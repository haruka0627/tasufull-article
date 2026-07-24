#!/usr/bin/env node
/**
 * Builder General Jobs P1 Wave 1 — admin-applications 選定 → Talk UUID
 *
 *   node scripts/test-builder-general-jobs-p1-wave1-admin-path.mjs
 *   node scripts/test-builder-general-jobs-p1-wave1-admin-path.mjs --headed
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "./lib/playwright-browser.mjs";
import { buildLocalPageUrl, STANDARD_LOCAL_BASE } from "./lib/dev-server-url.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(root, "reports", "builder-general-jobs-p1-wave1");
const HEADED = process.argv.includes("--headed");
const ADMIN_URL = buildLocalPageUrl(STANDARD_LOCAL_BASE, "builder/admin-applications.html");
const BOARD_URL = buildLocalPageUrl(STANDARD_LOCAL_BASE, "builder/board-projects.html");

const TEST_USER = {
  email: "e2e-test@example.com",
  password: "E2eTestPass123!",
  uid: "bf2125bf-47b2-4ec2-9ba4-f12ebc57cb40",
};

const PARTNER_KEY = "demo-partner-e2e-p05";

let pass = 0;
let fail = 0;
const report = {
  phase: "P1-Wave1",
  timestamp: new Date().toISOString(),
  checks: [],
  decision: null,
  cleanup: [],
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

const IGNORE = [
  /favicon/i,
  /Failed to load resource/i,
  /net::ERR_/i,
  /CDN|fonts\.g/i,
  /\[TasuSupabase\]/i,
  /\[BuilderGeneralDualWrite\]/i,
  /\[BuilderBoardAppsHydrate\]/i,
  /\[TasuChat\]/i,
];

function isUuid(v) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v || ""));
}

async function openPage(browser, url) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript(() => {
    window.TASU_BUILDER_STORAGE_MODE = "supabase";
    window.TASU_BUILDER_GENERAL_JOBS_REPO = true;
  });
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
  const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForFunction(() => window.TasuBuilderGeneralJobsDualWrite?.syncTalkRoomAfterSelection, { timeout: 25000 });
  return { context, page, errors, status: res?.status() ?? 0 };
}

async function runE2E() {
  console.log(`=== P1 Wave 1 Admin Path @ ${STANDARD_LOCAL_BASE} ${HEADED ? "(headed)" : ""} ===\n`);

  const schemaOk =
    spawnSync(process.execPath, ["scripts/verify-builder-general-jobs-staging-schema.mjs"], {
      cwd: root,
      encoding: "utf8",
    }).status === 0;
  assert(schemaOk, "schema verify", "exit 0");
  if (!schemaOk) return finish(false);

  const browser = await chromium.launch({ headless: !HEADED, slowMo: HEADED ? 80 : 0 });
  const { context, page, errors, status } = await openPage(browser, ADMIN_URL);
  assert(status === 200, "admin-applications HTTP 200");
  assert(Boolean(await page.evaluate(() => !!window.TasuBuilderGeneralJobsDualWrite)), "dual-write loaded");
  assert(Boolean(await page.evaluate(() => !!window.TasuBuilderBoardApplicationsHydrate)), "hydrate loaded");
  assert(Boolean(await page.evaluate(() => !!window.TasuBuilderProjectTalkRoom)), "talk-room loaded");

  await page.evaluate(async ({ email, password }) => {
    const sb = window.TasuSupabase.getClient();
    await sb.auth.signInWithPassword({ email, password });
  }, TEST_USER);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.TasuBuilderGeneralJobsDualWrite?.syncTalkRoomAfterSelection, { timeout: 25000 });

  const seedCheck = await page.evaluate(async () => {
    const sb = window.TasuSupabase.getClient();
    const { data } = await sb.from("builder_partners").select("partner_key").eq("partner_key", "demo-partner-e2e-p05");
    return Array.isArray(data) && data.length > 0;
  });
  assert(seedCheck, "partners seed present");
  if (!seedCheck) {
    await context.close();
    await browser.close();
    return finish(false);
  }

  const projectKey = `e2e-p1w1-${Date.now().toString(36)}`;
  const setup = await page.evaluate(
    async ({ projectKey, uid, partnerKey }) => {
      const talkCaptured = [];
      const mvpCaptured = [];
      if (window.TasuTalkPlatformNotify) {
        window.TasuTalkPlatformNotify.pushNotification = (p) => talkCaptured.push(p);
      }

      const state = {
        version: 1,
        owner_id: uid,
        projects: [],
        applications: [],
        specs: {},
        threads: {},
        partners: [],
      };
      const api = {
        reload: () => JSON.parse(JSON.stringify(state)),
        commit: (n) => {
          state.projects = n.projects || state.projects;
          state.applications = n.applications || state.applications;
          state.specs = n.specs || state.specs;
          state.threads = n.threads || state.threads;
          try {
            localStorage.setItem("tasful:builder:mvp:v1", JSON.stringify(state));
          } catch {
            /* ignore */
          }
        },
        pushNotification: (p) => mvpCaptured.push(p),
      };

      const created = await window.TasuBuilderGeneralJobsDualWrite.createProjectWithMirror({
        project: {
          project_id: projectKey,
          owner_id: uid,
          title: "P1 Wave1 Admin",
          kind: "builder_board",
          board_type: "project",
          status: "open",
          required_partners: 1,
          selected_partner_ids: [],
          visibility: "public",
          contact_policy: "tasful_talk_only",
          main_thread_id: null,
          source: "company",
          created_at: new Date().toISOString(),
        },
        spec: { description: "p1 wave1 admin path", trade_tags: ["内装"], area_codes: ["東京"] },
        api,
      });
      if (!created?.ok) return { ok: false, reason: "create_failed" };

      const project = created.project;
      const projectUuid = project.supabase_uuid;

      await window.TasuBuilderGeneralJobsDualWrite.applyWithMirror({
        api,
        projectId: projectKey,
        partnerId: partnerKey,
        project,
        typeCfg: { type: "project", label: "案件" },
      });

      const committed = api.reload();
      const appRow = (committed.applications || []).find(
        (a) => a.project_id === projectKey && a.partner_id === partnerKey
      );
      const applicationId = appRow?.application_id || `${projectKey}:${partnerKey}`;
      api.commit(committed);

      return {
        ok: true,
        projectKey,
        projectUuid,
        applicationId,
        talkCaptured,
        mvpCaptured,
      };
    },
    { projectKey, uid: TEST_USER.uid, partnerKey: PARTNER_KEY }
  );

  assert(setup.ok === true, "setup project + apply", projectKey);
  if (!setup.ok) {
    await context.close();
    await browser.close();
    return finish(false);
  }
  report.cleanup.push({ table: "builder_projects", id: setup.projectUuid });

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector(`[data-application-id="${setup.applicationId}"]`, { timeout: 15000 });
  assert(true, "admin list shows application");

  await page.click(`[data-application-id="${setup.applicationId}"]`);
  await page.waitForSelector(`[data-builder-admin-app-select="${setup.applicationId}"]`, { timeout: 10000 });
  await page.click(`[data-builder-admin-app-select="${setup.applicationId}"]`);

  await page.waitForTimeout(HEADED ? 2500 : 1200);

  const afterSelect = await page.evaluate(
    async ({ projectKey, projectUuid, partnerKey, applicationId }) => {
      const sb = window.TasuSupabase.getClient();
      const { data: dbProj } = await sb.from("builder_projects").select("talk_room_id,main_thread_id").eq("id", projectUuid).maybeSingle();
      const { data: dbApp } = await sb
        .from("builder_project_applications")
        .select("status,partner_key")
        .eq("project_id", projectUuid)
        .eq("partner_key", partnerKey)
        .maybeSingle();

      const raw = localStorage.getItem("tasful:builder:mvp:v1");
      const state = raw ? JSON.parse(raw) : {};
      const mvpProj = (state.projects || []).find((p) => p.project_id === projectKey);
      const mvpApp = (state.applications || []).find((a) => a.project_id === projectKey && a.partner_id === partnerKey);

      const href = dbProj?.talk_room_id
        ? window.TasuBuilderProjectTalkRoom.buildGeneralTalkHref(projectKey, dbProj.talk_room_id, { role: "partner" })
        : "";

      const notifs = (state.notifications || []).filter((n) => n.project_id === projectKey);
      const talkNotify = notifs.find((n) => n.type === "selected_talk" || n.type === "hire_confirmed_talk");

      return {
        dbTalkRoomId: dbProj?.talk_room_id || null,
        dbAppStatus: dbApp?.status || null,
        mvpAppStatus: mvpApp?.status || null,
        mvpTalkRoomId: mvpProj?.talk_room_id || mvpProj?.talkRoomId || null,
        href,
        talkNotifyHref: talkNotify?.href || null,
        applicationId,
      };
    },
    {
      projectKey: setup.projectKey,
      projectUuid: setup.projectUuid,
      partnerKey: PARTNER_KEY,
      applicationId: setup.applicationId,
    }
  );

  assert(afterSelect.dbAppStatus === "selected", "DB application selected", afterSelect.dbAppStatus);
  assert(afterSelect.mvpAppStatus === "selected", "MVP application selected", afterSelect.mvpAppStatus);
  assert(isUuid(afterSelect.dbTalkRoomId), "selected talk_room_id UUID", afterSelect.dbTalkRoomId);
  assert(String(afterSelect.href || "").includes("chat-detail.html"), "notify href chat-detail");
  assert(String(afterSelect.href || "").includes(afterSelect.dbTalkRoomId), "notify href UUID thread param");

  const rejectSetup = await page.evaluate(
    async ({ uid, partnerKey }) => {
      const projectKey = `e2e-p1w1-rej-${Date.now().toString(36)}`;
      const state = { version: 1, owner_id: uid, projects: [], applications: [], specs: {} };
      const api = {
        reload: () => JSON.parse(JSON.stringify(state)),
        commit: (n) => {
          state.projects = n.projects || state.projects;
          state.applications = n.applications || state.applications;
          localStorage.setItem("tasful:builder:mvp:v1", JSON.stringify(state));
        },
        pushNotification: () => {},
      };
      const created = await window.TasuBuilderGeneralJobsDualWrite.createProjectWithMirror({
        project: { project_id: projectKey, owner_id: uid, title: "P1 Reject", kind: "builder_board", board_type: "project" },
        spec: {},
        api,
      });
      const puuid = created.project?.supabase_uuid;
      await window.TasuBuilderGeneralJobsDualWrite.applyWithMirror({
        api,
        projectId: projectKey,
        partnerId: partnerKey,
        project: created.project,
        typeCfg: { type: "project" },
      });
      const committed = api.reload();
      const appRow = (committed.applications || []).find(
        (a) => a.project_id === projectKey && a.partner_id === partnerKey
      );
      const applicationId = appRow?.application_id || `${projectKey}:${partnerKey}`;
      api.commit(committed);
      return { projectKey, puuid, applicationId };
    },
    { uid: TEST_USER.uid, partnerKey: PARTNER_KEY }
  );
  report.cleanup.push({ table: "builder_projects", id: rejectSetup.puuid });

  await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(`[data-application-id="${rejectSetup.applicationId}"]`, { timeout: 15000 });
  await page.click(`[data-application-id="${rejectSetup.applicationId}"]`);
  await page.click(`[data-builder-admin-app-reject="${rejectSetup.applicationId}"]`);
  await page.waitForTimeout(HEADED ? 1500 : 800);

  const afterReject = await page.evaluate(async ({ puuid }) => {
    const sb = window.TasuSupabase.getClient();
    const { data: dbProj } = await sb.from("builder_projects").select("talk_room_id").eq("id", puuid).maybeSingle();
    return { talkRoomId: dbProj?.talk_room_id || null };
  }, { puuid: rejectSetup.puuid });

  assert(!afterReject.talkRoomId, "rejected no DB talk_room_id");

  if (afterSelect.href) {
    const chatRes = await page.goto(
      buildLocalPageUrl(STANDARD_LOCAL_BASE, afterSelect.href.replace(/^\.\.\//, "")),
      { waitUntil: "domcontentloaded", timeout: 20000 }
    );
    assert(chatRes?.status() === 200, "Talk chat-detail HTTP 200");
  } else {
    bad("Talk chat-detail navigate", "href missing");
  }

  const navPartner = await page.goto(buildLocalPageUrl(STANDARD_LOCAL_BASE, "builder/index.html"), {
    waitUntil: "domcontentloaded",
  });
  assert(navPartner?.status() === 200, "partner index HTTP 200");
  const partnerListHref = await page.locator('a.builder-partner-sidebar__link', { hasText: "案件一覧" }).getAttribute("href");
  assert(partnerListHref === "board-projects.html", "partner sidebar projects", partnerListHref);

  await page.goto(BOARD_URL, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.setItem("tasful:builder:mvp:role", "partner");
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  const boardBrand = await page.getAttribute(".builder-brand[href]", "href");
  const boardBack = await page.getAttribute("[data-builder-page-back]", "href");
  assert(boardBrand === "index.html", "partner brand dashboard", boardBrand);
  assert(boardBack === "board-projects.html", "partner list back", boardBack);

  assert(errors.length === 0, "Console Error 0", errors.join(" | ") || "none");

  await context.close();
  await browser.close();
  finish(fail === 0);
}

function finish(success) {
  report.decision = success ? "Go" : "No-Go";
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "result.json"), JSON.stringify(report, null, 2));
  console.log(`\n=== P1 Wave 1: ${report.decision} (${pass}/${pass + fail}) ===`);
  console.log(`Report: ${path.join(OUT, "result.json")}`);
  process.exit(success ? 0 : 1);
}

runE2E().catch((e) => {
  bad("unhandled", String(e?.message || e));
  finish(false);
});
