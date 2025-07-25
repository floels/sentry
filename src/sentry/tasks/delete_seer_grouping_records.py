import logging
from collections.abc import Sequence
from typing import Any

from sentry import options
from sentry.models.group import Group
from sentry.models.grouphash import GroupHash
from sentry.seer.similarity.grouping_records import (
    call_seer_to_delete_project_grouping_records,
    call_seer_to_delete_these_hashes,
)
from sentry.seer.similarity.utils import ReferrerOptions, killswitch_enabled
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.config import TaskworkerConfig
from sentry.taskworker.namespaces import seer_tasks
from sentry.utils import metrics
from sentry.utils.query import RangeQuerySetWrapper

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.tasks.delete_seer_grouping_records_by_hash",
    queue="delete_seer_grouping_records_by_hash",
    max_retries=0,  # XXX: Why do we not retry?
    silo_mode=SiloMode.REGION,
    soft_time_limit=60 * 15,
    time_limit=60 * (15 + 5),
    taskworker_config=TaskworkerConfig(
        namespace=seer_tasks,
        processing_deadline_duration=60 * (15 + 5),
    ),
)
def delete_seer_grouping_records_by_hash(
    project_id: int,
    hashes: Sequence[str],
    last_deleted_index: int = 0,
    *args: Any,
    **kwargs: Any,
) -> None:
    """
    Task to delete seer grouping records by hash list.
    Calls the seer delete by hash endpoint with batches of hashes of size `batch_size`.
    """
    if killswitch_enabled(project_id, ReferrerOptions.DELETION) or options.get(
        "seer.similarity-embeddings-delete-by-hash-killswitch.enabled"
    ):
        return

    batch_size = options.get("embeddings-grouping.seer.delete-record-batch-size") or 100
    len_hashes = len(hashes)
    if len_hashes <= batch_size:  # Base case
        call_seer_to_delete_these_hashes(project_id, hashes)
    else:
        if last_deleted_index != 0:
            # This tracks which tasks are still being scheduled with the whole list of hashes
            metrics.incr(
                "grouping.similarity.delete_seer_grouping_records_by_hash.batch_size_exceeded",
                sample_rate=options.get("seer.similarity.metrics_sample_rate"),
            )

        # Iterate through hashes in chunks and schedule a task for each chunk
        # There are tasks passing last_deleted_index, thus, we need to start from that index
        # Eventually all tasks will pass 0
        for i in range(last_deleted_index, len_hashes, batch_size):
            # Slice operations are safe and will not raise IndexError
            chunked_hashes = hashes[i : i + batch_size]
            delete_seer_grouping_records_by_hash.apply_async(args=[project_id, chunked_hashes, 0])


def may_schedule_task_to_delete_hashes_from_seer(
    group_ids: Sequence[int],
) -> None:
    project = None
    if group_ids:
        group = Group.objects.get(id=group_ids[0])
        project = group.project if group else None
    if (
        project
        and project.get_option("sentry:similarity_backfill_completed")
        and not killswitch_enabled(project.id, ReferrerOptions.DELETION)
        and not options.get("seer.similarity-embeddings-delete-by-hash-killswitch.enabled")
    ):
        group_hashes = []
        batch_size = options.get("embeddings-grouping.seer.delete-record-batch-size") or 100

        for group_hash in RangeQuerySetWrapper(
            GroupHash.objects.filter(project_id=project.id, group__id__in=group_ids),
            step=batch_size,
        ):
            group_hashes.append(group_hash.hash)

            # Schedule task when we reach batch_size
            if len(group_hashes) >= batch_size:
                delete_seer_grouping_records_by_hash.apply_async(args=[project.id, group_hashes, 0])
                group_hashes = []

        # Handle any remaining hashes
        if group_hashes:
            delete_seer_grouping_records_by_hash.apply_async(args=[project.id, group_hashes, 0])


@instrumented_task(
    name="sentry.tasks.call_seer_delete_project_grouping_records",
    queue="delete_seer_grouping_records_by_hash",
    max_retries=0,
    silo_mode=SiloMode.REGION,
    soft_time_limit=60 * 15,
    time_limit=60 * (15 + 5),
    taskworker_config=TaskworkerConfig(
        namespace=seer_tasks,
        processing_deadline_duration=60 * (15 + 5),
    ),
)
def call_seer_delete_project_grouping_records(
    project_id: int,
    *args: Any,
    **kwargs: Any,
) -> None:
    if killswitch_enabled(project_id, ReferrerOptions.DELETION) or options.get(
        "seer.similarity-embeddings-delete-by-hash-killswitch.enabled"
    ):
        return

    logger.info("calling seer delete records by project", extra={"project_id": project_id})
    call_seer_to_delete_project_grouping_records(project_id)
