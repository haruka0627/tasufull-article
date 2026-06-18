#!/usr/bin/env node
import { chromium } from "./lib/playwright-browser.mjs";
import { mkdirSync } from "fs";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const OUT_DIR = "screenshots/builder-scope-filters";
mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(`${BASE}/talk-home.html?tab=notify`, {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await page.waitForSelector("[data-talk-notify-mobile-chip]", { timeout: 20000 });
await page.waitForTimeout(800);

const chips = await page.evaluate(() =>
  [...document.querySelectorAll("[data-talk-notify-mobile-chip]")].map((b) => ({
    id: b.getAttribute("data-talk-notify-mobile-chip"),
    label: b.textContent?.trim(),
  }))
);
console.log("chips:", chips.map((c) => `${c.id}=${c.label}`).join(", "));

const results = [];
await page.evaluate(() => {
  document.querySelector('[data-talk-notify-mobile-chip="project"]')?.click();
});
await page.waitForTimeout(800);
const projectInfo = await page.evaluate(() => {
  const cards = [...document.querySelectorAll("[data-talk-notify-id]")];
  const scopes = cards.map(
    (c) => c.querySelector(".talk-notify-card__scope-chip")?.textContent?.trim() || "(なし)"
  );
  return { count: cards.length, scopes: [...new Set(scopes)] };
});
await page.screenshot({ path: `${OUT_DIR}/project-390.png`, fullPage: true });
results.push({ id: "project", ...projectInfo });
console.log("project", projectInfo);

await browser.close();
const projectOk =
  (projectInfo.count || 0) > 0 &&
  projectInfo.scopes.includes("Builder運営") &&
  projectInfo.scopes.includes("Builder一般");
console.log(`\n結果: project=${projectOk ? "OK" : "NG"}`);
process.exit(projectOk ? 0 : 1);
