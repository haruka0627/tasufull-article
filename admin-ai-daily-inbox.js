/**
 * AI運営秘書 Phase6 — Daily Inbox
 * 毎朝5分で全体確認できる統合インボックス。
 */
(function (global) {
  "use strict";

  const DISMISSED_KEY = "tasu_ai_daily_inbox_dismissed_v1";

  const CATEGORY_LABELS = Object.freeze({
    needs_judgment: "要判断",
    pending_approval: "承認待ち",
    auto_done: "自動処理済み",
  });

  const SOURCE_LABELS = Object.freeze({
    response_plan: "AI対応案",
    automation: "自動処理",
    connect: "Connect",
    support: "Support",
    builder: "Builder",
    anpi: "安否",
    talk: "TALK通知",
    market: "市場",
    content_gate: "Content Gate",
    ai_ops: "通報・AI-ops",
  });

  let toastTimer = null;

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

  function readDismissedSet() {
    const arr = readJson(DISMISSED_KEY, []);
    return new Set(Array.isArray(arr) ? arr : []);
  }

  function writeDismissedSet(set) {
    writeJson(DISMISSED_KEY, [...set]);
  }

  function clearDismissedForTests() {
    writeJson(DISMISSED_KEY, []);
  }

  function isToday(iso) {
    if (!iso) return false;
    const d = new Date(iso);
    const n = new Date();
    return (
      d.getFullYear() === n.getFullYear() &&
      d.getMonth() === n.getMonth() &&
      d.getDate() === n.getDate()
    );
  }

  function classifyResponsePlan(plan) {
    if (plan.status === "sent") return "auto_done";
    if (plan.confirmOnly || plan.gateLevel === "high" || plan.gateLevel === "prohibited" || plan.riskLevel === "high") {
      return "needs_judgment";
    }
    if (plan.requiresApproval || plan.gateLevel === "medium" || plan.status === "edited") {
      return "pending_approval";
    }
    return "pending_approval";
  }

  function classifyAutomation(c) {
    if (c.status === "executed") return "auto_done";
    if (c.requiresOpsOnly || c.status === "escalated" || c.gateLevel === "high" || c.gateLevel === "prohibited") {
      return "needs_judgment";
    }
    if (c.status === "scheduled" || c.gateLevel === "medium" || !c.autoExecutable) {
      return "pending_approval";
    }
    return "pending_approval";
  }

  function collectFromResponsePlans() {
    const plans = global.TasuAdminAiResponsePlans?.buildResponsePlans?.() || [];
    return plans.map((p) => ({
      id: `inbox_plan_${p.id}`,
      source: "response_plan",
      sourceId: p.id,
      category: classifyResponsePlan(p),
      eventType: p.eventType,
      riskLevel: p.riskLevel,
      gateLevel: p.gateLevel,
      title: p.eventTypeLabel || "AI対応案",
      target: p.targetUser || "—",
      reason: p.gateReason || p.aiReason || p.aiSuggestion || "",
      recommendedAction: p.primaryActionLabel || "確認",
      targetUrl: p.targetUrl || "#ops-ai-response",
      priority: p.gateLevel === "high" ? 0 : p.gateLevel === "medium" ? 1 : 2,
      createdAt: p.updatedAt || p.createdAt,
    }));
  }

  function collectFromAutomation() {
    const items = global.TasuAdminAiAutomationEngine?.buildAutomationCandidates?.() || [];
    return items.map((c) => ({
      id: `inbox_auto_${c.id}`,
      source: "automation",
      sourceId: c.id,
      category: classifyAutomation(c),
      eventType: c.eventType,
      riskLevel: c.riskLevel,
      gateLevel: c.gateLevel,
      title: c.ruleName,
      target: c.targetUser || "—",
      reason: c.reason || "",
      recommendedAction: c.autoExecutable ? "今すぐ実行" : c.requiresOpsOnly ? "運営確認" : "承認",
      targetUrl: c.targetUrl || "#ops-ai-automation",
      priority: c.requiresOpsOnly ? 0 : c.autoExecutable ? 2 : 1,
      createdAt: c.updatedAt || c.createdAt,
    }));
  }

  function collectAutoDoneFromActivity() {
    const out = [];
    const seen = new Set();

    (global.TasuAdminAiAutomationEngine?.readActivity?.() || []).forEach((a) => {
      if (!isToday(a.at)) return;
      if (!["executed", "approved"].includes(a.action)) return;
      const id = `inbox_done_auto_${a.candidateId || a.id}`;
      if (seen.has(id)) return;
      seen.add(id);
      out.push({
        id,
        source: "automation",
        sourceId: a.candidateId || a.id,
        category: "auto_done",
        title: a.ruleName || "自動処理",
        target: a.target || "—",
        reason: a.reason || "自動処理が実行されました",
        recommendedAction: "記録確認",
        targetUrl: "#ops-ai-automation",
        priority: 3,
        createdAt: a.at,
      });
    });

    (global.TasuAdminAiResponsePlans?.listOpsActivity?.() || []).forEach((a) => {
      if (!isToday(a.at)) return;
      if (a.type !== "ai_response_sent") return;
      const id = `inbox_done_plan_${a.eventType}_${a.targetUser}`;
      if (seen.has(id)) return;
      seen.add(id);
      out.push({
        id,
        source: "response_plan",
        sourceId: "",
        category: "auto_done",
        title: a.eventTypeLabel || "AI対応送信",
        target: a.targetUser || "—",
        reason: a.messagePreview || a.text || "送信済み",
        recommendedAction: "送信ログ確認",
        targetUrl: "#ops-ai-response",
        priority: 3,
        createdAt: a.at,
      });
    });

    (global.TasuAdminAiResponsePlans?.buildResponsePlans?.() || [])
      .filter((p) => p.status === "sent")
      .forEach((p) => {
        const id = `inbox_done_plan_${p.id}`;
        if (seen.has(id)) return;
        seen.add(id);
        out.push({
          id,
          source: "response_plan",
          sourceId: p.id,
          category: "auto_done",
          title: p.eventTypeLabel,
          target: p.targetUser,
          reason: "AI対応案を送信済み",
          recommendedAction: "記録確認",
          targetUrl: p.targetUrl || "#ops-ai-response",
          priority: 3,
          createdAt: p.updatedAt || p.createdAt,
        });
      });

    return out;
  }

  function collectFromConnect() {
    const items = global.TasuAdminConnectAiSupport?.buildConnectActionItems?.() || [];
    return items.map((item) => ({
      id: `inbox_connect_${item.id}`,
      source: "connect",
      sourceId: item.id,
      category: item.severity === "critical" || item.severity === "high" ? "needs_judgment" : "pending_approval",
      title: item.subject || "Connect未完了",
      target: item.subject || "Connect利用者",
      reason: item.summary || item.aiAnalysis || "Connect追加情報が必要です",
      recommendedAction: item.nextActionLabel || "Connect確認",
      targetUrl: item.targetUrl || "#ops-ai-connect",
      priority: item.severity === "critical" ? 0 : 1,
      createdAt: item.receivedAt,
    }));
  }

  function collectFromSupport() {
    const store = global.TasuSupportTicketStore;
    if (!store?.listTickets) return [];
    const open = new Set(["open", "needs_review", "in_progress"]);
    return (store.listTickets() || [])
      .filter((t) => open.has(t.status))
      .slice(0, 6)
      .map((t) => {
        const sev = String(t.severity || "medium").toLowerCase();
        let inboxCategory = "pending_approval";
        let eventType = "inquiry_received";
        let riskLevel = sev === "low" ? "low" : sev === "high" || sev === "critical" ? "high" : "medium";
        let gateLevel = riskLevel === "low" ? "low" : riskLevel === "high" ? "high" : "medium";
        if (/支払い|決済|payment/i.test(`${t.title}\n${t.body}`)) {
          eventType = "payment_pending";
          riskLevel = "low";
          gateLevel = "low";
        }
        if (sev === "high" || sev === "critical" || t.category === "abuse_or_policy") inboxCategory = "needs_judgment";
        return {
          id: `inbox_support_${t.id}`,
          source: "support",
          sourceId: t.id,
          category: inboxCategory,
          eventType,
          riskLevel,
          gateLevel,
          title: t.title || "問い合わせ",
          target: t.user_id || "問い合わせユーザー",
          reason: String(t.body || "").slice(0, 120),
          recommendedAction: inboxCategory === "needs_judgment" ? "運営確認" : "一次返信案を確認",
          targetUrl: `support-trouble-center.html?ticket=${encodeURIComponent(t.id)}`,
          priority: inboxCategory === "needs_judgment" ? 0 : 1,
          createdAt: t.updated_at || t.created_at,
        };
      });
  }

  function collectFromBuilder() {
    const evals = global.TasuBuilderPartnerEval?.listEvaluations?.() || [];
    const inboxTypes = new Set(["application", "completion_report", "rejection", "needs_review"]);
    return evals
      .filter(
        (e) => e.status === "needs_review" || inboxTypes.has(e.event_type) || e.visibility === "hidden"
      )
      .slice(0, 4)
      .map((e) => ({
        id: `inbox_builder_${e.id || e.partner_id}`,
        source: "builder",
        sourceId: e.id || e.partner_id,
        category: e.visibility === "hidden" ? "needs_judgment" : "pending_approval",
        title: e.partner_name || e.display_name || "Builder審査",
        target: e.partner_name || "Builderパートナー",
        reason: e.reason || e.summary || "Builder評価の確認が必要です",
        recommendedAction: "審査画面で確認",
        targetUrl: "builder/admin-partner-evaluations.html",
        priority: e.visibility === "hidden" ? 0 : 1,
        createdAt: e.updated_at || e.created_at,
      }));
  }

  function collectFromAnpi() {
    const hub = global.TasuTalkOpsAssistant?.buildHubSections?.();
    const sec = hub?.sections?.find((s) => s.id === "anpi");
    if (!sec?.items?.length) return [];
    return sec.items.slice(0, 4).map((item, idx) => {
      const urgent = /未読|未応答|緊急/.test(String(item.meta || ""));
      return {
        id: `inbox_anpi_${item.id || idx}`,
        source: "anpi",
        sourceId: item.id || String(idx),
        category: urgent ? "needs_judgment" : "pending_approval",
        title: item.title || "安否",
        target: item.title || "安否利用者",
        reason: item.meta || "安否関連の確認が必要です",
        recommendedAction: urgent ? "緊急確認" : "リマインド確認",
        targetUrl: item.href || "anpi-dashboard.html",
        priority: urgent ? 0 : 1,
        createdAt: new Date().toISOString(),
      };
    });
  }

  function collectFromSupportEvents() {
    const store = global.TasuSupportTicketStore;
    if (!store?.listLifecycleEvents) return [];
    const labels = {
      support_reopened: "Support再問い合わせ",
      support_complaint: "Support通報",
    };
    return store
      .listLifecycleEvents({ todayOnly: true })
      .slice(0, 4)
      .map((e) => {
        const urgent = e.event_type === "support_complaint";
        const ticket = store.getTicket?.(e.ticket_id);
        return {
          id: `inbox_support_evt_${e.id}`,
          source: "support",
          sourceId: e.ticket_id,
          category: urgent ? "needs_judgment" : "pending_approval",
          eventType: e.event_type,
          title: labels[e.event_type] || "Supportイベント",
          target: ticket?.user_id || "問い合わせユーザー",
          reason: e.payload_summary || labels[e.event_type] || "",
          recommendedAction: urgent ? "運営確認" : "一次返信案を確認",
          targetUrl: ticket
            ? `support-trouble-center.html?ticket=${encodeURIComponent(ticket.id)}`
            : "support-trouble-center.html",
          priority: urgent ? 0 : 1,
          createdAt: e.created_at,
        };
      });
  }

  function collectFromMarket() {
    const events = global.TasuMarketEventStore?.listMarketEvents?.() || [];
    const inboxTypes = new Set([
      "order_created",
      "payment_completed",
      "order_cancelled",
      "refund_requested",
      "refund_completed",
    ]);
    const labels = {
      order_created: "市場・新規注文",
      payment_completed: "市場・決済完了",
      order_cancelled: "市場・キャンセル",
      refund_requested: "市場・返金申請",
      refund_completed: "市場・返金完了",
    };
    return events
      .filter((e) => inboxTypes.has(e.event_type))
      .slice(0, 6)
      .map((e) => {
        const urgent = ["refund_requested", "order_cancelled"].includes(e.event_type);
        return {
          id: `inbox_market_${e.id}`,
          source: "market",
          sourceId: e.order_id || e.id,
          category: urgent ? "needs_judgment" : "pending_approval",
          eventType: e.event_type,
          title: labels[e.event_type] || "市場イベント",
          target: e.product_name || e.order_id || "市場注文",
          reason: e.note || `${labels[e.event_type] || e.event_type}（${e.order_id || "—"}）`,
          recommendedAction: urgent ? "注文・返金を確認" : "注文履歴で確認",
          targetUrl: "shop-market-order-history.html",
          priority: urgent ? 0 : 1,
          createdAt: e.created_at,
        };
      });
  }

  function collectFromTalk() {
    const store = global.TasuTalkNotifications;
    if (!store?.getAll) return [];
    return (store.getAll() || [])
      .filter((n) => {
        const unread = store.isUnread?.(n) !== false && !n.readAt;
        const important = ["important", "urgent", "high"].includes(String(n.priority || "").toLowerCase());
        return unread && important;
      })
      .slice(0, 4)
      .map((n) => ({
        id: `inbox_talk_${n.id}`,
        source: "talk",
        sourceId: n.id,
        category: "pending_approval",
        title: n.title || "重要通知",
        target: n.recipientUserId || "通知先",
        reason: String(n.body || "").slice(0, 100) || "未読の重要通知",
        recommendedAction: "通知センターで確認",
        targetUrl: n.targetUrl || n.href || "talk-home.html?tab=notify&talkAdmin=1",
        priority: 1,
        createdAt: n.createdAt,
      }));
  }

  function collectFromContentGate() {
    const bridge = global.TasuPlatformOpsInboxBridge;
    if (bridge?.collectExternalInboxItems) return bridge.collectExternalInboxItems();
    return [];
  }

  function collectFromAiOps() {
    const store = global.TasuAiOpsCaseStore;
    if (!store?.listCases) return [];
    return store
      .listCases()
      .filter((c) => {
        if (c.status === "resolved") return false;
        const cat = c.ops_category || c.ai_category || "";
        return cat === "report" || cat === "violation_report" || /通報/.test(String(c.title + c.body));
      })
      .slice(0, 8)
      .map((c) => ({
        id: `inbox_aiops_${c.id}`,
        source: "ai_ops",
        sourceId: c.id,
        category: c.ai_risk === "critical" || c.ai_risk === "high" ? "needs_judgment" : "pending_approval",
        eventType: c.ops_category || "report",
        title: c.title || "通報",
        target: c.user_id || "—",
        reason: String(c.ai_summary || c.body || "").slice(0, 120),
        recommendedAction: "通報を確認",
        targetUrl:
          global.TasuPlatformOpsActionUrl?.buildAiOpsCaseUrl?.(c.id) ||
          `admin-ai-operations-center.html?case=${encodeURIComponent(c.id)}`,
        priority: c.ai_risk === "critical" ? 0 : 1,
        createdAt: c.updated_at || c.created_at,
      }));
  }

  function collectAllRawItems() {
    return [
      ...collectFromResponsePlans(),
      ...collectFromAutomation(),
      ...collectFromConnect(),
      ...collectFromContentGate(),
      ...collectFromSupport(),
      ...collectFromAiOps(),
      ...collectFromSupportEvents(),
      ...collectFromBuilder(),
      ...collectFromMarket(),
      ...collectFromAnpi(),
      ...collectFromTalk(),
      ...collectAutoDoneFromActivity(),
    ];
  }

  function findItemById(id) {
    const seen = new Set();
    for (const item of collectAllRawItems()) {
      if (item.id === id && !seen.has(item.id)) return item;
      seen.add(item.id);
    }
    return null;
  }

  function buildInboxItems() {
    const dismissed = readDismissedSet();
    const seen = new Set();
    const raw = collectAllRawItems();

    const items = [];
    for (const item of raw) {
      if (dismissed.has(item.id)) continue;
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      const adjusted = global.TasuAdminAiOutcomeLearning?.applyInboxPriority?.(item) || item;
      items.push(adjusted);
    }

    const catOrder = { needs_judgment: 0, pending_approval: 1, auto_done: 2 };
    items.sort(
      (a, b) =>
        (catOrder[a.category] ?? 9) - (catOrder[b.category] ?? 9) ||
        (a.priority ?? 9) - (b.priority ?? 9) ||
        String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
    );
    return items;
  }

  function buildDailySummary(items) {
    const needsJudgment = items.filter((i) => i.category === "needs_judgment");
    const pendingApproval = items.filter((i) => i.category === "pending_approval");
    const autoDone = items.filter((i) => i.category === "auto_done");
    const top = needsJudgment[0] || pendingApproval[0] || null;
    return {
      needsJudgmentCount: needsJudgment.length,
      pendingApprovalCount: pendingApproval.length,
      autoDoneCount: autoDone.length,
      totalCount: items.length,
      topPriority: top
        ? {
            title: top.title,
            target: top.target,
            reason: top.reason,
            recommendedAction: top.recommendedAction,
            targetUrl: top.targetUrl,
            category: top.category,
          }
        : null,
    };
  }

  function pushExternalSignal(signal) {
    return global.TasuPlatformOpsInboxBridge?.pushExternalSignal?.(signal) || { pushed: false };
  }

  function completeInboxItem(id) {
    const bridge = global.TasuPlatformOpsInboxBridge;
    if (bridge?.completeInboxItem) return bridge.completeInboxItem(id);
    return dismissInboxItem(id);
  }

  function dismissInboxItem(id) {
    const item = findItemById(id);
    const set = readDismissedSet();
    set.add(id);
    writeDismissedSet(set);
    if (item && item.source === "content_gate") {
      completeInboxItem(id);
      global.dispatchEvent(new CustomEvent("tasu:admin-daily-inbox-updated"));
      return { ok: true };
    }
    if (item && item.source !== "response_plan" && item.source !== "automation") {
      global.TasuAdminAiDecisionLearning?.recordFromInbox?.(item, "dismissed");
    }
    if (item?.source === "response_plan" && item.sourceId) {
      global.TasuAdminAiResponsePlans?.dismissPlan?.(item.sourceId);
    }
    if (item?.source === "automation" && item.sourceId) {
      global.TasuAdminAiAutomationEngine?.stopCandidate?.(item.sourceId);
    }
    global.dispatchEvent(new CustomEvent("tasu:admin-daily-inbox-updated"));
    return { ok: true };
  }

  function approveInboxItem(id) {
    const item = findItemById(id);
    if (!item) return { ok: false, error: "項目が見つかりません" };

    if (item.source === "response_plan" && item.sourceId) {
      return global.TasuAdminAiResponsePlans?.sendPlan?.(item.sourceId) || { ok: false };
    }
    if (item.source === "automation" && item.sourceId) {
      return global.TasuAdminAiAutomationEngine?.approveCandidate?.(item.sourceId) || { ok: false };
    }
    global.TasuAdminAiDecisionLearning?.recordFromInbox?.(item, "approved");
    return { ok: true, message: "詳細画面で承認してください", href: item.targetUrl };
  }

  function renderSummary(summary) {
    const host = global.document?.querySelector("#ops-ai-command-center [data-ops-daily-inbox-summary]")
      || global.document?.querySelector("[data-ops-daily-inbox-summary]");
    const priorityHost = global.document?.querySelector("#ops-ai-command-center [data-ops-daily-inbox-priority]")
      || global.document?.querySelector("[data-ops-daily-inbox-priority]");
    if (!host) return;

    host.innerHTML =
      `<div class="ops-ai-inbox-stats">` +
      `<div class="ops-ai-inbox-stat ops-ai-inbox-stat--warn"><span>要判断</span><strong>${summary.needsJudgmentCount}件</strong></div>` +
      `<div class="ops-ai-inbox-stat ops-ai-inbox-stat--pending"><span>承認待ち</span><strong>${summary.pendingApprovalCount}件</strong></div>` +
      `<div class="ops-ai-inbox-stat ops-ai-inbox-stat--done"><span>自動処理済み</span><strong>${summary.autoDoneCount}件</strong></div>` +
      `</div>`;

    if (priorityHost) {
      if (summary.topPriority) {
        const t = summary.topPriority;
        priorityHost.innerHTML =
          `<p class="ops-ai-inbox-priority__label">最優先タスク</p>` +
          `<p class="ops-ai-inbox-priority__title"><strong>${esc(t.title)}</strong> — ${esc(t.target)}</p>` +
          `<p class="ops-ai-inbox-priority__action">推奨: ${esc(t.recommendedAction)}</p>` +
          (t.targetUrl
            ? `<a class="ops-ai-inbox-priority__link" href="${esc(t.targetUrl)}">詳細を開く</a>`
            : "");
      } else {
        priorityHost.innerHTML = `<p class="ops-ai-inbox-priority__empty">本日の最優先タスクはありません — 問題なし</p>`;
      }
    }
  }

  function renderItemRow(item) {
    const canApprove = item.category !== "auto_done";
    const approveDisabled = item.category === "auto_done" ? " disabled" : "";
    const outcomeHtml = global.TasuAdminAiOutcomeLearning?.renderOutcomeHtml?.(item) || "";
    const outcomeRec = item.outcomeAdjustment?.label
      ? `<p class="ops-ai-inbox-item__outcome">結果推奨: ${esc(item.outcomeAdjustment.label)}</p>`
      : "";
    return (
      `<li class="ops-ai-inbox-item" data-ops-inbox-item data-inbox-id="${esc(item.id)}">` +
      `<div class="ops-ai-inbox-item__main">` +
      `<span class="ops-ai-inbox-item__source">${esc(SOURCE_LABELS[item.source] || item.source)}</span>` +
      `<strong class="ops-ai-inbox-item__title">${esc(item.title)}</strong>` +
      `<span class="ops-ai-inbox-item__target">対象: ${esc(item.target)}</span>` +
      `<p class="ops-ai-inbox-item__reason">${esc(item.reason)}</p>` +
      `<p class="ops-ai-inbox-item__action">推奨操作: ${esc(item.recommendedAction)}</p>` +
      outcomeRec +
      outcomeHtml +
      `</div>` +
      `<div class="ops-ai-inbox-item__btns">` +
      `<a class="ops-ai-inbox-btn ops-ai-inbox-btn--link" href="${esc(item.targetUrl)}">開く</a>` +
      `<button type="button" class="ops-ai-inbox-btn ops-ai-inbox-btn--primary" data-ops-inbox-approve data-inbox-id="${esc(item.id)}"${approveDisabled}>承認</button>` +
      `<button type="button" class="ops-ai-inbox-btn ops-ai-inbox-btn--ghost" data-ops-inbox-hold data-inbox-id="${esc(item.id)}"${item.category === "auto_done" ? " disabled" : ""}>保留</button>` +
      `</div>` +
      `</li>`
    );
  }

  function renderCategorySection(category, items) {
    const label = CATEGORY_LABELS[category] || category;
    const list = items.filter((i) => i.category === category);
    if (!list.length) {
      return (
        `<section class="ops-ai-inbox-section ops-ai-inbox-section--empty" data-ops-inbox-section="${esc(category)}">` +
        `<h3 class="ops-ai-inbox-section__title">${esc(label)} <span class="ops-ai-inbox-section__count">0件</span></h3>` +
        `<p class="ops-ai-inbox-section__empty">該当なし</p>` +
        `</section>`
      );
    }
    return (
      `<section class="ops-ai-inbox-section" data-ops-inbox-section="${esc(category)}">` +
      `<h3 class="ops-ai-inbox-section__title">${esc(label)} <span class="ops-ai-inbox-section__count">${list.length}件</span></h3>` +
      `<ul class="ops-ai-inbox-list">${list.map(renderItemRow).join("")}</ul>` +
      `</section>`
    );
  }

  let renderDailyInboxTimer = null;

  function renderDailyInboxInternal() {
    const sectionsHost =
      global.document?.querySelector("#ops-ai-command-center [data-ops-daily-inbox-sections]") ||
      global.document?.querySelector("[data-ops-daily-inbox-sections]");
    if (!sectionsHost) return;

    const items = buildInboxItems();
    const summary = buildDailySummary(items);
    renderSummary(summary);

    sectionsHost.innerHTML = [
      renderCategorySection("needs_judgment", items),
      renderCategorySection("pending_approval", items),
      renderCategorySection("auto_done", items),
    ].join("");
  }

  function renderDailyInbox() {
    if (renderDailyInboxTimer) clearTimeout(renderDailyInboxTimer);
    renderDailyInboxTimer = setTimeout(() => {
      renderDailyInboxTimer = null;
      renderDailyInboxInternal();
    }, 16);
  }

  function showToast(message) {
    const el =
      global.document?.querySelector("#ops-ai-command-center [data-ops-daily-inbox-toast]") ||
      global.document?.querySelector("[data-ops-daily-inbox-toast]");
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
    if (toastTimer) global.clearTimeout(toastTimer);
    toastTimer = global.setTimeout(() => {
      el.hidden = true;
    }, 3500);
  }

  function bindUi() {
    const cc = global.document?.getElementById("ops-ai-command-center");
    const root =
      cc?.querySelector("[data-ops-daily-inbox]") ||
      global.document?.querySelector("[data-ops-daily-inbox]");
    if (!root || root.dataset.inboxBound === "1") return;
    root.dataset.inboxBound = "1";

    root.addEventListener("click", (e) => {
      const approveBtn = e.target.closest("[data-ops-inbox-approve]");
      const holdBtn = e.target.closest("[data-ops-inbox-hold]");
      if (approveBtn) {
        const id = approveBtn.getAttribute("data-inbox-id");
        const res = approveInboxItem(id);
        showToast(res.message || (res.ok ? "承認しました" : "承認できませんでした"));
        renderDailyInbox();
        global.TasuAdminAiResponsePlans?.renderPlansPanel?.();
        global.TasuAdminAiAutomationEngine?.renderAutomationPanel?.();
      }
      if (holdBtn) {
        dismissInboxItem(holdBtn.getAttribute("data-inbox-id"));
        showToast("保留にしました");
        renderDailyInbox();
      }
    });

    const events = [
      "tasu:admin-daily-inbox-updated",
      "tasu:admin-ai-response-plan-updated",
      "tasu:admin-ai-automation-updated",
      "tasu:support-tickets-updated",
      "tasu:admin-connect-resolved",
      "tasu:builder-partner-eval-changed",
      "tasful-talk-notifications-changed",
      "tasu-market-events-changed",
      "tasu:support-lifecycle-event",
      "tasu:moderation-signal",
      "tasu:ops-content-review-completed",
      "tasu:ai-ops-cases-changed",
    ];
    events.forEach((ev) => global.addEventListener(ev, renderDailyInbox));
  }

  function init() {
    bindUi();
    renderDailyInbox();
  }

  global.TasuAdminAiDailyInbox = {
    DISMISSED_KEY,
    CATEGORY_LABELS,
    collectAllRawItems,
    findItemById,
    buildInboxItems,
    buildDailySummary,
    dismissInboxItem,
    completeInboxItem,
    pushExternalSignal,
    approveInboxItem,
    clearDismissedForTests,
    renderDailyInbox,
    init,
  };

  if (global.document?.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(typeof window !== "undefined" ? window : globalThis);
