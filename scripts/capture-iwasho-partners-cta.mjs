#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl } from "./lib/dev-server-url.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "reports/screenshots/iwasho-partners-cta");
const base = await findDevServerBaseUrl({ probePath: "iwasho/partners.html" });
const url = `${base}/iwasho/partners.html`;

fs.mkdirSync(OUT, { recursive: true });

await withPlaywrightBrowser(async (browser) => {
  for (const { width, height } of [
    { width: 1280, height: 900 },
    { width: 390, height: 844 },
  ]) {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });

    const cta = page.locator(".iw-ptn-cta");
    await cta.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);

    await cta.screenshot({ path: path.join(OUT, `cta-${width}.png`) });

    const audit = await page.evaluate(() => {
      const inner = document.querySelector(".iw-ptn-cta__inner");
      const photo = document.querySelector(".iw-ptn-cta__photo");
      const icon = document.querySelector(".iw-ptn-cta__icon");
      const cs = inner ? getComputedStyle(inner) : null;
      return {
        gridColumns: cs?.gridTemplateColumns,
        photoSrc: photo?.getAttribute("src"),
        hasHandshakeIcon: !!icon,
        hasPhoto: !!photo,
      };
    });

    fs.writeFileSync(
      path.join(OUT, `audit-${width}.json`),
      JSON.stringify({ url, width, audit }, null, 2),
    );
    await page.close();
  }

  console.log(JSON.stringify({ url, out: path.relative(ROOT, OUT) }, null, 2));
});
