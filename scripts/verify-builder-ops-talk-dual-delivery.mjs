#!/usr/bin/env node
/**
 * Builder運営⇔パートナー通知 — 通知タブ + TASFUL TALK 同時配信検証
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { mkdirSync } from "fs";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const VIEWPORT = { width: 390, height: 844 };
const OUT_DIR = "screenshots/builder-ops-talk-dual-delivery";

const ROUTE_CASES = [
  {
    id: "builder-ops-route-001",
    title: "新しい案件が追加されました",
    actionLabel: "確認する",
    role: "partner",
    expectPath: "/builder/partner-assignment.html",
    expectQuery: { role: "partner", projectId: "builder_demo_001" },
  },
  {
    id: "builder-ops-route-002",
    title: "案件を受諾しました",
    actionLabel: "確認する",
    role: "owner",
    expectPath: "/builder/mvp-thread.html",
    expectQuery: { thread_id: "builder_thread_demo_001", role: "owner" },
  },
  {
    id: "builder-ops-route-003",
    title: "新しいメッセージがあります",
    actionLabel: "確認する",
    role: "partner",
    expectPath: "/builder/mvp-thread.html",
    expectQuery: { thread_id: "builder_thread_demo_001", role: "partner" },
  },
  {
    id: "builder-ops-route-004",
    title: "新しいメッセージがあります",
    actionLabel: "確認する",
    role: "owner",
    expectPath: "/builder/mvp-thread.html",
    expectQuery: { thread_id: "builder_thread_demo_001", role: "owner" },
  },
  {
    id: "builder-ops-route-005",
    title: "完了報告が提出されました",
    actionLabel: "確認する",
    role: "owner",
    expectPath: "/builder/mvp-thread.html",
    expectQuery: { thread_id: "builder_thread_demo_001", role: "owner" },
    expectHash: "completion",
  },
  {
    id: "builder-ops-route-006",
    title: "完了報告が承認されました",
    actionLabel: "確認する",
    role: "partner",
    expectPath: "/builder/mvp-thread.html",
    expectQuery: { thread_id: "builder_thread_demo_001", role: "partner" },
  },
];

const FLOW_TALK_CASES = [
  { id: "builder-ops-flow-003", title: "入場しました", actionLabel: "確認する" },
  { id: "builder-ops-flow-004", title: "退場しました", actionLabel: "確認する" },
];

const STORAGE_KEYS = [
  "tasful_talk_notifications",
  "tasful_builder_notify_master_v1",
  "tasful_talk_notifications_seeded_v2",
  "tasful_chat_messages",
  "tasful_official_room_last_seen_v1",
];

function matchUrl(actualUrl, c) {
  const u = new URL(actualUrl);
  const issues = [];
  const expectedPath = c.expectPath.startsWith("/") ? c.expectPath : `/${c.expectPath}`;
  if (u.pathname !== expectedPath) {
    issues.push(`path: ${u.pathname} (expected ${expectedPath})`);
  }
  for (const [key, val] of Object.entries(c.expectQuery || {})) {
    if (u.searchParams.get(key) !== val) {
      issues.push(`${key}=${u.searchParams.get(key) || "(なし)"} (expected ${val})`);
    }
  }
  if (c.expectHash) {
    const hash = u.hash.replace(/^#/, "");
    if (hash !== c.expectHash) issues.push(`hash=${hash || "(なし)"} (expected ${c.expectHash})`);
  }
  return issues;
}

mkdirSync(OUT_DIR, { recursive: true });
let results = [];
await withPlaywrightBrowser(async (browser) => {
async function resetStorage(page) {
  await page.goto(`${BASE}/talk-home.html`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.evaluate((keys) => keys.forEach((k) => localStorage.removeItem(k)), STORAGE_KEYS);
}

// --- 1. 通知タブ一覧 + Builder運営フィルター ---
const notifyPage = await browser.newPage({ viewport: VIEWPORT });
await resetStorage(notifyPage);
await notifyPage.goto(`${BASE}/talk-home.html?tab=notify`, {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await notifyPage.waitForSelector('[data-talk-notify-id="builder-ops-route-001"]', { timeout: 20000 });
await notifyPage.waitForTimeout(800);
await notifyPage.screenshot({ path: `${OUT_DIR}/01-notify-tab-390.png`, fullPage: true });

for (const c of ROUTE_CASES) {
  const visible = await notifyPage.evaluate(
    (id) => Boolean(document.querySelector(`[data-talk-notify-id="${id}"]`)),
    c.id
  );
  results.push({
    surface: "notify-tab",
    id: c.id,
    title: c.title,
    status: visible ? "OK" : "NG",
    issues: visible ? [] : ["通知タブに未表示"],
  });
}

await notifyPage.evaluate(() => {
  document.querySelector('[data-talk-notify-mobile-chip="project"]')?.click();
});
await notifyPage.waitForTimeout(800);
const filterInfo = await notifyPage.evaluate(() => {
  const cards = [...document.querySelectorAll("[data-talk-notify-id]")];
  const scopes = cards.map(
    (c) => c.querySelector(".talk-notify-card__scope-chip")?.textContent?.trim() || "(なし)"
  );
  return { count: cards.length, scopes: [...new Set(scopes)] };
});
await notifyPage.screenshot({ path: `${OUT_DIR}/02-builder-admin-ops-filter-390.png`, fullPage: true });
const filterOk =
  filterInfo.count > 0 &&
  filterInfo.scopes.some((s) => s === "Builder運営" || s === "Builder一般" || s === "(なし)");
results.push({
  surface: "notify-filter",
  id: "project",
  status: filterOk ? "OK" : "NG",
  issues: filterOk ? [] : [`scopes=${filterInfo.scopes.join(",")} count=${filterInfo.count}`],
});

// --- 2. TASFUL TALK official_builder ルーム ---
const talkPage = await browser.newPage({ viewport: VIEWPORT });
await resetStorage(talkPage);
await talkPage.goto(`${BASE}/talk-home.html?tab=chat&thread=official_builder`, {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await talkPage.waitForSelector(".chat-notify-card__title", { timeout: 20000 });
await talkPage.waitForTimeout(900);

const talkAudit = await talkPage.evaluate((routeIds) => {
  const msgs =
    window.TasuTalkOfficialRooms?.getRoomMessages?.("official_builder")?.filter(
      (m) => m.kind === "notify_card"
    ) || [];
  const cards = [...document.querySelectorAll(".chat-notify-card__title")].map((el) =>
    el.textContent?.trim()
  );
  const byId = {};
  for (const m of msgs) {
    const nid = String(m.notifyCard?.notificationId || "");
    if (nid) byId[nid] = m.notifyCard;
  }
  return { msgCount: msgs.length, cards, byId, routeIds };
}, ROUTE_CASES.map((c) => c.id));

await talkPage.screenshot({ path: `${OUT_DIR}/03-talk-official-builder-390.png`, fullPage: true });

const talkList = [...ROUTE_CASES, ...FLOW_TALK_CASES].map((c) => {
  const card = talkAudit.byId[c.id];
  const issues = [];
  if (!card) issues.push("TALKルームに未表示");
  else {
    if (card.title !== c.title) issues.push(`title=${card.title}`);
    if (card.actionLabel !== c.actionLabel) issues.push(`actionLabel=${card.actionLabel}`);
    if (card.body) issues.push(`body should be empty: ${card.body}`);
  }
  return {
    surface: "talk-room",
    id: c.id,
    title: c.title,
    status: issues.length === 0 ? "OK" : "NG",
    issues,
    href: card?.href || "",
  };
});
results.push(...talkList);

console.log(`TALK notify cards: ${talkAudit.msgCount}`);
console.log("TALK titles:", talkAudit.cards.join(" | "));

// --- 3. 通知タブボタン遷移（route 6件）---
for (const c of ROUTE_CASES) {
  const page = await browser.newPage({ viewport: VIEWPORT });
  const row = { surface: "notify-nav", id: c.id, title: c.title, status: "NG", issues: [] };
  try {
    await resetStorage(page);
    await page.goto(`${BASE}/talk-home.html?tab=notify`, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await page.waitForSelector(`[data-talk-notify-id="${c.id}"]`, { timeout: 20000 });

    const navPromise = page
      .waitForURL((url) => !url.pathname.endsWith("/talk-home.html"), { timeout: 15000 })
      .catch(() => null);

    await page.evaluate((id) => {
      const action = document
        .querySelector(`[data-talk-notify-id="${id}"]`)
        ?.querySelector("[data-talk-notify-action]");
      action?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    }, c.id);

    await navPromise;
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(900);

    row.navUrl = page.url();
    row.issues.push(...matchUrl(row.navUrl, c));
    await page.screenshot({ path: `${OUT_DIR}/04-notify-nav-${c.id}-390.png`, fullPage: true });
  } catch (err) {
    row.issues.push(String(err?.message || err));
  }
  row.status = row.issues.length === 0 ? "OK" : "NG";
  results.push(row);
  console.log(row.status, "notify-nav", c.id);
  await page.close();
}

// --- 4. TALKボタン遷移（route 6件）---
for (const c of ROUTE_CASES) {
  const page = await browser.newPage({ viewport: VIEWPORT });
  const row = { surface: "talk-nav", id: c.id, title: c.title, status: "NG", issues: [] };
  try {
    await resetStorage(page);
    await page.goto(`${BASE}/talk-home.html?tab=chat&thread=official_builder`, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await page.waitForSelector(".chat-notify-card__action", { timeout: 20000 });

    const expectedHref = talkAudit.byId[c.id]?.href || "";
    if (!expectedHref) {
      row.issues.push("TALKカード href 未検出");
    } else {
      const navPromise = page
        .waitForURL((url) => !url.pathname.endsWith("/talk-home.html"), { timeout: 15000 })
        .catch(() => null);

      const clicked = await page.evaluate((href) => {
        const sameTarget = (actual, expected) => {
          try {
            const a = new URL(actual, window.location.href);
            const e = new URL(expected, window.location.href);
            if (a.pathname !== e.pathname) return false;
            for (const [key, val] of e.searchParams.entries()) {
              if (a.searchParams.get(key) !== val) return false;
            }
            return a.hash.replace(/^#/, "") === e.hash.replace(/^#/, "");
          } catch {
            return false;
          }
        };
        const link = [...document.querySelectorAll(".chat-notify-card__action")].find((a) =>
          sameTarget(a.getAttribute("href") || a.href, href)
        );
        if (!link) return false;
        link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
        return true;
      }, expectedHref);
      if (!clicked) row.issues.push("TALKボタン未検出");

      await navPromise;
      if (clicked) {
        await navPromise;
        await page.waitForLoadState("domcontentloaded");
        await page.waitForTimeout(900);

        row.navUrl = page.url();
        row.issues.push(...matchUrl(row.navUrl, c));
        await page.screenshot({ path: `${OUT_DIR}/05-talk-nav-${c.id}-390.png`, fullPage: true });
      }
    }
  } catch (err) {
    row.issues.push(String(err?.message || err));
  }
  row.status = row.issues.length === 0 ? "OK" : "NG";
  results.push(row);
  console.log(row.status, "talk-nav", c.id);
  await page.close();
}

await notifyPage.close();
await talkPage.close();
});

const failed = results.filter((r) => r.status !== "OK");
console.log(`\n結果: ${results.length - failed.length}/${results.length} OK`);
if (failed.length) {
  for (const r of failed) {
    console.log(`- [${r.surface}] ${r.id}: ${r.issues.join("; ")}`);
  }
  await closeAllBrowsers();
  process.exit(1);
}
await closeAllBrowsers();
process.exit(0);
