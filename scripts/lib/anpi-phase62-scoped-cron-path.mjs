/**
 * ANPI Phase 62 — Scoped Cron path (staging only).
 *
 * When ANPI_P62_SCOPED_CRON_PATH=true:
 *   claim via anpi_phase62_claim_jobs_allowlisted
 *   write via Phase 61 scoped writer (ANPI_P61_SCOPED_WRITER_ENABLED must be true)
 *
 * When false: callers must use legacy Phase 47 stub path (unchanged).
 * Does NOT modify anpi_phase6_claim_jobs.
 */

import {
  STAGING_SUPABASE_REF,
  PRODUCTION_SUPABASE_REF,
} from "./anpi-phase48-scheduled-runtime.mjs";
import {
  createScopedRestClient,
  scopedWriteForJob,
  ANPI_P61_ENABLE_ENV,
  ANPI_P61_TARGET_AUTH_SHA8,
  sha8,
} from "./anpi-phase61-scoped-job-writer.mjs";

export const ANPI_P62_SCOPED_CRON_ENV = "ANPI_P62_SCOPED_CRON_PATH";

export function isScopedCronPathEnabled(env = {}) {
  return String(env[ANPI_P62_SCOPED_CRON_ENV] || "").trim().toLowerCase() === "true";
}

export function assertScopedCronEnv(env = {}) {
  const environment = String(env.ANPI_ENVIRONMENT || "").trim().toLowerCase();
  const projectRef = String(env.ANPI_STAGING_PROJECT_REF || env.ANPI_PROJECT_REF || "").trim();
  if (environment !== "staging") {
    throw new Error("anpi_p62_env_not_staging");
  }
  if (projectRef !== STAGING_SUPABASE_REF) {
    throw new Error("anpi_p62_project_ref_not_staging");
  }
  if (projectRef === PRODUCTION_SUPABASE_REF) {
    throw new Error("anpi_p62_refusing_production");
  }
  const provider = String(env.ANPI_NOTIFICATION_PROVIDER || "talk_local").trim();
  // Provider var stays talk_local* even during scoped soak (real write is flag path, not provider flip).
  if (!provider.startsWith("talk_local")) {
    throw new Error("anpi_p62_provider_must_remain_talk_local");
  }
}

async function rpc(apiUrl, serviceKey, name, args = {}) {
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
  if (!res.ok) {
    const code = json?.code || json?.message || `HTTP_${res.status}`;
    throw new Error(`anpi_p62_rpc_${name}:${String(code).slice(0, 100)}`);
  }
  return json;
}

async function restPatch(apiUrl, serviceKey, path, body) {
  const res = await fetch(`${apiUrl}/rest/v1/${path}`, {
    method: "PATCH",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`anpi_p62_patch_${res.status}:${t.slice(0, 80)}`);
  }
}

/**
 * Process allowlisted claimed jobs with Phase 61 writer.
 * Does not run Phase 4 tick / stub send (isolates soak from other users).
 */
export async function runAnpiPhase62ScopedCronPath({
  apiUrl,
  serviceKey,
  env = {},
  workerId = "anpi-p62-scoped",
  pNow = new Date().toISOString(),
  claimLimit = 5,
}) {
  assertScopedCronEnv(env);
  if (!isScopedCronPathEnabled(env)) {
    throw new Error("anpi_p62_scoped_cron_flag_off");
  }
  if (String(env[ANPI_P61_ENABLE_ENV] || "").trim().toLowerCase() !== "true") {
    throw new Error("anpi_p62_writer_flag_off");
  }

  const client = createScopedRestClient({
    apiUrl,
    serviceKey,
    envRef: STAGING_SUPABASE_REF,
  });

  const pNowIso = new Date(pNow).toISOString();
  const claimed = await rpc(apiUrl, serviceKey, "anpi_phase62_claim_jobs_allowlisted", {
    p_worker_id: String(workerId).slice(0, 64),
    p_limit: claimLimit,
    p_now: pNowIso,
    p_lease: "00:02:00",
  });
  const jobs = Array.isArray(claimed) ? claimed : [];
  const processed = [];

  for (const job of jobs) {
    const subjectSha = sha8(job.subject_user_id);
    if (subjectSha !== ANPI_P61_TARGET_AUTH_SHA8) {
      // Hard stop condition: allowlist RPC must not return non-test subjects.
      throw new Error("anpi_p62_allowlist_violation");
    }

    try {
      const write = await scopedWriteForJob(client, job, {
        dryRun: false,
        env,
        envRef: STAGING_SUPABASE_REF,
        logicalDueAt: job.available_at || pNowIso,
      });

      const delivered =
        write.reason_code === "anpi_p61_inserted" || write.reason_code === "anpi_p61_already_seen";

      if (delivered) {
        await restPatch(apiUrl, serviceKey, `anpi_scheduler_jobs?id=eq.${job.id}`, {
          status: "sent",
          completed_at: pNowIso,
          claimed_at: null,
          claimed_by: null,
          lease_expires_at: null,
          last_error_safe: null,
        });
      } else if (write.reason_code === "anpi_p61_identity_not_allowlisted") {
        await restPatch(apiUrl, serviceKey, `anpi_scheduler_jobs?id=eq.${job.id}`, {
          status: "skipped",
          completed_at: pNowIso,
          claimed_at: null,
          claimed_by: null,
          lease_expires_at: null,
          last_error_safe: "anpi_p61_identity_not_allowlisted",
        });
      } else {
        await restPatch(apiUrl, serviceKey, `anpi_scheduler_jobs?id=eq.${job.id}`, {
          status: "failed",
          completed_at: pNowIso,
          claimed_at: null,
          claimed_by: null,
          lease_expires_at: null,
          last_error_safe: String(write.reason_code || "anpi_p62_write_failed").slice(0, 200),
        });
      }

      processed.push({
        jobId: job.id,
        checkId: job.check_id,
        kind: job.kind,
        subject_sha8: subjectSha,
        delivery_status: delivered ? "delivered" : write.status || "failed",
        write_reason: write.reason_code,
        notification_id: write.notification_id || null,
        already_seen: Boolean(write.already_seen),
        inserted: Number(write.inserted || 0),
        attempt_number: job.attempt_count ?? null,
      });
    } catch (e) {
      try {
        await restPatch(apiUrl, serviceKey, `anpi_scheduler_jobs?id=eq.${job.id}`, {
          status: "failed",
          completed_at: pNowIso,
          claimed_at: null,
          claimed_by: null,
          lease_expires_at: null,
          last_error_safe: String(e?.message || "error").slice(0, 200),
        });
      } catch {
        /* ignore */
      }
      processed.push({
        jobId: job.id,
        checkId: job.check_id,
        kind: job.kind,
        subject_sha8: subjectSha,
        delivery_status: "failed",
        error: String(e?.message || e).slice(0, 160),
      });
    }
  }

  return {
    mode: "scoped_cron",
    claimed: jobs.length,
    processed,
    lateConfirmationCreatedCount: 0,
  };
}
