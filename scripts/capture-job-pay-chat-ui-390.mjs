#!/usr/bin/env node
import { chromium } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const OUT = "screenshots/platform-job-ui-review";
const JOB_ID = "job_demo_full_001";
const POSTER_ID = "u_job_demo_full";

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on("dialog", async (d) => d.accept());

await page.goto(`${BASE}/talk-home.html?tab=notify&userId=${POSTER_ID}&talkDev=1`, {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await page.waitForTimeout(500);
await page.evaluate(() => {
  localStorage.removeItem("tasful_chat_threads");
  localStorage.removeItem("tasful_chat_messages");
  localStorage.removeItem("tasful_platform_chat_fees_v1");
});

await page.goto(
  `${BASE}/detail-job.html?id=${JOB_ID}&userId=${POSTER_ID}&talkDev=1&view=applications&from=talk#applications`,
  { waitUntil: "domcontentloaded", timeout: 60000 }
);
await page.waitForFunction(() => document.body.dataset.listingLoaded === "true", { timeout: 45000 });
await page.waitForFunction(
  () => document.querySelector("[data-job-app-proceed]"),
  { timeout: 45000 }
);
await Promise.all([
  page.waitForURL(/platform-chat-fee-pay/, { timeout: 20000 }),
  page.evaluate(() => {
    document.querySelector("[data-job-app-proceed]")?.click();
  }),
]);
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(OUT, "01-job-pay-390.png") });

await page.click("[data-platform-fee-pay]");
await page.waitForFunction(
  () => !document.querySelector("[data-platform-fee-complete]")?.hasAttribute("hidden"),
  { timeout: 15000 }
);
const chatHref = await page.evaluate(() =>
  document.querySelector("[data-platform-fee-chat-link]")?.getAttribute("href")
);
await page.goto(`${BASE}/${String(chatHref).replace(/^\//, "")}`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);
await page.screenshot({ path: path.join(OUT, "02-job-chat-390.png") });

const card = page.locator("[data-platform-job-application-card]").first();
await card.scrollIntoViewIfNeeded();
await page.waitForTimeout(300);
await card.screenshot({ path: path.join(OUT, "03-job-chat-card-390.png") });

await page.locator(".chat-detail__messages").screenshot({
  path: path.join(OUT, "04-job-chat-intro-390.png"),
});

await browser.close();
console.log("OK", OUT);
