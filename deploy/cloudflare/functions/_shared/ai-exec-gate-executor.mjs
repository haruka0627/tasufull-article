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
import { collectDailyOps } from "./ai-exec-gate-ops-collector.mjs";
import { generateOpsReport } from "./ai-exec-gate-report-generator.mjs";
import {
  appendExecutionEvent,
  claimQueuedExecution,
  findExecutionResult,
  findRequestById,
  insertExecutionResult,
  nextEventSequence,
  pickGateDbEnv,
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
 *   collectFn?: typeof collectDailyOps,
 *   reportFn?: typeof generateOpsReport,
 * }} input
 */
export async function executeGatePipeline(input) {
  const collectFn =
    typeof input.collectFn === "function" ? input.collectFn : collectDailyOps;
  const reportFn =
    typeof input.reportFn === "function" ? input.reportFn : generateOpsReport;
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
