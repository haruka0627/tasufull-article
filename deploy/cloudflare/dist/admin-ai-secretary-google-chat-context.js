/**
 * AI秘書 Phase 3c-1 — Unified Google Chat Context v2
 * sessionStorage · TTL · gmail list/focus + lastTurn · no DOM/console exposure of internal ids
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "tasu_secretary_chat_google_ctx_v2";
  const LEGACY_GMAIL_KEY = "tasu_secretary_chat_gmail_ctx_v1";
  const SCHEMA_VERSION = "chat_google_ctx_v2";
  const TTL_MS = 15 * 60 * 1000;
  const BODY_PREVIEW_MAX = 1500;
  const ASSISTANT_PREVIEW_MAX = 800;
  const USER_TEXT_PREVIEW_MAX = 200;

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

  function emptyStore() {
    return {
      savedAt: new Date().toISOString(),
      schemaVersion: SCHEMA_VERSION,
      gmail: { list: null, focus: null, replyPlan: null, pendingGate: null },
      calendar: { list: null },
      lastTurn: null,
    };
  }

  function clearLegacyGmailKey() {
    try {
      global.sessionStorage?.removeItem(LEGACY_GMAIL_KEY);
    } catch {
      /* ignore */
    }
  }

  function writeStore(ctx) {
    ctx.savedAt = new Date().toISOString();
    ctx.schemaVersion = SCHEMA_VERSION;
    try {
      global.sessionStorage?.setItem(STORAGE_KEY, JSON.stringify(ctx));
      clearLegacyGmailKey();
    } catch {
      /* ignore */
    }
  }

  function getStore() {
    const ctx = readRaw();
    if (!ctx || ctx.schemaVersion !== SCHEMA_VERSION || isExpired(ctx)) {
      clear();
      return null;
    }
    return ctx;
  }

  function ensureStore() {
    return getStore() || emptyStore();
  }

  function mapListItems(messages) {
    messages = Array.isArray(messages) ? messages : [];
    return messages
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
  }

  function toGmailListLegacyShape(ctx) {
    const list = ctx?.gmail?.list;
    if (!list?.items?.length) return null;
    return {
      savedAt: ctx.savedAt,
      sourceIntent: list.sourceIntent || "",
      label: list.label || "",
      items: list.items,
    };
  }

  function safeFocusPreview(focus) {
    if (!focus) return null;
    return {
      index: focus.index || 0,
      subject: focus.subject || "",
      from: focus.from || "",
      snippet: focus.snippet || "",
      date: focus.date || "",
      bodyPreview: focus.bodyPreview || "",
      bodyTruncated: Boolean(focus.bodyTruncated),
      hasAttachment: Boolean(focus.hasAttachment),
      attachmentNames: Array.isArray(focus.attachmentNames) ? focus.attachmentNames.slice() : [],
    };
  }

  function safeLastTurn(turn) {
    if (!turn) return null;
    return {
      sourceIntent: turn.sourceIntent || "",
      userTextPreview: turn.userTextPreview || "",
      assistantPreview: turn.assistantPreview || "",
      kind: turn.kind || "gmail",
    };
  }

  function saveGmailList(messages, meta) {
    meta = meta || {};
    const ctx = ensureStore();
    ctx.gmail.list = {
      sourceIntent: trim(meta.sourceIntent, 40),
      label: trim(meta.label, 120),
      items: mapListItems(messages),
    };
    writeStore(ctx);
    return toGmailListLegacyShape(ctx);
  }

  function saveGmailFocus(message, meta) {
    message = message || {};
    meta = meta || {};
    const ctx = ensureStore();
    const rawBody = trim(message.bodyText, 4000);
    let bodyPreview = rawBody.slice(0, BODY_PREVIEW_MAX);
    const bodyTruncated =
      Boolean(message.bodyTruncated) || rawBody.length > BODY_PREVIEW_MAX || bodyPreview.length >= BODY_PREVIEW_MAX;
    if (bodyTruncated && bodyPreview.length >= BODY_PREVIEW_MAX) {
      bodyPreview = bodyPreview.slice(0, BODY_PREVIEW_MAX - 1) + "…";
    }
    if (!bodyPreview) {
      bodyPreview = trim(message.snippet, BODY_PREVIEW_MAX);
    }

    const attachments = Array.isArray(message.attachments) ? message.attachments : [];
    ctx.gmail.focus = {
      index: Number(meta.index ?? meta.pickIndex) || 0,
      id: trim(message.id, 120),
      threadId: trim(message.threadId, 120),
      subject: trim(message.subject, 200),
      from: trim(message.from, 200),
      snippet: trim(message.snippet, 300),
      date: trim(message.date, 80),
      bodyPreview,
      bodyTruncated,
      hasAttachment: Boolean(message.hasAttachment),
      attachmentNames: attachments
        .slice(0, 5)
        .map((a) => trim(a.filename, 80))
        .filter(Boolean),
      sourceIntent: trim(meta.sourceIntent, 40),
    };
    writeStore(ctx);
    return safeFocusPreview(ctx.gmail.focus);
  }

  function mapCalendarItems(events) {
    events = Array.isArray(events) ? events : [];
    return events
      .map((ev, i) => ({
        index: i + 1,
        id: trim(ev.id, 120),
        title: trim(ev.title || ev.summary, 200) || "(無題)",
        start: trim(ev.start, 80),
        end: trim(ev.end, 80),
        location: trim(ev.location, 120),
        allDay: Boolean(ev.allDay),
      }))
      .filter((x) => x.title || x.start);
  }

  function toCalendarListShape(ctx) {
    const list = ctx?.calendar?.list;
    if (!list?.items?.length) return null;
    return {
      savedAt: ctx.savedAt,
      sourceIntent: list.sourceIntent || "",
      label: list.label || "",
      preset: list.preset || "",
      items: list.items.map((item) => ({
        index: item.index,
        title: item.title,
        start: item.start,
        end: item.end,
        location: item.location,
        allDay: item.allDay,
      })),
    };
  }

  function saveCalendarList(events, meta) {
    meta = meta || {};
    const ctx = ensureStore();
    ctx.calendar = ctx.calendar || { list: null };
    ctx.calendar.list = {
      sourceIntent: trim(meta.sourceIntent, 40),
      label: trim(meta.label, 120),
      preset: trim(meta.preset, 40),
      items: mapCalendarItems(events),
    };
    writeStore(ctx);
    return toCalendarListShape(ctx);
  }

  function saveLastTurn(meta) {
    meta = meta || {};
    const ctx = ensureStore();
    ctx.lastTurn = {
      sourceIntent: trim(meta.sourceIntent, 40),
      userTextPreview: trim(meta.userText ?? meta.userTextPreview, USER_TEXT_PREVIEW_MAX),
      assistantPreview: trim(meta.assistantText ?? meta.assistantPreview, ASSISTANT_PREVIEW_MAX),
      kind: trim(meta.kind, 20) || "gmail",
    };
    writeStore(ctx);
    return safeLastTurn(ctx.lastTurn);
  }

  function getGmailListMeta() {
    return toGmailListLegacyShape(getStore());
  }

  function getGmailListItem(n) {
    const ctx = getStore();
    const items = ctx?.gmail?.list?.items;
    if (!items?.length) return null;
    const idx = Number(n);
    if (!Number.isFinite(idx) || idx < 1) return null;
    return items.find((x) => x.index === idx) || null;
  }

  function getGmailListFirst() {
    const ctx = getStore();
    const items = ctx?.gmail?.list?.items;
    return items?.length ? items[0] : null;
  }

  function getGmailFocusRef() {
    const ctx = getStore();
    return ctx?.gmail?.focus || null;
  }

  function getGmailFocusPreview() {
    return safeFocusPreview(getGmailFocusRef());
  }

  function getLastTurn() {
    const ctx = getStore();
    return ctx?.lastTurn ? safeLastTurn(ctx.lastTurn) : null;
  }

  function hasGmailList() {
    return Boolean(getStore()?.gmail?.list?.items?.length);
  }

  function hasGmailFocus() {
    const focus = getStore()?.gmail?.focus;
    return Boolean(focus && focus.id);
  }

  function hasLastTurn() {
    const turn = getStore()?.lastTurn;
    return Boolean(turn && (turn.assistantPreview || turn.userTextPreview));
  }

  function getCalendarListMeta() {
    return toCalendarListShape(getStore());
  }

  function hasCalendarList() {
    return Boolean(getStore()?.calendar?.list?.items?.length);
  }

  function hasFollowUpContext() {
    return hasGmailFocus() || hasLastTurn() || hasCalendarList();
  }

  function safeReplyPlanPreview(plan) {
    if (!plan) return null;
    return {
      subject: plan.subject || "",
      bodyPreview: plan.bodyPreview || "",
      recipient: plan.recipient || "",
      reason: plan.reason || "",
    };
  }

  function saveReplyPlan(plan) {
    plan = plan || {};
    const ctx = ensureStore();
    ctx.gmail = ctx.gmail || { list: null, focus: null, replyPlan: null, pendingGate: null };
    const body = trim(plan.body ?? plan.bodyPreview, 12000);
    let bodyPreview = body.slice(0, BODY_PREVIEW_MAX);
    if (body.length > BODY_PREVIEW_MAX) {
      bodyPreview = bodyPreview.slice(0, BODY_PREVIEW_MAX - 1) + "…";
    }
    ctx.gmail.replyPlan = {
      subject: trim(plan.subject, 200),
      body,
      bodyPreview,
      recipient: trim(plan.recipient ?? plan.to, 200),
      reason: trim(plan.reason, 300),
      id: trim(plan.messageId ?? plan.id, 120),
      threadId: trim(plan.threadId, 120),
      replyToMessageId: trim(plan.replyToMessageId ?? plan.messageId ?? plan.id, 120),
      sourceIntent: trim(plan.sourceIntent, 40),
    };
    writeStore(ctx);
    return safeReplyPlanPreview(ctx.gmail.replyPlan);
  }

  function getReplyPlanRef() {
    const ctx = getStore();
    return ctx?.gmail?.replyPlan || null;
  }

  function getReplyPlanPreview() {
    return safeReplyPlanPreview(getReplyPlanRef());
  }

  function hasReplyPlan() {
    const plan = getReplyPlanRef();
    return Boolean(plan && (plan.body || plan.bodyPreview));
  }

  function savePendingGate(meta) {
    meta = meta || {};
    const ctx = ensureStore();
    ctx.gmail = ctx.gmail || { list: null, focus: null, replyPlan: null, pendingGate: null };
    ctx.gmail.pendingGate = {
      pendingId: trim(meta.pendingId, 120),
      kind: trim(meta.kind, 40) || "gmail_draft",
      state: trim(meta.state, 20) || "pending",
      sourceIntent: trim(meta.sourceIntent, 40),
    };
    writeStore(ctx);
    return { kind: ctx.gmail.pendingGate.kind, state: ctx.gmail.pendingGate.state };
  }

  function getPendingGateMeta() {
    const gate = getStore()?.gmail?.pendingGate;
    if (!gate) return null;
    return { kind: gate.kind || "", state: gate.state || "" };
  }

  function hasPendingGate() {
    const gate = getStore()?.gmail?.pendingGate;
    return Boolean(gate && gate.state === "pending" && gate.pendingId);
  }

  function clear() {
    try {
      global.sessionStorage?.removeItem(STORAGE_KEY);
      clearLegacyGmailKey();
    } catch {
      /* ignore */
    }
  }

  global.TasuSecretaryGoogleChatContext = {
    SCHEMA_VERSION,
    STORAGE_KEY,
    TTL_MS,
    BODY_PREVIEW_MAX,
    saveGmailList,
    saveGmailFocus,
    saveCalendarList,
    saveLastTurn,
    getGmailListMeta,
    getCalendarListMeta,
    getGmailListItem,
    getGmailListFirst,
    getGmailFocusRef,
    getGmailFocusPreview,
    getLastTurn,
    hasGmailList,
    hasGmailFocus,
    hasCalendarList,
    hasLastTurn,
    hasFollowUpContext,
    saveReplyPlan,
    getReplyPlanRef,
    getReplyPlanPreview,
    hasReplyPlan,
    savePendingGate,
    getPendingGateMeta,
    hasPendingGate,
    clear,
  };
})(typeof window !== "undefined" ? window : globalThis);
