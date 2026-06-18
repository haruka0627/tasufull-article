#!/usr/bin/env node
/**
 * Step4: 掲載者の作業完了報告
 *
 *   BASE_URL=http://127.0.0.1:8765 node scripts/test-business-service-work-complete-browser.mjs
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
  await page.fill("[data-bsf-estimate-amount]", "88000");
  await page.fill("[data-bsf-estimate-note]", "Step4 E2E 見積（作業完了テスト）");
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
  console.log(`\n作業完了報告 Step4 E2E — ${BASE}\n`);
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
  if (!dealId) fail("deal 付き chat-detail");
  else pass("業務詳細CTA → chat-detail", dealId);

  await submitEstimateAsProvider(page, dealId, chatUrl);
  pass("掲載者: 見積送信 → agreed");

  await approveAsClient(page, dealId, chatUrl);
  const dealPending = await readDeal(page, dealId);
  if (dealPending?.status === "payment_pending") pass("依頼者承認 → payment_pending");
  else fail("依頼者承認 → payment_pending", dealPending?.status);

  await gotoProviderRole(page, chatUrl);
  const reportBtn = page.locator("[data-bsf-report-work-done]");
  if (await reportBtn.isVisible()) pass("掲載者: 作業完了報告ボタン表示");
  else fail("掲載者: 作業完了報告ボタン表示");

  const summaryProvider = await page.locator("[data-bsf-estimate-summary]").isVisible();
  if (summaryProvider) pass("掲載者: 見積サマリー表示");
  else fail("掲載者: 見積サマリー表示");

  await reportBtn.click();
  await page.waitForSelector("#bsfWorkCompleteModal:not([hidden])", { timeout: 5000 });
  const modalText = await page.locator("#bsfWorkCompleteModal").textContent();
  if (modalText?.includes("作業完了として報告しますか")) pass("確認モーダル表示");
  else fail("確認モーダル表示");

  await page.click("[data-bsf-work-complete-confirm]");
  await page.waitForFunction(
    ({ id }) => {
      const list = JSON.parse(localStorage.getItem("tasu_service_deals") || "[]");
      return list.find((d) => String(d.id) === String(id))?.status === "completed";
    },
    { id: dealId },
    { timeout: 10000 }
  );

  const dealDone = await readDeal(page, dealId);
  if (dealDone?.status === "completed") pass("報告 → completed");
  else fail("報告 → completed", dealDone?.status);

  if (dealDone?.work_completed_at) pass("work_completed_at 保存");
  else fail("work_completed_at 保存");

  await page.waitForFunction(() => {
    const hay = document.getElementById("chatMessages")?.textContent || "";
    return hay.includes("作業完了が報告されました") && hay.includes("依頼者の確認を待っています");
  });
  pass("作業完了システムメッセージ");

  const badgeProvider = await page.locator("[data-bsf-deal-status-badge]").textContent();
  if (badgeProvider?.includes("作業完了")) pass("掲載者 UI: 作業完了", badgeProvider.trim());
  else fail("掲載者 UI: 作業完了", badgeProvider || "");

  const providerWait = await page.locator(".bsf-deal-panel__waiting").textContent();
  if (providerWait?.includes("依頼者の取引完了確認を待っています")) {
    pass("掲載者: 依頼者確認待ち表示");
  } else {
    fail("掲載者: 依頼者確認待ち表示", providerWait || "");
  }

  await gotoClientRole(page, chatUrl);
  const clientCompleteBtn = page.locator("[data-bsf-client-complete]");
  if (await clientCompleteBtn.isVisible()) pass("依頼者: 取引を完了するボタン表示");
  else fail("依頼者: 取引を完了するボタン表示");

  const clientNote = await page.locator(".bsf-deal-panel__complete-note").textContent();
  if (clientNote?.includes("内容を確認してから完了")) pass("依頼者: 完了前の説明");
  else fail("依頼者: 完了前の説明", clientNote || "");

  const clientReport = page.locator("[data-bsf-report-work-done]");
  if ((await clientReport.count()) === 0) pass("依頼者: 作業完了報告ボタンなし（権限制御）");
  else fail("依頼者: 作業完了報告ボタンなし（権限制御）");

  const badgeClient = await page.locator("[data-bsf-deal-status-badge]").textContent();
  if (badgeClient?.includes("作業完了")) pass("依頼者 UI: 作業完了", badgeClient.trim());
  else fail("依頼者 UI: 作業完了", badgeClient || "");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(250);
  if (await page.locator("#bsfChatDealPanel:not([hidden])").isVisible()) {
    pass("スマホ幅レイアウト");
  } else {
    fail("スマホ幅レイアウト");
  }

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(200);
  if (await page.locator("#bsfChatDealPanel:not([hidden])").isVisible()) {
    pass("PC幅レイアウト");
  } else {
    fail("PC幅レイアウト");
  }

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
