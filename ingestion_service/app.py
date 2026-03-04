from __future__ import annotations

from pathlib import Path
import uuid
import os
from typing import Any

from fastapi import BackgroundTasks, FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from ingestion_service.config import DATASETS, FAILED_STATUSES, REJECT_THRESHOLD, UPLOAD_DIR
from ingestion_service.db import (
    create_batch,
    create_rerun_batch,
    delete_rejected_row,
    get_batch,
    get_conn,
    get_rejected_row,
    get_rejected_rows,
    list_batches,
    resolve_issue_and_delete_links,
    touch_batch,
)
from ingestion_service.flows import run_ingestion_flow

app = FastAPI(title="Data Ingestion Service", version="0.1.0")
RERUN_ALLOWED_STATUSES = FAILED_STATUSES | {"SUCCESS"}

allowed_origins = [
    origin.strip()
    for origin in os.getenv("INGEST_ALLOWED_ORIGINS", "*").split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins if allowed_origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _validate_dataset(dataset: str) -> str:
    normalized = dataset.strip().lower()
    if normalized not in DATASETS:
        raise HTTPException(status_code=400, detail=f"Unsupported dataset: {dataset}")
    return normalized


def _to_iso(value: Any) -> str | None:
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value) if value is not None else None


def _merchant_info_map(merchant_keys: list[str]) -> dict[str, dict[str, Any]]:
    if not merchant_keys:
        return {}
    unique_keys = list({key for key in merchant_keys if key})
    if not unique_keys:
        return {}

    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            select
                merchant_key::text as merchant_key,
                keyword_code as keyword,
                merchant_name,
                uniq_merchant,
                dc.category as category,
                dcl.cluster as cluster
            from public.dim_merchant
            left join public.dim_category dc
              on dc.category_id = dim_merchant.category_id
            left join public.dim_cluster dcl
              on dcl.cluster_id = dim_merchant.cluster_id
            where merchant_key = any(%s::uuid[])
            """,
            (unique_keys,),
        )
        rows = cur.fetchall()
    return {row["merchant_key"]: row for row in rows}


def _enrich_conflict_payload(payload: dict[str, Any], incoming: dict[str, Any], existing: list[dict[str, Any]]) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    # Fill incoming business fields from raw_payload (legacy rejected rows may miss these keys).
    for key in ["keyword", "merchant_name", "uniq_merchant", "category", "cluster"]:
        if not incoming.get(key):
            raw_val = payload.get(key)
            if raw_val:
                incoming[key] = str(raw_val)

    merchant_keys: list[str] = []
    if incoming.get("merchant_key"):
        merchant_keys.append(str(incoming["merchant_key"]))
    for item in existing:
        mk = item.get("rule_merchant") or item.get("merchant_key")
        if mk:
            merchant_keys.append(str(mk))

    info_map = _merchant_info_map(merchant_keys)

    incoming_merchant_key = str(incoming.get("merchant_key") or "")
    incoming_info = info_map.get(incoming_merchant_key)
    if incoming_info:
        incoming["keyword"] = incoming.get("keyword") or incoming_info.get("keyword")
        incoming["merchant_name"] = incoming.get("merchant_name") or incoming_info.get("merchant_name")
        incoming["uniq_merchant"] = incoming.get("uniq_merchant") or incoming_info.get("uniq_merchant")
        incoming["category"] = incoming.get("category") or incoming_info.get("category")
        incoming["cluster"] = incoming.get("cluster") or incoming_info.get("cluster")

    enriched_existing: list[dict[str, Any]] = []
    for item in existing:
        current = dict(item)
        mk = str(current.get("rule_merchant") or current.get("merchant_key") or "")
        info = info_map.get(mk)
        if info:
            current["keyword"] = current.get("keyword") or info.get("keyword")
            current["merchant_name"] = current.get("merchant_name") or info.get("merchant_name")
            current["uniq_merchant"] = current.get("uniq_merchant") or info.get("uniq_merchant")
            current["category"] = current.get("category") or info.get("category")
            current["cluster"] = current.get("cluster") or info.get("cluster")
        enriched_existing.append(current)

    return incoming, enriched_existing


def _current_existing_rules_for_incoming(incoming: dict[str, Any], limit: int = 5) -> list[dict[str, Any]] | None:
    merchant_key = str(incoming.get("merchant_key") or "").strip()
    start_period = incoming.get("start_period")
    end_period = incoming.get("end_period")
    if not merchant_key:
        return []

    query = """
        select
            rule_key::text as rule_key,
            rule_merchant::text as rule_merchant,
            dm.keyword_code as keyword,
            dm.merchant_name,
            dm.uniq_merchant,
            dc.category as category,
            dcl.cluster as cluster,
            point_redeem,
            lower(period)::date as start_period,
            (upper(period) - interval '1 day')::date as end_period
        from public.dim_rule
        join public.dim_merchant dm on dm.merchant_key = dim_rule.rule_merchant
        left join public.dim_category dc on dc.category_id = dm.category_id
        left join public.dim_cluster dcl on dcl.cluster_id = dm.cluster_id
        where rule_merchant = %s::uuid
    """
    params: list[Any] = [merchant_key]
    if start_period and end_period:
        query += " and period && daterange(%s::date, (%s::date + 1), '[)')"
        params.extend([start_period, end_period])
    query += " order by lower(period) asc limit %s"
    params.append(limit)

    try:
        with get_conn() as conn, conn.cursor() as cur:
            cur.execute(query, tuple(params))
            rows = cur.fetchall()
    except Exception:
        return None

    return [
        {
            "rule_key": row["rule_key"],
            "rule_merchant": row["rule_merchant"],
            "keyword": row["keyword"],
            "merchant_name": row["merchant_name"],
            "uniq_merchant": row["uniq_merchant"],
            "category": row.get("category"),
            "cluster": row.get("cluster"),
            "point_redeem": int(row["point_redeem"] or 0),
            "start_period": _to_iso(row["start_period"]),
            "end_period": _to_iso(row["end_period"]),
        }
        for row in rows
    ]


def _has_exact_period_match(incoming: dict[str, Any], existing: list[dict[str, Any]]) -> bool:
    return any(
        item.get("start_period") == incoming.get("start_period")
        and item.get("end_period") == incoming.get("end_period")
        for item in existing
    )


def _find_extendable_period_match(incoming: dict[str, Any], existing: list[dict[str, Any]]) -> dict[str, Any] | None:
    incoming_start = incoming.get("start_period")
    incoming_end = incoming.get("end_period")
    if not incoming_start or not incoming_end:
        return None

    candidates = [
        item
        for item in existing
        if item.get("start_period") == incoming_start
        and bool(item.get("end_period"))
        and str(incoming_end) > str(item.get("end_period"))
    ]
    if not candidates:
        return None
    candidates.sort(key=lambda item: str(item.get("end_period")))
    return candidates[-1]


def _resolution_for_row(row: dict[str, Any], incoming: dict[str, Any] | None = None, existing: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    payload = row.get("raw_payload") or {}
    conflict = payload.get("__conflict") if isinstance(payload, dict) else None
    kind = conflict.get("kind") if isinstance(conflict, dict) else None
    msg = (row.get("error_message") or "").lower()
    error_type = row.get("error_type")

    if kind in {"RULE_PERIOD_OVERLAP", "RULE_PERIOD_SHORTER"}:
        auto_solve = bool(conflict.get("can_auto_solve"))
        can_extend_period = False
        if incoming is not None and existing is not None:
            auto_solve = _has_exact_period_match(incoming, existing)
            can_extend_period = _find_extendable_period_match(incoming, existing) is not None
        if auto_solve:
            return {
                "can_solve": True,
                "solve_mode": "APPLY_TO_EXISTING_EXACT_PERIOD",
                "label": "Apply data baru ke rule existing (period sama)",
                "help": "Akan update point_redeem pada rule existing yang period-nya sama persis.",
            }
        if can_extend_period:
            return {
                "can_solve": True,
                "solve_mode": "EXTEND_EXISTING_PERIOD",
                "label": "Perpanjang end_period rule existing",
                "help": "Akan extend end_period rule existing (start_period sama dan end_period incoming lebih panjang).",
            }
        return {
            "can_solve": False,
            "solve_mode": "MANUAL_REQUIRED",
            "label": "Tidak bisa auto-solve",
            "help": "Perlu perbaikan period di file master (hindari overlap).",
        }

    if kind in {"FK_VIOLATION"} or error_type in {"FK_MISSING", "FK_AMBIGUOUS"}:
        return {
            "can_solve": False,
            "solve_mode": "MANUAL_REQUIRED",
            "label": "Tidak bisa auto-solve",
            "help": "Data referensi/dependency perlu diperbaiki dulu, lalu rerun batch.",
        }

    if "cluster tidak ditemukan" in msg or "merchant tidak ditemukan" in msg or "rule tidak ditemukan" in msg:
        return {
            "can_solve": False,
            "solve_mode": "MANUAL_REQUIRED",
            "label": "Tidak bisa auto-solve",
            "help": "Upload data master/list_kota/dependency yang hilang, lalu rerun.",
        }

    return {
        "can_solve": False,
        "solve_mode": "UNKNOWN",
        "label": "Belum ada auto-solve",
        "help": "Cek payload error, perbaiki data sumber, lalu rerun.",
    }


def _decorate_rejected_row(row: dict[str, Any]) -> dict[str, Any]:
    payload = row.get("raw_payload") if isinstance(row, dict) else None
    incoming = {}
    existing = []
    if isinstance(payload, dict):
        conflict = payload.get("__conflict")
        if isinstance(conflict, dict):
            incoming = dict(conflict.get("incoming") or {})
            existing = list(conflict.get("existing") or [])
            if conflict.get("kind") in {"RULE_PERIOD_OVERLAP", "RULE_PERIOD_SHORTER"}:
                current_existing = _current_existing_rules_for_incoming(incoming)
                if current_existing is not None:
                    existing = current_existing
            incoming, existing = _enrich_conflict_payload(payload, incoming, existing)
    resolution = _resolution_for_row(row, incoming, existing)
    return {
        **row,
        "resolution": resolution,
        "conflict": {
            "incoming": incoming,
            "existing": existing,
        },
    }


def _apply_solve_for_row(row: dict[str, Any]) -> None:
    payload = row.get("raw_payload") or {}
    conflict = payload.get("__conflict") if isinstance(payload, dict) else None
    if not isinstance(conflict, dict) or conflict.get("kind") not in {"RULE_PERIOD_OVERLAP", "RULE_PERIOD_SHORTER"}:
        raise HTTPException(status_code=409, detail="Tipe error ini belum support auto-solve")

    incoming = conflict.get("incoming") or {}
    existing = _current_existing_rules_for_incoming(incoming) or []
    resolution = _resolution_for_row(row, incoming, existing)
    if not resolution["can_solve"]:
        raise HTTPException(status_code=409, detail=resolution["help"])

    exact_match = None
    for item in existing:
        if (
            item.get("start_period") == incoming.get("start_period")
            and item.get("end_period") == incoming.get("end_period")
        ):
            exact_match = item
            break
    extendable_match = _find_extendable_period_match(incoming, existing)

    with get_conn() as conn, conn.cursor() as cur:
        if resolution["solve_mode"] == "APPLY_TO_EXISTING_EXACT_PERIOD":
            if not exact_match:
                raise HTTPException(status_code=409, detail="Tidak ditemukan existing rule dengan period yang sama persis")
            cur.execute(
                """
                update public.dim_rule
                set point_redeem = %s
                where rule_key = %s::uuid
                """,
                (int(incoming.get("point_redeem") or 0), exact_match["rule_key"]),
            )
        elif resolution["solve_mode"] == "EXTEND_EXISTING_PERIOD":
            if not extendable_match:
                raise HTTPException(status_code=409, detail="Tidak ditemukan rule existing yang bisa di-extend")
            cur.execute(
                """
                update public.dim_rule
                set point_redeem = %s,
                    period = daterange(%s::date, (%s::date + 1), '[)')
                where rule_key = %s::uuid
                """,
                (
                    int(incoming.get("point_redeem") or 0),
                    incoming.get("start_period"),
                    incoming.get("end_period"),
                    extendable_match["rule_key"],
                ),
            )
        else:
            raise HTTPException(status_code=409, detail="Solve mode tidak dikenali")

        if cur.rowcount == 0:
            conn.rollback()
            raise HTTPException(status_code=409, detail="Existing rule tidak ditemukan saat apply solve")
        conn.commit()


def _refresh_batch_metrics_after_rejected_cleanup(batch_id: str) -> dict[str, Any]:
    batch = get_batch(batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    internal_batch_id = str(batch.get("internal_batch_id") or "")
    if not internal_batch_id:
        raise HTTPException(status_code=404, detail="Batch internal id not found")

    total_rows = int(batch.get("total_rows") or 0)
    loaded_rows = int(batch.get("loaded_rows") or 0)

    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            select count(*) as rejected_rows
            from audit.batch_issue_links
            where batch_id = %s::uuid
              and state = 'ACTIVE'
            """,
            (internal_batch_id,),
        )
        rejected_rows = int(cur.fetchone()["rejected_rows"] or 0)

    quality_base = max(total_rows, loaded_rows + rejected_rows)
    reject_rate = (rejected_rows / quality_base) if quality_base else 0.0

    next_status = batch["status"]
    failed_step = batch.get("failed_step")
    failed_reason = batch.get("failed_reason")
    if rejected_rows == 0 or reject_rate <= REJECT_THRESHOLD:
        next_status = "SUCCESS"
        failed_step = None
        failed_reason = None

    touch_batch(
        batch_id,
        status=next_status,
        failed_step=failed_step,
        failed_reason=failed_reason,
        total_rows=quality_base,
        loaded_rows=loaded_rows,
        rejected_rows=rejected_rows,
        reject_rate=reject_rate,
    )
    return {
        "status": next_status,
        "loaded_rows": loaded_rows,
        "rejected_rows": rejected_rows,
        "reject_rate": reject_rate,
    }


def _refresh_batch_metrics_after_solve(batch_id: str) -> dict[str, Any]:
    batch = get_batch(batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    internal_batch_id = str(batch.get("internal_batch_id") or "")
    if not internal_batch_id:
        raise HTTPException(status_code=404, detail="Batch internal id not found")

    total_rows = int(batch.get("total_rows") or 0)
    loaded_rows = int(batch.get("loaded_rows") or 0) + 1

    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            select count(*) as rejected_rows
            from audit.batch_issue_links
            where batch_id = %s::uuid
              and state = 'ACTIVE'
            """,
            (internal_batch_id,),
        )
        rejected_rows = int(cur.fetchone()["rejected_rows"] or 0)

    quality_base = max(total_rows, loaded_rows + rejected_rows)
    reject_rate = (rejected_rows / quality_base) if quality_base else 0.0

    next_status = batch["status"]
    failed_step = batch.get("failed_step")
    failed_reason = batch.get("failed_reason")
    if rejected_rows == 0 or reject_rate <= REJECT_THRESHOLD:
        next_status = "SUCCESS"
        failed_step = None
        failed_reason = None

    touch_batch(
        batch_id,
        status=next_status,
        failed_step=failed_step,
        failed_reason=failed_reason,
        total_rows=quality_base,
        loaded_rows=loaded_rows,
        rejected_rows=rejected_rows,
        reject_rate=reject_rate,
    )
    return {
        "status": next_status,
        "loaded_rows": loaded_rows,
        "rejected_rows": rejected_rows,
        "reject_rate": reject_rate,
    }


@app.post("/ingest/{dataset}")
async def ingest_csv(
    dataset: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
):
    dataset = _validate_dataset(dataset)

    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="File harus CSV")

    safe_name = Path(file.filename).name
    target_file = UPLOAD_DIR / f"{dataset}__{uuid.uuid4().hex}__{safe_name}"
    content = await file.read()
    target_file.write_bytes(content)

    batch = create_batch(dataset, target_file)
    background_tasks.add_task(run_ingestion_flow, batch["internal_batch_id"])

    return {"batch_id": batch["batch_id"], "status": "UPLOADED"}


@app.get("/ingest/{batch_id}")
def get_ingestion_status(batch_id: str):
    batch = get_batch(batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    return {
        "batch_id": batch["batch_id"],
        "dataset": batch["dataset"],
        "status": batch["status"],
        "failed_step": batch["failed_step"],
        "failed_reason": batch["failed_reason"],
        "metrics": {
            "total": int(batch["total_rows"] or 0),
            "loaded": int(batch["loaded_rows"] or 0),
            "rejected": int(batch["rejected_rows"] or 0),
            "reject_rate": float(batch["reject_rate"] or 0),
        },
        "run_count": int(batch["run_count"] or 0),
        "created_at": batch["created_at"],
        "updated_at": batch["updated_at"],
    }


@app.get("/ingest")
def get_batches(
    dataset: str | None = Query(default=None),
    status: str | None = Query(default=None),
):
    if dataset:
        dataset = _validate_dataset(dataset)

    batches = list_batches(dataset, status)
    return {"items": batches, "count": len(batches)}


@app.get("/ingest/{batch_id}/source")
def download_batch_source(batch_id: str):
    batch = get_batch(batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    source_file = Path(str(batch.get("source_file") or ""))
    if not source_file.exists() or not source_file.is_file():
        raise HTTPException(status_code=404, detail="Source file not found")

    return FileResponse(
        path=source_file,
        filename=source_file.name,
        media_type="text/csv",
    )


@app.post("/ingest/{batch_id}/rerun")
def rerun_batch(batch_id: str, background_tasks: BackgroundTasks):
    batch = get_batch(batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    if batch["status"] not in RERUN_ALLOWED_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Batch status {batch['status']} tidak bisa di-rerun",
        )

    try:
        new_batch = create_rerun_batch(batch_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Batch not found")

    background_tasks.add_task(run_ingestion_flow, new_batch["internal_batch_id"])
    return {
        "source_batch_id": batch_id,
        "new_batch_id": new_batch["batch_id"],
        "source_status": batch["status"],
        "rerun": "queued",
    }


@app.get("/ingest/{batch_id}/rejected")
def get_batch_rejected(batch_id: str):
    batch = get_batch(batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    rows = [_decorate_rejected_row(row) for row in get_rejected_rows(batch_id)]

    return {
        "batch_id": batch_id,
        "dataset": batch["dataset"],
        "rejected_count": len(rows),
        "auto_removed_count": 0,
        "items": rows,
    }


@app.post("/ingest/{batch_id}/rejected/{rejected_id}/ignore")
def ignore_rejected(batch_id: str, rejected_id: int):
    batch = get_batch(batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    row = get_rejected_row(batch_id, rejected_id)
    if not row:
        raise HTTPException(status_code=404, detail="Rejected row not found")

    deleted = delete_rejected_row(batch_id, rejected_id)
    if not deleted:
        raise HTTPException(status_code=500, detail="Failed to ignore rejected row")

    return {
        "batch_id": batch_id,
        "rejected_id": rejected_id,
        "action": "ignored",
    }


@app.post("/ingest/{batch_id}/rejected/{rejected_id}/solve")
def solve_rejected(
    batch_id: str,
    rejected_id: int,
    background_tasks: BackgroundTasks,
    rerun: bool = Query(default=False),
):
    batch = get_batch(batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    row = get_rejected_row(batch_id, rejected_id)
    if not row:
        raise HTTPException(status_code=404, detail="Rejected row not found")

    _apply_solve_for_row(row)
    affected_batches = resolve_issue_and_delete_links(batch_id, rejected_id, batch_id)
    if not affected_batches:
        raise HTTPException(status_code=409, detail="Issue link tidak ditemukan untuk rejected row ini")

    metrics = _refresh_batch_metrics_after_solve(batch_id)
    for affected_batch_id in affected_batches:
        if affected_batch_id == batch_id:
            continue
        _refresh_batch_metrics_after_rejected_cleanup(affected_batch_id)
    queued = False
    rerun_batch_id = None
    if rerun:
        rerun_batch_meta = create_rerun_batch(batch_id)
        rerun_batch_id = rerun_batch_meta["batch_id"]
        background_tasks.add_task(run_ingestion_flow, rerun_batch_meta["internal_batch_id"])
        queued = True

    return {
        "batch_id": batch_id,
        "rejected_id": rejected_id,
        "action": "solved",
        "rerun": "queued" if queued else "skipped",
        "rerun_batch_id": rerun_batch_id,
        "metrics": metrics,
    }
