#!/usr/bin/env node
/**
 * 実機相当条件での board-thread DOM 監査（修正なし・調査のみ）
 * - URL: board-thread.html（#completion なし）
 * - 累積 localStorage 相当（completion_submission なし、採用済み、メッセージあり）
 */
import { chromium } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MVP_KEY = "tasful:builder:mvp:v1";

function seedRealisticDeviceState() {
  return {
    version: 1,
    owner_id: "demo-owner-001",
    partners: [
      { partner_id: "demo-partner-001", display_name: "株式会社オレンジ建装" },
      { partner_id: "demo-partner-002", display_name: "テスト建設" },
    ],
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
        main_thread_id: "thread-demo-001",
        created_at: "2026-05-25T10:10:00+09:00",
      },
    ],
    specs: { "demo-project-001": { overview: "外装改修" } },
    threads: {
      "thread-demo-001": {
        thread_id: "thread-demo-001",
        project_id: "demo-project-001",
        status: "in_progress",
        events: [
          { type: "created", ts: "2026-05-25T01:10:00.000Z", text: "案件を投稿しました（demo）" },
          { type: "selected", ts: "2026-05-28T02:00:00.000Z", text: "採用: 株式会社オレンジ建装" },
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
        // 実機で完了報告未提出の典型
      },
    },
    applications: [
      {
        application_id: "app-demo-001",
        project_id: "demo-project-001",
        partner_id: "demo-partner-001",
        status: "selected",
        ts: "2026-05-28T02:00:00.000Z",
      },
    ],
  };
}

async function auditUrl(page, label, urlPath) {
  await page.goto(urlPath, { waitUntil: "load", timeout: 60000 });
  await page.waitForTimeout(1200);

  return page.evaluate(() => {
    const rectPanels = [...document.querySelectorAll(".builder-panel, .builder-sitePhoto__group")].map((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        tag: el.tagName.toLowerCase(),
        id: el.id || null,
        className: el.className,
        dataAttrs: [...el.attributes]
          .filter((a) => a.name.startsWith("data-"))
          .map((a) => `${a.name}=${a.value}`),
        ariaLabel: el.getAttribute("aria-label"),
        hidden: el.hidden,
        display: cs.display,
        height: Math.round(r.height),
        width: Math.round(r.width),
        childTextPreview: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80),
        innerHTMLLength: el.innerHTML.trim().length,
      };
    });

    const siteGroups = [...document.querySelectorAll(".builder-sitePhoto__group")].map((el) => ({
      className: el.className,
      id: el.id || null,
      dataAttrs: [...el.attributes].filter((a) => a.name.startsWith("data-")).map((a) => `${a.name}=${a.value}`),
      text: (el.textContent || "").replace(/\s+/g, " ").trim(),
      parentChain: [
        el.parentElement?.className,
        el.parentElement?.parentElement?.id,
        el.closest("[data-builder-board-thread-photos-panel]")?.id,
      ],
    }));

    const compose = document.querySelector(".mvp-slack-thread__compose");
    const completionHost = document.querySelector("[data-builder-thread-completion-host]");
    const photosPanel = document.getElementById("photos");
    const filesPanel = document.getElementById("files");
    const completionPanel = document.getElementById("completion");

    const scriptSrc = [...document.querySelectorAll("script[src]")]
      .map((s) => s.getAttribute("src"))
      .find((s) => s && s.includes("builder.js"));

    return {
      href: location.href,
      hash: location.hash,
      search: location.search,
      dataPage: document.body?.dataset?.page,
      builderScriptSrc: scriptSrc || null,
      hasRenderBoardThreadCompletionPanel: typeof window.__audit !== "undefined",
      completionHostInnerLen: completionHost?.innerHTML?.trim().length || 0,
      completionHostPreview: completionHost?.innerHTML?.trim().slice(0, 120) || "",
      panels: {
        photos: { id: photosPanel?.id, hidden: photosPanel?.hidden, childLen: photosPanel?.innerHTML?.trim().length },
        files: { id: filesPanel?.id, hidden: filesPanel?.hidden, childLen: filesPanel?.innerHTML?.trim().length },
        completion: { id: completionPanel?.id, hidden: completionPanel?.hidden, childLen: completionPanel?.innerHTML?.trim().length },
      },
      sitePhotoGroupCount: siteGroups.length,
      siteGroups,
      compose: compose
        ? {
            tag: compose.tagName.toLowerCase(),
            className: compose.className,
            id: compose.id || null,
            hidden: compose.hidden,
            ariaLabel: compose.getAttribute("aria-label"),
            dataAttrs: [...compose.attributes].filter((a) => a.name.startsWith("data-")).map((a) => `${a.name}=${a.value}`),
            form: {
              className: document.querySelector("[data-builder-mvp-thread-form]")?.className,
              dataBuilderMvpThreadForm: Boolean(document.querySelector("[data-builder-mvp-thread-form]")),
            },
            textarea: {
              className: document.querySelector("[data-builder-mvp-thread-input]")?.className,
              placeholder: document.querySelector("[data-builder-mvp-thread-input]")?.getAttribute("placeholder"),
              dataBuilderMvpThreadInput: Boolean(document.querySelector("[data-builder-mvp-thread-input]")),
            },
          }
        : null,
      msgBody: {
        className: document.querySelector(".mvp-slack-thread__body")?.className,
        hidden: document.querySelector(".mvp-slack-thread__body")?.hidden,
      },
      visibleBuilderPanels: rectPanels.filter((p) => p.display !== "none" && !p.hidden && p.height > 20),
      reportsSection: {
        exists: Boolean(document.querySelector(".mvp-threadReports")),
        listWrap: Boolean(document.querySelector(".mvp-threadReports__listWrap")),
        empty: Boolean(document.querySelector(".mvp-threadReports__empty")),
        actions: Boolean(document.querySelector(".mvp-threadReports__actions")),
      },
    };
  });
}

const BASE = await requireDevServer();
console.log(`[dev] BASE_URL=${BASE}`);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

// 実機相当 localStorage
await page.goto(`${BASE}/builder/board-thread.html`, { waitUntil: "domcontentloaded" });
await page.evaluate(
  ({ mvpKey, state }) => {
    localStorage.setItem(mvpKey, JSON.stringify(state));
    localStorage.setItem("tasful:builder:mvp:role", "owner");
  },
  { mvpKey: MVP_KEY, state: seedRealisticDeviceState() }
);

const scenarios = [
  {
    label: "real-device-like-no-hash",
    path: `${BASE}/builder/board-thread.html?thread_id=thread-demo-001&role=owner`,
  },
  {
    label: "real-device-like-from-talk-no-hash",
    path: `${BASE}/builder/board-thread.html?thread_id=thread-demo-001&role=owner&from=talk`,
  },
  {
    label: "with-completion-hash",
    path: `${BASE}/builder/board-thread.html?thread_id=thread-demo-001&role=owner&from=talk#completion`,
  },
];

const builderJsText = await (await fetch(`${BASE}/builder/builder.js`)).text();
const codeMarkers = {
  renderBoardThreadCompletionPanel: builderJsText.includes("function renderBoardThreadCompletionPanel"),
  focusCompletionHide: builderJsText.includes("if (msgBody) msgBody.hidden = focusCompletion"),
  hideEmptyStages: builderJsText.includes("hideEmptyStages"),
  omitWhenEmpty: builderJsText.includes("omitWhenEmpty"),
  shouldFocusBoardThreadCompletion: builderJsText.includes("function shouldFocusBoardThreadCompletion"),
};

const report = { codeMarkers, scenarios: {} };
for (const s of scenarios) {
  report.scenarios[s.label] = await auditUrl(page, s.label, s.path);
}

const outPath = path.join(__dirname, "..", "screenshots", "builder-completion-thread-routing", "board-thread-real-device-dom-audit.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

console.log(JSON.stringify(report, null, 2));
console.log("\nWrote:", outPath);
await browser.close();
