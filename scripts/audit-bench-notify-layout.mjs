#!/usr/bin/env node
/** A/B 通知 iframe レイアウト — 高さ 300〜400px・折りたたみパネル確認 */
import { launchHeadlessBrowser } from "./lib/playwright-browser.mjs";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const URL =
  `${BASE}/chat-dual-window-demo.html?talkDev=1&review=chat-demo&demoConnect=0&liveFlow=1&userId=u_hiro&benchViewport=390&benchPattern=job-0&demoProfile=job`;

const browser = await launchHeadlessBrowser();
const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
const page = await context.newPage();

try {
await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForTimeout(1000);

const report = await page.evaluate(() => {
  const pane = (side) => {
    const col = document.querySelector(`.bench-col--${side}`);
    const wrap = col?.querySelector(".bench-pane--notify .bench-pane__frame-wrap");
    const iframe = document.getElementById(`frame-${side.toLowerCase()}-notify`);
    const rect = iframe?.getBoundingClientRect();
    const vpH = window.innerHeight;
    return {
      wrapH: Math.round(wrap?.getBoundingClientRect().height || 0),
      iframeH: Math.round(rect?.height || 0),
      top: Math.round(rect?.top || 0),
      bottom: Math.round(rect?.bottom || 0),
      visibleInViewport: rect ? rect.height >= 300 && rect.bottom > 0 && rect.top < vpH : false,
    };
  };
  const fold = (id) => {
    const el = document.getElementById(id);
    return { id, open: el?.open === true };
  };
  const cssVar = getComputedStyle(document.documentElement).getPropertyValue("--bench-notify-frame-h").trim();
  return {
    cssNotifyFrameH: cssVar,
    a: pane("a"),
    b: pane("b"),
    folds: [
      fold("benchNotifyDirectA"),
      fold("benchNotifyDirectB"),
      fold("benchVerdictFold"),
      fold("benchDebugFold"),
      fold("benchStateFold"),
      fold("benchLogFold"),
    ],
    chatFoldsOpen: [...document.querySelectorAll(".bench-chat-fold")].map((el, i) => ({
      index: i,
      open: el.open === true,
    })),
  };
});

console.log(JSON.stringify(report, null, 2));

const ok =
  report.a.iframeH >= 300 &&
  report.b.iframeH >= 300 &&
  report.a.visibleInViewport &&
  report.b.visibleInViewport &&
  report.folds.every((f) => !f.open) &&
  report.chatFoldsOpen.every((c) => !c.open);

if (!ok) {
  console.error("LAYOUT_AUDIT_FAIL");
  process.exitCode = 1;
} else {
  console.log("LAYOUT_AUDIT_OK");
}
} finally {
  await page.close().catch(() => null);
  await context.close().catch(() => null);
  await browser.close().catch(() => null);
}
