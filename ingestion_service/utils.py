from __future__ import annotations

import logging
import hashlib
import re
import uuid
from datetime import date, datetime

from dateutil import parser as dtparser

logger = logging.getLogger(__name__)


def stable_bigint_id(*parts: str) -> int:
    normalized = "|".join(p.strip().upper() for p in parts if p is not None)
    hashed = hashlib.sha256(normalized.encode("utf-8")).hexdigest()
    return int(hashed[:15], 16)


def stable_uuid(namespace: str, *parts: str) -> uuid.UUID:
    name = f"{namespace}:" + "|".join((p or "").strip().upper() for p in parts)
    return uuid.uuid5(uuid.NAMESPACE_URL, name)


def parse_int_loose(value: str) -> int:
    if value is None:
        return 0
    stripped = str(value).strip()
    if not stripped:
        return 0
    compact = re.sub(r"\s+", "", stripped.replace(".", "").replace(",", ""))
    if not compact:
        return 0
    try:
        return int(compact)
    except ValueError:
        logger.warning("Invalid numeric value '%s', defaulting to 0", stripped)
        return 0


def parse_date_master(value: str) -> date:
    return dtparser.parse(str(value), dayfirst=True).date()


def parse_tx_timestamp(value: str) -> datetime:
    raw = re.sub(r"\s*\(.*\)\s*$", "", str(value).strip())
    parsed = dtparser.parse(raw)
    return parsed.replace(tzinfo=None)


def normalize_status(value: str) -> str:
    lowered = str(value).strip().lower()
    if lowered in {"success", "sukses", "ok", "1", "true"}:
        return "success"
    return "failed"
