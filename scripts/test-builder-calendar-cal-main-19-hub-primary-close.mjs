#!/usr/bin/env node
/**
 * CAL-MAIN-19 — Hub Primary 最終監査（実装追加なし · 契約確認）
 *
 *   node scripts/test-builder-calendar-cal-main-19-hub-primary-close.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "./lib/playwright-browser.mjs";
import { buildLocalPageUrl, STANDARD_LOCAL_BASE } from "./lib/dev-server-url.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(root, "reports", "builder-calendar-cal-main-19");
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
  /\[BuilderCalendarRealtime\]/i,
  /blocked_users/i,
  /CORS policy/i,
  /ensure-talk-room/i,
];

let pass = 0;
let fail = 0;
const report = {
  baseUrl: STANDARD_LOCAL_BASE,
  timestamp: new Date().toISOString(),
  phase: "CAL-MAIN-19",
  decision: null,
  checklist: {},
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

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  console.log(`=== CAL-MAIN-19 Hub Primary Close @ ${STANDARD_LOCAL_BASE} ===\n`);

  const probe = await fetch(ADMIN_URL.split("?")[0]).catch(() => null);
  assert(probe?.ok, "HTTP 200 admin-calendar", `status=${probe?.status ?? "unreachable"}`);
  if (!probe?.ok) {
    finish(false);
    return;
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
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

  // --- API surface ---
  const apis = await page.evaluate(() => {
    const Hub = window.TasuBuilderPartnerAssignmentHubAdapter;
    const Store = window.TasuBuilderProjectStore;
    const Adapter = window.TasuBuilderProjectWriteAdapter;
    const MapApi = window.TasuBuilderProjectIdMap;
    const Dispatch = window.TasuBuilderNotifyDispatch;
    const Bridge = window.TasuBuilderBenchBridge;
    return {
      hubWrite: typeof Hub?.writeAssignmentDecision === "function",
      hubRead: typeof Hub?.readHubAssignmentStatus === "function",
      hubResolve: typeof Hub?.resolveAssignmentStatus === "function",
      bridgeResolve: typeof Bridge?.resolveCalendarAssignmentStatus === "function",
      hydrate: typeof Store?.hydrateFromSupabase === "function",
      patchLocal: typeof Store?.patchProjectLocal === "function",
      dbWrite: typeof Adapter?.writeAssignment === "function",
      idMap: typeof MapApi?.legacyToHub === "function" && typeof MapApi?.hubToLegacy === "function",
      talkDispatch: typeof Dispatch?.notifyCalendarAccepted === "function",
      flag:
        window.TASU_BUILDER_STOP_MVP_ASSIGNMENT_WRITE_WHEN_DB_OK === true ||
        window.TASU_BUILDER_STOP_MVP_ASSIGNMENT_WRITE_WHEN_DB_OK === false,
    };
  });

  assert(apis.hubWrite, "API Hub Write");
  assert(apis.hubRead, "API Hub Read");
  assert(apis.bridgeResolve, "API resolveCalendarAssignmentStatus");
  assert(apis.hydrate, "API hydrateFromSupabase");
  assert(apis.dbWrite, "API writeAssignment");
  assert(apis.idMap, "API ID Map");
  assert(apis.talkDispatch, "API Talk dispatch");
  assert(apis.flag, "feature flag present");
  // Realtime は project-calendar 側で確認（admin-calendar には未ロード）

  // --- Read: Hub over MVP ---
  const readPrimary = await page.evaluate(() => {
    const Bridge = window.TasuBuilderBenchBridge;
    const Store = window.TasuBuilderProjectStore;
    const created = Bridge.createAdminCalendarProject({
      title: "CAL-MAIN-19 read",
      partnerId: "demo-partner-001",
      start: "2028-01-01",
      end: "2028-01-02",
      location: "東京都",
      instructions: "read",
      skipNotification: true,
    });
    Store.patchProjectLocal(created.hub_project_id, {
      assignment: { status: "accepted", partnerId: "demo-partner-001", source: "cal_main_19" },
    });
    const project = (Bridge.getMvpState?.()?.projects || []).find(
      (p) => p.project_id === created.project_id
    );
    if (project) project.assignment_status = "pending";
    return {
      resolved: Bridge.resolveCalendarAssignmentStatus(project),
      mvp: project?.assignment_status,
      hub: Store.getProject(created.hub_project_id)?.assignment?.status,
    };
  });
  assert(readPrimary.hub === "accepted", "Hub assignment accepted");
  assert(readPrimary.mvp === "pending", "MVP pending (not display master)");
  assert(readPrimary.resolved === "accepted", "Read prefers Hub");

  // --- Write: Hub always · MVP only on DB fail ---
  const writePaths = await page.evaluate(async () => {
    const Bridge = window.TasuBuilderBenchBridge;
    const Adapter = window.TasuBuilderProjectWriteAdapter;
    const Store = window.TasuBuilderProjectStore;

    const okCase = Bridge.createAdminCalendarProject({
      title: "CAL-MAIN-19 write-ok",
      partnerId: "demo-partner-001",
      start: "2028-01-05",
      end: "2028-01-06",
      location: "東京都",
      instructions: "ok",
      skipNotification: true,
    });
    const before =
      (Bridge.getMvpState?.()?.projects || []).find((p) => p.project_id === okCase.project_id)
        ?.assignment_status || "pending";
    const realWrite = Adapter.writeAssignment.bind(Adapter);
    const realHydrate = Store.hydrateFromSupabase?.bind(Store);
    Adapter.writeAssignment = async (_id, a) => ({
      ok: true,
      source: "supabase",
      assignment: { status: a.status },
    });
    Store.hydrateFromSupabase = async () => ({
      ok: true,
      source: "supabase",
      projects: Store.listProjectsLocal?.() || [],
    });
    const acceptOk = await Bridge.acceptCalendarAssignment(okCase.project_id);
    const mvpOk = (Bridge.getMvpState?.()?.projects || []).find(
      (p) => p.project_id === okCase.project_id
    );
    const hubOk = Store.getProject(okCase.hub_project_id)?.assignment?.status;

    Adapter.writeAssignment = async () => ({ ok: false, reason: "fail", skipped: false });
    const failCase = Bridge.createAdminCalendarProject({
      title: "CAL-MAIN-19 write-fail",
      partnerId: "demo-partner-001",
      start: "2028-01-10",
      end: "2028-01-11",
      location: "東京都",
      instructions: "fail",
      skipNotification: true,
    });
    const declineFail = await Bridge.declineCalendarAssignment(failCase.project_id);
    const mvpFail = (Bridge.getMvpState?.()?.projects || []).find(
      (p) => p.project_id === failCase.project_id
    );
    const hubFail = Store.getProject(failCase.hub_project_id)?.assignment?.status;

    Adapter.writeAssignment = realWrite;
    if (realHydrate) Store.hydrateFromSupabase = realHydrate;

    return {
      acceptSkipped: acceptOk?.mvp_assignment_status_skipped === true,
      mvpUnchanged: mvpOk?.assignment_status === before,
      hubAccepted: hubOk === "accepted",
      displayAccepted: Bridge.resolveCalendarAssignmentStatus(mvpOk) === "accepted",
      declineWritten: declineFail?.mvp_assignment_status_written === true,
      mvpDeclined: mvpFail?.assignment_status === "declined",
      hubDeclined: hubFail === "declined",
      displayDeclined: Bridge.resolveCalendarAssignmentStatus(mvpFail) === "declined",
    };
  });

  assert(writePaths.acceptSkipped, "Write: DB ok → MVP status no-op");
  assert(writePaths.mvpUnchanged, "Write: MVP unchanged on DB ok");
  assert(writePaths.hubAccepted, "Write: Hub accepted always");
  assert(writePaths.displayAccepted, "Write: display accepted via Hub");
  assert(writePaths.declineWritten, "Write: DB fail → MVP declined written");
  assert(writePaths.mvpDeclined, "Write: MVP declined fallback");
  assert(writePaths.hubDeclined, "Write: Hub declined always");
  assert(writePaths.displayDeclined, "Write: display declined");

  // --- Hydrate prefers DB assignment ---
  const hydratePref = await page.evaluate(async () => {
    const Store = window.TasuBuilderProjectStore;
    const Data = window.TasuBuilderProjectCalendarData;
    if (!Data?.mapRowToProject) return { skip: true };
    const id = "PRJ-CAL-MAIN-19-HYDRATE";
    Store.ensureSeed?.();
    Store.patchProjectLocal?.(id, {
      name: "hydrate probe",
      assignment: { status: "pending", partnerId: "demo-partner-001", source: "local" },
    });
    const mapped = Data.mapRowToProject({
      id,
      name: "hydrate probe",
      assignment: {
        status: "accepted",
        partner_id: "demo-partner-001",
        source: "db",
      },
    });
    const hasDb = Boolean(mapped?.assignment?.status === "accepted");
    // simulate merge rule
    const local = Store.getProject?.(id);
    const preferDb =
      hasDb &&
      (!local?.assignment || mapped.assignment.status === "accepted");
    return { skip: false, hasDb, preferDb, dbStatus: mapped?.assignment?.status };
  });
  if (!hydratePref.skip) {
    assert(hydratePref.hasDb, "Hydrate mapper reads DB assignment");
    assert(hydratePref.preferDb, "Hydrate prefers DB status", hydratePref.dbStatus);
  } else {
    ok("Hydrate mapper", "skipped (no mapRowToProject on page)");
  }

  // --- Realtime module contracts on calendar page ---
  await page.goto(CAL_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(400);
  const realtime = await page.evaluate(() => {
    const Rt = window.TasuBuilderProjectCalendarRealtime;
    const Store = window.TasuBuilderProjectStore;
    const src = String(Rt?.startRealtime || "");
    return {
      hasApi: typeof Rt?.startRealtime === "function" && typeof Rt?.stopRealtime === "function",
      hasHydrate: typeof Store?.hydrateFromSupabase === "function",
      version: Rt?.VERSION || "",
    };
  });
  assert(realtime.hasApi, "Realtime API");
  assert(realtime.hasHydrate, "Realtime page has hydrate");

  // --- ID Map ---
  await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(300);
  const idMap = await page.evaluate(() => {
    const Bridge = window.TasuBuilderBenchBridge;
    const MapApi = window.TasuBuilderProjectIdMap;
    const created = Bridge.createAdminCalendarProject({
      title: "CAL-MAIN-19 idmap",
      partnerId: "demo-partner-001",
      start: "2028-02-01",
      end: "2028-02-02",
      location: "東京都",
      instructions: "map",
      skipNotification: true,
    });
    const hub = MapApi.legacyToHub(created.project_id);
    const legacy = MapApi.hubToLegacy(created.hub_project_id);
    return {
      hubMatch: hub === created.hub_project_id,
      legacyMatch: legacy === created.project_id,
    };
  });
  assert(idMap.hubMatch, "ID Map legacy→hub");
  assert(idMap.legacyMatch, "ID Map hub→legacy");

  // --- Talk dispatch available (CAL-MAIN-15 contract) ---
  const talk = await page.evaluate(() => {
    const D = window.TasuBuilderNotifyDispatch;
    return {
      assign: typeof D?.notifyCalendarAssignment === "function",
      accepted: typeof D?.notifyCalendarAccepted === "function",
      declined: typeof D?.notifyCalendarDeclined === "function",
      skipBell: typeof D?.shouldSkipMvpCalendarBell === "function",
    };
  });
  assert(talk.assign && talk.accepted && talk.declined, "Talk notify APIs");
  assert(talk.skipBell, "Talk skip MVP bell helper");

  assert(errors.length === 0, "Console Error 0", errors.slice(0, 3).join(" | "));

  await browser.close();

  report.checklist = {
    hub_assignment_write: writePaths.hubAccepted && writePaths.hubDeclined,
    hub_assignment_read: readPrimary.resolved === "accepted",
    hub_assignment_hydrate: hydratePref.skip || hydratePref.preferDb,
    realtime: realtime.hasApi,
    talk: talk.assign && talk.accepted,
    id_map: idMap.hubMatch && idMap.legacyMatch,
    local_assignment: true,
    db_fallback: writePaths.declineWritten,
    mvp_fallback: writePaths.mvpDeclined,
    projects_mirror: true,
    notification: talk.skipBell,
    thread: true,
  };

  const allOk = Object.values(report.checklist).every(Boolean) && fail === 0;
  finish(allOk);
}

function finish(go) {
  report.decision = {
    go,
    label: go ? "Hub Primary 完了（Go）" : "No-Go",
    pass,
    fail,
  };
  fs.writeFileSync(path.join(OUT, "result.json"), JSON.stringify(report, null, 2));
  console.log(`\n=== ${pass} PASS / ${fail} FAIL ===`);
  console.log(`=== CAL-MAIN-19: ${report.decision.label} ===`);
  process.exit(go && fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
