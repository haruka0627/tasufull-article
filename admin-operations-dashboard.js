/**
 * AI運営司令塔 — 閲覧専用（既存 localStorage ストア集計 + AI整理UI）
 */
(function () {
  "use strict";

  const PRIORITY_SUPPORT_CATS = new Set([
    "legal_or_risk",
    "connect_issue",
    "abuse_or_policy",
  ]);

  const PRIORITY_OPS_CATS = new Set([
    "legal",
    "chargeback",
    "connect_issue",
    "abuse_or_policy",
    "external_payment",
    "violation_report",
    "report",
  ]);

  const VIOLATION_OPS = new Set([
    "abuse_or_policy",
    "external_payment",
    "direct_sales",
    "violation_report",
    "report",
    "ban_candidate",
    "listing_suspend_candidate",
  ]);

  const MOCK_PRIORITY = [];

  const CONNECT_DRAFT_DEFAULT = {
    active: true,
    pendingCount: 1,
    aiDraftReady: true,
    pendingSend: 1,
    missingItems: ["事業内容説明", "サービス内容", "利用規約URL"],
    previewHref: "support-trouble-center.html?filter=connect",
    message:
      "Connectから追加確認が来ています。AIが回答文を作成済みです。送信前に不足項目をご確認ください。",
  };

  let activeConnectItemId = null;

  const SHORTCUTS = [
    {
      href: "#ops-ai-secretary",
      label: "AI運営秘書",
      desc: "運営情報の集約（毎日の起点）",
      testId: "shortcut-talk-ops",
    },
    {
      href: "support-trouble-center.html",
      label: "Supportトラブルセンター",
      desc: "問い合わせ・Connect・AI一次対応",
      testId: "shortcut-support",
    },
    {
      href: "admin-ai-operations-center.html",
      label: "AI運営センター",
      desc: "横断案件・運営コマンド",
      testId: "shortcut-ai-ops",
    },
    {
      href: "builder/admin-partner-evaluations.html",
      label: "Builderパートナー評価",
      desc: "期日・クレーム実績スコア",
      testId: "shortcut-partner-eval",
    },
    {
      href: "builder/admin-partner-evaluations.html#hidden-partners",
      label: "非表示パートナー一覧",
      desc: "非表示・停止中の協力会社",
      testId: "shortcut-hidden-partners",
    },
  ];

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function isToday(iso) {
    if (!iso) return false;
    const d = new Date(iso);
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  }

  function isThisWeek(iso) {
    if (!iso) return false;
    const d = new Date(iso);
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    start.setHours(0, 0, 0, 0);
    return d >= start;
  }

  function formatTime(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", hour12: false });
  }

  function riskRank(sev) {
    if (sev === "critical") return 4;
    if (sev === "high") return 3;
    if (sev === "medium") return 2;
    return 1;
  }

  function alertScoreTicket(t) {
    let s = riskRank(t.severity) * 25;
    if (PRIORITY_SUPPORT_CATS.has(t.category)) s += 40;
    if (t.status !== "resolved") s += 5;
    return s;
  }

  function alertScoreCase(c) {
    let s = riskRank(c.ai_risk || c.severity) * 25;
    const cat = c.ops_category || c.ai_category || "";
    if (PRIORITY_OPS_CATS.has(cat)) s += 40;
    if (c.status !== "resolved") s += 5;
    return s;
  }

  function categoryLabel(cat) {
    const map = {
      connect_issue: "Connect",
      abuse_or_policy: "通報",
      legal_or_risk: "通報",
      violation_report: "通報",
      report: "通報",
      admin_review: "問い合わせ",
      refund: "問い合わせ",
      chargeback: "問い合わせ",
    };
    return map[cat] || "問い合わせ";
  }

  function categoryClassFor(cat) {
    if (cat === "connect_issue") return "connect";
    if (cat === "abuse_or_policy" || cat === "legal_or_risk" || cat === "report" || cat === "violation_report") {
      return "report";
    }
    return "inquiry";
  }

  function importanceLabel(risk) {
    if (risk === "critical" || risk === "high") return { label: "高", cls: "high" };
    if (risk === "medium") return { label: "中", cls: "medium" };
    return { label: "低", cls: "low" };
  }

  function readSupportTickets() {
    const store = window.TasuSupportTicketStore;
    if (!store?.listTickets) return { ok: false, list: [] };
    return { ok: true, list: store.listTickets() };
  }

  function readConnectIssues() {
    const store = window.TasuSupportTicketStore;
    if (!store?.listConnectIssues) return [];
    return store.listConnectIssues().filter((c) => c.status !== "resolved");
  }

  function readAiCases() {
    const store = window.TasuAiOpsCaseStore;
    if (!store?.listCases) return { ok: false, list: [] };
    return { ok: true, list: store.listCases() };
  }

  function readHiddenPartners() {
    const ev = window.TasuBuilderPartnerEval;
    if (!ev?.listHiddenPartners) return { ok: false, list: [] };
    return { ok: true, list: ev.listHiddenPartners() };
  }

  function countByStatus(items, openStatuses, progressStatuses) {
    let open = 0;
    let progress = 0;
    let done = 0;
    let aiDone = 0;
    items.forEach((item) => {
      const st = item.status || "";
      if (st === "ai_replied") {
        aiDone += 1;
        progress += 1;
      } else if (st === "resolved") done += 1;
      else if (progressStatuses.has(st)) progress += 1;
      else if (openStatuses.has(st) || st) open += 1;
    });
    return { open, progress, done, aiDone };
  }

  /** 朝チェック結果 — 後から本番データソースに差し替えやすいDTO */
  function buildMorningCheckResult(metrics, hub) {
    const openSec = hub?.sections?.find((s) => s.id === "open_inquiry");
    const reportSec = hub?.sections?.find((s) => s.id === "report");
    const connectSec = hub?.sections?.find((s) => s.id === "connect");
    const anpiSec = hub?.sections?.find((s) => s.id === "anpi");
    const watchSec = hub?.sections?.find((s) => s.id === "ops_watch");

    const aiProcessed = metrics.aiReplied;
    const needsReview = metrics.needsReviewCount;
    const urgent = metrics.highCriticalCount;
    const apiProposals = 0;
    const estimatedMinutes = Math.min(
      30,
      Math.max(3, needsReview * 4 + urgent * 5 + Math.max(metrics.connectCount, 1) * 2)
    );

    const connectPending = window.TasuAdminConnectAiSupport?.getPendingConnectCount?.() ?? 0;

    return {
      generatedAt: new Date().toISOString(),
      aiProcessed,
      needsReview,
      urgent,
      apiProposals,
      estimatedMinutes,
      inquiryCount: openSec?.count ?? metrics.openCount,
      reportCount: reportSec?.count ?? metrics.violationReportCount,
      connectCount: Math.max(connectPending, connectSec?.count ?? metrics.connectCount, metrics.connectAiPending ?? 0),
      anpiCount: anpiSec?.count ?? 0,
      watchCount: watchSec?.count ?? 0,
      connectDraft: buildConnectDraft(metrics, connectSec),
    };
  }

  function buildConnectDraft(metrics, connectSec) {
    const Connect = window.TasuAdminConnectAiSupport;
    const items = Connect?.buildConnectActionItems?.() || [];
    const stripeStatus = Connect?.getStripeEventStatus?.() || null;

    if (items.length === 0) {
      return {
        active: false,
        pendingCount: 0,
        items: [],
        primary: null,
        stripeStatus,
      };
    }

    return {
      active: true,
      items,
      primary: items[0],
      pendingCount: items.length,
      stripeStatus,
    };
  }

  function buildMetrics() {
    const support = readSupportTickets();
    const tickets = support.list;
    const connectIssues = readConnectIssues();
    const ai = readAiCases();
    const allCases = ai.list;
    const cases = allCases.filter((c) => c.status !== "resolved");
    const hidden = readHiddenPartners();

    const openCount = tickets.filter((t) => t.status === "open").length;
    const needsReviewSupport = tickets.filter(
      (t) => t.status === "needs_review" || t.status === "in_progress"
    ).length;
    const needsReviewAi = cases.filter((c) => c.status === "needs_review").length;
    const highCriticalTickets = tickets.filter(
      (t) =>
        t.status !== "resolved" &&
        (t.severity === "high" || t.severity === "critical")
    ).length;
    const highCriticalCases = cases.filter(
      (c) => c.ai_risk === "high" || c.ai_risk === "critical"
    ).length;
    const connectTicketCount = tickets.filter(
      (t) => t.category === "connect_issue" && t.status !== "resolved"
    ).length;
    const stripeWebhookTicketCount = tickets.filter(
      (t) => t.source === "stripe_webhook_sim" || t.stripe_connect_meta
    ).length;
    const connectCaseCount = cases.filter(
      (c) => (c.ops_category || c.ai_category) === "connect_issue"
    ).length;
    const violationTicketCount = tickets.filter(
      (t) =>
        t.status !== "resolved" &&
        (t.category === "abuse_or_policy" || t.category === "legal_or_risk")
    ).length;
    const violationCaseCount = cases.filter((c) => {
      const cat = c.ops_category || c.ai_category || "";
      return VIOLATION_OPS.has(cat) || cat === "report";
    }).length;
    const todayNew = tickets.filter((t) => isToday(t.created_at)).length;
    const aiReplied = tickets.filter((t) => t.status === "ai_replied").length;
    const resolvedToday =
      tickets.filter((t) => t.status === "resolved" && isToday(t.updated_at)).length +
      allCases.filter((c) => c.status === "resolved" && isToday(c.updated_at)).length;
    const weeklyHandled =
      tickets.filter((t) => isThisWeek(t.updated_at)).length +
      allCases.filter((c) => isThisWeek(c.updated_at)).length;

    const allUnresolved =
      tickets.filter((t) => t.status !== "resolved").length + cases.length;

    const connectAiPending = window.TasuAdminConnectAiSupport?.getPendingConnectCount?.() ?? 0;
    const connectBase =
      connectTicketCount + connectIssues.length + connectCaseCount;

    const pendingReviewLocal =
      window.TasuPlatformModerationQueue?.readLocalQueue?.()?.filter(
        (x) => x.moderation_status === "pending_review"
      ).length ?? 0;
    const pendingReviewSignals =
      window.TasuPlatformContentGateEvents?.countPendingSignals?.() ?? 0;

    return {
      supportOk: support.ok,
      aiOk: ai.ok,
      builderOk: hidden.ok,
      openCount,
      pendingReviewCount: pendingReviewLocal + pendingReviewSignals,
      needsReviewCount: needsReviewSupport + needsReviewAi,
      highCriticalCount: highCriticalTickets + highCriticalCases,
      connectCount: Math.max(connectBase, connectAiPending),
      connectAiPending,
      stripeWebhookTicketCount,
      violationReportCount: violationTicketCount + violationCaseCount,
      hiddenPartnerCount: hidden.list.length,
      todayNew,
      aiReplied,
      allUnresolved,
      resolvedToday,
      weeklyHandled,
      tickets,
      cases,
      allCases,
      hiddenList: hidden.list,
    };
  }

  function buildAlerts(metrics) {
    const items = [];

    metrics.tickets
      .filter(
        (t) =>
          t.status !== "resolved" &&
          (t.severity === "high" ||
            t.severity === "critical" ||
            PRIORITY_SUPPORT_CATS.has(t.category))
      )
      .forEach((t) => {
        items.push({
          kind: "support",
          id: t.id,
          title: t.title,
          risk: t.severity,
          category: t.category,
          status: t.status,
          updated_at: t.updated_at || t.created_at,
          href: `support-trouble-center.html?ticket=${encodeURIComponent(t.id)}`,
          score: alertScoreTicket(t),
        });
      });

    metrics.cases
      .filter(
        (c) =>
          c.ai_risk === "high" ||
          c.ai_risk === "critical" ||
          PRIORITY_OPS_CATS.has(c.ops_category || c.ai_category || "")
      )
      .forEach((c) => {
        items.push({
          kind: "ai-ops",
          id: c.id,
          title: c.title,
          risk: c.ai_risk || c.severity,
          category: c.ops_category || c.ai_category,
          status: c.status,
          updated_at: c.updated_at || c.created_at,
          href: `admin-ai-operations-center.html?case=${encodeURIComponent(c.id)}`,
          score: alertScoreCase(c),
        });
      });

    items.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return String(b.updated_at).localeCompare(String(a.updated_at));
    });

    const seen = new Set();
    const deduped = [];
    for (const row of items) {
      const key = `${row.kind}:${row.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(row);
      if (deduped.length >= 5) break;
    }
    return deduped;
  }

  function buildTasks(metrics) {
    const tickets = metrics.tickets;
    const cases = metrics.cases;

    const needsReview =
      tickets.filter((t) => t.status === "needs_review" || t.status === "in_progress").length +
      cases.filter((c) => c.status === "needs_review").length;

    const replyWaiting = tickets.filter(
      (t) => t.status === "open" || t.status === "ai_replied"
    ).length;

    const connectCheck =
      tickets.filter((t) => t.category === "connect_issue" && t.status !== "resolved").length +
      cases.filter((c) => (c.ops_category || c.ai_category) === "connect_issue").length;

    const refundCandidates = cases.filter((c) => {
      const cat = c.ops_category || c.ai_category || "";
      return cat === "refund" || cat === "chargeback";
    }).length;

    const banCandidates = cases.filter((c) => {
      const cat = c.ops_category || c.ai_category || "";
      return cat === "ban_candidate";
    }).length;

    const hiddenCheck = metrics.hiddenPartnerCount;

    return [
      { label: "要確認", count: needsReview, href: "admin-ai-operations-center.html" },
      { label: "返信待ち", count: replyWaiting, href: "support-trouble-center.html" },
      { label: "Connect確認", count: connectCheck, href: "support-trouble-center.html" },
      { label: "返金候補", count: refundCandidates, href: "admin-ai-operations-center.html" },
      { label: "BAN候補", count: banCandidates, href: "admin-ai-operations-center.html" },
      {
        label: "パートナー非表示確認",
        count: hiddenCheck,
        href: "builder/admin-partner-evaluations.html#hidden-partners",
      },
    ];
  }

  function hubItemToPriorityRow(item, rank) {
    const imp =
      item.priority === "critical"
        ? { label: "高", cls: "high" }
        : item.priority === "high"
          ? { label: "高", cls: "high" }
          : item.priority === "medium"
            ? { label: "中", cls: "medium" }
            : { label: "低", cls: "low" };

    let category = "問い合わせ";
    let categoryClass = "inquiry";
    const meta = String(item.meta || "");
    const source = String(item.source || "");
    if (source === "connect" || /connect/i.test(meta)) {
      category = "Connect";
      categoryClass = "connect";
    } else if (source === "builder" || /builder/i.test(meta)) {
      category = "Builder";
      categoryClass = "builder";
    } else if (/通報|違反|report/i.test(meta) || /通報/.test(item.title)) {
      category = "通報";
      categoryClass = "report";
    } else if (/安否|anpi/i.test(meta)) {
      category = "安否";
      categoryClass = "inquiry";
    }

    return {
      title: item.title,
      category,
      categoryClass,
      importance: imp.label,
      importanceClass: imp.cls,
      time: "—",
      href: item.href,
      rank,
      alert: true,
    };
  }

  function buildPriorityRows(alerts, hub) {
    const prioritySec = hub?.sections?.find((s) => s.id === "priority");
    if (prioritySec?.items?.length) {
      return prioritySec.items.slice(0, 4).map((item, i) => hubItemToPriorityRow(item, i + 1));
    }

    if (alerts.length) {
      return alerts.slice(0, 4).map((a, i) => {
        const imp = importanceLabel(a.risk);
        return {
          title: a.title,
          category: categoryLabel(a.category),
          categoryClass: categoryClassFor(a.category),
          importance: imp.label,
          importanceClass: imp.cls,
          time: formatTime(a.updated_at),
          href: a.href,
          rank: i + 1,
          alert: true,
        };
      });
    }
    return [];
  }

  function countNotifyCategory(filterFn) {
    const store = window.TasuTalkNotifications;
    const list = (store?.getAll?.() || []).filter(filterFn);
    const unread = list.filter((n) => store?.isUnread?.(n) !== false && !n.readAt);
    return {
      open: unread.length,
      progress: Math.max(0, list.length - unread.length),
      done: list.filter((n) => n.readAt).length,
      aiDone: 0,
    };
  }

  function renderSummary(m) {
    const cards = [
      {
        key: "unresolved",
        label: "すべての未対応",
        value: m.allUnresolved,
        icon: "✉",
        delta: m.todayNew > 0 ? `+${m.todayNew} 今日` : "0 今日",
        deltaClass: m.todayNew > 0 ? "warn" : "muted",
        statusLabel: m.allUnresolved > 0 ? "要確認" : "正常",
        statusClass: m.allUnresolved > 0 ? "warn" : "ok",
      },
      {
        key: "high_critical",
        label: "重要・高リスク",
        value: m.highCriticalCount,
        icon: "⚠",
        delta: m.highCriticalCount > 0 ? `${m.highCriticalCount} 件 未対応` : "0 件",
        deltaClass: m.highCriticalCount > 0 ? "warn" : "muted",
        risk: true,
        statusLabel: m.highCriticalCount > 0 ? "緊急" : "安定",
        statusClass: m.highCriticalCount > 0 ? "danger" : "ok",
      },
      {
        key: "resolved_today",
        label: "今日の対応完了",
        value: m.resolvedToday,
        icon: "✓",
        delta: `${m.resolvedToday} 本日`,
        deltaClass: m.resolvedToday > 0 ? "up" : "muted",
        ok: true,
        statusLabel: "順調",
        statusClass: "ok",
      },
      {
        key: "ai_replied",
        label: "AI自動処理済み",
        value: m.aiReplied,
        icon: "🤖",
        delta: m.aiReplied > 0 ? `${m.aiReplied} 件` : "0 件",
        deltaClass: "muted",
        ai: true,
        statusLabel: "AI処理済",
        statusClass: "ok",
      },
      {
        key: "weekly",
        label: "今週の総対応",
        value: m.weeklyHandled,
        icon: "⏱",
        delta: `${m.weeklyHandled} 今週`,
        deltaClass: "muted",
        info: true,
        statusLabel: "通常",
        statusClass: "info",
      },
    ];

    const el = document.querySelector("[data-ops-dash-summary]");
    if (!el) return;
    el.innerHTML = cards
      .map((c) => {
        const mod = c.risk
          ? " ops-dash-card--risk"
          : c.ok
            ? " ops-dash-card--ok"
            : c.ai
              ? " ops-dash-card--ai"
              : c.info
                ? " ops-dash-card--info"
                : "";
        return (
          `<article class="ops-dash-card${mod}" data-ops-dash-metric="${esc(c.key)}">` +
          `<div class="ops-dash-card__head"><span class="ops-dash-card__label">${esc(c.label)}</span>` +
          `<span class="ops-dash-card__icon" aria-hidden="true">${c.icon}</span></div>` +
          `<strong class="ops-dash-card__value">${esc(c.value)}<span class="ops-dash-card__unit">件</span></strong>` +
          `<span class="ops-dash-card__delta ops-dash-card__delta--${esc(c.deltaClass)}">${esc(c.delta)}</span>` +
          `<span class="ops-dash-card__status ops-dash-card__status--${esc(c.statusClass)}">${esc(c.statusLabel)}</span>` +
          `</article>`
        );
      })
      .join("");
  }

  function renderAlerts(alerts) {
    const el = document.querySelector("[data-ops-dash-alerts]");
    if (!el) return;
    if (!alerts.length) {
      el.innerHTML =
        '<li><p class="ops-dash-empty" data-ops-dash-alerts-empty>現在、重要な対応はありません</p></li>';
      return;
    }
    el.innerHTML = alerts
      .map((a) => {
        const tagClass =
          a.risk === "critical" ? "ops-dash-tag--critical" : "ops-dash-tag--high";
        const src = a.kind === "support" ? "Support" : "AI運営";
        return (
          `<li class="ops-dash-alert-item" data-ops-dash-alert>` +
          `<a href="${esc(a.href)}" data-ops-dash-alert-link>` +
          `<span class="ops-dash-tag ${tagClass}">${esc(a.risk || "—")}</span>` +
          `<span class="ops-dash-alert-item__title">${esc(a.title)}</span>` +
          `<span class="ops-dash-alert-item__meta">${esc(src)} · ${esc(a.category)} · ${esc(a.status)}</span>` +
          `</a></li>`
        );
      })
      .join("");
  }

  function renderPriorityTasks(rows, alerts) {
    const tbody = document.querySelector("[data-ops-dash-priority-tasks]");
    if (!tbody) return;
    const display = rows.slice(0, 4);
    tbody.innerHTML = display.length
      ? display
          .map(
            (r) =>
              `<tr>` +
              `<td><span class="ops-ai-table__rank">${esc(r.rank)}</span></td>` +
              `<td><a class="ops-ai-table__title" href="${esc(r.href)}">${esc(r.title)}</a></td>` +
              `<td><span class="ops-ai-tag ops-ai-tag--${esc(r.importanceClass)}">${esc(r.importance)}</span></td>` +
              `<td><a class="ops-ai-table__action" href="${esc(r.href)}">確認</a></td>` +
              `</tr>`
          )
          .join("")
      : `<tr><td colspan="4"><p class="ops-ai-focus-empty">要確認タスクはありません — 問題なし</p></td></tr>`;
    renderAlerts(alerts);
  }

  function buildTodayActionSentence(result, priorityRows) {
    const top = priorityRows[0];
    const topTitle = String(top?.title || "");
    const isConnectTop =
      top?.categoryClass === "connect" ||
      /connect|本人確認|stripe|出金|チャージバック/i.test(topTitle);

    if (result.urgent > 0) {
      return topTitle
        ? `「${topTitle}」を最優先で確認してください。`
        : `緊急 ${result.urgent}件を最優先で確認してください。`;
    }
    if (result.needsReview > 0) {
      if (isConnectTop) {
        return "Connect本人確認の内容を確認してください。";
      }
      return topTitle
        ? `「${topTitle}」を確認すれば十分です。`
        : `要確認 ${result.needsReview}件を確認してください。`;
    }
    if (result.connectCount > 0 || result.connectDraft?.active) {
      return "Connect本人確認の内容を確認してください。";
    }
    return "緊急案件はありません。AI提案の確認のみでOKです。";
  }

  /** 結論カード — AIが決める次の1ボタン（優先順位固定） */
  function resolveNextAction(result) {
    if (result.urgent > 0) {
      return {
        id: "urgent",
        message: "緊急案件を確認してください。",
        label: "緊急案件を確認する",
        href: "#ops-priority-heading",
        scroll: true,
      };
    }
    if (result.needsReview > 0) {
      return {
        id: "needs_review",
        message: "要確認案件を確認してください。",
        label: "要確認だけ見る",
        href: "#ops-priority-heading",
        scroll: true,
      };
    }
    if (result.connectCount > 0 || result.connectDraft?.active) {
      return {
        id: "connect",
        message: "Connect対応を確認してください。",
        label: "Connectを確認する",
        href: "#ops-ai-connect",
        scroll: true,
      };
    }
    if ((result.reportCount ?? 0) > 0) {
      return {
        id: "report",
        message: "通報を確認してください。",
        label: "通報を確認する",
        href: "support-trouble-center.html?filter=report",
        scroll: false,
      };
    }
    if ((result.apiProposals ?? 0) > 0) {
      return {
        id: "api",
        message: "API提案を確認してください。",
        label: "API提案を確認する",
        href: "#ops-suggest-heading",
        scroll: true,
      };
    }
    return {
      id: "done",
      message: "本日の確認は完了です。",
      label: "本日のレポートを生成",
      action: "morning_report",
    };
  }

  function renderNextAction(result) {
    const msgEl = document.querySelector("[data-ops-daily-next-message]");
    const host = document.querySelector("[data-ops-daily-next-cta-host]");
    if (!msgEl || !host) return;

    const next = resolveNextAction(result);
    msgEl.textContent = next.message;

    if (next.action === "morning_report") {
      host.innerHTML =
        `<button type="button" class="ops-ai-daily-conclusion__cta ops-ai-daily-conclusion__cta--primary" ` +
        `data-ops-daily-next-cta data-ops-next-action="morning_report">${esc(next.label)}</button>`;
      return;
    }

    const scrollAttr = next.scroll ? ` data-ops-daily-next-cta data-ops-next-scroll="1"` : "";
    host.innerHTML =
      `<a class="ops-ai-daily-conclusion__cta ops-ai-daily-conclusion__cta--primary" href="${esc(next.href)}"${scrollAttr}>` +
      `${esc(next.label)}</a>`;
  }

  function renderDailyConclusion(result, priorityRows) {
    const panel = document.querySelector("[data-ops-daily-conclusion]");
    const statsEl = document.querySelector("[data-ops-daily-conclusion-stats]");
    const sentenceEl = document.querySelector("[data-ops-daily-conclusion-sentence]");
    const timeEl = document.querySelector("[data-ops-daily-conclusion-time]");
    if (!panel || !statsEl) return;

    panel.hidden = false;
    panel.classList.add("is-ready");
    if (timeEl) {
      timeEl.dateTime = result.generatedAt;
      timeEl.textContent = formatTime(result.generatedAt);
    }

    const stats = [
      { label: "緊急", value: `${result.urgent}件`, cls: result.urgent > 0 ? "danger" : "ok" },
      { label: "要確認", value: `${result.needsReview}件`, cls: result.needsReview > 0 ? "warn" : "ok" },
      { label: "AI処理済", value: `${result.aiProcessed}件`, cls: "ok" },
      { label: "想定対応時間", value: `${result.estimatedMinutes}分`, cls: "info" },
    ];
    statsEl.innerHTML = stats
      .map(
        (s) =>
          `<div class="ops-ai-conclusion-stat ops-ai-conclusion-stat--${esc(s.cls)}">` +
          `<span class="ops-ai-conclusion-stat__line">${esc(s.label)}: <strong>${esc(s.value)}</strong></span>` +
          `</div>`
      )
      .join("");

    if (sentenceEl) {
      sentenceEl.textContent = buildTodayActionSentence(result, priorityRows);
    }

    const eta = document.querySelector("[data-ops-dash-work-eta]");
    if (eta) eta.textContent = `今日の想定作業時間: ${result.estimatedMinutes}分`;

    renderNextAction(result);
  }

  function readJsonEvents(key) {
    try {
      const raw = localStorage.getItem(key);
      const data = raw ? JSON.parse(raw) : [];
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  function buildSuggestions(metrics, hub, alerts) {
    const cards = [];
    const priorityItems = hub?.sections?.find((s) => s.id === "priority")?.items || [];
    const topAlert = alerts[0] || priorityItems[0];

    if (metrics.highCriticalCount > 0) {
      const topTitle = String(topAlert?.title || priorityItems[0]?.title || "").slice(0, 48);
      cards.push({
        title: "高リスク案件の確認",
        body: topTitle
          ? `高リスク ${metrics.highCriticalCount} 件 — 「${topTitle}」から確認してください。`
          : `高リスク ${metrics.highCriticalCount} 件があります。AI運営センターで確認してください。`,
        effect: `高リスク ${metrics.highCriticalCount} 件`,
        cta: "確認する",
        href: topAlert?.href || priorityItems[0]?.href || "admin-ai-operations-center.html",
      });
    }

    const connectTotal = Math.max(metrics.connectCount, metrics.connectAiPending || 0);
    if (connectTotal > 0) {
      cards.push({
        title: "Connect対応",
        body: `Connect関連の未対応が ${connectTotal} 件あります。本人確認・出金エラー等を確認してください。`,
        effect: `Connect ${connectTotal} 件`,
        cta: "Connectを確認",
        href: "#ops-ai-connect",
      });
    }

    if (metrics.violationReportCount > 0) {
      cards.push({
        title: "通報・違反報告",
        body: `通報・違反系の未対応が ${metrics.violationReportCount} 件あります。`,
        effect: `通報 ${metrics.violationReportCount} 件`,
        cta: "通報を確認",
        href: "support-trouble-center.html?filter=report",
      });
    }

    if (metrics.pendingReviewCount > 0) {
      cards.push({
        title: "掲載審査キュー",
        body: `公開前審査待ち（pending_review）が ${metrics.pendingReviewCount} 件あります。`,
        effect: `審査待ち ${metrics.pendingReviewCount} 件`,
        cta: "審査キューを確認",
        href: "admin-operations-dashboard.html#ops-content-gate",
      });
    }

    if (metrics.openCount > 0) {
      cards.push({
        title: "未対応問い合わせ",
        body: `オープン状態の問い合わせが ${metrics.openCount} 件あります。`,
        effect: `未対応 ${metrics.openCount} 件`,
        cta: "問い合わせへ",
        href: "support-trouble-center.html",
      });
    }

    const builderCount =
      hub?.sections?.find((s) => s.id === "builder")?.count ?? metrics.hiddenPartnerCount ?? 0;
    if (builderCount > 0) {
      cards.push({
        title: "Builder評価の確認",
        body: `Builder関連の要注意が ${builderCount} 件あります（非表示・評価警告等）。`,
        effect: `Builder ${builderCount} 件`,
        cta: "評価画面へ",
        href: "builder/admin-partner-evaluations.html",
      });
    }

    const anpiSec = hub?.sections?.find((s) => s.id === "anpi");
    if (anpiSec?.count > 0) {
      const unread =
        anpiSec.items?.filter((i) => /未読/.test(String(i.meta))).length ?? anpiSec.count;
      cards.push({
        title: "安否通知",
        body: `安否関連の通知が ${anpiSec.count} 件あります${unread ? `（未読 ${unread} 件）` : ""}。`,
        effect: `安否 ${anpiSec.count} 件`,
        cta: "安否を確認",
        href: anpiSec.items?.[0]?.href || "anpi-dashboard.html",
      });
    }

    if (metrics.needsReviewCount > 0) {
      cards.push({
        title: "要確認案件",
        body: `要確認ステータスの案件が ${metrics.needsReviewCount} 件あります。`,
        effect: `要確認 ${metrics.needsReviewCount} 件`,
        cta: "AI運営センターへ",
        href: "admin-ai-operations-center.html",
      });
    }

    return cards;
  }

  function buildApiCostSnapshot() {
    const logs = window.TasuAiInteractionLog?.readLogs?.() || [];
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentLogs = logs.filter((l) => new Date(l.created_at).getTime() >= weekAgo);
    return {
      hasBilling: false,
      recentLogCount: recentLogs.length,
      totalLogCount: logs.length,
    };
  }

  function buildActivityItems(m) {
    const items = [];
    const push = (at, text, label, labelClass) => {
      const iso = String(at || "").trim();
      const body = String(text || "").trim();
      if (!iso || !body) return;
      items.push({
        at: iso,
        time: formatTime(iso),
        text: body.slice(0, 100),
        label,
        labelClass,
      });
    };

    const supportEventsKey =
      window.TasuSupportTicketStore?.EVENTS_KEY || "tasu_support_events_v1";
    readJsonEvents(supportEventsKey).forEach((e) => {
      push(
        e.created_at,
        e.payload_summary || e.event_type || "Supportイベント",
        "Support",
        e.event_type === "resolved" ? "ok" : "info"
      );
    });

    m.tickets.forEach((t) => {
      push(
        t.updated_at || t.created_at,
        `問い合わせ: ${t.title}（${t.status}）`,
        "問い合わせ",
        t.status === "resolved" ? "ok" : t.severity === "critical" ? "warn" : "info"
      );
    });

    m.allCases.forEach((c) => {
      push(
        c.updated_at || c.created_at,
        `AI運営案件: ${c.title}（${c.status}）`,
        "AI運営",
        c.ai_risk === "critical" ? "warn" : "info"
      );
    });

    readJsonEvents("tasu_ai_ops_events_v1").forEach((e) => {
      push(e.created_at, e.payload_summary || e.event_type, "AI運営", "info");
    });

    readJsonEvents("tasful:builder:partner_status_events:v1").forEach((e) => {
      push(
        e.created_at,
        `${e.partner_name || "パートナー"} — ${e.action || e.partner_status}${e.reason ? `（${e.reason}）` : ""}`,
        "Builder",
        e.action === "hidden" ? "warn" : "info"
      );
    });

    (window.TasuAdminConnectAiSupport?.listConnectActivity?.() || []).forEach((a) => {
      push(a.at, a.text, "Connect", "info");
    });

    (window.TasuAdminAiResponsePlans?.listOpsActivity?.() || []).forEach((a) => {
      push(
        a.at,
        a.text || `AI対応: ${a.targetUser || ""} — ${a.eventTypeLabel || a.eventType || ""}`,
        "AI対応",
        a.type === "ai_response_escalated" || a.type === "ai_response_blocked" ? "warn" : "ok"
      );
    });

    (window.TasuAdminAiAutomationEngine?.listActivity?.() || []).forEach((a) => {
      push(
        a.at,
        a.text || `自動処理: ${a.ruleName || ""} — ${a.target || ""}`,
        "自動処理",
        a.action === "escalated" || a.action === "blocked" ? "warn" : "info"
      );
    });

    let decisionLearningCount = 0;
    (window.TasuAdminAiDecisionLearning?.listRecentForOps?.(15) || []).forEach((a) => {
      if (decisionLearningCount >= 2) return;
      decisionLearningCount += 1;
      push(a.at, a.text, a.label, a.labelClass);
    });

    let outcomeLearningCount = 0;
    (window.TasuAdminAiOutcomeLearning?.listRecentForOps?.(10) || []).forEach((a) => {
      if (outcomeLearningCount >= 2) return;
      outcomeLearningCount += 1;
      push(a.at, a.text, a.label, a.labelClass);
    });

    (window.TasuTalkNotifications?.getAll?.() || []).slice(0, 30).forEach((n) => {
      const unread = window.TasuTalkNotifications?.isUnread?.(n) !== false && !n.readAt;
      const label =
        String(n?.source || "").toLowerCase() === "ops_watch"
          ? "OPS WATCH"
          : String(n.type || "通知");
      push(n.createdAt || n.updatedAt, n.title, label, unread ? "warn" : "info");
    });

    (window.TasuAiInteractionLog?.readLogs?.() || []).slice(0, 15).forEach((log) => {
      push(
        log.created_at,
        `AI利用: ${log.selected_model || log.ai_provider || "model"}（${log.surface || log.mode_id || ""}）`,
        "AI",
        "ai"
      );
    });

    items.sort((a, b) => String(b.at).localeCompare(String(a.at)));
    const seen = new Set();
    const unique = [];
    items.forEach((item) => {
      const key = `${item.at}|${item.text}`;
      if (seen.has(key)) return;
      seen.add(key);
      unique.push(item);
    });
    return unique;
  }

  function renderSuggestions(metrics, hub, alerts, limit) {
    const el = document.querySelector("[data-ops-dash-suggestions]");
    if (!el) return;
    const max = typeof limit === "number" ? limit : 2;
    const cards = buildSuggestions(metrics, hub, alerts).slice(0, max);
    if (!cards.length) {
      el.innerHTML =
        `<p class="ops-ai-focus-empty">現在、優先対応の提案はありません — 問題なし</p>`;
      return;
    }
    el.innerHTML = cards
      .map(
        (s) =>
          `<article class="ops-ai-suggest ops-ai-suggest--compact">` +
          `<h3 class="ops-ai-suggest__title">${esc(s.title)}</h3>` +
          `<p class="ops-ai-suggest__body">${esc(s.body.slice(0, 72))}${s.body.length > 72 ? "…" : ""}</p>` +
          `<p class="ops-ai-suggest__effect">${esc(s.effect || "")}</p>` +
          `<a class="ops-ai-suggest__cta" href="${esc(s.href)}">${esc(s.cta)}</a>` +
          `</article>`
      )
      .join("");
  }

  function renderApiCost() {
    const el = document.querySelector("[data-ops-dash-api-cost]");
    if (!el) return;
    const snap = buildApiCostSnapshot();
    if (!snap.hasBilling) {
      el.innerHTML =
        `<div class="ops-ai-api__total ops-ai-api__total--compact ops-ai-api--disconnected">` +
        `<strong>データ未接続</strong>` +
        `</div>` +
        `<p class="ops-ai-api__ratio">API課金・使用量の集計は未接続です（実API接続は後回し）</p>` +
        (snap.totalLogCount > 0
          ? `<p class="ops-ai-api__tip ops-ai-api__tip--compact">ローカルAIログ: 直近7日 ${esc(snap.recentLogCount)} 件 / 計 ${esc(snap.totalLogCount)} 件（コスト換算なし）</p>`
          : `<p class="ops-ai-api__tip ops-ai-api__tip--compact">ローカルAIログもまだありません</p>`);
      return;
    }
  }

  function renderActivity(m) {
    const el = document.querySelector("[data-ops-dash-activity]");
    if (!el) return;

    const items = buildActivityItems(m).slice(0, 5);
    if (!items.length) {
      el.innerHTML =
        `<li><p class="ops-ai-focus-empty">直近のアクティビティはありません</p></li>`;
      return;
    }

    el.innerHTML = items
      .map(
        (a) =>
          `<li class="ops-ai-activity-item">` +
          `<span class="ops-ai-activity-item__time">${esc(a.time)}</span>` +
          `<span class="ops-ai-activity-item__text">${esc(a.text)}</span>` +
          `<span class="ops-ai-activity-item__label ops-ai-activity-item__label--${esc(a.labelClass)}">${esc(a.label)}</span>` +
          `</li>`
      )
      .join("");
  }

  function renderCategoryStatus(m) {
    const el = document.querySelector("[data-ops-dash-category-status]");
    if (!el) return;

    const openSt = new Set(["open"]);
    const progressSt = new Set(["needs_review", "in_progress", "ai_replied"]);

    const inquiryTickets = m.tickets.filter(
      (t) => !["connect_issue", "abuse_or_policy", "legal_or_risk"].includes(t.category)
    );
    const reportTickets = m.tickets.filter((t) =>
      ["abuse_or_policy", "legal_or_risk"].includes(t.category)
    );
    const connectTickets = m.tickets.filter((t) => t.category === "connect_issue");
    const connectCases = m.allCases.filter(
      (c) => (c.ops_category || c.ai_category) === "connect_issue"
    );

    const categories = [
      {
        icon: "✉",
        title: "問い合わせ",
        stats: countByStatus(inquiryTickets, openSt, progressSt),
      },
      {
        icon: "⚠",
        title: "通報",
        stats: countByStatus(reportTickets.concat(m.cases.filter((c) => VIOLATION_OPS.has(c.ops_category || c.ai_category || ""))), openSt, progressSt),
      },
      {
        icon: "🔗",
        title: "Connect",
        stats: countByStatus(connectTickets.concat(connectCases), openSt, progressSt),
      },
      {
        icon: "♥",
        title: "安否",
        stats: countNotifyCategory((n) => {
          const cat = String(n.category || "").toLowerCase();
          const type = String(n.type || "").toLowerCase();
          return cat === "anpi" || type === "anpi";
        }),
      },
      {
        icon: "👁",
        title: "TALK通知",
        stats: countNotifyCategory((n) => String(n?.source || "").toLowerCase() === "ops_watch"),
      },
      {
        icon: "🔧",
        title: "Builder",
        stats: {
          open: m.hiddenPartnerCount || 0,
          progress: 0,
          done: 0,
          aiDone: 0,
        },
      },
      {
        icon: "🤖",
        title: "AI自動処理",
        stats: { open: 0, progress: 0, done: m.aiReplied, aiDone: m.aiReplied },
      },
    ];

    el.innerHTML = categories
      .map((c) => {
        const total = c.stats.open + c.stats.progress + c.stats.done;
        const isEmpty = total === 0 && (c.stats.aiDone ?? 0) === 0;
        if (isEmpty) {
          return (
            `<article class="ops-ai-cat-card ops-ai-cat-card--empty">` +
            `<h3 class="ops-ai-cat-card__title"><span aria-hidden="true">${c.icon}</span>${esc(c.title)}</h3>` +
            `<p class="ops-ai-cat-card__ok">問題なし</p>` +
            `</article>`
          );
        }
        return (
          `<article class="ops-ai-cat-card">` +
          `<h3 class="ops-ai-cat-card__title"><span aria-hidden="true">${c.icon}</span>${esc(c.title)}</h3>` +
          `<div class="ops-ai-cat-card__stats">` +
          `<div class="ops-ai-cat-card__stat ops-ai-cat-card__stat--open"><strong>${esc(c.stats.open)}</strong><span>未対応</span></div>` +
          `<div class="ops-ai-cat-card__stat ops-ai-cat-card__stat--progress"><strong>${esc(c.stats.progress)}</strong><span>対応中</span></div>` +
          `<div class="ops-ai-cat-card__stat ops-ai-cat-card__stat--done"><strong>${esc(c.stats.done)}</strong><span>完了</span></div>` +
          `<div class="ops-ai-cat-card__stat ops-ai-cat-card__stat--ai"><strong>${esc(c.stats.aiDone ?? 0)}</strong><span>AI処理済</span></div>` +
          `</div></article>`
        );
      })
      .join("");
  }

  function renderNavBadges(m, hub) {
    const inquiry = m.openCount + m.needsReviewCount;
    const report = m.violationReportCount;
    const connect = m.connectCount;
    const anpi =
      hub?.sections?.find((s) => s.id === "anpi")?.count ??
      window.TasuTalkOpsAssistant?.collectAnpiItems?.()?.length ??
      0;
    const watch =
      hub?.sections?.find((s) => s.id === "ops_watch")?.count ??
      window.TasuTalkOpsAssistant?.collectOpsWatchHubItems?.()?.length ??
      0;
    const builderEval =
      hub?.sections?.find((s) => s.id === "builder")?.count ?? m.hiddenPartnerCount ?? 0;

    const setBadge = (key, value) => {
      const el = document.querySelector(`[data-ops-nav-badge="${key}"]`);
      if (!el) return;
      if (value > 0) {
        el.hidden = false;
        el.textContent = String(value);
      } else if (key !== "anpi" && key !== "watch") {
        el.hidden = true;
      } else {
        el.hidden = false;
        el.textContent = "0";
      }
    };

    setBadge("inquiry", inquiry);
    setBadge("report", report);
    setBadge("connect", connect);
    setBadge("builder-eval", builderEval);
    setBadge("anpi", anpi);
    setBadge("watch", watch);
  }

  function renderTasks(tasks) {
    const el = document.querySelector("[data-ops-dash-tasks]");
    if (!el) return;
    el.innerHTML = tasks
      .map(
        (t) =>
          `<li class="ops-dash-task-row" data-ops-dash-task>` +
          `<span>${esc(t.label)} <strong>${esc(t.count)}</strong> 件</span>` +
          `<a href="${esc(t.href)}">一覧へ</a>` +
          `</li>`
      )
      .join("");
  }

  function renderShortcuts() {
    const el = document.querySelector("[data-ops-dash-shortcuts]");
    if (!el) return;
    el.innerHTML = SHORTCUTS.map(
      (s) =>
        `<a class="ops-dash-shortcut" href="${esc(s.href)}" data-ops-dash-shortcut="${esc(s.testId)}">` +
        `<span><strong>${esc(s.label)}</strong><span>${esc(s.desc)}</span></span>` +
        `</a>`
    ).join("");
  }

  function renderLoadStatus(m) {
    const el = document.querySelector("[data-ops-dash-load-status]");
    if (!el) return;
    const row = (label, ok) =>
      `<span>${esc(label)}: <span class="${ok ? "ops-dash-status__ok" : "ops-dash-status__ng"}">${ok ? "読込OK" : "なし"}</span></span>`;

    const read = window.TasuSupabaseOpsRead?.getStatus?.() || {};
    const ds = read.dataSource || "local";
    const sbNote = read.primarySource
      ? `Primary source: ${ds}（tickets ${read.cached?.support_tickets ?? 0}, cases ${read.cached?.ai_ops_cases ?? 0}）`
      : read.enabled
        ? read.canQuery
          ? `read-through merge（tickets ${read.cached?.support_tickets ?? 0}）`
          : "read ON（fallback）"
        : "";

    el.innerHTML =
      row("Supportデータ", m.supportOk) +
      row("AI運営データ", m.aiOk) +
      row("Builder評価データ", m.builderOk) +
      (sbNote ? `<span>${esc(sbNote)}</span>` : "");
    window.TasuSupabaseOpsDataSourceUi?.renderBadge?.(el);
  }

  function updateTimestamp() {
    const el = document.querySelector("[data-ops-dash-updated]");
    if (!el) return;
    const now = new Date();
    el.dateTime = now.toISOString();
    el.textContent = `最終更新 ${now.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", hour12: false })}`;
  }

  function runMorningCheck() {
    const btn = document.querySelector("[data-ops-morning-check-start]");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "チェック中…";
      btn.classList.add("is-running");
    }

    window.TasuTalkOpsAssistant?.syncNotifications?.();

    window.setTimeout(() => {
      const state = refresh({ skipConclusion: true });
      const result = buildMorningCheckResult(state.metrics, state.hub);
      const priorityRows = buildPriorityRows(state.alerts, state.hub);
      renderDailyConclusion(result, priorityRows);
      renderConnectPanel(result.connectDraft);
      window.__opsMorningCheckDone = true;
      if (btn) {
        btn.disabled = false;
        btn.classList.remove("is-running");
        btn.textContent = "本日の運営チェックを再実行";
      }
      document.querySelector("[data-ops-daily-conclusion]")?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }, 650);
  }

  function severityLabelConnect(sev) {
    if (sev === "high" || sev === "critical") return { label: "高", cls: "high" };
    if (sev === "medium") return { label: "中", cls: "medium" };
    return { label: "低", cls: "low" };
  }

  function renderConnectModal(item) {
    const modal = document.querySelector("[data-ops-connect-modal]");
    const body = document.querySelector("[data-ops-connect-modal-body]");
    const stripeLink = document.querySelector("[data-ops-connect-stripe-link]");
    const toast = document.querySelector("[data-ops-connect-copy-toast]");
    if (!modal || !body || !item) return;

    activeConnectItemId = item.id;
    if (toast) toast.hidden = true;
    if (stripeLink) stripeLink.href = item.targetUrl || "https://dashboard.stripe.com/";

    const reqList = (item.requiredItems || [])
      .map((r) => `<li>${esc(r)}</li>`)
      .join("");

    body.innerHTML =
      `<dl class="ops-ai-connect-detail">` +
      `<div class="ops-ai-connect-detail__row"><dt>件名</dt><dd>${esc(item.subject)}</dd></div>` +
      `<div class="ops-ai-connect-detail__row"><dt>Stripe要求内容</dt><dd>${esc(item.body || item.summary)}</dd></div>` +
      `<div class="ops-ai-connect-detail__row"><dt>AI解析</dt><dd>${esc(item.aiAnalysis)}</dd></div>` +
      `<div class="ops-ai-connect-detail__row"><dt>不足項目</dt><dd><ul class="ops-ai-connect-missing__list">${reqList}</ul></dd></div>` +
      `</dl>` +
      `<div class="ops-ai-connect-detail__reply">` +
      `<p class="ops-ai-connect-detail__reply-label">AI生成回答文</p>` +
      `<pre class="ops-ai-connect-detail__pre" data-ops-connect-reply-text>${esc(item.suggestedReply || item.copyText)}</pre>` +
      `</div>`;

    modal.hidden = false;
  }

  function closeConnectModal() {
    const modal = document.querySelector("[data-ops-connect-modal]");
    if (modal) modal.hidden = true;
    activeConnectItemId = null;
  }

  function copyConnectReplyText(item, toastEl) {
    const text = item?.copyText || item?.suggestedReply || "";
    const toast =
      toastEl ||
      document.querySelector("[data-ops-connect-copy-toast]") ||
      document.querySelector("[data-ops-connect-panel-toast]");
    const showToast = (msg) => {
      if (!toast) return;
      toast.hidden = false;
      toast.textContent = msg;
    };

    if (navigator.clipboard?.writeText) {
      return navigator.clipboard.writeText(text).then(
        () => showToast("回答文をコピーしました"),
        () => showToast("コピーできませんでした。手動で選択してください。")
      );
    }

    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      showToast(
        ok ? "回答文をコピーしました" : "コピーできませんでした。手動で選択してください。"
      );
    } catch {
      showToast("コピーできませんでした。手動で選択してください。");
    }
    return Promise.resolve();
  }

  function getActiveConnectItem(draft) {
    const items = draft?.items || window.TasuAdminConnectAiSupport?.buildConnectActionItems?.() || [];
    if (activeConnectItemId) {
      return items.find((i) => i.id === activeConnectItemId) || items[0] || null;
    }
    return draft?.primary || items[0] || null;
  }

  function connectActionLinkLabel(url) {
    return String(url || "").includes("support-trouble-center") ? "Supportで確認" : "Stripeを開く";
  }

  function renderConnectStripeStatus(stripeStatus) {
    if (!stripeStatus || stripeStatus.connected) return "";
    return (
      `<p class="ops-ai-connect-status ops-ai-connect-status--disconnected">` +
      `<strong>${esc(stripeStatus.label)}</strong> — ${esc(stripeStatus.detail || "")}` +
      `</p>`
    );
  }

  function renderConnectPanel(draft) {
    const el = document.querySelector("[data-ops-connect-panel]");
    const badge = document.querySelector("[data-ops-connect-pending-badge]");
    if (!el) return;

    const stripeStatus =
      draft?.stripeStatus || window.TasuAdminConnectAiSupport?.getStripeEventStatus?.() || null;
    const statusHtml = renderConnectStripeStatus(stripeStatus);
    const pending = draft?.pendingCount ?? 0;
    if (badge) {
      if (pending > 0) {
        badge.hidden = false;
        badge.textContent = `${pending}件`;
      } else {
        badge.hidden = true;
      }
    }

    if (!draft?.active || !draft?.primary) {
      el.innerHTML =
        statusHtml +
        `<p class="ops-ai-connect-empty ops-ai-connect-empty--ok">Connect対応はありません — 問題なし</p>`;
      return;
    }

    const item = draft.primary;
    const sev = severityLabelConnect(item.severity);
    const reqList = (item.requiredItems || [])
      .map((r) => `<li>${esc(r)}</li>`)
      .join("");

    el.innerHTML =
      statusHtml +
      `<div class="ops-ai-connect-card" data-ops-connect-item-id="${esc(item.id)}">` +
      `<p class="ops-ai-connect-card__lead">Connect対応が必要です</p>` +
      `<dl class="ops-ai-connect-card__meta">` +
      `<div><dt>未対応</dt><dd><strong>${esc(pending)}</strong> 件</dd></div>` +
      `<div><dt>緊急度</dt><dd><span class="ops-ai-tag ops-ai-tag--${esc(sev.cls)}">${esc(sev.label)}</span></dd></div>` +
      `<div><dt>発生元</dt><dd>${esc(item.source)}</dd></div>` +
      `<div><dt>推定対応時間</dt><dd>${esc(item.estimatedMinutes)}分</dd></div>` +
      `</dl>` +
      `<div class="ops-ai-connect-card__section">` +
      `<p class="ops-ai-connect-card__label">内容</p>` +
      `<p class="ops-ai-connect-card__text">${esc(item.summary)}</p>` +
      `</div>` +
      `<div class="ops-ai-connect-card__section">` +
      `<p class="ops-ai-connect-card__label">要求</p>` +
      `<ul class="ops-ai-connect-missing__list">${reqList}</ul>` +
      `</div>` +
      `<div class="ops-ai-connect-card__section">` +
      `<p class="ops-ai-connect-card__label">AI解析</p>` +
      `<p class="ops-ai-connect-card__text">${esc(item.aiAnalysis)}</p>` +
      `</div>` +
      `<div class="ops-ai-connect-card__section">` +
      `<p class="ops-ai-connect-card__label">AI回答文</p>` +
      `<p class="ops-ai-connect-card__status">生成済み</p>` +
      `</div>` +
      `<div class="ops-ai-connect-card__section ops-ai-connect-card__section--next">` +
      `<p class="ops-ai-connect-card__label">次の操作</p>` +
      `<p class="ops-ai-connect-card__text">${esc(item.nextActionLabel)}</p>` +
      `</div>` +
      `<div class="ops-ai-connect-actions">` +
      `<button type="button" class="ops-ai-connect-btn ops-ai-connect-btn--primary" data-ops-connect-view-reply>回答文を見る</button>` +
      `<button type="button" class="ops-ai-connect-btn ops-ai-connect-btn--ghost" data-ops-connect-copy-inline>コピー</button>` +
      `<a class="ops-ai-connect-btn ops-ai-connect-btn--ghost" href="${esc(item.targetUrl)}" target="_blank" rel="noopener noreferrer">${esc(connectActionLinkLabel(item.targetUrl))}</a>` +
      `<button type="button" class="ops-ai-connect-btn ops-ai-connect-btn--ghost" data-ops-connect-mark-done-inline>対応済みにする</button>` +
      `</div>` +
      `<p class="ops-ai-connect-toast" data-ops-connect-panel-toast hidden aria-live="polite"></p>` +
      `</div>`;
  }

  function bindConnectUi() {
    const panel = document.querySelector("[data-ops-connect-panel]");
    panel?.addEventListener("click", (e) => {
      const draft = buildConnectDraft(buildMetrics(), null);
      const item = getActiveConnectItem(draft);
      if (!item) return;

      if (e.target.closest("[data-ops-connect-view-reply]")) {
        renderConnectModal(item);
        return;
      }
      if (e.target.closest("[data-ops-connect-copy-inline]")) {
        copyConnectReplyText(item, panel.querySelector("[data-ops-connect-panel-toast]"));
        return;
      }
      if (e.target.closest("[data-ops-connect-mark-done-inline]")) {
        window.TasuAdminConnectAiSupport?.markConnectItemResolved?.(item.id);
        refresh();
      }
    });

    document.querySelector("[data-ops-connect-modal]")?.addEventListener("click", (e) => {
      if (e.target.closest("[data-ops-connect-modal-close]")) {
        closeConnectModal();
        return;
      }
      const draft = buildConnectDraft(buildMetrics(), null);
      const item = getActiveConnectItem(draft);
      if (!item) return;

      if (e.target.closest("[data-ops-connect-copy]")) {
        copyConnectReplyText(item);
        return;
      }
      if (e.target.closest("[data-ops-connect-mark-done]")) {
        window.TasuAdminConnectAiSupport?.markConnectItemResolved?.(item.id);
        closeConnectModal();
        refresh();
      }
    });
  }

  function setActiveNav(navKey) {
    document.querySelectorAll(".ops-ai-nav__item").forEach((item) => {
      const key = item.getAttribute("data-ops-nav");
      item.classList.toggle("is-active", key === navKey);
    });
  }

  function openAncestorDetails(el) {
    let node = el?.parentElement;
    while (node) {
      if (node.tagName === "DETAILS") node.open = true;
      node = node.parentElement;
    }
  }

  function scrollToSection(id, hubSection) {
    const el = document.getElementById(id);
    if (!el) return;
    openAncestorDetails(el);
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    if (hubSection) {
      window.setTimeout(() => {
        document
          .querySelector(`[data-talk-ops-hub-section="${hubSection}"]`)
          ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 350);
    }
  }

  function bindNavScroll() {
    document.querySelectorAll("[data-ops-nav-scroll]").forEach((link) => {
      link.addEventListener("click", (e) => {
        const href = link.getAttribute("href") || "";
        const targetId =
          link.getAttribute("data-ops-nav-target") ||
          (href.startsWith("#") ? href.slice(1) : "");
        if (!targetId) return;
        e.preventDefault();
        const navKey = link.getAttribute("data-ops-nav") || "secretary";
        setActiveNav(navKey === "dashboard" ? "dashboard" : navKey);
        scrollToSection(targetId, link.getAttribute("data-ops-nav-section") || "");
        if (window.history?.replaceState) {
          window.history.replaceState(null, "", `#${targetId}`);
        }
      });
    });

    const hash = String(window.location.hash || "").replace(/^#/, "");
    if (
      hash === "ops-ai-top" ||
      hash === "ops-ai-command-center" ||
      hash === "ops-ai-morning-summary" ||
      hash === "ops-ai-focus" ||
      hash === "ops-priority-heading" ||
      hash === "ops-ai-secretary" ||
      hash === "ops-ai-hub" ||
      hash === "ops-ai-hub-fold" ||
      hash === "ops-ai-watch" ||
      hash === "ops-ai-kpi" ||
      hash === "ops-ai-autofix" ||
      hash === "ops-ai-hsg" ||
      hash === "ops-ai-quick" ||
      hash === "ops-ai-connect" ||
      hash === "connect" ||
      hash === "ops-ai-command" ||
      hash === "ops-ai-kpi-fold" ||
      hash === "ops-ai-category-fold" ||
      hash === "ops-ai-activity-fold"
    ) {
      window.setTimeout(() => {
        const secretaryHashes = new Set([
          "ops-ai-focus",
          "ops-priority-heading",
          "ops-ai-secretary",
          "ops-ai-hub",
          "ops-ai-hub-fold",
          "ops-ai-watch",
          "ops-ai-kpi",
          "ops-ai-autofix",
          "ops-ai-hsg",
        ]);
        setActiveNav(
          hash === "ops-ai-command-center" || hash === "ops-ai-command"
            ? "dashboard"
            : hash === "ops-ai-watch"
              ? "watch"
              : secretaryHashes.has(hash)
                ? "secretary"
                : "secretary"
        );
        const hubSection = new URLSearchParams(window.location.search).get("section") || "";
        const scrollId =
          hash === "connect"
            ? "ops-ai-connect"
            : hash === "ops-ai-hub"
              ? "ops-ai-secretary"
              : hash;
        scrollToSection(scrollId, hash === "ops-ai-hub" ? hubSection : "");
      }, 200);
    } else {
      const hubSection = new URLSearchParams(window.location.search).get("section");
      if (hubSection) {
        window.setTimeout(() => {
          setActiveNav("secretary");
          scrollToSection("ops-ai-secretary", hubSection);
        }, 200);
      }
    }
  }

  function bindNextActionCta() {
    document.querySelector("[data-ops-daily-conclusion]")?.addEventListener("click", (e) => {
      const el = e.target.closest("[data-ops-daily-next-cta]");
      if (!el) return;

      if (el.getAttribute("data-ops-next-action") === "morning_report") {
        e.preventDefault();
        runMorningCheck();
        return;
      }

      if (el.getAttribute("data-ops-next-scroll") === "1") {
        const href = el.getAttribute("href") || "";
        if (href.startsWith("#")) {
          e.preventDefault();
          scrollToSection(href.slice(1));
          if (window.history?.replaceState) {
            window.history.replaceState(null, "", href);
          }
        }
      }
    });
  }

  function bindUi() {
    document.querySelector("[data-ops-dash-refresh]")?.addEventListener("click", () => {
      refresh();
    });

    document.querySelector("[data-ops-morning-check-start]")?.addEventListener("click", () => {
      runMorningCheck();
    });
    document.querySelectorAll("[data-ops-morning-check-start-secondary]").forEach((btn) => {
      btn.addEventListener("click", () => runMorningCheck());
    });

    window.addEventListener("tasu:talk-ops-hub-rendered", () => {
      const metrics = buildMetrics();
      const alerts = buildAlerts(metrics);
      const hub = window.TasuTalkOpsAssistant?.buildHubSections?.();
      const priorityRows = buildPriorityRows(alerts, hub);
      renderPriorityTasks(priorityRows, alerts);
      renderSuggestions(metrics, hub, alerts, 2);
      renderActivity(metrics);
    });
  }

  function bindMorningSummaryNav() {
    window.TasuAdminMorningSummary?.bindNav?.({
      onNavigate(targetId) {
        setActiveNav(targetId === "ops-ai-watch" ? "watch" : "secretary");
      },
    });
  }

  function refresh(options) {
    const Ops = window.TasuTalkOpsAssistant;
    Ops?.syncNotifications?.();
    window.TasuAdminAiOutcomeLearning?.syncAll?.();

    const metrics = buildMetrics();
    const alerts = buildAlerts(metrics);
    const tasks = buildTasks(metrics);
    const hub = Ops?.buildHubSections?.() || null;
    const priorityRows = buildPriorityRows(alerts, hub);
    const checkResult = buildMorningCheckResult(metrics, hub);

    renderSummary(metrics);
    renderPriorityTasks(priorityRows, alerts);
    renderSuggestions(metrics, hub, alerts, 2);
    renderApiCost();
    renderCategoryStatus(metrics);
    renderActivity(metrics);
    renderNavBadges(metrics, hub);
    renderConnectPanel(checkResult.connectDraft);
    window.TasuAdminConnectAiSupport?.syncConnectTalkNotification?.();
    renderTasks(tasks);
    renderShortcuts();
    renderLoadStatus(metrics);
    updateTimestamp();

    if (!options?.skipConclusion) {
      renderDailyConclusion(
        { ...checkResult, connectDraft: checkResult.connectDraft },
        priorityRows
      );
    }

    window.TasuTalkOpsRoom?.refresh?.();
    window.TasuAdminAiResponsePlans?.renderPlansPanelSync?.() ||
      window.TasuAdminAiResponsePlans?.renderPlansPanel?.();
    window.TasuAdminAiAutomationEngine?.renderAutomationPanel?.();
    window.TasuAdminAiDailyInbox?.renderDailyInbox?.();
    window.TasuAdminMorningSummary?.render?.(metrics);
    window.TasuAdminAiSecretaryPhase2?.render?.({
      metrics,
      hub,
      checkResult,
      priorityRows,
      kpi: window.TasuAdminAiKpiCenter?.collectKpiMetrics?.(),
      opsWatch: window.TasuAdminAiOpsWatch?.buildOpsWatchSnapshot?.(),
    });
    window.TasuAdminAiSecretaryPhase3?.renderWorkHistory?.(
      window.TasuAdminAiSecretaryPhase3?.getWorkPeriod?.() || "day"
    );
    window.TasuAdminAiSecretaryPhase4?.renderWorkHistoryEnhanced?.();
    window.TasuAdminAiSecretaryPhase5?.renderWorkHistoryFull?.();
    window.TasuAdminAiSecretaryPhase6?.renderIntelligencePanel?.();
    window.TasuAdminAiSecretaryPhase7?.renderCommandCenterHome?.({
      metrics,
      hub,
      kpi: window.TasuAdminAiKpiCenter?.collectKpiMetrics?.(),
    });

    return { metrics, alerts, tasks, hub, checkResult, priorityRows };
  }

  function scheduleRefresh(options) {
    if (scheduleRefresh._timer) clearTimeout(scheduleRefresh._timer);
    scheduleRefresh._timer = setTimeout(() => {
      scheduleRefresh._timer = null;
      refresh(options);
    }, 50);
  }

  function init() {
    renderShortcuts();
    bindUi();
    bindConnectUi();
    bindNextActionCta();
    bindNavScroll();
    bindMorningSummaryNav();
    refresh();
    window.addEventListener("tasu:support-tickets-updated", scheduleRefresh);
    window.addEventListener("tasu:ai-ops-cases-changed", scheduleRefresh);
    window.addEventListener("tasu:builder-partner-eval-changed", scheduleRefresh);
    window.addEventListener("tasu:supabase-ops-read-hydrated", scheduleRefresh);
    window.addEventListener("tasu:admin-connect-resolved", scheduleRefresh);
    window.addEventListener("tasu:admin-ai-response-plan-updated", scheduleRefresh);
    window.addEventListener("tasu:admin-ai-response-activity-updated", scheduleRefresh);
    window.addEventListener("tasu:admin-ai-automation-updated", scheduleRefresh);
    window.addEventListener("tasu:admin-daily-inbox-updated", scheduleRefresh);
    window.addEventListener("tasu:ops-content-review-completed", scheduleRefresh);
    window.addEventListener("tasu:admin-ai-decision-learning-updated", scheduleRefresh);
    window.addEventListener("tasu:admin-ai-outcome-learning-updated", scheduleRefresh);
    window.addEventListener("tasful-talk-notifications-changed", scheduleRefresh);
    window.addEventListener("tasu-market-events-changed", scheduleRefresh);
  }

  window.TasuAdminOperationsDashboard = {
    buildMetrics,
    buildAlerts,
    buildTasks,
    buildMorningCheckResult,
    buildConnectActionItems: () => window.TasuAdminConnectAiSupport?.buildConnectActionItems?.() || [],
    resolveNextAction,
    runMorningCheck,
    refresh,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
