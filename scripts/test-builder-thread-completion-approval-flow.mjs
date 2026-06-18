/**
 * Builder スレッド内 — 完了報告・承認・差し戻し・再提出
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { requireDevServer } from "./lib/dev-base-url.mjs";
const MVP_KEY = "tasful:builder:mvp:v1";
const PROJECT_ID = "demo-project-001";
const THREAD_ID = "thread-demo-001";
const PARTNER_ID = "demo-partner-001";

const base = await requireDevServer();
console.log(`[dev] BASE_URL=${base}`);

await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

async function seedHiredThread() {
  await page.evaluate(
    ({ mvpKey, projectId, threadId, partnerId }) => {
      localStorage.setItem(mvpKey, JSON.stringify({
        version: 1,
        owner_id: "demo-owner-001",
        partners: [
          { partner_id: partnerId, display_name: "株式会社オレンジ建装" },
        ],
        projects: [
          {
            project_id: projectId,
            owner_id: "demo-owner-001",
            title: "新宿区 共同住宅 外装改修",
            kind: "builder_board",
            board_type: "project",
            status: "open",
            required_partners: 1,
            selected_partner_ids: [partnerId],
            main_thread_id: threadId,
            created_at: new Date().toISOString(),
          },
        ],
        specs: {
          [projectId]: { budget: { min: 600000, max: 900000 }, overview: "テスト案件" },
        },
        threads: {
          [threadId]: {
            thread_id: threadId,
            project_id: projectId,
            thread_kind: "board_match",
            events: [{ type: "selected", ts: new Date().toISOString(), text: "採用" }],
            messages: [{ msg_id: "m1", from: { type: "owner", name: "運営" }, ts: new Date().toISOString(), text: "よろしく" }],
          },
        },
        applications: [
          {
            application_id: "app-1",
            project_id: projectId,
            partner_id: partnerId,
            status: "selected",
            ts: new Date().toISOString(),
          },
        ],
      }));
      localStorage.removeItem("tasful_talk_notifications");
      localStorage.removeItem("tasful_talk_notifications_seeded_v2");
      localStorage.setItem("tasful:builder:mvp:role", "partner");
      localStorage.setItem("tasful:builder:mvp:partner_id", partnerId);
    },
    { mvpKey: MVP_KEY, projectId: PROJECT_ID, threadId: THREAD_ID, partnerId: PARTNER_ID }
  );
}

await page.goto(`${base}/builder/board-thread.html`, { waitUntil: "domcontentloaded", timeout: 60000 });
await seedHiredThread();
await page.goto(
  `${base}/builder/board-thread.html?thread_id=${THREAD_ID}&role=partner`,
  { waitUntil: "domcontentloaded", timeout: 60000 }
);
await page.waitForSelector("[data-thread-completion-submit]", { timeout: 30000 });
await page.waitForTimeout(600);

const beforeSubmit = await page.evaluate(() => ({
  hasCard: Boolean(document.querySelector("[data-thread-completion-card='submit']")),
  dealLinks: Array.from(document.querySelectorAll("a[href*='deal-detail']")).length,
}));
console.log("Before submit:", beforeSubmit);

await page.locator("[data-thread-completion-comment]").fill("足場工事が完了しました。写真・請求書を添付します。");
await page.locator("[data-thread-completion-submit]").click();
await page.waitForTimeout(1200);

const afterSubmit = await page.evaluate(({ mvpKey, threadId }) => {
  const state = JSON.parse(localStorage.getItem(mvpKey) || "{}");
  const thread = state.threads?.[threadId];
  const notifs = JSON.parse(localStorage.getItem("tasful_talk_notifications") || "[]");
  const completionNotifs = notifs.filter((n) => n.title === "完了報告が届きました");
  return {
    status: thread?.completion_submission?.status,
    pending: document.querySelector("[data-thread-completion-card='submit']") === null,
    waiting: document.body.textContent.includes("確認待ち"),
    notifyTitles: notifs.map((n) => n.title),
    notifyHrefs: notifs.map((n) => n.targetUrl || n.href || ""),
    completionCount: completionNotifs.length,
    completionHrefs: completionNotifs.map((n) => n.targetUrl || n.href || ""),
    mvpThreadOnBoard: Boolean(
      document.querySelector("[data-thread-completion-redirect]") === null &&
        document.querySelector("[data-thread-completion-card]")
    ),
  };
}, { mvpKey: MVP_KEY, threadId: THREAD_ID });

console.log("After submit:", afterSubmit);

/* 通知からスレッドへ（運営視点） */
await page.evaluate(() => {
  localStorage.setItem("tasful:builder:mvp:role", "owner");
});
await page.goto(`${base}/talk-home.html?tab=notify`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(1000);

const notifyCard = await page.evaluate(({ threadId }) => {
  const cards = Array.from(document.querySelectorAll("[data-talk-notify-id]"));
  const matches = cards.filter((c) => c.textContent.includes("完了報告が届きました"));
  const hit =
    matches.find((c) => {
      const notifyId = c.getAttribute("data-talk-notify-id") || "";
      const row =
        window.TasuTalkNotifications?.findById?.(notifyId) ||
        (window.TasuTalkNotifications?.getAll?.() || []).find((n) => n.id === notifyId);
      const href = row?.href || row?.targetUrl || "";
      return new RegExp(threadId).test(href);
    }) || matches[0];
  const action = hit?.querySelector("[data-talk-notify-action]");
  const notifyId = hit?.getAttribute("data-talk-notify-id") || "";
  const row =
    window.TasuTalkNotifications?.findById?.(notifyId) ||
    (window.TasuTalkNotifications?.getAll?.() || []).find((n) =>
      String(n.title || "").includes("完了報告が届きました")
    );
  const built = row ? window.TasuTalkNotifyActions?.buildNotifyNavigateAction?.(row) : null;
  const href = built?.href || row?.href || row?.targetUrl || action?.getAttribute("href") || "";
  return {
    found: Boolean(hit),
    href,
    hasDealDetail: href.includes("deal-detail"),
  };
}, { threadId: THREAD_ID });
console.log("Notify card:", notifyCard);

let afterNotifyNav = { hasApprove: false, hasReject: false, cardCount: 0, completionInView: false, hash: "" };
if (notifyCard.href && !notifyCard.hasDealDetail) {
  const url = notifyCard.href.startsWith("http")
    ? notifyCard.href
    : `${base}/builder/${notifyCard.href.replace(/^\.\//, "").replace(/^builder\//, "")}`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector("[data-thread-completion-approve]", { timeout: 30000 });
  await page.waitForTimeout(800);
  afterNotifyNav = await page.evaluate(() => {
    const el = document.getElementById("completion");
    const rect = el?.getBoundingClientRect();
    return {
      hasApprove: Boolean(document.querySelector("[data-thread-completion-approve]")),
      hasReject: Boolean(document.querySelector("[data-thread-completion-reject-open]")),
      hasSummary: Boolean(document.querySelector(".mvp-thread-completion__summary")),
      hasAttachments: document.body.textContent.includes("添付ファイル"),
      hasCompletionPhotos: document.body.textContent.includes("完了写真"),
      hasEmptySiteGroups: document.querySelectorAll(".builder-sitePhoto__group").length,
      hasEmptyReportsPanel: !document.getElementById("files")?.hidden,
      hasInvoice: document.body.textContent.includes("請求書"),
      cardCount: document.querySelectorAll("[data-thread-completion-card]").length,
      completionInView: rect ? rect.top < window.innerHeight && rect.bottom > 0 : false,
      hash: location.hash,
      path: location.pathname,
    };
  });
  console.log("After notify nav:", afterNotifyNav);
} else {
  await page.goto(
    `${base}/builder/board-thread.html?thread_id=${THREAD_ID}&role=owner&from=talk#completion`,
    { waitUntil: "domcontentloaded", timeout: 60000 }
  );
  await page.waitForSelector("[data-thread-completion-approve]", { timeout: 30000 });
  afterNotifyNav = await page.evaluate(() => ({
    hasApprove: Boolean(document.querySelector("[data-thread-completion-approve]")),
    hasReject: Boolean(document.querySelector("[data-thread-completion-reject-open]")),
    cardCount: document.querySelectorAll("[data-thread-completion-card]").length,
    completionInView: true,
    hash: location.hash,
    path: location.pathname,
  }));
}

/* 差し戻し */
await page.locator("[data-thread-completion-reject-open]").click();
await page.waitForTimeout(300);
await page.locator("[data-thread-completion-reject-reason]").fill("写真の角度が不足しています。再提出をお願いします。");
await page.locator("[data-thread-completion-reject-confirm]").click();
await page.waitForTimeout(1200);

const afterReject = await page.evaluate(({ mvpKey, threadId }) => {
  const state = JSON.parse(localStorage.getItem(mvpKey) || "{}");
  const thread = state.threads?.[threadId];
  const notifs = JSON.parse(localStorage.getItem("tasful_talk_notifications") || "[]");
  const sysMsgs = (thread?.messages || []).filter((m) => m.system).map((m) => m.text);
  return {
    status: thread?.completion_submission?.status,
    reason: thread?.completion_submission?.rejected_reason,
    rejectNotify: notifs.filter((n) => n.title === "完了報告が差し戻されました").length,
    sysMsgs,
  };
}, { mvpKey: MVP_KEY, threadId: THREAD_ID });

console.log("After reject:", afterReject);

/* 再提出（協力会社） */
await page.evaluate(() => {
  localStorage.setItem("tasful:builder:mvp:role", "partner");
});
await page.goto(
  `${base}/builder/board-thread.html?thread_id=${THREAD_ID}&role=partner`,
  { waitUntil: "domcontentloaded", timeout: 60000 }
);
await page.waitForSelector("[data-thread-completion-submit]", { timeout: 30000 });
await page.locator("[data-thread-completion-comment]").fill("追加写真を添付して再提出します。");
await page.locator("[data-thread-completion-submit]").click();
await page.waitForTimeout(1200);

/* 承認（運営） */
await page.evaluate(() => {
  localStorage.setItem("tasful:builder:mvp:role", "owner");
});
await page.goto(
  `${base}/builder/board-thread.html?thread_id=${THREAD_ID}&role=owner`,
  { waitUntil: "domcontentloaded", timeout: 60000 }
);
await page.waitForSelector("[data-thread-completion-approve]", { timeout: 30000 });
await page.locator("[data-thread-completion-approve]").click();
await page.waitForTimeout(1200);

const afterApprove = await page.evaluate(({ mvpKey, threadId, projectId }) => {
  const state = JSON.parse(localStorage.getItem(mvpKey) || "{}");
  const thread = state.threads?.[threadId];
  const project = (state.projects || []).find((p) => p.project_id === projectId);
  const events = (thread?.events || []).map((e) => e.type);
  const hasCompletedEvent = events.includes("completed");
  const threadCompleted = thread?.status === "completed";
  const subApproved = thread?.completion_submission?.status === "approved";
  const sysApproved = (thread?.messages || []).some((m) => m.text === "完了報告が承認されました");
  return {
    threadStatus: thread?.status,
    subStatus: thread?.completion_submission?.status,
    hasCompletedEvent,
    threadCompleted,
    subApproved,
    sysApproved,
    siteCompleted: thread?.siteData?.completed,
    approvedBanner: document.body.textContent.includes("取引が完了"),
  };
}, { mvpKey: MVP_KEY, threadId: THREAD_ID, projectId: PROJECT_ID });

console.log("After approve:", afterApprove);

const failures = [];
if (!beforeSubmit.hasCard) failures.push("完了報告カードなし");
if (beforeSubmit.dealLinks > 0) failures.push("deal-detail リンクが残っている");
if (afterSubmit.status !== "submitted") failures.push("提出後ステータス不正");
if (!afterSubmit.notifyTitles.includes("完了報告が届きました")) failures.push("提出通知なし");
if (afterSubmit.completionCount !== 1) failures.push(`完了報告通知が重複 (${afterSubmit.completionCount})`);
if (afterSubmit.completionHrefs.some((h) => h.includes("mvp-thread"))) {
  failures.push("一般案件の完了報告が mvp-thread へ");
}
if (!afterSubmit.completionHrefs.some((h) => h.includes("board-thread"))) {
  failures.push("一般案件の完了報告が board-thread へ未振り分け");
}
if (afterSubmit.notifyHrefs.some((h) => h.includes("deal-detail"))) failures.push("提出通知が deal-detail へ");
if (!notifyCard.found || notifyCard.hasDealDetail) failures.push("通知カードが deal-detail へ遷移");
if (!afterNotifyNav.hasApprove) failures.push("通知遷移後に承認ボタンなし");
if (!afterNotifyNav.hasReject) failures.push("通知遷移後に差し戻しボタンなし");
if (afterNotifyNav.hasEmptySiteGroups > 0) failures.push("通知遷移後に空の現場写真枠が残っている");
if (afterNotifyNav.hasEmptyReportsPanel) failures.push("通知遷移後に空の報告書パネルが残っている");
if (!afterNotifyNav.hasSummary) failures.push("通知遷移後に完了報告サマリーなし");
if (!afterNotifyNav.hash.includes("completion") && !String(notifyCard.href || "").includes("#completion")) {
  failures.push("通知遷移後 #completion なし");
}
if (!afterNotifyNav.completionInView) failures.push("通知遷移後 #completion が画面内にない");
if (afterNotifyNav.cardCount > 1) failures.push(`完了報告カードが二重表示 (${afterNotifyNav.cardCount})`);
if (!afterNotifyNav.path?.includes("board-thread")) failures.push("通知遷移先が board-thread でない");
if (afterReject.status !== "rejected") failures.push("差し戻し後ステータス不正");
if (!afterReject.rejectNotify) failures.push("差し戻し通知なし");
if (!afterReject.sysMsgs.includes("完了報告が差し戻されました")) failures.push("差し戻しシステムメッセージなし");
if (!afterApprove.subApproved) failures.push("承認後 submission ステータス不正");
if (!afterApprove.threadCompleted) failures.push("承認後 thread.status が completed でない");
if (!afterApprove.hasCompletedEvent) failures.push("completed イベントなし");
if (!afterApprove.sysApproved) failures.push("承認システムメッセージなし");

});

if (failures.length) {
  console.error("FAILED:");
  failures.forEach((f) => console.error(" -", f));
  await closeAllBrowsers();
  process.exit(1);
}

console.log("OK: builder thread completion / approval / reject / resubmit flow");
