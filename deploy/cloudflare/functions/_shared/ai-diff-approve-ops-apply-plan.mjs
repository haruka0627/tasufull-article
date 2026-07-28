/**
 * Diff & Approve — Staging Apply Plan / Dry-run service (no Apply / Provider).
 */

import { detectGateEnvironment } from "./ai-exec-gate-flags.mjs";
import { isPhaseBCapabilityAllowed } from "./ai-exec-gate-capabilities.mjs";
import { deepFreeze } from "./ai-diff-approve-a1-foundation.mjs";
import { hashValue } from "./ai-diff-approve-a10-tamper-detection.mjs";
import {
  createPersistentRepository,
  pickDiffApprovePersistenceEnv,
  assertPersistenceAllowed,
  buildAuditEventHashes,
} from "./ai-diff-approve-persistence-repository.mjs";
import {
  APPLY_PLAN_SCHEMA,
  APPLY_PLAN_POLICY_VERSION,
  APPLY_PLAN_STATUSES,
  APPLY_PLAN_ERRORS,
  validateApplyPlanInput,
  buildApplyPlanIdempotencyKey,
  buildApplyPlanFingerprint,
  normalizeApplyPlanError,
  applyPlanErrorHttp,
  normalizeUuid,
} from "./ai-diff-approve-ops-apply-plan-contract.mjs";

export const APPLY_PLAN_HTTP_SCHEMA = "diff_approve.ops.apply_plan.http.v1";

/**
 * @param {Record<string, unknown>|null|undefined} env
 */
export function assertApplyPlanEnvironment(env) {
  const gateEnv = detectGateEnvironment(env);
  if (gateEnv === "production") {
    return { ok: false, error: "production_forbidden", http: 403 };
  }
  if (gateEnv !== "staging") {
    return { ok: false, error: "staging_required", http: 403 };
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
    return { ok: false, error: "apply_forbidden", http: 403 };
  }
  return { ok: true, cfg, environment: gateEnv };
}

/**
 * Build deterministic dry-run plan from Staging proposal row + timeline.
 * Does not call Provider or mutate Apply state.
 * @param {{
 *   proposal: Record<string, unknown>,
 *   timeline: unknown[],
 *   approvalRecord?: Record<string, unknown> | null,
 * }} args
 */
export function computeDryRunPlan(args) {
  /** @type {string[]} */
  const preconditions = [];
  /** @type {string[]} */
  const warnings = [];
  /** @type {string[]} */
  const blockers = [];

  const prop = args.proposal || {};
  const status = String(prop.status || "");
  const capability = String(prop.capability || "diff_approve");
  const resourceType = String(prop.resource_type || "unknown");
  const resourceId = String(prop.resource_id || "");
  const payload =
    prop.payload && typeof prop.payload === "object" && !Array.isArray(prop.payload)
      ? /** @type {Record<string, unknown>} */ (prop.payload)
      : {};

  preconditions.push("environment=staging");
  preconditions.push("mode=dry_run");
  preconditions.push("apply_executed=false");
  preconditions.push("provider_executed=false");

  if (status !== "approved") {
    blockers.push("INVALID_STATUS");
  } else {
    preconditions.push("status=approved");
  }

  if (
    prop.applied === true ||
    prop.executed === true ||
    prop.provider_called === true
  ) {
    blockers.push("ALREADY_EXECUTED");
  } else {
    preconditions.push("no_previous_apply_execution");
  }

  if (!capability || capability.length > 128) {
    blockers.push("CAPABILITY_DENIED");
  } else if (!isPhaseBCapabilityAllowed(capability)) {
    warnings.push("capability_outside_phase_b_allowlist");
    preconditions.push("capability_present");
  } else {
    preconditions.push("capability_allowed");
  }

  const timeline = Array.isArray(args.timeline) ? args.timeline : [];
  if (timeline[0] && /** @type {{ ok?: boolean }} */ (timeline[0]).ok === false) {
    blockers.push("AUDIT_INVALID");
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
    if (!chainOk) blockers.push("AUDIT_INVALID");
    else preconditions.push("audit_hash_chain_valid");
  }

  const hasApproval =
    timeline.some(
      (ev) =>
        /** @type {Record<string, unknown>} */ (ev).event_type ===
        "approval_granted"
    ) || Boolean(args.approvalRecord);
  if (!hasApproval) blockers.push("approval_snapshot_missing");
  else preconditions.push("approval_event_present");

  const changeType = String(payload.change_type || payload.last_decision || "unknown");
  if (changeType === "unknown" || changeType === "") {
    warnings.push("optional_change_type_missing");
  }

  const estimatedRisk = String(
    payload.estimated_risk || payload.risk || "unknown"
  );
  if (estimatedRisk === "high") {
    warnings.push("high_estimated_impact");
    warnings.push("manual_verification_recommended");
  }

  const changedFields = Array.isArray(payload.changed_fields)
    ? payload.changed_fields.map((x) => String(x)).slice(0, 32)
    : [];
  if (changedFields.length > 20) {
    warnings.push("large_change_count");
  }

  // Soft budget: hard block only if explicit exceeded flag
  if (payload.budget_exceeded === true) {
    blockers.push("BUDGET_BLOCKED");
  } else {
    preconditions.push("budget_within_hard_cap");
  }

  if (payload.unsupported_operation === true) {
    blockers.push("UNSUPPORTED_OPERATION");
  }

  const operations = Object.freeze([
    Object.freeze({
      step: "validate_target",
      target_resource: `${resourceType}:${resourceId}`,
      operation_type: "validate",
      provider_requirement: "none",
      external_side_effect: "none",
      reversibility: "n_a",
    }),
    Object.freeze({
      step: "preview_change",
      target_resource: `${resourceType}:${resourceId}`,
      operation_type: "preview",
      provider_requirement: "none",
      external_side_effect: "none",
      reversibility: "n_a",
    }),
    Object.freeze({
      step: "apply_change",
      target_resource: `${resourceType}:${resourceId}`,
      operation_type: "apply_planned_only",
      provider_requirement: "deferred_not_executed",
      external_side_effect: "none_in_dry_run",
      reversibility: "unknown_until_apply",
    }),
    Object.freeze({
      step: "verify_result",
      target_resource: `${resourceType}:${resourceId}`,
      operation_type: "verify",
      provider_requirement: "none",
      external_side_effect: "none",
      reversibility: "n_a",
    }),
  ]);

  const proposalHash =
    hashValue({
      proposal_id: prop.proposal_id,
      status,
      capability,
      resource_type: resourceType,
      resource_id: resourceId,
      record_version: prop.record_version,
      payload,
    }) || "missing_proposal_hash";

  const approvalHash =
    hashValue({
      approval_present: hasApproval,
      approval_payload: args.approvalRecord?.payload || null,
      approval_events: timeline
        .filter(
          (ev) =>
            /** @type {Record<string, unknown>} */ (ev).event_type ===
            "approval_granted"
        )
        .map((ev) => ({
          sequence_number: /** @type {Record<string, unknown>} */ (ev)
            .sequence_number,
          event_hash: /** @type {Record<string, unknown>} */ (ev).event_hash,
        })),
    }) || "missing_approval_hash";

  const uniqueBlockers = [...new Set(blockers)].sort();
  const uniqueWarnings = [...new Set(warnings)].sort();
  const uniquePreconditions = [...new Set(preconditions)].sort();
  const planStatus =
    uniqueBlockers.length > 0
      ? APPLY_PLAN_STATUSES.BLOCKED
      : APPLY_PLAN_STATUSES.READY;

  const fingerprint = buildApplyPlanFingerprint({
    environment: "staging",
    tenant: "ops_global",
    requestId: String(prop.proposal_id || ""),
    sourceVersion: Number(prop.record_version || 0),
    proposalHash,
    approvalHash,
    capability,
    budgetPolicyVersion: APPLY_PLAN_POLICY_VERSION,
    operations,
    preconditions: uniquePreconditions,
    warnings: uniqueWarnings,
    blockers: uniqueBlockers,
  });

  const normalized = deepFreeze({
    schema_version: APPLY_PLAN_SCHEMA,
    mode: "dry_run",
    status: planStatus,
    requestId: String(prop.proposal_id || ""),
    sourceVersion: Number(prop.record_version || 0),
    operations,
    preconditions: uniquePreconditions,
    warnings: uniqueWarnings,
    blockers: uniqueBlockers,
    estimatedImpact: Object.freeze({
      risk: estimatedRisk,
      changed_field_count: changedFields.length,
      cost_category: "unknown_dry_run",
    }),
    beforeSummary: Object.freeze({
      resource: `${resourceType}:${resourceId}`,
      status: "approved_source",
    }),
    afterSummary: Object.freeze({
      planned: true,
      applied: false,
      note: "dry_run_only",
    }),
    changedFields,
    unchangedFields: Object.freeze(["status_remains_approved"]),
    requiredCapability: capability,
    budgetCeiling: APPLY_PLAN_POLICY_VERSION,
    riskLevel: estimatedRisk,
    reversibilityClassification: "deferred",
    providerRequirement: "none_for_dry_run",
    externalSideEffectClassification: "none",
    applyExecuted: false,
    providerExecuted: false,
  });

  return {
    ok: true,
    planStatus,
    normalized,
    fingerprint: fingerprint || "fingerprint_failed",
    proposalHash,
    approvalHash,
    capability,
    warningCount: uniqueWarnings.length,
    blockerCount: uniqueBlockers.length,
    eventType:
      planStatus === APPLY_PLAN_STATUSES.BLOCKED
        ? "apply_plan_blocked"
        : "apply_plan_created",
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
export async function createApplyPlan(args) {
  const envCheck = assertApplyPlanEnvironment(args.env);
  if (!envCheck.ok) return envCheck;

  const validated = validateApplyPlanInput(args.body);
  if (!validated.ok) return validated;
  const input = validated.value;

  if (args.proposalIdFromPath) {
    const pathId = normalizeUuid(args.proposalIdFromPath);
    if (!pathId || pathId !== input.requestId) {
      return { ok: false, error: APPLY_PLAN_ERRORS.INVALID_UUID, http: 400 };
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
    const code = normalizeApplyPlanError(rowRes.error || "not_found");
    return { ok: false, error: code, code, http: applyPlanErrorHttp(code) };
  }
  const proposal = /** @type {Record<string, unknown>} */ (rowRes.value);
  if (Number(proposal.record_version) !== input.expectedVersion) {
    return {
      ok: false,
      error: APPLY_PLAN_ERRORS.VERSION_CONFLICT,
      code: APPLY_PLAN_ERRORS.VERSION_CONFLICT,
      http: 409,
      current_version: proposal.record_version,
      current_status: proposal.status,
    };
  }
  if (String(proposal.status) !== "approved") {
    return {
      ok: false,
      error: APPLY_PLAN_ERRORS.INVALID_STATUS,
      code: APPLY_PLAN_ERRORS.INVALID_STATUS,
      http: 400,
      current_status: proposal.status,
    };
  }

  const timeline = await repo.getAuditTimeline(input.requestId);
  const records = await repo.listByProposal(input.requestId);
  const approvalRecord =
    Array.isArray(records) &&
    records.find((r) => r.record_type === "approval")
      ? /** @type {Record<string, unknown>} */ (
          records.find((r) => r.record_type === "approval")
        )
      : null;

  const computed = computeDryRunPlan({
    proposal,
    timeline: Array.isArray(timeline) ? timeline : [],
    approvalRecord,
  });
  if (!computed.ok) {
    return { ok: false, error: APPLY_PLAN_ERRORS.INVALID_CONTEXT, http: 400 };
  }

  const result = await repo.persistApplyPlan({
    proposalId: input.requestId,
    expectedVersion: input.expectedVersion,
    idempotencyKey: buildApplyPlanIdempotencyKey({
      environment: envCheck.environment,
      actorId,
      requestId: input.requestId,
      idempotencyKey: input.idempotencyKey,
    }),
    payloadHash: input.payloadHash,
    actorId,
    mode: input.mode,
    status: computed.planStatus,
    fingerprint: computed.fingerprint,
    proposalHash: computed.proposalHash,
    approvalHash: computed.approvalHash,
    capabilitySnapshot: computed.capability,
    budgetSnapshot: APPLY_PLAN_POLICY_VERSION,
    warningCount: computed.warningCount,
    blockerCount: computed.blockerCount,
    normalizedPlan: /** @type {Record<string, unknown>} */ (
      computed.normalized
    ),
    eventType: computed.eventType,
  });

  if (!result.ok) {
    const code = normalizeApplyPlanError(result.error || result.code || "");
    return {
      ok: false,
      error: code,
      code,
      http: applyPlanErrorHttp(code),
      current_status: result.current_status,
      current_version: result.current_version,
    };
  }

  return {
    ok: true,
    http: 200,
    body: {
      ok: true,
      schema_version: APPLY_PLAN_HTTP_SCHEMA,
      requestId: result.requestId,
      planId: result.planId,
      mode: "dry_run",
      sourceVersion: result.sourceVersion,
      status: result.status,
      operations: result.operations,
      preconditions: result.preconditions,
      warnings: result.warnings,
      blockers: result.blockers,
      estimatedImpact: result.estimatedImpact,
      fingerprint: result.fingerprint,
      replayed: Boolean(result.replayed),
      createdAt: result.createdAt,
      applyExecuted: false,
      providerExecuted: false,
      requestStatus: result.requestStatus || "approved",
      environment: "staging",
      apply: "NOT_EXECUTED",
    },
  };
}

/**
 * @param {{ env: Record<string, unknown>, proposalId: string, planId?: string, fetchImpl?: typeof fetch }} args
 */
export async function getApplyPlans(args) {
  const envCheck = assertApplyPlanEnvironment(args.env);
  if (!envCheck.ok) {
    // Allow read when persistence enabled even if write gate used — reuse read if needed
    const cfg = pickDiffApprovePersistenceEnv(args.env);
    if (!cfg.readEnabled) return envCheck;
  }
  const id = normalizeUuid(args.proposalId);
  if (!id) return { ok: false, error: APPLY_PLAN_ERRORS.INVALID_UUID, http: 400 };
  const repo = createPersistentRepository({
    env: args.env,
    fetchImpl: args.fetchImpl,
  });
  if (args.planId) {
    const one = await repo.getApplyPlan(id, args.planId);
    if (!one.ok) {
      return {
        ok: false,
        error: normalizeApplyPlanError(one.error || "not_found"),
        http: one.error === "not_found" ? 404 : 400,
      };
    }
    return {
      ok: true,
      http: 200,
      body: { ok: true, plan: one.value, applyExecuted: false, providerExecuted: false },
    };
  }
  const list = await repo.listApplyPlans(id);
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

export { buildAuditEventHashes, computeDryRunPlan as buildPlanForTests };
