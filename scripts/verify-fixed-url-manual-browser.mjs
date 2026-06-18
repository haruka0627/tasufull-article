#!/usr/bin/env node
/**
 * 固定URL — 手動ブラウザ相当の実画面検証
 * 固定親URLのみ — 3秒以内に4枠 / B下CTA / A上通知
 */
import { chromium } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { requireDevServer } from "./lib/dev-base-url.mjs";
import {
  fixedWorkerBenchUrl,
  FORBIDDEN_PARENT_BENCH_PARAMS,
  isCanonicalBenchParentUrl,
} from "./lib/fixed-bench-url.mjs";

const BASE = await requireDevServer();
const URL = fixedWorkerBenchUrl(BASE);
const OUT = path.join("screenshots", "fixed-url-manual-browser");
fs.mkdirSync(OUT, { recursive: true });

const FRAME_IDS = ["frame-a-notify", "frame-a-chat", "frame-b-notify", "frame-b-chat"];

async function snap(page, tag) {
  return page.evaluate((t) => {
    const frames = ["frame-a-notify", "frame-a-chat", "frame-b-notify", "frame-b-chat"];
    const info = {};
    frames.forEach((id) => {
      const el = document.getElementById(id);
      const src = el?.src || "";
      const r = el?.getBoundingClientRect?.() || { width: 0, height: 0 };
      info[id] = { hasSrc: Boolean(src && !/about:blank$/i.test(src)), src: src.slice(0, 100), w: r.width, h: r.height };
    });
    const p = new URLSearchParams(location.search);
    const forbidden = ["liveFlowReset", "benchReconcile"].filter((k) => p.has(k));
    return {
      tag: t,
      parentUrl: location.href,
      forbiddenParams: forbidden,
      parentRenderCount: Number(document.getElementById("benchDebugPanel")?.textContent?.match(/parent render: (\d+)/)?.[1] || 0),
      frames: info,
      allFramesOk: Object.values(info).every((f) => f.hasSrc && f.w > 40 && f.h > 40),
    };
  }, tag);
}

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 390, height: 900 } })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.message || e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});

const report = { url: URL, timeline: [], errors: [], ok: false };

await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });

for (const ms of [0, 500, 1000, 2000, 3000]) {
  if (ms > 0) await page.waitForTimeout(ms - (report.timeline.at(-1)?.ms || 0));
  const s = await snap(page, `t${ms}ms`);
  report.timeline.push({ ms, ...s });
  await page.screenshot({ path: path.join(OUT, `bench-${ms}ms.png`) });
}

const at3s = report.timeline.find((t) => t.ms === 3000);
report.checks = {
  canonicalUrl: isCanonicalBenchParentUrl(URL),
  frames3s: at3s?.allFramesOk === true,
  noForbiddenParams: !(at3s?.forbiddenParams || []).length,
};

// B下CTA
const bFrame = page.frames().find((f) => /detail-worker|buyer-wait/i.test(f.url()));
let ctaOk = false;
if (bFrame && /detail-worker/i.test(bFrame.url())) {
  ctaOk = await bFrame.evaluate(() => {
    const btn = document.querySelector("[data-listing-primary-cta]");
    if (!btn || btn.disabled) return false;
    btn.click();
    return true;
  });
} else if (bFrame && /buyer-wait/i.test(bFrame.url())) {
  report.checks.ctaNote = "B already on buyer-wait (prior state)";
  ctaOk = true;
}
report.checks.ctaClicked = ctaOk;

await page.waitForTimeout(4500);
await page.locator("#frame-a-notify").screenshot({ path: path.join(OUT, "a-notify-after-cta.png") });
await page.screenshot({ path: path.join(OUT, "bench-after-cta.png") });

report.checks.notify = await page.evaluate(() => {
  const aWin = document.getElementById("frame-a-notify")?.contentWindow;
  if (!aWin) return { ok: false };
  const cards = [...aWin.document.querySelectorAll(".talk-notify-card")].filter((c) => c.getBoundingClientRect().height > 8);
  const titles = cards.map((c) => c.querySelector(".talk-notify-card__title")?.textContent?.trim() || "");
  const empty = aWin.document.body?.textContent?.includes("該当する通知はありません");
  return {
    ok: titles.some((t) => t.includes("依頼が届きました")),
    titles,
    empty,
    bWait: /buyer-wait/i.test(document.getElementById("frame-b-chat")?.src || ""),
  };
});

report.errors = errors.slice(0, 20);
report.ok =
  report.checks.canonicalUrl &&
  report.checks.frames3s &&
  report.checks.noForbiddenParams &&
  report.checks.ctaClicked &&
  report.checks.notify?.ok === true;

fs.writeFileSync(path.join(OUT, "manual-browser-report.json"), JSON.stringify(report, null, 2));
await browser.close();

console.log("\n=== FIXED URL MANUAL BROWSER VERIFY ===");
console.log("URL:", URL);
console.log("3s frames:", report.checks.frames3s ? "OK" : "NG", at3s?.frames);
console.log("canonical parent:", report.checks.canonicalUrl ? "OK" : "NG");
console.log("no forbidden params:", report.checks.noForbiddenParams ? "OK" : "NG");
console.log("CTA:", report.checks.ctaClicked ? "OK" : "NG");
console.log("A notify:", report.checks.notify?.ok ? "OK" : "NG", report.checks.notify);
if (report.errors.length) console.log("Errors:", report.errors);
console.log("RESULT:", report.ok ? "MANUAL-BROWSER OK" : "MANUAL-BROWSER NG");
console.log("Screenshots:", OUT);
process.exit(report.ok ? 0 : 1);
