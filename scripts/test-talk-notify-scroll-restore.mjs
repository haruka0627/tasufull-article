/**
 * TASFUL TALK — 通知→詳細→戻る でスクロール・タブ・選択カードを復元
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

await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

await page.addInitScript(() => {
  [
    "tasful_talk_notifications",
    "tasful_platform_notify_master_v1",
    "tasful_builder_notify_master_v1",
    "tasful_anpi_notify_master_v1",
    "tasful_talk_notifications_seeded_v2",
  ].forEach((k) => localStorage.removeItem(k));
  sessionStorage.clear();
});

await page.goto(`${base}/talk-home.html?tab=notify`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector('[data-talk-notify-id="builder-board-cancel-001"]', { timeout: 25000 });
await page.waitForTimeout(700);

const before = await page.evaluate(() => {
  const target = document.querySelector('[data-talk-notify-id="builder-board-cancel-001"]');
  target?.scrollIntoView({ block: "center" });
  const findPanel = () => {
    const panel = document.querySelector('[data-talk-panel="notify"]');
    if (panel && panel.scrollHeight > panel.clientHeight + 2) return panel;
    const roots = [panel, document.querySelector(".talk-home-main"), document.scrollingElement].filter(
      Boolean
    );
    for (const root of roots) {
      let el = root;
      while (el && el !== document.body) {
        const style = window.getComputedStyle(el);
        if (
          (style.overflowY === "auto" || style.overflowY === "scroll") &&
          el.scrollHeight > el.clientHeight + 2
        ) {
          return el;
        }
        el = el.parentElement;
      }
    }
    return panel || document.scrollingElement;
  };
  const panel = findPanel();
  return {
    scroll: panel?.scrollTop || 0,
    tab: document.querySelector('[data-talk-tab="notify"]')?.classList.contains("is-active"),
    panelTag: panel?.tagName || "",
  };
});

if (before.scroll < 80) {
  console.log("NG scroll setup failed", before);
  await closeAllBrowsers();
  process.exit(1);
}
console.log("OK scroll preset:", before.scroll, before.panelTag);

const storedBeforeNav = await page.evaluate(() => {
  const card = document.querySelector('article[data-talk-notify-id="builder-board-cancel-001"]');
  card?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  return {
    scroll: sessionStorage.getItem("talkScrollPosition"),
    tab: sessionStorage.getItem("talkActiveTab"),
    notifyId: sessionStorage.getItem("talkSelectedNotificationId"),
    restore: sessionStorage.getItem("talkRestoreOnLoad"),
  };
});
await page.waitForURL(/board-project-detail\.html.*from=talk/, { timeout: 25000 });
await page.waitForTimeout(800);

const stored = storedBeforeNav;
if (!stored.scroll || Number(stored.scroll) < 80) console.log("NG stored scroll", stored);
else console.log("OK sessionStorage scroll saved", stored.scroll);
if (stored.tab !== "notify") console.log("NG stored tab", stored);
else console.log("OK sessionStorage tab saved");
if (stored.notifyId !== "builder-board-cancel-001") console.log("NG stored notifyId", stored);
else console.log("OK sessionStorage notifyId saved");

await page.evaluate(() => document.querySelector("[data-tasu-talk-back]")?.click());
await page.waitForURL(/talk-home\.html/, { timeout: 20000 });
await page.waitForTimeout(900);

const after = await page.evaluate(() => {
  const findPanel = () => {
    const panel = document.querySelector('[data-talk-panel="notify"]');
    if (panel && panel.scrollHeight > panel.clientHeight + 2) return panel;
    const roots = [panel, document.querySelector(".talk-home-main"), document.scrollingElement].filter(
      Boolean
    );
    for (const root of roots) {
      let el = root;
      while (el && el !== document.body) {
        const style = window.getComputedStyle(el);
        if (
          (style.overflowY === "auto" || style.overflowY === "scroll") &&
          el.scrollHeight > el.clientHeight + 2
        ) {
          return el;
        }
        el = el.parentElement;
      }
    }
    return panel || document.scrollingElement;
  };
  const panel = findPanel();
  return {
    url: window.location.href,
    scroll: panel?.scrollTop || 0,
    notifyTab: document.querySelector('[data-talk-tab="notify"]')?.classList.contains("is-active"),
    restoreFlag: sessionStorage.getItem("talkRestoreOnLoad"),
  };
});

let failed = false;
const fail = (msg) => {
  console.log("NG", msg);
  failed = true;
};
const ok = (msg) => console.log("OK", msg);

if (!/tab=notify/.test(after.url) && !after.notifyTab) fail(`通知タブ復元 url=${after.url}`);
else ok("通知タブ復元");

if (after.scroll < Math.max(60, Number(stored.scroll || 0) - 80)) {
  fail(`スクロール復元 scroll=${after.scroll} expected~${stored.scroll}`);
} else ok(`スクロール復元 scroll=${after.scroll}`);

if (after.restoreFlag === "1") fail("restore フラグが残っている");
else ok("restore フラグ消去");

});
await closeAllBrowsers();
process.exit(failed ? 1 : 0);
