/**
 * AI Execution Gate — Phase C1 bridge to Phase B4 executor shapes.
 * Routes official daily ops purpose through C1 collector + deterministic adapter.
 * B4 fixture modules remain intact for direct import / regression.
 */

import { PHASE_B_ACTION_TYPE } from "./ai-exec-gate-capabilities.mjs";
import { budgetDayKeyJst } from "./ai-exec-gate-policy.mjs";
import {
  PHASE_C1_OUTPUT_TYPE,
  PHASE_C1_PERSIST_OUTPUT_TYPE,
  PHASE_C1_SCHEMA_VERSION,
} from "./ai-exec-gate-c1-contracts.mjs";
import {
  collectDailyOperationsSnapshot,
  createDefaultDailyOpsSources,
} from "./ai-exec-gate-c1-collector.mjs";
import { runDeterministicOpsReportPipeline } from "./ai-exec-gate-c1-adapter.mjs";

/**
 * Executor-compatible collector (ops_collector port).
 * Shape preserves pending.total / source for B4 event metadata.
 *
 * @param {{
 *   executionId: string,
 *   budgetDayKey?: string|null,
 *   correlationId?: string|null,
 *   now?: Date,
 *   sources?: import("./ai-exec-gate-c1-collector.mjs").DailyOpsSourceAdapter[],
 * }} input
 */
export function collectDailyOpsC1(input) {
  const now = input.now || new Date();
  const business_date_jst =
    typeof input.budgetDayKey === "string" && input.budgetDayKey
      ? input.budgetDayKey
      : budgetDayKeyJst(now);

  const collected = collectDailyOperationsSnapshot({
    input: {
      purpose: PHASE_B_ACTION_TYPE,
      action: PHASE_B_ACTION_TYPE,
      environment: "staging",
      business_date_jst,
      execution_id: input.executionId,
      correlation_id: input.correlationId || null,
    },
    sources: input.sources || createDefaultDailyOpsSources(),
    collectedAt: now.toISOString(),
  });

  if (!collected.ok) {
    const err = new Error("c1_collector_failed");
    err.code = "collector";
    err.gateError = collected.error;
    throw err;
  }

  const snapshot = collected.snapshot;
  const counts = /** @type {Record<string, unknown>} */ (snapshot.counts);
  const availability = /** @type {Record<string, unknown>} */ (
    snapshot.count_availability
  );
  const pendingTotal =
    availability.pending_total === "available" &&
    typeof counts.pending_total === "number"
      ? counts.pending_total
      : 0;

  return Object.freeze({
    collector: "ops_collector",
    capability_key: "collect_daily_ops",
    action_type: PHASE_B_ACTION_TYPE,
    collected_at: snapshot.collected_at,
    budget_day_key: business_date_jst,
    execution_id: input.executionId,
    correlation_id: input.correlationId || null,
    pending: Object.freeze({
      total: pendingTotal,
      by_category: Object.freeze({}),
      items: Object.freeze([]),
    }),
    source: "phase_c1_sanitized_collector",
    limitations: snapshot.limitations,
    /** @type {Record<string, unknown>} */
    c1_snapshot: snapshot,
  });
}

/**
 * Executor-compatible report generator (secretary_deepseek port · deterministic).
 *
 * @param {{
 *   collected: Record<string, unknown>,
 *   executionId: string,
 *   now?: Date,
 * }} input
 */
export function generateOpsReportC1(input) {
  const now = input.now || new Date();
  const completed_at = now.toISOString();
  const collected = input.collected && typeof input.collected === "object"
    ? input.collected
    : {};

  let snapshot = collected.c1_snapshot;
  if (!snapshot || typeof snapshot !== "object") {
    // Backward path: B4 fixture collected bag without C1 snapshot.
    const pending =
      collected.pending && typeof collected.pending === "object"
        ? collected.pending
        : { total: 0 };
    const total = Number(pending.total);
    const safeTotal = Number.isFinite(total) && total >= 0 ? Math.trunc(total) : 0;
    snapshot = {
      schema_version: PHASE_C1_SCHEMA_VERSION,
      purpose: PHASE_B_ACTION_TYPE,
      action: PHASE_B_ACTION_TYPE,
      environment: "staging",
      business_date_jst:
        typeof collected.budget_day_key === "string"
          ? collected.budget_day_key
          : budgetDayKeyJst(now),
      collected_at:
        typeof collected.collected_at === "string"
          ? collected.collected_at
          : completed_at,
      counts: Object.freeze({ pending_total: safeTotal }),
      count_availability: Object.freeze({ pending_total: "available" }),
      system_warning_codes: Object.freeze([]),
      source_errors: Object.freeze([]),
      limitations: Object.freeze([
        "Phase C1 bridge from B4 collected bag",
        "No provider invocation",
      ]),
    };
  }

  const ran = runDeterministicOpsReportPipeline({
    snapshot: /** @type {Record<string, unknown>} */ (snapshot),
    completed_at,
  });
  if (!ran.ok) {
    const err = new Error("c1_adapter_failed");
    err.code = "report";
    err.gateError = ran.error;
    throw err;
  }

  const result = ran.result;
  const pendingTotal =
    result.warning_counts &&
    typeof result.warning_counts === "object" &&
    typeof result.warning_counts.pending_total === "number"
      ? result.warning_counts.pending_total
      : typeof snapshot.counts?.pending_total === "number"
        ? snapshot.counts.pending_total
        : 0;

  return Object.freeze({
    report: Object.freeze({
      report_version: PHASE_C1_SCHEMA_VERSION,
      generated_at: completed_at,
      source: "deterministic_phase_c1",
      provider: "none",
      port: "secretary_deepseek",
      capability_key: "generate_ops_report",
      execution_id: input.executionId,
      summary: {
        pending_total: pendingTotal,
        headline: result.summary,
        lines: [result.summary, ...(result.priorities || [])],
        priorities: result.priorities,
      },
      warnings: [],
      limitations: [
        "Phase C1 deterministic adapter — provider not called",
        `output_type=${PHASE_C1_OUTPUT_TYPE}`,
      ],
      collector_source: String(collected.source || "unknown"),
    }),
    sanitized_summary: String(result.summary).slice(0, 8000),
    metrics: Object.freeze({
      report_version: PHASE_C1_SCHEMA_VERSION,
      pending_total: pendingTotal,
      provider_called: false,
      recorded_api_cost: 0,
      output_type: PHASE_C1_OUTPUT_TYPE,
      persist_output_type: PHASE_C1_PERSIST_OUTPUT_TYPE,
      priorities: result.priorities,
      warning_counts: result.warning_counts,
    }),
    recorded_api_cost: 0,
    c1_validated_result: result,
  });
}

/**
 * Whether executor should use C1 adapters for this action (official purpose).
 * @param {string|null|undefined} actionType
 */
export function shouldUsePhaseC1Adapters(actionType) {
  return actionType === PHASE_B_ACTION_TYPE;
}
