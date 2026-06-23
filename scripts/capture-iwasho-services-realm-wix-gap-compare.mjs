#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl } from "./lib/dev-server-url.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "reports/screenshots/iwasho-services-realm-wix-gap");
const base = await findDevServerBaseUrl({ probePath: "iwasho/services.html" });

const REVERT_CSS = [
  "@media (max-width: 768px) {",
  "  .iwasho-services-page .iw-about-services { padding-bottom: 80px !important; }",
  "  .iwasho-services-page .iw-svc-wix-alt { padding-top: 40px !important; }",
  "  .iwasho-services-page .iw-svc-wix-alt .section-container { padding-top: 64px !important; }",
  "}",
].join("\n");

async function capture(dir, width, revert) {
  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto(`${base}/iwasho/services.html`, { waitUntil: "networkidle", timeout: 120000 });
    if (revert) await page.addStyleTag({ content: REVERT_CSS });

    const gap = await page.evaluate(() => {
      const card = document.querySelector(".iw-about-service-card:last-child");
      const title = document.querySelector("#iw-svc-alt-title");
      return Math.round(title.getBoundingClientRect().top - card.getBoundingClientRect().bottom);
    });

    await page.locator(".iw-about-service-card:last-child").scrollIntoViewIfNeeded();
    const clip = await page.evaluate(() => {
      const card = document.querySelector(".iw-about-service-card:last-child");
      const title = document.querySelector("#iw-svc-alt-title");
      const cr = card.getBoundingClientRect();
      const tr = title.getBoundingClientRect();
      return {
        x: 0,
        y: Math.max(0, cr.top - 12),
        width: innerWidth,
        height: Math.ceil(tr.bottom - cr.top + 24),
      };
    });

    fs.mkdirSync(path.join(OUT, dir), { recursive: true });
    await page.screenshot({ path: path.join(OUT, dir, `gap-${width}.png`), clip });
    console.log(dir, width, { gap, scroll: await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), clipH: clip.height });
    await page.close();
  });
}

for (const width of [390, 430, 768]) {
  await capture("before", width, true);
  await capture("after", width, false);
}
