# Data Ingestion Service

FastAPI service untuk upload CSV, trigger pipeline ingestion, monitoring batch, rollback batch yang salah, dan melihat rejected rows.

## Fitur

- `POST /ingest/{dataset}` upload CSV + create batch + trigger Prefect flow
- `GET /ingest/{batch_id}` status batch dan metrics
- `GET /ingest` list batch (filter `dataset`, `status`)
- `GET /ingest/{batch_id}/rejected` list rejected rows
- `POST /ingest/{batch_id}/rejected/{rejected_id}/ignore` ignore rejected row
- `POST /ingest/{batch_id}/rejected/{rejected_id}/solve` solve + apply

Dataset yang didukung:

- `master`
- `transactions`
- `total_point`
- `list_kota`

Header CSV wajib per dataset:

- `list_kota`: `region`, `branch`, `cluster`
- `master`: `keyword`, `uniq_merchant`, `merchant_name`, `category`, `point_redeem`, `start_period`, `end_period`, `cluster`
- `transactions`: `timestamp`, `keyword`, `msisdn`, `quantity`, `status`
- `total_point`: `cluster`, `period`, `poin`, `own`

Upload akan ditolak lebih awal dengan HTTP `400` jika header CSV tidak sesuai.

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
PREFECT_API_URL=http://127.0.0.1:4200/api
INGEST_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

3. Jalankan API:

```bash
uvicorn ingestion_service.main:app --reload --port 8001
```

## Prefect

```bash
cd ingestion_service
prefect server start
```

Flow ada di `ingestion_service/flows.py` (`csv-ingestion`):

- retry task otomatis (`retries=2`)
- logging run dan status step
- business logic tetap di `ingestion_service/pipeline.py`

Supaya run dan log muncul di UI Prefect lokal:

- set `PREFECT_API_URL=http://127.0.0.1:4200/api`
- jalankan `prefect server start`
- jalankan ingestion service dengan env yang sama

Tidak perlu `PREFECT_API_KEY` untuk Prefect server lokal. API key hanya dipakai untuk Prefect Cloud.
Kalau Prefect tidak terjangkau, service akan fallback ke eksekusi lokal agar ingestion tetap jalan.

## Catatan `Solve & Apply`

- Tidak semua error bisa auto-solve.
- Auto-solve saat ini fokus ke update current rule state di `dim_merchant`:
  - sistem akan update `point_redeem`, `start_period`, dan `end_period` pada merchant existing
  - lalu hapus rejected row dan upload ulang batch bila perlu
- Error FK/dependency (merchant/cluster tidak ditemukan) tetap butuh perbaikan data referensi terlebih dahulu.
- Setelah ingestion, solve, ignore, atau rollback yang mengubah data warehouse, materialized view akan di-refresh di background.

## Integrasi Dashboard (Next.js)

Set env di aplikasi dashboard:

```env
NEXT_PUBLIC_INGESTION_API_URL=http://127.0.0.1:8001
```
