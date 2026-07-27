/**
 * AI Execution Gate — Phase B3 create / execute-stub / get orchestration.
 * No DeepSeek · no collector · no results writes · no child executions.
 */

import {
  PHASE_B3_FIXED_REQUEST_ESTIMATE_USD,
  GATE_EVENT_TYPES,
  budgetDayKeyJst,
  buildCreateFingerprint,
  evaluateCreateGatePolicy,
  sha256Hex,
  stableStringify,
  validateCreateBody,
} from "./ai-exec-gate-policy.mjs";
import {
  findRequestById,
  findRequestByIdempotencyKey,
  insertExecutionEvent,
  insertExecutionRequest,
  listEventsForExecution,
  pickGateDbEnv,
  sumDayEstimatedAllowed,
  updateExecutionRequest,
} from "./ai-exec-gate-repository.mjs";
import { PHASE_B_CAPABILITY_VERSION } from "./ai-exec-gate-capabilities.mjs";

function newId() {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
  } catch {
    /* fallthrough */
  }
  return `corr_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Public create response (no secrets / no cap value).
 * @param {Record<string, unknown>} row
 * @param {{ idempotentReplay?: boolean, auditIncomplete?: boolean }} [extra]
 */
export function mapCreateResponse(row, extra = {}) {
  const decision = row.preflight_decision || null;
  const blocked = decision === "blocked";
  const body = {
    ok: !blocked && !extra.auditIncomplete,
    execution_id: row.id,
    decision,
    status: row.execution_status,
    reason: blocked ? row.blocked_reason || null : null,
    idempotent_replay: Boolean(extra.idempotentReplay),
    correlation_id: row.correlation_id || null,
  };
  if (extra.auditIncomplete) {
    body.error = "event_persist_failed";
    body.audit_incomplete = true;
  }
  return body;
}

/**
 * @param {Record<string, unknown>} row
 * @param {unknown[]} [events]
 */
export function mapGetResponse(row, events = []) {
  const stubTouched = (events || []).some(
    (e) =>
      e?.event_type === GATE_EVENT_TYPES.EXECUTE_STUB_ACCEPTED ||
      e?.event_type === GATE_EVENT_TYPES.EXECUTE_STUB_COMPLETED
  );
  return {
    ok: true,
    execution_id: row.id,
    decision: row.preflight_decision || null,
    status: row.execution_status,
    reason: row.blocked_reason || null,
    action_type: row.action_type,
    target_service: row.target_service,
    capability_key: row.capability_key,
    correlation_id: row.correlation_id || null,
    parent_execution_id: row.parent_execution_id,
    created_at: row.created_at,
    /** Phase B4 pipeline flag when stub events exist (legacy B3) or succeeded with result */
    stub: stubTouched,
    pipeline_invoked: !stubTouched && row.execution_status === "succeeded",
    provider_called: false,
    events: (events || []).map((e) => ({
      sequence_number: e.sequence_number,
      event_type: e.event_type,
      decision: e.decision,
      blocked_reason: e.blocked_reason,
      created_at: e.created_at,
    })),
  };
}

/**
 * Compare stored fingerprint vs current create fingerprint.
 * @param {Record<string, unknown>} existing
 * @param {string} payloadHash
 */
export function isIdempotencyPayloadMatch(existing, payloadHash) {
  return String(existing.payload_hash || "") === String(payloadHash || "");
}

/**
 * @param {{
 *   env: Record<string, unknown>,
 *   body: unknown,
 *   userId: string,
 *   fetchImpl?: typeof fetch,
 * }} input
 */
export async function createGateExecution(input) {
  const validated = validateCreateBody(input.body);
  if (!validated.ok) {
    return {
      ok: false,
      http: 400,
      error: validated.error,
      persist: false,
    };
  }

  const cfg = {
    ...pickGateDbEnv(input.env),
    fetchImpl: input.fetchImpl,
  };
  if (!cfg.url || !cfg.serviceRoleKey) {
    return {
      ok: false,
      http: 503,
      error: "db_unavailable",
      persist: false,
    };
  }

  const fingerprint = buildCreateFingerprint({
    actionType: validated.actionType,
    targetService: validated.targetService,
    capabilities: validated.capabilities,
    ports: validated.ports,
  });
  const payloadHash = await sha256Hex(stableStringify(fingerprint));
  const dayKey = budgetDayKeyJst();
  const correlationId = validated.correlationId || newId();

  let daySpent = 0;
  try {
    daySpent = await sumDayEstimatedAllowed(cfg, dayKey);
  } catch {
    return { ok: false, http: 503, error: "db_unavailable", persist: false };
  }

  const policy = evaluateCreateGatePolicy({
    env: input.env,
    capabilityKey: validated.capabilityKey,
    actionType: validated.actionType,
    targetService: validated.targetService,
    executorPort: validated.ports[0],
    daySpentSoFar: daySpent,
    estimatedApiCost: PHASE_B3_FIXED_REQUEST_ESTIMATE_USD,
  });

  const blocked = policy.decision === "blocked";
  const status = blocked ? "blocked" : "queued";
  const blockedReason = blocked ? policy.reason : null;

  const actionPayload = {
    capabilities: validated.capabilities,
    requested_ports: validated.ports,
  };

  const row = {
    environment: policy.snapshots.environment,
    target_service: validated.targetService,
    action_type: validated.actionType,
    capability_key: validated.capabilityKey,
    capability_version: PHASE_B_CAPABILITY_VERSION,
    action_payload: actionPayload,
    payload_hash: payloadHash,
    sanitized_metadata: {
      ...validated.metadata,
      capabilities: validated.capabilities,
      requested_ports: validated.ports,
    },
    risk_level: "LOW",
    business_priority: "NORMAL",
    execution_mode: "AUTO",
    execution_status: status,
    preflight_decision: policy.decision,
    blocked_reason: blockedReason,
    estimated_api_cost: policy.snapshots.estimatedApiCost,
    recorded_api_cost: null,
    budget_limit_snapshot: policy.snapshots.budgetLimitSnapshot,
    budget_currency: "USD",
    budget_day_key: dayKey,
    feature_flag_key: policy.snapshots.featureFlagKey,
    feature_flag_state: policy.snapshots.featureFlagState,
    feature_flag_enabled: policy.snapshots.featureFlagEnabled,
    emergency_stop_active: policy.snapshots.emergencyStopActive,
    emergency_stop_snapshot: {
      active: policy.snapshots.emergencyStopActive,
    },
    policy_version: "phase_b3",
    idempotency_key: validated.idempotencyKey,
    correlation_id: correlationId,
    parent_execution_id: null,
    actor_type: "human",
    actor_id: input.userId,
    initiator_type: "human",
    initiator_id: input.userId,
    // user_id FK → auth.users; identity is actor_id (JWT subject). Avoid FK fail on probes.
    user_id: null,
    execution_attempts: 0,
    max_attempts: 1,
    executor_name: null,
    blocked_at: blocked ? new Date().toISOString() : null,
  };

  let inserted;
  try {
    const result = await insertExecutionRequest(cfg, row);
    if (!result.ok && result.conflict) {
      const existing = await findRequestByIdempotencyKey(
        cfg,
        validated.idempotencyKey
      );
      if (!existing) {
        return { ok: false, http: 503, error: "db_unavailable", persist: false };
      }
      if (!isIdempotencyPayloadMatch(existing, payloadHash)) {
        return {
          ok: false,
          http: 409,
          error: "idempotency_conflict",
          persist: false,
        };
      }
      return {
        ok: true,
        http: 200,
        body: mapCreateResponse(existing, { idempotentReplay: true }),
        persist: false,
        replay: true,
      };
    }
    inserted = result.row;
  } catch {
    return { ok: false, http: 503, error: "db_unavailable", persist: false };
  }

  // Required audit events — failure must not look like a clean success
  try {
    await insertExecutionEvent(cfg, {
      execution_id: inserted.id,
      sequence_number: 1,
      event_type: GATE_EVENT_TYPES.REQUEST_RECEIVED,
      capability_key: validated.capabilityKey,
      sanitized_metadata: {},
    });
    await insertExecutionEvent(cfg, {
      execution_id: inserted.id,
      sequence_number: 2,
      event_type: GATE_EVENT_TYPES.GATE_EVALUATED,
      capability_key: validated.capabilityKey,
      decision: policy.decision,
      blocked_reason: blockedReason,
      next_status: status,
      sanitized_metadata: {},
    });
    await insertExecutionEvent(cfg, {
      execution_id: inserted.id,
      sequence_number: 3,
      event_type: blocked
        ? GATE_EVENT_TYPES.REQUEST_BLOCKED
        : GATE_EVENT_TYPES.REQUEST_ALLOWED,
      capability_key: validated.capabilityKey,
      decision: policy.decision,
      blocked_reason: blockedReason,
      next_status: status,
      sanitized_metadata: {},
    });
  } catch {
    console.error("[ai-exec-gate] event_persist_failed", {
      code: "event_persist_failed",
      execution_id: inserted.id,
      correlation_id: correlationId,
      decision: policy.decision,
      status,
    });
    return {
      ok: false,
      http: 500,
      error: "event_persist_failed",
      body: mapCreateResponse(inserted, {
        idempotentReplay: false,
        auditIncomplete: true,
      }),
      persist: true,
      replay: false,
      auditIncomplete: true,
    };
  }

  return {
    ok: true,
    http: blocked ? 200 : 201,
    body: mapCreateResponse(inserted, { idempotentReplay: false }),
    persist: true,
    replay: false,
  };
}

/**
 * Execute stub — Phase B3 only.
 * No executor invocation · No provider call · No external side effect · No results row.
 * Leaves status at `queued` so B4 can run the real pipeline.
 * @param {{
 *   env: Record<string, unknown>,
 *   executionId: string,
 *   userId: string,
 *   fetchImpl?: typeof fetch,
 * }} input
 */
export async function executeGateStub(input) {
  const cfg = {
    ...pickGateDbEnv(input.env),
    fetchImpl: input.fetchImpl,
  };
  if (!cfg.url || !cfg.serviceRoleKey) {
    return { ok: false, http: 503, error: "db_unavailable" };
  }
  const id = String(input.executionId || "").trim();
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id
    )
  ) {
    return { ok: false, http: 400, error: "invalid_request" };
  }

  let row;
  try {
    row = await findRequestById(cfg, id);
  } catch {
    return { ok: false, http: 503, error: "db_unavailable" };
  }
  if (!row) {
    return { ok: false, http: 404, error: "not_found" };
  }
  if (String(row.actor_id) !== String(input.userId)) {
    return { ok: false, http: 403, error: "forbidden" };
  }
  if (
    row.preflight_decision === "blocked" ||
    row.execution_status === "blocked"
  ) {
    return {
      ok: false,
      http: 409,
      error: "execution_blocked",
      body: {
        ok: false,
        execution_id: row.id,
        decision: "blocked",
        status: row.execution_status,
        reason: row.blocked_reason || null,
        stub: true,
        pipeline_invoked: false,
        provider_called: false,
      },
    };
  }
  if (row.execution_status !== "queued" && row.execution_status !== "draft") {
    return { ok: false, http: 409, error: "invalid_status_transition" };
  }

  try {
    const events = await listEventsForExecution(cfg, row.id);
    const alreadyStubbed = events.some(
      (e) => e.event_type === GATE_EVENT_TYPES.EXECUTE_STUB_ACCEPTED
    );
    if (alreadyStubbed) {
      return {
        ok: true,
        http: 200,
        body: {
          ok: true,
          execution_id: row.id,
          decision: row.preflight_decision,
          status: row.execution_status,
          stub: true,
          pipeline_invoked: false,
          provider_called: false,
          external_side_effect: false,
          idempotent_replay: true,
          note: "Phase B3 stub only · No executor invocation",
        },
      };
    }

    const nextSeq =
      events.reduce((m, e) => Math.max(m, Number(e.sequence_number) || 0), 0) +
      1;
    const nextStatus =
      row.execution_status === "draft" ? "queued" : row.execution_status;

    await insertExecutionEvent(cfg, {
      execution_id: row.id,
      sequence_number: nextSeq,
      event_type: GATE_EVENT_TYPES.EXECUTE_STUB_ACCEPTED,
      previous_status: row.execution_status,
      next_status: nextStatus,
      sanitized_metadata: {
        stub: true,
        pipeline_invoked: false,
        provider_called: false,
        note: "Phase B3 stub only · No executor · No provider · No external side effect",
      },
    });

    if (row.execution_status === "draft") {
      await updateExecutionRequest(cfg, row.id, {
        execution_status: "queued",
        queued_at: new Date().toISOString(),
      });
    }
  } catch {
    return { ok: false, http: 503, error: "db_unavailable" };
  }

  return {
    ok: true,
    http: 200,
    body: {
      ok: true,
      execution_id: row.id,
      decision: "allowed",
      status: "queued",
      stub: true,
      pipeline_invoked: false,
      provider_called: false,
      external_side_effect: false,
      idempotent_replay: false,
      note: "Phase B3 stub only · No executor invocation · Awaiting B4",
    },
  };
}

/**
 * @param {{
 *   env: Record<string, unknown>,
 *   executionId: string,
 *   userId: string,
 *   fetchImpl?: typeof fetch,
 * }} input
 */
export async function getGateExecution(input) {
  const cfg = {
    ...pickGateDbEnv(input.env),
    fetchImpl: input.fetchImpl,
  };
  if (!cfg.url || !cfg.serviceRoleKey) {
    return { ok: false, http: 503, error: "db_unavailable" };
  }
  const id = String(input.executionId || "").trim();
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id
    )
  ) {
    return { ok: false, http: 400, error: "invalid_request" };
  }
  let row;
  let events;
  try {
    row = await findRequestById(cfg, id);
    if (!row) return { ok: false, http: 404, error: "not_found" };
    if (String(row.actor_id) !== String(input.userId)) {
      return { ok: false, http: 403, error: "forbidden" };
    }
    events = await listEventsForExecution(cfg, id);
  } catch {
    return { ok: false, http: 503, error: "db_unavailable" };
  }
  return {
    ok: true,
    http: 200,
    body: mapGetResponse(row, events),
  };
}
