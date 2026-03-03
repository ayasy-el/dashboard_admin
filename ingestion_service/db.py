from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Any, Iterator

import psycopg
from psycopg.rows import dict_row

from ingestion_service.config import DATABASE_URL

_UNSET = object()


@contextmanager
def get_conn() -> Iterator[psycopg.Connection]:
    with psycopg.connect(DATABASE_URL, row_factory=dict_row) as conn:
        conn.execute("SET search_path TO public, audit, stg;")
        yield conn


def create_batch(dataset: str, source_file: Path) -> str:
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            insert into audit.batches (dataset, status, source_file)
            values (%s, 'UPLOADED', %s)
            returning batch_id::text
            """,
            (dataset, str(source_file)),
        )
        row = cur.fetchone()
        conn.commit()
        return row["batch_id"]


def create_rerun_batch(source_batch_id: str) -> str:
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            insert into audit.batches (dataset, status, source_file)
            select dataset, 'UPLOADED', source_file
            from audit.batches
            where batch_id = %s::uuid
            returning batch_id::text
            """,
            (source_batch_id,),
        )
        row = cur.fetchone()
        if not row:
            raise ValueError(f"Batch not found: {source_batch_id}")
        conn.commit()
        return row["batch_id"]


def get_batch(batch_id: str) -> dict[str, Any] | None:
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            select batch_id::text as batch_id, dataset, status, source_file,
                   failed_step, failed_reason, total_rows, loaded_rows,
                   rejected_rows, reject_rate, created_at, updated_at, run_count
            from audit.batches
            where batch_id = %s::uuid
            """,
            (batch_id,),
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
        select batch_id::text as batch_id, dataset, status, failed_step,
               total_rows, loaded_rows, rejected_rows, reject_rate,
               created_at, updated_at, run_count
        from audit.batches
        {where_sql}
        order by created_at desc
    """
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(query, args)
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

    args.append(batch_id)
    set_sql = ", ".join(updates)
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            f"update audit.batches set {set_sql} where batch_id = %s::uuid",
            args,
        )
        conn.commit()


def get_rejected_rows(batch_id: str) -> list[dict[str, Any]]:
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            select id, batch_id::text as batch_id, dataset, row_num,
                   error_type, error_message, raw_payload, created_at
            from stg.rejected_rows
            where batch_id = %s::uuid
            order by row_num asc, id asc
            """,
            (batch_id,),
        )
        return cur.fetchall()


def get_rejected_row(batch_id: str, rejected_id: int) -> dict[str, Any] | None:
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            select id, batch_id::text as batch_id, dataset, row_num,
                   error_type, error_message, raw_payload, created_at
            from stg.rejected_rows
            where batch_id = %s::uuid and id = %s
            """,
            (batch_id, rejected_id),
        )
        return cur.fetchone()


def delete_rejected_row(batch_id: str, rejected_id: int) -> bool:
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            delete from stg.rejected_rows
            where batch_id = %s::uuid and id = %s
            """,
            (batch_id, rejected_id),
        )
        deleted = cur.rowcount > 0
        conn.commit()
        return deleted
