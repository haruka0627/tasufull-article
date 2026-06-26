/**
 * TASFUL TALK — 運営通知センター（AI運営秘書）
 * 既存 support / ai-ops / builder ストアを読み取り、tasful_chat_messages に同期（既存形式）
 */
(function (global) {
  "use strict";

  const OPS_ROOM_ID = "talk-ops-operations-room";
  const SENDER_ID = "__ops_assistant__";
  const SENDER_NAME = "AI運営秘書";
  const THREADS_KEY = "tasful_chat_threads";
  const MESSAGES_KEY = "tasful_chat_messages";

  const SUPPORT_NOTIFY_SEV = new Set(["high", "critical"]);
  const AI_OPS_NOTIFY_CATS = new Set([
    "legal",
    "chargeback",
    "connect_issue",
    "abuse_or_policy",
  ]);

  const OPS_CAT_LABEL = {
    connect_issue: "Connect",
    legal: "法的リスク",
    chargeback: "チャージバック",
    abuse_or_policy: "違反・ポリシー",
    refund: "返金",
    report: "通報",
    violation_report: "違反報告",
    external_payment: "外部決済",
    ban_candidate: "BAN候補",
    inquiry: "問い合わせ",
    general: "一般",
  };

  const SUPPORT_CAT_LABEL = {
    connect_issue: "Connect",
    legal_or_risk: "法的リスク",
    abuse_or_policy: "違反・ポリシー",
    admin_review: "要確認",
    general_auto_reply: "一般",
  };

  function readThreads() {
    try {
      const raw = global.localStorage.getItem(THREADS_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }

  function writeThreads(list) {
    global.localStorage.setItem(THREADS_KEY, JSON.stringify(list));
    try {
      global.dispatchEvent(new CustomEvent("tasful-chat-threads-changed"));
    } catch {
      /* ignore */
    }
  }

  function readMessagesMap() {
    try {
      const raw = global.localStorage.getItem(MESSAGES_KEY);
      const map = raw ? JSON.parse(raw) : {};
      return map && typeof map === "object" ? map : {};
    } catch {
      return {};
    }
  }

  function mergeMessagesMap(current, incoming) {
    const merged = { ...(current || {}) };
    const inc = incoming && typeof incoming === "object" ? incoming : {};
    Object.keys(inc).forEach((chatId) => {
      const prev = Array.isArray(merged[chatId]) ? merged[chatId] : [];
      const next = Array.isArray(inc[chatId]) ? inc[chatId] : [];
      const byId = new Map();
      prev.forEach((m) => {
        if (m?.id) byId.set(String(m.id), m);
      });
      next.forEach((m) => {
        if (m?.id) byId.set(String(m.id), m);
      });
      merged[chatId] = [...byId.values()].sort((a, b) =>
        String(a.createdAt || "").localeCompare(String(b.createdAt || ""))
      );
    });
    return merged;
  }

  function writeMessagesMap(map) {
    const merged = mergeMessagesMap(readMessagesMap(), map);
    global.localStorage.setItem(MESSAGES_KEY, JSON.stringify(merged));
  }

  function talkRowToRoomMessage(row) {
    return {
      id: row.id,
      chatId: row.room_id || OPS_ROOM_ID,
      roomId: row.room_id || OPS_ROOM_ID,
      senderId: row.sender_id || SENDER_ID,
      senderName: row.sender_name || SENDER_NAME,
      text: row.text || "",
      createdAt: row.created_at || new Date().toISOString(),
      kind: row.kind || "text",
      opsCard: row.ops_card || null,
      opsSummary: row.ops_summary || null,
    };
  }

  function getRoomMessages() {
    const Primary = global.TasuSupabaseOpsPrimaryConfig;
    const PC = global.TasuSupabaseOpsPrimaryCache;
    const Read = global.TasuSupabaseOpsRead;

    if (Primary?.isPrimarySource?.()) {
      const remote = Read?.getCached?.("talk_ops_messages") || [];
      if (remote.length > 0) {
        return remote.map(talkRowToRoomMessage).sort((a, b) =>
          String(a.createdAt).localeCompare(String(b.createdAt))
        );
      }
      const cached = PC?.readTableCache?.("talk_ops_messages");
      if (Array.isArray(cached) && cached.length) {
        return cached.map(talkRowToRoomMessage).sort((a, b) =>
          String(a.createdAt).localeCompare(String(b.createdAt))
        );
      }
    }

    const map = readMessagesMap();
    return Array.isArray(map[OPS_ROOM_ID]) ? map[OPS_ROOM_ID] : [];
  }

  function hasMessageId(id) {
    return getRoomMessages().some((m) => String(m.id) === String(id));
  }

  function syncTalkOpsMessageToSupabase(msg) {
    const W = global.TasuSupabaseOpsWrite;
    if (!W?.isEnabled?.()) return;
    void W.insertTalkOpsMessage(msg).then((r) => {
      if (r?.ok && W.markTalkOpsMessageSynced) {
        void W.markTalkOpsMessageSynced(msg.id, true);
      }
      if (r?.ok && msg.kind === "ops_summary" && W.markTalkOpsSummaryGenerated) {
        void W.markTalkOpsSummaryGenerated(msg.id, msg.opsSummary);
      }
    });
  }

  function appendRoomMessage(msg) {
    if (hasMessageId(msg.id)) return false;
    const map = readMessagesMap();
    const list = Array.isArray(map[OPS_ROOM_ID]) ? [...map[OPS_ROOM_ID]] : [];
    list.push(msg);
    map[OPS_ROOM_ID] = list;
    writeMessagesMap(map);

    const threads = readThreads();
    const idx = threads.findIndex((t) => String(t.id) === OPS_ROOM_ID);
    const preview = String(msg.opsCard?.title || msg.text || "運営通知").slice(0, 80);
    const now = msg.createdAt || new Date().toISOString();
    if (idx >= 0) {
      threads[idx] = { ...threads[idx], lastMessage: preview, updatedAt: now };
    } else {
      threads.unshift({
        id: OPS_ROOM_ID,
        listingId: "ops",
        listingType: "system",
        listingTitle: "AI運営秘書",
        category: "運営",
        sellerId: "tasu_ops",
        sellerName: "TASFUL運営通知",
        buyerId: global.TasuChatUserIdentity?.getEffectiveUserId?.() || "ops-admin",
        buyerName: "運営",
        status: "open",
        source: "talk-ops-assistant",
        lastMessage: preview,
        createdAt: now,
        updatedAt: now,
      });
    }
    writeThreads(threads);
    syncTalkOpsMessageToSupabase(msg);
    return true;
  }

  function labelSupportCategory(cat) {
    return SUPPORT_CAT_LABEL[cat] || cat || "問い合わせ";
  }

  function labelOpsCategory(cat) {
    return OPS_CAT_LABEL[cat] || cat || "運営";
  }

  function recommendForTicket(ticket) {
    const provider = global.TasuAiOpsProvider;
    const cat =
      provider?.inferOpsCategory?.(ticket.body, ticket.category) ||
      ticket.category ||
      "inquiry";
    return (
      provider?.buildRecommendedAction?.(cat, ticket.severity) ||
      "運営が内容を確認し、専用画面で対応してください"
    );
  }

  function recommendForCase(c) {
    const cat = c.ops_category || c.ai_category || "inquiry";
    return (
      global.TasuAiOpsProvider?.buildRecommendedAction?.(cat, c.ai_risk) ||
      "要確認 — 専用画面でステータスを更新してください"
    );
  }

  function linkSupport(ticketId) {
    return `support-trouble-center.html?ticket=${encodeURIComponent(ticketId)}`;
  }

  function linkAiOps(caseId) {
    return `admin-ai-operations-center.html?case=${encodeURIComponent(caseId)}`;
  }

  function hubItem(payload) {
    return {
      id: String(payload.id || `hub-${Date.now()}`),
      title: String(payload.title || "（無題）"),
      meta: String(payload.meta || ""),
      href: String(payload.href || "#"),
      linkLabel: String(payload.linkLabel || "詳細を見る"),
      priority: payload.priority === "critical" || payload.priority === "high" ? payload.priority : "normal",
      source: String(payload.source || ""),
    };
  }

  function collectOpenInquiries() {
    return (global.TasuSupportTicketStore?.listTickets?.() || [])
      .filter((t) => t.status === "open" || t.status === "ai_replied")
      .map((t) =>
        hubItem({
          id: `inq-${t.id}`,
          title: t.title,
          meta: `${labelSupportCategory(t.category)} / ${t.status}`,
          href: linkSupport(t.id),
          linkLabel: "トラブルセンター",
          priority:
            t.severity === "critical" ? "critical" : t.severity === "high" ? "high" : "normal",
          source: "support",
        })
      );
  }

  function collectReports() {
    const rows = [];
    (global.TasuSupportTicketStore?.listTickets?.() || []).forEach((t) => {
      if (t.status === "resolved") return;
      if (/通報/.test(String(t.title + t.body))) {
        rows.push(
          hubItem({
            id: `rpt-support-${t.id}`,
            title: t.title,
            meta: `Support / ${labelSupportCategory(t.category)}`,
            href: linkSupport(t.id),
            linkLabel: "トラブルセンター",
            priority: t.severity === "critical" ? "critical" : "high",
            source: "support",
          })
        );
      }
    });
    (global.TasuAiOpsCaseStore?.listCases?.() || []).forEach((c) => {
      if (c.status === "resolved") return;
      const cat = c.ops_category || c.ai_category || "";
      if (cat === "report" || cat === "violation_report" || /通報|違反/.test(String(c.title + c.body))) {
        rows.push(
          hubItem({
            id: `rpt-aiops-${c.id}`,
            title: c.title,
            meta: `${labelOpsCategory(cat)} / ${c.ai_risk}`,
            href: linkAiOps(c.id),
            linkLabel: "AI運営センター",
            priority: c.ai_risk === "critical" ? "critical" : "high",
            source: "ai_ops",
          })
        );
      }
    });
    return rows;
  }

  function collectAnpiItems() {
    const items = [];
    const store = global.TasuTalkNotifications;
    const list = store?.getAll?.() || [];
    list.forEach((n) => {
      const cat = String(n.category || "").toLowerCase();
      const type = String(n.type || "").toLowerCase();
      if (cat !== "anpi" && type !== "anpi") return;
      const unread = store?.isUnread?.(n) !== false && !n.readAt;
      items.push(
        hubItem({
          id: `anpi-${n.id}`,
          title: n.title,
          meta: unread ? "未読 · 安否" : "既読 · 安否",
          href: n.targetUrl || "anpi-dashboard.html",
          linkLabel: "安否を開く",
          priority: String(n.priority || "").toLowerCase() === "urgent" ? "critical" : "high",
          source: "notify",
        })
      );
    });
    return items;
  }

  function collectConnectHubItems() {
    const tickets = filterSupport({ category: "connect_issue" });
    const cases = filterAiOps({ ops_category: "connect_issue" });
    return [...tickets, ...cases].map((r, i) =>
      hubItem({
        id: `connect-${i}-${r.href}`,
        title: r.title,
        meta: r.meta,
        href: r.href,
        linkLabel: "詳細を見る",
        priority: /critical|high/i.test(r.meta) ? "high" : "normal",
        source: "connect",
      })
    );
  }

  function collectBuilderHubItems() {
    return collectBuilderAlerts().map((c) =>
      hubItem({
        id: c.messageId,
        title: c.headline,
        meta: `${c.categoryLabel} · ${String(c.body || "").slice(0, 48)}`,
        href: c.linkHref,
        linkLabel: c.linkLabel,
        priority: c.priority === "critical" ? "critical" : "high",
        source: "builder",
      })
    );
  }

  function collectOpsWatchHubItems() {
    const store = global.TasuTalkNotifications;
    return (store?.getAll?.() || [])
      .filter((n) => String(n?.source || "").toLowerCase() === "ops_watch")
      .sort((a, b) =>
        String(b.createdAt || b.updatedAt || "").localeCompare(
          String(a.createdAt || a.updatedAt || "")
        )
      )
      .slice(0, 15)
      .map((n) => {
        const imp = String(n.opsWatchImportance || "").toLowerCase();
        const unread = store?.isUnread?.(n) !== false && !n.readAt;
        return hubItem({
          id: `ow-${n.id}`,
          title: n.title,
          meta: [imp && `重要度 ${imp}`, unread && "未読"].filter(Boolean).join(" · "),
          href: "talk-home.html?tab=notify&talkAdmin=1",
          linkLabel: "TALK通知で見る",
          priority: imp === "high" ? "high" : "normal",
          source: "ops_watch",
        });
      });
  }

  function collectPriorityToday() {
    const cards = [...collectSupportAlerts(), ...collectAiOpsAlerts(), ...collectBuilderAlerts()];
    if (cards.length) {
      return cards.slice(0, 8).map((c) =>
        hubItem({
          id: c.messageId,
          title: c.headline,
          meta: `${c.categoryLabel} · ${c.body.slice(0, 48)}`,
          href: c.linkHref,
          linkLabel: c.linkLabel,
          priority: c.priority === "critical" ? "critical" : "high",
          source: c.source,
        })
      );
    }
    return collectOpenInquiries()
      .concat(collectReports())
      .filter((i) => i.priority === "critical" || i.priority === "high")
      .slice(0, 6);
  }

  /**
   * AI運営秘書 — 集約ハブ（毎日の運営画面）
   */
  function buildHubSections() {
    const priority = collectPriorityToday();
    const openInquiry = collectOpenInquiries();
    const report = collectReports();
    const anpi = collectAnpiItems();
    const connect = collectConnectHubItems();
    const builder = collectBuilderHubItems();
    const opsWatch = collectOpsWatchHubItems();
    return {
      generatedAt: new Date().toISOString(),
      metrics: buildMetrics(),
      summaryText: buildDailySummaryText(),
      sections: [
        { id: "priority", label: "本日の優先対応", count: priority.length, items: priority },
        {
          id: "open_inquiry",
          label: "未対応問い合わせ",
          count: openInquiry.length,
          items: openInquiry,
        },
        { id: "report", label: "通報", count: report.length, items: report },
        { id: "anpi", label: "安否", count: anpi.length, items: anpi },
        { id: "connect", label: "Connect関連", count: connect.length, items: connect },
        { id: "builder", label: "Builder", count: builder.length, items: builder },
        { id: "ops_watch", label: "TALK通知（OPS WATCH）", count: opsWatch.length, items: opsWatch },
      ],
    };
  }

  function buildOpsCard(payload) {
    return {
      messageId: payload.messageId,
      headline: payload.headline,
      categoryLabel: payload.categoryLabel,
      body: payload.body,
      recommended: payload.recommended,
      linkHref: payload.linkHref,
      linkLabel: payload.linkLabel || "詳細を見る",
      priority: payload.priority || "high",
      source: payload.source,
    };
  }

  function postOpsCard(payload) {
    const card = buildOpsCard(payload);
    return appendRoomMessage({
      id: card.messageId,
      chatId: OPS_ROOM_ID,
      roomId: OPS_ROOM_ID,
      senderId: SENDER_ID,
      senderName: SENDER_NAME,
      text: card.headline,
      createdAt: new Date().toISOString(),
      kind: "ops_card",
      opsCard: card,
    });
  }

  function collectSupportAlerts() {
    const store = global.TasuSupportTicketStore;
    if (!store?.listTickets) return [];
    return store
      .listTickets()
      .filter(
        (t) =>
          t.status !== "resolved" &&
          (SUPPORT_NOTIFY_SEV.has(t.severity) ||
            t.category === "connect_issue" ||
            t.category === "legal_or_risk" ||
            t.category === "abuse_or_policy")
      )
      .map((t) => {
        const isReport = /通報/.test(String(t.title + t.body));
        const headline = isReport ? "【通報】" : "【高リスク問い合わせ】";
        const useAiOps =
          t.category === "legal_or_risk" ||
          t.category === "abuse_or_policy" ||
          t.severity === "critical";
        return buildOpsCard({
          messageId: `ops-support-${t.id}`,
          headline,
          categoryLabel: labelSupportCategory(t.category),
          body: String(t.title || t.body || "").slice(0, 200),
          recommended: recommendForTicket(t),
          linkHref: useAiOps ? linkAiOpsForTicket(t) : linkSupport(t.id),
          linkLabel: useAiOps ? "AI運営センターを開く" : "トラブルセンターを開く",
          priority: t.severity === "critical" ? "critical" : "high",
          source: "support",
        });
      });
  }

  function linkAiOpsForTicket(ticket) {
    const cases = global.TasuAiOpsCaseStore?.listCases?.() || [];
    const linked = cases.find((c) => c.support_ticket_id === ticket.id);
    return linked ? linkAiOps(linked.id) : "admin-ai-operations-center.html";
  }

  function collectAiOpsAlerts() {
    const store = global.TasuAiOpsCaseStore;
    if (!store?.listCases) return [];
    return store
      .listCases()
      .filter((c) => {
        if (c.status === "resolved") return false;
        const cat = c.ops_category || c.ai_category || "";
        return (
          AI_OPS_NOTIFY_CATS.has(cat) ||
          cat === "report" ||
          cat === "violation_report"
        );
      })
      .map((c) => {
        const cat = c.ops_category || c.ai_category || "";
        const isViolation =
          cat === "abuse_or_policy" ||
          cat === "violation_report" ||
          cat === "external_payment";
        const isReport = cat === "report";
        let headline = "【高リスク案件】";
        if (isReport) headline = "【通報】";
        else if (isViolation) headline = "【違反報告】";
        else if (cat === "connect_issue") headline = "【Connect問題】";
        return buildOpsCard({
          messageId: `ops-aiops-${c.id}`,
          headline,
          categoryLabel: labelOpsCategory(cat),
          body: String(c.title || c.ai_summary || c.body || "").slice(0, 200),
          recommended: recommendForCase(c),
          linkHref: linkAiOps(c.id),
          linkLabel: "AI運営センターを開く",
          priority: c.ai_risk === "critical" ? "critical" : "high",
          source: "ai_ops",
        });
      });
  }

  function collectBuilderAlerts() {
    const ev = global.TasuBuilderPartnerEval;
    if (!ev) return [];
    const rows = [];
    (ev.listHiddenPartners?.() || []).forEach((p) => {
      rows.push(
        buildOpsCard({
          messageId: `ops-builder-hide-${p.partner_id}`,
          headline: "【パートナー非表示】",
          categoryLabel: "Builder · ドタキャン等",
          body: `${p.partner_name} — 非表示（${p.partner_status || "hidden"}）`,
          recommended: "非表示理由を確認し、必要ならパートナー評価画面で復帰可否を判断",
          linkHref: "builder/admin-partner-evaluations.html#hidden-partners",
          linkLabel: "非表示一覧を開く",
          priority: "high",
          source: "builder",
        })
      );
    });

    const board = ev.listPartnerScoreboard?.(true) || [];
    board
      .filter((r) => !r.hidden && (r.score?.total_score < 0 || r.badge?.mod === "warn"))
      .forEach((r) => {
        rows.push(
          buildOpsCard({
            messageId: `ops-builder-warn-${r.partner_id}`,
            headline: "【要注意評価】",
            categoryLabel: "Builder · 実績評価",
            body: `${r.partner_name} — 合算 ${r.score?.total_score ?? 0}（${r.badge?.label || "要注意"}）`,
            recommended: "期日・クレーム履歴を確認。掲載停止・非表示は評価画面から（確認必須）",
            linkHref: "builder/admin-partner-evaluations.html",
            linkLabel: "パートナー評価を開く",
            priority: "high",
            source: "builder",
          })
        );
      });
    return rows;
  }

  function ensurePinnedIntro() {
    const id = "ops-msg-intro-pinned";
    if (hasMessageId(id)) return;
    appendRoomMessage({
      id,
      senderId: SENDER_ID,
      senderName: SENDER_NAME,
      text: "運営通知ルームへようこそ",
      createdAt: new Date().toISOString(),
      kind: "ops_intro",
      opsIntro: {
        title: "TASFUL運営通知 / AI運営秘書",
        lines: ["運営通知", "AI要約", "対応候補"],
        note: "返金・BAN・Connect・Stripeの実行はこの画面では行いません。リンク先の管理画面で操作してください。",
      },
    });
  }

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  }

  function buildMetrics() {
    const tickets = global.TasuSupportTicketStore?.listTickets?.() || [];
    const cases = (global.TasuAiOpsCaseStore?.listCases?.() || []).filter(
      (c) => c.status !== "resolved"
    );
    const open = tickets.filter((t) => t.status === "open").length;
    const connect =
      tickets.filter((t) => t.category === "connect_issue" && t.status !== "resolved").length +
      cases.filter((c) => (c.ops_category || c.ai_category) === "connect_issue").length;
    const needsReview =
      tickets.filter((t) => t.status === "needs_review" || t.status === "in_progress").length +
      cases.filter((c) => c.status === "needs_review").length;
    const highRisk =
      tickets.filter(
        (t) =>
          t.status !== "resolved" &&
          (t.severity === "high" || t.severity === "critical")
      ).length +
      cases.filter((c) => c.ai_risk === "high" || c.ai_risk === "critical").length;
    const violationReportCount =
      tickets.filter(
        (t) =>
          t.status !== "resolved" &&
          (t.category === "abuse_or_policy" || t.category === "legal_or_risk" || /通報/.test(String(t.title + t.body)))
      ).length +
      cases.filter((c) => {
        const cat = c.ops_category || c.ai_category || "";
        return cat === "report" || cat === "violation_report" || /通報|違反/.test(String(c.title + c.body));
      }).length;
    const anpiCount = collectAnpiItems().length;
    const opsWatchCount = collectOpsWatchHubItems().length;
    const builderCount = collectBuilderHubItems().length;
    return {
      open,
      connect,
      needsReview,
      highRisk,
      openCount: open,
      needsReviewCount: needsReview,
      highCriticalCount: highRisk,
      connectCount: connect,
      violationReportCount,
      anpiCount,
      opsWatchCount,
      builderCount,
    };
  }

  function buildDailySummaryText() {
    const m = buildMetrics();
    const priorities = collectSupportAlerts()
      .concat(collectAiOpsAlerts())
      .sort((a, b) => (a.priority === "critical" ? -1 : 0))
      .slice(0, 3)
      .map((c) => `・${c.body.slice(0, 40)}`);

    const lines = [
      "おはようございます。",
      "",
      "本日の状況",
      "",
      `未対応問い合わせ：${m.open}件`,
      `Connect問題：${m.connect}件`,
      `要確認案件：${m.needsReview}件`,
      `高リスク案件：${m.highRisk}件`,
      "",
      "本日の優先対応",
      priorities.length ? priorities.join("\n") : "・現在、優先対応は登録されていません",
      "",
      "※ 実行操作は各管理画面から行ってください。",
    ];
    return lines.join("\n");
  }

  function maybePostDailySummary() {
    const id = `ops-daily-${todayKey()}`;
    if (hasMessageId(id)) return false;
    return appendRoomMessage({
      id,
      senderId: SENDER_ID,
      senderName: SENDER_NAME,
      text: "本日の運営サマリー",
      createdAt: new Date().toISOString(),
      kind: "ops_summary",
      opsSummary: buildDailySummaryText(),
    });
  }

  function syncNotifications() {
    ensurePinnedIntro();
    maybePostDailySummary();
    const cards = [...collectSupportAlerts(), ...collectAiOpsAlerts(), ...collectBuilderAlerts()];
    let added = 0;
    cards.forEach((card) => {
      if (postOpsCard(card)) added += 1;
    });
    return { added, pending: countPendingAlerts() };
  }

  function countPendingAlerts() {
    return (
      collectSupportAlerts().length +
      collectAiOpsAlerts().length +
      collectBuilderAlerts().length
    );
  }

  function getRoomPreview() {
    const msgs = getRoomMessages();
    const last = msgs[msgs.length - 1];
    return {
      lastMessagePreview: last
        ? String(last.opsCard?.headline || last.text || "運営通知").slice(0, 60)
        : "運営通知 · AI要約 · 対応候補",
      unreadCount: Math.min(countPendingAlerts(), 9),
    };
  }

  const TALK_COMMANDS = [
    { re: /未対応だけ|未対応のみ|未対応/, run: () => filterSupport({ status: "open" }) },
    { re: /高リスク/, run: () => filterCombinedHighRisk() },
    { re: /Connect問題|Connectだけ|connect/i, run: () => filterConnect() },
    { re: /通報一覧|通報だけ|通報/, run: () => filterAiOps({ ops_category: "report" }) },
    { re: /違反一覧|違反報告|違反/, run: () => filterViolations() },
    { re: /要確認だけ|要確認のみ|要確認/, run: () => filterNeedsReview() },
  ];

  function filterSupport(filter) {
    const list = global.TasuSupportTicketStore?.listTickets?.(filter) || [];
    return list
      .filter((t) => t.status !== "resolved")
      .map((t) => ({
        title: t.title,
        meta: `${labelSupportCategory(t.category)} / ${t.severity} / ${t.status}`,
        href: linkSupport(t.id),
      }));
  }

  function filterAiOps(filter) {
    return (global.TasuAiOpsCaseStore?.listCases?.(filter) || [])
      .filter((c) => c.status !== "resolved")
      .map((c) => ({
        title: c.title,
        meta: `${labelOpsCategory(c.ops_category || c.ai_category)} / ${c.ai_risk}`,
        href: linkAiOps(c.id),
      }));
  }

  function filterCombinedHighRisk() {
    const a = filterSupport({ severity: "high" }).concat(filterSupport({ severity: "critical" }));
    const b = filterAiOps({ ai_risk_in: ["high", "critical"] });
    return [...a, ...b];
  }

  function filterConnect() {
    const tickets = filterSupport({ category: "connect_issue" });
    const cases = filterAiOps({ ops_category: "connect_issue" });
    return [...tickets, ...cases];
  }

  function filterViolations() {
    return filterAiOps({}).filter((row) =>
      /違反|abuse|外部決済|violation/i.test(row.meta)
    );
  }

  function filterNeedsReview() {
    const tickets = (global.TasuSupportTicketStore?.listTickets?.() || []).filter(
      (t) => t.status === "needs_review" || t.status === "in_progress"
    );
    const cases = filterAiOps({ status: "needs_review" });
    return [
      ...tickets.map((t) => ({
        title: t.title,
        meta: `Support / ${t.status}`,
        href: linkSupport(t.id),
      })),
      ...cases,
    ];
  }

  function parseTalkOpsCommand(text) {
    const raw = String(text || "").trim();
    if (!raw) return { ok: false, error: "コマンドが空です" };
    for (const cmd of TALK_COMMANDS) {
      if (cmd.re.test(raw)) {
        return { ok: true, label: raw, rows: cmd.run() };
      }
    }
    const ai = global.TasuAiOpsCommand?.parseOpsCommand?.(raw);
    if (ai?.ok && ai.filter) {
      const rows = (global.TasuAiOpsCaseStore?.listCases?.(ai.filter) || [])
        .filter((c) => c.status !== "resolved")
        .map((c) => ({
          title: c.title,
          meta: `${labelOpsCategory(c.ops_category || c.ai_category)} / ${c.ai_risk}`,
          href: linkAiOps(c.id),
        }));
      return { ok: true, label: raw, rows };
    }
    return { ok: false, error: "該当するコマンドがありません" };
  }

  function formatCommandResult(parsed) {
    if (!parsed.ok) return parsed.error || "エラー";
    if (!parsed.rows?.length) {
      return `「${parsed.label}」の結果：該当案件はありません。`;
    }
    const lines = parsed.rows.slice(0, 8).map((r, i) => {
      return `${i + 1}. ${r.title}\n   ${r.meta}\n   → ${r.href}`;
    });
    const more = parsed.rows.length > 8 ? `\n…他 ${parsed.rows.length - 8} 件` : "";
    return `「${parsed.label}」の抽出結果（${parsed.rows.length}件）\n\n${lines.join("\n\n")}${more}\n\n※ 実行は管理画面から行ってください。`;
  }

  function postUserCommand(text) {
    const me =
      global.TasuChatUserIdentity?.getEffectiveUserId?.() ||
      global.TASU_CHAT_SUPABASE_CONFIG?.currentUserId ||
      "ops-admin";
    appendRoomMessage({
      id: `ops-user-${Date.now()}`,
      senderId: me,
      senderName: "運営",
      text: String(text).trim(),
      createdAt: new Date().toISOString(),
      kind: "text",
    });
    const parsed = parseTalkOpsCommand(text);
    appendRoomMessage({
      id: `ops-cmd-${Date.now()}`,
      senderId: SENDER_ID,
      senderName: SENDER_NAME,
      text: parsed.ok ? "コマンド結果" : "コマンドエラー",
      createdAt: new Date().toISOString(),
      kind: "ops_command_result",
      opsCommandText: formatCommandResult(parsed),
    });
    return parsed;
  }

  function clearRoomForTests() {
    const map = readMessagesMap();
    delete map[OPS_ROOM_ID];
    writeMessagesMap(map);
    writeThreads(readThreads().filter((t) => String(t.id) !== OPS_ROOM_ID));
  }

  function bindStoreEvents() {
    if (global.__tasuTalkOpsEventsBound) return;
    global.__tasuTalkOpsEventsBound = true;
    [
      "tasu:support-tickets-updated",
      "tasu:ai-ops-cases-changed",
      "tasu:builder-partner-eval-changed",
      "tasful-talk-notifications-changed",
      "tasu:ops-watch-daily-summary",
    ].forEach((ev) => {
      global.addEventListener(ev, () => {
        syncNotifications();
        try {
          global.dispatchEvent(new CustomEvent("tasu:talk-ops-hub-updated"));
        } catch {
          /* ignore */
        }
      });
    });
  }

  bindStoreEvents();

  global.TasuTalkOpsAssistant = {
    OPS_ROOM_ID,
    SENDER_ID,
    syncNotifications,
    buildHubSections,
    getRoomMessages,
    getRoomPreview,
    countPendingAlerts,
    buildDailySummaryText,
    collectOpenInquiries,
    collectReports,
    collectAnpiItems,
    collectConnectHubItems,
    collectBuilderHubItems,
    collectOpsWatchHubItems,
    collectPriorityToday,
    parseTalkOpsCommand,
    formatCommandResult,
    postUserCommand,
    collectSupportAlerts,
    collectAiOpsAlerts,
    collectBuilderAlerts,
    clearRoomForTests,
    linkSupport,
    linkAiOps,
  };
})(typeof window !== "undefined" ? window : globalThis);
