/**
 * プラットフォーム ワーカー依頼 — 依頼カード → 受諾 / 断る → 受諾時のみ worker_request チャット
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const PORTS = [5173, 5176, 5174, 5199, 5200, 5188];
const WORKER_ID = "worker_hiro_001";
const WORKER_USER = "u_hiro";
const REQUESTER_ID = "u_request_flow_test";

const STORAGE = {
  requests: "tasful_worker_requests_v1",
  threads: "tasful_chat_threads",
  messages: "tasful_chat_messages",
  notifications: "tasful_talk_notifications",
};

async function findBaseUrl() {
  for (const port of PORTS) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/detail-worker.html`, {
        method: "HEAD",
      });
      if (res.ok) return `http://127.0.0.1:${port}`;
    } catch {
      /* next */
    }
  }
  throw new Error("No dev server found");
}

function countWorkerThreads(threads) {
  return (threads || []).filter(
    (t) => String(t.threadKind) === "worker_request" && String(t.listingId) === WORKER_ID
  ).length;
}

const base = await findBaseUrl();
console.log("Base URL:", base);

await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

await page.addInitScript((keys) => {
  // sessionStorage: 同一タブ内の goto 間で保持（globalThis は毎ナビでリセットされる）
  if (sessionStorage.getItem("__workerPlatformFlowCleared") === "1") return;
  sessionStorage.setItem("__workerPlatformFlowCleared", "1");
  Object.values(keys).forEach((k) => localStorage.removeItem(k));
  localStorage.removeItem("tasful_talk_notifications_seeded_v2");
}, STORAGE);

/* --- 1. 依頼時点でチャットを作らない --- */
await page.goto(
  `${base}/detail-worker.html?id=${WORKER_ID}&userId=${REQUESTER_ID}&talkDev=1`,
  { waitUntil: "domcontentloaded", timeout: 60000 }
);
await page.waitForSelector("[data-listing-primary-cta]", { timeout: 30000 });
await page.waitForFunction(() => document.body.dataset.listingLoaded === "true", {
  timeout: 30000,
});
await page.waitForTimeout(800);

await page.locator("[data-listing-primary-cta]").first().click();
await page.waitForTimeout(1000);

const afterRequest = await page.evaluate(({ keys, workerId, requesterId }) => {
  const reqs = JSON.parse(localStorage.getItem(keys.requests) || "[]");
  const threads = JSON.parse(localStorage.getItem(keys.threads) || "[]");
  const mine = reqs.find(
    (r) => String(r.worker_id) === workerId && String(r.requester_id) === requesterId
  );
  return {
    requested: Boolean(mine),
    status: mine?.status || "",
    threadId: mine?.thread_id || null,
    workerThreadCount: threads.filter(
      (t) => String(t.threadKind) === "worker_request" && String(t.listingId) === workerId
    ).length,
    ctaText: document.querySelector("[data-listing-primary-cta]")?.textContent?.trim(),
  };
}, { keys: STORAGE, workerId: WORKER_ID, requesterId: REQUESTER_ID });

console.log("After request:", afterRequest);

/* --- 2. ワーカー本人 — 依頼カード --- */
await page.goto(
  `${base}/detail-worker.html?id=${WORKER_ID}&userId=${WORKER_USER}&talkDev=1#requests`,
  { waitUntil: "domcontentloaded", timeout: 60000 }
);
await page.waitForSelector("[data-worker-requests-section]:not([hidden])", {
  timeout: 30000,
});
await page.waitForSelector("[data-worker-requests-list] .job-app-card", {
  timeout: 30000,
});
await page.waitForTimeout(800);

const beforeAccept = await page.evaluate(
  ({ keys, workerId, requesterId }) => {
    const reqs = JSON.parse(localStorage.getItem(keys.requests) || "[]");
    const flowRow = reqs.find(
      (r) =>
        String(r.worker_id) === workerId &&
        String(r.requester_id) === requesterId &&
        String(r.request_id || "").indexOf("demo") < 0
    );
    const cards = [...document.querySelectorAll("[data-worker-req-card]")];
    const target =
      cards.find((c) => c.getAttribute("data-request-id") === flowRow?.request_id) ||
      cards.find((c) => {
        const id = c.getAttribute("data-request-id") || "";
        return id && !id.includes("demo");
      });
    return {
      cardCount: cards.length,
      flowInStorage: Boolean(flowRow),
      flowRequestId: flowRow?.request_id || "",
      acceptBtn: target?.querySelector("[data-worker-req-accept]")?.textContent?.trim(),
      rejectBtn: target?.querySelector("[data-worker-req-reject]")?.textContent?.trim(),
      sectionVisible: !document.querySelector("[data-worker-requests-section]")?.hidden,
      targetId: target?.getAttribute("data-request-id") || "",
      isDemoTarget: (target?.getAttribute("data-request-id") || "").includes("demo"),
    };
  },
  { keys: STORAGE, workerId: WORKER_ID, requesterId: REQUESTER_ID }
);

console.log("Before accept (worker):", beforeAccept);

const threadsBefore = JSON.parse(
  (await page.evaluate((k) => localStorage.getItem(k), STORAGE.threads)) || "[]"
);
const threadCountBefore = countWorkerThreads(threadsBefore);

/* --- 3. 依頼を受ける --- */
const acceptLocator = page.locator(
  `[data-worker-req-card][data-request-id="${beforeAccept.targetId}"] [data-worker-req-accept]`
);
await acceptLocator.click();
await page.waitForTimeout(1200);

const afterAccept = await page.evaluate(({ keys, workerId, requestId }) => {
  const reqs = JSON.parse(localStorage.getItem(keys.requests) || "[]");
  const threads = JSON.parse(localStorage.getItem(keys.threads) || "[]");
  const notifs = JSON.parse(localStorage.getItem(keys.notifications) || "[]");
  const accepted = reqs.find(
    (r) => String(r.request_id) === String(requestId) && String(r.worker_id) === workerId
  );
  const wrThread = threads.find(
    (t) =>
      String(t.threadKind) === "worker_request" &&
      String(t.listingId) === workerId &&
      String(t.requestId) === String(requestId)
  );
  const msgs = JSON.parse(localStorage.getItem(keys.messages) || "{}");
  const msgCount = wrThread ? (msgs[wrThread.id] || []).length : 0;
  return {
    status: accepted?.status || "",
    threadId: accepted?.thread_id || wrThread?.id || null,
    workerThreadCount: threads.filter(
      (t) => String(t.threadKind) === "worker_request" && String(t.listingId) === workerId
    ).length,
    msgCount,
    notifTitles: notifs.map((n) => n.title),
    chatBtn: document
      .querySelector(`[data-worker-req-card][data-request-id="${requestId}"] .job-app-card__btn--chat`)
      ?.textContent?.trim(),
    chatHref: document
      .querySelector(`[data-worker-req-card][data-request-id="${requestId}"] .job-app-card__btn--chat`)
      ?.getAttribute("href"),
  };
}, { keys: STORAGE, workerId: WORKER_ID, requestId: beforeAccept.targetId });

console.log("After accept:", JSON.stringify(afterAccept, null, 2));

/* --- 4. 断る（別依頼者デモ） --- */
await page.locator("[data-worker-req-reject]").first().click();
await page.waitForTimeout(1200);

const afterReject = await page.evaluate(({ keys, workerId }) => {
  const reqs = JSON.parse(localStorage.getItem(keys.requests) || "[]");
  const threads = JSON.parse(localStorage.getItem(keys.threads) || "[]");
  const notifs = JSON.parse(localStorage.getItem(keys.notifications) || "[]");
  const rejected = reqs.filter(
    (r) => r.status === "rejected" && String(r.worker_id) === workerId
  );
  return {
    rejectedCount: rejected.length,
    workerThreadCount: threads.filter(
      (t) => String(t.threadKind) === "worker_request" && String(t.listingId) === workerId
    ).length,
    rejectNotifCount: notifs.filter((n) => n.title === "依頼が辞退されました").length,
  };
}, { keys: STORAGE, workerId: WORKER_ID });

console.log("After reject:", afterReject);

const failures = [];

if (!afterRequest.requested) failures.push("依頼が記録されていない");
if (afterRequest.workerThreadCount > 0) failures.push("依頼時点で worker_request チャットが作成された");
if (afterRequest.threadId) failures.push("依頼レコードに thread_id が付いている");

if (!beforeAccept.sectionVisible) failures.push("ワーカーに依頼セクションが表示されない");
if (!beforeAccept.flowInStorage) failures.push("ワーカー画面でフロー依頼が storage にない");
if (beforeAccept.isDemoTarget) failures.push("受諾対象がデモ依頼になっている（フロー依頼が消失）");
if (!beforeAccept.targetId || beforeAccept.targetId !== beforeAccept.flowRequestId) {
  failures.push("フロー依頼カードが UI に表示されていない");
}
if (beforeAccept.cardCount < 1) failures.push("依頼カードが表示されない");
if (beforeAccept.acceptBtn !== "依頼を受ける") failures.push(`受諾ボタン文言: ${beforeAccept.acceptBtn}`);
if (beforeAccept.rejectBtn !== "断る") failures.push(`断るボタン文言: ${beforeAccept.rejectBtn}`);

if (threadCountBefore > 0) failures.push("受諾前に既に worker_request チャットがある");

if (afterAccept.status !== "accepted") failures.push("受諾後ステータスが accepted でない");
if (!afterAccept.threadId) failures.push("受諾後 thread_id がない");
if (afterAccept.workerThreadCount < 1) failures.push("受諾後 worker_request チャットがない");
if (afterAccept.msgCount < 2) failures.push("受諾チャットに初期メッセージが不足");
if (!afterAccept.notifTitles.includes("依頼を引き受けました")) failures.push("依頼者向け受諾通知がない");
if (!afterAccept.notifTitles.includes("依頼を受けました")) failures.push("ワーカー向け受諾通知がない");
if (afterAccept.chatBtn !== "チャットを開く") failures.push("受諾カードにチャットボタンがない");
if (!afterAccept.chatHref?.includes("chat-detail.html")) failures.push("チャットリンクが不正");

if (afterReject.rejectedCount < 1) failures.push("断り後 rejected ステータスがない");
if (afterReject.workerThreadCount !== afterAccept.workerThreadCount) {
  failures.push("断り時に追加の worker_request チャットが作成された");
}
if (afterReject.rejectNotifCount < 1) failures.push("断り通知が届いていない");

});

if (failures.length) {
  console.error("FAILED:");
  failures.forEach((f) => console.error(" -", f));
  await closeAllBrowsers();
  process.exit(1);
}

console.log("OK: worker request platform flow");
