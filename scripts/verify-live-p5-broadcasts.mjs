#!/usr/bin/env node
/**
 * TASFUL LIVE Phase 5 — ライブ配信 / スタジオ / コメント smoke
 *
 *   node scripts/verify-live-p5-broadcasts.mjs
 *   npm run verify:live-p5
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
  "live/watch.html",
  "live/create.html",
  "live/studio.html",
  "live/live-broadcasts.js",
  "live/live-create.js",
  "live/live-comments.js",
  "live/live-config.js",
  "live/live.css",
  "live/index.html",
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
  return !/favicon|404|Failed to load resource|Failed to fetch|\[TasuChat\]|\[TasuSupabase\]|\[TasuLiveProfile\]|\[TasuLiveShorts\]|\[TasuLiveBroadcasts\]|\[TasuLiveComments\]|\[TasuLiveTalkBridge\]|gemini-chat|CORS policy/i.test(
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
  if (bc.includes('"live/watch.html"') && bc.includes('"live/studio.html"')) pass("static:breadcrumb-broadcasts");
  else fail("static:breadcrumb-broadcasts");

  const cfg = read("live/live-config.js");
  if (cfg.includes('broadcasts: "live_broadcasts"') && cfg.includes('broadcastMessages: "live_broadcast_messages"')) {
    pass("P5-code-tables");
  } else fail("P5-code-tables");
  if (cfg.includes('LIVE_STREAM_PROVIDER_DEFAULT = "stub"')) pass("P5-code-stream-provider-default");
  else fail("P5-code-stream-provider-default");

  const broadcastsJs = read("live/live-broadcasts.js");
  if (broadcastsJs.includes('TABLES.broadcasts') && broadcastsJs.includes('"live"') && broadcastsJs.includes('"scheduled"')) {
    pass("P5-code-broadcast-statuses");
  } else fail("P5-code-broadcast-statuses");
  if (broadcastsJs.includes("stream_provider") && broadcastsJs.includes("stub")) pass("P5-code-stub-provider");
  else fail("P5-code-stub-provider");
  if (!broadcastsJs.includes("cloudflare.com") && !broadcastsJs.includes("CLOUDFLARE_STREAM_API")) {
    pass("P5-code-no-stream-api");
  } else fail("P5-code-no-stream-api");

  const commentsJs = read("live/live-comments.js");
  if (commentsJs.includes("broadcastMessages") && commentsJs.includes('status === "live"')) {
    pass("P5-code-comments-live-only");
  } else fail("P5-code-comments-live-only");

  const createJs = read("live/live-create.js");
  if (createJs.includes("hasBroadcastPermission") && createJs.includes("本人確認または運営許可が必要")) {
    pass("P5-code-permission-gate");
  } else fail("P5-code-permission-gate");

  const indexHtml = read("live/index.html");
  if (indexHtml.includes("data-live-broadcasts-root") && indexHtml.includes('href="studio.html"')) {
    pass("P5-code-index-live-section");
  } else fail("P5-code-index-live-section");
}

async function seedPageAuth(page, jwt, talkUserId = "u_me") {
  await page.addInitScript(
    ({ token, uid }) => {
      try {
        localStorage.setItem(
          "tasu-supabase-auth",
          JSON.stringify({
            access_token: token,
            refresh_token: "verify-live-p5",
            expires_in: 3600,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            token_type: "bearer",
            user: {
              id: "verify-live-p5",
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

async function smokePage(page, base, vp, jwt, spec) {
  const probe = await collectConsoleErrors(page);
  try {
    if (jwt) await seedPageAuth(page, jwt);
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto(`${base}/${spec.path}`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForSelector(spec.selector, { timeout: 15000 });
    await page.waitForTimeout(900);

    const title = await page.locator(".live-header__title, .live-hero__title").first().textContent();
    if (String(title || "").includes(spec.title)) pass(`UI:${spec.id}@${vp.name}`, spec.title);
    else fail(`UI:${spec.id}@${vp.name}`, title || "no title");

    if (spec.extra) await spec.extra(page, vp);

    if (probe.errors.length) fail(`console:${spec.id}@${vp.name}`, probe.errors.slice(0, 2).join(" | "));
    else pass(`console:${spec.id}@${vp.name}`, "0 errors");
  } catch (err) {
    fail(`smoke:${spec.id}@${vp.name}`, err.message || String(err));
  } finally {
    probe.detach();
  }
}

async function smokeViewport(page, base, vp, jwt) {
  const pages = [
    {
      id: "index",
      path: "live/index.html?talkDev=1",
      selector: "[data-live-hub]",
      title: "ショート",
      async extra(p) {
        const liveRoot = p.locator("[data-live-broadcasts-root]");
        if ((await liveRoot.count()) > 0) pass(`UI:index-live-section@${vp.name}`);
        else fail(`UI:index-live-section@${vp.name}`);
      },
    },
    {
      id: "create",
      path: "live/create.html?talkDev=1",
      selector: "[data-live-create-root]",
      title: "配信作成",
      async extra(p) {
        const panel = p.locator("[data-live-create-form], .live-panel--notice");
        if ((await panel.count()) > 0) pass(`UI:create-mounted@${vp.name}`);
        else fail(`UI:create-mounted@${vp.name}`);
      },
    },
    {
      id: "studio",
      path: "live/studio.html?talkDev=1",
      selector: "[data-live-studio-root]",
      title: "配信スタジオ",
      async extra(p) {
        const list = p.locator("[data-live-studio-list], .live-empty, .live-error");
        if ((await list.count()) > 0) pass(`UI:studio-mounted@${vp.name}`);
        else fail(`UI:studio-mounted@${vp.name}`);
      },
    },
    {
      id: "watch",
      path: "live/watch.html?broadcast_id=stub&talkDev=1",
      selector: "[data-live-watch]",
      title: "ライブ視聴",
      async extra(p) {
        const placeholder = p.locator("[data-live-watch-placeholder]");
        if ((await placeholder.count()) > 0) pass(`UI:watch-stub-placeholder@${vp.name}`);
        else fail(`UI:watch-stub-placeholder@${vp.name}`);
        const comments = p.locator("[data-live-comments]");
        if ((await comments.count()) > 0) pass(`UI:watch-comments@${vp.name}`);
        else fail(`UI:watch-comments@${vp.name}`);
      },
    },
  ];

  for (const spec of pages) {
    await smokePage(page, base, vp, jwt, spec);
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
  console.log("\n=== TASFUL LIVE Phase 5 broadcasts smoke ===\n");

  verifyStaticCode();

  let base = "";
  try {
    base = await findDevServerBaseUrl({ probePath: "live/index.html" });
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
