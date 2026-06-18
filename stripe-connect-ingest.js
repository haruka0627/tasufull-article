/**
 * Stripe Connect webhook 風 payload の取込（本番 endpoint なし・localStorage + 既存ストア）
 */
(function (global) {
  "use strict";

  const INGEST_LOG_KEY = "tasu_stripe_event_ingest_logs_v1";
  const OFFPLATFORM_KEY = "tasu_offplatform_risk_events_v1";
  const MODE_KEY = "tasu_stripe_ingest_mode_v1";

  const MODES = Object.freeze({
    simulation: "simulation",
    production: "production",
  });

  const PAYMENT_SUCCESS_EVENTS = new Set([
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded",
    "payment_intent.succeeded",
    "charge.succeeded",
  ]);

  const REFUND_EVENTS = new Set(["charge.refunded", "refund.created", "refund.updated"]);

  function uid(p) {
    return `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  }

  function getIngestMode() {
    try {
      const raw = String(global.localStorage.getItem(MODE_KEY) || MODES.simulation).trim();
      return raw === MODES.production ? MODES.production : MODES.simulation;
    } catch {
      return MODES.simulation;
    }
  }

  function setIngestMode(mode) {
    const next = mode === MODES.production ? MODES.production : MODES.simulation;
    try {
      global.localStorage.setItem(MODE_KEY, next);
    } catch {
      /* ignore */
    }
    return next;
  }

  function resolveEventSource(mode) {
    return (mode || getIngestMode()) === MODES.production
      ? "stripe_webhook_production"
      : "stripe_webhook_sim";
  }

  function normalizeStripePayload(payload) {
    if (!payload || typeof payload !== "object") return payload;
    const eventType =
      payload.type ||
      payload.stripeEventType ||
      payload.event_type ||
      payload.event?.type ||
      "";
    const object = payload?.data?.object || payload?.object || payload?.data || {};
    return {
      ...payload,
      type: String(eventType || "").trim(),
      data: { object },
      object,
    };
  }

  function extractPaymentAmount(payload) {
    const obj = payload?.data?.object || payload?.object || {};
    const raw = Number(obj.amount ?? obj.amount_total ?? obj.amount_received ?? payload?.amount);
    if (!Number.isFinite(raw) || raw <= 0) return 0;
    const currency = String(obj.currency || payload?.currency || "jpy").toLowerCase();
    if (currency === "jpy") return Math.round(raw);
    return Math.round(raw / 100);
  }

  function extractOrderId(payload) {
    const obj = payload?.data?.object || payload?.object || {};
    return String(
      obj.metadata?.order_id ||
        obj.metadata?.orderId ||
        payload?.related_order_id ||
        payload?.metadata?.order_id ||
        obj.id ||
        ""
    ).trim();
  }

  function bridgeMarketPayment(payload, amount, source) {
    if (!global.TasuMarketEventStore?.appendMarketEvent || amount <= 0) return null;
    const orderId = extractOrderId(payload) || `stripe_${uid("ord")}`;
    return global.TasuMarketEventStore.appendMarketEvent({
      id: `stripe_pay_${orderId}_${Date.now()}`,
      event_type: "payment_completed",
      order_id: orderId,
      amount,
      channel: "shop_stripe",
      note: `Stripe ingest (${source})`,
      created_at: new Date().toISOString(),
    });
  }

  function bridgeMarketRefund(payload, amount, eventType) {
    if (!global.TasuMarketEventStore?.appendMarketEvent) return null;
    const orderId = extractOrderId(payload) || `stripe_${uid("ord")}`;
    const isCompleted = eventType === "charge.refunded";
    return global.TasuMarketEventStore.appendMarketEvent({
      id: `stripe_${isCompleted ? "refund_done" : "refund_req"}_${orderId}_${Date.now()}`,
      event_type: isCompleted ? "refund_completed" : "refund_requested",
      order_id: orderId,
      amount,
      channel: "shop_stripe",
      note: `Stripe ${eventType}`,
      created_at: new Date().toISOString(),
    });
  }

  function appendIngestLog(row) {
    try {
      const raw = localStorage.getItem(INGEST_LOG_KEY);
      const list = raw ? JSON.parse(raw) : [];
      list.unshift(row);
      localStorage.setItem(INGEST_LOG_KEY, JSON.stringify(list.slice(0, 1000)));
    } catch {
      /* ignore */
    }
  }

  function saveOffplatformEvent(row) {
    try {
      const raw = localStorage.getItem(OFFPLATFORM_KEY);
      const list = raw ? JSON.parse(raw) : [];
      list.unshift(row);
      localStorage.setItem(OFFPLATFORM_KEY, JSON.stringify(list.slice(0, 500)));
    } catch {
      /* ignore */
    }
  }

  function payloadSummary(payload, mapping) {
    const obj = payload?.data?.object || payload?.object || {};
    const parts = [
      mapping.stripe_event_type,
      mapping.issue_type,
      obj.id ? `id=${obj.id}` : "",
      obj.amount != null ? `amount=${obj.amount}` : "",
      obj.failure_code ? `failure=${obj.failure_code}` : "",
    ].filter(Boolean);
    return parts.join(" · ");
  }

  function ingestStripeConnectEvent(payload, options) {
    const EventMap = global.TasuStripeConnectEventMap;
    const Store = global.TasuSupportTicketStore;
    const AiStore = global.TasuAiOpsCaseStore;
    const Notify = global.TasuSupportAdminNotify;
    const Identity = global.TasuConnectIdentityTemplates;
    const Offplatform = global.TasuOffplatformRiskDetector;
    const Evidence = global.TasuChargebackEvidencePack;

    if (!EventMap || !Store) {
      throw new Error("Stripe Connect ingest dependencies not loaded");
    }

    const normalized = normalizeStripePayload(payload);
    const mode = options?.mode || getIngestMode();
    const source = resolveEventSource(mode);
    const eventType = EventMap.normalizeEventType(normalized);
    const mapping = EventMap.classifyStripeEvent(eventType, normalized);
    const now = new Date().toISOString();
    const obj = normalized?.data?.object || normalized?.object || {};
    const amount = extractPaymentAmount(normalized);

    const textBlob = JSON.stringify(obj).slice(0, 4000);
    const offplatform = Offplatform?.scanText?.(textBlob) || { detected: false };

    let identityTemplates = [];
    if (Identity) {
      if (mapping.identity_template_hints?.length) {
        identityTemplates = Identity.getTemplatesForHints(mapping.identity_template_hints);
      }
      if (eventType === EventMap.EVENTS.ACCOUNT_UPDATED || eventType === EventMap.EVENTS.CAPABILITY_UPDATED) {
        const inferred = Identity.inferTemplatesFromAccountPayload(normalized);
        identityTemplates = [...identityTemplates, ...inferred].filter(
          (t, i, arr) => arr.findIndex((x) => x.key === t.key) === i
        );
      }
    }

    const ticketId = Store.uid("tkt");
    const ticket = {
      id: ticketId,
      user_id: normalized?.user_id || normalized?.metadata?.user_id || "system_stripe",
      related_project_id:
        normalized?.related_project_id || normalized?.metadata?.project_id || obj.metadata?.project_id || null,
      related_order_id:
        normalized?.related_order_id || normalized?.metadata?.order_id || obj.metadata?.order_id || null,
      related_stripe_account_id:
        normalized?.stripe_account_id ||
        normalized?.account ||
        obj.account ||
        obj.destination ||
        null,
      source,
      title: `[Stripe] ${mapping.stripe_event_type}`,
      body:
        normalized?.admin_summary ||
        mapping.admin_summary +
          "\n\n" +
          (payloadSummary(normalized, mapping) || "") +
          (offplatform.detected ? `\n[外部決済検知] ${offplatform.risk_type}` : ""),
      category: mapping.support_ticket_type || mapping.category,
      severity: mapping.severity,
      status: mapping.admin_required ? "needs_review" : "open",
      ai_summary: mapping.admin_summary,
      ai_suggested_reply: "",
      ai_recommended_action: mapping.recommended_action,
      admin_note: "",
      created_at: now,
      updated_at: now,
      resolved_at: null,
      stripe_connect_meta: {
        mapping,
        event_type: eventType,
        event_id: normalized?.id || null,
        identity_templates: identityTemplates.map((t) => t.key),
        offplatform_risk: offplatform.detected ? offplatform : null,
        user_visible_summary: mapping.user_visible_summary,
        amount,
        object_amount: amount,
        ingest_mode: mode,
      },
    };

    Store.appendEvent(ticketId, "stripe_event_ingested", mapping.admin_summary, { mapping, eventType, mode });
    Store.saveTicket(ticket);

    let connectIssue = null;
    if (
      mapping.category === "connect_issue" ||
      mapping.support_ticket_type === "connect_issue" ||
      /connect|payout|transfer|dispute|account/i.test(eventType)
    ) {
      connectIssue = {
        id: Store.uid("conn"),
        user_id: ticket.user_id,
        stripe_account_id: ticket.related_stripe_account_id || "",
        stripe_event_type: eventType,
        issue_type: mapping.issue_type,
        severity: mapping.severity,
        status: "open",
        detected_reason: ticket.body.slice(0, 500),
        recommended_action: mapping.recommended_action,
        admin_required: mapping.admin_required !== false,
        raw_event_ref: normalized?.id || null,
        ticket_id: ticketId,
        created_at: now,
        resolved_at: null,
      };
      Store.saveConnectIssue(connectIssue);
      Store.appendEvent(ticketId, "connect_issue_linked", connectIssue.id, connectIssue);
    }

    let aiCase = null;
    if (AiStore?.createCaseFromInput) {
      aiCase = AiStore.createCaseFromInput(
        {
          support_ticket_id: ticketId,
          source,
          title: ticket.title,
          body: ticket.body,
          support_category: ticket.category,
          severity: ticket.severity,
          status: "needs_review",
          ops_category: mapping.ai_ops_case_type || mapping.category,
          related_project_id: ticket.related_project_id,
          related_order_id: ticket.related_order_id,
          user_id: ticket.user_id,
        },
        true
      );
      if (aiCase) {
        aiCase.stripe_connect_meta = { ...ticket.stripe_connect_meta };
      }
    }

    if (offplatform.detected) {
      saveOffplatformEvent({
        id: uid("offplat"),
        ticket_id: ticketId,
        case_id: aiCase?.id || null,
        created_at: now,
        ...offplatform,
        source_text_preview: textBlob.slice(0, 500),
      });
      Store.appendEvent(ticketId, "offplatform_risk_detected", offplatform.risk_type, offplatform);
    }

    let evidencePack = null;
    if (mapping.suggest_evidence_pack && Evidence?.buildEvidencePack) {
      evidencePack = Evidence.buildEvidencePack({
        ticket_id: ticketId,
        case_id: aiCase?.id || null,
        dispute_id: obj.id,
        transaction_id: obj.payment_intent || obj.charge || normalized?.charge_id,
        order_id: ticket.related_order_id,
        project_id: ticket.related_project_id,
        payment_at: obj.created ? new Date(obj.created * 1000).toISOString() : now,
        amount: obj.amount != null ? `${obj.amount} ${obj.currency || "jpy"}` : null,
        stripe_account_id: ticket.related_stripe_account_id,
        user_id: ticket.user_id,
        ai_summary: mapping.admin_summary,
        admin_note: `Stripe webhook ingest (${mode})`,
      });
      Store.appendEvent(ticketId, "evidence_pack_created", evidencePack.id, { pack_id: evidencePack.id });
    }

    if (Notify && mapping.admin_required && Notify.notifyAdminImportantTicket) {
      Notify.notifyAdminImportantTicket(ticket);
    }

    if (PAYMENT_SUCCESS_EVENTS.has(eventType) && amount > 0) {
      bridgeMarketPayment(normalized, amount, source);
    }
    if (REFUND_EVENTS.has(eventType) && amount > 0) {
      bridgeMarketRefund(normalized, amount, eventType);
    }

    const logRow = {
      id: uid("slog"),
      created_at: now,
      event_type: eventType,
      ticket_id: ticketId,
      case_id: aiCase?.id || null,
      connect_issue_id: connectIssue?.id || null,
      evidence_pack_id: evidencePack?.id || null,
      mapping_issue_type: mapping.issue_type,
      admin_required: mapping.admin_required,
      amount,
      ingest_mode: mode,
      source,
    };
    appendIngestLog(logRow);

    try {
      global.dispatchEvent(
        new CustomEvent("tasu:stripe-connect-ingested", {
          detail: { ticket, connectIssue, aiCase, evidencePack, mapping, log: logRow, mode },
        })
      );
    } catch {
      /* ignore */
    }

    if (global.TasuTalkOpsAssistant?.syncNotifications) {
      try {
        global.TasuTalkOpsAssistant.syncNotifications();
      } catch {
        /* ignore */
      }
    }

    return {
      ticket,
      connectIssue,
      aiCase,
      evidencePack,
      mapping,
      offplatform,
      identityTemplates,
      ingestLog: logRow,
      mode,
      source,
    };
  }

  function ingestProductionWebhook(payload) {
    return ingestStripeConnectEvent(payload, { mode: MODES.production });
  }

  function ingestSimulatedEvent(payload) {
    return ingestStripeConnectEvent(payload, { mode: MODES.simulation });
  }

  global.TasuStripeConnectIngest = {
    INGEST_LOG_KEY,
    OFFPLATFORM_KEY,
    MODE_KEY,
    MODES,
    PAYMENT_SUCCESS_EVENTS,
    REFUND_EVENTS,
    getIngestMode,
    setIngestMode,
    resolveEventSource,
    normalizeStripePayload,
    extractPaymentAmount,
    ingestStripeConnectEvent,
    ingestProductionWebhook,
    ingestSimulatedEvent,
    appendIngestLog,
  };
})(typeof window !== "undefined" ? window : globalThis);
