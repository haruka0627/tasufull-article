#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl } from "./lib/dev-server-url.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "reports/screenshots/iwasho-partners-mobile-final");
const sub = process.argv[2] === "after" ? "after" : "before";
const DIR = path.join(OUT, sub);
fs.mkdirSync(DIR, { recursive: true });
const base = await findDevServerBaseUrl({ probePath: "iwasho/partners.html" });

const REVERT_CSS = [
  "@media (max-width: 768px) {",
  "  .iwasho-partners-page .iw-ptn-trades-card__desc { line-height: 1.7 !important; }",
  "  .iwasho-partners-page .iw-ptn-trades-card__body { padding-inline: 18px !important; }",
  "  .iwasho-partners-page .iwasho-cta .iwasho-cta__lead { line-height: 1.8 !important; }",
  "}",
].join("\n");

for (const width of [390, 430, 768]) {
  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage({ viewport: { width, height: 1600 } });
    await page.goto(`${base}/iwasho/partners.html`, { waitUntil: "networkidle", timeout: 120000 });
    if (sub === "before") await page.addStyleTag({ content: REVERT_CSS });

    const metrics = await page.evaluate(() => {
      const desc = document.querySelector(".iw-ptn-trades-card__desc");
      const body = document.querySelector(".iw-ptn-trades-card__body");
      const lead = document.querySelector(".iwasho-cta__lead");
      const btn = document.querySelector(".iwasho-cta-btn");
      const descCs = desc ? getComputedStyle(desc) : null;
      const bodyCs = body ? getComputedStyle(body) : null;
      const leadCs = lead ? getComputedStyle(lead) : null;
      const btnBox = btn?.getBoundingClientRect();
      return {
        scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        descLh: descCs?.lineHeight,
        descFont: descCs?.fontSize,
        bodyPad: bodyCs ? `${bodyCs.paddingLeft}/${bodyCs.paddingRight}` : null,
        leadLh: leadCs?.lineHeight,
        leadFont: leadCs?.fontSize,
        btnH: btnBox ? Math.round(btnBox.height) : null,
        cardH: Math.round(document.querySelector(".iw-ptn-trades-card")?.getBoundingClientRect().height ?? 0),
      };
    });
    console.log(sub, width, JSON.stringify(metrics));

    await page.locator(".iw-ptn-trades__grid").scrollIntoViewIfNeeded();
    await page.locator(".iw-ptn-trades__grid").screenshot({ path: path.join(DIR, `trades-${width}.png`) });

    await page.locator(".iwasho-cta__lead").scrollIntoViewIfNeeded();
    await page.locator(".iwasho-cta__lead").screenshot({ path: path.join(DIR, `cta-lead-${width}.png`) });

    await page.close();
  });
}
