#!/usr/bin/env node
/**
 * TALK/通知導線 — 下部タブバー表示 390px スクショ
 * 1. 求人550円支払い
 * 2. 支払い後チャット
 */
import { chromium } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const OUT = path.join("screenshots", "platform-shell-tabbar");
const JOB_ID = "job_demo_full_001";
const POSTER_ID = "u_job_demo_full";

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on("dialog", async (d) => d.accept());

await page.goto(`${BASE}/talk-home.html?tab=notify&userId=${POSTER_ID}&talkDev=1`, {
  waitUntil: "domcontentloaded",
});
await page.waitForTimeout(400);
await page.evaluate(() => {
  localStorage.removeItem("tasful_chat_threads");
  localStorage.removeItem("tasful_chat_messages");
  localStorage.removeItem("tasful_platform_chat_fees_v1");
});

await page.goto(
  `${BASE}/detail-job.html?id=${JOB_ID}&userId=${POSTER_ID}&talkDev=1&view=applications&from=notify#applications`,
  { waitUntil: "domcontentloaded", timeout: 60000 }
);
await page.waitForFunction(() => document.body.dataset.listingLoaded === "true", { timeout: 45000 });
await page.waitForFunction(() => document.querySelector("[data-job-app-proceed]"), { timeout: 45000 });
await Promise.all([
  page.waitForURL(/platform-chat-fee-pay.*from=notify/, { timeout: 20000 }),
  page.evaluate(() => document.querySelector("[data-job-app-proceed]")?.click()),
]);
await page.waitForFunction(
  () =>
    document.querySelector("[data-tasu-app-tabbar]") &&
    document.body.classList.contains("tasu-app-mobile-page"),
  { timeout: 15000 }
);
await page.waitForTimeout(700);

const payAudit = await page.evaluate(() => {
  const tabbar = document.querySelector("[data-tasu-app-tabbar]");
  const cta = document.querySelector("[data-platform-fee-pay]");
  const tabbarRect = tabbar?.getBoundingClientRect();
  const ctaRect = cta?.getBoundingClientRect();
  return {
    url: location.href,
    tabbarVisible: Boolean(tabbar && tabbarRect && tabbarRect.height > 40),
    tabbarFixed: tabbar ? getComputedStyle(tabbar).position === "fixed" : false,
    ctaAboveTabbar: Boolean(tabbarRect && ctaRect && ctaRect.bottom <= tabbarRect.top + 2),
    activeTab: document.querySelector(".tasu-app-tabbar__item.is-active")?.textContent?.trim(),
  };
});

await page.screenshot({ path: path.join(OUT, "01-job-fee-pay-390.png") });

await page.click("[data-platform-fee-pay]");
await page.waitForFunction(() => document.querySelector("[data-platform-fee-complete]:not([hidden])"), {
  timeout: 15000,
});
await page.click("[data-platform-fee-chat-link]");
await page.waitForURL(/chat-detail\.html/, { timeout: 20000 });
await page.waitForFunction(
  () =>
    document.querySelector("[data-tasu-app-tabbar]") &&
    document.body.dataset.tasuPlatformShell === "1",
  { timeout: 15000 }
);
await page.waitForTimeout(900);

const chatAudit = await page.evaluate(() => {
  const tabbar = document.querySelector("[data-tasu-app-tabbar]");
  const composer = document.querySelector(".chat-composer");
  const input = document.querySelector("#chatInput");
  const tabbarRect = tabbar?.getBoundingClientRect();
  const composerRect = composer?.getBoundingClientRect();
  const inputRect = input?.getBoundingClientRect();
  const gapPx =
    tabbarRect && composerRect ? Math.round(tabbarRect.top - composerRect.bottom) : null;
  return {
    url: location.href,
    from: new URLSearchParams(location.search).get("from"),
    tabbarVisible: Boolean(tabbar && tabbarRect && tabbarRect.height > 40),
    composerAboveTabbar: Boolean(
      tabbarRect && composerRect && composerRect.bottom <= tabbarRect.top + 2
    ),
    inputAboveTabbar: Boolean(tabbarRect && inputRect && inputRect.bottom <= tabbarRect.top + 2),
    composerTabGapPx: gapPx,
    inputMinHeight: input ? getComputedStyle(input).minHeight : null,
    activeTab: document.querySelector(".tasu-app-tabbar__item.is-active")?.textContent?.trim(),
  };
});

await page.screenshot({ path: path.join(OUT, "02-job-chat-after-pay-390.png") });

const composerRect = await page.evaluate(() => {
  const composer = document.querySelector(".chat-composer");
  const tabbar = document.querySelector("[data-tasu-app-tabbar]");
  const composerBox = composer?.getBoundingClientRect();
  const tabbarBox = tabbar?.getBoundingClientRect();
  if (!composerBox || !tabbarBox) return null;
  const top = Math.max(0, Math.floor(composerBox.top - 24));
  const height = Math.ceil(tabbarBox.bottom - top);
  return { x: 0, y: top, width: 390, height: Math.min(height, 844 - top) };
});

if (composerRect) {
  await page.screenshot({
    path: path.join(OUT, "03-chat-composer-area-390.png"),
    clip: composerRect,
  });
}

fs.writeFileSync(
  path.join(OUT, "capture-report.json"),
  JSON.stringify({ baseUrl: BASE, payAudit, chatAudit }, null, 2)
);

await browser.close();
console.log(JSON.stringify({ out: OUT, payAudit, chatAudit }, null, 2));
