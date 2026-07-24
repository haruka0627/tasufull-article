#!/usr/bin/env node
/**
 * CAL-MAIN-01 — Builder Calendar 実 Talk Room ID 正本化
 *
 *   node scripts/test-builder-calendar-cal-main-01-talk-room.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "./lib/playwright-browser.mjs";
import { buildLocalPageUrl, STANDARD_LOCAL_BASE } from "./lib/dev-server-url.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(root, "reports", "builder-calendar-cal-main-01");
const CAL_URL = buildLocalPageUrl(STANDARD_LOCAL_BASE, "builder/project-calendar.html");
const IGNORE = [
  /favicon/i,
  /Failed to load resource/i,
  /net::ERR_/i,
  /CDN|fonts\.g|placehold/i,
  /\[TasuSupabase\]/i,
  /\[TasuTalkRoomEnsure\]/i,
  /\[TasuChat\]/i,
  /\[WriteAdapter\]/i,
  /\[Store\]/i,
  /CORS policy/i,
  /ensure-talk-room/i,
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
  console.log(`=== CAL-MAIN-01 Talk Room @ ${STANDARD_LOCAL_BASE} ===\n`);

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
  await page.waitForTimeout(400);

  // 新規案件（id は UUID — builder_projects.id が uuid 型のため）
  const created = await page.evaluate(async () => {
    const Store = window.TasuBuilderProjectStore;
    const Talk = window.TasuBuilderProjectTalkRoom;
    const id = crypto.randomUUID();
    Store.saveProject({
      id,
      name: "CAL-MAIN-01 テスト案件",
      status: "inquiry",
      scheduleStartDate: Store.todayDateOnly(),
      scheduleEndDate: Store.todayDateOnly(),
      siteAddress: "東京都千代田区1-1",
      managerName: "テスト担当",
      managerPhone: "03-0000-0000",
    });
    const res = await Talk.ensureTalkRoomForProject(id);
    const p = Store.getProject(id);
    const again = await Talk.ensureTalkRoomForProject(id);
    return {
      id,
      roomId: res.roomId,
      saved: p.talkRoomId,
      mode: res.mode,
      created: res.created,
      againId: again.roomId,
      againReused: again.reused || again.mode === "cached" || again.mode === "db_lookup",
      placeholder: Talk.isPlaceholderTalkRoomId(res.roomId),
      stable: Talk.isStableTalkRoomId(res.roomId),
    };
  });

  assert(created.stable, "new project stable room", created.roomId);
  assert(!created.placeholder, "new project not builder-cal-*");
  assert(created.saved === created.roomId, "new project talkRoomId saved");
  assert(created.againId === created.roomId, "no duplicate room", created.againId);

  // 別案件で仮 ID を昇格（created とは別 ID）
  const upgraded = await page.evaluate(async (createdId) => {
    const Store = window.TasuBuilderProjectStore;
    const Talk = window.TasuBuilderProjectTalkRoom;
    const otherId = crypto.randomUUID();
    Store.saveProject({
      id: otherId,
      name: "CAL-MAIN-01 昇格テスト",
      status: "inquiry",
      scheduleStartDate: Store.todayDateOnly(),
      scheduleEndDate: Store.todayDateOnly(),
    });
    const fake = `builder-cal-${otherId}`;
    Store.patchProjectLocal(otherId, { talkRoomId: fake, talkThreadId: fake });
    const before = Store.getProject(otherId).talkRoomId;
    const res = await Talk.ensureTalkRoomForProject(otherId);
    const after = Store.getProject(otherId).talkRoomId;
    return {
      id: otherId,
      createdId,
      before,
      after,
      roomId: res.roomId,
      placeholderAfter: Talk.isPlaceholderTalkRoomId(after),
      stable: Talk.isStableTalkRoomId(after),
    };
  }, created.id);
  assert(Boolean(upgraded), "project for upgrade found");
  assert(upgraded.before.startsWith("builder-cal-"), "placeholder set", upgraded.before);
  assert(upgraded.stable && !upgraded.placeholderAfter, "upgraded to real room", upgraded.after);

  // UI: メッセージ → chat-detail
  await page.evaluate((pid) => window.TasuBuilderProjectCalendar.selectProject(pid), created.id);
  await page.waitForTimeout(200);
  await page.locator('[data-builder-pc-action="message"]').click();
  await page.waitForFunction(
    () => /chat-detail/.test(location.pathname) && new URLSearchParams(location.search).get("from") === "builder_calendar",
    { timeout: 20000 },
  );
  const talkUrl = page.url();
  const roomInUrl = await page.evaluate(() => {
    const sp = new URLSearchParams(location.search);
    return sp.get("thread") || sp.get("roomId") || "";
  });
  assert(/chat-detail/.test(talkUrl), "navigated to chat-detail");
  assert(roomInUrl === created.roomId, "URL uses saved room id", roomInUrl);

  // 戻り → 同じ room
  await page.locator("a[data-builder-cal-return]").first().click();
  await page.waitForFunction(
    () => /project-calendar/.test(location.pathname),
    { timeout: 20000 },
  );
  await page.waitForTimeout(400);
  const afterReturn = await page.evaluate((pid) => {
    const p = window.TasuBuilderProjectStore.getProject(pid);
    return p?.talkRoomId || "";
  }, created.id);
  assert(afterReturn === created.roomId, "room id stable after return");

  // ページ更新後も同じ room
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-builder-pc-calendar-body]", { timeout: 15000 });
  await page.waitForTimeout(800);
  const afterReload = await page.evaluate(async (pid) => {
    await window.TasuBuilderProjectStore.hydrateFromSupabase?.();
    const p = window.TasuBuilderProjectStore.getProject(pid);
    const res = await window.TasuBuilderProjectTalkRoom.ensureTalkRoomForProject(pid);
    return { saved: p?.talkRoomId || "", ensured: res.roomId };
  }, created.id);
  assert(afterReload.ensured === created.roomId, "same room after reload", JSON.stringify(afterReload));

  await page.screenshot({ path: path.join(OUT, "001-cal-main-01-1280.png"), fullPage: true });
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
