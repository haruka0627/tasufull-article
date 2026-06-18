/**
 * TASFUL TALK — ブロック / 通報 / ミュート / ピン留め（mock store）
 * 将来 Supabase: talk_room_settings, talk_reports
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "tasful_talk_room_safety_v1";
  const EVENT_NAME = "tasful-talk-room-safety-changed";
  const DB_TABLE_SETTINGS = "talk_room_settings";
  const DB_TABLE_REPORTS = "talk_reports";

  const REPORT_REASONS = Object.freeze([
    { id: "nuisance", label: "迷惑行為" },
    { id: "external_redirect", label: "外部誘導" },
    { id: "spam_sales", label: "営業行為" },
    { id: "defamation", label: "誹謗中傷" },
    { id: "impersonation", label: "なりすまし" },
    { id: "other", label: "その他" },
  ]);

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function normalizeTargetId(targetId) {
    return pickStr(targetId);
  }

  function readRaw() {
    try {
      const raw = global.localStorage?.getItem(STORAGE_KEY);
      if (!raw) return { blocked: {}, muted: {}, pinned: {}, reports: [] };
      const parsed = JSON.parse(raw);
      return {
        blocked: parsed.blocked && typeof parsed.blocked === "object" ? parsed.blocked : {},
        muted: parsed.muted && typeof parsed.muted === "object" ? parsed.muted : {},
        pinned: parsed.pinned && typeof parsed.pinned === "object" ? parsed.pinned : {},
        reports: Array.isArray(parsed.reports) ? parsed.reports : [],
      };
    } catch {
      return { blocked: {}, muted: {}, pinned: {}, reports: [] };
    }
  }

  function writeRaw(next) {
    try {
      global.localStorage?.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    try {
      global.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: next }));
    } catch {
      /* ignore */
    }
  }

  function resolveTargetKey(target) {
    const threadId = pickStr(target?.threadId, target?.id);
    const userId = pickStr(target?.userId, target?.partnerUserId, target?.partner?.id);
    return threadId || userId;
  }

  function isBlocked(targetId) {
    const id = normalizeTargetId(targetId);
    return Boolean(id && readRaw().blocked[id]);
  }

  function isMuted(targetId) {
    const id = normalizeTargetId(targetId);
    return Boolean(id && readRaw().muted[id]);
  }

  function isPinned(targetId) {
    const id = normalizeTargetId(targetId);
    return Boolean(id && readRaw().pinned[id]);
  }

  function setBlocked(targetId, blocked) {
    const id = normalizeTargetId(targetId);
    if (!id) return null;
    const data = readRaw();
    if (blocked) data.blocked[id] = { at: nowIso() };
    else delete data.blocked[id];
    writeRaw(data);
    return data.blocked[id] || null;
  }

  function setMuted(targetId, muted) {
    const id = normalizeTargetId(targetId);
    if (!id) return null;
    const data = readRaw();
    if (muted) data.muted[id] = { at: nowIso() };
    else delete data.muted[id];
    writeRaw(data);
    return data.muted[id] || null;
  }

  function setPinned(targetId, pinned) {
    const id = normalizeTargetId(targetId);
    if (!id) return null;
    const data = readRaw();
    if (pinned) data.pinned[id] = { at: nowIso() };
    else delete data.pinned[id];
    writeRaw(data);
    return data.pinned[id] || null;
  }

  function toggleBlocked(targetId) {
    return setBlocked(targetId, !isBlocked(targetId));
  }

  function toggleMuted(targetId) {
    return setMuted(targetId, !isMuted(targetId));
  }

  function togglePinned(targetId) {
    return setPinned(targetId, !isPinned(targetId));
  }

  /**
   * @param {{ targetId?: string, target?: object, reasonId: string, detail?: string }} input
   */
  function submitReport(input) {
    const targetId = normalizeTargetId(
      input?.targetId || resolveTargetKey(input?.target || {})
    );
    const reasonId = pickStr(input?.reasonId);
    const reason = REPORT_REASONS.find((r) => r.id === reasonId);
    if (!targetId || !reason) return null;
    const data = readRaw();
    const row = {
      id: `rep_${Date.now()}`,
      targetId,
      reasonId,
      reasonLabel: reason.label,
      detail: pickStr(input?.detail),
      createdAt: nowIso(),
      status: "submitted",
    };
    data.reports = [row, ...data.reports].slice(0, 200);
    writeRaw(data);
    return row;
  }

  global.TasuTalkRoomSafetyStore = {
    STORAGE_KEY,
    EVENT_NAME,
    DB_TABLE_SETTINGS,
    DB_TABLE_REPORTS,
    REPORT_REASONS,
    readRaw,
    resolveTargetKey,
    isBlocked,
    isMuted,
    isPinned,
    setBlocked,
    setMuted,
    setPinned,
    toggleBlocked,
    toggleMuted,
    togglePinned,
    submitReport,
  };
})(typeof window !== "undefined" ? window : globalThis);
