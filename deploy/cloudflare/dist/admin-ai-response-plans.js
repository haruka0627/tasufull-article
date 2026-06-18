/**
 * AI運営司令塔 Phase2/3/4 — AI対応案（Safety Gate・TALK通知・送信ログ）
 * 高リスクは自動送信しない。BAN/返金/停止/非表示は実行しない。
 */
(function (global) {
  "use strict";

  const STATE_KEY = "tasu_admin_ai_response_plans_state_v1";
  const SEND_LOG_KEY = "tasu_admin_ai_response_send_logs_v1";
  const DISMISSED_KEY = "tasu_admin_ai_response_dismissed_v1";
  const ACTIVITY_KEY = "tasu_admin_ops_ai_response_activity_v1";
  const NOTIFY_SOURCE = "ai_response_plan";

  const EVENT_LABELS = Object.freeze({
    connect_incomplete: "Connect未完了",
    identity_doc_incomplete: "本人確認書類不備",
    payment_pending: "支払い確認中",
    chat_not_opening: "チャットが開かない",
    report: "通報",
    external_contact_suspect: "外部連絡先送信疑い",
    refund_consultation: "返金相談",
    market_order: "市場・注文",
    market_refund: "市場・返金",
    market_cancel: "市場・キャンセル",
    listing_hide_candidate: "出品非表示候補",
    builder_review: "Builder審査",
    anpi_no_response: "安否未応答",
    inquiry_received: "問い合わせ受付",
    deadline_reminder: "期限リマインド",
  });

  const RISK_LABELS = Object.freeze({ low: "低", medium: "中", high: "高" });

  const TALK_NOTIFY_EVENT_TYPES = new Set([
    "inquiry_received",
    "payment_pending",
    "chat_not_opening",
    "report",
    "refund_consultation",
    "deadline_reminder",
    "connect_incomplete",
    "identity_doc_incomplete",
    "builder_review",
    "anpi_no_response",
  ]);

  const CONNECT_EVENT_TYPES = new Set(["connect_incomplete", "identity_doc_incomplete"]);
  const BUILDER_EVENT_TYPES = new Set(["builder_review"]);
  const ANPI_EVENT_TYPES = new Set(["anpi_no_response"]);

  let activeEditPlanId = null;

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

  function readStateMap() {
    const raw = readJson(STATE_KEY, {});
    return raw && typeof raw === "object" ? raw : {};
  }

  function writeStateMap(map) {
    writeJson(STATE_KEY, map);
  }

  function readDismissedSet() {
    const arr = readJson(DISMISSED_KEY, []);
    return new Set(Array.isArray(arr) ? arr : []);
  }

  function writeDismissedSet(set) {
    writeJson(DISMISSED_KEY, [...set]);
  }

  function readSendLogs() {
    const arr = readJson(SEND_LOG_KEY, []);
    return Array.isArray(arr) ? arr : [];
  }

  function appendSendLog(entry) {
    const logs = readSendLogs();
    logs.unshift(entry);
    writeJson(SEND_LOG_KEY, logs.slice(0, 200));
  }

  function listOpsActivity() {
    const list = readJson(ACTIVITY_KEY, []);
    return Array.isArray(list) ? list : [];
  }

  function appendOpsActivity(entry) {
    const list = listOpsActivity();
    list.unshift({
      id: entry.id || `act_${Date.now()}`,
      type: entry.type || "ai_response_sent",
      targetUser: entry.targetUser || "",
      targetUserId: entry.targetUserId || "",
      eventType: entry.eventType || "",
      eventTypeLabel: entry.eventTypeLabel || "",
      messagePreview: entry.messagePreview || "",
      notificationId: entry.notificationId || "",
      text: entry.text || "",
      at: entry.at || new Date().toISOString(),
    });
    writeJson(ACTIVITY_KEY, list.slice(0, 50));
    try {
      global.dispatchEvent(new CustomEvent("tasu:admin-ai-response-activity-updated"));
    } catch {
      /* ignore */
    }
  }

  function clearOpsActivityForTests() {
    writeJson(ACTIVITY_KEY, []);
  }

  function isTalkNotificationEligible(plan) {
    return TALK_NOTIFY_EVENT_TYPES.has(plan.eventType);
  }

  function resolveNotifyType(eventType) {
    if (BUILDER_EVENT_TYPES.has(eventType)) return "builder";
    if (ANPI_EVENT_TYPES.has(eventType)) return "anpi";
    if (CONNECT_EVENT_TYPES.has(eventType)) return "system";
    return "general";
  }

  function buildTalkNotification(plan) {
    const now = new Date().toISOString();
    const notifyId = `talk-n-ai-response-${plan.id}`;
    const draft = String(plan.aiDraftMessage || "").trim();
    const body = draft || plan.aiSuggestion || plan.aiReason || "";
    const title = `【運営】${plan.eventTypeLabel} — ${plan.targetUser}`;
    const href = plan.targetUrl || "admin-operations-dashboard.html#ops-ai-response";

    const payload = {
      id: notifyId,
      type: resolveNotifyType(plan.eventType),
      title,
      body: body.slice(0, 500),
      href,
      targetUrl: href,
      createdAt: now,
      source: NOTIFY_SOURCE,
      actionLabel: "内容を確認",
      priority: plan.riskLevel === "low" ? "normal" : "important",
      recipientUserId: plan.targetUserId || "",
      category:
        CONNECT_EVENT_TYPES.has(plan.eventType)
          ? "connect"
          : BUILDER_EVENT_TYPES.has(plan.eventType)
            ? "builder"
            : ANPI_EVENT_TYPES.has(plan.eventType)
              ? "anpi"
              : "support",
      planId: plan.id,
      eventType: plan.eventType,
    };

    if (
      !payload.recipientUserId &&
      (BUILDER_EVENT_TYPES.has(plan.eventType) || ANPI_EVENT_TYPES.has(plan.eventType))
    ) {
      payload.audienceScope = "admin_ops";
      payload.recipientRole = "ops";
      payload.audience = "admin";
    }

    return payload;
  }

  function deliverTalkNotification(plan) {
    const store = global.TasuTalkNotifications;
    if (!store?.add) {
      return { ok: false, skipped: true, reason: "notify_store_unavailable" };
    }
    if (!isTalkNotificationEligible(plan)) {
      return { ok: false, skipped: true, reason: "event_not_eligible" };
    }
    const payload = buildTalkNotification(plan);
    const row = store.add(payload);
    return { ok: true, notification: row, notificationId: payload.id };
  }

  function buildActivityText(plan, notificationId) {
    const who = plan.targetUser || plan.targetUserId || "対象ユーザー";
    const what = String(plan.aiDraftMessage || plan.aiSuggestion || "").slice(0, 80);
    const when = new Date().toLocaleString("ja-JP");
    const notifyNote = notificationId ? `（通知ID: ${notificationId}）` : "（通知なし）";
    return `AI対応送信: ${who} へ「${plan.eventTypeLabel}」${notifyNote} — ${what}${what.length >= 80 ? "…" : ""} — ${when}`;
  }

  function normalizeRisk(risk) {
    const r = String(risk || "medium").toLowerCase();
    if (r === "critical") return "high";
    if (r === "low" || r === "medium" || r === "high") return r;
    return "medium";
  }

  function applySafetyLicenseGate(plan) {
    const gate = global.TasuAdminAiResponseSafetyLicenseGate;
    if (!gate?.applyGateToPlan) return plan;
    return gate.applyGateToPlan(plan);
  }

  function mergePlan(base) {
    const state = readStateMap()[base.id] || {};
    const dismissed = readDismissedSet();
    const draft =
      state.aiDraftMessage != null && state.aiDraftMessage !== ""
        ? state.aiDraftMessage
        : base.aiDraftMessage;

    let status = state.status || base.status || "draft";
    if (dismissed.has(base.id) && status === "draft") status = "dismissed";

    const merged = applySafetyLicenseGate({
      ...base,
      riskLevel: normalizeRisk(state.riskLevel || base.riskLevel),
      aiDraftMessage: draft,
      status,
      secondaryActionLabel: "編集",
      updatedAt: state.updatedAt || base.createdAt,
      sendLogNote: state.sendLogNote || "",
    });

    return merged;
  }

  function makePlanId(prefix, sourceId) {
    return `${prefix}_${String(sourceId || "").replace(/\s+/g, "_")}`;
  }

  function collectFromConnect() {
    const items = global.TasuAdminConnectAiSupport?.buildConnectActionItems?.() || [];
    return items.map((item) => {
      const isIdentity = (item.requiredItems || []).some((r) => /本人確認/.test(r));
      const eventType = isIdentity ? "identity_doc_incomplete" : "connect_incomplete";
      const riskLevel = normalizeRisk(item.severity === "critical" ? "high" : item.severity);
      return mergePlan({
        id: makePlanId("connect", item.id),
        eventType,
        eventTypeLabel: EVENT_LABELS[eventType],
        riskLevel,
        aiSuggestion: item.nextActionLabel || "Connect追加情報の提出案内",
        aiReason: item.aiAnalysis || "Stripe Connectで追加情報が要求されています。",
        aiDraftMessage: item.suggestedReply || item.copyText || "",
        targetUrl: item.targetUrl || "support-trouble-center.html?filter=connect",
        targetUser: item.subject || "Connect利用者",
        targetUserId: item.ticketId || item.connectIssueId || "",
        sourceId: item.id,
        createdAt: item.receivedAt || new Date().toISOString(),
        status: "draft",
      });
    });
  }

  function collectFromSupport() {
    const store = global.TasuSupportTicketStore;
    if (!store?.listTickets) return [];
    const open = new Set(["open", "needs_review", "in_progress", "ai_replied"]);
    const tickets = (store.listTickets() || []).filter((t) => open.has(t.status));
    const provider = global.TasuAiOpsProvider;

    return tickets.map((t) => {
      const text = `${t.title || ""}\n${t.body || ""}`;
      const opsCategory =
        provider?.inferOpsCategory?.(text, t.category) ||
        (t.category === "connect_issue" ? "connect_issue" : "inquiry");
      let eventType = "inquiry_received";
      let riskLevel = normalizeRisk(t.severity);

      if (/チャット.*開かない|chat.*not.*open/i.test(text)) {
        eventType = "chat_not_opening";
        riskLevel = "medium";
      } else if (/返金|refund/i.test(text)) {
        eventType = "refund_consultation";
        riskLevel = riskLevel === "low" ? "medium" : riskLevel;
      } else if (/通報|report/i.test(text) || t.category === "abuse_or_policy") {
        eventType = "report";
      } else if (/外部|line|電話|メール.*誘導|直接連絡/i.test(text)) {
        eventType = "external_contact_suspect";
        riskLevel = "high";
      } else if (/支払い.*確認|決済.*確認|payment/i.test(text)) {
        eventType = "payment_pending";
        riskLevel = "low";
      } else if (t.category === "connect_issue") {
        eventType = "connect_incomplete";
      } else if (/期限|リマインド|deadline/i.test(text)) {
        eventType = "deadline_reminder";
        riskLevel = "low";
      }

      const draft =
        provider?.buildReplyDraft?.(opsCategory) ||
        "お問い合わせありがとうございます。内容を確認のうえ、担当よりご連絡いたします。";
      const suggestion =
        provider?.buildRecommendedAction?.(opsCategory, riskLevel) ||
        "内容確認のうえ一次返信または要確認キューへ";

      return mergePlan({
        id: makePlanId("support", t.id),
        eventType,
        eventTypeLabel: EVENT_LABELS[eventType] || EVENT_LABELS.inquiry_received,
        riskLevel,
        aiSuggestion: suggestion,
        aiReason: provider?.buildSummary?.(t.title, t.body, opsCategory) || t.title || "",
        aiDraftMessage: draft,
        targetUrl: `support-trouble-center.html?ticket=${encodeURIComponent(t.id)}`,
        targetUser: t.user_id || "問い合わせユーザー",
        targetUserId: t.user_id || "",
        sourceId: t.id,
        createdAt: t.created_at || new Date().toISOString(),
        status: "draft",
      });
    });
  }

  function collectFromAiOps() {
    const store = global.TasuAiOpsCaseStore;
    if (!store?.listCases) return [];
    const open = new Set(["open", "needs_review", "in_progress"]);
    return (store.listCases() || [])
      .filter((c) => open.has(c.status))
      .map((c) => {
        const cat = c.ops_category || "inquiry";
        let eventType = "inquiry_received";
        let riskLevel = normalizeRisk(c.ai_risk || c.severity);

        if (cat === "ban_candidate") {
          eventType = "listing_hide_candidate";
          riskLevel = "high";
        } else if (cat === "violation_report" || cat === "report") {
          eventType = "report";
        } else if (cat === "refund") {
          eventType = "refund_consultation";
        } else if (cat === "connect_issue") {
          eventType = "connect_incomplete";
        } else if (cat === "listing_suspend_candidate") {
          eventType = "listing_hide_candidate";
          riskLevel = "high";
        }

        return mergePlan({
          id: makePlanId("aiops", c.id),
          eventType,
          eventTypeLabel: EVENT_LABELS[eventType] || "要確認案件",
          riskLevel,
          aiSuggestion: c.ai_recommended_action || "AI運営センターで要確認",
          aiReason: c.ai_summary || c.title || "",
          aiDraftMessage:
            c.ai_reply_draft ||
            global.TasuAiOpsProvider?.buildReplyDraft?.(cat) ||
            "重要なご連絡として受け付けました。担当が確認いたします。",
          targetUrl: `admin-ai-operations-center.html?case=${encodeURIComponent(c.id)}`,
          targetUser: c.user_id || "AI運営案件",
          targetUserId: c.user_id || "",
          sourceId: c.id,
          createdAt: c.created_at || new Date().toISOString(),
          status: "draft",
        });
      });
  }

  function collectFromBuilder() {
    const evalStore = global.TasuBuilderPartnerEval;
    if (!evalStore?.listEvaluations) return [];
    const items = [];
    const evals = evalStore.listEvaluations() || [];
    evals
      .filter(
        (e) =>
          e.status === "needs_review" ||
          e.visibility === "hidden" ||
          ["application", "completion_report", "rejection"].includes(e.event_type)
      )
      .slice(0, 5)
      .forEach((e) => {
        items.push(
          mergePlan({
            id: makePlanId("builder", e.id || e.partner_id),
            eventType: e.visibility === "hidden" ? "listing_hide_candidate" : "builder_review",
            eventTypeLabel:
              e.visibility === "hidden"
                ? EVENT_LABELS.listing_hide_candidate
                : EVENT_LABELS.builder_review,
            riskLevel: e.visibility === "hidden" ? "high" : "medium",
            aiSuggestion: "Builder評価・掲載状態を管理者が確認（自動非表示は行いません）",
            aiReason: e.reason || e.summary || "Builderパートナー評価の確認が必要です。",
            aiDraftMessage:
              "Builder審査に関するご連絡です。評価内容を確認のうえ、必要に応じて担当よりご連絡いたします。掲載状態の変更は管理者判断後に実施されます。",
            targetUrl: "builder/admin-partner-evaluations.html",
            targetUser: e.partner_name || e.display_name || "Builderパートナー",
            targetUserId: e.partner_id || "",
            sourceId: e.id || e.partner_id,
            createdAt: e.updated_at || e.created_at || new Date().toISOString(),
            status: "draft",
          })
        );
      });
    return items;
  }

  function collectFromMarket() {
    const events = global.TasuMarketEventStore?.listMarketEvents?.() || [];
    const items = [];
    const typeMap = {
      order_created: { eventType: "market_order", label: EVENT_LABELS.market_order, risk: "low" },
      payment_completed: { eventType: "payment_pending", label: EVENT_LABELS.payment_pending, risk: "low" },
      order_cancelled: { eventType: "market_cancel", label: EVENT_LABELS.market_cancel, risk: "medium" },
      refund_requested: { eventType: "market_refund", label: EVENT_LABELS.market_refund, risk: "high" },
      refund_completed: { eventType: "refund_consultation", label: EVENT_LABELS.refund_consultation, risk: "medium" },
    };
    events
      .filter((e) => typeMap[e.event_type])
      .slice(0, 5)
      .forEach((e) => {
        const cfg = typeMap[e.event_type];
        items.push(
          mergePlan({
            id: makePlanId("market", e.id),
            eventType: cfg.eventType,
            eventTypeLabel: cfg.label,
            riskLevel: cfg.risk,
            aiSuggestion: "市場注文の状況を確認し、必要に応じて返金・キャンセル対応案を作成",
            aiReason: e.note || `${cfg.label}（注文 ${e.order_id || "—"}）`,
            aiDraftMessage:
              "市場注文に関するご連絡です。注文内容を確認のうえ、担当よりご連絡いたします。返金・キャンセルの可否は個別に判断いたします。",
            targetUrl: "shop-market-order-history.html",
            targetUser: e.product_name || "市場購入者",
            targetUserId: e.order_id || "",
            sourceId: e.id,
            createdAt: e.created_at || new Date().toISOString(),
            status: "draft",
          })
        );
      });
    return items;
  }

  function collectFromAnpi() {
    const hub = global.TasuTalkOpsAssistant?.buildHubSections?.();
    const anpiSec = hub?.sections?.find((s) => s.id === "anpi");
    if (!anpiSec?.items?.length) return [];

    return anpiSec.items.slice(0, 5).map((item, idx) => {
      const unread = /未読|未応答|緊急/.test(String(item.meta || ""));
      return mergePlan({
        id: makePlanId("anpi", item.id || idx),
        eventType: "anpi_no_response",
        eventTypeLabel: EVENT_LABELS.anpi_no_response,
        riskLevel: unread ? "high" : "medium",
        aiSuggestion: "安否通知の確認・利用者へのフォロー連絡案を作成",
        aiReason: item.meta || item.title || "安否関連の通知があります。",
        aiDraftMessage:
          "安否確認のご連絡です。状況をご確認いただき、必要に応じてご返信をお願いいたします。緊急の場合は担当より別途ご連絡します。",
        targetUrl: item.href || "anpi-dashboard.html",
        targetUser: item.title || "安否利用者",
        targetUserId: "",
        sourceId: item.id || String(idx),
        createdAt: new Date().toISOString(),
        status: "draft",
      });
    });
  }

  function buildResponsePlans() {
    const dismissed = readDismissedSet();
    const seen = new Set();
    const plans = [];

    const sources = [
      ...collectFromConnect(),
      ...collectFromSupport(),
      ...collectFromAiOps(),
      ...collectFromBuilder(),
      ...collectFromMarket(),
      ...collectFromAnpi(),
    ];

    for (const plan of sources) {
      if (dismissed.has(plan.id) || plan.status === "dismissed") continue;
      if (seen.has(plan.id)) continue;
      seen.add(plan.id);
      plans.push(plan);
    }

    const riskOrder = { high: 0, medium: 1, low: 2, prohibited: -1 };
    plans.sort(
      (a, b) =>
        (riskOrder[a.gateLevel] ?? riskOrder[a.riskLevel] ?? 9) -
          (riskOrder[b.gateLevel] ?? riskOrder[b.riskLevel] ?? 9) ||
        String(b.createdAt).localeCompare(String(a.createdAt))
    );

    return plans.slice(0, 12);
  }

  function updatePlanState(planId, patch) {
    const map = readStateMap();
    map[planId] = { ...(map[planId] || {}), ...patch, updatedAt: new Date().toISOString() };
    writeStateMap(map);
  }

  function recordBlockedResponse(plan, gate, reason) {
    const note = reason || gate.gateReason || plan.gateReason || "Safety & License Gate — 送信不可";
    appendOpsActivity({
      type: "ai_response_blocked",
      targetUser: plan.targetUser,
      targetUserId: plan.targetUserId,
      eventType: plan.eventType,
      eventTypeLabel: plan.eventTypeLabel,
      messagePreview: String(plan.aiDraftMessage || "").slice(0, 200),
      text: `送信ブロック: ${plan.targetUser} — ${plan.eventTypeLabel}（${gate.sendabilityLabel || "送信不可"}）`,
    });
    appendSendLog({
      id: `log_${Date.now()}`,
      planId: plan.id,
      eventType: plan.eventType,
      riskLevel: plan.riskLevel,
      gateLevel: gate.gateLevel,
      safetyResult: gate.safetyResult,
      licenseResult: gate.licenseResult,
      action: "blocked",
      mode: "gate_blocked",
      message: note,
      targetUser: plan.targetUser,
      targetUserId: plan.targetUserId,
      at: new Date().toISOString(),
      note: "TALK通知は作成していません（Safety & License Gate: blocked）",
    });
    global.dispatchEvent(new CustomEvent("tasu:admin-ai-response-plan-updated"));
  }

  function recordLearning(plan, operatorAction, extra) {
    return global.TasuAdminAiDecisionLearning?.recordFromResponsePlan?.(plan, operatorAction, extra);
  }

  function sendPlan(planId, options) {
    const base = findPlanById(planId);
    if (!base) return { ok: false, error: "対応案が見つかりません" };
    const plan = applySafetyLicenseGate(base);
    const gate = global.TasuAdminAiResponseSafetyLicenseGate?.evaluateGate?.(plan) || {};

    const HSG = global.TasuAdminAiHumanSendGate;
    if (HSG?.shouldQueueResponsePlan?.(plan, options)) {
      const queued = HSG.enqueueFromResponsePlan(plan);
      return {
        ok: false,
        queued: true,
        needsApproval: true,
        pendingId: queued?.id,
        message: "利用者への送信は承認待ちに追加しました（AI単独送信は行いません）",
      };
    }

    if (plan.sendBlocked || gate.sendBlocked || gate.gateLevel === "prohibited") {
      recordBlockedResponse(plan, gate, gate.gateReason || plan.gateReason);
      recordLearning(plan, "blocked", { finalStatus: "blocked" });
      return {
        ok: false,
        blocked: true,
        gate,
        message: `送信不可: ${gate.gateReason || plan.gateReason || "禁止・高リスクカテゴリ"}`,
      };
    }

    if (plan.confirmOnly || gate.confirmOnly || gate.gateLevel === "high") {
      updatePlanState(planId, { status: "escalated" });
      appendOpsActivity({
        type: "ai_response_escalated",
        targetUser: plan.targetUser,
        targetUserId: plan.targetUserId,
        eventType: plan.eventType,
        eventTypeLabel: plan.eventTypeLabel,
        messagePreview: String(plan.aiDraftMessage || "").slice(0, 200),
        text: `要確認記録: ${plan.targetUser} — ${plan.eventTypeLabel}（${gate.sendabilityLabel || "確認のみ"}）`,
      });
      appendSendLog({
        id: `log_${Date.now()}`,
        planId,
        eventType: plan.eventType,
        riskLevel: plan.riskLevel,
        gateLevel: gate.gateLevel,
        safetyResult: gate.safetyResult,
        licenseResult: gate.licenseResult,
        action: "escalated",
        mode: "admin_only",
        message: "Safety & License Gate — 高リスクのため自動送信せず要確認として記録",
        targetUser: plan.targetUser,
        at: new Date().toISOString(),
        note: "TALK通知は送信していません（Gate: 確認のみ）",
      });
      global.dispatchEvent(new CustomEvent("tasu:admin-ai-response-plan-updated"));
      const decision = recordLearning(plan, "escalated", { finalStatus: "escalated" });
      global.TasuAdminAiOutcomeLearning?.createPendingFromResponsePlan?.(plan, {
        decisionId: decision?.id,
        actionType: "escalated",
        outcomeReason: "Safety Gate — 運営確認",
      });
      return {
        ok: true,
        escalated: true,
        gate,
        message: `Safety Gate: ${gate.sendabilityLabel || "確認のみ"} — 運営履歴に記録しました（自動送信なし）`,
      };
    }

    if (!plan.sendAllowed && !gate.sendAllowed) {
      recordBlockedResponse(plan, gate, "送信が許可されていません");
      recordLearning(plan, "blocked", { finalStatus: "blocked" });
      return {
        ok: false,
        blocked: true,
        gate,
        message: "送信が許可されていません",
      };
    }

    const notifyResult = deliverTalkNotification(plan);
    const notificationId = notifyResult.notificationId || notifyResult.notification?.id || "";

    appendOpsActivity({
      type: "ai_response_sent",
      targetUser: plan.targetUser,
      targetUserId: plan.targetUserId,
      eventType: plan.eventType,
      eventTypeLabel: plan.eventTypeLabel,
      messagePreview: String(plan.aiDraftMessage || "").slice(0, 200),
      notificationId,
      text: buildActivityText(plan, notificationId),
    });

    const logEntry = {
      id: `log_${Date.now()}`,
      planId,
      eventType: plan.eventType,
      riskLevel: plan.riskLevel,
      gateLevel: gate.gateLevel,
      safetyResult: gate.safetyResult,
      licenseResult: gate.licenseResult,
      action: "sent",
      mode: notifyResult.ok ? "talk_notification" : "send_log_only",
      destinationType: plan.destinationType,
      targetUser: plan.targetUser,
      targetUserId: plan.targetUserId,
      notificationId,
      draftPreview: String(plan.aiDraftMessage || "").slice(0, 200),
      at: new Date().toISOString(),
      note: notifyResult.ok
        ? "TALK通知を作成し、送信ログ・運営履歴に保存しました"
        : `TALK通知未作成（${notifyResult.reason || "不明"}）— 送信ログ・運営履歴に保存しました`,
    };
    appendSendLog(logEntry);
    updatePlanState(planId, {
      status: "sent",
      sendLogNote: logEntry.note,
      notificationId,
    });
    global.dispatchEvent(new CustomEvent("tasu:admin-ai-response-plan-updated"));
    const decision = recordLearning(plan, "approved", {
      finalStatus: "sent",
      editedMessage: plan.status === "edited" ? plan.aiDraftMessage : "",
    });
    global.TasuAdminAiOutcomeLearning?.createPendingFromResponsePlan?.(plan, {
      decisionId: decision?.id,
      notificationId,
      actionType: "sent",
    });
    return {
      ok: true,
      log: logEntry,
      notification: notifyResult.notification || null,
      message: notifyResult.ok
        ? "TALK通知を送信し、運営履歴・送信ログに記録しました"
        : "送信ログと運営履歴に記録しました（TALK通知は作成されませんでした）",
    };
  }

  function findPlanById(planId) {
    const all = [
      ...collectFromConnect(),
      ...collectFromSupport(),
      ...collectFromAiOps(),
      ...collectFromBuilder(),
      ...collectFromMarket(),
      ...collectFromAnpi(),
    ];
    return all.map((p) => mergePlan(p)).find((p) => p.id === planId) || null;
  }

  function saveEditedDraft(planId, draftMessage) {
    const plan = findPlanById(planId);
    updatePlanState(planId, {
      aiDraftMessage: String(draftMessage || "").trim(),
      status: "edited",
    });
    if (plan) {
      recordLearning(
        { ...plan, aiDraftMessage: String(draftMessage || "").trim(), status: "edited" },
        "edited",
        { editedMessage: String(draftMessage || "").trim(), finalStatus: "edited" }
      );
    }
    global.dispatchEvent(new CustomEvent("tasu:admin-ai-response-plan-updated"));
    return { ok: true };
  }

  function dismissPlan(planId) {
    const plan = findPlanById(planId);
    const dismissed = readDismissedSet();
    dismissed.add(planId);
    writeDismissedSet(dismissed);
    updatePlanState(planId, { status: "dismissed" });
    if (plan) recordLearning(plan, "dismissed", { finalStatus: "dismissed" });
    global.dispatchEvent(new CustomEvent("tasu:admin-ai-response-plan-updated"));
    return { ok: true };
  }

  function renderGateSection(plan) {
    const safety = plan.safetyResult || {};
    const license = plan.licenseResult || {};
    const docs = (plan.requiredDocuments || license.requiredDocuments || []).filter(Boolean);
    const docsText = docs.length ? docs.join("、") : "—";
    const gateCls =
      plan.gateLevel === "prohibited"
        ? "ops-ai-response-gate--blocked"
        : plan.gateLevel === "high"
          ? "ops-ai-response-gate--high"
          : plan.gateLevel === "medium"
            ? "ops-ai-response-gate--medium"
            : "ops-ai-response-gate--low";

    return (
      `<div class="ops-ai-response-gate ${gateCls}" data-ops-ai-response-gate>` +
      `<p class="ops-ai-response-card__label">Safety & License Gate</p>` +
      `<dl class="ops-ai-response-gate__grid">` +
      `<div><dt>安全判定</dt><dd>${esc(safety.label || "—")}（${esc(RISK_LABELS[safety.level] || safety.level || "低")}）</dd></div>` +
      `<div><dt>資格/許可</dt><dd>${esc(license.statusLabel || "—")} · ${esc(license.categoryLabel || plan.serviceCategoryLabel || "一般")}</dd></div>` +
      `<div><dt>判定理由</dt><dd>${esc(plan.gateReason || safety.reason || license.reason || "—")}</dd></div>` +
      `<div><dt>確認書類</dt><dd>${esc(docsText)}</dd></div>` +
      `<div><dt>送信可否</dt><dd><strong>${esc(plan.sendabilityLabel || "—")}</strong></dd></div>` +
      `</dl>` +
      `</div>`
    );
  }

  function renderPlanCard(plan) {
    const riskCls = `ops-ai-tag--${plan.gateLevel === "prohibited" || plan.gateLevel === "high" || plan.riskLevel === "high" ? "high" : plan.riskLevel === "low" && plan.gateLevel === "low" ? "low" : "medium"}`;
    const sent = plan.status === "sent";
    const escalated = plan.status === "escalated";
    const statusNote = sent
      ? `<p class="ops-ai-response-card__status ops-ai-response-card__status--sent">送信済み（TALK通知・送信ログ保存）</p>`
      : escalated
        ? `<p class="ops-ai-response-card__status ops-ai-response-card__status--escalated">要確認として記録済み</p>`
        : plan.status === "edited"
          ? `<p class="ops-ai-response-card__status ops-ai-response-card__status--edited">編集済み</p>`
          : "";

    const blocked = plan.sendBlocked || plan.gateLevel === "prohibited";
    const primaryDisabled = sent || escalated || blocked ? " disabled" : "";
    const primaryLabel = plan.primaryActionLabel || "送信";

    return (
      `<article class="ops-ai-response-card" data-ops-ai-response-card data-plan-id="${esc(plan.id)}">` +
      `<header class="ops-ai-response-card__head">` +
      `<span class="ops-ai-tag ops-ai-tag--inquiry">${esc(plan.eventTypeLabel)}</span>` +
      `<span class="ops-ai-tag ${riskCls}">優先度: ${esc(RISK_LABELS[plan.riskLevel] || plan.riskLevel)}</span>` +
      `</header>` +
      `<p class="ops-ai-response-card__user"><strong>対象:</strong> ${esc(plan.targetUser)}</p>` +
      `<div class="ops-ai-response-card__section">` +
      `<p class="ops-ai-response-card__label">AI提案</p>` +
      `<p class="ops-ai-response-card__text">${esc(plan.aiSuggestion)}</p>` +
      `</div>` +
      `<div class="ops-ai-response-card__section">` +
      `<p class="ops-ai-response-card__label">理由</p>` +
      `<p class="ops-ai-response-card__text">${esc(plan.aiReason)}</p>` +
      `</div>` +
      `<div class="ops-ai-response-card__section">` +
      `<p class="ops-ai-response-card__label">返信案</p>` +
      `<pre class="ops-ai-response-card__draft">${esc(plan.aiDraftMessage)}</pre>` +
      `</div>` +
      renderGateSection(plan) +
      (global.TasuAdminAiDecisionLearning?.renderLearningHtml?.(plan) || "") +
      (global.TasuAdminAiOutcomeLearning?.renderOutcomeHtml?.(plan) || "") +
      statusNote +
      `<div class="ops-ai-response-card__actions">` +
      `<button type="button" class="ops-ai-response-btn ops-ai-response-btn--primary" data-ops-ai-response-send data-plan-id="${esc(plan.id)}"${primaryDisabled}>${esc(primaryLabel)}</button>` +
      `<button type="button" class="ops-ai-response-btn ops-ai-response-btn--ghost" data-ops-ai-response-edit data-plan-id="${esc(plan.id)}"${sent || escalated ? " disabled" : ""}>${esc(plan.secondaryActionLabel || "編集")}</button>` +
      `<button type="button" class="ops-ai-response-btn ops-ai-response-btn--ghost" data-ops-ai-response-hold data-plan-id="${esc(plan.id)}"${sent || escalated ? " disabled" : ""}>保留</button>` +
      (plan.targetUrl
        ? `<a class="ops-ai-response-btn ops-ai-response-btn--link" href="${esc(plan.targetUrl)}">詳細</a>`
        : "") +
      `</div>` +
      `</article>`
    );
  }

  let renderPlansPanelTimer = null;

  function renderPlansPanelInternal() {
    const host = global.document?.querySelector("[data-ops-ai-response-plans]");
    const countBadge = global.document?.querySelector("[data-ops-ai-response-count]");
    if (!host) return;

    const plans = buildResponsePlans();
    if (countBadge) {
      if (plans.length) {
        countBadge.hidden = false;
        countBadge.textContent = `${plans.length}件`;
      } else {
        countBadge.hidden = true;
      }
    }

    if (!plans.length) {
      host.innerHTML =
        `<p class="ops-ai-response-empty">現在の対応案はありません — 問題なし</p>`;
      return;
    }

    host.innerHTML = `<div class="ops-ai-response-list">${plans.map(renderPlanCard).join("")}</div>`;
  }

  function renderPlansPanel() {
    if (renderPlansPanelTimer) clearTimeout(renderPlansPanelTimer);
    renderPlansPanelTimer = setTimeout(() => {
      renderPlansPanelTimer = null;
      renderPlansPanelInternal();
    }, 16);
  }

  function renderPlansPanelSync() {
    if (renderPlansPanelTimer) {
      clearTimeout(renderPlansPanelTimer);
      renderPlansPanelTimer = null;
    }
    renderPlansPanelInternal();
  }

  function openEditModal(planId) {
    const plan = findPlanById(planId);
    const modal = global.document?.querySelector("[data-ops-ai-response-modal]");
    const textarea = global.document?.querySelector("[data-ops-ai-response-modal-draft]");
    const title = global.document?.querySelector("[data-ops-ai-response-modal-title]");
    if (!modal || !textarea || !plan) return;
    activeEditPlanId = planId;
    if (title) title.textContent = `${plan.eventTypeLabel} — 返信案を編集`;
    textarea.value = plan.aiDraftMessage || "";
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    textarea.focus();
  }

  function closeEditModal() {
    const modal = global.document?.querySelector("[data-ops-ai-response-modal]");
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    activeEditPlanId = null;
  }

  function showToast(message) {
    const el = global.document?.querySelector("[data-ops-ai-response-toast]");
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
    global.setTimeout(() => {
      el.hidden = true;
    }, 4000);
  }

  function bindUi() {
    const host = global.document?.querySelector("[data-ops-ai-response-plans]");
    if (!host || host.dataset.opsAiResponseBound === "1") return;
    host.dataset.opsAiResponseBound = "1";

    host.addEventListener("click", (e) => {
      const sendBtn = e.target.closest("[data-ops-ai-response-send]");
      const editBtn = e.target.closest("[data-ops-ai-response-edit]");
      const holdBtn = e.target.closest("[data-ops-ai-response-hold]");
      if (sendBtn) {
        const id = sendBtn.getAttribute("data-plan-id");
        let res = { ok: false, message: "失敗" };
        try {
          res = sendPlan(id) || res;
        } catch (err) {
          res = { ok: false, message: "送信処理でエラーが発生しました" };
        }
        showToast(res.message || (res.ok ? "完了" : res.blocked ? "送信不可" : "失敗"));
        renderPlansPanelSync();
      }
      if (editBtn) openEditModal(editBtn.getAttribute("data-plan-id"));
      if (holdBtn) {
        dismissPlan(holdBtn.getAttribute("data-plan-id"));
        showToast("保留にしました");
        renderPlansPanelSync();
      }
    });

    global.document?.querySelector("[data-ops-ai-response-modal]")?.addEventListener("click", (e) => {
      if (e.target.closest("[data-ops-ai-response-modal-close]")) closeEditModal();
    });

    global.document
      ?.querySelector("[data-ops-ai-response-modal-save]")
      ?.addEventListener("click", () => {
        if (!activeEditPlanId) return;
        const textarea = global.document?.querySelector("[data-ops-ai-response-modal-draft]");
        saveEditedDraft(activeEditPlanId, textarea?.value || "");
        closeEditModal();
        showToast("返信案を保存しました");
        renderPlansPanelSync();
      });

    global.document
      ?.querySelector("[data-ops-ai-response-modal-send]")
      ?.addEventListener("click", () => {
        if (!activeEditPlanId) return;
        const textarea = global.document?.querySelector("[data-ops-ai-response-modal-draft]");
        saveEditedDraft(activeEditPlanId, textarea?.value || "");
        const res = sendPlan(activeEditPlanId);
        closeEditModal();
        showToast(res.message || "完了");
        renderPlansPanelSync();
      });

    global.addEventListener("tasu:support-tickets-updated", renderPlansPanel);
    global.addEventListener("tasu:ai-ops-cases-changed", renderPlansPanel);
    global.addEventListener("tasu:admin-connect-resolved", renderPlansPanel);
    global.addEventListener("tasu:builder-partner-eval-changed", renderPlansPanel);
    global.addEventListener("tasful-talk-notifications-changed", renderPlansPanel);
    global.addEventListener("tasu-market-events-changed", renderPlansPanel);
  }

  function init() {
    bindUi();
    renderPlansPanelSync();
  }

  global.TasuAdminAiResponsePlans = {
    EVENT_LABELS,
    NOTIFY_SOURCE,
    buildResponsePlans,
    buildTalkNotification,
    deliverTalkNotification,
    applySafetyLicenseGate,
    sendPlan,
    saveEditedDraft,
    dismissPlan,
    readSendLogs,
    listOpsActivity,
    clearOpsActivityForTests,
    renderPlansPanel,
    renderPlansPanelSync,
    init,
  };

  if (global.document?.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(typeof window !== "undefined" ? window : globalThis);
