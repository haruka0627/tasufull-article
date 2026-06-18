/**
 * 安否ダッシュボード — 390px スクリーンショット
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "screenshots", "anpi-dashboard-mobile-390");
const DEMO_KEY = "tasful_anpi_notify_demo_v1";
const PORTS = [5173, 5176, 5174, 5199, 5200, 5188];

async function findBaseUrl() {
  for (const port of PORTS) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/anpi-dashboard.html`, { method: "HEAD" });
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

await withPlaywrightBrowser(async (browser) => {async function capture(page, file, url) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.evaluate(() => document.querySelector("vite-error-overlay")?.remove());
  await page.waitForSelector("[data-anpi-dashboard-shell]:not([hidden])", { timeout: 20000 });
  await page.waitForTimeout(1500);
  const outPath = path.join(OUT_DIR, file);
  await page.screenshot({ path: outPath, fullPage: true });
  console.log("Saved:", outPath);
}

const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.addInitScript((key) => localStorage.removeItem(key), DEMO_KEY);

await capture(page, "01-dashboard-gemini-normal.png", `${base}/anpi-dashboard.html`);
await capture(page, "02-dashboard-gemini-from-talk.png", `${base}/anpi-dashboard.html?from=talk`);
await capture(page, "03-dashboard-gemini-check-focus.png", `${base}/anpi-dashboard.html#check`);

await page.close();
});
console.log("Done.");

await closeAllBrowsers();
