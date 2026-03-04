from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Json

from ingestion_service.config import DATABASE_URL
from ingestion_service.issues import issue_fields

_UNSET = object()


@contextmanager
def get_conn() -> Iterator[psycopg.Connection]:
    with psycopg.connect(DATABASE_URL, row_factory=dict_row) as conn:
        conn.execute("SET search_path TO public, audit, stg;")
        yield conn


def _new_batch_public_id(dataset: str) -> str:
    # Public batch id for UI/API: <dataset>-<UTC timestamp>-<sequence slot>.
    ts = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S%f")[:17]
    return f"{dataset}-{ts}-00"


def resolve_batch_uuid(batch_ref: str) -> str | None:
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            select batch_id::text as batch_id
            from audit.batches
            where batch_id::text = %s
               or batch_public_id = %s
            limit 1
            """,
            (batch_ref, batch_ref),
        )
        row = cur.fetchone()
        return str(row["batch_id"]) if row else None


def create_batch(dataset: str, source_file: Path) -> dict[str, str]:
    public_id = _new_batch_public_id(dataset)
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            insert into audit.batches (dataset, status, source_file, batch_public_id)
            values (%s, 'UPLOADED', %s, %s)
            returning batch_id::text, batch_public_id
            """,
            (dataset, str(source_file), public_id),
        )
        row = cur.fetchone()
        conn.commit()
        return {
            "batch_id": row["batch_public_id"],
            "internal_batch_id": row["batch_id"],
        }


def create_rerun_batch(source_batch_id: str) -> dict[str, str]:
    source_uuid = resolve_batch_uuid(source_batch_id)
    if not source_uuid:
        raise ValueError(f"Batch not found: {source_batch_id}")

    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            select dataset, source_file
            from audit.batches
            where batch_id = %s::uuid
            """,
            (source_uuid,),
        )
        source = cur.fetchone()
        if not source:
            raise ValueError(f"Batch not found: {source_batch_id}")
        public_id = _new_batch_public_id(str(source["dataset"]))
        cur.execute(
            """
            insert into audit.batches (dataset, status, source_file, batch_public_id)
            values (%s, 'UPLOADED', %s, %s)
            returning batch_id::text, batch_public_id
            """,
            (source["dataset"], source["source_file"], public_id),
        )
        row = cur.fetchone()
        conn.commit()
        return {
            "batch_id": row["batch_public_id"],
            "internal_batch_id": row["batch_id"],
        }


def get_batch(batch_id: str) -> dict[str, Any] | None:
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            select batch_public_id as batch_id,
                   batch_id::text as internal_batch_id,
                   dataset, status, source_file,
                   failed_step, failed_reason, total_rows, loaded_rows,
                   rejected_rows, reject_rate, created_at, updated_at, run_count
            from audit.batches
            where batch_id::text = %s
               or batch_public_id = %s
            limit 1
            """,
            (batch_id, batch_id),
        )
        return cur.fetchone()


def list_batches(dataset: str | None, status: str | None) -> list[dict[str, Any]]:
    clauses = []
    args: list[Any] = []
    if dataset:
        clauses.append("dataset = %s")
        args.append(dataset)
    if status:
        clauses.append("status = %s")
        args.append(status)

    where_sql = f"where {' and '.join(clauses)}" if clauses else ""
    query = f"""
        select batch_public_id as batch_id,
               batch_id::text as internal_batch_id,
               dataset, status, failed_step,
               total_rows, loaded_rows, rejected_rows, reject_rate,
               created_at, updated_at, run_count
        from audit.batches
        {where_sql}
        order by created_at desc
    """
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            query,
            args,
        )
        return cur.fetchall()


def touch_batch(
    batch_id: str,
    *,
    status: str | None | object = _UNSET,
    failed_step: str | None | object = _UNSET,
    failed_reason: str | None | object = _UNSET,
    total_rows: int | None | object = _UNSET,
    loaded_rows: int | None | object = _UNSET,
    rejected_rows: int | None | object = _UNSET,
    reject_rate: float | None | object = _UNSET,
    increment_run_count: bool = False,
) -> None:
    internal_batch_id = resolve_batch_uuid(batch_id)
    if not internal_batch_id:
        return

    updates = ["updated_at = %s"]
    args: list[Any] = [datetime.utcnow()]

    if status is not _UNSET:
        updates.append("status = %s")
        args.append(status)
    if failed_step is not _UNSET:
        updates.append("failed_step = %s")
        args.append(failed_step)
    if failed_reason is not _UNSET:
        updates.append("failed_reason = %s")
        args.append(failed_reason)
    if total_rows is not _UNSET:
        updates.append("total_rows = %s")
        args.append(total_rows)
    if loaded_rows is not _UNSET:
        updates.append("loaded_rows = %s")
        args.append(loaded_rows)
    if rejected_rows is not _UNSET:
        updates.append("rejected_rows = %s")
        args.append(rejected_rows)
    if reject_rate is not _UNSET:
        updates.append("reject_rate = %s")
        args.append(reject_rate)
    if increment_run_count:
        updates.append("run_count = run_count + 1")

    args.append(internal_batch_id)
    set_sql = ", ".join(updates)
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            f"update audit.batches set {set_sql} where batch_id = %s::uuid",
            args,
        )
        conn.commit()


def get_rejected_rows(batch_id: str) -> list[dict[str, Any]]:
    internal_batch_id = resolve_batch_uuid(batch_id)
    if not internal_batch_id:
        return []

    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            select id, %s as batch_id, dataset, row_num,
                   error_type, error_message, raw_payload, created_at
            from stg.rejected_rows
            where batch_id = %s::uuid
              and exists (
                  select 1
                  from audit.batch_issue_links bil
                  join audit.ingestion_issues ii on ii.issue_id = bil.issue_id
                  where bil.batch_id = stg.rejected_rows.batch_id
                    and bil.rejected_row_id = stg.rejected_rows.id
                    and bil.state = 'ACTIVE'
                    and ii.status = 'OPEN'
              )
            order by row_num asc, id asc
            """,
            (batch_id, internal_batch_id),
        )
        return cur.fetchall()


def get_rejected_row(batch_id: str, rejected_id: int) -> dict[str, Any] | None:
    internal_batch_id = resolve_batch_uuid(batch_id)
    if not internal_batch_id:
        return None

    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            select id, %s as batch_id, dataset, row_num,
                   error_type, error_message, raw_payload, created_at
            from stg.rejected_rows
            where batch_id = %s::uuid and id = %s
              and exists (
                  select 1
                  from audit.batch_issue_links bil
                  join audit.ingestion_issues ii on ii.issue_id = bil.issue_id
                  where bil.batch_id = stg.rejected_rows.batch_id
                    and bil.rejected_row_id = stg.rejected_rows.id
                    and bil.state = 'ACTIVE'
                    and ii.status = 'OPEN'
              )
            """,
            (batch_id, internal_batch_id, rejected_id),
        )
        return cur.fetchone()


def delete_rejected_row(batch_id: str, rejected_id: int) -> bool:
    internal_batch_id = resolve_batch_uuid(batch_id)
    if not internal_batch_id:
        return False

    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            update audit.batch_issue_links
            set state = 'CLOSED', updated_at = now()
            where batch_id = %s::uuid and rejected_row_id = %s
            """,
            (internal_batch_id, rejected_id),
        )
        cur.execute(
            """
            delete from stg.rejected_rows
            where batch_id = %s::uuid and id = %s
            """,
            (internal_batch_id, rejected_id),
        )
        deleted = cur.rowcount > 0
        conn.commit()
        return deleted


def resolve_issue_and_delete_links(batch_id: str, rejected_id: int, resolved_by_batch_id: str) -> list[str]:
    internal_batch_id = resolve_batch_uuid(batch_id)
    internal_resolved_by = resolve_batch_uuid(resolved_by_batch_id)
    if not internal_batch_id or not internal_resolved_by:
        return []

    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            select bil.issue_id
            from audit.batch_issue_links bil
            where bil.batch_id = %s::uuid
              and bil.rejected_row_id = %s
            limit 1
            """,
            (internal_batch_id, rejected_id),
        )
        row = cur.fetchone()
        if not row:
            return []
        issue_id = int(row["issue_id"])

        cur.execute(
            """
            update audit.ingestion_issues
            set status = 'RESOLVED',
                resolved_at = now(),
                resolved_by_batch_id = %s::uuid,
                updated_at = now()
            where issue_id = %s
            """,
            (internal_resolved_by, issue_id),
        )

        cur.execute(
            """
            select b.batch_public_id as batch_id, bil.rejected_row_id
            from audit.batch_issue_links bil
            join audit.batches b on b.batch_id = bil.batch_id
            where bil.issue_id = %s
              and bil.state = 'ACTIVE'
            """,
            (issue_id,),
        )
        active_links = cur.fetchall()
        if not active_links:
            conn.commit()
            return []

        affected_batches = sorted({str(item["batch_id"]) for item in active_links})
        rejected_ids = [int(item["rejected_row_id"]) for item in active_links]

        cur.execute(
            """
            update audit.batch_issue_links
            set state = 'SOLVED',
                updated_at = now()
            where issue_id = %s
              and state = 'ACTIVE'
            """,
            (issue_id,),
        )
        cur.execute(
            """
            delete from stg.rejected_rows
            where id = any(%s::bigint[])
            """,
            (rejected_ids,),
        )
        conn.commit()
        return affected_batches


def backfill_issue_links_for_batch(batch_id: str) -> int:
    internal_batch_id = resolve_batch_uuid(batch_id)
    if not internal_batch_id:
        return 0

    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            select rr.id, rr.dataset, rr.row_num, rr.error_type, rr.error_message, rr.raw_payload
            from stg.rejected_rows rr
            where rr.batch_id = %s::uuid
              and not exists (
                  select 1
                  from audit.batch_issue_links bil
                  where bil.batch_id = rr.batch_id
                    and bil.rejected_row_id = rr.id
              )
            order by rr.id asc
            """,
            (internal_batch_id,),
        )
        rows = cur.fetchall()
        created = 0
        for row in rows:
            raw_payload = dict(row["raw_payload"] or {})
            issue = issue_fields(
                dataset=str(row["dataset"]),
                error_type=str(row["error_type"]),
                error_message=str(row["error_message"]),
                raw_payload=raw_payload,
            )
            cur.execute(
                """
                insert into audit.ingestion_issues (
                    issue_fingerprint, dataset, issue_kind,
                    conflict_merchant_key, conflict_start_period, conflict_end_period,
                    error_type, error_message, raw_payload, status, resolved_at, resolved_by_batch_id, last_seen_at, updated_at
                )
                values (
                    %s, %s, %s,
                    %s::uuid, %s::date, %s::date,
                    %s, %s, %s, 'OPEN', null, null, now(), now()
                )
                on conflict (issue_fingerprint) do update
                set dataset = excluded.dataset,
                    issue_kind = excluded.issue_kind,
                    conflict_merchant_key = excluded.conflict_merchant_key,
                    conflict_start_period = excluded.conflict_start_period,
                    conflict_end_period = excluded.conflict_end_period,
                    error_type = excluded.error_type,
                    error_message = excluded.error_message,
                    raw_payload = excluded.raw_payload,
                    status = 'OPEN',
                    resolved_at = null,
                    resolved_by_batch_id = null,
                    last_seen_at = now(),
                    updated_at = now()
                returning issue_id
                """,
                (
                    issue["fingerprint"],
                    str(row["dataset"]),
                    issue["kind"],
                    issue["merchant_key"],
                    issue["start_period"],
                    issue["end_period"],
                    str(row["error_type"]),
                    str(row["error_message"]),
                    Json(raw_payload),
                ),
            )
            issue_id = int(cur.fetchone()["issue_id"])
            cur.execute(
                """
                insert into audit.batch_issue_links (batch_id, issue_id, rejected_row_id, row_num, state, updated_at)
                values (%s::uuid, %s, %s, %s, 'ACTIVE', now())
                on conflict (batch_id, rejected_row_id) do nothing
                """,
                (internal_batch_id, issue_id, int(row["id"]), int(row["row_num"])),
            )
            created += 1
        conn.commit()
        return created


def backfill_issue_links_all() -> dict[str, int]:
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute("select distinct batch_id::text as batch_id from stg.rejected_rows")
        batches = [str(row["batch_id"]) for row in cur.fetchall()]

    total_links = 0
    touched_batches = 0
    for batch_id in batches:
        created = backfill_issue_links_for_batch(batch_id)
        if created > 0:
            touched_batches += 1
            total_links += created
    return {
        "batch_count": len(batches),
        "touched_batches": touched_batches,
        "created_links": total_links,
    }
