#!/usr/bin/env node
/** CTA を早期押下（A notify 未準備）でもカードが出るか */
import { chromium } from "./lib/playwright-browser.mjs";
import { requireDevServer } from "./lib/dev-base-url.mjs";
import { fixedWorkerBenchUrl } from "./lib/fixed-bench-url.mjs";

const BASE = await requireDevServer();
const URL = fixedWorkerBenchUrl(BASE);
const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 390, height: 900 } })).newPage();

await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 45000 });
await page.waitForTimeout(600);

await page.evaluate(() => {
  const win = document.getElementById("frame-b-chat")?.contentWindow;
  win?.document.querySelector("[data-listing-primary-cta]")?.click();
});

await page.waitForTimeout(5000);

const snap = await page.evaluate(() => {
  const aWin = document.getElementById("frame-a-notify")?.contentWindow;
  const rows = aWin?.TasuTalkData?.getNotifications?.({ filter: "all", applySettings: false }) || [];
  const visible = aWin
    ? [...aWin.document.querySelectorAll(".talk-notify-card")].filter(
        (c) => c.getBoundingClientRect().height > 8
      )
    : [];
  return {
    rows: rows.length,
    titles: rows.map((n) => n.title),
    visible: visible.length,
    empty: aWin?.document.body?.textContent?.includes("該当する通知はありません"),
    bWait: /buyer-wait/i.test(document.getElementById("frame-b-chat")?.src || ""),
  };
});

console.log(snap);
console.log(snap.visible > 0 && snap.titles.some((t) => t.includes("依頼が届きました")) ? "OK" : "NG");
await browser.close();
process.exit(snap.visible > 0 ? 0 : 1);
