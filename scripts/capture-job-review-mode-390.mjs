#!/usr/bin/env node
/**
 * 求人 review=job モード — 390px スクショ（通知タブ / TALK / 導線着地）
 */
import { chromium } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { requireDevServer, devUrl } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const OUT = path.join("screenshots", "platform-job-review-mode");
const VIEWPORT = { width: 390, height: 844 };

const APPLY_NOTIFY_ID = "platform-verify-job-full-apply-001";
const HIRED_NOTIFY_ID = "platform-verify-job-full-applicant-start-001";

const URLS = {
  notifyTab: "talk-home.html?tab=notify&review=job&talkDev=1",
  talkRoom: "talk-home.html?tab=chat&thread=official_tasful&review=job&talkDev=1",
  applyDest:
    "detail-job.html?id=job_demo_full_001&userId=u_job_demo_full&talkDev=1&view=applications&from=talk#applications",
  hiredDest:
    "chat-detail.html?thread=chat-demo-job-full-001&userId=u_hiro&talkDev=1&review=job-full",
};

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: VIEWPORT });

async function waitNotifyReady() {
  await page.waitForFunction(
    () => (window.TasuTalkJobReviewMode?.isJobReviewMode?.() && (window.TasuTalkData?.getNotifications?.({ filter: "all", applySettings: false }) || []).length === 2),
    { timeout: 45000 }
  );
  await page.waitForTimeout(700);
}

await page.goto(devUrl(URLS.notifyTab), { waitUntil: "domcontentloaded", timeout: 60000 });
await waitNotifyReady();
await page.screenshot({ path: path.join(OUT, "01-notify-tab-job-review-390.png") });

const notifyAudit = await page.evaluate(() => {
  const rows = window.TasuTalkData?.getNotifications?.({ filter: "all", applySettings: false }) || [];
  return {
    count: rows.length,
    titles: rows.map((n) => n.title),
    ids: rows.map((n) => n.id),
  };
});
console.log("notify audit:", notifyAudit);

await page.goto(devUrl(URLS.talkRoom), { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector("[data-talk-line-room-active]:not([hidden])", { timeout: 20000 });
await page.waitForFunction(
  () => (window.TasuTalkOfficialRooms?.getRoomMessages?.("official_tasful") || []).length === 2,
  { timeout: 45000 }
);
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(OUT, "02-talk-official-job-review-390.png") });

const talkAudit = await page.evaluate(() => {
  const msgs = window.TasuTalkOfficialRooms?.getRoomMessages?.("official_tasful") || [];
  return {
    count: msgs.length,
    cards: msgs.map((m) => ({
      title: m.notifyCard?.title || m.text,
      action: m.notifyCard?.actionLabel,
      href: m.notifyCard?.href,
    })),
  };
});
console.log("talk audit:", talkAudit);

await page.goto(devUrl(URLS.notifyTab), { waitUntil: "domcontentloaded", timeout: 60000 });
await waitNotifyReady();
await page.locator(`article[data-talk-notify-id="${APPLY_NOTIFY_ID}"] .talk-notify-card__minimal-action`).click();
await page.waitForFunction(
  () => document.querySelector("[data-job-applications-section]") && !document.querySelector("[data-job-applications-section]").hidden,
  { timeout: 45000 }
);
await page.waitForTimeout(900);
await page.screenshot({ path: path.join(OUT, "03-apply-notify-to-applications-390.png") });

await page.goto(devUrl(URLS.notifyTab), { waitUntil: "domcontentloaded", timeout: 60000 });
await waitNotifyReady();
await page.locator(`article[data-talk-notify-id="${HIRED_NOTIFY_ID}"] .talk-notify-card__minimal-action`).click();
await page.waitForFunction(
  () => document.body.dataset.chatDetailReady === "true",
  { timeout: 45000 }
);
await page.waitForTimeout(900);
await page.screenshot({ path: path.join(OUT, "04-hired-notify-to-chat-390.png") });

const report = {
  generatedAt: new Date().toISOString(),
  baseUrl: BASE,
  viewport: VIEWPORT,
  urls: Object.fromEntries(
    Object.entries(URLS).map(([key, rel]) => [key, devUrl(rel)])
  ),
  notifyAudit,
  talkAudit,
  screenshots: [
    "01-notify-tab-job-review-390.png",
    "02-talk-official-job-review-390.png",
    "03-apply-notify-to-applications-390.png",
    "04-hired-notify-to-chat-390.png",
  ],
};

fs.writeFileSync(path.join(OUT, "capture-report.json"), JSON.stringify(report, null, 2));
await browser.close();
console.log(JSON.stringify(report, null, 2));

if (notifyAudit.count !== 2) throw new Error(`expected 2 notify rows, got ${notifyAudit.count}`);
if (talkAudit.count !== 2) throw new Error(`expected 2 talk messages, got ${talkAudit.count}`);
