#!/usr/bin/env node
/**
 * board-thread の localStorage 差分調査
 * - 実機相当（自然初期化 / seed なし）
 * - seedGeneralCompletion 後
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "screenshots", "builder-completion-thread-routing");
const FIXTURE_DIR = path.join(__dirname, "..", "fixtures");
const TARGET_PATH =
  "/builder/board-thread.html?thread_id=thread-demo-001&role=owner&from=talk#completion";
const MVP_KEY = "tasful:builder:mvp:v1";
const THREAD_ID = "thread-demo-001";

function pickThreadSnapshot(storage) {
  let mvp = null;
  try {
    mvp = JSON.parse(storage[MVP_KEY] || "null");
  } catch {
    mvp = null;
  }
  const thread = mvp?.threads?.[THREAD_ID] || null;
  const project = (mvp?.projects || []).find((p) => p.main_thread_id === THREAD_ID || p.project_id === thread?.project_id) || null;
  return {
    mvpKeyPresent: Boolean(storage[MVP_KEY]),
    threadsKeyPresent: Boolean(storage["tasful:builder:mvp:threads:v1"]),
    role: storage["tasful:builder:mvp:role"] || null,
    sessionRole: storage["tasful:builder:mvp:session:role"] || null,
    owner_id: mvp?.owner_id || null,
    project: project
      ? {
          project_id: project.project_id,
          title: project.title,
          selected_partner_ids: project.selected_partner_ids || [],
          board_type: project.board_type,
          projectKind: project.projectKind,
          status: project.status,
        }
      : null,
    thread: thread
      ? {
          thread_id: thread.thread_id,
          project_id: thread.project_id,
          status: thread.status,
          messageCount: (thread.messages || []).length,
          eventCount: (thread.events || []).length,
          messages: (thread.messages || []).map((m) => ({
            msg_id: m.msg_id,
            from: m.from?.name,
            text: String(m.text || "").slice(0, 80),
            ts: m.ts,
          })),
          events: (thread.events || []).map((e) => ({
            type: e.type,
            text: String(e.text || "").slice(0, 80),
            ts: e.ts,
          })),
          completion_submission: thread.completion_submission || null,
          siteDataPhotoCount: thread.siteData?.photos?.length || 0,
          demo_completion_review_seeded: Boolean(thread.demo_completion_review_seeded),
          demo_phase2_enriched: Boolean(thread.demo_phase2_enriched),
        }
      : null,
  };
}

function diffList(a, b) {
  const rows = [];
  const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  for (const k of [...keys].sort()) {
    const av = JSON.stringify(a?.[k]);
    const bv = JSON.stringify(b?.[k]);
    if (av !== bv) rows.push({ field: k, natural: a?.[k], seedGeneralCompletion: b?.[k] });
  }
  return rows;
}

async function readAllLocalStorage(page) {
  return page.evaluate(() => {
    const out = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      out[k] = localStorage.getItem(k);
    }
    return out;
  });
}

function seedGeneralCompletionPayload() {
  return {
    version: 1,
    owner_id: "demo-owner-001",
    partners: [{ partner_id: "demo-partner-001", display_name: "株式会社オレンジ建装" }],
    projects: [
      {
        project_id: "demo-project-001",
        owner_id: "demo-owner-001",
        title: "新宿区 共同住宅 外装改修",
        kind: "builder_board",
        board_type: "project",
        projectKind: "project",
        status: "open",
        required_partners: 1,
        selected_partner_ids: ["demo-partner-001"],
        main_thread_id: THREAD_ID,
        created_at: new Date().toISOString(),
      },
    ],
    specs: { "demo-project-001": { overview: "テスト案件" } },
    threads: {
      [THREAD_ID]: {
        thread_id: THREAD_ID,
        project_id: "demo-project-001",
        thread_kind: "board_match",
        status: "completion_pending",
        completion_submission: {
          status: "submitted",
          comment: "足場工事が完了しました。写真・請求書を添付します。",
          attachments: [{ name: "作業報告書.pdf", type: "pdf" }],
          photos: [
            { name: "完了写真_01.jpg", type: "image" },
            { name: "完了写真_02.jpg", type: "image" },
          ],
          invoice: { name: "請求書.pdf", type: "pdf" },
          submitted_at: new Date().toISOString(),
          submitted_by: { id: "demo-partner-001", type: "partner", name: "株式会社オレンジ建装" },
        },
        events: [
          {
            type: "completion_requested",
            ts: new Date().toISOString(),
            text: "完了報告を提出しました。",
          },
        ],
        messages: [],
      },
    },
    applications: [
      {
        application_id: "app-1",
        project_id: "demo-project-001",
        partner_id: "demo-partner-001",
        status: "selected",
        ts: new Date().toISOString(),
      },
    ],
  };
}

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(FIXTURE_DIR, { recursive: true });
const BASE = await requireDevServer();
console.log(`[dev] BASE_URL=${BASE}`);
await withPlaywrightBrowser(async (browser) => {// A) 自然状態: localStorage 空 → アプリが自分で初期化 + #completion シード
const ctxNatural = await browser.newContext({ viewport: { width: 390, height: 844 } });
const pageNatural = await ctxNatural.newPage();
await pageNatural.goto(`${BASE}${TARGET_PATH}`, { waitUntil: "load", timeout: 60000 });
await pageNatural.waitForTimeout(1500);
const storageNatural = await readAllLocalStorage(pageNatural);
const snapNatural = pickThreadSnapshot(storageNatural);

// B) seedGeneralCompletion 強制注入（旧スクショ取得スクリプトと同条件）
const ctxSeed = await browser.newContext({ viewport: { width: 390, height: 844 } });
const pageSeed = await ctxSeed.newPage();
await pageSeed.goto(`${BASE}/builder/board-thread.html`, { waitUntil: "domcontentloaded" });
await pageSeed.evaluate(
  ({ mvpKey, payload }) => {
    localStorage.setItem(mvpKey, JSON.stringify(payload));
    localStorage.setItem("tasful:builder:mvp:role", "owner");
  },
  { mvpKey: MVP_KEY, payload: seedGeneralCompletionPayload() }
);
await pageSeed.goto(`${BASE}${TARGET_PATH}`, { waitUntil: "load", timeout: 60000 });
await pageSeed.waitForTimeout(1500);
const storageSeed = await readAllLocalStorage(pageSeed);
const snapSeed = pickThreadSnapshot(storageSeed);

const threadDiff = diffList(snapNatural.thread, snapSeed.thread);
const projectDiff = diffList(snapNatural.project, snapSeed.project);

const report = {
  investigatedAt: new Date().toISOString(),
  targetUrl: `${BASE}${TARGET_PATH}`,
  localStorageKeysUsedByBoardThread: [
    "tasful:builder:mvp:v1 (primary — projects, threads, applications, specs)",
    "tasful:builder:mvp:threads:v1 (mirror of state.threads on save)",
    "tasful:builder:mvp:role",
    "tasful:builder:mvp:session:role (from URL role=owner)",
    "tasful:builder:mvp:partner_id (partner role only)",
  ],
  threadDemo001Sources: [
    "localStorage tasful:builder:mvp:v1 → state.threads[thread-demo-001]",
    "If empty: seedMvpStateIfEmpty() in builder.js (DEMO_PROJECTS / initial thread)",
    "On #completion + from=talk: ensureBoardThreadCompletionReviewSeed() may mutate thread",
    "NOT used on board-thread: ensureMvpThreadDetailDemoData() (mvp-thread only)",
  ],
  naturalSnapshot: snapNatural,
  seedGeneralCompletionSnapshot: snapSeed,
  threadFieldDiff: threadDiff,
  projectFieldDiff: projectDiff,
};

const reportPath = path.join(OUT_DIR, "board-thread-localStorage-diff-report.json");
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

// 自然状態の localStorage を fixture として保存（実機エクスポート待ちのベースライン）
const naturalFixturePath = path.join(FIXTURE_DIR, "playwright-natural-localStorage.json");
fs.writeFileSync(naturalFixturePath, JSON.stringify(storageNatural, null, 2));

// C) 実機エクスポートがあればそれでスクショ
const realDeviceFixturePath = path.join(FIXTURE_DIR, "real-device-localStorage.json");
let realDeviceUsed = false;
if (fs.existsSync(realDeviceFixturePath)) {
  realDeviceUsed = true;
  const imported = JSON.parse(fs.readFileSync(realDeviceFixturePath, "utf8"));
  const ctxReal = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pageReal = await ctxReal.newPage();
  await pageReal.goto(`${BASE}/builder/board-thread.html`, { waitUntil: "domcontentloaded" });
  await pageReal.evaluate((storage) => {
    localStorage.clear();
    for (const [k, v] of Object.entries(storage)) {
      localStorage.setItem(k, v);
    }
  }, imported);
  await pageReal.goto(`${BASE}${TARGET_PATH}`, { waitUntil: "load", timeout: 60000 });
  await pageReal.waitForTimeout(1500);
  await pageReal.evaluate(() => {
    const box = document.createElement("div");
    box.id = "playwright-capture-evidence";
    const params = new URLSearchParams(location.search);
    box.style.cssText =
      "position:fixed;top:0;left:0;right:0;z-index:99999;padding:10px;background:#111827;color:#fff;font:11px monospace;white-space:pre-wrap;border-bottom:3px solid #22c55e";
    box.textContent = [
      "[REAL DEVICE localStorage import]",
      `href=${location.href}`,
      `hash=${location.hash}`,
      `thread_id=${params.get("thread_id")}`,
      `role=${params.get("role")}`,
      `from=${params.get("from")}`,
      `dataSource=fixtures/real-device-localStorage.json`,
    ].join("\n");
    document.body.prepend(box);
  });
  const realOut = path.join(OUT_DIR, "board-thread-completion-390-real-device.png");
  await pageReal.screenshot({ path: realOut, fullPage: true });
  const realSnap = pickThreadSnapshot(await readAllLocalStorage(pageReal));
  report.realDeviceSnapshot = realSnap;
  report.realDeviceScreenshot = realOut;
  await ctxReal.close();
}

// 自然状態スクショ（seedGeneralCompletion 不使用）
await pageNatural.evaluate(() => {
  const box = document.createElement("div");
  box.id = "playwright-capture-evidence";
  const params = new URLSearchParams(location.search);
  box.style.cssText =
    "position:fixed;top:0;left:0;right:0;z-index:99999;padding:10px;background:#111827;color:#fff;font:11px monospace;white-space:pre-wrap;border-bottom:3px solid #3b82f6";
  box.textContent = [
    "[NATURAL localStorage — no seedGeneralCompletion]",
    `href=${location.href}`,
    `hash=${location.hash}`,
    `thread_id=${params.get("thread_id")}`,
    `role=${params.get("role")}`,
    `from=${params.get("from")}`,
    `dataSource=app seedMvpStateIfEmpty + ensureBoardThreadCompletionReviewSeed`,
  ].join("\n");
  document.body.prepend(box);
});
const naturalOut = path.join(OUT_DIR, "board-thread-completion-390-natural-localStorage.png");
await pageNatural.screenshot({ path: naturalOut, fullPage: true });
report.naturalScreenshot = naturalOut;
report.realDeviceFixturePresent = realDeviceUsed;

console.log(JSON.stringify(report, null, 2));
console.log("\nWrote:", reportPath);
console.log("Natural screenshot:", naturalOut);
if (!realDeviceUsed) {
  console.log("\nNOTE: fixtures/real-device-localStorage.json が無いため実機データ import スクショは未作成");
  console.log("実機で DevTools Console からエクスポートして同ファイルに保存してください。");
}

await ctxNatural.close();
await ctxSeed.close();
});

await closeAllBrowsers();
