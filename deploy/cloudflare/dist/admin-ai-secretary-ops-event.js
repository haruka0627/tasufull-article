/**
 * AI 秘書 Phase 5-B — OpsEvent ingest（inbox · ops-watch · CI → OpsEventV1）
 */
(function (global) {
  "use strict";

  const SCHEMA = "ops_event_v1";

  function mapSeverity(raw) {
    const s = String(raw || "").toLowerCase();
    if (s === "critical" || s === "high") return "high";
    if (s === "warning") return "medium";
    if (s === "low" || s === "normal") return "low";
    return "medium";
  }

  function toOpsEvent(partial) {
    return {
      schema: SCHEMA,
      id: String(partial.id || `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
      source: partial.source || "manual",
      category: partial.category || "general",
      severity: partial.severity || "medium",
      title: String(partial.title || "").slice(0, 200),
      summary: String(partial.summary || "").slice(0, 500),
      href: partial.href || "",
      suggestedAgents: Array.isArray(partial.suggestedAgents) ? partial.suggestedAgents : ["secretary"],
      suggestedLevel: partial.suggestedLevel || "L2",
      at: partial.at || new Date().toISOString(),
      meta: partial.meta || {},
    };
  }

  function collectFromInbox() {
    const events = [];
    const Inbox = global.TasuAdminAiDailyInbox;
    const items = Inbox?.buildInboxItems?.() || [];
    items.slice(0, 15).forEach((item, idx) => {
      events.push(
        toOpsEvent({
          id: `inbox-${item.id || idx}`,
          source: "inbox",
          category: item.category === "needs_judgment" ? "inquiry" : "inquiry",
          severity: item.priority === 0 || item.category === "needs_judgment" ? "high" : "medium",
          title: item.title || item.label || "Inbox item",
          summary: [item.reason, item.recommendedAction].filter(Boolean).join(" — ").slice(0, 500),
          href: item.targetUrl || item.href || "",
          suggestedAgents: ["secretary"],
          suggestedLevel: item.category === "needs_judgment" ? "L3" : "L2",
          at: item.createdAt || new Date().toISOString(),
          meta: { inboxCategory: item.category, source: item.source },
        })
      );
    });

    const Hub = global.TasuTalkOpsAssistant;
    const hub = Hub?.buildHubSections?.() || [];
    hub.forEach((sec) => {
      (sec.items || []).slice(0, 5).forEach((item, idx) => {
        events.push(
          toOpsEvent({
            id: `hub-${sec.id}-${idx}-${item.title}`,
            source: "inbox",
            category: sec.id === "report" ? "report" : sec.id === "builder" ? "builder_consult" : "inquiry",
            severity: item.priority === "critical" ? "high" : item.priority === "high" ? "medium" : "low",
            title: item.title || sec.title,
            summary: item.meta || sec.title,
            href: item.href || "",
            suggestedAgents: sec.id === "builder" ? ["builder"] : sec.id === "report" ? ["security"] : ["secretary"],
            suggestedLevel: sec.id === "report" ? "L3" : "L2",
            meta: { hubSection: sec.id },
          })
        );
      });
    });

    return events;
  }

  function collectFromOpsWatch() {
    const events = [];
    const snap = global.TasuAdminAiOpsWatch?.buildOpsWatchSnapshot?.();
    if (!snap) return events;

    (snap.anomalies || []).slice(0, 20).forEach((a, idx) => {
      events.push(
        toOpsEvent({
          id: `ops-watch-${a.id || idx}`,
          source: "ops_watch",
          category: "incident",
          severity: mapSeverity(a.severity),
          title: a.title || a.label || "OPS WATCH anomaly",
          summary: [a.reason, a.recommendation].filter(Boolean).join(" — ").slice(0, 500),
          href: "#ops-ai-watch",
          suggestedAgents: ["devops", "ci"],
          suggestedLevel: a.severity === "critical" ? "L3" : "L2",
          at: snap.generatedAt || new Date().toISOString(),
          meta: { watchSeverity: a.severity },
        })
      );
    });

    return events;
  }

  function collectFromCi() {
    const Ci = global.TasuSecretaryCiIngest;
    if (!Ci?.getCachedEvents) return [];
    return Ci.getCachedEvents().map((e) =>
      toOpsEvent({
        ...e,
        source: "ci",
      })
    );
  }

  let lastCollected = [];

  async function collectAllAsync(options) {
    options = options || {};
    if (options.refreshCi !== false) {
      await global.TasuSecretaryCiIngest?.refreshCiReports?.();
    }
    return collectAllSync();
  }

  function collectAllSync() {
    const byId = new Map();
    [...collectFromInbox(), ...collectFromOpsWatch(), ...collectFromCi()].forEach((ev) => {
      if (!byId.has(ev.id)) byId.set(ev.id, ev);
    });
    lastCollected = [...byId.values()];
    return lastCollected;
  }

  function getLastCollected() {
    return lastCollected.slice();
  }

  function getEventById(id) {
    return lastCollected.find((e) => e.id === String(id || "")) || null;
  }

  function summarize(events) {
    events = Array.isArray(events) ? events : [];
    const bySource = {};
    events.forEach((e) => {
      bySource[e.source] = (bySource[e.source] || 0) + 1;
    });
    return {
      total: events.length,
      bySource,
      highSeverity: events.filter((e) => e.severity === "high").length,
    };
  }

  global.TasuSecretaryOpsEvent = {
    SCHEMA,
    toOpsEvent,
    collectFromInbox,
    collectFromOpsWatch,
    collectFromCi,
    collectAllSync,
    collectAllAsync,
    summarize,
    getLastCollected,
    getEventById,
  };
})(typeof window !== "undefined" ? window : globalThis);
