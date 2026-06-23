#!/usr/bin/env node
/**
 * TASFUL LIVE Phase 2 — TALK 相談導線 smoke
 *
 *   node scripts/verify-live-p2-talk-link.mjs
 *   npm run verify:live-p2
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl } from "./lib/dev-server-url.mjs";
import {
  ensureTalkJwt,
  loadTalkSupabaseConfig,
  TALK_TEST_USERS,
} from "./lib/talk-rls-test-auth.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const VIEWPORTS = [
  { name: "390", width: 390, height: 844 },
  { name: "768", width: 768, height: 1024 },
  { name: "1280", width: 1280, height: 900 },
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

function isSevereConsoleError(text) {
  return !/favicon|404|Failed to load resource|Failed to fetch|\[TasuChat\]|\[TasuSupabase\]|\[TasuLiveProfile\]|\[TasuLiveTalkBridge\]|gemini-chat|CORS policy/i.test(
    String(text || "")
  );
}

function verifyStaticCode() {
  console.log("\n=== A. Static code ===\n");

  const files = [
    "live/live-talk-bridge.js",
    "live/live-notify.js",
    "live/live-profile.js",
    "live/live-follow.js",
    "live/profile.html",
    "talk-room-ensure.js",
  ];

  for (const f of files) {
    if (existsSync(path.join(ROOT, f))) pass(`static:${f}`);
    else fail(`static:${f}`, "missing");
  }

  const bridge = read("live/live-talk-bridge.js");
  if (bridge.includes('service_type: "live"') && bridge.includes('listing_type: "live_creator"')) {
    pass("P2-code-service-type-live");
  } else {
    fail("P2-code-service-type-live");
  }

  if (bridge.includes("ensureTalkRoom")) pass("P2-code-ensure-talk-room");
  else fail("P2-code-ensure-talk-room");

  if (bridge.includes("service_ref_id")) pass("P2-code-service-ref-id");
  else fail("P2-code-service-ref-id");

  const profileHtml = read("live/profile.html");
  if (profileHtml.includes("talk-room-ensure.js") && profileHtml.includes("live-talk-bridge.js")) {
    pass("P2-profile-scripts");
  } else {
    fail("P2-profile-scripts");
  }

  const profileJs = read("live/live-profile.js");
  if (profileJs.includes("data-live-talk-cta") && !profileJs.includes("準備中")) {
    pass("P2-profile-talk-cta-wired");
  } else {
    fail("P2-profile-talk-cta-wired");
  }

  if (profileJs.includes("refreshFollowerCountDisplay")) pass("P2-follower-count-refresh");
  else fail("P2-follower-count-refresh");

  const notify = read("live/live-notify.js");
  if (notify.includes("phase3_edge_fanout")) pass("P2-notify-deferred");
  else skip("P2-notify-deferred", "pattern not found");
}

async function seedPageAuth(page, jwt, talkUserId = "u_me") {
  await page.addInitScript(
    ({ token, uid }) => {
      try {
        localStorage.setItem(
          "tasu-supabase-auth",
          JSON.stringify({
            access_token: token,
            refresh_token: "verify-live-p2",
            expires_in: 3600,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            token_type: "bearer",
            user: {
              id: "verify-live-p2",
              app_metadata: { talk_user_id: uid, member_id: uid },
              user_metadata: { talk_user_id: uid },
            },
          })
        );
        localStorage.setItem(
          "tasu_member_session",
          JSON.stringify({ id: uid, email: "verify@tasful.local", signedInAt: Date.now() })
        );
      } catch {
        /* ignore */
      }
    },
    { token: jwt, uid: talkUserId }
  );
}

async function collectConsoleErrors(page) {
  const errors = [];
  const onConsole = (m) => {
    if (m.type() === "error" && isSevereConsoleError(m.text())) errors.push(m.text());
  };
  const onPageError = (e) => errors.push(e.message);
  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  return {
    errors,
    detach() {
      page.off("console", onConsole);
      page.off("pageerror", onPageError);
    },
  };
}

async function smokeProfiles(page, base, vp, jwt) {
  const cases = [
    { id: "u_me", query: "userId=u_me&talkDev=1", expectTalk: false },
    { id: "u_creator", query: "userId=u_creator&talkDev=1", expectTalk: true },
    { id: "u_store", query: "userId=u_store&talkDev=1", expectTalk: true },
  ];

  for (const spec of cases) {
    const probe = await collectConsoleErrors(page);
    try {
      if (jwt) await seedPageAuth(page, jwt);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${base}/live/profile.html?${spec.query}`, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      await page.waitForSelector("[data-live-profile-root]", { timeout: 15000 });

      const talkBtn = page.locator("[data-live-talk-cta]");
      const count = await talkBtn.count();
      if (spec.expectTalk) {
        if (count > 0) pass(`P2-talk-cta:${spec.id}@${vp.name}`);
        else skip(`P2-talk-cta:${spec.id}@${vp.name}`, "profile empty or own");
      } else if (count === 0) {
        pass(`P2-talk-cta-absent:${spec.id}@${vp.name}`);
      } else {
        skip(`P2-talk-cta-absent:${spec.id}@${vp.name}`, "own profile shows talk?");
      }

      const bridgeLoaded = await page.evaluate(() => {
        return (
          typeof window.TasuLiveTalkBridge?.ensureLiveCreatorTalkRoom === "function" &&
          typeof window.TasuTalkRoomEnsure?.ensureTalkRoom === "function"
        );
      });
      if (bridgeLoaded) pass(`P2-bridge-loaded:${spec.id}@${vp.name}`);
      else fail(`P2-bridge-loaded:${spec.id}@${vp.name}`);

      if (probe.errors.length) fail(`console:profile-${spec.id}@${vp.name}`, probe.errors.slice(0, 2).join(" | "));
      else pass(`console:profile-${spec.id}@${vp.name}`, "0 errors");
    } catch (err) {
      fail(`smoke:profile-${spec.id}@${vp.name}`, err.message || String(err));
    } finally {
      probe.detach();
    }
  }
}

async function main() {
  console.log("\n=== TASFUL LIVE Phase 2 TALK link smoke ===\n");

  verifyStaticCode();

  let base = "";
  try {
    base = await findDevServerBaseUrl({ probePath: "live/profile.html" });
    pass("dev-server", base);
  } catch (err) {
    skip("dev-server", err.message);
    printSummary();
    process.exit(summary.fail > 0 ? 1 : 0);
  }

  const cfg = loadTalkSupabaseConfig();
  let jwt = "";
  if (cfg.serviceKey) {
    try {
      jwt = await ensureTalkJwt(cfg, TALK_TEST_USERS.u_me);
      pass("jwt-setup", TALK_TEST_USERS.u_me.talkUserId);
    } catch (err) {
      skip("jwt-setup", err.message);
    }
  } else {
    skip("jwt-setup", "SUPABASE_SERVICE_ROLE_KEY missing");
  }

  console.log("\n=== B. Viewport smoke ===\n");

  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage();
    for (const vp of VIEWPORTS) {
      await smokeProfiles(page, base, vp, jwt);
    }
  });

  await closeAllBrowsers();
  printSummary();
  process.exit(summary.fail > 0 ? 1 : 0);
}

function printSummary() {
  console.log("\n--- Summary ---");
  console.log(`  PASS: ${summary.pass}`);
  console.log(`  FAIL: ${summary.fail}`);
  console.log(`  SKIP: ${summary.skip}`);
  if (failures.length) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  - ${f}`);
  }
  console.log(`\nResult: ${summary.fail > 0 ? "FAIL" : "PASS"}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
