#!/usr/bin/env node
/**
 * ワーカー review=worker モード — 390px スクショ（通知 / TALK / 導線）
 */
import { chromium } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { requireDevServer, devUrl } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const OUT = path.join("screenshots", "platform-worker-review-mode");
const VIEWPORT = { width: 390, height: 844 };

const REQUEST_NOTIFY_ID = "platform-verify-worker-request-001";
const COMPLETE_NOTIFY_ID = "platform-verify-worker-connect-complete-001";
const SELLER_ID = "u_worker";

const URLS = {
  notifyTab: `talk-home.html?tab=notify&review=worker&talkDev=1&userId=${SELLER_ID}`,
  talkRoom: "talk-home.html?tab=chat&thread=official_tasful&review=worker&talkDev=1",
  dealChat: `chat-detail.html?thread=chat-demo-worker-deal-001&deal=worker_deal_demo_001&userId=${SELLER_ID}&talkDev=1&from=talk`,
};

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: VIEWPORT });
page.on("dialog", async (dialog) => {
  await dialog.accept();
});

async function waitWorkerNotifyReady() {
  await page.waitForFunction(
    () =>
      window.TasuTalkWorkerReviewMode?.isWorkerReviewMode?.() &&
      (window.TasuTalkData?.getNotifications?.({ filter: "all", applySettings: false }) || []).length === 3,
    { timeout: 45000 }
  );
  await page.waitForSelector(`article[data-talk-notify-id="${REQUEST_NOTIFY_ID}"] .talk-notify-card__job-title`, {
    timeout: 15000,
  });
  await page.waitForTimeout(600);
}

async function resetPrepayThread(notifyId) {
  await page.evaluate((id) => window.TasuPlatformChatDemoSeed?.resetVerifyFeeThread?.(id), notifyId);
}

async function resetConnectComplete(notifyId) {
  await page.evaluate(
    (id) => window.TasuPlatformChatConnectDemoSeed?.resetConnectCompleteDemo?.(id),
    notifyId
  );
}

async function payPreChatFee() {
  await page.click("[data-platform-fee-pay]");
  await page.waitForFunction(
    () => !document.querySelector("[data-platform-fee-complete]")?.hasAttribute("hidden"),
    { timeout: 15000 }
  );
  await page.waitForTimeout(500);
  const chatHref = await page.evaluate(() => {
    const link = document.querySelector("[data-platform-fee-chat-link]");
    return link?.getAttribute("href") || "";
  });
  if (!chatHref) throw new Error("chat link missing after fee pay");
  await page.goto(devUrl(chatHref.replace(/^\//, "")), { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1100);
}

await page.goto(devUrl(URLS.notifyTab), { waitUntil: "domcontentloaded", timeout: 60000 });
await waitWorkerNotifyReady();
await page.screenshot({ path: path.join(OUT, "01-notify-tab-worker-review-390.png") });

const notifyAudit = await page.evaluate(() => {
  const rows = window.TasuTalkData?.getNotifications?.({ filter: "all", applySettings: false }) || [];
  return {
    count: rows.length,
    titles: rows.map((n) => n.title),
    ids: rows.map((n) => n.id),
    cards: rows.map((n) => ({
      id: n.id,
      chip: document
        .querySelector(`article[data-talk-notify-id="${n.id}"] .talk-notify-card__category-chip`)
        ?.textContent?.trim(),
      listingTitle: document
        .querySelector(`article[data-talk-notify-id="${n.id}"] .talk-notify-card__job-title`)
        ?.textContent?.trim(),
      eventTitle: document
        .querySelector(`article[data-talk-notify-id="${n.id}"] .talk-notify-card__title--job-event`)
        ?.textContent?.trim(),
    })),
  };
});

await page.goto(devUrl(URLS.talkRoom), { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector("[data-talk-line-room-active]:not([hidden])", { timeout: 20000 });
await page.waitForFunction(
  () => (window.TasuTalkOfficialRooms?.getRoomMessages?.("official_tasful") || []).length === 3,
  { timeout: 45000 }
);
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(OUT, "02-talk-official-worker-review-390.png") });

await page.goto(devUrl(URLS.notifyTab), { waitUntil: "domcontentloaded", timeout: 60000 });
await waitWorkerNotifyReady();
await resetPrepayThread(REQUEST_NOTIFY_ID);
await page.reload({ waitUntil: "domcontentloaded" });
await waitWorkerNotifyReady();
await page.locator(`article[data-talk-notify-id="${REQUEST_NOTIFY_ID}"] .talk-notify-card__minimal-action`).click();
await page.waitForURL(/platform-chat-fee-pay\.html/, { timeout: 20000 });
await page.waitForTimeout(700);
await page.screenshot({ path: path.join(OUT, "03-request-notify-to-fee-pay-390.png") });

await payPreChatFee();
await page.waitForFunction(
  () => document.querySelector("[data-platform-content-card], [data-chat-detail-root]"),
  { timeout: 15000 }
);
await page.screenshot({ path: path.join(OUT, "04-chat-after-pay-390.png") });

const contentCard = page.locator("[data-platform-content-card]").first();
if ((await contentCard.count()) > 0) {
  await contentCard.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await contentCard.screenshot({ path: path.join(OUT, "05-content-card-390.png") });
} else {
  throw new Error("content card missing");
}

await resetConnectComplete(COMPLETE_NOTIFY_ID);
await page.goto(devUrl(URLS.dealChat), { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(900);

await page.goto(devUrl(URLS.notifyTab), { waitUntil: "domcontentloaded", timeout: 60000 });
await waitWorkerNotifyReady();
await resetConnectComplete(COMPLETE_NOTIFY_ID);
await page.reload({ waitUntil: "domcontentloaded" });
await waitWorkerNotifyReady();
const completeCard = page.locator(`article[data-talk-notify-id="${COMPLETE_NOTIFY_ID}"]`);
await completeCard.scrollIntoViewIfNeeded();
await page.waitForTimeout(400);
await completeCard.screenshot({ path: path.join(OUT, "06-complete-notify-390.png") });

await completeCard.locator(".talk-notify-card__minimal-action").click();
await page.waitForURL(/chat-detail\.html/, { timeout: 20000 });
await page.waitForFunction(
  () => document.querySelector("[data-platform-completion-card], .chat-completion-card, [data-platform-completion-approve]"),
  { timeout: 15000 }
);
await page.waitForTimeout(900);
await page.screenshot({ path: path.join(OUT, "07-complete-notify-to-completion-card-390.png") });

const approve = page.locator("[data-platform-completion-approve]");
if ((await approve.count()) > 0) {
  await approve.click();
  await page.waitForTimeout(700);
}

const feePayHref = await page.evaluate(
  () => document.querySelector("[data-platform-completion-fee-pay]")?.getAttribute("href") || ""
);
if (!feePayHref.includes("platform-chat-fee-pay.html")) {
  throw new Error(`completion fee href missing: ${feePayHref}`);
}
await page.goto(devUrl(feePayHref.replace(/^\//, "")), { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(700);
await page.screenshot({ path: path.join(OUT, "08-fee-after-complete-390.png") });

const report = {
  generatedAt: new Date().toISOString(),
  baseUrl: BASE,
  viewport: VIEWPORT,
  urls: Object.fromEntries(Object.entries(URLS).map(([k, rel]) => [k, devUrl(rel)])),
  notifyAudit,
  screenshots: [
    "01-notify-tab-worker-review-390.png",
    "02-talk-official-worker-review-390.png",
    "03-request-notify-to-fee-pay-390.png",
    "04-chat-after-pay-390.png",
    "05-content-card-390.png",
    "06-complete-notify-390.png",
    "07-complete-notify-to-completion-card-390.png",
    "08-fee-after-complete-390.png",
  ],
};

fs.writeFileSync(path.join(OUT, "capture-report.json"), JSON.stringify(report, null, 2));
await browser.close();
console.log(JSON.stringify(report, null, 2));

if (notifyAudit.count !== 3) throw new Error(`expected 3 notify rows, got ${notifyAudit.count}`);
