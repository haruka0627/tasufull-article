/**
 * AI Execution Gate — Phase C10 Production Readiness (non-live · evaluation only).
 *
 * Final integration check: ready | not_ready.
 * NEVER executes · NEVER network · NEVER SDK · NEVER credentials ·
 * NEVER adapter.execute · NEVER process.env · NEVER dynamic import · NEVER SAFE write.
 *
 * Provider execute eligibility is NOT a readiness criterion (provider stays disabled).
 * Report/Persist are evaluated as frozen *contract path* readiness (slot is pre-report).
 */

import { isPhaseBCapabilityAllowed } from "./ai-exec-gate-capabilities.mjs";
import { validateProviderIdentifier } from "./ai-exec-gate-c4-provider.mjs";
import { deepFreeze } from "./ai-exec-gate-c5-execution-boundary.mjs";
import { PHASE_C9_DECISIONS } from "./ai-exec-gate-c9-activation-readiness.mjs";

export { deepFreeze };

export const PHASE_C10_SCHEMA_VERSION = "phase_c10.production_readiness.v1";
export const PHASE_C10_PIPELINE_VERSION = "phase_c10.pipeline.v1";

/** Frozen completed phase labels (architectural · B through C9). */
export const PHASE_C10_COMPLETED_PHASES = Object.freeze([
  "B",
  "C1",
  "C2",
  "C3",
  "C4",
  "C5",
  "C6",
  "C7",
  "C8",
  "C9",
]);

/**
 * Fixed pipeline stage order (C10 freeze).
 * Report/Persist follow Production Readiness in the live executor.
 */
export const PHASE_C10_PIPELINE_STAGES = Object.freeze([
  "validation",
  "hardening",
  "safe_usage",
  "budget",
  "resolve",
  "execution_boundary",
  "invocation_gate",
  "dry_run",
  "activation",
  "production_readiness",
  "deterministic_report",
  "persist",
]);

/** ReadinessDecision vocabulary. */
export const PHASE_C10_DECISIONS = Object.freeze({
  READY: "ready",
  NOT_READY: "not_ready",
});

/** ReadinessReason vocabulary (fail-closed). */
export const PHASE_C10_REASONS = Object.freeze({
  PRODUCTION_READY: "production_ready",
  MISSING_PHASE: "missing_phase",
  UNKNOWN_STATE: "unknown_state",
  INVALID_CONTRACT: "invalid_contract",
  PIPELINE_MISMATCH: "pipeline_mismatch",
  UNKNOWN_CAPABILITY: "unknown_capability",
  UNKNOWN_PROVIDER: "unknown_provider",
  POLICY_MISMATCH: "policy_mismatch",
  BUDGET_INCONSISTENT: "budget_inconsistent",
  SECURITY_VIOLATION: "security_violation",
  EXECUTE_FLAGS_FORBIDDEN: "execute_flags_forbidden",
  INVALID_CONTEXT: "invalid_context",
  IMMUTABLE_VIOLATION: "immutable_violation",
  EXTRA_FIELDS: "extra_fields",
  REGRESSION_INCOMPLETE: "regression_incomplete",
  ACTIVATION_INCONSISTENT: "activation_inconsistent",
  DRY_RUN_INCONSISTENT: "dry_run_inconsistent",
});

/** Contract keys that must be true for ready. */
export const PHASE_C10_CONTRACT_KEYS = Object.freeze([
  "validation",
  "hardening",
  "safe_usage",
  "budget",
  "resolve",
  "execution_boundary",
  "invocation_gate",
  "dry_run",
  "activation",
  "deterministic_report",
  "persist",
  "security",
]);

const CONTEXT_ALLOWLIST = Object.freeze([
  "schema_version",
  "pipeline_version",
  "completed_phases",
  "contracts",
  "security",
  "regression",
  "integration",
  "capability",
  "provider",
  "usage",
  "budget",
  "boundary",
  "invocation",
  "dry_run",
  "activation",
  "policy",
  "executed",
  "provider_called",
  "transmit",
  "recorded_api_cost",
]);

const SNAPSHOT_ALLOWLIST = Object.freeze([
  "schema_version",
  "completed_phases",
  "pipeline_version",
  "contracts",
  "security",
  "regression",
  "decision",
  "reason",
  "provider_called",
  "executed",
  "transmit",
  "recorded_api_cost",
]);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Frozen IntegrationSummary — prior-stage presence map (no prompt/secrets).
 * @param {Record<string, unknown>} input
 */
export function buildIntegrationSummary(input = {}) {
  if (!isPlainObject(input)) {
    return {
      ok: false,
      error: PHASE_C10_REASONS.INVALID_CONTEXT,
      reason: PHASE_C10_REASONS.INVALID_CONTEXT,
    };
  }
  const o = /** @type {Record<string, unknown>} */ (input);
  const summary = deepFreeze({
    schema_version: PHASE_C10_SCHEMA_VERSION,
    pipeline_version: PHASE_C10_PIPELINE_VERSION,
    stages: deepFreeze({
      validation: o.validation === true,
      hardening: o.hardening === true,
      safe_usage: o.safe_usage === true,
      budget: o.budget === true,
      resolve: o.resolve === true,
      execution_boundary: o.execution_boundary === true,
      invocation_gate: o.invocation_gate === true,
      dry_run: o.dry_run === true,
      activation: o.activation === true,
      // Contract path: wired next in executor (pre-report slot)
      deterministic_report: o.deterministic_report === true,
      persist: o.persist === true,
    }),
    provider_called: false,
    executed: false,
    transmit: false,
    recorded_api_cost: 0,
  });
  return { ok: true, value: summary };
}

/**
 * Default contracts for an integrated non-live gate (path consistency).
 */
export function buildDefaultContracts() {
  /** @type {Record<string, boolean>} */
  const contracts = {};
  for (const key of PHASE_C10_CONTRACT_KEYS) {
    contracts[key] = true;
  }
  return deepFreeze(contracts);
}

/**
 * Validate ProductionReadinessSnapshot shape.
 * @param {unknown} fields
 */
export function buildProductionReadinessSnapshot(fields) {
  if (!isPlainObject(fields)) {
    return {
      ok: false,
      error: PHASE_C10_REASONS.INVALID_CONTEXT,
      reason: PHASE_C10_REASONS.INVALID_CONTEXT,
    };
  }
  const o = /** @type {Record<string, unknown>} */ (fields);
  for (const key of Object.keys(o)) {
    if (
      key === "__proto__" ||
      key === "prototype" ||
      key === "constructor" ||
      !SNAPSHOT_ALLOWLIST.includes(key)
    ) {
      return {
        ok: false,
        error: PHASE_C10_REASONS.EXTRA_FIELDS,
        reason: PHASE_C10_REASONS.EXTRA_FIELDS,
      };
    }
  }

  const phases = Array.isArray(o.completed_phases)
    ? o.completed_phases.filter((p) => typeof p === "string")
    : null;
  if (!phases) {
    return {
      ok: false,
      error: PHASE_C10_REASONS.INVALID_CONTRACT,
      reason: PHASE_C10_REASONS.INVALID_CONTRACT,
    };
  }

  const contracts = isPlainObject(o.contracts)
    ? /** @type {Record<string, unknown>} */ (o.contracts)
    : null;
  if (!contracts) {
    return {
      ok: false,
      error: PHASE_C10_REASONS.INVALID_CONTRACT,
      reason: PHASE_C10_REASONS.INVALID_CONTRACT,
    };
  }

  const security = isPlainObject(o.security)
    ? /** @type {Record<string, unknown>} */ (o.security)
    : null;
  if (!security) {
    return {
      ok: false,
      error: PHASE_C10_REASONS.SECURITY_VIOLATION,
      reason: PHASE_C10_REASONS.SECURITY_VIOLATION,
    };
  }

  const regression = isPlainObject(o.regression)
    ? /** @type {Record<string, unknown>} */ (o.regression)
    : null;
  if (!regression) {
    return {
      ok: false,
      error: PHASE_C10_REASONS.REGRESSION_INCOMPLETE,
      reason: PHASE_C10_REASONS.REGRESSION_INCOMPLETE,
    };
  }

  const decision =
    o.decision === PHASE_C10_DECISIONS.READY ||
    o.decision === PHASE_C10_DECISIONS.NOT_READY
      ? o.decision
      : PHASE_C10_DECISIONS.NOT_READY;

  const snap = deepFreeze({
    schema_version: PHASE_C10_SCHEMA_VERSION,
    completed_phases: Object.freeze([...phases]),
    pipeline_version:
      typeof o.pipeline_version === "string"
        ? o.pipeline_version
        : PHASE_C10_PIPELINE_VERSION,
    contracts: deepFreeze({ ...contracts }),
    security: deepFreeze({
      provider_called: false,
      executed: false,
      transmit: false,
      recorded_api_cost: 0,
      network: false,
      sdk: false,
    }),
    regression: deepFreeze({
      ok: regression.ok === true,
      suite:
        typeof regression.suite === "string" ? regression.suite : "B-C10",
    }),
    decision,
    reason:
      typeof o.reason === "string"
        ? o.reason
        : PHASE_C10_REASONS.INVALID_CONTEXT,
    provider_called: false,
    executed: false,
    transmit: false,
    recorded_api_cost: 0,
  });
  return { ok: true, value: snap };
}

/**
 * @param {unknown} context
 */
export function validateReadinessContext(context) {
  if (!isPlainObject(context)) {
    return {
      ok: false,
      error: PHASE_C10_REASONS.INVALID_CONTEXT,
      reason: PHASE_C10_REASONS.INVALID_CONTEXT,
    };
  }
  const o = /** @type {Record<string, unknown>} */ (context);
  for (const key of Object.keys(o)) {
    if (
      key === "__proto__" ||
      key === "prototype" ||
      key === "constructor" ||
      !CONTEXT_ALLOWLIST.includes(key)
    ) {
      return {
        ok: false,
        error: PHASE_C10_REASONS.EXTRA_FIELDS,
        reason: PHASE_C10_REASONS.EXTRA_FIELDS,
      };
    }
  }
  return { ok: true, value: o };
}

/**
 * @param {unknown} phases
 * @returns {boolean}
 */
function phasesMatchExpected(phases) {
  if (!Array.isArray(phases)) return false;
  if (phases.length !== PHASE_C10_COMPLETED_PHASES.length) return false;
  for (let i = 0; i < PHASE_C10_COMPLETED_PHASES.length; i += 1) {
    if (phases[i] !== PHASE_C10_COMPLETED_PHASES[i]) return false;
  }
  return true;
}

/**
 * @param {unknown} contracts
 * @returns {{ ok: boolean, reason?: string }}
 */
function validateContracts(contracts) {
  if (!isPlainObject(contracts)) {
    return { ok: false, reason: PHASE_C10_REASONS.INVALID_CONTRACT };
  }
  const o = /** @type {Record<string, unknown>} */ (contracts);
  for (const key of Object.keys(o)) {
    if (!PHASE_C10_CONTRACT_KEYS.includes(key)) {
      return { ok: false, reason: PHASE_C10_REASONS.EXTRA_FIELDS };
    }
  }
  for (const key of PHASE_C10_CONTRACT_KEYS) {
    if (o[key] !== true) {
      return { ok: false, reason: PHASE_C10_REASONS.MISSING_PHASE };
    }
  }
  return { ok: true };
}

/**
 * ReadinessEvaluator — ready | not_ready only.
 *
 * @param {Record<string, unknown>} [input]
 */
export function evaluateProductionReadiness(input = {}) {
  const zero = {
    provider_called: /** @type {false} */ (false),
    executed: /** @type {false} */ (false),
    transmit: /** @type {false} */ (false),
    recorded_api_cost: /** @type {0} */ (0),
  };

  const ctxCheck = validateReadinessContext({
    schema_version: PHASE_C10_SCHEMA_VERSION,
    pipeline_version: input.pipeline_version,
    completed_phases: input.completed_phases,
    contracts: input.contracts,
    security: input.security,
    regression: input.regression,
    integration: input.integration,
    capability: input.capability,
    provider: input.provider,
    usage: input.usage,
    budget: input.budget,
    boundary: input.boundary,
    invocation: input.invocation,
    dry_run: input.dry_run,
    activation: input.activation,
    policy: input.policy,
    executed: input.executed === true ? true : false,
    provider_called: input.provider_called === true ? true : false,
    transmit: input.transmit === true ? true : false,
    recorded_api_cost:
      typeof input.recorded_api_cost === "number"
        ? input.recorded_api_cost
        : 0,
  });
  if (!ctxCheck.ok) {
    return {
      ok: false,
      decision: PHASE_C10_DECISIONS.NOT_READY,
      reason: ctxCheck.reason || PHASE_C10_REASONS.INVALID_CONTEXT,
      error: ctxCheck.error || PHASE_C10_REASONS.INVALID_CONTEXT,
      ...zero,
    };
  }

  /**
   * @param {string} reason
   * @param {Record<string, unknown>} [partial]
   */
  function notReady(reason, partial = {}) {
    const snapBuilt = buildProductionReadinessSnapshot({
      completed_phases: Array.isArray(partial.completed_phases)
        ? partial.completed_phases
        : Array.isArray(input.completed_phases)
          ? input.completed_phases
          : [...PHASE_C10_COMPLETED_PHASES],
      pipeline_version:
        typeof partial.pipeline_version === "string"
          ? partial.pipeline_version
          : typeof input.pipeline_version === "string"
            ? input.pipeline_version
            : PHASE_C10_PIPELINE_VERSION,
      contracts: isPlainObject(partial.contracts)
        ? partial.contracts
        : isPlainObject(input.contracts)
          ? input.contracts
          : buildDefaultContracts(),
      security: {
        provider_called: false,
        executed: false,
        transmit: false,
        recorded_api_cost: 0,
        network: false,
        sdk: false,
      },
      regression: isPlainObject(partial.regression)
        ? partial.regression
        : isPlainObject(input.regression)
          ? input.regression
          : { ok: false, suite: "B-C10" },
      decision: PHASE_C10_DECISIONS.NOT_READY,
      reason,
    });
    if (!snapBuilt.ok) {
      return {
        ok: false,
        decision: PHASE_C10_DECISIONS.NOT_READY,
        reason: snapBuilt.reason || reason,
        error: snapBuilt.error || reason,
        ...zero,
      };
    }
    return {
      ok: true,
      decision: PHASE_C10_DECISIONS.NOT_READY,
      reason,
      snapshot: snapBuilt.value,
      ...zero,
    };
  }

  if (
    input.executed === true ||
    input.provider_called === true ||
    input.transmit === true ||
    (typeof input.recorded_api_cost === "number" &&
      input.recorded_api_cost !== 0)
  ) {
    return notReady(PHASE_C10_REASONS.EXECUTE_FLAGS_FORBIDDEN);
  }

  if (
    typeof input.capability === "string" &&
    !isPhaseBCapabilityAllowed(input.capability)
  ) {
    return notReady(PHASE_C10_REASONS.UNKNOWN_CAPABILITY);
  }

  if (input.provider != null) {
    const idCheck = validateProviderIdentifier(input.provider);
    if (!idCheck.ok) {
      return notReady(PHASE_C10_REASONS.UNKNOWN_PROVIDER);
    }
  }

  const pipelineVersion =
    typeof input.pipeline_version === "string"
      ? input.pipeline_version
      : null;
  if (pipelineVersion !== PHASE_C10_PIPELINE_VERSION) {
    return notReady(PHASE_C10_REASONS.PIPELINE_MISMATCH, {
      pipeline_version: pipelineVersion || "unknown",
    });
  }

  if (!phasesMatchExpected(input.completed_phases)) {
    return notReady(PHASE_C10_REASONS.MISSING_PHASE, {
      completed_phases: Array.isArray(input.completed_phases)
        ? input.completed_phases
        : [],
    });
  }

  const contractsCheck = validateContracts(input.contracts);
  if (!contractsCheck.ok) {
    return notReady(
      contractsCheck.reason || PHASE_C10_REASONS.INVALID_CONTRACT
    );
  }

  // Integration stages (when provided) must agree with contracts
  if (input.integration != null) {
    if (!isPlainObject(input.integration)) {
      return notReady(PHASE_C10_REASONS.UNKNOWN_STATE);
    }
    const integ = /** @type {Record<string, unknown>} */ (input.integration);
    const stages = isPlainObject(integ.stages)
      ? /** @type {Record<string, unknown>} */ (integ.stages)
      : null;
    if (!stages) {
      return notReady(PHASE_C10_REASONS.UNKNOWN_STATE);
    }
    const requiredRuntime = [
      "validation",
      "hardening",
      "safe_usage",
      "budget",
      "resolve",
      "execution_boundary",
      "invocation_gate",
      "dry_run",
      "activation",
      "deterministic_report",
      "persist",
    ];
    for (const key of requiredRuntime) {
      if (stages[key] !== true) {
        return notReady(PHASE_C10_REASONS.MISSING_PHASE);
      }
    }
    if (
      typeof integ.pipeline_version === "string" &&
      integ.pipeline_version !== PHASE_C10_PIPELINE_VERSION
    ) {
      return notReady(PHASE_C10_REASONS.PIPELINE_MISMATCH);
    }
  }

  // Budget consistency — blocked is inconsistent at this pipeline slot
  if (input.budget != null) {
    if (!isPlainObject(input.budget)) {
      return notReady(PHASE_C10_REASONS.BUDGET_INCONSISTENT);
    }
    const b = /** @type {Record<string, unknown>} */ (input.budget);
    if (
      b.blocked === true ||
      b.decision === "blocked" ||
      b.decision === "hard_cap"
    ) {
      return notReady(PHASE_C10_REASONS.BUDGET_INCONSISTENT);
    }
  }

  // Invocation must be recorded (denied is OK for non-live readiness)
  if (input.invocation != null) {
    if (!isPlainObject(input.invocation)) {
      return notReady(PHASE_C10_REASONS.POLICY_MISMATCH);
    }
    const inv = /** @type {Record<string, unknown>} */ (input.invocation);
    if (typeof inv.decision !== "string" || inv.decision.length === 0) {
      return notReady(PHASE_C10_REASONS.POLICY_MISMATCH);
    }
  } else {
    return notReady(PHASE_C10_REASONS.POLICY_MISMATCH);
  }

  // Dry-run consistency
  if (input.dry_run != null) {
    if (!isPlainObject(input.dry_run)) {
      return notReady(PHASE_C10_REASONS.DRY_RUN_INCONSISTENT);
    }
    const d = /** @type {Record<string, unknown>} */ (input.dry_run);
    if (
      d.executed === true ||
      d.provider_called === true ||
      d.transmit === true ||
      (typeof d.recorded_api_cost === "number" && d.recorded_api_cost !== 0)
    ) {
      return notReady(PHASE_C10_REASONS.SECURITY_VIOLATION);
    }
    if (d.simulated !== true && d.ok !== true) {
      return notReady(PHASE_C10_REASONS.DRY_RUN_INCONSISTENT);
    }
  } else {
    return notReady(PHASE_C10_REASONS.DRY_RUN_INCONSISTENT);
  }

  // Activation consistency — eligible OR not_eligible both acceptable
  if (input.activation != null) {
    if (!isPlainObject(input.activation)) {
      return notReady(PHASE_C10_REASONS.ACTIVATION_INCONSISTENT);
    }
    const a = /** @type {Record<string, unknown>} */ (input.activation);
    const decision =
      typeof a.activation_decision === "string"
        ? a.activation_decision
        : typeof a.decision === "string"
          ? a.decision
          : null;
    if (
      decision !== PHASE_C9_DECISIONS.ELIGIBLE &&
      decision !== PHASE_C9_DECISIONS.NOT_ELIGIBLE
    ) {
      return notReady(PHASE_C10_REASONS.ACTIVATION_INCONSISTENT);
    }
  } else {
    return notReady(PHASE_C10_REASONS.ACTIVATION_INCONSISTENT);
  }

  // Security block
  if (input.security != null) {
    if (!isPlainObject(input.security)) {
      return notReady(PHASE_C10_REASONS.SECURITY_VIOLATION);
    }
    const s = /** @type {Record<string, unknown>} */ (input.security);
    if (
      s.provider_called === true ||
      s.executed === true ||
      s.transmit === true ||
      s.network === true ||
      s.sdk === true ||
      (typeof s.recorded_api_cost === "number" && s.recorded_api_cost !== 0)
    ) {
      return notReady(PHASE_C10_REASONS.SECURITY_VIOLATION);
    }
  }

  // Regression marker required
  if (!isPlainObject(input.regression) || input.regression.ok !== true) {
    return notReady(PHASE_C10_REASONS.REGRESSION_INCOMPLETE);
  }

  const snapBuilt = buildProductionReadinessSnapshot({
    completed_phases: [...PHASE_C10_COMPLETED_PHASES],
    pipeline_version: PHASE_C10_PIPELINE_VERSION,
    contracts: input.contracts,
    security: {
      provider_called: false,
      executed: false,
      transmit: false,
      recorded_api_cost: 0,
      network: false,
      sdk: false,
    },
    regression: input.regression,
    decision: PHASE_C10_DECISIONS.READY,
    reason: PHASE_C10_REASONS.PRODUCTION_READY,
  });
  if (!snapBuilt.ok) {
    return {
      ok: false,
      decision: PHASE_C10_DECISIONS.NOT_READY,
      reason: snapBuilt.reason || PHASE_C10_REASONS.INVALID_CONTEXT,
      error: snapBuilt.error || PHASE_C10_REASONS.INVALID_CONTEXT,
      ...zero,
    };
  }

  return {
    ok: true,
    decision: PHASE_C10_DECISIONS.READY,
    reason: PHASE_C10_REASONS.PRODUCTION_READY,
    snapshot: snapBuilt.value,
    ...zero,
  };
}

/** Alias matching ticket vocabulary. */
export function evaluateReadiness(input) {
  return evaluateProductionReadiness(input);
}

/**
 * Sanitized event metadata — no prompt / credentials.
 * @param {unknown} readinessOutcome
 */
export function sanitizeReadinessEventMetadata(readinessOutcome) {
  const o =
    readinessOutcome && typeof readinessOutcome === "object"
      ? /** @type {Record<string, unknown>} */ (readinessOutcome)
      : {};
  const snap =
    o.snapshot && typeof o.snapshot === "object"
      ? /** @type {Record<string, unknown>} */ (o.snapshot)
      : {};

  return deepFreeze({
    schema_version: PHASE_C10_SCHEMA_VERSION,
    decision:
      o.decision === PHASE_C10_DECISIONS.READY ||
      o.decision === PHASE_C10_DECISIONS.NOT_READY
        ? o.decision
        : PHASE_C10_DECISIONS.NOT_READY,
    reason:
      typeof o.reason === "string"
        ? o.reason
        : PHASE_C10_REASONS.INVALID_CONTEXT,
    pipeline_version:
      typeof snap.pipeline_version === "string"
        ? snap.pipeline_version
        : PHASE_C10_PIPELINE_VERSION,
    completed_phases: Array.isArray(snap.completed_phases)
      ? Object.freeze([...snap.completed_phases])
      : Object.freeze([...PHASE_C10_COMPLETED_PHASES]),
    provider_called: false,
    executed: false,
    transmit: false,
    recorded_api_cost: 0,
  });
}
