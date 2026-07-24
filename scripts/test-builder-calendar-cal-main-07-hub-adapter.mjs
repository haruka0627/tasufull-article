#!/usr/bin/env node
/**
 * CAL-MAIN-07 — partner-assignment Hub 読取アダプタ
 *
 *   node scripts/test-builder-calendar-cal-main-07-hub-adapter.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "./lib/playwright-browser.mjs";
import { buildLocalPageUrl, STANDARD_LOCAL_BASE } from "./lib/dev-server-url.mjs";
import {
  auditPartnerAssignmentPage,
  BUILDER_DEMO_ASSIGNMENT_PROJECT,
} from "./lib/audit-partner-assignment.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(root, "reports", "builder-calendar-cal-main-07");

const IGNORE = [
  /favicon/i,
  /Failed to load resource/i,
  /net::ERR_/i,
  /CDN|fonts\.g|placehold/i,
  /\[TasuSupabase\]/i,
  /\[TasuChat\]/i,
  /\[WriteAdapter\]/i,
  /\[Store\]/i,
  /blocked_users/i,
  /CORS policy/i,
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

function pageUrl(projectId, partnerId = "demo-partner-001") {
  const q = `role=partner&projectId=${encodeURIComponent(projectId)}&partnerId=${encodeURIComponent(partnerId)}`;
  return buildLocalPageUrl(STANDARD_LOCAL_BASE, `builder/partner-assignment.html?${q}`);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  console.log(`=== CAL-MAIN-07 Hub Adapter @ ${STANDARD_LOCAL_BASE} ===\n`);

  const probe = await fetch(
    buildLocalPageUrl(STANDARD_LOCAL_BASE, "builder/partner-assignment.html")
  ).catch(() => null);
  assert(probe?.ok, "HTTP 200 partner-assignment", `status=${probe?.status ?? "unreachable"}`);
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

  // --- legacy URL → Hub read (assignment overlay keeps demo labels) ---
  await page.goto(pageUrl("builder_demo_001"), { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("[data-partner-assignment-detail]", { timeout: 15000 });
  await page.waitForTimeout(600);

  const legacyAudit = await auditPartnerAssignmentPage(page, BUILDER_DEMO_ASSIGNMENT_PROJECT);
  assert(legacyAudit.ok, "legacy URL displays assignment", legacyAudit.issues?.join("; "));

  const legacyMeta = await page.evaluate(() => {
    const detail = document.querySelector("[data-partner-assignment-detail]");
    return {
      source: detail?.getAttribute("data-partner-assignment-source") || "",
      hubId: detail?.getAttribute("data-hub-project-id") || "",
      hasCard: Boolean(detail?.querySelector(".mvp-cal-assignment--partner")),
      hasAdapter: Boolean(window.TasuBuilderPartnerAssignmentHubAdapter),
      hasMap: Boolean(window.TasuBuilderProjectIdMap),
      hasStore: Boolean(window.TasuBuilderProjectStore),
      mvpKey: localStorage.getItem("tasful:builder:mvp:v1") ? "present" : "missing",
    };
  });
  assert(legacyMeta.hasAdapter, "Hub adapter loaded");
  assert(legacyMeta.hasMap, "IdMap loaded");
  assert(legacyMeta.hasStore, "Hub store loaded");
  assert(legacyMeta.source === "hub", "legacy URL uses hub source", legacyMeta.source);
  assert(legacyMeta.hubId === "PRJ-2026-001", "legacy resolves hub id", legacyMeta.hubId);
  assert(legacyMeta.mvpKey === "present", "MVP key not deleted");

  // --- Hub URL → Hub project fields ---
  await page.goto(pageUrl("PRJ-2026-001"), { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("[data-partner-assignment-detail]", { timeout: 15000 });
  await page.waitForTimeout(600);

  const hubMeta = await page.evaluate(() => {
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
      address: rowMap["現場住所"] || "",
      denied: Boolean(detail?.querySelector(".mvp-cal-detail__denied")),
      hasActions: Boolean(
        detail?.querySelector("[data-partner-assignment-accept], [data-partner-assignment-decline]")
      ),
    };
  });
  assert(hubMeta.source === "hub", "hub URL uses hub source", hubMeta.source);
  assert(!hubMeta.denied, "hub URL not denied");
  assert(
    hubMeta.title.includes("世田谷") || hubMeta.title.includes("外壁"),
    "hub URL shows Hub title",
    hubMeta.title
  );
  assert(
    /世田谷/.test(hubMeta.address) || hubMeta.address.length > 0,
    "hub URL shows Hub address",
    hubMeta.address
  );

  // --- unknown id → denied or empty, no crash ---
  await page.goto(pageUrl("totally-unknown-project-xyz"), {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await page.waitForSelector("[data-partner-assignment-detail]", { timeout: 15000 });
  await page.waitForTimeout(400);
  const unknownMeta = await page.evaluate(() => {
    const detail = document.querySelector("[data-partner-assignment-detail]");
    return {
      source: detail?.getAttribute("data-partner-assignment-source") || "",
      denied: Boolean(detail?.querySelector(".mvp-cal-detail__denied")),
      empty: Boolean(detail?.querySelector(".mvp-cal-detail__empty")),
      text: detail?.textContent?.trim()?.slice(0, 80) || "",
    };
  });
  assert(
    unknownMeta.denied || unknownMeta.empty || /割り当て|指定/.test(unknownMeta.text),
    "unknown id falls back safely",
    unknownMeta.text
  );

  // --- MVP-only project (no hub map) still works via MVP fallback ---
  await page.goto(pageUrl("partner-cal-demo-a", "partner-a"), {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await page.waitForSelector("[data-partner-assignment-detail]", { timeout: 15000 });
  await page.waitForTimeout(600);
  const mvpOnly = await page.evaluate(() => {
    const detail = document.querySelector("[data-partner-assignment-detail]");
    const rowMap = Object.fromEntries(
      [...(detail?.querySelectorAll(".mvp-cal-assignment__row") || [])].map((row) => [
        row.querySelector("dt")?.textContent?.trim() || "",
        row.querySelector("dd")?.textContent?.trim() || "",
      ])
    );
    return {
      source: detail?.getAttribute("data-partner-assignment-source") || "",
      title: rowMap["案件名"] || "",
      denied: Boolean(detail?.querySelector(".mvp-cal-detail__denied")),
    };
  });
  assert(!mvpOnly.denied, "MVP-only project not denied");
  assert(mvpOnly.source === "mvp", "MVP-only uses mvp source", mvpOnly.source);
  assert(/店舗内装|共同住宅/.test(mvpOnly.title), "MVP-only shows title", mvpOnly.title);

  // --- Hub miss → adapter ok:false（ページは MVP-only ケースで fallback 済み） ---
  const fallbackMeta = await page.evaluate(() => {
    const Adapter = window.TasuBuilderPartnerAssignmentHubAdapter;
    const hubFail = Adapter.tryLoadHubDetail("no-such-legacy-id", "demo-partner-001", {
      findAssignment: () => null,
    });
    return {
      hubFailOk: hubFail?.ok === false,
      reason: hubFail?.reason || "",
    };
  });
  assert(fallbackMeta.hubFailOk, "hub miss returns ok:false", fallbackMeta.reason);

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
