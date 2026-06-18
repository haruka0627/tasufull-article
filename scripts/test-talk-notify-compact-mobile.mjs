/**
 * TASFUL TALK — 通知タブ コンパクトUI（390px）
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const PORTS = [5173, 5176, 5174, 5199, 5200, 5188];

async function findBaseUrl() {
  for (const port of PORTS) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/talk-home.html?tab=notify`, { method: "HEAD" });
      if (res.ok) return `http://127.0.0.1:${port}`;
    } catch {
      /* next */
    }
  }
  throw new Error("No dev server found");
}

const base = await findBaseUrl();
console.log("Base URL:", base);

await withPlaywrightBrowser(async (browser) => {let failed = false;
const fail = (msg) => {
  console.log("NG", msg);
  failed = true;
};
const pass = (msg) => console.log("OK", msg);

const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.addInitScript(() => {
  [
    "tasful_talk_notifications",
    "tasful_platform_notify_master_v1",
    "tasful_builder_notify_master_v1",
    "tasful_anpi_notify_master_v1",
    "tasful_talk_notifications_seeded_v2",
  ].forEach((k) => localStorage.removeItem(k));
});

await page.goto(`${base}/talk-home.html?tab=notify`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.evaluate(() => document.querySelector("vite-error-overlay")?.remove());
await page.waitForSelector('[data-talk-notify-id="anpi-check-request-001"]', { timeout: 20000 });
await page.waitForTimeout(1000);
await page.evaluate(() => {
  [
    document.querySelector('[data-talk-panel="notify"]'),
    document.querySelector(".talk-panel--line-stage"),
    document.querySelector(".talk-home-main"),
    document.querySelector(".dash-content"),
  ].forEach((el) => {
    if (el) el.scrollTop = 0;
  });
  window.scrollTo(0, 0);
});
const layout = await page.evaluate(() => {
  const cards = [...document.querySelectorAll(".talk-notify-list article.talk-notify-card")];
  const tabBar = document.querySelector("[data-talk-mobile-tabbar], [data-tasu-app-tabbar]");
  const tabBarRect = tabBar?.getBoundingClientRect();
  const bottomLimit = tabBarRect ? tabBarRect.top : window.innerHeight;
  const first = cards[0];
  const avgH =
    cards.length > 0
      ? cards.slice(0, 8).reduce((s, c) => s + c.getBoundingClientRect().height, 0) / Math.min(cards.length, 8)
      : 0;
  const listGap = parseFloat(window.getComputedStyle(document.querySelector(".talk-notify-list") || document.body).gap || "0") || 0;
  const rowH = avgH + listGap;
  const headerReserve = 130;
  const usableListHeight = Math.max(0, bottomLimit - headerReserve);
  const densityEstimate = rowH > 0 ? Math.floor(usableListHeight / rowH) : 0;
  const styles = first ? window.getComputedStyle(first) : null;
  const visibleBtn = first?.querySelector(".talk-notify-card__action");
  const btnRect = visibleBtn?.getBoundingClientRect();
  const btnStyle = visibleBtn ? window.getComputedStyle(visibleBtn) : null;
  const btnVisible =
    visibleBtn &&
    btnRect &&
    btnRect.height > 2 &&
    btnRect.width > 2 &&
    btnStyle?.opacity !== "0" &&
    btnStyle?.pointerEvents !== "none" &&
    !/rect\(0(?:px)?, 0(?:px)?, 0(?:px)?, 0(?:px)?\)/.test(String(btnStyle?.clip || ""));

  const chevron = Boolean(first?.querySelector(".talk-notify-card__chevron"));
  const chevronVisible = chevron
    ? window.getComputedStyle(first.querySelector(".talk-notify-card__chevron")).display !== "none"
    : false;

  const scrollW = document.documentElement.scrollWidth;
  const clientW = document.documentElement.clientWidth;

  return {
    totalCards: cards.length,
    densityEstimate,
    usableListHeight: Math.round(usableListHeight),
    rowH: Math.round(rowH),
    firstCardHeight: first ? Math.round(first.getBoundingClientRect().height) : 0,
    avgCardHeight: cards.length
      ? Math.round(cards.slice(0, 12).reduce((s, c) => s + c.getBoundingClientRect().height, 0) / Math.min(cards.length, 12))
      : 0,
    tabBarTop: Math.round(tabBarRect?.top || 0),
    firstCardTop: first ? Math.round(first.getBoundingClientRect().top) : 0,
    horizontalOverflow: scrollW > clientW + 1,
    btnVisible,
    chevronVisible,
    padding: styles?.padding,
    hasChip: Boolean(first?.querySelector(".talk-notify-card__type, .talk-notify-card__category-chip")),
    hasTitle: Boolean(first?.querySelector(".talk-notify-card__title")),
    hasText: Boolean(first?.querySelector(".talk-notify-card__text")),
    hasTime: Boolean(first?.querySelector(".talk-notify-card__time")),
  };
});

if (layout.horizontalOverflow) fail(`横スクロールあり scroll=${layout.scrollW} client=${layout.clientW}`);
else pass("横スクロールなし");

if (layout.btnVisible) fail("青い遷移ボタンが表示されている");
else pass("遷移ボタン非表示（カードタップ方式）");

if (!layout.chevronVisible) fail("右端矢印なし");
else pass("右端矢印表示");

if (layout.firstCardHeight > 110) fail(`カード高さ過大: ${layout.firstCardHeight}px`);
else pass(`カード高さ: ${layout.firstCardHeight}px`);

if (layout.densityEstimate < 4) {
  fail(`1画面表示件数不足: 推定${layout.densityEstimate}件 (row=${layout.rowH}px, usable=${layout.usableListHeight}px)`);
} else {
  pass(`1画面表示: 推定${layout.densityEstimate}件 (カード${layout.firstCardHeight}px)`);
}

if (!layout.hasChip || !layout.hasTitle || !layout.hasText || !layout.hasTime) {
  fail(`表示要素不足: ${JSON.stringify(layout)}`);
} else {
  pass("チップ・タイトル・本文・時刻");
}

// カードタップ遷移 + from=talk
await page.locator('article[data-talk-notify-id="anpi-check-request-001"]').click();
await page.waitForURL(/anpi-dashboard\.html/, { timeout: 20000 });
const nav = await page.evaluate(() => ({
  url: location.href,
  fromTalk: /[?&]from=talk(?:&|$)/.test(location.search),
  hash: location.hash,
}));
if (!nav.fromTalk || !nav.hash.includes("check")) fail(`遷移不正: ${nav.url}`);
else pass("カードタップ → anpi-dashboard#check?from=talk");

// 公式トークは壊していないか（メッセージ数）
await page.goto(`${base}/talk-home.html?tab=chat`, { waitUntil: "domcontentloaded" });
await page.evaluate(() => {
  document.querySelector("vite-error-overlay")?.remove();
  window.TasuTalkLineRoom?.openThreadById?.("official_anpi");
});
await page.waitForSelector(".chat-notify-card__action", { timeout: 15000 });
const official = await page.evaluate(() => ({
  msgs: (window.TasuTalkOfficialRooms?.getRoomMessages?.("official_anpi") || []).filter((m) => m.kind === "notify_card").length,
  links: document.querySelectorAll(".chat-notify-card__action").length,
}));
if (official.msgs < 6) fail(`公式トーク同期: ${official.msgs}件`);
else pass(`公式トーク同期: ${official.msgs}件`);
if (official.links < 1) fail("公式トーク遷移リンクなし");
else pass("公式トーク遷移リンクあり");

});
await closeAllBrowsers();
process.exit(failed ? 1 : 0);
