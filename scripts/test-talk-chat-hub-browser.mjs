#!/usr/bin/env node
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
/**
 * TASFUL TALK — チャットハブ smoke test（現行UI / talkDev=1）
 *
 *   node scripts/test-talk-chat-hub-browser.mjs
 */
import { findDevServerBaseUrl, buildLocalPageUrl } from "./lib/dev-server-url.mjs";

const THREAD_KEY = "tasful_chat_threads";
const FRIEND_THREAD_ID = "talk-mock-friend-001";
const FRIEND_DISPLAY_NAME = "田中 一郎";
const FRIEND_PREVIEW_SNIPPET = "カフェ";

const base = await findDevServerBaseUrl({ probePath: "talk-home.html" });
console.log("Base URL:", base);

function talkUrl(params = {}) {
  const sp = new URLSearchParams({ talkDev: "1", ...params });
  return buildLocalPageUrl(base, "talk-home.html", `?${sp}`);
}

async function main() {
  await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({ viewport: { width: 1280, height: 900 }
});
  const errors = [];
  const pass = (m) => console.log(`  ✓ ${m}`);
  const fail = (m) => {
    errors.push(m);
    console.log(`  ✗ ${m}`);
  };

  try {
    await page.goto(talkUrl({ tab: "chat" }), {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    await page.waitForFunction(() => typeof window.TasuTalkData?.applyChatHubFilters === "function");
    await page.waitForSelector(".talk-line-list__item", { timeout: 15000 });

    const lineUi = await page.evaluate(
      ({ threadId, previewSnippet }) => {
        const row = document.querySelector(
          `[data-talk-thread-id="${threadId}"].talk-line-list__item, [data-talk-select-thread][data-talk-thread-id="${threadId}"]`
        );
        if (!row) return { ok: false, reason: `${threadId} row missing` };
        const avatar = row.querySelector(
          ".talk-line-list__avatar, .talk-line-list__avatar--img, .talk-line-list__avatar--initials, .talk-line-list__avatar-wrap"
        );
        const name = row.querySelector(".talk-line-list__name");
        const preview = row.querySelector(".talk-line-list__preview");
        const unread = row.querySelector(".talk-chat-line__unread");
        if (!avatar || !name?.textContent?.trim()) return { ok: false, reason: "avatar or name" };
        if (!String(preview?.textContent || "").includes(previewSnippet)) {
          return { ok: false, reason: `preview expected snippet: ${previewSnippet}` };
        }
        if (!unread) return { ok: false, reason: "unread badge" };
        return { ok: true, name: name.textContent.trim(), preview: preview.textContent.trim() };
      },
      { threadId: FRIEND_THREAD_ID, previewSnippet: FRIEND_PREVIEW_SNIPPET }
    );
    if (!lineUi.ok) fail(`LINE-style list row: ${lineUi.reason || "unknown"}`);
    else pass(`LINE-style list (${lineUi.name} / unread)`);

    const searchOk = await page.evaluate(() => {
      const source = window.TasuTalkData.buildChatDisplayList(window.TasuTalkData.getRecentChats() || []);
      const rows = window.TasuTalkData.applyChatHubFilters(source, { channel: "all", query: "カフェ" });
      return rows.some((r) => String(r.lastMessagePreview || "").includes("カフェ"));
    });
    if (!searchOk) fail("search filters demo social threads");
    else pass("search filters demo social threads");

    const friendList = await page.evaluate(() => {
      const source = window.TasuTalkData.buildChatDisplayList(window.TasuTalkData.getRecentChats() || []);
      return source.filter((r) => r.chatDomain === "friend" && String(r.id || "").startsWith("talk-mock"));
    });
    if (friendList.length < 1) fail("demo friend threads in list");
    else pass(`demo friend threads: ${friendList.length}`);

    const unreadSort = await page.evaluate(() => {
      const rows = window.TasuTalkData.sortChatThreads(
        window.TasuTalkData.buildChatDisplayList(window.TasuTalkData.getRecentChats() || [])
      );
      const firstUnread = rows.findIndex((r) => Number(r.unreadCount) > 0);
      if (firstUnread < 0) return rows.length > 0;
      for (let i = 0; i < firstUnread; i += 1) {
        if (Number(rows[i].unreadCount) > 0) return false;
      }
      return true;
    });
    if (!unreadSort) fail("unread threads sort first");
    else pass("unread threads sort first");

    const builderHrefData = await page.evaluate(() => window.TasuTalkData.getBuilderHub?.().href || "");
    if (!builderHrefData.includes("builder/mvp-threads.html")) {
      fail(`builder hub href: ${builderHrefData}`);
    } else pass("builder hub links to mvp-threads");

    await page.goto(talkUrl({ tab: "chat", talkAdmin: "1" }), {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    await page.waitForSelector('.talk-line-list__item--static[data-talk-channel-row="ai_consult"]', {
      timeout: 15000,
    });
    const aiHref = await page.evaluate(() => {
      const card = window.TasuTalkData.getStaticChatHubCards().find((c) => c._talkChannel === "ai_consult");
      return window.TasuTalkData.resolveChatTalkHref(card || {});
    });
    if (!aiHref?.includes("ai-workspace.html")) fail(`ai hub href: ${aiHref}`);
    else pass("ai hub → ai-workspace.html");

    const supportHref = await page.evaluate(() => {
      const card = window.TasuTalkData.getStaticChatHubCards().find((c) => c.id === "talk-hub-support");
      return window.TasuTalkData.resolveChatTalkHref(card || {});
    });
    if (!supportHref?.includes("support-trouble-center.html")) fail(`support hub href: ${supportHref}`);
    else pass("support hub → support-trouble-center.html");

    await page.goto(talkUrl({ tab: "chat" }), { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForSelector(".talk-line-list__item", { timeout: 15000 });
    await page.click(`[data-talk-select-thread][data-talk-thread-id="${FRIEND_THREAD_ID}"]`);
    await page.waitForTimeout(400);
    const inlineRoom = await page.evaluate((displayName) => {
      const col = document.querySelector("[data-talk-line-room]");
      const empty = document.querySelector("[data-talk-line-room-empty]");
      const active = document.querySelector("[data-talk-line-room-active]");
      const name = document.querySelector("[data-talk-line-peer-name]");
      const msgs = document.querySelector("[data-talk-line-messages] .chat-msg");
      const emptyVisible =
        empty && !empty.hidden && window.getComputedStyle(empty).display !== "none";
      return Boolean(
        col?.classList.contains("talk-line-room--active") &&
          col?.getAttribute("data-selected-thread-id") &&
          active &&
          !active.hidden &&
          !emptyVisible &&
          String(name?.textContent || "").includes(displayName) &&
          msgs
      );
    }, FRIEND_DISPLAY_NAME);
    if (!inlineRoom) fail("inline room opens without navigation");
    else pass("inline room opens without navigation");

    const emptyCopy = await page.evaluate(() => window.TasuTalkData.CHAT_EMPTY_MESSAGE);
    if (!emptyCopy?.includes("取引のやりとり")) fail("empty message constant");
    else pass("empty message constant (notification center copy)");

    const legacyLink = await page.locator('a[href="chat-list.html"]').count();
    if (legacyLink < 1) fail("legacy chat-list link preserved");
    else pass("legacy chat-list link preserved");

    await page.evaluate((key) => {
      localStorage.setItem(key, "{{not-json");
    }, THREAD_KEY);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(600);
    const crashed = await page.evaluate(() => {
      const list = document.getElementById("talkChatThreadList");
      return !list || list.textContent.includes("失敗");
    });
    if (crashed) fail("corrupt localStorage does not break page");
    else pass("corrupt localStorage does not break page");

    await page.goto(talkUrl({ tab: "notify" }), { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(300);
    const notifyPanel = await page.locator('[data-talk-panel="notify"]').isVisible();
    if (!notifyPanel) fail("notify tab still works");
    else pass("notify tab still works");

    await page.goto(talkUrl({ tab: "chat" }), { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForSelector(".talk-line-list__item", { timeout: 15000 });

    const pcLayout = await page.evaluate(() => {
      const rail = document.querySelector(".talk-line-rail");
      const split = document.querySelector(".talk-line-split");
      if (!rail || !split) return { ok: false, reason: "shell missing" };
      const railDisplay = getComputedStyle(rail).display;
      const cols = getComputedStyle(split).gridTemplateColumns || "";
      const threeCol = cols.includes(" ") && cols.split(" ").filter(Boolean).length >= 2;
      return { ok: railDisplay !== "none" && threeCol, railDisplay, cols };
    });
    if (!pcLayout.ok) fail(`PC 3-column layout: ${pcLayout.reason || pcLayout.cols}`);
    else pass("PC 3-column layout (rail + split columns)");

    const pcComposer = await page.evaluate(() => {
      const c = document.querySelector(".talk-line-composer");
      return c && getComputedStyle(c).flexShrink === "0";
    });
    if (!pcComposer) fail("PC composer pinned in flex column");
    else pass("PC composer flex-shrink 0 (bottom area)");

    const mobilePage = await browser.newPage({
      viewport: { width: 390, height: 844 },
      isMobile: true,
    });
    try {
      await mobilePage.goto(talkUrl({ tab: "chat" }), {
        waitUntil: "domcontentloaded",
        timeout: 20000,
      });
      await mobilePage.waitForSelector(".talk-line-list__item", { timeout: 15000 });

      const mobileChrome = await mobilePage.evaluate(() => {
        const rail = document.querySelector(".talk-line-rail");
        const tabbar = document.querySelector("[data-talk-mobile-tabbar]");
        const header = document.querySelector("[data-talk-page-header]");
        const listCol = document.querySelector(".talk-line-list-col");
        const roomCol = document.querySelector(".talk-line-room-col");
        const split = document.querySelector(".talk-line-split");
        return {
          railHidden: rail && getComputedStyle(rail).display === "none",
          tabbarVisible: tabbar && getComputedStyle(tabbar).display !== "none",
          headerHidden: !header || getComputedStyle(header).display === "none",
          listVisible: listCol && getComputedStyle(listCol).display !== "none",
          roomHidden:
            !split?.classList.contains("talk-line-split--room-open") &&
            roomCol &&
            getComputedStyle(roomCol).display === "none",
          talkTabActive: Boolean(
            tabbar?.querySelector('[data-talk-mobile-tab="chat"].is-active')
          ),
          tabCount: tabbar?.querySelectorAll("[data-talk-mobile-tab]").length || 0,
        };
      });
      if (!mobileChrome.railHidden) fail("mobile: left rail hidden");
      else pass("mobile: left rail hidden");
      if (!mobileChrome.tabbarVisible) fail("mobile: bottom tab bar visible");
      else pass("mobile: bottom tab bar visible");
      if (mobileChrome.tabCount !== 4) fail(`mobile: tab count ${mobileChrome.tabCount} (expected 4)`);
      else pass("mobile: 4-tab bar (home/TALK/AI/mypage)");
      if (!mobileChrome.headerHidden) fail("mobile: page header hidden on chat tab");
      else pass("mobile: page header hidden on chat tab");
      if (!mobileChrome.listVisible || !mobileChrome.roomHidden) {
        fail("mobile: initial list-only view");
      } else pass("mobile: initial list-only view");
      if (!mobileChrome.talkTabActive) fail("mobile: TALK tab active");
      else pass("mobile: TALK tab active");

      const tabHrefs = await mobilePage.evaluate(() => {
        const get = (id) =>
          document.querySelector(`[data-talk-mobile-tab="${id}"]`)?.getAttribute("href") || "";
        return {
          home: get("home"),
          chat: get("chat"),
          ai: get("ai"),
          mypage: get("mypage"),
          notify: get("notify"),
        };
      });
      if (tabHrefs.home !== "dashboard.html") fail("mobile tab: home → dashboard");
      else pass("mobile tab: home → dashboard");
      if (!tabHrefs.chat.includes("tab=chat")) fail("mobile tab: TALK → chat");
      else pass("mobile tab: TALK → chat");
      if (tabHrefs.notify) fail(`mobile: notify tab removed (got ${tabHrefs.notify})`);
      else pass("mobile: notify tab removed (notify via TALK内パネル)");
      if (tabHrefs.ai !== "ai-workspace.html") fail(`mobile tab: ai → ${tabHrefs.ai}`);
      else pass("mobile tab: ai → ai-workspace.html");
      if (tabHrefs.mypage !== "profile-settings.html") fail("mobile tab: mypage → profile-settings");
      else pass("mobile tab: mypage → profile-settings");

      const layoutWidth = await mobilePage.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const main = document.querySelector(".talk-home-main");
        const app = document.querySelector(".talk-line-app");
        if (!main || !app) return { ok: false };
        const mw = main.getBoundingClientRect().width;
        const aw = app.getBoundingClientRect().width;
        return {
          ok: Math.abs(mw - aw) <= 2 && mw >= vw * 0.85,
          mw,
          aw,
          vw,
        };
      });
      if (!layoutWidth.ok) {
        fail(`mobile: chat shell width (main=${layoutWidth.mw}, app=${layoutWidth.aw}, vw=${layoutWidth.vw})`);
      } else pass("mobile: chat shell fills viewport band");

      await mobilePage.click(`[data-talk-select-thread][data-talk-thread-id="${FRIEND_THREAD_ID}"]`);
      await mobilePage.waitForTimeout(400);
      const afterOpen = await mobilePage.evaluate((displayName) => ({
        url: location.href,
        splitOpen: document
          .querySelector(".talk-line-split")
          ?.classList.contains("talk-line-split--room-open"),
        listHidden:
          getComputedStyle(document.querySelector(".talk-line-list-col")).display === "none",
        roomActive: document
          .querySelector(".talk-line-room-col")
          ?.classList.contains("talk-line-room--active"),
        backVisible:
          getComputedStyle(document.querySelector(".talk-line-room-header__back")).display !==
          "none",
        name: document.querySelector("[data-talk-line-peer-name]")?.textContent || "",
        hasDisplayName: String(
          document.querySelector("[data-talk-line-peer-name]")?.textContent || ""
        ).includes(displayName),
      }), FRIEND_DISPLAY_NAME);
      if (afterOpen.url.includes("chat-detail.html")) {
        fail("mobile: must not navigate to chat-detail.html");
      } else pass("mobile: inline room (no chat-detail navigation)");
      if (!afterOpen.splitOpen || !afterOpen.listHidden || !afterOpen.roomActive) {
        fail("mobile: conversation full-width after select");
      } else pass("mobile: conversation full-width after select");
      if (!afterOpen.backVisible) fail("mobile: back button visible");
      else pass("mobile: back button visible");
      if (!afterOpen.hasDisplayName) fail(`mobile: peer name (${afterOpen.name})`);
      else pass(`mobile: peer name (${FRIEND_DISPLAY_NAME})`);

      const composerSticky = await mobilePage.evaluate(() => {
        const c = document.querySelector(".talk-line-composer");
        return c && getComputedStyle(c).position === "sticky";
      });
      if (!composerSticky) fail("mobile: composer sticky bottom");
      else pass("mobile: composer sticky bottom");

      await mobilePage.click("[data-talk-line-room-back]");
      await mobilePage.waitForTimeout(300);
      const afterBack = await mobilePage.evaluate(() => ({
        splitOpen: document
          .querySelector(".talk-line-split")
          ?.classList.contains("talk-line-split--room-open"),
        listVisible:
          getComputedStyle(document.querySelector(".talk-line-list-col")).display !== "none",
        roomHidden:
          getComputedStyle(document.querySelector(".talk-line-room-col")).display === "none",
      }));
      if (afterBack.splitOpen || !afterBack.listVisible || !afterBack.roomHidden) {
        fail("mobile: back returns to thread list");
      } else pass("mobile: back returns to thread list");
      if (!mobilePage.url().includes("talk-home.html")) {
        fail("mobile: still on talk-home after back");
      } else pass("mobile: still on talk-home after back");
    } finally {
      await mobilePage.close();
    }
  } catch (err) {
    fail(String(err?.message || err));
  }
});
  

  console.log("");
  if (errors.length) {
    console.error(`FAILED (${errors.length}):`);
    errors.forEach((e) => console.error(`  - ${e}`));
    await closeAllBrowsers();
    process.exit(1);
  }
  console.log("All talk chat hub checks passed.");
}

main();
