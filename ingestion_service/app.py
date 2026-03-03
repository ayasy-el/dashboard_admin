from __future__ import annotations

from pathlib import Path
import uuid

from fastapi import BackgroundTasks, FastAPI, File, HTTPException, Query, UploadFile

from ingestion_service.config import DATASETS, FAILED_STATUSES, UPLOAD_DIR
from ingestion_service.db import create_batch, get_batch, get_rejected_rows, list_batches
from ingestion_service.flows import run_ingestion_flow

app = FastAPI(title="Data Ingestion Service", version="0.1.0")


def _validate_dataset(dataset: str) -> str:
    normalized = dataset.strip().lower()
    if normalized not in DATASETS:
        raise HTTPException(status_code=400, detail=f"Unsupported dataset: {dataset}")
    return normalized


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

    batch_id = create_batch(dataset, target_file)
    background_tasks.add_task(run_ingestion_flow, batch_id)

    return {"batch_id": batch_id, "status": "UPLOADED"}


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


@app.post("/ingest/{batch_id}/rerun")
def rerun_batch(batch_id: str, background_tasks: BackgroundTasks):
    batch = get_batch(batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    if batch["status"] not in FAILED_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Batch status {batch['status']} tidak bisa di-rerun",
        )

    background_tasks.add_task(run_ingestion_flow, batch_id)
    return {"batch_id": batch_id, "status": batch["status"], "rerun": "queued"}


@app.get("/ingest/{batch_id}/rejected")
def get_batch_rejected(batch_id: str):
    batch = get_batch(batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    rows = get_rejected_rows(batch_id)
    return {
        "batch_id": batch_id,
        "dataset": batch["dataset"],
        "rejected_count": len(rows),
        "items": rows,
    }
