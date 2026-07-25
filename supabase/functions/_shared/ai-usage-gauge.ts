/**
 * TASFUL AI — Usage Gauge（Edge 共有）
 * scripts/lib/ai-usage-gauge.mjs と同契約。原価・単価は返さない。
 */

export const GAUGE_THRESHOLDS = {
  comfortableMax: 0.49,
  normalMax: 0.74,
  elevatedMax: 0.89,
  lowMax: 0.99,
} as const;

export const GAUGE_STATUS_LABELS: Record<string, string> = {
  comfortable: "余裕あり",
  normal: "通常",
  elevated: "やや多い",
  low: "残り少ない",
  near_limit: "上限付近",
  stopped: "利用停止中",
  unavailable: "利用状況を取得できません",
};

export const GAUGE_STATUS_HINTS: Record<string, string> = {
  comfortable: "かなり余裕があります。",
  normal: "まだ余裕があります。",
  elevated: "半分を超えて利用しています。",
  low: "残りが少なくなっています。",
  near_limit: "まもなく上限です。更新までお待ちください。",
  stopped: "本日の利用枠に達したため、送信を停止しています。",
  unavailable: "サーバーから利用状況を取得できませんでした。",
};

const HEAVY_MODEL_NOTE =
  "高性能モデルや画像機能は、通常より利用枠を多く消費する場合があります。";

export type GaugeStatus =
  | "comfortable"
  | "normal"
  | "elevated"
  | "low"
  | "near_limit"
  | "stopped"
  | "unavailable";

export type UsageGaugePublic = {
  ok: boolean;
  periodUsed: number | null;
  periodLimit: number | null;
  remaining: number | null;
  usageRatio: number | null;
  displayPercent: number | null;
  periodStart: string | null;
  periodEnd: string | null;
  resetAt: string | null;
  status: GaugeStatus;
  statusLabel: string;
  statusHint: string;
  canExecute: boolean;
  planCode: string | null;
  planLabel: string | null;
  feature: string;
  periodKind: string;
  periodLabel: string;
  source: string;
  authoritative: boolean;
  dateJst: string;
  heavyModelNote: string;
};

export function getTokyoDateKey(now = new Date()): string {
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

export function parseTokyoDateKey(dateKey: string): { y: number; m: number; d: number } | null {
  const raw = String(dateKey || "").trim();
  const m = raw.match(/^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return { y, m: mo, d };
}

function addOneCalendarDay(parts: { y: number; m: number; d: number }) {
  const utc = Date.UTC(parts.y, parts.m - 1, parts.d, 12, 0, 0);
  const next = new Date(utc + 86400000);
  return {
    y: next.getUTCFullYear(),
    m: next.getUTCMonth() + 1,
    d: next.getUTCDate(),
  };
}

export function tokyoPeriodStartIso(dateKey: string): string | null {
  const parts = parseTokyoDateKey(dateKey);
  if (!parts) return null;
  return `${parts.y}-${String(parts.m).padStart(2, "0")}-${String(parts.d).padStart(2, "0")}T00:00:00+09:00`;
}

export function nextTokyoResetIso(dateKey: string): string | null {
  const parts = parseTokyoDateKey(dateKey) || parseTokyoDateKey(getTokyoDateKey());
  if (!parts) return null;
  const n = addOneCalendarDay(parts);
  return `${n.y}-${String(n.m).padStart(2, "0")}-${String(n.d).padStart(2, "0")}T00:00:00+09:00`;
}

export function resolveGaugeStatus(
  ratio: number,
  opts: { canExecute?: boolean; forceUnavailable?: boolean } = {}
): GaugeStatus {
  if (opts.forceUnavailable) return "unavailable";
  if (!Number.isFinite(ratio)) return "unavailable";
  if (ratio >= 1) return opts.canExecute === false ? "stopped" : "near_limit";
  if (ratio > GAUGE_THRESHOLDS.lowMax) return "near_limit";
  if (ratio > GAUGE_THRESHOLDS.elevatedMax) return "low";
  if (ratio > GAUGE_THRESHOLDS.normalMax) return "elevated";
  if (ratio > GAUGE_THRESHOLDS.comfortableMax) return "normal";
  return "comfortable";
}

export function buildUsageGauge(input: {
  used?: number | null;
  limit?: number | null;
  dateJst?: string | null;
  allowed?: boolean | null;
  planCode?: string | null;
  planLabel?: string | null;
  feature?: string | null;
  source?: string | null;
  authoritative?: boolean;
  forceUnavailable?: boolean;
}): UsageGaugePublic {
  if (input.forceUnavailable) {
    return finalize({
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

  if (input.used == null || !Number.isFinite(Number(input.used))) {
    return finalize({
      periodUsed: null,
      periodLimit: Number.isFinite(Number(input.limit)) ? Math.max(0, Number(input.limit)) : null,
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

  const periodUsed = Math.max(0, Number(input.used) || 0);

  if (input.limit == null || !Number.isFinite(Number(input.limit))) {
    return finalize({
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

  const periodLimit = Math.max(0, Number(input.limit) || 0);
  let usageRatio: number;
  let remaining: number;
  let canExecute: boolean;

  if (periodLimit === 0) {
    usageRatio = 1;
    remaining = 0;
    canExecute = false;
  } else {
    usageRatio = periodUsed / periodLimit;
    remaining = Math.max(0, periodLimit - periodUsed);
    canExecute =
      input.allowed == null ? remaining > 0 : Boolean(input.allowed) && remaining > 0;
  }

  const status = resolveGaugeStatus(periodLimit === 0 ? 1 : usageRatio, { canExecute });
  const displayRatio = periodLimit === 0 ? 1 : Math.min(Math.max(usageRatio, 0), 1);
  const displayPercent = Math.min(100, Math.max(0, Math.round(displayRatio * 100)));

  return finalize({
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

function finalize(g: {
  periodUsed: number | null;
  periodLimit: number | null;
  remaining: number | null;
  usageRatio: number | null;
  displayPercent: number | null;
  periodStart: string | null;
  periodEnd: string | null;
  resetAt: string | null;
  status: GaugeStatus;
  canExecute: boolean;
  planCode: string | null;
  planLabel: string | null;
  feature: string;
  periodKind: string;
  source: string;
  authoritative: boolean;
  dateJst: string;
}): UsageGaugePublic {
  return {
    ok: g.status !== "unavailable",
    periodUsed: g.periodUsed,
    periodLimit: g.periodLimit,
    remaining: g.remaining,
    usageRatio: g.usageRatio,
    displayPercent: g.displayPercent,
    periodStart: g.periodStart,
    periodEnd: g.periodEnd,
    resetAt: g.resetAt,
    status: g.status,
    statusLabel: GAUGE_STATUS_LABELS[g.status] || GAUGE_STATUS_LABELS.unavailable,
    statusHint: GAUGE_STATUS_HINTS[g.status] || GAUGE_STATUS_HINTS.unavailable,
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

/** Attach public usage gauge to quota status without cost fields. */
export function attachUsageGaugeToStatus(
  status: {
    ok?: boolean;
    used?: number;
    dailyLimit?: number;
    remaining?: number;
    allowed?: boolean;
    dateJst?: string;
    planCode?: string;
    planLabel?: string;
    feature?: string;
    userId?: string;
  },
  opts: { authoritative?: boolean; authMode?: string; source?: string } = {}
): Record<string, unknown> {
  const usage = buildUsageGauge({
    used: status.used,
    limit: status.dailyLimit,
    dateJst: status.dateJst,
    allowed: status.allowed,
    planCode: status.planCode,
    planLabel: status.planLabel,
    feature: status.feature,
    source: opts.source || "ai-workspace-quota",
    authoritative: opts.authoritative !== false,
  });

  const { userId: _dropUser, ...rest } = status as Record<string, unknown>;
  return {
    ...rest,
    ok: status.ok !== false,
    usage,
    authMode: opts.authMode || "claimed",
  };
}
