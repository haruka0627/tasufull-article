/**
 * AI 秘書 — OpsContextBuilder Phase 2（6 ドメイン正規化 · DeepSeek context）
 */
(function (global) {
  "use strict";

  const San = () => global.TasuSecretaryOpsContextSanitize;
  const SCHEMA_VERSION = "ops_context_v1";
  const INBOX_IDS_KEY = "tasu_secretary_inbox_ids_v1";
  const CHAR_BUDGET = 6000;
  const ITEM_LIMIT = 5;
  const PRIORITY_LIMIT = 5;

  const ALL_DOMAINS = ["support", "builder", "platform", "stripe_connect", "tlv", "ai_usage"];

  const DOMAIN_LABELS = {
    support: "Support",
    builder: "Builder",
    platform: "Platform",
    stripe_connect: "Stripe / Connect",
    tlv: "TLV",
    ai_usage: "AI利用状況",
  };

  const INBOX_SOURCE_DOMAIN = {
    support: "support",
    ai_ops: "support",
    anpi: "support",
    talk: "support",
    builder: "builder",
    market: "platform",
    content_gate: "platform",
    response_plan: "platform",
    automation: "platform",
    connect: "stripe_connect",
  };

  const HUB_SECTION_DOMAIN = {
    priority: "support",
    open_inquiry: "support",
    report: "support",
    anpi: "support",
    ops_watch: "support",
    builder: "builder",
    connect: "stripe_connect",
  };

  const CONTEXT_RULES =
    "回答ルール:\n" +
    "- 上記データに無い数値は推測しない\n" +
    "- 返金・BAN・掲載停止などの実行操作は提案せず画面確認を促す\n" +
    "- 詳細一覧は下部「運営コマンド」（例: 未対応だけ）も案内可\n" +
    "- 不足時は「データなし」と明言\n" +
    "Connect=本人確認・口座・出金 / Stripe=決済・返金・webhook";

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  }

  function yesterdayKey() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  }

  function startOfTodayMs() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  function ageLabelFrom(iso) {
    if (!iso) return "—";
    const t = new Date(iso).getTime();
    if (!Number.isFinite(t)) return "—";
    const days = Math.floor((startOfTodayMs() - new Date(iso).setHours(0, 0, 0, 0)) / 86400000);
    if (days <= 0) return "今日";
    if (days === 1) return "昨日";
    return `${days}日前`;
  }

  function mapInboxDomain(source) {
    return INBOX_SOURCE_DOMAIN[String(source || "").toLowerCase()] || "support";
  }

  function mapCategory(cat) {
    if (cat === "needs_judgment") return "needs_judgment";
    if (cat === "auto_done") return "auto_done";
    return "pending_approval";
  }

  function mapPriority(priority, category) {
    if (category === "needs_judgment" || priority === 0) return "critical";
    if (priority === 1) return "high";
    if (priority >= 3) return "low";
    return "normal";
  }

  function inboxToItem(raw, domain, partnerIdx) {
    const san = San();
    if (!san) return null;
    let title = san.sanitizeText(raw.title || raw.eventType || "案件", 80);
    if (domain === "builder" && raw.target) {
      title = `${san.maskPartnerName(raw.target, partnerIdx)} — ${title}`.slice(0, 80);
    }
    return {
      id: String(raw.id || `inbox_${domain}_${partnerIdx}`),
      domain,
      category: mapCategory(raw.category),
      priority: mapPriority(raw.priority, raw.category),
      title,
      reason: san.sanitizeText(raw.reason || raw.summary || "", 120),
      recommendedAction: san.sanitizeText(raw.recommendedAction || "管理画面で確認", 80),
      ageLabel: ageLabelFrom(raw.createdAt),
      countsToward: [],
    };
  }

  function hubItemToOpsItem(item, domain, idx) {
    const san = San();
    if (!san || !item) return null;
    const pri = /critical|high|urgent/i.test(String(item.priority || item.meta || "")) ? "high" : "normal";
    return {
      id: String(item.id || `hub_${domain}_${idx}`),
      domain,
      category: pri === "high" ? "needs_judgment" : "pending_approval",
      priority: pri === "high" ? "critical" : "normal",
      title: san.sanitizeText(item.title || item.headline || "案件", 80),
      reason: san.sanitizeText(item.meta || item.body || "", 120),
      recommendedAction: "管理画面で確認",
      ageLabel: "今日",
      countsToward: [],
    };
  }

  function readInboxIdSnapshot() {
    try {
      const raw = global.localStorage?.getItem(INBOX_IDS_KEY);
      const parsed = JSON.parse(raw || "{}");
      const out = {};
      ALL_DOMAINS.forEach((d) => {
        out[d] = new Set(Array.isArray(parsed[d]) ? parsed[d] : []);
      });
      return out;
    } catch {
      const out = {};
      ALL_DOMAINS.forEach((d) => {
        out[d] = new Set();
      });
      return out;
    }
  }

  function writeInboxIdSnapshot(byDomain) {
    try {
      const payload = {};
      ALL_DOMAINS.forEach((d) => {
        payload[d] = [...(byDomain[d] || new Set())];
      });
      global.localStorage?.setItem(INBOX_IDS_KEY, JSON.stringify(payload));
    } catch {
      /* ignore */
    }
  }

  function getPreviousKpiSummary() {
    const key = global.TasuAdminAiKpiCenter?.KPI_SNAPSHOT_KEY;
    if (!key) return null;
    try {
      const raw = global.localStorage?.getItem(key);
      const snaps = JSON.parse(raw || "{}");
      return snaps[yesterdayKey()]?.summary || null;
    } catch {
      return null;
    }
  }

  function positiveKpiDeltas(kpi, previous) {
    const KC = global.TasuAdminAiKpiCenter;
    if (!KC?.compareKpiWithPrevious) return {};
    const all = KC.compareKpiWithPrevious(kpi || {}, previous || {});
    const out = {};
    Object.keys(all || {}).forEach((k) => {
      const v = Number(all[k]);
      if (Number.isFinite(v) && v > 0) out[k] = v;
    });
    return out;
  }

  function collectInboxByDomain() {
    const inbox = global.TasuAdminAiDailyInbox?.buildInboxItems?.() || [];
    const byDomain = {};
    ALL_DOMAINS.forEach((d) => {
      byDomain[d] = [];
    });
    let builderIdx = 0;
    inbox.forEach((raw) => {
      const domain = mapInboxDomain(raw.source);
      const item = inboxToItem(raw, domain, builderIdx);
      if (!item) return;
      if (domain === "builder") builderIdx += 1;
      byDomain[domain].push(item);
    });
    return { inbox, byDomain };
  }

  function supplementFromHub(byDomain, hub) {
    if (!hub?.sections) return;
    hub.sections.forEach((sec) => {
      const domain = HUB_SECTION_DOMAIN[sec.id];
      if (!domain || !sec.items?.length) return;
      sec.items.slice(0, ITEM_LIMIT).forEach((it, i) => {
        const mapped = hubItemToOpsItem(it, domain, i);
        if (!mapped) return;
        if (!byDomain[domain].some((x) => x.id === mapped.id)) {
          byDomain[domain].push(mapped);
        }
      });
    });
  }

  function sortItems(items) {
    const catOrder = { needs_judgment: 0, pending_approval: 1, auto_done: 2, info: 3 };
    const priOrder = { critical: 0, high: 1, normal: 2, low: 3 };
    return [...items].sort(
      (a, b) =>
        (catOrder[a.category] ?? 9) - (catOrder[b.category] ?? 9) ||
        (priOrder[a.priority] ?? 9) - (priOrder[b.priority] ?? 9) ||
        String(b.ageLabel || "").localeCompare(String(a.ageLabel || ""))
    );
  }

  function applyDiffFilter(byDomain, prevIds, diffOnly) {
    const newCounts = {};
    ALL_DOMAINS.forEach((d) => {
      newCounts[d] = 0;
    });
    if (!diffOnly) return { byDomain, newCounts };

    const filtered = {};
    ALL_DOMAINS.forEach((d) => {
      const prev = prevIds[d] || new Set();
      filtered[d] = (byDomain[d] || []).filter((it) => {
        const isNew = !prev.has(it.id);
        if (isNew) newCounts[d] += 1;
        return isNew;
      });
    });
    return { byDomain: filtered, newCounts };
  }

  function domainStatus(items, metrics) {
    if ((metrics?.anpiEmergency || 0) > 0 && items.some((i) => i.priority === "critical")) return "critical";
    const critical = items.filter((i) => i.priority === "critical" || i.category === "needs_judgment").length;
    if (critical > 0) return "critical";
    if (items.length > 0) return "watch";
    return "ok";
  }

  function buildDomainMetrics(domain, kpi, snapMetrics) {
    const k = kpi || {};
    const m = snapMetrics || {};
    switch (domain) {
      case "support":
        return {
          inquiries: Number(k.inquiries) || 0,
          unresolved: Number(k.unresolved) || 0,
          reports: Number(k.reports) || 0,
          highRisk: Number(k.highRisk) || 0,
          anpiEmergency: Number(k.anpiEmergency) || 0,
        };
      case "builder":
        return {
          builderPending: Number(k.builderPending) || 0,
          builderRejections: Number(k.builderRejections) || 0,
          hiddenPartners: Number(m.hiddenPartnerCount) || 0,
        };
      case "platform":
        return {
          marketOrderCreated: Number(k.marketOrderCreated) || 0,
          marketRefundRequested: Number(k.marketRefundRequested) || 0,
          pendingReview: Number(m.pendingReviewCount) || 0,
        };
      case "stripe_connect":
        return {
          connectPending: Number(m.connectCount || m.connectAiPending) || Number(k.connectApplications) || 0,
          connectFailures: Number(k.connectFailures) || 0,
          paymentCountToday: Number(k.paymentCount) || 0,
          refundRequestedToday: Number(k.marketRefundRequested) || 0,
        };
      case "tlv":
        return { tlvOpsConnected: 0 };
      case "ai_usage":
        return collectAiUsageMetrics();
      default:
        return {};
    }
  }

  function collectAiUsageMetrics() {
    const logs = global.TasuAiInteractionLog?.readLogs?.() || [];
    const weekAgo = Date.now() - 7 * 86400000;
    const todayStart = startOfTodayMs();
    let todayCount = 0;
    let weekCount = 0;
    let fallbackN = 0;
    let searchN = 0;
    const bySurface = {};
    const byProvider = {};
    logs.forEach((row) => {
      const t = new Date(row.created_at || 0).getTime();
      if (!Number.isFinite(t)) return;
      if (t >= weekAgo) weekCount += 1;
      if (t >= todayStart) todayCount += 1;
      if (row.fallback_used) fallbackN += 1;
      if (row.search_used) searchN += 1;
      const surf = String(row.surface || row.mode_id || "unknown").slice(0, 32);
      bySurface[surf] = (bySurface[surf] || 0) + 1;
      const prov = String(row.ai_provider || row.selected_provider || "unknown").slice(0, 32);
      byProvider[prov] = (byProvider[prov] || 0) + 1;
    });
    return {
      todayCount,
      weekCount,
      fallbackRate: weekCount ? Math.round((fallbackN / weekCount) * 100) : 0,
      searchUsedRate: weekCount ? Math.round((searchN / weekCount) * 100) : 0,
      secretaryWeekCount: bySurface.ops_secretary || 0,
      bySurfaceCount: Object.keys(bySurface).length,
      byProviderCount: Object.keys(byProvider).length,
    };
  }

  function summaryLineForDomain(domain, items, metrics, kpiDelta) {
    const label = DOMAIN_LABELS[domain] || domain;
    if (domain === "tlv") {
      return "TLV 運営データは OPS 秘書に未接続です。live/admin-* で直接確認してください。";
    }
    if (domain === "ai_usage") {
      const m = metrics || {};
      return `直近7日 AI 呼び出し ${m.weekCount || 0} 回（秘書 ${m.secretaryWeekCount || 0}）。フォールバック ${m.fallbackRate || 0}%。`;
    }
    const needs = items.filter((i) => i.category === "needs_judgment").length;
    const pending = items.filter((i) => i.category === "pending_approval").length;
    let deltaLabel = "";
    const keys = Object.keys(kpiDelta || {}).filter((k) => {
      if (domain === "support") return /inquir|unresolved|report|highRisk|anpi/.test(k);
      if (domain === "builder") return /builder/.test(k);
      if (domain === "platform") return /market|pending/.test(k);
      if (domain === "stripe_connect") return /connect|payment|refund/.test(k);
      return false;
    });
    if (keys.length) {
      deltaLabel = keys.map((k) => `${k}+${kpiDelta[k]}`).join(", ");
    }
    return `${label}: 要判断 ${needs} · 承認待ち ${pending}${deltaLabel ? ` · 前日比 ${deltaLabel}` : ""}`;
  }

  function buildPriorities(byDomain, hub, snap) {
    const rows = snap?.priorityRows || [];
    const out = [];
    rows.slice(0, PRIORITY_LIMIT).forEach((row, i) => {
      const san = San();
      out.push({
        rank: i + 1,
        domain: "support",
        title: san?.sanitizeText(row.title || row.label || "優先項目", 80) || "優先項目",
        priority: /critical|high|緊急|通報/.test(String(row.title || row.importance || "")) ? "critical" : "high",
      });
    });
    if (out.length >= PRIORITY_LIMIT) return out;
    const priSec = hub?.sections?.find((s) => s.id === "priority");
    (priSec?.items || []).forEach((it) => {
      if (out.length >= PRIORITY_LIMIT) return;
      const san = San();
      out.push({
        rank: out.length + 1,
        domain: "support",
        title: san?.sanitizeText(it.title || it.headline || "優先", 80) || "優先",
        priority: "high",
      });
    });
    if (out.length >= PRIORITY_LIMIT) return out;
    ALL_DOMAINS.forEach((d) => {
      if (out.length >= PRIORITY_LIMIT) return;
      const top = (byDomain[d] || [])[0];
      if (!top) return;
      out.push({
        rank: out.length + 1,
        domain: d,
        title: top.title,
        priority: top.priority,
      });
    });
    return out.slice(0, PRIORITY_LIMIT);
  }

  function buildGlobalHeadline(kpi, priorities) {
    const parts = [];
    if (Number(kpi?.unresolved) > 0) parts.push(`未対応 ${kpi.unresolved}`);
    if (Number(kpi?.highRisk) > 0) parts.push(`高リスク ${kpi.highRisk}`);
    if (Number(kpi?.connectFailures) > 0) parts.push(`Connect失敗 ${kpi.connectFailures}`);
    if (Number(kpi?.builderPending) > 0) parts.push(`Builder承認待ち ${kpi.builderPending}`);
    if (!parts.length && priorities[0]) parts.push(`優先: ${priorities[0].title}`);
    return parts.slice(0, 4).join(" · ") || "特筆すべき滞留なし";
  }

  function collectTlvDomain() {
    return {
      id: "tlv",
      label: DOMAIN_LABELS.tlv,
      status: "unknown",
      metrics: { tlvOpsConnected: 0 },
      topItems: [],
      summaryLine: summaryLineForDomain("tlv", [], {}, {}),
      dataQuality: "stub",
    };
  }

  function collectAiUsageDomain() {
    const metrics = collectAiUsageMetrics();
    return {
      id: "ai_usage",
      label: DOMAIN_LABELS.ai_usage,
      status: "ok",
      metrics,
      topItems: [],
      summaryLine: summaryLineForDomain("ai_usage", [], metrics, {}),
      dataQuality: "live",
    };
  }

  function resolveIntent(userText) {
    const t = String(userText || "").trim();
    if (/Builderだけ|Builderのみ|Builderに絞/i.test(t)) return { filters: { domains: ["builder"] } };
    if (/Platformだけ|Platformのみ|市場だけ/i.test(t)) return { filters: { domains: ["platform"] } };
    if (/Connect|Stripe/i.test(t)) return { filters: { domains: ["stripe_connect"] } };
    if (/Support|問い合わせ|通報/i.test(t)) return { filters: { domains: ["support"] } };
    if (/TLV/i.test(t)) return { filters: { domains: ["tlv"] } };
    if (/AI利用|API利用状況/i.test(t)) return { filters: { domains: ["ai_usage"] } };
    if (/昨日から増えた|前日比|差分/.test(t)) return { filters: { diffOnly: true } };
    if (/今日は何を優先|本日の優先|優先対応/.test(t)) return { filters: { prioritize: true } };
    return { filters: {} };
  }

  function build(options) {
    options = options || {};
    const filters = options.filters || {};
    const snap = options.snapshot || {};
    const hub = snap.hub || global.TasuTalkOpsAssistant?.buildHubSections?.() || null;
    const kpi = snap.kpi || global.TasuAdminAiKpiCenter?.collectKpiMetrics?.() || {};
    const snapMetrics = snap.metrics || {};
    const prevKpi = getPreviousKpiSummary();
    const kpiDelta = positiveKpiDeltas(kpi, prevKpi);

    const { byDomain: rawByDomain } = collectInboxByDomain();
    supplementFromHub(rawByDomain, hub);

    ALL_DOMAINS.forEach((d) => {
      if (d !== "tlv" && d !== "ai_usage") rawByDomain[d] = sortItems(rawByDomain[d] || []).slice(0, ITEM_LIMIT);
    });

    const prevIds = readInboxIdSnapshot();
    const { byDomain: diffDomain, newCounts } = applyDiffFilter(rawByDomain, prevIds, filters.diffOnly);

    const currentIds = {};
    ALL_DOMAINS.forEach((d) => {
      currentIds[d] = new Set((rawByDomain[d] || []).map((it) => it.id));
    });
    writeInboxIdSnapshot(currentIds);

    const activeDomains =
      Array.isArray(filters.domains) && filters.domains.length
        ? filters.domains.filter((d) => ALL_DOMAINS.includes(d))
        : ALL_DOMAINS;

    const domains = {};
    activeDomains.forEach((d) => {
      if (d === "tlv") {
        domains.tlv = collectTlvDomain();
        return;
      }
      if (d === "ai_usage") {
        domains.ai_usage = collectAiUsageDomain();
        return;
      }
      const items = diffDomain[d] || [];
      const metrics = buildDomainMetrics(d, kpi, snapMetrics);
      domains[d] = {
        id: d,
        label: DOMAIN_LABELS[d],
        status: domainStatus(items, metrics),
        metrics,
        deltas: filters.diffOnly ? undefined : kpiDelta,
        topItems: items.slice(0, ITEM_LIMIT),
        summaryLine:
          filters.diffOnly && !items.length
            ? `前日比で増加した ${DOMAIN_LABELS[d]} 案件は検知されていません`
            : summaryLineForDomain(d, items, metrics, kpiDelta),
        dataQuality: "live",
      };
    });

    const priorities = buildPriorities(rawByDomain, hub, snap);
    const san = San();
    const hubSummaryText = san?.sanitizeText(String(hub?.summaryText || "").slice(0, 300), 300) || "";

    const ctx = {
      schemaVersion: SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      timezone: "Asia/Tokyo",
      filtersApplied: {
        domains: filters.domains || null,
        diffOnly: Boolean(filters.diffOnly),
        prioritize: Boolean(filters.prioritize),
      },
      globalSummary: {
        headline: buildGlobalHeadline(kpi, priorities),
        priorityQuestionHint: "support > stripe_connect > builder > platform の順で確認推奨",
        hubSummaryText,
      },
      priorities,
      kpiSummary: {
        inquiries: Number(kpi.inquiries) || 0,
        unresolved: Number(kpi.unresolved) || 0,
        reports: Number(kpi.reports) || 0,
        connectFailures: Number(kpi.connectFailures) || 0,
        builderPending: Number(kpi.builderPending) || 0,
      },
      deltas: {
        kpi: kpiDelta,
        inboxNewSinceYesterday: newCounts,
      },
      domains,
      meta: {
        sourceModules: [
          "TasuTalkOpsAssistant.buildHubSections",
          "TasuAdminAiDailyInbox.buildInboxItems",
          "TasuAdminAiKpiCenter.collectKpiMetrics",
        ],
        truncated: false,
        approxChars: 0,
        itemLimits: { perDomain: ITEM_LIMIT, priorities: PRIORITY_LIMIT },
      },
    };

    ctx.meta.approxChars = formatForSystemPrompt(ctx).length;
    return applyCharBudget(ctx);
  }

  function formatDomainBlock(d) {
    const lines = [
      `### ${d.label}`,
      `status: ${d.status}`,
      `summary: ${d.summaryLine}`,
    ];
    if (d.dataQuality === "stub") lines.push("dataQuality: stub");
    const metricPairs = Object.entries(d.metrics || {})
      .slice(0, 8)
      .map(([k, v]) => `${k}=${v}`);
    if (metricPairs.length) lines.push(`metrics: ${metricPairs.join(", ")}`);
    (d.topItems || []).forEach((it, i) => {
      lines.push(
        `${i + 1}. [${it.priority}] ${it.title} — ${it.reason.slice(0, 60)} (${it.ageLabel})`
      );
    });
    return lines.join("\n");
  }

  function formatForSystemPrompt(ctx) {
    if (!ctx) return "";
    const fa = ctx.filtersApplied || {};
    const filterLine = fa.domains?.length
      ? `domains=${fa.domains.join(",")}`
      : fa.diffOnly
        ? "diffOnly=true"
        : "all";
    const lines = [
      "## 運営コンテキスト（参照専用 · 実行不可）",
      `- schema: ${ctx.schemaVersion}`,
      `- 生成: ${ctx.generatedAt}`,
      `- フィルタ: ${filterLine}`,
      "",
      "### 全体",
      ctx.globalSummary?.headline || "",
      ctx.globalSummary?.hubSummaryText || "",
      "",
    ];
    if (ctx.priorities?.length) {
      lines.push("### 優先候補");
      ctx.priorities.forEach((p) => {
        lines.push(`${p.rank}. [${p.domain}/${p.priority}] ${p.title}`);
      });
      lines.push("");
    }
    if (ctx.kpiSummary) {
      const k = ctx.kpiSummary;
      lines.push(
        "### KPI",
        `問い合わせ今日 ${k.inquiries} · 未対応 ${k.unresolved} · 通報 ${k.reports} · Connect失敗 ${k.connectFailures} · Builder待ち ${k.builderPending}`,
        ""
      );
    }
    Object.keys(ctx.domains || {}).forEach((key) => {
      lines.push(formatDomainBlock(ctx.domains[key]));
      lines.push("");
    });
    lines.push(CONTEXT_RULES);
    return lines.join("\n").trim();
  }

  function applyCharBudget(ctx) {
    let text = formatForSystemPrompt(ctx);
    if (text.length <= CHAR_BUDGET) {
      ctx.meta.approxChars = text.length;
      return ctx;
    }
    ctx.meta.truncated = true;
    const hub = ctx.globalSummary?.hubSummaryText || "";
    if (hub.length > 120) {
      ctx.globalSummary.hubSummaryText = hub.slice(0, 120) + "…";
    }
    text = formatForSystemPrompt(ctx);
    if (text.length <= CHAR_BUDGET) {
      ctx.meta.approxChars = text.length;
      return ctx;
    }
    Object.keys(ctx.domains || {}).forEach((k) => {
      if (k === "ai_usage" || k === "tlv") return;
      const d = ctx.domains[k];
      if (d.topItems?.length > 3) d.topItems = d.topItems.slice(0, 3);
    });
    text = formatForSystemPrompt(ctx);
    if (text.length <= CHAR_BUDGET) {
      ctx.meta.approxChars = text.length;
      return ctx;
    }
    Object.keys(ctx.domains || {}).forEach((k) => {
      const d = ctx.domains[k];
      if (d.topItems?.length > 1) d.topItems = d.topItems.slice(0, 1);
    });
    ctx.meta.approxChars = formatForSystemPrompt(ctx).length;
    return ctx;
  }

  function sanitizeItem(raw) {
    return inboxToItem(raw, mapInboxDomain(raw?.source), 0);
  }

  global.TasuSecretaryOpsContextBuilder = {
    SCHEMA_VERSION,
    INBOX_IDS_KEY,
    CHAR_BUDGET,
    ALL_DOMAINS,
    resolveIntent,
    build,
    sanitizeItem,
    formatForSystemPrompt,
    mapInboxDomain,
  };
})(typeof window !== "undefined" ? window : globalThis);
