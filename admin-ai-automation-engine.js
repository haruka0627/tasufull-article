/**
 * AI運営秘書 Phase5 — Automation Engine
 * 定型業務の自動処理候補を生成・スケジュール・実行する。
 * Phase4 Safety & License Gate を必ず通す。BAN/返金/停止/非表示は自動実行しない。
 */
(function (global) {
  "use strict";

  const RULES_KEY = "tasu_ai_automation_rules_v1";
  const ACTIVITY_KEY = "tasu_ai_automation_activity_v1";
  const NOTIFY_SOURCE = "ai_automation_engine";

  const DOMAIN_LABELS = Object.freeze({
    connect: "Connect",
    support: "Support",
    builder: "Builder",
    anpi: "安否",
    talk: "TALK通知",
  });

  const CONNECT_DAY_RULES = [
    { days: 0, ruleId: "connect_day_0", ruleName: "Connect本人確認依頼", action: "identity_notify", autoCandidate: true },
    { days: 3, ruleId: "connect_day_3", ruleName: "Connect再通知", action: "remind", autoCandidate: true },
    { days: 7, ruleId: "connect_day_7", ruleName: "Connect運営確認待ち", action: "ops_review", autoCandidate: false },
    { days: 14, ruleId: "connect_day_14", ruleName: "Connect利用制限候補", action: "restriction_candidate", autoCandidate: false },
  ];

  let activeToastTimer = null;

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

  function readRulesState() {
    const raw = readJson(RULES_KEY, {});
    return raw && typeof raw === "object" ? raw : {};
  }

  function writeRulesState(map) {
    writeJson(RULES_KEY, map);
  }

  function readActivity() {
    const arr = readJson(ACTIVITY_KEY, []);
    return Array.isArray(arr) ? arr : [];
  }

  function appendActivity(entry) {
    const list = readActivity();
    list.unshift({
      id: entry.id || `auto_act_${Date.now()}`,
      candidateId: entry.candidateId || "",
      ruleName: entry.ruleName || "",
      action: entry.action || "executed",
      target: entry.target || "",
      reason: entry.reason || "",
      gateLevel: entry.gateLevel || "",
      at: entry.at || new Date().toISOString(),
      text: entry.text || "",
    });
    writeJson(ACTIVITY_KEY, list.slice(0, 100));
    try {
      global.dispatchEvent(new CustomEvent("tasu:admin-ai-automation-updated"));
    } catch {
      /* ignore */
    }
  }

  function clearActivityForTests() {
    writeJson(ACTIVITY_KEY, []);
    writeJson(RULES_KEY, {});
  }

  function daysSince(iso) {
    const t = new Date(iso || 0).getTime();
    if (!Number.isFinite(t)) return 0;
    return Math.floor((Date.now() - t) / 86400000);
  }

  function hoursSince(iso) {
    const t = new Date(iso || 0).getTime();
    if (!Number.isFinite(t)) return 0;
    return Math.floor((Date.now() - t) / 3600000);
  }

  function formatNextRun(iso) {
    if (!iso) return "即時";
    try {
      const d = new Date(iso);
      if (!Number.isFinite(d.getTime())) return "—";
      return d.toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch {
      return "—";
    }
  }

  function candidateId(domain, ruleId, sourceId) {
    return `auto_${domain}_${ruleId}_${String(sourceId || "").replace(/\s+/g, "_")}`;
  }

  function evaluateGateForCandidate(candidate) {
    const gate = global.TasuAdminAiResponseSafetyLicenseGate;
    if (!gate?.evaluateGate) {
      return {
        gateLevel: "medium",
        sendabilityLabel: "要承認送信",
        sendAllowed: false,
        confirmOnly: false,
        sendBlocked: false,
        safetyResult: { level: "low", label: "—", reason: "Gate未接続" },
        licenseResult: { statusLabel: "—", reason: "—" },
      };
    }
    return gate.evaluateGate({
      eventType: candidate.eventType || "inquiry_received",
      eventTypeLabel: candidate.ruleName,
      aiSuggestion: candidate.reason,
      aiReason: candidate.reason,
      aiDraftMessage: candidate.draftMessage || candidate.reason,
      targetUser: candidate.targetUser,
      targetUserId: candidate.targetUserId,
      riskLevel: candidate.riskLevel || "medium",
    });
  }

  function mergeCandidateState(base) {
    const state = readRulesState()[base.id] || {};
    let status = state.status || base.status || "pending";
    if (state.stoppedAt && status !== "executed" && status !== "escalated") status = "dismissed";
    const gate = evaluateGateForCandidate(base);
    const learningBoost = global.TasuAdminAiDecisionLearning?.applyLearningBoost?.({
      ...base,
      gateLevel: gate.gateLevel,
      gate,
    }) || { promote: false };
    const outcomeAdj = learningBoost.outcomeAdjustment || {};
    const forbidden = global.TasuAdminAiDecisionLearning?.isAutoPromotionForbidden?.({
      ...base,
      gateLevel: gate.gateLevel,
      gate,
    });
    const gateOk =
      gate.gateLevel === "low" &&
      gate.sendAllowed &&
      !gate.sendBlocked &&
      !gate.confirmOnly &&
      !base.requiresOpsOnly &&
      !forbidden;

    let autoExecutable = false;
    if (gateOk && !outcomeAdj.upgrade) {
      if (outcomeAdj.downgrade) {
        autoExecutable = false;
      } else if (base.autoCandidate) {
        autoExecutable = true;
      } else if (learningBoost.promote && !outcomeAdj.blockPromote) {
        autoExecutable = true;
      }
    }

    let autoExecutableLabel = base.requiresOpsOnly
      ? "運営確認のみ"
      : outcomeAdj.upgrade
        ? "要判断（結果学習）"
        : outcomeAdj.downgrade
          ? "承認待ち（再問い合わせ多）"
          : learningBoost.promote
            ? "学習昇格・自動実行可"
            : autoExecutable
              ? "自動実行可"
              : "要承認/確認";

    return {
      ...base,
      status,
      nextRunAt: state.scheduledAt || base.nextRunAt,
      gateLevel: gate.gateLevel,
      gate,
      autoExecutable,
      learningBoost,
      outcomeAdjustment: outcomeAdj,
      autoExecutableLabel,
      updatedAt: state.updatedAt || base.createdAt,
    };
  }

  function collectConnectCandidates() {
    const items = global.TasuAdminConnectAiSupport?.buildConnectActionItems?.() || [];
    const out = [];
    items.forEach((item) => {
      const elapsed = daysSince(item.receivedAt);
      const rule =
        [...CONNECT_DAY_RULES].reverse().find((r) => elapsed >= r.days) || CONNECT_DAY_RULES[0];
      const requiresOpsOnly = rule.action === "ops_review" || rule.action === "restriction_candidate";
      const nextDays = CONNECT_DAY_RULES.find((r) => r.days > elapsed)?.days;
      const nextRunAt = nextDays != null
        ? new Date(new Date(item.receivedAt).getTime() + nextDays * 86400000).toISOString()
        : null;

      out.push({
        id: candidateId("connect", rule.ruleId, item.id),
        domain: "connect",
        ruleId: rule.ruleId,
        ruleName: rule.ruleName,
        targetUser: item.subject || "Connect利用者",
        targetUserId: item.ticketId || "",
        targetUrl: item.targetUrl || "support-trouble-center.html?filter=connect",
        sourceId: item.id,
        reason: `${elapsed}日経過 — ${rule.ruleName}（自動BAN・停止はしません）`,
        draftMessage: item.suggestedReply || item.copyText || "Connect本人確認のご案内です。",
        eventType: /本人確認/.test(String(item.requiredItems)) ? "identity_doc_incomplete" : "connect_incomplete",
        riskLevel: requiresOpsOnly ? "high" : "low",
        autoCandidate: rule.autoCandidate,
        requiresOpsOnly,
        status: requiresOpsOnly ? "scheduled" : "pending",
        nextRunAt,
        createdAt: item.receivedAt || new Date().toISOString(),
      });
    });
    return out;
  }

  function collectSupportCandidates() {
    const store = global.TasuSupportTicketStore;
    if (!store?.listTickets) return [];
    const open = new Set(["open", "needs_review", "in_progress", "ai_replied"]);
    return (store.listTickets() || [])
      .filter((t) => open.has(t.status))
      .slice(0, 8)
      .map((t) => {
        const text = `${t.title}\n${t.body}`;
        let riskLevel = String(t.severity || "medium").toLowerCase();
        if (/返金|refund|通報|ban|停止/i.test(text)) riskLevel = "high";
        else if (/支払い|確認|期限/i.test(text)) riskLevel = "low";

        let ruleName = "問い合わせ・運営確認";
        let autoCandidate = false;
        let status = "escalated";
        let eventType = /返金/i.test(text) ? "refund_consultation" : "inquiry_received";
        if (/支払い|確認|期限/i.test(text) && !/返金/i.test(text)) {
          eventType = /期限|リマインド/i.test(text) ? "deadline_reminder" : "payment_pending";
        }
        if (riskLevel === "low") {
          ruleName = "問い合わせ・AI返信案自動送信候補";
          autoCandidate = true;
          status = "pending";
        } else if (riskLevel === "medium") {
          ruleName = "問い合わせ・承認待ち";
          status = "scheduled";
        }

        return {
          id: candidateId("support", `support_${riskLevel}`, t.id),
          domain: "support",
          ruleId: `support_${riskLevel}`,
          ruleName,
          targetUser: t.user_id || "問い合わせユーザー",
          targetUserId: t.user_id || "",
          targetUrl: `support-trouble-center.html?ticket=${encodeURIComponent(t.id)}`,
          sourceId: t.id,
          reason: `${t.title} — リスク${riskLevel === "low" ? "低" : riskLevel === "medium" ? "中" : "高"}`,
          draftMessage:
            global.TasuAiOpsProvider?.buildReplyDraft?.("inquiry") ||
            "お問い合わせありがとうございます。内容を確認のうえご連絡します。",
          eventType,
          riskLevel,
          autoCandidate,
          requiresOpsOnly: riskLevel === "high",
          status,
          nextRunAt: new Date(Date.now() + 3600000).toISOString(),
          createdAt: t.created_at || new Date().toISOString(),
        };
      });
  }

  function collectBuilderCandidates() {
    const evalStore = global.TasuBuilderPartnerEval;
    if (!evalStore?.listEvaluations) return [];
    return (evalStore.listEvaluations() || [])
      .filter(
        (e) =>
          e.status === "needs_review" &&
          e.visibility !== "hidden" &&
          ["application", "completion_report", "rejection", "needs_review"].includes(
            e.event_type || "needs_review"
          )
      )
      .slice(0, 5)
      .map((e) => {
        const good = (e.score || 0) >= 4 || /良好|高評価/.test(String(e.summary || e.reason || ""));
        const verified = e.identity_verified !== false;
        const clean = !/違反|violat/i.test(String(e.reason || ""));
        const eligible = good && verified && clean;
        return {
          id: candidateId("builder", "builder_approval", e.id || e.partner_id),
          domain: "builder",
          ruleId: "builder_approval",
          ruleName: eligible ? "Builder承認候補" : "Builder審査・要確認",
          targetUser: e.partner_name || e.display_name || "Builderパートナー",
          targetUserId: e.partner_id || "",
          targetUrl: "builder/admin-partner-evaluations.html",
          sourceId: e.id || e.partner_id,
          reason: eligible
            ? "評価良好・本人確認済・違反なし — 承認候補（自動非表示はしません）"
            : "審査条件未充足 — 管理者確認が必要です",
          draftMessage: "Builder審査に関するご連絡です。担当が確認いたします。",
          eventType: "builder_review",
          riskLevel: eligible ? "medium" : "high",
          autoCandidate: false,
          requiresOpsOnly: !eligible,
          status: eligible ? "pending" : "escalated",
          nextRunAt: new Date(Date.now() + 7200000).toISOString(),
          createdAt: e.updated_at || e.created_at || new Date().toISOString(),
        };
      });
  }

  function collectAnpiCandidates() {
    const hub = global.TasuTalkOpsAssistant?.buildHubSections?.();
    const sec = hub?.sections?.find((s) => s.id === "anpi");
    if (!sec?.items?.length) return [];

    return sec.items.slice(0, 5).map((item, idx) => {
      const unread = /未読|未応答|緊急/.test(String(item.meta || ""));
      const hours = hoursSince(item.createdAt || new Date().toISOString());
      const urgent = unread && hours >= 24;
      return {
        id: candidateId("anpi", urgent ? "anpi_urgent" : "anpi_remind", item.id || idx),
        domain: "anpi",
        ruleId: urgent ? "anpi_urgent" : "anpi_remind",
        ruleName: urgent ? "安否・緊急フラグ" : "安否・自動リマインド",
        targetUser: item.title || "安否利用者",
        targetUserId: "",
        targetUrl: item.href || "anpi-dashboard.html",
        sourceId: item.id || String(idx),
        reason: urgent
          ? `${hours}時間未応答 — 緊急フラグ（自動停止はしません）`
          : "安否未応答 — リマインド送信候補",
        draftMessage:
          "安否確認のご連絡です。状況をご確認いただき、必要に応じてご返信をお願いいたします。",
        eventType: "anpi_no_response",
        riskLevel: urgent ? "high" : "medium",
        autoCandidate: !urgent,
        requiresOpsOnly: urgent,
        status: urgent ? "escalated" : "pending",
        nextRunAt: urgent ? null : new Date(Date.now() + 1800000).toISOString(),
        createdAt: new Date().toISOString(),
      };
      });
  }

  function collectMarketCandidates() {
    const events = global.TasuMarketEventStore?.listMarketEvents?.() || [];
    return events
      .filter((e) =>
        ["order_cancelled", "refund_requested", "refund_completed"].includes(e.event_type)
      )
      .slice(0, 5)
      .map((e) => {
        const isRefund = e.event_type === "refund_requested";
        const isCancel = e.event_type === "order_cancelled";
        return {
          id: candidateId("market", e.event_type, e.id),
          domain: "market",
          ruleId: isRefund ? "market_refund" : isCancel ? "market_cancel" : "market_refund_done",
          ruleName: isRefund
            ? "市場・返金申請確認"
            : isCancel
              ? "市場・キャンセル確認"
              : "市場・返金完了記録",
          targetUser: e.product_name || "市場購入者",
          targetUserId: e.order_id || "",
          targetUrl: "shop-market-order-history.html",
          sourceId: e.id,
          reason: e.note || `${e.event_type}（${e.order_id || "—"}）`,
          draftMessage:
            "市場注文に関するご連絡です。注文状況を確認のうえ、担当よりご連絡いたします。",
          eventType: isRefund ? "refund_consultation" : isCancel ? "market_cancel" : "refund_consultation",
          riskLevel: isRefund ? "high" : "medium",
          autoCandidate: false,
          requiresOpsOnly: isRefund,
          status: isRefund ? "escalated" : "pending",
          nextRunAt: new Date(Date.now() + 3600000).toISOString(),
          createdAt: e.created_at || new Date().toISOString(),
        };
      });
  }

  function collectTalkCandidates() {
    const store = global.TasuTalkNotifications;
    if (!store?.getAll) return [];
    return (store.getAll() || [])
      .filter((n) => {
        const unread = store.isUnread?.(n) !== false && !n.readAt;
        const important = ["important", "urgent", "high"].includes(String(n.priority || "").toLowerCase());
        return unread && important;
      })
      .slice(0, 5)
      .map((n) => ({
        id: candidateId("talk", "talk_renotify", n.id),
        domain: "talk",
        ruleId: "talk_renotify",
        ruleName: "TALK未読重要通知・再通知候補",
        targetUser: n.title || "通知先",
        targetUserId: n.recipientUserId || "",
        targetUrl: n.targetUrl || n.href || "talk-home.html?tab=notify&talkAdmin=1",
        sourceId: n.id,
        reason: `未読の重要通知 — ${n.title}`,
        draftMessage: n.body || n.title || "",
        eventType: "inquiry_received",
        riskLevel: "low",
        autoCandidate: true,
        requiresOpsOnly: false,
        status: "pending",
        nextRunAt: new Date(Date.now() + 900000).toISOString(),
        createdAt: n.createdAt || new Date().toISOString(),
      }));
  }

  function buildAutomationCandidates() {
    const seen = new Set();
    const raw = [
      ...collectConnectCandidates(),
      ...collectSupportCandidates(),
      ...collectBuilderCandidates(),
      ...collectMarketCandidates(),
      ...collectAnpiCandidates(),
      ...collectTalkCandidates(),
    ];

    const merged = [];
    for (const item of raw) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      const c = mergeCandidateState(item);
      if (c.status === "dismissed" || c.status === "executed") continue;
      merged.push(c);
    }

    const order = { escalated: 0, scheduled: 1, pending: 2 };
    merged.sort(
      (a, b) =>
        (order[a.status] ?? 9) - (order[b.status] ?? 9) ||
        String(a.nextRunAt || "").localeCompare(String(b.nextRunAt || ""))
    );
    return merged.slice(0, 12);
  }

  function findCandidateById(id) {
    const all = [
      ...collectConnectCandidates(),
      ...collectSupportCandidates(),
      ...collectBuilderCandidates(),
      ...collectMarketCandidates(),
      ...collectAnpiCandidates(),
      ...collectTalkCandidates(),
    ];
    const base = all.find((c) => c.id === id);
    return base ? mergeCandidateState(base) : null;
  }

  function updateCandidateState(id, patch) {
    const map = readRulesState();
    map[id] = { ...(map[id] || {}), ...patch, updatedAt: new Date().toISOString() };
    writeRulesState(map);
  }

  function deliverAutomationNotification(candidate) {
    const store = global.TasuTalkNotifications;
    if (!store?.add) return { ok: false, reason: "notify_store_unavailable" };
    const notifyId = `talk-n-auto-${candidate.id}`;
    const row = store.add({
      id: notifyId,
      type: candidate.domain === "anpi" ? "anpi" : candidate.domain === "connect" ? "system" : "general",
      title: `【自動処理】${candidate.ruleName}`,
      body: String(candidate.draftMessage || candidate.reason || "").slice(0, 500),
      href: candidate.targetUrl,
      targetUrl: candidate.targetUrl,
      source: NOTIFY_SOURCE,
      recipientUserId: candidate.targetUserId || "",
      createdAt: new Date().toISOString(),
      priority: candidate.riskLevel === "low" ? "normal" : "important",
      automationCandidateId: candidate.id,
      ruleName: candidate.ruleName,
    });
    return { ok: true, notification: row, notificationId: notifyId };
  }

  function recordAutomationLearning(candidate, operatorAction, extra) {
    return global.TasuAdminAiDecisionLearning?.recordFromAutomation?.(candidate, operatorAction, extra);
  }

  function executeCandidate(id, options) {
    const candidate = findCandidateById(id);
    if (!candidate) return { ok: false, error: "候補が見つかりません" };
    if (candidate.status === "dismissed") return { ok: false, error: "停止済みです" };

    const gate = evaluateGateForCandidate(candidate);
    const approved = options?.approved === true;

    if (gate.sendBlocked || gate.gateLevel === "prohibited") {
      updateCandidateState(id, { status: "escalated" });
      appendActivity({
        candidateId: id,
        ruleName: candidate.ruleName,
        action: "blocked",
        target: candidate.targetUser,
        reason: gate.gateReason || "Gate blocked",
        gateLevel: gate.gateLevel,
        text: `自動処理ブロック: ${candidate.ruleName} — ${candidate.targetUser}`,
      });
      recordAutomationLearning(candidate, "blocked", { finalStatus: "blocked" });
      return { ok: false, blocked: true, gate, message: "Safety Gateにより自動実行をブロックしました" };
    }

    if (gate.confirmOnly || gate.gateLevel === "high" || candidate.requiresOpsOnly) {
      updateCandidateState(id, { status: "escalated", lastExecutedAt: new Date().toISOString() });
      appendActivity({
        candidateId: id,
        ruleName: candidate.ruleName,
        action: "escalated",
        target: candidate.targetUser,
        reason: candidate.reason,
        gateLevel: gate.gateLevel,
        text: `自動処理エスカレーション: ${candidate.ruleName} — ${candidate.targetUser}`,
      });
      global.dispatchEvent(new CustomEvent("tasu:admin-ai-automation-updated"));
      const decision = recordAutomationLearning(candidate, "escalated", { finalStatus: "escalated" });
      global.TasuAdminAiOutcomeLearning?.createPendingFromAutomation?.(candidate, {
        decisionId: decision?.id,
        actionType: "escalated",
      });
      return {
        ok: true,
        escalated: true,
        gate,
        message: "運営確認として記録しました（自動通知は送信していません）",
      };
    }

    if (gate.gateLevel === "medium" && !approved && !candidate.autoExecutable) {
      updateCandidateState(id, { status: "scheduled", scheduledAt: candidate.nextRunAt });
      return {
        ok: false,
        needsApproval: true,
        gate,
        message: "中リスクのため承認が必要です",
      };
    }

    const HSG = global.TasuAdminAiHumanSendGate;
    if (HSG?.shouldQueueAutomation?.(candidate, gate, options)) {
      const queued = HSG.enqueueFromAutomation(candidate);
      return {
        ok: false,
        queued: true,
        needsApproval: true,
        pendingId: queued?.id,
        message: "利用者への通知は承認待ちに追加しました（AI単独送信は行いません）",
      };
    }

    const linkedPlan = (global.TasuAdminAiResponsePlans?.buildResponsePlans?.() || []).find(
      (p) => String(p.sourceId) === String(candidate.sourceId)
    );
    let notifyResult = { ok: false };
    if (linkedPlan && gate.gateLevel === "low") {
      notifyResult = global.TasuAdminAiResponsePlans?.sendPlan?.(linkedPlan.id) || { ok: false };
    } else if (gate.gateLevel === "low" || (gate.gateLevel === "medium" && approved)) {
      notifyResult = deliverAutomationNotification(candidate);
    }

    updateCandidateState(id, { status: "executed", lastExecutedAt: new Date().toISOString() });
    appendActivity({
      candidateId: id,
      ruleName: candidate.ruleName,
      action: approved ? "approved" : "executed",
      target: candidate.targetUser,
      reason: candidate.reason,
      gateLevel: gate.gateLevel,
      text: `自動処理実行: ${candidate.ruleName} — ${candidate.targetUser}`,
    });
    global.dispatchEvent(new CustomEvent("tasu:admin-ai-automation-updated"));
    const decision = recordAutomationLearning(candidate, "approved", { finalStatus: "executed" });
    global.TasuAdminAiOutcomeLearning?.createPendingFromAutomation?.(candidate, {
      decisionId: decision?.id,
      notificationId: notifyResult.notificationId || "",
      actionType: approved ? "approved" : "executed",
    });
    return {
      ok: true,
      executed: true,
      gate,
      notifyResult,
      message: notifyResult.ok
        ? "自動処理を実行し、活動履歴に記録しました"
        : "活動履歴に記録しました（通知は作成されませんでした）",
    };
  }

  function approveCandidate(id) {
    return executeCandidate(id, { approved: true });
  }

  function stopCandidate(id) {
    updateCandidateState(id, { status: "dismissed", stoppedAt: new Date().toISOString() });
    const c = findCandidateById(id);
    appendActivity({
      candidateId: id,
      ruleName: c?.ruleName || id,
      action: "stopped",
      target: c?.targetUser || "",
      reason: "運営者が自動処理を停止",
      text: `自動処理停止: ${c?.ruleName || id}`,
    });
    global.dispatchEvent(new CustomEvent("tasu:admin-ai-automation-updated"));
    recordAutomationLearning(c, "dismissed", { finalStatus: "dismissed" });
    return { ok: true, message: "自動処理を停止しました" };
  }

  function runNow(id) {
    return executeCandidate(id, { runNow: true });
  }

  function renderCandidateCard(c) {
    const statusCls = `ops-ai-auto-card--${c.status || "pending"}`;
    const done = c.status === "executed" || c.status === "dismissed";
    const disabled = done ? " disabled" : "";

    return (
      `<article class="ops-ai-auto-card ${statusCls}" data-ops-ai-auto-card data-auto-id="${esc(c.id)}">` +
      `<header class="ops-ai-auto-card__head">` +
      `<span class="ops-ai-tag ops-ai-tag--inquiry">${esc(DOMAIN_LABELS[c.domain] || c.domain)}</span>` +
      `<strong class="ops-ai-auto-card__rule">${esc(c.ruleName)}</strong>` +
      `</header>` +
      `<dl class="ops-ai-auto-card__meta">` +
      `<div><dt>対象</dt><dd>${esc(c.targetUser)}</dd></div>` +
      `<div><dt>次回実行</dt><dd>${esc(formatNextRun(c.nextRunAt))}</dd></div>` +
      `<div><dt>理由</dt><dd>${esc(c.reason)}</dd></div>` +
      `<div><dt>自動実行可否</dt><dd><strong>${esc(c.autoExecutableLabel)}</strong>（Gate: ${esc(c.gateLevel || "—")}）</dd></div>` +
      `</dl>` +
      (global.TasuAdminAiDecisionLearning?.renderLearningHtml?.(c) || "") +
      (global.TasuAdminAiOutcomeLearning?.renderOutcomeHtml?.(c) || "") +
      `<div class="ops-ai-auto-card__actions">` +
      `<button type="button" class="ops-ai-auto-btn ops-ai-auto-btn--primary" data-ops-ai-auto-run data-auto-id="${esc(c.id)}"${disabled}>今すぐ実行</button>` +
      `<button type="button" class="ops-ai-auto-btn ops-ai-auto-btn--ghost" data-ops-ai-auto-approve data-auto-id="${esc(c.id)}"${disabled}>承認</button>` +
      `<button type="button" class="ops-ai-auto-btn ops-ai-auto-btn--ghost" data-ops-ai-auto-stop data-auto-id="${esc(c.id)}"${done ? " disabled" : ""}>停止</button>` +
      (c.targetUrl ? `<a class="ops-ai-auto-btn ops-ai-auto-btn--link" href="${esc(c.targetUrl)}">詳細</a>` : "") +
      `</div>` +
      `</article>`
    );
  }

  let renderAutomationPanelTimer = null;

  function renderAutomationPanelInternal() {
    const host = global.document?.querySelector("[data-ops-ai-automation]");
    const badge = global.document?.querySelector("[data-ops-ai-automation-count]");
    if (!host) return;

    const items = buildAutomationCandidates();
    if (badge) {
      if (items.length) {
        badge.hidden = false;
        badge.textContent = `${items.length}件`;
      } else {
        badge.hidden = true;
      }
    }

    if (!items.length) {
      host.innerHTML = `<p class="ops-ai-auto-empty">自動処理候補はありません — 例外対応のみ</p>`;
      return;
    }
    host.innerHTML = `<div class="ops-ai-auto-list">${items.map(renderCandidateCard).join("")}</div>`;
  }

  function renderAutomationPanel() {
    if (renderAutomationPanelTimer) clearTimeout(renderAutomationPanelTimer);
    renderAutomationPanelTimer = setTimeout(() => {
      renderAutomationPanelTimer = null;
      renderAutomationPanelInternal();
    }, 16);
  }

  function showToast(message) {
    const el = global.document?.querySelector("[data-ops-ai-automation-toast]");
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
    if (activeToastTimer) global.clearTimeout(activeToastTimer);
    activeToastTimer = global.setTimeout(() => {
      el.hidden = true;
    }, 4000);
  }

  function bindUi() {
    const host = global.document?.querySelector("[data-ops-ai-automation]");
    if (!host || host.dataset.opsAiAutoBound === "1") return;
    host.dataset.opsAiAutoBound = "1";

    host.addEventListener("click", (e) => {
      const runBtn = e.target.closest("[data-ops-ai-auto-run]");
      const approveBtn = e.target.closest("[data-ops-ai-auto-approve]");
      const stopBtn = e.target.closest("[data-ops-ai-auto-stop]");
      if (runBtn) {
        const res = runNow(runBtn.getAttribute("data-auto-id"));
        showToast(res.message || (res.ok ? "完了" : "失敗"));
        renderAutomationPanel();
      }
      if (approveBtn) {
        const res = approveCandidate(approveBtn.getAttribute("data-auto-id"));
        showToast(res.message || (res.ok ? "承認完了" : "承認待ち"));
        renderAutomationPanel();
      }
      if (stopBtn) {
        const res = stopCandidate(stopBtn.getAttribute("data-auto-id"));
        showToast(res.message || "停止しました");
        renderAutomationPanel();
      }
    });

    global.addEventListener("tasu:admin-ai-automation-updated", renderAutomationPanel);
    global.addEventListener("tasu:support-tickets-updated", renderAutomationPanel);
    global.addEventListener("tasu:admin-connect-resolved", renderAutomationPanel);
    global.addEventListener("tasu:builder-partner-eval-changed", renderAutomationPanel);
    global.addEventListener("tasu:admin-ai-response-plan-updated", renderAutomationPanel);
    global.addEventListener("tasful-talk-notifications-changed", renderAutomationPanel);
    global.addEventListener("tasu-market-events-changed", renderAutomationPanel);
  }

  function init() {
    bindUi();
    renderAutomationPanel();
  }

  global.TasuAdminAiAutomationEngine = {
    RULES_KEY,
    ACTIVITY_KEY,
    NOTIFY_SOURCE,
    buildAutomationCandidates,
    findCandidateById,
    evaluateGateForCandidate,
    executeCandidate,
    approveCandidate,
    stopCandidate,
    runNow,
    updateCandidateState,
    readActivity,
    listActivity: readActivity,
    clearActivityForTests,
    renderAutomationPanel,
    init,
  };

  if (global.document?.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(typeof window !== "undefined" ? window : globalThis);
