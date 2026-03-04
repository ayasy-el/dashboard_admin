from __future__ import annotations

import hashlib
import json
from typing import Any


def issue_fields(
    *,
    dataset: str,
    error_type: str,
    error_message: str,
    raw_payload: dict[str, Any],
) -> dict[str, Any]:
    conflict = raw_payload.get("__conflict") if isinstance(raw_payload, dict) else None
    incoming = {}
    if isinstance(conflict, dict):
        incoming = dict(conflict.get("incoming") or {})
    if not incoming and isinstance(raw_payload, dict):
        incoming = dict(raw_payload.get("__incoming") or {})

    kind = (
        str(conflict.get("kind"))
        if isinstance(conflict, dict) and conflict.get("kind")
        else "GENERIC"
    )
    merchant_key = str(incoming.get("merchant_key") or "").strip() or None
    start_period = str(incoming.get("start_period") or "").strip() or None
    end_period = str(incoming.get("end_period") or "").strip() or None

    # Stable key for global issue identity across rerun batches.
    if kind == "RULE_PERIOD_OVERLAP" and merchant_key and start_period and end_period:
        key = f"{dataset}|{kind}|{merchant_key}|{start_period}|{end_period}"
    elif kind in {"FK_VIOLATION", "FK_MISSING", "FK_AMBIGUOUS"} and merchant_key:
        key = f"{dataset}|{kind}|{merchant_key}"
    else:
        payload_digest = hashlib.sha256(
            json.dumps(raw_payload, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode("utf-8")
        ).hexdigest()
        key = f"{dataset}|{kind}|{error_type}|{payload_digest}"

    fingerprint = hashlib.sha256(key.encode("utf-8")).hexdigest()
    return {
        "fingerprint": fingerprint,
        "kind": kind,
        "merchant_key": merchant_key,
        "start_period": start_period,
        "end_period": end_period,
    }
