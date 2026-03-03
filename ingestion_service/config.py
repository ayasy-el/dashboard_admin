from __future__ import annotations

import os
from pathlib import Path
from typing import Final

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

DATASETS: Final[set[str]] = {"master", "transactions", "total_point", "list_kota"}
FAILED_STATUSES: Final[set[str]] = {"FAILED_STAGE", "FAILED_LOAD", "FAILED_QUALITY"}

DATABASE_URL = os.getenv("DATABASE_URL", "")
UPLOAD_DIR = Path(os.getenv("INGEST_UPLOAD_DIR", str(BASE_DIR / "uploads")))
REJECT_THRESHOLD = float(os.getenv("INGEST_REJECT_THRESHOLD", "0.2"))

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is required (set in ingestion_service/.env)")

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
