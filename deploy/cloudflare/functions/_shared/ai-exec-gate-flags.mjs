/**
 * AI Execution Gate — Phase B1 Feature Flag · Emergency Stop · env boundary · preflight
 *
 * Evaluation order (B1 preflight):
 *   environment → emergency stop → feature flag → allowlist → hard cap
 *
 * Fail closed. No frontend. No secrets logging. No DB I/O.
 */

import {
  isPhaseBActionAllowed,
  isPhaseBCapabilityAllowed,
  isPhaseBPortAllowed,
  isPhaseBServiceAllowed,
  PHASE_B_ACTION_TYPE,
  PHASE_B_TARGET_SERVICE,
} from "./ai-exec-gate-capabilities.mjs";
import { evaluatePhaseBHardCap } from "./ai-exec-gate-budget.mjs";
import {
  GATE_ENVIRONMENTS,
  GATE_FEATURE_FLAG_STATES,
  gateAllowedResult,
  gateBlockedResult,
} from "./ai-exec-gate-types.mjs";

/** Logical flag key (design). Not an env name. */
export const PHASE_B_FEATURE_FLAG_KEY =
  "ai_exec_gate.phase_b.daily_ops_report";

/** Catalog state for this flag (staging_only). */
export const PHASE_B_FEATURE_FLAG_STATE =
  GATE_FEATURE_FLAG_STATES.STAGING_ONLY;

/**
 * Env latch: only exact "1" turns the Phase B feature ON for evaluation.
 * Still requires Staging environment (Production force-off).
 */
export const PHASE_B_FEATURE_FLAG_ENV_KEY =
  "AI_EXEC_GATE_PHASE_B_DAILY_OPS_REPORT";

/**
 * Env latch: "1" activates emergency stop.
 * Non-empty invalid values → stopped (fail closed).
 * Unset / empty / explicit off → not stopped.
 */
export const PHASE_B_EMERGENCY_STOP_ENV_KEY = "AI_EXEC_GATE_EMERGENCY_STOP";

/** Optional explicit override for tests / Staging config: staging|production */
export const PHASE_B_ENVIRONMENT_ENV_KEY = "AI_EXEC_GATE_ENVIRONMENT";

export const STAGING_SUPABASE_REF = "ahlxuyvhzqdqaojiywmu";
export const PRODUCTION_SUPABASE_REF = "ddojquacsyqesrjhcvmn";

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isExplicitOffToken(value) {
  const s = String(value ?? "")
    .trim()
    .toLowerCase();
  return s === "" || s === "0" || s === "false" || s === "no" || s === "off";
}

/**
 * Feature enable latch — Voice/Media style: only "1".
 * @param {unknown} raw
 * @returns {boolean}
 */
export function isPhaseBFeatureEnvEnabled(raw) {
  return String(raw ?? "").trim() === "1";
}

/**
 * Emergency stop active?
 * - unset/empty/0/false/no/off → not stopped
 * - "1" → stopped
 * - any other non-empty → stopped (fail closed)
 * @param {unknown} raw
 * @returns {boolean}
 */
export function isEmergencyStopActiveFromRaw(raw) {
  if (raw === undefined || raw === null) return false;
  const s = String(raw).trim();
  if (s === "") return false;
  if (isExplicitOffToken(s)) return false;
  if (s === "1") return true;
  return true;
}

/**
 * Detect Gate environment from Pages / Supabase signals.
 * Ambiguous → production-like (unknown) so staging_only cannot pass.
 * @param {Record<string, unknown>|null|undefined} env
 * @returns {"staging"|"production"|"unknown"}
 */
export function detectGateEnvironment(env) {
  const bag = env && typeof env === "object" ? env : {};

  const explicit = String(bag[PHASE_B_ENVIRONMENT_ENV_KEY] ?? "")
    .trim()
    .toLowerCase();
  if (explicit === "staging") return GATE_ENVIRONMENTS.STAGING;
  if (explicit === "production") return GATE_ENVIRONMENTS.PRODUCTION;
  if (explicit) return GATE_ENVIRONMENTS.UNKNOWN;

  const cf = String(bag.CF_PAGES_ENV ?? "")
    .trim()
    .toLowerCase();
  if (cf === "production") return GATE_ENVIRONMENTS.PRODUCTION;
  if (cf === "preview" || cf === "staging") return GATE_ENVIRONMENTS.STAGING;

  const supabaseUrl = String(
    bag.TASFUL_SUPABASE_URL || bag.SUPABASE_URL || ""
  ).toLowerCase();
  if (supabaseUrl.includes(PRODUCTION_SUPABASE_REF)) {
    return GATE_ENVIRONMENTS.PRODUCTION;
  }
  if (supabaseUrl.includes(STAGING_SUPABASE_REF)) {
    return GATE_ENVIRONMENTS.STAGING;
  }

  // local / missing signals → unknown (do not silently treat as Staging)
  return GATE_ENVIRONMENTS.UNKNOWN;
}

/**
 * Feature flag effective for this environment.
 * Default OFF · invalid OFF · Production always OFF even if env "1".
 * @param {Record<string, unknown>|null|undefined} env
 * @param {"staging"|"production"|"unknown"} [environment]
 * @returns {{ enabled: boolean, state: string, reason?: string }}
 */
export function evaluatePhaseBFeatureFlag(env, environment) {
  const gateEnv =
    environment || detectGateEnvironment(env);

  if (gateEnv !== GATE_ENVIRONMENTS.STAGING) {
    return {
      enabled: false,
      state: PHASE_B_FEATURE_FLAG_STATE,
      reason: "wrong_environment",
    };
  }

  const latch = isPhaseBFeatureEnvEnabled(
    env?.[PHASE_B_FEATURE_FLAG_ENV_KEY]
  );
  if (!latch) {
    return {
      enabled: false,
      state: GATE_FEATURE_FLAG_STATES.DISABLED,
      reason: "feature_disabled",
    };
  }

  return {
    enabled: true,
    state: PHASE_B_FEATURE_FLAG_STATE,
  };
}

/**
 * @param {Record<string, unknown>|null|undefined} env
 * @returns {boolean}
 */
export function isPhaseBEmergencyStopActive(env) {
  return isEmergencyStopActiveFromRaw(env?.[PHASE_B_EMERGENCY_STOP_ENV_KEY]);
}

/**
 * Phase B1 combined preflight (pure).
 *
 * @param {{
 *   env?: Record<string, unknown>|null,
 *   capabilityKey: unknown,
 *   actionType?: unknown,
 *   targetService?: unknown,
 *   executorPort?: unknown,
 *   daySpentSoFar?: unknown,
 *   estimatedApiCost?: unknown,
 * }} input
 */
export function evaluatePhaseB1Preflight(input) {
  const env = input?.env && typeof input.env === "object" ? input.env : {};
  const gateEnv = detectGateEnvironment(env);

  if (gateEnv !== GATE_ENVIRONMENTS.STAGING) {
    return gateBlockedResult("wrong_environment", { environment: gateEnv });
  }

  if (isPhaseBEmergencyStopActive(env)) {
    return gateBlockedResult("emergency_stop", { environment: gateEnv });
  }

  const flag = evaluatePhaseBFeatureFlag(env, gateEnv);
  if (!flag.enabled) {
    return gateBlockedResult("feature_disabled", {
      environment: gateEnv,
      flagKey: PHASE_B_FEATURE_FLAG_KEY,
    });
  }

  if (!isPhaseBCapabilityAllowed(input?.capabilityKey)) {
    return gateBlockedResult("capability_not_allowed");
  }

  const actionType =
    input?.actionType === undefined
      ? PHASE_B_ACTION_TYPE
      : input.actionType;
  if (!isPhaseBActionAllowed(actionType)) {
    return gateBlockedResult("action_not_allowed");
  }

  const targetService =
    input?.targetService === undefined
      ? PHASE_B_TARGET_SERVICE
      : input.targetService;
  if (!isPhaseBServiceAllowed(targetService)) {
    return gateBlockedResult("service_not_allowed");
  }

  if (input?.executorPort !== undefined && input?.executorPort !== null) {
    if (!isPhaseBPortAllowed(input.executorPort)) {
      return gateBlockedResult("port_not_allowed");
    }
  }

  const budget = evaluatePhaseBHardCap({
    env,
    daySpentSoFar:
      input?.daySpentSoFar === undefined ? 0 : input.daySpentSoFar,
    estimatedApiCost:
      input?.estimatedApiCost === undefined ? 0 : input.estimatedApiCost,
  });
  if (budget.decision !== "allowed") {
    return budget;
  }

  return gateAllowedResult({
    environment: gateEnv,
    flagKey: PHASE_B_FEATURE_FLAG_KEY,
    capabilityKey: input.capabilityKey,
    actionType,
    targetService,
  });
}
