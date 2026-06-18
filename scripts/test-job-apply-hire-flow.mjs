/**
 * 求人応募 — 応募カード → 採用 / 断る → 採用時のみチャット + 双方通知
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const PORTS = [5173, 5176, 5174, 5199, 5200, 5188];
const JOB_ID = "job_demo_full_001";
const POSTER_ID = "u_job_demo_full";
const APPLICANT_ID = "u_apply_flow_test";

const STORAGE = {
  applications: "tasful_job_applications_v1",
  threads: "tasful_chat_threads",
  messages: "tasful_chat_messages",
  notifications: "tasful_talk_notifications",
};

async function findBaseUrl() {
  for (const port of PORTS) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/detail-job.html`, {
        method: "HEAD",
      });
      if (res.ok) return `http://127.0.0.1:${port}`;
    } catch {
      /* next */
    }
  }
  throw new Error("No dev server found");
}

function readJson(page, key) {
  return page.evaluate((k) => {
    try {
      const raw = localStorage.getItem(k);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, key);
}

function countHireThreads(threads) {
  return (threads || []).filter(
    (t) => String(t.threadKind) === "job_hire" && String(t.listingId) === JOB_ID
  ).length;
}

function notifTitles(notifs) {
  return (notifs || []).map((n) => String(n.title || ""));
}

const base = await findBaseUrl();
console.log("Base URL:", base);

await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

await page.addInitScript((keys) => {
  Object.values(keys).forEach((k) => localStorage.removeItem(k));
  localStorage.removeItem("tasful_talk_notifications_seeded_v2");
}, STORAGE);

/* --- 1. 応募時点でチャットを作らない --- */
await page.goto(
  `${base}/detail-job.html?id=${JOB_ID}&userId=${APPLICANT_ID}&talkDev=1`,
  { waitUntil: "domcontentloaded", timeout: 60000 }
);
await page.waitForSelector("[data-job-dock-apply], [data-listing-primary-cta]", {
  timeout: 30000,
});
await page.waitForFunction(
  () => document.body.dataset.listingLoaded === "true",
  { timeout: 30000 }
);
await page.waitForTimeout(800);

const applyBtn = page.locator("[data-job-dock-apply], [data-listing-primary-cta]").first();
await applyBtn.click();
await page.waitForTimeout(1000);

const afterApply = await page.evaluate(({ keys, jobId, applicantId }) => {
  const apps = JSON.parse(localStorage.getItem(keys.applications) || "[]");
  const threads = JSON.parse(localStorage.getItem(keys.threads) || "[]");
  const mine = apps.find(
    (a) => String(a.job_id) === jobId && String(a.applicant_id) === applicantId
  );
  const hireThreads = threads.filter(
    (t) => String(t.threadKind) === "job_hire" && String(t.listingId) === jobId
  );
  return {
    applied: Boolean(mine),
    appStatus: mine?.status || "",
    threadId: mine?.thread_id || null,
    hireThreadCount: hireThreads.length,
    applyBtnText: document
      .querySelector("[data-job-dock-apply], [data-listing-primary-cta]")
      ?.textContent?.trim(),
  };
}, { keys: STORAGE, jobId: JOB_ID, applicantId: APPLICANT_ID });

console.log("After apply:", afterApply);

/* --- 2. 掲載者 — 応募者カード + 採用 / 断る --- */
await page.goto(
  `${base}/detail-job.html?id=${JOB_ID}&userId=${POSTER_ID}&talkDev=1#applications`,
  { waitUntil: "domcontentloaded", timeout: 60000 }
);
await page.waitForSelector("[data-job-applications-section]:not([hidden])", {
  timeout: 30000,
});
await page.waitForSelector("[data-job-applications-list] .job-app-card", {
  timeout: 30000,
});
await page.waitForTimeout(800);

const beforeHire = await page.evaluate(() => {
  const cards = [...document.querySelectorAll("[data-job-app-card]")];
  const first = cards[0];
  return {
    cardCount: cards.length,
    hireBtn: first?.querySelector("[data-job-app-hire]")?.textContent?.trim(),
    rejectBtn: first?.querySelector("[data-job-app-reject]")?.textContent?.trim(),
    sectionVisible: !document.querySelector("[data-job-applications-section]")?.hidden,
  };
}, STORAGE);

console.log("Before hire (poster):", beforeHire);

const threadsBeforeHire = await readJson(page, STORAGE.threads);
const hireCountBefore = countHireThreads(threadsBeforeHire);

/* --- 3. 採用する → チャット作成 + 双方通知 --- */
const hireTarget = page.locator("[data-job-app-hire]").first();
await hireTarget.click();
await page.waitForTimeout(1200);

const afterHire = await page.evaluate(({ keys, jobId }) => {
  const apps = JSON.parse(localStorage.getItem(keys.applications) || "[]");
  const threads = JSON.parse(localStorage.getItem(keys.threads) || "[]");
  const notifs = JSON.parse(localStorage.getItem(keys.notifications) || "[]");
  const hired = apps.find((a) => a.status === "selected" && String(a.job_id) === jobId);
  const hireThread = threads.find(
    (t) =>
      String(t.threadKind) === "job_hire" &&
      String(t.listingId) === jobId &&
      String(t.applicationId) === String(hired?.application_id)
  );
  const msgs = JSON.parse(localStorage.getItem(keys.messages) || "{}");
  const msgCount = hireThread ? (msgs[hireThread.id] || []).length : 0;
  return {
    hiredStatus: hired?.status || "",
    threadId: hired?.thread_id || hireThread?.id || null,
    hireThreadCount: threads.filter(
      (t) => String(t.threadKind) === "job_hire" && String(t.listingId) === jobId
    ).length,
    msgCount,
    notifTitles: notifs.map((n) => n.title),
    chatBtn: document.querySelector("[data-job-app-card] [data-job-app-hire]") === null
      ? document.querySelector(".job-app-card__btn--chat")?.textContent?.trim()
      : document
          .querySelector('[data-application-id="' + hired?.application_id + '"] .job-app-card__btn--chat')
          ?.textContent?.trim(),
    chatHref: document
      .querySelector(
        '[data-application-id="' + hired?.application_id + '"] .job-app-card__btn--chat'
      )
      ?.getAttribute("href"),
  };
}, { keys: STORAGE, jobId: JOB_ID });

console.log("After hire:", JSON.stringify(afterHire, null, 2));

/* --- 4. 断る → チャットなし + 断り通知のみ --- */
const rejectTarget = page.locator("[data-job-app-reject]").first();
await rejectTarget.click();
await page.waitForTimeout(1200);

const afterReject = await page.evaluate(({ keys, jobId }) => {
  const apps = JSON.parse(localStorage.getItem(keys.applications) || "[]");
  const threads = JSON.parse(localStorage.getItem(keys.threads) || "[]");
  const notifs = JSON.parse(localStorage.getItem(keys.notifications) || "[]");
  const rejected = apps.filter(
    (a) => a.status === "rejected" && String(a.job_id) === jobId
  );
  const hireThreads = threads.filter(
    (t) => String(t.threadKind) === "job_hire" && String(t.listingId) === jobId
  );
  return {
    rejectedCount: rejected.length,
    hireThreadCount: hireThreads.length,
    rejectNotifCount: notifs.filter((n) => n.title === "今回は見送りになりました").length,
    rejectNotifTitles: notifs
      .filter((n) => n.title === "今回は見送りになりました")
      .map((n) => n.title),
  };
}, { keys: STORAGE, jobId: JOB_ID });

console.log("After reject:", afterReject);

const failures = [];

if (!afterApply.applied) failures.push("応募が記録されていない");
if (afterApply.hireThreadCount > 0) failures.push("応募時点で job_hire チャットが作成された");
if (afterApply.threadId) failures.push("応募レコードに thread_id が付いている");

if (!beforeHire.sectionVisible) failures.push("掲載者に応募セクションが表示されない");
if (beforeHire.cardCount < 1) failures.push("応募者カードが表示されない");
if (beforeHire.hireBtn !== "採用する") failures.push(`採用ボタン文言: ${beforeHire.hireBtn}`);
if (beforeHire.rejectBtn !== "断る") failures.push(`断るボタン文言: ${beforeHire.rejectBtn}`);

if (hireCountBefore > 0) failures.push("採用前に既に job_hire チャットがある");

if (afterHire.hiredStatus !== "selected") failures.push("採用後ステータスが selected でない");
if (!afterHire.threadId) failures.push("採用後 thread_id がない");
if (afterHire.hireThreadCount < 1) failures.push("採用後 job_hire チャットがない");
if (afterHire.msgCount < 2) failures.push("採用チャットに初期メッセージが不足");
if (!afterHire.notifTitles.includes("掲載者とのやりとりを開始してください")) {
  failures.push("応募者向けやりとり開始通知がない");
}
if (!afterHire.notifTitles.includes("応募者とのやりとりを開始してください")) {
  failures.push("掲載者向けやりとり開始通知がない");
}
if (afterHire.chatBtn !== "チャットを開く") failures.push("採用カードにチャットボタンがない");
if (!afterHire.chatHref?.includes("chat-detail.html")) failures.push("チャットリンクが不正");

if (afterReject.rejectedCount < 1) failures.push("断り後 rejected ステータスがない");
if (afterReject.hireThreadCount !== afterHire.hireThreadCount) {
  failures.push("断り時に追加の job_hire チャットが作成された");
}
if (afterReject.rejectNotifCount < 1) failures.push("断り通知が届いていない");

});

if (failures.length) {
  console.error("FAILED:");
  failures.forEach((f) => console.error(" -", f));
  await closeAllBrowsers();
  process.exit(1);
}

console.log("OK: job apply / hire / reject flow");
