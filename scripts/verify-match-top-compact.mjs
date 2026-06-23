import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";

const url = "http://127.0.0.1:8788/match/match-top.html?v=compact1";
const outDir = "reports/screenshots";
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(url, { waitUntil: "networkidle" });

const metrics = await page.evaluate(() => {
  const pick = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return { sel, missing: true };
    const r = el.getBoundingClientRect();
    return {
      sel,
      top: Math.round(r.top),
      bottom: Math.round(r.bottom),
      height: Math.round(r.height),
    };
  };
  const footer = document.querySelector(".match-footer--top");
  const badges = document.querySelector(".match-top-trust-badges");
  const shell = document.querySelector(".match-top-shell");
  const pageEl = document.querySelector(".match-top-page");
  return {
    shell: pick(".match-top-shell"),
    badges: pick(".match-top-trust-badges"),
    footerExists: !!footer,
    footerDisplay: footer ? getComputedStyle(footer).display : null,
    pageHeight: Math.round(pageEl?.getBoundingClientRect().height ?? 0),
    documentHeight: Math.round(document.documentElement.scrollHeight),
    scrollBeyond844: Math.max(0, Math.round(document.documentElement.scrollHeight) - 844),
    lastElementIsBadges:
      badges &&
      shell &&
      Math.abs(badges.getBoundingClientRect().bottom - shell.getBoundingClientRect().bottom) < 20,
  };
});

writeFileSync("reports/match-top-compact-metrics.json", JSON.stringify(metrics, null, 2));
await page.screenshot({ path: `${outDir}/match-top-compact-390-v2.png`, fullPage: false });
await browser.close();
console.log(JSON.stringify(metrics, null, 2));
