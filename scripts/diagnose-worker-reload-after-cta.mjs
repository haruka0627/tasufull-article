#!/usr/bin/env node
/**
 * CTA後に固定親URLで再読込 → A上通知が消えるか（内部resetあり）
 */
import { chromium } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { requireDevServer } from "./lib/dev-base-url.mjs";
import { fixedWorkerBenchUrl } from "./lib/fixed-bench-url.mjs";

const BASE = await requireDevServer();
const PARENT_URL = fixedWorkerBenchUrl(BASE);
const OUT = path.join("screenshots", "worker-notify-reload-after-cta");
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 390, height: 900 } })).newPage();

async function readState(label) {
  return page.evaluate((tag) => {
    const aWin = document.getElementById("frame-a-notify")?.contentWindow;
    const all = JSON.parse(localStorage.getItem("tasful_talk_notifications") || "[]");
    const hits = all.filter((n) => String(n.title || "").includes("依頼が届きました"));
    const rows = aWin?.TasuTalkData?.getNotifications?.({ filter: "all", applySettings: false }) || [];
    const filtered = aWin?.TasuTalkJobFullReviewMode?.filterJobFullReviewNotifications?.(rows) || rows;
    const cards = aWin ? [...aWin.document.querySelectorAll(".talk-notify-card")] : [];
    const visible = cards.filter((c) => c.getBoundingClientRect().height > 8);
    return {
      tag,
      parentUrl: location.href,
      bSrc: (document.getElementById("frame-b-chat")?.src || "").slice(0, 120),
      storageHits: hits.length,
      getNotificationsRows: rows.length,
      filteredRows: filtered.length,
      visibleCards: visible.length,
      emptyText: aWin?.document.body?.textContent?.includes("該当する通知はありません"),
      titles: rows.map((n) => n.title),
    };
  }, label);
}

const report = { phases: [] };

await page.goto(PARENT_URL, { waitUntil: "domcontentloaded", timeout: 45000 });
await page.waitForTimeout(2500);

const bf = page.frames().find((f) => /detail-worker/i.test(f.url()));
await bf?.evaluate(() => document.querySelector("[data-listing-primary-cta]")?.click());
await page.waitForTimeout(4000);
report.phases.push({ step: "after_cta", ...(await readState("after_cta")) });

await page.goto(PARENT_URL, { waitUntil: "domcontentloaded", timeout: 45000 });
await page.waitForTimeout(4000);
report.phases.push({ step: "after_reload_same_parent", ...(await readState("after_reload")) });

await page.screenshot({ path: path.join(OUT, "after-reload-steady.png") });
await page.locator("#frame-a-notify").screenshot({ path: path.join(OUT, "a-notify-after-reload.png") }).catch(() => {});

report.ok = report.phases[1]?.visibleCards > 0 && report.phases[1]?.getNotificationsRows > 0;
fs.writeFileSync(path.join(OUT, "reload-report.json"), JSON.stringify(report, null, 2));

console.log(JSON.stringify(report, null, 2));
console.log(`RESULT: ${report.ok ? "OK" : "NG — reload drops A notify"}`);
await browser.close();
process.exit(report.ok ? 0 : 1);
