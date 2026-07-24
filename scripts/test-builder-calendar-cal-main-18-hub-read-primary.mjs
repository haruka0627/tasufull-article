#!/usr/bin/env node
/**
 * CAL-MAIN-18 — Hub assignment Read 正本（本線表示）· MVP assignment_status は fallback
 *
 *   node scripts/test-builder-calendar-cal-main-18-hub-read-primary.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "./lib/playwright-browser.mjs";
import { buildLocalPageUrl, STANDARD_LOCAL_BASE } from "./lib/dev-server-url.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(root, "reports", "builder-calendar-cal-main-18");
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
const report = {
  baseUrl: STANDARD_LOCAL_BASE,
  timestamp: new Date().toISOString(),
  inventory: {
    A_hub_read_primary: [
      "resolveCalendarAssignmentStatus / HubAdapter.resolveAssignmentStatus",
      "getCalendarAssignmentStatusLabel",
      "isPartnerAcceptedAssignment / Pending / Declined",
      "renderPartnerAssignmentDetailOnly",
      "renderMvpCalendarPartnerAssignmentDetail",
      "partnerAcceptedThreadHref",
      "getCalendarListItemClass (is-accepted / is-declined)",
      "partner-assignment page (via helpers)",
    ],
    B_mvp_fallback: [
      "resolveAssignmentStatus → project.assignment_status when Hub missing",
      "accept/decline CAL-MAIN-17 MVP write on DB fail",
      "partner-assignment MVP path (data-partner-assignment-source=mvp)",
    ],
    C_demo_test_admin: [
      "ensureAdminCalendarPartnerDemoData assignmentStatus seeds",
      "scripts/test-builder-calendar-cal-main-*.mjs assertions",
      "admin calendar create pending write",
    ],
    D_keep_not_deleted: [
      "tasful:builder:mvp:v1 projects[].assignment_status",
      "tasu_builder_project_hub_v1 assignment",
      "tasful:builder:admin:calendarAssignments:v1",
      "builder-talk-bridge assignment_status recovery",
      "notifications / thread / completion / projects mirror",
    ],
  },
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

function assignUrl(projectId, partnerId = "demo-partner-001") {
  return buildLocalPageUrl(
    STANDARD_LOCAL_BASE,
    `builder/partner-assignment.html?role=partner&projectId=${encodeURIComponent(projectId)}&partnerId=${encodeURIComponent(partnerId)}`
  );
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  console.log(`=== CAL-MAIN-18 Hub Read Primary @ ${STANDARD_LOCAL_BASE} ===\n`);

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
  await page.waitForTimeout(500);

  // Hub accepted + MVP pending → resolve prefers Hub
  const hubOverMvp = await page.evaluate(() => {
    const Bridge = window.TasuBuilderBenchBridge;
    const Store = window.TasuBuilderProjectStore;
    const Hub = window.TasuBuilderPartnerAssignmentHubAdapter;
    const created = Bridge.createAdminCalendarProject({
      title: "CAL-MAIN-18 hub-over-mvp accept",
      partnerId: "demo-partner-001",
      start: "2027-09-01",
      end: "2027-09-02",
      location: "東京都",
      instructions: "hub prefer",
      skipNotification: true,
    });
    const legacyId = created.project_id;
    const hubId = created.hub_project_id;
    Store.patchProjectLocal(hubId, {
      assignment: {
        status: "accepted",
        partnerId: "demo-partner-001",
        source: "cal_main_18",
        acceptedAt: new Date().toISOString(),
      },
    });
    const mvp = (Bridge.getMvpState?.()?.projects || []).find((p) => p.project_id === legacyId);
    // force MVP pending (simulate CAL-MAIN-17 no-op)
    if (mvp) mvp.assignment_status = "pending";
    Bridge.getMvpState?.();
    const api = window.TasuBuilderMvp;
    // commit pending if possible
    try {
      const state = Bridge.getMvpState();
      const idx = (state.projects || []).findIndex((p) => p.project_id === legacyId);
      if (idx >= 0) {
        state.projects[idx].assignment_status = "pending";
        // use internal commit via accept path not available — patch via storage reload
      }
    } catch {
      /* ignore */
    }
    const project = (Bridge.getMvpState?.()?.projects || []).find((p) => p.project_id === legacyId);
    if (project) project.assignment_status = "pending";
    const resolved = Bridge.resolveCalendarAssignmentStatus(project);
    const hubDirect = Hub.resolveAssignmentStatus(project);
    const label = Bridge.resolveCalendarAssignmentStatus
      ? resolved
      : "";
    return {
      legacyId,
      hubId,
      mvpStatus: project?.assignment_status || "",
      hubStatus: Store.getProject(hubId)?.assignment?.status || "",
      resolved,
      hubDirect,
      label,
    };
  });

  assert(hubOverMvp.mvpStatus === "pending", "MVP still pending", hubOverMvp.mvpStatus);
  assert(hubOverMvp.hubStatus === "accepted", "Hub accepted", hubOverMvp.hubStatus);
  assert(hubOverMvp.resolved === "accepted", "resolve prefers Hub accepted", hubOverMvp.resolved);

  // partner-assignment UI shows accepted from Hub
  await page.goto(assignUrl(hubOverMvp.legacyId), { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("[data-partner-assignment-detail]", { timeout: 15000 });
  await page.waitForTimeout(400);
  const acceptUi = await page.evaluate(() => {
    const detail = document.querySelector("[data-partner-assignment-detail]");
    return {
      source: detail?.getAttribute("data-partner-assignment-source") || "",
      text: detail?.textContent || "",
      hasAcceptBtn: Boolean(detail?.querySelector("[data-partner-assignment-accept]")),
    };
  });
  assert(acceptUi.source === "hub", "UI source hub", acceptUi.source);
  assert(/受諾済み/.test(acceptUi.text), "UI shows 受諾済み despite MVP pending");
  assert(!acceptUi.hasAcceptBtn, "accept button hidden when Hub accepted");

  // Hub declined + MVP pending
  await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(400);
  const hubDeclined = await page.evaluate(() => {
    const Bridge = window.TasuBuilderBenchBridge;
    const Store = window.TasuBuilderProjectStore;
    const created = Bridge.createAdminCalendarProject({
      title: "CAL-MAIN-18 hub-over-mvp decline",
      partnerId: "demo-partner-001",
      start: "2027-09-05",
      end: "2027-09-06",
      location: "東京都",
      instructions: "hub decline",
      skipNotification: true,
    });
    Store.patchProjectLocal(created.hub_project_id, {
      assignment: {
        status: "declined",
        partnerId: "demo-partner-001",
        source: "cal_main_18",
        declinedAt: new Date().toISOString(),
      },
    });
    const project = (Bridge.getMvpState?.()?.projects || []).find(
      (p) => p.project_id === created.project_id
    );
    if (project) project.assignment_status = "pending";
    return {
      legacyId: created.project_id,
      resolved: Bridge.resolveCalendarAssignmentStatus(project),
      mvpStatus: project?.assignment_status || "",
    };
  });
  assert(hubDeclined.mvpStatus === "pending", "decline case MVP pending");
  assert(hubDeclined.resolved === "declined", "resolve prefers Hub declined");

  await page.goto(assignUrl(hubDeclined.legacyId), { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("[data-partner-assignment-detail]", { timeout: 15000 });
  await page.waitForTimeout(400);
  const declineUi = await page.evaluate(() => {
    const detail = document.querySelector("[data-partner-assignment-detail]");
    return {
      source: detail?.getAttribute("data-partner-assignment-source") || "",
      text: detail?.textContent || "",
    };
  });
  assert(declineUi.source === "hub", "decline UI source hub");
  assert(/辞退/.test(declineUi.text), "UI shows 辞退 despite MVP pending");

  // No Hub assignment → MVP fallback（DB fail accept で MVP を書き、Hub assignment のみ消す）
  await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(400);
  const mvpFallback = await page.evaluate(async () => {
    const Bridge = window.TasuBuilderBenchBridge;
    const Store = window.TasuBuilderProjectStore;
    const Hub = window.TasuBuilderPartnerAssignmentHubAdapter;
    const Adapter = window.TasuBuilderProjectWriteAdapter;
    const created = Bridge.createAdminCalendarProject({
      title: "CAL-MAIN-18 mvp-fallback",
      partnerId: "demo-partner-001",
      start: "2027-09-10",
      end: "2027-09-11",
      location: "東京都",
      instructions: "mvp only",
      skipNotification: true,
    });
    Adapter.writeAssignment = async () => ({
      ok: false,
      reason: "forced_fail",
      skipped: false,
    });
    await Bridge.acceptCalendarAssignment(created.project_id);
    Store.patchProjectLocal(created.hub_project_id, { assignment: null });
    const project = (Bridge.getMvpState?.()?.projects || []).find(
      (p) => p.project_id === created.project_id
    );
    const resolved = Bridge.resolveCalendarAssignmentStatus(project);
    const hubRead = Hub.readHubAssignmentStatus(project);
    Adapter.resetAssignmentColumnCacheForTests?.();
    return {
      legacyId: created.project_id,
      hubRead,
      resolved,
      mvpStatus: project?.assignment_status || "",
    };
  });
  assert(!mvpFallback.hubRead, "no Hub status", mvpFallback.hubRead || "(empty)");
  assert(mvpFallback.mvpStatus === "accepted", "MVP accepted for fallback", mvpFallback.mvpStatus);
  assert(mvpFallback.resolved === "accepted", "MVP fallback accepted", mvpFallback.resolved);

  // CAL-MAIN-17: DB ok → MVP status not written; display still Hub
  const dbOkDisplay = await page.evaluate(async () => {
    const Bridge = window.TasuBuilderBenchBridge;
    const Adapter = window.TasuBuilderProjectWriteAdapter;
    const Store = window.TasuBuilderProjectStore;
    const created = Bridge.createAdminCalendarProject({
      title: "CAL-MAIN-18 db-ok display",
      partnerId: "demo-partner-001",
      start: "2027-09-15",
      end: "2027-09-16",
      location: "東京都",
      instructions: "db ok display",
      skipNotification: true,
    });
    const before =
      (Bridge.getMvpState?.()?.projects || []).find((p) => p.project_id === created.project_id)
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
    const res = await Bridge.acceptCalendarAssignment(created.project_id);
    const project = (Bridge.getMvpState?.()?.projects || []).find(
      (p) => p.project_id === created.project_id
    );
    Adapter.writeAssignment = realWrite;
    if (realHydrate) Store.hydrateFromSupabase = realHydrate;
    return {
      skipped: res?.mvp_assignment_status_skipped === true,
      mvpStatus: project?.assignment_status || "",
      before,
      resolved: Bridge.resolveCalendarAssignmentStatus(project),
      hubStatus: Store.getProject(created.hub_project_id)?.assignment?.status || "",
    };
  });
  assert(dbOkDisplay.skipped === true, "DB ok MVP status skipped");
  assert(dbOkDisplay.mvpStatus === dbOkDisplay.before, "MVP status unchanged on DB ok");
  assert(dbOkDisplay.hubStatus === "accepted", "Hub accepted on DB ok");
  assert(dbOkDisplay.resolved === "accepted", "display accepted via Hub on DB ok");

  // CAL-MAIN-17: DB fail → MVP written; display accepted
  const dbFailDisplay = await page.evaluate(async () => {
    const Bridge = window.TasuBuilderBenchBridge;
    const Adapter = window.TasuBuilderProjectWriteAdapter;
    const Store = window.TasuBuilderProjectStore;
    const created = Bridge.createAdminCalendarProject({
      title: "CAL-MAIN-18 db-fail display",
      partnerId: "demo-partner-001",
      start: "2027-09-20",
      end: "2027-09-21",
      location: "東京都",
      instructions: "db fail display",
      skipNotification: true,
    });
    Adapter.writeAssignment = async () => ({
      ok: false,
      reason: "no_row_updated",
      skipped: false,
    });
    const res = await Bridge.declineCalendarAssignment(created.project_id);
    const project = (Bridge.getMvpState?.()?.projects || []).find(
      (p) => p.project_id === created.project_id
    );
    Adapter.resetAssignmentColumnCacheForTests?.();
    return {
      written: res?.mvp_assignment_status_written === true,
      mvpStatus: project?.assignment_status || "",
      resolved: Bridge.resolveCalendarAssignmentStatus(project),
      hubStatus: Store.getProject(created.hub_project_id)?.assignment?.status || "",
    };
  });
  assert(dbFailDisplay.written === true, "DB fail MVP status written");
  assert(dbFailDisplay.mvpStatus === "declined", "MVP declined on DB fail");
  assert(dbFailDisplay.hubStatus === "declined", "Hub declined on DB fail");
  assert(dbFailDisplay.resolved === "declined", "display declined");

  // list badge class uses Hub prefer
  const listClass = await page.evaluate(() => {
    const Bridge = window.TasuBuilderBenchBridge;
    const Store = window.TasuBuilderProjectStore;
    const created = Bridge.createAdminCalendarProject({
      title: "CAL-MAIN-18 list class",
      partnerId: "demo-partner-001",
      start: "2027-09-25",
      end: "2027-09-26",
      location: "東京都",
      instructions: "list",
      skipNotification: true,
    });
    Store.patchProjectLocal(created.hub_project_id, {
      assignment: { status: "accepted", partnerId: "demo-partner-001", source: "cal_main_18" },
    });
    const project = (Bridge.getMvpState?.()?.projects || []).find(
      (p) => p.project_id === created.project_id
    );
    if (project) project.assignment_status = "pending";
    const status = Bridge.resolveCalendarAssignmentStatus(project);
    return { status, mvp: project?.assignment_status };
  });
  assert(listClass.status === "accepted", "list resolve accepted", listClass.status);
  assert(listClass.mvp === "pending", "list MVP still pending");

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
