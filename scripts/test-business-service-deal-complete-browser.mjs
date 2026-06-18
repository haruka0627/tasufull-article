#!/usr/bin/env node
/**
 * Step5: 依頼者の取引完了 → fee_pending
 *
 *   BASE_URL=http://127.0.0.1:8765 node scripts/test-business-service-deal-complete-browser.mjs
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

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

function readThreadPreview(page, roomId) {
  return page.evaluate((rid) => {
    const seed = JSON.parse(localStorage.getItem("tasu_chat_seed_v1") || "{}");
    const t = (seed.threads || []).find((x) => String(x.id) === String(rid));
    return {
      lastMessagePreview: t?.lastMessagePreview || "",
      updatedAt: t?.updatedAt || t?.updated_at || "",
    };
  }, roomId);
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
    roomId: url.searchParams.get("roomId") || url.searchParams.get("room") || "",
    chatUrl: page.url(),
  };
}

async function submitEstimateAsProvider(page, dealId, chatUrl) {
  const deal = await readDeal(page, dealId);
  const providerId = deal?.provider_user_id || "";
  if (!providerId) throw new Error("provider_user_id missing");

  const providerUrl = new URL(chatUrl);
  providerUrl.searchParams.set("userId", providerId);
  providerUrl.searchParams.delete("dealRole");
  await page.goto(providerUrl.toString(), { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-bsf-estimate-form]", { timeout: 10000 });
  await page.fill("[data-bsf-estimate-amount]", "95000");
  await page.fill("[data-bsf-estimate-note]", "Step5 E2E 見積（取引完了テスト）");
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

async function approveAsClient(page, dealId, chatUrl) {
  const url = new URL(chatUrl);
  url.searchParams.delete("userId");
  url.searchParams.set("dealRole", "client");
  await page.goto(url.toString(), { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-bsf-approve-estimate]", { timeout: 15000 });
  await page.click("[data-bsf-approve-estimate]");
  await page.waitForFunction(
    ({ id }) => {
      const list = JSON.parse(localStorage.getItem("tasu_service_deals") || "[]");
      return list.find((d) => String(d.id) === String(id))?.status === "payment_pending";
    },
    { id: dealId },
    { timeout: 10000 }
  );
}

async function reportWorkAsProvider(page, dealId, chatUrl) {
  await gotoProviderRole(page, chatUrl);
  await page.click("[data-bsf-report-work-done]");
  await page.waitForSelector("#bsfWorkCompleteModal:not([hidden])", { timeout: 5000 });
  await page.click("[data-bsf-work-complete-confirm]");
  await page.waitForFunction(
    ({ id }) => {
      const list = JSON.parse(localStorage.getItem("tasu_service_deals") || "[]");
      return list.find((d) => String(d.id) === String(id))?.status === "completed";
    },
    { id: dealId },
    { timeout: 10000 }
  );
}

async function gotoClientRole(page, chatUrl) {
  const url = new URL(chatUrl);
  url.searchParams.delete("userId");
  url.searchParams.set("dealRole", "client");
  await page.goto(url.toString(), { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#bsfChatDealPanel:not([hidden])", { timeout: 15000 });
}

async function gotoProviderRole(page, chatUrl) {
  const url = new URL(chatUrl);
  url.searchParams.delete("userId");
  url.searchParams.set("dealRole", "provider");
  await page.goto(url.toString(), { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#bsfChatDealPanel:not([hidden])", { timeout: 15000 });
}

async function main() {
  console.log(`\n取引完了 Step5 E2E — ${BASE}\n`);
  await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error" && !isIgnorableConsoleError(msg.text())) {
      consoleErrors.push(msg.text());
    }
  });
  page.on("pageerror", (err) => {
    if (!isIgnorableConsoleError(err.message)) consoleErrors.push(String(err.message));
  });

  const { dealId, roomId, chatUrl } = await openConsultingChat(page);
  if (!dealId) fail("deal 付き chat-detail");
  else pass("業務詳細CTA → chat-detail", dealId);

  await submitEstimateAsProvider(page, dealId, chatUrl);
  pass("consulting → agreed");

  await approveAsClient(page, dealId, chatUrl);
  const dealPay = await readDeal(page, dealId);
  if (dealPay?.status === "payment_pending") pass("agreed → payment_pending");
  else fail("agreed → payment_pending", dealPay?.status);

  await reportWorkAsProvider(page, dealId, chatUrl);
  const dealWork = await readDeal(page, dealId);
  if (dealWork?.status === "completed") pass("payment_pending → completed");
  else fail("payment_pending → completed", dealWork?.status);

  await gotoClientRole(page, chatUrl);
  const completeBtn = page.locator("[data-bsf-client-complete]");
  if (await completeBtn.isVisible()) pass("依頼者: 取引を完了するボタン表示");
  else fail("依頼者: 取引を完了するボタン表示");

  const providerComplete = page.locator("[data-bsf-client-complete]");
  await gotoProviderRole(page, chatUrl);
  if ((await providerComplete.count()) === 0) pass("掲載者: 取引完了ボタン非表示");
  else fail("掲載者: 取引完了ボタン非表示");

  await gotoClientRole(page, chatUrl);
  await completeBtn.click();
  await page.waitForSelector("#bsfDealCompleteModal:not([hidden])", { timeout: 5000 });
  const modalBody = await page.locator("#bsfDealCompleteModal").textContent();
  if (modalBody?.includes("取引を完了しますか") && modalBody?.includes("手数料支払い待ち")) {
    pass("確認モーダル表示");
  } else {
    fail("確認モーダル表示");
  }

  await page.click("[data-bsf-deal-complete-confirm]");
  await page.waitForFunction(
    ({ id }) => {
      const list = JSON.parse(localStorage.getItem("tasu_service_deals") || "[]");
      return list.find((d) => String(d.id) === String(id))?.status === "fee_pending";
    },
    { id: dealId },
    { timeout: 10000 }
  );

  const dealFee = await readDeal(page, dealId);
  if (dealFee?.status === "fee_pending") pass("completed → fee_pending");
  else fail("completed → fee_pending", dealFee?.status);

  if (dealFee?.deal_completed_at && !Number.isNaN(Date.parse(dealFee.deal_completed_at))) {
    pass("deal_completed_at ISO 保存");
  } else {
    fail("deal_completed_at ISO 保存", dealFee?.deal_completed_at || "");
  }

  if (dealFee?.updated_at && dealFee.updated_at >= (dealFee.deal_completed_at || "")) {
    pass("updated_at 更新");
  } else {
    fail("updated_at 更新", `${dealFee?.updated_at || ""}`);
  }

  await page.waitForFunction(() => {
    const hay = document.getElementById("chatMessages")?.textContent || "";
    return hay.includes("取引が完了しました") && hay.includes("手数料支払いを待っています");
  });
  pass("取引完了システムメッセージ");

  if (roomId) {
    const thread = await readThreadPreview(page, roomId);
    if (thread.lastMessagePreview?.includes("取引が完了しました")) {
      pass("chat-list lastMessagePreview 更新", thread.lastMessagePreview.slice(0, 40));
    } else {
      fail("chat-list lastMessagePreview 更新", thread.lastMessagePreview || "(empty)");
    }
    if (thread.updatedAt) pass("chat-list updatedAt 更新", thread.updatedAt.slice(0, 24));
    else fail("chat-list updatedAt 更新");
  } else {
    fail("roomId 取得");
  }

  const badgeClient = await page.locator("[data-bsf-deal-status-badge]").textContent();
  if (badgeClient?.includes("取引完了")) pass("依頼者 fee_pending UI: 取引完了", badgeClient.trim());
  else fail("依頼者 fee_pending UI: 取引完了", badgeClient || "");

  const clientWait = await page.locator(".bsf-deal-panel__waiting").textContent();
  if (clientWait?.includes("手数料支払いを待っています")) pass("依頼者: 手数料待ち説明");
  else fail("依頼者: 手数料待ち説明", clientWait || "");

  const reviewBtn = page.locator("[data-bsf-open-review]");
  if ((await reviewBtn.count()) === 0) pass("依頼者 fee_pending: レビュー導線は未表示（fee_paid で表示）");
  else fail("依頼者 fee_pending: レビュー導線は未表示", "button visible");

  await gotoProviderRole(page, chatUrl);
  const badgeProvider = await page.locator("[data-bsf-deal-status-badge]").textContent();
  if (badgeProvider?.includes("手数料支払い待ち")) {
    pass("掲載者 fee_pending UI: 手数料支払い待ち", badgeProvider.trim());
  } else {
    fail("掲載者 fee_pending UI: 手数料支払い待ち", badgeProvider || "");
  }

  const payFeeBtn = page.locator("[data-bsf-pay-fee]");
  if (await payFeeBtn.isVisible()) pass("掲載者: 手数料を支払うボタン");
  else fail("掲載者: 手数料を支払うボタン");

  const providerHint = await page.locator(".bsf-deal-panel__hint").textContent();
  if (providerHint?.includes("手数料の支払いを行ってください")) pass("掲載者: 手数料支払い説明");
  else fail("掲載者: 手数料支払い説明", providerHint || "");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(250);
  if (await page.locator("#bsfChatDealPanel:not([hidden])").isVisible()) pass("スマホ幅レイアウト");
  else fail("スマホ幅レイアウト");

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(200);
  if (await page.locator("#bsfChatDealPanel:not([hidden])").isVisible()) pass("PC幅レイアウト");
  else fail("PC幅レイアウト");

  const critical = consoleErrors.filter((e) => !isIgnorableConsoleError(e));
  if (!critical.length) pass("console error なし");
  else fail("console error なし", critical.slice(0, 2).join(" | "));

    });
  const failed = results.filter((r) => !r.ok);
  console.log(`\n--- ${results.length - failed.length}/${results.length} passed ---\n`);
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

await closeAllBrowsers();
