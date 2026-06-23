#!/usr/bin/env node
/**
 * TASFUL LIVE Phase 3 — ショートフィード / 投稿 / いいね smoke
 *
 *   node scripts/verify-live-p3-shorts.mjs
 *   npm run verify:live-p3
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

const STATIC_FILES = [
  "live/shorts.html",
  "live/short-upload.html",
  "live/live-shorts.js",
  "live/live-short-upload.js",
  "live/live-config.js",
  "live/live.css",
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
  return !/favicon|404|Failed to load resource|Failed to fetch|\[TasuChat\]|\[TasuSupabase\]|\[TasuLiveProfile\]|\[TasuLiveShorts\] signed URL failed|\[TasuLiveTalkBridge\]|gemini-chat|CORS policy/i.test(
    String(text || "")
  );
}

function verifyStaticCode() {
  console.log("\n=== A. Static code ===\n");

  for (const rel of STATIC_FILES) {
    if (existsSync(path.join(ROOT, rel))) pass(`static:${rel}`);
    else fail(`static:${rel}`, "missing");
  }

  const bc = read("breadcrumb-config.js");
  if (bc.includes('"live/shorts.html"') && bc.includes('"live/short-upload.html"')) {
    pass("static:breadcrumb-shorts");
  } else {
    fail("static:breadcrumb-shorts");
  }

  const cfg = read("live/live-config.js");
  if (cfg.includes("LIVE_SIGNED_URL_TTL_SECONDS = 300")) pass("P3-code-signed-ttl-300");
  else fail("P3-code-signed-ttl-300");
  if (cfg.includes('STORAGE_BUCKET_SHORT_VIDEOS = "short-videos"')) pass("P3-code-bucket-short-videos");
  else fail("P3-code-bucket-short-videos");
  if (cfg.includes('shorts: "live_shorts"') && cfg.includes('likes: "live_short_likes"')) {
    pass("P3-code-tables");
  } else {
    fail("P3-code-tables");
  }

  const shortsJs = read("live/live-shorts.js");
  if (shortsJs.includes('eq("status", "published")')) pass("P3-code-feed-published");
  else fail("P3-code-feed-published");
  if (shortsJs.includes("getSignedShortVideoUrl") && shortsJs.includes("TABLES.likes")) {
    pass("P3-code-likes");
  } else {
    fail("P3-code-likes");
  }

  const uploadJs = read("live/live-short-upload.js");
  if (uploadJs.includes("video/mp4") && uploadJs.includes("LIVE_SHORT_MAX_DURATION_SEC")) {
    pass("P3-code-upload-mp4-duration");
  } else {
    fail("P3-code-upload-mp4-duration");
  }
  if (uploadJs.includes("STORAGE_BUCKET_SHORT_VIDEOS") || uploadJs.includes("short-videos")) {
    pass("P3-code-upload-bucket");
  } else {
    fail("P3-code-upload-bucket");
  }
  if (uploadJs.includes('from(cfg.TABLES.shorts)')) pass("P3-code-insert-live-shorts");
  else fail("P3-code-insert-live-shorts");

  const indexHtml = read("live/index.html");
  if (indexHtml.includes('href="shorts.html"') && indexHtml.includes('href="short-upload.html"')) {
    pass("P3-code-index-links");
  } else {
    fail("P3-code-index-links");
  }
}

async function seedPageAuth(page, jwt, talkUserId = "u_me") {
  await page.addInitScript(
    ({ token, uid }) => {
      try {
        localStorage.setItem(
          "tasu-supabase-auth",
          JSON.stringify({
            access_token: token,
            refresh_token: "verify-live-p3",
            expires_in: 3600,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            token_type: "bearer",
            user: {
              id: "verify-live-p3",
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

async function smokeViewport(page, base, vp, jwt) {
  const pages = [
    {
      id: "shorts",
      path: "live/shorts.html?talkDev=1",
      selector: "[data-live-shorts-root]",
      title: "ショートフィード",
    },
    {
      id: "upload",
      path: "live/short-upload.html?talkDev=1",
      selector: "[data-live-upload-root]",
      title: "ショート投稿",
      formSelector: "[data-live-upload-form]",
    },
  ];

  for (const spec of pages) {
    const probe = await collectConsoleErrors(page);
    try {
      if (jwt) await seedPageAuth(page, jwt);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${base}/${spec.path}`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForSelector(spec.selector, { timeout: 15000 });
      await page.waitForTimeout(900);

      const header = await page.locator(".live-header__title").first().textContent();
      if (String(header || "").includes(spec.title)) {
        pass(`UI:${spec.id}@${vp.name}`, spec.title);
      } else {
        fail(`UI:${spec.id}@${vp.name}`, header || "no title");
      }

      if (spec.id === "shorts") {
        const feedOrEmpty = page.locator("[data-live-shorts-feed], .live-empty, .live-error");
        if ((await feedOrEmpty.count()) > 0) pass(`UI:shorts-mounted@${vp.name}`);
        else fail(`UI:shorts-mounted@${vp.name}`, "no feed/empty");
      }

      if (spec.formSelector && jwt) {
        const form = page.locator(spec.formSelector);
        if ((await form.count()) > 0) pass(`UI:upload-form@${vp.name}`);
        else fail(`UI:upload-form@${vp.name}`, "form missing");
      }

      if (probe.errors.length) {
        fail(`console:${spec.id}@${vp.name}`, probe.errors.slice(0, 2).join(" | "));
      } else {
        pass(`console:${spec.id}@${vp.name}`, "0 errors");
      }
    } catch (err) {
      fail(`smoke:${spec.id}@${vp.name}`, err.message || String(err));
    } finally {
      probe.detach();
    }
  }
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

async function main() {
  console.log("\n=== TASFUL LIVE Phase 3 shorts smoke ===\n");

  verifyStaticCode();

  let base = "";
  try {
    base = await findDevServerBaseUrl({ probePath: "live/shorts.html" });
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
      await smokeViewport(page, base, vp, jwt);
    }
  });

  await closeAllBrowsers();
  printSummary();
  process.exit(summary.fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
