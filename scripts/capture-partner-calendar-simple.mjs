#!/usr/bin/env node
/** パートナー用カレンダー（受諾済み予定）— 390px / PC スクショ */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { mkdirSync } from "fs";
import { requireDevServer, logScreenshotUrl } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const OUT = "screenshots/partner-calendar-simple";
mkdirSync(OUT, { recursive: true });

const RESET_KEYS = [
  "tasful:builder:admin:calendarAssignments:v1",
  "tasful:builder:mvp:v1",
  "tasful:builder:mvp:partner_id",
];

const SHOTS = [
  {
    label: "partner-a",
    url: "/builder/mvp-calendar.html?role=partner&partnerId=partner-a",
    wait: "[data-mvp-cal-partner-accepted-list] a",
  },
  {
    label: "partner-b",
    url: "/builder/mvp-calendar.html?role=partner&partnerId=partner-b",
    wait: "[data-mvp-cal-partner-accepted-list] a",
  },
];

await withPlaywrightBrowser(async (browser) => {for (const [vpLabel, viewport] of [
  ["390", { width: 390, height: 844 }],
  ["1280", { width: 1280, height: 900 }],
]) {
  for (const shot of SHOTS) {
    const page = await browser.newPage({ viewport });
    await page.goto(`${BASE}/talk-home.html`, { waitUntil: "domcontentloaded" });
    await page.evaluate((keys) => keys.forEach((k) => localStorage.removeItem(k)), RESET_KEYS);
    await page.goto(`${BASE}${shot.url}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector(shot.wait, { timeout: 20000 });
    await page.waitForTimeout(800);
    const file = `${OUT}/${shot.label}-${vpLabel}.png`;
    await page.screenshot({ path: file, fullPage: true });
    logScreenshotUrl(`${shot.label}-${vpLabel}`, shot.url);
    await page.close();
  }
}

});
console.log(`Saved to ${OUT}/`);

await closeAllBrowsers();
