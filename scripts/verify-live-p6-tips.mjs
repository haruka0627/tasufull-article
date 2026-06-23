#!/usr/bin/env node
/**
 * TASFUL LIVE Phase 6 — 投げ銭 stub / ギフト / 履歴 smoke
 *
 *   node scripts/verify-live-p6-tips.mjs
 *   npm run verify:live-p6
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
  "live/gifts.html",
  "live/tips.html",
  "live/live-gifts.js",
  "live/live-tips.js",
  "live/live-config.js",
  "live/live-broadcasts.js",
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
  return !/favicon|404|Failed to load resource|Failed to fetch|\[TasuChat\]|\[TasuSupabase\]|\[TasuLiveProfile\]|\[TasuLiveShorts\]|\[TasuLiveBroadcasts\]|\[TasuLiveComments\]|\[TasuLiveGifts\]|\[TasuLiveTips\]|\[TasuLiveTalkBridge\]|gemini-chat|CORS policy/i.test(
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
  if (bc.includes('"live/gifts.html"') && bc.includes('"live/tips.html"')) pass("static:breadcrumb-tips");
  else fail("static:breadcrumb-tips");

  const cfg = read("live/live-config.js");
  if (cfg.includes('tips: "live_tips"')) pass("P6-code-table-live-tips");
  else fail("P6-code-table-live-tips");
  if (cfg.includes("LIVE_TIP_PAYMENT_STATUS_STUB") && cfg.includes('"stub"')) pass("P6-code-payment-status-stub");
  else fail("P6-code-payment-status-stub");

  const gifts = read("live/live-gifts.js");
  if (gifts.includes("stub決済") && gifts.includes("LIVE_P0_GIFTS")) pass("P6-code-gifts-ui");
  else fail("P6-code-gifts-ui");
  const badStripe = /stripe\.(createCheckout|redirectToCheckout)|checkout\.sessions|create-checkout/i;
  if (!badStripe.test(gifts)) pass("P6-code-no-stripe-gifts");
  else fail("P6-code-no-stripe-gifts");

  const tipsJs = read("live/live-tips.js");
  if (tipsJs.includes("TABLES.tips") && tipsJs.includes("payment_status")) pass("P6-code-tips-insert");
  else fail("P6-code-tips-insert");
  if (!tipsJs.includes(".update(") && !tipsJs.includes(".upsert(")) pass("P6-code-no-client-update");
  else fail("P6-code-no-client-update");
  if (tipsJs.includes("fetchSentTips") && tipsJs.includes("fetchReceivedTips")) pass("P6-code-tips-history");
  else fail("P6-code-tips-history");

  const broadcastsJs = read("live/live-broadcasts.js");
  if (broadcastsJs.includes("giftsUrl") && broadcastsJs.includes("ギフト")) pass("P6-code-watch-gift-btn");
  else fail("P6-code-watch-gift-btn");

  const profileJs = read("live/live-profile.js");
  if (profileJs.includes("tipsUrl") && profileJs.includes("応援履歴")) pass("P6-code-profile-tips-link");
  else fail("P6-code-profile-tips-link");
}

async function seedPageAuth(page, jwt, talkUserId = "u_me") {
  await page.addInitScript(
    ({ token, uid }) => {
      try {
        localStorage.setItem(
          "tasu-supabase-auth",
          JSON.stringify({
            access_token: token,
            refresh_token: "verify-live-p6",
            expires_in: 3600,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            token_type: "bearer",
            user: {
              id: "verify-live-p6",
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

    const title = await page.locator(".live-header__title").first().textContent();
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
      id: "watch",
      path: "live/watch.html?broadcast_id=stub&talkDev=1",
      selector: "[data-live-watch]",
      title: "ライブ視聴",
      async extra(p) {
        const gift = p.locator('a.live-btn:has-text("ギフト")');
        if ((await gift.count()) > 0) pass(`UI:watch-gift-btn@${vp.name}`);
        else fail(`UI:watch-gift-btn@${vp.name}`);
      },
    },
    {
      id: "gifts",
      path: "live/gifts.html?broadcast_id=stub&creator_user_id=u_creator&talkDev=1",
      selector: "[data-live-gifts]",
      title: "ギフト",
      async extra(p) {
        const form = p.locator("[data-live-gifts-form]");
        if ((await form.count()) > 0) pass(`UI:gifts-form@${vp.name}`);
        else fail(`UI:gifts-form@${vp.name}`);
        const stub = p.locator('text=stub決済');
        if ((await stub.count()) > 0) pass(`UI:gifts-stub-label@${vp.name}`);
        else fail(`UI:gifts-stub-label@${vp.name}`);
      },
    },
    {
      id: "tips",
      path: "live/tips.html?talkDev=1",
      selector: "[data-live-tips-root]",
      title: "応援履歴",
      async extra(p) {
        const panels = p.locator(".live-panel");
        if ((await panels.count()) >= 1) pass(`UI:tips-panels@${vp.name}`);
        else fail(`UI:tips-panels@${vp.name}`);
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
  console.log("\n=== TASFUL LIVE Phase 6 tips stub smoke ===\n");

  verifyStaticCode();

  let base = "";
  try {
    base = await findDevServerBaseUrl({ probePath: "live/gifts.html" });
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
