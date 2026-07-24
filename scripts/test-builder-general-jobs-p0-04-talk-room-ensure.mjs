#!/usr/bin/env node
/**
 * Builder General Jobs P0-04 — Talk Room ensure / UUID canonicalization E2E
 *
 *   node scripts/test-builder-general-jobs-p0-04-talk-room-ensure.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "./lib/playwright-browser.mjs";
import { buildLocalPageUrl, STANDARD_LOCAL_BASE } from "./lib/dev-server-url.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(root, "reports", "builder-general-jobs-p0-04");
const BOARD_URL = buildLocalPageUrl(STANDARD_LOCAL_BASE, "builder/board-project-detail.html");
const POST_URL = buildLocalPageUrl(STANDARD_LOCAL_BASE, "builder/mvp-project-new.html");

const TEST_USER = {
  email: "e2e-test@example.com",
  password: "E2eTestPass123!",
  uid: "bf2125bf-47b2-4ec2-9ba4-f12ebc57cb40",
};

let pass = 0;
let fail = 0;
const report = { phase: "P0-04", timestamp: new Date().toISOString(), checks: [], decision: null, cleanup: [] };

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

const IGNORE = [/favicon/i, /Failed to load resource/i, /net::ERR_/i, /CDN|fonts\.g/i, /\[TasuSupabase\]/i, /\[BuilderGeneralDualWrite\]/i, /\[TasuChat\]/i];

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
  await page.waitForFunction(() => window.TasuBuilderGeneralJobsDualWrite?.VERSION, { timeout: 20000 });
  await page.waitForFunction(() => window.TasuBuilderProjectTalkRoom?.ensureTalkRoomForGeneralProject, { timeout: 20000 });
  return { context, page, errors, status: res?.status() ?? 0 };
}

async function runE2E() {
  console.log(`=== P0-04 Talk Room Ensure @ ${STANDARD_LOCAL_BASE} ===\n`);
  const schemaOk = spawnSync(process.execPath, ["scripts/verify-builder-general-jobs-staging-schema.mjs"], { cwd: root }).status === 0;
  assert(schemaOk, "schema verify", "exit 0");

  const probe = await fetch(POST_URL.split("?")[0]).catch(() => null);
  assert(probe?.ok, "dev server up", `HTTP ${probe?.status ?? "unreachable"}`);
  if (!probe?.ok) return finish(false);

  const browser = await chromium.launch({ headless: true });
  const { context, page, errors, status } = await openPage(browser, POST_URL);
  assert(status === 200, "mvp-project-new HTTP 200");

  const auth = await page.evaluate(async ({ email, password }) => {
    const sb = window.TasuSupabase?.getClient?.();
    if (!sb) return { ok: false };
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    return { ok: !error, uid: data?.session?.user?.id, error: error?.message };
  }, TEST_USER);
  assert(auth.ok && auth.uid === TEST_USER.uid, "auth sign-in", auth.error || auth.uid);
  await page.reload({ waitUntil: "domcontentloaded" });

  const projectKey = `e2e-p04-${Date.now().toString(36)}`;
  const partnerKey = "demo-partner-e2e-p04";

  const created = await page.evaluate(async ({ projectKey, uid }) => {
    const state = { projects: [], specs: {}, applications: [] };
    const api = {
      reload: () => ({ ...state, projects: [...state.projects], applications: [...state.applications] }),
      commit: (n) => {
        state.projects = n.projects || state.projects;
        state.applications = n.applications || state.applications;
        window.__P04_STATE__ = state;
      },
      pushNotification: () => {},
    };
    const res = await window.TasuBuilderGeneralJobsDualWrite.createProjectWithMirror({
      project: { project_id: projectKey, title: "P0-04 Talk", kind: "builder_board", owner_id: uid },
      spec: { description: "talk ensure" },
      api,
    });
    return res;
  }, { projectKey, uid: TEST_USER.uid });

  assert(created?.supabaseOk === true, "create supabase");
  const projectUuid = created?.project?.supabase_uuid;
  report.cleanup.push({ table: "builder_projects", id: projectUuid });

  await page.evaluate(async ({ projectKey, projectUuid, partnerKey }) => {
    const state = { projects: [{ project_id: projectKey, supabase_uuid: projectUuid, kind: "builder_board" }], applications: [] };
    const api = {
      reload: () => ({ ...state }),
      commit: (n) => { state.applications = n.applications || state.applications; },
      pushNotification: () => {},
    };
    await window.TasuBuilderGeneralJobsDualWrite.applyWithMirror({
      api, projectId: projectKey, partnerId: partnerKey, project: state.projects[0], typeCfg: { type: "project" },
    });
  }, { projectKey, projectUuid, partnerKey });

  const selectFlow = await page.evaluate(async ({ projectKey, projectUuid, partnerKey, uid }) => {
    const state = {
      projects: [{ project_id: projectKey, supabase_uuid: projectUuid, kind: "builder_board", owner_id: uid, main_thread_id: "mvp-thread-p04" }],
      applications: [{ project_id: projectKey, partner_id: partnerKey, status: "applied" }],
      threads: { "mvp-thread-p04": { thread_id: "mvp-thread-p04", project_id: projectKey, messages: [], events: [] } },
    };
    const api = {
      reload: () => JSON.parse(JSON.stringify(state)),
      commit: (n) => {
        state.projects = n.projects || state.projects;
        state.applications = n.applications || state.applications;
        window.__P04_MIRROR__ = JSON.parse(JSON.stringify(state));
      },
      pushNotification: () => {},
    };
    const decision = await window.TasuBuilderGeneralJobsDualWrite.syncDecisionWithMirror({
      project: state.projects[0], partnerId: partnerKey, selected: true,
    });
    const talk = await window.TasuBuilderGeneralJobsDualWrite.syncTalkRoomAfterSelection({
      project: state.projects[0], partnerId: partnerKey, api, threadId: "mvp-thread-p04", selected: true,
    });
    const target = window.TasuBuilderProjectTalkRoom.resolveGeneralTalkTarget(
      window.__P04_MIRROR__?.projects?.[0] || state.projects[0], state
    );
    return { decision, talk, mirror: window.__P04_MIRROR__, target };
  }, { projectKey, projectUuid, partnerKey, uid: TEST_USER.uid });

  assert(selectFlow.decision?.supabaseOk === true, "select supabase");
  assert(selectFlow.talk?.ok === true, "ensureTalkRoom after select", selectFlow.talk?.mode);
  assert(Boolean(selectFlow.talk?.talkRoomId), "talkRoomId returned");

  const dbTalk = await page.evaluate(async ({ projectUuid }) => {
    const sb = window.TasuSupabase.getClient();
    const { data: project } = await sb.from("builder_projects").select("talk_room_id").eq("id", projectUuid).maybeSingle();
    const { data: app } = await sb.from("builder_project_applications").select("payload").eq("project_id", projectUuid).maybeSingle();
    return { project, app };
  }, { projectUuid });

  assert(Boolean(dbTalk.project?.talk_room_id), "DB talk_room_id", dbTalk.project?.talk_room_id);
  assert(dbTalk.app?.payload?.talk_room_id === dbTalk.project?.talk_room_id, "application payload talk_room_id");
  assert(selectFlow.mirror?.projects?.[0]?.talk_room_id === dbTalk.project?.talk_room_id, "MVP mirror talk_room_id");
  assert(selectFlow.mirror?.projects?.[0]?.main_thread_id === "mvp-thread-p04", "MVP thread fallback kept");

  if (isUuid(dbTalk.project?.talk_room_id)) {
    assert(String(selectFlow.target?.href || "").includes("chat-detail.html"), "Talk href chat-detail");
    assert(String(selectFlow.target?.href || "").includes(dbTalk.project.talk_room_id), "Talk href UUID");
  }

  const rejectFlow = await page.evaluate(async ({ partnerKey, uid }) => {
    const rejectKey = `e2e-p04-rej-${Date.now().toString(36)}`;
    const state = { projects: [], applications: [] };
    const api = { reload: () => ({ ...state }), commit: (n) => { state.projects = n.projects || state.projects; state.applications = n.applications || state.applications; }, pushNotification: () => {} };
    const created = await window.TasuBuilderGeneralJobsDualWrite.createProjectWithMirror({
      project: { project_id: rejectKey, title: "Reject", kind: "builder_board", owner_id: uid }, spec: {}, api,
    });
    const puuid = created.project?.supabase_uuid;
    await window.TasuBuilderGeneralJobsDualWrite.applyWithMirror({
      api, projectId: rejectKey, partnerId: `${partnerKey}-rej`, project: { ...created.project, supabase_uuid: puuid }, typeCfg: { type: "project" },
    });
    await window.TasuBuilderGeneralJobsDualWrite.syncDecisionWithMirror({ project: { project_id: rejectKey, supabase_uuid: puuid, kind: "builder_board" }, partnerId: `${partnerKey}-rej`, selected: false });
    const talk = await window.TasuBuilderGeneralJobsDualWrite.syncTalkRoomAfterSelection({ project: { project_id: rejectKey, supabase_uuid: puuid, kind: "builder_board" }, partnerId: `${partnerKey}-rej`, api, selected: false });
    const sb = window.TasuSupabase.getClient();
    const { data } = await sb.from("builder_projects").select("talk_room_id").eq("id", puuid).maybeSingle();
    return { talk, talkRoomId: data?.talk_room_id, puuid };
  }, { partnerKey, uid: TEST_USER.uid });

  assert(rejectFlow.talk?.skipped === true, "reject skips talk ensure");
  assert(!rejectFlow.talkRoomId, "reject no DB talk_room_id");
  if (rejectFlow.puuid) report.cleanup.push({ table: "builder_projects", id: rejectFlow.puuid });

  const fallback = await page.evaluate(() => {
    return window.TasuBuilderProjectTalkRoom.resolveGeneralTalkTarget(
      { project_id: "fb", main_thread_id: "thread-fb" },
      { threads: { "thread-fb": { thread_id: "thread-fb", project_id: "fb" } } }
    );
  });
  assert(fallback.kind === "mvp_thread", "MVP thread fallback", fallback.id);

  const detailRes = await page.goto(`${BOARD_URL}?id=${encodeURIComponent(projectKey)}`, { waitUntil: "domcontentloaded" });
  assert(detailRes?.status() === 200, "board-project-detail HTTP 200");
  assert(errors.length === 0, "Console Error 0", errors.join(" | ") || "none");

  await context.close();
  await browser.close();
  finish(fail === 0);
}

function finish(success) {
  report.decision = success ? "Go" : "No-Go";
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "result.json"), JSON.stringify(report, null, 2));
  console.log(`\n=== P0-04: ${report.decision} (${pass}/${pass + fail}) ===`);
  process.exit(success ? 0 : 1);
}

runE2E().catch((e) => { bad("unhandled", String(e?.message || e)); finish(false); });
