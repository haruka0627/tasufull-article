/**
 * TASFUL AI Workspace — Usage Gauge（ブラウザ）
 * 計算正本は scripts/lib/ai-usage-gauge.mjs と同契約。原価・単価は扱わない。
 */
(function (global) {
  "use strict";

  const GAUGE_THRESHOLDS = Object.freeze({
    comfortableMax: 0.49,
    normalMax: 0.74,
    elevatedMax: 0.89,
    lowMax: 0.99,
  });

  const GAUGE_STATUS_LABELS = Object.freeze({
    comfortable: "余裕あり",
    normal: "通常",
    elevated: "やや多い",
    low: "残り少ない",
    near_limit: "上限付近",
    stopped: "利用停止中",
    unavailable: "利用状況を取得できません",
  });

  const GAUGE_STATUS_HINTS = Object.freeze({
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

  function getTokyoDateKey(now) {
    const d = now || new Date();
    try {
      return new Intl.DateTimeFormat("ja-JP", {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(d);
    } catch {
      return d.toISOString().slice(0, 10).replace(/-/g, "/");
    }
  }

  function parseTokyoDateKey(dateKey) {
    const raw = String(dateKey || "").trim();
    const m = raw.match(/^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})/);
    if (!m) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const day = Number(m[3]);
    if (!Number.isFinite(y) || mo < 1 || mo > 12 || day < 1 || day > 31) return null;
    return { y, m: mo, d: day };
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

  function tokyoPeriodStartIso(dateKey) {
    const parts = parseTokyoDateKey(dateKey);
    if (!parts) return null;
    return `${parts.y}-${String(parts.m).padStart(2, "0")}-${String(parts.d).padStart(2, "0")}T00:00:00+09:00`;
  }

  function nextTokyoResetIso(dateKey) {
    const parts = parseTokyoDateKey(dateKey) || parseTokyoDateKey(getTokyoDateKey());
    if (!parts) return null;
    const n = addOneCalendarDay(parts);
    return `${n.y}-${String(n.m).padStart(2, "0")}-${String(n.d).padStart(2, "0")}T00:00:00+09:00`;
  }

  function resolveGaugeStatus(ratio, opts) {
    const o = opts || {};
    if (o.forceUnavailable) return "unavailable";
    if (!Number.isFinite(ratio)) return "unavailable";
    if (ratio >= 1) return o.canExecute === false ? "stopped" : "near_limit";
    if (ratio > GAUGE_THRESHOLDS.lowMax) return "near_limit";
    if (ratio > GAUGE_THRESHOLDS.elevatedMax) return "low";
    if (ratio > GAUGE_THRESHOLDS.normalMax) return "elevated";
    if (ratio > GAUGE_THRESHOLDS.comfortableMax) return "normal";
    return "comfortable";
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

  function buildUsageGauge(input) {
    const src = input || {};
    if (src.forceUnavailable) {
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
        planCode: src.planCode || null,
        planLabel: src.planLabel || null,
        feature: src.feature || "text_turn",
        periodKind: "daily_jst",
        source: src.source || "none",
        authoritative: false,
        dateJst: src.dateJst || getTokyoDateKey(),
      });
    }

    const dateJst = String(src.dateJst || getTokyoDateKey()).trim() || getTokyoDateKey();
    const periodStart = tokyoPeriodStartIso(dateJst);
    const resetAt = nextTokyoResetIso(dateJst);
    const periodEnd = resetAt;

    if (src.used == null || !Number.isFinite(Number(src.used))) {
      return publicGaugePayload({
        periodUsed: null,
        periodLimit: Number.isFinite(Number(src.limit)) ? Math.max(0, Number(src.limit)) : null,
        remaining: null,
        usageRatio: null,
        displayPercent: null,
        periodStart,
        periodEnd,
        resetAt,
        status: "unavailable",
        canExecute: false,
        planCode: src.planCode || null,
        planLabel: src.planLabel || null,
        feature: src.feature || "text_turn",
        periodKind: "daily_jst",
        source: src.source || "incomplete",
        authoritative: Boolean(src.authoritative),
        dateJst,
      });
    }

    const periodUsed = Math.max(0, Number(src.used) || 0);

    if (src.limit == null || !Number.isFinite(Number(src.limit))) {
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
        planCode: src.planCode || null,
        planLabel: src.planLabel || null,
        feature: src.feature || "text_turn",
        periodKind: "daily_jst",
        source: src.source || "incomplete",
        authoritative: Boolean(src.authoritative),
        dateJst,
      });
    }

    const periodLimit = Math.max(0, Number(src.limit) || 0);
    let usageRatio;
    let remaining;
    let canExecute;

    if (periodLimit === 0) {
      usageRatio = 1;
      remaining = 0;
      canExecute = false;
    } else {
      usageRatio = periodUsed / periodLimit;
      remaining = Math.max(0, periodLimit - periodUsed);
      canExecute = src.allowed == null ? remaining > 0 : Boolean(src.allowed) && remaining > 0;
    }

    const status = resolveGaugeStatus(periodLimit === 0 ? 1 : usageRatio, { canExecute });
    const displayRatio = periodLimit === 0 ? 1 : Math.min(Math.max(usageRatio, 0), 1);
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
      planCode: src.planCode || null,
      planLabel: src.planLabel || null,
      feature: src.feature || "text_turn",
      periodKind: "daily_jst",
      source: src.source || "quota",
      authoritative: src.authoritative !== false,
      dateJst,
    });
  }

  function formatResetLabel(iso) {
    if (!iso) return "—";
    try {
      return new Intl.DateTimeFormat("ja-JP", {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "long",
        day: "numeric",
      }).format(new Date(iso));
    } catch {
      return String(iso);
    }
  }

  function formatCompactLine(gauge) {
    if (!gauge || gauge.status === "unavailable" || gauge.displayPercent == null) {
      return "利用状況を取得できません";
    }
    const rem =
      gauge.displayPercent == null ? "—" : `${Math.max(0, 100 - gauge.displayPercent)}%`;
    return `本日のテキスト ${gauge.displayPercent}% · 残り目安 ${rem} · ${gauge.statusLabel}`;
  }

  global.TasuAiUsageGauge = {
    GAUGE_THRESHOLDS,
    GAUGE_STATUS_LABELS,
    GAUGE_STATUS_HINTS,
    HEAVY_MODEL_NOTE,
    getTokyoDateKey,
    parseTokyoDateKey,
    tokyoPeriodStartIso,
    nextTokyoResetIso,
    resolveGaugeStatus,
    buildUsageGauge,
    formatResetLabel,
    formatCompactLine,
  };
})(typeof window !== "undefined" ? window : globalThis);
