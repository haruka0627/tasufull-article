#!/usr/bin/env node
/** パートナー案件確認画面 — 390px / PC スクショ */
import { chromium } from "./lib/playwright-browser.mjs";
import { mkdirSync } from "fs";
import { requireDevServer, logScreenshotUrl } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const OUT = "screenshots/partner-assignment";
mkdirSync(OUT, { recursive: true });

const RESET_KEYS = [
  "tasful:builder:admin:calendarAssignments:v1",
  "tasful:builder:mvp:v1",
  "tasful:builder:mvp:partner_id",
];

const URL =
  "/builder/partner-assignment.html?role=partner&partnerId=demo-partner-001&projectId=builder_demo_001&from=talk";

const browser = await chromium.launch({ headless: true });

for (const [label, viewport] of [
  ["390", { width: 390, height: 844 }],
  ["1280", { width: 1280, height: 900 }],
]) {
  const page = await browser.newPage({ viewport });
  await page.goto(`${BASE}/talk-home.html`, { waitUntil: "domcontentloaded" });
  await page.evaluate((keys) => keys.forEach((k) => localStorage.removeItem(k)), RESET_KEYS);
  await page.goto(`${BASE}${URL}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector("[data-partner-assignment-accept]", { timeout: 20000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/partner-assignment-${label}.png`, fullPage: true });
  logScreenshotUrl(`partner-assignment-${label}`, URL);
  await page.close();
}

await browser.close();
console.log(`Saved to ${OUT}/`);
