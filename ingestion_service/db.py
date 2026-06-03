from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator
import threading
import logging

import psycopg
from psycopg.rows import dict_row

from ingestion_service.config import DATABASE_URL

_UNSET = object()

logger = logging.getLogger(__name__)
MATERIALIZED_VIEWS = (
    "public.vw_overview_transaction",
    "public.vw_merchant_tx_monthly_agg",
    "public.vw_rule_merchant_dim",
)

RAW_TABLES = {
    "list_kota": "list_kota_raw",
    "master": "master_raw",
    "transactions": "transactions_raw",
    "total_point": "total_point_raw",
}

CLEAN_TABLES = {
    "list_kota": "list_kota_clean",
    "master": "master_clean",
    "transactions": "transactions_clean",
    "total_point": "total_point_clean",
}


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


def count_rejected_rows(batch_id: str) -> int:
    internal_batch_id = resolve_batch_uuid(batch_id)
    if not internal_batch_id:
        return 0

    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            select count(*) as total
            from audit.batch_issue_links bil
            join audit.ingestion_issues ii on ii.issue_id = bil.issue_id
            where bil.batch_id = %s::uuid
              and bil.state = 'ACTIVE'
              and ii.status = 'OPEN'
            """,
            (internal_batch_id,),
        )
        row = cur.fetchone()
        return int(row["total"] or 0) if row else 0


def get_rejected_rows(batch_id: str, limit: int | None = None, offset: int = 0) -> list[dict[str, Any]]:
    internal_batch_id = resolve_batch_uuid(batch_id)
    if not internal_batch_id:
        return []

    query = """
        select bil.id, %s as batch_id, bil.dataset, bil.row_num,
               bil.error_type, bil.error_message, bil.raw_payload, bil.created_at
        from audit.batch_issue_links bil
        join audit.ingestion_issues ii on ii.issue_id = bil.issue_id
        where bil.batch_id = %s::uuid
          and bil.state = 'ACTIVE'
          and ii.status = 'OPEN'
        order by bil.row_num asc, bil.id asc
    """
    params: list[Any] = [batch_id, internal_batch_id]
    if limit is not None:
        query += " limit %s offset %s"
        params.extend([limit, max(offset, 0)])

    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(query, tuple(params))
        return cur.fetchall()


def get_rejected_row(batch_id: str, rejected_id: int) -> dict[str, Any] | None:
    internal_batch_id = resolve_batch_uuid(batch_id)
    if not internal_batch_id:
        return None

    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            select bil.id, %s as batch_id, bil.dataset, bil.row_num,
                   bil.error_type, bil.error_message, bil.raw_payload, bil.created_at
            from audit.batch_issue_links bil
            join audit.ingestion_issues ii on ii.issue_id = bil.issue_id
            where bil.batch_id = %s::uuid
              and bil.id = %s
              and bil.state = 'ACTIVE'
              and ii.status = 'OPEN'
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
            where batch_id = %s::uuid
              and id = %s
              and state = 'ACTIVE'
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
              and bil.id = %s
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
            select b.batch_public_id as batch_id
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
        conn.commit()
        return affected_batches


def count_source_file_references(source_file: str) -> int:
    if not source_file:
        return 0

    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            select count(*) as total
            from audit.batches
            where source_file = %s
            """,
            (source_file,),
        )
        row = cur.fetchone()
        return int(row["total"] or 0) if row else 0


def rollback_batch(batch_id: str) -> dict[str, Any]:
    internal_batch_id = resolve_batch_uuid(batch_id)
    if not internal_batch_id:
        raise ValueError(f"Batch not found: {batch_id}")

    try:
        with get_conn() as conn, conn.cursor() as cur:
            cur.execute(
                """
                select
                    batch_public_id as batch_id,
                    batch_id::text as internal_batch_id,
                    dataset,
                    status,
                    source_file
                from audit.batches
                where batch_id = %s::uuid
                for update
                """,
                (internal_batch_id,),
            )
            batch = cur.fetchone()
            if not batch:
                raise ValueError(f"Batch not found: {batch_id}")

            if batch["status"] != "SUCCESS":
                raise RuntimeError(f"Batch status {batch['status']} tidak bisa di-rollback")

            dataset = str(batch["dataset"])
            source_file = str(batch["source_file"] or "")
            deleted_rows: dict[str, int] = {}

            raw_table = RAW_TABLES.get(dataset)
            clean_table = CLEAN_TABLES.get(dataset)
            if raw_table and clean_table:
                cur.execute(
                    f"delete from stg.{raw_table} where batch_id = %s::uuid",
                    (internal_batch_id,),
                )
                deleted_rows[raw_table] = cur.rowcount
                cur.execute(
                    f"delete from stg.{clean_table} where batch_id = %s::uuid",
                    (internal_batch_id,),
                )
                deleted_rows[clean_table] = cur.rowcount

            if dataset == "transactions":
                cur.execute(
                    """
                    delete from public.fact_transaction
                    where source_batch_id = %s::uuid
                    """,
                    (internal_batch_id,),
                )
                deleted_rows["fact_transaction"] = cur.rowcount
            elif dataset == "total_point":
                cur.execute(
                    """
                    delete from public.fact_cluster_balance
                    where source_batch_id = %s::uuid
                    """,
                    (internal_batch_id,),
                )
                deleted_rows["fact_cluster_balance"] = cur.rowcount
            elif dataset == "master":
                cur.execute(
                    """
                    select count(*) as total
                    from public.fact_transaction ft
                    join public.dim_merchant dm on dm.merchant_key = ft.merchant_key
                    where dm.source_batch_id = %s::uuid
                    """,
                    (internal_batch_id,),
                )
                master_transaction_refs = int((cur.fetchone() or {}).get("total") or 0)
                if master_transaction_refs > 0:
                    reasons = []
                    if master_transaction_refs > 0:
                        reasons.append(f"{master_transaction_refs} transaksi")
                    raise RuntimeError(
                        "Batch master tidak bisa di-rollback karena masih ada "
                        f"{' dan '.join(reasons)} yang memakai merchant batch ini"
                    )

                cur.execute(
                    """
                    delete from public.dim_merchant dm
                    where dm.source_batch_id = %s::uuid
                    """,
                    (internal_batch_id,),
                )
                deleted_rows["dim_merchant"] = cur.rowcount

                cur.execute(
                    """
                    delete from public.dim_category dc
                    where dc.source_batch_id = %s::uuid
                      and not exists (
                        select 1
                        from public.dim_merchant dm
                        where dm.category_id = dc.category_id
                    )
                    """,
                    (internal_batch_id,),
                )
                deleted_rows["dim_category"] = cur.rowcount
            elif dataset == "list_kota":
                cur.execute(
                    """
                    delete from public.dim_cluster dcl
                    where dcl.source_batch_id = %s::uuid
                      and not exists (
                        select 1
                        from public.dim_merchant dm
                        where dm.cluster_id = dcl.cluster_id
                    )
                    """,
                    (internal_batch_id,),
                )
                deleted_rows["dim_cluster"] = cur.rowcount
            else:
                raise RuntimeError(f"Unsupported dataset: {dataset}")

            cur.execute(
                """
                with deleted_links as (
                  delete from audit.batch_issue_links
                  where batch_id = %s::uuid
                  returning issue_id
                ),
                orphan_issues as (
                  delete from audit.ingestion_issues ii
                  where ii.issue_id in (select distinct issue_id from deleted_links)
                    and not exists (
                      select 1
                      from audit.batch_issue_links bil
                      where bil.issue_id = ii.issue_id
                        and bil.state = 'ACTIVE'
                    )
                  returning issue_id
                )
                select
                  coalesce((select count(*) from deleted_links), 0) as deleted_links,
                  coalesce((select count(*) from orphan_issues), 0) as deleted_issues
                """,
                (internal_batch_id,),
            )
            cleanup = cur.fetchone() or {"deleted_links": 0, "deleted_issues": 0}

            cur.execute("delete from audit.batches where batch_id = %s::uuid", (internal_batch_id,))
            if cur.rowcount == 0:
                raise RuntimeError(f"Failed to delete batch: {batch_id}")

            conn.commit()
    except psycopg.Error as exc:
        raise RuntimeError(str(exc)) from exc

    return {
        "batch_id": batch["batch_id"],
        "internal_batch_id": batch["internal_batch_id"],
        "dataset": dataset,
        "source_file": source_file,
        "deleted_rows": deleted_rows,
        "deleted_links": int(cleanup["deleted_links"] or 0),
        "deleted_issues": int(cleanup["deleted_issues"] or 0),
    }


def refresh_materialized_views() -> None:
    conn = psycopg.connect(DATABASE_URL, row_factory=dict_row)
    try:
        conn.autocommit = True
        conn.execute("SET search_path TO public, audit, stg;")
        with conn.cursor() as cur:
            for view_name in MATERIALIZED_VIEWS:
                logger.info("Refreshing materialized view: %s", view_name)
                cur.execute(f"REFRESH MATERIALIZED VIEW CONCURRENTLY {view_name};")
    finally:
        conn.close()


def refresh_materialized_views_background() -> None:
    thread = threading.Thread(target=refresh_materialized_views, daemon=True)
    thread.start()
