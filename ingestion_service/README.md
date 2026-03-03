# Data Ingestion Service

FastAPI service untuk upload CSV, trigger pipeline ingestion, monitoring batch, rerun batch gagal, dan melihat rejected rows.

## Fitur

- `POST /ingest/{dataset}` upload CSV + create batch + trigger Prefect flow
- `GET /ingest/{batch_id}` status batch dan metrics
- `GET /ingest` list batch (filter `dataset`, `status`)
- `POST /ingest/{batch_id}/rerun` rerun batch gagal
- `GET /ingest/{batch_id}/rejected` list rejected rows

Dataset yang didukung:

- `master`
- `transactions`
- `total_point`
- `list_kota`

## Setup

1. Install dependency:

```bash
pip install -r ingestion_service/requirements.txt
```

2. Buat file `ingestion_service/.env`:

```bash
cp ingestion_service/.env.example ingestion_service/.env
```

Isi nilainya sesuai environment:

```env
DATABASE_URL=postgresql://user:pass@host:5432/dbname
INGEST_UPLOAD_DIR=./ingestion_service/uploads
INGEST_REJECT_THRESHOLD=0.2
```

3. Jalankan API:

```bash
uvicorn ingestion_service.main:app --reload --port 8001
```

## Prefect

Flow ada di `ingestion_service/flows.py` (`csv-ingestion`):

- retry task otomatis (`retries=2`)
- logging run dan status step
- business logic tetap di `ingestion_service/pipeline.py`

Untuk observability UI Prefect, jalankan worker/server Prefect sesuai environment Anda.
