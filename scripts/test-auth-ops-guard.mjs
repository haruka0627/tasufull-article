#!/usr/bin/env node
/**
 * NB-3 STEP 3 — ops/admin guard 検証
 *   node scripts/test-auth-ops-guard.mjs
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl, buildLocalPageUrl } from "./lib/dev-server-url.mjs";
import { canUseLocalStorageFallback, isProductionHost } from "./lib/auth-current-user-core.mjs";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(isProductionHost({ hostname: "tasful.jp" }), "core: tasful.jp production");
assert(!canUseLocalStorageFallback({ hostname: "tasful.jp" }), "core: prod blocks LS");

let base;
try {
  base = await findDevServerBaseUrl({ probePath: "auth-ops-guard.js" });
} catch (err) {
  console.warn("[test-auth-ops-guard] dev server unavailable:", err.message);
  console.log("SUMMARY: core PASS · browser SKIPPED");
  await closeAllBrowsers();
  process.exit(0);
}

await withPlaywrightBrowser(async (browser) => {
  const adminUrl = buildLocalPageUrl(base, "admin-operations-dashboard.html");
  await page.goto(adminUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForFunction(() => typeof window.TasuAuthOpsGuard !== "undefined", {
    timeout: 15000,
  });

  const localhostDemo = await page.evaluate(() => ({
    can: window.TasuAuthOpsGuard.canAccessOps(),
    preview: window.TasuAuthOpsGuard.isOpsPreviewAllowed(),
    forbidden: document.body.classList.contains("tasu-ops-forbidden"),
    title: document.querySelector("h1")?.textContent || "",
  }));
  assert(localhostDemo.can, "localhost demo: canAccessOps");
  assert(!localhostDemo.forbidden, "localhost demo: not 403");
  assert(
    localhostDemo.title.includes("AI運営") || localhostDemo.title.includes("司令塔"),
    "localhost demo: dashboard loads"
  );

  const talkDev = await page.evaluate(() => {
    window.TASU_CHAT_SUPABASE_CONFIG = window.TASU_CHAT_SUPABASE_CONFIG || {};
    window.TASU_CHAT_SUPABASE_CONFIG.talkProductionMode = false;
    window.TASU_CHAT_SUPABASE_CONFIG.talkDevMode = true;
    return {
      can: window.TasuAuthOpsGuard.canAccessOps(),
      demo: window.TasuAuthCurrentUser.isDemoMode(),
    };
  });
  assert(talkDev.can, "talkDev: canAccessOps");
  assert(talkDev.demo, "talkDev: isDemoMode");

  const prodNoJwt = await page.evaluate(() => {
    window.TASU_CHAT_SUPABASE_CONFIG.talkProductionMode = true;
    localStorage.removeItem("tasu-supabase-auth");
    localStorage.removeItem("tasu_talk_admin_preview");
    return {
      can: window.TasuAuthOpsGuard.canAccessOps(),
      preview: window.TasuAuthOpsGuard.isOpsPreviewAllowed(),
      isOps: window.TasuAuthCurrentUser.isOpsUser(),
    };
  });
  assert(!prodNoJwt.can, "prod: no access without JWT");
  assert(!prodNoJwt.preview, "prod: no preview");
  assert(!prodNoJwt.isOps, "prod: not ops without JWT");

  const prodUrlEscalation = await page.evaluate(() => {
    const u = new URL(window.location.href);
    u.searchParams.set("talkAdmin", "1");
    window.history.replaceState({}, "", u.toString());
    localStorage.setItem("tasu_talk_admin_preview", "1");
    return {
      can: window.TasuAuthOpsGuard.canAccessOps(),
      preview: window.TasuAuthOpsGuard.isOpsPreviewAllowed(),
      talkAdmin: window.TasuTalkRuntime?.isTalkAdmin?.(),
    };
  });
  assert(!prodUrlEscalation.can, "prod: URL talkAdmin blocked");
  assert(!prodUrlEscalation.preview, "prod: LS preview blocked");
  assert(!prodUrlEscalation.talkAdmin, "prod: isTalkAdmin false");

  const prodLsOnly = await page.evaluate(() => {
    window.TASU_CHAT_SUPABASE_CONFIG.talkProductionMode = true;
    localStorage.setItem("tasu_anpi_line_admin_v1", "1");
    return window.TasuAnpiLineHealthcheck?.isAnpiLineAdmin?.();
  });
  assert(!prodLsOnly, "prod: anpi LS admin blocked");

  const jwtOps = await page.evaluate(() => {
    window.TASU_CHAT_SUPABASE_CONFIG.talkProductionMode = true;
    const header = btoa(JSON.stringify({ alg: "none" })).replace(/=/g, "");
    const body = btoa(
      JSON.stringify({
        sub: "ops-user",
        role: "tasu_admin",
        app_metadata: { talk_user_id: "u_ops_guard", is_ops: true },
      })
    ).replace(/=/g, "");
    localStorage.setItem("tasu-supabase-auth", JSON.stringify({ access_token: `${header}.${body}.x` }));
    return {
      can: window.TasuAuthOpsGuard.canAccessOps(),
      isOps: window.TasuAuthCurrentUser.isOpsUser(),
    };
  });
  assert(jwtOps.can, "prod: JWT ops allowed");
  assert(jwtOps.isOps, "prod: isOpsUser true");

  const demoPreview = await page.goto(
    buildLocalPageUrl(base, "admin-operations-dashboard.html", "?talkDev=1&talkAdmin=1"),
    { waitUntil: "domcontentloaded", timeout: 30000 }
  );
  void demoPreview;
  await page.waitForFunction(() => typeof window.TasuAuthOpsGuard !== "undefined", { timeout: 15000 });
  const demoTalkAdminOps = await page.evaluate(() => ({
    can: window.TasuAuthOpsGuard.canAccessOps(),
    preview: window.TasuAuthOpsGuard.isOpsPreviewAllowed(),
  }));
  assert(demoTalkAdminOps.can, "demo talkAdmin: canAccessOps");
  assert(demoTalkAdminOps.preview, "demo talkAdmin: preview allowed");

  console.log("  localhost demo: PASS");
  console.log("  talkDev: PASS");
  console.log("  production host (simulated): PASS");
  console.log("  JWT ops: PASS");
  console.log("  URL/LS escalation blocked on prod: PASS");
  console.log("  demo talkAdmin: PASS");
  console.log("\nSUMMARY: ALL PASS");
});

await closeAllBrowsers();
