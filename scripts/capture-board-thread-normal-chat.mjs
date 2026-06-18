#!/usr/bin/env node
/**
 * board-thread 通常チャット（#completion なし）— 390 / 1280 スクショ
 */
import { chromium } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { requireDevServer, logScreenshotUrl } from "./lib/dev-base-url.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "screenshots", "builder-completion-thread-routing");
const MVP_KEY = "tasful:builder:mvp:v1";
const TARGET = "/builder/board-thread.html?thread_id=thread-demo-001&role=owner";

function seedNormalOwnerChat() {
  return {
    version: 1,
    owner_id: "demo-owner-001",
    partners: [{ partner_id: "demo-partner-001", display_name: "株式会社オレンジ建装" }],
    projects: [{
      project_id: "demo-project-001",
      owner_id: "demo-owner-001",
      title: "新宿区 共同住宅 外装改修",
      kind: "builder_board",
      board_type: "project",
      projectKind: "project",
      status: "open",
      required_partners: 1,
      selected_partner_ids: ["demo-partner-001"],
      main_thread_id: "thread-demo-001",
      created_at: "2026-05-25T10:10:00+09:00",
    }],
    specs: { "demo-project-001": { overview: "外装改修" } },
    threads: {
      "thread-demo-001": {
        thread_id: "thread-demo-001",
        project_id: "demo-project-001",
        status: "in_progress",
        events: [
          { type: "created", ts: "2026-05-25T01:10:00.000Z", text: "案件を投稿しました（demo）" },
        ],
        messages: [
          {
            msg_id: "msg-demo-001",
            from: { id: "demo-owner-001", type: "owner", name: "TASFUL運営" },
            ts: "2026-05-25T01:12:00.000Z",
            text: "よろしくお願いします。条件確認はTalkで。",
          },
          {
            msg_id: "msg-demo-002",
            from: { id: "demo-partner-001", type: "partner", name: "株式会社オレンジ建装" },
            ts: "2026-05-26T04:15:00.000Z",
            text: "承知しました。14時に伺います。",
          },
        ],
        siteData: { photos: [], completed: false },
      },
    },
    applications: [{
      application_id: "app-demo-001",
      project_id: "demo-project-001",
      partner_id: "demo-partner-001",
      status: "selected",
      ts: "2026-05-28T02:00:00.000Z",
    }],
  };
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const BASE = await requireDevServer();
console.log(`[dev] BASE_URL=${BASE}`);
const browser = await chromium.launch({ headless: true });
let failed = false;

for (const { file, width, height, seed, label, expectMsgBody } of [
  {
    label: "with-messages",
    file: "board-thread-normal-chat-390.png",
    width: 390,
    height: 844,
    seed: seedNormalOwnerChat(),
    expectMsgBody: true,
  },
  {
    label: "empty-timeline",
    file: "board-thread-normal-chat-empty-390.png",
    width: 390,
    height: 844,
    seed: {
      ...seedNormalOwnerChat(),
      threads: {
        "thread-demo-001": {
          thread_id: "thread-demo-001",
          project_id: "demo-project-001",
          status: "in_progress",
          events: [],
          messages: [],
          siteData: { photos: [], completed: false },
        },
      },
    },
    expectMsgBody: false,
  },
  {
    label: "with-messages-pc",
    file: "board-thread-normal-chat-1280.png",
    width: 1280,
    height: 900,
    seed: seedNormalOwnerChat(),
    expectMsgBody: true,
  },
]) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto(`${BASE}/builder/board-thread.html`, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ mvpKey, state }) => {
      localStorage.setItem(mvpKey, JSON.stringify(state));
      localStorage.setItem("tasful:builder:mvp:role", "owner");
    },
    { mvpKey: MVP_KEY, state: seed }
  );
  await page.goto(`${BASE}${TARGET}`, { waitUntil: "load", timeout: 60000 });
  await page.waitForTimeout(1000);

  const meta = await page.evaluate(() => ({
    href: location.href,
    hash: location.hash,
    photosHidden: document.getElementById("photos")?.hidden,
    filesHidden: document.getElementById("files")?.hidden,
    completionHidden: document.getElementById("completion")?.hidden,
    siteGroups: document.querySelectorAll(".builder-sitePhoto__group").length,
    reportsVisible: Boolean(document.querySelector(".mvp-threadReports")),
    completionCard: Boolean(document.querySelector(".mvp-thread-completion__summary, [data-thread-completion-card]")),
    msgBodyVisible: !document.querySelector(".mvp-slack-thread__body")?.hidden,
    msgBodyHeight: Math.round(document.querySelector(".mvp-slack-thread__body")?.getBoundingClientRect().height || 0),
    composeVisible: !document.querySelector(".mvp-slack-thread__compose")?.hidden,
    msgCount: document.querySelectorAll(".mvp-slack-msg").length,
    emptyPanels: [...document.querySelectorAll(".builder-panel:not([hidden])")].filter((el) => {
      const h = el.getBoundingClientRect().height;
      const text = (el.textContent || "").replace(/\s+/g, "").trim();
      return h > 24 && !text;
    }).length,
  }));

  console.log(label, file, meta);
  if (
    !meta.photosHidden ||
    !meta.filesHidden ||
    !meta.completionHidden ||
    meta.siteGroups > 0 ||
    meta.reportsVisible ||
    meta.completionCard ||
    meta.msgBodyVisible !== expectMsgBody ||
    !meta.composeVisible ||
    meta.emptyPanels > 0
  ) {
    failed = true;
  }

  logScreenshotUrl(file, TARGET);
  await page.screenshot({ path: path.join(OUT_DIR, file), fullPage: true });
  await page.close();
}

await browser.close();
if (failed) {
  console.error("FAIL: normal chat still shows empty panels or hides chat");
  process.exit(1);
}
console.log("OK: board-thread normal chat empty panels hidden");
