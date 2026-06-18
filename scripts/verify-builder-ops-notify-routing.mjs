#!/usr/bin/env node
/**
 * Builder運営案件（私⇔パートナー）通知 — 390px 導線確認
 * - 一覧表示 / navigate ボタン遷移 / 既読
 * - talk-builder-notify-master-v1.js の builder-ops-flow-* シード準拠
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { mkdirSync } from "fs";
import {
  auditPartnerAssignmentPage,
  BUILDER_DEMO_ASSIGNMENT_PROJECT,
} from "./lib/audit-partner-assignment.mjs";
import { requireDevServer, logScreenshotUrl } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const VIEWPORT = { width: 390, height: 844 };
const NOTIFY_URL = `${BASE}/talk-home.html?tab=notify&talkDev=1&talkAdmin=1`;

/** runtime シード（adminOpsRows）の表示タイトル — BUILDER_OPS_FLOW_CASES.id と対応 */
const OPS_FLOW_CASES = [
  {
    id: "builder-ops-flow-001",
    title: "新しい案件が追加されました",
    role: "パートナー",
    assignmentProject: BUILDER_DEMO_ASSIGNMENT_PROJECT,
    screenshot: "assignment-notify-project-390.png",
  },
  { id: "builder-ops-flow-002", title: "案件を受諾しました", role: "運営" },
  { id: "builder-ops-flow-003", title: "入場しました", role: "運営" },
  { id: "builder-ops-flow-004", title: "退場しました", role: "運営" },
  { id: "builder-ops-flow-005", title: "完了報告が提出されました", role: "運営" },
  { id: "builder-ops-flow-006", title: "完了報告が承認されました", role: "パートナー" },
  { id: "builder-ops-flow-007", title: "差し戻し", role: "パートナー" },
];

const STORAGE_KEYS = [
  "tasful_talk_notifications",
  "tasful_platform_notify_master_v1",
  "tasful_builder_notify_master_v1",
  "tasful_anpi_notify_master_v1",
  "tasful_talk_notifications_seeded_v2",
  "tasful_chat_messages",
  "tasful_official_room_last_seen_v1",
];

function matchNotifyHref(actualUrl, href, options = {}) {
  const issues = [];
  if (!href) {
    issues.push("通知 href なし");
    return issues;
  }
  try {
    const actual = new URL(actualUrl);
    const expected = new URL(href.replace(/^\.\//, ""), actual.origin);
    if (actual.pathname !== expected.pathname) {
      issues.push(`path: ${actual.pathname} (expected ${expected.pathname})`);
    }
    expected.searchParams.forEach((val, key) => {
      if (actual.searchParams.get(key) !== val) {
        issues.push(`${key}=${actual.searchParams.get(key) || "(なし)"} (expected ${val})`);
      }
    });
    const expectedHash = expected.hash.replace(/^#/, "");
    const actualHash = actual.hash.replace(/^#/, "");
    if (expectedHash && actualHash !== expectedHash) {
      if (!(options.allowMissingHash && expectedHash === "completion")) {
        issues.push(`hash=${actualHash || "(なし)"} (expected ${expectedHash})`);
      }
    }
  } catch (err) {
    issues.push(String(err?.message || err));
  }
  return issues;
}

function displayUrl(url) {
  try {
    const u = new URL(url);
    return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return url;
  }
}

const OUT_DIR = "screenshots/builder-ops-notify-routing";
mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const results = [];

async function resetNotifyStorage(page) {
  await page.goto(`${BASE}/talk-home.html?talkDev=1`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.evaluate((keys) => {
    keys.forEach((k) => localStorage.removeItem(k));
  }, STORAGE_KEYS);
}

async function returnToNotifyList(page) {
  for (let i = 0; i < 2; i += 1) {
    try {
      await page.goto(NOTIFY_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForSelector("[data-talk-notify-list]", { timeout: 20000 });
      return;
    } catch {
      await page.waitForTimeout(700);
    }
  }
}

async function evaluateRetry(page, fn, arg, retries = 4) {
  let lastErr;
  for (let i = 0; i < retries; i += 1) {
    try {
      return arg === undefined ? await page.evaluate(fn) : await page.evaluate(fn, arg);
    } catch (err) {
      lastErr = err;
      const msg = String(err?.message || err);
      if (i < retries - 1 && /Execution context was destroyed|navigation|interrupted/i.test(msg)) {
        await page.waitForTimeout(500 + i * 300);
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

async function clickNotifyNavigate(page, id) {
  const card = page.locator(`article[data-talk-notify-id="${id}"]`);
  await card.waitFor({ state: "attached", timeout: 20000 });
  const navigateBtn = card.locator('[data-talk-notify-action="navigate"]').first();
  if (await navigateBtn.count()) {
    await navigateBtn.click({ force: true });
  } else {
    await card.click({ force: true });
  }
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(900);
}

for (const c of OPS_FLOW_CASES) {
  const page = await browser.newPage({ viewport: VIEWPORT });
  await resetNotifyStorage(page);

  const row = {
    title: c.title,
    role: c.role,
    visible: false,
    unreadBefore: false,
    readAfter: false,
    navUrl: "",
    status: "NG",
    issues: [],
  };

  try {
    await page.goto(NOTIFY_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector(`[data-talk-notify-id="${c.id}"]`, { timeout: 20000 });

    const before = await evaluateRetry(page, (id) => {
      const card = document.querySelector(`[data-talk-notify-id="${id}"]`);
      const n = window.TasuTalkData?.findNotificationById?.(id);
      return {
        visible: Boolean(card),
        title: card?.querySelector(".talk-notify-card__title")?.textContent?.trim() || "",
        masterTitle: String(n?.title || "").trim(),
        href: String(n?.href || n?.targetUrl || "").trim(),
        unread: card?.classList.contains("talk-notify-card--unread") || false,
        readAt: n?.readAt || null,
      };
    }, c.id);

    row.visible = before.visible;
    row.unreadBefore = before.unread && !before.readAt;

    if (!row.visible) row.issues.push("一覧に未表示");
    const expectedTitle = before.masterTitle || c.title;
    if (before.title !== expectedTitle) row.issues.push(`タイトル不一致: ${before.title}`);
    if (!row.unreadBefore) row.issues.push("初期状態が未読ではない");

    await clickNotifyNavigate(page, c.id);

    row.navUrl = page.url();
    row.issues.push(
      ...matchNotifyHref(row.navUrl, before.href, {
        allowMissingHash: c.id === "builder-ops-flow-005",
      })
    );

    if (c.assignmentProject) {
      const calAudit = await auditPartnerAssignmentPage(page, c.assignmentProject);
      row.assignmentAudit = {
        urlProjectId: calAudit.urlProjectId,
        detailProjectTitle: calAudit.detailProjectTitle,
      };
      row.issues.push(...calAudit.issues);
      if (c.screenshot) {
        const shotPath = `${OUT_DIR}/${c.screenshot}`;
        await page.screenshot({ path: shotPath, fullPage: true });
        logScreenshotUrl(c.screenshot.replace(".png", ""), displayUrl(row.navUrl));
      }
    }

    await returnToNotifyList(page);
    await page.waitForSelector(`[data-talk-notify-id="${c.id}"]`, { timeout: 20000 });

    const after = await evaluateRetry(page, (id) => {
      const card = document.querySelector(`[data-talk-notify-id="${id}"]`);
      const n = window.TasuTalkData?.findNotificationById?.(id);
      return {
        unread: card?.classList.contains("talk-notify-card--unread") || false,
        readAt: n?.readAt || null,
      };
    }, c.id);
    row.readAfter = Boolean(after.readAt) && !after.unread;
    if (!row.readAfter) row.issues.push("既読が付かない");
  } catch (err) {
    row.issues.push(String(err?.message || err));
  }

  row.status = row.visible && row.unreadBefore && row.readAfter && row.issues.length === 0 ? "OK" : "NG";
  results.push(row);
  await page.close();
}

await browser.close();

console.log("\n## Builder運営案件 通知導線確認（390px / talkDev=1）\n");
console.log("| 通知名 | 対象 | 遷移先URL | 案件表示 | OK/NG |");
console.log("| --- | --- | --- | --- | --- |");
for (const r of results) {
  const url = r.navUrl ? displayUrl(r.navUrl) : "—";
  const cal = r.assignmentAudit?.detailProjectTitle || (r.assignmentAudit ? "未選択" : "—");
  console.log(`| ${r.title} | ${r.role} | ${url} | ${cal} | ${r.status} |`);
}

console.log("\n### 詳細（NGのみ）");
let failed = 0;
for (const r of results) {
  if (r.status !== "OK") {
    failed += 1;
    console.log(`- **${r.title}** (${r.role}): ${r.issues.join("; ")}`);
  }
}

if (failed) process.exit(1);
console.log("\nAll builder ops notify routing checks passed");
