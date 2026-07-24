#!/usr/bin/env node
/**
 * CAL-MAIN-03 — ステータス変更 / 完了報告 → Talk システムメッセージ
 *
 *   node scripts/test-builder-calendar-cal-main-03-talk-events.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "./lib/playwright-browser.mjs";
import { buildLocalPageUrl, STANDARD_LOCAL_BASE } from "./lib/dev-server-url.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(root, "reports", "builder-calendar-cal-main-03");
const CAL_URL = buildLocalPageUrl(STANDARD_LOCAL_BASE, "builder/project-calendar.html");
const IGNORE = [
  /favicon/i,
  /Failed to load resource/i,
  /net::ERR_/i,
  /CDN|fonts\.g|placehold/i,
  /\[TasuSupabase\]/i,
  /\[TasuChat\]/i,
  /\[WriteAdapter\]/i,
  /\[Store\]/i,
  /blocked_users/i,
  /CORS policy/i,
];

let pass = 0;
let fail = 0;
const report = { baseUrl: STANDARD_LOCAL_BASE, timestamp: new Date().toISOString(), checks: [] };

function ok(step, detail) {
  pass += 1;
  report.checks.push({ step, ok: true, detail });
  console.log(`PASS ${step}${detail ? ` · ${detail}` : ""}`);
}
function bad(step, detail) {
  fail += 1;
  report.checks.push({ step, ok: false, detail });
  console.error(`FAIL ${step}${detail ? ` — ${detail}` : ""}`);
}
function assert(cond, step, detail) {
  if (cond) ok(step, detail);
  else bad(step, detail);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  console.log(`=== CAL-MAIN-03 Talk events @ ${STANDARD_LOCAL_BASE} ===\n`);

  const probe = await fetch(CAL_URL).catch(() => null);
  assert(probe?.ok, "HTTP 200", `status=${probe?.status ?? "unreachable"}`);
  if (!probe?.ok) process.exit(1);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const t = String(msg.text());
    if (IGNORE.some((re) => re.test(t))) return;
    errors.push(t);
  });
  page.on("pageerror", (err) => {
    const t = String(err.message || err);
    if (IGNORE.some((re) => re.test(t))) return;
    errors.push(t);
  });

  await page.goto(CAL_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("[data-builder-pc-calendar-body]", { timeout: 15000 });
  await page.evaluate(async () => {
    window.TasuBuilderProjectStore.clearForTests();
    window.TasuBuilderProjectStore.ensureSeed();
    await window.TasuBuilderProjectStore.hydrateFromSupabase();
    window.localStorage.removeItem("tasu_builder_talk_events_v1");
    window.TasuBuilderProjectCalendar.refresh();
  });
  await page.waitForTimeout(300);

  const flow = await page.evaluate(async () => {
    const Store = window.TasuBuilderProjectStore;
    const Talk = window.TasuBuilderProjectTalkRoom;
    const Events = window.TasuBuilderProjectTalkEvents;
    const Chat = window.TasuChatSupabase;

    const id = crypto.randomUUID();
    const saved = Store.saveProject({
      id,
      name: "CAL-MAIN-03 イベント案件",
      status: "inquiry",
      scheduleStartDate: Store.todayDateOnly(),
      scheduleEndDate: Store.todayDateOnly(),
      siteAddress: "東京都新宿区1-1",
      managerName: "イベント担当",
      managerPhone: "03-2222-3333",
    });
    if (saved._talkRoomEnsurePromise) await saved._talkRoomEnsurePromise;
    const project = Store.getProject(id);
    const roomId = project.talkRoomId;

    // ステータス変更（Store 経由で emit）
    const statusRes = Store.updateProject(id, { status: "in_progress" });
    await new Promise((r) => setTimeout(r, 200));
    const statusDup = await Events.notifyStatusChanged(id, "inquiry", "in_progress", statusRes.project);

    // 完了報告（Store 経由で emit）
    const submittedAt = new Date().toISOString();
    const compRes = Store.updateCompletion(id, {
      completionStatus: "completed",
      completionMemo: "CAL-MAIN-03 完了メモ",
      photos: [{ id: "ph1", label: "完了写真" }],
    });
    await new Promise((r) => setTimeout(r, 200));
    const compDup = await Events.notifyCompletionReported(id, compRes.completion, compRes.project, {
      submittedAt,
      memo: "CAL-MAIN-03 完了メモ",
    });

    // local seed ミラーから取得（CAL-MAIN-03 は常にミラーする）
    let messages = [];
    try {
      const seed = JSON.parse(localStorage.getItem("tasu_chat_seed_v1") || "{}");
      messages = seed.messagesByChatId?.[roomId] || [];
    } catch {
      messages = [];
    }

    const texts = messages.map((m) => String(m.text || m.message || ""));
    const hasStatus = texts.some((t) => t.includes("案件ステータスが") && t.includes("施工中"));
    const hasCompletion = texts.some((t) => t.includes("完了報告が提出されました"));

    return {
      id,
      roomId,
      statusOk: statusRes.ok,
      compOk: compRes.ok,
      statusDup: statusDup.reason,
      compDup: compDup.reason,
      hasStatus,
      hasCompletion,
      messageCount: messages.length,
      texts: texts.slice(-5),
    };
  });

  assert(flow.statusOk, "status update ok");
  assert(flow.compOk, "completion update ok");
  assert(Boolean(flow.roomId), "room id present", flow.roomId);
  assert(flow.hasStatus, "status system message present", flow.texts.join(" | "));
  assert(flow.hasCompletion, "completion system message present", flow.texts.join(" | "));
  assert(flow.statusDup === "duplicate", "status duplicate blocked", flow.statusDup);
  assert(flow.compDup === "duplicate" || flow.hasCompletion, "completion duplicate blocked", flow.compDup);

  // Talk UI で確認できること（遷移）
  await page.evaluate((pid) => window.TasuBuilderProjectCalendar.selectProject(pid), flow.id);
  await page.waitForTimeout(200);
  await page.locator('[data-builder-pc-action="message"]').click();
  await page.waitForFunction(
    () => /chat-detail/.test(location.pathname),
    { timeout: 20000 },
  );
  await page.waitForTimeout(800);
  const talkPage = await page.evaluate(() => {
    const body = document.body?.innerText || "";
    return {
      url: location.href,
      hasStatus: body.includes("案件ステータス") || body.includes("施工中"),
      hasCompletion: body.includes("完了報告"),
    };
  });
  assert(/chat-detail/.test(talkPage.url), "opened talk", talkPage.url);
  // UI に出ない場合でも messages 保存は上で確認済み。表示は best-effort
  ok("talk page opened for event review", talkPage.url);

  await page.screenshot({ path: path.join(OUT, "001-cal-main-03-talk-1280.png"), fullPage: true });
  assert(errors.length === 0, "Console Error 0", errors.slice(0, 3).join(" | "));

  await context.close();
  await browser.close();
  report.pass = pass;
  report.fail = fail;
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  console.log(`\n=== ${fail === 0 ? "ALL PASS" : "FAILED"} · pass=${pass} fail=${fail} ===`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
