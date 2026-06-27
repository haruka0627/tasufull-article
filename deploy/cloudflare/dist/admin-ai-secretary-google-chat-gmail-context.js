/**
 * AI秘書 Phase 3b — Chat Gmail list context (sessionStorage · TTL · no DOM exposure)
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "tasu_secretary_chat_gmail_ctx_v1";
  const TTL_MS = 15 * 60 * 1000;

  function trim(value, max) {
    return String(value ?? "").trim().slice(0, max || 4000);
  }

  function readRaw() {
    try {
      const raw = global.sessionStorage?.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function isExpired(ctx) {
    if (!ctx?.savedAt) return true;
    const t = Date.parse(ctx.savedAt);
    return !Number.isFinite(t) || Date.now() - t > TTL_MS;
  }

  function clear() {
    try {
      global.sessionStorage?.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  function saveList(messages, meta) {
    messages = Array.isArray(messages) ? messages : [];
    meta = meta || {};
    const items = messages
      .map((m, i) => ({
        index: i + 1,
        id: trim(m.id, 120),
        threadId: trim(m.threadId, 120),
        subject: trim(m.subject, 200),
        from: trim(m.from, 200),
        snippet: trim(m.snippet, 300),
        date: trim(m.date, 80),
      }))
      .filter((x) => x.id);

    const ctx = {
      savedAt: new Date().toISOString(),
      sourceIntent: trim(meta.sourceIntent, 40),
      label: trim(meta.label, 120),
      items,
    };

    try {
      global.sessionStorage?.setItem(STORAGE_KEY, JSON.stringify(ctx));
    } catch {
      /* ignore */
    }
    return ctx;
  }

  function getContext() {
    const ctx = readRaw();
    if (!ctx || isExpired(ctx)) {
      clear();
      return null;
    }
    return ctx;
  }

  function getByIndex(n) {
    const ctx = getContext();
    if (!ctx?.items?.length) return null;
    const idx = Number(n);
    if (!Number.isFinite(idx) || idx < 1) return null;
    return ctx.items.find((x) => x.index === idx) || null;
  }

  function getLast() {
    const ctx = getContext();
    if (!ctx?.items?.length) return null;
    return ctx.items[0];
  }

  function hasContext() {
    const ctx = getContext();
    return Boolean(ctx?.items?.length);
  }

  global.TasuSecretaryGoogleChatGmailContext = {
    STORAGE_KEY,
    TTL_MS,
    saveList,
    getContext,
    getByIndex,
    getLast,
    hasContext,
    clear,
  };
})(typeof window !== "undefined" ? window : globalThis);
