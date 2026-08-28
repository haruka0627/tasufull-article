/**
 * Economics Core V1 — normalize source events → common read records.
 */

import { ACTUALITY, isProductId } from "./contracts.mjs";
import { normalizeFxAmount } from "./fx.mjs";

/**
 * @typedef {{
 *   period: string,
 *   user_id: string|null,
 *   product: string,
 *   feature: string|null,
 *   provider: string|null,
 *   vendor: string|null,
 *   revenue_type: string|null,
 *   cost_type: string|null,
 *   fee_contract_id: string|null,
 *   quantity: number|null,
 *   unit: string|null,
 *   source_currency: string,
 *   source_amount: number,
 *   fx_rate: number|null,
 *   amount_jpy: number|null,
 *   actuality: string,
 *   source: string,
 *   source_id: string,
 *   occurred_at: string,
 *   direction: 'revenue'|'cost'|'refund'|'meta',
 *   cost_class: string|null,
 *   fx_status: string|null,
 *   user_role: string|null,
 *   user_roles: string[]|null,
 *   party_refs: object|null,
 *   attribution_status: string|null,
 *   trace: object,
 * }} EconomicsRecord
 */

/**
 * @param {object} raw
 * @returns {{ ok: true, record: EconomicsRecord } | { ok: false, error: string }}
 */
export function normalizeEconomicsEvent(raw) {
  const product = String(raw?.product || "").trim();
  if (!isProductId(product)) {
    return { ok: false, error: "invalid_product" };
  }
  const source_id = String(raw?.source_id || "").trim();
  if (!source_id) {
    return { ok: false, error: "missing_source_id" };
  }
  const source = String(raw?.source || "unknown").trim();
  const occurred_at = String(raw?.occurred_at || "").trim();
  if (!occurred_at) {
    return { ok: false, error: "missing_occurred_at" };
  }
  const period = String(raw?.period || occurred_at.slice(0, 7)).trim();
  const direction = String(raw?.direction || "revenue").trim();
  if (!["revenue", "cost", "refund", "meta"].includes(direction)) {
    return { ok: false, error: "invalid_direction" };
  }

  const actuality = String(raw?.actuality || ACTUALITY.ACTUAL).trim();
  if (!Object.values(ACTUALITY).includes(actuality)) {
    return { ok: false, error: "invalid_actuality" };
  }

  const fx = normalizeFxAmount({
    source_currency: raw?.source_currency || "JPY",
    source_amount: raw?.source_amount ?? raw?.amount_jpy,
    fx_rate: raw?.fx_rate,
    fx_source: raw?.fx_source,
    fx_timestamp: raw?.fx_timestamp,
  });

  const attributionFields = {
    user_role: raw?.user_role == null ? null : String(raw.user_role),
    user_roles: Array.isArray(raw?.user_roles) ? raw.user_roles.map(String) : null,
    party_refs: raw?.party_refs && typeof raw.party_refs === "object" ? raw.party_refs : null,
    attribution_status:
      raw?.user_id == null || String(raw.user_id).trim() === ""
        ? "UNATTRIBUTED"
        : "ATTRIBUTED",
  };

  if (direction !== "meta" && fx.normalized_jpy == null && (fx.fx_status === "MISSING" || fx.fx_status === "UNSUPPORTED_CURRENCY")) {
    return {
      ok: true,
      record: {
        period,
        user_id: raw?.user_id == null ? null : String(raw.user_id),
        product,
        feature: raw?.feature == null ? null : String(raw.feature),
        provider: raw?.provider == null ? null : String(raw.provider),
        vendor: raw?.vendor == null ? null : String(raw.vendor),
        revenue_type: raw?.revenue_type == null ? null : String(raw.revenue_type),
        cost_type: raw?.cost_type == null ? null : String(raw.cost_type),
        fee_contract_id: raw?.fee_contract_id == null ? null : String(raw.fee_contract_id),
        quantity: raw?.quantity == null ? null : Number(raw.quantity),
        unit: raw?.unit == null ? null : String(raw.unit),
        source_currency: fx.source_currency,
        source_amount: fx.source_amount,
        fx_rate: fx.fx_rate,
        amount_jpy: null,
        actuality,
        source,
        source_id,
        occurred_at,
        direction,
        cost_class: raw?.cost_class == null ? null : String(raw.cost_class),
        fx_status: fx.fx_status === "UNSUPPORTED_CURRENCY" ? "UNSUPPORTED_CURRENCY" : "FX_MISSING",
        ...attributionFields,
        trace: { raw_keys: Object.keys(raw || {}), note: "amount_jpy unavailable until FX provided" },
      },
    };
  }

  return {
    ok: true,
    record: {
      period,
      user_id: raw?.user_id == null ? null : String(raw.user_id),
      product,
      feature: raw?.feature == null ? null : String(raw.feature),
      provider: raw?.provider == null ? null : String(raw.provider),
      vendor: raw?.vendor == null ? null : String(raw.vendor),
      revenue_type: raw?.revenue_type == null ? null : String(raw.revenue_type),
      cost_type: raw?.cost_type == null ? null : String(raw.cost_type),
      fee_contract_id: raw?.fee_contract_id == null ? null : String(raw.fee_contract_id),
      quantity: raw?.quantity == null ? null : Number(raw.quantity),
      unit: raw?.unit == null ? null : String(raw.unit),
      source_currency: fx.source_currency,
      source_amount: fx.source_amount,
      fx_rate: fx.fx_rate,
      amount_jpy: fx.normalized_jpy,
      actuality,
      source,
      source_id,
      occurred_at,
      direction,
      cost_class: raw?.cost_class == null ? null : String(raw.cost_class),
      fx_status: fx.fx_status,
      ...attributionFields,
      trace: {
        source,
        source_id,
        adapter: raw?.adapter || null,
        party_refs: attributionFields.party_refs,
      },
    },
  };
}

/**
 * Idempotent merge by source+source_id (last write wins for same key).
 * @param {EconomicsRecord[]} records
 */
export function dedupeRecords(records) {
  const map = new Map();
  for (const r of records || []) {
    if (!r?.source_id) continue;
    const key = `${r.source}::${r.source_id}`;
    map.set(key, r);
  }
  return Array.from(map.values());
}
