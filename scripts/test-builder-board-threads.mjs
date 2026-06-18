#!/usr/bin/env node
/**
 * 一般案件やり取り一覧（board-threads.html）の最小検証
 */
import { chromium } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:5173").replace(/\/$/, "");
const results = [];

function push(name, ok, detail = "") {
  results.push({ name, ok, detail });
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

await page.goto(`${BASE}/builder/board-threads.html?role=partner`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-builder-board-thread-list] .mvp-thread-card", { timeout: 20000 });

const listData = await page.evaluate(() => {
  const cards = [...document.querySelectorAll("[data-builder-board-thread-list] .mvp-thread-card:not(.mvp-thread-card--empty)")];
  return cards.map((c) => ({
    title: c.querySelector(".mvp-thread-card__title")?.textContent?.trim() || "",
    counterpart: c.querySelector(".mvp-thread-card__counterpart")?.textContent?.trim() || "",
    preview: c.querySelector(".mvp-thread-card__preview")?.textContent?.trim() || "",
    status: c.querySelector(".mvp-thread-card__status")?.textContent?.trim() || "",
    unread: c.querySelector(".mvp-thread-card__unread")?.textContent?.trim() || "",
    time: c.querySelector(".mvp-thread-card__time")?.textContent?.trim() || "",
    href: c.getAttribute("href") || "",
    threadId: c.getAttribute("data-thread-id") || "",
  }));
});

push(
  "builder_board スレッド表示",
  listData.length > 0,
  `${listData.length} 件`
);
push(
  "カード項目（案件名・相手・最終MSG・日時・未読・ステータス）",
  listData.length > 0 &&
    listData.every((c) => c.title && c.counterpart && c.preview && c.time && c.status && c.unread),
  listData[0] ? JSON.stringify(listData[0]) : ""
);

// tasful_managed スレッド非表示
await page.evaluate(() => {
  const KEY = "tasful:builder:mvp:v1";
  let state = {};
  try {
    state = JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    state = {};
  }
  const managedPid = "demo-managed-thread-001";
  if (!(state.projects || []).some((p) => p.project_id === managedPid)) {
    state.projects = [
      ...(state.projects || []),
      {
        project_id: managedPid,
        owner_id: state.owner_id || "owner-demo-001",
        title: "運営管理スレッド（非表示）",
        kind: "tasful_managed",
        status: "open",
        required_partners: 1,
        selected_partner_ids: [],
        main_thread_id: "thread-managed-only-001",
        created_at: new Date().toISOString(),
      },
    ];
    state.threads = {
      ...(state.threads || {}),
      "thread-managed-only-001": {
        thread_id: "thread-managed-only-001",
        project_id: managedPid,
        events: [{ type: "created", actor: { id: "owner", type: "owner", name: "運営" }, ts: new Date().toISOString(), text: "managed" }],
        messages: [{ msg_id: "m1", from: { id: "owner", type: "owner", name: "運営" }, ts: new Date().toISOString(), text: "現場管理メッセージ" }],
      },
    };
    localStorage.setItem(KEY, JSON.stringify(state));
  }
});

await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-builder-board-thread-list] .mvp-thread-card", { timeout: 20000 });

const afterInject = await page.evaluate(() => {
  const cards = [...document.querySelectorAll("[data-builder-board-thread-list] .mvp-thread-card")];
  const titles = cards.map((c) => c.querySelector(".mvp-thread-card__title")?.textContent?.trim() || "");
  return {
    showsManaged: titles.some((t) => t.includes("運営管理スレッド")),
    count: cards.filter((c) => !c.classList.contains("mvp-thread-card--empty")).length,
  };
});

push("tasful_managed スレッド非表示", !afterInject.showsManaged, `cards=${afterInject.count}`);

// 一覧 → 詳細チャット
const firstCard = page.locator("[data-builder-board-thread-list] .mvp-thread-card").first();
const href = await firstCard.getAttribute("href");
await firstCard.click();
await page.waitForURL(/board-thread\.html/, { timeout: 15000 });
push("一覧 → board-thread 遷移", page.url().includes("board-thread.html") && page.url().includes("thread_id="), page.url());

// from=talk 戻り導線
await page.goto(`${BASE}/builder/board-threads.html?from=talk&role=partner`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-builder-page-back]", { state: "attached", timeout: 10000 });
const back = await page.evaluate(() => {
  const el = document.querySelector("[data-builder-page-back]");
  return { href: el?.getAttribute("href") || "", text: el?.textContent?.trim() || "" };
});
push(
  "from=talk 戻り導線",
  back.href.includes("talk-home.html") && back.text.includes("TASFUL TALK"),
  `${back.text} → ${back.href}`
);

await page.close();
await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(JSON.stringify(results, null, 2));
if (failed.length) {
  console.error(`FAILED ${failed.length}/${results.length}`);
  process.exit(1);
}
console.log(`ALL PASSED ${results.length}/${results.length}`);
