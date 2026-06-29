#!/usr/bin/env node
/**
 * TLV 仕上げ — 主要導線 smoke（T1/T2/T4）
 *
 *   node scripts/verify-tlv-finish-main-flow-smoke.mjs
 *   npm run verify:tlv-finish-main-flow-smoke
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findDevServerBaseUrl, buildLocalPageUrl } from "./lib/dev-server-url.mjs";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPORT_MD = path.join(ROOT, "reports/tlv-finish-t1-t2-t4-smoke.md");

const VIEWPORTS = [
  { name: "1280", width: 1280, height: 900 },
  { name: "390", width: 390, height: 844 },
];

const ROUTES = [
  { id: "index", path: "live/index.html", query: "" },
  { id: "videos", path: "live/videos.html", query: "" },
  { id: "watch", path: "live/watch.html", query: "broadcast_id=stub&talkDev=1" },
  { id: "studio", path: "live/studio.html", query: "talkDev=1" },
  { id: "creator-dashboard", path: "live/creator-dashboard.html", query: "" },
];

const results = [];
const failures = [];

function record(id, status, detail = "") {
  results.push({ id, status, detail });
  console.log(`  ${status.padEnd(5)} ${id}${detail ? ` — ${detail}` : ""}`);
}

function pass(id, detail = "") {
  record(id, "PASS", detail);
}

function fail(id, detail = "") {
  record(id, "FAIL", detail);
  failures.push(`${id}${detail ? `: ${detail}` : ""}`);
}

function isSevereConsoleError(text) {
  return !/favicon|404|Failed to load resource|\[TlvPlatformLiveBridge\]|\[TasuLiveBroadcasts\]|\[TasuLiveComments\]|Permissions policy/i.test(
    String(text || ""),
  );
}

function verifyT1Sources() {
  console.log("\n=== T1 — watch URL source checks ===\n");
  const files = [
    "live/tlv-notification-types.js",
    "live/live-notify.js",
    "live/tlv-dev-auth.js",
    "supabase/functions/live-notify/index.ts",
  ];
  for (const rel of files) {
    const src = fs.readFileSync(path.join(ROOT, rel), "utf8");
    if (src.includes("watch-live.html?id=")) fail(`t1:source:${rel}`, "legacy watch-live?id still present");
    else pass(`t1:source:${rel}`, "canonical watch.html?broadcast_id=");
  }
  const legacy = fs.readFileSync(path.join(ROOT, "live/watch-live.html"), "utf8");
  if (legacy.includes("location.replace") && legacy.includes("broadcast_id")) pass("t1:watch-live-redirect");
  else fail("t1:watch-live-redirect", "non-fatal redirect missing");
}

function writeReport({ base, verdict }) {
  const lines = [
    "# TLV 仕上げ — 主要導線 smoke（T1/T2/T4）",
    "",
    `**Date:** ${new Date().toISOString()}`,
    `**Base URL:** ${base || "n/a"}`,
    `**Verdict:** ${verdict}`,
    "",
    "## Results",
    "",
    ...results.map((r) => `- **${r.status}** \`${r.id}\`${r.detail ? ` — ${r.detail}` : ""}`),
    "",
  ];
  fs.mkdirSync(path.dirname(REPORT_MD), { recursive: true });
  fs.writeFileSync(REPORT_MD, lines.join("\n"), "utf8");
  console.log(`\nReport: ${REPORT_MD}`);
}

async function probeRoute(page, base, route, vp) {
  const tag = `${route.id}:${vp.name}`;
  const url = buildLocalPageUrl(base, route.path, route.query);
  const errors = [];
  const onConsole = (m) => {
    if (m.type() === "error" && isSevereConsoleError(m.text())) errors.push(m.text());
  };
  const onPageError = (e) => errors.push(e.message);
  page.on("console", onConsole);
  page.on("pageerror", onPageError);

  try {
    const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    const status = res?.status() ?? 0;
    if (status === 200) pass(`http:${tag}`, String(status));
    else fail(`http:${tag}`, String(status));

    if (route.id === "watch") {
      await page.waitForSelector("[data-live-watch]", { timeout: 15000 }).catch(() => null);
      const href = page.url();
      if (href.includes("broadcast_id=stub")) pass(`watch:url:${vp.name}`);
      else fail(`watch:url:${vp.name}`, href);
    }

    if (route.id === "creator-dashboard") {
      await page.waitForTimeout(2500);
      const dash = await page.evaluate(() => {
        const hasHardError = Boolean(document.querySelector(".live-error"));
        const hasFallback = Boolean(document.querySelector("[data-tlv-creator-dashboard-fallback]"));
        const hasDashboard = Boolean(
          document.querySelector(".tlv-creator-disclaimer") ||
            document.querySelector("[data-tlv-monetization-apply]") ||
            document.querySelector(".tlv-creator-summary"),
        );
        const loginTitle = document.querySelector(".live-empty__title")?.textContent || "";
        const hasLogin = /ログイン/.test(loginTitle);
        return { hasHardError, hasFallback, hasDashboard, hasLogin };
      });
      if (!dash.hasHardError && (dash.hasFallback || dash.hasDashboard || dash.hasLogin)) {
        pass(`creator-dashboard:ui:${vp.name}`, dash.hasFallback ? "fallback" : dash.hasDashboard ? "dashboard" : "login");
      } else {
        fail(`creator-dashboard:ui:${vp.name}`, JSON.stringify(dash));
      }
    }

    if (errors.length) fail(`console:${tag}`, errors.slice(0, 2).join(" | "));
    else pass(`console:${tag}`, "0 severe errors");
  } finally {
    page.off("console", onConsole);
    page.off("pageerror", onPageError);
  }
}

async function probeWatchLiveRedirect(page, base) {
  const url = buildLocalPageUrl(base, "live/watch-live.html", "id=stub&talkDev=1");
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error" && isSevereConsoleError(m.text())) errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(500);
    const href = page.url();
    const redirected =
      href.includes("broadcast_id=stub") &&
      /\/live\/watch(?:\.html)?(\?|$)/.test(href) &&
      !/\/watch-live/.test(href);
    if (redirected) pass("t1:legacy-redirect");
    else fail("t1:legacy-redirect", href);
    if (errors.length) fail("t1:legacy-redirect-console", errors.slice(0, 2).join(" | "));
    else pass("t1:legacy-redirect-console", "0 severe errors");
  } catch (err) {
    fail("t1:legacy-redirect", err.message || String(err));
  }
}

async function main() {
  console.log("\n=== TLV Finish — Main Flow Smoke (T1/T2/T4) ===\n");

  verifyT1Sources();

  let base = "";
  try {
    base = await findDevServerBaseUrl({ probePath: "live/index.html" });
    pass("dev:8788", base);
  } catch (err) {
    fail("dev:8788", err.message);
    writeReport({ base: "", verdict: "NO-GO" });
    process.exit(1);
  }

  await withPlaywrightBrowser(async (browser) => {
    for (const vp of VIEWPORTS) {
      const page = await browser.newPage();
      await page.setViewportSize({ width: vp.width, height: vp.height });
      for (const route of ROUTES) {
        await probeRoute(page, base, route, vp);
      }
      await page.close();
    }

    const redirectPage = await browser.newPage();
    await redirectPage.setViewportSize({ width: 1280, height: 900 });
    await probeWatchLiveRedirect(redirectPage, base);
    await redirectPage.close();
  });
  await closeAllBrowsers();

  const verdict = failures.length === 0 ? "GO" : "NO-GO";
  writeReport({ base, verdict });
  console.log(`\nTLV Finish Smoke ${verdict}\n`);
  process.exit(failures.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
