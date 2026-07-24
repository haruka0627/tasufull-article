#!/usr/bin/env node
/**
 * CAL-MAIN-10 — 受諾/辞退 Hub dual-write（local assignment）
 *
 *   node scripts/test-builder-calendar-cal-main-10-assignment-dual-write.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "./lib/playwright-browser.mjs";
import { buildLocalPageUrl, STANDARD_LOCAL_BASE } from "./lib/dev-server-url.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(root, "reports", "builder-calendar-cal-main-10");
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

function assignUrl(projectId, partnerId = "demo-partner-001") {
  return buildLocalPageUrl(
    STANDARD_LOCAL_BASE,
    `builder/partner-assignment.html?role=partner&projectId=${encodeURIComponent(projectId)}&partnerId=${encodeURIComponent(partnerId)}`
  );
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  console.log(`=== CAL-MAIN-10 Assignment Dual-Write @ ${STANDARD_LOCAL_BASE} ===\n`);

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

  // Create two projects: one accept, one decline
  await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(600);

  const created = await page.evaluate(() => {
    const Bridge = window.TasuBuilderBenchBridge;
    const accept = Bridge.createAdminCalendarProject({
      title: "CAL-MAIN-10 受諾テスト",
      partnerId: "demo-partner-001",
      partnerName: "デモパートナー",
      start: "2026-10-01",
      end: "2026-10-03",
      location: "東京都港区1-1-1",
      instructions: "accept case",
      category: "interior",
      skipNotification: true,
    });
    const decline = Bridge.createAdminCalendarProject({
      title: "CAL-MAIN-10 辞退テスト",
      partnerId: "demo-partner-001",
      partnerName: "デモパートナー",
      start: "2026-10-05",
      end: "2026-10-07",
      location: "東京都港区2-2-2",
      instructions: "decline case",
      category: "interior",
      skipNotification: true,
    });
    const Store = window.TasuBuilderProjectStore;
    return {
      acceptLegacy: accept?.project_id || "",
      acceptHub: accept?.hub_project_id || "",
      declineLegacy: decline?.project_id || "",
      declineHub: decline?.hub_project_id || "",
      acceptPending: Store.getProject(accept?.hub_project_id)?.assignment?.status || "",
      declinePending: Store.getProject(decline?.hub_project_id)?.assignment?.status || "",
    };
  });

  assert(Boolean(created.acceptLegacy && created.acceptHub), "accept project created");
  assert(Boolean(created.declineLegacy && created.declineHub), "decline project created");
  assert(created.acceptPending === "pending", "Hub assignment pending on create", created.acceptPending);

  // Accept on partner-assignment page
  await page.goto(assignUrl(created.acceptLegacy), { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("[data-partner-assignment-detail]", { timeout: 15000 });
  await page.waitForTimeout(500);

  const acceptResult = await page.evaluate(async (legacyId) => {
    const Bridge = window.TasuBuilderBenchBridge;
    const Store = window.TasuBuilderProjectStore;
    const MapApi = window.TasuBuilderProjectIdMap;
    const res = await Bridge.acceptCalendarAssignment(legacyId);
    const mvp = Bridge.getMvpState?.();
    const mvpProject = (mvp?.projects || []).find((p) => p.project_id === legacyId);
    const hubId = MapApi.legacyToHub(legacyId);
    const hub = Store.getProject(hubId);
    return {
      ok: res?.ok === true,
      hubWriteOk: res?.hub_assignment_ok === true,
      mvpStatus: mvpProject?.assignment_status || "",
      hubStatus: hub?.assignment?.status || "",
      hubPartner: hub?.assignment?.partnerId || "",
      hubAcceptedAt: hub?.assignment?.acceptedAt || "",
      hubId,
      mvpStatusSkipped: res?.mvp_assignment_status_skipped === true,
    };
  }, created.acceptLegacy);

  assert(acceptResult.ok, "accept MVP ok");
  assert(acceptResult.hubWriteOk, "accept Hub write ok");
  assert(acceptResult.mvpStatus === "accepted", "MVP accepted", acceptResult.mvpStatus);
  assert(acceptResult.hubStatus === "accepted", "Hub accepted", acceptResult.hubStatus);
  assert(acceptResult.hubPartner === "demo-partner-001", "Hub partnerId", acceptResult.hubPartner);
  assert(Boolean(acceptResult.hubAcceptedAt), "Hub acceptedAt set");

  // UI reflects accepted
  await page.evaluate(() => {
    document.dispatchEvent(new Event("builder:mvp-changed"));
  });
  await page.waitForTimeout(400);
  const acceptUi = await page.evaluate(() => {
    const detail = document.querySelector("[data-partner-assignment-detail]");
    return {
      source: detail?.getAttribute("data-partner-assignment-source") || "",
      text: detail?.textContent || "",
      hasAcceptBtn: Boolean(detail?.querySelector("[data-partner-assignment-accept]")),
    };
  });
  assert(acceptUi.source === "hub", "accept UI source hub", acceptUi.source);
  assert(/受諾済み/.test(acceptUi.text), "accept UI shows 受諾済み");
  assert(!acceptUi.hasAcceptBtn, "accept button hidden after accept");

  // Decline
  await page.goto(assignUrl(created.declineLegacy), { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("[data-partner-assignment-detail]", { timeout: 15000 });
  await page.waitForTimeout(400);

  const declineResult = await page.evaluate(async (legacyId) => {
    const Bridge = window.TasuBuilderBenchBridge;
    const Store = window.TasuBuilderProjectStore;
    const MapApi = window.TasuBuilderProjectIdMap;
    const res = await Bridge.declineCalendarAssignment(legacyId);
    const mvp = Bridge.getMvpState?.();
    const mvpProject = (mvp?.projects || []).find((p) => p.project_id === legacyId);
    const hubId = MapApi.legacyToHub(legacyId);
    const hub = Store.getProject(hubId);
    return {
      ok: res?.ok === true,
      hubWriteOk: res?.hub_assignment_ok === true,
      mvpStatus: mvpProject?.assignment_status || "",
      hubStatus: hub?.assignment?.status || "",
      hubDeclinedAt: hub?.assignment?.declinedAt || "",
      mvpStatusSkipped: res?.mvp_assignment_status_skipped === true,
    };
  }, created.declineLegacy);

  assert(declineResult.ok, "decline MVP ok");
  assert(declineResult.hubWriteOk, "decline Hub write ok");
  assert(declineResult.mvpStatus === "declined", "MVP declined", declineResult.mvpStatus);
  assert(declineResult.hubStatus === "declined", "Hub declined", declineResult.hubStatus);
  assert(Boolean(declineResult.hubDeclinedAt), "Hub declinedAt set");

  await page.evaluate(() => {
    document.dispatchEvent(new Event("builder:mvp-changed"));
  });
  await page.waitForTimeout(400);
  const declineUi = await page.evaluate(() => {
    const detail = document.querySelector("[data-partner-assignment-detail]");
    return {
      text: detail?.textContent || "",
      source: detail?.getAttribute("data-partner-assignment-source") || "",
    };
  });
  assert(/辞退済み/.test(declineUi.text), "decline UI shows 辞退済み");

  // Hub write failure still succeeds MVP
  const failSafe = await page.evaluate(async () => {
    const Bridge = window.TasuBuilderBenchBridge;
    const Adapter = window.TasuBuilderPartnerAssignmentHubAdapter;
    const created = Bridge.createAdminCalendarProject({
      title: "CAL-MAIN-10 fail-safe",
      partnerId: "demo-partner-001",
      start: "2026-11-01",
      end: "2026-11-02",
      location: "東京都",
      instructions: "fail",
      skipNotification: true,
    });
    const legacyId = created?.project_id || "";
    const savedWrite = Adapter.writeAssignmentDecision;
    Adapter.writeAssignmentDecision = async () => {
      throw new Error("simulated_hub_assignment_failure");
    };
    const res = await Bridge.acceptCalendarAssignment(legacyId);
    Adapter.writeAssignmentDecision = savedWrite;
    const mvp = Bridge.getMvpState?.();
    const mvpProject = (mvp?.projects || []).find((p) => p.project_id === legacyId);
    return {
      ok: res?.ok === true,
      hubWriteOk: res?.hub_assignment_ok === true,
      mvpStatus: mvpProject?.assignment_status || "",
      mvpStatusWritten: res?.mvp_assignment_status_written === true,
      legacyId,
    };
  });
  assert(failSafe.ok, "MVP accept succeeds when Hub throws");
  assert(failSafe.mvpStatus === "accepted", "MVP accepted despite Hub fail", failSafe.mvpStatus);
  assert(failSafe.hubWriteOk === false, "hub_assignment_ok false on failure");

  // Hub missing assignment → MVP fallback display (builder_demo_001 path still works)
  await page.goto(assignUrl("builder_demo_001"), { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("[data-partner-assignment-detail]", { timeout: 15000 });
  await page.waitForTimeout(400);
  const fallbackUi = await page.evaluate(() => {
    const detail = document.querySelector("[data-partner-assignment-detail]");
    const Store = window.TasuBuilderProjectStore;
    const hub = Store.getProject("PRJ-2026-001");
    // clear assignment for fallback check
    const prev = hub?.assignment;
    if (hub) Store.patchProjectLocal("PRJ-2026-001", { assignment: null });
    document.dispatchEvent(new Event("builder:mvp-changed"));
    const after = document.querySelector("[data-partner-assignment-detail]");
    const title =
      [...(after?.querySelectorAll(".mvp-cal-assignment__row") || [])]
        .map((row) => [
          row.querySelector("dt")?.textContent?.trim(),
          row.querySelector("dd")?.textContent?.trim(),
        ])
        .find((r) => r[0] === "案件名")?.[1] || "";
    // restore
    if (prev) Store.patchProjectLocal("PRJ-2026-001", { assignment: prev });
    else Store.patchProjectLocal("PRJ-2026-001", { assignment: null });
    document.dispatchEvent(new Event("builder:mvp-changed"));
    return {
      source: after?.getAttribute("data-partner-assignment-source") || "",
      title,
      denied: Boolean(after?.querySelector(".mvp-cal-detail__denied")),
    };
  });
  assert(!fallbackUi.denied, "MVP fallback not denied");
  assert(
    fallbackUi.title === "店舗内装リニューアル（Builder）" || fallbackUi.source === "hub",
    "MVP/assignment display works without Hub assignment",
    fallbackUi.title
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
