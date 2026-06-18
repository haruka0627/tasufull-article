#!/usr/bin/env node
/**
 * Step3: 見積承認・差し戻し
 *
 *   BASE_URL=http://127.0.0.1:8765 node scripts/test-business-service-estimate-approval-browser.mjs
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
  await page.fill("[data-bsf-estimate-amount]", "92000");
  await page.fill("[data-bsf-estimate-note]", "Step3 E2E 見積（承認テスト）");
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
  console.log(`\n見積承認 Step3 E2E — ${BASE}\n`);
  await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage();

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

  await gotoClientRole(page, chatUrl);
  const approveVisible = await page.locator("[data-bsf-approve-estimate]").isVisible();
  if (approveVisible) pass("依頼者: 承認ボタン表示");
  else fail("依頼者: 承認ボタン表示");

  const summaryVisible = await page.locator("[data-bsf-estimate-summary]").isVisible();
  if (summaryVisible) pass("依頼者: 見積サマリー表示");
  else fail("依頼者: 見積サマリー表示");

  await page.click("[data-bsf-approve-estimate]");
  await page.waitForFunction(
    ({ id }) => {
      const list = JSON.parse(localStorage.getItem("tasu_service_deals") || "[]");
      return list.find((d) => String(d.id) === String(id))?.status === "payment_pending";
    },
    { id: dealId },
    { timeout: 10000 }
  );

  const dealApproved = await readDeal(page, dealId);
  if (dealApproved?.status === "payment_pending") pass("承認 → payment_pending");
  else fail("承認 → payment_pending", dealApproved?.status);

  if (dealApproved?.approved_at) pass("approved_at 保存");
  else fail("approved_at 保存");

  await page.waitForFunction(() => {
    const hay = document.getElementById("chatMessages")?.textContent || "";
    return hay.includes("見積が承認され、取引が開始されました");
  });
  pass("承認システムメッセージ");

  const badge = await page.locator("[data-bsf-deal-status-badge]").textContent();
  if (badge?.includes("取引進行中")) pass("UI: 取引進行中", badge.trim());
  else fail("UI: 取引進行中", badge || "");

  await gotoProviderRole(page, chatUrl);
  const providerApprove = page.locator("[data-bsf-approve-estimate]");
  if ((await providerApprove.count()) === 0) pass("掲載者: 承認ボタンなし");
  else fail("掲載者: 承認ボタンなし（権限制御）");

  const pageReject = await browser.newPage();
  pageReject.on("console", (msg) => {
    if (msg.type() === "error" && !isIgnorableConsoleError(msg.text())) {
      consoleErrors.push(msg.text());
    }
  });
  const rejectFlow = await openConsultingChat(pageReject);
  const rejectDealId = rejectFlow.dealId;
  await submitEstimateAsProvider(pageReject, rejectDealId, rejectFlow.chatUrl);
  await gotoClientRole(pageReject, rejectFlow.chatUrl);

  await pageReject.waitForSelector("[data-bsf-reject-estimate]", { timeout: 15000 });
  await pageReject.click("[data-bsf-reject-estimate]");
  await pageReject.waitForSelector("[data-bsf-reject-form]:not([hidden])");
  const rejectReason = "金額内訳の再提示をお願いします（E2E）";
  await pageReject.fill("[data-bsf-reject-reason]", rejectReason);
  await pageReject.click("[data-bsf-submit-reject]");

  await pageReject.waitForFunction(
    ({ id }) => {
      const list = JSON.parse(localStorage.getItem("tasu_service_deals") || "[]");
      return list.find((d) => String(d.id) === String(id))?.status === "consulting";
    },
    { id: rejectDealId },
    { timeout: 10000 }
  );

  const dealRejected = await readDeal(pageReject, rejectDealId);
  if (dealRejected?.status === "consulting") pass("差し戻し → consulting");
  else fail("差し戻し → consulting", dealRejected?.status);

  if (dealRejected?.estimate_reject_reason?.includes("金額内訳")) {
    pass("estimate_reject_reason 保存");
  } else {
    fail("estimate_reject_reason 保存", dealRejected?.estimate_reject_reason || "");
  }

  if (dealRejected?.estimate_rejected_at) pass("estimate_rejected_at 保存");
  else fail("estimate_rejected_at 保存");

  await pageReject.waitForFunction(() => {
    const hay = document.getElementById("chatMessages")?.textContent || "";
    return hay.includes("見積が差し戻されました") && hay.includes("金額内訳");
  });
  pass("差し戻しシステムメッセージ");

  await gotoProviderRole(pageReject, rejectFlow.chatUrl);
  await pageReject.waitForSelector("[data-bsf-estimate-form]", { timeout: 10000 });
  pass("差し戻し後: 掲載者が再見積フォーム表示");

  await pageReject.setViewportSize({ width: 390, height: 844 });
  await pageReject.waitForTimeout(250);
  if (await pageReject.locator("#bsfChatDealPanel:not([hidden])").isVisible()) {
    pass("スマホ幅レイアウト");
  } else {
    fail("スマホ幅レイアウト");
  }

  await pageReject.close();

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
