#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "reports/screenshots/company-hp-ref");
const BASE = process.env.BASE_URL || "http://127.0.0.1:8788";

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(`${BASE}/company/`, { waitUntil: "networkidle", timeout: 60000 });

await page.screenshot({ path: path.join(OUT, "company-hp-full-1280.png"), fullPage: true });
await page.locator(".tasful-hero").screenshot({ path: path.join(OUT, "company-hp-hero-1280.png") });

const check = await page.evaluate(() => ({
  hasCorpBizHero: !!document.querySelector(".corp-biz-hero"),
  hasTasfulHero: !!document.querySelector(".tasful-hero"),
  sections: [...document.querySelectorAll(".tas-top-section, .tas-top-partner-section")].length,
  bg: document.querySelector(".tasful-hero__bg")?.getAttribute("src"),
  cards: document.querySelector(".hero-card--construction .neon-card")?.getBoundingClientRect(),
}));

console.log(JSON.stringify(check, null, 2));
console.log("saved:", path.join(OUT, "company-hp-full-1280.png"));
await browser.close();
