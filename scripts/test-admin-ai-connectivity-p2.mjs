#!/usr/bin/env node
/**
 * AI運営秘書 P2接続テスト — Stripe ingest / Connect・Builder KPI / confirmed / Support events
 *   node scripts/test-admin-ai-connectivity-p2.mjs
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const SHOT_DIR = path.join(root, "screenshots", "admin-ai-connectivity-p2");

const KEYS = [
  "tasu_support_tickets_v1",
  "tasu_support_events_v1",
  "tasu_connect_issues_v1",
  "tasu_ai_ops_watch_snapshots_v1",
  "tasu_ai_ops_watch_log_v1",
  "tasu_ai_kpi_center_snapshots_v1",
  "tasu_market_admin_events_v1",
  "tasu_shop_orders",
  "tasu_stripe_event_ingest_logs_v1",
  "tasu_stripe_ingest_mode_v1",
  "tasful_platform_chat_fees_v1",
  "tasu_ai_outcome_learning_v1",
  "tasful_talk_notifications",
];

function pageUrl(rel) {
  const base = process.env.BUILDER_BASE_URL;
  if (base) return `${base.replace(/\/$/, "")}/${rel}`;
  return pathToFileURL(path.join(root, rel)).href;
}

function fail(msg) {
  console.error("FAIL:", msg);
  process.exit(1);
}

function pass(msg) {
  console.log("PASS:", msg);
}

async function main() {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  for (const vp of [
    { name: "390", width: 390, height: 844 },
    { name: "1280", width: 1280, height: 900 },
  ]) {
    const page = await browser.newPage();
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto(pageUrl("admin-operations-dashboard.html"), { waitUntil: "domcontentloaded" });
    await page.evaluate((keys) => keys.forEach((k) => localStorage.removeItem(k)), KEYS);
    await page.waitForFunction(
      () => window.TasuStripeConnectIngest?.ingestProductionWebhook && window.TasuAdminAiKpiCenter,
      { timeout: 15000 }
    );

    const stripeRes = await page.evaluate(() => {
      window.TasuAdminAiOpsWatch?.clearForTests?.();
      window.TasuMarketEventStore?.clearForTests?.();
      window.TasuSupportTicketStore?.clearAllForTests?.();

      window.TasuStripeConnectIngest.setIngestMode("production");
      const ingested = window.TasuStripeConnectIngest.ingestProductionWebhook({
        id: "p2_evt_checkout",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_p2",
            amount_total: 8800,
            currency: "jpy",
            metadata: { order_id: "P2-STRIPE-1" },
          },
        },
      });

      const kpi = window.TasuAdminAiKpiCenter.collectKpiMetrics();
      const market = window.TasuMarketEventStore.listMarketEvents();
      const mode = window.TasuStripeConnectIngest.getIngestMode();

      return {
        mode,
        source: ingested.source,
        logAmount: ingested.ingestLog?.amount || 0,
        marketPay: market.filter((e) => e.event_type === "payment_completed").length,
        totalRevenue: kpi.totalRevenue,
        marketRevenue: kpi.marketRevenue,
      };
    });

    if (stripeRes.mode !== "production") fail(`[${vp.name}] ingest mode not production`);
    if (stripeRes.source !== "stripe_webhook_production") fail(`[${vp.name}] source=${stripeRes.source}`);
    if (!stripeRes.logAmount) fail(`[${vp.name}] stripe log amount missing`);
    if (!stripeRes.marketPay) fail(`[${vp.name}] payment_completed not bridged to market`);
    pass(`[${vp.name}] Stripe production ingest→市場売上→KPI`);

    const feeRes = await page.evaluate(() => {
      const now = new Date().toISOString();
      localStorage.setItem(
        "tasful_platform_chat_fees_v1",
        JSON.stringify([
          {
            threadId: "p2_connect_fee",
            category: "skill",
            status: "paid",
            paidAt: now,
            feeAmount: 550,
          },
          {
            threadId: "p2_builder_fee",
            category: "builder",
            status: "paid",
            paidAt: now,
            feeAmount: 1100,
          },
        ])
      );

      const kpi = window.TasuAdminAiKpiCenter.collectKpiMetrics();
      const ow = window.TasuAdminAiOpsWatch.buildOpsWatchSnapshot();
      return {
        connectRevenue: kpi.connectRevenue,
        builderRevenue: kpi.builderRevenue,
        connectFeeCount: kpi.connectFeeCount,
        builderFeeCount: kpi.builderFeeCount,
        owConnect: ow.summary?.connectRevenue || 0,
        owBuilder: ow.summary?.builderRevenue || 0,
      };
    });

    if (feeRes.connectRevenue < 550) fail(`[${vp.name}] connectRevenue=${feeRes.connectRevenue}`);
    if (feeRes.builderRevenue < 1100) fail(`[${vp.name}] builderRevenue=${feeRes.builderRevenue}`);
    if (!feeRes.connectFeeCount || !feeRes.builderFeeCount) fail(`[${vp.name}] fee counts missing`);
    if (feeRes.owConnect < 550 || feeRes.owBuilder < 1100) fail(`[${vp.name}] Ops Watch summary revenue missing`);
    pass(`[${vp.name}] Connect/Builder手数料 KPI + Ops Watch summary`);

    const anpiRes = await page.evaluate(() => {
      window.TasuTalkNotifications?.add?.({
        id: "p2_anpi_confirmed",
        category: "anpi",
        type: "anpi",
        title: "安否確認完了",
        body: "confirmed · 応答あり",
        priority: "normal",
        createdAt: new Date().toISOString(),
      });
      const kpi = window.TasuAdminAiKpiCenter.collectKpiMetrics();
      const metrics = window.TasuAdminAiOpsWatch.collectCurrentMetrics();
      return {
        kpiConfirmed: kpi.anpiConfirmed,
        owConfirmed: metrics.anpi?.confirmed || 0,
      };
    });

    if (!anpiRes.kpiConfirmed) fail(`[${vp.name}] anpiConfirmed=0`);
    if (anpiRes.kpiConfirmed !== anpiRes.owConfirmed) {
      fail(`[${vp.name}] confirmed mismatch kpi=${anpiRes.kpiConfirmed} ow=${anpiRes.owConfirmed}`);
    }
    pass(`[${vp.name}] 安否 confirmed KPI/Ops Watch反映`);

    const supportRes = await page.evaluate(() => {
      window.TasuSupportTicketStore?.clearAllForTests?.();
      window.TasuAdminAiOutcomeLearning?.clearForTests?.();

      const store = window.TasuSupportTicketStore;
      store.saveTicket({
        id: "p2_ticket_resolved",
        title: "支払い確認",
        body: "決済について",
        user_id: "p2_user",
        category: "general",
        severity: "low",
        status: "resolved",
        created_at: new Date(Date.now() - 86400000).toISOString(),
        updated_at: new Date().toISOString(),
        resolved_at: new Date().toISOString(),
      });
      store.saveTicket({
        id: "p2_ticket_reopened",
        title: "再問い合わせ",
        body: "決済について再度",
        user_id: "p2_user",
        category: "general",
        severity: "low",
        status: "open",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      window.TasuAdminAiOutcomeLearning.recordOutcome({
        sourceType: "support",
        sourceId: "p2_ticket_resolved",
        eventType: "payment_pending",
        category: "general",
        riskLevel: "low",
        gateLevel: "low",
        actionType: "sent",
        finalMessage: "test",
        outcome: "resolved",
        relatedTicketId: "p2_ticket_resolved",
        userId: "p2_user",
        resolvedAt: new Date(Date.now() - 3600000).toISOString(),
      });

      window.TasuAdminAiOutcomeLearning.syncSupportReopened();
      const reopenedEvents = store.listLifecycleEvents({ todayOnly: true }).filter(
        (e) => e.event_type === "support_reopened"
      );
      const inbox = window.TasuAdminAiDailyInbox.buildInboxItems().filter(
        (i) => i.eventType === "support_reopened"
      );
      const metrics = window.TasuAdminAiOpsWatch.collectCurrentMetrics();

      store.saveTicket({
        id: "p2_complaint",
        title: "通報",
        body: "クレーム",
        user_id: "p2_complaint_user",
        category: "abuse_or_policy",
        severity: "critical",
        status: "open",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      window.TasuAdminAiOutcomeLearning.syncComplaints();
      const complaintEvents = store.listLifecycleEvents({ todayOnly: true }).filter(
        (e) => e.event_type === "support_complaint"
      );

      return {
        reopenedEvents: reopenedEvents.length,
        inboxReopened: inbox.length,
        supportReopened: metrics.support?.reopened || 0,
        complaintEvents: complaintEvents.length,
      };
    });

    if (!supportRes.reopenedEvents) fail(`[${vp.name}] support_reopened event missing`);
    if (!supportRes.complaintEvents) fail(`[${vp.name}] support_complaint event missing`);
    if (!supportRes.supportReopened) fail(`[${vp.name}] Ops Watch reopened=0`);
    pass(`[${vp.name}] Support first-class events (reopened/complaint)`);

    const simRes = await page.evaluate(() => {
      window.TasuStripeConnectIngest.setIngestMode("simulation");
      const ingested = window.TasuStripeConnectIngest.ingestSimulatedEvent({
        id: "p2_evt_sim",
        type: "payment_intent.succeeded",
        data: { object: { id: "pi_sim", amount: 1200, currency: "jpy", metadata: { order_id: "SIM-1" } } },
      });
      return { mode: window.TasuStripeConnectIngest.getIngestMode(), source: ingested.source };
    });
    if (simRes.mode !== "simulation") fail(`[${vp.name}] simulation mode broken`);
    if (simRes.source !== "stripe_webhook_sim") fail(`[${vp.name}] sim source=${simRes.source}`);
    pass(`[${vp.name}] Stripe simulation mode preserved`);

    await page.screenshot({ path: path.join(SHOT_DIR, `dashboard-${vp.name}.png`), fullPage: true });
    await page.close();
  }

  await browser.close();
  console.log("\nAll P2 connectivity tests passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
