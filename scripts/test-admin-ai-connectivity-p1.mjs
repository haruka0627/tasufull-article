#!/usr/bin/env node
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
/**
 * AI運営秘書 P1接続テスト — 市場イベント + Ops Watch dedupe + KPI complaint統合
 *   node scripts/test-admin-ai-connectivity-p1.mjs
 */
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const SHOT_DIR = path.join(root, "screenshots", "admin-ai-connectivity-p1");

const KEYS = [
  "tasu_support_tickets_v1",
  "tasu_support_events_v1",
  "tasu_ai_ops_watch_snapshots_v1",
  "tasu_ai_ops_watch_log_v1",
  "tasu_ai_kpi_center_snapshots_v1",
  "tasu_admin_ai_response_plans_state_v1",
  "tasu_ai_automation_rules_v1",
  "tasu_ai_automation_activity_v1",
  "tasu_ai_daily_inbox_dismissed_v1",
  "tasu_market_admin_events_v1",
  "tasu_market_order_history",
  "tasu_shop_orders",
  "tasu_ai_outcome_learning_v1",
];

function pageUrl(rel) {
  const base = process.env.BUILDER_BASE_URL;
  if (base) return `${base.replace(/\/$/, "")}/${rel}`;
  return pathToFileURL(path.join(root, rel)).href;
}

function fail(msg) {
  console.error("FAIL:", msg);
  closeAllBrowsers().finally(() => process.exit(1));
}

function pass(msg) {
  console.log("PASS:", msg);
}

async function main() {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  await withPlaywrightBrowser(async (browser) => {for (const vp of [
    { name: "390", width: 390, height: 844 },
    { name: "1280", width: 1280, height: 900 },
  ]) {
    const page = await browser.newPage();
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto(pageUrl("admin-operations-dashboard.html"), { waitUntil: "domcontentloaded" });
    await page.evaluate((keys) => keys.forEach((k) => localStorage.removeItem(k)), KEYS);
    await page.waitForFunction(() => window.TasuMarketEventStore?.listMarketEvents, { timeout: 15000 });

    const marketRes = await page.evaluate(() => {
      window.TasuAdminAiOpsWatch?.clearForTests?.();
      window.TasuMarketEventStore?.clearForTests?.();

      const now = new Date().toISOString();
      const events = [
        {
          id: "p1_order_1",
          event_type: "order_created",
          order_id: "P1-ORDER-1",
          amount: 3200,
          product_name: "P1テスト商品",
          created_at: now,
        },
        {
          id: "p1_pay_1",
          event_type: "payment_completed",
          order_id: "P1-ORDER-1",
          amount: 3200,
          product_name: "P1テスト商品",
          created_at: now,
        },
        {
          id: "p1_cancel_1",
          event_type: "order_cancelled",
          order_id: "P1-ORDER-2",
          amount: 1500,
          product_name: "P1キャンセル商品",
          note: "購入者都合キャンセル",
          created_at: now,
        },
        {
          id: "p1_cancel_2",
          event_type: "order_cancelled",
          order_id: "P1-ORDER-3",
          amount: 800,
          product_name: "P1キャンセル商品2",
          created_at: now,
        },
        {
          id: "p1_refund_req_1",
          event_type: "refund_requested",
          order_id: "P1-ORDER-4",
          amount: 5000,
          product_name: "P1返金商品",
          note: "返金申請",
          created_at: now,
        },
        {
          id: "p1_refund_done_1",
          event_type: "refund_completed",
          order_id: "P1-ORDER-4",
          amount: 5000,
          product_name: "P1返金商品",
          created_at: now,
        },
      ];
      events.forEach((e) => window.TasuMarketEventStore.appendMarketEvent(e));

      window.dispatchEvent(new CustomEvent("tasu-market-events-changed"));
      window.TasuAdminAiDailyInbox?.renderDailyInbox?.();
      window.TasuAdminAiOpsWatch?.renderOpsWatchPanel?.("[data-ops-ai-watch]");
      window.TasuAdminAiKpiCenter?.renderKpiCenterPanel?.("[data-ops-ai-kpi-center]");
      window.TasuAdminAiResponsePlans?.renderPlansPanelSync?.();
      window.TasuAdminAiAutomationEngine?.renderAutomationPanel?.();

      const list = window.TasuMarketEventStore.listMarketEvents();
      const types = [...new Set(list.map((e) => e.event_type))];
      const inbox = window.TasuAdminAiDailyInbox.buildInboxItems();
      const ow = window.TasuAdminAiOpsWatch.buildOpsWatchSnapshot();
      const kpi = window.TasuAdminAiKpiCenter.collectKpiMetrics();
      const plans = window.TasuAdminAiResponsePlans.buildResponsePlans();
      const auto = window.TasuAdminAiAutomationEngine.buildAutomationCandidates();
      const af = window.TasuAdminAiAutoFixCandidate.buildAutoFixSnapshot();

      return {
        eventCount: list.length,
        types,
        inboxMarket: inbox.filter((i) => i.source === "market").length,
        marketOrderCreated: ow.metrics?.market?.orderCreated || 0,
        marketRefundReq: ow.metrics?.market?.refundRequested || 0,
        marketCancelled: ow.metrics?.market?.cancelled || 0,
        refundAnomaly: (ow.anomalies || []).some((a) => a.source === "market" && a.type === "refund_requested"),
        kpiMarketOrder: kpi.marketOrderCreated,
        kpiRefundReq: kpi.marketRefundRequested,
        planMarket: plans.filter((p) => /market|返金|キャンセル|支払い/.test(p.eventTypeLabel || "")).length,
        autoMarket: auto.filter((c) => c.domain === "market").length,
        autoFixMarket: af.candidates.filter((c) => c.source === "market").length,
      };
    });

    const requiredTypes = [
      "order_created",
      "payment_completed",
      "order_cancelled",
      "refund_requested",
      "refund_completed",
    ];
    for (const t of requiredTypes) {
      if (!marketRes.types.includes(t)) fail(`[${vp.name}] missing event type: ${t}`);
    }
    if (!marketRes.inboxMarket) fail(`[${vp.name}] market inbox empty`);
    if (!marketRes.marketOrderCreated) fail(`[${vp.name}] Ops Watch orderCreated=0`);
    if (!marketRes.refundAnomaly) fail(`[${vp.name}] Ops Watch refund anomaly missing`);
    if (!marketRes.kpiMarketOrder) fail(`[${vp.name}] KPI marketOrderCreated=0`);
    if (!marketRes.autoMarket) fail(`[${vp.name}] Automation market candidates empty`);
    if (!marketRes.autoFixMarket) fail(`[${vp.name}] Auto Fix market candidate missing (cancel increase)`);
    pass(`[${vp.name}] 市場イベント→Inbox/OpsWatch/KPI/Plans/Automation/AutoFix反映`);

    const dedupeRes = await page.evaluate(() => {
      window.TasuAdminAiOpsWatch?.clearForTests?.();
      localStorage.setItem("tasu_market_admin_events_v1", JSON.stringify([
        {
          id: "dedupe_refund",
          event_type: "refund_requested",
          order_id: "DEDUPE-1",
          amount: 1000,
          created_at: new Date().toISOString(),
        },
      ]));
      const snap1 = window.TasuAdminAiOpsWatch.buildOpsWatchSnapshot();
      const log1 = window.TasuAdminAiOpsWatch.readWatchLog(50).length;
      const snap2 = window.TasuAdminAiOpsWatch.buildOpsWatchSnapshot();
      const log2 = window.TasuAdminAiOpsWatch.readWatchLog(50).length;
      return {
        anomalies: snap1.anomalies?.length || 0,
        log1,
        log2,
        logDelta: log2 - log1,
      };
    });

    if (dedupeRes.logDelta > 0) {
      fail(`[${vp.name}] Ops Watch log grew on repeat refresh: ${dedupeRes.log1} → ${dedupeRes.log2}`);
    }
    pass(`[${vp.name}] Ops Watch log dedupe（同一refreshで増殖なし）`);

    const complaintRes = await page.evaluate(() => {
      window.TasuAdminAiOpsWatch?.clearForTests?.();
      window.TasuSupportTicketStore?.clearAllForTests?.();
      window.TasuAdminAiOutcomeLearning?.clearForTests?.();

      window.TasuSupportTicketStore.saveTicket({
        id: "p1_complaint_001",
        title: "通報テスト",
        body: "クレーム内容 P1",
        user_id: "p1_complaint_user",
        source: "support_intake",
        category: "abuse_or_policy",
        severity: "critical",
        status: "open",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      window.TasuAdminAiOutcomeLearning.syncAll();

      const reports = window.TasuAdminAiOpsWatch.collectComplaintReports({ todayOnly: true });
      const metrics = window.TasuAdminAiOpsWatch.collectCurrentMetrics();
      const kpi = window.TasuAdminAiKpiCenter.collectKpiMetrics();
      const ow = window.TasuAdminAiOpsWatch.buildOpsWatchSnapshot();

      return {
        unified: reports,
        supportComplaint: metrics.support?.complaint || 0,
        kpiReports: kpi.reports,
        complaintAnomalies: (ow.anomalies || []).filter((a) => a.metric === "support.complaint").length,
      };
    });

    if (complaintRes.unified !== 1) fail(`[${vp.name}] unified complaint count=${complaintRes.unified}`);
    if (complaintRes.supportComplaint !== complaintRes.kpiReports) {
      fail(
        `[${vp.name}] KPI/Ops Watch mismatch: support=${complaintRes.supportComplaint} kpi=${complaintRes.kpiReports}`
      );
    }
    pass(`[${vp.name}] KPI complaint/reports 統合（同一件数=${complaintRes.kpiReports}）`);

    await page.screenshot({ path: path.join(SHOT_DIR, `dashboard-${vp.name}.png`), fullPage: true });
    await page.close();
  }
});
  console.log("\nAll P1 connectivity tests passed.");
}

main().catch(() => {
  console.error();
  closeAllBrowsers().finally(() => process.exit(1));
});
