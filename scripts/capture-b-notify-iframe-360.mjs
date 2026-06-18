#!/usr/bin/env node
/** B 本番通知 iframe — 360px 高さでカード+CTA が写るか */
import { chromium } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const OUT = path.join("screenshots", "bench-job-0-notify-360");
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await (
  await browser.newContext({ viewport: { width: 390, height: 900 } })
).newPage();

const notify = {
  id: `talk-n-capture-${Date.now()}`,
  type: "job",
  title: "応募が承諾されました",
  body: "掲載者が応募を承諾しました。",
  actionLabel: "やり取りチャットを開く",
  href: "/chat-detail.html?thread=chat-capture&userId=u_hiro&review=chat-demo",
  targetUrl: "/chat-detail.html?thread=chat-capture&userId=u_hiro&review=chat-demo",
  recipientUserId: "u_hiro",
  recipientRole: "applicant",
  source: "job",
  category: "求人",
  notifyListingTitle: "デモ求人",
  createdAt: new Date().toISOString(),
  minimalNotifyCard: true,
  sendNotification: true,
};

await page.goto(
  `${BASE}/chat-dual-window-demo.html?talkDev=1&review=chat-demo&demoConnect=0&liveFlow=1&userId=u_hiro&benchViewport=390&benchPattern=job-0&demoProfile=job`,
  { waitUntil: "domcontentloaded" }
);
await page.waitForTimeout(2000);
await page.evaluate((n) => {
  const all = JSON.parse(localStorage.getItem("tasful_talk_notifications") || "[]");
  all.unshift(n);
  localStorage.setItem("tasful_talk_notifications", JSON.stringify(all));
  document.getElementById("frame-b-notify")?.contentWindow?.postMessage?.({ type: "tasu-bench-notify-refresh" }, "*");
}, notify);
await page.waitForTimeout(3500);

const report = await page.evaluate(() => {
  const wrap = document.querySelector(".bench-col--b .bench-pane--notify .bench-pane__frame-wrap");
  const iframe = document.getElementById("frame-b-notify");
  const doc = iframe?.contentWindow?.document;
  const title =
    doc?.querySelector(".talk-notify-card__title, .talk-notify-card__title--job-event")?.textContent?.trim() || "";
  const cta =
    doc?.querySelector(".talk-notify-card__minimal-action, .talk-notify-card__card-cta")?.textContent?.trim() || "";
  return {
    wrapH: Math.round(wrap?.getBoundingClientRect().height || 0),
    iframeH: Math.round(iframe?.getBoundingClientRect().height || 0),
    cards: doc?.querySelectorAll(".talk-notify-card").length || 0,
    title,
    cta,
  };
});

await page.locator(".bench-col--b .bench-pane--notify .bench-pane__frame-wrap").screenshot({
  path: path.join(OUT, "b-notify-iframe-360-proof.png"),
});

const ok =
  report.wrapH >= 300 &&
  report.iframeH >= 300 &&
  report.cards >= 1 &&
  report.title.includes("応募が承諾") &&
  report.cta.includes("やり取りチャットを開く");

console.log(JSON.stringify({ ...report, ok, screenshot: path.join(OUT, "b-notify-iframe-360-proof.png") }, null, 2));
await browser.close();
process.exit(ok ? 0 : 1);
