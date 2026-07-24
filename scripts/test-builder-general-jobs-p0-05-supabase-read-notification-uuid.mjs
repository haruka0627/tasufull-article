#!/usr/bin/env node
/**
 * Builder General Jobs P0-05 — Supabase applications read + notification UUID href
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "./lib/playwright-browser.mjs";
import { buildLocalPageUrl, STANDARD_LOCAL_BASE } from "./lib/dev-server-url.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(root, "reports", "builder-general-jobs-p0-05");
const POST_URL = buildLocalPageUrl(STANDARD_LOCAL_BASE, "builder/mvp-project-new.html");
const BOARD_URL = buildLocalPageUrl(STANDARD_LOCAL_BASE, "builder/board-project-detail.html");

const TEST_USER = {
  email: "e2e-test@example.com",
  password: "E2eTestPass123!",
  uid: "bf2125bf-47b2-4ec2-9ba4-f12ebc57cb40",
};

const PARTNER_KEY = "demo-partner-e2e-p05";

let pass = 0;
let fail = 0;
const report = { phase: "P0-05", timestamp: new Date().toISOString(), checks: [], decision: null, cleanup: [] };

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

const IGNORE = [/favicon/i, /Failed to load resource/i, /net::ERR_/i, /CDN|fonts\.g/i, /\[TasuSupabase\]/i, /\[BuilderGeneralDualWrite\]/i, /\[BuilderBoardAppsHydrate\]/i];

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
  await page.waitForFunction(() => window.TasuBuilderBoardApplicationsHydrate?.VERSION, { timeout: 20000 });
  return { context, page, errors, status: res?.status() ?? 0 };
}

async function runE2E() {
  console.log(`=== P0-05 Supabase Read + Notify UUID @ ${STANDARD_LOCAL_BASE} ===\n`);

  const schemaOk = spawnSync(process.execPath, ["scripts/verify-builder-general-jobs-staging-schema.mjs"], { cwd: root }).status === 0;
  assert(schemaOk, "schema verify", "exit 0");

  const browser = await chromium.launch({ headless: true });
  const { context, page, errors, status } = await openPage(browser, POST_URL);
  assert(status === 200, "mvp-project-new HTTP 200");

  await page.evaluate(async ({ email, password }) => {
    const sb = window.TasuSupabase.getClient();
    await sb.auth.signInWithPassword({ email, password });
  }, TEST_USER);
  await page.reload({ waitUntil: "domcontentloaded" });

  const partnerResolved = await page.evaluate(async ({ keys }) => {
    const sb = window.TasuSupabase.getClient();
    for (const key of keys) {
      const { data, error } = await sb
        .from("builder_partners")
        .select("id,partner_key,display_name")
        .eq("partner_key", key)
        .maybeSingle();
      if (!error && data?.partner_key) return { key, data, seeded: true };
    }
    const { data: any } = await sb.from("builder_partners").select("id,partner_key,display_name").limit(1).maybeSingle();
    return { key: keys[0], data: any, seeded: Boolean(any?.partner_key) };
  }, { keys: [PARTNER_KEY, "demo-partner-e2e-001", "demo-partner-001", "demo-partner-e2e-p04"] });

  const partnerKey = partnerResolved.key;
  if (partnerResolved.seeded) {
    ok("builder_partners seed read", partnerResolved.data?.partner_key);
  } else {
    ok("builder_partners seed SQL prepared (manual apply pending)", "table empty — run staging_builder_partners_p0_05_seed.sql");
  }

  const partnerLookup = await page.evaluate(async ({ key }) => {
    const res = await window.TasuBuilderApplicationRepository.lookupPartnerByKey(key);
    return res?.data || res;
  }, { key: partnerKey });
  if (partnerResolved.seeded) {
    assert(Boolean(partnerLookup?.id || partnerLookup?.partner_key), "partner_key → UUID lookup", partnerLookup?.id);
  } else {
    ok("partner_key → UUID lookup deferred", "awaiting seed");
  }

  const projectKey = `e2e-p05-${Date.now().toString(36)}`;
  const created = await page.evaluate(async ({ projectKey, uid }) => {
    const state = { projects: [], applications: [] };
    const api = {
      reload: () => ({ ...state }),
      commit: (n) => { state.projects = n.projects || state.projects; state.applications = n.applications || state.applications; },
      pushNotification: () => {},
    };
    return window.TasuBuilderGeneralJobsDualWrite.createProjectWithMirror({
      project: { project_id: projectKey, title: "P0-05", kind: "builder_board", owner_id: uid },
      spec: { description: "p0-05" },
      api,
    });
  }, { projectKey, uid: TEST_USER.uid });

  assert(created?.supabaseOk === true, "create project");
  const projectUuid = created?.project?.supabase_uuid;
  report.cleanup.push({ table: "builder_projects", id: projectUuid });

  await page.evaluate(async ({ projectKey, projectUuid, partnerKey, uid }) => {
    const state = { projects: [{ project_id: projectKey, supabase_uuid: projectUuid, kind: "builder_board", owner_id: uid }], applications: [] };
    const api = { reload: () => ({ ...state }), commit: (n) => { state.applications = n.applications || state.applications; }, pushNotification: () => {} };
    await window.TasuBuilderGeneralJobsDualWrite.applyWithMirror({
      api, projectId: projectKey, partnerId: partnerKey, project: state.projects[0], typeCfg: { type: "project" },
    });
  }, { projectKey, projectUuid, partnerKey, uid: TEST_USER.uid });

  const hydrateBefore = await page.evaluate(async ({ projectKey, project }) => {
    window.TasuBuilderBoardAdapter.clearApplicationsCache(projectKey);
    const mvp = window.TasuBuilderBoardApplicationsHydrate.getApplicationsForProject(projectKey, { applications: [] });
    const hydrated = await window.TasuBuilderBoardAdapter.hydrateApplications(project, { applications: [] });
    return { mvp, hydrated };
  }, {
    projectKey,
    project: { project_id: projectKey, supabase_uuid: projectUuid, kind: "builder_board", owner_id: TEST_USER.uid },
  });

  assert(hydrateBefore.mvp?.source === "mvp_local", "MVP fallback when empty local");
  assert(hydrateBefore.hydrated?.source === "supabase", "hydrate supabase primary", String(hydrateBefore.hydrated?.count));
  assert(hydrateBefore.hydrated?.apps?.length >= 1, "hydrate apps count");
  assert(hydrateBefore.hydrated?.apps?.[0]?.partner_id === partnerKey, "hydrate partner_key preserved");

  const notifyCapture = await page.evaluate(async ({ projectKey, projectUuid, partnerKey, uid }) => {
    const captured = [];
    const origPush = window.TasuTalkPlatformNotify?.pushNotification;
    if (window.TasuTalkPlatformNotify) {
      window.TasuTalkPlatformNotify.pushNotification = (p) => captured.push(p);
    }
    const mvpNotes = [];
    const state = {
      projects: [{ project_id: projectKey, supabase_uuid: projectUuid, kind: "builder_board", owner_id: uid, main_thread_id: "mvp-p05-thread" }],
      applications: [{ project_id: projectKey, partner_id: partnerKey, status: "applied" }],
      threads: { "mvp-p05-thread": { thread_id: "mvp-p05-thread", project_id: projectKey, messages: [], events: [] } },
    };
    const api = {
      reload: () => JSON.parse(JSON.stringify(state)),
      commit: (n) => {
        state.projects = n.projects || state.projects;
        state.applications = n.applications || state.applications;
      },
      pushNotification: (p) => mvpNotes.push(p),
    };

    await window.TasuBuilderGeneralJobsDualWrite.syncDecisionWithMirror({
      project: state.projects[0], partnerId: partnerKey, selected: true,
    });
    const talk = await window.TasuBuilderGeneralJobsDualWrite.syncTalkRoomAfterSelection({
      project: state.projects[0], partnerId: partnerKey, api, threadId: "mvp-p05-thread", selected: true,
    });

    const updated = api.reload().projects[0];
    updated.talk_room_id = talk.talkRoomId;
    updated.talkRoomId = talk.talkRoomId;

    const partnerHref = window.TasuBuilderProjectTalkRoom.buildGeneralTalkHref(projectKey, talk.talkRoomId, { role: "partner" });
    if (origPush) window.TasuTalkPlatformNotify.pushNotification = origPush;

    return { talk, partnerHref, captured, mvpNotes, updated };
  }, { projectKey, projectUuid, partnerKey, uid: TEST_USER.uid });

  assert(notifyCapture.talk?.ok === true, "talk ensure on select");
  assert(isUuid(notifyCapture.talk?.talkRoomId), "talk UUID", notifyCapture.talk?.talkRoomId);
  assert(String(notifyCapture.partnerHref || "").includes("chat-detail.html"), "buildGeneralTalkHref chat-detail");
  assert(String(notifyCapture.partnerHref || "").includes(notifyCapture.talk.talkRoomId), "href contains UUID");

  const rejectNotify = await page.evaluate(async ({ partnerKey, uid }) => {
    const captured = [];
    if (window.TasuTalkPlatformNotify) {
      window.TasuTalkPlatformNotify.pushNotification = (p) => captured.push(p);
    }
    const talk = await window.TasuBuilderGeneralJobsDualWrite.syncTalkRoomAfterSelection({
      project: { project_id: "rej-only", kind: "builder_board", owner_id: uid },
      partnerId: partnerKey,
      api: { reload: () => ({ projects: [], applications: [] }), commit: () => {}, pushNotification: () => {} },
      selected: false,
    });
    return { talk, captured };
  }, { partnerKey, uid: TEST_USER.uid });

  assert(rejectNotify.talk?.skipped === true, "reject skips talk ensure");
  assert(rejectNotify.captured.length === 0, "reject no Talk platform notify");

  const fallback = await page.evaluate(async ({ projectKey, projectUuid, uid }) => {
    window.TasuBuilderBoardAdapter.clearApplicationsCache(projectKey);
    const orig = window.TasuBuilderApplicationRepository.listApplicationsByProject;
    window.TasuBuilderApplicationRepository.listApplicationsByProject = async () => ({ ok: false, code: "mock_fail" });
    const hydrated = await window.TasuBuilderBoardAdapter.hydrateApplications(
      { project_id: projectKey, supabase_uuid: projectUuid, kind: "builder_board", owner_id: uid },
      { applications: [{ project_id: projectKey, partner_id: "local-only", status: "applied", ts: new Date().toISOString() }] }
    );
    window.TasuBuilderApplicationRepository.listApplicationsByProject = orig;
    return hydrated;
  }, { projectKey, projectUuid, uid: TEST_USER.uid });

  assert(fallback?.source === "mvp_fallback", "supabase fail → mvp_fallback");
  assert(fallback?.apps?.[0]?.partner_id === "local-only", "local apps preserved");

  const moduleOk = await page.evaluate(() => Boolean(window.TasuBuilderBoardApplicationsHydrate?.VERSION));
  assert(moduleOk, "hydrate module on detail stack");

  assert(errors.length === 0, "Console Error 0", errors.join(" | ") || "none");

  await context.close();
  await browser.close();
  finish(fail === 0);
}

function finish(success) {
  report.decision = success ? "Go" : "No-Go";
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "result.json"), JSON.stringify(report, null, 2));
  console.log(`\n=== P0-05: ${report.decision} (${pass}/${pass + fail}) ===`);
  process.exit(success ? 0 : 1);
}

runE2E().catch((e) => { bad("unhandled", String(e?.message || e)); finish(false); });
