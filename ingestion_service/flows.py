from __future__ import annotations

from prefect import flow, get_run_logger, task

from ingestion_service.pipeline import run_batch


@task(retries=2, retry_delay_seconds=5, log_prints=True)
def run_pipeline(batch_id: str) -> None:
    run_batch(batch_id)


@flow(name="csv-ingestion")
def ingest_flow(batch_id: str) -> None:
    logger = get_run_logger()
    logger.info("Start ingestion batch_id=%s", batch_id)
    run_pipeline(batch_id)
    logger.info("Completed ingestion batch_id=%s", batch_id)


def run_ingestion_flow(batch_id: str) -> None:
    ingest_flow(batch_id)
