#!/usr/bin/env node
/**
 * AI Execution Gate — Phase B1 constants / preflight unit tests
 *   node scripts/test-ai-exec-gate-phase-b1-constants.mjs
 */
import {
  PHASE_B_ACTION_TYPE,
  PHASE_B_CAPABILITY_KEYS,
  PHASE_B_EXECUTOR_PORTS,
  PHASE_B_TARGET_SERVICE,
  getPhaseBCapabilityDefinition,
  isPhaseBActionAllowed,
  isPhaseBCapabilityAllowed,
  isPhaseBPortAllowed,
  isPhaseBServiceAllowed,
} from "../deploy/cloudflare/functions/_shared/ai-exec-gate-capabilities.mjs";
import {
  PHASE_B_DEFAULT_HARD_CAP_USD,
  PHASE_B_HARD_CAP_ENV_KEY,
  evaluatePhaseBHardCap,
  parseHardCapUsd,
  resolvePhaseBHardCapUsd,
} from "../deploy/cloudflare/functions/_shared/ai-exec-gate-budget.mjs";
import {
  PHASE_B_EMERGENCY_STOP_ENV_KEY,
  PHASE_B_ENVIRONMENT_ENV_KEY,
  PHASE_B_FEATURE_FLAG_ENV_KEY,
  PHASE_B_FEATURE_FLAG_KEY,
  detectGateEnvironment,
  evaluatePhaseB1Preflight,
  evaluatePhaseBFeatureFlag,
  isEmergencyStopActiveFromRaw,
  isPhaseBEmergencyStopActive,
  isPhaseBFeatureEnvEnabled,
} from "../deploy/cloudflare/functions/_shared/ai-exec-gate-flags.mjs";
import {
  GATE_METADATA_FORBIDDEN_KEYS,
  sanitizeGateMetadata,
} from "../deploy/cloudflare/functions/_shared/ai-exec-gate-redaction.mjs";
import {
  GATE_BLOCKED_REASONS,
  GATE_DECISIONS,
  isGateBlockedReason,
} from "../deploy/cloudflare/functions/_shared/ai-exec-gate-types.mjs";

const errors = [];

function assert(label, condition) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    return;
  }
  errors.push(label);
  console.log(`  ✗ ${label}`);
}

const stagingEnv = {
  [PHASE_B_ENVIRONMENT_ENV_KEY]: "staging",
  [PHASE_B_FEATURE_FLAG_ENV_KEY]: "1",
  [PHASE_B_EMERGENCY_STOP_ENV_KEY]: "0",
};

console.log("B1 — contracts");
assert("two capabilities", PHASE_B_CAPABILITY_KEYS.length === 2);
assert("collect_daily_ops allowed", isPhaseBCapabilityAllowed("collect_daily_ops"));
assert(
  "generate_ops_report allowed",
  isPhaseBCapabilityAllowed("generate_ops_report")
);
assert("unknown capability denied", !isPhaseBCapabilityAllowed("draft_support_reply"));
assert("case mismatch denied", !isPhaseBCapabilityAllowed("Collect_Daily_Ops"));
assert("trim not applied", !isPhaseBCapabilityAllowed(" collect_daily_ops "));
assert("empty denied", !isPhaseBCapabilityAllowed(""));
assert("null denied", !isPhaseBCapabilityAllowed(null));
assert("number denied", !isPhaseBCapabilityAllowed(1));
assert("action fixed", isPhaseBActionAllowed(PHASE_B_ACTION_TYPE));
assert("action partial denied", !isPhaseBActionAllowed("ops_secretary.daily_pending"));
assert("service fixed", isPhaseBServiceAllowed(PHASE_B_TARGET_SERVICE));
assert("service other denied", !isPhaseBServiceAllowed("tasful_ai"));
assert("three ports", PHASE_B_EXECUTOR_PORTS.length === 3);
assert("ops_collector port", isPhaseBPortAllowed("ops_collector"));
assert("unknown port denied", !isPhaseBPortAllowed("workspace_gateway"));
assert(
  "capability definition shape",
  getPhaseBCapabilityDefinition("collect_daily_ops")?.capability_version === "1"
);
assert("flag key fixed", PHASE_B_FEATURE_FLAG_KEY === "ai_exec_gate.phase_b.daily_ops_report");

console.log("\nB1 — environment");
assert(
  "explicit staging",
  detectGateEnvironment({ [PHASE_B_ENVIRONMENT_ENV_KEY]: "staging" }) ===
    "staging"
);
assert(
  "explicit production",
  detectGateEnvironment({ [PHASE_B_ENVIRONMENT_ENV_KEY]: "production" }) ===
    "production"
);
assert(
  "garbage explicit → unknown",
  detectGateEnvironment({ [PHASE_B_ENVIRONMENT_ENV_KEY]: "local" }) ===
    "unknown"
);
assert(
  "CF_PAGES_ENV production",
  detectGateEnvironment({ CF_PAGES_ENV: "production" }) === "production"
);
assert(
  "CF_PAGES_ENV preview → staging",
  detectGateEnvironment({ CF_PAGES_ENV: "preview" }) === "staging"
);
assert(
  "staging supabase ref",
  detectGateEnvironment({
    TASFUL_SUPABASE_URL: "https://ahlxuyvhzqdqaojiywmu.supabase.co",
  }) === "staging"
);
assert(
  "production supabase ref",
  detectGateEnvironment({
    TASFUL_SUPABASE_URL: "https://ddojquacsyqesrjhcvmn.supabase.co",
  }) === "production"
);
assert("empty env → unknown", detectGateEnvironment({}) === "unknown");
assert(
  "unknown not silently staging",
  detectGateEnvironment({}) !== "staging"
);

console.log("\nB1 — feature flag");
assert("unset latch false", !isPhaseBFeatureEnvEnabled(undefined));
assert("false latch", !isPhaseBFeatureEnvEnabled("false"));
assert("true string not enough", !isPhaseBFeatureEnvEnabled("true"));
assert("only 1 enables", isPhaseBFeatureEnvEnabled("1"));
assert(
  "staging+1 enabled",
  evaluatePhaseBFeatureFlag(stagingEnv).enabled === true
);
assert(
  "unset flag disabled on staging",
  evaluatePhaseBFeatureFlag({
    [PHASE_B_ENVIRONMENT_ENV_KEY]: "staging",
  }).enabled === false
);
assert(
  "production+1 still disabled",
  evaluatePhaseBFeatureFlag({
    [PHASE_B_ENVIRONMENT_ENV_KEY]: "production",
    [PHASE_B_FEATURE_FLAG_ENV_KEY]: "1",
  }).enabled === false
);
assert(
  "unknown+1 disabled",
  evaluatePhaseBFeatureFlag({
    [PHASE_B_FEATURE_FLAG_ENV_KEY]: "1",
  }).enabled === false
);

console.log("\nB1 — emergency stop");
assert("unset not stopped", !isEmergencyStopActiveFromRaw(undefined));
assert("0 not stopped", !isEmergencyStopActiveFromRaw("0"));
assert("1 stopped", isEmergencyStopActiveFromRaw("1"));
assert("garbage stopped (fail closed)", isEmergencyStopActiveFromRaw("maybe"));
assert(
  "env stop active",
  isPhaseBEmergencyStopActive({ [PHASE_B_EMERGENCY_STOP_ENV_KEY]: "1" })
);

console.log("\nB1 — hard cap");
assert("default parse", parseHardCapUsd(undefined).value === PHASE_B_DEFAULT_HARD_CAP_USD);
assert("env key name", PHASE_B_HARD_CAP_ENV_KEY === "AI_EXEC_GATE_PHASE_B_DAILY_HARD_CAP");
assert("default is 0.1", PHASE_B_DEFAULT_HARD_CAP_USD === 0.1);
assert("negative invalid", parseHardCapUsd(-1).ok === false);
assert("NaN invalid", parseHardCapUsd(Number.NaN).ok === false);
assert("resolve default", resolvePhaseBHardCapUsd({}).ok === true);
assert(
  "under cap allowed",
  evaluatePhaseBHardCap({ daySpentSoFar: 0, estimatedApiCost: 0.05, hardCapUsd: 0.1 })
    .decision === GATE_DECISIONS.ALLOWED
);
assert(
  "equal cap allowed",
  evaluatePhaseBHardCap({ daySpentSoFar: 0.05, estimatedApiCost: 0.05, hardCapUsd: 0.1 })
    .decision === GATE_DECISIONS.ALLOWED
);
assert(
  "over cap blocked",
  evaluatePhaseBHardCap({ daySpentSoFar: 0.08, estimatedApiCost: 0.05, hardCapUsd: 0.1 })
    .reason === "budget_hard_cap"
);
assert(
  "invalid usage blocked",
  evaluatePhaseBHardCap({ daySpentSoFar: Number.NaN, estimatedApiCost: 0, hardCapUsd: 0.1 })
    .reason === "invalid_configuration"
);
assert(
  "invalid estimate blocked",
  evaluatePhaseBHardCap({ daySpentSoFar: 0, estimatedApiCost: -1, hardCapUsd: 0.1 })
    .reason === "invalid_configuration"
);
assert(
  "invalid cap blocked",
  evaluatePhaseBHardCap({ daySpentSoFar: 0, estimatedApiCost: 0, hardCapUsd: "nope" })
    .reason === "invalid_configuration"
);

console.log("\nB1 — preflight order / composite");
const ok = evaluatePhaseB1Preflight({
  env: stagingEnv,
  capabilityKey: "collect_daily_ops",
  daySpentSoFar: 0,
  estimatedApiCost: 0.01,
});
assert("happy path allowed", ok.decision === GATE_DECISIONS.ALLOWED);

assert(
  "production blocked first",
  evaluatePhaseB1Preflight({
    env: {
      [PHASE_B_ENVIRONMENT_ENV_KEY]: "production",
      [PHASE_B_FEATURE_FLAG_ENV_KEY]: "1",
      [PHASE_B_EMERGENCY_STOP_ENV_KEY]: "1",
    },
    capabilityKey: "collect_daily_ops",
  }).reason === "wrong_environment"
);

assert(
  "stop before flag",
  evaluatePhaseB1Preflight({
    env: {
      [PHASE_B_ENVIRONMENT_ENV_KEY]: "staging",
      [PHASE_B_FEATURE_FLAG_ENV_KEY]: "1",
      [PHASE_B_EMERGENCY_STOP_ENV_KEY]: "1",
    },
    capabilityKey: "collect_daily_ops",
  }).reason === "emergency_stop"
);

assert(
  "flag off blocked",
  evaluatePhaseB1Preflight({
    env: {
      [PHASE_B_ENVIRONMENT_ENV_KEY]: "staging",
      [PHASE_B_FEATURE_FLAG_ENV_KEY]: "0",
    },
    capabilityKey: "collect_daily_ops",
  }).reason === "feature_disabled"
);

assert(
  "bad capability after flag",
  evaluatePhaseB1Preflight({
    env: stagingEnv,
    capabilityKey: "send_support_reply",
  }).reason === "capability_not_allowed"
);

assert(
  "bad action",
  evaluatePhaseB1Preflight({
    env: stagingEnv,
    capabilityKey: "generate_ops_report",
    actionType: "other.action",
  }).reason === "action_not_allowed"
);

assert(
  "bad service",
  evaluatePhaseB1Preflight({
    env: stagingEnv,
    capabilityKey: "generate_ops_report",
    targetService: "builder_ai",
  }).reason === "service_not_allowed"
);

assert(
  "bad port",
  evaluatePhaseB1Preflight({
    env: stagingEnv,
    capabilityKey: "generate_ops_report",
    executorPort: "mcp_tools",
  }).reason === "port_not_allowed"
);

assert(
  "hard cap in preflight",
  evaluatePhaseB1Preflight({
    env: { ...stagingEnv, [PHASE_B_HARD_CAP_ENV_KEY]: "0.01" },
    capabilityKey: "generate_ops_report",
    daySpentSoFar: 0.01,
    estimatedApiCost: 0.01,
  }).reason === "budget_hard_cap"
);

assert(
  "deterministic repeat",
  evaluatePhaseB1Preflight({
    env: stagingEnv,
    capabilityKey: "generate_ops_report",
  }).decision ===
    evaluatePhaseB1Preflight({
      env: stagingEnv,
      capabilityKey: "generate_ops_report",
    }).decision
);

console.log("\nB1 — redaction / reasons");
assert("forbidden includes prompt", GATE_METADATA_FORBIDDEN_KEYS.includes("prompt"));
assert(
  "sanitize drops prompt",
  sanitizeGateMetadata({ prompt: "x", count: 3 }).count === 3 &&
    sanitizeGateMetadata({ prompt: "x", count: 3 }).prompt === undefined
);
assert(
  "sanitize drops hardCap",
  sanitizeGateMetadata({ hardCap: 0.1, ok: true }).hardCap === undefined
);
assert("non-object → {}", Object.keys(sanitizeGateMetadata(null)).length === 0);
assert("reason union known", isGateBlockedReason("budget_hard_cap"));
assert("reason union size", GATE_BLOCKED_REASONS.length >= 8);

if (errors.length) {
  console.error(`\nFAILED (${errors.length})`);
  process.exit(1);
}
console.log(`\nALL PASSED (${errors.length === 0 ? "ok" : ""})`);
