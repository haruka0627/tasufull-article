#!/usr/bin/env node
import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://127.0.0.1:8788";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(`${BASE}/company/`, { waitUntil: "networkidle", timeout: 60000 });

const check = await page.evaluate(() => ({
  hasTasfulHero: !!document.querySelector(".tasful-hero"),
  hasCorpBizHero: !!document.querySelector(".corp-biz-hero"),
  neonCards: document.querySelectorAll(".neon-card").length,
  neonBtn: document.querySelectorAll(".neon-btn").length,
  heroBg: document.querySelector(".tasful-hero__bg")?.getAttribute("src") || null,
  tasTopCss: !!document.querySelector('link[href*="tas-top-page"]'),
  corpCompanyHeroCss: !!document.querySelector('link[href*="corp-company-hero"]'),
  firstSectionClass: document.querySelector(".corp-main > section")?.className || null,
}));

console.log(JSON.stringify(check, null, 2));
await browser.close();
