/**
 * ANPI Phase 56 — Cloudflare Cron adapter (thin)
 *
 * Wires Cloudflare env / scheduled metadata into Phase 48 runtime core.
 * No due pickup / lease / notification logic here — Phase 48 owns that.
 */

import {
  runAnpiPhase48ScheduledRuntime,
  STAGING_SUPABASE_REF,
  PRODUCTION_SUPABASE_REF,
} from "./anpi-phase48-scheduled-runtime.mjs";

export const CF_STAGING_ENV = "staging";
export const CF_ALLOWED_PROVIDER_PREFIX = "talk_local";

function safeErrorCode(err) {
  const msg = String(err?.message || err || "unknown_error");
  return msg.replace(/[^\w.:-]/g, "_").slice(0, 120);
}

function randomSuffix() {
  try {
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      const buf = new Uint8Array(4);
      crypto.getRandomValues(buf);
      return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
    }
  } catch {
    /* ignore */
  }
  return Math.floor(Math.random() * 0xffffffff)
    .toString(16)
    .padStart(8, "0");
}

/**
 * Build a unique execution id for Cloudflare scheduled / diagnostic runs.
 */
export function buildCfExecutionId(scheduledTime) {
  const t = scheduledTime ? new Date(scheduledTime).getTime() : Date.now();
  const stamp = Number.isFinite(t) ? String(t) : String(Date.now());
  return `cf-anpi-staging-${stamp}-${randomSuffix()}`.slice(0, 80);
}

/**
 * Map Worker env bindings → Phase 48 config. Never logs secret values.
 */
export function resolveCfSchedulerConfig(env = {}) {
  const environment = String(env.ANPI_ENVIRONMENT || "").trim().toLowerCase();
  const projectRef = String(
    env.ANPI_STAGING_PROJECT_REF || env.ANPI_PROJECT_REF || ""
  ).trim();
  const enabled = String(env.ANPI_STAGING_RUNTIME_ENABLED || env.ANPI_SCHEDULER_ENABLED || "")
    .trim()
    .toLowerCase();
  const provider = String(
    env.ANPI_NOTIFICATION_PROVIDER || env.ANPI_PROVIDER || "talk_local"
  ).trim();
  const apiUrl = String(
    env.ANPI_STAGING_SUPABASE_URL || env.SUPABASE_URL || ""
  ).trim();
  const serviceKey = String(
    env.ANPI_STAGING_SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || ""
  ).trim();

  const scopedCronPath = String(env.ANPI_P62_SCOPED_CRON_PATH || "false").trim().toLowerCase();
  const scopedWriter = String(env.ANPI_P61_SCOPED_WRITER_ENABLED || "false").trim().toLowerCase();
  const allowLegacyClaim = String(env.ANPI_ALLOW_LEGACY_CLAIM || "").trim().toLowerCase();

  return {
    environment,
    projectRef,
    enabled,
    provider,
    apiUrl,
    serviceKey,
    scopedCronPath,
    scopedWriter,
    allowLegacyClaim,
  };
}

/**
 * Fail-closed Cloudflare-side guards before calling Phase 48.
 */
export function validateCfSchedulerEnv(cfg) {
  if (cfg.environment !== CF_STAGING_ENV) {
    return { ok: false, code: "anpi_cf_env_not_staging" };
  }
  if (cfg.projectRef !== STAGING_SUPABASE_REF) {
    return { ok: false, code: "anpi_cf_project_ref_not_staging" };
  }
  if (cfg.projectRef === PRODUCTION_SUPABASE_REF) {
    return { ok: false, code: "anpi_cf_refusing_production_project_ref" };
  }
  if (cfg.enabled !== "true") {
    return { ok: false, code: "anpi_cf_scheduler_disabled" };
  }
  if (!cfg.provider.startsWith(CF_ALLOWED_PROVIDER_PREFIX)) {
    return { ok: false, code: "anpi_cf_provider_not_talk_local" };
  }
  if (!cfg.apiUrl) {
    return { ok: false, code: "anpi_cf_missing_api_url" };
  }
  if (cfg.apiUrl.includes(PRODUCTION_SUPABASE_REF)) {
    return { ok: false, code: "anpi_cf_refusing_production_endpoint" };
  }
  if (!cfg.serviceKey) {
    return { ok: false, code: "anpi_cf_missing_service_key" };
  }
  return { ok: true, code: null };
}

/**
 * Structured log line — JSON only, no secrets / PII.
 */
export function buildCfSchedulerLog({
  executionId,
  trigger,
  scheduledTime,
  cron,
  projectRef,
  provider,
  status,
  lease,
  summary,
  errorCode,
}) {
  return {
    service: "anpi-scheduler",
    platform: "cloudflare",
    environment: "staging",
    trigger: String(trigger || "scheduled"),
    execution_id: executionId,
    scheduled_time: scheduledTime ? new Date(scheduledTime).toISOString() : null,
    cron: cron || null,
    project_ref: projectRef || STAGING_SUPABASE_REF,
    provider: provider || "talk_local",
    status: status || "FAIL",
    lease_acquired: lease === "acquired",
    lease: lease || null,
    processed_count: Number(summary?.jobsProcessed ?? summary?.processed_count ?? 0),
    jobs_claimed: Number(summary?.jobsClaimed ?? summary?.jobsProcessed ?? 0),
    jobs_delivered: Number(summary?.jobsDelivered ?? 0),
    skipped_count: status === "SKIPPED" ? 1 : 0,
    failed_count: Number(summary?.jobsFailed ?? 0),
    provider_validation: summary?.provider_validation || null,
    overall_status: summary?.overall_status || status || null,
    scoped_cron_path: Boolean(summary?.scoped_cron_path),
    mode: summary?.mode || null,
    subject_sha8s: Array.isArray(summary?.processed)
      ? summary.processed.map((p) => p.subject_sha8).filter(Boolean).slice(0, 5)
      : [],
    write_reasons: Array.isArray(summary?.processed)
      ? summary.processed.map((p) => p.write_reason).filter(Boolean).slice(0, 5)
      : [],
    error_code: errorCode || null,
  };
}

/**
 * Run one ANPI staging tick from Cloudflare (cron or authenticated diagnostic).
 */
export async function runAnpiCfScheduledTick({
  env,
  trigger = "cloudflare_cron",
  scheduledTime = null,
  cron = null,
  deploymentId = null,
  runRuntime = runAnpiPhase48ScheduledRuntime,
}) {
  const cfg = resolveCfSchedulerConfig(env);
  const executionId = buildCfExecutionId(scheduledTime || Date.now());
  const pNow = scheduledTime ? new Date(scheduledTime).toISOString() : new Date().toISOString();

  const guard = validateCfSchedulerEnv(cfg);
  if (!guard.ok) {
    const log = buildCfSchedulerLog({
      executionId,
      trigger,
      scheduledTime: pNow,
      cron,
      projectRef: cfg.projectRef || STAGING_SUPABASE_REF,
      provider: cfg.provider,
      status: "FAIL",
      lease: null,
      summary: null,
      errorCode: guard.code,
    });
    return { ok: false, executionId, summary: null, log, errorCode: guard.code };
  }

  const holderBits = ["cf", "staging", executionId.replace(/^cf-anpi-staging-/, "").slice(0, 24)];
  if (deploymentId) holderBits.push(String(deploymentId).slice(0, 12));
  const holderId = holderBits.join("-").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40);

  let summary = null;
  let errorCode = null;
  try {
    summary = await runRuntime({
      apiUrl: cfg.apiUrl,
      serviceKey: cfg.serviceKey,
      projectRef: cfg.projectRef,
      enabled: cfg.enabled,
      pNow,
      workerId: executionId.slice(0, 64),
      holderId,
      stubMode: "success",
      failIfDisabled: true,
      env: {
        ANPI_ENVIRONMENT: cfg.environment,
        ANPI_STAGING_PROJECT_REF: cfg.projectRef,
        ANPI_PROJECT_REF: cfg.projectRef,
        ANPI_NOTIFICATION_PROVIDER: cfg.provider,
        ANPI_STAGING_RUNTIME_ENABLED: cfg.enabled,
        ANPI_P62_SCOPED_CRON_PATH: cfg.scopedCronPath,
        ANPI_P61_SCOPED_WRITER_ENABLED: cfg.scopedWriter,
        ANPI_ALLOW_LEGACY_CLAIM: cfg.allowLegacyClaim || "",
      },
    });
  } catch (err) {
    if (err?.summary) summary = err.summary;
    errorCode = safeErrorCode(err);
  }

  const status = summary?.overall_status || summary?.status || (errorCode ? "FAIL" : "FAIL");
  const log = buildCfSchedulerLog({
    executionId,
    trigger,
    scheduledTime: pNow,
    cron,
    projectRef: cfg.projectRef,
    provider: cfg.provider,
    status,
    lease: summary?.lease || null,
    summary,
    errorCode,
  });

  return {
    ok: status === "PASS" || status === "SKIPPED",
    executionId,
    summary,
    log,
    errorCode,
  };
}
