/**
 * AI運営秘書 Phase8 — Outcome Learning
 * AI対応・自動処理・運営判断の「結果」を記録し、次回提案・自動化に反映する。
 * 個人情報は保存しない。unknown のまま自動昇格しない。
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "tasu_ai_outcome_learning_v1";
  const MAX_ENTRIES = 500;
  const MIN_OUTCOME_SAMPLES = 3;
  const MIN_RESOLVED_RATE = 0.85;
  const MAX_REOPENED_RATE = 0.15;
  const MAX_COMPLAINT_RATE = 0.1;

  const OUTCOMES = Object.freeze({
    unknown: "unknown",
    resolved: "resolved",
    reopened: "reopened",
    complaint: "complaint",
    escalated: "escalated",
  });

  const PII_PATTERN =
    /(?:0\d{1,4}[-\s]?\d{1,4}[-\s]?\d{3,4})|(?:\d{3}-\d{4})|(?:〒?\d{3}-?\d{4})|(?:[^\s@]+@[^\s@]+\.[^\s@]+)|(?:マイナンバー|免許番号|証明書番号|電話番号|住所)/gi;

  const OPEN_TICKET_STATUSES = new Set(["open", "needs_review", "in_progress", "ai_replied"]);

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function readJson(key, fallback) {
    try {
      const raw = global.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(key, data) {
    global.localStorage.setItem(key, JSON.stringify(data));
  }

  function sanitizeText(text) {
    return String(text || "")
      .replace(PII_PATTERN, "[伏せ字]")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 300);
  }

  function readOutcomes() {
    const arr = readJson(STORAGE_KEY, []);
    return Array.isArray(arr) ? arr : [];
  }

  function writeOutcomes(list) {
    writeJson(STORAGE_KEY, list.slice(0, MAX_ENTRIES));
  }

  function clearForTests() {
    writeJson(STORAGE_KEY, []);
  }

  function emitUpdated() {
    try {
      global.dispatchEvent(new CustomEvent("tasu:admin-ai-outcome-learning-updated"));
    } catch {
      /* ignore */
    }
  }

  function buildMatchCriteria(item) {
    return {
      eventType: item?.eventType || "inquiry_received",
      category: item?.serviceCategory || item?.domain || item?.eventType || "general",
      riskLevel: item?.riskLevel || "medium",
      gateLevel: item?.gateLevel || item?.gate?.gateLevel || "medium",
    };
  }

  function isForbidden(item) {
    return global.TasuAdminAiDecisionLearning?.isAutoPromotionForbidden?.(item) === true;
  }

  function resolveRelatedTicketId(planOrCandidate) {
    if (planOrCandidate?.sourceId) return String(planOrCandidate.sourceId);
    const m = String(planOrCandidate?.id || "").match(/^support_(.+)$/);
    return m ? m[1] : "";
  }

  function recordOutcome(entry) {
    const row = {
      id: entry.id || `ol_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      decisionId: entry.decisionId || "",
      sourceType: entry.sourceType || "unknown",
      sourceId: String(entry.sourceId || ""),
      eventType: entry.eventType || "",
      category: entry.category || entry.eventType || "general",
      riskLevel: entry.riskLevel || "medium",
      gateLevel: entry.gateLevel || "medium",
      actionType: entry.actionType || "sent",
      finalMessage: sanitizeText(entry.finalMessage),
      outcome: entry.outcome || OUTCOMES.unknown,
      outcomeReason: sanitizeText(entry.outcomeReason),
      relatedTicketId: entry.relatedTicketId || "",
      relatedNotificationId: entry.relatedNotificationId || "",
      userId: entry.userId || "",
      resolvedAt: entry.resolvedAt || null,
      createdAt: entry.createdAt || new Date().toISOString(),
    };
    const list = readOutcomes();
    list.unshift(row);
    writeOutcomes(list);
    emitUpdated();
    return row;
  }

  function updateOutcome(id, patch) {
    const list = readOutcomes();
    const idx = list.findIndex((o) => o.id === id);
    if (idx < 0) return null;
    list[idx] = {
      ...list[idx],
      ...patch,
      outcomeReason: patch.outcomeReason != null ? sanitizeText(patch.outcomeReason) : list[idx].outcomeReason,
      finalMessage: patch.finalMessage != null ? sanitizeText(patch.finalMessage) : list[idx].finalMessage,
    };
    writeOutcomes(list);
    emitUpdated();
    return list[idx];
  }

  function findSimilarOutcomes(criteria) {
    const key = buildMatchCriteria(criteria);
    return readOutcomes().filter((o) => {
      if (o.eventType !== key.eventType) return false;
      if (o.riskLevel !== key.riskLevel) return false;
      if (o.gateLevel !== key.gateLevel) return false;
      return true;
    });
  }

  function summarizeSimilarOutcomes(criteria) {
    const similar = findSimilarOutcomes(criteria);
    const counts = {
      resolved: 0,
      reopened: 0,
      complaint: 0,
      escalated: 0,
      unknown: 0,
      total: similar.length,
    };
    similar.forEach((o) => {
      const k = o.outcome || OUTCOMES.unknown;
      if (counts[k] != null) counts[k] += 1;
    });
    const known = counts.total - counts.unknown;
    const resolvedRate = known > 0 ? counts.resolved / known : 0;
    const reopenedRate = known > 0 ? counts.reopened / known : 0;
    const complaintRate = known > 0 ? counts.complaint / known : 0;
    return { ...counts, known, resolvedRate, reopenedRate, complaintRate };
  }

  function getOutcomeRecommendation(item) {
    const stats = summarizeSimilarOutcomes(item);
    if (isForbidden(item)) {
      return {
        label: "自動昇格不可",
        promote: false,
        downgrade: false,
        upgrade: false,
        blockPromote: true,
        stats,
      };
    }

    if (stats.known < MIN_OUTCOME_SAMPLES || stats.unknown > stats.resolved) {
      return {
        label: "結果データ不足",
        promote: false,
        downgrade: false,
        upgrade: false,
        blockPromote: true,
        stats,
      };
    }

    if (stats.complaint > 0 && stats.complaintRate >= MAX_COMPLAINT_RATE) {
      return {
        label: "要判断（クレームあり）",
        promote: false,
        downgrade: false,
        upgrade: true,
        blockPromote: true,
        stats,
      };
    }

    if (stats.reopenedRate >= MAX_REOPENED_RATE) {
      return {
        label: "承認待ち（再問い合わせ多）",
        promote: false,
        downgrade: true,
        upgrade: false,
        blockPromote: true,
        stats,
      };
    }

    if (stats.resolvedRate >= MIN_RESOLVED_RATE && stats.complaint === 0) {
      return {
        label: "自動実行候補",
        promote: true,
        downgrade: false,
        upgrade: false,
        blockPromote: false,
        stats,
      };
    }

    return {
      label: "要確認",
      promote: false,
      downgrade: false,
      upgrade: false,
      blockPromote: true,
      stats,
    };
  }

  function applyOutcomeAdjustment(item) {
    return getOutcomeRecommendation({ ...buildMatchCriteria(item), ...item });
  }

  function createPendingFromResponsePlan(plan, extra) {
    if (!plan) return null;
    if (extra?.actionType === "escalated") {
      return recordOutcome({
        decisionId: extra?.decisionId || "",
        sourceType: "response_plan",
        sourceId: plan.sourceId || plan.id,
        eventType: plan.eventType,
        category: plan.serviceCategory || plan.eventType,
        riskLevel: plan.riskLevel,
        gateLevel: plan.gateLevel,
        actionType: "escalated",
        finalMessage: plan.aiDraftMessage,
        outcome: OUTCOMES.escalated,
        outcomeReason: extra?.outcomeReason || "運営確認に回しました",
        relatedTicketId: resolveRelatedTicketId(plan),
        relatedNotificationId: extra?.notificationId || "",
        userId: plan.targetUserId || "",
      });
    }
    return recordOutcome({
      decisionId: extra?.decisionId || "",
      sourceType: "response_plan",
      sourceId: plan.sourceId || plan.id,
      eventType: plan.eventType,
      category: plan.serviceCategory || plan.eventType,
      riskLevel: plan.riskLevel,
      gateLevel: plan.gateLevel,
      actionType: extra?.actionType || "sent",
      finalMessage: plan.aiDraftMessage,
      outcome: OUTCOMES.unknown,
      outcomeReason: "",
      relatedTicketId: resolveRelatedTicketId(plan),
      relatedNotificationId: extra?.notificationId || "",
      userId: plan.targetUserId || "",
    });
  }

  function createPendingFromAutomation(candidate, extra) {
    if (!candidate) return null;
    if (extra?.actionType === "escalated") {
      return recordOutcome({
        decisionId: extra?.decisionId || "",
        sourceType: "automation",
        sourceId: candidate.id,
        eventType: candidate.eventType,
        category: candidate.domain || candidate.eventType,
        riskLevel: candidate.riskLevel,
        gateLevel: candidate.gateLevel || candidate.gate?.gateLevel,
        actionType: "escalated",
        finalMessage: candidate.draftMessage,
        outcome: OUTCOMES.escalated,
        outcomeReason: extra?.outcomeReason || "自動処理を運営確認へ",
        relatedTicketId: resolveRelatedTicketId(candidate),
        relatedNotificationId: extra?.notificationId || "",
        userId: candidate.targetUserId || "",
      });
    }
    return recordOutcome({
      decisionId: extra?.decisionId || "",
      sourceType: "automation",
      sourceId: candidate.id,
      eventType: candidate.eventType,
      category: candidate.domain || candidate.eventType,
      riskLevel: candidate.riskLevel,
      gateLevel: candidate.gateLevel || candidate.gate?.gateLevel,
      actionType: extra?.actionType || "executed",
      finalMessage: candidate.draftMessage,
      outcome: OUTCOMES.unknown,
      outcomeReason: "",
      relatedTicketId: resolveRelatedTicketId(candidate),
      relatedNotificationId: extra?.notificationId || "",
      userId: candidate.targetUserId || "",
    });
  }

  function ticketMatchesOutcome(ticket, outcome) {
    if (!ticket || !outcome) return false;
    const text = `${ticket.title || ""}\n${ticket.body || ""}`;
    if (outcome.eventType === "payment_pending" && /支払い|決済|payment/i.test(text)) return true;
    if (outcome.eventType === "inquiry_received") return true;
    if (outcome.eventType === "refund_consultation" && /返金|refund/i.test(text)) return true;
    if (outcome.eventType === "connect_incomplete" && ticket.category === "connect_issue") return true;
    return ticket.category === outcome.category || ticket.category === outcome.eventType;
  }

  function isComplaintTicket(ticket) {
    const text = `${ticket.title || ""}\n${ticket.body || ""}`;
    return (
      ["abuse_or_policy", "legal_or_risk"].includes(ticket.category) ||
      ticket.severity === "critical" ||
      /通報|クレーム|complaint|report/i.test(text)
    );
  }

  function syncSupportResolved() {
    const store = global.TasuSupportTicketStore;
    if (!store?.getTicket) return 0;
    let n = 0;
    readOutcomes()
      .filter((o) => o.outcome === OUTCOMES.unknown && o.relatedTicketId)
      .forEach((o) => {
        const ticket = store.getTicket(o.relatedTicketId);
        if (ticket?.status === "resolved") {
          updateOutcome(o.id, {
            outcome: OUTCOMES.resolved,
            resolvedAt: ticket.resolved_at || new Date().toISOString(),
            outcomeReason: "Supportチケット解決済み",
          });
          n += 1;
        }
      });
    return n;
  }

  function syncSupportReopened() {
    const store = global.TasuSupportTicketStore;
    if (!store?.listTickets) return 0;
    const tickets = store.listTickets() || [];
    const latestResolved = new Map();
    readOutcomes()
      .filter((o) => o.outcome === OUTCOMES.resolved)
      .forEach((o) => {
        const key = `${o.userId || ""}|${o.eventType || ""}`;
        const prev = latestResolved.get(key);
        if (!prev || String(o.resolvedAt || o.createdAt) > String(prev.resolvedAt || prev.createdAt)) {
          latestResolved.set(key, o);
        }
      });

    let n = 0;
    latestResolved.forEach((o) => {
      const reopened = tickets.find(
        (t) =>
          OPEN_TICKET_STATUSES.has(t.status) &&
          t.user_id &&
          o.userId &&
          t.user_id === o.userId &&
          t.id !== o.relatedTicketId &&
          String(t.created_at) > String(o.resolvedAt || o.createdAt) &&
          ticketMatchesOutcome(t, o)
      );
      if (reopened) {
        store.recordSupportReopened?.(reopened.id, "同一利用者の再問い合わせを検知", {
          priorOutcomeId: o.id,
          priorTicketId: o.relatedTicketId,
          userId: o.userId,
        });
        updateOutcome(o.id, {
          outcome: OUTCOMES.reopened,
          outcomeReason: "同一利用者の再問い合わせを検知",
        });
        n += 1;
      }
    });
    return n;
  }

  function syncComplaints() {
    const store = global.TasuSupportTicketStore;
    if (!store?.listTickets) return 0;
    const tickets = (store.listTickets() || []).filter(isComplaintTicket);
    let n = 0;
    tickets.forEach((ticket) => {
      const existingComplaint = readOutcomes().some(
        (o) => o.relatedTicketId === ticket.id && o.outcome === OUTCOMES.complaint
      );
      if (existingComplaint) return;

      const candidates = readOutcomes().filter(
        (o) =>
          (o.outcome === OUTCOMES.unknown || o.outcome === OUTCOMES.resolved) &&
          (o.userId === ticket.user_id || o.relatedTicketId === ticket.id)
      );
      if (!candidates.length && ticket.user_id) {
        store.recordSupportComplaint?.(ticket.id, "通報・高リスク・クレーム案件を検知", {
          category: ticket.category,
          severity: ticket.severity,
        });
        recordOutcome({
          sourceType: "support",
          sourceId: ticket.id,
          eventType: "report",
          category: ticket.category,
          riskLevel: "high",
          gateLevel: "high",
          actionType: "complaint",
          finalMessage: ticket.title,
          outcome: OUTCOMES.complaint,
          outcomeReason: "通報・高リスク・クレーム案件を検知",
          relatedTicketId: ticket.id,
          userId: ticket.user_id,
        });
        n += 1;
        return;
      }
      candidates.slice(0, 3).forEach((o) => {
        store.recordSupportComplaint?.(ticket.id, "通報・高リスク・クレーム案件を検知", {
          relatedOutcomeId: o.id,
          category: ticket.category,
        });
        updateOutcome(o.id, {
          outcome: OUTCOMES.complaint,
          outcomeReason: "通報・高リスク・クレーム案件を検知",
        });
        n += 1;
      });
    });
    return n;
  }

  function syncConnectResolved() {
    const resolvedArr = readJson("tasu_admin_connect_resolved_v1", []);
    const resolved = new Set(Array.isArray(resolvedArr) ? resolvedArr : []);
    if (!resolved.size) return 0;
    let n = 0;
    readOutcomes()
      .filter((o) => o.outcome === OUTCOMES.unknown && o.eventType?.includes("connect"))
      .forEach((o) => {
        const key = o.sourceId?.startsWith("connect") ? o.sourceId : `connect-${o.sourceId}`;
        if (resolved.has?.(key) || resolved.has?.(o.sourceId)) {
          updateOutcome(o.id, {
            outcome: OUTCOMES.resolved,
            resolvedAt: new Date().toISOString(),
            outcomeReason: "Connect対応完了",
          });
          n += 1;
        }
      });
    return n;
  }

  function syncAll() {
    syncSupportResolved();
    syncSupportReopened();
    syncComplaints();
    syncConnectResolved();
    return true;
  }

  function formatPercent(rate) {
    return `${Math.round((rate || 0) * 100)}%`;
  }

  function renderOutcomeHtml(item) {
    const stats = summarizeSimilarOutcomes(item);
    if (!stats.total) return "";

    const rec = getOutcomeRecommendation({ ...buildMatchCriteria(item), ...item });
    const promoteCls = rec.promote ? " ops-ai-outcome--promote" : rec.upgrade ? " ops-ai-outcome--warn" : "";
    return (
      `<div class="ops-ai-outcome${promoteCls}" data-ops-ai-outcome>` +
      `<p class="ops-ai-outcome__label">過去結果</p>` +
      `<p class="ops-ai-outcome__stats">` +
      `解決率 ${esc(formatPercent(stats.resolvedRate))} / ` +
      `再問い合わせ率 ${esc(formatPercent(stats.reopenedRate))} / ` +
      `クレーム ${esc(String(stats.complaint))}件` +
      `</p>` +
      `<p class="ops-ai-outcome__rec">推奨: <strong>${esc(rec.label)}</strong></p>` +
      `</div>`
    );
  }

  function applyInboxPriority(item) {
    const adj = applyOutcomeAdjustment(item);
    let category = item.category;
    let priority = item.priority ?? 1;
    if (adj.upgrade && category !== "auto_done") {
      category = "needs_judgment";
      priority = 0;
    } else if (adj.downgrade && category === "needs_judgment") {
      category = "pending_approval";
      priority = 1;
    } else if (adj.promote && category === "pending_approval") {
      priority = 2;
    }
    return { ...item, category, priority, outcomeAdjustment: adj };
  }

  function listRecentForOps(limit) {
    return readOutcomes().slice(0, limit || 15).map((o) => ({
      at: o.resolvedAt || o.createdAt,
      text: `結果${o.outcome}: ${o.eventType}（${o.category}）`,
      label: "結果学習",
      labelClass: o.outcome === "complaint" || o.outcome === "escalated" ? "warn" : "info",
    }));
  }

  function init() {
    syncAll();
    global.addEventListener("tasu:support-tickets-updated", syncAll);
    global.addEventListener("tasu:admin-connect-resolved", syncAll);
  }

  global.TasuAdminAiOutcomeLearning = {
    STORAGE_KEY,
    OUTCOMES,
    MIN_OUTCOME_SAMPLES,
    readOutcomes,
    recordOutcome,
    updateOutcome,
    clearForTests,
    sanitizeText,
    buildMatchCriteria,
    findSimilarOutcomes,
    summarizeSimilarOutcomes,
    getOutcomeRecommendation,
    applyOutcomeAdjustment,
    applyInboxPriority,
    createPendingFromResponsePlan,
    createPendingFromAutomation,
    syncAll,
    syncSupportReopened,
    syncComplaints,
    renderOutcomeHtml,
    listRecentForOps,
    init,
  };

  if (global.document?.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(typeof window !== "undefined" ? window : globalThis);
