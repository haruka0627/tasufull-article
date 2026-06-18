/**
 * TASFUL TALK — 安否通知マスター v1.0 スクリーンショット（390px）
 */
import { chromium } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "screenshots", "talk-anpi-notify-v1");
const PORTS = [5173, 5176, 5174, 5199, 5200, 5188];

async function findBaseUrl() {
  for (const port of PORTS) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/talk-home.html?tab=notify`, { method: "HEAD" });
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
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });

const page = await context.newPage();
await page.addInitScript(() => {
  localStorage.removeItem("tasful_talk_notifications");
  localStorage.removeItem("tasful_platform_notify_master_v1");
  localStorage.removeItem("tasful_builder_notify_master_v1");
  localStorage.removeItem("tasful_anpi_notify_master_v1");
  localStorage.removeItem("tasful_talk_notifications_seeded_v2");
});

await page.goto(`${base}/talk-home.html?tab=notify`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector('[data-talk-notify-id="anpi-check-request-001"]', { timeout: 15000 });
await page.waitForTimeout(600);

async function scrollTo(id) {
  await page.locator(`article[data-talk-notify-id="${id}"]`).scrollIntoViewIfNeeded();
  await page.waitForTimeout(350);
}

await scrollTo("anpi-check-request-001");
await page.screenshot({ path: path.join(OUT_DIR, "01-notify-list-top.png"), fullPage: false });
console.log("Saved: 01-notify-list-top.png");

await scrollTo("anpi-family-response-001");
await page.screenshot({ path: path.join(OUT_DIR, "02-anpi-notify-cards.png"), fullPage: false });
console.log("Saved: 02-anpi-notify-cards.png");

const destinations = [
  { file: "03-check-destination.png", url: "/anpi-dashboard.html#check" },
  { file: "04-family-destination.png", url: "/anpi-dashboard.html#family" },
  { file: "05-no-response-destination.png", url: "/anpi-dashboard.html#no-response" },
  { file: "06-disaster-destination.png", url: "/anpi-dashboard.html#disaster" },
  { file: "07-drill-destination.png", url: "/anpi-dashboard.html#drill" },
  { file: "08-settings-destination.png", url: "/anpi-dashboard.html#settings" },
];

for (const dest of destinations) {
  const p = await context.newPage();
  await p.goto(`${base}${dest.url}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.waitForSelector("[data-anpi-dashboard-shell]:not([hidden])", { timeout: 15000 });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: path.join(OUT_DIR, dest.file), fullPage: false });
  console.log("Saved:", dest.file);
  await p.close();
}

await browser.close();
console.log("Done.");
