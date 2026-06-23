#!/usr/bin/env node
/**
 * TASFUL LIVE YouTube P1 Phase 7 — TLV UI / navigation
 *
 *   npm run verify:live-youtube-p7
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
  "live/videos.html",
  "live/watch-video.html",
  "live/index.html",
  "live/tlv-nav.js",
  "live/live.css",
  "live/live-videos.js",
  "live/live-watch-video.js",
  "deploy/cloudflare/dist/live/videos.html",
  "deploy/cloudflare/dist/live/watch-video.html",
  "deploy/cloudflare/dist/live/index.html",
  "deploy/cloudflare/dist/live/tlv-nav.js",
  "deploy/cloudflare/dist/live/live.css",
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

  const css = read("live/live.css");
  if (css.includes(".tlv-desktop-shell") && css.includes(".tlv-mobile-shell")) pass("code-dual-shell-css");
  else fail("code-dual-shell-css");

  const navJs = read("live/tlv-nav.js");
  if (navJs.includes("HOME") && navJs.includes("VIEW") && !navJs.includes("tasful-app-mobile")) {
    pass("code-tlv-nav");
  } else fail("code-tlv-nav");

  const videosHtml = read("live/videos.html");
  if (videosHtml.includes("data-tlv-desktop-shell") && videosHtml.includes("data-tlv-mobile-shell")) {
    pass("code-videos-shells");
  } else fail("code-videos-shells");

  const watchJs = read("live/live-watch-video.js");
  if (watchJs.includes("tlv-watch-layout") && watchJs.includes("fetchRelatedVideos")) pass("code-watch-layout");
  else fail("code-watch-layout");
}

async function seedPageAuth(page, jwt, talkUserId = "u_me") {
  await page.addInitScript(
    ({ token, uid }) => {
      try {
        localStorage.setItem(
          "tasu-supabase-auth",
          JSON.stringify({
            access_token: token,
            refresh_token: "verify-live-youtube-p7",
            expires_in: 3600,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            token_type: "bearer",
            user: {
              id: "verify-live-youtube-p7",
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

async function checkPageConsole(page, url, viewport) {
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
  await seedPageAuth(page, viewport._jwt);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2500);
  page.off("console", handler);
  return errors;
}

async function verifyViewports(base, jwt) {
  console.log("\n=== B. Viewport smoke (console errors) ===\n");
  const pages = [
    { path: "/live/videos.html", wait: "[data-tlv-mobile-shell], [data-tlv-desktop-shell]" },
    { path: "/live/watch-video.html?id=00000000-0000-4000-8000-000000000001", wait: "[data-live-watch-root], [data-live-watch-root-mobile]" },
    { path: "/live/admin-videos.html", wait: "[data-live-admin-videos-root], .live-empty, .live-watch-error" },
  ];

  await withPlaywrightBrowser(async (browser) => {
    for (const vp of VIEWPORTS) {
      vp._jwt = jwt;
      const page = await browser.newPage();
      for (const spec of pages) {
        const url = `${base}${spec.path}`;
        const errors = await checkPageConsole(page, url, vp);
        await page.waitForSelector(spec.wait, { timeout: 20000 }).catch(() => null);
        if (errors.length === 0) pass(`console:${vp.id}:${path.basename(spec.path)}`);
        else fail(`console:${vp.id}:${path.basename(spec.path)}`, errors.slice(0, 2).join(" | "));
      }

      await page.setViewportSize(vp);
      await seedPageAuth(page, jwt);
      await page.goto(`${base}/live/videos.html`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(500);
      const mobileVisible = vp.width < 1024
        ? await page.locator("[data-tlv-mobile-shell]").isVisible()
        : await page.locator("[data-tlv-desktop-shell]").isVisible();
      const otherHidden = vp.width < 1024
        ? !(await page.locator("[data-tlv-desktop-shell]").isVisible())
        : !(await page.locator("[data-tlv-mobile-shell]").isVisible());
      if (mobileVisible && otherHidden) pass(`shell:${vp.id}`);
      else fail(`shell:${vp.id}`, `visible=${mobileVisible} hiddenOther=${otherHidden}`);

      if (vp.width < 1024) {
        const tabs = await page.locator("[data-tlv-mobile-tabbar]").count();
        if (tabs > 0) pass(`mobile-tabbar:${vp.id}`);
        else fail(`mobile-tabbar:${vp.id}`);
      } else {
        const sidebar = await page.locator(".tlv-desktop-sidebar").count();
        if (sidebar > 0) pass(`desktop-sidebar:${vp.id}`);
        else fail(`desktop-sidebar:${vp.id}`);
      }
      await page.close();
    }
  });
}

async function verifyUiFeatures(base, jwt) {
  console.log("\n=== C. TLV UI features ===\n");
  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1280, height: 800 });
    await seedPageAuth(page, jwt);
    await page.goto(`${base}/live/videos.html`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-tlv-category-chips]", { timeout: 20000 });
    if ((await page.locator("[data-tlv-category-chips]").count()) > 0) pass("ui-desktop-chips");
    else fail("ui-desktop-chips");
    await page.waitForSelector("[data-live-videos-feed], .live-empty", { timeout: 25000 });
    if ((await page.locator("[data-live-videos-feed], .live-empty").count()) > 0) pass("ui-videos-feed");
    else fail("ui-videos-feed");

    await page.setViewportSize({ width: 390, height: 844 });
    await seedPageAuth(page, jwt);
    await page.goto(`${base}/live/videos.html`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-tlv-feed-tabs]", { timeout: 20000 });
    if ((await page.locator("[data-tlv-feed-tabs]").count()) > 0) pass("ui-mobile-feed-tabs");
    else fail("ui-mobile-feed-tabs");

    await page.goto(`${base}/live/index.html`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-tlv-mobile-tabbar]", { timeout: 15000 });
    if ((await page.locator("[data-tlv-mobile-tabbar]").count()) > 0) pass("ui-index-mobile-nav");
    else fail("ui-index-mobile-nav");
  });
}

async function verifyRegression() {
  console.log("\n=== D. Regression ===\n");
  const r = spawnSync(
    process.execPath,
    ["scripts/verify-live-youtube-p6-admin-report-ads.mjs", "--skip-nested-regression"],
    { cwd: ROOT, encoding: "utf8", maxBuffer: 20 * 1024 * 1024 },
  );
  const out = `${r.stdout || ""}\n${r.stderr || ""}`;
  if (/Result:\s*PASS/.test(out) && (r.status ?? 1) === 0) pass("regression:verify:live-youtube-p6");
  else fail("regression:verify:live-youtube-p6", out.split("\n").slice(-8).join(" | "));
}

async function main() {
  console.log("\n=== TASFUL LIVE YouTube P1 Phase 7 UI/Navigation ===\n");
  verifyStatic();

  await verifyRegression();

  const base = await findDevServerBaseUrl();
  if (!base) {
    skip("viewport-tests", "dev server not running");
  } else {
    pass("dev-server", base);
    const cfg = loadTalkSupabaseConfig();
    const jwt = await ensureTalkJwt(cfg, TALK_TEST_USERS.u_me);
    await verifyViewports(base, jwt);
    await verifyUiFeatures(base, jwt);
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
