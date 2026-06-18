#!/usr/bin/env node
/** 修正報告用スクショ（390px / PC） */
import { chromium } from "./lib/playwright-browser.mjs";
import { mkdirSync } from "fs";
import { requireDevServer, logScreenshotUrl } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const OUT = "screenshots/builder-notify-report";
mkdirSync(OUT, { recursive: true });

const STORAGE_KEYS = [
  "tasful_talk_notifications",
  "tasful_platform_notify_master_v1",
  "tasful_builder_notify_master_v1",
  "tasful_anpi_notify_master_v1",
  "tasful_talk_notifications_seeded_v2",
];

async function resetStorage(page) {
  await page.goto(`${BASE}/talk-home.html`, { waitUntil: "domcontentloaded" });
  await page.evaluate((keys) => keys.forEach((k) => localStorage.removeItem(k)), STORAGE_KEYS);
}

const browser = await chromium.launch({ headless: true });

for (const [label, viewport] of [
  ["390", { width: 390, height: 844 }],
  ["1280", { width: 1280, height: 900 }],
]) {
  const page = await browser.newPage({ viewport });
  await resetStorage(page);

  const notifyUrl = `${BASE}/talk-home.html?tab=notify&talkAdmin=1`;
  await page.goto(notifyUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector('[data-talk-notify-id="builder-board-apply-001"]', { timeout: 25000 });
  await page.waitForTimeout(700);
  const notifyPath = `${OUT}/notify-list-${label}.png`;
  await page.screenshot({ path: notifyPath, fullPage: true });
  logScreenshotUrl(`notify-list-${label}`, "/talk-home.html?tab=notify&talkAdmin=1");

  await page.locator('article[data-talk-notify-id="builder-ops-verify-new-project-001"]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  const opsCardPath = `${OUT}/notify-ops-calendar-card-${label}.png`;
  await page.locator('article[data-talk-notify-id="builder-ops-verify-new-project-001"]').screenshot({
    path: opsCardPath,
  });

  await page.locator('article[data-talk-notify-id="builder-ops-verify-new-project-001"]').click();
  await page.waitForLoadState("domcontentloaded");
  await page.waitForSelector(".mvp-cal-listItem.is-selected", { timeout: 20000 });
  await page.waitForTimeout(900);
  const calPath = `${OUT}/partner-calendar-${label}.png`;
  await page.screenshot({ path: calPath, fullPage: true });
  logScreenshotUrl(`partner-calendar-${label}`, page.url().replace(BASE, ""));

  const detailPath = `${OUT}/partner-calendar-detail-${label}.png`;
  const detailPanel = page.locator("[data-builder-mvp-cal-detail]");
  if ((await detailPanel.count()) > 0) {
    await detailPanel.screenshot({ path: detailPath });
  }

  await page.close();
}

await browser.close();
console.log(`\nSaved to ${OUT}/`);
