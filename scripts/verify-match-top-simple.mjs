import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const url = "http://127.0.0.1:8788/match/match-top.html?v=simple1";
const outDir = "reports/screenshots";
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(url, { waitUntil: "networkidle" });

const check = await page.evaluate(() => ({
  hasValues: !!document.querySelector(".match-top-values"),
  hasFooter: !!document.querySelector(".match-footer--top"),
  footerText: document.querySelector(".match-footer--top")?.textContent?.trim(),
  badgeCount: document.querySelectorAll(".match-top-trust-badges li").length,
  documentHeight: document.documentElement.scrollHeight,
  scrollBeyond844: Math.max(0, document.documentElement.scrollHeight - 844),
}));

await page.screenshot({ path: `${outDir}/match-top-simple-390.png`, fullPage: false });
await browser.close();
console.log(JSON.stringify(check, null, 2));
