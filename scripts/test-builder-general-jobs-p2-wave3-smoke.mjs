#!/usr/bin/env node
/**
 * Builder General Jobs P2 Wave 3 — withdraw · my-applications · edit hide · search
 *
 *   node scripts/test-builder-general-jobs-p2-wave3-smoke.mjs
 *   node scripts/test-builder-general-jobs-p2-wave3-smoke.mjs --headed
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "./lib/playwright-browser.mjs";
import { buildLocalPageUrl, STANDARD_LOCAL_BASE } from "./lib/dev-server-url.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(root, "reports", "builder-general-jobs-p2-wave3");
const HEADED = process.argv.includes("--headed");
const BOARD_URL = buildLocalPageUrl(STANDARD_LOCAL_BASE, "builder/board-projects.html");
const DETAIL_BASE = buildLocalPageUrl(STANDARD_LOCAL_BASE, "builder/board-project-detail.html");

const PARTNER_KEY = "demo-partner-001";
const OWNER_UID = "demo-owner-001";

let pass = 0;
let fail = 0;
const report = {
  phase: "P2-Wave3",
  timestamp: new Date().toISOString(),
  checks: [],
  regressions: [],
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
  const success = res.status === 0;
  report.regressions.push({ script, ok: success, status: res.status });
  assert(success, `regression ${path.basename(script)}`, `exit ${res.status}`);
  return success;
}

async function openBoardPage(browser, query = "") {
  const url = `${BOARD_URL}${query ? (BOARD_URL.includes("?") ? "&" : "?") + query : ""}`;
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
  const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForFunction(() => window.TasuBuilderGeneralJobsDualWrite?.withdrawWithMirror, { timeout: 25000 });
  return { context, page, errors, status: res?.status() ?? 0 };
}

async function runE2E() {
  console.log(`=== P2 Wave 3 Smoke @ ${STANDARD_LOCAL_BASE} ${HEADED ? "(headed)" : ""} ===\n`);

  runRegression("scripts/test-builder-general-jobs-p0-06-staging-live-read-uuid.mjs");
  runRegression("scripts/test-builder-general-jobs-p1-wave1-admin-path.mjs");
  runRegression("scripts/test-builder-general-jobs-p0-04-talk-room-ensure.mjs");
  runRegression("scripts/test-builder-general-jobs-p0-05-supabase-read-notification-uuid.mjs");

  const browser = await chromium.launch({ headless: !HEADED, slowMo: HEADED ? 80 : 0 });
  const partnerQ = `role=partner&partner_id=${encodeURIComponent(PARTNER_KEY)}`;
  const { context, page, errors, status } = await openBoardPage(browser, partnerQ);

  assert(status === 200, "board-projects HTTP 200");
  assert(Boolean(await page.evaluate(() => !!window.TasuBuilderGeneralJobsDualWrite?.withdrawWithMirror)), "withdrawWithMirror loaded");
  assert(Boolean(await page.evaluate(() => !!window.TasuBuilderSearchUiAdapter?.filterFromBoardQuery)), "filterFromBoardQuery loaded");

  const setup = await page.evaluate(
    async ({ partnerKey, ownerUid }) => {
      const projectKey = `e2e-p2w3-${Date.now().toString(36)}`;
      const state = {
        version: 1,
        owner_id: ownerUid,
        projects: [],
        applications: [],
        specs: {},
        withdrawn_board_applications: [],
      };
      const api = {
        reload: () => JSON.parse(JSON.stringify(state)),
        commit: (n) => {
          Object.assign(state, n);
          try {
            localStorage.setItem("tasful:builder:mvp:v1", JSON.stringify(state));
          } catch {
            /* ignore */
          }
        },
        pushNotification: () => {},
      };

      const project = {
        project_id: projectKey,
        owner_id: ownerUid,
        title: "P2 Wave3 内装 東京",
        kind: "builder_board",
        board_type: "project",
        status: "open",
        required_partners: 1,
        selected_partner_ids: [],
        visibility: "public",
        contact_policy: "tasful_talk_only",
        created_at: new Date().toISOString(),
      };
      state.projects = [project];
      state.specs = {
        [projectKey]: {
          trade_tags: ["内装"],
          area_codes: ["東京"],
          description: "P2 wave3 smoke",
        },
      };
      api.commit(state);

      const applied = await window.TasuBuilderGeneralJobsDualWrite.applyWithMirror({
        api,
        projectId: projectKey,
        partnerId: partnerKey,
        project,
        typeCfg: { type: "project", label: "案件" },
      });
      if (!applied) return { ok: false, reason: "apply_failed" };

      const withdrawn = await window.TasuBuilderGeneralJobsDualWrite.withdrawWithMirror({
        api,
        projectId: projectKey,
        partnerId: partnerKey,
        project,
      });

      const afterWithdraw = api.reload();
      const appGone = !(afterWithdraw.applications || []).some(
        (a) => a.project_id === projectKey && a.partner_id === partnerKey
      );
      const withdrawnRecorded = (afterWithdraw.withdrawn_board_applications || []).some(
        (w) => w.project_id === projectKey && w.partner_id === partnerKey
      );

      await window.TasuBuilderGeneralJobsDualWrite.applyWithMirror({
        api,
        projectId: projectKey,
        partnerId: partnerKey,
        project,
        typeCfg: { type: "project" },
      });

      return {
        ok: true,
        projectKey,
        withdrawn,
        appGone,
        withdrawnRecorded,
      };
    },
    { partnerKey: PARTNER_KEY, ownerUid: OWNER_UID }
  );

  assert(setup.ok === true, "setup apply/withdraw/re-apply", setup.projectKey);
  assert(setup.withdrawn === true, "withdrawWithMirror true");
  assert(setup.appGone === true, "MVP application removed after withdraw");
  assert(setup.withdrawnRecorded === true, "withdrawn_board_applications recorded");

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector(`[data-project-id="${setup.projectKey}"]`, { timeout: 15000 });

  const myAppsUrl = buildLocalPageUrl(
    STANDARD_LOCAL_BASE,
    `builder/board-projects.html?view=my-applications&${partnerQ}`
  );
  const myAppsRes = await page.goto(myAppsUrl, { waitUntil: "domcontentloaded" });
  assert(myAppsRes?.status() === 200, "my-applications HTTP 200");
  await page.waitForSelector(`[data-project-id="${setup.projectKey}"]`, { timeout: 10000 });
  const myAppsHasProject = await page.locator(`[data-project-id="${setup.projectKey}"]`).count();
  assert(myAppsHasProject >= 1, "my-applications lists applied project", String(myAppsHasProject));

  const myAppsShortcut = await page.locator("[data-builder-board-my-apps-link]").isVisible();
  assert(myAppsShortcut, "my-applications shortcut visible for partner");

  const detailUrl = `${DETAIL_BASE}?id=${encodeURIComponent(setup.projectKey)}&${partnerQ}`;
  await page.goto(detailUrl, { waitUntil: "domcontentloaded" });
  const editHiddenForPartner = await page.evaluate(() => {
    const el = document.querySelector("[data-builder-board-pd-edit]");
    return !el || el.hidden || !el.offsetParent;
  });
  assert(editHiddenForPartner, "edit link hidden for partner (P3 owner-only)");

  const withdrawVisible = await page.locator("[data-builder-board-pd-withdraw]").isVisible();
  assert(withdrawVisible, "withdraw button visible on detail");

  page.once("dialog", (d) => d.accept());
  await page.click("[data-builder-board-pd-withdraw]");
  await page.waitForTimeout(HEADED ? 1200 : 600);

  const afterUiWithdraw = await page.evaluate(
    ({ projectKey, partnerKey }) => {
      const raw = localStorage.getItem("tasful:builder:mvp:v1");
      const state = raw ? JSON.parse(raw) : {};
      const app = (state.applications || []).find(
        (a) => a.project_id === projectKey && a.partner_id === partnerKey
      );
      return { hasApp: Boolean(app) };
    },
    { projectKey: setup.projectKey, partnerKey: PARTNER_KEY }
  );
  assert(!afterUiWithdraw.hasApp, "UI withdraw removed MVP application");

  await page.goto(`${BOARD_URL}?${partnerQ}`, { waitUntil: "domcontentloaded" });
  const searchForm = page.locator("[data-builder-board-search-form]");
  await searchForm.locator("[data-builder-board-search-q]").fill("P2 Wave3");
  await searchForm.locator("[data-builder-board-search-trade]").fill("内装");
  await searchForm.locator("[data-builder-board-search-area]").selectOption("tokyo");
  await searchForm.locator("button[type=submit]").click();
  await page.waitForTimeout(HEADED ? 800 : 400);
  const searchHits = await page.locator(`[data-project-id="${setup.projectKey}"]`).count();
  assert(searchHits >= 1, "keyword/trade/area search finds project");

  await searchForm.locator("[data-builder-board-search-reset]").click();
  await page.waitForTimeout(HEADED ? 500 : 250);
  const afterReset = await page.locator("[data-builder-board-project-list] .mvp-card").count();
  assert(afterReset >= 1, "search reset shows cards", String(afterReset));

  assert(errors.length === 0, "Console Error 0", errors.join(" | ") || "none");

  await context.close();
  await browser.close();
  finish(fail === 0);
}

function finish(success) {
  report.decision = success ? "Go" : "No-Go";
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "result.json"), JSON.stringify(report, null, 2));
  console.log(`\n=== P2 Wave 3: ${report.decision} (${pass}/${pass + fail}) ===`);
  console.log(`Report: ${path.join(OUT, "result.json")}`);
  process.exit(success ? 0 : 1);
}

runE2E().catch((err) => {
  console.error(err);
  finish(false);
});
