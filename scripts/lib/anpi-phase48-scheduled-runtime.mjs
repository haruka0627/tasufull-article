/**
 * ANPI Phase 48 — Staging Scheduled Runtime Integration
 *
 * Wraps Phase 47 Notification Runtime Core with:
 * - staging-only enable flag + project-ref guards
 * - Production fail-closed rejection at the entrypoint
 * - DB lease concurrency control (anpi_scheduler_runs)
 * - talk_local* provider validation
 * - JSON observability summary (no secrets / PII)
 *
 * Does not reimplement reminder/overdue/contact logic — calls Phase 47 export.
 */

import { runAnpiPhase47NotificationRuntimeCore } from "./anpi-phase47-notification-runtime-core.mjs";

export const PRODUCTION_SUPABASE_REF = "ddojquacsyqesrjhcvmn";
export const STAGING_SUPABASE_REF = "ahlxuyvhzqdqaojiywmu";
export const LEASE_WORKER_PREFIX = "anpi-p48-lease:";
export const DEFAULT_LEASE_TTL_MS = 10 * 60 * 1000;

function firstRow(json) {
  if (!json) return null;
  return Array.isArray(json) ? json[0] : json;
}

function extractProjectRef(apiUrl) {
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

async function restSelect(apiUrl, serviceKey, resourcePath) {
  const res = await fetch(`${apiUrl}/rest/v1/${resourcePath}`, {
    method: "GET",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Prefer: "return=representation",
    },
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : [];
  } catch {
    json = [];
  }
  if (!res.ok) {
    const code = json?.code || json?.message || `HTTP_${res.status}`;
    throw new Error(`anpi_phase48_restSelect_failed:${String(code).slice(0, 90)}`);
  }
  return Array.isArray(json) ? json : [];
}

async function restInsert(apiUrl, serviceKey, table, row) {
  const res = await fetch(`${apiUrl}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(row),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    const code = json?.code || json?.message || `HTTP_${res.status}`;
    throw new Error(`anpi_phase48_restInsert_${table}_failed:${String(code).slice(0, 90)}`);
  }
  return firstRow(json);
}

async function restPatch(apiUrl, serviceKey, resourcePath, patchRow) {
  const res = await fetch(`${apiUrl}/rest/v1/${resourcePath}`, {
    method: "PATCH",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(patchRow),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    const code = json?.code || json?.message || `HTTP_${res.status}`;
    throw new Error(`anpi_phase48_restPatch_failed:${String(code).slice(0, 90)}`);
  }
  return json;
}

/**
 * Validate staging enablement + project identity. Fail closed for Production.
 */
export function validatePhase48StagingGuards({
  apiUrl,
  serviceKey,
  projectRef,
  enabled,
  failIfDisabled = true,
}) {
  const enabledNorm = String(enabled ?? "").trim().toLowerCase();
  if (enabledNorm !== "true") {
    if (failIfDisabled) {
      throw new Error("anpi_phase48_runtime_disabled");
    }
    return { ok: false, skipped: true, reason: "disabled" };
  }

  if (!apiUrl) throw new Error("anpi_phase48_missing_apiUrl");
  if (!serviceKey) throw new Error("anpi_phase48_missing_serviceKey");

  const url = String(apiUrl);
  if (url.includes(PRODUCTION_SUPABASE_REF)) {
    throw new Error("anpi_phase48_refusing_production_endpoint");
  }

  const expected = String(projectRef || "").trim();
  if (!expected) throw new Error("anpi_phase48_missing_project_ref");
  if (expected === PRODUCTION_SUPABASE_REF) {
    throw new Error("anpi_phase48_refusing_production_project_ref");
  }

  const derived = extractProjectRef(apiUrl);
  if (derived === PRODUCTION_SUPABASE_REF) {
    throw new Error("anpi_phase48_refusing_production_endpoint");
  }

  // local Supabase is only for unit/integration tests (projectRef must be "local").
  if (derived === "local") {
    if (expected !== "local") {
      throw new Error("anpi_phase48_local_requires_project_ref_local");
    }
  } else {
    if (derived !== STAGING_SUPABASE_REF) {
      throw new Error("anpi_phase48_unexpected_project_ref");
    }
    if (expected !== STAGING_SUPABASE_REF) {
      throw new Error("anpi_phase48_project_ref_not_staging");
    }
    if (derived !== expected) {
      throw new Error("anpi_phase48_project_ref_mismatch");
    }
  }

  return { ok: true, skipped: false, derivedRef: derived || expected };
}

/**
 * Expire stale Phase 48 leases, then try to acquire a new lease row.
 * Winner = oldest unfinished lease for this window; losers finish immediately as skip.
 */
export async function acquirePhase48Lease({
  apiUrl,
  serviceKey,
  holderId,
  pNow = new Date().toISOString(),
  leaseTtlMs = DEFAULT_LEASE_TTL_MS,
}) {
  const nowMs = new Date(pNow).getTime();
  const cutoffIso = new Date(nowMs - leaseTtlMs).toISOString();
  const workerId = `${LEASE_WORKER_PREFIX}${holderId}`.slice(0, 64);

  // Expire stale unfinished leases so a crashed runner cannot permanently block.
  const stale = await restSelect(
    apiUrl,
    serviceKey,
    `anpi_scheduler_runs?worker_id=like.anpi-p48-lease:*` +
      `&finished_at=is.null&started_at=lt.${cutoffIso}&select=id`
  );
  for (const row of stale) {
    await restPatch(apiUrl, serviceKey, `anpi_scheduler_runs?id=eq.${row.id}`, {
      finished_at: pNow,
      error_safe: "anpi_p48_lease_expired",
    }).catch(() => {});
  }

  const leaseRow = await restInsert(apiUrl, serviceKey, "anpi_scheduler_runs", {
    as_of: pNow,
    worker_id: workerId,
    error_safe: "anpi_p48_lease_active",
  });

  const active = await restSelect(
    apiUrl,
    serviceKey,
    `anpi_scheduler_runs?worker_id=like.anpi-p48-lease:*` +
      `&finished_at=is.null&started_at=gte.${cutoffIso}` +
      `&select=id,worker_id,started_at&order=started_at.asc`
  );

  const winner = active[0] || null;
  const acquired = winner && winner.id === leaseRow.id;
  if (!acquired) {
    await restPatch(apiUrl, serviceKey, `anpi_scheduler_runs?id=eq.${leaseRow.id}`, {
      finished_at: pNow,
      error_safe: "anpi_p48_lease_skip_busy",
    }).catch(() => {});
    return {
      acquired: false,
      leaseId: leaseRow.id,
      workerId,
      reason: "anpi_p48_lease_busy",
    };
  }

  return { acquired: true, leaseId: leaseRow.id, workerId, reason: null };
}

export async function releasePhase48Lease({
  apiUrl,
  serviceKey,
  leaseId,
  pNow = new Date().toISOString(),
  errorSafe = null,
}) {
  if (!leaseId) return;
  await restPatch(apiUrl, serviceKey, `anpi_scheduler_runs?id=eq.${leaseId}`, {
    finished_at: pNow,
    error_safe: errorSafe ? String(errorSafe).slice(0, 500) : null,
  }).catch(() => {});
}

export async function validateTalkLocalProviders({
  apiUrl,
  serviceKey,
  checkIds,
  sinceIso,
}) {
  if (!checkIds?.length) {
    return { ok: true, providers: [], nonLocalCount: 0, deliveryCount: 0 };
  }
  const idList = checkIds.join(",");
  let query =
    `anpi_notification_deliveries?check_id=in.(${idList})` +
    `&select=id,provider,kind,status,created_at`;
  if (sinceIso) {
    query += `&created_at=gte.${sinceIso}`;
  }
  const rows = await restSelect(apiUrl, serviceKey, query);
  const providers = Array.from(
    new Set(rows.map((r) => String(r.provider || "")).filter(Boolean))
  ).sort();
  const nonLocal = rows.filter((r) => !String(r.provider || "").startsWith("talk_local"));
  return {
    ok: nonLocal.length === 0,
    providers,
    nonLocalCount: nonLocal.length,
    deliveryCount: rows.length,
  };
}

function summarizeProcessed(processed) {
  const list = Array.isArray(processed) ? processed : [];
  let jobsClaimed = list.length;
  let jobsDelivered = 0;
  let jobsFailed = 0;
  let contactNotificationsDelivered = 0;
  const byKind = {};
  for (const p of list) {
    byKind[p.kind] = (byKind[p.kind] || 0) + 1;
    if (p.delivery_status === "delivered") {
      jobsDelivered += 1;
      if (p.kind === "contact_unconfirmed") contactNotificationsDelivered += 1;
    } else if (p.delivery_status === "failed" || p.error) {
      jobsFailed += 1;
    }
  }
  return {
    jobsClaimed,
    jobsProcessed: list.length,
    jobsDelivered,
    jobsFailed,
    contactNotificationsDelivered,
    processedByKind: byKind,
  };
}

/**
 * Staging scheduled entrypoint.
 * @returns {Promise<object>} JSON-safe summary (no secrets)
 */
export async function runAnpiPhase48ScheduledRuntime({
  apiUrl,
  serviceKey,
  projectRef,
  enabled,
  pNow = new Date().toISOString(),
  workerId = `anpi-p48-${Date.now().toString(36)}`,
  stubMode = "success",
  failIfDisabled = true,
  leaseTtlMs = DEFAULT_LEASE_TTL_MS,
  holderId = null,
}) {
  const runStartedAt = new Date().toISOString();
  const pNowIso = new Date(pNow).toISOString();
  const derivedRef = extractProjectRef(apiUrl) || String(projectRef || "");

  const baseSummary = {
    phase: 48,
    environment: derivedRef === "local" ? "local" : "staging",
    project_ref: derivedRef === "local" ? "local" : STAGING_SUPABASE_REF,
    run_started_at: runStartedAt,
    run_finished_at: null,
    scheduler_tick: null,
    jobsClaimed: 0,
    jobsProcessed: 0,
    jobsDelivered: 0,
    jobsFailed: 0,
    reminders_created: 0,
    lateConfirmationCreatedCount: 0,
    contact_notifications_delivered: 0,
    providers: [],
    provider_validation: "pending",
    lease: null,
    status: "FAIL",
    overall_status: "FAIL",
  };

  const guard = validatePhase48StagingGuards({
    apiUrl,
    serviceKey,
    projectRef,
    enabled,
    failIfDisabled,
  });
  if (guard.skipped) {
    return {
      ...baseSummary,
      run_finished_at: new Date().toISOString(),
      status: "SKIPPED",
      overall_status: "SKIPPED",
      provider_validation: "skipped",
      reason: guard.reason,
    };
  }

  const leaseHolder = String(holderId || workerId).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || "runner";
  const lease = await acquirePhase48Lease({
    apiUrl,
    serviceKey,
    holderId: leaseHolder,
    pNow: pNowIso,
    leaseTtlMs,
  });
  baseSummary.lease = lease.acquired ? "acquired" : "busy";

  if (!lease.acquired) {
    return {
      ...baseSummary,
      run_finished_at: new Date().toISOString(),
      status: "SKIPPED",
      overall_status: "SKIPPED",
      provider_validation: "skipped",
      reason: lease.reason || "anpi_p48_lease_busy",
    };
  }

  try {
    const core = await runAnpiPhase47NotificationRuntimeCore({
      apiUrl,
      serviceKey,
      pNow: pNowIso,
      workerId: String(workerId).slice(0, 64),
      stubMode,
    });

    const stats = summarizeProcessed(core.processed);
    const checkIds = Array.from(
      new Set((core.processed || []).map((p) => p.checkId).filter(Boolean))
    );
    const reminderJobs = (core.processed || []).filter((p) => p.kind === "reminder");
    const providerCheck = await validateTalkLocalProviders({
      apiUrl,
      serviceKey,
      checkIds,
      sinceIso: runStartedAt,
    });

    if (!providerCheck.ok) {
      await releasePhase48Lease({
        apiUrl,
        serviceKey,
        leaseId: lease.leaseId,
        pNow: new Date().toISOString(),
        errorSafe: "anpi_p48_non_local_provider",
      });
      const failSummary = {
        ...baseSummary,
        ...stats,
        reminders_created: reminderJobs.length,
        lateConfirmationCreatedCount: core.lateConfirmationCreatedCount || 0,
        contact_notifications_delivered: stats.contactNotificationsDelivered,
        providers: providerCheck.providers,
        provider_validation: "FAIL",
        run_finished_at: new Date().toISOString(),
        status: "FAIL",
        overall_status: "FAIL",
        reason: "anpi_p48_non_local_provider",
      };
      throw Object.assign(new Error("anpi_phase48_non_local_provider"), { summary: failSummary });
    }

    await releasePhase48Lease({
      apiUrl,
      serviceKey,
      leaseId: lease.leaseId,
      pNow: new Date().toISOString(),
      errorSafe: null,
    });

    return {
      ...baseSummary,
      ...stats,
      reminders_created: reminderJobs.length,
      lateConfirmationCreatedCount: core.lateConfirmationCreatedCount || 0,
      contact_notifications_delivered: stats.contactNotificationsDelivered,
      providers: providerCheck.providers,
      provider_validation: "PASS",
      run_finished_at: new Date().toISOString(),
      status: "PASS",
      overall_status: "PASS",
      processedByKind: stats.processedByKind,
    };
  } catch (e) {
    if (e?.summary) throw e;
    await releasePhase48Lease({
      apiUrl,
      serviceKey,
      leaseId: lease.leaseId,
      pNow: new Date().toISOString(),
      errorSafe: "anpi_p48_runtime_error",
    });
    throw e;
  }
}
