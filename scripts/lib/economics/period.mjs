/**
 * Economics Core V1 — period helpers (Asia/Tokyo reporting convention).
 * Aligns with Creator Program / TLV docs (JST calendar month).
 */

export const ECONOMICS_TIMEZONE = "Asia/Tokyo";

/**
 * Format a Date as YYYY-MM-DD in Asia/Tokyo.
 * @param {Date|string|number} input
 */
export function toJstDateString(input) {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ECONOMICS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  if (!y || !m || !day) return null;
  return `${y}-${m}-${day}`;
}

/**
 * @param {Date|string|number} input
 * @returns {string|null} YYYY-MM
 */
export function toJstMonthKey(input) {
  const day = toJstDateString(input);
  return day ? day.slice(0, 7) : null;
}

/**
 * Inclusive monthly bounds in UTC ISO strings for Asia/Tokyo calendar month.
 * @param {string} monthKey YYYY-MM
 */
export function monthlyPeriodBounds(monthKey) {
  const m = String(monthKey || "").trim();
  if (!/^\d{4}-\d{2}$/.test(m)) {
    return { ok: false, error: "invalid_month_key" };
  }
  const [y, mo] = m.split("-").map(Number);
  const startLocal = `${m}-01T00:00:00+09:00`;
  const nextMonth = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
  const endExclusiveLocal = `${nextMonth}-01T00:00:00+09:00`;
  const start = new Date(startLocal);
  const endExclusive = new Date(endExclusiveLocal);
  const end = new Date(endExclusive.getTime() - 1);
  return {
    ok: true,
    grain: "MONTHLY",
    timezone: ECONOMICS_TIMEZONE,
    period_key: m,
    period_start: start.toISOString(),
    period_end: end.toISOString(),
  };
}

/**
 * Inclusive daily bounds for Asia/Tokyo calendar day.
 * @param {string} dayKey YYYY-MM-DD
 */
export function dailyPeriodBounds(dayKey) {
  const d = String(dayKey || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    return { ok: false, error: "invalid_day_key" };
  }
  const start = new Date(`${d}T00:00:00+09:00`);
  const endExclusive = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const end = new Date(endExclusive.getTime() - 1);
  return {
    ok: true,
    grain: "DAILY",
    timezone: ECONOMICS_TIMEZONE,
    period_key: d,
    period_start: start.toISOString(),
    period_end: end.toISOString(),
  };
}

/**
 * @param {'DAILY'|'MONTHLY'|'ALL_TIME'} grain
 * @param {string|null} [key] YYYY-MM-DD or YYYY-MM
 */
export function resolvePeriodBounds(grain, key = null) {
  if (grain === "ALL_TIME") {
    return {
      ok: true,
      grain: "ALL_TIME",
      timezone: ECONOMICS_TIMEZONE,
      period_key: "ALL_TIME",
      period_start: null,
      period_end: null,
    };
  }
  if (grain === "DAILY") return dailyPeriodBounds(key);
  if (grain === "MONTHLY") return monthlyPeriodBounds(key);
  return { ok: false, error: "invalid_grain" };
}

/**
 * @param {import('./normalize.mjs').EconomicsRecord[]} records
 * @param {{ period_start?: string|null, period_end?: string|null, period?: string|null }} bounds
 */
export function filterRecordsByPeriod(records, bounds = {}) {
  const list = Array.isArray(records) ? records : [];
  if (bounds.period_start || bounds.period_end) {
    const startMs = bounds.period_start ? new Date(bounds.period_start).getTime() : null;
    const endMs = bounds.period_end ? new Date(bounds.period_end).getTime() : null;
    return list.filter((r) => {
      const t = new Date(r.occurred_at).getTime();
      if (Number.isNaN(t)) return false;
      if (startMs != null && t < startMs) return false;
      if (endMs != null && t > endMs) return false;
      return true;
    });
  }
  if (bounds.period) {
    return list.filter((r) => r.period === bounds.period);
  }
  return list;
}
