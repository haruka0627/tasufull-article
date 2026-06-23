#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "reports/screenshots/company-hero-ref");
const BASE = process.env.BASE_URL || "http://127.0.0.1:8788";

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(`${BASE}/company/`, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForSelector(".tasful-hero", { timeout: 15000 });

const hero = page.locator(".tasful-hero");
await hero.screenshot({ path: path.join(OUT, "company-hero-1280.png") });
await page.screenshot({ path: path.join(OUT, "company-page-1280.png"), fullPage: false });

await browser.close();
console.log("saved:", path.join(OUT, "company-hero-1280.png"));
