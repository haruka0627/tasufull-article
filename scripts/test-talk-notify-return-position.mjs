#!/usr/bin/env node
/**
 * TALK 通知 → 詳細/スレッド/カレンダー → TALKに戻る で位置復元
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const results = [];
function push(name, ok, detail = "") {
  results.push({ name, ok, detail });
}

async function findBaseUrl() {
  if (process.env.BASE_URL) return process.env.BASE_URL.replace(/\/$/, "");
  for (const host of ["http://localhost", "http://127.0.0.1"]) {
    for (const port of [5173, 5175, 5176, 5174]) {
      try {
        const res = await fetch(`${host}:${port}/talk-home.html?tab=notify`, { method: "HEAD" });
        if (res.ok) return `${host}:${port}`;
      } catch {
        /* next */
      }
    }
  }
  throw new Error("No dev server found");
}

const SCENARIOS = [
  {
    label: "public-board-detail",
    notifyId: "builder-board-publish-001",
    urlPattern: /public-board-detail\.html.*from=talk/,
    presetScrollMin: 0,
  },
  {
    label: "board-project-detail",
    notifyId: "builder-board-cancel-001",
    urlPattern: /board-project-detail\.html.*from=talk/,
    presetScrollMin: 80,
  },
  {
    label: "board-project-applications",
    notifyId: "builder-board-apply-001",
    urlPattern: /board-project-detail\.html.*view=applications.*from=talk/,
    presetScrollMin: 80,
    expectTitle: "応募者確認",
  },
  {
    label: "board-thread",
    notifyId: "builder-board-thread-001",
    urlPattern: /board-thread\.html.*from=talk/,
    presetScrollMin: 80,
  },
  {
    label: "board-thread-completion",
    notifyId: "builder-board-completion-001",
    urlPattern: /board-thread\.html.*from=talk/,
    presetScrollMin: 0,
  },
  {
    label: "mvp-calendar",
    notifyId: "builder-ops-calendar-001",
    urlPattern: /mvp-calendar\.html.*from=talk/,
    presetScrollMin: 80,
    talkAdmin: true,
  },
  {
    label: "mvp-thread",
    notifyId: "builder-ops-started-001",
    urlPattern: /mvp-thread\.html.*from=talk/,
    presetScrollMin: 80,
    talkAdmin: true,
  },
];

const BASE = await findBaseUrl();
await withPlaywrightBrowser(async (browser) => {for (const viewport of [
  { tag: "PC1280", width: 1280, height: 900 },
  { tag: "SP390", width: 390, height: 844 },
]) {
  for (const scenario of SCENARIOS) {
    const context = await browser.newContext();
    const page = await context.newPage({
      viewport: { width: viewport.width, height: viewport.height },
    });

    const talkUrl = scenario.talkAdmin
      ? `${BASE}/talk-home.html?tab=notify&talkAdmin=1`
      : `${BASE}/talk-home.html?tab=notify`;

    await page.goto(talkUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await page.waitForSelector(`[data-talk-notify-id="${scenario.notifyId}"]`, { timeout: 25000 });
    await page.waitForTimeout(600);

    await page.evaluate((id) => {
      const card = document.querySelector(`[data-talk-notify-id="${id}"]`);
      card?.scrollIntoView({ block: "center" });
    }, scenario.notifyId);
    await page.waitForTimeout(400);

    const before = await page.evaluate((id) => {
      const panel =
        document.querySelector('[data-talk-panel="notify"]') ||
        document.querySelector(".talk-home-main") ||
        document.scrollingElement;
      return {
        scroll: panel?.scrollTop || 0,
        notifyId: id,
      };
    }, scenario.notifyId);

    const prefix = `${viewport.tag}/${scenario.label}`;
    push(`${prefix}: 事前スクロール`, before.scroll >= scenario.presetScrollMin, `scroll=${before.scroll}`);

    await page.locator(`article[data-talk-notify-id="${scenario.notifyId}"]`).click();
    await page.waitForURL(scenario.urlPattern, { timeout: 25000 });
    await page.waitForTimeout(700);

    const stored = await page.evaluate(() => ({
      scroll: sessionStorage.getItem("talkScrollPosition"),
      tab: sessionStorage.getItem("talkActiveTab"),
      lineNav: sessionStorage.getItem("talkActiveLineNav"),
      notifyId: sessionStorage.getItem("talkSelectedNotificationId"),
      restore: sessionStorage.getItem("talkRestoreOnLoad"),
      cardOffset: sessionStorage.getItem("talkNotifyCardOffset"),
      cardIndex: sessionStorage.getItem("talkNotifyCardIndex"),
    }));

    push(
      `${prefix}: 位置保存 scroll`,
      stored.scroll !== null && Number(stored.scroll) >= 0,
      stored.scroll
    );
    push(`${prefix}: 位置保存 tab`, stored.tab === "notify", stored.tab);
    push(`${prefix}: 位置保存 lineNav`, stored.lineNav !== null, stored.lineNav);
    push(`${prefix}: 位置保存 notifyId`, stored.notifyId === scenario.notifyId, stored.notifyId);
    push(`${prefix}: restoreフラグ`, stored.restore === "1", stored.restore);
    push(
      `${prefix}: cardOffset保存`,
      stored.cardOffset !== null || stored.cardIndex !== null,
      `offset=${stored.cardOffset},index=${stored.cardIndex}`
    );

    if (scenario.expectTitle) {
      const titleState = await page.evaluate(() => ({
        pageTitle: document.querySelector("[data-builder-mvp-pd-title]")?.textContent?.trim() || "",
        mobileTitle: document.querySelector(".tasu-mobile-page-head__title")?.textContent?.trim() || "",
        documentTitle: document.title,
      }));
      const titleOk =
        titleState.pageTitle === scenario.expectTitle ||
        titleState.mobileTitle === scenario.expectTitle ||
        titleState.documentTitle.includes(scenario.expectTitle);
      push(`${prefix}: タイトル応募者確認`, titleOk, JSON.stringify(titleState));
    }

    await page.evaluate(() => {
      document.querySelectorAll(".is-view-focus").forEach((el) => el.classList.remove("is-view-focus"));
      window.TasufulAppMobile?.goBackToTalk?.();
    });
    await page.waitForURL(/talk-home\.html/, { timeout: 20000 });
    await page.waitForTimeout(2600);

    const after = await page.evaluate((id) => {
      const panel =
        document.querySelector('[data-talk-panel="notify"]') ||
        document.querySelector(".talk-home-main") ||
        document.scrollingElement;
      const card = document.querySelector(`[data-talk-notify-id="${id}"]`);
      const shell = document.querySelector("[data-tasu-mobile-shell-head]");
      const offset = (shell?.getBoundingClientRect().height || 0) + 8;
      const r = card?.getBoundingClientRect();
      return {
        url: location.href,
        scroll: panel?.scrollTop || 0,
        notifyTab: document.querySelector('[data-talk-tab="notify"]')?.classList.contains("is-active"),
        restoreFlag: sessionStorage.getItem("talkRestoreOnLoad"),
        cardFound: Boolean(card),
        cardInView: Boolean(
          card && r && r.top >= offset - 12 && r.top < window.innerHeight * 0.72 && r.bottom > offset
        ),
      };
    }, scenario.notifyId);

    push(
      `${prefix}: 通知タブ復元`,
      /tab=notify/.test(after.url) || after.notifyTab,
      after.url
    );
    push(
      `${prefix}: 通知カード画面内`,
      after.cardInView,
      `scroll=${after.scroll},cardFound=${after.cardFound}`
    );
    push(`${prefix}: restoreフラグ消去`, after.restoreFlag !== "1", String(after.restoreFlag));

    await context.close();
  }
}

// scrollY fallback（notifyId なし）
for (const viewport of [
  { tag: "PC1280", width: 1280, height: 900 },
  { tag: "SP390", width: 390, height: 844 },
]) {
  const context = await browser.newContext();
  const page = await context.newPage({
    viewport: { width: viewport.width, height: viewport.height },
  });

  await page.goto(`${BASE}/talk-home.html?tab=notify`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    sessionStorage.setItem("talkRestoreOnLoad", "1");
    sessionStorage.setItem("talkActiveTab", "notify");
    sessionStorage.setItem("talkActiveLineNav", "notify");
    sessionStorage.setItem("talkScrollPosition", "240");
    sessionStorage.removeItem("talkSelectedNotificationId");
    sessionStorage.removeItem("talkNotifyCardOffset");
    sessionStorage.removeItem("talkNotifyCardIndex");
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2600);

  const fb = await page.evaluate(() => {
    const panel =
      document.querySelector('[data-talk-panel="notify"]') ||
      document.querySelector(".talk-home-main") ||
      document.scrollingElement;
    return { scroll: panel?.scrollTop || 0, restore: sessionStorage.getItem("talkRestoreOnLoad") };
  });

  const prefix = `${viewport.tag}/fallback`;
  push(`${prefix}: scrollY復元`, fb.scroll >= 180, `scroll=${fb.scroll}`);
  push(`${prefix}: フラグ消去`, fb.restore !== "1", String(fb.restore));
  await context.close();
}

});

const failed = results.filter((r) => !r.ok);
console.log("\n=== talk notify return position ===\n");
results.forEach((r) => console.log(`${r.ok ? "OK" : "NG"} ${r.name}${r.detail ? ` — ${r.detail}` : ""}`));
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exit(1);
