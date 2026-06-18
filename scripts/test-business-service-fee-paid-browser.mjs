#!/usr/bin/env node
/**
 * Step6: 掲載者の手数料デモ支払い → fee_paid
 *
 *   BASE_URL=http://127.0.0.1:8765 node scripts/test-business-service-fee-paid-browser.mjs
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
  await page.fill("[data-bsf-estimate-amount]", "96000");
  await page.fill("[data-bsf-estimate-note]", "Step6 E2E 見積（手数料支払いテスト）");
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

async function completeDealAsClient(page, dealId, chatUrl) {
  await gotoClientRole(page, chatUrl);
  await page.click("[data-bsf-client-complete]");
  await page.waitForSelector("#bsfDealCompleteModal:not([hidden])", { timeout: 5000 });
  await page.click("[data-bsf-deal-complete-confirm]");
  await page.waitForFunction(
    ({ id }) => {
      const list = JSON.parse(localStorage.getItem("tasu_service_deals") || "[]");
      return list.find((d) => String(d.id) === String(id))?.status === "fee_pending";
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
  console.log(`\n手数料支払い Step6 E2E — ${BASE}\n`);
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

  const { dealId, roomId, chatUrl } = await openConsultingChat(page);
  if (!dealId) fail("deal 付き chat-detail");
  else pass("業務詳細CTA → chat-detail", dealId);

  await submitEstimateAsProvider(page, dealId, chatUrl);
  pass("consulting → agreed");

  await approveAsClient(page, dealId, chatUrl);
  pass("→ payment_pending");

  await reportWorkAsProvider(page, dealId, chatUrl);
  pass("→ completed");

  await completeDealAsClient(page, dealId, chatUrl);
  const dealFeePending = await readDeal(page, dealId);
  if (dealFeePending?.status === "fee_pending") pass("→ fee_pending");
  else fail("→ fee_pending", dealFeePending?.status);

  await gotoProviderRole(page, chatUrl);
  const payBtn = page.locator("[data-bsf-pay-fee]");
  if (await payBtn.isVisible()) pass("掲載者: 手数料を支払うボタン表示");
  else fail("掲載者: 手数料を支払うボタン表示");

  await gotoClientRole(page, chatUrl);
  if ((await page.locator("[data-bsf-pay-fee]").count()) === 0) {
    pass("依頼者: 手数料支払いボタン非表示");
  } else {
    fail("依頼者: 手数料支払いボタン非表示");
  }

  await gotoProviderRole(page, chatUrl);
  await payBtn.click();
  await page.waitForSelector("#bsfFeePayModal:not([hidden])", { timeout: 5000 });
  const modalText = await page.locator("#bsfFeePayModal").textContent();
  if (modalText?.includes("手数料を支払いますか") && modalText?.includes("完了になります")) {
    pass("確認モーダル表示");
  } else {
    fail("確認モーダル表示");
  }

  await page.click("[data-bsf-fee-pay-confirm]");
  await page.waitForFunction(
    ({ id }) => {
      const list = JSON.parse(localStorage.getItem("tasu_service_deals") || "[]");
      return list.find((d) => String(d.id) === String(id))?.status === "fee_paid";
    },
    { id: dealId },
    { timeout: 10000 }
  );

  const dealPaid = await readDeal(page, dealId);
  if (dealPaid?.status === "fee_paid") pass("fee_pending → fee_paid");
  else fail("fee_pending → fee_paid", dealPaid?.status);

  if (dealPaid?.platform_fee_paid_at && !Number.isNaN(Date.parse(dealPaid.platform_fee_paid_at))) {
    pass("platform_fee_paid_at ISO 保存");
  } else {
    fail("platform_fee_paid_at ISO 保存", dealPaid?.platform_fee_paid_at || "");
  }

  if (dealPaid?.platform_fee_payment_method === "demo") pass("platform_fee_payment_method === demo");
  else fail("platform_fee_payment_method", dealPaid?.platform_fee_payment_method || "");

  if (dealPaid?.platform_fee_payment_status === "paid") pass("platform_fee_payment_status === paid");
  else fail("platform_fee_payment_status", dealPaid?.platform_fee_payment_status || "");

  if (String(dealPaid?.platform_fee_transaction_id || "").startsWith("demo_fee_")) {
    pass("platform_fee_transaction_id 保存", dealPaid.platform_fee_transaction_id);
  } else {
    fail("platform_fee_transaction_id 保存", dealPaid?.platform_fee_transaction_id || "");
  }

  if (dealPaid?.updated_at) pass("updated_at 更新");
  else fail("updated_at 更新");

  await page.waitForFunction(() => {
    const hay = document.getElementById("chatMessages")?.textContent || "";
    return hay.includes("手数料の支払いが完了しました") && hay.includes("取引が完了しました");
  });
  pass("手数料完了システムメッセージ");

  if (roomId) {
    const thread = await readThreadPreview(page, roomId);
    if (thread.lastMessagePreview?.includes("手数料の支払いが完了しました")) {
      pass("chat-list lastMessagePreview 更新", thread.lastMessagePreview.slice(0, 40));
    } else {
      fail("chat-list lastMessagePreview 更新", thread.lastMessagePreview || "(empty)");
    }
    if (thread.updatedAt) pass("chat-list updatedAt 更新");
    else fail("chat-list updatedAt 更新");
  } else {
    fail("roomId 取得");
  }

  await gotoProviderRole(page, chatUrl);
  const badgeProv = await page.locator("[data-bsf-deal-status-badge]").textContent();
  if (badgeProv?.includes("完了")) pass("掲載者 fee_paid UI: 完了", badgeProv.trim());
  else fail("掲載者 fee_paid UI", badgeProv || "");

  const salesLink = page.locator("[data-bsf-sales-mgmt]");
  if (await salesLink.isVisible()) pass("掲載者: 売上管理導線");
  else fail("掲載者: 売上管理導線");

  const provWait = await page.locator(".bsf-deal-panel__waiting").textContent();
  if (provWait?.includes("手数料の支払いが完了し")) pass("掲載者: 完了説明");
  else fail("掲載者: 完了説明", provWait || "");

  await gotoClientRole(page, chatUrl);
  const badgeCli = await page.locator("[data-bsf-deal-status-badge]").textContent();
  if (badgeCli?.includes("取引完了")) pass("依頼者 fee_paid UI: 取引完了", badgeCli.trim());
  else fail("依頼者 fee_paid UI", badgeCli || "");

  const cliWait = await page.locator(".bsf-deal-panel__waiting").textContent();
  if (cliWait?.includes("この取引は完了しました")) pass("依頼者: 完了説明");
  else fail("依頼者: 完了説明", cliWait || "");

  if (await page.locator("[data-bsf-open-review]").isVisible()) pass("依頼者: レビュー導線");
  else fail("依頼者: レビュー導線");

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

  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n--- ${results.length - failed.length}/${results.length} passed ---\n`);
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
