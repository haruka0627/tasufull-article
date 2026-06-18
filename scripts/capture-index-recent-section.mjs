#!/usr/bin/env node
import { chromium } from "./lib/playwright-browser.mjs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(import.meta.url), "..", "..");
const out = join(root, "screenshots", "index-recent-reviews-section.png");
const fullOut = join(root, "screenshots", "index-recent-reviews-full.png");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const url = "http://localhost:5502/screenshots/index.html#recent-reviews";
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForSelector("#recent-reviews", { timeout: 15000 });
const section = page.locator("#recent-reviews");
await section.screenshot({ path: out });
await page.screenshot({ path: fullOut, fullPage: false });
await browser.close();
console.log(out);
console.log(fullOut);
