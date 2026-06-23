#!/usr/bin/env node
/**
 * TASFUL LIVE YouTube P1 Phase 9 — channel profile enhancement
 *
 *   npm run verify:live-youtube-p9
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
  "live/profile.html",
  "live/live-profile.js",
  "live/live-videos.js",
  "live/live-follow.js",
  "live/live.css",
  "deploy/cloudflare/dist/live/profile.html",
  "deploy/cloudflare/dist/live/live-profile.js",
  "deploy/cloudflare/dist/live/live-videos.js",
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

  const profileJs = read("live/live-profile.js");
  if (profileJs.includes("tlv-channel-header") && profileJs.includes("mountChannelTabsOnRoot")) {
    pass("code-channel-profile");
  } else fail("code-channel-profile");

  const videosJs = read("live/live-videos.js");
  if (
    videosJs.includes("fetchCreatorChannelStats") &&
    videosJs.includes("bindChannelTabs") &&
    videosJs.includes("renderChannelTabContent")
  ) {
    pass("code-channel-videos");
  } else fail("code-channel-videos");

  const css = read("live/live.css");
  if (css.includes(".tlv-channel-tabs") && css.includes(".tlv-channel-grid")) pass("code-channel-css");
  else fail("code-channel-css");

  const followJs = read("live/live-follow.js");
  if (followJs.includes("channelMode") && followJs.includes("ログインして登録")) pass("code-channel-follow");
  else fail("code-channel-follow");
}

async function seedPageAuth(page, jwt, talkUserId = "u_me") {
  await page.addInitScript(
    ({ token, uid }) => {
      try {
        localStorage.setItem(
          "tasu-supabase-auth",
          JSON.stringify({
            access_token: token,
            refresh_token: "verify-live-youtube-p9",
            expires_in: 3600,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            token_type: "bearer",
            user: {
              id: "verify-live-youtube-p9",
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

async function verifyViewports(base, jwtStore, jwtMe) {
  console.log("\n=== B. Viewport smoke ===\n");
  const pages = [
    { path: "/live/profile.html?userId=u_store", jwt: jwtStore, uid: "u_store", label: "other" },
    { path: "/live/profile.html?userId=u_store", jwt: jwtMe, uid: "u_me", label: "other-as-me" },
    { path: "/live/profile.html?userId=u_me", jwt: jwtMe, uid: "u_me", label: "own" },
  ];

  await withPlaywrightBrowser(async (browser) => {
    for (const vp of VIEWPORTS) {
      const page = await browser.newPage();
      for (const spec of pages) {
        const url = `${base}${spec.path}`;
        const errors = await checkPageConsole(page, url, vp, spec.jwt, spec.uid);
        await page.waitForSelector("[data-tlv-channel], .live-error", { timeout: 20000 }).catch(() => null);
        if (errors.length === 0) pass(`console:${vp.id}:${spec.label}`);
        else fail(`console:${vp.id}:${spec.label}`, errors.slice(0, 2).join(" | "));
      }

      await page.setViewportSize(vp);
      await seedPageAuth(page, jwtStore, "u_store");
      await page.goto(`${base}/live/profile.html?userId=u_store`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(500);
      const mobileVisible = vp.width < 1024
        ? await page.locator("[data-tlv-mobile-shell]").isVisible()
        : await page.locator("[data-tlv-desktop-shell]").isVisible();
      if (mobileVisible) pass(`shell:${vp.id}`);
      else fail(`shell:${vp.id}`);
      await page.close();
    }
  });
}

async function verifyChannelUi(base, jwtStore, jwtMe) {
  console.log("\n=== C. Channel UI ===\n");
  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1280, height: 800 });
    await seedPageAuth(page, jwtStore, "u_store");
    await page.goto(`${base}/live/profile.html?userId=u_store`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-tlv-channel-header]", { timeout: 25000 });

    const headerParts = [
      ".tlv-channel-header__name",
      ".tlv-channel-header__handle",
      "[data-channel-stat-videos]",
      "[data-live-follower-count]",
      "[data-channel-stat-views]",
    ];
    for (const sel of headerParts) {
      if ((await page.locator(sel).count()) > 0) pass(`ui-header:${sel}`);
      else fail(`ui-header:${sel}`);
    }

    await page.waitForSelector("[data-tlv-channel-tabs]", { timeout: 15000 });
    const tabCount = await page.locator("[data-tlv-channel-tab]").count();
    if (tabCount >= 5) pass("ui-channel-tabs");
    else fail("ui-channel-tabs", `count=${tabCount}`);

    await page.waitForSelector(".tlv-desktop-shell [data-live-profile-videos-grid], .tlv-desktop-shell .tlv-channel-empty", {
      timeout: 25000,
    });
    if (
      (await page.locator(".tlv-desktop-shell [data-live-profile-videos-grid], .tlv-desktop-shell .tlv-channel-empty").count()) > 0
    ) {
      pass("ui-videos-tab-content");
    } else fail("ui-videos-tab-content");

    await page.locator('.tlv-desktop-shell [data-tlv-channel-tab="popular"]').click();
    await page.waitForSelector(".tlv-desktop-shell [data-live-profile-videos-grid], .tlv-desktop-shell .tlv-channel-empty", {
      timeout: 20000,
    });
    pass("ui-tab-popular");

    await page.locator('.tlv-desktop-shell [data-tlv-channel-tab="new"]').click();
    await page.waitForSelector(".tlv-desktop-shell [data-live-profile-videos-grid], .tlv-desktop-shell .tlv-channel-empty", {
      timeout: 20000,
    });
    pass("ui-tab-new");

    await page.locator('.tlv-desktop-shell [data-tlv-channel-tab="shorts"]').click();
    await page.waitForSelector(".tlv-desktop-shell [data-tlv-channel-grid], .tlv-desktop-shell .tlv-channel-empty", {
      timeout: 20000,
    });
    pass("ui-tab-shorts");

    await seedPageAuth(page, jwtMe, "u_me");
    await page.goto(`${base}/live/profile.html?userId=u_store`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".tlv-desktop-shell [data-live-follow-btn], .tlv-desktop-shell .live-follow-slot a", {
      timeout: 20000,
    });
    const followBtn = page.locator(".tlv-desktop-shell [data-live-follow-btn], .tlv-desktop-shell .live-follow-slot a");
    if ((await followBtn.count()) > 0) pass("ui-follow-cta");
    else fail("ui-follow-cta");

    await page.setViewportSize({ width: 390, height: 844 });
    await seedPageAuth(page, jwtStore, "u_store");
    await page.goto(`${base}/live/profile.html?userId=u_store`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-tlv-mobile-tabbar]", { timeout: 15000 });
    if ((await page.locator("[data-tlv-mobile-tabbar]").count()) > 0) pass("ui-mobile-tabbar");
    else fail("ui-mobile-tabbar");

    await page.evaluate(() => {
      localStorage.removeItem("tasu-supabase-auth");
      localStorage.removeItem("tasu_member_session");
    });
    await page.goto(`${base}/live/profile.html?userId=u_store`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".tlv-mobile-shell [data-tlv-channel-header]", { timeout: 20000 });
    await page.locator('.tlv-mobile-shell [data-tlv-channel-tab="videos"]').click();
    await page.waitForTimeout(500);
    pass("ui-guest-channel");
  });
}

async function verifyRegression() {
  console.log("\n=== D. Regression ===\n");
  const r = spawnSync(process.execPath, ["scripts/verify-live-youtube-p8-shell-extension.mjs"], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  const out = `${r.stdout || ""}\n${r.stderr || ""}`;
  if (/Result:\s*PASS/.test(out) && (r.status ?? 1) === 0) pass("regression:verify:live-youtube-p8");
  else fail("regression:verify:live-youtube-p8", out.split("\n").slice(-8).join(" | "));
}

async function main() {
  console.log("\n=== TASFUL LIVE YouTube P1 Phase 9 Channel Profile ===\n");
  verifyStatic();
  await verifyRegression();

  const base = await findDevServerBaseUrl();
  if (!base) {
    skip("viewport-tests", "dev server not running");
  } else {
    pass("dev-server", base);
    const cfg = loadTalkSupabaseConfig();
    const jwtStore = await ensureTalkJwt(cfg, TALK_TEST_USERS.u_store);
    const jwtMe = await ensureTalkJwt(cfg, TALK_TEST_USERS.u_me);
    await verifyViewports(base, jwtStore, jwtMe);
    await verifyChannelUi(base, jwtStore, jwtMe);
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
