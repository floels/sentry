from urllib.parse import parse_qs

from django.urls import reverse

from sentry.testutils import TestCase
from sentry.testutils.silo import control_silo_test

PROXY_URL_PREFIX = "https://sentry.example.com"


@control_silo_test
class AsanaSocialAuthTest(TestCase):
    def test_redirect_uri_with_proxy(self):
        with self.options({"system.url-prefix": PROXY_URL_PREFIX}):
            response = self.client.post(
                reverse("socialauth_associate", kwargs={"backend": "asana"})
            )

        assert response.status_code == 302

        redirect_uri = parse_qs(response.url)["redirect_uri"][0]
        assert redirect_uri.startswith(PROXY_URL_PREFIX)
