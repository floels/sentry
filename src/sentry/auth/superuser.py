"""
Superuser in Sentry works differently than the native Django implementation.

In Sentry a user must achieve the following to be treated as a superuser:

- ``User.is_superuser`` must be True
- If configured, the user must be accessing Sentry from a privileged IP (``SUPERUSER_ALLOWED_IPS``)
- The user must have a valid 'superuser session', which is a secondary session on top of their
  standard auth. This session has a shorter lifespan.
"""

from __future__ import annotations

import ipaddress
import logging
from collections.abc import Container
from datetime import datetime, timedelta, timezone
from typing import Any, Never, TypeIs, overload

import orjson
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.core.signing import BadSignature
from django.http import HttpRequest
from django.utils import timezone as django_timezone
from django.utils.crypto import constant_time_compare, get_random_string
from rest_framework import serializers, status
from rest_framework.request import Request

from sentry import options
from sentry.api.exceptions import DataSecrecyError, SentryAPIException
from sentry.auth.elevated_mode import ElevatedMode, InactiveReason
from sentry.auth.services.auth.model import RpcAuthState
from sentry.auth.system import is_system_auth
from sentry.data_secrecy.data_secrecy_logic import should_allow_superuser_access
from sentry.models.organization import Organization
from sentry.organizations.services.organization import RpcUserOrganizationContext
from sentry.types.request import _HttpRequestWithUser, _RequestWithUser
from sentry.users.models.user import User
from sentry.utils import metrics
from sentry.utils.auth import has_completed_sso
from sentry.utils.settings import is_self_hosted

logger = logging.getLogger("sentry.superuser")

SESSION_KEY = "_su"

COOKIE_NAME = getattr(settings, "SUPERUSER_COOKIE_NAME", "su")

COOKIE_SALT = getattr(settings, "SUPERUSER_COOKIE_SALT", "")

COOKIE_SECURE = getattr(settings, "SUPERUSER_COOKIE_SECURE", settings.SESSION_COOKIE_SECURE)

COOKIE_DOMAIN = getattr(settings, "SUPERUSER_COOKIE_DOMAIN", settings.SESSION_COOKIE_DOMAIN)

COOKIE_PATH = getattr(settings, "SUPERUSER_COOKIE_PATH", settings.SESSION_COOKIE_PATH)

COOKIE_HTTPONLY = getattr(settings, "SUPERUSER_COOKIE_HTTPONLY", True)

# the maximum time the session can stay alive
MAX_AGE = getattr(settings, "SUPERUSER_MAX_AGE", timedelta(hours=4))

# the maximum time the session can stay alive when accessing different orgs
MAX_AGE_PRIVILEGED_ORG_ACCESS = getattr(
    settings, "MAX_AGE_PRIVILEGED_ORG_ACCESS", timedelta(hours=1)
)

# the maximum time the session can stay alive without making another request
IDLE_MAX_AGE = getattr(settings, "SUPERUSER_IDLE_MAX_AGE", timedelta(minutes=15))

ALLOWED_IPS = frozenset(getattr(settings, "SUPERUSER_ALLOWED_IPS", settings.INTERNAL_IPS) or ())

SUPERUSER_ORG_ID = getattr(settings, "SUPERUSER_ORG_ID", None)

SUPERUSER_ACCESS_CATEGORIES = getattr(settings, "SUPERUSER_ACCESS_CATEGORIES", ["for_unit_test"])

UNSET = object()

DISABLE_SU_FORM_U2F_CHECK_FOR_LOCAL = getattr(
    settings, "DISABLE_SU_FORM_U2F_CHECK_FOR_LOCAL", False
)

SUPERUSER_SCOPES = settings.SENTRY_SCOPES.union({"org:superuser"})

SUPERUSER_READONLY_SCOPES = settings.SENTRY_READONLY_SCOPES.union({"org:superuser"})


def get_superuser_scopes(
    auth_state: RpcAuthState,
    user: Any,
    organization_context: Organization | RpcUserOrganizationContext,
) -> set[str]:

    if not should_allow_superuser_access(organization_context):
        raise DataSecrecyError()

    superuser_scopes = SUPERUSER_SCOPES
    if (
        not is_self_hosted()
        and options.get("superuser.read-write.ga-rollout")
        and "superuser.write" not in auth_state.permissions
    ):
        superuser_scopes = SUPERUSER_READONLY_SCOPES

    return superuser_scopes


def superuser_has_permission(
    request: HttpRequest, permissions: Container[str] | None = None
) -> bool:
    """
    This is used in place of is_active_superuser() in APIs / permission classes.
    Checks if superuser has permission for the request.
    Superuser read-only is restricted to GET and OPTIONS requests.
    These checks do not affect self-hosted.

    The `permissions` arg is passed in and used when request.access is not populated,
    e.g. in UserPermission
    """
    if not is_active_superuser(request):
        return False

    if is_self_hosted():
        return True

    # if we aren't enforcing superuser read-write, then superuser always has access
    if not options.get("superuser.read-write.ga-rollout"):
        return True

    # either request.access or permissions must exist
    assert getattr(request, "access", None) or permissions is not None

    # superuser write can access all requests
    if getattr(request, "access", None) and request.access.has_permission("superuser.write"):
        return True

    elif permissions is not None and "superuser.write" in permissions:
        return True

    # superuser read-only can only hit GET and OPTIONS (pre-flight) requests
    return request.method == "GET" or request.method == "OPTIONS"


@overload
def is_active_superuser(request: Request) -> TypeIs[_RequestWithUser]: ...


@overload
def is_active_superuser(request: HttpRequest) -> TypeIs[_HttpRequestWithUser]: ...


def is_active_superuser(request: HttpRequest) -> bool:
    if is_system_auth(getattr(request, "auth", None)):
        return True
    su = getattr(request, "superuser", None) or Superuser(request)
    return su.is_active


class SuperuserAccessSerializer(serializers.Serializer[Never]):
    superuserAccessCategory = serializers.ChoiceField(choices=SUPERUSER_ACCESS_CATEGORIES)
    superuserReason = serializers.CharField(min_length=4, max_length=128)


class SuperuserAccessFormInvalidJson(SentryAPIException):
    status_code = status.HTTP_400_BAD_REQUEST
    code = "invalid-superuser-access-json"
    message = "The request contains invalid json"


class Superuser(ElevatedMode):
    allowed_ips = frozenset(ipaddress.ip_network(str(v), strict=False) for v in ALLOWED_IPS)
    org_id = SUPERUSER_ORG_ID

    def _check_expired_on_org_change(self) -> bool:
        if self.expires is not None:
            session_start_time = self.expires - MAX_AGE
            current_datetime = django_timezone.now()
            if current_datetime - session_start_time > MAX_AGE_PRIVILEGED_ORG_ACCESS:
                logger.warning(
                    "superuser.privileged_org_access_expired",
                    extra={"superuser_token": self.token},
                )
                self.set_logged_out()
                return False
        return self._is_active

    def __init__(self, request, allowed_ips=UNSET, org_id=UNSET, current_datetime=None):
        self.uid: str | None = None
        self.request = request
        if allowed_ips is not UNSET:
            self.allowed_ips = frozenset(
                ipaddress.ip_network(str(v), strict=False) for v in allowed_ips or ()
            )
        if org_id is not UNSET:
            self.org_id = org_id
        self._populate(current_datetime=current_datetime)

    @staticmethod
    def _needs_validation() -> bool:
        self_hosted = is_self_hosted()
        logger.info(
            "superuser.needs-validation",
            extra={
                "DISABLE_SU_FORM_U2F_CHECK_FOR_LOCAL": DISABLE_SU_FORM_U2F_CHECK_FOR_LOCAL,
                "self_hosted": self_hosted,
            },
        )
        if self_hosted or DISABLE_SU_FORM_U2F_CHECK_FOR_LOCAL:
            return False
        return settings.VALIDATE_SUPERUSER_ACCESS_CATEGORY_AND_REASON

    @property
    def is_active(self) -> bool:
        org = getattr(self.request, "organization", None)
        if org and org.id != self.org_id:
            return self._check_expired_on_org_change()
        # We have a wsgi request with no user or user is None.
        if not hasattr(self.request, "user") or self.request.user is None:
            return False
        # if we've been logged out
        if not self.request.user.is_authenticated:
            return False
        # if superuser status was changed
        if not self.request.user.is_superuser:
            return False
        # if the user has changed
        if str(self.request.user.id) != self.uid:
            return False
        return self._is_active

    def is_privileged_request(self) -> tuple[bool, InactiveReason]:
        """
        Returns ``(bool is_privileged, RequestStatus reason)``
        """
        allowed_ips = self.allowed_ips
        # if we've bound superuser to an organization they must
        # have completed SSO to gain status
        if self.org_id and not has_completed_sso(self.request, self.org_id):
            return False, InactiveReason.INCOMPLETE_SSO

        # if there's no IPs configured, we allow assume its the same as *
        if not allowed_ips:
            return True, InactiveReason.NONE
        ip = ipaddress.ip_address(str(self.request.META["REMOTE_ADDR"]))
        if not any(ip in addr for addr in allowed_ips):
            return False, InactiveReason.INVALID_IP
        return True, InactiveReason.NONE

    def get_session_data(self, current_datetime=None):
        """
        Return the current session data, with native types coerced.
        """
        request = self.request

        try:
            cookie_token = request.get_signed_cookie(
                key=COOKIE_NAME, default=None, salt=COOKIE_SALT, max_age=MAX_AGE.total_seconds()
            )
        except BadSignature:
            logger.exception(
                "superuser.bad-cookie-signature",
                extra={"ip_address": request.META["REMOTE_ADDR"], "user_id": request.user.id},
            )
            return

        data = request.session.get(SESSION_KEY)
        if not cookie_token:
            if data:
                logger.warning(
                    "superuser.missing-cookie-token",
                    extra={"ip_address": request.META["REMOTE_ADDR"], "user_id": request.user.id},
                )
            return
        elif not data:
            logger.warning(
                "superuser.missing-session-data",
                extra={"ip_address": request.META["REMOTE_ADDR"], "user_id": request.user.id},
            )
            return

        session_token = data.get("tok")
        if not session_token:
            logger.warning(
                "superuser.missing-session-token",
                extra={"ip_address": request.META["REMOTE_ADDR"], "user_id": request.user.id},
            )
            return

        if not constant_time_compare(cookie_token, session_token):
            logger.warning(
                "superuser.invalid-token",
                extra={"ip_address": request.META["REMOTE_ADDR"], "user_id": request.user.id},
            )
            return

        if data["uid"] != str(request.user.id):
            logger.warning(
                "superuser.invalid-uid",
                extra={
                    "ip_address": request.META["REMOTE_ADDR"],
                    "user_id": request.user.id,
                    "expected_user_id": data["uid"],
                },
            )
            return

        if current_datetime is None:
            current_datetime = django_timezone.now()

        try:
            data["idl"] = datetime.fromtimestamp(float(data["idl"]), timezone.utc)
        except (TypeError, ValueError):
            logger.warning(
                "superuser.invalid-idle-expiration",
                extra={"ip_address": request.META["REMOTE_ADDR"], "user_id": request.user.id},
                exc_info=True,
            )
            return

        if data["idl"] < current_datetime:
            logger.info(
                "superuser.session-expired",
                extra={"ip_address": request.META["REMOTE_ADDR"], "user_id": request.user.id},
            )
            return

        try:
            data["exp"] = datetime.fromtimestamp(float(data["exp"]), timezone.utc)
        except (TypeError, ValueError):
            logger.warning(
                "superuser.invalid-expiration",
                extra={"ip_address": request.META["REMOTE_ADDR"], "user_id": request.user.id},
                exc_info=True,
            )
            return

        if data["exp"] < current_datetime:
            logger.info(
                "superuser.session-expired",
                extra={"ip_address": request.META["REMOTE_ADDR"], "user_id": request.user.id},
            )
            return

        return data

    def _populate(self, current_datetime=None) -> None:
        if current_datetime is None:
            current_datetime = django_timezone.now()

        request = self.request
        user = getattr(request, "user", None)
        if not hasattr(request, "session"):
            data = None
        elif not (user and user.is_superuser):
            data = None
        else:
            data = self.get_session_data(current_datetime=current_datetime)

        if not data:
            self._set_logged_out()
        else:
            self._set_logged_in(expires=data["exp"], token=data["tok"], user=user)

            if not self.is_active:
                if self._inactive_reason:
                    logger.warning(
                        "superuser.%s",
                        self._inactive_reason,
                        extra={
                            "ip_address": request.META["REMOTE_ADDR"],
                            "user_id": request.user.id,
                        },
                    )
                else:
                    logger.warning(
                        "superuser.inactive-unknown-reason",
                        extra={
                            "ip_address": request.META["REMOTE_ADDR"],
                            "user_id": request.user.id,
                        },
                    )

    def _set_logged_in(self, expires, token, user, current_datetime=None) -> None:
        # we bind uid here, as if you change users in the same request
        # we wouldn't want to still support superuser auth (given
        # the superuser check happens right here)
        assert user.is_superuser
        if current_datetime is None:
            current_datetime = django_timezone.now()
        self.token = token
        self.uid = str(user.id)
        # the absolute maximum age of this session
        self.expires = expires
        # do we have a valid superuser session?
        self.is_valid = True
        # is the session active? (it could be valid, but inactive)
        self._is_active, self._inactive_reason = self.is_privileged_request()
        self.request.session[SESSION_KEY] = {
            "exp": self.expires.strftime("%s"),
            "idl": (current_datetime + IDLE_MAX_AGE).strftime("%s"),
            "tok": self.token,
            # XXX(dcramer): do we really need the uid safety mechanism
            "uid": self.uid,
        }

    def _set_logged_out(self) -> None:
        self.uid = None
        self.expires = None
        self.token = None
        self._is_active = False
        self._inactive_reason = InactiveReason.NONE
        self.is_valid = False
        self.request.session.pop(SESSION_KEY, None)

    def set_logged_in(
        self,
        user: User | AnonymousUser,
        current_datetime: datetime | None = None,
        prefilled_su_modal=None,
    ) -> None:
        """
        Mark a session as superuser-enabled.
        """
        request = self.request
        if current_datetime is None:
            current_datetime = django_timezone.now()

        token = get_random_string(12)

        def enable_and_log_superuser_access():
            self._set_logged_in(
                expires=current_datetime + MAX_AGE,
                token=token,
                user=user,
                current_datetime=current_datetime,
            )

            metrics.incr(
                "superuser.success",
                sample_rate=1.0,
            )

            logger.info(
                "superuser.logged-in",
                extra={"ip_address": request.META["REMOTE_ADDR"], "user_id": user.id},
            )

        if not self._needs_validation():
            enable_and_log_superuser_access()
            return

        if prefilled_su_modal:
            su_access_json = prefilled_su_modal
        else:
            try:
                # need to use json loads as the data is no longer in request.data
                su_access_json = orjson.loads(request.body)
            except orjson.JSONDecodeError:
                metrics.incr(
                    "superuser.failure",
                    sample_rate=1.0,
                    tags={"reason": SuperuserAccessFormInvalidJson.code},
                )
                raise SuperuserAccessFormInvalidJson()

        su_access_info = SuperuserAccessSerializer(data=su_access_json)

        if not su_access_info.is_valid():
            raise serializers.ValidationError(su_access_info.errors)

        try:
            logger.info(
                "superuser.superuser_access",
                extra={
                    "superuser_token_id": token,
                    "user_id": request.user.id,
                    "user_email": request.user.email,
                    "su_access_category": su_access_info.validated_data["superuserAccessCategory"],
                    "reason_for_su": su_access_info.validated_data["superuserReason"],
                },
            )
            enable_and_log_superuser_access()
        except AttributeError:
            metrics.incr("superuser.failure", sample_rate=1.0, tags={"reason": "missing-user-info"})
            logger.exception("superuser.superuser_access.missing_user_info")

    def set_logged_out(self) -> None:
        """
        Mark a session as superuser-disabled.
        """
        request = self.request
        self._set_logged_out()
        logger.info(
            "superuser.logged-out",
            extra={"ip_address": request.META["REMOTE_ADDR"], "user_id": request.user.id},
        )

    def on_response(self, response) -> None:
        request = self.request

        # always re-bind the cookie to update the idle expiration window
        if self.is_active:
            response.set_signed_cookie(
                COOKIE_NAME,
                self.token,
                salt=COOKIE_SALT,
                # set max_age to None, as we want this cookie to expire on browser close
                max_age=None,
                secure=request.is_secure() if COOKIE_SECURE is None else COOKIE_SECURE,
                httponly=COOKIE_HTTPONLY,
                path=COOKIE_PATH,
                domain=COOKIE_DOMAIN,
            )
        # otherwise, if the session is invalid and there's a cookie set, clear it
        elif not self.is_valid and request.COOKIES.get(COOKIE_NAME):
            response.delete_cookie(COOKIE_NAME)
