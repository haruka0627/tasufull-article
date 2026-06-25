/**
 * Platform OPS-FLOW-2 — Content Gate / moderation signal → AI秘書 Daily Inbox
 */
(function (global) {
  "use strict";

  const EXTERNAL_KEY = "tasu_ops_inbox_external_v1";
  const COMPLETED_KEY = "tasu_ops_inbox_completed_v1";

  const REVIEW_EVENT_TYPES = new Set([
    "moderation.needs_review",
    "listing.pending_review",
    "listing.flagged",
    "shop.pending_review",
    "shop.flagged",
    "review.flagged",
    "attachment.unscanned",
    "attachment.flagged",
  ]);

  const CRITICAL_EVENT_TYPES = new Set(["moderation.blocked", "contact_leak_attempt"]);

  const AUTO_DONE_EVENT_TYPES = new Set(["moderation.auto_cleared", "listing.approved_auto"]);

  function readJson(key, fallback) {
    try {
      const raw = global.localStorage?.getItem(key);
      const list = raw ? JSON.parse(raw) : fallback;
      return Array.isArray(list) ? list : fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(key, data) {
    try {
      global.localStorage?.setItem(key, JSON.stringify(data));
    } catch {
      /* ignore */
    }
  }

  function readExternal() {
    return readJson(EXTERNAL_KEY, []);
  }

  function writeExternal(list) {
    writeJson(EXTERNAL_KEY, list.slice(0, 300));
  }

  function readCompletedSet() {
    return new Set(readJson(COMPLETED_KEY, []));
  }

  function writeCompletedSet(set) {
    writeJson(COMPLETED_KEY, [...set].slice(0, 500));
  }

  function inboxIdForSignal(signal) {
    return `inbox_cg_${String(signal.event_id || signal.id || "").trim()}`;
  }

  function shouldPushToInbox(type) {
    const t = String(type || "").trim();
    return (
      REVIEW_EVENT_TYPES.has(t) ||
      CRITICAL_EVENT_TYPES.has(t) ||
      AUTO_DONE_EVENT_TYPES.has(t)
    );
  }

  function signalToInboxItem(signal) {
    const enriched = global.TasuPlatformOpsActionUrl?.enrichSignal?.(signal) || signal;
    const type = String(enriched.type || "").trim();
    const critical = CRITICAL_EVENT_TYPES.has(type) || enriched.severity === "critical";
    const autoDone = AUTO_DONE_EVENT_TYPES.has(type);

    return {
      id: inboxIdForSignal(enriched),
      source: "content_gate",
      sourceId: enriched.event_id || enriched.id,
      eventType: type,
      event_id: enriched.event_id || enriched.id,
      category: autoDone ? "auto_done" : critical ? "needs_judgment" : "pending_approval",
      riskLevel: autoDone ? "low" : critical ? "critical" : "medium",
      gateLevel: autoDone ? "low" : critical ? "high" : "medium",
      title: enriched.title || type,
      target: enriched.target_id || enriched.surface || "Content Gate",
      reason: enriched.body || "",
      recommendedAction: autoDone
        ? "記録確認（自動処理済み）"
        : critical
          ? "危険内容を確認"
          : "承認または却下",
      targetUrl: enriched.action_url,
      target_type: enriched.target_type,
      target_id: enriched.target_id,
      moderation_status: autoDone
        ? "approved"
        : enriched.moderation_status || "pending_review",
      action_url: enriched.action_url,
      severity: enriched.severity || "",
      priority: autoDone ? 3 : critical ? 0 : 1,
      createdAt: enriched.at || new Date().toISOString(),
      flags: enriched.flags || [],
    };
  }

  function pushExternalSignal(signal) {
    if (!signal || !shouldPushToInbox(signal.type)) return { pushed: false, reason: "skipped" };

    const enriched = global.TasuPlatformOpsActionUrl?.enrichSignal?.(signal) || signal;
    const id = inboxIdForSignal(enriched);
    const completed = readCompletedSet();
    if (completed.has(id)) return { pushed: false, reason: "completed" };

    const list = readExternal();
    const idx = list.findIndex((x) => x.id === id);
    const item = signalToInboxItem(enriched);
    if (idx >= 0) list[idx] = { ...list[idx], ...item, updatedAt: new Date().toISOString() };
    else list.unshift({ ...item, storedAt: new Date().toISOString() });

    writeExternal(list);
    try {
      global.dispatchEvent?.(new CustomEvent("tasu:admin-daily-inbox-updated"));
    } catch {
      /* ignore */
    }
    return { pushed: true, id, item };
  }

  function collectExternalInboxItems() {
    const completed = readCompletedSet();
    return readExternal()
      .filter((row) => !completed.has(row.id))
      .map((row) => ({
        id: row.id,
        source: "content_gate",
        sourceId: row.sourceId || row.event_id,
        category: row.category || "pending_approval",
        eventType: row.eventType,
        title: row.title,
        target: row.target,
        reason: row.reason,
        recommendedAction: row.recommendedAction,
        targetUrl: row.targetUrl || row.action_url,
        target_type: row.target_type,
        target_id: row.target_id,
        moderation_status: row.moderation_status,
        action_url: row.action_url,
        severity: row.severity || "",
        priority: row.priority ?? 1,
        createdAt: row.createdAt || row.storedAt,
      }));
  }

  function completeInboxItem(id) {
    const key = String(id || "").trim();
    if (!key) return { ok: false };
    const set = readCompletedSet();
    set.add(key);
    writeCompletedSet(set);
    try {
      global.dispatchEvent?.(new CustomEvent("tasu:admin-daily-inbox-updated"));
      global.dispatchEvent?.(
        new CustomEvent("tasu:ops-content-review-completed", { detail: { id: key } })
      );
    } catch {
      /* ignore */
    }
    return { ok: true };
  }

  function completeBySource(source, sourceId) {
    const list = readExternal();
    const matches = list.filter(
      (x) => x.source === source && String(x.sourceId) === String(sourceId)
    );
    matches.forEach((m) => completeInboxItem(m.id));
    if (source === "content_gate" && sourceId) {
      completeInboxItem(`inbox_cg_${sourceId}`);
    }
    return { ok: true, count: matches.length };
  }

  function completeByReviewTarget(targetType, targetId) {
    const list = readExternal();
    list
      .filter(
        (x) =>
          String(x.target_type) === String(targetType) &&
          String(x.target_id) === String(targetId)
      )
      .forEach((m) => completeInboxItem(m.id));
    return { ok: true };
  }

  function onModerationSignal(event) {
    const detail = event?.detail;
    if (!detail?.type) return;
    pushExternalSignal(detail);
  }

  function init() {
    global.addEventListener("tasu:moderation-signal", onModerationSignal);
  }

  global.TasuPlatformOpsInboxBridge = {
    EXTERNAL_KEY,
    COMPLETED_KEY,
    pushExternalSignal,
    collectExternalInboxItems,
    completeInboxItem,
    completeBySource,
    completeByReviewTarget,
    shouldPushToInbox,
    signalToInboxItem,
    clearCompletedForTests() {
      writeCompletedSet(new Set());
      writeExternal([]);
    },
    init,
  };

  init();
})(typeof window !== "undefined" ? window : globalThis);
