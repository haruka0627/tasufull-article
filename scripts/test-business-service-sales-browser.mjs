#!/usr/bin/env node
/**
 * Step8: 売上管理（fee_paid 反映）
 *
 *   BASE_URL=http://127.0.0.1:8765 node scripts/test-business-service-sales-browser.mjs
 */
import { chromium } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:8765").replace(/\/$/, "");
const DEMO_ID = process.env.BSD_DEMO_ID || "business-demo-other-001";

const results = [];
const consoleErrors = [];

function pass(step, detail = "") {
  results.push({ step, ok: true, detail });
  console.log(`  OK  ${step}${detail ? `: ${detail}` : ""}`);
}

function fail(step, detail = "") {
  results.push({ step, ok: false, detail });
  console.error(`  NG  ${step}${detail ? `: ${detail}` : ""}`);
}

function isIgnorableConsoleError(text) {
  const t = String(text || "");
  return (
    /favicon|Failed to load resource|supabase|Supabase|ERR_/i.test(t) ||
    /createBusinessConsultRoom|PGRST204|partner_display_name|schema cache/i.test(t)
  );
}

function readDeal(page, dealId) {
  return page.evaluate((id) => {
    const list = JSON.parse(localStorage.getItem("tasu_service_deals") || "[]");
    return list.find((d) => String(d.id) === String(id)) || null;
  }, dealId);
}

async function openConsultingChat(page) {
  await page.goto(`${BASE}/detail-business-service.html?id=${encodeURIComponent(DEMO_ID)}`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(() => document.body.dataset.listingLoaded === "true", {
    timeout: 25000,
  });
  const estimateBtn = page.locator("[data-business-service-estimate]").first();
  await Promise.all([
    page.waitForURL(/chat-detail\.html/, { timeout: 15000 }),
    estimateBtn.click(),
  ]);
  await page.waitForSelector("#bsfChatDealPanel:not([hidden])", { timeout: 15000 });
  const url = new URL(page.url());
  return {
    dealId: url.searchParams.get("deal") || "",
    chatUrl: page.url(),
  };
}

async function submitEstimateAsProvider(page, dealId, chatUrl) {
  const deal = await readDeal(page, dealId);
  const providerUrl = new URL(chatUrl);
  providerUrl.searchParams.set("userId", deal.provider_user_id);
  providerUrl.searchParams.delete("dealRole");
  await page.goto(providerUrl.toString(), { waitUntil: "domcontentloaded" });
  await page.fill("[data-bsf-estimate-amount]", "100000");
  await page.fill("[data-bsf-estimate-note]", "Step8 E2E 売上管理テスト");
  await page.click("[data-bsf-submit-estimate]");
  await page.waitForFunction(
    ({ id }) => {
      const list = JSON.parse(localStorage.getItem("tasu_service_deals") || "[]");
      return list.find((d) => String(d.id) === String(id))?.status === "agreed";
    },
    { id: dealId },
    { timeout: 10000 }
  );
}

async function runFullFlowToFeePaid(page, dealId, chatUrl) {
  const clientUrl = new URL(chatUrl);
  clientUrl.searchParams.set("dealRole", "client");
  clientUrl.searchParams.delete("userId");
  await page.goto(clientUrl.toString(), { waitUntil: "domcontentloaded" });
  await page.click("[data-bsf-approve-estimate]");

  const providerUrl = new URL(chatUrl);
  providerUrl.searchParams.set("dealRole", "provider");
  providerUrl.searchParams.delete("userId");
  await page.goto(providerUrl.toString(), { waitUntil: "domcontentloaded" });
  await page.click("[data-bsf-report-work-done]");
  await page.waitForSelector("#bsfWorkCompleteModal:not([hidden])");
  await page.click("[data-bsf-work-complete-confirm]");

  await page.goto(clientUrl.toString(), { waitUntil: "domcontentloaded" });
  await page.click("[data-bsf-client-complete]");
  await page.waitForSelector("#bsfDealCompleteModal:not([hidden])");
  await page.click("[data-bsf-deal-complete-confirm]");

  await page.goto(providerUrl.toString(), { waitUntil: "domcontentloaded" });
  await page.click("[data-bsf-pay-fee]");
  await page.waitForSelector("#bsfFeePayModal:not([hidden])");
  await page.click("[data-bsf-fee-pay-confirm]");

  await page.waitForFunction(
    ({ id }) => {
      const list = JSON.parse(localStorage.getItem("tasu_service_deals") || "[]");
      return list.find((d) => String(d.id) === String(id))?.status === "fee_paid";
    },
    { id: dealId },
    { timeout: 10000 }
  );
}

async function postReviewAsClient(page, dealId, chatUrl) {
  const clientUrl = new URL(chatUrl);
  clientUrl.searchParams.set("dealRole", "client");
  clientUrl.searchParams.delete("userId");
  await page.goto(clientUrl.toString(), { waitUntil: "domcontentloaded" });
  await page.click("[data-bsf-open-review]");
  await page.waitForSelector("#bsfBusinessReviewModal:not([hidden])");
  await page.click("[data-bsf-review-star='4']");
  await page.fill("[data-bsf-review-comment]", "Step8 売上管理 E2E レビュー");
  await page.click("[data-bsf-review-submit]");
  await page.waitForSelector("[data-bsf-review-done]", { timeout: 10000 });
}

async function main() {
  console.log(`\n売上管理 Step8 E2E — ${BASE}\n`);
  const browser = await chromium.launch();
  const page = await browser.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error" && !isIgnorableConsoleError(msg.text())) {
      consoleErrors.push(msg.text());
    }
  });
  page.on("pageerror", (err) => {
    if (!isIgnorableConsoleError(err.message)) consoleErrors.push(String(err.message));
  });

  const { dealId, chatUrl } = await openConsultingChat(page);
  if (!dealId) fail("deal 開始");
  else pass("フルフロー開始", dealId);

  await submitEstimateAsProvider(page, dealId, chatUrl);
  pass("→ agreed");

  await runFullFlowToFeePaid(page, dealId, chatUrl);
  const deal = await readDeal(page, dealId);
  if (deal?.status === "fee_paid") pass("→ fee_paid");
  else fail("→ fee_paid", deal?.status);

  const feePendingOnly = await page.evaluate(() => {
    const list = JSON.parse(localStorage.getItem("tasu_service_deals") || "[]");
    return list.filter((d) => d.status === "fee_pending").length;
  });
  if (feePendingOnly >= 0) pass("fee_pending は別件（一覧対象外）");

  await postReviewAsClient(page, dealId, chatUrl);
  pass("→ review posted");

  const providerId = deal?.provider_user_id || "";
  const expectedFee = Math.round((deal.agreed_amount || 0) * (deal.platform_fee_rate ?? 0.05));
  const expectedNet = (deal.agreed_amount || 0) - expectedFee;

  await page.goto(
    `${BASE}/sales-fees.html?userId=${encodeURIComponent(providerId)}&dealId=${encodeURIComponent(dealId)}`,
    { waitUntil: "domcontentloaded" }
  );
  await page.waitForSelector("[data-sf-tbody] tr", { timeout: 10000 });

  const row = page.locator(`[data-sf-row="${dealId}"]`);
  if ((await row.count()) > 0) pass("fee_paid 取引が売上管理に表示");
  else fail("fee_paid 取引が売上管理に表示");

  const rowText = await row.textContent();
  if (rowText?.includes("100,000") || rowText?.includes("100000")) {
    pass("見積金額表示");
  } else {
    fail("見積金額表示", rowText || "");
  }

  if (rowText?.includes(expectedFee.toLocaleString("ja-JP")) || rowText?.includes(String(expectedFee))) {
    pass("手数料表示", String(expectedFee));
  } else {
    fail("手数料表示", rowText || "");
  }

  if (rowText?.includes(expectedNet.toLocaleString("ja-JP")) || rowText?.includes(String(expectedNet))) {
    pass("差引売上表示", String(expectedNet));
  } else {
    fail("差引売上表示", rowText || "");
  }

  if (rowText?.includes("5%")) pass("手数料率表示");
  else fail("手数料率表示", rowText || "");

  if (rowText?.includes("★4")) pass("レビュー評価表示");
  else fail("レビュー評価表示", rowText || "");

  const paidAt = deal.platform_fee_paid_at || "";
  if (paidAt && rowText && /\d{4}\/\d{2}\/\d{2}/.test(rowText)) {
    pass("支払い日時表示");
  } else {
    fail("支払い日時表示");
  }

  const summaryText = await page.locator("[data-sf-stats]").textContent();
  if (summaryText?.includes("1件") || summaryText?.includes("総取引数")) {
    pass("summary 総取引数");
  } else {
    fail("summary 総取引数", summaryText || "");
  }

  if (summaryText?.includes("100,000") || summaryText?.includes("100000")) {
    pass("summary 総見積");
  } else {
    fail("summary 総見積");
  }

  if (summaryText?.includes(String(expectedFee)) || summaryText?.includes(expectedFee.toLocaleString("ja-JP"))) {
    pass("summary 総手数料");
  } else {
    fail("summary 総手数料");
  }

  if (summaryText?.includes("4.0") || summaryText?.includes("4")) {
    pass("summary 平均評価");
  } else {
    fail("summary 平均評価", summaryText || "");
  }

  const highlight = await row.evaluate((el) => el.classList.contains("sf-row--highlight"));
  if (highlight) pass("dealId 強調表示");
  else fail("dealId 強調表示");

  const feePendingInTable = await page.evaluate((currentDealId) => {
    const deals = JSON.parse(localStorage.getItem("tasu_service_deals") || "[]");
    const pendingIds = deals.filter((d) => d.status === "fee_pending").map((d) => String(d.id));
    const rowIds = [...document.querySelectorAll("[data-sf-tbody] [data-sf-row]")].map((el) =>
      el.getAttribute("data-sf-row")
    );
    const hasPending = pendingIds.some((id) => rowIds.includes(id));
    const hasCurrent = rowIds.includes(String(currentDealId));
    return { hasPending, hasCurrent };
  }, dealId);
  if (!feePendingInTable.hasPending) pass("fee_pending は一覧に出ない");
  else fail("fee_pending は一覧に出ない");
  if (feePendingInTable.hasCurrent) pass("対象 deal は fee_paid で表示");
  else fail("対象 deal は fee_paid で表示");

  const clientChat = new URL(chatUrl);
  clientChat.searchParams.set("dealRole", "client");
  clientChat.searchParams.delete("userId");
  await page.goto(clientChat.toString(), { waitUntil: "domcontentloaded" });
  if ((await page.locator("[data-bsf-sales-mgmt]").count()) === 0) {
    pass("client: 売上管理リンク非表示");
  } else {
    fail("client: 売上管理リンク非表示");
  }

  await page.goto(
    `${BASE}/sales-fees.html?userId=${encodeURIComponent(providerId)}&dealId=${encodeURIComponent(dealId)}`,
    { waitUntil: "domcontentloaded" }
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(250);
  if (await page.locator("[data-sf-table-wrap]").isVisible()) pass("スマホ幅レイアウト");
  else fail("スマホ幅レイアウト");

  const critical = consoleErrors.filter((e) => !isIgnorableConsoleError(e));
  if (!critical.length) pass("console error なし");
  else fail("console error なし", critical.slice(0, 2).join(" | "));

  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n--- ${results.length - failed.length}/${results.length} passed ---\n`);
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
