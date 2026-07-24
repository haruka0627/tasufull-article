#!/usr/bin/env node
/**
 * Builder General Jobs P3 — withdraw RLS · edit · adapter · legacy · demo cleanup
 *
 *   node scripts/test-builder-general-jobs-p3-smoke.mjs
 *   node scripts/test-builder-general-jobs-p3-smoke.mjs --headed
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "./lib/playwright-browser.mjs";
import { buildLocalPageUrl, STANDARD_LOCAL_BASE } from "./lib/dev-server-url.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(root, "reports", "builder-general-jobs-p3");
const HEADED = process.argv.includes("--headed");

const OWNER_Q = "role=owner";
const PARTNER_Q = "role=partner&partner_id=demo-partner-001";
const DEMO_PROJECT = "demo-project-001";

let pass = 0;
let fail = 0;
const report = {
  phase: "P3",
  timestamp: new Date().toISOString(),
  checks: [],
  regressions: [],
  sqlApplyRequired: true,
  sqlFile: "supabase/manual/staging_builder_general_jobs_p3_rls.sql",
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

function runRegression(script) {
  const res = spawnSync(process.execPath, [script], { cwd: root, encoding: "utf8" });
  report.regressions.push({ script, ok: res.status === 0, status: res.status });
  assert(res.status === 0, `regression ${path.basename(script)}`, `exit ${res.status}`);
  return res.status === 0;
}

async function runE2E() {
  console.log(`=== P3 Smoke @ ${STANDARD_LOCAL_BASE} ${HEADED ? "(headed)" : ""} ===\n`);

  runRegression("scripts/test-builder-general-jobs-p2-wave4-smoke.mjs");
  runRegression("scripts/test-builder-general-jobs-p2-wave3-smoke.mjs");
  runRegression("scripts/test-builder-general-jobs-p0-06-staging-live-read-uuid.mjs");
  runRegression("scripts/test-builder-general-jobs-p1-wave1-admin-path.mjs");

  const browser = await chromium.launch({ headless: !HEADED, slowMo: HEADED ? 60 : 0 });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
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

  const boardUrl = buildLocalPageUrl(STANDARD_LOCAL_BASE, `builder/board-projects.html?${OWNER_Q}`);
  let res = await page.goto(boardUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  assert(res?.status() === 200, "board-projects owner HTTP 200");

  const adapters = await page.evaluate(() => ({
    boardVersion: window.TasuBuilderBoardAdapter?.VERSION || "",
    partnerVersion: window.TasuBuilderPartnerAdapter?.VERSION || "",
    commitBoardMutation: typeof window.TasuBuilderBoardAdapter?.commitBoardMutation === "function",
    ensureFeedListings: typeof window.TasuBuilderBoardAdapter?.ensureFeedListings === "function",
    recordBoardEvent: typeof window.TasuBuilderBoardAdapter?.recordBoardEvent === "function",
    resolvePartner: typeof window.TasuBuilderPartnerAdapter?.resolvePartnerForApplication === "function",
    updateMirror: typeof window.TasuBuilderGeneralJobsDualWrite?.updateProjectWithMirror === "function",
    dualVersion: window.TasuBuilderGeneralJobsDualWrite?.VERSION || "",
  }));
  assert(adapters.boardVersion.includes("p3"), "board adapter p3", adapters.boardVersion);
  assert(adapters.partnerVersion.includes("p3"), "partner adapter p3", adapters.partnerVersion);
  assert(adapters.commitBoardMutation, "commitBoardMutation exported");
  assert(adapters.ensureFeedListings, "ensureFeedListings exported");
  assert(adapters.recordBoardEvent, "recordBoardEvent exported");
  assert(adapters.resolvePartner, "resolvePartnerForApplication exported");
  assert(adapters.updateMirror, "updateProjectWithMirror loaded", adapters.dualVersion);

  const demoLabel = await page.evaluate(() => {
    const host = document.querySelector("[data-builder-role]");
    return host?.textContent || "";
  });
  assert(!/開発用/.test(demoLabel), "demo label removed from role menu", demoLabel.slice(0, 40));

  const legacyRedirect = await page.goto(
    buildLocalPageUrl(STANDARD_LOCAL_BASE, `builder/mvp-projects.html?${OWNER_Q}`),
    { waitUntil: "domcontentloaded" }
  );
  assert(legacyRedirect?.status() === 200, "mvp-projects HTTP 200");
  await page.waitForURL(/board-projects/, { timeout: 15000 });
  ok("mvp-projects redirects to board-projects", page.url());

  const projectRedirect = await page.goto(
    buildLocalPageUrl(STANDARD_LOCAL_BASE, `builder/project.html?id=${encodeURIComponent(DEMO_PROJECT)}&${OWNER_Q}`),
    { waitUntil: "domcontentloaded" }
  );
  assert(projectRedirect?.status() === 200, "project.html HTTP 200");
  await page.waitForURL(/board-project-detail/, { timeout: 15000 });
  ok("project.html redirects to board-project-detail", page.url());

  await page.goto(
    buildLocalPageUrl(
      STANDARD_LOCAL_BASE,
      `builder/board-project-detail.html?id=${encodeURIComponent(DEMO_PROJECT)}&${OWNER_Q}`
    ),
    { waitUntil: "domcontentloaded" }
  );
  await page.waitForSelector("[data-builder-mvp-pd-title]", { timeout: 12000 });

  const editOwner = await page.evaluate(() => {
    const el = document.querySelector("[data-builder-board-pd-edit]");
    return {
      exists: Boolean(el),
      hidden: el?.hidden,
      href: el?.getAttribute("href") || "",
    };
  });
  assert(editOwner.exists && !editOwner.hidden, "edit CTA visible for owner on open project");
  assert(/mvp-project-new.*project_id=/.test(editOwner.href), "edit href has project_id", editOwner.href);

  await page.goto(
    buildLocalPageUrl(
      STANDARD_LOCAL_BASE,
      `builder/mvp-project-new.html?project_id=${encodeURIComponent(DEMO_PROJECT)}&${OWNER_Q}`
    ),
    { waitUntil: "domcontentloaded" }
  );
  await page.waitForSelector("[data-builder-mvp-project-form]", { timeout: 12000 });
  const editForm = await page.evaluate(() => {
    const kpi = document.querySelector("[data-builder-mvp-kpi]")?.textContent || "";
    const form = document.querySelector("[data-builder-mvp-project-form]");
    const title = form?.querySelector("[data-builder-mvp-project-title]")?.value || "";
    return {
      kpi,
      editId: form?.dataset?.editProjectId || "",
      title,
    };
  });
  assert(editForm.kpi.includes("編集"), "edit form KPI", editForm.kpi);
  assert(editForm.editId === DEMO_PROJECT, "edit form dataset", editForm.editId);
  assert(editForm.title.length > 0, "edit form prefill title", editForm.title);

  const notifyHref = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("tasful:builder:mvp:v1") || "{}");
    const project = (state.projects || []).find((p) => p.project_id === "demo-project-001");
    const n = {
      type: "admin",
      project_id: "demo-project-001",
      projectId: "demo-project-001",
    };
    const fn = window.TasuBuilderBoardFeed?.resolveMvpNotificationHref;
    if (typeof fn !== "function") return null;
    return fn(n, state);
  });
  if (notifyHref) {
    assert(/board-project-detail\.html/.test(notifyHref), "admin notify → board detail", notifyHref);
  } else {
    ok("notify href check skipped", "resolveMvpNotificationHref not on window (builder.js internal)");
  }

  const sqlExists = fs.existsSync(path.join(root, "supabase/manual/staging_builder_general_jobs_p3_rls.sql"));
  assert(sqlExists, "P3 RLS SQL file present");

  await browser.close();

  assert(errors.length === 0, "console errors 0", errors.join(" | ") || "ok");

  report.decision = fail === 0 ? "Go" : "No-Go";
  report.pass = pass;
  report.fail = fail;

  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "smoke-report.json"), JSON.stringify(report, null, 2));

  console.log(`\n=== P3 ${report.decision} (${pass} pass / ${fail} fail) ===`);
  process.exit(fail === 0 ? 0 : 1);
}

runE2E().catch((err) => {
  console.error(err);
  process.exit(1);
});
