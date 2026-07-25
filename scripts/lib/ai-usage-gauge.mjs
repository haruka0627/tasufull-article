/**
 * TASFUL AI — Usage Gauge 計算（正本）
 * 日次枠（Asia/Tokyo）に対する消費率。Provider 原価・単価・内部係数は扱わない。
 * Browser / Node / Edge から同じ契約で利用する。
 */

/** @typedef {"comfortable"|"normal"|"elevated"|"low"|"near_limit"|"stopped"|"unavailable"} GaugeStatus */

export const GAUGE_THRESHOLDS = Object.freeze({
  comfortableMax: 0.49,
  normalMax: 0.74,
  elevatedMax: 0.89,
  lowMax: 0.99,
});

export const GAUGE_STATUS_LABELS = Object.freeze({
  comfortable: "余裕あり",
  normal: "通常",
  elevated: "やや多い",
  low: "残り少ない",
  near_limit: "上限付近",
  stopped: "利用停止中",
  unavailable: "利用状況を取得できません",
});

export const GAUGE_STATUS_HINTS = Object.freeze({
  comfortable: "かなり余裕があります。",
  normal: "まだ余裕があります。",
  elevated: "半分を超えて利用しています。",
  low: "残りが少なくなっています。",
  near_limit: "まもなく上限です。更新までお待ちください。",
  stopped: "本日の利用枠に達したため、送信を停止しています。",
  unavailable: "サーバーから利用状況を取得できませんでした。",
});

const HEAVY_MODEL_NOTE =
  "高性能モデルや画像機能は、通常より利用枠を多く消費する場合があります。";

/**
 * @param {Date} [now]
 * @returns {string} e.g. 2026/07/26 (ja-JP Asia/Tokyo)
 */
export function getTokyoDateKey(now = new Date()) {
  try {
    return new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  } catch {
    return now.toISOString().slice(0, 10).replace(/-/g, "/");
  }
}

/**
 * Parse ja-JP date key or ISO date into {y,m,d} in Tokyo calendar sense.
 * @param {string} dateKey
 */
export function parseTokyoDateKey(dateKey) {
  const raw = String(dateKey || "").trim();
  const m = raw.match(/^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return { y, m: mo, d };
}

function addOneCalendarDay(parts) {
  const utc = Date.UTC(parts.y, parts.m - 1, parts.d, 12, 0, 0);
  const next = new Date(utc + 86400000);
  return {
    y: next.getUTCFullYear(),
    m: next.getUTCMonth() + 1,
    d: next.getUTCDate(),
  };
}

/**
 * Next JST midnight as ISO with +09:00 (safe across month-end / leap day).
 * @param {string} dateKey Tokyo date key for "today"
 */
export function nextTokyoResetIso(dateKey) {
  const parts = parseTokyoDateKey(dateKey) || parseTokyoDateKey(getTokyoDateKey());
  if (!parts) return null;
  const n = addOneCalendarDay(parts);
  return `${n.y}-${String(n.m).padStart(2, "0")}-${String(n.d).padStart(2, "0")}T00:00:00+09:00`;
}

/**
 * Period start ISO for the Tokyo date key (00:00+09:00).
 * @param {string} dateKey
 */
export function tokyoPeriodStartIso(dateKey) {
  const parts = parseTokyoDateKey(dateKey);
  if (!parts) return null;
  const { y, m, d } = parts;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}T00:00:00+09:00`;
}

/**
 * @param {number} ratio
 * @param {{ canExecute?: boolean, forceUnavailable?: boolean }} [opts]
 * @returns {GaugeStatus}
 */
export function resolveGaugeStatus(ratio, opts = {}) {
  if (opts.forceUnavailable) return "unavailable";
  if (!Number.isFinite(ratio)) return "unavailable";
  if (opts.canExecute === false && ratio >= 1) return "stopped";
  if (ratio >= 1) return opts.canExecute === false ? "stopped" : "near_limit";
  if (ratio > GAUGE_THRESHOLDS.lowMax) return "near_limit";
  if (ratio > GAUGE_THRESHOLDS.elevatedMax) return "low";
  if (ratio > GAUGE_THRESHOLDS.normalMax) return "elevated";
  if (ratio > GAUGE_THRESHOLDS.comfortableMax) return "normal";
  return "comfortable";
}

/**
 * @param {{
 *   used?: number|null,
 *   limit?: number|null,
 *   dateJst?: string|null,
 *   allowed?: boolean|null,
 *   planCode?: string|null,
 *   planLabel?: string|null,
 *   feature?: string|null,
 *   source?: string|null,
 *   authoritative?: boolean,
 *   forceUnavailable?: boolean,
 * }} input
 */
export function buildUsageGauge(input = {}) {
  if (input.forceUnavailable) {
    return publicGaugePayload({
      periodUsed: null,
      periodLimit: null,
      remaining: null,
      usageRatio: null,
      displayPercent: null,
      periodStart: null,
      periodEnd: null,
      resetAt: null,
      status: "unavailable",
      canExecute: false,
      planCode: input.planCode || null,
      planLabel: input.planLabel || null,
      feature: input.feature || "text_turn",
      periodKind: "daily_jst",
      source: input.source || "none",
      authoritative: false,
      dateJst: input.dateJst || getTokyoDateKey(),
    });
  }

  const dateJst = String(input.dateJst || getTokyoDateKey()).trim() || getTokyoDateKey();
  const periodStart = tokyoPeriodStartIso(dateJst);
  const resetAt = nextTokyoResetIso(dateJst);
  const periodEnd = resetAt;

  let usedRaw = input.used;
  let limitRaw = input.limit;

  if (usedRaw == null || !Number.isFinite(Number(usedRaw))) {
    return publicGaugePayload({
      periodUsed: null,
      periodLimit: Number.isFinite(Number(limitRaw)) ? Math.max(0, Number(limitRaw)) : null,
      remaining: null,
      usageRatio: null,
      displayPercent: null,
      periodStart,
      periodEnd,
      resetAt,
      status: "unavailable",
      canExecute: false,
      planCode: input.planCode || null,
      planLabel: input.planLabel || null,
      feature: input.feature || "text_turn",
      periodKind: "daily_jst",
      source: input.source || "incomplete",
      authoritative: Boolean(input.authoritative),
      dateJst,
    });
  }

  const periodUsed = Math.max(0, Number(usedRaw) || 0);

  if (limitRaw == null || !Number.isFinite(Number(limitRaw))) {
    return publicGaugePayload({
      periodUsed,
      periodLimit: null,
      remaining: null,
      usageRatio: null,
      displayPercent: null,
      periodStart,
      periodEnd,
      resetAt,
      status: "unavailable",
      canExecute: false,
      planCode: input.planCode || null,
      planLabel: input.planLabel || null,
      feature: input.feature || "text_turn",
      periodKind: "daily_jst",
      source: input.source || "incomplete",
      authoritative: Boolean(input.authoritative),
      dateJst,
    });
  }

  const periodLimit = Math.max(0, Number(limitRaw) || 0);
  let usageRatio;
  let remaining;
  let canExecute;

  if (periodLimit === 0) {
    usageRatio = periodUsed > 0 ? Number.POSITIVE_INFINITY : 1;
    remaining = 0;
    canExecute = false;
  } else {
    usageRatio = periodUsed / periodLimit;
    remaining = Math.max(0, periodLimit - periodUsed);
    canExecute = input.allowed == null ? remaining > 0 : Boolean(input.allowed) && remaining > 0;
  }

  const status = resolveGaugeStatus(
    periodLimit === 0 ? 1 : usageRatio,
    { canExecute, forceUnavailable: false }
  );

  const displayRatio = periodLimit === 0 ? 1 : Math.min(usageRatio, 1);
  const displayPercent = Math.min(100, Math.max(0, Math.round(displayRatio * 100)));

  return publicGaugePayload({
    periodUsed,
    periodLimit,
    remaining,
    usageRatio: Number.isFinite(usageRatio) ? usageRatio : 1,
    displayPercent,
    periodStart,
    periodEnd,
    resetAt,
    status,
    canExecute,
    planCode: input.planCode || null,
    planLabel: input.planLabel || null,
    feature: input.feature || "text_turn",
    periodKind: "daily_jst",
    source: input.source || "quota",
    authoritative: input.authoritative !== false,
    dateJst,
  });
}

function publicGaugePayload(g) {
  const status = g.status;
  return {
    ok: status !== "unavailable",
    periodUsed: g.periodUsed,
    periodLimit: g.periodLimit,
    remaining: g.remaining,
    usageRatio: g.usageRatio,
    displayPercent: g.displayPercent,
    periodStart: g.periodStart,
    periodEnd: g.periodEnd,
    resetAt: g.resetAt,
    status,
    statusLabel: GAUGE_STATUS_LABELS[status] || GAUGE_STATUS_LABELS.unavailable,
    statusHint: GAUGE_STATUS_HINTS[status] || GAUGE_STATUS_HINTS.unavailable,
    canExecute: Boolean(g.canExecute),
    planCode: g.planCode,
    planLabel: g.planLabel,
    feature: g.feature,
    periodKind: g.periodKind,
    periodLabel: "本日",
    source: g.source,
    authoritative: Boolean(g.authoritative),
    dateJst: g.dateJst,
    heavyModelNote: HEAVY_MODEL_NOTE,
  };
}

/**
 * Strip any accidental cost / secret fields from a gauge-like object.
 * @param {Record<string, unknown>} raw
 */
export function sanitizePublicUsageResponse(raw) {
  if (!raw || typeof raw !== "object") return { ok: false, error: "invalid_response" };
  const gauge = raw.usage && typeof raw.usage === "object" ? raw.usage : raw;
  const allowed = new Set([
    "ok",
    "periodUsed",
    "periodLimit",
    "remaining",
    "usageRatio",
    "displayPercent",
    "periodStart",
    "periodEnd",
    "resetAt",
    "status",
    "statusLabel",
    "statusHint",
    "canExecute",
    "planCode",
    "planLabel",
    "feature",
    "periodKind",
    "periodLabel",
    "source",
    "authoritative",
    "dateJst",
    "heavyModelNote",
    "authMode",
  ]);
  const forbidden = [
    "unit_price",
    "estimated_cost",
    "cost",
    "price",
    "profit",
    "weight",
    "multiplier",
    "service_role",
    "prompt",
    "response",
    "messages",
  ];
  for (const key of Object.keys(gauge)) {
    if (forbidden.includes(key) || /cost|price|secret|prompt|response/i.test(key)) {
      /* drop */
    }
  }
  const usage = {};
  for (const key of allowed) {
    if (key in gauge && gauge[key] !== undefined) usage[key] = gauge[key];
  }
  return {
    ok: Boolean(raw.ok !== false && usage.status !== "unavailable"),
    usage,
  };
}

export default {
  GAUGE_THRESHOLDS,
  GAUGE_STATUS_LABELS,
  GAUGE_STATUS_HINTS,
  getTokyoDateKey,
  parseTokyoDateKey,
  nextTokyoResetIso,
  tokyoPeriodStartIso,
  resolveGaugeStatus,
  buildUsageGauge,
  sanitizePublicUsageResponse,
};
