#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl } from "./lib/dev-server-url.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "reports/screenshots/iwasho-categories-subtitle");
const EXPECTED = "基礎工事・杭工事・造成工事・擁壁工事・新築工務店業務は対象外です";

fs.mkdirSync(OUT, { recursive: true });
const base = await findDevServerBaseUrl({ probePath: "iwasho/" });

for (const width of [390, 430, 768]) {
  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto(`${base}/iwasho/`, { waitUntil: "networkidle", timeout: 120000 });
    await page.locator(".iw-categories").scrollIntoViewIfNeeded();
    const info = await page.evaluate((expected) => {
      const el = document.querySelector(".iw-categories__subtitle");
      const cs = getComputedStyle(el);
      const visible = el.innerText.trim();
      return {
        visible,
        ok: visible === expected,
        whiteSpace: cs.whiteSpace,
        overflow: cs.overflow,
        width: cs.width,
        maxWidth: cs.maxWidth,
        lineHeight: cs.lineHeight,
        height: el.offsetHeight,
        scrollOverflow: el.scrollWidth > el.clientWidth + 1,
      };
    }, EXPECTED);
    console.log(width, JSON.stringify(info));
    await page.locator(".iw-categories__inner").screenshot({
      path: path.join(OUT, `categories-${width}.png`),
    });
    await page.close();
  });
}
