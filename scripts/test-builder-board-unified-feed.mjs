/**
 * Builder 掲示板 — 案件 / ワーカー 共通一覧・詳細
 */
import { chromium } from "./lib/playwright-browser.mjs";

const PORTS = [5173, 5176, 5174, 5199, 5200, 5188];
const MVP_KEY = "tasful:builder:mvp:v1";

async function findBaseUrl() {
  for (const port of PORTS) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/builder/board-projects.html`, {
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

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

await page.addInitScript((mvpKey) => {
  localStorage.removeItem(mvpKey);
  localStorage.setItem("tasful:builder:mvp:role", "owner");
}, MVP_KEY);

await page.goto(`${base}/builder/board-projects.html`, {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await page.waitForSelector("[data-builder-board-project-list] .mvp-card", {
  timeout: 30000,
});
await page.waitForTimeout(1000);

const listAudit = await page.evaluate(() => {
  const cards = [...document.querySelectorAll("[data-builder-board-project-list] .mvp-card")];
  const labels = cards.map((c) => c.querySelector(".mvp-pill--kind")?.textContent?.trim()).filter(Boolean);
  const types = cards.map((c) => c.getAttribute("data-board-type")).filter(Boolean);
  const tabs = [...document.querySelectorAll("[data-board-type-filter]")].map((b) => b.textContent?.trim());
  return { count: cards.length, labels, types, tabs };
});

console.log("List:", listAudit);

/* 案件詳細（旧 job タイプ） — 選定する */
await page.goto(`${base}/builder/board-project-detail.html?id=job_demo_full_001&type=job&view=applications`, {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await page.waitForSelector("[data-builder-mvp-pd-app-list] .mvp-pd-appItem", { timeout: 20000 });
await page.waitForTimeout(600);

const jobBefore = await page.evaluate(() => ({
  hireBtn: document.querySelector("[data-builder-board-pd-select]")?.textContent?.trim(),
  rejectBtn: document.querySelector("[data-builder-board-pd-reject]")?.textContent?.trim(),
  kind: document.querySelector("[data-builder-mvp-pd-badges] .mvp-pill--kind")?.textContent?.trim(),
  talkLink: document.querySelector("[data-builder-board-pd-talk]")?.getAttribute("href"),
}));

await page.locator("[data-builder-board-pd-select]").first().click();
await page.waitForTimeout(1000);

const jobAfter = await page.evaluate((mvpKey) => {
  const state = JSON.parse(localStorage.getItem(mvpKey) || "{}");
  const project = (state.projects || []).find((p) => p.project_id === "job_demo_full_001");
  const threadId =
    project?.main_thread_id ||
    Object.values(state.threads || {}).find((t) => t.project_id === "job_demo_full_001")?.thread_id;
  return {
    threadId,
    chatHref: document.querySelector("[data-builder-board-pd-thread]")?.getAttribute("href"),
  };
}, MVP_KEY);

/* ワーカー詳細 — 依頼を受ける */
await page.goto(`${base}/builder/board-project-detail.html?id=demo-worker-001&type=worker&view=applications`, {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await page.waitForSelector("[data-builder-mvp-pd-app-list] .mvp-pd-appItem", { timeout: 20000 });
await page.waitForTimeout(600);

const workerBefore = await page.evaluate(() => ({
  hireBtn: document.querySelector("[data-builder-board-pd-select]")?.textContent?.trim(),
  appsTitle: document.querySelector("[data-builder-board-pd-apps-title]")?.textContent?.trim(),
  kind: document.querySelector("[data-builder-mvp-pd-badges] .mvp-pill--kind")?.textContent?.trim(),
}));

await page.locator("[data-builder-board-pd-select]").first().click();
await page.waitForTimeout(1000);

const workerAfter = await page.evaluate((mvpKey) => {
  const state = JSON.parse(localStorage.getItem(mvpKey) || "{}");
  const project = (state.projects || []).find((p) => p.project_id === "demo-worker-001");
  const thread =
    Object.values(state.threads || {}).find((t) => t.project_id === "demo-worker-001") || null;
  const threadId = project?.main_thread_id || thread?.thread_id;
  return { threadId: threadId || null, threadKind: thread?.thread_kind || "" };
}, MVP_KEY);

console.log("Job:", jobBefore, jobAfter);
console.log("Worker:", workerBefore, workerAfter);

const failures = [];
if (listAudit.count < 3) failures.push(`一覧件数不足: ${listAudit.count}`);
if (!listAudit.labels.includes("案件") && !listAudit.labels.some((l) => /募集/.test(l))) {
  failures.push("案件カードなし");
}
if (!listAudit.labels.includes("ワーカー")) failures.push("ワーカーカードなし");
if (!listAudit.tabs.includes("すべて")) failures.push("タイプタブなし");
if (listAudit.tabs.includes("求人")) failures.push("求人タブが残っています");

if (jobBefore.kind === "求人") failures.push(`求人バッジが残存: ${jobBefore.kind}`);
if (!jobBefore.kind || jobBefore.kind === "ワーカー") failures.push(`案件バッジ: ${jobBefore.kind}`);
if (jobBefore.hireBtn !== "選定する") failures.push(`案件選定ボタン: ${jobBefore.hireBtn}`);
if (!jobAfter.threadId) failures.push("案件選定後スレッド未作成");
if (!jobAfter.chatHref?.includes("board-thread.html")) failures.push("案件チャットリンクなし");
if (!jobBefore.talkLink?.includes("talk-home.html")) failures.push("詳細にTALKリンクなし");

if (workerBefore.kind !== "ワーカー") failures.push(`ワーカーバッジ: ${workerBefore.kind}`);
if (workerBefore.hireBtn !== "依頼を受ける") failures.push(`ワーカー受諾ボタン: ${workerBefore.hireBtn}`);
if (workerBefore.appsTitle !== "依頼状況") failures.push(`ワーカーパネル: ${workerBefore.appsTitle}`);
if (!workerAfter.threadId) failures.push("ワーカー受諾後スレッド未作成");
if (workerAfter.threadKind !== "worker_request") failures.push(`worker_request 未設定: ${workerAfter.threadKind}`);

await browser.close();

if (failures.length) {
  console.error("FAILED:");
  failures.forEach((f) => console.error(" -", f));
  process.exit(1);
}

console.log("OK: builder unified board feed");
