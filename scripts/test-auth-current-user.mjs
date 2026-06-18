#!/usr/bin/env node
/**
 * NB-3 STEP 2 — Auth helper 検証
 *   node scripts/test-auth-current-user.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl, buildLocalPageUrl } from "./lib/dev-server-url.mjs";
import {
  isProductionHost,
  isDemoMode,
  canUseLocalStorageFallback,
  isOpsFromClaims,
  extractClaimsFromJwt,
  decodeJwtPayload,
} from "./lib/auth-current-user-core.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function runCoreTests() {
  assert(isDemoMode({ hostname: "localhost" }), "localhost is demo");
  assert(isDemoMode({ hostname: "127.0.0.1" }), "127.0.0.1 is demo");
  assert(isDemoMode({ hostname: "tasful.jp", search: "?talkDev=1" }) === false, "prod host ignores talkDev");
  assert(
    isDemoMode({ hostname: "localhost", search: "?talkDev=1" }),
    "localhost + talkDev=1 is demo"
  );
  assert(isProductionHost({ hostname: "tasful.jp" }), "tasful.jp is production");
  assert(isProductionHost({ hostname: "www.tasful.jp" }), "www.tasful.jp is production");
  assert(!isProductionHost({ hostname: "localhost" }), "localhost not production");
  assert(
    !canUseLocalStorageFallback({ hostname: "tasful.jp" }),
    "prod host blocks LS fallback"
  );
  assert(
    canUseLocalStorageFallback({ hostname: "localhost" }),
    "localhost allows LS fallback"
  );
  assert(isOpsFromClaims({ is_ops: true }), "is_ops true");
  assert(isOpsFromClaims({ role: "tasu_admin" }), "tasu_admin role");
  assert(!isOpsFromClaims({ role: "authenticated" }), "authenticated not ops");

  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      sub: "auth-uuid-1",
      role: "authenticated",
      app_metadata: {
        talk_user_id: "u_jwt_test",
        member_id: "u_jwt_test",
        is_ops: false,
        platform_role: "member",
      },
    })
  ).toString("base64url");
  const token = `${header}.${payload}.sig`;
  const decoded = decodeJwtPayload(token);
  const claims = extractClaimsFromJwt(decoded, null);
  assert(claims.talk_user_id === "u_jwt_test", "JWT talk_user_id parse");
  assert(claims.member_id === "u_jwt_test", "JWT member_id parse");
}

async function runBrowserTests(base) {
  await withPlaywrightBrowser(async (browser) => {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForFunction(() => typeof window.TasuAuthCurrentUser !== "undefined", {
      timeout: 15000,
    });

    const localhostDemo = await page.evaluate(() => {
      const auth = window.TasuAuthCurrentUser;
      return {
        demo: auth.isDemoMode(),
        prod: auth.isProductionHost(),
        ls: auth.canUseLocalStorageFallback(),
        userId: auth.getCurrentUser().talkUserId,
        source: auth.getCurrentUser().source,
      };
    });
    assert(localhostDemo.demo, "browser: demo mode");
    assert(!localhostDemo.prod, "browser: not production");
    assert(localhostDemo.ls, "browser: LS fallback allowed");
    assert(localhostDemo.userId === "u_me", "browser: demo userId u_me");
    assert(
      localhostDemo.source === "demo_fallback" || localhostDemo.source === "jwt",
      "browser: demo or jwt source"
    );

    const prodBlocked = await page.evaluate(() => {
      window.TASU_CHAT_SUPABASE_CONFIG = window.TASU_CHAT_SUPABASE_CONFIG || {};
      window.TASU_CHAT_SUPABASE_CONFIG.talkProductionMode = true;
      const auth = window.TasuAuthCurrentUser;
      localStorage.setItem("tasu_member_session", JSON.stringify({ userId: "u_ls_fake" }));
      const user = auth.getCurrentUser();
      const opsPreview = auth.isOpsPreviewActive();
      return {
        ls: auth.canUseLocalStorageFallback(),
        userId: user.talkUserId,
        source: user.source,
        opsPreview,
      };
    });
    assert(!prodBlocked.ls, "browser: prod blocks LS fallback");
    assert(!prodBlocked.userId, "browser: prod ignores LS userId");
    assert(prodBlocked.source === "none", "browser: prod source none");
    assert(!prodBlocked.opsPreview, "browser: prod blocks ops preview");

    const opsJwt = await page.evaluate(() => {
      const header = btoa(JSON.stringify({ alg: "none" })).replace(/=/g, "");
      const body = btoa(
        JSON.stringify({
          sub: "ops-1",
          role: "tasu_admin",
          app_metadata: { talk_user_id: "u_ops", is_ops: true },
        })
      ).replace(/=/g, "");
      const token = `${header}.${body}.x`;
      localStorage.setItem("tasu-supabase-auth", JSON.stringify({ access_token: token }));
      const auth = window.TasuAuthCurrentUser;
      return {
        isOps: auth.isOpsUser(),
        userId: auth.getCurrentUser().talkUserId,
        source: auth.getCurrentUser().source,
      };
    });
    assert(opsJwt.isOps, "browser: JWT ops");
    assert(opsJwt.userId === "u_ops", "browser: JWT user id");
    assert(opsJwt.source === "jwt", "browser: JWT source");

    const talkAdminIgnoredOnProd = await page.evaluate(() => {
      window.TASU_CHAT_SUPABASE_CONFIG.talkProductionMode = true;
      localStorage.removeItem("tasu-supabase-auth");
      const auth = window.TasuAuthCurrentUser;
      return {
        isOps: auth.isOpsUser(),
        preview: auth.isOpsPreviewActive(),
      };
    });
    assert(!talkAdminIgnoredOnProd.isOps, "browser: no JWT ops on prod");
    assert(!talkAdminIgnoredOnProd.preview, "browser: no preview ops on prod");

    const identityCompat = await page.evaluate(() => {
      window.TASU_CHAT_SUPABASE_CONFIG.talkProductionMode = false;
      window.TASU_CHAT_SUPABASE_CONFIG.talkDevMode = true;
      window.TasuChatUserIdentity?.applyToConfig?.();
      return {
        effective: window.TasuChatUserIdentity?.getEffectiveUserId?.(),
        configId: window.TASU_CHAT_SUPABASE_CONFIG?.currentUserId,
      };
    });
    assert(identityCompat.effective === "u_me", "browser: chat-user-identity demo compat");
    assert(identityCompat.configId === "u_me", "browser: config currentUserId set");

    const identityProdEmpty = await page.evaluate(() => {
      window.TASU_CHAT_SUPABASE_CONFIG.talkProductionMode = true;
      localStorage.removeItem("tasu-supabase-auth");
      window.TasuChatUserIdentity?.applyToConfig?.();
      return window.TasuChatUserIdentity?.getEffectiveUserId?.() || "";
    });
    assert(identityProdEmpty === "", "browser: production no u_me fallback");
    });
  
}

async function runScreenshotSmoke(base) {
  await withPlaywrightBrowser(async (browser) => {
    const url = buildLocalPageUrl(base, "talk-home.html", "?talkDev=1&userId=u_me");
    await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForFunction(
      () => document.querySelector(".talk-home") || document.body?.innerText?.includes("TALK"),
      { timeout: 20000 }
    );
    const title = await page.title();
    assert(title.includes("TALK") || title.includes("TASFUL"), "talk-home loads");
    });
  
}

console.log("[test-auth-current-user] core unit tests…");
runCoreTests();
console.log("  core: PASS");

let base;
try {
  base = await findDevServerBaseUrl({ probePath: "auth-current-user.js" });
} catch (err) {
  console.warn("[test-auth-current-user] dev server unavailable:", err.message);
  console.log("\nSUMMARY: core PASS · browser SKIPPED (start vite or Live Server)");
  await closeAllBrowsers();
  process.exit(0);
}

console.log("[test-auth-current-user] browser tests @", base);
await runBrowserTests(base);
console.log("  browser: PASS");

console.log("[test-auth-current-user] talk-home smoke…");
await runScreenshotSmoke(base);
console.log("  smoke: PASS");

console.log("\nSUMMARY: ALL PASS");

await closeAllBrowsers();
