/**
 * Materials Creator ownership — PUBLIC_INDEX creator_user_id
 * Canonical value = TASFUL Account user_id (AD-051 / Marketplace sellerUserId).
 * Never invents owners. Never maps generators / auto-supply / official TASFUL to a user.
 */
import path from "node:path";
export const CONTRACT_VERSION = "materials_creator_ownership_index.v1";

/** Same identity keys as materials-data CREATOR_ID_FIELDS / Marketplace sellerUserId. */
export const CANONICAL_OWNER_ID_FIELDS = Object.freeze([
  "creator_user_id",
  "seller_user_id",
  "sellerUserId",
  "owner_id",
  "user_id",
]);

const REJECT_EXACT = new Set([
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
]);

const REJECT_SUBSTRING = [
  "comfyui",
  "auto-generator",
  "autogenerator",
  "local-synthesis",
  "ace-step",
  "template-local",
  "presentation-local",
  "generator",
];

function normalizeCandidate(raw) {
  return String(raw == null ? "" : raw).trim();
}

function looksLikePathOrEmail(value) {
  if (value.includes("@")) return true;
  if (value.includes("/") || value.includes("\\")) return true;
  if (value.includes("://")) return true;
  return false;
}

function looksLikeAccountUserId(value) {
  if (value.length < 2 || value.length > 80) return false;
  return /^[A-Za-z0-9._:-]+$/.test(value);
}

/**
 * @param {object} source metadata.json row or index item
 * @returns {{ ok: true, creator_user_id: string, source_field: string } | { ok: false, reason: string }}
 */
export function resolveCanonicalCreatorUserId(source = {}) {
  if (!source || typeof source !== "object") {
    return { ok: false, reason: "source_missing" };
  }
  for (const field of CANONICAL_OWNER_ID_FIELDS) {
    const value = normalizeCandidate(source[field]);
    if (!value) continue;
    const lowered = value.toLowerCase();
    if (REJECT_EXACT.has(lowered)) {
      return { ok: false, reason: "rejected_token", field, value };
    }
    if (REJECT_SUBSTRING.some((token) => lowered.includes(token))) {
      return { ok: false, reason: "rejected_generator_or_provider", field, value };
    }
    if (looksLikePathOrEmail(value) || !looksLikeAccountUserId(value)) {
      return { ok: false, reason: "not_tasful_account_user_id", field, value };
    }
    return { ok: true, creator_user_id: value, source_field: field };
  }
  return { ok: false, reason: "unresolved" };
}

/**
 * Attach creator_user_id only when resolved. Does not write empty / null / UNKNOWN.
 * @param {object} item
 * @param {object} [meta]
 */
export function attachResolvedCreatorUserId(item, meta) {
  if (!item || typeof item !== "object") return item;
  const resolved = resolveCanonicalCreatorUserId(meta && typeof meta === "object" ? meta : item);
  if (!resolved.ok) {
    if (item.creator_user_id != null && item.creator_user_id !== "") {
      const next = { ...item };
      delete next.creator_user_id;
      return next;
    }
    return item;
  }
  return { ...item, creator_user_id: resolved.creator_user_id };
}

export function metadataPathFromSourcePath(sourcePath) {
  const raw = String(sourcePath || "").trim();
  if (!raw) return "";
  const lower = raw.replace(/\\/g, "/").toLowerCase();
  if (lower.endsWith("metadata.json")) return raw;
  const ext = path.extname(raw);
  if (ext) return path.join(path.dirname(raw), "metadata.json");
  return path.join(raw, "metadata.json");
}
