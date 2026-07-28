/**
 * Diff & Approve — Phase A8 Read Model (pure projection · no Dashboard/API/DB).
 */

import { deepFreeze } from "./ai-diff-approve-a1-foundation.mjs";

export { deepFreeze };

export const PHASE_A8_SCHEMA_VERSION = "diff_approve.a8.read_model.v1";

export const PHASE_A8_REASONS = Object.freeze({
  OK: "ok",
  INVALID_CONTEXT: "invalid_context",
});

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * @param {Record<string, unknown>} [input]
 */
export function projectReadModel(input = {}) {
  if (!isPlainObject(input)) {
    return {
      ok: false,
      error: PHASE_A8_REASONS.INVALID_CONTEXT,
      reason: PHASE_A8_REASONS.INVALID_CONTEXT,
    };
  }

  const proposal = isPlainObject(input.proposal)
    ? /** @type {Record<string, unknown>} */ (input.proposal)
    : {};
  const approval = isPlainObject(input.approval)
    ? /** @type {Record<string, unknown>} */ (input.approval)
    : {};
  const readiness = isPlainObject(input.readiness)
    ? /** @type {Record<string, unknown>} */ (input.readiness)
    : {};
  const simulation = isPlainObject(input.simulation)
    ? /** @type {Record<string, unknown>} */ (input.simulation)
    : {};
  const finalGate = isPlainObject(input.final_gate)
    ? /** @type {Record<string, unknown>} */ (input.final_gate)
    : {};
  const impact = isPlainObject(input.impact)
    ? /** @type {Record<string, unknown>} */ (input.impact)
    : {};
  const timeline = Array.isArray(input.audit_timeline)
    ? input.audit_timeline
    : [];

  const model = deepFreeze({
    schema_version: PHASE_A8_SCHEMA_VERSION,
    proposal_id:
      typeof proposal.proposal_id === "string" ? proposal.proposal_id : null,
    status: typeof proposal.status === "string" ? proposal.status : null,
    capability:
      typeof proposal.capability === "string" ? proposal.capability : null,
    resource_type:
      typeof proposal.resource_type === "string"
        ? proposal.resource_type
        : null,
    approval_actor: approval.actor || null,
    approval_decision:
      typeof approval.decision === "string"
        ? approval.decision
        : typeof proposal.status === "string"
          ? proposal.status
          : null,
    impact_summary: deepFreeze({
      estimated_risk: impact.estimated_risk || null,
      approval_required: impact.approval_required === true,
      changed_fields: Array.isArray(impact.changed_fields)
        ? Object.freeze([...impact.changed_fields])
        : Object.freeze([]),
    }),
    apply_readiness:
      typeof readiness.decision === "string" ? readiness.decision : null,
    simulation_result:
      typeof simulation.simulation_state === "string"
        ? simulation.simulation_state
        : null,
    final_gate_decision:
      typeof finalGate.decision === "string" ? finalGate.decision : null,
    risk_summary: impact.estimated_risk || "unknown",
    blocking_reasons: Array.isArray(finalGate.blocking_reasons)
      ? Object.freeze([...finalGate.blocking_reasons])
      : Object.freeze([]),
    audit_timeline: Object.freeze([...timeline]),
    counters: deepFreeze({
      timeline_events: timeline.length,
      blocking_count: Array.isArray(finalGate.blocking_reasons)
        ? finalGate.blocking_reasons.length
        : 0,
    }),
  });

  return { ok: true, value: model, reason: PHASE_A8_REASONS.OK };
}

/**
 * @param {unknown[]} rows
 * @param {Record<string, unknown>} [query]
 */
export function queryReadModels(rows, query = {}) {
  const list = Array.isArray(rows) ? rows.filter(isPlainObject) : [];
  let filtered = list;
  if (typeof query.status === "string") {
    filtered = filtered.filter(
      (r) => /** @type {Record<string, unknown>} */ (r).status === query.status
    );
  }
  if (typeof query.risk === "string") {
    filtered = filtered.filter(
      (r) =>
        /** @type {Record<string, unknown>} */ (r).risk_summary === query.risk
    );
  }
  const sortBy = typeof query.sortBy === "string" ? query.sortBy : "proposal_id";
  const dir = query.sortDir === "desc" ? -1 : 1;
  const sorted = [...filtered].sort((a, b) => {
    const av = String(/** @type {any} */ (a)[sortBy] ?? "");
    const bv = String(/** @type {any} */ (b)[sortBy] ?? "");
    return av < bv ? -1 * dir : av > bv ? 1 * dir : 0;
  });
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
  const start = (page - 1) * pageSize;
  return deepFreeze({
    total: sorted.length,
    page,
    pageSize,
    items: Object.freeze(sorted.slice(start, start + pageSize)),
  });
}

/**
 * @param {unknown[]} rows
 */
export function groupByStatus(rows) {
  /** @type {Record<string, number>} */
  const counts = {};
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!isPlainObject(row)) continue;
    const s = String(/** @type {any} */ (row).status || "unknown");
    counts[s] = (counts[s] || 0) + 1;
  }
  return deepFreeze(counts);
}
