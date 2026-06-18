/**
 * AI運営秘書 Phase10 — KPI Center
 * 日次の運営数字ボード（集計・可視化のみ。自動修正は行わない）。
 */
(function (global) {
  "use strict";

  const KPI_SNAPSHOT_KEY = "tasu_ai_kpi_center_snapshots_v1";
  const SHOP_ORDERS_KEY = "tasu_shop_orders";
  const INGEST_LOG_KEY = "tasu_stripe_event_ingest_logs_v1";

  const STATUS_RANK = { critical: 0, warning: 1, normal: 2, good: 3 };

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

  function todayKey(d) {
    return global.TasuAdminAiOpsWatch?.todayKey?.(d) || (d || new Date()).toISOString().slice(0, 10);
  }

  function yesterdayKey() {
    return global.TasuAdminAiOpsWatch?.yesterdayKey?.() || (() => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return todayKey(d);
    })();
  }

  function deltaRate(current, previous) {
    if (global.TasuAdminAiOpsWatch?.deltaRate) {
      return global.TasuAdminAiOpsWatch.deltaRate(current, previous);
    }
    const cur = Number(current) || 0;
    const prev = Number(previous) || 0;
    if (prev <= 0) return cur > 0 ? 1 : 0;
    return (cur - prev) / prev;
  }

  function clearForTests() {
    writeJson(KPI_SNAPSHOT_KEY, {});
  }

  function isToday(iso) {
    return String(iso || "").slice(0, 10) === todayKey();
  }

  function collectRevenueMetrics() {
    const breakdown = global.TasuAdminAiOpsWatch?.collectRevenueBreakdown?.() || null;
    if (breakdown) {
      const paymentCount =
        (breakdown.marketCount || 0) + (breakdown.connectCount || 0) + (breakdown.builderCount || 0);
      return {
        revenue: breakdown.totalRevenue || 0,
        paymentCount,
        averageOrderValue: paymentCount > 0 ? Math.round((breakdown.totalRevenue || 0) / paymentCount) : 0,
        marketRevenue: breakdown.marketRevenue || 0,
        connectRevenue: breakdown.connectRevenue || 0,
        builderRevenue: breakdown.builderRevenue || 0,
        totalRevenue: breakdown.totalRevenue || 0,
        refundAmount: breakdown.refundAmount || 0,
        cancelCount: breakdown.cancelCount || 0,
        marketCount: breakdown.marketCount || 0,
        connectCount: breakdown.connectCount || 0,
        builderCount: breakdown.builderCount || 0,
      };
    }

    const today = todayKey();
    let revenue = 0;
    let paymentCount = 0;
    const seen = new Set();

    const orders = readJson(SHOP_ORDERS_KEY, []);
    (Array.isArray(orders) ? orders : []).forEach((o) => {
      const at = String(o.created_at || o.paid_at || o.updated_at || "").slice(0, 10);
      if (at !== today) return;
      const id = String(o.id || o.order_id || `${at}_${paymentCount}`);
      if (seen.has(id)) return;
      const amt = Number(o.amount_total || o.total_amount_jpy || o.amount || 0);
      if (amt <= 0) return;
      seen.add(id);
      revenue += amt;
      paymentCount += 1;
    });

    const ingestLogs = readJson(INGEST_LOG_KEY, []);
    const successEvents = new Set([
      "checkout.session.completed",
      "checkout.session.async_payment_succeeded",
      "payment_intent.succeeded",
      "charge.succeeded",
    ]);
    (Array.isArray(ingestLogs) ? ingestLogs : []).forEach((log) => {
      const at = String(log.created_at || "").slice(0, 10);
      if (at !== today) return;
      if (!successEvents.has(String(log.event_type || ""))) return;
      const id = String(log.id || log.ticket_id || "");
      if (!id || seen.has(`stripe_${id}`)) return;
      const ticket = global.TasuSupportTicketStore?.listTickets?.()?.find(
        (t) => String(t.id) === String(log.ticket_id)
      );
      const meta = ticket?.stripe_connect_meta || {};
      const objAmt = Number(meta.amount || meta.object_amount || 0);
      const amt = objAmt > 0 ? objAmt : 0;
      if (amt <= 0) return;
      seen.add(`stripe_${id}`);
      revenue += amt;
      paymentCount += 1;
    });

    const marketEvents = global.TasuMarketEventStore?.listMarketEvents?.() || [];
    marketEvents.forEach((e) => {
      if (e.event_type !== "payment_completed") return;
      const at = String(e.created_at || "").slice(0, 10);
      if (at !== today) return;
      if (e.channel === "shop_stripe") return;
      const id = String(e.order_id || "");
      if (!id || seen.has(`market_${id}`)) return;
      const amt = Number(e.amount) || 0;
      if (amt <= 0) return;
      seen.add(`market_${id}`);
      revenue += amt;
      paymentCount += 1;
    });

    return {
      revenue,
      paymentCount,
      averageOrderValue: paymentCount > 0 ? Math.round(revenue / paymentCount) : 0,
      marketRevenue: 0,
      connectRevenue: 0,
      builderRevenue: 0,
      totalRevenue: revenue,
      refundAmount: 0,
      cancelCount: 0,
      marketCount: 0,
      connectCount: 0,
      builderCount: 0,
    };
  }

  function collectKpiMetrics() {
    const base = global.TasuAdminAiOpsWatch?.collectCurrentMetrics?.() || {};
    const today = todayKey();
    const store = global.TasuSupportTicketStore;
    const tickets = store?.listTickets?.() || [];
    const connectIssues = store?.listConnectIssues?.() || [];
    const outcomes = global.TasuAdminAiOutcomeLearning?.readOutcomes?.() || [];
    const autoActivity = global.TasuAdminAiAutomationEngine?.readActivity?.() || readJson("tasu_ai_automation_activity_v1", []);

    const inquiriesToday = tickets.filter((t) => isToday(t.created_at)).length;
    const reports = global.TasuAdminAiOpsWatch?.collectComplaintReports?.({ todayOnly: true }) ?? 0;

    const connectApplications = connectIssues.filter((i) => isToday(i.created_at)).length;
    const connectFailures =
      (base.connect?.identityFail || 0) +
      (base.connect?.gateNg || 0) +
      (base.connect?.payoutErrors || 0);

    const autoToday = (Array.isArray(autoActivity) ? autoActivity : []).filter((a) =>
      isToday(a.at)
    ).length;
    const autoOutcomes = outcomes.filter(
      (o) => o.actionType === "auto_executed" || o.sourceType === "automation"
    ).length;
    const handled = outcomes.filter((o) => o.outcome && o.outcome !== "unknown").length || 1;
    const automationRate = Math.min(1, (autoToday + autoOutcomes) / Math.max(handled, autoToday + 1, 1));

    const revenueMetrics = collectRevenueMetrics();

    const automationCandidates =
      global.TasuAdminAiAutomationEngine?.buildAutomationCandidates?.() || [];
    const pendingAutoCandidates = automationCandidates.filter(
      (c) => c.autoCandidate && !c.autoExecutable
    ).length;

    return {
      inquiries: inquiriesToday,
      unresolved: base.support?.open || 0,
      resolutionRate: base.outcome?.resolvedRate || 0,
      automationRate,
      reopenedRate: base.outcome?.reopenedRate || 0,
      reports,
      highRisk: base.support?.highRisk || 0,
      connectApplications: connectApplications || base.connect?.pending || 0,
      connectFailures,
      anpiEmergency: base.anpi?.emergency || 0,
      anpiConfirmed: base.anpi?.confirmed || 0,
      builderPending: base.builder?.pendingReview || 0,
      builderRejections: base.builder?.rejection || 0,
      complaint: reports,
      escalated: base.outcome?.escalated || 0,
      pendingAutoCandidates,
      revenue: revenueMetrics.totalRevenue || revenueMetrics.revenue,
      paymentCount: revenueMetrics.paymentCount,
      averageOrderValue: revenueMetrics.averageOrderValue,
      marketRevenue: revenueMetrics.marketRevenue || 0,
      connectRevenue: revenueMetrics.connectRevenue || 0,
      builderRevenue: revenueMetrics.builderRevenue || 0,
      totalRevenue: revenueMetrics.totalRevenue || revenueMetrics.revenue || 0,
      refundAmount: revenueMetrics.refundAmount || 0,
      cancelCount: revenueMetrics.cancelCount || base.market?.cancelled || 0,
      connectFeeCount: revenueMetrics.connectCount || 0,
      builderFeeCount: revenueMetrics.builderCount || 0,
      marketOrderCreated: base.market?.orderCreated || 0,
      marketCancelled: base.market?.cancelled || 0,
      marketRefundRequested: base.market?.refundRequested || 0,
      marketRefundCompleted: base.market?.refundCompleted || 0,
      _base: base,
    };
  }

  function readKpiSnapshots() {
    const raw = readJson(KPI_SNAPSHOT_KEY, {});
    return raw && typeof raw === "object" ? raw : {};
  }

  function saveKpiSnapshot(summary) {
    const snaps = readKpiSnapshots();
    snaps[todayKey()] = { at: new Date().toISOString(), summary };
    const keys = Object.keys(snaps).sort().slice(-14);
    const trimmed = {};
    keys.forEach((k) => {
      trimmed[k] = snaps[k];
    });
    writeJson(KPI_SNAPSHOT_KEY, trimmed);
  }

  function getPreviousKpiSummary() {
    return readKpiSnapshots()[yesterdayKey()]?.summary || null;
  }

  function compareKpiWithPrevious(current, previous) {
    const prev = previous || {};
    const keys = [
      "inquiries",
      "unresolved",
      "resolutionRate",
      "automationRate",
      "reopenedRate",
      "reports",
      "connectApplications",
      "connectFailures",
      "revenue",
      "paymentCount",
      "anpiEmergency",
      "anpiConfirmed",
      "connectRevenue",
      "builderRevenue",
      "totalRevenue",
      "marketRevenue",
      "connectRevenue",
      "builderRevenue",
      "refundAmount",
      "cancelCount",
      "builderPending",
      "highRisk",
    ];
    const deltas = {};
    keys.forEach((key) => {
      const cur = current[key];
      const prv = prev[key];
      if (key.endsWith("Rate")) {
        deltas[key] =
          typeof cur === "number" && typeof prv === "number" ? cur - prv : deltaRate(cur, prv);
      } else {
        deltas[key] = deltaRate(cur, prv);
      }
    });
    return deltas;
  }

  function getOpsWatchStatusMap() {
    const OW = global.TasuAdminAiOpsWatch;
    if (!OW?.detectOpsAnomalies) return {};
    const metrics = OW.collectCurrentMetrics?.() || {};
    const previous = OW.getPreviousMetrics?.() || null;
    const anomalies = OW.rankOpsAnomalies?.(OW.detectOpsAnomalies(metrics, previous)) || [];
    const map = {};
    const metricByAnomaly = {
      "support.open": "unresolved",
      "support.complaint": "reports",
      "support.highRisk": "highRisk",
      "support.reopened": "reopenedRate",
      "connect.identityFail": "connectFailures",
      "connect.gateNg": "connectFailures",
      "connect.payoutErrors": "connectFailures",
      "outcome.reopenedRate": "reopenedRate",
      "outcome.resolvedRate": "resolutionRate",
      "outcome.complaint": "reports",
      "anpi.emergency": "anpiEmergency",
      "anpi.confirmed": "anpiConfirmed",
      "builder.pendingReview": "builderPending",
      "automation.postReopened": "reopenedRate",
    };
    (anomalies || []).forEach((a) => {
      const key = metricByAnomaly[a.metric] || null;
      if (!key) return;
      const sev = a.severity === "critical" ? "critical" : a.severity === "warning" ? "warning" : "normal";
      if (!map[key] || STATUS_RANK[sev] < STATUS_RANK[map[key]]) map[key] = sev;
    });
    return map;
  }

  function resolveMetricStatus(key, value, delta, opsMap) {
    if (opsMap[key]) return opsMap[key];

    const TH = global.TasuAdminAiOpsWatch?.THRESHOLDS || {};
    const n = Number(value) || 0;
    const d = Number(delta) || 0;

    switch (key) {
      case "unresolved":
        if (n >= 10) return "warning";
        return "normal";
      case "highRisk":
        if (n >= 1) return "critical";
        return "normal";
      case "anpiEmergency":
        if (n >= 1) return "critical";
        return "normal";
      case "anpiConfirmed":
        if (n >= 1) return "good";
        return "normal";
      case "reopenedRate":
        if (n >= (TH.reopenedRateWarning || 0.15)) return "warning";
        if (d < 0) return "good";
        return "normal";
      case "resolutionRate":
        if (n < (TH.resolvedRateWarning || 0.7) && n > 0) return "warning";
        if (d > 0) return "good";
        return n >= (TH.resolvedRateWarning || 0.7) ? "good" : "normal";
      case "automationRate":
        if (d > 0) return "good";
        return "normal";
      case "connectFailures":
        if (n >= (TH.connectIdentityWarning || 3)) return "warning";
        return "normal";
      case "reports":
        if (n >= 1) return "warning";
        return "normal";
      case "revenue":
        if (d <= -0.5) return "warning";
        if (d > 0) return "good";
        return "normal";
      case "inquiries":
      case "connectApplications":
      case "builderPending":
      case "builderRejections":
      case "paymentCount":
      case "averageOrderValue":
        return "normal";
      default:
        return "normal";
    }
  }

  function formatMetricValue(key, value) {
    if (key.endsWith("Rate")) {
      return `${Math.round((Number(value) || 0) * 100)}`;
    }
    if (key === "revenue" || key === "averageOrderValue" || key === "marketRevenue" || key === "connectRevenue" || key === "builderRevenue" || key === "totalRevenue" || key === "refundAmount") {
      const n = Math.round(Number(value) || 0);
      return n >= 10000 ? `${Math.round(n / 1000)}k` : String(n);
    }
    return String(Math.round(Number(value) || 0));
  }

  function formatMetricUnit(key) {
    if (key.endsWith("Rate")) return "%";
    if (key === "revenue" || key === "averageOrderValue") return "円";
    return "件";
  }

  function formatDelta(key, delta) {
    const d = Number(delta) || 0;
    if (key.endsWith("Rate")) {
      const pts = Math.round(d * 100);
      if (pts === 0) return "±0pt";
      return `${pts > 0 ? "+" : ""}${pts}pt`;
    }
    if (Math.abs(d) < 0.005 && !key.endsWith("Rate")) return "±0%";
    const pct = Math.round(d * 100);
    return `${pct > 0 ? "+" : ""}${pct}%`;
  }

  function buildMetric(key, label, value, delta, opsMap) {
    return {
      key,
      label,
      value: formatMetricValue(key, value),
      rawValue: value,
      unit: formatMetricUnit(key),
      delta: formatDelta(key, delta),
      deltaRate: delta,
      status: resolveMetricStatus(key, value, delta, opsMap),
    };
  }

  function hasKpiData(summary) {
    return (
      summary.inquiries > 0 ||
      summary.unresolved > 0 ||
      summary.reports > 0 ||
      summary.connectApplications > 0 ||
      summary.connectFailures > 0 ||
      summary.anpiEmergency > 0 ||
      summary.anpiConfirmed > 0 ||
      summary.builderPending > 0 ||
      summary.revenue > 0 ||
      summary.totalRevenue > 0 ||
      summary.paymentCount > 0 ||
      (summary._base?.outcome?.resolved || 0) + (summary._base?.outcome?.reopened || 0) > 0
    );
  }

  function buildKpiCenterCards(summary, deltas, opsMap) {
    const m = (key, label) =>
      buildMetric(key, label, summary[key], deltas[key], opsMap);

    return [
      {
        id: "ops_today",
        title: "今日の運営",
        metrics: [
          m("inquiries", "問い合わせ"),
          m("unresolved", "未対応"),
          m("resolutionRate", "解決率"),
          m("automationRate", "自動化率"),
        ],
      },
      {
        id: "risk",
        title: "リスク",
        metrics: [
          m("reports", "通報"),
          m("highRisk", "high risk"),
          m("anpiEmergency", "安否 emergency"),
          m("anpiConfirmed", "安否 confirmed"),
        ],
      },
      {
        id: "connect_builder",
        title: "Connect / Builder",
        metrics: [
          m("connectApplications", "Connect申請"),
          m("connectFailures", "Connect失敗"),
          m("builderPending", "承認待ち"),
          m("builderRejections", "差し戻し"),
        ],
      },
      {
        id: "revenue",
        title: "売上",
        metrics: [
          m("totalRevenue", "総売上"),
          m("marketRevenue", "市場売上"),
          m("connectRevenue", "Connect売上"),
          m("builderRevenue", "Builder売上"),
        ],
      },
    ].map((card) => {
      if (card.id === "revenue") {
        card.metrics.push(
          buildMetric("refundAmount", "返金額", summary.refundAmount, deltas.refundAmount, opsMap),
          buildMetric("cancelCount", "キャンセル", summary.cancelCount, deltas.cancelCount, opsMap),
          {
            key: "connectFeeDelta",
            label: "Connect前日比",
            value: formatDelta("connectRevenue", deltas.connectRevenue).replace("±0%", "0%"),
            rawValue: deltas.connectRevenue,
            unit: "",
            delta: formatDelta("connectRevenue", deltas.connectRevenue),
            deltaRate: deltas.connectRevenue,
            status: resolveMetricStatus("connectRevenue", summary.connectRevenue, deltas.connectRevenue, opsMap),
          },
          {
            key: "builderFeeDelta",
            label: "Builder前日比",
            value: formatDelta("builderRevenue", deltas.builderRevenue).replace("±0%", "0%"),
            rawValue: deltas.builderRevenue,
            unit: "",
            delta: formatDelta("builderRevenue", deltas.builderRevenue),
            deltaRate: deltas.builderRevenue,
            status: resolveMetricStatus("builderRevenue", summary.builderRevenue, deltas.builderRevenue, opsMap),
          }
        );
      }
      return card;
    });
  }

  function buildKpiCenterSnapshot() {
    const summary = collectKpiMetrics();
    const previous = getPreviousKpiSummary();
    const deltas = compareKpiWithPrevious(summary, previous);
    const opsMap = getOpsWatchStatusMap();
    const cards = buildKpiCenterCards(summary, deltas, opsMap);
    const hasData = hasKpiData(summary);

    saveKpiSnapshot(summary);

    const publicSummary = { ...summary };
    delete publicSummary._base;

    return {
      generatedAt: new Date().toISOString(),
      range: "today",
      previousRange: "yesterday",
      hasData,
      summary: publicSummary,
      deltas,
      opsWatchStatusMap: opsMap,
      cards,
    };
  }

  function renderMetricHtml(metric) {
    const status = metric.status || "normal";
    return (
      `<div class="ops-ai-kpi-metric ops-ai-kpi-metric--${esc(status)}" data-kpi-metric="${esc(metric.key)}">` +
      `<span class="ops-ai-kpi-metric__label">${esc(metric.label)}</span>` +
      `<span class="ops-ai-kpi-metric__value-row">` +
      `<span class="ops-ai-kpi-metric__value">${esc(metric.value)}</span>` +
      (metric.unit ? `<span class="ops-ai-kpi-metric__unit">${esc(metric.unit)}</span>` : "") +
      `</span>` +
      (metric.key !== "revenueDelta"
        ? `<span class="ops-ai-kpi-metric__delta">${esc(metric.delta)}</span>`
        : `<span class="ops-ai-kpi-metric__delta ops-ai-kpi-metric__delta--primary">${esc(metric.delta)}</span>`) +
      `</div>`
    );
  }

  function renderKpiCenterPanel(target) {
    const host =
      typeof target === "string"
        ? global.document?.querySelector(target)
        : target || global.document?.querySelector("[data-ops-ai-kpi-center]");
    if (!host) return;

    const snap = buildKpiCenterSnapshot();

    if (!snap.hasData) {
      host.innerHTML =
        `<header class="ops-ai-kpi__head">` +
        `<h2 class="ops-ai-kpi__title" id="ops-ai-kpi-heading">KPI Center</h2>` +
        `<p class="ops-ai-kpi__sub">今日の運営数字をまとめています</p>` +
        `</header>` +
        `<p class="ops-ai-kpi-empty">今日のKPIデータはまだありません</p>`;
      host.dataset.kpiReady = "1";
      return;
    }

    const cardsHtml = snap.cards
      .map(
        (card) =>
          `<article class="ops-ai-kpi-card" data-kpi-card="${esc(card.id)}">` +
          `<h3 class="ops-ai-kpi-card__title">${esc(card.title)}</h3>` +
          `<div class="ops-ai-kpi-card__metrics">${card.metrics.map(renderMetricHtml).join("")}</div>` +
          `</article>`
      )
      .join("");

    const alertCount = snap.cards
      .flatMap((c) => c.metrics)
      .filter((m) => m.status === "critical" || m.status === "warning").length;

    host.innerHTML =
      `<header class="ops-ai-kpi__head">` +
      `<div class="ops-ai-kpi__title-row">` +
      `<h2 class="ops-ai-kpi__title" id="ops-ai-kpi-heading">KPI Center</h2>` +
      (alertCount
        ? `<span class="ops-ai-kpi__alert-badge">${alertCount} 要確認</span>`
        : "") +
      `</div>` +
      `<p class="ops-ai-kpi__sub">今日の運営数字をまとめています</p>` +
      `</header>` +
      `<div class="ops-ai-kpi__grid">${cardsHtml}</div>`;

    host.dataset.kpiReady = "1";
    host.classList.toggle("ops-ai-kpi--alert", alertCount > 0);
  }

  let renderTimer = null;
  function scheduleRender() {
    if (renderTimer) clearTimeout(renderTimer);
    renderTimer = setTimeout(() => {
      renderTimer = null;
      renderKpiCenterPanel("[data-ops-ai-kpi-center]");
    }, 50);
  }

  function init() {
    scheduleRender();
    const events = [
      "tasu:support-tickets-updated",
      "tasu:admin-ai-outcome-learning-updated",
      "tasu:admin-ai-automation-updated",
      "tasu:admin-connect-resolved",
      "tasu:builder-partner-eval-changed",
      "tasu:stripe-connect-ingested",
      "tasu:admin-ai-ops-watch-updated",
      "tasful-talk-notifications-changed",
      "tasu-market-events-changed",
      "tasu:support-lifecycle-event",
    ];
    events.forEach((ev) => global.addEventListener(ev, scheduleRender));
  }

  global.TasuAdminAiKpiCenter = {
    KPI_SNAPSHOT_KEY,
    clearForTests,
    collectKpiMetrics,
    compareKpiWithPrevious,
    buildKpiCenterCards,
    buildKpiCenterSnapshot,
    renderKpiCenterPanel,
    getOpsWatchStatusMap,
    init,
  };

  if (global.document?.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(typeof window !== "undefined" ? window : globalThis);
