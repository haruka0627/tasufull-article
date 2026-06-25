/**
 * Platform NB-1M — Content Gate イベント（AI秘書 / TALK通知向け）
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "tasu_platform_content_gate_events_v1";
  const MAX_EVENTS = 500;

  const EVENT_TYPES = Object.freeze({
    MODERATION_BLOCKED: "moderation.blocked",
    MODERATION_NEEDS_REVIEW: "moderation.needs_review",
    MODERATION_AUTO_CLEARED: "moderation.auto_cleared",
    LISTING_PENDING_REVIEW: "listing.pending_review",
    LISTING_FLAGGED: "listing.flagged",
    LISTING_APPROVED_AUTO: "listing.approved_auto",
    SHOP_PENDING_REVIEW: "shop.pending_review",
    SHOP_FLAGGED: "shop.flagged",
    REVIEW_FLAGGED: "review.flagged",
    ATTACHMENT_UNSCANNED: "attachment.unscanned",
    ATTACHMENT_FLAGGED: "attachment.flagged",
    USER_SUSPENSION_CANDIDATE: "user.suspension_candidate",
    CONTACT_LEAK_ATTEMPT: "contact_leak_attempt",
  });

  function readRaw() {
    try {
      const raw = global.localStorage?.getItem(STORAGE_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }

  function writeRaw(list) {
    try {
      global.localStorage?.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_EVENTS)));
    } catch {
      /* ignore */
    }
  }

  function record(eventType, detail) {
    const entry = {
      id: `cg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      type: String(eventType || "").trim(),
      at: new Date().toISOString(),
      detail: detail && typeof detail === "object" ? detail : {},
    };
    const list = readRaw();
    list.unshift(entry);
    writeRaw(list);
    return entry;
  }

  function listRecent(limit) {
    const n = Math.min(Number(limit) || 50, MAX_EVENTS);
    return readRaw().slice(0, n);
  }

  function countByType(type) {
    const t = String(type || "").trim();
    return readRaw().filter((e) => e.type === t).length;
  }

  function countPendingSignals() {
    const list = readRaw();
    const pendingTypes = new Set([
      EVENT_TYPES.LISTING_PENDING_REVIEW,
      EVENT_TYPES.LISTING_FLAGGED,
      EVENT_TYPES.SHOP_PENDING_REVIEW,
      EVENT_TYPES.SHOP_FLAGGED,
      EVENT_TYPES.MODERATION_NEEDS_REVIEW,
      EVENT_TYPES.REVIEW_FLAGGED,
      EVENT_TYPES.ATTACHMENT_UNSCANNED,
      EVENT_TYPES.ATTACHMENT_FLAGGED,
    ]);
    return list.filter((e) => pendingTypes.has(e.type)).length;
  }

  global.TasuPlatformContentGateEvents = {
    STORAGE_KEY,
    EVENT_TYPES,
    record,
    listRecent,
    countByType,
    countPendingSignals,
  };
})(typeof window !== "undefined" ? window : globalThis);
