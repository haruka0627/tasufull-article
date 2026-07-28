/**
 * Phase C7 test fixtures — authoritative usage reader doubles (no live SAFE DB).
 */
import {
  PHASE_C7_CURRENCY,
  PHASE_C7_SCHEMA_VERSION,
  PHASE_C7_SOURCE,
  PHASE_C7_TIMEZONE,
  buildJstDayPeriod,
  createFixedUsageReader,
} from "../../deploy/cloudflare/functions/_shared/ai-exec-gate-c7-usage-snapshot.mjs";

export const PHASE_C7_TEST_ACTOR_ID =
  "11111111-1111-4111-8111-111111111111";

export const PHASE_C7_TEST_DAY_KEY = "2026-07-28";

/**
 * @param {number} usageUsd
 * @param {{
 *   actorId?: string,
 *   dayKey?: string,
 *   environment?: string,
 * }} [opts]
 */
export function createAvailableUsageReader(usageUsd, opts = {}) {
  const actorId = opts.actorId || PHASE_C7_TEST_ACTOR_ID;
  const dayKey = opts.dayKey || PHASE_C7_TEST_DAY_KEY;
  const environment = opts.environment || "staging";
  const period = buildJstDayPeriod(dayKey);
  if (!period.ok) {
    throw new Error("invalid_test_day_key");
  }
  return createFixedUsageReader({
    schema_version: PHASE_C7_SCHEMA_VERSION,
    source: PHASE_C7_SOURCE,
    availability: "available",
    actor_id: actorId,
    environment,
    period_start: period.period_start,
    period_end: period.period_end,
    period_key: dayKey,
    timezone: PHASE_C7_TIMEZONE,
    currency: PHASE_C7_CURRENCY,
    recorded_usage_usd: usageUsd,
    reserved_usage_usd: 0,
    effective_usage_usd: usageUsd,
    snapshot_at: `${dayKey}T01:00:00.000Z`,
    provider_called: false,
    recorded_api_cost: 0,
  });
}

/**
 * Mock PostgREST body for SAFE-07 aggregate (empty = authoritative 0 for actor).
 * @param {unknown} [_body]
 */
export function safe07EmptyAggregateResponse(_body) {
  return {
    ok: true,
    group_by: "user",
    currency: "USD",
    from: "2026-07-27T15:00:00.000Z",
    to: "2026-07-28T15:00:00.000Z",
    tz: "Asia/Tokyo",
    note: "estimated_api_cost_not_provider_invoice_not_customer_billing",
    rows: [],
  };
}
