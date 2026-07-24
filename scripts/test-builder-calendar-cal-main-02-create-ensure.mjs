#!/usr/bin/env node
/**
 * CAL-MAIN-02 — 案件作成時 Talk Room 自動 ensure
 *
 *   node scripts/test-builder-calendar-cal-main-02-create-ensure.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "./lib/playwright-browser.mjs";
import { buildLocalPageUrl, STANDARD_LOCAL_BASE } from "./lib/dev-server-url.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(root, "reports", "builder-calendar-cal-main-02");
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
  console.log(`=== CAL-MAIN-02 create ensure @ ${STANDARD_LOCAL_BASE} ===\n`);

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
    window.TasuBuilderProjectCalendar.refresh();
  });
  await page.waitForTimeout(300);

  // 1) saveProject 直後に talkRoomId が入る（同期 provisional）
  const created = await page.evaluate(async () => {
    const Store = window.TasuBuilderProjectStore;
    const Talk = window.TasuBuilderProjectTalkRoom;
    const id = crypto.randomUUID();
    const immediate = Store.saveProject({
      id,
      name: "CAL-MAIN-02 作成時 ensure",
      status: "inquiry",
      scheduleStartDate: Store.todayDateOnly(),
      scheduleEndDate: Store.todayDateOnly(),
      siteAddress: "東京都港区1-1",
      managerName: "作成テスト",
      managerPhone: "03-1111-2222",
    });
    const immediateRoom = immediate.talkRoomId || "";
    const afterAwait = immediate._talkRoomEnsurePromise
      ? await immediate._talkRoomEnsurePromise
      : await Store.saveProjectAsync({ id, name: immediate.name });
    const finalRoom = afterAwait.talkRoomId || Store.getProject(id)?.talkRoomId || "";
    const again = await Talk.ensureTalkRoomForProject(id);
    return {
      id,
      immediateRoom,
      finalRoom,
      againRoom: again.roomId,
      immediateStable: Talk.isStableTalkRoomId(immediateRoom),
      finalStable: Talk.isStableTalkRoomId(finalRoom),
      placeholder: Talk.isPlaceholderTalkRoomId(finalRoom),
      sameAsAgain: again.roomId === finalRoom,
    };
  });

  assert(created.immediateStable, "immediate talkRoomId after saveProject", created.immediateRoom);
  assert(created.finalStable, "final talkRoomId after ensure", created.finalRoom);
  assert(!created.placeholder, "not builder-cal-*", created.finalRoom);
  assert(created.sameAsAgain, "Talk start reuses same room", created.againRoom);

  // 2) 作成直後メッセージ → 同じ room
  await page.evaluate((pid) => window.TasuBuilderProjectCalendar.selectProject(pid), created.id);
  await page.waitForTimeout(200);
  await page.locator('[data-builder-pc-action="message"]').click();
  await page.waitForFunction(
    () => /chat-detail/.test(location.pathname) && new URLSearchParams(location.search).get("from") === "builder_calendar",
    { timeout: 20000 },
  );
  const roomInUrl = await page.evaluate(() => {
    const sp = new URLSearchParams(location.search);
    return sp.get("thread") || sp.get("roomId") || "";
  });
  assert(roomInUrl === created.finalRoom, "message opens same room", roomInUrl);

  // 3) 戻り・更新後も同じ room
  await page.locator("a[data-builder-cal-return]").first().click();
  await page.waitForFunction(() => /project-calendar/.test(location.pathname), { timeout: 20000 });
  await page.waitForTimeout(400);
  const afterReturn = await page.evaluate((pid) => {
    return window.TasuBuilderProjectStore.getProject(pid)?.talkRoomId || "";
  }, created.id);
  assert(afterReturn === created.finalRoom, "room stable after return");

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-builder-pc-calendar-body]", { timeout: 15000 });
  await page.waitForTimeout(600);
  const afterReload = await page.evaluate(async (pid) => {
    await window.TasuBuilderProjectStore.hydrateFromSupabase?.();
    const p = window.TasuBuilderProjectStore.getProject(pid);
    const res = await window.TasuBuilderProjectTalkRoom.ensureTalkRoomForProject(pid);
    return { saved: p?.talkRoomId || "", ensured: res.roomId };
  }, created.id);
  assert(afterReload.ensured === created.finalRoom, "same room after reload", JSON.stringify(afterReload));

  // 4) skipTalkRoom オプション
  const skipped = await page.evaluate(() => {
    const Store = window.TasuBuilderProjectStore;
    const Talk = window.TasuBuilderProjectTalkRoom;
    const id = crypto.randomUUID();
    const p = Store.saveProject(
      { id, name: "skip talk", status: "inquiry", scheduleStartDate: Store.todayDateOnly(), scheduleEndDate: Store.todayDateOnly() },
      { skipTalkRoom: true },
    );
    return {
      id,
      room: p.talkRoomId || "",
      hasPromise: Boolean(p._talkRoomEnsurePromise),
      placeholder: Talk.isPlaceholderTalkRoomId(p.talkRoomId),
    };
  });
  assert(!skipped.room && !skipped.hasPromise, "skipTalkRoom leaves empty", JSON.stringify(skipped));

  await page.screenshot({ path: path.join(OUT, "001-cal-main-02-1280.png"), fullPage: true });
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
