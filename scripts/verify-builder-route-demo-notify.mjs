#!/usr/bin/env node
/**
 * Builder 通知導線テスト（6件）— 表示 / ボタン / 遷移
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { mkdirSync } from "fs";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const VIEWPORT = { width: 390, height: 844 };
const OUT_DIR = "screenshots/builder-route-demo-notify";

const CASES = [
  {
    id: "builder-ops-route-001",
    title: "新しい案件が追加されました",
    actionLabel: "確認する",
    expectPath: "/builder/partner-assignment.html",
    expectQuery: { role: "partner", projectId: "builder_demo_001" },
  },
  {
    id: "builder-ops-route-002",
    title: "案件を受諾しました",
    actionLabel: "確認する",
    expectPath: "/builder/mvp-thread.html",
    expectQuery: { thread_id: "builder_thread_demo_001", role: "owner" },
  },
  {
    id: "builder-ops-route-003",
    title: "新しいメッセージがあります",
    actionLabel: "確認する",
    expectPath: "/builder/mvp-thread.html",
    expectQuery: { thread_id: "builder_thread_demo_001", role: "partner" },
  },
  {
    id: "builder-ops-route-004",
    title: "新しいメッセージがあります",
    actionLabel: "確認する",
    expectPath: "/builder/mvp-thread.html",
    expectQuery: { thread_id: "builder_thread_demo_001", role: "owner" },
  },
  {
    id: "builder-ops-route-005",
    title: "完了報告が提出されました",
    actionLabel: "確認する",
    expectPath: "/builder/mvp-thread.html",
    expectQuery: { thread_id: "builder_thread_demo_001", role: "owner" },
    expectHash: "completion",
  },
  {
    id: "builder-ops-route-006",
    title: "完了報告が承認されました",
    actionLabel: "確認する",
    expectPath: "/builder/mvp-thread.html",
    expectQuery: { thread_id: "builder_thread_demo_001", role: "partner" },
  },
];

const STORAGE_KEYS = [
  "tasful_talk_notifications",
  "tasful_builder_notify_master_v1",
  "tasful_talk_notifications_seeded_v2",
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
const browser = await chromium.launch({ headless: true });
const results = [];

async function resetStorage(page) {
  await page.goto(`${BASE}/talk-home.html`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.evaluate((keys) => keys.forEach((k) => localStorage.removeItem(k)), STORAGE_KEYS);
}

const listPage = await browser.newPage({ viewport: VIEWPORT });
await resetStorage(listPage);
await listPage.goto(`${BASE}/talk-home.html?tab=notify`, { waitUntil: "domcontentloaded", timeout: 60000 });
await listPage.waitForSelector('[data-talk-notify-id="builder-ops-route-001"]', { timeout: 20000 });
await listPage.waitForTimeout(800);
await listPage.screenshot({ path: `${OUT_DIR}/01-notify-list-390.png`, fullPage: true });
console.log("Saved: 01-notify-list-390.png");

for (const c of CASES) {
  const page = await browser.newPage({ viewport: VIEWPORT });
  const row = { id: c.id, title: c.title, status: "NG", issues: [] };

  try {
    await resetStorage(page);
    await page.goto(`${BASE}/talk-home.html?tab=notify`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector(`[data-talk-notify-id="${c.id}"]`, { timeout: 20000 });

    const cardInfo = await page.evaluate((id) => {
      const card = document.querySelector(`[data-talk-notify-id="${id}"]`);
      const action = card?.querySelector("[data-talk-notify-action]");
      return {
        visible: Boolean(card),
        title: card?.querySelector(".talk-notify-card__title")?.textContent?.trim() || "",
        actionLabel: action?.textContent?.trim() || "",
        actionHref: action?.getAttribute("href") || "",
        hasAction: Boolean(action),
      };
    }, c.id);

    if (!cardInfo.visible) row.issues.push("一覧に未表示");
    if (cardInfo.title !== c.title) row.issues.push(`title=${cardInfo.title}`);
    if (!cardInfo.hasAction) row.issues.push("ボタン未表示");
    if (cardInfo.actionLabel !== c.actionLabel) {
      row.issues.push(`actionLabel=${cardInfo.actionLabel}`);
    }

    await page.evaluate((id) => {
      document.querySelector(`[data-talk-notify-id="${id}"]`)?.scrollIntoView({ block: "center" });
    }, c.id);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT_DIR}/02-${c.id}-button-390.png`, fullPage: false });

    const navPromise = page.waitForURL(
      (url) => !url.pathname.endsWith("/talk-home.html"),
      { timeout: 15000 }
    ).catch(() => null);

    await page.evaluate((id) => {
      const card = document.querySelector(`article[data-talk-notify-id="${id}"]`);
      const action = card?.querySelector("[data-talk-notify-action]");
      if (action) {
        action.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
        return;
      }
      card?.click();
    }, c.id);

    await navPromise;
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(900);

    row.navUrl = page.url();
    row.issues.push(...matchUrl(row.navUrl, c));
    await page.screenshot({ path: `${OUT_DIR}/03-${c.id}-destination-390.png`, fullPage: true });
    console.log(row.issues.length ? "NG" : "OK", c.id, c.title, row.navUrl);
  } catch (err) {
    row.issues.push(String(err?.message || err));
    console.log("NG", c.id, row.issues.join("; "));
  }

  row.status = row.issues.length === 0 ? "OK" : "NG";
  results.push(row);
  await page.close();
}

await listPage.close();
await browser.close();

const failed = results.filter((r) => r.status !== "OK");
console.log(`\n結果: ${results.length - failed.length}/${results.length} OK`);
if (failed.length) {
  for (const r of failed) console.log(`- ${r.id}: ${r.issues.join("; ")}`);
  process.exit(1);
}
process.exit(0);
