/**
 * 問い合わせ受付 → 分類 → AI一次返信 or 管理者キュー
 */
(function (global) {
  "use strict";

  const Store = () => global.TasuSupportTicketStore;
  const Classifier = () => global.TasuSupportClassifier;
  const AiReply = () => global.TasuSupportAiReply;
  const Notify = () => global.TasuSupportAdminNotify;

  function submitInquiry(input) {
    const store = Store();
    const clf = Classifier();
    const ai = AiReply();
    const notify = Notify();
    if (!store || !clf || !ai) {
      throw new Error("Support modules not loaded");
    }

    const Gate = global.TasuPlatformContentGate;
    if (Gate?.applyInquiryGate) {
      const gate = Gate.applyInquiryGate(input);
      if (!gate.ok) {
        return {
          ok: false,
          blocked: true,
          error: gate.error || "お問い合わせ内容を送信できません",
          scan: gate.scan,
        };
      }
      if (gate.needsReview) {
        input = { ...input, _moderationNeedsReview: true, _moderationFlags: gate.scan?.flags };
      }
    }

    const classification = clf.classifySupportInquiry(input);
    const now = new Date().toISOString();
    const ticket = {
      id: store.uid("tkt"),
      user_id: input?.user_id || "guest",
      related_project_id: input?.related_project_id || null,
      related_order_id: input?.related_order_id || null,
      related_stripe_account_id: input?.related_stripe_account_id || null,
      source: input?.source || "web_form",
      title: String(input?.title || "お問い合わせ").trim().slice(0, 200),
      body: String(input?.body || "").trim(),
      category: classification.category,
      severity: classification.severity,
      status: "open",
      ai_summary: ai.summarizeForAdmin(input?.title, input?.body, classification),
      ai_suggested_reply: "",
      ai_recommended_action: classification.aiRecommendedAction,
      admin_note: "",
      created_at: now,
      updated_at: now,
      resolved_at: null,
    };

    store.appendEvent(ticket.id, "ticket_created", `受付: ${ticket.category}`, { classification });

    if (
      classification.autoReplyAllowed &&
      !input?._moderationNeedsReview
    ) {
      const gen = ai.generateAutoReply({ body: ticket.body, classification });
      if (gen.allowed && gen.reply) {
        ticket.ai_suggested_reply = gen.reply;
        ticket.status = "ai_replied";
        store.appendEvent(ticket.id, "ai_auto_reply", "AI自動返信を送信", { reply: gen.reply });
      } else {
        ticket.status = "needs_review";
      }
    } else {
      ticket.status = "needs_review";
      store.appendEvent(ticket.id, "routed_admin", "管理者確認キューへ", {
        reason: classification.category,
      });
    }

    if (
      classification.category === Classifier().CATEGORIES.CONNECT_ISSUE ||
      input?.stripeEventType
    ) {
      const connect = {
        id: store.uid("conn"),
        user_id: ticket.user_id,
        stripe_account_id: ticket.related_stripe_account_id || input?.stripe_account_id || "",
        stripe_event_type: input?.stripeEventType || "",
        issue_type: input?.issue_type || "connect_inquiry",
        severity: ticket.severity,
        status: "open",
        detected_reason: ticket.body.slice(0, 300),
        recommended_action: ticket.ai_recommended_action,
        admin_required: true,
        raw_event_ref: input?.raw_event_ref || null,
        ticket_id: ticket.id,
        created_at: now,
        resolved_at: null,
      };
      store.saveConnectIssue(connect);
      store.appendEvent(ticket.id, "connect_issue_linked", connect.id, connect);
    }

    store.saveTicket(ticket);

    if (notify && Classifier().shouldNotifyAdmin(ticket)) {
      notify.notifyAdminImportantTicket(ticket);
    }

    return { ticket, classification };
  }

  function ingestStripeWebhookEvent(input) {
    if (global.TasuStripeConnectIngest?.ingestStripeConnectEvent && input?.type) {
      return global.TasuStripeConnectIngest.ingestStripeConnectEvent(input);
    }
    return submitInquiry({
      user_id: input?.user_id || "system",
      title: `Stripe webhook: ${input?.stripeEventType || "unknown"}`,
      body: input?.detected_reason || input?.summary || "異常イベントを検知しました",
      source: "stripe_webhook",
      stripeEventType: input?.stripeEventType,
      stripe_account_id: input?.stripe_account_id,
      related_stripe_account_id: input?.stripe_account_id,
      raw_event_ref: input?.raw_event_ref,
      issue_type: input?.issue_type || "webhook_anomaly",
    });
  }

  /** Stripe Connect 強化 — webhook 風 payload（推奨） */
  function ingestStripeConnectEvent(payload) {
    const Ingest = global.TasuStripeConnectIngest;
    if (!Ingest?.ingestStripeConnectEvent) {
      throw new Error("TasuStripeConnectIngest not loaded");
    }
    return Ingest.ingestStripeConnectEvent(payload);
  }

  function applyAdminAction(ticketId, action, note) {
    const store = Store();
    const ticket = store.getTicket(ticketId);
    if (!ticket) return null;

    const statusMap = {
      send_reply: { status: "in_progress", event: "admin_reply_planned", summary: "返信送信（管理者確認済み・予定）" },
      refund: { status: "in_progress", event: "refund_planned", summary: "返金対応へ進む（操作予定・未実行）" },
      connect_verified: { status: "in_progress", event: "connect_verified_planned", summary: "Connect確認済み（操作予定）" },
      cancel_project: { status: "in_progress", event: "cancel_project_planned", summary: "案件キャンセル（操作予定）" },
      account_restrict: { status: "in_progress", event: "account_restrict_planned", summary: "アカウント制限（操作予定）" },
      ban_candidate: { status: "needs_review", event: "ban_candidate_planned", summary: "BAN候補に登録（操作予定）" },
      resolved: { status: "resolved", event: "resolved", summary: "解決済み" },
    };

    const plan = statusMap[action];
    if (!plan) return null;

    ticket.status = plan.status;
    if (note) ticket.admin_note = String(note).trim();
    if (plan.status === "resolved") {
      ticket.resolved_at = new Date().toISOString();
      const notify = Notify();
      if (notify?.markNotificationsReadForTicket) {
        notify.markNotificationsReadForTicket(ticketId);
      }
      global.TasuAdminAiDailyInbox?.completeInboxItem?.(`inbox_support_${ticketId}`);
    }
    if (plan.status === "in_progress" && action === "send_reply") {
      global.TasuAdminAiDailyInbox?.completeInboxItem?.(`inbox_support_${ticketId}`);
    }
    ticket.updated_at = new Date().toISOString();
    store.saveTicket(ticket);
    store.appendEvent(ticketId, plan.event, plan.summary, { action, note });
    return ticket;
  }

  global.TasuSupportTicketService = {
    submitInquiry,
    ingestStripeWebhookEvent,
    ingestStripeConnectEvent,
    applyAdminAction,
  };
})(typeof window !== "undefined" ? window : globalThis);
