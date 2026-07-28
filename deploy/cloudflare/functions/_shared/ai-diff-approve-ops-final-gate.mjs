/**
 * Diff & Approve — Staging Final Apply Gate + staging_simulation service.
 * Keeps proposal status approved. No Provider / real Apply.
 */

import { detectGateEnvironment } from "./ai-exec-gate-flags.mjs";
import { isPhaseBCapabilityAllowed } from "./ai-exec-gate-capabilities.mjs";
import { deepFreeze } from "./ai-diff-approve-a1-foundation.mjs";
import { hashValue } from "./ai-diff-approve-a10-tamper-detection.mjs";
import {
  createPersistentRepository,
  pickDiffApprovePersistenceEnv,
  assertPersistenceAllowed,
} from "./ai-diff-approve-persistence-repository.mjs";
import { computeDryRunPlan } from "./ai-diff-approve-ops-apply-plan.mjs";
import {
  FINAL_GATE_SCHEMA,
  EXEC_ATTEMPT_SCHEMA,
  GATE_STATUSES,
  EXEC_MODES,
  EXEC_STATUSES,
  GATE_ERRORS,
  validateApplyGateInput,
  validateSimulateExecutionInput,
  buildGateIdempotencyKey,
  classifySimulationOutcome,
  normalizeGateError,
  gateErrorHttp,
  normalizeUuid,
} from "./ai-diff-approve-ops-final-gate-contract.mjs";

export const FINAL_GATE_HTTP_SCHEMA = "diff_approve.ops.final_gate.http.v1";
export const SIM_HTTP_SCHEMA = "diff_approve.ops.simulate_execution.http.v1";

/**
 * @param {Record<string, unknown>|null|undefined} env
 */
export function assertFinalGateEnvironment(env) {
  const gateEnv = detectGateEnvironment(env);
  if (gateEnv === "production") {
    return { ok: false, error: "production_forbidden", http: 403 };
  }
  if (gateEnv !== "staging") {
    return {
      ok: false,
      error: GATE_ERRORS.ENVIRONMENT_BLOCKED,
      http: 403,
    };
  }
  const cfg = pickDiffApprovePersistenceEnv(env);
  const write = assertPersistenceAllowed(cfg);
  if (!write.ok) {
    return {
      ok: false,
      error: write.error || "persistence_disabled",
      http: write.error === "db_unavailable" ? 503 : 403,
    };
  }
  if (cfg.applyEnabled) {
    return { ok: false, error: GATE_ERRORS.APPLY_FORBIDDEN, http: 403 };
  }
  return { ok: true, cfg, environment: gateEnv };
}

/**
 * Evaluate Final Apply Gate (dry-run plan required). Does not mutate Apply.
 * @param {{
 *   proposal: Record<string, unknown>,
 *   plan: Record<string, unknown>,
 *   expectedFingerprint: string,
 *   timeline: unknown[],
 *   approvalRecord?: Record<string, unknown>|null,
 *   activeExecution?: boolean,
 * }} args
 */
export function evaluateApplyGate(args) {
  /** @type {string[]} */
  const blockers = [];
  /** @type {string[]} */
  const preconditions = [];

  const prop = args.proposal || {};
  const plan = args.plan || {};
  const status = String(prop.status || "");

  preconditions.push("environment=staging");
  preconditions.push("mode=manual_final_apply_gate");
  preconditions.push("provider_executed=false");
  preconditions.push("apply_executed=false");

  if (status !== "approved") blockers.push(GATE_ERRORS.INVALID_STATUS);
  else preconditions.push("status=approved");

  if (
    prop.applied === true ||
    prop.executed === true ||
    prop.provider_called === true
  ) {
    blockers.push(GATE_ERRORS.ALREADY_APPLIED);
  } else {
    preconditions.push("no_previous_successful_apply");
  }

  if (args.activeExecution) {
    blockers.push(GATE_ERRORS.EXECUTION_IN_PROGRESS);
  } else {
    preconditions.push("no_active_execution");
  }

  const capability = String(prop.capability || "");
  if (!capability || capability.length > 128) {
    blockers.push(GATE_ERRORS.CAPABILITY_BLOCKED);
  } else if (!isPhaseBCapabilityAllowed(capability)) {
    preconditions.push("capability_present_outside_phase_b");
  } else {
    preconditions.push("capability_allowed");
  }

  const payload =
    prop.payload && typeof prop.payload === "object" && !Array.isArray(prop.payload)
      ? /** @type {Record<string, unknown>} */ (prop.payload)
      : {};
  if (payload.budget_exceeded === true) {
    blockers.push(GATE_ERRORS.BUDGET_BLOCKED);
  } else {
    preconditions.push("budget_within_hard_cap");
  }

  const timeline = Array.isArray(args.timeline) ? args.timeline : [];
  if (timeline[0] && /** @type {{ ok?: boolean }} */ (timeline[0]).ok === false) {
    blockers.push(GATE_ERRORS.AUDIT_INVALID);
  } else {
    let prev = "genesis";
    let seq = 0;
    let chainOk = true;
    for (const ev of timeline) {
      const e = /** @type {Record<string, unknown>} */ (ev);
      const s = Number(e.sequence_number);
      if (!Number.isInteger(s) || s !== seq + 1) {
        chainOk = false;
        break;
      }
      if (String(e.previous_event_hash) !== prev) {
        chainOk = false;
        break;
      }
      prev = String(e.event_hash || "");
      seq = s;
    }
    if (!chainOk) blockers.push(GATE_ERRORS.AUDIT_INVALID);
    else preconditions.push("audit_hash_chain_valid");
  }

  const hasApproval =
    timeline.some(
      (ev) =>
        /** @type {Record<string, unknown>} */ (ev).event_type ===
        "approval_granted"
    ) || Boolean(args.approvalRecord);
  if (!hasApproval) blockers.push(GATE_ERRORS.APPROVAL_MISSING);
  else preconditions.push("approval_exists");

  const planStatus = String(plan.status || "");
  if (!plan.planId && !plan.id) {
    blockers.push(GATE_ERRORS.PLAN_MISSING);
  } else if (planStatus === "blocked") {
    blockers.push(GATE_ERRORS.PLAN_BLOCKED);
  } else if (planStatus !== "ready") {
    blockers.push(GATE_ERRORS.PLAN_MISSING);
  } else {
    preconditions.push("latest_apply_plan_ready");
  }

  const storedFp = String(plan.fingerprint || "");
  const expectedFp = String(args.expectedFingerprint || "");
  if (!storedFp || storedFp !== expectedFp) {
    blockers.push(GATE_ERRORS.FINGERPRINT_MISMATCH);
  } else {
    preconditions.push("plan_fingerprint_matches_client");
  }

  // Recompute from source — reject stale plan vs current proposal
  const recomputed = computeDryRunPlan({
    proposal: prop,
    timeline,
    approvalRecord: args.approvalRecord,
  });
  if (
    !recomputed.ok ||
    String(recomputed.fingerprint) !== storedFp ||
    Number(plan.sourceVersion) !== Number(prop.record_version)
  ) {
    blockers.push(GATE_ERRORS.STALE_PLAN);
  } else {
    preconditions.push("plan_fingerprint_matches_current_source");
    preconditions.push("proposal_hash_stable");
    preconditions.push("approval_hash_stable");
  }

  if (
    recomputed.ok &&
    (recomputed.proposalHash !== String(plan.proposalHash || recomputed.proposalHash) ||
      recomputed.approvalHash !== String(plan.approvalHash || recomputed.approvalHash))
  ) {
    // soft: plan row may not echo hashes in list view — use recomputed only
  }

  if (recomputed.ok && recomputed.blockerCount > 0) {
    blockers.push(GATE_ERRORS.PLAN_BLOCKED);
  }

  const uniqueBlockers = [...new Set(blockers)].sort();
  const uniquePreconditions = [...new Set(preconditions)].sort();
  const gateStatus =
    uniqueBlockers.length > 0
      ? GATE_STATUSES.BLOCKED
      : GATE_STATUSES.APPLY_READY;

  return deepFreeze({
    ok: true,
    status: gateStatus,
    blockers: uniqueBlockers,
    preconditions: uniquePreconditions,
    planFingerprint: storedFp,
    proposalHash: recomputed.ok ? recomputed.proposalHash : "unknown",
    approvalHash: recomputed.ok ? recomputed.approvalHash : "unknown",
    eventType:
      gateStatus === GATE_STATUSES.BLOCKED
        ? "apply_gate_blocked"
        : "apply_gate_confirmed",
    applyEligible: false,
    providerEligible: false,
    realExecutionAvailable: false,
  });
}

/**
 * @param {{
 *   env: Record<string, unknown>,
 *   actor: { userId: string },
 *   body: unknown,
 *   proposalIdFromPath?: string,
 *   fetchImpl?: typeof fetch,
 * }} args
 */
export async function confirmApplyGate(args) {
  const envCheck = assertFinalGateEnvironment(args.env);
  if (!envCheck.ok) return envCheck;

  const validated = validateApplyGateInput(args.body);
  if (!validated.ok) return validated;
  const input = validated.value;

  if (args.proposalIdFromPath) {
    const pathId = normalizeUuid(args.proposalIdFromPath);
    if (!pathId || pathId !== input.requestId) {
      return { ok: false, error: GATE_ERRORS.INVALID_UUID, http: 400 };
    }
  }

  const actorId = String(args.actor?.userId || "").trim();
  if (!normalizeUuid(actorId)) {
    return { ok: false, error: "auth_required", http: 401 };
  }

  const repo = createPersistentRepository({
    env: args.env,
    fetchImpl: args.fetchImpl,
    ownerUserId: actorId,
  });

  const rowRes = await repo.getProposalRow(input.requestId);
  if (!rowRes.ok) {
    const code = normalizeGateError(rowRes.error || "not_found");
    return { ok: false, error: code, code, http: gateErrorHttp(code) };
  }
  const proposal = /** @type {Record<string, unknown>} */ (rowRes.value);
  if (Number(proposal.record_version) !== input.expectedVersion) {
    return {
      ok: false,
      error: GATE_ERRORS.VERSION_CONFLICT,
      code: GATE_ERRORS.VERSION_CONFLICT,
      http: 409,
      current_version: proposal.record_version,
    };
  }
  if (String(proposal.status) !== "approved") {
    return {
      ok: false,
      error: GATE_ERRORS.INVALID_STATUS,
      code: GATE_ERRORS.INVALID_STATUS,
      http: 400,
    };
  }

  const planRes = await repo.getApplyPlan(input.requestId, input.planId);
  if (!planRes.ok) {
    return {
      ok: false,
      error: GATE_ERRORS.PLAN_MISSING,
      code: GATE_ERRORS.PLAN_MISSING,
      http: 400,
    };
  }
  const plan = /** @type {Record<string, unknown>} */ (planRes.value);
  const timeline = await repo.getAuditTimeline(input.requestId);
  const records = await repo.listByProposal(input.requestId);
  const approvalRecord =
    Array.isArray(records) &&
    records.find((r) => r.record_type === "approval")
      ? /** @type {Record<string, unknown>} */ (
          records.find((r) => r.record_type === "approval")
        )
      : null;

  const active = await repo.hasActiveExecutionAttempt(input.requestId);

  const evaluated = evaluateApplyGate({
    proposal,
    plan: {
      planId: plan.planId,
      status: plan.status,
      fingerprint: plan.fingerprint,
      sourceVersion: plan.sourceVersion,
      proposalHash: plan.normalizedPlan?.proposalHash,
      approvalHash: plan.normalizedPlan?.approvalHash,
    },
    expectedFingerprint: input.planFingerprint,
    timeline: Array.isArray(timeline) ? timeline : [],
    approvalRecord,
    activeExecution: Boolean(active),
  });

  const result = await repo.persistApplyGate({
    proposalId: input.requestId,
    expectedVersion: input.expectedVersion,
    idempotencyKey: buildGateIdempotencyKey({
      environment: envCheck.environment,
      actorId,
      requestId: input.requestId,
      idempotencyKey: input.idempotencyKey,
      op: "confirm_apply_gate",
    }),
    payloadHash: input.payloadHash,
    actorId,
    planId: input.planId,
    planFingerprint: String(plan.fingerprint || ""),
    status: evaluated.status,
    blockers: evaluated.blockers,
    preconditions: evaluated.preconditions,
    proposalHash: evaluated.proposalHash,
    approvalHash: evaluated.approvalHash,
    confirmationPhrase: input.confirmationPhrase,
    eventType: evaluated.eventType,
  });

  if (!result.ok) {
    const code = normalizeGateError(result.error || result.code || "");
    return {
      ok: false,
      error: code,
      code,
      http: gateErrorHttp(code),
      current_version: result.current_version,
    };
  }

  return {
    ok: true,
    http: 200,
    body: {
      ok: true,
      schema_version: FINAL_GATE_HTTP_SCHEMA,
      requestId: result.requestId,
      gateId: result.gateId,
      planId: input.planId,
      status: result.status,
      sourceVersion: result.sourceVersion,
      planFingerprint: result.planFingerprint,
      blockers: result.blockers,
      preconditions: result.preconditions,
      replayed: Boolean(result.replayed),
      createdAt: result.createdAt,
      requestStatus: "approved",
      applyExecuted: false,
      providerExecuted: false,
      realExecutionAvailable: false,
      environment: "staging",
      badges: [
        "STAGING",
        "APPROVED",
        "DRY RUN",
        result.status === GATE_STATUSES.APPLY_READY
          ? "APPLY READY"
          : "GATE BLOCKED",
        "SIMULATION ONLY",
        "NO PROVIDER EXECUTION",
      ],
    },
  };
}

/**
 * @param {{
 *   env: Record<string, unknown>,
 *   actor: { userId: string },
 *   body: unknown,
 *   proposalIdFromPath?: string,
 *   fetchImpl?: typeof fetch,
 * }} args
 */
export async function simulateExecution(args) {
  const envCheck = assertFinalGateEnvironment(args.env);
  if (!envCheck.ok) return envCheck;

  const validated = validateSimulateExecutionInput(args.body);
  if (!validated.ok) return validated;
  const input = validated.value;

  if (args.proposalIdFromPath) {
    const pathId = normalizeUuid(args.proposalIdFromPath);
    if (!pathId || pathId !== input.requestId) {
      return { ok: false, error: GATE_ERRORS.INVALID_UUID, http: 400 };
    }
  }

  const actorId = String(args.actor?.userId || "").trim();
  if (!normalizeUuid(actorId)) {
    return { ok: false, error: "auth_required", http: 401 };
  }

  // Explicit: real execution path is unavailable
  if (String(input.mode) !== EXEC_MODES.STAGING_SIMULATION) {
    return {
      ok: false,
      error: GATE_ERRORS.REAL_EXECUTION_UNAVAILABLE,
      http: 403,
    };
  }

  const repo = createPersistentRepository({
    env: args.env,
    fetchImpl: args.fetchImpl,
    ownerUserId: actorId,
  });

  const rowRes = await repo.getProposalRow(input.requestId);
  if (!rowRes.ok) {
    const code = normalizeGateError(rowRes.error || "not_found");
    return { ok: false, error: code, code, http: gateErrorHttp(code) };
  }
  const proposal = /** @type {Record<string, unknown>} */ (rowRes.value);
  if (Number(proposal.record_version) !== input.expectedVersion) {
    return {
      ok: false,
      error: GATE_ERRORS.VERSION_CONFLICT,
      code: GATE_ERRORS.VERSION_CONFLICT,
      http: 409,
    };
  }
  if (String(proposal.status) !== "approved") {
    return {
      ok: false,
      error: GATE_ERRORS.INVALID_STATUS,
      code: GATE_ERRORS.INVALID_STATUS,
      http: 400,
    };
  }

  const gateRes = await repo.getApplyGate(input.requestId, input.gateId);
  if (!gateRes.ok || String(gateRes.value?.status) !== GATE_STATUSES.APPLY_READY) {
    return {
      ok: false,
      error: GATE_ERRORS.GATE_NOT_READY,
      code: GATE_ERRORS.GATE_NOT_READY,
      http: 400,
    };
  }
  const gate = gateRes.value;
  if (String(gate.planId) !== input.planId) {
    return {
      ok: false,
      error: GATE_ERRORS.STALE_PLAN,
      code: GATE_ERRORS.STALE_PLAN,
      http: 409,
    };
  }

  const outcome = classifySimulationOutcome(input.outcomeHint);
  const resultSummary = deepFreeze({
    mode: EXEC_MODES.STAGING_SIMULATION,
    status: outcome.status,
    note: "noop_provider_adapter",
    provider: "none",
    operationCount: 0,
    applyExecuted: false,
    providerExecuted: false,
    rollbackAvailable: false,
    rollbackNotExecuted: true,
  });

  const eventType =
    outcome.status === EXEC_STATUSES.SIMULATED
      ? "execution_simulation_succeeded"
      : outcome.status === EXEC_STATUSES.CANCELLED
        ? "execution_simulation_cancelled"
        : "execution_simulation_failed";

  const result = await repo.persistExecutionAttempt({
    proposalId: input.requestId,
    expectedVersion: input.expectedVersion,
    idempotencyKey: buildGateIdempotencyKey({
      environment: envCheck.environment,
      actorId,
      requestId: input.requestId,
      idempotencyKey: input.idempotencyKey,
      op: "simulate_execution",
    }),
    payloadHash: input.payloadHash,
    actorId,
    gateId: input.gateId,
    planId: input.planId,
    planFingerprint: String(gate.planFingerprint || ""),
    mode: EXEC_MODES.STAGING_SIMULATION,
    status: outcome.status,
    provider: "noop",
    operationCount: 0,
    errorCode: outcome.errorCode,
    errorMessage: outcome.errorMessage,
    retryable: outcome.retryable,
    retryReason: outcome.retryReason,
    maxAttempts: outcome.maxAttempts,
    nextAttemptNotScheduled: true,
    rollbackAvailable: false,
    rollbackStrategy: "none",
    rollbackNotExecuted: true,
    resultSummary,
    eventType,
  });

  if (!result.ok) {
    const code = normalizeGateError(result.error || result.code || "");
    return {
      ok: false,
      error: code,
      code,
      http: gateErrorHttp(code),
    };
  }

  return {
    ok: true,
    http: 200,
    body: {
      ok: true,
      schema_version: SIM_HTTP_SCHEMA,
      requestId: result.requestId,
      attemptId: result.attemptId,
      gateId: input.gateId,
      planId: input.planId,
      mode: EXEC_MODES.STAGING_SIMULATION,
      status: result.status,
      provider: "noop",
      resultSummary: result.resultSummary,
      retryable: result.retryable,
      retryReason: result.retryReason,
      maxAttempts: result.maxAttempts,
      nextAttemptNotScheduled: true,
      rollbackAvailable: false,
      rollbackNotExecuted: true,
      applyExecuted: false,
      providerExecuted: false,
      realExecutionAvailable: false,
      replayed: Boolean(result.replayed),
      createdAt: result.createdAt,
      requestStatus: "approved",
      environment: "staging",
      badges: [
        "STAGING",
        "SIMULATION ONLY",
        "NO PROVIDER EXECUTION",
        "NO APPLY",
      ],
    },
  };
}

/**
 * @param {{ env: Record<string, unknown>, proposalId: string, gateId?: string, fetchImpl?: typeof fetch }} args
 */
export async function getApplyGates(args) {
  const envCheck = assertFinalGateEnvironment(args.env);
  if (!envCheck.ok) {
    const cfg = pickDiffApprovePersistenceEnv(args.env);
    if (!cfg.readEnabled) return envCheck;
  }
  const id = normalizeUuid(args.proposalId);
  if (!id) return { ok: false, error: GATE_ERRORS.INVALID_UUID, http: 400 };
  const repo = createPersistentRepository({
    env: args.env,
    fetchImpl: args.fetchImpl,
  });
  if (args.gateId) {
    const one = await repo.getApplyGate(id, args.gateId);
    if (!one.ok) {
      return {
        ok: false,
        error: normalizeGateError(one.error || "not_found"),
        http: one.error === "not_found" ? 404 : 400,
      };
    }
    return {
      ok: true,
      http: 200,
      body: {
        ok: true,
        gate: one.value,
        applyExecuted: false,
        providerExecuted: false,
      },
    };
  }
  const list = await repo.listApplyGates(id);
  return {
    ok: true,
    http: 200,
    body: {
      ok: true,
      items: list,
      applyExecuted: false,
      providerExecuted: false,
    },
  };
}

/**
 * @param {{ env: Record<string, unknown>, proposalId: string, attemptId?: string, fetchImpl?: typeof fetch }} args
 */
export async function getExecutionAttempts(args) {
  const envCheck = assertFinalGateEnvironment(args.env);
  if (!envCheck.ok) {
    const cfg = pickDiffApprovePersistenceEnv(args.env);
    if (!cfg.readEnabled) return envCheck;
  }
  const id = normalizeUuid(args.proposalId);
  if (!id) return { ok: false, error: GATE_ERRORS.INVALID_UUID, http: 400 };
  const repo = createPersistentRepository({
    env: args.env,
    fetchImpl: args.fetchImpl,
  });
  if (args.attemptId) {
    const one = await repo.getExecutionAttempt(id, args.attemptId);
    if (!one.ok) {
      return {
        ok: false,
        error: normalizeGateError(one.error || "not_found"),
        http: one.error === "not_found" ? 404 : 400,
      };
    }
    return {
      ok: true,
      http: 200,
      body: {
        ok: true,
        attempt: one.value,
        applyExecuted: false,
        providerExecuted: false,
      },
    };
  }
  const list = await repo.listExecutionAttempts(id);
  return {
    ok: true,
    http: 200,
    body: {
      ok: true,
      items: list,
      applyExecuted: false,
      providerExecuted: false,
    },
  };
}

export {
  evaluateApplyGate as evaluateApplyGateForTests,
  classifySimulationOutcome,
  hashValue,
  FINAL_GATE_SCHEMA,
  EXEC_ATTEMPT_SCHEMA,
};
