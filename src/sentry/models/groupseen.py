from django.conf import settings
from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, Model, region_silo_model, sane_repr
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey


@region_silo_model
class GroupSeen(Model):
    """
    Track when a group is last seen by a user.
    """

    __relocation_scope__ = RelocationScope.Excluded

    project = FlexibleForeignKey("sentry.Project")
    group = FlexibleForeignKey("sentry.Group")
    user_id = HybridCloudForeignKey(settings.AUTH_USER_MODEL, on_delete="CASCADE", db_index=False)
    last_seen = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_groupseen"
        unique_together = (("user_id", "group"),)

    __repr__ = sane_repr("project_id", "group_id", "user_id", "last_seen")
