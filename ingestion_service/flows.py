from __future__ import annotations

import json

from prefect import flow, get_run_logger, task

from ingestion_service.db import get_batch, touch_batch
from ingestion_service.pipeline import (
    BatchError,
    clean_data,
    load_data,
    quality_check,
    stage_csv,
)


def _snapshot_payload(batch: dict | None) -> dict:
    if not batch:
        return {"status": "BATCH_NOT_FOUND"}
    return {
        "dataset": batch.get("dataset"),
        "status": batch.get("status"),
        "failed_step": batch.get("failed_step"),
        "total_rows": int(batch.get("total_rows") or 0),
        "loaded_rows": int(batch.get("loaded_rows") or 0),
        "rejected_rows": int(batch.get("rejected_rows") or 0),
        "reject_rate": float(batch.get("reject_rate") or 0),
    }


def _log_snapshot(phase: str, batch_id: str) -> None:
    logger = get_run_logger()
    payload = _snapshot_payload(get_batch(batch_id))
    logger.info(
        "batch_snapshot phase=%s batch_id=%s payload=%s",
        phase,
        batch_id,
        json.dumps(payload, ensure_ascii=False),
    )


@task(log_prints=True)
def mark_processing(batch_id: str) -> None:
    touch_batch(
        batch_id,
        status="PROCESSING",
        failed_step=None,
        failed_reason=None,
        increment_run_count=True,
    )
    _log_snapshot("PROCESSING", batch_id)


@task(retries=2, retry_delay_seconds=5, log_prints=True)
def stage_step(batch_id: str) -> int:
    total = stage_csv(batch_id)
    _log_snapshot("STAGED", batch_id)
    return total


@task(retries=2, retry_delay_seconds=5, log_prints=True)
def clean_step(batch_id: str) -> int:
    cleaned = clean_data(batch_id)
    touch_batch(batch_id, status="CLEANED")
    _log_snapshot("CLEANED", batch_id)
    return cleaned


@task(retries=2, retry_delay_seconds=5, log_prints=True)
def load_step(batch_id: str) -> int:
    loaded = load_data(batch_id)
    _log_snapshot("LOADED", batch_id)
    return loaded


@task(retries=2, retry_delay_seconds=5, log_prints=True)
def quality_step(batch_id: str) -> None:
    quality_check(batch_id)
    touch_batch(batch_id, status="QUALITY_PASSED")
    _log_snapshot("QUALITY_PASSED", batch_id)


@task(log_prints=True)
def mark_success(batch_id: str) -> None:
    touch_batch(batch_id, status="SUCCESS", failed_step=None, failed_reason=None)
    _log_snapshot("SUCCESS", batch_id)


@task(log_prints=True)
def mark_failed(batch_id: str, step: str, error: str) -> None:
    status = {
        "stage": "FAILED_STAGE",
        "clean": "FAILED_STAGE",
        "load": "FAILED_LOAD",
        "quality": "FAILED_QUALITY",
    }.get(step, "FAILED_LOAD")
    touch_batch(batch_id, status=status, failed_step=step, failed_reason=error)
    _log_snapshot("FAILED", batch_id)


@flow(name="csv-ingestion", flow_run_name="ingest-{dataset}-{batch_id}")
def ingest_flow(batch_id: str, dataset: str) -> None:
    logger = get_run_logger()
    logger.info("Start ingestion batch_id=%s", batch_id)
    _log_snapshot("START", batch_id)

    mark_processing(batch_id)

    try:
        stage_step(batch_id)
    except Exception as exc:
        mark_failed(batch_id, "stage", str(exc))
        raise

    try:
        clean_step(batch_id)
    except Exception as exc:
        mark_failed(batch_id, "clean", str(exc))
        raise

    try:
        load_step(batch_id)
    except Exception as exc:
        mark_failed(batch_id, "load", str(exc))
        raise

    try:
        quality_step(batch_id)
    except BatchError as exc:
        mark_failed(batch_id, "quality", str(exc))
        raise
    except Exception as exc:
        mark_failed(batch_id, "quality", str(exc))
        raise

    mark_success(batch_id)
    _log_snapshot("END", batch_id)
    logger.info("Completed ingestion batch_id=%s", batch_id)


def run_ingestion_flow(batch_id: str) -> None:
    batch = get_batch(batch_id)
    dataset = batch["dataset"] if batch else "unknown"
    ingest_flow(batch_id=batch_id, dataset=dataset)
