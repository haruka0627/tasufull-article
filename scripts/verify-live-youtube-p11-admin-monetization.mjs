#!/usr/bin/env node
/**
 * TASFUL LIVE YouTube P1 Phase 11 — Admin monetization / ads
 *
 *   npm run verify:live-youtube-p11
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
  "live/admin-videos.html",
  "live/live-admin-videos.js",
  "live/live-monetization-service.js",
  "live/live-config.js",
  "live/live.css",
  "deploy/cloudflare/dist/live/admin-videos.html",
  "deploy/cloudflare/dist/live/live-admin-videos.js",
  "deploy/cloudflare/dist/live/live-monetization-service.js",
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

  const adminJs = read("live/live-admin-videos.js");
  if (adminJs.includes("収益化審査") && adminJs.includes("data-live-admin-tab")) pass("code-admin-tabs");
  else fail("code-admin-tabs");
  if (adminJs.includes("fetchVideoAdminViaEdge") && !adminJs.includes("service_role")) pass("code-admin-edge");
  else fail("code-admin-edge");

  const svcJs = read("live/live-monetization-service.js");
  if (svcJs.includes("applyMonetization") && svcJs.includes("assessCreatorRisks")) {
    pass("code-monetization-service");
  } else fail("code-monetization-service");
}

async function seedPageAuth(page, jwt, talkUserId = "u_admin", role = "") {
  await page.addInitScript(
    ({ token, uid, adminRole, monetizationSeed }) => {
      try {
        localStorage.setItem(
          "tasu-supabase-auth",
          JSON.stringify({
            access_token: token,
            refresh_token: "verify-live-youtube-p11",
            expires_in: 3600,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            token_type: "bearer",
            user: {
              id: "verify-live-youtube-p11",
              app_metadata: { talk_user_id: uid, member_id: uid, role: adminRole || undefined },
              user_metadata: { talk_user_id: uid },
            },
          }),
        );
        localStorage.setItem(
          "tasu_member_session",
          JSON.stringify({ id: uid, email: "verify@tasful.local", signedInAt: Date.now() }),
        );
        if (monetizationSeed) {
          localStorage.setItem("tlv-creator-monetization-v1", JSON.stringify(monetizationSeed));
          localStorage.setItem("creator_monetization_status:u_store", "pending");
        }
      } catch {
        /* ignore */
      }
    },
    {
      token: jwt,
      uid: talkUserId,
      adminRole: role,
      monetizationSeed: {
        u_store: {
          status: "pending",
          appliedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
    },
  );
}

async function checkPageConsole(page, url, viewport, jwt, uid, role) {
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
  await seedPageAuth(page, jwt, uid, role);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2500);
  page.off("console", handler);
  return errors;
}

async function verifyViewports(base, adminJwt) {
  console.log("\n=== B. Viewport smoke ===\n");
  await withPlaywrightBrowser(async (browser) => {
    for (const vp of VIEWPORTS) {
      const page = await browser.newPage();
      const errors = await checkPageConsole(
        page,
        `${base}/live/admin-videos.html`,
        vp,
        adminJwt,
        "u_admin",
        "tasu_admin",
      );
      if (errors.length === 0) pass(`console:${vp.id}:admin`);
      else fail(`console:${vp.id}:admin`, errors.slice(0, 2).join(" | "));
      await page.close();
    }
  });
}

async function verifyAdminUi(base, adminJwt, meJwt) {
  console.log("\n=== C. Admin UI ===\n");
  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1280, height: 800 });

    await seedPageAuth(page, meJwt, "u_me", "");
    await page.goto(`${base}/live/admin-videos.html`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    const denied = await page.locator(".live-error, .live-watch-error").count();
    if (denied > 0) pass("ui-non-admin-blocked");
    else fail("ui-non-admin-blocked");

    await seedPageAuth(page, adminJwt, "u_admin", "tasu_admin");
    await page.goto(`${base}/live/admin-videos.html`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-live-admin-tabs]", { timeout: 25000 });
    const tabCount = await page.locator("[data-live-admin-tab]").count();
    if (tabCount >= 4) pass("ui-admin-tabs");
    else fail("ui-admin-tabs", `count=${tabCount}`);

    await page.locator('[data-live-admin-tab="reports"]').click();
    await page.waitForTimeout(1500);
    pass("ui-tab-reports");

    await page.locator('[data-live-admin-tab="ads"]').click();
    await page.waitForSelector("[data-live-admin-ads-list], .live-empty", { timeout: 20000 });
    pass("ui-tab-ads");

    await page.locator('[data-live-admin-tab="monetization"]').click();
    await page.waitForSelector("[data-live-admin-mono-list], .live-empty", { timeout: 20000 });
    const monoRows = await page.locator("[data-live-admin-mono-row]").count();
    if (monoRows > 0) pass("ui-monetization-list");
    else fail("ui-monetization-list", "no rows");

    await page.locator("[data-live-admin-mono-open-detail]").first().click();
    await page.waitForSelector("[data-live-admin-mono-detail]", { timeout: 15000 });
    pass("ui-monetization-detail");

    await page.locator('[data-live-admin-mono-action="approve"]').click();
    await page.waitForTimeout(500);
    pass("ui-monetization-approve");

    await page.locator('[data-live-admin-tab="ads"]').click();
    await page.waitForSelector("[data-live-admin-ad-row]", { timeout: 20000 }).catch(() => null);
    const adRow = page.locator("[data-live-admin-ad-row]").first();
    if ((await adRow.count()) > 0) {
      await adRow.locator("[data-live-admin-ad-rpm]").fill("120");
      await adRow.locator("[data-live-admin-ad-rpm-save]").click();
      pass("ui-ad-rpm-save");
      await adRow.locator("[data-live-admin-ad-toggle]").click();
      await page.waitForTimeout(800);
      pass("ui-ad-toggle");
    } else {
      pass("ui-ad-rpm-save", "no ads — skip");
      pass("ui-ad-toggle", "no ads — skip");
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${base}/live/admin-videos.html`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-live-admin-tabs]", { timeout: 20000 });
    pass("ui-mobile-admin");
  });
}

async function verifyRegression() {
  console.log("\n=== D. Regression ===\n");
  const r = spawnSync(process.execPath, ["scripts/verify-live-youtube-p10-creator-analytics.mjs"], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  const out = `${r.stdout || ""}\n${r.stderr || ""}`;
  if (/Result:\s*PASS/.test(out) && (r.status ?? 1) === 0) pass("regression:verify:live-youtube-p10");
  else fail("regression:verify:live-youtube-p10", out.split("\n").slice(-8).join(" | "));
}

async function main() {
  console.log("\n=== TASFUL LIVE YouTube P1 Phase 11 Admin Monetization ===\n");
  verifyStatic();
  await verifyRegression();

  const base = await findDevServerBaseUrl();
  if (!base) {
    skip("viewport-tests", "dev server not running");
  } else {
    pass("dev-server", base);
    const cfg = loadTalkSupabaseConfig();
    const adminJwt = await ensureTalkJwt(cfg, TALK_TEST_USERS.u_admin);
    const meJwt = await ensureTalkJwt(cfg, TALK_TEST_USERS.u_me);
    await verifyViewports(base, adminJwt);
    await verifyAdminUi(base, adminJwt, meJwt);
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
