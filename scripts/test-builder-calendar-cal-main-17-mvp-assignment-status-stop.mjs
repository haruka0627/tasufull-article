#!/usr/bin/env node
/**
 * CAL-MAIN-17 — Hub DB write 成功時のみ MVP assignment_status write を no-op
 *
 *   node scripts/test-builder-calendar-cal-main-17-mvp-assignment-status-stop.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "./lib/playwright-browser.mjs";
import { buildLocalPageUrl, STANDARD_LOCAL_BASE } from "./lib/dev-server-url.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(root, "reports", "builder-calendar-cal-main-17");
const ADMIN_URL = buildLocalPageUrl(STANDARD_LOCAL_BASE, "builder/admin-calendar.html?role=owner");

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
  console.log(`=== CAL-MAIN-17 MVP assignment_status stop @ ${STANDARD_LOCAL_BASE} ===\n`);

  const probe = await fetch(ADMIN_URL.split("?")[0]).catch(() => null);
  assert(probe?.ok, "HTTP 200 admin-calendar", `status=${probe?.status ?? "unreachable"}`);
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
  await page.waitForTimeout(600);

  // Flag default on
  const flagOn = await page.evaluate(() => window.TASU_BUILDER_STOP_MVP_ASSIGNMENT_WRITE_WHEN_DB_OK);
  assert(flagOn === true, "flag default true");

  // DB ok + hydrate confirm → MVP assignment_status no-op (accept)
  const dbOkSkip = await page.evaluate(async () => {
    const Bridge = window.TasuBuilderBenchBridge;
    const Adapter = window.TasuBuilderProjectWriteAdapter;
    const Hub = window.TasuBuilderPartnerAssignmentHubAdapter;
    const Store = window.TasuBuilderProjectStore;
    const created = Bridge.createAdminCalendarProject({
      title: "CAL-MAIN-17 db-ok accept",
      partnerId: "demo-partner-001",
      start: "2027-08-01",
      end: "2027-08-02",
      location: "東京都",
      instructions: "db ok",
      skipNotification: true,
    });
    const legacyId = created.project_id;
    const hubId = created.hub_project_id;
    const beforeStatus =
      (Bridge.getMvpState?.()?.projects || []).find((p) => p.project_id === legacyId)
        ?.assignment_status || "pending";

    const realWrite = Adapter.writeAssignment.bind(Adapter);
    const realHydrate = Store.hydrateFromSupabase?.bind(Store);
    Adapter.writeAssignment = async (_id, assignment) => ({
      ok: true,
      source: "supabase",
      assignment: { status: assignment.status, partner_id: assignment.partnerId },
    });
    Store.hydrateFromSupabase = async () => ({
      ok: true,
      source: "supabase",
      projects: Store.listProjectsLocal?.() || [],
    });

    const res = await Bridge.acceptCalendarAssignment(legacyId);
    const mvp = (Bridge.getMvpState?.()?.projects || []).find((p) => p.project_id === legacyId);
    const hub = Store.getProject(hubId);

    Adapter.writeAssignment = realWrite;
    if (realHydrate) Store.hydrateFromSupabase = realHydrate;

    return {
      acceptOk: res?.ok === true,
      skipped: res?.mvp_assignment_status_skipped === true,
      written: res?.mvp_assignment_status_written === true,
      mvpStatus: mvp?.assignment_status || "",
      beforeStatus,
      hubStatus: hub?.assignment?.status || "",
      threadId: res?.threadId || "",
      shouldSkip: Hub.shouldSkipMvpAssignmentStatusWrite?.({
        ok: true,
        dbConfirmed: true,
      }),
    };
  });

  assert(dbOkSkip.acceptOk, "accept ok when DB confirmed");
  assert(dbOkSkip.shouldSkip === true, "shouldSkip helper true");
  assert(dbOkSkip.skipped === true, "mvp status skipped");
  assert(dbOkSkip.written === false, "mvp status not written");
  assert(
    dbOkSkip.mvpStatus === dbOkSkip.beforeStatus,
    "MVP assignment_status unchanged",
    `${dbOkSkip.beforeStatus}→${dbOkSkip.mvpStatus}`
  );
  assert(dbOkSkip.hubStatus === "accepted", "Hub local accepted", dbOkSkip.hubStatus);
  assert(Boolean(dbOkSkip.threadId), "thread still created");

  // DB fail → MVP assignment_status written (fallback)
  const dbFailWrite = await page.evaluate(async () => {
    const Bridge = window.TasuBuilderBenchBridge;
    const Adapter = window.TasuBuilderProjectWriteAdapter;
    const Store = window.TasuBuilderProjectStore;
    const created = Bridge.createAdminCalendarProject({
      title: "CAL-MAIN-17 db-fail accept",
      partnerId: "demo-partner-001",
      start: "2027-08-05",
      end: "2027-08-06",
      location: "東京都",
      instructions: "db fail",
      skipNotification: true,
    });
    Adapter.writeAssignment = async () => ({
      ok: false,
      source: "supabase",
      reason: "no_row_updated",
      skipped: false,
    });
    const res = await Bridge.acceptCalendarAssignment(created.project_id);
    const mvp = (Bridge.getMvpState?.()?.projects || []).find(
      (p) => p.project_id === created.project_id
    );
    const hub = Store.getProject(created.hub_project_id);
    Adapter.resetAssignmentColumnCacheForTests?.();
    return {
      acceptOk: res?.ok === true,
      skipped: res?.mvp_assignment_status_skipped === true,
      written: res?.mvp_assignment_status_written === true,
      mvpStatus: mvp?.assignment_status || "",
      hubStatus: hub?.assignment?.status || "",
    };
  });

  assert(dbFailWrite.acceptOk, "accept ok when DB fails");
  assert(dbFailWrite.written === true, "MVP status written on DB fail");
  assert(dbFailWrite.skipped === false, "not skipped on DB fail");
  assert(dbFailWrite.mvpStatus === "accepted", "MVP accepted fallback", dbFailWrite.mvpStatus);
  assert(dbFailWrite.hubStatus === "accepted", "Hub local still accepted");

  // Decline: DB ok → MVP no-op
  const declineSkip = await page.evaluate(async () => {
    const Bridge = window.TasuBuilderBenchBridge;
    const Adapter = window.TasuBuilderProjectWriteAdapter;
    const Store = window.TasuBuilderProjectStore;
    const created = Bridge.createAdminCalendarProject({
      title: "CAL-MAIN-17 db-ok decline",
      partnerId: "demo-partner-001",
      start: "2027-08-10",
      end: "2027-08-11",
      location: "東京都",
      instructions: "decline ok",
      skipNotification: true,
    });
    const legacyId = created.project_id;
    const beforeStatus =
      (Bridge.getMvpState?.()?.projects || []).find((p) => p.project_id === legacyId)
        ?.assignment_status || "pending";
    const realWrite = Adapter.writeAssignment.bind(Adapter);
    const realHydrate = Store.hydrateFromSupabase?.bind(Store);
    Adapter.writeAssignment = async (_id, assignment) => ({
      ok: true,
      source: "supabase",
      assignment: { status: assignment.status },
    });
    Store.hydrateFromSupabase = async () => ({
      ok: true,
      source: "supabase",
      projects: Store.listProjectsLocal?.() || [],
    });
    const res = await Bridge.declineCalendarAssignment(legacyId);
    const mvp = (Bridge.getMvpState?.()?.projects || []).find((p) => p.project_id === legacyId);
    const hub = Store.getProject(created.hub_project_id);
    Adapter.writeAssignment = realWrite;
    if (realHydrate) Store.hydrateFromSupabase = realHydrate;
    return {
      ok: res?.ok === true,
      skipped: res?.mvp_assignment_status_skipped === true,
      mvpStatus: mvp?.assignment_status || "",
      beforeStatus,
      hubStatus: hub?.assignment?.status || "",
    };
  });

  assert(declineSkip.ok, "decline ok when DB confirmed");
  assert(declineSkip.skipped === true, "decline MVP status skipped");
  assert(
    declineSkip.mvpStatus === declineSkip.beforeStatus,
    "decline MVP status unchanged",
    declineSkip.mvpStatus
  );
  assert(declineSkip.hubStatus === "declined", "Hub local declined");

  // Flag off → always write MVP even when DB ok
  const flagOff = await page.evaluate(async () => {
    const Bridge = window.TasuBuilderBenchBridge;
    const Adapter = window.TasuBuilderProjectWriteAdapter;
    const Store = window.TasuBuilderProjectStore;
    const prev = window.TASU_BUILDER_STOP_MVP_ASSIGNMENT_WRITE_WHEN_DB_OK;
    window.TASU_BUILDER_STOP_MVP_ASSIGNMENT_WRITE_WHEN_DB_OK = false;
    const created = Bridge.createAdminCalendarProject({
      title: "CAL-MAIN-17 flag-off",
      partnerId: "demo-partner-001",
      start: "2027-08-15",
      end: "2027-08-16",
      location: "東京都",
      instructions: "flag off",
      skipNotification: true,
    });
    const realWrite = Adapter.writeAssignment.bind(Adapter);
    const realHydrate = Store.hydrateFromSupabase?.bind(Store);
    Adapter.writeAssignment = async (_id, assignment) => ({
      ok: true,
      source: "supabase",
      assignment: { status: assignment.status },
    });
    Store.hydrateFromSupabase = async () => ({
      ok: true,
      source: "supabase",
      projects: Store.listProjectsLocal?.() || [],
    });
    const res = await Bridge.acceptCalendarAssignment(created.project_id);
    const mvp = (Bridge.getMvpState?.()?.projects || []).find(
      (p) => p.project_id === created.project_id
    );
    Adapter.writeAssignment = realWrite;
    if (realHydrate) Store.hydrateFromSupabase = realHydrate;
    window.TASU_BUILDER_STOP_MVP_ASSIGNMENT_WRITE_WHEN_DB_OK = prev;
    return {
      ok: res?.ok === true,
      skipped: res?.mvp_assignment_status_skipped === true,
      written: res?.mvp_assignment_status_written === true,
      mvpStatus: mvp?.assignment_status || "",
    };
  });

  assert(flagOff.ok, "accept ok with flag off");
  assert(flagOff.written === true, "MVP written when flag off");
  assert(flagOff.skipped === false, "not skipped when flag off");
  assert(flagOff.mvpStatus === "accepted", "MVP accepted when flag off");

  // hydrate not supabase → MVP fallback write
  const hydrateFail = await page.evaluate(async () => {
    const Bridge = window.TasuBuilderBenchBridge;
    const Adapter = window.TasuBuilderProjectWriteAdapter;
    const Store = window.TasuBuilderProjectStore;
    const created = Bridge.createAdminCalendarProject({
      title: "CAL-MAIN-17 hydrate-fail",
      partnerId: "demo-partner-001",
      start: "2027-08-20",
      end: "2027-08-21",
      location: "東京都",
      instructions: "hydrate fail",
      skipNotification: true,
    });
    const realWrite = Adapter.writeAssignment.bind(Adapter);
    const realHydrate = Store.hydrateFromSupabase?.bind(Store);
    Adapter.writeAssignment = async (_id, assignment) => ({
      ok: true,
      source: "supabase",
      assignment: { status: assignment.status },
    });
    Store.hydrateFromSupabase = async () => ({
      ok: true,
      source: "demo_fallback",
      projects: [],
    });
    const res = await Bridge.acceptCalendarAssignment(created.project_id);
    const mvp = (Bridge.getMvpState?.()?.projects || []).find(
      (p) => p.project_id === created.project_id
    );
    Adapter.writeAssignment = realWrite;
    if (realHydrate) Store.hydrateFromSupabase = realHydrate;
    return {
      ok: res?.ok === true,
      written: res?.mvp_assignment_status_written === true,
      mvpStatus: mvp?.assignment_status || "",
    };
  });

  assert(hydrateFail.ok, "accept ok when hydrate not supabase");
  assert(hydrateFail.written === true, "MVP written when hydrate not confirmed");
  assert(hydrateFail.mvpStatus === "accepted", "MVP accepted on hydrate fail");

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
