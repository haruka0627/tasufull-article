/**
 * 安否通知センター — 390px 空状態スクリーンショット
 */
import { chromium } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "screenshots", "anpi-notifications-mobile-390");
const STORAGE_LOGS = "tasu_anpi_notification_logs_v1";
const PORTS = [5173, 5176, 5174, 5199, 5200, 5188];

async function findBaseUrl() {
  for (const port of PORTS) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/anpi-notifications.html`, { method: "HEAD" });
      if (res.ok) return `http://127.0.0.1:${port}`;
    } catch {
      /* next */
    }
  }
  throw new Error("No dev server found");
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const base = await findBaseUrl();
console.log("Base URL:", base);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

await page.addInitScript((key) => localStorage.removeItem(key), STORAGE_LOGS);
await page.goto(`${base}/anpi-notifications.html`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForFunction(() => Boolean(window.TasuAnpiNotificationsPage), { timeout: 15000 });
await page.waitForSelector("[data-anpi-empty]:not([hidden])", { timeout: 10000 });
await page.waitForTimeout(1200);

const check = await page.evaluate(() => ({
  lead: document.querySelector(".anpi-notifications-lead")?.textContent?.trim(),
  unread: document.querySelector("[data-anpi-summary-unread]")?.textContent?.trim(),
  total: document.querySelector("[data-anpi-summary-total]")?.textContent?.trim(),
  urgent: document.querySelector("[data-anpi-summary-urgent]")?.textContent?.trim(),
  emptyTitle: document.querySelector(".anpi-notifications-empty__title")?.textContent?.trim(),
  tabbarBottom: document.querySelector("[data-tasu-app-tabbar-injected]")?.getBoundingClientRect().top,
  contentBottom: document.querySelector(".anpi-notifications-main")?.getBoundingClientRect().bottom,
}));

console.log("Check:", JSON.stringify(check, null, 2));

const outPath = path.join(OUT_DIR, "01-notifications-empty-390.png");
await page.screenshot({ path: outPath, fullPage: false });
console.log("Saved:", outPath);

await browser.close();
