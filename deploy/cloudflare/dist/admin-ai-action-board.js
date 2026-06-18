/**
 * AI運営司令塔 — 行動提案ボード（監視数字ではなく次の1手）
 */
(function (global) {
  "use strict";

  const ZONE = Object.freeze({
    urgent: "urgent",
    today: "today",
    ai: "ai",
    latest: "latest",
    normal: "normal",
  });

  const AT = global.TasuAdminAiActionExecutor?.ACTION_TYPE || {
    reviewOnly: "review_only",
    prepareReply: "prepare_reply",
    sendReply: "send_reply",
    bulkResolve: "bulk_resolve",
    openDetail: "open_detail",
  };

  const AL = global.TasuAdminAiActionExecutor?.ACTION_LEVEL || {
    reviewOnly: 1,
    draftPrep: 2,
    mockExec: 3,
    realSend: 4,
    settingsChange: 5,
  };

  const PRIORITY_RANK = Object.freeze({ critical: 0, high: 1, normal: 2 });
  const ZONE_TOP_LIMIT = 3;
  const ZONE_SECONDARY_LIMIT = 3;

  const zoneExpanded = {
    urgent: false,
    today: false,
    ai: false,
    latest: false,
  };

  function resolveActionLevel(extra, actionType) {
    return global.TasuAdminAiActionExecutor?.inferActionLevel?.(actionType, extra?.actionLevel) ?? AL.reviewOnly;
  }

  let lastCtx = null;
  let lastFullBoard = null;

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function item(id, zone, happened, impact, aiDecision, recommendation, actionLabel, href, extra) {
    const actionType = extra?.actionType ?? AT.openDetail;
    return {
      id: String(id || happened).slice(0, 80),
      zone,
      happened: String(happened || "").trim(),
      impact: String(impact || "").trim(),
      aiDecision: String(aiDecision || "").trim(),
      recommendation: String(recommendation || "").trim(),
      actionLabel: String(actionLabel || "確認する").trim(),
      href: String(href || "#ops-ai-details").trim(),
      actionType,
      actionLevel: resolveActionLevel(extra, actionType),
      source: "action_board",
      ...(extra || {}),
    };
  }

  function impactForCategory(cat) {
    if (cat === "connect_issue") return "本人確認・出金・決済フローに影響する可能性があります";
    if (cat === "abuse_or_policy" || cat === "legal_or_risk") return "利用者安全とプラットフォーム信頼に影響します";
    if (cat === "report" || /通報/.test(String(cat))) return "違反対応の遅延が二次被害につながる可能性があります";
    return "未対応のまま放置すると対応品質と利用者満足に影響します";
  }

  function inquiryReplyDraft(ticket) {
    if (!ticket) {
      return "お問い合わせありがとうございます。内容を確認のうえ、追ってご連絡いたします。\n\nTASFUL サポート";
    }
    const title = String(ticket.title || "お問い合わせ").slice(0, 40);
    return (
      `${title} についてご連絡いただきありがとうございます。\n` +
      `内容を確認しました。必要に応じて追加情報をお知らせください。\n\n` +
      `TASFUL サポート`
    );
  }

  function fromAlert(alert, zone) {
    const title = alert.title || "重要案件";
    const cat = alert.category || "";
    return item(
      `alert_${alert.kind}_${alert.id}`,
      zone,
      title,
      impactForCategory(cat),
      alert.risk === "critical" ? "緊急（即時判断が必要）" : "要確認（本日中に判断）",
      alert.risk === "critical"
        ? "最優先で内容を確認し、必要なら専用画面で対応を開始してください"
        : "内容を確認し、対応方針を決めてください",
      "詳細を見る",
      alert.href || "support-trouble-center.html",
      {
        actionType: AT.reviewOnly,
        source: "alert",
        priority: alert.risk === "critical" ? "critical" : alert.risk === "high" ? "high" : "normal",
      }
    );
  }

  function fromConnectPrimary(primary) {
    const attachments = (primary.requiredItems || []).map((x) => String(x));
    return item(
      `connect_${primary.id || "primary"}`,
      ZONE.urgent,
      primary.title || primary.subject || "Stripe Connect から追加確認が届いています",
      "本人確認が完了しないと、出金・決済に影響する可能性があります",
      "問題なし（要返信）",
      primary.message || primary.summary || "AIが返信文と不足項目チェックを準備済みです。内容確認のうえ送信してください",
      "返信を確認",
      "#ops-ai-connect",
      {
        actionType: AT.prepareReply,
        actionLevel: AL.draftPrep,
        source: "connect",
        openDetails: true,
        scrollTarget: "ops-ai-connect",
        priority: "high",
        executionPayload: {
          target: primary.subject || primary.title || "Connect追加確認",
          executionSummary: "Connect追加資料の返信文・必要書類を確認し、送信準備を完了する",
          recommendationReason: "本人確認が完了しないと出品・出金に影響します",
          bodyText: primary.suggestedReply || primary.copyText || "",
          attachments,
          connectId: primary.id,
          ticketId: primary.ticketId || null,
          before: { status: "pending", connectId: primary.id },
          afterPreview: { status: "reply_prepared" },
          warnings: ["Stripeダッシュボードへの実送信はこの操作では行いません。"],
        },
      }
    );
  }

  function fromHubInquiry(it, idx) {
    const hubId = String(it.id || `hub_open_${idx}`);
    const ticketId = hubId.replace(/^inq-/, "");
    const ticket = (global.TasuSupportTicketStore?.listTickets?.() || []).find(
      (t) => String(t.id) === ticketId
    );
    const isAiReplied = ticket?.status === "ai_replied";
    const draft = inquiryReplyDraft(ticket);
    return item(
      hubId,
      ZONE.today,
      it.title || ticket?.title || "未対応の問い合わせ",
      "放置すると利用者の不安とクレームにつながる可能性があります",
      isAiReplied ? "送信可能（AI下書き済み）" : "要返信（定型文準備）",
      isAiReplied
        ? "AI下書きを確認のうえ送信準備を完了してください"
        : "定型返信文を確認のうえ、送信準備を完了してください",
      "返信を確認",
      it.href || `support-trouble-center.html?ticket=${encodeURIComponent(ticketId)}`,
      {
        actionType: isAiReplied ? AT.sendReply : AT.prepareReply,
        actionLevel: isAiReplied ? AL.mockExec : AL.draftPrep,
        source: "support_inquiry",
        executionPayload: {
          target: it.title || ticket?.title || ticketId,
          executionSummary: isAiReplied
            ? "AI作成済み返信文の内容確認と送信準備"
            : "問い合わせへの定型返信文の確認と送信準備",
          recommendationReason: "未対応のまま放置すると利用者満足度が低下します",
          bodyText: draft,
          attachments: [],
          ticketId,
          before: { status: ticket?.status || "open", ticketId },
          afterPreview: { status: "send_prepared", ticketId },
          warnings: ["実際のメール/LINE送信は行いません。"],
        },
      }
    );
  }

  function buildBulkResolveItem(metrics) {
    const tickets = (metrics.tickets || []).filter(
      (t) => t.status === "open" || t.status === "ai_replied"
    );
    if (tickets.length < 2) return null;
    const ids = tickets.map((t) => t.id);
    return item(
      "bulk_resolve_open_tickets",
      ZONE.today,
      `未対応チケットが ${tickets.length} 件滞留しています`,
      "優先度の低い案件がキューを圧迫し、重要案件の見落としにつながる可能性があります",
      "整理可能（要確認）",
      "AIが分類ラベルを付与し、本日対応キューを整理します",
      "一括整理を確認",
      "#ops-ai-details",
      {
        actionType: AT.bulkResolve,
        actionLevel: AL.mockExec,
        source: "support_bulk",
        openDetails: true,
        scrollTarget: "ops-ai-focus",
        priority: "normal",
        executionPayload: {
          target: `未対応チケット ${tickets.length} 件`,
          executionSummary: "未対応・AI返信済みチケットに整理ラベルを付与（自動クローズなし）",
          recommendationReason: "キューを整理すると本日の優先対応が明確になります",
          bodyText: tickets
            .slice(0, 5)
            .map((t) => `· ${t.title || t.id} (${t.status})`)
            .join("\n"),
          attachments: [],
          ticketIds: ids,
          before: { openCount: tickets.length, ticketIds: ids },
          afterPreview: { organizedCount: ids.length },
          warnings: ["チケットの自動クローズ・削除は行いません。"],
        },
      }
    );
  }

  function fromConnectStripeSendBlocked(primary) {
    const attachments = (primary.requiredItems || []).map((x) => String(x));
    const bodyText = primary.suggestedReply || primary.copyText || "";
    return item(
      `connect_stripe_send_${primary.id || "primary"}`,
      ZONE.today,
      "Stripe Connect へ実送信（本番連携前）",
      "本人確認返信のStripeダッシュボードへの実送信は本番連携後にのみ許可されます",
      "実送信不可（本番連携前）",
      "返信文を確認したうえで、本番連携後にStripeから送信してください",
      "詳細を見る",
      "#ops-ai-connect",
      {
        actionType: AT.reviewOnly,
        actionLevel: AL.realSend,
        source: "connect_stripe_send",
        priority: "high",
        executionPayload: {
          target: primary.subject || primary.title || "Connect追加確認",
          bodyText,
          attachments,
          connectId: primary.id,
          ticketId: primary.ticketId || null,
        },
      }
    );
  }

  function fromSettingsChangeBlocked() {
    return item(
      "settings_change_blocked",
      ZONE.ai,
      "Gemini API / 料金プラン設定変更（本番連携前）",
      "本番環境のAPIキー・料金設定を誤って変更すると全利用者に影響します",
      "設定変更不可（本番連携前）",
      "変更内容と影響範囲を確認したうえで、ひろの最終承認後に本番反映してください",
      "詳細を見る",
      "#ops-ai-details",
      {
        actionType: AT.reviewOnly,
        actionLevel: AL.settingsChange,
        source: "settings_change",
        priority: "normal",
        executionPayload: {
          target: "Gemini API / 料金プラン",
          changeTarget: "Gemini API tier / billing plan",
          beforeValue: "staging-tier (mock)",
          afterValue: "production-tier (未承認)",
          impactScope: "全AI機能・利用者課金",
        },
      }
    );
  }

  function fromResponsePlan(plan) {
    const high =
      plan.gateLevel === "high" ||
      plan.gateLevel === "prohibited" ||
      plan.riskLevel === "high" ||
      plan.riskLevel === "critical";
    const zone = high ? ZONE.urgent : ZONE.ai;
    return item(
      `plan_${plan.id}`,
      zone,
      plan.eventTypeLabel || plan.title || "AI対応案が届いています",
      plan.gateReason || plan.aiReason || "利用者への連絡内容を誤ると信頼低下につながります",
      high ? "要承認（高リスク）" : "要承認（通常）",
      plan.aiSuggestion || plan.primaryActionLabel || "承認または編集のうえ送信してください",
      "詳細を見る",
      plan.targetUrl || "#ops-ai-response",
      {
        actionType: AT.reviewOnly,
        source: "response_plan",
        openDetails: true,
        scrollTarget: "ops-ai-response",
        priority: high ? "critical" : "normal",
      }
    );
  }

  function fromAutomation(c) {
    const zone =
      c.requiresOpsOnly || c.status === "escalated" || c.gateLevel === "high"
        ? ZONE.urgent
        : ZONE.ai;
    return item(
      `auto_${c.id}`,
      zone,
      c.ruleName || c.title || "自動処理候補",
      c.reason || "誤った自動実行は利用者体験に影響します",
      c.autoExecutable ? "実行可能（要確認）" : "運営判断が必要",
      c.autoExecutable ? "内容を確認のうえ実行できます" : "運営判断が必要です",
      "詳細を見る",
      c.targetUrl || "#ops-ai-automation",
      {
        actionType: AT.reviewOnly,
        source: "automation",
        openDetails: true,
        scrollTarget: "ops-ai-automation",
        priority:
          c.requiresOpsOnly || c.status === "escalated" || c.gateLevel === "high" ? "high" : "normal",
      }
    );
  }

  function fromSuggestion(s) {
    const isPricing =
      /料金|価格|Gemini|API|規約|決済|手数料/i.test(`${s.title} ${s.body} ${s.effect || ""}`);
    return item(
      `suggest_${s.title}`,
      ZONE.ai,
      s.title,
      s.body.replace(/\d+\s*件/g, "複数の案件").replace(/\d+/g, "").trim() || "運営判断が必要な状況です",
      isPricing ? "要調査（設定変更は不可）" : "提案あり",
      s.effect ? `${s.effect} — ${s.cta}を推奨します` : "AIが次の一手を提案しています",
      "詳細を見る",
      s.href || "#ops-ai-details",
      {
        actionType: AT.reviewOnly,
        actionLevel: isPricing ? AL.settingsChange : AL.reviewOnly,
        source: "ai_suggestion",
        openDetails: s.href?.startsWith("#"),
        priority: "normal",
      }
    );
  }

  function fromPriorityRow(row) {
    const zone = row.importanceClass === "high" ? ZONE.urgent : ZONE.today;
    return item(
      `priority_${row.rank}`,
      zone,
      row.title,
      impactForCategory(row.categoryClass === "connect" ? "connect_issue" : row.categoryClass),
      zone === ZONE.urgent ? "要対応（本日中）" : "要対応（本日）",
      "内容を確認し、必要なら専用画面で対応してください",
      "詳細を見る",
      row.href || "#ops-ai-details",
      {
        actionType: AT.reviewOnly,
        source: "priority",
        openDetails: String(row.href || "").startsWith("#"),
        priority: row.importanceClass === "high" ? "high" : "normal",
      }
    );
  }

  function fromOpsWatchLogRow(row, idx) {
    const title = row?.title || "外部変化を検知";
    const impact = row?.reason || "運営に影響する可能性があります";
    const sev = row?.severity || "info";
    const aiDecision = sev === "critical" ? "要対応（重大）" : sev === "warning" ? "要確認（影響調査）" : "情報（監視継続）";
    const rec = (row?.recommendedActions || []).slice(0, 2).join(" / ") || "詳細を確認してください";
    const target = row?.metric === "connect.identityFail" ? "ops-ai-connect" : "ops-ai-watch";
    return item(
      `latest_${row?.kind || "ow"}_${row?.type || "update"}_${idx}`,
      ZONE.latest,
      title,
      impact,
      aiDecision,
      rec,
      "詳細を見る",
      `#${target}`,
      {
        actionType: AT.reviewOnly,
        source: "ops_watch",
        openDetails: true,
        scrollTarget: target,
        priority: sev === "critical" ? "critical" : sev === "warning" ? "high" : "normal",
      }
    );
  }

  function sortByPriority(rows) {
    const rank = (row) => {
      const p = row.priority || "normal";
      return PRIORITY_RANK[p] ?? PRIORITY_RANK.normal;
    };
    return [...rows].sort((a, b) => rank(a) - rank(b));
  }

  function sortAiForDisplay(rows) {
    return [...rows].sort((a, b) => {
      const la = Number(a.actionLevel) || 1;
      const lb = Number(b.actionLevel) || 1;
      const blockedA = la >= 4 ? 0 : 1;
      const blockedB = lb >= 4 ? 0 : 1;
      if (blockedA !== blockedB) return blockedA - blockedB;
      return lb - la;
    });
  }

  function rowsForDisplay(zone, allRows) {
    if (zone === ZONE.urgent || zone === ZONE.today) return sortByPriority(allRows);
    if (zone === ZONE.ai) return sortAiForDisplay(allRows);
    return allRows;
  }

  function buildHealthLines(ctx) {
    const metrics = ctx?.metrics || {};
    const hub = ctx?.hub || {};
    const check = ctx?.checkResult || {};
    const connectTotal = Math.max(
      metrics.connectCount || 0,
      metrics.connectAiPending || 0,
      check.connectDraft?.active ? 1 : 0
    );
    const anpiCount = hub?.sections?.find((s) => s.id === "anpi")?.count ?? 0;
    const paymentIssues = (metrics.tickets || []).filter(
      (t) =>
        t.category === "external_payment" ||
        /stripe|決済|payment|chargeback|チャージバック/i.test(`${t.title || ""} ${t.category || ""}`)
    ).length;
    const marketplaceCount =
      hub?.sections?.find((s) => s.id === "marketplace")?.count ??
      metrics.violationReportCount ??
      0;

    return [
      { key: "connect", label: "Connect", ok: connectTotal === 0 },
      { key: "payment", label: "決済", ok: paymentIssues === 0 && (metrics.violationReportCount || 0) === 0 },
      { key: "anpi", label: "安否", ok: anpiCount === 0 },
      { key: "marketplace", label: "Marketplace", ok: marketplaceCount === 0 },
    ];
  }

  function healthSummaryText(lines, compact) {
    const list = compact ? lines.slice(0, 3) : lines;
    return list.map((l) => `${l.label}${l.ok ? "正常" : "要確認"}`).join(" · ");
  }

  function renderHealthList(lines, compact) {
    const list = compact ? lines.slice(0, 3) : lines;
    return (
      `<ul class="ops-ai-action-health">` +
      list
        .map(
          (l) =>
            `<li class="ops-ai-action-health__item${l.ok ? " ops-ai-action-health__item--ok" : " ops-ai-action-health__item--warn"}">` +
            `${l.ok ? "✓" : "!"} ${esc(l.label)}${l.ok ? "正常" : "要確認"}</li>`
        )
        .join("") +
      `</ul>`
    );
  }

  function dedupeItems(list) {
    const seen = new Set();
    const out = [];
    (list || []).forEach((row) => {
      const key = `${row.happened}|${row.actionType}|${row.id}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push(row);
    });
    return out;
  }

  function filterExecutedIfNeeded(list) {
    const Ex = global.TasuAdminAiActionExecutor;
    if (!Ex?.getExecutedState) return list;
    return list.filter((row) => {
      if (!Ex.canExecuteRow?.(row)) return true;
      return !Ex.getExecutedState(row.id);
    });
  }

  function levelBadgeHtml(row) {
    const Ex = global.TasuAdminAiActionExecutor;
    const level = row.actionLevel ?? Ex?.inferActionLevel?.(row.actionType, row.actionLevel) ?? 1;
    const label = Ex?.getActionLevelLabel?.(level) || `Lv.${level}`;
    const blocked = Ex?.isLevelBlocked?.(level);
    const mod = blocked ? " ops-ai-action-card__level--blocked" : "";
    return `<span class="ops-ai-action-card__level${mod}" data-ops-action-level="${level}">Lv.${level} ${esc(label)}</span>`;
  }

  /**
   * @param {{ metrics?: object, alerts?: object[], hub?: object, checkResult?: object, priorityRows?: object[] }} ctx
   */
  function buildActionBoard(ctx) {
    lastCtx = ctx;
    const metrics = ctx?.metrics || {};
    const alerts = ctx?.alerts || [];
    const checkResult = ctx?.checkResult || {};
    const priorityRows = ctx?.priorityRows || [];
    const Dash = global.TasuAdminOperationsDashboard;

    const urgent = [];
    const today = [];
    const ai = [];
    const latest = [];
    const normal = [];

    alerts.forEach((a) => {
      const zone = a.risk === "critical" || a.risk === "high" ? ZONE.urgent : ZONE.today;
      if (zone === ZONE.urgent) urgent.push(fromAlert(a, ZONE.urgent));
      else today.push(fromAlert(a, ZONE.today));
    });

    if (checkResult.connectDraft?.active && checkResult.connectDraft.primary) {
      urgent.push(fromConnectPrimary(checkResult.connectDraft.primary));
      today.push(fromConnectStripeSendBlocked(checkResult.connectDraft.primary));
    }

    const bulk = buildBulkResolveItem(metrics);
    if (bulk) today.push(bulk);

    (global.TasuAdminAiResponsePlans?.buildResponsePlans?.() || [])
      .filter((p) => p.status !== "sent")
      .forEach((p) => {
        const row = fromResponsePlan(p);
        if (row.zone === ZONE.urgent) urgent.push(row);
        else ai.push(row);
      });

    (global.TasuAdminAiAutomationEngine?.buildAutomationCandidates?.() || [])
      .filter((c) => c.status !== "executed")
      .forEach((c) => {
        const row = fromAutomation(c);
        if (row.zone === ZONE.urgent) urgent.push(row);
        else ai.push(row);
      });

    if (Dash?.buildSuggestions) {
      Dash.buildSuggestions(metrics, ctx?.hub, alerts).forEach((s) => ai.push(fromSuggestion(s)));
    }

    if (!ai.some((r) => Number(r.actionLevel) >= 5)) {
      ai.push(fromSettingsChangeBlocked());
    }

    priorityRows.forEach((row) => {
      const built = fromPriorityRow(row);
      if (built.zone === ZONE.urgent) urgent.push(built);
      else today.push(built);
    });

    const hub = ctx?.hub;
    const openSec = hub?.sections?.find((s) => s.id === "open_inquiry");
    if (openSec?.items?.length) {
      openSec.items.slice(0, 3).forEach((it, i) => {
        today.push(fromHubInquiry(it, i));
      });
    }

    if (!urgent.length) {
      normal.push(
        item(
          "ok_urgent",
          ZONE.normal,
          "今すぐ対応が必要な緊急案件はありません",
          "決済停止・安否・重大通報の即時リスクは検知されていません",
          "問題なし",
          "本日対応・AI提案を確認するか、詳細統計で全体を把握できます",
          "詳細を見る",
          "#ops-ai-details",
          { actionType: AT.openDetail, openDetails: true, source: "status_ok" }
        )
      );
    }

    if (!today.length && !urgent.length) {
      normal.push(
        item(
          "ok_today",
          ZONE.normal,
          "本日の必須対応キューは空です",
          "未対応の問い合わせ・Connect・通報に即時の滞留はありません",
          "問題なし",
          "AI提案を確認するか、運営TALKで通知を眺めてください",
          "運営TALKを開く",
          "talk-home.html?audience=admin_ops&tab=chat&talkAdmin=1",
          { actionType: AT.openDetail, source: "status_ok" }
        )
      );
    }

    if (!ai.length) {
      normal.push(
        item(
          "ok_ai",
          ZONE.normal,
          "AIからの新しい提案はありません",
          "自動化候補・対応案の承認待ちはありません",
          "問題なし",
          "問題なし — 監視パネルは詳細からいつでも確認できます",
          "詳細を見る",
          "#ops-ai-details",
          { actionType: AT.openDetail, openDetails: true, source: "status_ok" }
        )
      );
    }

    const OW = global.TasuAdminAiOpsWatch;
    const watchLog = OW?.readWatchLog?.(10) || [];
    watchLog.slice(0, 4).forEach((row, i) => latest.push(fromOpsWatchLogRow(row, i)));
    if (!latest.length) {
      latest.push(
        item(
          "latest_ok",
          ZONE.latest,
          "運営に影響する外部変化は検知されていません",
          "OpenAI / Stripe / Supabase / Cloudflare などの大きな変更は記録されていません",
          "問題なし",
          "監視は継続しつつ、必要なら詳細を確認できます",
          "詳細を見る",
          "#ops-ai-watch",
          { actionType: AT.reviewOnly, openDetails: true, scrollTarget: "ops-ai-watch", source: "ops_watch" }
        )
      );
    }

    const watchSec = hub?.sections?.find((s) => s.id === "ops_watch");
    const watchCritical = (watchSec?.items || []).some(
      (i) => i.priority === "critical" || i.priority === "high"
    );
    if (!watchCritical && !urgent.length) {
      normal.push(
        item(
          "ok_watch",
          ZONE.normal,
          "OPS WATCH — 外部監視は安定",
          "Stripe・OpenAI・Cursor の重大アラートはありません",
          "問題なし",
          "定期チェックは自動実行中です",
          "詳細を見る",
          "#ops-ai-watch",
          { actionType: AT.reviewOnly, openDetails: true, scrollTarget: "ops-ai-watch", source: "ops_watch" }
        )
      );
    }

    const board = {
      urgent: dedupeItems(urgent),
      today: dedupeItems(today),
      ai: dedupeItems(ai),
      latest: dedupeItems(latest),
      normal: dedupeItems(normal).slice(0, 4),
    };

    lastFullBoard = board;
    global.TasuAdminAiActionExecutor?.indexBoard?.(board);
    return board;
  }

  function renderCard(row) {
    const Ex = global.TasuAdminAiActionExecutor;
    const executed = Ex?.getExecutedState?.(row.id);
    const level = Ex?.inferActionLevel?.(row.actionType, row.actionLevel) ?? row.actionLevel ?? 1;
    const canExec = Ex?.canExecuteRow?.(row);
    const levelBlocked = Ex?.isLevelBlocked?.(level);
    const attrs = [];
    if (row.openDetails) attrs.push('data-ops-action-open-details="1"');
    if (row.scrollTarget) attrs.push(`data-ops-action-scroll="${esc(row.scrollTarget)}"`);

    let actionHtml;
    if (executed) {
      actionHtml =
        `<p class="ops-ai-action-card__executed" data-ops-action-executed="${esc(row.id)}">` +
        `<span class="ops-ai-action-card__executed-badge">実行済み</span> ` +
        `${esc(Ex.formatJaDateTime(executed.executedAt))}<br>` +
        `${esc(executed.resultMessage || "完了")}` +
        `</p>`;
    } else if (canExec) {
      actionHtml = `<button type="button" class="ops-ai-action-card__btn ops-ai-action-card__btn--exec" data-ops-action-execute="${esc(row.id)}" data-ops-action-type="${esc(row.actionType)}" data-ops-action-level="${level}">${esc(row.actionLabel)}</button>`;
    } else if (levelBlocked) {
      actionHtml =
        `<p class="ops-ai-action-card__level-note">本番連携前のため確認のみ</p>` +
        `<button type="button" class="ops-ai-action-card__btn ops-ai-action-card__btn--preflight" data-ops-action-preflight-detail="${esc(row.id)}">詳細を見る</button>`;
    } else {
      actionHtml = `<a class="ops-ai-action-card__btn" href="${esc(row.href)}" ${attrs.join(" ")}>${esc(row.actionLabel)}</a>`;
    }

    const cardClass = executed
      ? " ops-ai-action-card--executed"
      : levelBlocked
        ? " ops-ai-action-card--level-blocked"
        : "";
    return (
      `<article class="ops-ai-action-card${cardClass}" data-ops-action-card="${esc(row.id)}" data-ops-action-type="${esc(row.actionType || "")}" data-ops-action-level="${level}">` +
      `<div class="ops-ai-action-card__head">${levelBadgeHtml({ ...row, actionLevel: level })}</div>` +
      `<div class="ops-ai-action-card__flow">` +
      `<p class="ops-ai-action-card__step"><span class="ops-ai-action-card__step-label">何が起きたか</span>${esc(row.happened)}</p>` +
      `<p class="ops-ai-action-card__step"><span class="ops-ai-action-card__step-label">影響</span>${esc(row.impact)}</p>` +
      `<p class="ops-ai-action-card__step"><span class="ops-ai-action-card__step-label">AI判断</span>${esc(row.aiDecision)}</p>` +
      `<p class="ops-ai-action-card__step"><span class="ops-ai-action-card__step-label">推奨行動</span>${esc(row.recommendation)}</p>` +
      `</div>` +
      actionHtml +
      `</article>`
    );
  }

  function renderOverflowFooter(zone, hiddenCount) {
    if (hiddenCount <= 0) return "";
    return (
      `<div class="ops-ai-action-overflow">` +
      `<p class="ops-ai-action-overflow__more">+${hiddenCount}件あります</p>` +
      `<button type="button" class="ops-ai-action-overflow__link" data-ops-action-show-all="${esc(zone)}">すべて見る</button>` +
      `</div>`
    );
  }

  function renderTodayEmpty(ctx) {
    const lines = buildHealthLines(ctx);
    return (
      `<div class="ops-ai-action-today-ok">` +
      `<p class="ops-ai-action-today-ok__head">本日の必須対応はありません</p>` +
      renderHealthList(lines, true) +
      `</div>`
    );
  }

  function renderZone(host, zone, title, allRows, options) {
    if (!host) return;
    const opts = options || {};
    const limit =
      opts.limit ??
      (zone === ZONE.urgent || zone === ZONE.today
        ? ZONE_TOP_LIMIT
        : zone === ZONE.ai || zone === ZONE.latest
          ? ZONE_SECONDARY_LIMIT
          : allRows.length);
    const expanded = zoneExpanded[zone] === true;
    const displayRows = rowsForDisplay(zone, allRows);
    const visibleRows = expanded ? displayRows : displayRows.slice(0, limit);
    const hiddenCount = expanded ? 0 : Math.max(0, displayRows.length - limit);
    const showOverflow = (zone === ZONE.urgent || zone === ZONE.today) && hiddenCount > 0;

    let body;
    if (visibleRows.length > 0) {
      body =
        `<div class="ops-ai-action-list">${visibleRows.map(renderCard).join("")}</div>` +
        (showOverflow ? renderOverflowFooter(zone, hiddenCount) : "");
    } else if (zone === ZONE.today && opts.emptyMode === "compact-health") {
      body = renderTodayEmpty(opts.ctx || lastCtx || {});
    } else {
      body = `<p class="ops-ai-action-empty">${esc(opts.emptyText || "該当なし")}</p>`;
    }

    host.innerHTML =
      `<header class="ops-ai-action-zone__head"><h2 class="ops-ai-action-zone__title" id="ops-action-${zone}-heading">${esc(title)}</h2></header>` +
      body;
  }

  function renderNormalFold(host, summaryHost, rows, ctx) {
    const lines = buildHealthLines(ctx);
    const summaryText = healthSummaryText(lines, false);
    if (summaryHost) {
      summaryHost.textContent = summaryText;
    }
    if (!host) return;
    const body =
      rows.length > 0
        ? `<div class="ops-ai-action-list">${rows.map(renderCard).join("")}</div>`
        : `<p class="ops-ai-action-empty">すべて安定しています</p>`;
    host.innerHTML = body;
  }

  function scrollToZoneHeading(zone) {
    const heading = global.document?.getElementById(`ops-action-${zone}-heading`);
    if (!heading) return;
    heading.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderActionSummary(board) {
    const host = global.document?.querySelector("[data-ops-action-summary-inner]");
    if (!host) return;
    const items = [
      { zone: ZONE.urgent, icon: "🔥", label: "今すぐ対応", count: (board.urgent || []).length, mod: "urgent" },
      { zone: ZONE.today, icon: "📅", label: "本日対応", count: (board.today || []).length, mod: "today" },
      { zone: ZONE.ai, icon: "💡", label: "AI提案", count: (board.ai || []).length, mod: "ai" },
      { zone: ZONE.latest, icon: "📰", label: "最新情報", count: (board.latest || []).length, mod: "latest" },
    ];
    host.innerHTML = items
      .map(
        (item) =>
          `<button type="button" class="ops-ai-action-summary__chip ops-ai-action-summary__chip--${item.mod}" role="listitem" data-ops-action-summary-jump="${esc(item.zone)}" aria-label="${esc(item.label)} ${item.count}件">` +
          `<span class="ops-ai-action-summary__chip-icon" aria-hidden="true">${item.icon}</span>` +
          `<span class="ops-ai-action-summary__chip-label">${esc(item.label)}</span>` +
          `<span class="ops-ai-action-summary__chip-count">${item.count}件</span>` +
          `</button>`
      )
      .join("");
  }

  function bindActionSummary() {
    const strip = global.document?.querySelector("[data-ops-action-summary]");
    if (!strip || strip.dataset.summaryWired === "1") return;
    strip.dataset.summaryWired = "1";
    strip.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-ops-action-summary-jump]");
      if (!btn) return;
      e.preventDefault();
      scrollToZoneHeading(btn.getAttribute("data-ops-action-summary-jump"));
    });
  }

  function openDetailsAndScroll(targetId) {
    const details = global.document?.getElementById("ops-ai-details");
    if (details && !details.open) details.open = true;
    const el = targetId ? global.document?.getElementById(targetId) : null;
    if (el) {
      global.setTimeout(() => {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    }
  }

  function bindActionBoard() {
    const root = global.document?.querySelector("[data-ops-action-board]");
    if (!root || root.dataset.wired === "1") return;
    root.dataset.wired = "1";
    root.addEventListener("click", (e) => {
      const showAllBtn = e.target.closest("[data-ops-action-show-all]");
      if (showAllBtn) {
        e.preventDefault();
        const zone = showAllBtn.getAttribute("data-ops-action-show-all");
        if (zone && Object.prototype.hasOwnProperty.call(zoneExpanded, zone)) {
          zoneExpanded[zone] = true;
          refreshFromContext();
        }
        return;
      }
      if (e.target.closest("[data-ops-action-execute]")) return;
      const btn = e.target.closest("[data-ops-action-open-details], [data-ops-action-scroll]");
      if (!btn) return;
      const href = btn.getAttribute("href") || "";
      if (href.startsWith("#") && href.length > 1) {
        e.preventDefault();
        openDetailsAndScroll(href.slice(1));
        return;
      }
      const scrollId = btn.getAttribute("data-ops-action-scroll");
      if (scrollId) {
        e.preventDefault();
        openDetailsAndScroll(scrollId);
      }
    });
  }

  function renderActionBoard(ctx) {
    const boardCtx = ctx || lastCtx || {};
    const board = buildActionBoard(boardCtx);
    renderZone(
      global.document?.querySelector('[data-ops-action-zone="urgent"]'),
      ZONE.urgent,
      "今すぐ対応",
      board.urgent,
      { emptyText: "緊急対応はありません", limit: ZONE_TOP_LIMIT }
    );
    renderZone(
      global.document?.querySelector('[data-ops-action-zone="today"]'),
      ZONE.today,
      "本日対応",
      board.today,
      { emptyText: "本日の必須キューは空です", limit: ZONE_TOP_LIMIT, emptyMode: "compact-health", ctx: boardCtx }
    );
    renderZone(
      global.document?.querySelector('[data-ops-action-zone="ai"]'),
      ZONE.ai,
      "AI提案",
      board.ai,
      { emptyText: "新しいAI提案はありません", limit: ZONE_SECONDARY_LIMIT }
    );
    renderZone(
      global.document?.querySelector('[data-ops-action-zone="latest"]'),
      ZONE.latest,
      "最新情報",
      board.latest,
      { emptyText: "運営に影響する外部変化はありません", limit: ZONE_SECONDARY_LIMIT }
    );
    renderNormalFold(
      global.document?.querySelector("[data-ops-action-normal-cards]"),
      global.document?.querySelector("[data-ops-action-normal-summary]"),
      board.normal,
      boardCtx
    );
    renderActionSummary(board);
    bindActionBoard();
    bindActionSummary();
    return board;
  }

  function refreshFromContext() {
    if (lastCtx) renderActionBoard(lastCtx);
    else global.TasuAdminOperationsDashboard?.refresh?.({ skipConclusion: true });
  }

  global.addEventListener?.("tasu:ai-action-executed", () => {
    refreshFromContext();
    global.TasuAdminAiActionHistory?.render?.();
  });

  global.TasuAdminAiActionBoard = {
    ZONE,
    buildActionBoard,
    renderActionBoard,
    refreshFromContext,
    openDetailsAndScroll,
  };
})(typeof window !== "undefined" ? window : globalThis);
