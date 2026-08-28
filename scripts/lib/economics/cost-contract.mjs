/**
 * Economics Core V1 — Cost Contract (in-memory / config).
 * No DB table. No hardcoded vendor price proliferation in call sites.
 */

/**
 * @typedef {{
 *   vendor: string,
 *   service: string,
 *   sku_or_model: string,
 *   billing_unit: string,
 *   currency: string,
 *   unit_cost: number,
 *   effective_from: string,
 *   effective_to?: string|null,
 *   source: string,
 *   verified_at?: string|null,
 *   verification_status: 'CANDIDATE'|'VERIFIED'|'APPROVED'|'REVOKED'|'PROVISIONAL',
 * }} CostContractRow
 */

/**
 * @param {CostContractRow[]} rows
 * @param {{ vendor: string, service: string, sku_or_model: string, at?: string }} query
 * @returns {CostContractRow|null}
 */
export function lookupCostContract(rows, query) {
  const list = Array.isArray(rows) ? rows : [];
  const at = query.at ? new Date(query.at).getTime() : Date.now();
  const matches = list.filter((r) => {
    if (String(r.vendor) !== String(query.vendor)) return false;
    if (String(r.service) !== String(query.service)) return false;
    if (String(r.sku_or_model) !== String(query.sku_or_model)) return false;
    if (r.verification_status === "REVOKED") return false;
    const from = new Date(r.effective_from).getTime();
    const to = r.effective_to == null ? Number.POSITIVE_INFINITY : new Date(r.effective_to).getTime();
    return from <= at && at < to;
  });
  matches.sort((a, b) => new Date(b.effective_from) - new Date(a.effective_from));
  return matches[0] || null;
}

/**
 * Daily Radar handoff: external candidate only — never auto-activates.
 * @param {Omit<CostContractRow,'verification_status'> & { verification_status?: string }} candidate
 */
export function createCostContractCandidate(candidate) {
  return {
    ...candidate,
    verification_status: "CANDIDATE",
    handoff: "DAILY_RADAR_EXTERNAL_INTELLIGENCE",
    auto_apply: false,
    requires_human_approval: true,
  };
}

/**
 * @param {CostContractRow} row
 * @param {number} quantity
 */
export function estimateCostFromContract(row, quantity) {
  if (!row || !Number.isFinite(Number(quantity))) {
    return { ok: false, error: "invalid_input", amount: null };
  }
  if (row.verification_status === "CANDIDATE" || row.verification_status === "REVOKED") {
    return { ok: false, error: "not_active", amount: null, verification_status: row.verification_status };
  }
  const q = Number(quantity);
  const unit = Number(row.unit_cost);
  if (!Number.isFinite(unit)) {
    return { ok: false, error: "invalid_unit_cost", amount: null };
  }
  return {
    ok: true,
    amount: q * unit,
    currency: row.currency,
    billing_unit: row.billing_unit,
    verification_status: row.verification_status,
    actuality: row.verification_status === "APPROVED" ? "CALCULATED" : "ESTIMATED",
  };
}
