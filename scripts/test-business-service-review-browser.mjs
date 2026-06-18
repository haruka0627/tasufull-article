#!/usr/bin/env node
/**
 * Step7: 依頼者レビュー投稿 → 詳細ページ反映
 *
 *   BASE_URL=http://127.0.0.1:8765 node scripts/test-business-service-review-browser.mjs
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

function readReviewByDeal(page, dealId) {
  return page.evaluate((id) => {
    const list = JSON.parse(localStorage.getItem("tasu_business_service_reviews_v1") || "[]");
    return list.find((r) => String(r.deal_id) === String(id)) || null;
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
  const providerUrl = new URL(chatUrl);
  providerUrl.searchParams.set("userId", providerId);
  providerUrl.searchParams.delete("dealRole");
  await page.goto(providerUrl.toString(), { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-bsf-estimate-form]", { timeout: 10000 });
  await page.fill("[data-bsf-estimate-amount]", "97000");
  await page.fill("[data-bsf-estimate-note]", "Step7 E2E 見積（レビューテスト）");
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
  url.searchParams.set("dealRole", "client");
  url.searchParams.delete("userId");
  await page.goto(url.toString(), { waitUntil: "domcontentloaded" });
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
  const url = new URL(chatUrl);
  url.searchParams.set("dealRole", "provider");
  url.searchParams.delete("userId");
  await page.goto(url.toString(), { waitUntil: "domcontentloaded" });
  await page.click("[data-bsf-report-work-done]");
  await page.waitForSelector("#bsfWorkCompleteModal:not([hidden])");
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
  const url = new URL(chatUrl);
  url.searchParams.set("dealRole", "client");
  url.searchParams.delete("userId");
  await page.goto(url.toString(), { waitUntil: "domcontentloaded" });
  await page.click("[data-bsf-client-complete]");
  await page.waitForSelector("#bsfDealCompleteModal:not([hidden])");
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

async function payFeeAsProvider(page, chatUrl) {
  const url = new URL(chatUrl);
  url.searchParams.set("dealRole", "provider");
  url.searchParams.delete("userId");
  await page.goto(url.toString(), { waitUntil: "domcontentloaded" });
  await page.click("[data-bsf-pay-fee]");
  await page.waitForSelector("#bsfFeePayModal:not([hidden])");
  await page.click("[data-bsf-fee-pay-confirm]");
  await page.waitForFunction(() => {
    const badge = document.querySelector("[data-bsf-deal-status-badge]")?.textContent || "";
    return badge.includes("完了");
  });
}

async function gotoClientRole(page, chatUrl) {
  const url = new URL(chatUrl);
  url.searchParams.set("dealRole", "client");
  url.searchParams.delete("userId");
  await page.goto(url.toString(), { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#bsfChatDealPanel:not([hidden])", { timeout: 15000 });
}

async function gotoProviderRole(page, chatUrl) {
  const url = new URL(chatUrl);
  url.searchParams.set("dealRole", "provider");
  url.searchParams.delete("userId");
  await page.goto(url.toString(), { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#bsfChatDealPanel:not([hidden])", { timeout: 15000 });
}

async function main() {
  console.log(`\nレビュー投稿 Step7 E2E — ${BASE}\n`);
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
  else pass("chat-detail 開始", dealId);

  await submitEstimateAsProvider(page, dealId, chatUrl);
  pass("→ agreed");

  await approveAsClient(page, dealId, chatUrl);
  pass("→ payment_pending");

  if ((await page.locator("[data-bsf-open-review]").count()) === 0) {
    pass("payment_pending: レビューボタン非表示");
  } else {
    fail("payment_pending: レビューボタン非表示");
  }

  await reportWorkAsProvider(page, dealId, chatUrl);
  pass("→ completed");

  if ((await page.locator("[data-bsf-open-review]").count()) === 0) {
    pass("completed: レビューボタン非表示");
  } else {
    fail("completed: レビューボタン非表示");
  }

  await completeDealAsClient(page, dealId, chatUrl);
  pass("→ fee_pending");

  await gotoClientRole(page, chatUrl);
  if ((await page.locator("[data-bsf-open-review]").count()) === 0) {
    pass("fee_pending: レビューボタン非表示");
  } else {
    fail("fee_pending: レビューボタン非表示");
  }

  await payFeeAsProvider(page, chatUrl);
  const dealPaid = await readDeal(page, dealId);
  if (dealPaid?.status === "fee_paid") pass("→ fee_paid");
  else fail("→ fee_paid", dealPaid?.status);

  await gotoClientRole(page, chatUrl);
  const reviewBtn = page.locator("[data-bsf-open-review]");
  if (await reviewBtn.isVisible()) pass("client: レビュー投稿ボタン表示");
  else fail("client: レビュー投稿ボタン表示");

  await gotoProviderRole(page, chatUrl);
  if ((await page.locator("[data-bsf-open-review]").count()) === 0) {
    pass("provider: レビューボタン非表示");
  } else {
    fail("provider: レビューボタン非表示");
  }

  await gotoClientRole(page, chatUrl);
  await reviewBtn.click();
  await page.waitForSelector("#bsfBusinessReviewModal:not([hidden])", { timeout: 5000 });
  pass("レビューモーダル表示");

  await page.click("[data-bsf-review-star='5']");
  const reviewComment = "Step7 E2E 大変満足でした。丁寧な対応でした。";
  await page.fill("[data-bsf-review-comment]", reviewComment);
  await page.click("[data-bsf-review-submit]");

  await page.waitForSelector("[data-bsf-review-done]", { timeout: 10000 });

  const review = await readReviewByDeal(page, dealId);
  if (review?.rating === 5) pass("rating 保存", String(review.rating));
  else fail("rating 保存", String(review?.rating));

  if (review?.comment === reviewComment) pass("comment 保存");
  else fail("comment 保存", review?.comment || "");

  if (review?.deal_id === dealId) pass("deal_id 保存");
  else fail("deal_id 保存");

  if (review?.service_id) pass("service_id 保存", review.service_id);
  else fail("service_id 保存");

  if (review?.provider_id) pass("provider_id 保存", review.provider_id);
  else fail("provider_id 保存");

  if (review?.client_id) pass("client_id 保存", review.client_id);
  else fail("client_id 保存");

  const dupBlocked = await page.evaluate((id) => {
    try {
      window.TasuBusinessServiceReviewsDb.createReview({
        deal_id: id,
        service_id: "x",
        provider_id: "p",
        client_id: "c",
        rating: 4,
        comment: "dup",
      });
      return false;
    } catch (err) {
      return /すでにレビュー/.test(String(err.message || err));
    }
  }, dealId);
  if (dupBlocked) pass("同一 deal_id 二重投稿不可");
  else fail("同一 deal_id 二重投稿不可");

  if (await page.locator("[data-bsf-review-done]").isVisible()) {
    pass("レビュー投稿済み表示");
  } else {
    fail("レビュー投稿済み表示");
  }

  await page.waitForFunction(() => {
    const hay = document.getElementById("chatMessages")?.textContent || "";
    return hay.includes("レビューが投稿されました");
  });
  pass("レビューシステムメッセージ");

  if (roomId) {
    const thread = await readThreadPreview(page, roomId);
    if (thread.lastMessagePreview?.includes("レビューが投稿されました")) {
      pass("chat-list lastMessagePreview 更新");
    } else {
      fail("chat-list lastMessagePreview 更新", thread.lastMessagePreview || "");
    }
    if (thread.updatedAt) pass("chat-list updatedAt 更新");
    else fail("chat-list updatedAt 更新");
  } else {
    fail("roomId 取得");
  }

  const serviceId = review?.service_id || dealPaid?.service_id || DEMO_ID;
  await page.goto(`${BASE}/detail-business-service.html?id=${encodeURIComponent(serviceId)}`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(() => document.body.dataset.listingLoaded === "true", {
    timeout: 25000,
  });
  await page.waitForFunction(() => {
    const avg = document.querySelector("[data-biz-detail-review-average]")?.textContent || "";
    const count = document.querySelector("[data-biz-detail-review-count]")?.textContent || "";
    return avg.includes("5.0") && count.includes("1");
  });
  pass("詳細: 平均評価・件数反映", "5.0 / 1件");

  const stripText = await page.locator("[data-biz-detail-reviews-strip]").textContent();
  if (stripText?.includes("Step7 E2E") && stripText?.includes("大変満足")) {
    pass("詳細: レビュー一覧反映");
  } else {
    fail("詳細: レビュー一覧反映", stripText?.slice(0, 80) || "");
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(250);
  if (await page.locator("#section-reviews").isVisible()) pass("スマホ幅レイアウト");
  else fail("スマホ幅レイアウト");

  await page.setViewportSize({ width: 1280, height: 800 });
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
