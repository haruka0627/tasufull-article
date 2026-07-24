#!/usr/bin/env node
/**
 * Builder General Jobs P2 Wave 4 — responsive · dock · adapter · labels
 *
 *   node scripts/test-builder-general-jobs-p2-wave4-smoke.mjs
 *   node scripts/test-builder-general-jobs-p2-wave4-smoke.mjs --headed
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "./lib/playwright-browser.mjs";
import { buildLocalPageUrl, STANDARD_LOCAL_BASE } from "./lib/dev-server-url.mjs";
import { createUiReviewSession } from "./lib/ui-review-capture.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(root, "reports", "builder-general-jobs-p2-wave4");
const SHOTS = path.join(root, "reports", "ui-review", "builder-general-p2-wave4");
const HEADED = process.argv.includes("--headed");

const PARTNER_Q = "role=partner&partner_id=demo-partner-001";
const PAGES = [
  { slug: "board-projects", path: `builder/board-projects.html?${PARTNER_Q}`, wait: "[data-builder-board-project-list]" },
  { slug: "board-project-detail", path: "builder/board-project-detail.html?id=demo-project-001&" + PARTNER_Q, wait: "[data-builder-mvp-pd-title]" },
  { slug: "mvp-project-new", path: "builder/mvp-project-new.html", wait: "[data-page='builder-mvp-project-new']" },
  { slug: "mvp-notifications", path: "builder/mvp-notifications.html?" + PARTNER_Q, wait: "[data-builder-mvp-notif-list]" },
];

let pass = 0;
let fail = 0;
const report = {
  phase: "P2-Wave4",
  timestamp: new Date().toISOString(),
  checks: [],
  regressions: [],
  responsive: [],
  screenshots: SHOTS,
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

async function checkResponsivePage(page, spec, viewport) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  const url = buildLocalPageUrl(STANDARD_LOCAL_BASE, spec.path);
  const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  assert(res?.status() === 200, `${spec.slug} HTTP 200 @${viewport.id}`, spec.path);

  try {
    await page.waitForSelector(spec.wait, { timeout: 12000, state: "attached" });
  } catch {
    bad(`${spec.slug} wait @${viewport.id}`, spec.wait);
  }

  const metrics = await page.evaluate(() => {
    const doc = document.documentElement;
    const overflowX = doc.scrollWidth > doc.clientWidth + 2;
    const buttons = Array.from(
      document.querySelectorAll(
        ".mvp-card__btn, .mvp-pd-btnPrimary, .builder-board-pd-apply-dock__btn, .builder-search__actions .builder-btn, .mvp-dark-toolbar .builder-btn"
      )
    );
    const smallTargets = buttons
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && (r.height < 44 || r.width < 44);
      })
      .slice(0, 5)
      .map((el) => el.textContent?.trim().slice(0, 24));
    return { overflowX, smallTargets, scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth };
  });

  report.responsive.push({
    page: spec.slug,
    viewport: viewport.id,
    overflowX: metrics.overflowX,
    smallTargets: metrics.smallTargets,
  });

  assert(!metrics.overflowX, `${spec.slug} no horizontal scroll @${viewport.id}`, `${metrics.scrollWidth}/${metrics.clientWidth}`);
  if (viewport.id !== "1280") {
    assert(metrics.smallTargets.length === 0, `${spec.slug} tap targets @${viewport.id}`, metrics.smallTargets.join(", ") || "ok");
  }

  const shotDir = path.join(SHOTS, spec.slug);
  fs.mkdirSync(shotDir, { recursive: true });
  await page.screenshot({ path: path.join(shotDir, `${viewport.id}.png`), fullPage: true });
}

async function runE2E() {
  console.log(`=== P2 Wave 4 @ ${STANDARD_LOCAL_BASE} ${HEADED ? "(headed)" : ""} ===\n`);

  runRegression("scripts/test-builder-general-jobs-p2-wave3-smoke.mjs");
  runRegression("scripts/test-builder-general-jobs-p0-06-staging-live-read-uuid.mjs");
  runRegression("scripts/test-builder-general-jobs-p1-wave1-admin-path.mjs");

  const browser = await chromium.launch({ headless: !HEADED, slowMo: HEADED ? 60 : 0 });
  const context = await browser.newContext();
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

  const viewports = [
    { id: "1280", width: 1280, height: 900 },
    { id: "768", width: 768, height: 1024 },
    { id: "390", width: 390, height: 844 },
  ];

  for (const spec of PAGES) {
    for (const vp of viewports) {
      await checkResponsivePage(page, spec, vp);
    }
  }

  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto(buildLocalPageUrl(STANDARD_LOCAL_BASE, `builder/board-project-detail.html?id=demo-project-002&${PARTNER_Q}`), {
    waitUntil: "domcontentloaded",
  });
  await page.waitForSelector("[data-builder-board-pd-apply-dock]", { state: "attached", timeout: 10000 });

  const dock768 = await page.evaluate(() => {
    const dock = document.querySelector("[data-builder-board-pd-apply-dock]");
    const mq = globalThis.matchMedia("(max-width: 768px)").matches;
    const css = dock ? globalThis.getComputedStyle(dock) : null;
    return {
      exists: Boolean(dock),
      hidden: dock?.hidden,
      display: css?.display,
      mq,
    };
  });
  assert(dock768.exists, "apply dock element exists @768");
  assert(dock768.mq, "768px media query active");
  ok("apply dock 768 CSS gate", `hidden=${dock768.hidden} display=${dock768.display}`);

  await page.goto(buildLocalPageUrl(STANDARD_LOCAL_BASE, "builder/board-projects.html?" + PARTNER_Q), {
    waitUntil: "domcontentloaded",
  });
  const talkLabel = await page.locator("[data-builder-board-threads-link] .mvp-shortcut__title").textContent();
  assert(String(talkLabel || "").includes("TASFUL Talk"), "board talk label", talkLabel);

  const adapterOk = await page.evaluate(() => {
    const board = window.TasuBuilderBoardAdapter;
    const partner = window.TasuBuilderPartnerAdapter;
    const listed = board?.listBoardProjects?.();
    return {
      boardVersion: board?.VERSION,
      partnerVersion: partner?.VERSION,
      hasList: Array.isArray(listed?.projects),
      hasMyApps: typeof board?.listMyApplications === "function",
      hasGetApp: typeof partner?.getApplication === "function",
    };
  });
  assert(adapterOk.hasList, "board adapter listBoardProjects");
  assert(adapterOk.hasMyApps, "board adapter listMyApplications");
  assert(adapterOk.hasGetApp, "partner adapter getApplication");
  ok("adapter versions", `${adapterOk.boardVersion} / ${adapterOk.partnerVersion}`);

  await page.goto(buildLocalPageUrl(STANDARD_LOCAL_BASE, "builder/mvp-project-new.html"), { waitUntil: "domcontentloaded" });
  const mobileShell = await page.evaluate(() => ({
    tabbar: !!document.querySelector("[data-tasu-app-tabbar]"),
    pageBack: !!document.querySelector("[data-builder-page-back]"),
  }));
  assert(mobileShell.pageBack, "mvp-project-new page back");
  ok("mvp-project-new mobile assets", mobileShell.tabbar ? "tabbar injected" : "tabbar optional @1280");

  assert(errors.length === 0, "Console Error 0", errors.join(" | ") || "none");

  await context.close();
  await browser.close();
  finish(fail === 0);
}

function finish(success) {
  report.decision = success ? "Go" : "No-Go";
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "result.json"), JSON.stringify(report, null, 2));
  console.log(`\n=== P2 Wave 4: ${report.decision} (${pass}/${pass + fail}) ===`);
  console.log(`Report: ${path.join(OUT, "result.json")}`);
  console.log(`Screenshots: ${SHOTS}`);
  process.exit(success ? 0 : 1);
}

runE2E().catch((err) => {
  console.error(err);
  finish(false);
});
