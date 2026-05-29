from __future__ import annotations

import csv
import logging
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Any

from psycopg import errors
from psycopg import sql
from psycopg.types.json import Json

from ingestion_service.config import REJECT_THRESHOLD
from ingestion_service.db import (
    get_batch,
    get_conn,
    refresh_materialized_views_background,
    touch_batch,
)
from ingestion_service.issues import issue_fields
from ingestion_service.utils import (
    normalize_status,
    parse_date_master,
    parse_int_loose,
    parse_tx_timestamp,
    stable_bigint_id,
    stable_uuid,
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

logger = logging.getLogger(__name__)


class BatchError(RuntimeError):
    def __init__(self, status: str, step: str, message: str):
        super().__init__(message)
        self.status = status
        self.step = step


@dataclass
class BatchMetrics:
    total_rows: int
    loaded_rows: int
    rejected_rows: int


def _iso_date(value: Any) -> str | None:
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return str(value) if value is not None else None


def _parse_total_point_period(value: str) -> tuple[int, int]:
    raw = str(value or "").strip()
    if not raw:
        raise ValueError("period wajib diisi")

    token = raw.replace("/", "_").replace("-", "_")
    parts = [p for p in token.split("_") if p]
    if len(parts) != 2:
        raise ValueError(f"format period tidak valid: {raw}")

    if len(parts[0]) == 4:
        year = int(parts[0])
        month = int(parts[1])
    else:
        month = int(parts[0])
        year = int(parts[1])

    if month < 1 or month > 12:
        raise ValueError(f"bulan period tidak valid: {raw}")
    return month, year


def _build_master_load_error(cur, row: dict[str, Any], exc: Exception) -> tuple[str, str, dict[str, Any]]:
    payload = dict(row.get("raw_payload") or {})
    payload["__incoming"] = {
        "merchant_key": str(row.get("merchant_key")),
        "keyword": str(payload.get("keyword") or ""),
        "merchant_name": str(payload.get("merchant_name") or ""),
        "uniq_merchant": str(payload.get("uniq_merchant") or ""),
        "category": str(payload.get("category") or ""),
        "cluster": str(payload.get("cluster") or ""),
        "point_redeem": int(row.get("point_redeem") or 0),
        "start_period": _iso_date(row.get("start_period")),
        "end_period": _iso_date(row.get("end_period")),
    }

    if isinstance(exc, errors.ForeignKeyViolation):
        payload["__conflict"] = {
            "kind": "FK_VIOLATION",
            "constraint": getattr(getattr(exc, "diag", None), "constraint_name", ""),
            "incoming": payload["__incoming"],
            "can_auto_solve": False,
        }
        message = (
            "Referensi foreign key tidak valid. Data dependency belum ada "
            "(contoh merchant/cluster). Upload data referensi dulu lalu rerun."
        )
        return "FK_MISSING", message, payload

    return "LOAD_ERROR", str(exc), payload



def _read_csv_rows(path: Path) -> list[dict[str, str]]:
    sample = path.read_text(encoding="utf-8", errors="ignore")[:4096]
    delimiter = ";" if sample.count(";") >= sample.count(",") else ","

    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle, delimiter=delimiter)
        if not reader.fieldnames:
            raise ValueError("CSV tidak memiliki header")
        rows = []
        for row in reader:
            normalized = {k.strip(): (v or "").strip() for k, v in row.items() if k}
            rows.append(normalized)
        return rows


def _insert_rejected(
    cur,
    *,
    batch_id: str,
    dataset: str,
    row_num: int,
    error_type: str,
    error_message: str,
    raw_payload: dict[str, Any],
) -> None:
    _upsert_global_issue_link(
        cur,
        batch_id=batch_id,
        row_num=row_num,
        dataset=dataset,
        error_type=error_type,
        error_message=error_message,
        raw_payload=raw_payload,
    )


def _upsert_global_issue_link(
    cur,
    *,
    batch_id: str,
    row_num: int,
    dataset: str,
    error_type: str,
    error_message: str,
    raw_payload: dict[str, Any],
) -> None:
    issue = issue_fields(
        dataset=dataset,
        error_type=error_type,
        error_message=error_message,
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
            dataset,
            issue["kind"],
            issue["merchant_key"],
            issue["start_period"],
            issue["end_period"],
            error_type,
            error_message,
            Json(raw_payload),
        ),
    )
    issue_id = int(cur.fetchone()["issue_id"])

    cur.execute(
        """
        insert into audit.batch_issue_links (
            batch_id, issue_id, row_num, state,
            dataset, error_type, error_message, raw_payload, updated_at
        )
        values (%s::uuid, %s, %s, 'ACTIVE', %s, %s, %s, %s, now())
        on conflict (batch_id, row_num, issue_id) do update
        set issue_id = excluded.issue_id,
            row_num = excluded.row_num,
            state = 'ACTIVE',
            dataset = excluded.dataset,
            error_type = excluded.error_type,
            error_message = excluded.error_message,
            raw_payload = excluded.raw_payload,
            updated_at = now()
        """,
        (batch_id, issue_id, row_num, dataset, error_type, error_message, Json(raw_payload)),
    )


def _clear_batch_tables(cur, batch_id: str, dataset: str) -> None:
    raw_table = RAW_TABLES[dataset]
    clean_table = CLEAN_TABLES[dataset]

    cur.execute(
        sql.SQL("delete from stg.{} where batch_id = %s::uuid").format(
            sql.Identifier(raw_table)
        ),
        (batch_id,),
    )
    cur.execute(
        sql.SQL("delete from stg.{} where batch_id = %s::uuid").format(
            sql.Identifier(clean_table)
        ),
        (batch_id,),
    )
    cur.execute("delete from audit.batch_issue_links where batch_id = %s::uuid", (batch_id,))


def stage_csv(batch_id: str) -> int:
    batch = get_batch(batch_id)
    if not batch:
        raise BatchError("FAILED_STAGE", "stage", f"Batch not found: {batch_id}")

    source_file = Path(batch["source_file"])
    if not source_file.exists():
        raise BatchError("FAILED_STAGE", "stage", f"Source file not found: {source_file}")

    dataset = batch["dataset"]
    rows = _read_csv_rows(source_file)
    raw_table = RAW_TABLES[dataset]

    with get_conn() as conn, conn.cursor() as cur:
        _clear_batch_tables(cur, batch_id, dataset)

        for idx, payload in enumerate(rows, start=1):
            cur.execute(
                sql.SQL("""
                    insert into stg.{} (batch_id, row_num, raw_payload)
                    values (%s::uuid, %s, %s)
                """).format(sql.Identifier(raw_table)),
                (batch_id, idx, Json(payload)),
            )

        conn.commit()

    touch_batch(
        batch_id,
        status="STAGED",
        failed_step=None,
        failed_reason=None,
        total_rows=len(rows),
    )
    return len(rows)


def clean_data(batch_id: str) -> int:
    batch = get_batch(batch_id)
    if not batch:
        raise BatchError("FAILED_STAGE", "clean", f"Batch not found: {batch_id}")

    dataset = batch["dataset"]
    raw_table = RAW_TABLES[dataset]
    clean_table = CLEAN_TABLES[dataset]

    cleaned = 0

    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            sql.SQL(
                "select row_num, raw_payload from stg.{} where batch_id = %s::uuid order by row_num"
            ).format(sql.Identifier(raw_table)),
            (batch_id,),
        )
        staged_rows = cur.fetchall()

        for row in staged_rows:
            row_num = row["row_num"]
            raw_payload = row["raw_payload"]
            try:
                if dataset == "list_kota":
                    cluster = raw_payload["cluster"].strip()
                    branch = raw_payload["branch"].strip()
                    region = raw_payload["region"].strip()
                    if not cluster:
                        raise ValueError("cluster wajib diisi")

                    cluster_id = stable_bigint_id("CLUSTER", region, branch, cluster)
                    cur.execute(
                        """
                        insert into stg.list_kota_clean
                          (batch_id, row_num, region, branch, cluster, cluster_id, raw_payload)
                        values (%s::uuid, %s, %s, %s, %s, %s, %s)
                        """,
                        (
                            batch_id,
                            row_num,
                            region,
                            branch,
                            cluster,
                            cluster_id,
                            Json(raw_payload),
                        ),
                    )

                elif dataset == "master":
                    keyword = raw_payload["keyword"].strip()
                    if not keyword:
                        raise ValueError("keyword wajib diisi")

                    uniq_merchant = raw_payload["uniq_merchant"].strip()
                    merchant_name = raw_payload["merchant_name"].strip()
                    category = raw_payload["category"].strip() or "UNKNOWN"
                    point_redeem = parse_int_loose(raw_payload.get("point_redeem", "0"))
                    start_period = parse_date_master(raw_payload["start_period"])
                    end_period = parse_date_master(raw_payload["end_period"])
                    if start_period > end_period:
                        raise ValueError("start_period > end_period")

                    region = raw_payload.get("region", "").strip()
                    branch = raw_payload.get("branch", "").strip()
                    cluster = raw_payload.get("cluster", "").strip()
                    if not cluster:
                        raise ValueError("cluster wajib diisi")

                    merchant_key = stable_uuid("merchant", keyword)
                    category_id = stable_bigint_id("CAT", category) % 2_000_000_000
                    cluster_id = stable_bigint_id("CLUSTER", region, branch, cluster)
                    rule_key = stable_uuid("rule", keyword)

                    cur.execute(
                        """
                        insert into stg.master_clean
                          (
                            batch_id, row_num, uniq_merchant, merchant_name, keyword,
                            category, point_redeem, start_period, end_period,
                            region, branch, cluster,
                            merchant_key, category_id, cluster_id, rule_key, raw_payload
                          )
                        values
                          (%s::uuid, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        """,
                        (
                            batch_id,
                            row_num,
                            uniq_merchant,
                            merchant_name,
                            keyword,
                            category,
                            point_redeem,
                            start_period,
                            end_period,
                            region,
                            branch,
                            cluster,
                            merchant_key,
                            category_id,
                            cluster_id,
                            rule_key,
                            Json(raw_payload),
                        ),
                    )

                elif dataset == "transactions":
                    tx_at = parse_tx_timestamp(raw_payload["timestamp"])
                    keyword = raw_payload["keyword"].strip()
                    msisdn = raw_payload["msisdn"].strip()
                    qty = parse_int_loose(raw_payload.get("quantity", "0"))
                    status = normalize_status(raw_payload.get("status", ""))

                    if not keyword:
                        raise ValueError("keyword wajib diisi")
                    if qty <= 0:
                        raise ValueError("quantity harus > 0")

                    transaction_key = stable_uuid("tx", batch_id, str(row_num))
                    cur.execute(
                        """
                        insert into stg.transactions_clean
                          (batch_id, row_num, transaction_key, transaction_at, keyword, msisdn, qty, status, raw_payload)
                        values (%s::uuid, %s, %s, %s, %s, %s, %s, %s, %s)
                        """,
                        (
                            batch_id,
                            row_num,
                            transaction_key,
                            tx_at,
                            keyword,
                            msisdn,
                            qty,
                            status,
                            Json(raw_payload),
                        ),
                    )

                elif dataset == "total_point":
                    cluster = raw_payload["cluster"].strip()
                    if not cluster:
                        raise ValueError("cluster wajib diisi")

                    def insert_total_point(month: int, year: int, total_point: int, point_owner: int) -> None:
                        month_year = f"{year:04d}-{month:02d}-01"
                        point_key = stable_uuid("cluster_point", cluster.strip().upper(), month_year)
                        cur.execute(
                            """
                            insert into stg.total_point_clean
                              (batch_id, row_num, point_key, cluster, cluster_id, month_year, total_point, point_owner, raw_payload)
                            values (%s::uuid, %s, %s, %s, %s, %s::date, %s, %s, %s)
                            on conflict (batch_id, row_num, month_year) do update set
                              total_point = excluded.total_point,
                              point_owner = excluded.point_owner
                            """,
                            (
                                batch_id,
                                row_num,
                                point_key,
                                cluster,
                                0,
                                month_year,
                                total_point,
                                point_owner,
                                Json(raw_payload),
                            ),
                        )

                    month, year = _parse_total_point_period(str(raw_payload.get("period", "")))
                    total_point = parse_int_loose(str(raw_payload.get("poin", "0")))
                    point_owner = parse_int_loose(str(raw_payload.get("own", "0")))
                    insert_total_point(month, year, total_point, point_owner)

                else:
                    raise ValueError(f"Unsupported dataset: {dataset}")

                cleaned += 1
            except Exception as exc:
                _insert_rejected(
                    cur,
                    batch_id=batch_id,
                    dataset=dataset,
                    row_num=row_num,
                    error_type="PARSE_ERROR",
                    error_message=str(exc),
                    raw_payload=raw_payload,
                )

        conn.commit()

    return cleaned


def load_data(batch_id: str) -> int:
    batch = get_batch(batch_id)
    if not batch:
        raise BatchError("FAILED_LOAD", "load", f"Batch not found: {batch_id}")

    dataset = batch["dataset"]
    loaded = 0

    with get_conn() as conn, conn.cursor() as cur:
        if dataset == "list_kota":
            cur.execute(
                """
                with dedup as (
                    select
                        cluster_id, cluster, branch, region,
                        row_number() over (
                            partition by cluster_id
                            order by row_num desc
                        ) as rn
                    from stg.list_kota_clean
                    where batch_id = %s::uuid
                )
                insert into public.dim_cluster (cluster_id, cluster, branch, region, source_batch_id)
                select cluster_id, cluster, branch, region, %s::uuid
                from dedup
                where rn = 1
                on conflict (cluster_id) do update
                set cluster = excluded.cluster,
                    branch = excluded.branch,
                    region = excluded.region,
                    source_batch_id = excluded.source_batch_id
                """,
                (batch_id, batch_id),
            )
            loaded = cur.rowcount

        elif dataset == "master":
            cur.execute(
                """
                with dedup as (
                    select
                        category_id, category,
                        row_number() over (
                            partition by category_id
                            order by row_num desc
                        ) as rn
                    from stg.master_clean
                    where batch_id = %s::uuid
                )
                insert into public.dim_category (category_id, category, source_batch_id)
                select category_id, category, %s::uuid
                from dedup
                where rn = 1
                on conflict (category_id) do update
                set category = excluded.category,
                    source_batch_id = excluded.source_batch_id
                """,
                (batch_id, batch_id),
            )

            cur.execute(
                """
                with candidates as (
                    select
                        c.row_num,
                        c.raw_payload,
                        c.cluster,
                        dcl.cluster_id,
                        count(dcl.cluster_id) over (partition by c.id) as cluster_match_count
                    from stg.master_clean c
                    left join public.dim_cluster dcl
                      on upper(trim(dcl.cluster)) = upper(trim(c.cluster))
                    where c.batch_id = %s::uuid
                )
                select row_num,
                       case
                         when cluster_match_count = 0 then 'FK_MISSING'
                         else 'FK_AMBIGUOUS'
                       end as error_type,
                       case
                         when cluster_match_count = 0
                           then 'cluster tidak ditemukan di dim_cluster untuk cluster=' || cluster
                         else 'cluster ambigu di dim_cluster untuk cluster=' || cluster
                       end as error_message,
                       raw_payload
                from candidates
                where cluster_match_count = 0 or cluster_match_count > 1
                """,
                (batch_id,),
            )
            for rejected in cur.fetchall():
                _insert_rejected(
                    cur,
                    batch_id=batch_id,
                    dataset=dataset,
                    row_num=int(rejected["row_num"]),
                    error_type=str(rejected["error_type"]),
                    error_message=str(rejected["error_message"]),
                    raw_payload=dict(rejected["raw_payload"] or {}),
                )

            cur.execute(
                """
                with dedup as (
                    select
                        merchant_key, keyword, merchant_name, uniq_merchant, cluster, category_id,
                        point_redeem, start_period, end_period, rule_key,
                        row_number() over (
                            partition by keyword
                            order by row_num desc
                        ) as rn
                    from stg.master_clean
                    where batch_id = %s::uuid
                ),
                candidates as (
                    select
                        d.*,
                        dcl.cluster_id as resolved_cluster_id,
                        count(dcl.cluster_id) over (partition by d.keyword) as cluster_match_count
                    from dedup d
                    left join public.dim_cluster dcl
                      on upper(trim(dcl.cluster)) = upper(trim(d.cluster))
                    where d.rn = 1
                )
                insert into public.dim_merchant
                  (
                    merchant_key, keyword_code, merchant_name, uniq_merchant,
                    rule_key, point_redeem, start_period, end_period,
                    cluster_id, category_id, source_batch_id
                  )
                select
                    candidates.merchant_key,
                    candidates.keyword,
                    candidates.merchant_name,
                    candidates.uniq_merchant,
                    candidates.rule_key,
                    candidates.point_redeem,
                    candidates.start_period,
                    candidates.end_period,
                    candidates.resolved_cluster_id,
                    candidates.category_id,
                    %s::uuid
                from candidates
                where candidates.cluster_match_count = 1
                on conflict (keyword_code) do update
                set merchant_key = excluded.merchant_key,
                    merchant_name = excluded.merchant_name,
                    uniq_merchant = excluded.uniq_merchant,
                    rule_key = excluded.rule_key,
                    point_redeem = excluded.point_redeem,
                    start_period = excluded.start_period,
                    end_period = excluded.end_period,
                    cluster_id = excluded.cluster_id,
                    category_id = excluded.category_id,
                    source_batch_id = excluded.source_batch_id
                """,
                (batch_id, batch_id),
            )
            loaded = cur.rowcount

        elif dataset == "transactions":
            cur.execute(
                """
                select
                  c.row_num,
                  'FK_MISSING' as error_type,
                  case
                    when m.merchant_key is null then 'merchant tidak ditemukan untuk keyword=' || c.keyword
                  end as error_message,
                  c.raw_payload
                from stg.transactions_clean c
                left join public.dim_merchant m on m.keyword_code = c.keyword
                where c.batch_id = %s::uuid
                  and m.merchant_key is null
                """,
                (batch_id,),
            )
            for rejected in cur.fetchall():
                _insert_rejected(
                    cur,
                    batch_id=batch_id,
                    dataset=dataset,
                    row_num=int(rejected["row_num"]),
                    error_type=str(rejected["error_type"]),
                    error_message=str(rejected["error_message"]),
                    raw_payload=dict(rejected["raw_payload"] or {}),
                )

            cur.execute(
                """
                insert into public.dim_date
                  (date_key, full_date, day_num, month_num, month_name, quarter_num, year_num)
                select distinct
                  to_char(c.transaction_at::date, 'YYYYMMDD')::int as date_key,
                  c.transaction_at::date as full_date,
                  extract(day from c.transaction_at)::int as day_num,
                  extract(month from c.transaction_at)::int as month_num,
                  to_char(c.transaction_at::date, 'FMMonth') as month_name,
                  extract(quarter from c.transaction_at)::int as quarter_num,
                  extract(year from c.transaction_at)::int as year_num
                from stg.transactions_clean c
                where c.batch_id = %s::uuid
                on conflict (date_key) do update
                set full_date = excluded.full_date,
                    day_num = excluded.day_num,
                    month_num = excluded.month_num,
                    month_name = excluded.month_name,
                    quarter_num = excluded.quarter_num,
                    year_num = excluded.year_num
                """,
                (batch_id,),
            )

            cur.execute(
                """
                insert into public.fact_transaction
                  (transaction_key, transaction_at, date_key, rule_key, merchant_key, status, qty, point_redeem, msisdn, created_at, source_batch_id)
                select
                  c.transaction_key,
                  c.transaction_at,
                  to_char(c.transaction_at::date, 'YYYYMMDD')::int as date_key,
                  m.rule_key,
                  m.merchant_key,
                  c.status::transaction_status,
                  c.qty,
                  m.point_redeem,
                  c.msisdn,
                  now(),
                  %s::uuid
                from stg.transactions_clean c
                join public.dim_merchant m on m.keyword_code = c.keyword
                where c.batch_id = %s::uuid
                on conflict (transaction_key) do update
                set transaction_at = excluded.transaction_at,
                    date_key = excluded.date_key,
                    rule_key = excluded.rule_key,
                    merchant_key = excluded.merchant_key,
                    status = excluded.status,
                    qty = excluded.qty,
                    point_redeem = excluded.point_redeem,
                    msisdn = excluded.msisdn,
                    created_at = excluded.created_at,
                    source_batch_id = excluded.source_batch_id
                """,
                (batch_id, batch_id),
            )
            loaded = cur.rowcount

        elif dataset == "total_point":
            # dim_cluster is managed only by list_kota ingestion.
            # Resolve cluster_id by cluster name from dim_cluster.
            # Reject when cluster is missing or ambiguous (same name maps to multiple cluster_id).
            cur.execute(
                """
                with candidates as (
                    select
                        c.id as clean_id,
                        c.row_num,
                        c.raw_payload,
                        c.cluster,
                        dcl.cluster_id,
                        count(dcl.cluster_id) over (partition by c.id) as cluster_match_count
                    from stg.total_point_clean c
                    left join public.dim_cluster dcl
                      on upper(trim(dcl.cluster)) = upper(trim(c.cluster))
                    where c.batch_id = %s::uuid
                )
                select row_num,
                       case
                         when cluster_match_count = 0 then 'FK_MISSING'
                         else 'FK_AMBIGUOUS'
                       end as error_type,
                       case
                         when cluster_match_count = 0
                           then 'cluster tidak ditemukan di dim_cluster untuk cluster=' || cluster
                         else 'cluster ambigu di dim_cluster untuk cluster=' || cluster
                       end as error_message,
                       raw_payload
                from candidates
                where cluster_match_count = 0 or cluster_match_count > 1
                """,
                (batch_id,),
            )
            for rejected in cur.fetchall():
                _insert_rejected(
                    cur,
                    batch_id=batch_id,
                    dataset=dataset,
                    row_num=int(rejected["row_num"]),
                    error_type=str(rejected["error_type"]),
                    error_message=str(rejected["error_message"]),
                    raw_payload=dict(rejected["raw_payload"] or {}),
                )

            cur.execute(
                """
                insert into public.fact_cluster_balance
                  (point_key, month_year, cluster_id, total_point, point_owner, source_batch_id)
                with candidates as (
                    select
                        c.id as clean_id,
                        c.point_key,
                        c.month_year,
                        c.total_point,
                        c.point_owner,
                        dcl.cluster_id,
                        count(dcl.cluster_id) over (partition by c.id) as cluster_match_count
                    from stg.total_point_clean c
                    left join public.dim_cluster dcl
                      on upper(trim(dcl.cluster)) = upper(trim(c.cluster))
                    where c.batch_id = %s::uuid
                )
                select point_key, month_year, cluster_id, total_point, point_owner, %s::uuid
                from candidates
                where cluster_match_count = 1
                on conflict (point_key) do update
                set total_point = excluded.total_point,
                    point_owner = excluded.point_owner,
                    source_batch_id = excluded.source_batch_id
                """,
                (batch_id, batch_id),
            )
            loaded = cur.rowcount

        conn.commit()

    touch_batch(batch_id, status="LOADED", loaded_rows=loaded)
    return loaded


def quality_check(batch_id: str) -> BatchMetrics:
    batch = get_batch(batch_id)
    if not batch:
        raise BatchError("FAILED_QUALITY", "quality", f"Batch not found: {batch_id}")

    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            select count(*) as rejected_rows
            from audit.batch_issue_links
            where batch_id = %s::uuid
              and state = 'ACTIVE'
            """,
            (batch_id,),
        )
        rejected_rows = cur.fetchone()["rejected_rows"]

    total_rows = int(batch["total_rows"] or 0)
    loaded_rows = int(batch["loaded_rows"] or 0)
    quality_base = max(total_rows, loaded_rows + rejected_rows)
    reject_rate = (rejected_rows / quality_base) if quality_base else 0.0

    touch_batch(
        batch_id,
        rejected_rows=rejected_rows,
        reject_rate=reject_rate,
        loaded_rows=loaded_rows,
        total_rows=quality_base,
    )

    if reject_rate > REJECT_THRESHOLD:
        raise BatchError(
            "FAILED_QUALITY",
            "quality",
            f"Reject rate {reject_rate:.2%} lebih besar dari threshold {REJECT_THRESHOLD:.2%}",
        )

    return BatchMetrics(total_rows=total_rows, loaded_rows=loaded_rows, rejected_rows=rejected_rows)


def run_batch(batch_id: str) -> BatchMetrics:
    touch_batch(
        batch_id,
        status="PROCESSING",
        failed_step=None,
        failed_reason=None,
        increment_run_count=True,
    )

    try:
        stage_csv(batch_id)
    except Exception as exc:
        status = exc.status if isinstance(exc, BatchError) else "FAILED_STAGE"
        step = exc.step if isinstance(exc, BatchError) else "stage"
        touch_batch(batch_id, status=status, failed_step=step, failed_reason=str(exc))
        raise

    try:
        clean_data(batch_id)
    except Exception as exc:
        touch_batch(batch_id, status="FAILED_STAGE", failed_step="clean", failed_reason=str(exc))
        raise

    try:
        load_data(batch_id)
    except Exception as exc:
        status = exc.status if isinstance(exc, BatchError) else "FAILED_LOAD"
        step = exc.step if isinstance(exc, BatchError) else "load"
        touch_batch(batch_id, status=status, failed_step=step, failed_reason=str(exc))
        raise

    try:
        metrics = quality_check(batch_id)
        touch_batch(batch_id, status="SUCCESS", failed_step=None, failed_reason=None)
        refresh_materialized_views_background()
        return metrics
    except Exception as exc:
        status = exc.status if isinstance(exc, BatchError) else "FAILED_QUALITY"
        step = exc.step if isinstance(exc, BatchError) else "quality"
        touch_batch(batch_id, status=status, failed_step=step, failed_reason=str(exc))
        raise
