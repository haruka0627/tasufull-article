#!/usr/bin/env node
/**
 * AI運営秘書 Phase10 — KPI Center E2E
 *   node scripts/test-admin-ai-kpi-center-browser.mjs
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const SHOT_DIR = path.join(root, "screenshots", "admin-ai-kpi-center");

const KEYS = [
  "tasu_support_tickets_v1",
  "tasu_support_events_v1",
  "tasu_connect_issues_v1",
  "tasu_ai_decision_learning_v1",
  "tasu_ai_outcome_learning_v1",
  "tasu_ai_ops_watch_snapshots_v1",
  "tasu_ai_ops_watch_log_v1",
  "tasu_ai_kpi_center_snapshots_v1",
  "tasu_admin_ai_response_plans_state_v1",
  "tasu_ai_automation_rules_v1",
  "tasu_ai_automation_activity_v1",
  "tasu_shop_orders",
  "tasu_stripe_event_ingest_logs_v1",
  "tasful_talk_notifications",
];

function pageUrl(rel) {
  const [pathname, query] = String(rel || "").split("?");
  const base = process.env.BUILDER_BASE_URL;
  if (base) {
    const url = `${base.replace(/\/$/, "")}/${pathname.replace(/^\//, "")}`;
    return query ? `${url}?${query}` : url;
  }
  const fileHref = pathToFileURL(path.join(root, pathname)).href;
  return query ? `${fileHref.split("?")[0]}?${query}` : fileHref;
}

function fail(msg) {
  console.error("FAIL:", msg);
  process.exit(1);
}

function pass(msg) {
  console.log("PASS:", msg);
}

async function seedEmpty(page) {
  return page.evaluate(() => {
    window.TasuAdminAiKpiCenter?.clearForTests?.();
    window.TasuAdminAiOpsWatch?.clearForTests?.();
    window.TasuSupportTicketStore?.clearAllForTests?.();
    window.TasuAdminAiOutcomeLearning?.clearForTests?.();
    window.TasuAdminAiDecisionLearning?.clearForTests?.();
    [
      "tasful_talk_notifications",
      "tasu_admin_ai_response_plans_state_v1",
      "tasu_ai_automation_rules_v1",
      "tasu_ai_automation_activity_v1",
      "tasu_connect_issues_v1",
      "tasu_shop_orders",
      "tasu_stripe_event_ingest_logs_v1",
    ].forEach((k) => localStorage.removeItem(k));
    localStorage.setItem("tasful_talk_notifications", "[]");
    window.TasuAdminAiKpiCenter.renderKpiCenterPanel("[data-ops-ai-kpi-center]");
    const snap = window.TasuAdminAiKpiCenter.buildKpiCenterSnapshot();
    return { ok: true, hasData: snap.hasData };
  });
}

async function seedKpiData(page) {
  return page.evaluate(() => {
    const store = window.TasuSupportTicketStore;
    const OL = window.TasuAdminAiOutcomeLearning;
    const KC = window.TasuAdminAiKpiCenter;
    const OW = window.TasuAdminAiOpsWatch;
    if (!store || !OL || !KC || !OW) return { ok: false, reason: "missing modules" };

    KC.clearForTests();
    OW.clearForTests();
    store.clearAllForTests();
    OL.clearForTests();

    const now = new Date().toISOString();
    const y = new Date();
    y.setDate(y.getDate() - 1);
    const yKey = y.toISOString().slice(0, 10);

    localStorage.setItem(
      "tasu_ai_kpi_center_snapshots_v1",
      JSON.stringify({
        [yKey]: {
          at: y.toISOString(),
          summary: {
            inquiries: 2,
            unresolved: 1,
            resolutionRate: 0.85,
            automationRate: 0.1,
            reopenedRate: 0.05,
            reports: 0,
            highRisk: 0,
            connectApplications: 1,
            connectFailures: 0,
            anpiEmergency: 0,
            builderPending: 0,
            builderRejections: 0,
            revenue: 20000,
            paymentCount: 2,
            averageOrderValue: 10000,
          },
        },
      })
    );

    store.saveTicket({
      id: "kpi_open_1",
      title: "未対応チケット",
      body: "test",
      user_id: "kpi_u",
      status: "open",
      severity: "high",
      category: "general",
      created_at: now,
      updated_at: now,
    });
    store.saveTicket({
      id: "kpi_report_1",
      title: "通報テスト",
      body: "クレーム",
      user_id: "kpi_u",
      status: "open",
      severity: "critical",
      category: "abuse_or_policy",
      created_at: now,
      updated_at: now,
    });

    for (let i = 0; i < 5; i++) {
      store.saveConnectIssue({
        id: `kpi_ci_${i}`,
        user_id: `kpi_cu_${i}`,
        issue_type: "identity_verification",
        detected_reason: "本人確認失敗",
        status: "open",
        created_at: now,
      });
    }

    for (let i = 0; i < 8; i++) {
      OL.recordOutcome({
        sourceType: "response_plan",
        sourceId: `kpi_out_${i}`,
        eventType: "payment_pending",
        riskLevel: "low",
        gateLevel: "low",
        outcome: i < 4 ? "resolved" : "reopened",
        actionType: i < 2 ? "auto_executed" : "sent",
        finalMessage: "test",
      });
    }

    window.TasuTalkNotifications.add({
      id: "kpi_anpi_em",
      category: "anpi",
      type: "anpi",
      title: "緊急安否 emergency",
      body: "要確認",
      priority: "urgent",
      createdAt: now,
    });

    localStorage.setItem(
      "tasu_shop_orders",
      JSON.stringify([
        {
          id: "kpi_order_1",
          amount_total: 15000,
          total_amount_jpy: 15000,
          created_at: now,
        },
        {
          id: "kpi_order_2",
          amount_total: 8000,
          total_amount_jpy: 8000,
          created_at: now,
        },
      ])
    );

    KC.renderKpiCenterPanel("[data-ops-ai-kpi-center]");
    OW.renderOpsWatchPanel("[data-ops-ai-watch]");

    const kpi = KC.buildKpiCenterSnapshot();
    const ops = OW.buildOpsWatchSnapshot();
    return {
      ok: true,
      cards: kpi.cards.length,
      hasCriticalKpi: kpi.cards.some((c) =>
        c.metrics.some((m) => m.status === "critical")
      ),
      hasWarningKpi: kpi.cards.some((c) =>
        c.metrics.some((m) => m.status === "warning")
      ),
      opsCritical: ops.anomalies.filter((a) => a.severity === "critical").map((a) => a.metric),
      kpiStatuses: kpi.cards.flatMap((c) =>
        c.metrics.map((m) => `${m.key}:${m.status}`)
      ),
    };
  });
}

async function main() {
  fs.mkdirSync(SHOT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto(pageUrl("admin-operations-dashboard.html"), { waitUntil: "domcontentloaded" });
  await page.evaluate((keys) => keys.forEach((k) => localStorage.removeItem(k)), KEYS);
  await page.waitForFunction(() => window.TasuAdminAiKpiCenter?.buildKpiCenterSnapshot, {
    timeout: 15000,
  });

  const emptyRes = await seedEmpty(page);
  if (!emptyRes.ok) fail("seedEmpty failed");
  if (emptyRes.hasData) fail("empty state should have hasData=false");
  const emptyText = await page.locator("[data-ops-ai-kpi-center]").innerText();
  if (!emptyText.includes("今日のKPIデータはまだありません")) fail(`empty: ${emptyText.slice(0, 80)}`);
  pass("データなし時の空状態が表示される");

  const heading = await page.locator("#ops-ai-kpi-heading").innerText();
  if (heading !== "KPI Center") fail(`heading: ${heading}`);
  pass("KPI Center セクションが表示される");

  const seedRes = await seedKpiData(page);
  if (!seedRes.ok) fail(`seed: ${seedRes.reason}`);
  await page.waitForTimeout(100);

  if (seedRes.cards !== 4) fail(`cards count: ${seedRes.cards}`);
  pass("4カードが描画される");

  for (const title of ["今日の運営", "リスク", "Connect / Builder", "売上"]) {
    const card = page.locator(`[data-kpi-card]`).filter({ hasText: title });
    if (!(await card.count())) fail(`card missing: ${title}`);
  }
  pass("今日の運営 / リスク / Connect・Builder / 売上 が表示される");

  if (!(await page.locator(".ops-ai-kpi-metric--critical").count()))
    fail("critical metric not rendered");
  if (!(await page.locator(".ops-ai-kpi-metric--warning").count()))
    fail("warning metric not rendered");
  if (!(await page.locator(".ops-ai-kpi-metric--good, .ops-ai-kpi-metric--normal").count()))
    fail("normal/good metric not rendered");
  pass("good / normal / warning / critical が描画される");

  const consistency = await page.evaluate(() => {
    const KC = window.TasuAdminAiKpiCenter;
    const OW = window.TasuAdminAiOpsWatch;
    const kpi = KC.buildKpiCenterSnapshot();
    const ops = OW.buildOpsWatchSnapshot();
    const opsCritMetrics = new Set(
      ops.anomalies.filter((a) => a.severity === "critical").map((a) => a.metric)
    );
    const map = {
      "support.highRisk": "highRisk",
      "anpi.emergency": "anpiEmergency",
    };
    const mismatches = [];
    opsCritMetrics.forEach((metric) => {
      const kpiKey = map[metric];
      if (!kpiKey) return;
      const m = kpi.cards.flatMap((c) => c.metrics).find((x) => x.key === kpiKey);
      if (m && m.status !== "critical") mismatches.push(`${kpiKey}:${m.status}`);
    });
    return { mismatches, opsCrit: [...opsCritMetrics] };
  });
  if (consistency.mismatches.length) {
    fail(`Ops Watch vs KPI mismatch: ${consistency.mismatches.join(", ")}`);
  }
  pass("Ops Watch の critical と KPI Center の status が矛盾しない");

  const overflow390 = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  );
  if (overflow390) fail("390px horizontal scroll");
  const kpiWidth = await page.evaluate(() => {
    const el = document.querySelector("[data-ops-ai-kpi-center]");
    return el ? el.getBoundingClientRect().width : 0;
  });
  if (kpiWidth > 390) fail(`kpi width ${kpiWidth}px`);
  const gridCols390 = await page.evaluate(() => {
    const grid = document.querySelector(".ops-ai-kpi__grid");
    return grid ? getComputedStyle(grid).gridTemplateColumns.split(" ").filter(Boolean).length : 0;
  });
  if (gridCols390 !== 1) fail(`390px columns: ${gridCols390}`);
  pass("390pxで縦積みになる");

  await page.screenshot({ path: path.join(SHOT_DIR, "kpi-center-390.png"), fullPage: false });

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate(() => window.TasuAdminAiKpiCenter.renderKpiCenterPanel("[data-ops-ai-kpi-center]"));
  await page.waitForTimeout(50);

  const gridCols1280 = await page.evaluate(() => {
    const grid = document.querySelector(".ops-ai-kpi__grid");
    return grid ? getComputedStyle(grid).gridTemplateColumns.split(" ").filter(Boolean).length : 0;
  });
  if (gridCols1280 < 4) fail(`1280px grid columns: ${gridCols1280}`);
  pass("1280pxで4カードグリッドになる");

  await page.screenshot({ path: path.join(SHOT_DIR, "kpi-center-1280.png"), fullPage: false });
  pass("390px / 1280px スクショ保存");

  const placement = await page.evaluate(() => {
    const watch = document.querySelector("[data-ops-ai-watch]");
    const kpi = document.querySelector("[data-ops-ai-kpi-center]");
    const hub = document.querySelector("[data-talk-ops-hub]");
    if (!watch || !kpi || !hub) return { ok: false };
    return {
      ok: true,
      watchBeforeKpi: watch.compareDocumentPosition(kpi) & Node.DOCUMENT_POSITION_FOLLOWING,
      kpiBeforeHub: kpi.compareDocumentPosition(hub) & Node.DOCUMENT_POSITION_FOLLOWING,
    };
  });
  if (!placement.ok || !placement.watchBeforeKpi || !placement.kpiBeforeHub) {
    fail("KPI Center placement incorrect");
  }
  pass("Ops Watch の下・本日の優先対応（ハブ）より上に配置されている");

  await browser.close();
  console.log("\nAll KPI Center (Phase10) tests passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
