"""Materials Creator ownership WRITE — optional metadata.creator_user_id.

Mirrors scripts/lib/materials-ingest/creator-ownership-write-v1.mjs.
Platform/system generators omit the field unless an official TASFUL Account exists.
Never invents owners. Never trusts a client-supplied id alone.
"""

from __future__ import annotations

import re
from typing import Any

WRITE_CONTRACT_VERSION = "materials_creator_ownership_write.v1"

OWNER_FIELDS = (
    "creator_user_id",
    "seller_user_id",
    "sellerUserId",
    "owner_id",
    "user_id",
)

REJECT_EXACT = {
    "auto-supply",
    "autosupply",
    "platform",
    "official",
    "tasful",
    "tasful-official",
    "tasful_official",
    "operator",
    "unknown",
    "none",
    "null",
    "undefined",
    "n/a",
    "na",
    "anonymous",
    "system",
}

REJECT_SUBSTRING = (
    "comfyui",
    "auto-generator",
    "autogenerator",
    "local-synthesis",
    "ace-step",
    "template-local",
    "presentation-local",
    "generator",
)

ACCOUNT_ID_RE = re.compile(r"^[A-Za-z0-9._:-]+$")
PLATFORM_SOURCES = {"platform", "generator", "system", "auto-supply", "autosupply"}
USER_SOURCES = {"user", "creator"}


def strip_owner_fields(meta: dict[str, Any] | None) -> dict[str, Any]:
    out = dict(meta or {})
    for field in OWNER_FIELDS:
        out.pop(field, None)
    out.pop("__ownership", None)
    return out


def _looks_like_account_user_id(value: str) -> bool:
    if len(value) < 2 or len(value) > 80:
        return False
    if "@" in value or "/" in value or "\\" in value or "://" in value:
        return False
    return bool(ACCOUNT_ID_RE.match(value))


def _resolve_canonical(value: str) -> tuple[bool, str]:
    raw = str(value or "").strip()
    if not raw:
        return False, "unresolved"
    lowered = raw.lower()
    if lowered in REJECT_EXACT:
        return False, "rejected_token"
    if any(token in lowered for token in REJECT_SUBSTRING):
        return False, "rejected_generator_or_provider"
    if not _looks_like_account_user_id(raw):
        return False, "not_tasful_account_user_id"
    return True, raw


def apply_creator_ownership(
    meta: dict[str, Any] | None,
    *,
    source: str = "platform",
    authenticated_user_id: str | None = None,
    claimed_user_id: str | None = None,
    platform_creator_user_id: str | None = None,
) -> dict[str, Any]:
    cleaned = strip_owner_fields(meta)
    src = str(source or "platform").strip().lower()
    claimed = str(claimed_user_id or "").strip()

    if src in PLATFORM_SOURCES:
        official = str(platform_creator_user_id or "").strip()
        if not official:
            return cleaned
        ok, canonical = _resolve_canonical(official)
        if not ok:
            return cleaned
        if claimed and claimed != canonical:
            raise ValueError("client_spoof_denied")
        cleaned["creator_user_id"] = canonical
        return cleaned

    if src not in USER_SOURCES:
        raise ValueError("unknown_ownership_source")

    authenticated = str(authenticated_user_id or "").strip()
    if not authenticated:
        raise ValueError("authenticated_user_required")
    ok, canonical = _resolve_canonical(authenticated)
    if not ok:
        raise ValueError("authenticated_user_not_canonical")
    if claimed and claimed != canonical:
        raise ValueError("client_spoof_denied")
    cleaned["creator_user_id"] = canonical
    return cleaned


def apply_platform_generator_metadata(meta: dict[str, Any] | None) -> dict[str, Any]:
    return apply_creator_ownership(meta, source="platform")
