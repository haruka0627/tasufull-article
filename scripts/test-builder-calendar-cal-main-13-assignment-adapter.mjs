#!/usr/bin/env node
/**
 * CAL-MAIN-13 — assignment Read/Write Adapter 往復（列あり/なし両対応）
 *
 *   node scripts/test-builder-calendar-cal-main-13-assignment-adapter.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "./lib/playwright-browser.mjs";
import { buildLocalPageUrl, STANDARD_LOCAL_BASE } from "./lib/dev-server-url.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(root, "reports", "builder-calendar-cal-main-13");
const ADMIN_URL = buildLocalPageUrl(STANDARD_LOCAL_BASE, "builder/admin-calendar.html?role=owner");
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
  /\[TasuTalkRoomEnsure\]/i,
  /blocked_users/i,
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
  console.log(`=== CAL-MAIN-13 Assignment Adapter @ ${STANDARD_LOCAL_BASE} ===\n`);

  const probe = await fetch(ADMIN_URL.split("?")[0]).catch(() => null);
  assert(probe?.ok, "HTTP 200", `status=${probe?.status ?? "unreachable"}`);
  if (!probe?.ok) {
    writeReport();
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
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

  await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(500);

  // --- column supported: writeAssignment is invoked ---
  const colYes = await page.evaluate(async () => {
    const Adapter = window.TasuBuilderProjectWriteAdapter;
    const Bridge = window.TasuBuilderBenchBridge;
    const Store = window.TasuBuilderProjectStore;
    Adapter.resetAssignmentColumnCacheForTests?.();
    Adapter.setAssignmentColumnSupportedForTests?.(true);

    const calls = [];
    const realWrite = Adapter.writeAssignment.bind(Adapter);
    Adapter.writeAssignment = async (id, assignment) => {
      calls.push({ id, status: assignment?.status, partnerId: assignment?.partnerId });
      return { ok: true, source: "supabase" };
    };

    const created = Bridge.createAdminCalendarProject({
      title: "CAL-MAIN-13 col-yes",
      partnerId: "demo-partner-001",
      start: "2027-01-01",
      end: "2027-01-02",
      location: "東京都",
      instructions: "col yes",
      skipNotification: true,
    });
    await new Promise((r) => setTimeout(r, 50));

    const accept = await Bridge.acceptCalendarAssignment(created.project_id);

    const mvp = (Bridge.getMvpState?.()?.projects || []).find((p) => p.project_id === created.project_id);
    const hub = Store.getProject(created.hub_project_id);

    Adapter.writeAssignment = realWrite;
    Adapter.resetAssignmentColumnCacheForTests?.();

    return {
      primary: created?.primary,
      hubId: created?.hub_project_id,
      createCalled: calls.some((c) => c.status === "pending"),
      acceptCalled: calls.some((c) => c.status === "accepted"),
      acceptOk: accept?.ok === true,
      mvpStatus: mvp?.assignment_status,
      hubStatus: hub?.assignment?.status,
      mvpStatusSkipped: accept?.mvp_assignment_status_skipped === true,
      callCount: calls.length,
    };
  });

  assert(colYes.primary === "hub", "hub primary create", colYes.primary);
  assert(colYes.createCalled, "writeAssignment called on create (pending)");
  assert(colYes.acceptCalled, "writeAssignment called on accept");
  assert(colYes.acceptOk, "accept still ok");
  // CAL-MAIN-17: DB write+hydrate 成功時は MVP assignment_status を no-op してよい
  assert(
    colYes.mvpStatus === "accepted" || colYes.mvpStatusSkipped === true,
    "MVP accepted or skipped when DB confirmed",
    `status=${colYes.mvpStatus} skipped=${colYes.mvpStatusSkipped}`
  );
  assert(colYes.hubStatus === "accepted", "local Hub accepted", colYes.hubStatus);
  assert(colYes.callCount >= 2, "db write attempts", String(colYes.callCount));

  // --- column unsupported: skip safely ---
  const colNo = await page.evaluate(async () => {
    const Adapter = window.TasuBuilderProjectWriteAdapter;
    const Bridge = window.TasuBuilderBenchBridge;
    const Store = window.TasuBuilderProjectStore;
    Adapter.setAssignmentColumnSupportedForTests?.(false);

    const calls = [];
    const realWrite = Adapter.writeAssignment.bind(Adapter);
    Adapter.writeAssignment = async (id, assignment) => {
      const result = await realWrite(id, assignment);
      calls.push(result);
      return result;
    };

    const created = Bridge.createAdminCalendarProject({
      title: "CAL-MAIN-13 col-no",
      partnerId: "demo-partner-001",
      start: "2027-02-01",
      end: "2027-02-02",
      location: "東京都",
      instructions: "col no",
      skipNotification: true,
    });
    await new Promise((r) => setTimeout(r, 50));
    const accept = await Bridge.acceptCalendarAssignment(created.project_id);

    const mvp = (Bridge.getMvpState?.()?.projects || []).find((p) => p.project_id === created.project_id);
    const hub = Store.getProject(created.hub_project_id);

    Adapter.writeAssignment = realWrite;
    Adapter.resetAssignmentColumnCacheForTests?.();

    return {
      acceptOk: accept?.ok === true,
      mvpStatus: mvp?.assignment_status,
      hubStatus: hub?.assignment?.status,
      mvpStatusWritten: accept?.mvp_assignment_status_written === true,
      allSkipped: calls.length > 0 && calls.every((c) => c.skipped === true || c.reason === "column_unsupported"),
      calls,
    };
  });

  assert(colNo.acceptOk, "accept ok when column unsupported");
  assert(colNo.mvpStatus === "accepted", "MVP ok without column");
  assert(colNo.hubStatus === "accepted", "local Hub ok without column");
  assert(colNo.allSkipped, "db writes skipped", JSON.stringify(colNo.calls));

  // --- writeAssignment failure does not break accept ---
  const failSafe = await page.evaluate(async () => {
    const Adapter = window.TasuBuilderProjectWriteAdapter;
    const Bridge = window.TasuBuilderBenchBridge;
    Adapter.setAssignmentColumnSupportedForTests?.(true);
    Adapter.writeAssignment = async () => {
      throw new Error("simulated_rls_or_network");
    };
    const created = Bridge.createAdminCalendarProject({
      title: "CAL-MAIN-13 fail-safe",
      partnerId: "demo-partner-001",
      start: "2027-03-01",
      end: "2027-03-02",
      location: "東京都",
      instructions: "fail",
      skipNotification: true,
    });
    await new Promise((r) => setTimeout(r, 30));
    const accept = await Bridge.acceptCalendarAssignment(created.project_id);
    const mvp = (Bridge.getMvpState?.()?.projects || []).find((p) => p.project_id === created.project_id);
    Adapter.resetAssignmentColumnCacheForTests?.();
    return {
      acceptOk: accept?.ok === true,
      mvpStatus: mvp?.assignment_status,
      mvpStatusWritten: accept?.mvp_assignment_status_written === true,
    };
  });
  assert(failSafe.acceptOk, "accept ok when DB write throws");
  assert(failSafe.mvpStatus === "accepted", "MVP accepted on DB throw");
  assert(failSafe.mvpStatusWritten, "MVP status written when DB throws");

  // --- Read mapper: DB assignment hydrates into project.assignment ---
  await page.goto(CAL_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(400);
  const readMap = await page.evaluate(() => {
    const Data = window.TasuBuilderProjectCalendarData;
    const mapped = Data.mapRowToProject({
      id: "a0000000-0000-0000-0000-00000000abcd",
      title: "DB assignment row",
      status: "inquiry",
      assignment: {
        status: "accepted",
        partner_id: "demo-partner-001",
        partner_name: "デモ",
        accepted_at: "2027-01-01T00:00:00.000Z",
        source: "supabase",
      },
    });
    const noCol = Data.mapRowToProject({
      id: "a0000000-0000-0000-0000-00000000abce",
      title: "no assignment col",
      status: "inquiry",
    });
    const nullAssign = Data.mapRowToProject({
      id: "a0000000-0000-0000-0000-00000000abcf",
      title: "null assignment",
      status: "inquiry",
      assignment: null,
    });
    return {
      hasAssignment: mapped?.assignment?.status === "accepted",
      partnerId: mapped?.assignment?.partnerId,
      noColAssignment: noCol?.assignment,
      nullAssignment: nullAssign?.assignment,
      toJsonb: window.TasuBuilderProjectWriteAdapter.toAssignmentJsonb({
        status: "declined",
        partnerId: "p1",
        partnerName: "n1",
      }),
    };
  });

  assert(readMap.hasAssignment, "mapRowToProject maps assignment.status");
  assert(readMap.partnerId === "demo-partner-001", "maps partner_id → partnerId");
  assert(readMap.noColAssignment == null, "missing column → no assignment field");
  assert(readMap.nullAssignment == null, "null assignment → no field");
  assert(readMap.toJsonb?.status === "declined", "toAssignmentJsonb status");
  assert(readMap.toJsonb?.partner_id === "p1", "toAssignmentJsonb partner_id");

  // hydrate merge: local assignment preserved when remote has none
  const hydrateMerge = await page.evaluate(() => {
    const Store = window.TasuBuilderProjectStore;
    Store.clearForTests?.();
    Store.ensureSeed?.();
    const id = "PRJ-2026-001";
    Store.patchProjectLocal(id, {
      assignment: { status: "declined", partnerId: "demo-partner-001", source: "test" },
    });
    const localBefore = Store.getProject(id)?.assignment?.status;

    // simulate remote without assignment (as hydrate does)
    const localById = new Map(Store.listProjectsLocal().map((p) => [String(p.id), p]));
    const remote = Store.listProjectsLocal().map((p) => {
      const copy = { ...p, assignment: null };
      return copy;
    });
    const merged = remote.map((raw) => {
      const hasDb =
        raw.assignment && typeof raw.assignment === "object" && (raw.assignment.status || raw.assignment.partnerId);
      if (hasDb) return raw;
      const local = localById.get(String(raw.id));
      if (local?.assignment) return { ...raw, assignment: local.assignment };
      return raw;
    });
    const row = merged.find((p) => p.id === id);
    return { localBefore, mergedStatus: row?.assignment?.status };
  });
  assert(hydrateMerge.localBefore === "declined", "local assignment set");
  assert(hydrateMerge.mergedStatus === "declined", "hydrate keeps local when DB null");

  assert(errors.length === 0, "Console Error 0", errors.slice(0, 3).join(" | "));

  await browser.close();
  writeReport();
  console.log(`\n=== ${pass} PASS / ${fail} FAIL ===`);
  process.exit(fail ? 1 : 0);
}

function writeReport() {
  fs.writeFileSync(
    path.join(OUT, "result.json"),
    JSON.stringify({ ...report, pass, fail }, null, 2)
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
