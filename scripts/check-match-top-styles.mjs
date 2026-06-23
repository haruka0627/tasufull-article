import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const url = "http://127.0.0.1:8788/match/match-top.html";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(url, { waitUntil: "networkidle" });

const metrics = await page.evaluate(() => {
  const pick = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      sel,
      marginTop: s.marginTop,
      marginBottom: s.marginBottom,
      paddingTop: s.paddingTop,
      paddingBottom: s.paddingBottom,
      fontSize: s.fontSize,
      gap: s.gap,
      top: Math.round(r.top),
      height: Math.round(r.height),
    };
  };
  return {
    bottom: pick(".match-top-bottom"),
    values: pick(".match-top-values"),
    title: pick(".match-top-values__title"),
    firstItem: pick(".match-top-values__item"),
    badges: pick(".match-top-trust-badges"),
    footer: pick(".match-footer--top"),
    cssHref: [...document.querySelectorAll('link[rel="stylesheet"]')].map((l) => l.href),
  };
});

writeFileSync("reports/match-top-computed-before.json", JSON.stringify(metrics, null, 2));
await page.screenshot({ path: "reports/screenshots/match-top-before-balance.png", fullPage: true });
await browser.close();
console.log(JSON.stringify(metrics, null, 2));
