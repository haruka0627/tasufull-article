#!/usr/bin/env node
/**
 * CAL-MAIN-08 — 運営案件作成 → Hub saveProject + ID マップ
 *
 *   node scripts/test-builder-calendar-cal-main-08-hub-create.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "./lib/playwright-browser.mjs";
import { buildLocalPageUrl, STANDARD_LOCAL_BASE } from "./lib/dev-server-url.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(root, "reports", "builder-calendar-cal-main-08");
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
  console.log(`=== CAL-MAIN-08 Hub Create @ ${STANDARD_LOCAL_BASE} ===\n`);

  const probe = await fetch(ADMIN_URL.split("?")[0]).catch(() => null);
  assert(probe?.ok, "HTTP 200 admin-calendar", `status=${probe?.status ?? "unreachable"}`);
  if (!probe?.ok) {
    writeReport();
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const t = String(msg.text());
    if (IGNORE.some((re) => re.test(t))) return;
    errors.push(`console:${t}`);
  });
  page.on("pageerror", (err) => {
    const t = String(err.message || err);
    const stack = String(err.stack || "").split("\n").slice(0, 6).join(" | ");
    if (IGNORE.some((re) => re.test(t))) return;
    errors.push(`pageerror:${t} :: ${stack}`);
  });

  await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(800);

  const created = await page.evaluate(async () => {
    const Bridge = window.TasuBuilderBenchBridge;
    const Store = window.TasuBuilderProjectStore;
    const MapApi = window.TasuBuilderProjectIdMap;
    const HubWrite = window.TasuBuilderAdminCalendarHubWrite;

    const title = "CAL-MAIN-08 運営テスト案件";
    const partnerId = "demo-partner-001";
    const result = Bridge.createAdminCalendarProject({
      title,
      partnerId,
      partnerName: "デモパートナー",
      start: "2026-08-01",
      end: "2026-08-05",
      location: "東京都千代田区1-1-1",
      instructions: "Hub 作成テスト用メモ",
      category: "interior",
    });

    const legacyId = result?.project_id || "";
    const hubId = result?.hub_project_id || "";
    const mvpState = Bridge.getMvpState?.() || {};
    const mvpProject = (mvpState.projects || []).find((p) => p.project_id === legacyId);
    const hubProject = hubId ? Store.getProject(hubId) : null;

    // wait brief for talk room ensure
    if (hubProject?._talkRoomEnsurePromise) {
      try {
        await hubProject._talkRoomEnsurePromise;
      } catch {
        /* ignore */
      }
    }
    const hubAfter = hubId ? Store.getProject(hubId) : null;
    const talkRoom = hubAfter?.talkRoomId || hubProject?.talkRoomId || "";

    const notifications = Bridge.getNotifications?.() || [];
    const notify = notifications.find(
      (n) =>
        n.project_id === legacyId ||
        n.projectId === legacyId ||
        (n.hubProjectId && n.hubProjectId === hubId)
    );

    const again = Bridge.createAdminCalendarProject({
      title,
      partnerId,
      project_id: legacyId,
      assignment_id: result?.assignment_id,
      start: "2026-08-01",
      end: "2026-08-05",
      location: "東京都千代田区1-1-1",
      instructions: "Hub 作成テスト用メモ",
      category: "interior",
      skipNotification: true,
    });

    return {
      hasWrite: Boolean(HubWrite),
      hasBridge: Boolean(Bridge?.createAdminCalendarProject),
      resultOk: result?.ok === true,
      legacyId,
      hubId,
      assignmentId: result?.assignment_id || "",
      mvpTitle: mvpProject?.title || "",
      mvpHubField: mvpProject?.hub_project_id || "",
      hubName: hubAfter?.name || hubProject?.name || "",
      hubAddress: hubAfter?.siteAddress || hubProject?.siteAddress || "",
      mapHub: MapApi.legacyToHub(legacyId),
      mapLegacy: MapApi.hubToLegacy(hubId),
      talkRoom,
      mapFromRoom: talkRoom ? MapApi.talkRoomToHub(talkRoom) : "",
      notifyHub: notify?.hubProjectId || "",
      notifyHubHref: notify?.hubHref || "",
      notifyHref: notify?.href || notify?.targetUrl || "",
      notifyProjectId: notify?.project_id || notify?.projectId || "",
      duplicateOk: again?.ok === true && again?.duplicate === true,
      duplicateSameHub: again?.hub_project_id === hubId || MapApi.legacyToHub(legacyId) === hubId,
    };
  });

  assert(created.hasWrite, "AdminCalendarHubWrite loaded");
  assert(created.hasBridge, "BenchBridge.createAdminCalendarProject");
  assert(created.resultOk, "createAdminCalendarProject ok");
  assert(Boolean(created.legacyId), "MVP project_id", created.legacyId);
  assert(Boolean(created.hubId), "hub_project_id returned", created.hubId);
  assert(created.mvpTitle === "CAL-MAIN-08 運営テスト案件", "MVP title", created.mvpTitle);
  assert(created.mvpHubField === created.hubId, "MVP stores hub_project_id", created.mvpHubField);
  assert(created.hubName === "CAL-MAIN-08 運営テスト案件", "Hub title", created.hubName);
  assert(/千代田区/.test(created.hubAddress), "Hub address", created.hubAddress);
  assert(created.mapHub === created.hubId, "legacyToHub", created.mapHub);
  assert(created.mapLegacy === created.legacyId, "hubToLegacy", created.mapLegacy);
  assert(Boolean(created.talkRoom), "talkRoomId assigned", created.talkRoom);
  assert(created.mapFromRoom === created.hubId, "talkRoomToHub", created.mapFromRoom);
  assert(created.notifyHub === created.hubId, "notify hubProjectId", created.notifyHub);
  assert(
    /project-calendar\.html\?projectId=/.test(created.notifyHubHref || ""),
    "notify hubHref",
    created.notifyHubHref
  );
  assert(
    String(created.notifyHref).includes(created.legacyId),
    "notify href keeps legacy",
    created.notifyHref
  );
  assert(created.duplicateOk, "duplicate create ok");
  assert(created.duplicateSameHub, "duplicate reuses hub id");

  // Hub failure must not break MVP create（saveProject 欠落をシミュレート）
  const failSafe = await page.evaluate(() => {
    const Bridge = window.TasuBuilderBenchBridge;
    const Store = window.TasuBuilderProjectStore;
    const HubWrite = window.TasuBuilderAdminCalendarHubWrite;
    const savedSave = Store.saveProject;
    try {
      delete Store.saveProject;
      const result = Bridge.createAdminCalendarProject({
        title: "CAL-MAIN-08 fail-safe",
        partnerId: "demo-partner-001",
        start: "2026-09-01",
        end: "2026-09-02",
        location: "東京都中央区",
        instructions: "fail",
        category: "other",
        skipNotification: true,
      });
      const mvp = Bridge.getMvpState?.();
      const mvpExists = (mvp?.projects || []).some((p) => p.project_id === result?.project_id);
      const direct = HubWrite.ensureHubProjectForAdminCalendar({
        project: { project_id: "proj-no-store", title: "x" },
        payload: { title: "x", start: "2026-09-01", end: "2026-09-02" },
      });
      return {
        mvpOk: result?.ok === true,
        legacyId: result?.project_id || "",
        hubId: result?.hub_project_id,
        mvpExists,
        directFail: direct?.ok === false,
        directReason: direct?.reason || "",
      };
    } finally {
      Store.saveProject = savedSave;
    }
  });
  assert(failSafe.mvpOk, "MVP create succeeds when Hub unavailable");
  assert(failSafe.mvpExists, "MVP project exists after Hub failure");
  assert(!failSafe.hubId, "hub_project_id empty on Hub failure", String(failSafe.hubId));
  assert(failSafe.directFail, "ensureHub returns ok:false", failSafe.directReason);

  // partner-assignment legacy URL → Hub read
  const assignUrl = buildLocalPageUrl(
    STANDARD_LOCAL_BASE,
    `builder/partner-assignment.html?role=partner&projectId=${encodeURIComponent(created.legacyId)}&partnerId=demo-partner-001`
  );
  await page.goto(assignUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("[data-partner-assignment-detail]", { timeout: 15000 });
  await page.waitForTimeout(600);

  const assignMeta = await page.evaluate(() => {
    const detail = document.querySelector("[data-partner-assignment-detail]");
    const rowMap = Object.fromEntries(
      [...(detail?.querySelectorAll(".mvp-cal-assignment__row") || [])].map((row) => [
        row.querySelector("dt")?.textContent?.trim() || "",
        row.querySelector("dd")?.textContent?.trim() || "",
      ])
    );
    return {
      source: detail?.getAttribute("data-partner-assignment-source") || "",
      hubId: detail?.getAttribute("data-hub-project-id") || "",
      title: rowMap["案件名"] || "",
      denied: Boolean(detail?.querySelector(".mvp-cal-detail__denied")),
    };
  });

  assert(!assignMeta.denied, "partner-assignment not denied");
  assert(assignMeta.source === "hub", "partner-assignment source hub", assignMeta.source);
  assert(assignMeta.hubId === created.hubId, "partner-assignment hub id", assignMeta.hubId);
  assert(
    assignMeta.title === "CAL-MAIN-08 運営テスト案件",
    "partner-assignment title",
    assignMeta.title
  );

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
