/**
 * AI Execution Gate — Phase C9 Provider Activation Readiness (evaluation only).
 *
 * Decides eligible | not_eligible from prior gate snapshots.
 * NEVER executes · NEVER network · NEVER SDK · NEVER credentials ·
 * NEVER adapter.execute · NEVER process.env · NEVER dynamic import.
 *
 * Provider-neutral · fail-closed · existing Phase B capabilities only.
 */

import { isPhaseBCapabilityAllowed } from "./ai-exec-gate-capabilities.mjs";
import { validateProviderIdentifier } from "./ai-exec-gate-c4-provider.mjs";
import {
  deepFreeze,
  validateExecutionEnvelope,
  validateExecutionPlan,
} from "./ai-exec-gate-c5-execution-boundary.mjs";
import {
  PHASE_C6_DECISIONS,
  getInvocationPolicy,
} from "./ai-exec-gate-c6-invocation-gate.mjs";

export { deepFreeze };

export const PHASE_C9_SCHEMA_VERSION = "phase_c9.activation_readiness.v1";

/** ActivationDecision vocabulary — evaluation only. */
export const PHASE_C9_DECISIONS = Object.freeze({
  ELIGIBLE: "eligible",
  NOT_ELIGIBLE: "not_eligible",
});

/** ActivationReason vocabulary (fail-closed). */
export const PHASE_C9_REASONS = Object.freeze({
  ACTIVATION_READY: "activation_ready",
  UNKNOWN_CAPABILITY: "unknown_capability",
  UNKNOWN_PROVIDER: "unknown_provider",
  BUDGET_BLOCKED: "budget_blocked",
  INVOCATION_DENIED: "invocation_denied",
  DRY_RUN_INVALID: "dry_run_invalid",
  /** Design Freeze deny vocab (matches C6). */
  PROVIDER_DISABLED: "provider_disabled",
  BOUNDARY_INVALID: "execution_boundary_invalid",
  TRANSMIT_FORBIDDEN: "transmit_forbidden",
  EXECUTE_FLAGS_FORBIDDEN: "execute_flags_forbidden",
  INVALID_CONTEXT: "invalid_context",
  IMMUTABLE_VIOLATION: "immutable_violation",
  EXTRA_FIELDS: "extra_fields",
});

/** ActivationContext allowlist (exact keys only). */
const CONTEXT_ALLOWLIST = Object.freeze([
  "schema_version",
  "provider",
  "capability",
  "plan",
  "envelope",
  "budget_decision",
  "invocation",
  "dry_run",
  "policy",
  "executed",
  "provider_called",
  "transmit",
  "recorded_api_cost",
]);

/** ActivationSnapshot allowlist — minimal · no prompt/secrets/payload. */
const SNAPSHOT_ALLOWLIST = Object.freeze([
  "schema_version",
  "provider",
  "capability",
  "budget_decision",
  "invocation_decision",
  "dry_run_decision",
  "activation_decision",
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
 * CapabilityEligibility — existing Phase B capabilities only.
 * Unknown capability → not eligible.
 *
 * @param {unknown} capability
 * @returns {{ eligible: boolean, capability: string|null, reason: string }}
 */
export function evaluateCapabilityEligibility(capability) {
  if (typeof capability !== "string" || !isPhaseBCapabilityAllowed(capability)) {
    return {
      eligible: false,
      capability: typeof capability === "string" ? capability : null,
      reason: PHASE_C9_REASONS.UNKNOWN_CAPABILITY,
    };
  }
  return {
    eligible: true,
    capability,
    reason: PHASE_C9_REASONS.ACTIVATION_READY,
  };
}

/**
 * ProviderEligibility — C4 identifier allowlist only.
 *
 * @param {unknown} provider
 * @returns {{ eligible: boolean, provider: string|null, reason: string }}
 */
export function evaluateProviderEligibility(provider) {
  const idCheck = validateProviderIdentifier(provider);
  if (!idCheck.ok) {
    return {
      eligible: false,
      provider: typeof provider === "string" ? provider : null,
      reason: PHASE_C9_REASONS.UNKNOWN_PROVIDER,
    };
  }
  return {
    eligible: true,
    provider: idCheck.value,
    reason: PHASE_C9_REASONS.ACTIVATION_READY,
  };
}

/**
 * Normalize budget decision string from plan or explicit field.
 * @param {unknown} budget
 * @returns {{ blocked: boolean, decision: string|null }}
 */
function readBudgetState(budget) {
  if (!isPlainObject(budget)) {
    return { blocked: true, decision: null };
  }
  const o = /** @type {Record<string, unknown>} */ (budget);
  const decision = typeof o.decision === "string" ? o.decision : null;
  const blocked =
    o.blocked === true ||
    decision === "blocked" ||
    decision === "hard_cap";
  return { blocked, decision };
}

/**
 * @param {unknown} invocation
 * @returns {{ decision: string|null, reason: string|null }}
 */
function readInvocationState(invocation) {
  if (!isPlainObject(invocation)) {
    return { decision: null, reason: null };
  }
  const o = /** @type {Record<string, unknown>} */ (invocation);
  return {
    decision: typeof o.decision === "string" ? o.decision : null,
    reason: typeof o.reason === "string" ? o.reason : null,
  };
}

/**
 * Dry-run decision label for snapshot (no body).
 * @param {unknown} dryRun
 * @returns {{ ok: boolean, decision: string|null }}
 */
function readDryRunState(dryRun) {
  if (!isPlainObject(dryRun)) {
    return { ok: false, decision: null };
  }
  const o = /** @type {Record<string, unknown>} */ (dryRun);
  if (o.ok !== true) {
    return { ok: false, decision: "invalid" };
  }
  if (
    o.executed === true ||
    o.provider_called === true ||
    o.transmit === true ||
    o.recorded_api_cost !== 0
  ) {
    return { ok: false, decision: "execute_flags" };
  }
  const r =
    o.result && isPlainObject(o.result)
      ? /** @type {Record<string, unknown>} */ (o.result)
      : null;
  if (r) {
    if (
      r.executed === true ||
      r.provider_called === true ||
      r.transmit === true ||
      r.would_call_adapter_execute === true ||
      r.recorded_api_cost !== 0
    ) {
      return { ok: false, decision: "execute_flags" };
    }
    if (r.simulated === true) {
      return { ok: true, decision: "simulated" };
    }
  }
  return { ok: true, decision: "ok" };
}

/**
 * Policy must explicitly enable execution for activation eligibility.
 * Missing / false flags → not eligible (fail-closed).
 * @param {unknown} policy
 * @returns {boolean}
 */
function isPolicyActivationEnabled(policy) {
  if (!isPlainObject(policy)) return false;
  const o = /** @type {Record<string, unknown>} */ (policy);
  return (
    o.provider_execution_enabled === true &&
    o.network_transmission_enabled === true &&
    o.credentials_enabled === true &&
    o.actual_cost_recording_enabled === true
  );
}

/**
 * Build ActivationSnapshot (minimal · frozen).
 * @param {Record<string, unknown>} fields
 */
export function buildActivationSnapshot(fields) {
  if (!isPlainObject(fields)) {
    return {
      ok: false,
      error: PHASE_C9_REASONS.INVALID_CONTEXT,
      reason: PHASE_C9_REASONS.INVALID_CONTEXT,
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
        error: PHASE_C9_REASONS.EXTRA_FIELDS,
        reason: PHASE_C9_REASONS.EXTRA_FIELDS,
      };
    }
  }
  const snap = deepFreeze({
    schema_version: PHASE_C9_SCHEMA_VERSION,
    provider: typeof o.provider === "string" ? o.provider : null,
    capability: typeof o.capability === "string" ? o.capability : null,
    budget_decision:
      typeof o.budget_decision === "string" ? o.budget_decision : null,
    invocation_decision:
      typeof o.invocation_decision === "string"
        ? o.invocation_decision
        : null,
    dry_run_decision:
      typeof o.dry_run_decision === "string" ? o.dry_run_decision : null,
    activation_decision:
      o.activation_decision === PHASE_C9_DECISIONS.ELIGIBLE ||
      o.activation_decision === PHASE_C9_DECISIONS.NOT_ELIGIBLE
        ? o.activation_decision
        : PHASE_C9_DECISIONS.NOT_ELIGIBLE,
    reason: typeof o.reason === "string" ? o.reason : PHASE_C9_REASONS.INVALID_CONTEXT,
    provider_called: false,
    executed: false,
    transmit: false,
    recorded_api_cost: 0,
  });
  return { ok: true, value: snap };
}

/**
 * Validate ActivationContext shape (allowlist · no proto pollution).
 * @param {unknown} context
 */
export function validateActivationContext(context) {
  if (!isPlainObject(context)) {
    return {
      ok: false,
      error: PHASE_C9_REASONS.INVALID_CONTEXT,
      reason: PHASE_C9_REASONS.INVALID_CONTEXT,
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
        error: PHASE_C9_REASONS.EXTRA_FIELDS,
        reason: PHASE_C9_REASONS.EXTRA_FIELDS,
      };
    }
  }
  return { ok: true, value: o };
}

/**
 * ActivationEvaluator — decide eligible | not_eligible only.
 * Does not execute providers.
 *
 * @param {{
 *   capability?: unknown,
 *   provider?: unknown,
 *   plan?: unknown,
 *   envelope?: unknown,
 *   budget_decision?: unknown,
 *   invocation?: unknown,
 *   dry_run?: unknown,
 *   policy?: unknown,
 *   executed?: unknown,
 *   provider_called?: unknown,
 *   transmit?: unknown,
 *   recorded_api_cost?: unknown,
 * }} input
 * @returns {{
 *   ok: true,
 *   decision: string,
 *   reason: string,
 *   snapshot: Readonly<Record<string, unknown>>,
 *   capability_eligibility: ReturnType<typeof evaluateCapabilityEligibility>,
 *   provider_eligibility: ReturnType<typeof evaluateProviderEligibility>,
 *   provider_called: false,
 *   executed: false,
 *   transmit: false,
 *   recorded_api_cost: 0,
 * } | {
 *   ok: false,
 *   decision: "not_eligible",
 *   reason: string,
 *   error: string,
 *   provider_called: false,
 *   executed: false,
 *   transmit: false,
 *   recorded_api_cost: 0,
 * }}
 */
export function evaluateActivation(input = {}) {
  const zero = {
    provider_called: /** @type {false} */ (false),
    executed: /** @type {false} */ (false),
    transmit: /** @type {false} */ (false),
    recorded_api_cost: /** @type {0} */ (0),
  };

  const ctxCheck = validateActivationContext({
    schema_version: PHASE_C9_SCHEMA_VERSION,
    provider: input.provider,
    capability: input.capability,
    plan: input.plan,
    envelope: input.envelope,
    budget_decision: input.budget_decision,
    invocation: input.invocation,
    dry_run: input.dry_run,
    policy: input.policy,
    executed: input.executed === true ? true : false,
    provider_called: input.provider_called === true ? true : false,
    transmit: input.transmit === true ? true : false,
    recorded_api_cost:
      typeof input.recorded_api_cost === "number" ? input.recorded_api_cost : 0,
  });
  if (!ctxCheck.ok) {
    return {
      ok: false,
      decision: PHASE_C9_DECISIONS.NOT_ELIGIBLE,
      reason: ctxCheck.reason || PHASE_C9_REASONS.INVALID_CONTEXT,
      error: ctxCheck.error || PHASE_C9_REASONS.INVALID_CONTEXT,
      ...zero,
    };
  }

  /**
   * @param {string} reason
   * @param {Record<string, unknown>} partial
   */
  function notEligible(reason, partial = {}) {
    const snapBuilt = buildActivationSnapshot({
      provider:
        typeof partial.provider === "string"
          ? partial.provider
          : typeof input.provider === "string"
            ? input.provider
            : null,
      capability:
        typeof partial.capability === "string"
          ? partial.capability
          : typeof input.capability === "string"
            ? input.capability
            : null,
      budget_decision:
        typeof partial.budget_decision === "string"
          ? partial.budget_decision
          : null,
      invocation_decision:
        typeof partial.invocation_decision === "string"
          ? partial.invocation_decision
          : null,
      dry_run_decision:
        typeof partial.dry_run_decision === "string"
          ? partial.dry_run_decision
          : null,
      activation_decision: PHASE_C9_DECISIONS.NOT_ELIGIBLE,
      reason,
    });
    if (!snapBuilt.ok) {
      return {
        ok: false,
        decision: PHASE_C9_DECISIONS.NOT_ELIGIBLE,
        reason: snapBuilt.reason || reason,
        error: snapBuilt.error || reason,
        ...zero,
      };
    }
    return {
      ok: true,
      decision: PHASE_C9_DECISIONS.NOT_ELIGIBLE,
      reason,
      snapshot: snapBuilt.value,
      capability_eligibility:
        partial.capability_eligibility ||
        evaluateCapabilityEligibility(input.capability),
      provider_eligibility:
        partial.provider_eligibility ||
        evaluateProviderEligibility(input.provider),
      ...zero,
    };
  }

  // Hard execute-flag short-circuit
  if (
    input.executed === true ||
    input.provider_called === true ||
    input.transmit === true ||
    (typeof input.recorded_api_cost === "number" &&
      input.recorded_api_cost !== 0)
  ) {
    return notEligible(PHASE_C9_REASONS.EXECUTE_FLAGS_FORBIDDEN);
  }

  const cap = evaluateCapabilityEligibility(input.capability);
  if (!cap.eligible) {
    return notEligible(PHASE_C9_REASONS.UNKNOWN_CAPABILITY, {
      capability: cap.capability,
      capability_eligibility: cap,
    });
  }

  // Provider: prefer explicit input, else plan.provider
  let providerRaw = input.provider;
  if (providerRaw == null && isPlainObject(input.plan)) {
    providerRaw = /** @type {Record<string, unknown>} */ (input.plan).provider;
  }
  const prov = evaluateProviderEligibility(providerRaw);
  if (!prov.eligible) {
    return notEligible(PHASE_C9_REASONS.UNKNOWN_PROVIDER, {
      capability: cap.capability,
      provider: prov.provider,
      capability_eligibility: cap,
      provider_eligibility: prov,
    });
  }

  // Execution boundary — plan required & valid
  const planCheck = validateExecutionPlan(input.plan);
  if (!planCheck.ok) {
    return notEligible(PHASE_C9_REASONS.BOUNDARY_INVALID, {
      capability: cap.capability,
      provider: prov.provider,
      capability_eligibility: cap,
      provider_eligibility: prov,
    });
  }
  const plan = planCheck.value;
  if (Object.isFrozen && !Object.isFrozen(plan)) {
    return notEligible(PHASE_C9_REASONS.IMMUTABLE_VIOLATION, {
      capability: cap.capability,
      provider: prov.provider,
      capability_eligibility: cap,
      provider_eligibility: prov,
    });
  }
  if (
    plan.provider_called === true ||
    plan.recorded_api_cost !== 0 ||
    (plan.provider !== prov.provider && plan.provider !== providerRaw)
  ) {
    // provider mismatch or execute flags on plan
    if (plan.provider_called === true || plan.recorded_api_cost !== 0) {
      return notEligible(PHASE_C9_REASONS.EXECUTE_FLAGS_FORBIDDEN, {
        capability: cap.capability,
        provider: prov.provider,
        capability_eligibility: cap,
        provider_eligibility: prov,
      });
    }
  }
  if (plan.provider !== prov.provider) {
    return notEligible(PHASE_C9_REASONS.UNKNOWN_PROVIDER, {
      capability: cap.capability,
      provider: prov.provider,
      capability_eligibility: cap,
      provider_eligibility: prov,
    });
  }

  if (input.envelope != null) {
    const envCheck = validateExecutionEnvelope(input.envelope);
    if (!envCheck.ok) {
      return notEligible(PHASE_C9_REASONS.BOUNDARY_INVALID, {
        capability: cap.capability,
        provider: prov.provider,
        capability_eligibility: cap,
        provider_eligibility: prov,
      });
    }
    const env = envCheck.value;
    if (env.transmit === true) {
      return notEligible(PHASE_C9_REASONS.TRANSMIT_FORBIDDEN, {
        capability: cap.capability,
        provider: prov.provider,
        capability_eligibility: cap,
        provider_eligibility: prov,
      });
    }
    if (env.provider_called === true || env.recorded_api_cost !== 0) {
      return notEligible(PHASE_C9_REASONS.EXECUTE_FLAGS_FORBIDDEN, {
        capability: cap.capability,
        provider: prov.provider,
        capability_eligibility: cap,
        provider_eligibility: prov,
      });
    }
  }

  const budgetSrc =
    input.budget_decision != null
      ? input.budget_decision
      : plan.budget_decision;
  const budget = readBudgetState(budgetSrc);
  if (budget.blocked) {
    return notEligible(PHASE_C9_REASONS.BUDGET_BLOCKED, {
      capability: cap.capability,
      provider: prov.provider,
      budget_decision: budget.decision || "blocked",
      capability_eligibility: cap,
      provider_eligibility: prov,
    });
  }

  const inv = readInvocationState(input.invocation);
  if (inv.decision !== PHASE_C6_DECISIONS.ALLOWED) {
    return notEligible(PHASE_C9_REASONS.INVOCATION_DENIED, {
      capability: cap.capability,
      provider: prov.provider,
      budget_decision: budget.decision,
      invocation_decision: inv.decision || PHASE_C6_DECISIONS.DENIED,
      capability_eligibility: cap,
      provider_eligibility: prov,
    });
  }

  const policy =
    input.policy != null ? input.policy : getInvocationPolicy();
  if (!isPolicyActivationEnabled(policy)) {
    return notEligible(PHASE_C9_REASONS.PROVIDER_DISABLED, {
      capability: cap.capability,
      provider: prov.provider,
      budget_decision: budget.decision,
      invocation_decision: inv.decision,
      capability_eligibility: cap,
      provider_eligibility: prov,
    });
  }

  const dry = readDryRunState(input.dry_run);
  if (!dry.ok) {
    return notEligible(PHASE_C9_REASONS.DRY_RUN_INVALID, {
      capability: cap.capability,
      provider: prov.provider,
      budget_decision: budget.decision,
      invocation_decision: inv.decision,
      dry_run_decision: dry.decision || "invalid",
      capability_eligibility: cap,
      provider_eligibility: prov,
    });
  }

  // All gates pass → eligible (still does not execute)
  const snapBuilt = buildActivationSnapshot({
    provider: prov.provider,
    capability: cap.capability,
    budget_decision: budget.decision,
    invocation_decision: inv.decision,
    dry_run_decision: dry.decision,
    activation_decision: PHASE_C9_DECISIONS.ELIGIBLE,
    reason: PHASE_C9_REASONS.ACTIVATION_READY,
  });
  if (!snapBuilt.ok) {
    return {
      ok: false,
      decision: PHASE_C9_DECISIONS.NOT_ELIGIBLE,
      reason: snapBuilt.reason || PHASE_C9_REASONS.INVALID_CONTEXT,
      error: snapBuilt.error || PHASE_C9_REASONS.INVALID_CONTEXT,
      ...zero,
    };
  }

  const decision = deepFreeze({
    schema_version: PHASE_C9_SCHEMA_VERSION,
    decision: PHASE_C9_DECISIONS.ELIGIBLE,
    reason: PHASE_C9_REASONS.ACTIVATION_READY,
  });

  return {
    ok: true,
    decision: decision.decision,
    reason: decision.reason,
    snapshot: snapBuilt.value,
    capability_eligibility: cap,
    provider_eligibility: prov,
    ...zero,
  };
}

/**
 * Alias matching ticket vocabulary.
 * @param {Parameters<typeof evaluateActivation>[0]} input
 */
export function evaluateActivationReadiness(input) {
  return evaluateActivation(input);
}

/**
 * Sanitized event metadata (no prompt / credentials / provider payload).
 * @param {unknown} activationOutcome
 */
export function sanitizeActivationEventMetadata(activationOutcome) {
  const o =
    activationOutcome && typeof activationOutcome === "object"
      ? /** @type {Record<string, unknown>} */ (activationOutcome)
      : {};
  const snap =
    o.snapshot && typeof o.snapshot === "object"
      ? /** @type {Record<string, unknown>} */ (o.snapshot)
      : {};

  return deepFreeze({
    schema_version: PHASE_C9_SCHEMA_VERSION,
    activation_decision:
      o.decision === PHASE_C9_DECISIONS.ELIGIBLE ||
      o.decision === PHASE_C9_DECISIONS.NOT_ELIGIBLE
        ? o.decision
        : PHASE_C9_DECISIONS.NOT_ELIGIBLE,
    reason:
      typeof o.reason === "string"
        ? o.reason
        : PHASE_C9_REASONS.INVALID_CONTEXT,
    provider: typeof snap.provider === "string" ? snap.provider : null,
    capability: typeof snap.capability === "string" ? snap.capability : null,
    budget_decision:
      typeof snap.budget_decision === "string" ? snap.budget_decision : null,
    invocation_decision:
      typeof snap.invocation_decision === "string"
        ? snap.invocation_decision
        : null,
    dry_run_decision:
      typeof snap.dry_run_decision === "string" ? snap.dry_run_decision : null,
    provider_called: false,
    executed: false,
    transmit: false,
    recorded_api_cost: 0,
  });
}
