/**
 * AI運営秘書 Phase12 — Approved Auto Fix & Human Send Gate
 * 利用者へ影響する処理は必ず運営承認を通す（AI単独送信禁止）。
 */
(function (global) {
  "use strict";

  const PENDING_KEY = "tasu_ai_human_send_gate_pending_v1";
  const EXEC_LOG_KEY = "tasu_ai_execution_log_v1";
  const MAX_PENDING = 80;
  const MAX_LOG = 200;

  const HUMAN_SEND_CATEGORIES = new Set([
    "user_reply",
    "support_answer",
    "notification_send",
    "connect_guidance",
    "complaint_response",
    "anpi_check",
    "builder_communication",
  ]);

  const INTERNAL_CATEGORIES = new Set([
    "faq_register",
    "learning_register",
    "autofix_generate",
    "kpi_update",
    "ops_watch_update",
    "automation_exclude",
    "move_to_pending",
    "approval_rollback",
    "form_improvement",
    "learning_reeval",
  ]);

  const AUTOFIX_CATEGORY_MAP = {
    automation_exclude: { category: "automation_exclude", actionType: "internal" },
    automation_pause: { category: "automation_exclude", actionType: "internal" },
    automation_failure_rate: { category: "automation_exclude", actionType: "internal" },
    approval_rollback: { category: "move_to_pending", actionType: "internal" },
    complaint_review: { category: "complaint_response", actionType: "human_send" },
    escalated_increase: { category: "support_answer", actionType: "human_send" },
    learning_reeval: { category: "learning_reeval", actionType: "internal" },
    automation_degraded: { category: "learning_reeval", actionType: "internal" },
    identity_guide: { category: "connect_guidance", actionType: "human_send" },
    faq_candidate: { category: "faq_register", actionType: "internal" },
    form_improvement: { category: "form_improvement", actionType: "internal" },
  };

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

  function clearForTests() {
    writeJson(PENDING_KEY, []);
    writeJson(EXEC_LOG_KEY, []);
  }

  function emitUpdated() {
    try {
      global.dispatchEvent(new CustomEvent("tasu:admin-ai-human-send-gate-updated"));
    } catch {
      /* ignore */
    }
  }

  function isHumanSendCategory(category) {
    return HUMAN_SEND_CATEGORIES.has(String(category || ""));
  }

  function readPendingQueue() {
    const arr = readJson(PENDING_KEY, []);
    return (Array.isArray(arr) ? arr : []).filter((p) => p.status === "pending");
  }

  function readAllPending() {
    return readJson(PENDING_KEY, []);
  }

  function savePendingList(list) {
    writeJson(PENDING_KEY, list.slice(0, MAX_PENDING));
    emitUpdated();
  }

  function appendExecutionLog(entry) {
    const list = readJson(EXEC_LOG_KEY, []);
    list.unshift({
      actionId: entry.actionId || entry.id || `exec_${Date.now()}`,
      category: entry.category || "",
      source: entry.source || "",
      approvedBy: entry.approvedBy || "operator",
      approvedAt: entry.approvedAt || new Date().toISOString(),
      executedAt: entry.executedAt || new Date().toISOString(),
      result: entry.result || "unknown",
      outcome: entry.outcome || "",
      status: entry.status || "executed",
      detail: entry.detail || "",
    });
    writeJson(EXEC_LOG_KEY, list.slice(0, MAX_LOG));
  }

  function readExecutionLog(limit) {
    const arr = readJson(EXEC_LOG_KEY, []);
    return (Array.isArray(arr) ? arr : []).slice(0, limit || 30);
  }

  function makePendingItem(partial) {
    const now = new Date().toISOString();
    return {
      id: partial.id || `hsg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      status: "pending",
      category: partial.category || "support_answer",
      actionType: partial.actionType || (isHumanSendCategory(partial.category) ? "human_send" : "internal"),
      source: partial.source || "autofix",
      sourceId: partial.sourceId || "",
      proposal: partial.proposal || partial.recommendation || "",
      recommendation: partial.recommendation || partial.proposal || "",
      reason: partial.reason || "",
      impactArea: partial.impactArea || partial.source || "Support",
      severity: partial.severity || "normal",
      confidence: partial.confidence ?? 0.7,
      createdAt: partial.createdAt || now,
      approvedBy: null,
      approvedAt: null,
      rejectedAt: null,
      payload: partial.payload || {},
    };
  }

  function enqueuePendingItem(item) {
    const list = readAllPending();
    const row = makePendingItem(item);
    const dup = list.find(
      (p) =>
        p.status === "pending" &&
        p.source === row.source &&
        p.sourceId === row.sourceId &&
        p.recommendation === row.recommendation
    );
    if (dup) return dup;
    list.unshift(row);
    savePendingList(list);
    return row;
  }

  function enqueueFromAutoFixCandidate(candidate) {
    const map = AUTOFIX_CATEGORY_MAP[candidate.category] || {
      category: candidate.source === "connect" ? "connect_guidance" : "move_to_pending",
      actionType: candidate.source === "connect" ? "human_send" : "internal",
    };
    return enqueuePendingItem({
      source: "autofix",
      sourceId: candidate.id,
      category: map.category,
      actionType: map.actionType,
      proposal: candidate.recommendation,
      recommendation: candidate.recommendation,
      reason: candidate.reason,
      impactArea: candidate.impactArea,
      severity: candidate.severity,
      confidence: candidate.confidence,
      payload: { candidateId: candidate.id, autofixCategory: candidate.category },
    });
  }

  function enqueueFromResponsePlan(plan) {
    const category =
      plan.eventType === "connect_issue" || plan.domain === "connect"
        ? "connect_guidance"
        : plan.riskLevel === "high" || plan.eventType === "abuse_or_policy"
          ? "complaint_response"
          : "support_answer";
    return enqueuePendingItem({
      source: "response_plan",
      sourceId: plan.id,
      category,
      actionType: "human_send",
      proposal: plan.aiDraftMessage || plan.title,
      recommendation: `Support回答送信: ${plan.eventTypeLabel || plan.eventType}`,
      reason: plan.reason || plan.gateReason || "AI対応案 — 送信前承認が必要",
      impactArea: "Support",
      severity: plan.riskLevel === "high" || plan.riskLevel === "critical" ? "critical" : "warning",
      confidence: 0.85,
      payload: { planId: plan.id, targetUserId: plan.targetUserId },
    });
  }

  function enqueueFromAutomation(candidate) {
    const domain = String(candidate.domain || candidate.source || "").toLowerCase();
    let category = "notification_send";
    if (domain === "connect") category = "connect_guidance";
    else if (domain === "anpi") category = "anpi_check";
    else if (domain === "builder") category = "builder_communication";
    else if (domain === "support") category = "support_answer";

    return enqueuePendingItem({
      source: "automation",
      sourceId: candidate.id,
      category,
      actionType: "human_send",
      proposal: candidate.reason || candidate.ruleName,
      recommendation: `自動処理: ${candidate.ruleName}`,
      reason: candidate.reason || "Automation Engine — 利用者影響のため承認が必要",
      impactArea: candidate.domain || "Automation",
      severity: candidate.severity === "critical" ? "critical" : "warning",
      confidence: 0.8,
      payload: { candidateId: candidate.id },
    });
  }

  function enqueueFromGmailDraft(partial) {
    partial = partial || {};
    const gmailAction = partial.gmailAction === "send" ? "send" : "draft_create";
    const subject = String(partial.subject || "(件名なし)").slice(0, 200);
    const to = String(partial.to || "").slice(0, 200);
    return enqueuePendingItem({
      source: "gmail",
      sourceId: partial.messageId || partial.threadId || "",
      category: "user_reply",
      actionType: "human_send",
      proposal: String(partial.body || partial.proposal || "").slice(0, 2000),
      recommendation:
        gmailAction === "send"
          ? `Gmail 送信確認: ${subject}`
          : `Gmail 下書き作成: ${subject} → ${to}`,
      reason: "Gmail — Human Gate 必須（自動送信禁止）",
      impactArea: "Gmail",
      severity: "warning",
      confidence: 0.9,
      payload: {
        gmailAction,
        messageId: partial.messageId || "",
        threadId: partial.threadId || "",
        replyToMessageId: partial.replyToMessageId || partial.messageId || "",
        to,
        subject,
        body: String(partial.body || "").slice(0, 12000),
        draftId: partial.draftId || "",
        chatOrigin: Boolean(partial.chatOrigin),
        chatIntent: String(partial.chatIntent || "").slice(0, 40),
      },
    });
  }

  function enqueueFromCalendarEvent(partial) {
    partial = partial || {};
    const calendarAction = partial.calendarAction || "create";
    const title = String(partial.title || "(タイトルなし)").slice(0, 200);
    const labels = {
      create: "予定作成確認",
      update: "予定変更確認",
      delete: "予定削除確認",
    };
    return enqueuePendingItem({
      source: "calendar",
      sourceId: partial.eventId || partial.calendarId || "",
      category: "notification_send",
      actionType: "human_send",
      proposal: String(partial.description || partial.proposal || title).slice(0, 2000),
      recommendation: `${labels[calendarAction] || "Calendar"}: ${title}`,
      reason: "Calendar — Human Gate 必須（自動実行禁止）",
      impactArea: "Calendar",
      severity: "warning",
      confidence: 0.9,
      payload: {
        calendarAction,
        calendarId: partial.calendarId || "primary",
        eventId: partial.eventId || "",
        title,
        start: partial.start || "",
        end: partial.end || "",
        allDay: Boolean(partial.allDay),
        location: String(partial.location || "").slice(0, 500),
        description: String(partial.description || "").slice(0, 5000),
        attendees: Array.isArray(partial.attendees) ? partial.attendees.map(String).slice(0, 20) : [],
      },
    });
  }

  function notifyChatGateHook(item, event, exec) {
    const Bridge = global.TasuSecretaryGoogleChatWriteBridge;
    if (!Bridge || item?.source !== "gmail" || !item?.payload?.chatOrigin) return;
    if (event === "reject" && Bridge.handleGateRejected) {
      Bridge.handleGateRejected(item);
    } else if (event === "execute" && Bridge.handleGateExecutionResult) {
      Bridge.handleGateExecutionResult(item, exec);
    }
  }

  function rejectPendingItem(id) {
    const list = readAllPending();
    const idx = list.findIndex((p) => p.id === id);
    if (idx < 0) return { ok: false, error: "not found" };
    list[idx] = {
      ...list[idx],
      status: "rejected",
      rejectedAt: new Date().toISOString(),
    };
    savePendingList(list);
    appendExecutionLog({
      actionId: id,
      category: list[idx].category,
      source: list[idx].source,
      result: "rejected",
      outcome: "rejected",
      status: "rejected",
      detail: list[idx].recommendation,
    });
    global.TasuAdminAiOutcomeLearning?.recordOutcome?.({
      sourceType: "human_send_gate",
      sourceId: id,
      eventType: list[idx].category,
      actionType: "rejected",
      finalMessage: list[idx].recommendation,
      outcome: "unknown",
      outcomeReason: "運営者が却下",
    });
    notifyChatGateHook(list[idx], "reject");
    return { ok: true, item: list[idx] };
  }

  function approvePendingWithoutSend(id, options) {
    options = options || {};
    const list = readAllPending();
    const idx = list.findIndex((p) => p.id === id && p.status === "pending");
    if (idx < 0) return { ok: false, error: "承認待ちが見つかりません" };
    const item = list[idx];
    if (item.source !== "orchestrator" && !options.force) {
      return { ok: false, error: "Orchestrator 項目のみ Phase 5-C 無送信承認可" };
    }
    const approvedAt = new Date().toISOString();
    list[idx] = {
      ...item,
      status: "approved",
      approvedBy: options.approvedBy || "operator",
      approvedAt,
      executedAt: null,
      executionResult: {
        ok: true,
        result: "approved_no_send",
        message: "承認記録のみ（送信未実行 · Phase 5-C）",
      },
    };
    savePendingList(list);
    appendExecutionLog({
      actionId: id,
      category: item.category,
      source: item.source,
      approvedBy: list[idx].approvedBy,
      approvedAt,
      result: "approved_no_send",
      outcome: "pending_send",
      status: "approved",
      detail: item.recommendation,
    });
    emitUpdated();
    return { ok: true, item: list[idx], noSend: true };
  }

  function updatePendingProposal(id, proposal) {
    const list = readAllPending();
    const idx = list.findIndex((p) => p.id === id && p.status === "pending");
    if (idx < 0) return { ok: false, error: "not found" };
    list[idx] = {
      ...list[idx],
      proposal: String(proposal || "").slice(0, 2000),
      recommendation: String(proposal || list[idx].recommendation).slice(0, 500),
    };
    savePendingList(list);
    return { ok: true, item: list[idx] };
  }

  function executeInternalAction(item) {
    const payload = item.payload || {};
    const AE = global.TasuAdminAiAutomationEngine;

    if (item.category === "automation_exclude" && payload.candidateId) {
      AE?.stopCandidate?.(payload.candidateId);
      return { ok: true, result: "success", outcome: "resolved", message: "自動化候補を一時除外しました" };
    }
    if (item.category === "move_to_pending" || item.category === "approval_rollback") {
      if (payload.candidateId) {
        AE?.updateCandidateState?.(payload.candidateId, { status: "scheduled" });
      }
      return { ok: true, result: "success", outcome: "resolved", message: "承認待ちへ戻しました（送信なし）" };
    }
    if (item.category === "faq_register") {
      return { ok: true, result: "success", outcome: "resolved", message: "FAQ候補を登録候補として記録しました" };
    }
    if (item.category === "learning_reeval" || item.category === "learning_register") {
      return { ok: true, result: "success", outcome: "resolved", message: "学習データ再評価を記録しました" };
    }
    if (item.category === "form_improvement") {
      return { ok: true, result: "success", outcome: "resolved", message: "入力フォーム改善候補を記録しました" };
    }
    return { ok: true, result: "success", outcome: "resolved", message: "内部アクションを記録しました" };
  }

  async function executeHumanSendAction(item) {
    const payload = item.payload || {};
    const gateOpts = { fromHumanSendGate: true, approved: true };

    if (item.source === "response_plan" && payload.planId) {
      const res = global.TasuAdminAiResponsePlans?.sendPlan?.(payload.planId, gateOpts);
      if (res?.blocked || res?.escalated) {
        return {
          ok: !!res?.ok,
          result: res?.escalated ? "escalated" : "blocked",
          outcome: res?.escalated ? "escalated" : "unknown",
          message: res?.message,
          raw: res,
        };
      }
      return {
        ok: !!res?.ok,
        result: res?.ok ? "success" : "failed",
        outcome: res?.ok ? "resolved" : "unknown",
        message: res?.message,
        raw: res,
      };
    }

    if (item.source === "automation" && payload.candidateId) {
      const res = global.TasuAdminAiAutomationEngine?.executeCandidate?.(payload.candidateId, gateOpts);
      return {
        ok: !!res?.ok,
        result: res?.executed ? "success" : res?.escalated ? "escalated" : "failed",
        outcome: res?.executed ? "resolved" : res?.escalated ? "escalated" : "unknown",
        message: res?.message,
        raw: res,
      };
    }

    if (item.category === "connect_guidance") {
      return {
        ok: true,
        result: "success",
        outcome: "resolved",
        message: "Connect案内を承認済みとして記録しました（ガイド改善候補）",
      };
    }

    if (item.source === "gmail") {
      const Gmail = global.TasuSecretaryGoogleGmailClient;
      if (!Gmail?.executeWriteApproved) {
        return { ok: false, result: "failed", outcome: "unknown", message: "Gmail client missing" };
      }
      const action = payload.gmailAction || "draft_create";
      if (action === "send") {
        if (payload.chatOrigin) {
          return {
            ok: false,
            result: "failed",
            outcome: "unknown",
            message: "Chat 由来の送信は Phase 4-2 では未対応",
          };
        }
        const sendMethod = payload.draftId ? "drafts.send" : "messages.send";
        const r = await Gmail.executeWriteApproved({
          method: sendMethod,
          pendingId: item.id,
          draftId: payload.draftId,
          to: payload.to,
          subject: payload.subject,
          body: payload.body || item.proposal,
          threadId: payload.threadId,
          replyToMessageId: payload.replyToMessageId,
        });
        return {
          ok: !!r?.ok,
          result: r?.ok ? "success" : "failed",
          outcome: r?.ok ? "resolved" : "unknown",
          message: r?.ok ? "Gmail 送信完了（Human Gate 承認後）" : String(r?.error || "send_failed"),
          raw: r,
        };
      }
      const r = await Gmail.executeWriteApproved({
        method: "drafts.create",
        pendingId: item.id,
        to: payload.to,
        subject: payload.subject,
        body: payload.body || item.proposal,
        threadId: payload.threadId,
        replyToMessageId: payload.replyToMessageId,
      });
      return {
        ok: !!r?.ok,
        result: r?.ok ? "success" : "failed",
        outcome: r?.ok ? "draft_created" : "unknown",
        message: r?.ok ? "Gmail 下書きを作成しました" : String(r?.error || "draft_failed"),
        raw: r,
      };
    }

    if (item.source === "calendar") {
      const Cal = global.TasuSecretaryGoogleCalendarClient;
      if (!Cal?.executeWriteApproved) {
        return { ok: false, result: "failed", outcome: "unknown", message: "Calendar client missing" };
      }
      const action = payload.calendarAction || "create";
      const methodMap = { create: "events.insert", update: "events.update", delete: "events.delete" };
      const method = methodMap[action] || "events.insert";
      const r = await Cal.executeWriteApproved({
        method,
        pendingId: item.id,
        calendarId: payload.calendarId,
        eventId: payload.eventId,
        title: payload.title,
        start: payload.start,
        end: payload.end,
        allDay: payload.allDay,
        location: payload.location,
        description: payload.description || item.proposal,
        attendees: payload.attendees,
      });
      const msg =
        action === "delete"
          ? "Calendar 予定を削除しました（Human Gate 承認後）"
          : action === "update"
            ? "Calendar 予定を更新しました（Human Gate 承認後）"
            : "Calendar 予定を作成しました（Human Gate 承認後）";
      return {
        ok: !!r?.ok,
        result: r?.ok ? "success" : "failed",
        outcome: r?.ok ? "resolved" : "unknown",
        message: r?.ok ? msg : String(r?.error || "calendar_write_failed"),
        raw: r,
      };
    }

    return {
      ok: true,
      result: "success",
      outcome: "resolved",
      message: "承認済み送信を記録しました",
    };
  }

  async function approveAndExecute(id, options) {
    const list = readAllPending();
    const idx = list.findIndex((p) => p.id === id && p.status === "pending");
    if (idx < 0) return { ok: false, error: "承認待ちが見つかりません" };

    const item = list[idx];
    const approvedAt = new Date().toISOString();
    const approvedBy = options?.approvedBy || "operator";

    let exec;
    if (item.actionType === "human_send" || isHumanSendCategory(item.category)) {
      exec = await executeHumanSendAction(item);
    } else {
      exec = executeInternalAction(item);
    }

    const payload = item.payload || {};
    const chatDraftRetry =
      exec.ok === false &&
      item.source === "gmail" &&
      payload.chatOrigin &&
      (payload.gmailAction || "draft_create") === "draft_create";

    const executedAt = new Date().toISOString();
    if (chatDraftRetry) {
      list[idx] = {
        ...item,
        status: "pending",
        lastExecutionAttemptAt: executedAt,
        lastExecutionResult: exec,
      };
    } else {
      list[idx] = {
        ...item,
        status: "approved",
        approvedBy,
        approvedAt,
        executedAt,
        executionResult: exec,
      };
    }
    savePendingList(list);

    appendExecutionLog({
      actionId: id,
      category: item.category,
      source: item.source,
      approvedBy: chatDraftRetry ? "operator" : approvedBy,
      approvedAt: chatDraftRetry ? executedAt : approvedAt,
      executedAt,
      result: exec.result || (exec.ok ? "success" : "failed"),
      outcome: exec.outcome || "unknown",
      status: chatDraftRetry ? "failed" : "approved",
      detail: item.recommendation,
    });

    notifyChatGateHook(list[idx], "execute", exec);

    global.TasuAdminAiOutcomeLearning?.recordOutcome?.({
      sourceType: "human_send_gate",
      sourceId: id,
      eventType: item.category,
      category: item.category,
      riskLevel: item.severity === "critical" ? "high" : "low",
      gateLevel: item.actionType === "human_send" ? "medium" : "low",
      actionType: "approved",
      finalMessage: item.proposal || item.recommendation,
      outcome:
        exec.outcome === "resolved"
          ? "resolved"
          : exec.outcome === "escalated"
            ? "escalated"
            : exec.outcome === "reopened"
              ? "reopened"
              : exec.outcome === "complaint"
                ? "complaint"
                : exec.ok
                  ? "resolved"
                  : "unknown",
      outcomeReason: exec.message || item.reason,
      userId: item.payload?.targetUserId || "",
      relatedTicketId: item.payload?.planId || "",
    });

    emitUpdated();
    global.TasuAdminAiOpsWatch?.renderOpsWatchPanel?.("[data-ops-ai-watch]");
    global.TasuAdminAiKpiCenter?.renderKpiCenterPanel?.("[data-ops-ai-kpi-center]");

    return { ok: exec.ok !== false, approved: true, executed: exec, item: list[idx] };
  }

  function shouldQueueResponsePlan(plan, options) {
    if (options?.fromHumanSendGate) return false;
    if (!plan) return false;
    if (plan.status === "sent" || plan.status === "dismissed") return false;
    const gate = global.TasuAdminAiResponseSafetyLicenseGate?.evaluateGate?.(plan) || {};
    if (gate.sendBlocked || gate.gateLevel === "prohibited") return false;
    if (gate.confirmOnly || gate.gateLevel === "high") return false;
    return !!(plan.sendAllowed || gate.sendAllowed || gate.gateLevel === "low" || gate.gateLevel === "medium");
  }

  function shouldQueueAutomation(candidate, gate, options) {
    if (options?.fromHumanSendGate) return false;
    if (!candidate) return false;
    if (gate?.sendBlocked || gate?.gateLevel === "prohibited") return false;
    if (gate?.confirmOnly || candidate.requiresOpsOnly) return false;
    return gate?.gateLevel === "low" || gate?.gateLevel === "medium" || candidate.autoExecutable;
  }

  function buildHumanSendGateSnapshot() {
    const pending = readPendingQueue();
    return {
      generatedAt: new Date().toISOString(),
      summary: {
        pendingCount: pending.length,
        criticalCount: pending.filter((p) => p.severity === "critical").length,
        warningCount: pending.filter((p) => p.severity === "warning").length,
        normalCount: pending.filter((p) => p.severity === "normal").length,
      },
      pending,
      recentLog: readExecutionLog(8),
    };
  }

  function renderPendingCard(item) {
    const conf = Math.round((item.confidence || 0) * 100);
    const created = String(item.createdAt || "").slice(0, 16).replace("T", " ");
    return (
      `<article class="ops-ai-hsg-card ops-ai-hsg-card--${esc(item.severity)}" data-hsg-item="${esc(item.id)}">` +
      `<header class="ops-ai-hsg-card__head">` +
      `<span class="ops-ai-hsg-card__source">${esc(item.source)}</span>` +
      `<span class="ops-ai-hsg-card__severity ops-ai-hsg-card__severity--${esc(item.severity)}">${esc(item.severity)}</span>` +
      `</header>` +
      `<h4 class="ops-ai-hsg-card__proposal">${esc(item.proposal || item.recommendation)}</h4>` +
      `<p class="ops-ai-hsg-card__reason">${esc(item.reason)}</p>` +
      `<dl class="ops-ai-hsg-card__meta">` +
      `<div><dt>種別</dt><dd>${esc(item.category)}</dd></div>` +
      `<div><dt>影響</dt><dd>${esc(item.impactArea)}</dd></div>` +
      `<div><dt>confidence</dt><dd>${conf}%</dd></div>` +
      `<div><dt>作成</dt><dd>${esc(created)}</dd></div>` +
      `</dl>` +
      `<details class="ops-ai-hsg-card__details">` +
      `<summary class="ops-ai-hsg-card__detail-btn" data-hsg-detail>詳細</summary>` +
      `<p class="ops-ai-hsg-card__detail-body">${esc(item.recommendation)} — ${esc(item.reason)}</p>` +
      `</details>` +
      `<div class="ops-ai-hsg-card__actions">` +
      `<button type="button" class="ops-ai-hsg-btn ops-ai-hsg-btn--approve" data-hsg-approve="${esc(item.id)}">承認して実行</button>` +
      `<button type="button" class="ops-ai-hsg-btn ops-ai-hsg-btn--reject" data-hsg-reject="${esc(item.id)}">却下</button>` +
      `</div>` +
      `</article>`
    );
  }

  function renderHumanSendGatePanel(target) {
    const host =
      typeof target === "string"
        ? global.document?.querySelector(target)
        : target || global.document?.querySelector("[data-ops-ai-human-send-gate]");
    if (!host) return;

    const snap = buildHumanSendGateSnapshot();
    const { pending, summary } = snap;

    if (!pending.length) {
      host.innerHTML =
        `<header class="ops-ai-hsg__head">` +
        `<h2 class="ops-ai-hsg__title" id="ops-ai-hsg-heading">承認待ち</h2>` +
        `<p class="ops-ai-hsg__sub">利用者へ影響する処理は運営承認後にのみ実行されます</p>` +
        `</header>` +
        `<p class="ops-ai-hsg-empty">承認待ちはありません — AI単独送信は行いません</p>`;
      host.dataset.hsgReady = "1";
      return;
    }

    host.innerHTML =
      `<header class="ops-ai-hsg__head">` +
      `<div class="ops-ai-hsg__title-row">` +
      `<h2 class="ops-ai-hsg__title" id="ops-ai-hsg-heading">承認待ち</h2>` +
      `<span class="ops-ai-hsg__count">${summary.pendingCount}件</span>` +
      (summary.criticalCount
        ? `<span class="ops-ai-hsg-badge ops-ai-hsg-badge--critical">critical ${summary.criticalCount}</span>`
        : "") +
      (summary.warningCount
        ? `<span class="ops-ai-hsg-badge ops-ai-hsg-badge--warning">warning ${summary.warningCount}</span>`
        : "") +
      `</div>` +
      `<p class="ops-ai-hsg__sub">利用者へ影響する処理は運営承認後にのみ実行されます</p>` +
      `</header>` +
      `<div class="ops-ai-hsg__grid" data-hsg-grid>${pending.map(renderPendingCard).join("")}</div>` +
      `<p class="ops-ai-hsg-toast" data-hsg-toast hidden aria-live="polite"></p>`;

    host.dataset.hsgReady = "1";
    host.classList.toggle("ops-ai-hsg--alert", summary.criticalCount + summary.warningCount > 0);

    host.querySelectorAll("[data-hsg-approve]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-hsg-approve");
        void approveAndExecute(id).then((res) => {
          const toast = host.querySelector("[data-hsg-toast]");
          if (toast) {
            toast.hidden = false;
            toast.textContent = res.ok
              ? `承認して実行しました: ${res.executed?.message || "完了"}`
              : `実行できませんでした: ${res.error || res.executed?.message || ""}`;
          }
          renderHumanSendGatePanel(host);
          global.TasuAdminAiAutoFixCandidate?.renderAutoFixPanel?.("[data-ops-ai-auto-fix]");
        });
      });
    });

    host.querySelectorAll("[data-hsg-reject]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-hsg-reject");
        rejectPendingItem(id);
        const toast = host.querySelector("[data-hsg-toast]");
        if (toast) {
          toast.hidden = false;
          toast.textContent = "却下しました";
        }
        renderHumanSendGatePanel(host);
      });
    });
  }

  let renderTimer = null;
  function scheduleRender() {
    if (renderTimer) clearTimeout(renderTimer);
    renderTimer = setTimeout(() => {
      renderTimer = null;
      renderHumanSendGatePanel("[data-ops-ai-human-send-gate]");
    }, 50);
  }

  function init() {
    scheduleRender();
    [
      "tasu:admin-ai-human-send-gate-updated",
      "tasu:admin-ai-automation-updated",
      "tasu:admin-ai-response-plan-updated",
      "tasu:admin-ai-outcome-learning-updated",
      "tasu:support-tickets-updated",
      "tasful-talk-notifications-changed",
    ].forEach((ev) => global.addEventListener(ev, scheduleRender));
  }

  global.TasuAdminAiHumanSendGate = {
    PENDING_KEY,
    EXEC_LOG_KEY,
    HUMAN_SEND_CATEGORIES,
    INTERNAL_CATEGORIES,
    clearForTests,
    isHumanSendCategory,
    readPendingQueue,
    enqueuePendingItem,
    enqueueFromAutoFixCandidate,
    enqueueFromResponsePlan,
    enqueueFromAutomation,
    enqueueFromGmailDraft,
    enqueueFromCalendarEvent,
    rejectPendingItem,
    approvePendingWithoutSend,
    updatePendingProposal,
    approveAndExecute,
    appendExecutionLog,
    readExecutionLog,
    shouldQueueResponsePlan,
    shouldQueueAutomation,
    buildHumanSendGateSnapshot,
    renderHumanSendGatePanel,
    init,
  };

  if (global.document?.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(typeof window !== "undefined" ? window : globalThis);
