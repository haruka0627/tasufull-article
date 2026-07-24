#!/usr/bin/env node
/**
 * CAL-MAIN-11 — 運営作成 Hub-primary（MVP は互換ミラー）
 *
 *   node scripts/test-builder-calendar-cal-main-11-hub-primary.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "./lib/playwright-browser.mjs";
import { buildLocalPageUrl, STANDARD_LOCAL_BASE } from "./lib/dev-server-url.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(root, "reports", "builder-calendar-cal-main-11");
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
  console.log(`=== CAL-MAIN-11 Hub-Primary @ ${STANDARD_LOCAL_BASE} ===\n`);

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

  const created = await page.evaluate(() => {
    const Bridge = window.TasuBuilderBenchBridge;
    const Store = window.TasuBuilderProjectStore;
    const MapApi = window.TasuBuilderProjectIdMap;
    const HubWrite = window.TasuBuilderAdminCalendarHubWrite;

    const beforeIds = new Set((Store.listProjectsLocal?.() || Store.listProjects?.() || []).map((p) => p.id));

    const result = Bridge.createAdminCalendarProject({
      title: "CAL-MAIN-11 Hub-primary テスト",
      partnerId: "demo-partner-001",
      partnerName: "デモパートナー",
      start: "2026-12-01",
      end: "2026-12-05",
      location: "東京都新宿区1-1-1",
      instructions: "hub primary",
      category: "interior",
      skipNotification: true,
    });

    const legacyId = result?.project_id || "";
    const hubId = result?.hub_project_id || "";
    const mvp = Bridge.getMvpState?.();
    const mvpProject = (mvp?.projects || []).find((p) => p.project_id === legacyId);
    const hub = hubId ? Store.getProject(hubId) : null;
    const afterIds = (Store.listProjectsLocal?.() || Store.listProjects?.() || []).map((p) => p.id);
    const newHubIds = afterIds.filter((id) => !beforeIds.has(id));

    return {
      hasCreateHubPrimary: typeof HubWrite?.createHubPrimaryProject === "function",
      resultOk: result?.ok === true,
      primary: result?.primary || "",
      legacyId,
      hubId,
      mvpHubField: mvpProject?.hub_project_id || "",
      mvpDataRole: mvpProject?.data_role || "",
      mvpHubPrimaryFlag: mvpProject?.hub_primary === true,
      mvpTitle: mvpProject?.title || "",
      hubName: hub?.name || "",
      hubAssignment: hub?.assignment?.status || "",
      mapHub: MapApi.legacyToHub(legacyId),
      mapLegacy: MapApi.hubToLegacy(hubId),
      newHubIncludes: newHubIds.includes(hubId),
    };
  });

  assert(created.hasCreateHubPrimary, "createHubPrimaryProject API");
  assert(created.resultOk, "create ok");
  assert(created.primary === "hub", "primary is hub", created.primary);
  assert(Boolean(created.hubId), "hub_project_id", created.hubId);
  assert(Boolean(created.legacyId), "legacy project_id", created.legacyId);
  assert(created.mvpHubField === created.hubId, "MVP mirror has hub_project_id", created.mvpHubField);
  assert(created.mvpDataRole === "hub_mirror", "MVP data_role hub_mirror", created.mvpDataRole);
  assert(created.mvpHubPrimaryFlag, "MVP hub_primary flag");
  assert(created.mvpTitle === "CAL-MAIN-11 Hub-primary テスト", "MVP mirror title");
  assert(created.hubName === "CAL-MAIN-11 Hub-primary テスト", "Hub title");
  assert(created.hubAssignment === "pending", "Hub assignment pending");
  assert(created.mapHub === created.hubId, "legacyToHub");
  assert(created.mapLegacy === created.legacyId, "hubToLegacy");
  assert(created.newHubIncludes, "Hub project created in store");

  // partner-assignment + accept dual-write still works
  const assignUrl = buildLocalPageUrl(
    STANDARD_LOCAL_BASE,
    `builder/partner-assignment.html?role=partner&projectId=${encodeURIComponent(created.legacyId)}&partnerId=demo-partner-001`
  );
  await page.goto(assignUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("[data-partner-assignment-detail]", { timeout: 15000 });
  await page.waitForTimeout(400);

  const assignMeta = await page.evaluate(async (legacyId) => {
    const detail = document.querySelector("[data-partner-assignment-detail]");
    const Bridge = window.TasuBuilderBenchBridge;
    const Store = window.TasuBuilderProjectStore;
    const MapApi = window.TasuBuilderProjectIdMap;
    const accept = await Bridge.acceptCalendarAssignment(legacyId);
    const hubId = MapApi.legacyToHub(legacyId);
    const hub = Store.getProject(hubId);
    const mvp = (Bridge.getMvpState?.()?.projects || []).find((p) => p.project_id === legacyId);
    return {
      source: detail?.getAttribute("data-partner-assignment-source") || "",
      hubAttr: detail?.getAttribute("data-hub-project-id") || "",
      acceptOk: accept?.ok === true,
      hubWriteOk: accept?.hub_assignment_ok === true,
      mvpStatus: mvp?.assignment_status || "",
      hubStatus: hub?.assignment?.status || "",
      mvpStatusSkipped: accept?.mvp_assignment_status_skipped === true,
    };
  }, created.legacyId);

  assert(assignMeta.source === "hub", "partner-assignment hub source", assignMeta.source);
  assert(assignMeta.hubAttr === created.hubId, "data-hub-project-id", assignMeta.hubAttr);
  assert(assignMeta.acceptOk, "accept ok");
  assert(assignMeta.hubWriteOk, "accept hub dual-write");
  assert(assignMeta.mvpStatus === "accepted", "MVP accepted");
  assert(assignMeta.hubStatus === "accepted", "Hub accepted");

  // Hub failure → MVP fallback (primary mvp)
  await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(400);
  const fallback = await page.evaluate(() => {
    const Bridge = window.TasuBuilderBenchBridge;
    const Store = window.TasuBuilderProjectStore;
    const HubWrite = window.TasuBuilderAdminCalendarHubWrite;
    const savedCreate = HubWrite.createHubPrimaryProject;
    HubWrite.createHubPrimaryProject = () => ({ ok: false, reason: "simulated", primary: "none" });
    const result = Bridge.createAdminCalendarProject({
      title: "CAL-MAIN-11 MVP fallback",
      partnerId: "demo-partner-001",
      start: "2026-12-10",
      end: "2026-12-11",
      location: "東京都",
      instructions: "fallback",
      skipNotification: true,
    });
    HubWrite.createHubPrimaryProject = savedCreate;
    const mvp = (Bridge.getMvpState?.()?.projects || []).find((p) => p.project_id === result?.project_id);
    return {
      ok: result?.ok === true,
      primary: result?.primary || "",
      legacyId: result?.project_id || "",
      hubId: result?.hub_project_id,
      mvpTitle: mvp?.title || "",
      dataRole: mvp?.data_role || "",
      hasSave: typeof Store.saveProject === "function",
    };
  });

  assert(fallback.ok, "MVP fallback create ok");
  assert(fallback.primary === "mvp", "primary mvp on Hub fail", fallback.primary);
  assert(Boolean(fallback.legacyId), "legacy id on fallback");
  assert(!fallback.hubId, "no hub_project_id on fallback", String(fallback.hubId));
  assert(fallback.mvpTitle === "CAL-MAIN-11 MVP fallback", "MVP project exists");
  assert(fallback.dataRole === "mvp_primary", "data_role mvp_primary", fallback.dataRole);

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
