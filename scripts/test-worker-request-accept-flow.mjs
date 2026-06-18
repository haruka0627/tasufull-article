/**
 * Builder ワーカー依頼 — 依頼カード → 受諾 / 断る → 受諾時のみ worker_request スレッド
 */
import { chromium } from "./lib/playwright-browser.mjs";

const PORTS = [5173, 5176, 5174, 5199, 5200, 5188];
const MVP_KEY = "tasful:builder:mvp:v1";
const WORKER_ID = "demo-worker-001";
const REQUESTER_ACCEPT = "demo-partner-003";
const REQUESTER_REJECT = "demo-partner-002";

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

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

async function setRole(role, partnerId) {
  await page.evaluate(
    ({ r, pid }) => {
      localStorage.setItem("tasful:builder:mvp:role", r);
      if (pid) localStorage.setItem("tasful:builder:mvp:partner_id", pid);
    },
    { r: role, pid: partnerId || null }
  );
}

await page.goto(`${base}/builder/board-projects.html`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.evaluate((mvpKey) => {
  localStorage.removeItem(mvpKey);
  localStorage.removeItem("tasful_talk_notifications");
  localStorage.removeItem("tasful_talk_notifications_seeded_v2");
}, MVP_KEY);
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);

async function requestAsPartner(partnerId) {
  await setRole("partner", partnerId);
  await page.goto(`${base}/builder/board-project-detail.html?id=${WORKER_ID}&type=worker`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForSelector("[data-builder-board-pd-apply]:not([hidden])", { timeout: 30000 });
  await page.locator("[data-builder-board-pd-apply]").first().click();
  await page.waitForTimeout(900);
}

/* --- 断り用依頼 --- */
await requestAsPartner(REQUESTER_REJECT);

await setRole("owner");
await page.goto(
  `${base}/builder/board-project-detail.html?id=${WORKER_ID}&type=worker&view=applications`,
  { waitUntil: "domcontentloaded", timeout: 60000 }
);
await page.waitForSelector("[data-builder-mvp-pd-app-list] .mvp-pd-appItem", { timeout: 30000 });
await page.waitForTimeout(600);

const beforeReject = await page.evaluate(() => ({
  rejectBtn: document.querySelector("[data-builder-board-pd-reject]")?.textContent?.trim(),
  acceptBtn: document.querySelector("[data-builder-board-pd-select]")?.textContent?.trim(),
}));

await page.locator(`[data-builder-board-pd-reject][data-partner-id="${REQUESTER_REJECT}"]`).click();
await page.waitForTimeout(1000);

const afterReject = await page.evaluate(({ mvpKey, workerId, partnerId }) => {
  const state = JSON.parse(localStorage.getItem(mvpKey) || "{}");
  const notifs = JSON.parse(localStorage.getItem("tasful_talk_notifications") || "[]");
  const app = (state.applications || []).find(
    (a) => a.project_id === workerId && a.partner_id === partnerId
  );
  return {
    status: app?.status || "",
    workerRequestThreads: Object.values(state.threads || {}).filter(
      (t) => t.project_id === workerId && t.thread_kind === "worker_request"
    ).length,
    rejectTitles: notifs.map((n) => n.title).filter((t) => t === "依頼が辞退されました"),
  };
}, { mvpKey: MVP_KEY, workerId: WORKER_ID, partnerId: REQUESTER_REJECT });

console.log("Reject flow:", beforeReject, afterReject);

/* --- 受諾用依頼 --- */
await requestAsPartner(REQUESTER_ACCEPT);

const afterRequest = await page.evaluate(({ mvpKey, workerId, partnerId }) => {
  const state = JSON.parse(localStorage.getItem(mvpKey) || "{}");
  const mine = (state.applications || []).find(
    (a) => a.project_id === workerId && a.partner_id === partnerId
  );
  return {
    requested: Boolean(mine),
    status: mine?.status || "",
    workerRequestThreads: Object.values(state.threads || {}).filter(
      (t) => t.project_id === workerId && t.thread_kind === "worker_request"
    ).length,
  };
}, { mvpKey: MVP_KEY, workerId: WORKER_ID, partnerId: REQUESTER_ACCEPT });

console.log("After request (accept path):", afterRequest);

await setRole("owner");
await page.goto(
  `${base}/builder/board-project-detail.html?id=${WORKER_ID}&type=worker&view=applications`,
  { waitUntil: "domcontentloaded", timeout: 60000 }
);
await page.waitForSelector("[data-builder-mvp-pd-app-list] .mvp-pd-appItem", { timeout: 30000 });
await page.waitForTimeout(600);

const beforeAccept = await page.evaluate((partnerId) => {
  const cards = [...document.querySelectorAll("[data-builder-mvp-pd-app-list] .mvp-pd-appItem")].filter(
    (c) => !c.classList.contains("mvp-pd-appItem--empty")
  );
  const target = document.querySelector(`[data-builder-board-pd-select][data-partner-id="${partnerId}"]`);
  return {
    cardCount: cards.length,
    acceptBtn: target?.textContent?.trim(),
    rejectBtn: document.querySelector(`[data-builder-board-pd-reject][data-partner-id="${partnerId}"]`)?.textContent?.trim(),
    panelTitle: document.querySelector("[data-builder-board-pd-apps-title]")?.textContent?.trim(),
  };
}, REQUESTER_ACCEPT);

await page.locator(`[data-builder-board-pd-select][data-partner-id="${REQUESTER_ACCEPT}"]`).click();
await page.waitForTimeout(1200);

const afterAccept = await page.evaluate(({ mvpKey, workerId, partnerId }) => {
  const state = JSON.parse(localStorage.getItem(mvpKey) || "{}");
  const notifs = JSON.parse(localStorage.getItem("tasful_talk_notifications") || "[]");
  const app = (state.applications || []).find(
    (a) => a.project_id === workerId && a.partner_id === partnerId
  );
  const thread =
    Object.values(state.threads || {}).find(
      (t) => t.project_id === workerId && t.thread_kind === "worker_request"
    ) || null;
  return {
    appStatus: app?.status || "",
    threadId: state.projects?.find((p) => p.project_id === workerId)?.main_thread_id || thread?.thread_id,
    threadKind: thread?.thread_kind || "",
    msgCount: (thread?.messages || []).length,
    notifTitles: notifs.map((n) => n.title),
    chatHref: document.querySelector("[data-builder-board-pd-thread]")?.getAttribute("href"),
  };
}, { mvpKey: MVP_KEY, workerId: WORKER_ID, partnerId: REQUESTER_ACCEPT });

console.log("Accept flow:", beforeAccept, JSON.stringify(afterAccept, null, 2));

const failures = [];

if (afterRequest.workerRequestThreads > 0) failures.push("依頼時点で worker_request スレッドが作成された");
if (!afterRequest.requested) failures.push("依頼が記録されていない");

if (beforeReject.acceptBtn !== "依頼を受ける") failures.push(`受諾ボタン(断り前): ${beforeReject.acceptBtn}`);
if (beforeReject.rejectBtn !== "断る") failures.push(`断るボタン(断り前): ${beforeReject.rejectBtn}`);

if (afterReject.status !== "rejected") failures.push("断り後 rejected でない");
if (afterReject.workerRequestThreads > 0) failures.push("断り時に worker_request スレッドが作成された");
if (!afterReject.rejectTitles.length) failures.push("辞退通知が届いていない");

if (beforeAccept.cardCount < 1) failures.push("依頼カードが表示されない");
if (beforeAccept.panelTitle !== "依頼状況") failures.push(`パネルタイトル: ${beforeAccept.panelTitle}`);
if (beforeAccept.acceptBtn !== "依頼を受ける") failures.push(`受諾ボタン: ${beforeAccept.acceptBtn}`);

if (afterAccept.appStatus !== "selected") failures.push("受諾後ステータスが selected でない");
if (!afterAccept.threadId) failures.push("受諾後 thread_id がない");
if (afterAccept.threadKind !== "worker_request") failures.push(`thread_kind: ${afterAccept.threadKind}`);
if (afterAccept.msgCount < 2) failures.push("受諾チャットに初期メッセージが不足");
if (!afterAccept.notifTitles.includes("依頼を引き受けました")) failures.push("依頼者向け受諾通知がない");
if (!afterAccept.notifTitles.includes("依頼を受けました")) failures.push("投稿者向け受諾通知がない");
if (!afterAccept.chatHref?.includes("board-thread.html")) failures.push("チャットリンクが不正");

await browser.close();

if (failures.length) {
  console.error("FAILED:");
  failures.forEach((f) => console.error(" -", f));
  process.exit(1);
}

console.log("OK: worker request / accept / reject flow");
