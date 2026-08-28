/**
 * Economics Core V1 — FX Contract.
 * No invented FX. No new FX API. Missing → FX_MISSING.
 */

/**
 * @param {object} input
 * @param {string} input.source_currency
 * @param {number} input.source_amount
 * @param {number|null|undefined} [input.fx_rate]
 * @param {string|null|undefined} [input.fx_source]
 * @param {string|null|undefined} [input.fx_timestamp]
 * @returns {{
 *   source_currency: string,
 *   source_amount: number,
 *   fx_rate: number|null,
 *   fx_source: string|null,
 *   fx_timestamp: string|null,
 *   normalized_jpy: number|null,
 *   fx_status: 'ACTUAL'|'MANUAL_VERIFIED'|'MISSING'|'NOT_REQUIRED',
 * }}
 */
export function normalizeFxAmount(input) {
  const source_currency = String(input?.source_currency || "JPY").toUpperCase();
  const source_amount = Number(input?.source_amount);
  const amountOk = Number.isFinite(source_amount);

  if (!amountOk) {
    return {
      source_currency,
      source_amount: NaN,
      fx_rate: null,
      fx_source: null,
      fx_timestamp: null,
      normalized_jpy: null,
      fx_status: "MISSING",
    };
  }

  if (source_currency === "JPY") {
    return {
      source_currency,
      source_amount,
      fx_rate: 1,
      fx_source: "IDENTITY",
      fx_timestamp: input?.fx_timestamp || null,
      normalized_jpy: Math.round(source_amount),
      fx_status: "NOT_REQUIRED",
    };
  }

  /** Currencies Economics V1 can normalize only when an explicit fx_rate is supplied. */
  const SUPPORTED_WITH_RATE = new Set(["USD", "EUR", "GBP", "AUD", "CAD", "SGD", "KRW", "CNY", "TWD", "HKD"]);
  if (!SUPPORTED_WITH_RATE.has(source_currency)) {
    return {
      source_currency,
      source_amount,
      fx_rate: null,
      fx_source: input?.fx_source || null,
      fx_timestamp: input?.fx_timestamp || null,
      normalized_jpy: null,
      fx_status: "UNSUPPORTED_CURRENCY",
    };
  }

  const fx_rate = input?.fx_rate == null ? null : Number(input.fx_rate);
  if (!Number.isFinite(fx_rate) || fx_rate <= 0) {
    return {
      source_currency,
      source_amount,
      fx_rate: null,
      fx_source: input?.fx_source || null,
      fx_timestamp: input?.fx_timestamp || null,
      normalized_jpy: null,
      fx_status: "MISSING",
    };
  }

  return {
    source_currency,
    source_amount,
    fx_rate,
    fx_source: String(input?.fx_source || "MANUAL"),
    fx_timestamp: input?.fx_timestamp || null,
    normalized_jpy: Math.round(source_amount * fx_rate),
    fx_status: String(input?.fx_source || "").toUpperCase().includes("VENDOR")
      ? "ACTUAL"
      : "MANUAL_VERIFIED",
  };
}
