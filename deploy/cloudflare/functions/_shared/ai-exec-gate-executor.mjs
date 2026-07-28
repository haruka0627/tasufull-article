/**
 * AI Execution Gate — Phase B4 pipeline executor.
 * ops_collector → secretary_deepseek (deterministic) → gate_audit_writer (result persist)
 * No DeepSeek / OpenAI / Gemini / Claude / external HTTP / Cron / Worker.
 */

import {
  PHASE_B_ACTION_TYPE,
  PHASE_B_TARGET_SERVICE,
} from "./ai-exec-gate-capabilities.mjs";
import {
  EXECUTOR_FAILURE_CODES,
  GATE_EVENT_TYPES,
  PHASE_B4_EXECUTOR_TIMEOUT_MS,
  PHASE_B_PIPELINE_CAPABILITIES,
  PHASE_B_PIPELINE_PORTS,
  detectGateEnvironment,
} from "./ai-exec-gate-policy.mjs";
import { GATE_ENVIRONMENTS } from "./ai-exec-gate-types.mjs";
import {
  collectDailyOpsC1,
  generateOpsReportC1,
} from "./ai-exec-gate-c1-pipeline.mjs";
import {
  evaluatePhaseC3BudgetGuard,
  sanitizeBudgetDecisionForResponse,
} from "./ai-exec-gate-c3-budget.mjs";
import {
  PHASE_C4_DEFAULT_PROVIDER_ID,
  prepareProviderNeutralRequest,
  resolveProviderAdapter,
  sanitizeProviderResolveMetadata,
  validateProviderIdentifier,
} from "./ai-exec-gate-c4-provider.mjs";
import {
  buildExecutionPlan,
  dispatchExecutionPlan,
  sanitizeExecutionBoundaryMetadata,
} from "./ai-exec-gate-c5-execution-boundary.mjs";
import {
  buildInvocationContext,
  evaluateInvocationGate,
  sanitizeInvocationAuditMetadata,
} from "./ai-exec-gate-c6-invocation-gate.mjs";
import {
  createSafe07UsageSnapshotReader,
  sanitizeUsageSnapshotEventMetadata,
  usageSnapshotToBudgetInput,
} from "./ai-exec-gate-c7-usage-snapshot.mjs";
import {
  appendExecutionEvent,
  claimQueuedExecution,
  findExecutionResult,
  findRequestById,
  insertExecutionResult,
  nextEventSequence,
  pickGateDbEnv,
  rpcAiCostLedgerAggregate,
  transitionExecutionStatus,
} from "./ai-exec-gate-repository.mjs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function fail(http, error, extra = {}) {
  return {
    ok: false,
    http,
    error,
    body: {
      ok: false,
      error,
      ...extra,
    },
  };
}

function logOrphan(executionId, code, detail) {
  console.error("[ai-exec-gate-executor] running_orphan_risk", {
    code,
    execution_id: executionId,
    detail: detail || null,
  });
}

/**
 * Validate queued allowed execution contract (fail closed).
 * @param {Record<string, unknown>} row
 * @param {Record<string, unknown>} env
 */
export function validateExecutableContract(row, env) {
  if (!row) return EXECUTOR_FAILURE_CODES.EXECUTION_NOT_FOUND;
  if (row.parent_execution_id != null) {
    return EXECUTOR_FAILURE_CODES.INVALID_EXECUTION_CONTRACT;
  }
  if (row.preflight_decision !== "allowed") {
    return EXECUTOR_FAILURE_CODES.EXECUTION_NOT_ALLOWED;
  }
  if (row.execution_status === "succeeded") {
    return EXECUTOR_FAILURE_CODES.EXECUTION_ALREADY_COMPLETED;
  }
  if (row.execution_status === "failed") {
    return EXECUTOR_FAILURE_CODES.EXECUTION_FAILED_TERMINAL;
  }
  if (row.execution_status === "running") {
    return EXECUTOR_FAILURE_CODES.EXECUTION_ALREADY_CLAIMED;
  }
  if (row.execution_status !== "queued") {
    return EXECUTOR_FAILURE_CODES.EXECUTION_NOT_QUEUED;
  }
  if (row.action_type !== PHASE_B_ACTION_TYPE) {
    return EXECUTOR_FAILURE_CODES.INVALID_EXECUTION_CONTRACT;
  }
  if (row.target_service !== PHASE_B_TARGET_SERVICE) {
    return EXECUTOR_FAILURE_CODES.INVALID_EXECUTION_CONTRACT;
  }
  if (row.capability_key !== PHASE_B_PIPELINE_CAPABILITIES[0]) {
    return EXECUTOR_FAILURE_CODES.INVALID_EXECUTION_CONTRACT;
  }
  if (row.environment !== "staging") {
    return EXECUTOR_FAILURE_CODES.INVALID_EXECUTION_CONTRACT;
  }
  if (row.feature_flag_enabled !== true) {
    return EXECUTOR_FAILURE_CODES.INVALID_EXECUTION_CONTRACT;
  }
  if (row.emergency_stop_active === true) {
    return EXECUTOR_FAILURE_CODES.INVALID_EXECUTION_CONTRACT;
  }
  if (detectGateEnvironment(env) !== GATE_ENVIRONMENTS.STAGING) {
    return EXECUTOR_FAILURE_CODES.INVALID_EXECUTION_CONTRACT;
  }
  if (!row.idempotency_key || !row.payload_hash) {
    return EXECUTOR_FAILURE_CODES.INVALID_EXECUTION_CONTRACT;
  }
  return null;
}

async function emit(cfg, executionId, seq, partial) {
  return appendExecutionEvent(cfg, {
    execution_id: executionId,
    sequence_number: seq,
    sanitized_metadata: {},
    ...partial,
  });
}

/**
 * Mark failed from running. Never overwrites an existing result row.
 * @returns {{ seq: number, statusFailed: boolean, orphanRisk: boolean }}
 */
async function failRunning(cfg, row, code, seqStart) {
  let seq = seqStart;
  let statusFailed = false;
  const stepFailedType =
    code === EXECUTOR_FAILURE_CODES.COLLECTOR_FAILED
      ? GATE_EVENT_TYPES.STEP_COLLECT_FAILED
      : code === EXECUTOR_FAILURE_CODES.REPORT_GENERATION_FAILED
        ? GATE_EVENT_TYPES.STEP_REPORT_FAILED
        : null;
  if (stepFailedType) {
    try {
      await emit(cfg, row.id, seq, {
        event_type: stepFailedType,
        previous_status: "running",
        next_status: "running",
        capability_key: row.capability_key,
        reason_code: code,
        sanitized_metadata: { failure_code: code },
      });
      seq += 1;
    } catch {
      /* continue */
    }
  }
  try {
    await emit(cfg, row.id, seq, {
      event_type: GATE_EVENT_TYPES.EXECUTION_FAILED,
      previous_status: "running",
      next_status: "failed",
      capability_key: row.capability_key,
      reason_code: code,
      sanitized_metadata: { failure_code: code },
    });
    seq += 1;
  } catch {
    /* continue */
  }

  // Insert failure result only if none exists — never PATCH overwrite
  try {
    const existing = await findExecutionResult(cfg, row.id);
    if (!existing) {
      await insertExecutionResult(cfg, {
        execution_id: row.id,
        output_type: "ops_report_failure",
        sanitized_summary: `Execution failed: ${code}`.slice(0, 8000),
        metrics: {
          failure_code: code,
          provider_called: false,
          recorded_api_cost: 0,
        },
        error_code: String(code).slice(0, 128),
        retryable: false,
        completed_at: new Date().toISOString(),
      });
    }
  } catch {
    /* continue */
  }

  try {
    const transitioned = await transitionExecutionStatus(cfg, row.id, "running", {
      execution_status: "failed",
      failed_at: new Date().toISOString(),
      recorded_api_cost: 0,
    });
    statusFailed = Boolean(transitioned.ok);
    if (!transitioned.ok) {
      logOrphan(row.id, "failed_transition_miss", code);
    }
  } catch (e) {
    logOrphan(row.id, "failed_transition_exception", code);
  }

  return { seq, statusFailed, orphanRisk: !statusFailed };
}

/**
 * @param {{
 *   env: Record<string, unknown>,
 *   executionId: string,
 *   userId: string,
 *   fetchImpl?: typeof fetch,
 *   now?: Date,
 *   collectFn?: Function,
 *   reportFn?: Function,
 *   budgetUsage?: { current_usage?: number, budget_limit?: number },
 *   usageSnapshotReader?: { readUsageSnapshot: Function },
 *   providerId?: string,
 * }} input
 *
 * Note (C7): `budgetUsage` is ignored on the execute path (no request override /
 * silent default 0). Tests must inject `usageSnapshotReader`. Runtime uses
 * SAFE-07 `ai_cost_ledger_aggregate` via `rpcAiCostLedgerAggregate`.
 */
export async function executeGatePipeline(input) {
  // Phase C1: official purpose routes to sanitized collector + deterministic adapter.
  // Inject collectFn/reportFn to force B4 fixtures or test doubles. B4 modules remain.
  const collectFn =
    typeof input.collectFn === "function" ? input.collectFn : collectDailyOpsC1;
  const reportFn =
    typeof input.reportFn === "function" ? input.reportFn : generateOpsReportC1;
  const id = String(input.executionId || "").trim();
  if (!UUID_RE.test(id)) {
    return fail(400, "invalid_request");
  }

  const cfg = {
    ...pickGateDbEnv(input.env),
    fetchImpl: input.fetchImpl,
  };
  if (!cfg.url || !cfg.serviceRoleKey) {
    return fail(503, "db_unavailable");
  }

  if (detectGateEnvironment(input.env) !== GATE_ENVIRONMENTS.STAGING) {
    return fail(403, EXECUTOR_FAILURE_CODES.INVALID_EXECUTION_CONTRACT);
  }

  let row;
  try {
    row = await findRequestById(cfg, id);
  } catch {
    return fail(503, "db_unavailable");
  }
  if (!row) {
    return fail(404, EXECUTOR_FAILURE_CODES.EXECUTION_NOT_FOUND);
  }
  if (String(row.actor_id) !== String(input.userId)) {
    return fail(403, EXECUTOR_FAILURE_CODES.FORBIDDEN);
  }

  if (row.execution_status === "succeeded") {
    let result = null;
    try {
      result = await findExecutionResult(cfg, id);
    } catch {
      /* ignore */
    }
    return {
      ok: true,
      http: 200,
      body: {
        ok: true,
        execution_id: id,
        decision: row.preflight_decision,
        status: "succeeded",
        idempotent_replay: true,
        provider_called: false,
        pipeline_invoked: true,
        result_present: Boolean(result),
      },
    };
  }

  const contractError = validateExecutableContract(row, input.env);
  if (contractError) {
    const http =
      contractError === EXECUTOR_FAILURE_CODES.EXECUTION_ALREADY_CLAIMED ||
      contractError === EXECUTOR_FAILURE_CODES.EXECUTION_NOT_QUEUED ||
      contractError === EXECUTOR_FAILURE_CODES.EXECUTION_FAILED_TERMINAL ||
      contractError === EXECUTOR_FAILURE_CODES.EXECUTION_NOT_ALLOWED
        ? 409
        : 400;
    return fail(http, contractError, {
      execution_id: id,
      status: row.execution_status,
      decision: row.preflight_decision,
    });
  }

  // Phase C7 — Authoritative SAFE-07 usage snapshot (before C3 budget · before claim)
  // No request/env/dashboard override. No silent default 0.
  // Test-only: inject usageSnapshotReader. Runtime: SAFE-07 RPC via repository.
  const usageReader =
    input.usageSnapshotReader &&
    typeof input.usageSnapshotReader.readUsageSnapshot === "function"
      ? input.usageSnapshotReader
      : createSafe07UsageSnapshotReader({
          rpcAggregate: (params) =>
            rpcAiCostLedgerAggregate(
              { ...cfg, fetchImpl: input.fetchImpl },
              params
            ),
        });

  let usageOutcome;
  try {
    usageOutcome = await usageReader.readUsageSnapshot({
      actor_id: row.actor_id,
      environment: row.environment,
      budget_day_key: row.budget_day_key,
      snapshot_at: new Date().toISOString(),
    });
  } catch {
    usageOutcome = {
      ok: false,
      availability: "read_failure",
      reason: "usage_read_failed",
      provider_called: false,
      recorded_api_cost: 0,
    };
  }

  const usageMeta = sanitizeUsageSnapshotEventMetadata(usageOutcome);
  if (
    !usageOutcome ||
    usageOutcome.ok !== true ||
    usageOutcome.availability !== "available" ||
    !usageOutcome.snapshot
  ) {
    return fail(403, EXECUTOR_FAILURE_CODES.USAGE_SNAPSHOT_UNAVAILABLE, {
      execution_id: id,
      decision: "blocked",
      status: row.execution_status,
      provider_called: false,
      recorded_api_cost: 0,
      usage: usageMeta,
    });
  }

  const budgetInput = usageSnapshotToBudgetInput(usageOutcome.snapshot);
  if (!budgetInput.ok) {
    return fail(403, EXECUTOR_FAILURE_CODES.USAGE_SNAPSHOT_UNAVAILABLE, {
      execution_id: id,
      decision: "blocked",
      status: row.execution_status,
      provider_called: false,
      recorded_api_cost: 0,
      usage: usageMeta,
    });
  }

  // Phase C3 — Budget Guard (code-constant hard cap · reuse C3 decision · before claim)
  const budgetEval = evaluatePhaseC3BudgetGuard({
    current_usage: budgetInput.current_usage,
  });
  if (!budgetEval.ok) {
    return fail(400, EXECUTOR_FAILURE_CODES.INVALID_EXECUTION_CONTRACT, {
      execution_id: id,
      budget_error: budgetEval.error,
      usage: usageMeta,
    });
  }
  const budgetDecision = budgetEval.decision;
  const budgetPublic = sanitizeBudgetDecisionForResponse(budgetDecision);
  if (budgetDecision.blocked) {
    return fail(403, EXECUTOR_FAILURE_CODES.BUDGET_HARD_CAP, {
      execution_id: id,
      decision: "blocked",
      status: row.execution_status,
      provider_called: false,
      recorded_api_cost: 0,
      budget: budgetPublic,
      usage: usageMeta,
    });
  }

  // Phase C4 — Provider identifier + resolve (NoOp only · before claim · no execute)
  // Code-constant default; optional inject for tests must still be allowlisted (no silent alias).
  const providerIdRaw =
    input.providerId === undefined
      ? PHASE_C4_DEFAULT_PROVIDER_ID
      : input.providerId;
  const providerIdCheck = validateProviderIdentifier(providerIdRaw);
  if (!providerIdCheck.ok) {
    return fail(400, EXECUTOR_FAILURE_CODES.UNKNOWN_PROVIDER, {
      execution_id: id,
      decision: "blocked",
      status: row.execution_status,
      provider_called: false,
      recorded_api_cost: 0,
      budget: budgetPublic,
      provider_error: providerIdCheck.error,
    });
  }
  const providerResolved = resolveProviderAdapter(providerIdCheck.value);
  if (!providerResolved.ok) {
    return fail(400, EXECUTOR_FAILURE_CODES.PROVIDER_RESOLVE_FAILED, {
      execution_id: id,
      decision: "blocked",
      status: row.execution_status,
      provider_called: false,
      recorded_api_cost: 0,
      budget: budgetPublic,
      provider_error: providerResolved.error,
    });
  }
  const providerMeta = sanitizeProviderResolveMetadata({
    provider_id: providerResolved.adapter.provider_id,
    adapter_status: providerResolved.adapter.status,
  });
  // C4: adapter.execute exists as contract stub only — never invoke.

  try {
    const existingResult = await findExecutionResult(cfg, id);
    if (existingResult) {
      return fail(409, EXECUTOR_FAILURE_CODES.EXECUTION_ALREADY_COMPLETED, {
        execution_id: id,
      });
    }
  } catch {
    return fail(503, "db_unavailable");
  }

  let claimed;
  try {
    claimed = await claimQueuedExecution(cfg, id, {
      attempts: Number(row.execution_attempts || 0) + 1,
    });
  } catch {
    return fail(503, EXECUTOR_FAILURE_CODES.CLAIM_FAILED);
  }
  if (!claimed.ok) {
    return fail(409, EXECUTOR_FAILURE_CODES.EXECUTION_ALREADY_CLAIMED, {
      execution_id: id,
    });
  }
  row = claimed.row;

  const deadline = Date.now() + PHASE_B4_EXECUTOR_TIMEOUT_MS;
  const timedOut = () => Date.now() > deadline;

  let seq = 1;
  try {
    seq = await nextEventSequence(cfg, id);
  } catch {
    const fr = await failRunning(
      cfg,
      row,
      EXECUTOR_FAILURE_CODES.EVENT_PERSIST_FAILED,
      1
    );
    return fail(500, EXECUTOR_FAILURE_CODES.EVENT_PERSIST_FAILED, {
      execution_id: id,
      audit_incomplete: true,
      running_orphan_risk: fr.orphanRisk,
    });
  }

  try {
    await emit(cfg, id, seq++, {
      event_type: GATE_EVENT_TYPES.EXECUTOR_CLAIMED,
      previous_status: "queued",
      next_status: "running",
      executor_port: PHASE_B_PIPELINE_PORTS[0],
      capability_key: "collect_daily_ops",
    });
    await emit(cfg, id, seq++, {
      event_type: GATE_EVENT_TYPES.EXECUTION_STARTED,
      previous_status: "queued",
      next_status: "running",
      capability_key: "collect_daily_ops",
    });
    await emit(cfg, id, seq++, {
      event_type: GATE_EVENT_TYPES.USAGE_SNAPSHOT_LOADED,
      capability_key: "generate_ops_report",
      sanitized_metadata: usageMeta,
    });
    await emit(cfg, id, seq++, {
      event_type: GATE_EVENT_TYPES.BUDGET_GUARD_EVALUATED,
      capability_key: "generate_ops_report",
      sanitized_metadata: {
        decision: budgetDecision.decision,
        reason: budgetDecision.reason,
        blocked: false,
        provider_called: false,
        recorded_api_cost: 0,
        warning: Boolean(budgetDecision.warning),
      },
    });
    await emit(cfg, id, seq++, {
      event_type: GATE_EVENT_TYPES.PROVIDER_RESOLVED,
      capability_key: "generate_ops_report",
      executor_port: "secretary_deepseek",
      sanitized_metadata: providerMeta,
    });

    if (timedOut()) {
      const fr = await failRunning(
        cfg,
        row,
        EXECUTOR_FAILURE_CODES.EXECUTION_TIMEOUT,
        seq
      );
      return fail(504, EXECUTOR_FAILURE_CODES.EXECUTION_TIMEOUT, {
        execution_id: id,
        running_orphan_risk: fr.orphanRisk,
      });
    }

    // Step 1 — collect
    await emit(cfg, id, seq++, {
      event_type: GATE_EVENT_TYPES.STEP_COLLECT_START,
      step_name: "collect_daily_ops",
      capability_key: "collect_daily_ops",
      executor_port: "ops_collector",
    });
    let collected;
    try {
      collected = collectFn({
        executionId: id,
        budgetDayKey: row.budget_day_key,
        correlationId: row.correlation_id,
        now: input.now,
      });
    } catch (e) {
      const err = e instanceof Error ? e : new Error("collector_failed");
      err.code = "collector";
      throw err;
    }
    await emit(cfg, id, seq++, {
      event_type: GATE_EVENT_TYPES.STEP_COLLECT_DONE,
      step_name: "collect_daily_ops",
      capability_key: "collect_daily_ops",
      executor_port: "ops_collector",
      sanitized_metadata: {
        pending_total: collected.pending?.total ?? 0,
        source: collected.source,
      },
    });

    // Phase C4 — provider-neutral prepare/validate (NoOp · never execute)
    let c5DispatchMeta = null;
    let c6InvocationMeta = null;
    if (collected.c1_snapshot && typeof collected.c1_snapshot === "object") {
      const prepared = prepareProviderNeutralRequest(
        /** @type {Record<string, unknown>} */ (collected.c1_snapshot),
        providerResolved.adapter.provider_id
      );
      if (!prepared.ok) {
        const err = new Error("provider_prepare_failed");
        err.code = "report";
        err.gateError = prepared.error;
        throw err;
      }
      await emit(cfg, id, seq++, {
        event_type: GATE_EVENT_TYPES.PROVIDER_PREPARE_DONE,
        capability_key: "generate_ops_report",
        executor_port: "secretary_deepseek",
        sanitized_metadata: {
          provider_id: prepared.provider_id,
          adapter_status: prepared.adapter_status,
          provider_called: false,
          recorded_api_cost: 0,
        },
      });

      // Phase C5 — Execution Plan + Dispatcher (NoOp stop · never adapter.execute)
      const planBuilt = buildExecutionPlan({
        context: {
          execution_id: id,
          request_id: id,
          correlation_id: row.correlation_id,
          actor_id: row.actor_id,
          budget_day_key: row.budget_day_key,
        },
        provider_id: prepared.provider_id,
        prepared_request: prepared.prepared,
        budget_decision: budgetDecision,
        metadata: {
          port: "secretary_deepseek",
          provider_id: prepared.provider_id,
          adapter_status: prepared.adapter_status,
          provider_called: false,
          recorded_api_cost: 0,
          schema_version: prepared.prepared?.schema_version,
        },
      });
      if (!planBuilt.ok) {
        const err = new Error("execution_plan_failed");
        err.code = "report";
        err.gateError = planBuilt.error;
        throw err;
      }
      const dispatched = dispatchExecutionPlan({ plan: planBuilt.value });
      if (!dispatched.ok) {
        const err = new Error("execution_dispatch_failed");
        err.code = "report";
        err.gateError = dispatched.error;
        throw err;
      }
      if (dispatched.result?.executed === true || dispatched.provider_called === true) {
        const err = new Error("execution_boundary_violation");
        err.code = "report";
        err.gateError = "DISPATCH_FORBIDDEN_EXECUTE";
        throw err;
      }
      c5DispatchMeta = sanitizeExecutionBoundaryMetadata(dispatched);
      await emit(cfg, id, seq++, {
        event_type: GATE_EVENT_TYPES.EXECUTION_BOUNDARY_DISPATCHED,
        capability_key: "generate_ops_report",
        executor_port: "secretary_deepseek",
        sanitized_metadata: c5DispatchMeta,
      });

      // Phase C6 — Controlled Provider Invocation Gate (always deny · never execute)
      const invCtx = buildInvocationContext({
        provider_id: prepared.provider_id,
        plan: dispatched.plan,
        envelope: dispatched.envelope,
        executed: dispatched.result?.executed === true,
        provider_called: dispatched.provider_called === true,
        recorded_api_cost: dispatched.recorded_api_cost ?? 0,
        execution_id: id,
        request_id: id,
      });
      if (!invCtx.ok) {
        const err = new Error("invocation_context_failed");
        err.code = "report";
        err.gateError = invCtx.reason || invCtx.error;
        throw err;
      }
      const invocation = evaluateInvocationGate({ context: invCtx.value });
      if (
        invocation.decision !== "denied" ||
        invocation.invoke === true ||
        invocation.provider_called === true ||
        invocation.recorded_api_cost !== 0
      ) {
        const err = new Error("invocation_gate_violation");
        err.code = "report";
        err.gateError = "INVOCATION_GATE_MUST_DENY";
        throw err;
      }
      c6InvocationMeta = sanitizeInvocationAuditMetadata(invocation);
      await emit(cfg, id, seq++, {
        event_type: GATE_EVENT_TYPES.PROVIDER_INVOCATION_DENIED,
        capability_key: "generate_ops_report",
        executor_port: "secretary_deepseek",
        sanitized_metadata: c6InvocationMeta,
      });
    }

    if (timedOut()) {
      const fr = await failRunning(
        cfg,
        row,
        EXECUTOR_FAILURE_CODES.EXECUTION_TIMEOUT,
        seq
      );
      return fail(504, EXECUTOR_FAILURE_CODES.EXECUTION_TIMEOUT, {
        execution_id: id,
        running_orphan_risk: fr.orphanRisk,
      });
    }

    // Step 2 — deterministic report
    await emit(cfg, id, seq++, {
      event_type: GATE_EVENT_TYPES.STEP_REPORT_START,
      step_name: "generate_ops_report",
      capability_key: "generate_ops_report",
      executor_port: "secretary_deepseek",
      sanitized_metadata: { provider_called: false },
    });
    let generated;
    try {
      generated = reportFn({
        collected,
        executionId: id,
        now: input.now,
      });
    } catch (e) {
      const err = e instanceof Error ? e : new Error("report_generation_failed");
      err.code = "report";
      throw err;
    }
    await emit(cfg, id, seq++, {
      event_type: GATE_EVENT_TYPES.STEP_REPORT_DONE,
      step_name: "generate_ops_report",
      capability_key: "generate_ops_report",
      executor_port: "secretary_deepseek",
      sanitized_metadata: {
        provider_called: false,
        report_version: generated.metrics.report_version,
      },
    });

    if (timedOut()) {
      const fr = await failRunning(
        cfg,
        row,
        EXECUTOR_FAILURE_CODES.EXECUTION_TIMEOUT,
        seq
      );
      return fail(504, EXECUTOR_FAILURE_CODES.EXECUTION_TIMEOUT, {
        execution_id: id,
        running_orphan_risk: fr.orphanRisk,
      });
    }

    // Step 3 — insert-only result (never overwrite)
    const inserted = await insertExecutionResult(cfg, {
      execution_id: id,
      output_type: "ops_daily_report",
      sanitized_summary: generated.sanitized_summary,
      metrics: generated.metrics,
      error_code: null,
      retryable: false,
      completed_at: new Date().toISOString(),
    });
    if (!inserted.ok) {
      if (
        inserted.reason === "exists" ||
        inserted.reason === "conflict"
      ) {
        // Race: another writer already has a result — never PATCH overwrite.
        const existing = inserted.row;
        if (existing && existing.output_type === "ops_daily_report") {
          const transitioned = await transitionExecutionStatus(cfg, id, "running", {
            execution_status: "succeeded",
            completed_at: new Date().toISOString(),
            recorded_api_cost: 0,
            executor_name: "gate_audit_writer",
          });
          if (transitioned.ok) {
            return {
              ok: true,
              http: 200,
              body: {
                ok: true,
                execution_id: id,
                decision: "allowed",
                status: "succeeded",
                pipeline_invoked: true,
                provider_called: false,
                recorded_api_cost: 0,
                idempotent_replay: true,
                audit_incomplete: true,
              },
            };
          }
          logOrphan(id, "result_exists_transition_miss", "conflict");
          return fail(409, EXECUTOR_FAILURE_CODES.EXECUTION_ALREADY_COMPLETED, {
            execution_id: id,
            result_present: true,
            running_orphan_risk: true,
          });
        }
        return fail(409, EXECUTOR_FAILURE_CODES.EXECUTION_ALREADY_COMPLETED, {
          execution_id: id,
          result_present: Boolean(existing),
        });
      }
      const fr = await failRunning(
        cfg,
        row,
        EXECUTOR_FAILURE_CODES.RESULT_PERSIST_FAILED,
        seq
      );
      return fail(500, EXECUTOR_FAILURE_CODES.RESULT_PERSIST_FAILED, {
        execution_id: id,
        running_orphan_risk: fr.orphanRisk,
      });
    }

    try {
      await emit(cfg, id, seq++, {
        event_type: GATE_EVENT_TYPES.RESULT_PERSISTED,
        executor_port: "gate_audit_writer",
        capability_key: "generate_ops_report",
        sanitized_metadata: { provider_called: false },
      });
      await emit(cfg, id, seq++, {
        event_type: GATE_EVENT_TYPES.STEP_AUDIT_DONE,
        step_name: "gate_audit_writer",
        executor_port: "gate_audit_writer",
      });
      await emit(cfg, id, seq++, {
        event_type: GATE_EVENT_TYPES.EXECUTION_SUCCEEDED,
        previous_status: "running",
        next_status: "succeeded",
        decision: "allowed",
      });
    } catch {
      // Result already inserted — never overwrite; still try succeeded transition
      console.error("[ai-exec-gate-executor] post_result_event_failed", {
        execution_id: id,
        code: "event_persist_failed",
      });
    }

    const transitioned = await transitionExecutionStatus(cfg, id, "running", {
      execution_status: "succeeded",
      completed_at: new Date().toISOString(),
      recorded_api_cost: generated.recorded_api_cost,
      executor_name: "gate_audit_writer",
    });
    if (!transitioned.ok) {
      logOrphan(id, "succeeded_transition_miss", "result_persisted");
      return fail(500, EXECUTOR_FAILURE_CODES.INTERNAL_ERROR, {
        execution_id: id,
        audit_incomplete: true,
        running_orphan_risk: true,
        result_present: true,
      });
    }

    return {
      ok: true,
      http: 200,
      body: {
        ok: true,
        execution_id: id,
        decision: "allowed",
        status: "succeeded",
        stub: false,
        pipeline_invoked: true,
        provider_called: false,
        external_side_effect: false,
        recorded_api_cost: generated.recorded_api_cost,
        correlation_id: row.correlation_id || null,
        summary: generated.sanitized_summary.slice(0, 500),
        budget: budgetPublic,
        provider: providerMeta,
        execution_boundary: c5DispatchMeta,
        provider_invocation: c6InvocationMeta,
        usage: usageMeta,
      },
    };
  } catch (e) {
    const code =
      e?.code === "collector"
        ? EXECUTOR_FAILURE_CODES.COLLECTOR_FAILED
        : e?.code === "report"
          ? EXECUTOR_FAILURE_CODES.REPORT_GENERATION_FAILED
          : EXECUTOR_FAILURE_CODES.INTERNAL_ERROR;
    // If success result already exists, do not failRunning overwrite — orphan log only
    try {
      const existing = await findExecutionResult(cfg, id);
      if (existing && existing.output_type === "ops_daily_report") {
        logOrphan(id, "exception_after_success_result", code);
        const transitioned = await transitionExecutionStatus(
          cfg,
          id,
          "running",
          {
            execution_status: "succeeded",
            completed_at: new Date().toISOString(),
            recorded_api_cost: 0,
            executor_name: "gate_audit_writer",
          }
        );
        if (transitioned.ok) {
          return {
            ok: true,
            http: 200,
            body: {
              ok: true,
              execution_id: id,
              decision: "allowed",
              status: "succeeded",
              pipeline_invoked: true,
              provider_called: false,
              audit_incomplete: true,
              recorded_api_cost: 0,
            },
          };
        }
        return fail(500, EXECUTOR_FAILURE_CODES.INTERNAL_ERROR, {
          execution_id: id,
          audit_incomplete: true,
          running_orphan_risk: true,
          result_present: true,
        });
      }
    } catch {
      /* fall through to failRunning */
    }

    const fr = await failRunning(cfg, row, code, seq);
    return fail(500, code, {
      execution_id: id,
      correlation_id: row.correlation_id || null,
      running_orphan_risk: fr.orphanRisk,
    });
  }
}
