#!/usr/bin/env node
import { withPlaywrightBrowser } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl } from "./lib/dev-server-url.mjs";

const base = await findDevServerBaseUrl({ probePath: "iwasho/services.html" });
await withPlaywrightBrowser(async (browser) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 3000 } });
  await page.goto(`${base}/iwasho/services.html`, { waitUntil: "networkidle", timeout: 120000 });
  const data = await page.evaluate(() => {
    const btns = [...document.querySelectorAll("a")].filter((el) => {
      const cls = el.className || "";
      return /btn|cta/i.test(cls);
    }).map((el) => ({
      text: el.textContent.trim().replace(/\s+/g, " ").slice(0, 40),
      cls: el.className,
      h: el.offsetHeight,
    }));
    const notes = [...document.querySelectorAll("p")].filter((el) => {
      const t = el.textContent.trim();
      return t.includes("対象外") || t.includes("相談") || t.includes("記載");
    }).map((el) => ({
      text: el.textContent.trim().slice(0, 80),
      cls: el.className,
      fs: getComputedStyle(el).fontSize,
    }));
    return { btns, notes, scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  console.log(JSON.stringify(data, null, 2));
  await page.close();
});
