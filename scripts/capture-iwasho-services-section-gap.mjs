#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl } from "./lib/dev-server-url.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "reports/screenshots/iwasho-services-section-gap");
const AFTER = path.join(OUT, "after");
fs.mkdirSync(AFTER, { recursive: true });
const base = await findDevServerBaseUrl({ probePath: "iwasho/services.html" });

for (const width of [390, 430, 768]) {
  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage({ viewport: { width, height: 2400 } });
    await page.goto(`${base}/iwasho/services.html`, { waitUntil: "networkidle", timeout: 120000 });

    const metrics = await page.evaluate(() => {
      const wix = document.querySelector(".iw-svc-wix-alt");
      const flow = document.querySelector(".iw-svc-flow");
      const flowTitle = document.querySelector("#iw-svc-flow-title");
      const box = document.querySelector(".iw-svc-wix-alt .app-section-box");
      const wixCs = getComputedStyle(wix);
      const flowCs = getComputedStyle(flow);
      const boxRect = box.getBoundingClientRect();
      const titleRect = flowTitle.getBoundingClientRect();
      return {
        scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        wixPad: `${wixCs.paddingTop} / ${wixCs.paddingBottom}`,
        flowPad: `${flowCs.paddingTop} / ${flowCs.paddingBottom}`,
        boxToTitle: Math.round(titleRect.top - boxRect.bottom),
      };
    });
    console.log(width, JSON.stringify(metrics));

    await page.locator(".iw-svc-wix-alt").scrollIntoViewIfNeeded();
    await page.evaluate(() => {
      const wix = document.querySelector(".iw-svc-wix-alt");
      const flow = document.querySelector(".iw-svc-flow");
      const top = wix.getBoundingClientRect().top + window.scrollY;
      const bottom = flow.getBoundingClientRect().bottom + window.scrollY;
      window.scrollTo(0, Math.max(0, top - 40));
    });
    await page.screenshot({
      path: path.join(AFTER, `gap-${width}.png`),
      clip: await page.evaluate(() => {
        const wix = document.querySelector(".iw-svc-wix-alt");
        const flowTitle = document.querySelector("#iw-svc-flow-title");
        const wixRect = wix.getBoundingClientRect();
        const titleRect = flowTitle.getBoundingClientRect();
        return {
          x: 0,
          y: Math.max(0, wixRect.top - 20),
          width: document.documentElement.clientWidth,
          height: Math.min(
            titleRect.bottom - wixRect.top + 40,
            document.documentElement.clientHeight,
          ),
        };
      }),
    });
    await page.close();
  });
}
