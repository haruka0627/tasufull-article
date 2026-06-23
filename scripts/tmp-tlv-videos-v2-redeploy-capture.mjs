/**
 * TLV /live/videos v2 — Local / Preview screenshot + layout verification
 * Usage: node scripts/tmp-tlv-videos-v2-redeploy-capture.mjs [--base URL]
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { findDevServerBaseUrl } from "./lib/dev-server-url.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "reports");
const VIEWPORTS = [
  { width: 390, height: 844, suffix: "390" },
  { width: 1280, height: 900, suffix: "1280" },
  { width: 1920, height: 1080, suffix: "1920" },
];

const baseArg = process.argv.find((a) => a.startsWith("--base="));
const base =
  baseArg?.slice("--base=".length) ||
  (await findDevServerBaseUrl({ probePath: "live/videos.html" }));
const label = base.includes("127.0.0.1") || base.includes("localhost") ? "local" : "preview";

fs.mkdirSync(OUT_DIR, { recursive: true });

async function probe(width, height) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto(`${base}/live/videos?talkDev=1`, {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  await page.waitForSelector("[data-live-videos-feed]", { state: "attached", timeout: 30000 });
  await page.waitForTimeout(2500);

  const cssUrl = await page.evaluate(
    () => document.querySelector('link[href*="live.css"]')?.href || "",
  );
  const cssRes = await page.request.get(cssUrl);
  const cssText = await cssRes.text();

  const metrics = await page.evaluate(() => {
    const feed = document.querySelector("[data-live-videos-feed]");
    const cs = feed ? getComputedStyle(feed) : null;
    const cols = cs ? cs.gridTemplateColumns.split(" ").filter(Boolean) : [];
    const sidebar = document.querySelector(".tlv-desktop-sidebar");
    return {
      dataPage: document.body.getAttribute("data-page"),
      colCount: cols.length,
      gridTemplateColumns: cs?.gridTemplateColumns || "",
      sidebarW: sidebar ? Math.round(sidebar.getBoundingClientRect().width) : 0,
      hasYtCard: Boolean(document.querySelector(".live-video-card--yt")),
      cssHref: document.querySelector('link[href*="live.css"]')?.getAttribute("href") || "",
      cardCount: document.querySelectorAll(".live-video-card--yt").length,
    };
  });

  const suffix = VIEWPORTS.find((v) => v.width === width)?.suffix || String(width);
  const shotPath = path.join(OUT_DIR, `tlv-videos-layout-v2-${suffix}.png`);
  await page.screenshot({ path: shotPath, fullPage: false });
  await browser.close();

  return {
    width,
    screenshot: shotPath,
    cssBytes: cssText.length,
    cssV2: {
      has72px: cssText.includes("--tlv-sidebar-w: 72px"),
      hasYtClass: cssText.includes(".live-video-card--yt"),
      hasV2Comment: cssText.includes("YouTube-style grid v2"),
    },
    metrics,
  };
}

const results = [];
for (const vp of VIEWPORTS) {
  results.push(await probe(vp.width, vp.height));
}

const summary = {
  label,
  base,
  capturedAt: new Date().toISOString(),
  results,
};
console.log(JSON.stringify(summary, null, 2));
