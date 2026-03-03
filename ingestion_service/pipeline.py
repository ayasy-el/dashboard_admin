from __future__ import annotations

import csv
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from psycopg import sql
from psycopg.types.json import Json

from ingestion_service.config import REJECT_THRESHOLD
from ingestion_service.db import get_batch, get_conn, touch_batch
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
    cur.execute(
        """
        insert into stg.rejected_rows
            (batch_id, dataset, row_num, error_type, error_message, raw_payload)
        values (%s::uuid, %s, %s, %s, %s, %s)
        """,
        (batch_id, dataset, row_num, error_type, error_message, Json(raw_payload)),
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
    cur.execute("delete from stg.rejected_rows where batch_id = %s::uuid", (batch_id,))


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
                    rule_key = stable_uuid(
                        "rule",
                        str(merchant_key),
                        start_period.isoformat(),
                        end_period.isoformat(),
                        str(point_redeem),
                    )

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

                    for key, value in raw_payload.items():
                        lower = key.lower()
                        if not (lower.startswith("poin_") or lower.startswith("own_")):
                            continue
                        parts = lower.split("_")
                        if len(parts) != 3:
                            continue
                        try:
                            month = int(parts[1])
                            year = int(parts[2])
                        except ValueError:
                            logger.warning(
                                "Skip invalid period column '%s' for batch_id=%s row_num=%s",
                                key,
                                batch_id,
                                row_num,
                            )
                            continue
                        if month < 1 or month > 12:
                            continue

                        month_year = f"{year:04d}-{month:02d}-01"
                        if lower.startswith("poin_"):
                            total_point = parse_int_loose(value)
                            point_owner = parse_int_loose(raw_payload.get(f"own_{parts[1]}_{parts[2]}", "0"))
                        else:
                            point_owner = parse_int_loose(value)
                            total_point = parse_int_loose(raw_payload.get(f"poin_{parts[1]}_{parts[2]}", "0"))

                        point_key = stable_uuid(
                            "cluster_point", cluster.strip().upper(), month_year
                        )
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
                insert into public.dim_cluster (cluster_id, cluster, branch, region)
                select cluster_id, cluster, branch, region
                from dedup
                where rn = 1
                on conflict (cluster_id) do update
                set cluster = excluded.cluster,
                    branch = excluded.branch,
                    region = excluded.region
                """,
                (batch_id,),
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
                insert into public.dim_category (category_id, category)
                select category_id, category
                from dedup
                where rn = 1
                on conflict (category_id) do update
                set category = excluded.category
                """,
                (batch_id,),
            )

            # dim_cluster is managed only by list_kota ingestion.
            # Resolve cluster by cluster name from dim_cluster and reject missing/ambiguous rows.
            cur.execute(
                """
                insert into stg.rejected_rows
                  (batch_id, dataset, row_num, error_type, error_message, raw_payload)
                with candidates as (
                    select
                        c.id as clean_id,
                        c.batch_id,
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
                select batch_id, 'master', row_num,
                       case
                         when cluster_match_count = 0 then 'FK_MISSING'
                         else 'FK_AMBIGUOUS'
                       end,
                       case
                         when cluster_match_count = 0
                           then 'cluster tidak ditemukan di dim_cluster untuk cluster=' || cluster
                         else 'cluster ambigu di dim_cluster untuk cluster=' || cluster
                       end,
                       raw_payload
                from candidates
                where cluster_match_count = 0 or cluster_match_count > 1
                """,
                (batch_id,),
            )

            cur.execute(
                """
                with dedup as (
                    select
                        merchant_key, keyword, merchant_name, uniq_merchant, cluster, category_id, row_num,
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
                  (merchant_key, keyword_code, merchant_name, uniq_merchant, cluster_id, category_id)
                select
                    candidates.merchant_key,
                    candidates.keyword,
                    candidates.merchant_name,
                    candidates.uniq_merchant,
                    candidates.resolved_cluster_id,
                    candidates.category_id
                from candidates
                where candidates.cluster_match_count = 1
                on conflict (keyword_code) do update
                set merchant_key = excluded.merchant_key,
                    merchant_name = excluded.merchant_name,
                    uniq_merchant = excluded.uniq_merchant,
                    cluster_id = excluded.cluster_id,
                    category_id = excluded.category_id
                """,
                (batch_id,),
            )

            cur.execute(
                """
                select
                    c.row_num,
                    c.rule_key,
                    dm.merchant_key,
                    c.point_redeem,
                    c.start_period,
                    c.end_period,
                    c.raw_payload
                from stg.master_clean c
                join public.dim_merchant dm on dm.keyword_code = c.keyword
                where c.batch_id = %s::uuid
                order by c.row_num
                """,
                (batch_id,),
            )
            rows = cur.fetchall()
            for row in rows:
                savepoint = f"sp_rule_{row['row_num']}"
                cur.execute(sql.SQL("savepoint {};").format(sql.Identifier(savepoint)))
                try:
                    # Auto-merge duplicate master rule when only end_period is extended:
                    # same merchant + same start_period + same point_redeem.
                    cur.execute(
                        """
                        select
                            rule_key,
                            (upper(period) - interval '1 day')::date as end_period
                        from public.dim_rule
                        where rule_merchant = %s
                          and lower(period)::date = %s::date
                          and point_redeem = %s
                        order by upper(period) desc
                        limit 1
                        """,
                        (
                            row["merchant_key"],
                            row["start_period"],
                            row["point_redeem"],
                        ),
                    )
                    same_rule = cur.fetchone()
                    if same_rule:
                        existing_end = same_rule["end_period"]
                        incoming_end = row["end_period"]

                        # Incoming rule extends existing period -> update in place.
                        if incoming_end > existing_end:
                            cur.execute(
                                """
                                update public.dim_rule
                                set period = daterange(%s::date, (%s::date + 1), '[)')
                                where rule_key = %s
                                """,
                                (
                                    row["start_period"],
                                    incoming_end,
                                    same_rule["rule_key"],
                                ),
                            )
                            cur.execute(
                                sql.SQL("release savepoint {};").format(
                                    sql.Identifier(savepoint)
                                )
                            )
                            loaded += 1
                            continue

                        # Exact duplicate is idempotent no-op.
                        if incoming_end == existing_end:
                            cur.execute(
                                sql.SQL("release savepoint {};").format(
                                    sql.Identifier(savepoint)
                                )
                            )
                            loaded += 1
                            continue

                        # Incoming end_period is shorter -> reject.
                        raise ValueError(
                            f"end_period lebih pendek dari existing rule "
                            f"(existing={existing_end}, incoming={incoming_end})"
                        )

                    # Special-case: same merchant+period already exists and current value is 0.
                    # In this case we only update point_redeem to incoming value.
                    cur.execute(
                        """
                        update public.dim_rule
                        set point_redeem = %s
                        where rule_merchant = %s
                          and period = daterange(%s::date, (%s::date + 1), '[)')
                          and point_redeem = 0
                        returning rule_key
                        """,
                        (
                            row["point_redeem"],
                            row["merchant_key"],
                            row["start_period"],
                            row["end_period"],
                        ),
                    )
                    updated = cur.fetchone()
                    if updated:
                        cur.execute(
                            sql.SQL("release savepoint {};").format(
                                sql.Identifier(savepoint)
                            )
                        )
                        loaded += 1
                        continue

                    cur.execute(
                        """
                        insert into public.dim_rule
                          (rule_key, rule_merchant, point_redeem, period, created_at)
                        values
                          (%s, %s, %s, daterange(%s::date, (%s::date + 1), '[)'), now())
                        on conflict (rule_key) do update
                        set point_redeem = excluded.point_redeem,
                            period = excluded.period
                        """,
                        (
                            row["rule_key"],
                            row["merchant_key"],
                            row["point_redeem"],
                            row["start_period"],
                            row["end_period"],
                        ),
                    )
                    cur.execute(sql.SQL("release savepoint {};").format(sql.Identifier(savepoint)))
                    loaded += 1
                except Exception as exc:
                    cur.execute(sql.SQL("rollback to savepoint {};").format(sql.Identifier(savepoint)))
                    cur.execute(sql.SQL("release savepoint {};").format(sql.Identifier(savepoint)))
                    _insert_rejected(
                        cur,
                        batch_id=batch_id,
                        dataset=dataset,
                        row_num=row["row_num"],
                        error_type="LOAD_ERROR",
                        error_message=str(exc),
                        raw_payload=row["raw_payload"],
                    )

        elif dataset == "transactions":
            cur.execute(
                """
                insert into stg.rejected_rows
                  (batch_id, dataset, row_num, error_type, error_message, raw_payload)
                select c.batch_id, 'transactions', c.row_num,
                       'FK_MISSING',
                       case
                         when m.merchant_key is null then 'merchant tidak ditemukan untuk keyword=' || c.keyword
                         when r.rule_key is null then 'rule tidak ditemukan untuk keyword=' || c.keyword || ' at ' || c.transaction_at::date
                       end,
                       c.raw_payload
                from stg.transactions_clean c
                left join public.dim_merchant m on m.keyword_code = c.keyword
                left join public.dim_rule r
                  on r.rule_merchant = m.merchant_key
                 and r.period @> c.transaction_at::date
                where c.batch_id = %s::uuid
                  and (m.merchant_key is null or r.rule_key is null)
                """,
                (batch_id,),
            )

            cur.execute(
                """
                insert into public.fact_transaction
                  (transaction_key, transaction_at, rule_key, merchant_key, status, qty, point_redeem, msisdn, created_at)
                select c.transaction_key, c.transaction_at, r.rule_key, m.merchant_key,
                       c.status::transaction_status, c.qty, r.point_redeem, c.msisdn, now()
                from stg.transactions_clean c
                join public.dim_merchant m on m.keyword_code = c.keyword
                join public.dim_rule r
                  on r.rule_merchant = m.merchant_key
                 and r.period @> c.transaction_at::date
                where c.batch_id = %s::uuid
                on conflict (transaction_key) do update
                set transaction_at = excluded.transaction_at,
                    rule_key = excluded.rule_key,
                    merchant_key = excluded.merchant_key,
                    status = excluded.status,
                    qty = excluded.qty,
                    point_redeem = excluded.point_redeem,
                    msisdn = excluded.msisdn
                """,
                (batch_id,),
            )
            loaded = cur.rowcount

        elif dataset == "total_point":
            # dim_cluster is managed only by list_kota ingestion.
            # Resolve cluster_id by cluster name from dim_cluster.
            # Reject when cluster is missing or ambiguous (same name maps to multiple cluster_id).
            cur.execute(
                """
                insert into stg.rejected_rows
                  (batch_id, dataset, row_num, error_type, error_message, raw_payload)
                with candidates as (
                    select
                        c.id as clean_id,
                        c.batch_id,
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
                select batch_id, 'total_point', row_num,
                       case
                         when cluster_match_count = 0 then 'FK_MISSING'
                         else 'FK_AMBIGUOUS'
                       end,
                       case
                         when cluster_match_count = 0
                           then 'cluster tidak ditemukan di dim_cluster untuk cluster=' || cluster
                         else 'cluster ambigu di dim_cluster untuk cluster=' || cluster
                       end,
                       raw_payload
                from candidates
                where cluster_match_count = 0 or cluster_match_count > 1
                """,
                (batch_id,),
            )

            cur.execute(
                """
                insert into public.fact_cluster_point
                  (point_key, month_year, cluster_id, total_point, point_owner)
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
                select point_key, month_year, cluster_id, total_point, point_owner
                from candidates
                where cluster_match_count = 1
                on conflict (point_key) do update
                set total_point = excluded.total_point,
                    point_owner = excluded.point_owner
                """,
                (batch_id,),
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
            "select count(*) as rejected_rows from stg.rejected_rows where batch_id = %s::uuid",
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
        return metrics
    except Exception as exc:
        status = exc.status if isinstance(exc, BatchError) else "FAILED_QUALITY"
        step = exc.step if isinstance(exc, BatchError) else "quality"
        touch_batch(batch_id, status=status, failed_step=step, failed_reason=str(exc))
        raise
