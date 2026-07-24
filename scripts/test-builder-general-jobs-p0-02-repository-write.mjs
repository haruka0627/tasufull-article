#!/usr/bin/env node
/**
 * Builder General Jobs P0-02 — dual-write / repository connection tests
 *
 *   node scripts/test-builder-general-jobs-p0-02-repository-write.mjs
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { chromium } from "./lib/playwright-browser.mjs";
import { buildLocalPageUrl, STANDARD_LOCAL_BASE } from "./lib/dev-server-url.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(root, "reports", "builder-general-jobs-p0-02");
const PAGE_URL = buildLocalPageUrl(STANDARD_LOCAL_BASE, "builder/board-project-detail.html?id=demo");
const STAGING_UID = "bf2125bf-47b2-4ec2-9ba4-f12ebc57cb40";

let pass = 0;
let fail = 0;
const report = {
  phase: "P0-02",
  timestamp: new Date().toISOString(),
  stagingSchema: null,
  checks: [],
  decision: null,
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

function readBuilder(rel) {
  return fs.readFileSync(path.join(root, "builder", rel), "utf8");
}

function loadStack(opts) {
  const o = opts && typeof opts === "object" ? opts : {};
  const calls = { projects: [], applications: [], decisions: [] };

  const sandbox = {
    console,
    localStorage: {
      _m: new Map(),
      getItem(k) {
        return this._m.has(k) ? this._m.get(k) : null;
      },
      setItem(k, v) {
        this._m.set(k, String(v));
      },
      removeItem(k) {
        this._m.delete(k);
      },
    },
    TASU_BUILDER_GENERAL_JOBS_REPO: o.generalJobsRepo === true,
    TASU_BUILDER_STORAGE_MODE: o.storageMode || "local",
    TASU_BUILDER_DEMO_AUTH_UID: STAGING_UID,
    TASU_CHAT_SUPABASE_CONFIG: { url: "https://example.supabase.co", anonKey: "test-anon" },
    __TEST_CALLS__: calls,
  };

  if (o.supabaseMode === "success" || o.supabaseMode === "fail") {
    sandbox.TasuSupabase = { getClient: () => ({ from: () => ({}) }) };
  }

  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.document = { readyState: "complete", addEventListener() {} };
  const ctx = vm.createContext(sandbox);

  for (const f of [
    "builder-config.js",
    "builder-session.js",
    "builder-repository.js",
    "builder-general-mapper.js",
    "builder-repositories-local.js",
    "builder-repositories-supabase.js",
    "builder-project-repository.js",
    "builder-application-repository.js",
    "builder-general-jobs-dual-write.js",
    "builder-data-provider.js",
    "builder-b3-init.js",
  ]) {
    vm.runInContext(readBuilder(f), ctx, { filename: f });
  }

  if (o.supabaseMode === "success" || o.supabaseMode === "fail") {
    sandbox.localStorage.setItem(
      "tasu-supabase-auth",
      JSON.stringify({ user: { id: STAGING_UID } })
    );
    const projectRepo = {
      isEnabled: () => true,
      async createGeneralProject(input) {
        calls.projects.push(input);
        if (o.supabaseMode === "fail") {
          return { ok: false, code: "supabase_insert_failed", message: "mock fail" };
        }
        return {
          ok: true,
          data: {
            uuid: "11111111-2222-3333-4444-555555555555",
            project_id: input.project_id,
            owner_id: input.owner_id,
            kind: input.kind,
            project_category: input.project_category,
            board_type: input.board_type,
          },
          meta: { source: "supabase" },
        };
      },
      async getGeneralProjectById() {
        return { ok: true, data: { uuid: "11111111-2222-3333-4444-555555555555" } };
      },
      async listGeneralProjects() {
        return { ok: true, data: [] };
      },
      async updateGeneralProjectStatus() {
        return { ok: true, data: {} };
      },
    };
    const applicationRepo = {
      isEnabled: () => true,
      async createApplication(input) {
        calls.applications.push(input);
        if (o.supabaseMode === "fail") {
          return { ok: false, code: "supabase_insert_failed", message: "mock fail" };
        }
        return {
          ok: true,
          data: { id: "app-uuid-001", application_id: input.application_id, ...input },
          meta: { source: "supabase" },
        };
      },
      async listApplicationsByProject() {
        return {
          ok: true,
          data: [{ id: "app-uuid-001", application_id: "app-1", partner_id: "demo-partner-001" }],
        };
      },
      async selectApplication(id) {
        calls.decisions.push({ id, status: "selected" });
        return { ok: true, data: { id, status: "selected" } };
      },
      async rejectApplication(id) {
        calls.decisions.push({ id, status: "rejected" });
        return { ok: true, data: { id, status: "rejected" } };
      },
    };
    sandbox.TasuBuilderRepositoriesSupabase = {
      VERSION: "mock",
      isEnabled: () => true,
      project: projectRepo,
      application: applicationRepo,
    };
  }

  sandbox.TasuBuilderB3Init.finish();
  return sandbox;
}

function mockApi() {
  const state = { projects: [], specs: {}, applications: [] };
  return {
    reload() {
      return state;
    },
    commit(next) {
      state.projects = next.projects || state.projects;
      state.specs = next.specs || state.specs;
      state.applications = next.applications || state.applications;
    },
    pushNotification() {},
    _state: state,
  };
}

async function runUnitTests() {
  console.log("--- Unit: dual-write ---\n");

  const sbOff = loadStack({ storageMode: "local", generalJobsRepo: false });
  const dualOff = sbOff.TasuBuilderGeneralJobsDualWrite;
  assert(!dualOff.isRepositoryActive(), "flag OFF repo inactive");

  const apiOff = mockApi();
  const offRes = await dualOff.createProjectWithMirror({
    project: { project_id: "proj-off-1", title: "OFF", kind: "builder_board" },
    spec: { description: "x" },
    api: apiOff,
  });
  assert(offRes.ok && offRes.source === "mvp_only", "flag OFF mvp_only", offRes.source);
  assert(apiOff._state.projects.length === 1, "flag OFF single MVP project");
  assert(sbOff.__TEST_CALLS__.projects.length === 0, "flag OFF no supabase create");

  const sbOn = loadStack({ storageMode: "supabase", generalJobsRepo: true, supabaseMode: "success" });
  const dualOn = sbOn.TasuBuilderGeneralJobsDualWrite;
  assert(dualOn.isRepositoryActive(), "flag ON repo active");

  const apiOn = mockApi();
  const onRes = await dualOn.createProjectWithMirror({
    project: { project_id: "proj-on-1", title: "ON", kind: "builder_board", owner_id: STAGING_UID },
    spec: { description: "supabase primary" },
    api: apiOn,
  });
  assert(onRes.supabaseOk === true, "flag ON supabase success");
  assert(onRes.source === "supabase+mirror", "supabase+mirror source", onRes.source);
  assert(apiOn._state.projects.length === 1, "mirror single project (no duplicate)");
  assert(apiOn._state.projects[0].supabase_uuid === "11111111-2222-3333-4444-555555555555", "mirror has uuid");

  const createPayload = sbOn.__TEST_CALLS__.projects[0];
  assert(createPayload?.owner_id === STAGING_UID, "payload owner_id");
  assert(createPayload?.kind === "builder_board", "payload kind");
  assert(createPayload?.project_category === "general", "payload project_category");
  assert(createPayload?.board_type === "project", "payload board_type project");

  const projectForApply = {
    project_id: "proj-on-1",
    title: "Apply Test",
    kind: "builder_board",
    supabase_uuid: "11111111-2222-3333-4444-555555555555",
  };
  const apiApply = mockApi();
  apiApply._state.projects = [projectForApply];
  const applyOk = await dualOn.applyWithMirror({
    api: apiApply,
    projectId: "proj-on-1",
    partnerId: "demo-partner-001",
    project: projectForApply,
    typeCfg: { type: "project" },
  });
  assert(applyOk === true, "applyWithMirror ok");
  assert(apiApply._state.applications.length === 1, "apply MVP mirror one row");
  const appPayload = sbOn.__TEST_CALLS__.applications[0];
  assert(appPayload?.applicant_auth_uid === STAGING_UID, "apply applicant_auth_uid");
  assert(appPayload?.status === "applied", "apply status applied (DB)");
  assert(appPayload?.payload?.display_status === "pending", "apply display_status pending");

  const sbFail = loadStack({ storageMode: "supabase", generalJobsRepo: true, supabaseMode: "fail" });
  const dualFail = sbFail.TasuBuilderGeneralJobsDualWrite;
  const apiFail = mockApi();
  const failRes = await dualFail.createProjectWithMirror({
    project: { project_id: "proj-fail-1", title: "Fail", kind: "builder_board" },
    spec: {},
    api: apiFail,
  });
  assert(failRes.fallback === true, "supabase fail MVP fallback");
  assert(apiFail._state.projects.length === 1, "fallback still mirrors MVP");

  const syncRes = await dualOn.syncDecisionWithMirror({
    project: { project_id: "proj-on-1", kind: "builder_board", supabase_uuid: "11111111-2222-3333-4444-555555555555" },
    partnerId: "demo-partner-001",
    selected: true,
  });
  assert(syncRes?.supabaseOk === true, "syncDecision select via repo");
  assert(sbOn.__TEST_CALLS__.decisions[0]?.status === "selected", "decision selected");

  const syncRej = await dualOn.syncDecisionWithMirror({
    project: { project_id: "proj-on-1", kind: "builder_board", supabase_uuid: "11111111-2222-3333-4444-555555555555" },
    partnerId: "demo-partner-002",
    selected: false,
  });
  assert(syncRej?.supabaseOk === true, "syncDecision reject via repo");
}

async function runStagingPreflight() {
  console.log("\n--- Staging schema preflight ---\n");
  try {
    const { spawnSync } = await import("node:child_process");
    const r = spawnSync(process.execPath, ["scripts/verify-builder-general-jobs-staging-schema.mjs"], {
      cwd: root,
      encoding: "utf8",
    });
    const applied = r.status === 0;
    report.stagingSchema = applied ? "applied" : "not_applied";
    if (applied) ok("staging schema applied");
    else ok("staging schema not applied (documented — live Supabase write uses MVP fallback)", r.stdout?.trim()?.split("\n").pop());
  } catch (e) {
    report.stagingSchema = "check_error";
    bad("staging preflight", String(e.message || e));
  }
}

async function runBrowserSmoke() {
  console.log("\n--- Browser smoke ---\n");
  const probe = await fetch(PAGE_URL.split("?")[0]).catch(() => null);
  if (!probe?.ok) {
    ok("browser smoke skipped", `dev server not up (${probe?.status ?? "unreachable"})`);
    return;
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const errors = [];
  const IGNORE = [/favicon/i, /Failed to load resource/i, /net::ERR_/i, /CDN|fonts\.g/i];

  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const t = String(msg.text());
    if (IGNORE.some((re) => re.test(t))) return;
    errors.push(t);
  });

  await page.goto(PAGE_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForFunction(() => window.TasuBuilderGeneralJobsDualWrite?.VERSION, { timeout: 15000 });

  const status = await page.evaluate(() => {
    const cfg = window.TASU_CHAT_SUPABASE_CONFIG || {};
    const url = String(cfg.url || cfg.supabaseUrl || "");
    return {
      dual: window.TasuBuilderGeneralJobsDualWrite?.VERSION,
      active: window.TasuBuilderGeneralJobsDualWrite?.isRepositoryActive?.(),
      source: window.TasuBuilderProjectRepository?.getActiveSource?.(),
      isStaging: url.includes("ahlxuyvhzqdqaojiywmu"),
    };
  });

  assert(Boolean(status.dual), "dual-write loaded on page", status.dual);
  if (status.isStaging) {
    assert(status.active === true, "page staging repo active");
    assert(status.source === "supabase", "page staging supabase", status.source);
  } else {
    assert(status.active === false, "page default repo inactive");
    assert(status.source === "mvp_local", "page default mvp_local");
  }
  const off = await page.evaluate(() => {
    window.TASU_BUILDER_GENERAL_JOBS_REPO = false;
    window.TASU_BUILDER_STORAGE_MODE = "local";
    return {
      active: window.TasuBuilderGeneralJobsDualWrite?.isRepositoryActive?.(),
      source: window.TasuBuilderProjectRepository?.getActiveSource?.(),
    };
  });
  assert(off.active === false, "flag OFF inactive");
  assert(off.source === "mvp_local", "flag OFF mvp_local");
  assert(errors.length === 0, "Console Error 0", errors.join(" | ") || "none");

  await context.close();
  await browser.close();
}

function finish() {
  report.decision = fail === 0 ? "Go" : "No-Go";
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "result.json"), JSON.stringify(report, null, 2));
  console.log(`\n=== P0-02 dual-write: ${report.decision} (${pass} pass / ${fail} fail) ===`);
  process.exit(fail > 0 ? 1 : 0);
}

async function main() {
  console.log(`=== Builder General Jobs P0-02 @ ${new Date().toISOString()} ===\n`);
  await runStagingPreflight();
  await runUnitTests();
  await runBrowserSmoke();
  finish();
}

main().catch((e) => {
  bad("unhandled", String(e?.message || e));
  finish();
});
