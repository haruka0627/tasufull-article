#!/usr/bin/env node
/**
 * トラブルセンター E2E
 *   node scripts/test-support-trouble-center-browser.mjs
 */
import { chromium } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:8765").replace(/\/$/, "");
const INTAKE = "/support-intake.html";
const CENTER = "/support-trouble-center.html";

const TICKETS_KEY = "tasu_support_tickets_v1";
const NOTIFY_KEY = "tasu_support_admin_notifications_v1";

function fail(msg) {
  console.error("FAIL:", msg);
  process.exit(1);
}

function pass(msg) {
  console.log("PASS:", msg);
}

async function clearStorage(page) {
  await page.evaluate(
    (keys) => {
      keys.forEach((k) => localStorage.removeItem(k));
    },
    [TICKETS_KEY, "tasu_support_events_v1", "tasu_connect_issues_v1", NOTIFY_KEY]
  );
}

async function submitViaApi(page, payload) {
  return page.evaluate((p) => window.TasuSupportTicketService.submitInquiry(p), payload);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(`${BASE}${INTAKE}`, { waitUntil: "domcontentloaded" });
  await clearStorage(page);

  const light = await submitViaApi(page, {
    title: "掲載方法を教えてください",
    body: "初めてなのですが掲載方法と料金の確認方法を知りたいです。FAQも見ました。",
    user_id: "test_user_light",
  });
  if (light.ticket.status !== "ai_replied" || light.ticket.category !== "general_auto_reply") {
    fail(`軽い問い合わせ: expected ai_replied/general_auto_reply got ${light.ticket.status}/${light.ticket.category}`);
  }
  pass("軽い問い合わせ → AI自動返信済み");

  const refund = await submitViaApi(page, {
    title: "返金希望",
    body: "先日の注文について全額返金をお願いします。",
    user_id: "test_refund",
  });
  if (refund.ticket.category !== "admin_review" || refund.ticket.status !== "needs_review") {
    fail(`返金: got ${refund.ticket.category}/${refund.ticket.status}`);
  }
  pass("返金問い合わせ → admin_review");

  const cb = await submitViaApi(page, {
    title: "チャージバック",
    body: "Stripeでチャージバック通知が来ました。対応をお願いします。",
    user_id: "test_cb",
  });
  if (cb.ticket.category !== "connect_issue") {
    fail(`チャージバック: category ${cb.ticket.category}`);
  }
  if (cb.ticket.severity !== "critical" && cb.ticket.severity !== "high") {
    fail(`チャージバック: severity ${cb.ticket.severity}`);
  }
  pass("チャージバック → connect_issue + high/critical");

  const abuse = await submitViaApi(page, {
    title: "支払い",
    body: "TASFULを使わず銀行振込で直接支払いしましょう。外部決済で安くできます。",
    user_id: "test_abuse",
  });
  if (abuse.ticket.category !== "abuse_or_policy") {
    fail(`外部決済: ${abuse.ticket.category}`);
  }
  pass("外部決済誘導 → abuse_or_policy");

  const legal = await submitViaApi(page, {
    title: "事故",
    body: "現場で事故が起き損害賠償について法的に対応してください。弁護士も検討します。",
    user_id: "test_legal",
  });
  if (legal.ticket.category !== "legal_or_risk") {
    fail(`法的: ${legal.ticket.category}`);
  }
  pass("法的文言 → legal_or_risk");

  const notifyCount = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) || "[]").filter((n) => !n.read).length,
    NOTIFY_KEY
  );
  if (notifyCount < 4) {
    fail(`管理通知件数不足: ${notifyCount}`);
  }
  pass("high/critical 系は管理通知に記録");

  await page.goto(`${BASE}${CENTER}?ticket=${encodeURIComponent(refund.ticket.id)}`, {
    waitUntil: "domcontentloaded",
  });

  const backHref = await page.locator(".support-trouble-back").getAttribute("href");
  if (backHref !== "admin-operations-dashboard.html") fail(`back href: ${backHref}`);
  const backText = await page.locator(".support-trouble-back").textContent();
  if (!backText?.includes("AI運営司令塔")) fail(`back text: ${backText}`);
  pass("戻るリンクが AI運営司令塔 を指す");

  const crumbText = await page.locator(".support-trouble-crumb").innerText();
  if (!crumbText.includes("TASFUL Admin") || !crumbText.includes("AI運営司令塔")) {
    fail(`breadcrumb: ${crumbText}`);
  }
  pass("パンくずが TASFUL Admin > AI運営司令塔 > 重要問い合わせセンター");

  const originText = await page.locator(".support-trouble-detail .support-trouble-origin").innerText();
  if (!originText.includes("発生元:") || !originText.includes("カテゴリ:")) {
    fail(`origin block: ${originText}`);
  }
  if (!originText.includes("要確認")) fail(`origin category label: ${originText}`);
  pass("詳細に発生元・カテゴリ・対象を表示");

  const notifyVisible = await page.locator("[data-support-notify-bar]").isVisible();
  if (!notifyVisible) fail("管理画面通知バーが表示されない");
  pass("管理画面に重要通知バー");

  await page.locator('[data-support-action="refund"]').click();
  const modal = page.locator("[data-support-confirm-modal]");
  if (await modal.isHidden()) fail("返金ボタンで確認モーダルが開かない");
  pass("管理者ボタンは確認モーダルを挟む");

  await page.locator("[data-support-modal-confirm]").click();
  await page.waitForTimeout(200);

  const afterRefund = await page.evaluate(
    (id) => window.TasuSupportTicketStore.getTicket(id),
    refund.ticket.id
  );
  if (afterRefund.status !== "in_progress") {
    fail(`返金操作後 status: ${afterRefund.status}`);
  }

  await page.locator('[data-support-action="resolved"]').click();
  await page.locator("[data-support-modal-confirm]").click();
  await page.waitForTimeout(200);

  const resolved = await page.evaluate(
    (id) => window.TasuSupportTicketStore.getTicket(id),
    refund.ticket.id
  );
  if (resolved.status !== "resolved" || !resolved.resolved_at) {
    fail("解決済みに変更できない");
  }
  pass("解決済みに変更できる");

  console.log("\nAll support trouble center browser tests passed.");
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
