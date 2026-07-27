/**
 * ANPI runtime pause / claim-mode controls (Phase 65).
 *
 * Stops BOTH legacy Phase 47 claim and scoped Phase 62 claim when paused.
 * Prevents Phase 63-style flag-off race where legacy_stub claims pending jobs
 * while scoped flags are flipping.
 *
 * Modes:
 *   paused  — runtime disabled → no claims
 *   scoped  — ANPI_P62_SCOPED_CRON_PATH=true → allowlisted path only
 *   legacy  — scoped off AND ANPI_ALLOW_LEGACY_CLAIM=true → Phase 47 stub
 *   none    — scoped off AND legacy claim disallowed → no claims (safe idle)
 */

export const ANPI_ALLOW_LEGACY_CLAIM_ENV = "ANPI_ALLOW_LEGACY_CLAIM";
export const ANPI_P62_SCOPED_CRON_ENV = "ANPI_P62_SCOPED_CRON_PATH";

export function isRuntimeEnabled(env = {}) {
  const v = String(
    env.ANPI_PRODUCTION_RUNTIME_ENABLED ||
      env.ANPI_STAGING_RUNTIME_ENABLED ||
      env.ANPI_SCHEDULER_ENABLED ||
      ""
  )
    .trim()
    .toLowerCase();
  return v === "true";
}

export function isScopedCronPathEnabled(env = {}) {
  return String(env[ANPI_P62_SCOPED_CRON_ENV] || "").trim().toLowerCase() === "true";
}

/**
 * Legacy Phase 47 claim (anpi_phase6_claim_jobs) allowed?
 * Staging default true for stub continuity.
 * Production Worker draft must set false so flag-off cannot mutate jobs.
 */
export function isLegacyClaimAllowed(env = {}) {
  const raw = env[ANPI_ALLOW_LEGACY_CLAIM_ENV];
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    // Default: allow on staging-shaped envs; deny when environment=production.
    const environment = String(env.ANPI_ENVIRONMENT || "").trim().toLowerCase();
    if (environment === "production") return false;
    return true;
  }
  return String(raw).trim().toLowerCase() === "true";
}

/**
 * Resolve claim mode after runtime is known enabled.
 * @returns {'scoped'|'legacy'|'none'}
 */
export function resolveClaimMode(env = {}) {
  if (!isRuntimeEnabled(env)) return "none"; // caller should treat as paused earlier
  if (isScopedCronPathEnabled(env)) return "scoped";
  if (isLegacyClaimAllowed(env)) return "legacy";
  return "none";
}

/**
 * Safe config transition checklist (tabletop / automation).
 * Returns { ok, blockers[] }.
 */
export function assertSafeConfigTransition({
  runtimeEnabled,
  inflightLeaseCount = 0,
  inflightProcessingJobs = 0,
  changingScopedFlags = false,
  changingSecrets = false,
  changingAllowlist = false,
} = {}) {
  const blockers = [];
  if (changingScopedFlags || changingSecrets || changingAllowlist) {
    if (runtimeEnabled) {
      blockers.push("anpi_pause_required_before_config_change");
    }
  }
  if (Number(inflightLeaseCount) > 0) {
    blockers.push("anpi_inflight_leases_nonzero");
  }
  if (Number(inflightProcessingJobs) > 0) {
    blockers.push("anpi_inflight_processing_jobs_nonzero");
  }
  return { ok: blockers.length === 0, blockers };
}

/**
 * Ordered cutover/rollback steps (documentation + testable).
 */
export const FORCED_PAUSE_ORDER = Object.freeze([
  "runtime_pause",
  "confirm_inflight_zero",
  "configuration_change",
  "worker_deploy",
  "health_provider_ref_check",
  "gate_enable_if_needed",
  "limited_runtime_resume",
  "observe",
  "repause_on_issue",
]);

export function simulateFlagOffRace({
  runtimeEnabled,
  scopedBefore,
  scopedAfter,
  allowLegacyClaim,
}) {
  // Mid-deploy hypothetical: scoped flipped off while runtime still true.
  const midEnv = {
    ANPI_ENVIRONMENT: "production",
    ANPI_STAGING_RUNTIME_ENABLED: runtimeEnabled ? "true" : "false",
    ANPI_PRODUCTION_RUNTIME_ENABLED: runtimeEnabled ? "true" : "false",
    ANPI_P62_SCOPED_CRON_PATH: scopedAfter ? "true" : "false",
    ANPI_ALLOW_LEGACY_CLAIM: allowLegacyClaim ? "true" : "false",
  };
  const mode = resolveClaimMode(midEnv);
  return {
    scoped_before: scopedBefore,
    scoped_after: scopedAfter,
    mode_during_flip: mode,
    legacy_would_claim: mode === "legacy",
    safe_if_legacy_disallowed: allowLegacyClaim === false || runtimeEnabled === false,
  };
}
