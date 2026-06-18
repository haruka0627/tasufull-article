#!/usr/bin/env node
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
/**
 * AI運営秘書 Phase12 — Human Send Gate E2E
 *   node scripts/test-admin-ai-human-send-gate-browser.mjs
 */
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const SHOT_DIR = path.join(root, "screenshots", "admin-ai-human-send-gate");

const KEYS = [
  "tasu_support_tickets_v1",
  "tasu_support_events_v1",
  "tasu_connect_issues_v1",
  "tasu_ai_decision_learning_v1",
  "tasu_ai_outcome_learning_v1",
  "tasu_ai_ops_watch_snapshots_v1",
  "tasu_ai_kpi_center_snapshots_v1",
  "tasu_admin_ai_response_plans_state_v1",
  "tasu_ai_automation_rules_v1",
  "tasu_ai_automation_activity_v1",
  "tasu_ai_human_send_gate_pending_v1",
  "tasu_ai_execution_log_v1",
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
  closeAllBrowsers().finally(() => process.exit(1));
}

function pass(msg) {
  console.log("PASS:", msg);
}

async function main() {
  fs.mkdirSync(SHOT_DIR, { recursive: true });

  await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage();
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto(pageUrl("admin-operations-dashboard.html"), { waitUntil: "domcontentloaded" });
  await page.evaluate((keys) => keys.forEach((k) => localStorage.removeItem(k)), KEYS);
  await page.waitForFunction(() => window.TasuAdminAiHumanSendGate?.buildHumanSendGateSnapshot, {
    timeout: 15000,
  });

  const emptyText = await page.locator("[data-ops-ai-human-send-gate]").innerText();
  if (!/承認待ち/.test(emptyText)) fail("承認待ちセクションなし");
  pass("承認待ちセクションが表示される");

  const seedRes = await page.evaluate(() => {
    const HSG = window.TasuAdminAiHumanSendGate;
    const AFC = window.TasuAdminAiAutoFixCandidate;
    HSG.clearForTests();
    window.TasuSupportTicketStore?.clearAllForTests?.();
    window.TasuAdminAiOutcomeLearning?.clearForTests?.();

    const item = HSG.enqueuePendingItem({
      source: "autofix",
      sourceId: "test_internal_1",
      category: "faq_register",
      actionType: "internal",
      proposal: "FAQ化候補を登録",
      recommendation: "FAQ化候補",
      reason: "同一問い合わせ 8件",
      impactArea: "Support",
      severity: "normal",
      confidence: 0.7,
    });

    const human = HSG.enqueuePendingItem({
      source: "response_plan",
      sourceId: "test_plan_1",
      category: "support_answer",
      actionType: "human_send",
      proposal: "お支払い状況を確認いたします",
      recommendation: "Support回答送信",
      reason: "AI対応案",
      impactArea: "Support",
      severity: "warning",
      confidence: 0.85,
      payload: { planId: "missing_plan_test" },
    });

    HSG.renderHumanSendGatePanel("[data-ops-ai-human-send-gate]");
    return { internalId: item.id, humanId: human.id, count: HSG.readPendingQueue().length };
  });

  if (seedRes.count < 2) fail(`pending count ${seedRes.count}`);
  pass("候補が承認待ちに追加される");

  const panelText = await page.locator("[data-ops-ai-human-send-gate]").innerText();
  if (!/2件/.test(panelText) && !/承認して実行/.test(panelText)) fail(`panel: ${panelText.slice(0, 100)}`);
  if (!(await page.locator(".ops-ai-hsg-card--warning").count())) fail("warning card missing");
  pass("severity付きで承認待ち一覧が描画される");

  const rejectRes = await page.evaluate((id) => {
    const HSG = window.TasuAdminAiHumanSendGate;
    const res = HSG.rejectPendingItem(id);
    const log = HSG.readExecutionLog(5);
    const outcomes = window.TasuAdminAiOutcomeLearning.readOutcomes();
    return {
      ok: res.ok,
      pending: HSG.readPendingQueue().length,
      logRejected: log.some((l) => l.result === "rejected"),
      outcomeRejected: outcomes.some((o) => o.actionType === "rejected"),
    };
  }, seedRes.humanId);

  if (!rejectRes.ok) fail("reject failed");
  if (rejectRes.pending !== 1) fail(`pending after reject ${rejectRes.pending}`);
  if (!rejectRes.logRejected) fail("execution log reject missing");
  if (!rejectRes.outcomeRejected) fail("outcome reject missing");
  pass("却下が記録される（ログ・Outcome）");

  const approveRes = await page.evaluate((id) => {
    const HSG = window.TasuAdminAiHumanSendGate;
    const res = HSG.approveAndExecute(id);
    const log = HSG.readExecutionLog(5);
    const outcomes = window.TasuAdminAiOutcomeLearning.readOutcomes();
    return {
      ok: res.ok,
      approved: res.approved,
      pending: HSG.readPendingQueue().length,
      logApproved: log.some((l) => l.status === "approved" && l.result === "success"),
      outcomeApproved: outcomes.some((o) => o.sourceType === "human_send_gate" && o.actionType === "approved"),
    };
  }, seedRes.internalId);

  if (!approveRes.approved) fail("approve failed");
  if (approveRes.pending !== 0) fail(`pending after approve ${approveRes.pending}`);
  if (!approveRes.logApproved) fail("execution log approve missing");
  if (!approveRes.outcomeApproved) fail("outcome approve missing");
  pass("承認して実行が記録される（ログ・Outcome）");

  const soloSendBlocked = await page.evaluate(() => {
    window.TasuSupportTicketStore?.clearAllForTests?.();
    window.TasuAdminAiHumanSendGate.clearForTests();
    const svc = window.TasuSupportTicketService;
    const res = svc.submitInquiry({
      user_id: "hsg_solo_test",
      title: "支払い確認",
      body: "支払い状況を教えてください",
    });
    const plans = window.TasuAdminAiResponsePlans.buildResponsePlans();
    const plan = plans.find((p) => p.riskLevel === "low") || plans[0];
    if (!plan) return { ok: false, reason: "no plan" };
    const send = window.TasuAdminAiResponsePlans.sendPlan(plan.id);
    const pending = window.TasuAdminAiHumanSendGate.readPendingQueue().length;
    return {
      ok: true,
      needsApproval: send.needsApproval || send.queued,
      pending,
      noDirectSend: !send.ok || send.needsApproval,
    };
  });

  if (!soloSendBlocked.ok) fail(`solo send setup: ${soloSendBlocked.reason}`);
  if (!soloSendBlocked.noDirectSend) fail("AI単独送信がブロックされていない");
  if (soloSendBlocked.pending < 1) fail("承認待ちに追加されていない");
  pass("AI単独送信なし — sendPlanは承認待ちへ");

  const placement = await page.evaluate(() => {
    const autofix = document.querySelector("[data-ops-ai-auto-fix]");
    const hsg = document.querySelector("[data-ops-ai-human-send-gate]");
    const hub = document.querySelector("[data-talk-ops-hub]");
    if (!autofix || !hsg || !hub) return false;
    return (
      (autofix.compareDocumentPosition(hsg) & Node.DOCUMENT_POSITION_FOLLOWING) &&
      (hsg.compareDocumentPosition(hub) & Node.DOCUMENT_POSITION_FOLLOWING)
    );
  });
  if (!placement) fail("配置が不正");
  pass("Auto Fix下・本日の優先対応（ハブ）より上に配置");

  const overflow390 = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  );
  if (overflow390) fail("390px scroll");
  const width = await page.evaluate(() => {
    const el = document.querySelector("[data-ops-ai-human-send-gate]");
    return el ? el.getBoundingClientRect().width : 0;
  });
  if (width > 390) fail(`width ${width}px`);
  pass("390pxで崩れない");

  await page.screenshot({ path: path.join(SHOT_DIR, "human-send-gate-390.png"), fullPage: false });

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate(() => {
    window.TasuAdminAiHumanSendGate.enqueuePendingItem({
      source: "autofix",
      category: "move_to_pending",
      actionType: "internal",
      proposal: "テスト2",
      recommendation: "テスト2",
      reason: "layout test",
      severity: "normal",
    });
    window.TasuAdminAiHumanSendGate.renderHumanSendGatePanel("[data-ops-ai-human-send-gate]");
  });

  const cols = await page.evaluate(() => {
    const g = document.querySelector(".ops-ai-hsg__grid");
    return g ? getComputedStyle(g).gridTemplateColumns.split(" ").filter(Boolean).length : 0;
  });
  if (cols < 2) fail(`1280px cols ${cols}`);
  pass("1280pxでグリッド表示");

  await page.screenshot({ path: path.join(SHOT_DIR, "human-send-gate-1280.png"), fullPage: false });
  pass("390px / 1280px スクショ保存");

    });
  console.log("\nAll Human Send Gate (Phase12) tests passed.");
}

main().catch(() => {
  console.error();
  closeAllBrowsers().finally(() => process.exit(1));
});
