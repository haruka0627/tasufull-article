#!/usr/bin/env node
/**
 * Builder通知 — 運営/一般の判別ラベル + 案件名（390px）
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { mkdirSync } from "fs";
import { requireDevServer, logScreenshotUrl } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const VIEWPORT = { width: 390, height: 844 };
const OUT_DIR = "screenshots/builder-notify-scope-labels";

const STORAGE_KEYS = [
  "tasful_talk_notifications",
  "tasful_platform_notify_master_v1",
  "tasful_builder_notify_master_v1",
  "tasful_anpi_notify_master_v1",
  "tasful_talk_notifications_seeded_v2",
];

const CASES = [
  {
    id: "builder-board-apply-001",
    scope: "Builder一般",
    project: "東京都 外壁塗装案件",
    title: "応募がありました",
    talkAdmin: false,
  },
  {
    id: "builder-board-thread-001",
    scope: "Builder一般",
    project: "新宿区 共同住宅 外装改修",
    title: "新しいメッセージが届きました",
    talkAdmin: false,
  },
  {
    id: "builder-ops-verify-completion-submit-001",
    scope: "Builder運営",
    project: "新宿区 共同住宅 外装改修",
    title: "完了報告が提出されました",
    talkAdmin: true,
  },
  {
    id: "builder-ops-verify-new-project-001",
    scope: "Builder運営",
    project: "新宿区 共同住宅 外装改修",
    title: "新着案件が入りました",
    talkAdmin: true,
  },
];

async function resetStorage(page) {
  await page.goto(`${BASE}/talk-home.html`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.evaluate((keys) => keys.forEach((k) => localStorage.removeItem(k)), STORAGE_KEYS);
}

mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: VIEWPORT });
await resetStorage(page);

await page.goto(`${BASE}/talk-home.html?tab=notify&talkAdmin=1`, {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await page.waitForSelector('[data-talk-notify-id="builder-board-apply-001"]', { timeout: 25000 });
await page.waitForTimeout(600);

const results = await page.evaluate((cases) => {
  return cases.map((c) => {
    const card = document.querySelector(`article[data-talk-notify-id="${c.id}"]`);
    const scope = card?.querySelector(".talk-notify-card__scope-chip, .talk-notify-card__category-chip")?.textContent?.trim() || "";
    const project = card?.querySelector(".talk-notify-card__project")?.textContent?.trim() || "";
    const title = card?.querySelector(".talk-notify-card__title")?.textContent?.trim() || "";
    const visible = Boolean(card);
    const issues = [];
    if (!visible) issues.push("カード未表示");
    if (scope !== c.scope) issues.push(`ラベル: ${scope || "(なし)"}`);
    if (project !== c.project) issues.push(`案件名: ${project || "(なし)"}`);
    if (title !== c.title) issues.push(`タイトル: ${title || "(なし)"}`);
    return {
      id: c.id,
      scope: c.scope,
      project: c.project,
      actualScope: scope,
      actualProject: project,
      status: visible && scope === c.scope && project === c.project && title === c.title ? "OK" : "NG",
      issues,
    };
  });
}, CASES);

const overflow = await page.evaluate(() => ({
  doc: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  body: document.body.scrollWidth > document.body.clientWidth,
}));

await page.screenshot({ path: `${OUT_DIR}/notify-builder-scope-390.png`, fullPage: true });
logScreenshotUrl("notify-builder-scope-390", "/talk-home.html?tab=notify&talkAdmin=1");

await browser.close();

console.log("\n## Builder通知 分類ラベル確認（390px）\n");
console.log("| 通知 | ラベル | 案件名 | OK/NG |");
console.log("| --- | --- | --- | --- |");
for (const r of results) {
  console.log(`| ${r.id} | ${r.actualScope || "—"} | ${r.actualProject || "—"} | ${r.status} |`);
}
console.log(`\n横スクロール: ${overflow.doc || overflow.body ? "NG" : "OK"}`);

const failed = results.filter((r) => r.status !== "OK");
if (failed.length || overflow.doc || overflow.body) {
  console.log("\n### 詳細（NG）\n");
  for (const r of failed) {
    console.log(`- ${r.id}: ${r.issues.join("; ")}`);
  }
  process.exit(1);
}

console.log("\n全件 OK");
process.exit(0);
