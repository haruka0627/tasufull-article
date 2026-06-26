#!/usr/bin/env node
/**
 * 一般案件（builder_board）専用 board-* ページの最小検証
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:5173").replace(/\/$/, "");
const results = [];

function push(name, ok, detail = "") {
  results.push({ name, ok, detail });
}

await withPlaywrightBrowser(async (browser) => {// 1. board-projects: builder_board のみ / tasful_managed 非表示
const listPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
await listPage.goto(`${BASE}/builder/board-projects.html?role=partner`, { waitUntil: "domcontentloaded" });
await listPage.waitForSelector("[data-builder-board-project-list] article.mvp-card", { timeout: 20000 });

const listData = await listPage.evaluate(() => {
  const cards = [...document.querySelectorAll("[data-builder-board-project-list] article.mvp-card")];
  const ALLOWED_BOARD_TYPES = new Set(["project", "job", "worker", "calendar"]);
  const boardTypes = cards.map((c) => c.getAttribute("data-board-type") || "");
  const allBoardFeed = cards.length > 0 && boardTypes.every((t) => ALLOWED_BOARD_TYPES.has(t));
  const kinds = cards.map((c) => c.querySelector(".mvp-pill--kind")?.textContent?.trim() || "");
  const applyBtn = document.querySelector("[data-builder-board-apply]");
  return {
    cardCount: cards.length,
    allBoardFeed,
    boardTypes,
    kinds,
    hasApplyCta: Boolean(applyBtn),
    firstProjectId: cards[0]?.getAttribute("data-project-id") || "",
  };
});

// tasful_managed をストアに注入しても一覧に出ないこと
await listPage.evaluate(() => {
  const KEY = "tasful:builder:mvp:v1";
  let state = {};
  try {
    state = JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    state = {};
  }
  const exists = (state.projects || []).some((p) => p.project_id === "demo-managed-hidden-001");
  if (!exists) {
    state.projects = [
      ...(state.projects || []),
      {
        project_id: "demo-managed-hidden-001",
        owner_id: state.owner_id || "owner-demo-001",
        title: "運営管理テスト案件（非表示）",
        kind: "tasful_managed",
        status: "open",
        required_partners: 1,
        selected_partner_ids: [],
        visibility: "partner_only",
        contact_policy: "tasful_talk_only",
        main_thread_id: "thread-managed-hidden",
        created_at: new Date().toISOString(),
      },
    ];
    localStorage.setItem(KEY, JSON.stringify(state));
  }
});

await listPage.reload({ waitUntil: "domcontentloaded" });
await listPage.waitForSelector("[data-builder-board-project-list] article.mvp-card", { timeout: 20000 });
await listPage.waitForTimeout(400);
const afterInject = await listPage.evaluate(() => {
  const cards = [...document.querySelectorAll("[data-builder-board-project-list] article.mvp-card")];
  const titles = cards.map((c) => c.querySelector(".mvp-card__title")?.textContent?.trim() || "");
  return {
    showsManaged: titles.some((t) => t.includes("運営管理テスト案件")),
    cardCount: cards.length,
  };
});

push(
  "board-projects: builder_board のみ表示",
  listData.allBoardFeed && listData.cardCount > 0,
  `cards=${listData.cardCount} types=${listData.boardTypes.join(",")}`
);
push("board-projects: tasful_managed 非表示", !afterInject.showsManaged, afterInject.showsManaged ? "managed visible" : `cards=${afterInject.cardCount}`);
push("board-projects: パートナー応募CTA", listData.hasApplyCta, "");

const projectId = listData.firstProjectId || "demo-project-001";

// 2. 一覧 → 詳細
const detailLink = listPage.locator(`[data-project-id="${projectId}"] .mvp-card__titleLink`).first();
await detailLink.click();
await listPage.waitForURL(/board-project-detail\.html/, { timeout: 15000 });
push("一覧 → 詳細 導線", listPage.url().includes("board-project-detail.html"), listPage.url());

const partnerDetail = await listPage.evaluate(() => ({
  hasApply: Boolean(document.querySelector("[data-builder-board-pd-apply]:not([hidden])")),
  hasThread: Boolean(document.querySelector("[data-builder-board-pd-thread]")),
}));
push("詳細: パートナー応募CTA", partnerDetail.hasApply || partnerDetail.hasThread, "");

// 3. オーナー視点で応募者管理
await listPage.goto(`${BASE}/builder/board-project-detail.html?id=${encodeURIComponent(projectId)}&role=owner`, {
  waitUntil: "domcontentloaded",
});
await listPage.waitForSelector("[data-builder-board-pd-apps-section]", { timeout: 15000 });
const ownerDetail = await listPage.evaluate(() => ({
  appsVisible: !document.querySelector("[data-builder-board-pd-apps-section]")?.hidden,
  hasAppList: Boolean(document.querySelector("[data-builder-mvp-pd-app-list] .mvp-pd-appItem")),
  hasSelect: Boolean(document.querySelector("[data-builder-board-pd-select]")),
}));
push("詳細: オーナー応募者管理UI", ownerDetail.appsVisible, ownerDetail.hasAppList ? "応募者あり" : "応募者なし（UI表示）");

// 4. 詳細 → チャット
const threadHref = await listPage.locator("[data-builder-board-pd-thread]").getAttribute("href").catch(() => "");
if (threadHref && threadHref.includes("board-thread.html")) {
  await listPage.goto(`${BASE}/builder/${threadHref.replace(/^\.\//, "")}`, { waitUntil: "domcontentloaded" });
} else {
  const threadId = await listPage.evaluate((pid) => {
    try {
      const state = JSON.parse(localStorage.getItem("tasful:builder:mvp:v1") || "{}");
      const p = (state.projects || []).find((x) => x.project_id === pid);
      return p?.main_thread_id || "thread-demo-001";
    } catch {
      return "thread-demo-001";
    }
  }, projectId);
  await listPage.goto(`${BASE}/builder/board-thread.html?thread_id=${encodeURIComponent(threadId)}&role=partner`, {
    waitUntil: "domcontentloaded",
  });
}
await listPage.waitForSelector("[data-builder-mvp-thread-msgs]", { timeout: 15000 });

const threadData = await listPage.evaluate(() => ({
  hasEnter: Boolean(document.querySelector("[data-builder-mvp-thread-enter]")),
  hasLeave: Boolean(document.querySelector("[data-builder-mvp-thread-leave]")),
  photosPanelHidden: document.getElementById("photos")?.hidden === true,
  reportsPanelHidden: document.getElementById("files")?.hidden === true,
  hasCompletionJump: Boolean(document.querySelector("[data-builder-board-thread-completion-jump]:not([hidden])")),
  hasTalkLink: Boolean(document.querySelector('[data-builder-board-thread-talk][href*="talk-home"]')),
  hasCompose: Boolean(document.querySelector("[data-builder-mvp-thread-form]")),
  url: location.href,
}));

push("詳細 → チャット 導線", threadData.url.includes("board-thread.html"), threadData.url);
push("board-thread: 入退場UIなし", !threadData.hasEnter && !threadData.hasLeave, "");
push(
  "board-thread: 現場管理UIなし",
  threadData.photosPanelHidden && threadData.reportsPanelHidden,
  ""
);
push(
  "board-thread: 完了/支払い導線",
  threadData.hasCompletionJump && threadData.hasTalkLink,
  ""
);
push("board-thread: メッセージ入力あり", threadData.hasCompose, "");

await listPage.close();
});

const failed = results.filter((r) => !r.ok);
console.log(JSON.stringify(results, null, 2));
if (failed.length) {
  console.error(`FAILED ${failed.length}/${results.length}`);
  await closeAllBrowsers();
  process.exit(1);
}
console.log(`ALL PASSED ${results.length}/${results.length}`);
