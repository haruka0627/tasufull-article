/**
 * AI 秘書 Phase 6 — Priority Engine（Critical · Warning · Info）
 */
(function (global) {
  "use strict";

  const PRIORITY = Object.freeze({
    CRITICAL: "critical",
    WARNING: "warning",
    INFO: "info",
  });

  const PRIORITY_ORDER = Object.freeze([PRIORITY.CRITICAL, PRIORITY.WARNING, PRIORITY.INFO]);

  const PRIORITY_RANK = Object.freeze({
    critical: 300,
    warning: 200,
    info: 100,
  });

  function mapInsightSeverity(severity) {
    const s = String(severity || "").toLowerCase();
    if (s === "critical" || s === "high") return PRIORITY.CRITICAL;
    if (s === "warning" || s === "medium") return PRIORITY.WARNING;
    return PRIORITY.INFO;
  }

  function scoreItem(item) {
    const priority = item.priority || PRIORITY.INFO;
    const rank = PRIORITY_RANK[priority] || 100;
    const delta = Math.abs(Number(item.deltaPct) || Number(item.insight?.deltaPct) || 0);
    const domainBoost = item.domain === "platform" && priority === PRIORITY.CRITICAL ? 10 : 0;
    return rank + Math.min(delta, 100) + domainBoost;
  }

  /**
   * @param {object[]} insights
   * @returns {object[]}
   */
  function classifyInsights(insights) {
    return (Array.isArray(insights) ? insights : []).map((insight) => ({
      insightId: insight.id,
      insight,
      domain: insight.domain,
      domainLabel: insight.domainLabel,
      title: insight.title,
      summary: insight.summary,
      priority: mapInsightSeverity(insight.severity),
      deltaPct: insight.deltaPct,
      sortScore: 0,
    }));
  }

  /**
   * @param {object[]} items — classified insight items or suggestion bundles
   */
  function sortForDisplay(items) {
    return [...(Array.isArray(items) ? items : [])]
      .map((item) => ({ ...item, sortScore: scoreItem(item) }))
      .sort((a, b) => b.sortScore - a.sortScore);
  }

  function groupByPriority(items) {
    const groups = {
      [PRIORITY.CRITICAL]: [],
      [PRIORITY.WARNING]: [],
      [PRIORITY.INFO]: [],
    };
    sortForDisplay(items).forEach((item) => {
      const p = item.priority || PRIORITY.INFO;
      if (groups[p]) groups[p].push(item);
      else groups[PRIORITY.INFO].push(item);
    });
    return groups;
  }

  function priorityLabel(priority) {
    if (priority === PRIORITY.CRITICAL) return "Critical";
    if (priority === PRIORITY.WARNING) return "Warning";
    return "Info";
  }

  function priorityImpactClass(priority) {
    if (priority === PRIORITY.CRITICAL) return "critical";
    if (priority === PRIORITY.WARNING) return "high";
    return "low";
  }

  global.TasuSecretaryPriorityEngine = {
    PRIORITY,
    PRIORITY_ORDER,
    mapInsightSeverity,
    classifyInsights,
    sortForDisplay,
    groupByPriority,
    priorityLabel,
    priorityImpactClass,
    scoreItem,
  };
})(typeof window !== "undefined" ? window : globalThis);
