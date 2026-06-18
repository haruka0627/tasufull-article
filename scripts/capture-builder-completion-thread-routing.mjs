#!/usr/bin/env node
/**
 * 完了報告スレッド振り分け — レビュー用スクショ PC1280 / SP390
 */
import { chromium } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { requireDevServer, logScreenshotUrl } from "./lib/dev-base-url.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "screenshots", "builder-completion-thread-routing");
const MVP_KEY = "tasful:builder:mvp:v1";
const PROJECT_ID = "demo-project-001";
const THREAD_ID = "thread-demo-001";
const PARTNER_ID = "demo-partner-001";
const CAL_PROJECT_ID = "builder_demo_001";

async function seedGeneralCompletion(page) {
  await page.evaluate(
    ({ mvpKey, projectId, threadId, partnerId }) => {
      localStorage.setItem(mvpKey, JSON.stringify({
        version: 1,
        owner_id: "demo-owner-001",
        partners: [{ partner_id: partnerId, display_name: "株式会社オレンジ建装" }],
        projects: [{
          project_id: projectId,
          owner_id: "demo-owner-001",
          title: "新宿区 共同住宅 外装改修",
          kind: "builder_board",
          board_type: "project",
          projectKind: "project",
          status: "open",
          required_partners: 1,
          selected_partner_ids: [partnerId],
          main_thread_id: threadId,
          created_at: new Date().toISOString(),
        }],
        specs: { [projectId]: { overview: "テスト案件" } },
        threads: {
          [threadId]: {
            thread_id: threadId,
            project_id: projectId,
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
              submitted_by: { id: partnerId, type: "partner", name: "株式会社オレンジ建装" },
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
        applications: [{
          application_id: "app-1",
          project_id: projectId,
          partner_id: partnerId,
          status: "selected",
          ts: new Date().toISOString(),
        }],
      }));
      localStorage.setItem("tasful:builder:mvp:role", "owner");
    },
    { mvpKey: MVP_KEY, projectId: PROJECT_ID, threadId: THREAD_ID, partnerId: PARTNER_ID }
  );
}

async function seedCalendarCompletion(page) {
  await page.evaluate(
    ({ mvpKey, projectId, partnerId }) => {
      const state = JSON.parse(localStorage.getItem(mvpKey) || "{}");
      const threadId = state.projects?.find((p) => p.project_id === projectId)?.main_thread_id;
      if (!threadId || !state.threads?.[threadId]) return;
      state.threads[threadId].status = "completion_pending";
      state.threads[threadId].completion_submission = {
        status: "submitted",
        comment: "店舗内装が完了しました。",
        attachments: [],
        photos: [],
        submitted_at: new Date().toISOString(),
        submitted_by: { id: partnerId, type: "partner", name: "株式会社オレンジ建装" },
      };
      localStorage.setItem(mvpKey, JSON.stringify(state));
      localStorage.setItem("tasful:builder:mvp:role", "owner");
    },
    { mvpKey: MVP_KEY, projectId: CAL_PROJECT_ID, partnerId: PARTNER_ID }
  );
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const BASE = await requireDevServer();
console.log(`[dev] BASE_URL=${BASE}`);
const browser = await chromium.launch({ headless: true });

for (const { file, width, height, kind } of [
  { file: "board-thread-completion-1280.png", width: 1280, height: 900, kind: "board" },
  { file: "board-thread-completion-390.png", width: 390, height: 844, kind: "board" },
  { file: "mvp-thread-completion-1280.png", width: 1280, height: 900, kind: "mvp" },
  { file: "mvp-thread-completion-390.png", width: 390, height: 844, kind: "mvp" },
]) {
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  if (kind === "board") {
    await page.goto(`${BASE}/builder/board-thread.html`, { waitUntil: "domcontentloaded" });
    await seedGeneralCompletion(page);
    await page.goto(
      `${BASE}/builder/board-thread.html?thread_id=${THREAD_ID}&role=owner&from=talk#completion`,
      { waitUntil: "domcontentloaded" }
    );
    await page.waitForSelector("[data-thread-completion-approve]", { timeout: 30000 });
    await page.waitForTimeout(600);
  } else {
    await page.goto(`${BASE}/builder/mvp-calendar.html?role=partner&projectId=${CAL_PROJECT_ID}`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const btn = document.querySelector("[data-mvp-cal-accept]");
      btn?.click();
    });
    await page.waitForTimeout(1200);
    await seedCalendarCompletion(page);
    const calThreadId = await page.evaluate((mvpKey) => {
      const state = JSON.parse(localStorage.getItem(mvpKey) || "{}");
      return state.projects?.find((p) => p.project_id === "builder_demo_001")?.main_thread_id;
    }, MVP_KEY);
    await page.goto(
      `${BASE}/builder/mvp-thread.html?thread_id=${calThreadId}&role=owner#completion`,
      { waitUntil: "domcontentloaded" }
    );
  }

  await page.waitForTimeout(900);
  await page.evaluate(() => {
    document.getElementById("completion")?.scrollIntoView({ block: "start" });
  });
  await page.waitForTimeout(400);

  const out = path.join(OUT_DIR, file);
  const shotPath = await page.evaluate(() => location.pathname + location.search + location.hash);
  logScreenshotUrl(file, shotPath);
  await page.screenshot({ path: out, fullPage: width >= 960 });
  const meta = await page.evaluate(() => ({
    path: location.pathname,
    hasCompletion: Boolean(document.querySelector("[data-thread-completion-card], .mvp-thread-completion__summary")),
    hasApprove: Boolean(document.querySelector("[data-thread-completion-approve]")),
    hasReject: Boolean(document.querySelector("[data-thread-completion-reject-open]")),
    hasCompletionPhotos: document.body.textContent.includes("完了写真"),
    emptySiteGroups: document.querySelectorAll(".builder-sitePhoto__group").length,
    reportsPanelVisible: !document.getElementById("files")?.hidden,
    photosPanelVisible: !document.getElementById("photos")?.hidden,
    msgBodyVisible: !document.querySelector(".mvp-slack-thread__body")?.hidden,
    msgComposeVisible: !document.querySelector(".mvp-slack-thread__compose")?.hidden,
    emptyPanels: document.querySelectorAll(
      ".builder-panel:not([hidden]):empty, .builder-panel:not([hidden]) > :empty"
    ).length,
    hasRedirect: Boolean(document.querySelector("[data-thread-completion-redirect]")),
    title: document.querySelector("[data-builder-mvp-thread-project-title]")?.textContent?.trim(),
  }));
  console.log(file, meta, errors.length ? `errors:${errors.length}` : "no-console-errors");
  await page.close();
}

await browser.close();
console.log(`Screenshots saved to ${OUT_DIR}`);
