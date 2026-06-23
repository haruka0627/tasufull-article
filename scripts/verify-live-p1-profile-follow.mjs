#!/usr/bin/env node
/**
 * TASFUL LIVE Phase 1 — プロフィール / フォロー UI smoke
 *
 *   node scripts/verify-live-p1-profile-follow.mjs
 *
 * 要: npm run build:pages && npm run dev（または BASE_URL）
 * 任意: SUPABASE_SERVICE_ROLE_KEY（JWT シードで settings フォーム検証）
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
  "live/index.html",
  "live/profile.html",
  "live/settings.html",
  "live/live-config.js",
  "live/live-profile.js",
  "live/live-follow.js",
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

function isSevereConsoleError(text) {
  return !/favicon|404|Failed to load resource|Failed to fetch|\[TasuChat\]|\[TasuSupabase\]|\[TasuLiveProfile\]|gemini-chat|CORS policy/i.test(
    String(text || "")
  );
}

function verifyStaticFiles() {
  console.log("\n=== A. Static files ===\n");
  for (const rel of STATIC_FILES) {
    const full = path.join(ROOT, rel);
    if (existsSync(full)) pass(`static:${rel}`);
    else fail(`static:${rel}`, "missing");
  }

  const bc = path.join(ROOT, "breadcrumb-config.js");
  if (existsSync(bc)) {
    const text = readFileSync(bc, "utf8");
    if (text.includes('"live/index.html"')) pass("static:breadcrumb-live");
    else fail("static:breadcrumb-live", "live entries missing");
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
            refresh_token: "verify-live-p1",
            expires_in: 3600,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            token_type: "bearer",
            user: {
              id: "verify-live-p1",
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
      id: "index",
      path: "live/index.html?talkDev=1",
      selector: "[data-live-hub]",
      label: "ショート",
    },
    {
      id: "profile",
      path: "live/profile.html?userId=u_store&talkDev=1",
      selector: "[data-live-profile-root]",
      label: null,
    },
    {
      id: "settings",
      path: "live/settings.html?talkDev=1",
      selector: "[data-live-settings-root]",
      label: "クリエイター設定",
    },
  ];

  for (const spec of pages) {
    const probe = await collectConsoleErrors(page);
    try {
      if (jwt) await seedPageAuth(page, jwt);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${base}/${spec.path}`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForSelector(spec.selector, { timeout: 15000 });

      if (spec.label) {
        const title = await page.locator(".live-hero__title, .live-header__title").first().textContent();
        if (String(title || "").includes(spec.label)) {
          pass(`UI:${spec.id}@${vp.name}`, spec.label);
        } else {
          fail(`UI:${spec.id}@${vp.name}`, title || "no title");
        }
      } else {
        pass(`UI:${spec.id}@${vp.name}`, "root mounted");
      }

      if (spec.id === "profile") {
        const talkBtn = page.locator("[data-live-talk-cta]");
        if ((await talkBtn.count()) > 0) pass(`UI:profile-talk-cta@${vp.name}`);
        else skip(`UI:profile-talk-cta@${vp.name}`, "no profile / empty state");
      }

      if (spec.id === "settings" && jwt) {
        const form = page.locator("[data-live-settings-form]");
        await page.waitForTimeout(800);
        if ((await form.count()) > 0) pass(`UI:settings-form@${vp.name}`);
        else fail(`UI:settings-form@${vp.name}`, "form missing");
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

async function main() {
  console.log("\n=== TASFUL LIVE Phase 1 profile/follow smoke ===\n");

  verifyStaticFiles();

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

  console.log("\n=== B. Viewport smoke (390 / 768 / 1280) ===\n");

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
