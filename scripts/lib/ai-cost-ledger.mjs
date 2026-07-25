/**
 * SAFE-07 — Minimum Cost Ledger（推定原価計算 · サーバー側ロジックの JS 鏡）
 * DB RPC `ai_estimate_event_cost` / `ai_cost_ledger_aggregate` と同一規則。
 * クライアントへ価格を埋め込まない · Edge への重複ハードコード禁止（このモジュールが単一計算正本のテスト用）。
 *
 * 選択 A: query 時算出 · ai_usage_events.estimated_cost は書き換えない
 */

/** @typedef {{ provider: string, model: string, unitType: 'input'|'output'|'image'|'request', perUnits: number|string, unitPrice: number|string, currency?: string, unitBasis?: string, provisional?: boolean, effectiveFrom: string|Date, effectiveTo?: string|Date|null }} PriceRate */

export const COST_STATUS_ESTIMATED = "estimated";
export const COST_STATUS_UNKNOWN_RATE = "unknown_rate";
export const COST_STATUS_NOT_BILLABLE = "not_billable";

/** gemini-2.5-flash provisional fixture（migration seed と一致 · 公式単価ではない） */
export const PROVISIONAL_GEMINI_FLASH_RATES = Object.freeze([
  {
    provider: "gemini",
    model: "gemini-2.5-flash",
    unitType: "input",
    perUnits: "1000000",
    unitPrice: "0.10",
    currency: "USD",
    unitBasis: "char",
    provisional: true,
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    effectiveTo: null,
  },
  {
    provider: "gemini",
    model: "gemini-2.5-flash",
    unitType: "output",
    perUnits: "1000000",
    unitPrice: "0.40",
    currency: "USD",
    unitBasis: "char",
    provisional: true,
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    effectiveTo: null,
  },
]);

function toNum(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

function round8(n) {
  return Math.round(n * 1e8) / 1e8;
}

/**
 * 期間重複チェック（同一 provider/model/unitType）
 * @param {PriceRate[]} rates
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function assertNoOverlappingPriceRates(rates) {
  const list = Array.isArray(rates) ? rates : [];
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      const a = list[i];
      const b = list[j];
      if (
        String(a.provider) !== String(b.provider) ||
        String(a.model) !== String(b.model) ||
        String(a.unitType) !== String(b.unitType)
      ) {
        continue;
      }
      const aFrom = new Date(a.effectiveFrom).getTime();
      const bFrom = new Date(b.effectiveFrom).getTime();
      const aTo = a.effectiveTo == null ? Number.POSITIVE_INFINITY : new Date(a.effectiveTo).getTime();
      const bTo = b.effectiveTo == null ? Number.POSITIVE_INFINITY : new Date(b.effectiveTo).getTime();
      if (!(aTo <= bFrom || bTo <= aFrom)) {
        return { ok: false, error: "overlapping_price_rate" };
      }
    }
  }
  return { ok: true };
}

/**
 * (provider, model, unitType, effectiveFrom) 一意性
 */
export function assertUniquePriceRateStarts(rates) {
  const seen = new Set();
  for (const r of rates || []) {
    const key = [
      String(r.provider),
      String(r.model),
      String(r.unitType),
      new Date(r.effectiveFrom).toISOString(),
    ].join("|");
    if (seen.has(key)) return { ok: false, error: "duplicate_price_rate_start" };
    seen.add(key);
  }
  return { ok: true };
}

function pickRate(rates, provider, model, unitType, at, currency) {
  const t = new Date(at).getTime();
  const cur = String(currency || "USD").toUpperCase();
  const matches = (rates || [])
    .filter((r) => {
      if (String(r.provider).toLowerCase() !== String(provider).toLowerCase()) return false;
      if (String(r.model) !== String(model)) return false;
      if (String(r.unitType) !== unitType) return false;
      if (String(r.currency || "USD").toUpperCase() !== cur) return false;
      const from = new Date(r.effectiveFrom).getTime();
      const to = r.effectiveTo == null ? Number.POSITIVE_INFINITY : new Date(r.effectiveTo).getTime();
      return from <= t && t < to;
    })
    .sort((a, b) => new Date(b.effectiveFrom) - new Date(a.effectiveFrom));
  return matches[0] || null;
}

/**
 * @param {object} event
 * @param {PriceRate[]} rates
 */
export function estimateEventCost(event, rates, currency = "USD") {
  const status = String(event?.status || "").toLowerCase();
  const provider = String(event?.provider || "").toLowerCase();
  const model = String(event?.model || "").trim();
  const cur = String(currency || "USD").toUpperCase();
  const at = event?.createdAt || event?.created_at || new Date().toISOString();

  if (status !== "success") {
    return {
      ok: true,
      billable: false,
      costStatus: COST_STATUS_NOT_BILLABLE,
      estimatedCost: null,
      currency: cur,
      inputCost: null,
      outputCost: null,
      provisional: null,
    };
  }

  const inputUnits = toNum(event?.inputUnits ?? event?.input_units);
  const outputUnits = toNum(event?.outputUnits ?? event?.output_units);

  if ((inputUnits != null && inputUnits < 0) || (outputUnits != null && outputUnits < 0)) {
    return { ok: false, error: "invalid_units" };
  }

  if (!model || !provider) {
    return {
      ok: true,
      billable: true,
      costStatus: COST_STATUS_UNKNOWN_RATE,
      estimatedCost: null,
      currency: cur,
      inputCost: null,
      outputCost: null,
      provisional: null,
    };
  }

  const inputRate = pickRate(rates, provider, model, "input", at, cur);
  const outputRate = pickRate(rates, provider, model, "output", at, cur);

  const needInput = inputUnits != null && inputUnits > 0;
  const needOutput = outputUnits != null && outputUnits > 0;

  if (!inputRate && !outputRate) {
    return {
      ok: true,
      billable: true,
      costStatus: COST_STATUS_UNKNOWN_RATE,
      estimatedCost: null,
      currency: cur,
      inputCost: null,
      outputCost: null,
      provisional: null,
    };
  }

  if ((needInput && !inputRate) || (needOutput && !outputRate)) {
    return {
      ok: true,
      billable: true,
      costStatus: COST_STATUS_UNKNOWN_RATE,
      estimatedCost: null,
      currency: cur,
      inputCost: null,
      outputCost: null,
      provisional: null,
    };
  }

  let inputCost = 0;
  let outputCost = 0;

  if (inputUnits != null && inputRate) {
    const per = toNum(inputRate.perUnits);
    const price = toNum(inputRate.unitPrice);
    if (per == null || per <= 0 || price == null || price < 0) {
      return { ok: false, error: "invalid_price_rate" };
    }
    inputCost = round8((inputUnits / per) * price);
  }

  if (outputUnits != null && outputRate) {
    const per = toNum(outputRate.perUnits);
    const price = toNum(outputRate.unitPrice);
    if (per == null || per <= 0 || price == null || price < 0) {
      return { ok: false, error: "invalid_price_rate" };
    }
    outputCost = round8((outputUnits / per) * price);
  }

  const provisional =
    (inputRate ? inputRate.provisional !== false : true) &&
    (outputRate ? outputRate.provisional !== false : true);

  return {
    ok: true,
    billable: true,
    costStatus: COST_STATUS_ESTIMATED,
    estimatedCost: round8(inputCost + outputCost),
    currency: cur,
    inputCost,
    outputCost,
    provisional,
  };
}

function tokyoBucket(iso, groupBy) {
  const d = new Date(iso);
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
  if (groupBy === "month") return `${parts.year}-${parts.month}`;
  if (groupBy === "day") return `${parts.year}-${parts.month}-${parts.day}`;
  return null;
}

/**
 * @param {object[]} events
 * @param {PriceRate[]} rates
 * @param {'day'|'month'|'provider'|'model'|'feature'|'user'} groupBy
 */
export function aggregateEstimatedCost(events, rates, groupBy, currency = "USD") {
  const allowed = new Set(["day", "month", "provider", "model", "feature", "user"]);
  if (!allowed.has(groupBy)) {
    return { ok: false, error: "invalid_group_by" };
  }

  /** @type {Map<string, any>} */
  const map = new Map();

  for (const e of events || []) {
    const created = e.createdAt || e.created_at;
    let bucket;
    if (groupBy === "day" || groupBy === "month") {
      bucket = tokyoBucket(created, groupBy);
    } else if (groupBy === "provider") {
      bucket = String(e.provider || "");
    } else if (groupBy === "model") {
      bucket = String(e.model || "");
    } else if (groupBy === "feature") {
      bucket = String(e.feature || "");
    } else {
      bucket = e.user_id || e.userId || "anonymous";
    }

    if (!map.has(bucket)) {
      map.set(bucket, {
        bucket,
        eventCount: 0,
        successCount: 0,
        errorCount: 0,
        deniedCount: 0,
        unknownRateCount: 0,
        costedEventCount: 0,
        estimatedCostSum: 0,
        currency,
      });
    }
    const row = map.get(bucket);
    row.eventCount += 1;
    const status = String(e.status || "");
    if (status === "success") row.successCount += 1;
    if (status === "error") row.errorCount += 1;
    if (status === "denied") row.deniedCount += 1;

    const est = estimateEventCost(e, rates, currency);
    if (!est.ok) continue;
    if (est.costStatus === COST_STATUS_UNKNOWN_RATE) row.unknownRateCount += 1;
    if (est.estimatedCost != null) {
      row.costedEventCount += 1;
      row.estimatedCostSum = round8(row.estimatedCostSum + est.estimatedCost);
    }
  }

  const rows = [...map.values()].sort((a, b) => String(a.bucket).localeCompare(String(b.bucket)));
  return {
    ok: true,
    groupBy,
    currency,
    note: "estimated_api_cost_not_provider_invoice_not_customer_billing",
    rows,
  };
}
