#!/usr/bin/env node
/**
 * TASFUL LIVE YouTube P1 Phase 8 — TLV shell extension (my-videos / profile / upload)
 *
 *   npm run verify:live-youtube-p8
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
  "live/my-videos.html",
  "live/profile.html",
  "live/video-upload.html",
  "live/tlv-nav.js",
  "live/live.css",
  "live/live-my-videos.js",
  "live/live-profile.js",
  "live/live-video-upload.js",
  "deploy/cloudflare/dist/live/my-videos.html",
  "deploy/cloudflare/dist/live/profile.html",
  "deploy/cloudflare/dist/live/video-upload.html",
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

  for (const page of ["my-videos.html", "profile.html", "video-upload.html"]) {
    const html = read(`live/${page}`);
    if (html.includes("data-tlv-desktop-shell") && html.includes("data-tlv-mobile-shell")) {
      pass(`code-shell:${page}`);
    } else fail(`code-shell:${page}`);
    if (html.includes("tlv-nav.js") && html.includes("initPageShell")) {
      pass(`code-init:${page}`);
    } else fail(`code-init:${page}`);
  }

  const navJs = read("live/tlv-nav.js");
  if (navJs.includes("initPageShell") && navJs.includes("pickContentRoot")) pass("code-tlv-nav-helpers");
  else fail("code-tlv-nav-helpers");

  const css = read("live/live.css");
  if (css.includes("tlv-mobile-content--upload") && css.includes("tlv-mobile-content--profile")) {
    pass("code-phase8-css");
  } else fail("code-phase8-css");
}

async function seedPageAuth(page, jwt, talkUserId = "u_me") {
  await page.addInitScript(
    ({ token, uid }) => {
      try {
        localStorage.setItem(
          "tasu-supabase-auth",
          JSON.stringify({
            access_token: token,
            refresh_token: "verify-live-youtube-p8",
            expires_in: 3600,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            token_type: "bearer",
            user: {
              id: "verify-live-youtube-p8",
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

async function checkPageConsole(page, url, viewport, jwt, talkUserId) {
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
  await seedPageAuth(page, jwt, talkUserId);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2500);
  page.off("console", handler);
  return errors;
}

async function verifyViewports(base, jwtMe, jwtStore) {
  console.log("\n=== B. Viewport smoke (Phase 8 pages) ===\n");
  const pages = [
    {
      path: "/live/my-videos.html",
      wait: "[data-live-my-videos-root-desktop], [data-live-my-videos-root-mobile]",
      jwt: jwtMe,
      uid: "u_me",
    },
    {
      path: "/live/profile.html?userId=u_store",
      wait: "[data-live-profile-root-desktop], [data-live-profile-root-mobile]",
      jwt: jwtStore,
      uid: "u_store",
    },
    {
      path: "/live/video-upload.html",
      wait: "[data-live-video-upload-root-desktop], [data-live-video-upload-root-mobile]",
      jwt: jwtStore,
      uid: "u_store",
    },
  ];

  await withPlaywrightBrowser(async (browser) => {
    for (const vp of VIEWPORTS) {
      const page = await browser.newPage();
      for (const spec of pages) {
        const url = `${base}${spec.path}`;
        const errors = await checkPageConsole(page, url, vp, spec.jwt, spec.uid);
        await page.waitForSelector(spec.wait, { timeout: 20000 }).catch(() => null);
        const slug = path.basename(spec.path).split("?")[0];
        if (errors.length === 0) pass(`console:${vp.id}:${slug}`);
        else fail(`console:${vp.id}:${slug}`, errors.slice(0, 2).join(" | "));
      }

      await page.setViewportSize(vp);
      await seedPageAuth(page, jwtMe, "u_me");
      await page.goto(`${base}/live/my-videos.html`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(500);
      const mobileVisible = vp.width < 1024
        ? await page.locator("[data-tlv-mobile-shell]").isVisible()
        : await page.locator("[data-tlv-desktop-shell]").isVisible();
      const otherHidden = vp.width < 1024
        ? !(await page.locator("[data-tlv-desktop-shell]").isVisible())
        : !(await page.locator("[data-tlv-mobile-shell]").isVisible());
      if (mobileVisible && otherHidden) pass(`shell:my-videos:${vp.id}`);
      else fail(`shell:my-videos:${vp.id}`, `visible=${mobileVisible} hiddenOther=${otherHidden}`);

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

async function verifyPageContent(base, jwtMe, jwtStore) {
  console.log("\n=== C. Phase 8 page content ===\n");
  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1280, height: 800 });
    await seedPageAuth(page, jwtMe, "u_me");
    await page.goto(`${base}/live/my-videos.html`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(
      ".tlv-desktop-shell [data-live-my-videos-list], .tlv-desktop-shell .live-empty, .tlv-desktop-shell .live-error",
      { timeout: 40000 },
    );
    const myVideosReady = await page.locator(
      ".tlv-desktop-shell [data-live-my-videos-list], .tlv-desktop-shell .live-empty, .tlv-desktop-shell .live-error",
    ).count();
    if (myVideosReady > 0) pass("ui-my-videos-mounted");
    else fail("ui-my-videos-mounted");

    await seedPageAuth(page, jwtStore, "u_store");
    await page.goto(`${base}/live/profile.html?userId=u_store`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(
      ".tlv-channel-header, .live-empty, .live-error",
      { timeout: 25000 },
    );
    if ((await page.locator(".tlv-channel-header, .live-empty, .live-error").count()) > 0) {
      pass("ui-profile-mounted");
    } else fail("ui-profile-mounted");

    await page.goto(`${base}/live/video-upload.html`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(
      "[data-live-video-upload-form], .live-panel--notice, .live-error",
      { timeout: 25000 },
    );
    if (
      (await page.locator("[data-live-video-upload-form], .live-panel--notice, .live-error").count()) > 0
    ) {
      pass("ui-upload-mounted");
    } else fail("ui-upload-mounted");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${base}/live/video-upload.html`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-tlv-mobile-tabbar]", { timeout: 15000 });
    await page.waitForSelector(
      ".tlv-mobile-shell [data-live-video-upload-form], .tlv-mobile-shell .live-panel--notice, .tlv-mobile-shell .live-error",
      { timeout: 25000 },
    );
    const uploadFormVisible = await page
      .locator(".tlv-mobile-shell [data-live-video-upload-form]")
      .isVisible()
      .catch(() => false);
    const noticeVisible = await page
      .locator(".tlv-mobile-shell .live-panel--notice")
      .isVisible()
      .catch(() => false);
    const errorVisible = await page.locator(".tlv-mobile-shell .live-error").isVisible().catch(() => false);
    if (uploadFormVisible || noticeVisible || errorVisible) pass("ui-upload-mobile-form");
    else fail("ui-upload-mobile-form");
  });
}

async function verifyRegression() {
  console.log("\n=== D. Regression ===\n");
  const r = spawnSync(process.execPath, ["scripts/verify-live-youtube-p7-ui-navigation.mjs"], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  const out = `${r.stdout || ""}\n${r.stderr || ""}`;
  if (/Result:\s*PASS/.test(out) && (r.status ?? 1) === 0) pass("regression:verify:live-youtube-p7");
  else fail("regression:verify:live-youtube-p7", out.split("\n").slice(-8).join(" | "));
}

async function main() {
  console.log("\n=== TASFUL LIVE YouTube P1 Phase 8 Shell Extension ===\n");
  verifyStatic();
  await verifyRegression();

  const base = await findDevServerBaseUrl();
  if (!base) {
    skip("viewport-tests", "dev server not running");
  } else {
    pass("dev-server", base);
    const cfg = loadTalkSupabaseConfig();
    const jwtMe = await ensureTalkJwt(cfg, TALK_TEST_USERS.u_me);
    const jwtStore = await ensureTalkJwt(cfg, TALK_TEST_USERS.u_store);
    await verifyViewports(base, jwtMe, jwtStore);
    await verifyPageContent(base, jwtMe, jwtStore);
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
