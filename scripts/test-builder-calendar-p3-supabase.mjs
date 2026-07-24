#!/usr/bin/env node
/**
 * Builder Calendar P3 — Supabase read adapter + Demo fallback
 *
 *   node scripts/test-builder-calendar-p3-supabase.mjs
 *
 * Requires: npm run dev (http://127.0.0.1:8788) for Playwright section
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { chromium } from "./lib/playwright-browser.mjs";
import { buildLocalPageUrl, STANDARD_LOCAL_BASE } from "./lib/dev-server-url.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(root, "reports", "builder-calendar-p3-supabase");
const CAL_PATH = "builder/project-calendar.html";
const CAL_URL = buildLocalPageUrl(STANDARD_LOCAL_BASE, CAL_PATH);
const IGNORE = [/favicon/i, /Failed to load resource/i, /net::ERR_/i, /CDN|fonts\.g|placehold/i, /\[TasuSupabase\]/i];

let pass = 0;
let fail = 0;
const report = {
  baseUrl: STANDARD_LOCAL_BASE,
  url: CAL_URL,
  timestamp: new Date().toISOString(),
  checks: [],
};

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

function loadAdapter() {
  const sandbox = { console };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(
    fs.readFileSync(path.join(root, "builder", "builder-project-calendar-supabase.js"), "utf8"),
    sandbox,
    { filename: "builder-project-calendar-supabase.js" },
  );
  return sandbox.TasuBuilderProjectCalendarData;
}

function runMapperUnitTests() {
  console.log("--- Mapper unit ---\n");
  const Data = loadAdapter();
  assert(Boolean(Data?.mapRowToProject), "adapter exports mapRowToProject");
  assert(Array.isArray(Data.TABLE_CANDIDATES) && Data.TABLE_CANDIDATES.includes("builder_projects"), "table candidates");

  // === Test 1: DDL snake_case column names (uuid id, full columns) ===
  {
    const mapped = Data.mapRowToProject({
      id: "a0000000-0000-0000-0000-000000000001",
      title: "Supabase 案件 A（DDL準拠）",
      customer_name: "顧客A",
      customer_contact: "03-1234-5678",
      assigned_vendor: "テスト建設",
      status: "in_progress",
      schedule_start: "2026-07-01",
      schedule_end: "2026-07-10",
      work_start_time: "08:00",
      work_end_time: "17:00",
      site_address: "東京都千代田区1-1",
      manager_name: "担当 太郎",
      manager_phone: "03-1111-2222",
      memo: "メモ内容",
      talk_room_id: "room-ddl-001",
      talk_thread_id: "thread-ddl-001",
      schedule_phase: "construction",
      category: "exterior",
      completion_report: {
        completionStatus: "completed",
        completion_memo: "完了しました",
        startedAt: "2026-06-01",
        completedAt: "2026-07-01",
      },
      attachments: [
        { id: "a1", title: "図面", type: "drawing", filename: "plan.pdf" },
      ],
      site_photos: [
        { id: "p1", label: "着工前", at: "2026-06-30" },
        { id: "p2", label: "完了後", at: "2026-07-01" },
      ],
      created_at: "2026-06-15T00:00:00.000Z",
      updated_at: "2026-07-04T00:00:00.000Z",
    });

    assert(mapped?.id === "a0000000-0000-0000-0000-000000000001", "ddl mapper uuid id", mapped?.id);
    assert(mapped?.name === "Supabase 案件 A（DDL準拠）", "ddl mapper name");
    assert(mapped?.customerName === "顧客A", "ddl mapper customerName");
    // customerContact は mapper 内で managerPhone と同値になる（設計）
    assert(mapped?.customerContact === mapped?.managerPhone, "ddl mapper customerContact eq managerPhone");
    assert(mapped?.customerContact === "03-1111-2222", "ddl mapper customerContact value");
    assert(mapped?.assignedVendor === "テスト建設", "ddl mapper assignedVendor");
    assert(mapped?.status === "in_progress", "ddl mapper status");
    assert(mapped?.scheduleStartDate === "2026-07-01", "ddl mapper scheduleStart");
    assert(mapped?.scheduleEndDate === "2026-07-10", "ddl mapper scheduleEnd");
    assert(mapped?.workStartTime === "08:00", "ddl mapper workStart");
    assert(mapped?.workEndTime === "17:00", "ddl mapper workEnd");
    assert(mapped?.siteAddress === "東京都千代田区1-1", "ddl mapper siteAddress");
    assert(mapped?.managerName === "担当 太郎", "ddl mapper managerName");
    assert(mapped?.managerPhone === "03-1111-2222", "ddl mapper managerPhone");
    assert(mapped?.memo === "メモ内容", "ddl mapper memo");
    assert(mapped?.talkRoomId === "room-ddl-001", "ddl mapper talkRoomId");
    assert(mapped?.talkThreadId === "room-ddl-001", "ddl mapper talkThreadId fallback");
    assert(mapped?.schedulePhase === "construction", "ddl mapper schedulePhase");
    assert(mapped?.category === "exterior", "ddl mapper category");
    assert(mapped?.source === "supabase", "ddl mapper source=supabase");
    assert(Array.isArray(mapped?.documents), "ddl mapper documents array");
    assert(mapped?.documents.length === 1, "ddl mapper documents count");
    assert(mapped?.documents[0]?.title === "図面", "ddl mapper doc title");
    assert(mapped?.documents[0]?.type === "drawing", "ddl mapper doc type");
    assert(Array.isArray(mapped?.sitePhotos), "ddl mapper sitePhotos array");
    assert(mapped?.sitePhotos.length === 2, "ddl mapper sitePhotos count");
    assert(mapped?.sitePhotos[0]?.label === "着工前", "ddl mapper sitePhoto label");
    assert(mapped?.completion?.completionStatus === "completed", "ddl mapper completion status");
    assert(mapped?.completion?.completionMemo === "完了しました", "ddl mapper completion memo");
    // normalizer を通した後の output — date picker
    assert(typeof mapped?.completion?.startedAt === "string", "ddl mapper completion startedAt");
    assert(typeof mapped?.completion?.completedAt === "string", "ddl mapper completion completedAt");
    assert(mapped?.createdAt?.includes("2026-06-15"), "ddl mapper createdAt", mapped?.createdAt);
    assert(mapped?.updatedAt?.includes("2026-07-04"), "ddl mapper updatedAt", mapped?.updatedAt);
  }

  // === Test 2: camelCase variant (P3 互換) ===
  {
    const mapped2 = Data.mapRowToProject({
      projectId: "SB-001",
      projectName: "Supabase 案件 B",
      companyName: "テスト建設",
      customerName: "顧客B",
      status: "in_progress",
      scheduleStartDate: "2026-07-01",
      scheduleEndDate: "2026-07-10",
      address: "東京都千代田区1-1",
      contactName: "担当 太郎",
      contactPhone: "03-1111-2222",
      memo: "メモ",
      talkRoomId: "builder-cal-SB-001",
      documents: [{ id: "a1", title: "図面", type: "drawing" }],
      sitePhotos: [{ id: "p1", label: "着工前" }],
      completionReport: { status: "working", note: "進行中" },
      updatedAt: "2026-07-04T00:00:00.000Z",
    });
    assert(mapped2?.id === "SB-001", "cc mapper id", mapped2?.id);
    assert(mapped2?.name === "Supabase 案件 B", "cc mapper name");
    assert(mapped2?.customerName === "顧客B", "cc mapper customerName");
    assert(mapped2?.scheduleStartDate === "2026-07-01", "cc mapper scheduleStart");
    assert(mapped2?.scheduleEndDate === "2026-07-10", "cc mapper scheduleEnd");
    assert(mapped2?.talkRoomId === "builder-cal-SB-001", "cc mapper talkRoomId");
    assert(mapped2?.documents?.length === 1, "cc mapper attachments");
    assert(mapped2?.sitePhotos?.length === 1, "cc mapper sitePhotos");
    assert(mapped2?.completion?.completionStatus === "working", "cc mapper completion");
  }

  // === Test 3: Empty / null / edge rows ===
  assert(Data.mapRowToProject({}) === null, "mapper rejects empty row");
  assert(Data.mapRowToProject(null) === null, "mapper rejects null");
  assert(Data.mapRowToProject(undefined) === null, "mapper rejects undefined");
  assert(Data.mapRowToProject([]) === null, "mapper rejects array");
  assert(Data.mapRowToProject(0) === null, "mapper rejects number");

  // minimal row with only id + title
  const min = Data.mapRowToProject({ id: "min-1", title: "最小データ" });
  assert(min?.id === "min-1", "mapper minimal id");
  assert(min?.name === "最小データ", "mapper minimal name");
  assert(min?.status === "inquiry", "mapper minimal default status");
  assert(Array.isArray(min?.documents), "mapper minimal documents empty array");
  assert(min?.documents.length === 0, "mapper minimal documents count 0");
  assert(Array.isArray(min?.sitePhotos), "mapper minimal sitePhotos empty array");
  assert(min?.sitePhotos.length === 0, "mapper minimal sitePhotos count 0");

  // === Test 4: JSON array fields as JSON string (Supabase jsonb 互換) ===
  const jsonStr = Data.mapRowToProject({
    id: "json-str-1",
    title: "JSON文字列添付",
    attachments: '[{"id":"a1","title":"図面","type":"drawing"}]',
    site_photos: '[{"id":"p1","label":"施工前"}]',
    completion_report: '{"status":"completed","note":"文字列JSON"}',
  });
  assert(Array.isArray(jsonStr?.documents), "jsonStr mapper documents");
  assert(jsonStr?.documents[0]?.type === "drawing", "jsonStr doc type");
  assert(Array.isArray(jsonStr?.sitePhotos), "jsonStr mapper sitePhotos");
  assert(jsonStr?.sitePhotos[0]?.label === "施工前", "jsonStr sitePhoto label");
  assert(jsonStr?.completion?.completionStatus === "completed", "jsonStr completion");
  assert(jsonStr?.completion?.completionMemo === "文字列JSON", "jsonStr completion memo");

  // unconfigured fetch
  return Data.fetchProjectsFromSupabase().then((res) => {
    assert(res.ok === false, "fetch unconfigured ok=false");
    assert(res.source === "unconfigured", "fetch unconfigured source", res.source);
  });
}

async function openCal(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = String(msg.text());
    if (IGNORE.some((re) => re.test(text))) return;
    errors.push(text);
  });
  page.on("pageerror", (err) => {
    const text = String(err.message || err);
    if (IGNORE.some((re) => re.test(text))) return;
    errors.push(text);
  });
  const res = await page.goto(CAL_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("[data-builder-pc-calendar-body]", { timeout: 15000 });
  await page.waitForFunction(
    () => window.TasuBuilderProjectStore?.getDataSourceMode?.() && window.TasuBuilderProjectCalendar?.getSelectedDate?.(),
    { timeout: 15000 },
  );
  await page.evaluate(async () => {
    window.TasuBuilderProjectStore.clearForTests();
    window.TasuBuilderProjectStore.ensureSeed();
    await window.TasuBuilderProjectStore.hydrateFromSupabase();
    window.TasuBuilderProjectCalendar.refresh();
  });
  await page.waitForTimeout(400);
  return { context, page, errors, status: res?.status() ?? 0 };
}

async function overflowX(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    return Math.max(doc.scrollWidth - doc.clientWidth, body.scrollWidth - body.clientWidth, 0);
  });
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
}

async function runPlaywright() {
  console.log("\n--- Playwright ---\n");
  const probe = await fetch(CAL_URL).catch(() => null);
  assert(probe?.ok, "HTTP 200", `status=${probe?.status ?? "unreachable"}`);
  if (!probe?.ok) {
    console.error("Start `npm run dev` and re-run Playwright section.");
    return;
  }

  const browser = await chromium.launch({ headless: true });
  const { context, page, errors, status } = await openCal(browser);
  assert(status === 200, "PC HTTP", String(status));
  assert((await overflowX(page)) === 0, "PC overflow-x 0");
  assert(errors.length === 0, "PC Console Error 0", errors.slice(0, 3).join(" | "));

  const mode = await page.evaluate(() => ({
    mode: window.TasuBuilderProjectStore.getDataSourceMode(),
    count: window.TasuBuilderProjectStore.listProjects().length,
    scheduled: window.TasuBuilderProjectStore.listScheduledProjects().length,
    hasAdapter: Boolean(window.TasuBuilderProjectCalendarData?.mapRowToProject),
    err: window.TasuBuilderProjectStore.getLastHydrateError?.() || "",
  }));
  assert(mode.hasAdapter, "adapter loaded in page");
  assert(["demo", "demo_fallback", "supabase"].includes(mode.mode), "data source mode", mode.mode);
  // テーブル未作成環境では demo / demo_fallback
  if (mode.mode !== "supabase") {
    assert(mode.count >= 3, "demo fallback project count", String(mode.count));
    assert(mode.scheduled >= 1, "demo fallback scheduled", String(mode.scheduled));
  } else {
    assert(mode.count >= 1, "supabase project count", String(mode.count));
  }

  // force adapter failure → still demo
  const forced = await page.evaluate(async () => {
    const Data = window.TasuBuilderProjectCalendarData;
    const prev = Data.fetchProjectsFromSupabase;
    Data.fetchProjectsFromSupabase = async () => ({
      ok: false,
      source: "fetch_failed",
      error: "forced_test_error",
      projects: [],
    });
    const res = await window.TasuBuilderProjectStore.hydrateFromSupabase();
    Data.fetchProjectsFromSupabase = prev;
    window.TasuBuilderProjectCalendar.refresh();
    return {
      source: res.source,
      mode: window.TasuBuilderProjectStore.getDataSourceMode(),
      count: window.TasuBuilderProjectStore.listProjects().length,
      title: document.querySelector(".builder-pc-detail__title, [data-builder-pc-detail-summary]") ? true : false,
    };
  });
  assert(forced.source === "demo_fallback", "forced failure → demo_fallback", forced.source);
  assert(forced.mode === "demo_fallback", "mode demo_fallback");
  assert(forced.count >= 3, "forced failure keeps demo projects", String(forced.count));

  // calendar still interactive
  await page.evaluate(() => {
    const p = window.TasuBuilderProjectStore.listScheduledProjects()[0];
    if (p) window.TasuBuilderProjectCalendar.selectProject(p.id);
  });
  await page.waitForTimeout(200);
  const detail = await page.evaluate(() => ({
    project: window.TasuBuilderProjectCalendar.getSelectedProject(),
    title: document.querySelector(".builder-pc-detail__title")?.textContent?.trim() || "",
    actions: document.querySelectorAll("[data-builder-pc-action]").length,
  }));
  assert(Boolean(detail.project), "detail select works");
  assert(Boolean(detail.title), "detail title", detail.title);
  assert(detail.actions >= 7, "detail actions", String(detail.actions));

  // completion draft still local
  await page.locator('[data-builder-pc-action="completion"]').click();
  await page.waitForTimeout(150);
  await page.fill("[data-builder-pc-completion-memo]", "P3 fallback completion");
  await page.locator("[data-builder-pc-completion-submit]").click();
  await page.waitForTimeout(150);
  const saved = await page.evaluate(() => {
    const msg = document.querySelector("[data-builder-pc-completion-msg]");
    return msg && !msg.hidden;
  });
  assert(saved, "completion demo save on fallback");

  await shot(page, "001-pc-demo-fallback-1280");
  assert(errors.length === 0, "PC Console Error 0 (end)", errors.slice(0, 3).join(" | "));
  await context.close();
  await browser.close();
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  console.log(`=== Builder Calendar P3 Supabase @ ${STANDARD_LOCAL_BASE} ===\n`);
  await runMapperUnitTests();
  await runPlaywright();
  report.pass = pass;
  report.fail = fail;
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  console.log(`\n=== ${fail === 0 ? "ALL PASS" : "FAILED"} · pass=${pass} fail=${fail} ===`);
  console.log(`Report: ${path.join(OUT, "report.json")}`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
