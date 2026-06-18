/**
 * AI運営司令塔 — Connect対応AI支援（Support / connect_issues / Stripe取込ログ）
 */
(function (global) {
  "use strict";

  const RESOLVED_KEY = "tasu_admin_connect_resolved_v1";
  const ACTIVITY_KEY = "tasu_admin_ops_connect_activity_v1";
  const INGEST_LOG_KEY = "tasu_stripe_event_ingest_logs_v1";
  const NOTIFY_ID = "talk-n-admin-connect-ops-v1";
  const STRIPE_DASHBOARD_URL = "https://dashboard.stripe.com/";
  const EVENT_RESOLVED = "tasu:admin-connect-resolved";

  const OPEN_STATUSES = new Set(["open", "needs_review", "in_progress", "ai_replied"]);

  const REPLY_SECTIONS = Object.freeze({
    business_description: {
      label: "事業内容説明",
      text:
        "TASFULは、利用者同士の商品売買、業務依頼、チャット連絡、本人確認付き取引を支援する日本国内向けプラットフォームです。決済は、商品購入、サービス利用、業務依頼の取引代金の回収および出品者・提供者への支払いに使用されます。",
    },
    service_description: {
      label: "サービス内容説明",
      text:
        "TASFULでは、市場機能、TASFUL TALK、Builder、Connect認証を通じて、利用者が安全に取引・連絡・依頼管理を行える環境を提供します。",
    },
    payment_purpose: {
      label: "決済利用目的",
      text:
        "決済は、購入者が商品やサービスを購入する際の代金支払い、および取引完了後の出品者・提供者への支払いに使用されます。",
    },
    prohibited_items: {
      label: "禁止商材説明",
      text:
        "TASFULでは、違法商品、規制対象商品、危険物、成人向け商品、外部決済誘導、反社会的勢力に関連する取引を禁止しています。",
    },
  });

  const REQUIREMENT_RULES = [
    { key: "事業内容説明", re: /business description|事業内容|business profile|about your business/i, section: "business_description" },
    { key: "サービス内容", re: /service|how your users|サービス内容|users use payments/i, section: "service_description" },
    { key: "利用規約URL", re: /terms of service|terms of use|利用規約|tos url/i, section: "business_description" },
    { key: "プライバシーポリシーURL", re: /privacy policy|プライバシー/i, section: "business_description" },
    { key: "返金ポリシー", re: /refund policy|返金/i, section: "payment_purpose" },
    { key: "本人確認書類", re: /verification|identity|本人確認|document/i, section: "business_description" },
    { key: "銀行口座確認", re: /bank account|payouts|銀行口座|external account/i, section: "payment_purpose" },
    { key: "ウェブサイトURL", re: /website url|website|url/i, section: "service_description" },
  ];

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

  function readResolvedSet() {
    const arr = readJson(RESOLVED_KEY, []);
    return new Set(Array.isArray(arr) ? arr : []);
  }

  function writeResolvedSet(set) {
    writeJson(RESOLVED_KEY, [...set]);
  }

  function readIngestLogs() {
    const list = readJson(INGEST_LOG_KEY, []);
    return Array.isArray(list) ? list : [];
  }

  function classifyConnectRequirement(text) {
    const t = String(text || "");
    const found = [];
    const sections = new Set();
    for (const rule of REQUIREMENT_RULES) {
      if (rule.re.test(t) && !found.includes(rule.key)) {
        found.push(rule.key);
        if (rule.section) sections.add(rule.section);
      }
    }
    if (!found.length) {
      return {
        requiredItems: ["事業内容説明", "サービス内容", "利用規約URL"],
        sections: ["business_description", "service_description", "payment_purpose", "prohibited_items"],
      };
    }
    if (!sections.has("prohibited_items")) sections.add("prohibited_items");
    return { requiredItems: found, sections: [...sections] };
  }

  function generateConnectReplyDraft(item, classification) {
    const sections = classification?.sections || ["business_description", "service_description", "payment_purpose", "prohibited_items"];
    const blocks = sections.map((key) => {
      const sec = REPLY_SECTIONS[key];
      if (!sec) return "";
      return `【${sec.label}】\n${sec.text}`;
    });
    const header =
      `件名: Re: ${item.subject || "Stripe Connect additional information"}\n\n` +
      `Stripe Connect サポートご担当者様\n\n` +
      `追加情報のご依頼ありがとうございます。以下のとおり情報を提出いたします。\n`;
    const footer =
      `\n\n以上、ご確認のほどよろしくお願いいたします。\n` +
      `TASFUL 運営\n` +
      `※ 本回答は運営確認用ドラフトです。送信前に内容をご確認ください。`;
    return header + blocks.filter(Boolean).join("\n\n") + footer;
  }

  function buildAiAnalysis(requiredItems, raw) {
    const items = requiredItems || [];
    if (raw?.stripeEventType) {
      return `Stripeイベント（${raw.stripeEventType}）に基づく対応が必要です。Connect画面とSupportチケットを確認してください。`;
    }
    if (items.some((i) => /本人確認|銀行口座/.test(i))) {
      return "本人確認書類または口座情報の提出が必要です。Connect画面で書類と口座を確認してください。";
    }
    if (items.some((i) => /事業内容|サービス|利用規約/.test(i))) {
      return "TASFULの事業説明文を提出すれば対応可能です。";
    }
    return "Connect要求項目に沿って内容を確認し、必要ならAI下書きを提出してください。";
  }

  function issueToRawSource(issue, ticket) {
    const body = String(issue.detected_reason || ticket?.body || issue.recommended_action || "").trim();
    const subject = issue.stripe_event_type
      ? `[Stripe] ${issue.stripe_event_type}`
      : `[Connect] ${issue.issue_type || "issue"}`;
    return {
      id: `connect-issue-${issue.id}`,
      source: issue.stripe_event_type ? "Stripe（イベント取込）" : "Connect issue",
      from: issue.stripe_event_type || "connect",
      subject,
      body,
      receivedAt: issue.created_at || ticket?.updated_at || ticket?.created_at || new Date().toISOString(),
      ticketId: issue.ticket_id || ticket?.id || null,
      connectIssueId: issue.id,
      severity: issue.severity || ticket?.severity || "medium",
      stripeEventType: issue.stripe_event_type || null,
    };
  }

  function ticketToRawSource(ticket) {
    const meta = ticket.stripe_connect_meta || {};
    const body = String(ticket.body || ticket.ai_summary || "").trim();
    return {
      id: `support-ticket-${ticket.id}`,
      source:
        ticket.source === "stripe_webhook_sim" || meta.event_type
          ? "Stripe（イベント取込）"
          : "Support",
      from: meta.event_type || meta.mapping?.stripe_event_type || ticket.source || "support",
      subject: String(ticket.title || "Connect問い合わせ"),
      body,
      receivedAt: ticket.updated_at || ticket.created_at || new Date().toISOString(),
      ticketId: ticket.id,
      connectIssueId: null,
      severity: ticket.severity || "medium",
      stripeEventType: meta.event_type || meta.mapping?.stripe_event_type || null,
    };
  }

  function normalizeConnectSource(raw) {
    const text = `${raw?.subject || ""}\n${raw?.body || ""}`;
    const classification = classifyConnectRequirement(text);
    const severity =
      raw?.severity === "critical" || raw?.severity === "high"
        ? "high"
        : /restricted|disabled|payouts|verification|additional information|action required|failed/i.test(text)
          ? "high"
          : "medium";
    return {
      id: String(raw?.id || `connect-${Date.now()}`),
      source: String(raw?.source || "Connect"),
      from: String(raw?.from || ""),
      subject: String(raw?.subject || ""),
      body: String(raw?.body || ""),
      receivedAt: raw?.receivedAt || new Date().toISOString(),
      ticketId: raw?.ticketId || null,
      connectIssueId: raw?.connectIssueId || null,
      stripeEventType: raw?.stripeEventType || null,
      severity,
      classification,
    };
  }

  /** Support tickets / connect_issues / Stripe取込由来のみ */
  function fetchConnectActionSources() {
    const Store = global.TasuSupportTicketStore;
    if (!Store) return [];

    const resolved = readResolvedSet();
    const sources = [];
    const seenTicketIds = new Set();
    const issues = Store.listConnectIssues?.() || [];

    issues.forEach((issue) => {
      if (issue.status === "resolved") return;
      const itemId = `connect-issue-${issue.id}`;
      if (resolved.has(itemId)) return;
      const ticket = issue.ticket_id ? Store.getTicket?.(issue.ticket_id) : null;
      if (issue.ticket_id) seenTicketIds.add(issue.ticket_id);
      sources.push(issueToRawSource(issue, ticket));
    });

    (Store.listTickets?.() || []).forEach((ticket) => {
      if (ticket.status === "resolved") return;
      const isConnect =
        ticket.category === "connect_issue" ||
        ticket.stripe_connect_meta ||
        ticket.source === "stripe_webhook_sim";
      if (!isConnect) return;
      if (seenTicketIds.has(ticket.id)) return;
      const itemId = `support-ticket-${ticket.id}`;
      if (resolved.has(itemId)) return;
      const linkedResolved = issues.some(
        (issue) =>
          issue.ticket_id === ticket.id && resolved.has(`connect-issue-${issue.id}`)
      );
      if (linkedResolved) return;
      sources.push(ticketToRawSource(ticket));
    });

    return sources.sort((a, b) => String(b.receivedAt).localeCompare(String(a.receivedAt)));
  }

  function getStripeEventStatus() {
    const logs = readIngestLogs();
    const Store = global.TasuSupportTicketStore;
    const stripeTickets = (Store?.listTickets?.() || []).filter(
      (t) => t.source === "stripe_webhook_sim" || t.stripe_connect_meta
    );
    const stripeIssues = (Store?.listConnectIssues?.() || []).filter((i) => i.stripe_event_type);
    const hasStripeData = logs.length > 0 || stripeTickets.length > 0 || stripeIssues.length > 0;

    return {
      connected: hasStripeData,
      ingestCount: logs.length,
      label: hasStripeData ? "Stripeイベント（ローカル取込）" : "Stripeイベント未接続",
      detail: hasStripeData
        ? `取込ログ ${logs.length} 件 · Stripe由来チケット ${stripeTickets.length} 件`
        : "実Stripe webhook / Gmail API は未接続です",
    };
  }

  function buildSummary(normalized) {
    if (normalized.stripeEventType) {
      return `Stripeイベント「${normalized.stripeEventType}」の Connect 対応が必要です。`;
    }
    if (normalized.ticketId) {
      return `Connect関連の未対応案件: ${normalized.subject}`;
    }
    return `Connect対応が必要です: ${normalized.subject}`;
  }

  function buildTargetUrl(normalized) {
    if (normalized.ticketId) {
      return `support-trouble-center.html?ticket=${encodeURIComponent(normalized.ticketId)}`;
    }
    return STRIPE_DASHBOARD_URL;
  }

  function buildConnectActionItems() {
    return fetchConnectActionSources().map((raw) => {
      const mail = normalizeConnectSource(raw);
      const requiredItems = mail.classification.requiredItems;
      const suggestedReply = generateConnectReplyDraft(mail, mail.classification);
      const hasDraft = Boolean(suggestedReply && /TASFUL/.test(suggestedReply));
      return {
        id: mail.id,
        source: mail.source,
        receivedAt: mail.receivedAt,
        severity: mail.severity,
        status: "pending",
        subject: mail.subject,
        summary: buildSummary(mail),
        body: mail.body,
        requiredItems,
        aiAnalysis: buildAiAnalysis(requiredItems, raw),
        suggestedReply,
        nextActionLabel: mail.ticketId
          ? "Supportトラブルセンターで内容を確認してください。"
          : "StripeダッシュボードでConnect要件を確認してください。",
        targetUrl: buildTargetUrl(mail),
        copyText: suggestedReply,
        estimatedMinutes: Math.min(15, 5 + requiredItems.length * 2),
        ticketId: mail.ticketId,
        connectIssueId: mail.connectIssueId,
        stripeEventType: mail.stripeEventType,
        hasDraft,
      };
    });
  }

  function getPendingConnectCount() {
    return buildConnectActionItems().length;
  }

  function listConnectActivity() {
    const list = readJson(ACTIVITY_KEY, []);
    return Array.isArray(list) ? list : [];
  }

  function appendConnectActivity(text) {
    const list = listConnectActivity();
    list.unshift({
      text,
      at: new Date().toISOString(),
    });
    writeJson(ACTIVITY_KEY, list.slice(0, 20));
  }

  function markConnectItemResolved(id) {
    const set = readResolvedSet();
    const sid = String(id);
    set.add(sid);

    const Store = global.TasuSupportTicketStore;
    if (sid.startsWith("connect-issue-")) {
      const issueId = sid.slice("connect-issue-".length);
      const issue = (Store?.listConnectIssues?.() || []).find((i) => i.id === issueId);
      if (issue?.ticket_id) set.add(`support-ticket-${issue.ticket_id}`);
    }
    if (sid.startsWith("support-ticket-")) {
      const ticketId = sid.slice("support-ticket-".length);
      const issue = (Store?.listConnectIssues?.() || []).find((i) => i.ticket_id === ticketId);
      if (issue?.id) set.add(`connect-issue-${issue.id}`);
    }

    writeResolvedSet(set);
    appendConnectActivity("Connect対応を完了しました");
    try {
      global.dispatchEvent(new CustomEvent(EVENT_RESOLVED, { detail: { id } }));
    } catch {
      /* ignore */
    }
  }

  function syncConnectTalkNotification() {
    const store = global.TasuTalkNotifications;
    if (!store?.add || !store?.getAll) return;

    const pending = getPendingConnectCount();
    const all = store.getAll() || [];
    const existing = all.find((n) => String(n.id) === NOTIFY_ID);

    if (pending < 1) {
      return;
    }

    if (existing) {
      return;
    }

    store.add({
      id: NOTIFY_ID,
      type: "system",
      priority: "important",
      title: "【重要】Connect対応が必要です",
      body: `Connect未対応が ${pending} 件あります。AI運営司令塔で確認してください。`,
      targetUrl: "admin-operations-dashboard.html#connect",
      href: "admin-operations-dashboard.html#connect",
      actionLabel: "AI運営司令塔で確認",
      source: "admin_connect_ops",
      category: "Connect",
    });
  }

  function clearResolvedForTests() {
    global.localStorage.removeItem(RESOLVED_KEY);
    global.localStorage.removeItem(ACTIVITY_KEY);
  }

  global.TasuAdminConnectAiSupport = {
    STRIPE_DASHBOARD_URL,
    INGEST_LOG_KEY,
    REPLY_SECTIONS,
    normalizeConnectSource,
    normalizeConnectMailItem: normalizeConnectSource,
    classifyConnectRequirement,
    generateConnectReplyDraft,
    fetchConnectActionSources,
    getStripeEventStatus,
    buildConnectActionItems,
    getPendingConnectCount,
    markConnectItemResolved,
    syncConnectTalkNotification,
    listConnectActivity,
    appendConnectActivity,
    clearResolvedForTests,
  };
})(typeof window !== "undefined" ? window : globalThis);
