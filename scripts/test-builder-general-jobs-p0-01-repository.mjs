#!/usr/bin/env node
/**
 * Builder General Jobs P0-01 — Repository / Auth / RLS foundation tests
 *
 *   node scripts/test-builder-general-jobs-p0-01-repository.mjs
 *
 * Unit: mapper · config routing · local repository payloads
 * Browser (optional): Console Error 0 on mvp-project-new when dev server up
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { chromium } from "./lib/playwright-browser.mjs";
import { buildLocalPageUrl, STANDARD_LOCAL_BASE } from "./lib/dev-server-url.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(root, "reports", "builder-general-jobs-p0-01");
const PAGE_URL = buildLocalPageUrl(STANDARD_LOCAL_BASE, "builder/mvp-project-new.html");
const STAGING_UID = "bf2125bf-47b2-4ec2-9ba4-f12ebc57cb40";

let pass = 0;
let fail = 0;
const report = {
  phase: "P0-01",
  timestamp: new Date().toISOString(),
  stagingUid: STAGING_UID,
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
  };
  if (o.supabaseClient) sandbox.TasuSupabase = o.supabaseClient;
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.document = { readyState: "complete", addEventListener() {} };
  const ctx = vm.createContext(sandbox);

  const files = [
    "builder-config.js",
    "builder-session.js",
    "builder-repository.js",
    "builder-general-mapper.js",
    "builder-repositories-local.js",
    "builder-repositories-supabase.js",
    "builder-project-repository.js",
    "builder-application-repository.js",
    "builder-data-provider.js",
    "builder-b3-init.js",
  ];
  for (const f of files) {
    vm.runInContext(readBuilder(f), ctx, { filename: f });
  }
  sandbox.TasuBuilderB3Init.finish();
  return sandbox;
}

async function runUnitTests() {
  console.log("--- Unit: mapper / routing / local repo ---\n");

  const sb = loadStack();
  const Mapper = sb.TasuBuilderGeneralMapper;
  const ProjectRepo = sb.TasuBuilderProjectRepository;
  const AppRepo = sb.TasuBuilderApplicationRepository;

  assert(Mapper?.VERSION, "mapper loaded");
  assert(ProjectRepo?.VERSION, "project repository facade loaded");
  assert(AppRepo?.VERSION, "application repository facade loaded");
  assert(ProjectRepo.getActiveSource() === "mvp_local", "default source mvp_local");

  const projectRow = Mapper.toGeneralProjectRow(
    {
      project_id: "proj-test-001",
      title: "P0-01 テスト案件",
      visibility: "public",
      source: "public_user",
      spec: {
        trade_tags: ["内装"],
        area_codes: ["tokyo"],
        period: { start: "2026-08-01", end: "2026-08-31" },
        description: "テスト説明",
      },
    },
    { authUserId: STAGING_UID }
  );
  assert(projectRow.owner_id === STAGING_UID, "createGeneralProject owner_id", projectRow.owner_id);
  assert(projectRow.kind === "builder_board", "kind builder_board");
  assert(projectRow.spec?.trade_tags?.includes("内装"), "spec jsonb shape");

  const appRow = Mapper.toApplicationRow(
    { project_id: "uuid-placeholder", partner_id: "demo-partner-001", status: "applied" },
    { authUserId: STAGING_UID, projectUuid: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", applicationKey: "app-001" }
  );
  assert(appRow.applicant_auth_uid === STAGING_UID, "createApplication applicant_auth_uid");
  assert(appRow.status === "applied", "application status applied");
  assert(appRow.partner_key === "demo-partner-001", "partner_key legacy");

  const created = await ProjectRepo.createGeneralProject({
    project_id: "proj-local-001",
    title: "Local Repo Test",
    owner_id: STAGING_UID,
    spec: { description: "via local repo" },
  });
  assert(created?.ok === true, "local createGeneralProject");
  assert(created?.data?.owner_id === STAGING_UID, "local project owner_id persisted");
  assert(created?.meta?.source === "mvp_local" || created?.meta?.routedSource === "mvp_local", "local source tag");

  const listed = await ProjectRepo.listGeneralProjects({ kind: "builder_board" });
  assert(listed?.ok && listed.data?.length >= 1, "local listGeneralProjects", `count=${listed?.data?.length}`);

  const applied = await AppRepo.createApplication({
    project_id: "proj-local-001",
    partner_id: "demo-partner-002",
  });
  assert(applied?.ok === true, "local createApplication");
  assert(applied?.data?.applicant_auth_uid?.includes(STAGING_UID), "local applicant uid");

  const sbSupa = loadStack({
    storageMode: "supabase",
    generalJobsRepo: true,
    supabaseClient: { getClient: () => ({ from: () => ({}) }) },
  });
  assert(sbSupa.TasuBuilderConfig.isGeneralJobsRepositoryEnabled() === true, "flag enables general jobs repo");
  assert(sbSupa.TasuBuilderProjectRepository.getActiveSource() === "supabase", "routes supabase when client stub present");

  const sbNoClient = loadStack({ storageMode: "supabase", generalJobsRepo: true });
  assert(sbNoClient.TasuBuilderProjectRepository.getActiveSource() === "mvp_local", "falls back without TasuSupabase client");
}

async function runBrowserSmoke() {
  console.log("\n--- Browser smoke (optional) ---\n");
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
  page.on("pageerror", (err) => {
    const t = String(err.message || err);
    if (IGNORE.some((re) => re.test(t))) return;
    errors.push(t);
  });

  const res = await page.goto(PAGE_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForFunction(() => window.__TASU_BUILDER_B3_READY__, { timeout: 15000 });

  const status = await page.evaluate(() => {
    const cfg = window.TASU_CHAT_SUPABASE_CONFIG || {};
    const url = String(cfg.url || cfg.supabaseUrl || "");
    return {
      b3: window.__TASU_BUILDER_B3_READY__,
      source: window.TasuBuilderProjectRepository?.getActiveSource?.(),
      mapper: Boolean(window.TasuBuilderGeneralMapper?.toGeneralProjectRow),
      isStaging: url.includes("ahlxuyvhzqdqaojiywmu"),
      repoFlag: window.TASU_BUILDER_GENERAL_JOBS_REPO,
    };
  });

  assert(res?.status() === 200, "mvp-project-new HTTP 200");
  assert(status.b3?.version, "B3 init ready", status.b3?.version);
  if (status.isStaging) {
    assert(status.source === "supabase", "page staging auto-enable supabase", status.source);
    assert(status.repoFlag === true, "staging flags ON");
  } else {
    assert(status.source === "mvp_local", "page default mvp_local");
  }
  const off = await page.evaluate(() => {
    window.TASU_BUILDER_GENERAL_JOBS_REPO = false;
    window.TASU_BUILDER_STORAGE_MODE = "local";
    return window.TasuBuilderProjectRepository?.getActiveSource?.();
  });
  assert(off === "mvp_local", "flag OFF mvp_local");
  assert(status.mapper === true, "mapper on page");
  assert(errors.length === 0, "Console Error 0", errors.join(" | ") || "none");

  await context.close();
  await browser.close();
}

function finish() {
  report.decision = fail === 0 ? "Go" : "No-Go";
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "result.json"), JSON.stringify(report, null, 2));
  console.log(`\n=== P0-01 Repository foundation: ${report.decision} (${pass} pass / ${fail} fail) ===`);
  console.log(`Report: ${path.join(OUT, "result.json")}`);
  process.exit(fail > 0 ? 1 : 0);
}

async function main() {
  console.log(`=== Builder General Jobs P0-01 @ ${new Date().toISOString()} ===\n`);
  await runUnitTests();
  await runBrowserSmoke();
  finish();
}

main().catch((e) => {
  bad("unhandled", String(e?.message || e));
  finish();
});
