#!/usr/bin/env node
/**
 * AI運営秘書 Phase9 — Ops Watch E2E
 *   node scripts/test-admin-ai-ops-watch-browser.mjs
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const SHOT_DIR = path.join(root, "screenshots", "admin-ai-ops-watch");

const KEYS = [
  "tasu_support_tickets_v1",
  "tasu_support_events_v1",
  "tasu_connect_issues_v1",
  "tasu_ai_decision_learning_v1",
  "tasu_ai_outcome_learning_v1",
  "tasu_ai_ops_watch_snapshots_v1",
  "tasu_ai_ops_watch_log_v1",
  "tasu_admin_ai_response_plans_state_v1",
  "tasu_ai_automation_rules_v1",
  "tasu_ai_automation_activity_v1",
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
    window.TasuAdminAiOpsWatch?.clearForTests?.();
    window.TasuSupportTicketStore?.clearAllForTests?.();
    window.TasuAdminAiOutcomeLearning?.clearForTests?.();
    window.TasuAdminAiDecisionLearning?.clearForTests?.();
    window.TasuAdminAiHumanSendGate?.clearForTests?.();
    [
      "tasful_talk_notifications",
      "tasu_admin_ai_response_plans_state_v1",
  "tasu_ai_automation_rules_v1",
  "tasu_ai_automation_activity_v1",
  "tasu_ai_human_send_gate_pending_v1",
  "tasu_ai_execution_log_v1",
  "tasu_connect_issues_v1",
    ].forEach((k) => localStorage.removeItem(k));
    localStorage.setItem("tasful_talk_notifications", "[]");
    const snap = window.TasuAdminAiOpsWatch.buildOpsWatchSnapshot();
    window.TasuAdminAiOpsWatch.renderOpsWatchPanel("[data-ops-ai-watch]");
    return { ok: true, anomalyCount: snap.anomalies.length };
  });
}

async function seedAnomalies(page) {
  return page.evaluate(() => {
    const OW = window.TasuAdminAiOpsWatch;
    const store = window.TasuSupportTicketStore;
    const OL = window.TasuAdminAiOutcomeLearning;
    if (!OW || !store || !OL) return { ok: false, reason: "missing modules" };

    OW.clearForTests();
    store.clearAllForTests();
    OL.clearForTests();

    const d = new Date();
    d.setDate(d.getDate() - 1);
    const yKey = d.toISOString().slice(0, 10);
    const prevMetrics = {
      support: { open: 1, complaint: 0, highRisk: 0, reopened: 0, byCategory: {} },
      connect: { identityFail: 1, gateNg: 0, payoutErrors: 0, retryFail: 0, pending: 0 },
      builder: { pendingReview: 0, rejection: 0 },
      talk: { unreadImportant: 0, deliveryFail: 0, notifyByType: {} },
      anpi: { unconfirmed: 0, emergency: 0, total: 0 },
      outcome: {
        resolvedRate: 0.9,
        reopenedRate: 0.05,
        complaint: 0,
        escalated: 0,
        reopened: 0,
        resolved: 10,
      },
      automation: { postReopened: 0 },
      decision: { degraded: 0 },
    };
    localStorage.setItem(
      "tasu_ai_ops_watch_snapshots_v1",
      JSON.stringify({ [yKey]: { at: d.toISOString(), metrics: prevMetrics } })
    );

    for (let i = 0; i < 5; i++) {
      store.saveConnectIssue({
        id: `ow_ci_${i}`,
        user_id: `ow_u_${i % 2}`,
        issue_type: "identity_verification",
        detected_reason: "本人確認書類不備",
        status: "open",
        created_at: new Date().toISOString(),
      });
    }

    for (let i = 0; i < 10; i++) {
      OL.recordOutcome({
        sourceType: "response_plan",
        sourceId: `ow_out_${i}`,
        eventType: "payment_pending",
        category: "payment_pending",
        riskLevel: "low",
        gateLevel: "low",
        outcome: i < 5 ? "resolved" : "reopened",
        outcomeReason: i < 5 ? "解決" : "再問い合わせ",
        actionType: "sent",
        finalMessage: "テスト返信",
        resolvedAt: new Date().toISOString(),
      });
    }

    OL.recordOutcome({
      sourceType: "response_plan",
      sourceId: "ow_complaint_1",
      eventType: "abuse_or_policy",
      category: "abuse_or_policy",
      riskLevel: "high",
      gateLevel: "high",
      outcome: "complaint",
      actionType: "sent",
      finalMessage: "対応済み",
    });

    OL.recordOutcome({
      sourceType: "automation",
      sourceId: "ow_auto_1",
      eventType: "payment_pending",
      category: "payment_pending",
      riskLevel: "low",
      gateLevel: "low",
      outcome: "reopened",
      actionType: "auto_executed",
      finalMessage: "自動返信",
    });

    const notify = window.TasuTalkNotifications;
    notify?.add?.({
      id: "ow_anpi_emergency",
      category: "anpi",
      type: "anpi",
      title: "緊急安否確認 emergency",
      body: "要確認",
      priority: "urgent",
      createdAt: new Date().toISOString(),
    });

    OW.renderOpsWatchPanel("[data-ops-ai-watch]");
    const snap = OW.buildOpsWatchSnapshot();
    return {
      ok: true,
      critical: snap.summary.criticalCount,
      warning: snap.summary.warningCount,
      titles: snap.anomalies.map((a) => a.title),
    };
  });
}

async function main() {
  fs.mkdirSync(SHOT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto(pageUrl("admin-operations-dashboard.html"), {
    waitUntil: "domcontentloaded",
  });
  await page.evaluate((keys) => keys.forEach((k) => localStorage.removeItem(k)), KEYS);
  await page.waitForFunction(() => window.TasuAdminAiOpsWatch?.buildOpsWatchSnapshot, {
    timeout: 15000,
  });

  const emptySeed = await seedEmpty(page);
  if (!emptySeed.ok) fail("seedEmpty failed");
  if (emptySeed.anomalyCount > 0) fail(`empty snapshot has ${emptySeed.anomalyCount} anomalies`);
  await page.waitForTimeout(100);

  const emptyText = await page.locator("[data-ops-watch-today]").innerText();
  if (!emptyText.includes("現在、大きな異常はありません"))
    fail(`empty state: ${emptyText.slice(0, 80)}`);
  pass("異常なし時の空状態が表示される");

  const ready = await page.evaluate(() => document.querySelector("[data-ops-ai-watch]")?.dataset?.opsWatchReady);
  if (ready !== "1") {
    await page.evaluate(() => window.TasuAdminAiOpsWatch.renderOpsWatchPanel("[data-ops-ai-watch]"));
  }

  const heading = await page.locator("#ops-ai-watch-heading").innerText();
  if (heading !== "Ops Watch") fail(`heading: ${heading}`);
  pass("Ops Watch セクションが表示される");

  for (const sel of [
    "[data-ops-watch-today]",
    "[data-ops-watch-analysis]",
    "[data-ops-watch-recommendations]",
    "[data-ops-watch-log-panel]",
  ]) {
    if (!(await page.locator(sel).count())) fail(`card missing: ${sel}`);
  }
  pass("4カード（今日の異常・AI分析・推奨対応・監視ログ）が表示される");

  const seedRes = await seedAnomalies(page);
  if (!seedRes.ok) fail(`seed: ${seedRes.reason}`);
  await page.waitForTimeout(100);

  const todayText = await page.locator("[data-ops-watch-today]").innerText();
  if (!/安否 emergency|emergency/i.test(todayText)) fail(`emergency missing: ${todayText.slice(0, 120)}`);
  pass("安否 emergency が critical として表示される");

  if (!(await page.locator(".ops-ai-watch-list__item--critical").count()))
    fail("critical リスト項目なし");
  if (!(await page.locator(".ops-ai-watch-list__item--warning").count()))
    fail("warning リスト項目なし");
  pass("critical / warning が描画される");

  if (!/再問い合わせ|reopened|complaint/i.test(todayText))
    fail(`outcome anomalies: ${todayText.slice(0, 160)}`);
  pass("Outcome Learning の reopened / complaint が反映される");

  if (!/自動処理後|承認待ちへ戻す/i.test(todayText)) {
    const hasAuto = await page.evaluate(() =>
      window.TasuAdminAiOpsWatch.buildOpsWatchSnapshot().anomalies.some(
        (a) => a.source === "automation" && a.type === "post_auto_reopened"
      )
    );
    if (!hasAuto) fail(`automation reopened: ${todayText.slice(0, 160)}`);
  }
  pass("Automation Engine 後の reopened 増加が warning になる");

  const analysisText = await page.locator("[data-ops-watch-analysis]").innerText();
  if (!/原因候補|担当領域/.test(analysisText)) fail("AI分析ブロック不足");
  pass("AI分析が表示される");

  const recText = await page.locator("[data-ops-watch-recommendations]").innerText();
  if (!/最優先|本人確認|承認待ち/.test(recText)) fail(`recommendations: ${recText.slice(0, 120)}`);
  pass("推奨対応が表示される");

  const logCount = await page.locator(".ops-ai-watch-log__item").count();
  if (logCount < 1) fail("監視ログが空");
  pass("監視ログが確認できる");

  const overflow390 = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
  });
  if (overflow390) fail("390px horizontal scroll");
  const watchWidth = await page.evaluate(() => {
    const el = document.querySelector("[data-ops-ai-watch]");
    return el ? el.getBoundingClientRect().width : 0;
  });
  if (watchWidth > 390) fail(`watch width ${watchWidth}px > 390`);
  pass("390pxで崩れない");

  await page.screenshot({ path: path.join(SHOT_DIR, "ops-watch-390.png"), fullPage: false });

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate(() => window.TasuAdminAiOpsWatch.renderOpsWatchPanel("[data-ops-ai-watch]"));
  await page.waitForTimeout(50);

  const gridCols = await page.evaluate(() => {
    const grid = document.querySelector(".ops-ai-watch__grid");
    if (!grid) return 0;
    return getComputedStyle(grid).gridTemplateColumns.split(" ").filter(Boolean).length;
  });
  if (gridCols < 2) fail(`1280px grid columns: ${gridCols}`);
  pass("1280pxでカードが2カラムグリッドになる");

  await page.screenshot({ path: path.join(SHOT_DIR, "ops-watch-1280.png"), fullPage: false });
  pass("390px / 1280px スクショ保存");

  const apiSnap = await page.evaluate(() => {
    const s = window.TasuAdminAiOpsWatch.buildOpsWatchSnapshot();
    return {
      hasAnomalies: s.anomalies.length > 0,
      hasRecs: s.recommendations.length > 0,
      critical: s.summary.criticalCount,
      warning: s.summary.warningCount,
    };
  });
  if (!apiSnap.hasAnomalies) fail("buildOpsWatchSnapshot anomalies empty");
  if (!apiSnap.hasRecs) fail("buildOpsWatchRecommendations empty");
  pass("Ops Watch API（snapshot / recommendations）が動作する");

  await browser.close();
  console.log("\nAll Ops Watch (Phase9) tests passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
