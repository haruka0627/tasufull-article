#!/usr/bin/env node
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
/**
 * AI運営秘書 Phase5 — Automation Engine E2E
 *   node scripts/test-admin-ai-automation-engine-browser.mjs
 */
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const KEYS = [
  "tasu_support_tickets_v1",
  "tasu_connect_issues_v1",
  "tasu_admin_connect_resolved_v1",
  "tasu_ai_automation_rules_v1",
  "tasu_ai_automation_activity_v1",
  "tasu_ai_decision_learning_v1",
  "tasu_ai_outcome_learning_v1",
  "tasu_admin_ai_response_plans_state_v1",
  "tasu_admin_ai_response_send_logs_v1",
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

async function seed(page) {
  return page.evaluate(() => {
    window.TasuSupportTicketStore?.clearAllForTests?.();
    window.TasuAdminAiAutomationEngine?.clearActivityForTests?.();
    const svc = window.TasuSupportTicketService;
    if (!svc) return { ok: false, reason: "no support" };

    const now = new Date().toISOString();
    const old = new Date(Date.now() - 8 * 86400000).toISOString();
    const ticketId = "auto_connect_001";
    window.TasuSupportTicketStore.saveTicket({
      id: ticketId,
      title: "[Connect] 本人確認の追加情報",
      body: "Stripe Connect verification documents required.",
      user_id: "auto_test",
      source: "support_intake",
      category: "connect_issue",
      severity: "high",
      status: "needs_review",
      created_at: old,
      updated_at: old,
    });
    window.TasuSupportTicketStore.saveConnectIssue({
      id: "auto_conn_issue_001",
      user_id: "auto_test",
      stripe_account_id: "acct_auto",
      stripe_event_type: "account.updated",
      issue_type: "requirements_past_due",
      severity: "high",
      status: "open",
      detected_reason: "verification documents needed",
      recommended_action: "Review",
      admin_required: true,
      ticket_id: ticketId,
      created_at: old,
      resolved_at: null,
    });

    svc.submitInquiry({
      user_id: "auto_test",
      title: "支払い確認",
      body: "支払い確認の状況を教えてください。",
    });

    window.TasuTalkNotifications?.add?.({
      id: "auto-talk-important-001",
      type: "system",
      priority: "important",
      title: "重要なお知らせ",
      body: "未読の重要通知テスト",
      targetUrl: "talk-home.html?tab=notify",
      createdAt: now,
    });

    return { ok: true };
  });
}

async function main() {
  await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage();

  await page.goto(pageUrl("support-intake.html"), { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.TasuSupportTicketService, { timeout: 15000 });
  await page.evaluate((keys) => keys.forEach((k) => localStorage.removeItem(k)), KEYS);

  const seedRes = await seed(page);
  if (!seedRes.ok) fail(`seed: ${seedRes.reason}`);
  pass("自動処理テストデータ投入");

  await page.goto(pageUrl("admin-operations-dashboard.html"), { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.TasuAdminAiAutomationEngine, { timeout: 15000 });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.TasuAdminAiAutomationEngine, { timeout: 15000 });
  await page.evaluate(() => {
    window.TasuAdminOperationsDashboard.refresh();
    window.TasuAdminAiAutomationEngine.renderAutomationPanel();
  });

  const title = await page.locator("#ops-automation-heading").textContent();
  if (!title?.includes("AI自動処理候補")) fail(`title: ${title}`);
  pass("司令塔にAI自動処理候補セクションがある");

  const cards = await page.locator("[data-ops-ai-auto-card]").count();
  if (cards < 2) fail(`automation cards ${cards}`);
  pass("自動処理候補カードが表示される");

  const cardText = await page.locator("[data-ops-ai-auto-card]").first().innerText();
  for (const label of ["対象", "次回実行", "理由", "自動実行可否"]) {
    if (!cardText.includes(label)) fail(`card missing ${label}`);
  }
  for (const btn of ["今すぐ実行", "承認", "停止"]) {
    if (!(await page.locator(`[data-ops-ai-auto-card] button:has-text("${btn}")`).count())) {
      fail(`button missing ${btn}`);
    }
  }
  pass("カードにルール情報と3ボタンがある");

  const candidates = await page.evaluate(() =>
    window.TasuAdminAiAutomationEngine.buildAutomationCandidates()
  );
  const domains = new Set(candidates.map((c) => c.domain));
  for (const d of ["connect", "support", "talk"]) {
    if (!domains.has(d)) fail(`missing domain ${d}: ${[...domains].join(",")}`);
  }
  if (!candidates.every((c) => c.gate && c.gateLevel)) fail("gate missing on candidates");
  pass("Connect/Support/TALKから候補が生成されGateが付与される");

  const connectEsc = candidates.find((c) => c.domain === "connect" && c.requiresOpsOnly);
  if (!connectEsc) fail("connect escalation candidate missing");
  const runEsc = await page.evaluate((id) => window.TasuAdminAiAutomationEngine.runNow(id), connectEsc.id);
  if (!runEsc.escalated) fail("connect 7d+ should escalate");
  const escActivity = await page.evaluate(() =>
    window.TasuAdminAiAutomationEngine.readActivity().some((a) => a.action === "escalated")
  );
  if (!escActivity) fail("escalated activity missing");
  pass("Connect運営確認は自動送信せずescalated記録");

  const lowSupport = candidates.find(
    (c) => c.domain === "support" && c.gateLevel === "low" && c.autoExecutable
  );
  if (!lowSupport) fail("low support candidate missing");
  const runLow = await page.evaluate((id) => window.TasuAdminAiAutomationEngine.runNow(id), lowSupport.id);
  if (runLow.needsApproval || runLow.queued) {
    const approved = await page.evaluate((id) => {
      const HSG = window.TasuAdminAiHumanSendGate;
      const pending =
        HSG.readPendingQueue().find((p) => p.payload?.candidateId === id) || HSG.readPendingQueue()[0];
      if (!pending) return { ok: false };
      return HSG.approveAndExecute(pending.id);
    }, lowSupport.id);
    if (!approved.ok) fail(`low run approve failed: ${approved.executed?.message || ""}`);
  } else if (!runLow.ok) {
    fail(`low run failed: ${runLow.message}`);
  }
  const lowActivity = await page.evaluate(() =>
    window.TasuAdminAiAutomationEngine.readActivity().some(
      (a) => a.action === "executed" || a.action === "approved"
    )
  );
  if (!lowActivity) fail("executed/approved activity missing");
  pass("低リスクSupportは承認後に実行・活動履歴保存");

  const talkCand = candidates.find((c) => c.domain === "talk");
  if (talkCand) {
    await page.evaluate((id) => window.TasuAdminAiAutomationEngine.stopCandidate(id), talkCand.id);
    const stopped = await page.evaluate((id) => {
      const state = JSON.parse(localStorage.getItem("tasu_ai_automation_rules_v1") || "{}");
      return state[id]?.status === "dismissed";
    }, talkCand.id);
    if (!stopped) fail("stop state not saved");
    pass("停止でスケジュール状態がdismissedに保存される");
  } else {
    pass("TALK候補なし（スキップ）");
  }

  await page.evaluate(() => {
    const fold = document.getElementById("ops-ai-activity-fold");
    if (fold) fold.open = true;
    window.TasuAdminOperationsDashboard.refresh();
  });
  const activityText = await page.locator("[data-ops-dash-activity]").innerText();
  if (!/自動処理/.test(activityText)) fail(`dashboard activity: ${activityText.slice(0, 100)}`);
  pass("司令塔運営履歴に自動処理が表示される");

  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  );
  if (overflow) fail("390px horizontal scroll");
  if (!(await page.locator("#ops-ai-automation").isVisible())) fail("automation hidden at 390px");
  pass("390pxで操作できる");

    });
  console.log("\nAll Automation Engine tests passed.");
}

main().catch((e) => {
  console.error(e);
  closeAllBrowsers().finally(() => process.exit(1));
});
