/**
 * 一般案件 — 応募カード → 採用する → チャット自動作成 + 双方通知
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const PORTS = [5173, 5176, 5174, 5199, 5200, 5188];

async function findBaseUrl() {
  for (const port of PORTS) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/builder/board-project-detail.html`, {
        method: "HEAD",
      });
      if (res.ok) return `http://127.0.0.1:${port}`;
    } catch {
      /* next */
    }
  }
  throw new Error("No dev server found");
}

const base = await findBaseUrl();
console.log("Base URL:", base);

await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const MVP_KEY = "tasful:builder:mvp:v1";

await page.addInitScript((mvpKey) => {
  localStorage.removeItem(mvpKey);
  localStorage.removeItem("tasful_talk_notifications");
  localStorage.removeItem("tasful_builder_notify_master_v1");
  localStorage.setItem("tasful:builder:mvp:role", "owner");
}, MVP_KEY);

await page.goto(`${base}/builder/board-project-detail.html?id=demo-project-001&view=applications`, {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await page.waitForSelector("[data-builder-mvp-pd-app-list] .mvp-pd-appItem", { timeout: 20000 });
await page.waitForTimeout(800);

const beforeHire = await page.evaluate((mvpKey) => {
  const state = JSON.parse(localStorage.getItem(mvpKey) || "{}");
  const thread = state.threads?.["thread-demo-001"];
  return {
    msgCount: thread?.messages?.length || 0,
    hireBtn: document.querySelector("[data-builder-board-pd-select]")?.textContent?.trim(),
    rejectBtn: document.querySelector("[data-builder-board-pd-reject]")?.textContent?.trim(),
    view: new URL(window.location.href).searchParams.get("view"),
  };
}, MVP_KEY);

console.log("Before hire:", beforeHire);

await page.locator("[data-builder-board-pd-select]").first().click();
await page.waitForTimeout(1200);

const afterHire = await page.evaluate((mvpKey) => {
  const state = JSON.parse(localStorage.getItem(mvpKey) || "{}");
  const project = (state.projects || []).find((p) => p.project_id === "demo-project-001");
  const threadId = project?.main_thread_id;
  const thread = threadId ? state.threads?.[threadId] : null;
  let notifs = [];
  try {
    const raw = localStorage.getItem("tasful_talk_notifications");
    notifs = raw ? JSON.parse(raw) : [];
  } catch {
    notifs = [];
  }
  const hireNotifs = notifs.filter((n) => /採用/.test(String(n.title || "")));
  const matchNotifs = notifs.filter((n) => /マッチング/.test(String(n.title || "")));
  const app = (state.applications || []).find(
    (a) => a.project_id === "demo-project-001" && a.partner_id === "demo-partner-001"
  );
  return {
    threadId,
    selectedIds: project?.selected_partner_ids || [],
    appStatus: app?.status || "",
    msgCount: thread?.messages?.length || 0,
    hasSelectedEvent: (thread?.events || []).some((e) => e.type === "selected"),
    hireNotifTitles: hireNotifs.map((n) => n.title),
    matchCount: matchNotifs.length,
    chatBtn: document.querySelector("[data-builder-board-pd-thread]")?.textContent?.trim(),
    chatHref: document.querySelector("[data-builder-board-pd-thread]")?.getAttribute("href"),
  };
}, MVP_KEY);

console.log("After hire:", JSON.stringify(afterHire, null, 2));

let failed = false;
if (beforeHire.hireBtn !== "採用する") failed = true;
if (beforeHire.rejectBtn !== "断る") failed = true;
if (!afterHire.hasSelectedEvent) failed = true;
if (afterHire.msgCount < 2) failed = true;
if (!afterHire.hireNotifTitles.some((t) => t === "採用されました")) failed = true;
if (!afterHire.hireNotifTitles.some((t) => t === "採用が完了しました")) failed = true;
if (afterHire.matchCount > 0) failed = true;
if (!afterHire.chatHref?.includes("board-thread.html")) failed = true;

});
await closeAllBrowsers();
process.exit(failed ? 1 : 0);
