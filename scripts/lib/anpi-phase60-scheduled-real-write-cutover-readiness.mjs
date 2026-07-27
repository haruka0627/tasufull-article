/**
 * ANPI Phase 60 — Staging scheduled real-write cutover readiness (assessment).
 *
 * Verdict with existing guards only: CUTOVER NOT READY / NO-GO.
 *
 * Reasons (locked by audit):
 * - Cron path is hard-wired to Phase 6 talk_local_stub (no talk_notifications INSERT).
 * - CF + Phase 48 fail-closed on non-talk_local* providers (flip ≠ cutover).
 * - Claim has no test-identity filter (would blast all due jobs if real write were enabled).
 * - Phase 17/59 controlled inbox writer is a separate manual probe path.
 * - Attempt-scoped idempotency keys risk duplicate inbox rows on reclaim without new dedup.
 *
 * This module does NOT flip Worker provider, does NOT enable Phase 10 real mode,
 * and does NOT perform Cron real writes.
 */

import {
  validateCfSchedulerEnv,
  resolveCfSchedulerConfig,
  CF_ALLOWED_PROVIDER_PREFIX,
} from "./anpi-phase56-cloudflare-scheduler-adapter.mjs";
import {
  STAGING_SUPABASE_REF,
  PRODUCTION_SUPABASE_REF,
} from "./anpi-phase48-scheduled-runtime.mjs";
import { isAllowedRuntimeProvider } from "./anpi-phase58-talk-provider-readiness.mjs";

export const ANPI_P60_CUTOVER_VERDICT = "NOT_READY_NO_GO";
export const ANPI_P60_STAGING_CRON_PROVIDER = "talk_local";
export const ANPI_P60_BLOCKERS = Object.freeze([
  "cron_hardwired_talk_local_stub",
  "no_test_identity_filter_on_claim",
  "cf_and_phase48_reject_non_talk_local",
  "phase17_probe_path_separate_from_cron",
  "attempt_scoped_idempotency_duplicate_risk",
  "phase10_real_write_still_hard_disabled",
]);

/**
 * Evaluate whether a proposed Worker provider would pass CF guards.
 * talk_write must FAIL closed (not cut over).
 */
export function evaluateProposedProviderCutover(provider) {
  const p = String(provider || "");
  const startsLocal = p.startsWith(CF_ALLOWED_PROVIDER_PREFIX);
  const writeAllowedToday = isAllowedRuntimeProvider(p, { allowWriteProvider: false });
  const writeAllowedIfFlag = isAllowedRuntimeProvider(p, { allowWriteProvider: true });
  return {
    provider: p,
    passes_cf_talk_local_prefix: startsLocal,
    allowed_as_periodic_runtime_today: writeAllowedToday,
    would_need_allowWriteProvider_flag: !writeAllowedToday && writeAllowedIfFlag,
    /** Existing guards: flipping to talk_write stops Cron; it does not enable inbox writes. */
    flip_alone_enables_inbox_write: false,
    cutover_ready: false,
  };
}

/**
 * Synthetic CF env validation matrix for readiness evidence (no secrets).
 */
export function buildCutoverGuardMatrix() {
  const base = {
    ANPI_ENVIRONMENT: "staging",
    ANPI_STAGING_PROJECT_REF: STAGING_SUPABASE_REF,
    ANPI_STAGING_RUNTIME_ENABLED: "true",
    ANPI_NOTIFICATION_PROVIDER: "talk_local",
    ANPI_STAGING_SUPABASE_URL: `https://${STAGING_SUPABASE_REF}.supabase.co`,
    ANPI_STAGING_SUPABASE_SERVICE_ROLE_KEY: "test-service-key-not-real",
  };

  const cases = [
    { name: "staging_talk_local_ok", over: {}, expectOk: true, expectCode: null },
    {
      name: "talk_write_rejected",
      over: { ANPI_NOTIFICATION_PROVIDER: "talk_write" },
      expectOk: false,
      expectCode: "anpi_cf_provider_not_talk_local",
    },
    {
      name: "production_ref_rejected",
      over: { ANPI_STAGING_PROJECT_REF: PRODUCTION_SUPABASE_REF },
      expectOk: false,
      expectCode: "anpi_cf_project_ref_not_staging",
    },
    {
      name: "production_url_rejected",
      over: {
        ANPI_STAGING_SUPABASE_URL: `https://${PRODUCTION_SUPABASE_REF}.supabase.co`,
      },
      expectOk: false,
      expectCode: "anpi_cf_refusing_production_endpoint",
    },
    {
      name: "disabled_runtime",
      over: { ANPI_STAGING_RUNTIME_ENABLED: "false" },
      expectOk: false,
      expectCode: "anpi_cf_scheduler_disabled",
    },
  ];

  return cases.map((c) => {
    const cfg = resolveCfSchedulerConfig({ ...base, ...c.over });
    const v = validateCfSchedulerEnv(cfg);
    return {
      name: c.name,
      ok: v.ok,
      code: v.code,
      pass: v.ok === c.expectOk && (c.expectCode == null || v.code === c.expectCode),
      expectOk: c.expectOk,
      expectCode: c.expectCode,
    };
  });
}

/**
 * Readiness snapshot used by unit tests + staging verify (assessment only).
 */
export function assessScheduledRealWriteCutoverReadiness(extra = {}) {
  const matrix = buildCutoverGuardMatrix();
  const matrixOk = matrix.every((r) => r.pass);
  const talkWrite = evaluateProposedProviderCutover("talk_write");
  const talkLocal = evaluateProposedProviderCutover("talk_local");

  return {
    phase: 60,
    verdict: ANPI_P60_CUTOVER_VERDICT,
    cutover_performed: false,
    cron_real_write_executions: 0,
    real_insert_count_via_cron: 0,
    duplicates_via_cron: "n/a_cutover_not_performed",
    lease_with_real_write: "n/a_cutover_not_performed",
    retry_failure_behavior: "n/a_cutover_not_performed",
    owner_visibility_via_cron: "n/a_cutover_not_performed",
    cleanup_via_cron: "n/a_cutover_not_performed",
    rollback_to_stub: "not_required_still_on_talk_local",
    current_cron_provider: ANPI_P60_STAGING_CRON_PROVIDER,
    phase59_controlled_insert: "PASS_reuse",
    phase10_real_mode: "still_hard_disabled",
    blockers: [...ANPI_P60_BLOCKERS],
    guard_matrix_ok: matrixOk,
    guard_matrix: matrix,
    talk_local_eval: talkLocal,
    talk_write_eval: talkWrite,
    recommended_next:
      "Phase 61: staging-only Phase 10 job-writer enablement + claim identity allowlist + attempt-stable idempotency — still without Production / without full Cron blast",
    ...extra,
    assessed_at: new Date().toISOString(),
  };
}
