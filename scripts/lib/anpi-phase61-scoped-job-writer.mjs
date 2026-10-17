/**
 * ANPI Phase 61 — Staging scoped job-writer (manual path · Cron NOT cut over).
 *
 * Uses existing public.talk_notifications (+ optional sidecar links) with
 * anpi.talk.contract.v1. Does NOT flip Cloudflare Cron provider.
 * Does NOT call attempt-scoped Phase 8/10 create_internal as primary writer
 * (attempt keys violate stable idempotency). Stable key is computed in JS.
 *
 * Fail-closed: staging ref · explicit enable flag · test identity allowlist ·
 * service_role only (caller supplies key).
 */

import crypto from "node:crypto";
import {
  STAGING_SUPABASE_REF,
  PRODUCTION_SUPABASE_REF,
} from "./anpi-phase48-scheduled-runtime.mjs";
import {
  buildNotificationContract,
  validateContract,
  templateForKind,
} from "./anpi-talk-contract.mjs";

export const ANPI_P61_SOURCE = "anpi_phase61_test";
export const ANPI_P61_TYPE = "anpi";
export const ANPI_P61_TARGET_URL = "#";
export const ANPI_P61_OFFICIAL_ROOM = "official_anpi";
export const ANPI_P61_TARGET_AUTH_SHA8 = "0411f04d";
export const ANPI_P61_TARGET_TALK_SHA16 = "88d3dbfacf62520b";
export const ANPI_P61_ALLOWLIST_AUTH_SHA8 = Object.freeze([ANPI_P61_TARGET_AUTH_SHA8]);
export const ANPI_P61_ENABLE_ENV = "ANPI_P61_SCOPED_WRITER_ENABLED";

/** Catalog titles aligned with Phase 10 anpi_phase10_render_talk_row (no HTML/URL). */
export const ANPI_P61_RENDER = Object.freeze({
  "anpi.initial": {
    title: "安否確認のお願い",
    body: "本日の安否確認をお願いします。",
    priority: "normal",
  },
  "anpi.reminder": {
    title: "安否確認リマインド",
    body: "安否確認がまだ完了していません。",
    priority: "high",
  },
  "anpi.contact_unconfirmed": {
    title: "安否未確認のお知らせ",
    body: "ご家族の安否がまだ確認できていません。",
    priority: "high",
  },
  "anpi.late_confirmation": {
    title: "安否確認の完了（遅延）",
    body: "安否確認が完了しました。",
    priority: "normal",
  },
});

export function extractProjectRef(apiUrl) {
  try {
    const host = new URL(String(apiUrl || "")).hostname || "";
    const m = host.match(/^([a-z0-9]+)\.supabase\.co$/i);
    if (m) return m[1];
    if (host === "127.0.0.1" || host === "localhost") return "local";
    return host || "";
  } catch {
    return "";
  }
}

export function assertStagingScoped(apiUrl, envRef) {
  const url = String(apiUrl || "");
  if (!url) throw new Error("anpi_p61_missing_apiUrl");
  if (url.includes(PRODUCTION_SUPABASE_REF)) {
    throw new Error("anpi_p61_refusing_production_endpoint");
  }
  const ref = extractProjectRef(apiUrl);
  if (ref === PRODUCTION_SUPABASE_REF) {
    throw new Error("anpi_p61_refusing_production_project_ref");
  }
  if (ref !== STAGING_SUPABASE_REF && ref !== "local") {
    throw new Error("anpi_p61_unexpected_project_ref");
  }
  const er = String(envRef || "").trim();
  if (er) {
    if (er === PRODUCTION_SUPABASE_REF) throw new Error("anpi_p61_env_production_ref");
    if (er !== STAGING_SUPABASE_REF && ref !== "local") {
      throw new Error("anpi_p61_env_unexpected_ref");
    }
    if (ref !== "local" && er !== ref) throw new Error("anpi_p61_env_url_ref_mismatch");
  }
  return ref;
}

export function isScopedWriterEnabled(env = process.env) {
  return String(env[ANPI_P61_ENABLE_ENV] || "").trim().toLowerCase() === "true";
}

export function assertScopedWriterEnabled(env = process.env) {
  if (!isScopedWriterEnabled(env)) {
    throw new Error("anpi_p61_flag_off");
  }
}

export function sha8(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, 8);
}

export function sha16(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, 16);
}

export function isAllowlistedAuthUserId(authUserId, allowlist = ANPI_P61_ALLOWLIST_AUTH_SHA8) {
  if (!authUserId) return false;
  return allowlist.includes(sha8(authUserId));
}

/**
 * Stable idempotency key — NO attempt / claim / lease / worker id.
 * Immutable logical factors only.
 */
export function buildStableIdempotencyKey({
  subjectUserId,
  kind,
  checkId,
  logicalDueAt,
}) {
  const subject = String(subjectUserId || "").trim();
  const k = String(kind || "").trim();
  const check = String(checkId || "").trim();
  const due = String(logicalDueAt || "").trim();
  if (!subject || !k || !check || !due) {
    throw new Error("anpi_p61_stable_key_incomplete");
  }
  if (!/^\d{4}-\d{2}-\d{2}/.test(due) && !/^\d{4}-\d{2}-\d{2}T/.test(due)) {
    throw new Error("anpi_p61_stable_key_bad_due");
  }
  // Normalize due to date bucket (UTC date) to avoid ms churn.
  const dueDate = due.slice(0, 10);
  const raw = ["anpi", "p61", "v1", k, check, sha8(subject), dueDate].join(":");
  if (raw.length < 8 || raw.length > 200) throw new Error("anpi_p61_stable_key_length");
  if (!/^[A-Za-z0-9._:-]+$/.test(raw)) throw new Error("anpi_p61_stable_key_charset");
  return raw;
}

export function notificationIdFromIdempotencyKey(key) {
  const hex = crypto.createHash("sha256").update(String(key)).digest("hex");
  return `anpi-p61-${hex}`;
}

export function buildScopedJobContract(job, { logicalDueAt, attemptForContract = 1 } = {}) {
  const due = logicalDueAt || job.available_at || job.created_at || job.logical_due_at;
  const stableKey = buildStableIdempotencyKey({
    subjectUserId: job.subject_user_id || job.owner_id,
    kind: job.kind,
    checkId: job.check_id,
    logicalDueAt: due,
  });
  // Contract attempt_number is informational only — key does NOT include it.
  const contract = buildNotificationContract({
    id: job.id,
    kind: job.kind,
    check_id: job.check_id,
    subject_user_id: job.subject_user_id || job.owner_id,
    attempt_count: attemptForContract,
    idempotency_key: stableKey,
  });
  const err = validateContract(contract);
  if (err) throw new Error(err);
  return { contract, stableKey, notificationId: notificationIdFromIdempotencyKey(stableKey) };
}

export function renderTalkRowFromContract(contract, talkUserId) {
  const template = contract.template_key;
  const cat = ANPI_P61_RENDER[template];
  if (!cat) throw new Error("anpi_p61_unknown_template_render");
  if (!talkUserId) throw new Error("anpi_p61_talk_identity_unresolved");
  return {
    id: notificationIdFromIdempotencyKey(contract.idempotency_key),
    user_id: talkUserId,
    type: ANPI_P61_TYPE,
    title: cat.title,
    body: cat.body,
    target_url: ANPI_P61_TARGET_URL,
    source: ANPI_P61_SOURCE,
    priority: cat.priority,
  };
}

/**
 * Negative: keys that differ only by attempt must still collide on stable builder
 * when logical factors match — and keys with different kind must not collide.
 */
export function assertStableKeySemantics() {
  const base = {
    subjectUserId: "00000000-0000-4000-8000-0000000000aa",
    kind: "initial",
    checkId: "00000000-0000-4000-8000-0000000000bb",
    logicalDueAt: "2026-07-27T01:00:00.000Z",
  };
  const a = buildStableIdempotencyKey(base);
  const b = buildStableIdempotencyKey({ ...base, logicalDueAt: "2026-07-27T23:59:59.000Z" });
  const c = buildStableIdempotencyKey({ ...base, kind: "reminder" });
  if (a !== b) throw new Error("anpi_p61_due_bucket_unstable");
  if (a === c) throw new Error("anpi_p61_kind_collision");
  const parts = a.split(":");
  if (parts[0] !== "anpi" || parts[1] !== "p61" || parts[2] !== "v1") {
    throw new Error("anpi_p61_key_prefix");
  }
  if (a.includes("attempt")) throw new Error("anpi_p61_key_contains_attempt");
  return { ok: true, sample: a, same_due_bucket: a === b, different_kind: a !== c };
}

export function createScopedRestClient({ apiUrl, serviceKey, envRef, env = process.env }) {
  assertStagingScoped(apiUrl, envRef);
  if (!serviceKey) throw new Error("anpi_p61_missing_serviceKey");

  async function rpc(name, args = {}) {
    const res = await fetch(`${apiUrl}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(args),
    });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { ok: res.ok, status: res.status, json, code: json?.code || json?.message || null };
  }

  async function rest(path, { method = "GET", body, headers = {} } = {}) {
    const res = await fetch(`${apiUrl}${path}`, {
      method,
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
        ...headers,
      },
      body: body == null ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { ok: res.ok, status: res.status, json, text: text.slice(0, 300) };
  }

  return Object.freeze({
    apiUrl,
    rpc,
    rest,
    async resolveTalkUserId(authUserId) {
      const r = await rpc("anpi_resolve_talk_user_id", { p_auth_user_id: authUserId });
      if (!r.ok) throw new Error(`anpi_p61_resolve_failed:${r.code || r.status}`);
      return typeof r.json === "string" ? r.json : r.json;
    },
  });
}

/**
 * Core scoped write for one logical job-shaped input.
 * dryRun=true → no INSERT. enabled flag required for live.
 */
export async function scopedWriteForJob(client, job, opts = {}) {
  const {
    dryRun = true,
    env = process.env,
    envRef,
    logicalDueAt,
    allowlist = ANPI_P61_ALLOWLIST_AUTH_SHA8,
  } = opts;

  assertStagingScoped(client.apiUrl, envRef);

  if (!dryRun) assertScopedWriterEnabled(env);

  const subject = job.subject_user_id || job.owner_id;
  if (!isAllowlistedAuthUserId(subject, allowlist)) {
    return {
      status: "skipped",
      reason_code: "anpi_p61_identity_not_allowlisted",
      inserted: 0,
      already_seen: false,
      dry_run: dryRun,
    };
  }

  const { contract, stableKey, notificationId } = buildScopedJobContract(job, {
    logicalDueAt,
    attemptForContract: Number(job.attempt_count) || 1,
  });

  // Resolve talk identity
  const talkUserId = await client.resolveTalkUserId(subject);
  if (sha16(talkUserId) !== ANPI_P61_TARGET_TALK_SHA16) {
    // Allowlist is auth-sha based; talk sha must match Phase 15/17 bind for safety.
    return {
      status: "rejected",
      reason_code: "anpi_p61_talk_identity_not_test_bind",
      inserted: 0,
      already_seen: false,
      dry_run: dryRun,
      idempotency_key: stableKey,
    };
  }

  const row = renderTalkRowFromContract(contract, talkUserId);

  // Existing row?
  const existing = await client.rest(
    `/rest/v1/talk_notifications?id=eq.${encodeURIComponent(notificationId)}&select=id,source,type,user_id`
  );
  const ex = Array.isArray(existing.json) ? existing.json[0] : null;
  if (ex) {
    return {
      status: "already_seen",
      reason_code: "anpi_p61_already_seen",
      inserted: 0,
      already_seen: true,
      dry_run: dryRun,
      notification_id: notificationId,
      idempotency_key: stableKey,
      talk_user_sha16: sha16(talkUserId),
      official_room_id: ANPI_P61_OFFICIAL_ROOM,
      contract_schema: contract.schema,
    };
  }

  if (dryRun) {
    return {
      status: "dry_run",
      reason_code: "anpi_p61_dry_run_would_insert",
      inserted: 0,
      already_seen: false,
      dry_run: true,
      notification_id: notificationId,
      idempotency_key: stableKey,
      talk_user_sha16: sha16(talkUserId),
      row_preview: {
        type: row.type,
        target_url: row.target_url,
        source: row.source,
        title_len: row.title.length,
      },
    };
  }

  const ins = await client.rest("/rest/v1/talk_notifications", {
    method: "POST",
    headers: {
      Prefer: "return=representation,resolution=ignore-duplicates",
    },
    body: row,
  });

  if (!ins.ok && ins.status !== 201 && ins.status !== 200) {
    return {
      status: "failed",
      reason_code: `anpi_p61_insert_http_${ins.status}`,
      inserted: 0,
      already_seen: false,
      dry_run: false,
      idempotency_key: stableKey,
      error_safe: String(ins.code || ins.text || "").slice(0, 80),
    };
  }

  const written = Array.isArray(ins.json) ? ins.json[0] : ins.json;
  const inserted = written && written.id ? 1 : 0;

  // Best-effort sidecar (ignore if table/RPC absent)
  try {
    await client.rest("/rest/v1/anpi_talk_notification_links", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: {
        scheduler_job_id: job.id || null,
        idempotency_key: stableKey,
        talk_notification_id: notificationId,
        talk_user_id: talkUserId,
        state: "written",
      },
    });
  } catch {
    /* optional */
  }

  if (inserted === 0) {
    // conflict ignored
    return {
      status: "already_seen",
      reason_code: "anpi_p61_already_seen",
      inserted: 0,
      already_seen: true,
      dry_run: false,
      notification_id: notificationId,
      idempotency_key: stableKey,
      talk_user_sha16: sha16(talkUserId),
    };
  }

  return {
    status: "inserted",
    reason_code: "anpi_p61_inserted",
    inserted: 1,
    already_seen: false,
    dry_run: false,
    notification_id: notificationId,
    idempotency_key: stableKey,
    talk_user_sha16: sha16(talkUserId),
    official_room_id: ANPI_P61_OFFICIAL_ROOM,
    template_key: templateForKind(job.kind),
  };
}

export async function cleanupScopedMarkers(client, { dryRun = true, notificationId = null } = {}) {
  assertStagingScoped(client.apiUrl);
  let path =
    `/rest/v1/talk_notifications?source=eq.${ANPI_P61_SOURCE}&type=eq.${ANPI_P61_TYPE}&select=id`;
  if (notificationId) {
    path = `/rest/v1/talk_notifications?id=eq.${encodeURIComponent(notificationId)}&source=eq.${ANPI_P61_SOURCE}&type=eq.${ANPI_P61_TYPE}&select=id`;
  }
  const listed = await client.rest(path);
  const rows = Array.isArray(listed.json) ? listed.json : [];
  if (dryRun) {
    return {
      matched_count: rows.length,
      deleted_count: 0,
      dry_run: true,
      reason_code: "anpi_p61_cleanup_dry_run",
      ids: rows.map((r) => String(r.id).slice(0, 20)),
    };
  }
  if (rows.length === 0) {
    return {
      matched_count: 0,
      deleted_count: 0,
      dry_run: false,
      reason_code: "anpi_p61_cleanup_none",
    };
  }
  if (rows.length > 3) {
    return {
      matched_count: rows.length,
      deleted_count: 0,
      dry_run: false,
      blocked: true,
      reason_code: "anpi_p61_cleanup_ambiguous",
    };
  }
  let deleted = 0;
  for (const r of rows) {
    const del = await client.rest(
      `/rest/v1/talk_notifications?id=eq.${encodeURIComponent(r.id)}&source=eq.${ANPI_P61_SOURCE}&type=eq.${ANPI_P61_TYPE}`,
      { method: "DELETE", headers: { Prefer: "return=representation" } }
    );
    if (del.ok) deleted += Array.isArray(del.json) ? del.json.length : 1;
  }
  // sidecar cleanup best-effort
  for (const r of rows) {
    await client.rest(
      `/rest/v1/anpi_talk_notification_links?talk_notification_id=eq.${encodeURIComponent(r.id)}`,
      { method: "DELETE" }
    );
  }
  return {
    matched_count: rows.length,
    deleted_count: deleted,
    dry_run: false,
    reason_code: "anpi_p61_cleanup_deleted",
  };
}
