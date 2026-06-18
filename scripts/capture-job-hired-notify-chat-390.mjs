#!/usr/bin/env node
/**
 * 求人やりとり開始通知 → チャット導線 390px スクショ
 */
import { chromium } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const OUT = path.join("screenshots", "platform-job-hired-notify-chat");
const HIRED_NOTIFY_ID = "platform-verify-job-full-applicant-start-001";
const APPLICANT_ID = "u_hiro";

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

await page.goto(`${BASE}/talk-home.html?tab=notify&userId=${APPLICANT_ID}&talkDev=1&review=job`, {
  waitUntil: "domcontentloaded",
});
await page.waitForTimeout(1200);

const notifyCard = page.locator(`article[data-talk-notify-id="${HIRED_NOTIFY_ID}"]`);
await notifyCard.waitFor({ timeout: 15000 });
await page.screenshot({ path: path.join(OUT, "01-hired-notify-390.png") });

const notifyHref = await notifyCard.evaluate((el) => {
  const link = el.querySelector("[data-talk-notify-action='navigate']");
  return link?.getAttribute("href") || el.getAttribute("data-talk-notify-target") || "";
});

await Promise.all([
  page.waitForURL(/chat-detail\.html/, { timeout: 20000 }),
  notifyCard.locator("[data-talk-notify-action='navigate']").click(),
]);
await page.waitForFunction(
  () =>
    document.querySelector("[data-platform-job-hired-card], [data-platform-job-application-card]") &&
    document.querySelector("[data-tasu-app-tabbar]"),
  { timeout: 15000 }
);
await page.waitForTimeout(800);

const audit = await page.evaluate(() => {
  const card = document.querySelector("[data-platform-job-hired-card], [data-platform-job-application-card]");
  const tabbar = document.querySelector("[data-tasu-app-tabbar]");
  const composer = document.querySelector(".chat-composer");
  const tabbarRect = tabbar?.getBoundingClientRect();
  const composerRect = composer?.getBoundingClientRect();
  return {
    url: location.href,
    isChatDetail: /chat-detail\.html/.test(location.href),
    isHireResult: /view=hire-result/.test(location.href),
    cardTitle: card?.querySelector(".chat-job-card__category")?.textContent?.trim(),
    jobTitle: card?.querySelector(".chat-job-card__title")?.textContent?.trim(),
    rows: [...(card?.querySelectorAll(".chat-job-card__row") || [])].map((row) => ({
      label: row.querySelector(".chat-job-card__label")?.textContent?.trim(),
      value: row.querySelector(".chat-job-card__value")?.textContent?.trim(),
    })),
    guide: card?.querySelector(".chat-job-card__guide")?.textContent?.trim(),
    tabbarVisible: Boolean(tabbar && tabbarRect && tabbarRect.height > 40),
    composerAboveTabbar: Boolean(
      tabbarRect && composerRect && composerRect.bottom <= tabbarRect.top + 2
    ),
  };
});

await page.screenshot({ path: path.join(OUT, "02-hired-chat-390.png") });

const cardRect = await page.evaluate(() => {
  const card = document.querySelector("[data-platform-job-hired-card], [data-platform-job-application-card]");
  const box = card?.getBoundingClientRect();
  if (!box) return null;
  const top = Math.max(0, Math.floor(box.top - 12));
  const height = Math.min(Math.ceil(box.height + 24), 844 - top);
  return { x: 0, y: top, width: 390, height };
});
if (cardRect) {
  await page.screenshot({ path: path.join(OUT, "03-hired-card-390.png"), clip: cardRect });
}

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
  await page.screenshot({ path: path.join(OUT, "04-chat-composer-tabbar-390.png"), clip: composerRect });
}

fs.writeFileSync(
  path.join(OUT, "capture-report.json"),
  JSON.stringify({ baseUrl: BASE, notifyHref, audit }, null, 2)
);

await browser.close();
console.log(JSON.stringify({ out: OUT, notifyHref, audit }, null, 2));
