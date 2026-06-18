#!/usr/bin/env node
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
/**
 * AI運営秘書 Phase6 — Daily Inbox E2E
 *   node scripts/test-admin-ai-daily-inbox-browser.mjs
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
  "tasu_admin_ai_response_plans_state_v1",
  "tasu_admin_ai_response_send_logs_v1",
  "tasu_admin_ai_response_dismissed_v1",
  "tasu_admin_ops_ai_response_activity_v1",
  "tasu_ai_daily_inbox_dismissed_v1",
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
    window.TasuAdminAiDailyInbox?.clearDismissedForTests?.();
    window.TasuAdminAiResponsePlans?.clearOpsActivityForTests?.();
    localStorage.removeItem("tasu_admin_ai_response_dismissed_v1");

    const now = new Date().toISOString();
    const old = new Date(Date.now() - 8 * 86400000).toISOString();

    const ticketId = "inbox_connect_001";
    window.TasuSupportTicketStore.saveTicket({
      id: ticketId,
      title: "[Connect] 本人確認の追加情報",
      body: "Stripe Connect verification documents required.",
      user_id: "inbox_test",
      source: "support_intake",
      category: "connect_issue",
      severity: "high",
      status: "needs_review",
      created_at: old,
      updated_at: old,
    });
    window.TasuSupportTicketStore.saveConnectIssue({
      id: "inbox_conn_issue_001",
      user_id: "inbox_test",
      stripe_account_id: "acct_inbox",
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

    window.TasuSupportTicketStore.saveTicket({
      id: "inbox_support_med",
      title: "機能の使い方",
      body: "使い方を教えてください",
      user_id: "inbox_user",
      source: "support_intake",
      category: "general",
      severity: "medium",
      status: "open",
      created_at: now,
      updated_at: now,
    });

    localStorage.setItem(
      "tasu_ai_automation_activity_v1",
      JSON.stringify([
        {
          id: "act_inbox_done_001",
          candidateId: "auto_done_test_001",
          ruleName: "Connect 7日リマインド",
          action: "executed",
          target: "inbox_test",
          reason: "自動リマインド送信",
          at: now,
        },
      ])
    );

    return { ok: true };
  });
}

async function main() {
  await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage();
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto(pageUrl("admin-operations-dashboard.html"), { waitUntil: "domcontentloaded" });
  await page.evaluate((keys) => keys.forEach((k) => localStorage.removeItem(k)), KEYS);
  await seed(page);
  await page.reload({ waitUntil: "domcontentloaded" });

  await page.waitForFunction(
    () => window.TasuAdminAiDailyInbox && document.querySelector("[data-ops-daily-inbox-summary]")?.innerHTML,
    { timeout: 15000 }
  );

  const api = await page.evaluate(() => ({
    items: window.TasuAdminAiDailyInbox.buildInboxItems(),
    summary: window.TasuAdminAiDailyInbox.buildDailySummary(
      window.TasuAdminAiDailyInbox.buildInboxItems()
    ),
  }));

  if (!api.items.length) fail("inbox items empty");
  pass(`buildInboxItems: ${api.items.length}件`);

  const sources = new Set(api.items.map((i) => i.source));
  for (const expected of ["response_plan", "automation", "connect", "support"]) {
    if (![...sources].some((s) => s === expected)) {
      fail(`missing source: ${expected} (have ${[...sources].join(", ")})`);
    }
  }
  pass("AI対応案・自動処理・Connect・Support を統合");

  const categories = new Set(api.items.map((i) => i.category));
  if (!categories.has("needs_judgment")) fail("needs_judgment missing");
  if (!categories.has("pending_approval")) fail("pending_approval missing");
  if (!categories.has("auto_done")) fail("auto_done missing");
  pass("3分類（要判断・承認待ち・自動処理済み）がある");

  for (const item of api.items.slice(0, 5)) {
    if (!item.title || !item.target || !item.reason || !item.recommendedAction) {
      fail(`item fields missing: ${JSON.stringify(item)}`);
    }
  }
  pass("件名・対象・理由・推奨操作フィールドがある");

  if (typeof api.summary.needsJudgmentCount !== "number") fail("summary needsJudgmentCount");
  if (typeof api.summary.pendingApprovalCount !== "number") fail("summary pendingApprovalCount");
  if (typeof api.summary.autoDoneCount !== "number") fail("summary autoDoneCount");
  if (api.summary.needsJudgmentCount + api.summary.pendingApprovalCount + api.summary.autoDoneCount < 1) {
    fail("summary counts zero");
  }
  pass("本日の運営結果サマリー件数がある");

  const title = await page.locator("#ops-daily-inbox-heading").textContent();
  if (!title?.includes("本日の運営結果")) fail(`heading: ${title}`);
  pass("司令塔最上部に本日の運営結果がある");

  const sections = await page.locator("[data-ops-inbox-section]").count();
  if (sections < 3) fail(`inbox sections: ${sections}`);
  pass("3カテゴリセクションが表示される");

  for (const label of ["開く", "承認", "保留"]) {
    const btn = page.locator(`[data-ops-inbox-item] :is(a,button):has-text("${label}")`).first();
    if (!(await btn.count())) fail(`button missing: ${label}`);
  }
  pass("各項目に開く・承認・保留ボタンがある");

  const priorityText = await page.locator("[data-ops-daily-inbox-priority]").innerText();
  if (!priorityText.includes("最優先")) fail(`priority block: ${priorityText.slice(0, 80)}`);
  pass("最優先タスクが表示される");

  const holdTarget = api.items.find((i) => i.category !== "auto_done");
  if (!holdTarget) fail("no hold target");
  await page.locator(`[data-ops-inbox-hold][data-inbox-id="${holdTarget.id}"]`).click();
  await page.waitForTimeout(300);

  const afterHold = await page.evaluate(
    (id) => window.TasuAdminAiDailyInbox.buildInboxItems().some((i) => i.id === id),
    holdTarget.id
  );
  if (afterHold) fail("hold did not remove item");
  const dismissed = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("tasu_ai_daily_inbox_dismissed_v1") || "[]")
  );
  if (!dismissed.includes(holdTarget.id)) fail("dismissed key not saved");
  pass("保留でインボックスから除外される");

  const inboxWidth = await page.evaluate(() => {
    const el = document.querySelector("[data-ops-daily-inbox]");
    return el ? el.getBoundingClientRect().width : 0;
  });
  if (inboxWidth > 390) fail(`inbox width ${inboxWidth}px > 390`);
  pass("390pxビューポートでレイアウトが収まる");

    });
  console.log("\nAll Daily Inbox tests passed.");
}

main().catch((e) => {
  console.error(e);
  closeAllBrowsers().finally(() => process.exit(1));
});
