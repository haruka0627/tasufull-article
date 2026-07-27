/**
 * AI Execution Gate — Phase B4 ops_collector adapter (deterministic · no LLM).
 * Empty-safe fixture contract: no business-table writes · no PII dump · no external HTTP.
 */

import { PHASE_B_ACTION_TYPE } from "./ai-exec-gate-capabilities.mjs";

/**
 * @param {{
 *   executionId: string,
 *   budgetDayKey?: string|null,
 *   correlationId?: string|null,
 *   now?: Date,
 * }} input
 */
export function collectDailyOps(input) {
  const now = input.now || new Date();
  const generatedAt = now.toISOString();
  return Object.freeze({
    collector: "ops_collector",
    capability_key: "collect_daily_ops",
    action_type: PHASE_B_ACTION_TYPE,
    collected_at: generatedAt,
    budget_day_key: input.budgetDayKey || null,
    execution_id: input.executionId,
    correlation_id: input.correlationId || null,
    pending: Object.freeze({
      total: 0,
      by_category: Object.freeze({}),
      items: Object.freeze([]),
    }),
    source: "deterministic_phase_b4_fixture",
    limitations: Object.freeze([
      "Phase B4 uses empty-safe fixture collector",
      "Live inbox aggregation deferred to later phase",
      "No business table reads in B4",
    ]),
  });
}
