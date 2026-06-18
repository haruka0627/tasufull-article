#!/usr/bin/env node
import { chromium } from "./lib/playwright-browser.mjs";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const browser = await chromium.launch({ headless: true });
const page = await (
  await browser.newContext({ viewport: { width: 390, height: 900 } })
).newPage();

const notify = {
  id: "talk-n-test-hired-360b",
  type: "job",
  title: "応募が承諾されました",
  body: "test",
  actionLabel: "やり取りチャットを開く",
  href: "/chat-detail.html?thread=x&userId=u_hiro",
  targetUrl: "/chat-detail.html?thread=x&userId=u_hiro",
  recipientUserId: "u_hiro",
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
await page.waitForTimeout(1500);
await page.evaluate((n) => {
  const all = JSON.parse(localStorage.getItem("tasful_talk_notifications") || "[]");
  all.unshift(n);
  localStorage.setItem("tasful_talk_notifications", JSON.stringify(all));
  const el = document.getElementById("frame-b-notify");
  el?.contentWindow?.postMessage?.({ type: "tasu-bench-notify-refresh" }, "*");
}, notify);
await page.waitForTimeout(2000);

const report = await page.evaluate(() => {
  const iframeEl = document.getElementById("frame-b-notify");
  const win = iframeEl?.contentWindow;
  const doc = win?.document;
  const iframeH = Math.round(iframeEl?.getBoundingClientRect?.().height || 0);
  const rel = (el) => {
    const r = el?.getBoundingClientRect?.();
    if (!r) return null;
    return {
      top: Math.round(r.top),
      bottom: Math.round(r.bottom),
      h: Math.round(r.height),
      inIframe: r.top >= 0 && r.bottom <= iframeH + 2,
    };
  };
  const list = doc?.querySelector("[data-talk-notify-list]");
  const card = doc?.querySelector(".talk-notify-card");
  const cta = doc?.querySelector(".talk-notify-card__minimal-action, .talk-notify-card__card-cta");
  return {
    iframeH,
    innerH: win?.innerHeight,
    htmlH: doc?.documentElement?.style?.height,
    panel: rel(doc?.querySelector('[data-talk-panel="notify"]')),
    list: rel(list),
    card: rel(card),
    cta: rel(cta),
    cardCount: doc?.querySelectorAll(".talk-notify-card").length || 0,
    listMaxH: list ? getComputedStyle(list).maxHeight : null,
    listDisplay: list ? getComputedStyle(list).display : null,
    diag: win?.__tasuBenchNotifyRenderDiag,
  };
});

console.log(JSON.stringify(report, null, 2));
await browser.close();
