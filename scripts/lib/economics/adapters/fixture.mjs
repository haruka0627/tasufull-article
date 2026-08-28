/**
 * Economics Core V1 — fixture → normalized records adapter.
 * No Production DB. For tests and sample Contribution.
 */

import { normalizeEconomicsEvent } from "../normalize.mjs";

/**
 * @param {object[]} events
 * @returns {{ records: import('../normalize.mjs').EconomicsRecord[], errors: object[] }}
 */
export function adaptFixtureEvents(events) {
  const records = [];
  const errors = [];
  for (const raw of events || []) {
    const result = normalizeEconomicsEvent({
      ...raw,
      adapter: raw.adapter || "fixture",
    });
    if (!result.ok) {
      errors.push({ source_id: raw?.source_id, error: result.error });
      continue;
    }
    records.push(result.record);
  }
  return { records, errors };
}
