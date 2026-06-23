#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser } from "./lib/playwright-browser.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "reports/screenshots/iwasho-partners-page");
const FLOW_OUT = path.join(ROOT, "reports/screenshots/iwasho-partners-flow");
const url = "http://127.0.0.1:8788/iwasho/partners.html";
const widths = [390, 768, 1280];

fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(FLOW_OUT, { recursive: true });

const report = { url, capturedAt: new Date().toISOString(), viewports: [] };

await withPlaywrightBrowser(async (browser) => {
  for (const width of widths) {
    const page = await browser.newPage({ viewport: { width, height: width === 390 ? 844 : 900 } });
    await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });

    const audit = await page.evaluate(() => ({
      hero: !!document.querySelector(".iw-ptn-hero"),
      benefits: !!document.querySelector(".iw-ptn-benefits"),
      flow: !!document.querySelector(".iw-svc-flow"),
      trades: !!document.querySelector(".iw-svc-topics"),
      faq: !!document.querySelector(".iw-ptn-faq"),
      cta: !!document.querySelector(".iw-ptn-cta"),
      flowSteps: document.querySelectorAll(".iw-svc-flow__step").length,
      faqItems: document.querySelectorAll(".iw-ptn-faq__item").length,
      chips: document.querySelectorAll(".iw-svc-topics__chip").length,
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    }));

    await page.screenshot({ path: path.join(OUT, `partners-${width}.png`), fullPage: true });

    const flow = page.locator(".iw-svc-flow");
    if (await flow.count()) {
      await flow.screenshot({ path: path.join(FLOW_OUT, `flow-${width}.png`) });
    }

    report.viewports.push({ width, audit });
    await page.close();
  }
});

fs.writeFileSync(path.join(OUT, "audit.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
