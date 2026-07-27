/**
 * ANPI Production stable idempotency (Phase 65).
 *
 * Prefix: anpi:prod:v1 — NEVER reuse staging anpi:p61:v1.
 * Factors: kind · check_id · subject_sha8 · UTC YYYY-MM-DD due bucket.
 * Excludes: attempt · lease · worker · execution_id · Cron ms.
 *
 * No network. No Production writes.
 */

import crypto from "node:crypto";

export const ANPI_PROD_KEY_PREFIX = "anpi:prod:v1";
export const ANPI_PROD_SOURCE = "anpi_prod_canary";
export const ANPI_PROD_TYPE = "anpi";
export const ANPI_PROD_TARGET_URL = "#";
export const ANPI_STAGING_KEY_PREFIX = "anpi:p61:v1";

export function sha8(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, 8);
}

export function utcDateBucket(logicalDueAt) {
  const due = String(logicalDueAt || "").trim();
  if (!due) throw new Error("anpi_prod_due_missing");
  if (!/^\d{4}-\d{2}-\d{2}/.test(due) && !/^\d{4}-\d{2}-\d{2}T/.test(due)) {
    throw new Error("anpi_prod_due_malformed");
  }
  return due.slice(0, 10);
}

/**
 * @param {{ subjectUserId: string, kind: string, checkId: string, logicalDueAt: string }} args
 */
export function buildProdStableIdempotencyKey({
  subjectUserId,
  kind,
  checkId,
  logicalDueAt,
}) {
  const subject = String(subjectUserId || "").trim();
  const k = String(kind || "").trim();
  const check = String(checkId || "").trim();
  if (!subject || !k || !check) throw new Error("anpi_prod_key_incomplete");
  const dueDate = utcDateBucket(logicalDueAt);
  const raw = [ANPI_PROD_KEY_PREFIX, k, check, sha8(subject), dueDate].join(":");
  if (raw.length < 16 || raw.length > 220) throw new Error("anpi_prod_key_length");
  if (!/^[A-Za-z0-9._:-]+$/.test(raw)) throw new Error("anpi_prod_key_charset");
  if (raw.includes("attempt") || raw.includes("lease") || raw.includes("worker")) {
    throw new Error("anpi_prod_key_forbidden_token");
  }
  if (raw.startsWith(ANPI_STAGING_KEY_PREFIX)) {
    throw new Error("anpi_prod_key_staging_prefix_leak");
  }
  return raw;
}

export function notificationIdFromProdKey(key) {
  const k = String(key || "");
  if (!k.startsWith(ANPI_PROD_KEY_PREFIX)) {
    throw new Error("anpi_prod_id_requires_prod_prefix");
  }
  const hex = crypto.createHash("sha256").update(k).digest("hex");
  return `anpi-prod-${hex}`;
}

export function assertProdKeySemantics() {
  const base = {
    subjectUserId: "00000000-0000-4000-8000-0000000000aa",
    kind: "initial",
    checkId: "00000000-0000-4000-8000-0000000000bb",
    logicalDueAt: "2026-07-27T08:00:00.000Z",
  };
  const a = buildProdStableIdempotencyKey(base);
  const b = buildProdStableIdempotencyKey({
    ...base,
    logicalDueAt: "2026-07-27T23:59:59.000Z",
  });
  const c = buildProdStableIdempotencyKey({ ...base, kind: "reminder" });
  const d = buildProdStableIdempotencyKey({
    ...base,
    checkId: "00000000-0000-4000-8000-0000000000cc",
  });
  if (a !== b) throw new Error("anpi_prod_due_bucket_unstable");
  if (a === c) throw new Error("anpi_prod_kind_collision");
  if (a === d) throw new Error("anpi_prod_check_collision");
  if (!a.startsWith(ANPI_PROD_KEY_PREFIX)) throw new Error("anpi_prod_prefix");
  if (a.includes(ANPI_STAGING_KEY_PREFIX)) throw new Error("anpi_prod_staging_mix");
  const id = notificationIdFromProdKey(a);
  if (!id.startsWith("anpi-prod-")) throw new Error("anpi_prod_id_prefix");
  // Retry / reclaim / partial failure: same logical factors → same key + id
  const retry = buildProdStableIdempotencyKey(base);
  if (retry !== a || notificationIdFromProdKey(retry) !== id) {
    throw new Error("anpi_prod_retry_not_stable");
  }
  return { ok: true, sample: a, notification_id: id.slice(0, 24) };
}

/**
 * Model partial failure: INSERT succeeded (id known) · job update failed · reclaim.
 * Same key must map to same notification id (already_seen path).
 */
export function simulateReclaimAfterPartialFailure(job) {
  const key1 = buildProdStableIdempotencyKey({
    subjectUserId: job.subject_user_id,
    kind: job.kind,
    checkId: job.check_id,
    logicalDueAt: job.available_at,
  });
  const id1 = notificationIdFromProdKey(key1);
  // reclaim with higher attempt_count must NOT change key
  const key2 = buildProdStableIdempotencyKey({
    subjectUserId: job.subject_user_id,
    kind: job.kind,
    checkId: job.check_id,
    logicalDueAt: job.available_at,
  });
  const id2 = notificationIdFromProdKey(key2);
  return {
    same_key: key1 === key2,
    same_notification_id: id1 === id2,
    key: key1,
    notification_id: id1,
    attempt_ignored: true,
  };
}
