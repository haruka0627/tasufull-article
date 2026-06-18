/**
 * 公式カレンダー — 受ける / 受けない → 受諾時のみ calendar_request スレッド
 */
import { chromium } from "./lib/playwright-browser.mjs";

const PORTS = [5173, 5176, 5174, 5199, 5200, 5188];
const MVP_KEY = "tasful:builder:mvp:v1";
const DEMO_PROJECT_ID = "builder_demo_001";
const PARTNER_ACCEPT = "demo-partner-001";
const PARTNER_DECLINE = "demo-partner-002";

async function findBaseUrl() {
  for (const port of PORTS) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/builder/mvp-calendar.html`, {
        method: "HEAD",
      });
      if (res.ok) return `http://127.0.0.1:${port}`;
    } catch {
      /* next */
    }
  }
  throw new Error("No dev server found");
}

function countCalendarThreads(state, projectId) {
  return Object.values(state.threads || {}).filter(
    (t) =>
      String(t.project_id) === projectId &&
      String(t.thread_kind || "") === "calendar_request"
  ).length;
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

await page.goto(`${base}/builder/mvp-calendar.html`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.evaluate((mvpKey) => {
  localStorage.removeItem(mvpKey);
  localStorage.removeItem("tasful_talk_notifications");
  localStorage.removeItem("tasful_talk_notifications_seeded_v2");
}, MVP_KEY);
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);

/* 辞退用の第2案件を投入 */
await page.evaluate(
  ({ mvpKey, partnerId }) => {
    const state = JSON.parse(localStorage.getItem(mvpKey) || "{}");
    const id = "proj-cal-decline-test";
    const exists = (state.projects || []).some((p) => p.project_id === id);
    if (!exists) {
      state.projects = state.projects || [];
      state.projects.push({
        project_id: id,
        owner_id: "demo-owner-001",
        title: "カレンダー辞退テスト案件",
        kind: "builder_board",
        board_type: "calendar",
        projectKind: "calendar",
        type: "calendar",
        status: "open",
        required_partners: 1,
        selected_partner_ids: [partnerId],
        calendar_assigned_partner_id: partnerId,
        assignment_status: "pending",
        main_thread_id: null,
        source: "admin_calendar",
        created_at: new Date().toISOString(),
      });
      state.specs = state.specs || {};
      state.specs[id] = {
        area: { label: "東京都港区" },
        site_address: "東京都港区テスト1-1",
        period: { start: "2026-06-10", end: "2026-06-12" },
        reward: "¥50,000",
        overview: "辞退フロー検証用",
        work_content: "簡易作業",
        notes: "テスト",
      };
      localStorage.setItem(mvpKey, JSON.stringify(state));
    }
  },
  { mvpKey: MVP_KEY, partnerId: PARTNER_DECLINE }
);

/* --- 受諾前: スレッドなし --- */
await setRole("partner", PARTNER_ACCEPT);
await page.goto(
  `${base}/builder/mvp-calendar.html?role=partner&projectId=${DEMO_PROJECT_ID}`,
  { waitUntil: "domcontentloaded", timeout: 60000 }
);
await page.waitForSelector("[data-mvp-cal-accept]", { timeout: 30000 });
await page.waitForTimeout(600);

const beforeAccept = await page.evaluate(({ mvpKey, projectId }) => {
  const state = JSON.parse(localStorage.getItem(mvpKey) || "{}");
  const calendarThreads = Object.values(state.threads || {}).filter(
    (t) => t.project_id === projectId && t.thread_kind === "calendar_request"
  ).length;
  return {
    acceptBtn: document.querySelector("[data-mvp-cal-accept]")?.textContent?.trim(),
    declineBtn: document.querySelector("[data-mvp-cal-decline]")?.textContent?.trim(),
    calendarThreads,
    hasReward: document.body.textContent.includes("報酬"),
  };
}, { mvpKey: MVP_KEY, projectId: DEMO_PROJECT_ID });

console.log("Before accept:", beforeAccept);

/* --- 受ける --- */
await page.locator("[data-mvp-cal-accept]").click();
await page.waitForTimeout(1200);

const afterAccept = await page.evaluate(({ mvpKey, projectId }) => {
  const state = JSON.parse(localStorage.getItem(mvpKey) || "{}");
  const notifs = JSON.parse(localStorage.getItem("tasful_talk_notifications") || "[]");
  const project = (state.projects || []).find((p) => p.project_id === projectId);
  const thread =
    Object.values(state.threads || {}).find(
      (t) => t.project_id === projectId && t.thread_kind === "calendar_request"
    ) || null;
  return {
    status: project?.assignment_status,
    threadId: project?.main_thread_id || thread?.thread_id,
    threadKind: thread?.thread_kind,
    msgCount: (thread?.messages || []).length,
    titles: notifs.map((n) => n.title),
    chatHref: document.querySelector(".mvp-cal-assignment__actions a")?.getAttribute("href"),
  };
}, { mvpKey: MVP_KEY, projectId: DEMO_PROJECT_ID });

console.log("After accept:", afterAccept);

/* --- スレッド: 入退場・完了 --- */
if (afterAccept.threadId) {
  await page.goto(
    `${base}/builder/mvp-thread.html?thread_id=${encodeURIComponent(afterAccept.threadId)}&role=partner`,
    { waitUntil: "domcontentloaded", timeout: 60000 }
  );
  await page.waitForSelector("[data-builder-mvp-thread-enter]", { timeout: 30000 });
  await page.locator("[data-builder-mvp-thread-enter]").click();
  await page.waitForTimeout(500);
  await page.locator("[data-builder-mvp-thread-leave]").click();
  await page.waitForTimeout(500);
  await page.locator("[data-builder-mvp-thread-complete-open]").click();
  await page.waitForTimeout(800);
}

const threadOps = await page.evaluate(
  ({ mvpKey, threadId }) => {
    const state = JSON.parse(localStorage.getItem(mvpKey) || "{}");
    const thread = state.threads?.[threadId];
    const types = (thread?.events || []).map((e) => e.type);
    return {
      hasCheckIn: types.includes("check_in"),
      hasCheckOut: types.includes("check_out"),
      talkLink: document.querySelector('a[href*="talk-home"]')?.getAttribute("href"),
    };
  },
  { mvpKey: MVP_KEY, threadId: afterAccept.threadId }
);

console.log("Thread ops:", threadOps);

/* --- 受けない（第2案件） --- */
await setRole("partner", PARTNER_DECLINE);
await page.goto(
  `${base}/builder/mvp-calendar.html?role=partner&projectId=proj-cal-decline-test`,
  { waitUntil: "domcontentloaded", timeout: 60000 }
);
await page.waitForSelector("[data-mvp-cal-decline]", { timeout: 30000 });
const threadsBeforeDecline = await page.evaluate((mvpKey) => {
  const state = JSON.parse(localStorage.getItem(mvpKey) || "{}");
  return Object.values(state.threads || {}).filter(
    (t) => t.project_id === "proj-cal-decline-test" && t.thread_kind === "calendar_request"
  ).length;
}, MVP_KEY);
await page.locator("[data-mvp-cal-decline]").click();
await page.waitForTimeout(1000);

const afterDecline = await page.evaluate(({ mvpKey, projectId }) => {
  const state = JSON.parse(localStorage.getItem(mvpKey) || "{}");
  const notifs = JSON.parse(localStorage.getItem("tasful_talk_notifications") || "[]");
  const project = (state.projects || []).find((p) => p.project_id === projectId);
  return {
    status: project?.assignment_status,
    calendarThreads: Object.values(state.threads || {}).filter(
      (t) => t.project_id === projectId && t.thread_kind === "calendar_request"
    ).length,
    rejectTitles: notifs.map((n) => n.title).filter((t) => t === "今回は見送りになりました"),
  };
}, { mvpKey: MVP_KEY, projectId: "proj-cal-decline-test" });

console.log("After decline:", afterDecline);

const failures = [];
if (beforeAccept.calendarThreads > 0) failures.push("受諾前に calendar_request スレッドがある");
if (beforeAccept.acceptBtn !== "受ける") failures.push(`受けるボタン: ${beforeAccept.acceptBtn}`);
if (beforeAccept.declineBtn !== "受けない") failures.push(`受けないボタン: ${beforeAccept.declineBtn}`);
if (!beforeAccept.hasReward) failures.push("報酬表示なし");

if (afterAccept.status !== "accepted") failures.push("受諾後ステータス不正");
if (!afterAccept.threadId) failures.push("受諾後 thread_id なし");
if (afterAccept.threadKind !== "calendar_request") failures.push(`thread_kind: ${afterAccept.threadKind}`);
if (!afterAccept.titles.includes("依頼を引き受けました")) failures.push("受諾者通知なし");
if (!afterAccept.titles.includes("依頼を受けました")) failures.push("運営通知なし");
if (!afterAccept.chatHref?.includes("mvp-thread.html")) failures.push("チャットリンク不正");

if (!threadOps.hasCheckIn || !threadOps.hasCheckOut) failures.push("入退場イベントなし");
if (!threadOps.talkLink?.includes("talk-home")) failures.push("スレッドに TASFUL TALK リンクなし");

if (afterDecline.status !== "declined") failures.push("辞退後ステータス不正");
if (afterDecline.calendarThreads > threadsBeforeDecline) failures.push("辞退時にスレッド作成");
if (!afterDecline.rejectTitles.length) failures.push("辞退通知なし");

await browser.close();

if (failures.length) {
  console.error("FAILED:");
  failures.forEach((f) => console.error(" -", f));
  process.exit(1);
}

console.log("OK: calendar request / accept / decline flow");
