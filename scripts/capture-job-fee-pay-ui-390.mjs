#!/usr/bin/env node
/**
 * 求人550円支払い画面 — 390px スクショ（変更後）
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const OUT = path.join("screenshots", "platform-job-fee-pay-ui");
const BEFORE_SRC = path.join("screenshots", "platform-manual-review", "job", "06-pay-550.png");
const JOB_ID = "job_demo_full_001";
const POSTER_ID = "u_job_demo_full";

fs.mkdirSync(OUT, { recursive: true });

if (fs.existsSync(BEFORE_SRC)) {
  fs.copyFileSync(BEFORE_SRC, path.join(OUT, "01-before-390.png"));
}

await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on("dialog", async (d) => d.accept());

await page.goto(`${BASE}/talk-home.html?tab=notify&userId=${POSTER_ID}&talkDev=1`, {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await page.waitForTimeout(400);
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
await page.waitForFunction(() => document.querySelector("[data-job-app-proceed]"), { timeout: 45000 });
await Promise.all([
  page.waitForURL(/platform-chat-fee-pay/, { timeout: 20000 }),
  page.evaluate(() => document.querySelector("[data-job-app-proceed]")?.click()),
]);
await page.waitForFunction(
  () => document.body.classList.contains("platform-fee-pay--job") && document.querySelector("[data-platform-fee-job-applicant]")?.textContent?.trim(),
  { timeout: 15000 }
);
await page.waitForTimeout(700);

const audit = await page.evaluate(() => ({
  url: location.href,
  title: document.querySelector("[data-platform-fee-pay-title]")?.textContent?.trim(),
  jobTitle: document.querySelector("[data-platform-fee-job-title]")?.textContent?.trim(),
  applicant: document.querySelector("[data-platform-fee-job-applicant]")?.textContent?.trim(),
  appliedAt: document.querySelector("[data-platform-fee-job-applied-at]")?.textContent?.trim(),
  amount: document.querySelector("[data-platform-fee-amount]")?.textContent?.trim(),
  cta: document.querySelector("[data-platform-fee-pay]")?.textContent?.trim(),
}));

await page.screenshot({ path: path.join(OUT, "02-after-390.png") });

fs.writeFileSync(path.join(OUT, "capture-report.json"), JSON.stringify({ baseUrl: BASE, audit }, null, 2));
});
console.log(JSON.stringify({ out: OUT, audit }, null, 2));

await closeAllBrowsers();
