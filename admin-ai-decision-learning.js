/**
 * AI運営秘書 Phase7 — Decision Learning
 * 運営者の承認・編集・保留・却下・確認履歴を保存し、次回提案の精度を上げる。
 * 高リスク・資格必須・BAN/返金/停止/非表示は自動昇格しない。
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "tasu_ai_decision_learning_v1";
  const MAX_ENTRIES = 500;
  const MIN_SAMPLES = 3;
  const MIN_APPROVAL_RATE = 0.7;

  const PROHIBITED_AUTO_EVENT_TYPES = new Set([
    "refund_consultation",
    "listing_hide_candidate",
    "report",
    "external_contact_suspect",
  ]);

  const PROHIBITED_AUTO_PATTERN = /ban|返金|停止|非表示|refund|chargeback|アカウント停止/i;

  const ACTION_LABELS = Object.freeze({
    approved: "承認",
    edited: "編集",
    dismissed: "保留",
    escalated: "確認",
    blocked: "ブロック",
  });

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

  function readDecisions() {
    const arr = readJson(STORAGE_KEY, []);
    return Array.isArray(arr) ? arr : [];
  }

  function writeDecisions(list) {
    writeJson(STORAGE_KEY, list.slice(0, MAX_ENTRIES));
  }

  function clearForTests() {
    writeJson(STORAGE_KEY, []);
  }

  function normalizeCategory(item) {
    return (
      item?.category ||
      item?.serviceCategory ||
      item?.serviceCategoryLabel ||
      item?.domain ||
      item?.eventType ||
      "general"
    );
  }

  function buildMatchCriteria(item) {
    return {
      eventType: item?.eventType || "inquiry_received",
      category: normalizeCategory(item),
      riskLevel: item?.riskLevel || "medium",
      gateLevel: item?.gateLevel || item?.gate?.gateLevel || "medium",
    };
  }

  const LICENSE_BLOCKED_STATUSES = new Set([
    "qualification_required",
    "permit_required",
    "admin_review_required",
    "prohibited_or_high_risk",
  ]);

  function isLicenseRestricted(item) {
    const license = item?.licenseResult || item?.gate?.licenseResult || {};
    const status = String(license.status || license.licenseStatus || "");
    return (
      LICENSE_BLOCKED_STATUSES.has(status) ||
      license.requiresLicense === true ||
      license.requiresPermit === true
    );
  }

  function isAutoPromotionForbidden(item) {
    const criteria = buildMatchCriteria(item);
    if (PROHIBITED_AUTO_EVENT_TYPES.has(criteria.eventType)) return true;
    if (criteria.gateLevel !== "low" || criteria.riskLevel !== "low") return true;
    if (item?.requiresOpsOnly || item?.confirmOnly || item?.sendBlocked) return true;
    if (isLicenseRestricted(item)) return true;
    const text = `${item?.aiSuggestion || ""} ${item?.aiDraftMessage || ""} ${item?.reason || ""}`;
    if (PROHIBITED_AUTO_PATTERN.test(text)) return true;
    return false;
  }

  function findSimilarDecisions(criteria) {
    const key = buildMatchCriteria(criteria);
    return readDecisions().filter((d) => {
      if (d.eventType !== key.eventType) return false;
      if (d.riskLevel !== key.riskLevel) return false;
      if (d.gateLevel !== key.gateLevel) return false;
      return true;
    });
  }

  function summarizeSimilar(criteria) {
    const similar = findSimilarDecisions(criteria);
    const counts = { approved: 0, edited: 0, dismissed: 0, escalated: 0, blocked: 0, total: similar.length };
    similar.forEach((d) => {
      const a = d.operatorAction;
      if (counts[a] != null) counts[a] += 1;
    });
    return counts;
  }

  function getRecommendation(criteria) {
    const stats = summarizeSimilar(criteria);
    const item = { ...criteria };
    if (isAutoPromotionForbidden(item)) {
      if (item.gateLevel === "high" || item.gateLevel === "prohibited" || item.riskLevel === "high") {
        return { label: "運営確認必須", promote: false, stats };
      }
      if (isLicenseRestricted(item)) {
        return { label: "資格/許可確認必須", promote: false, stats };
      }
      return { label: "自動昇格不可", promote: false, stats };
    }

    const decisionTotal = stats.approved + stats.dismissed + stats.blocked;
    if (decisionTotal < MIN_SAMPLES) {
      return { label: "判断データ不足", promote: false, stats };
    }

    const approvalRate = stats.approved / decisionTotal;
    if (approvalRate >= MIN_APPROVAL_RATE && stats.dismissed === 0 && stats.blocked === 0) {
      return { label: "自動実行候補", promote: true, stats, approvalRate };
    }
    if (approvalRate >= MIN_APPROVAL_RATE) {
      return { label: "承認傾向（要確認）", promote: false, stats, approvalRate };
    }
    if (stats.dismissed >= stats.approved) {
      return { label: "保留傾向", promote: false, stats, approvalRate };
    }
    return { label: "要確認", promote: false, stats, approvalRate };
  }

  function canPromoteToAutomation(item) {
    if (isAutoPromotionForbidden(item)) return false;
    const rec = getRecommendation(buildMatchCriteria(item));
    return rec.promote === true;
  }

  function applyLearningBoost(candidate) {
    const criteria = buildMatchCriteria(candidate);
    const rec = getRecommendation({ ...criteria, ...candidate });
    const outcome =
      global.TasuAdminAiOutcomeLearning?.applyOutcomeAdjustment?.({ ...criteria, ...candidate }) || {};
    const forbidden = isAutoPromotionForbidden(candidate);
    let promote = false;
    if (!forbidden && !outcome.blockPromote && !outcome.upgrade && !outcome.downgrade) {
      promote = rec.promote && outcome.promote === true;
    }
    const recommendation = outcome.label || rec.label;
    return {
      promote,
      recommendation,
      stats: rec.stats,
      approvalRate: rec.approvalRate,
      outcomeStats: outcome.stats,
      outcomeAdjustment: outcome,
    };
  }

  function recordDecision(entry) {
    const row = {
      id: entry.id || `dl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      sourceType: entry.sourceType || "unknown",
      eventType: entry.eventType || "",
      category: entry.category || normalizeCategory(entry),
      riskLevel: entry.riskLevel || "medium",
      gateLevel: entry.gateLevel || "medium",
      aiSuggestion: String(entry.aiSuggestion || "").slice(0, 300),
      aiDraftMessage: String(entry.aiDraftMessage || "").slice(0, 500),
      operatorAction: entry.operatorAction || "approved",
      editedMessage: String(entry.editedMessage || "").slice(0, 500),
      finalStatus: entry.finalStatus || entry.operatorAction || "",
      sourceId: entry.sourceId || "",
      createdAt: entry.createdAt || new Date().toISOString(),
    };
    const list = readDecisions();
    list.unshift(row);
    writeDecisions(list);
    try {
      global.dispatchEvent(new CustomEvent("tasu:admin-ai-decision-learning-updated"));
    } catch {
      /* ignore */
    }
    return row;
  }

  function recordFromResponsePlan(plan, operatorAction, extra) {
    if (!plan) return null;
    return recordDecision({
      sourceType: "response_plan",
      sourceId: plan.id,
      eventType: plan.eventType,
      category: plan.serviceCategory || plan.eventType,
      riskLevel: plan.riskLevel,
      gateLevel: plan.gateLevel,
      aiSuggestion: plan.aiSuggestion,
      aiDraftMessage: plan.aiDraftMessage,
      operatorAction,
      editedMessage: extra?.editedMessage || "",
      finalStatus: extra?.finalStatus || operatorAction,
      createdAt: extra?.createdAt,
    });
  }

  function recordFromAutomation(candidate, operatorAction, extra) {
    if (!candidate) return null;
    return recordDecision({
      sourceType: "automation",
      sourceId: candidate.id,
      eventType: candidate.eventType,
      category: candidate.domain || candidate.eventType,
      riskLevel: candidate.riskLevel,
      gateLevel: candidate.gateLevel || candidate.gate?.gateLevel,
      aiSuggestion: candidate.reason,
      aiDraftMessage: candidate.draftMessage,
      operatorAction,
      editedMessage: extra?.editedMessage || "",
      finalStatus: extra?.finalStatus || operatorAction,
      createdAt: extra?.createdAt,
    });
  }

  function recordFromInbox(item, operatorAction) {
    if (!item) return null;
    const sourceType =
      item.source === "response_plan"
        ? "response_plan"
        : item.source === "automation"
          ? "automation"
          : "daily_inbox";
    return recordDecision({
      sourceType,
      sourceId: item.sourceId || item.id,
      eventType: item.eventType || item.source,
      category: item.category || item.source,
      riskLevel: item.riskLevel || "medium",
      gateLevel: item.gateLevel || "medium",
      aiSuggestion: item.reason,
      aiDraftMessage: item.recommendedAction,
      operatorAction,
      finalStatus: operatorAction,
    });
  }

  function renderLearningHtml(item) {
    const criteria = buildMatchCriteria(item);
    const stats = summarizeSimilar(criteria);
    if (!stats.total) return "";

    const rec = getRecommendation({ ...criteria, ...item });
    const lines = [
      `承認 ${stats.approved}回`,
      `編集 ${stats.edited}回`,
      `保留 ${stats.dismissed}回`,
    ];
    if (stats.escalated) lines.push(`確認 ${stats.escalated}回`);
    if (stats.blocked) lines.push(`ブロック ${stats.blocked}回`);

    const promoteCls = rec.promote ? " ops-ai-learning--promote" : "";
    return (
      `<div class="ops-ai-learning${promoteCls}" data-ops-ai-learning>` +
      `<p class="ops-ai-learning__label">過去の類似判断</p>` +
      `<p class="ops-ai-learning__stats">${esc(lines.join(" / "))}</p>` +
      `<p class="ops-ai-learning__rec">推奨: <strong>${esc(rec.label)}</strong></p>` +
      `</div>`
    );
  }

  function listRecentForOps(limit) {
    return readDecisions().slice(0, limit || 20).map((d) => ({
      at: d.createdAt,
      text: `${ACTION_LABELS[d.operatorAction] || d.operatorAction}: ${d.eventType}（${d.category}）`,
      label: "判断学習",
      labelClass: d.operatorAction === "blocked" || d.operatorAction === "escalated" ? "warn" : "info",
      operatorAction: d.operatorAction,
      eventType: d.eventType,
    }));
  }

  global.TasuAdminAiDecisionLearning = {
    STORAGE_KEY,
    MIN_SAMPLES,
    MIN_APPROVAL_RATE,
    PROHIBITED_AUTO_EVENT_TYPES,
    readDecisions,
    recordDecision,
    clearForTests,
    buildMatchCriteria,
    findSimilarDecisions,
    summarizeSimilar,
    getRecommendation,
    canPromoteToAutomation,
    applyLearningBoost,
    isAutoPromotionForbidden,
    recordFromResponsePlan,
    recordFromAutomation,
    recordFromInbox,
    renderLearningHtml,
    listRecentForOps,
  };
})(typeof window !== "undefined" ? window : globalThis);
