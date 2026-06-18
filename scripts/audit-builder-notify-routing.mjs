/**
 * Builder 通知ルーティング最終監査
 */
import { chromium } from "./lib/playwright-browser.mjs";

const PORTS = [5173, 5176, 5174, 5199, 5200, 5188];
const THREAD_ID = "thread-audit-001";
const PROJECT_ID = "demo-project-001";
const CAL_PROJECT = "builder_demo_001";

const EXPECTED = [
  { title: "選定されました", type: "selected", recipientRole: "partner", mustInclude: ["board-thread.html", THREAD_ID], mustExclude: ["deal-detail"] },
  { title: "選定が完了しました", type: "hire_confirmed", recipientRole: "owner", mustInclude: ["board-thread.html", THREAD_ID], mustExclude: ["deal-detail"] },
  { title: "依頼を引き受けました", type: "selected", projectKind: "calendar", recipientRole: "partner", mustInclude: ["mvp-thread.html", THREAD_ID], mustExclude: ["deal-detail"] },
  { title: "依頼を受けました", type: "hire_confirmed", projectKind: "calendar", recipientRole: "owner", mustInclude: ["mvp-thread.html", THREAD_ID], mustExclude: ["deal-detail"] },
  { title: "完了報告が届きました", type: "completion_submitted", recipientRole: "owner", mustInclude: ["board-thread.html", THREAD_ID], mustExclude: ["deal-detail"] },
  { title: "完了報告が差し戻されました", type: "completion_rejected", recipientRole: "partner", mustInclude: ["board-thread.html", THREAD_ID], mustExclude: ["deal-detail"] },
  { title: "新着案件が入りました", type: "calendar_assignment", projectKind: "calendar", mustInclude: ["mvp-calendar.html", CAL_PROJECT], mustExclude: ["deal-detail", "board-thread"] },
];

async function findBaseUrl() {
  for (const port of PORTS) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/talk-home.html`, { method: "HEAD" });
      if (res.ok) return `http://127.0.0.1:${port}`;
    } catch {
      /* next */
    }
  }
  throw new Error("No dev server found");
}

const base = await findBaseUrl();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await page.goto(`${base}/talk-home.html?tab=notify`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(500);

const results = await page.evaluate(
  ({ expected, threadId, projectId, calProject }) => {
    const resolve = window.TasuTalkPlatformNotify?.resolveBuilderMvpNotifyPayload;
    if (!resolve) return { error: "resolveBuilderMvpNotifyPayload missing" };
    return expected.map((row) => {
      const payload = resolve({
        type: row.type,
        title: row.title,
        thread_id: threadId,
        project_id: row.projectKind === "calendar" ? calProject : projectId,
        projectKind: row.projectKind || "project",
        board_type: row.projectKind || "project",
        recipientRole: row.recipientRole || "",
      });
      const href = String(payload?.href || "");
      const okInclude = (row.mustInclude || []).every((s) => href.includes(s));
      const okExclude = (row.mustExclude || []).every((s) => !href.includes(s));
      return {
        title: row.title,
        href,
        actionLabel: payload?.actionLabel,
        ok: okInclude && okExclude,
      };
    });
  },
  { expected: EXPECTED, threadId: THREAD_ID, projectId: PROJECT_ID, calProject: CAL_PROJECT }
);

console.log("Notify routing audit:");
results.forEach((r) => {
  console.log(` ${r.ok ? "OK" : "NG"} | ${r.title}`);
  console.log(`      href: ${r.href} | action: ${r.actionLabel}`);
});

const talkLinks = await page.evaluate(() => ({
  boardThread: Boolean(document.querySelector('a[href*="talk-home"][data-builder-board-thread-talk], a[href*="talk-home"].builder-btn--ghost')),
  mvpThread: null,
  boardPd: null,
  mvpCal: null,
}));

await page.goto(`${base}/builder/board-thread.html?thread_id=thread-demo-001&role=owner`, {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
talkLinks.boardThread = await page.evaluate(() =>
  Boolean(document.querySelector('[data-builder-board-thread-talk][href*="talk-home"]'))
);

await page.goto(`${base}/builder/mvp-thread.html?thread_id=thread-demo-001&role=partner`, {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
talkLinks.mvpThread = await page.evaluate(() =>
  Boolean(document.querySelector('[data-builder-mvp-thread-talk][href*="talk-home"]'))
);

await page.goto(`${base}/builder/board-project-detail.html?id=demo-project-001`, {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
talkLinks.boardPd = await page.evaluate(() => ({
  talk: Boolean(document.querySelector('[data-builder-board-pd-talk][href*="talk-home"]')),
  dealLinks: document.querySelectorAll('a[href*="deal-detail"]').length,
  completionBtn: document.querySelectorAll("[data-builder-board-pd-completion]").length,
  invoiceBtn: document.querySelectorAll("[data-builder-board-pd-invoice]").length,
}));

await page.goto(`${base}/builder/mvp-calendar.html?role=partner`, {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
talkLinks.mvpCal = await page.evaluate(() =>
  Boolean(document.querySelector('a.mvp-cal-talk-link[href*="talk-home"]'))
);

console.log("\nTALK back links:", JSON.stringify(talkLinks, null, 2));

await browser.close();

const failures = [];
if (results?.error) failures.push(results.error);
else (Array.isArray(results) ? results : []).forEach((r) => {
  if (!r.ok) failures.push(`通知ルーティング: ${r.title}`);
});
if (!talkLinks.boardThread) failures.push("board-thread: TALKリンクなし");
if (!talkLinks.mvpThread) failures.push("mvp-thread: TALKリンクなし");
if (!talkLinks.boardPd?.talk) failures.push("board-project-detail: TALKリンクなし");
if (talkLinks.boardPd?.dealLinks > 0) failures.push("board-project-detail: deal-detailリンク残存");
if (talkLinks.boardPd?.completionBtn > 0) failures.push("board-project-detail: 完了確認ボタン残存");
if (talkLinks.boardPd?.invoiceBtn > 0) failures.push("board-project-detail: 支払いボタン残存");
if (!talkLinks.mvpCal) failures.push("mvp-calendar: TALKリンクなし");

if (failures.length) {
  console.error("\nFAILED:");
  failures.forEach((f) => console.error(" -", f));
  process.exit(1);
}

console.log("\nOK: builder notify routing audit passed");
