#!/usr/bin/env node
/**
 * TASFUL LIVE YouTube P1 Phase 10 — Creator analytics dashboard
 *
 *   npm run verify:live-youtube-p10
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl } from "./lib/dev-server-url.mjs";
import { ensureTalkJwt, loadTalkSupabaseConfig, TALK_TEST_USERS } from "./lib/talk-rls-test-auth.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const STATIC_FILES = [
  "live/creator-dashboard.html",
  "live/live-creator-dashboard.js",
  "live/live-config.js",
  "live/tlv-nav.js",
  "live/my-videos.html",
  "live/live-my-videos.js",
  "live/live.css",
  "deploy/cloudflare/dist/live/creator-dashboard.html",
  "deploy/cloudflare/dist/live/live-creator-dashboard.js",
  "deploy/cloudflare/dist/live/tlv-nav.js",
];

const VIEWPORTS = [
  { id: "mobile-390", width: 390, height: 844 },
  { id: "tablet-768", width: 768, height: 1024 },
  { id: "desktop-1280", width: 1280, height: 800 },
];

const summary = { pass: 0, fail: 0, skip: 0 };
const failures = [];

function pass(id, detail = "") {
  summary.pass += 1;
  console.log(`  PASS  ${id}${detail ? ` — ${detail}` : ""}`);
}

function fail(id, detail = "") {
  summary.fail += 1;
  failures.push(`${id}${detail ? `: ${detail}` : ""}`);
  console.log(`  FAIL  ${id}${detail ? ` — ${detail}` : ""}`);
}

function skip(id, detail = "") {
  summary.skip += 1;
  console.log(`  SKIP  ${id}${detail ? ` — ${detail}` : ""}`);
}

function read(rel) {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

function verifyStatic() {
  console.log("\n=== A. Static code ===\n");
  for (const rel of STATIC_FILES) {
    if (existsSync(path.join(ROOT, rel))) pass(`static:${rel}`);
    else fail(`static:${rel}`, "missing");
  }

  const navJs = read("live/tlv-nav.js");
  if (navJs.includes("creator-dashboard.html") && navJs.includes("収益・分析")) pass("code-nav-creator");
  else fail("code-nav-creator");

  const dashJs = read("live/live-creator-dashboard.js");
  if (
    dashJs.includes("estimateRevenueYen") &&
    dashJs.includes("data-tlv-monetization-apply") &&
    dashJs.includes("tlv-creator-disclaimer")
  ) {
    pass("code-creator-dashboard");
  } else fail("code-creator-dashboard");

  const cfgJs = read("live/live-config.js");
  if (cfgJs.includes("CREATOR_ESTIMATED_RPM_YEN") && cfgJs.includes("100")) pass("code-rpm-constant");
  else fail("code-rpm-constant");
}

async function seedPageAuth(page, jwt, talkUserId = "u_store") {
  await page.addInitScript(
    ({ token, uid }) => {
      try {
        localStorage.setItem(
          "tasu-supabase-auth",
          JSON.stringify({
            access_token: token,
            refresh_token: "verify-live-youtube-p10",
            expires_in: 3600,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            token_type: "bearer",
            user: {
              id: "verify-live-youtube-p10",
              app_metadata: { talk_user_id: uid, member_id: uid },
              user_metadata: { talk_user_id: uid },
            },
          }),
        );
        localStorage.setItem(
          "tasu_member_session",
          JSON.stringify({ id: uid, email: "verify@tasful.local", signedInAt: Date.now() }),
        );
      } catch {
        /* ignore */
      }
    },
    { token: jwt, uid: talkUserId },
  );
}

async function checkPageConsole(page, url, viewport, jwt, uid) {
  const errors = [];
  const handler = (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (/Failed to load resource: the server responded with a status of (403|404)/.test(text)) return;
    if (/functions\/v1\//.test(text)) return;
    errors.push(text);
  };
  page.on("console", handler);
  page.on("pageerror", (err) => {
    const text = err.message || "";
    if (/Failed to fetch|403|404/.test(text)) return;
    errors.push(text);
  });
  await page.setViewportSize(viewport);
  await seedPageAuth(page, jwt, uid);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2500);
  page.off("console", handler);
  return errors;
}

async function verifyViewports(base, jwtStore) {
  console.log("\n=== B. Viewport smoke ===\n");
  const pages = [
    "/live/creator-dashboard.html",
    "/live/my-videos.html",
  ];

  await withPlaywrightBrowser(async (browser) => {
    for (const vp of VIEWPORTS) {
      const page = await browser.newPage();
      for (const p of pages) {
        const errors = await checkPageConsole(page, `${base}${p}`, vp, jwtStore, "u_store");
        const slug = path.basename(p);
        if (errors.length === 0) pass(`console:${vp.id}:${slug}`);
        else fail(`console:${vp.id}:${slug}`, errors.slice(0, 2).join(" | "));
      }
      await page.close();
    }
  });
}

async function verifyDashboardUi(base, jwtStore) {
  console.log("\n=== C. Creator dashboard UI ===\n");
  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1280, height: 800 });
    await seedPageAuth(page, jwtStore, "u_store");
    await page.goto(`${base}/live/creator-dashboard.html`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".tlv-desktop-shell [data-tlv-creator-dashboard]", { timeout: 30000 });

    const summaryCards = await page.locator(".tlv-desktop-shell .tlv-creator-summary__card").count();
    if (summaryCards >= 6) pass("ui-summary-cards");
    else fail("ui-summary-cards", `count=${summaryCards}`);

    const disclaimer = await page.locator(".tlv-desktop-shell [data-tlv-creator-disclaimer]").count();
    if (disclaimer >= 1) pass("ui-disclaimer");
    else fail("ui-disclaimer");

    const monetization = await page.locator(".tlv-desktop-shell [data-tlv-creator-monetization]").count();
    if (monetization > 0) pass("ui-monetization-panel");
    else fail("ui-monetization-panel");

    const applyBtn = page.locator(".tlv-desktop-shell [data-tlv-monetization-apply]");
    const statusHint = page.locator(".tlv-desktop-shell [data-tlv-creator-monetization] .live-hint");
    if ((await applyBtn.count()) > 0 || (await statusHint.count()) > 0) pass("ui-apply-button");
    else fail("ui-apply-button");

    await page.waitForSelector(
      ".tlv-desktop-shell [data-tlv-creator-perf-list], .tlv-desktop-shell .live-empty--compact",
      { timeout: 25000 },
    );
    pass("ui-perf-list");

    await page.goto(`${base}/live/my-videos.html`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".tlv-desktop-shell .tlv-creator-dash-link", { timeout: 25000 });
    if ((await page.locator(".tlv-desktop-shell .tlv-creator-dash-link").count()) > 0) pass("ui-my-videos-link");
    else fail("ui-my-videos-link");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${base}/live/creator-dashboard.html`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".tlv-mobile-shell [data-tlv-creator-dashboard]", { timeout: 25000 });
    if ((await page.locator(".tlv-mobile-shell [data-tlv-mobile-tabbar]").count()) > 0) pass("ui-mobile-shell");
    else fail("ui-mobile-shell");
  });
}

async function verifyRegression() {
  console.log("\n=== D. Regression ===\n");
  const r = spawnSync(process.execPath, ["scripts/verify-live-youtube-p9-channel-profile.mjs"], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  const out = `${r.stdout || ""}\n${r.stderr || ""}`;
  if (/Result:\s*PASS/.test(out) && (r.status ?? 1) === 0) pass("regression:verify:live-youtube-p9");
  else fail("regression:verify:live-youtube-p9", out.split("\n").slice(-8).join(" | "));
}

async function main() {
  console.log("\n=== TASFUL LIVE YouTube P1 Phase 10 Creator Analytics ===\n");
  verifyStatic();
  await verifyRegression();

  const base = await findDevServerBaseUrl();
  if (!base) {
    skip("viewport-tests", "dev server not running");
  } else {
    pass("dev-server", base);
    const cfg = loadTalkSupabaseConfig();
    const jwtStore = await ensureTalkJwt(cfg, TALK_TEST_USERS.u_store);
    await verifyViewports(base, jwtStore);
    await verifyDashboardUi(base, jwtStore);
  }

  await closeAllBrowsers();

  console.log("\n--- Summary ---");
  console.log(`  PASS: ${summary.pass}`);
  console.log(`  FAIL: ${summary.fail}`);
  console.log(`  SKIP: ${summary.skip}`);
  console.log(`\nResult: ${summary.fail ? "FAIL" : "PASS"}\n`);
  if (failures.length) for (const f of failures) console.log(`  - ${f}`);
  process.exit(summary.fail ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
