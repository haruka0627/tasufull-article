#!/usr/bin/env node
/**
 * NB-3 STEP 7 — localStorage / URL fallback lockdown 検証
 *   node scripts/test-auth-step7-fallback-lockdown.mjs
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl, buildLocalPageUrl } from "./lib/dev-server-url.mjs";
import {
  canUseLocalStorageFallback,
  isProductionHost,
  isDemoMode,
} from "./lib/auth-current-user-core.mjs";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

console.log("[step7] core policy…");
assert(!canUseLocalStorageFallback({ hostname: "tasful.jp" }), "prod blocks LS");
assert(
  !isDemoMode({ hostname: "tasful.jp", search: "?talkDev=1" }),
  "prod ignores talkDev"
);
assert(
  canUseLocalStorageFallback({ hostname: "localhost", search: "?talkDev=1" }),
  "localhost + talkDev allows LS"
);
assert(
  isDemoMode({ hostname: "localhost", search: "?benchEmbed=1" }),
  "localhost bench embed is demo"
);
console.log("  core: PASS");

let base;
try {
  base = await findDevServerBaseUrl({ probePath: "auth-current-user.js" });
} catch (err) {
  console.warn("[step7] dev server unavailable:", err.message);
  console.log("\nSUMMARY: core PASS · browser SKIPPED");
  process.exit(0);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  await page.goto(buildLocalPageUrl(base, "talk-home.html", "?talkDev=1&userId=u_me"), {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await page.waitForFunction(() => typeof window.TasuAuthCurrentUser !== "undefined", {
    timeout: 15000,
  });

  const prodChecks = await page.evaluate(() => {
    window.TASU_CHAT_SUPABASE_CONFIG = window.TASU_CHAT_SUPABASE_CONFIG || {};
    window.TASU_CHAT_SUPABASE_CONFIG.talkProductionMode = true;
    localStorage.removeItem("tasu-supabase-auth");

    const auth = window.TasuAuthCurrentUser;
    const results = {};

    localStorage.setItem("tasu_member_session", JSON.stringify({ userId: "u_ls_fake" }));
    results.uMeBlocked = auth.getCurrentUser().talkUserId === "";
    localStorage.setItem("tasful:builder:mvp:role", "owner");
    results.builderRoleBlocked =
      window.TasuBuilderActorIdentity?.getBuilderActor?.().viewRole !== "owner";
    localStorage.setItem("tasful_connect_onboarding_v1", JSON.stringify({ step: "ready" }));
    window.TasuConnectState?.invalidateConnectStateCache?.();
    results.connectLsBlocked = window.TasuConnectState?.getConnectState?.().ready !== true;
    localStorage.setItem("tasu_market_seller_profile", JSON.stringify({ shopId: "demo-shop-tasful-bakery" }));
    window.TasuMarketIdentity?.invalidateMarketIdentityCache?.();
    results.marketLsBlocked =
      window.TasuMarketIdentity?.getMarketIdentity?.().sellerShopId !== "demo-shop-tasful-bakery";

    const params = new URLSearchParams("?role=owner&talkAdmin=1&anpi_admin=1&userId=u_url_fake");
    window.history.replaceState({}, "", `${location.pathname}?${params}`);
    results.urlRoleBlocked =
      window.TasuBuilderActorIdentity?.getBuilderActor?.().viewRole !== "owner";
    results.talkAdminBlocked = auth.isOpsPreviewActive() !== true;
    results.anpiAdminBlocked =
      window.TasuAnpiLineHealthcheck?.isAnpiLineAdmin?.() !== true;

    window.TasuChatUserIdentity?.applyToConfig?.();
    results.identityEmpty = (window.TasuChatUserIdentity?.getEffectiveUserId?.() || "") === "";

    window.TasuAuthOpsGuard?.guardOpsPage?.({ pageName: "test", mode: "redirect", redirectUrl: "#" });
    results.opsGuardDenied = window.TasuAuthOpsGuard?.canAccessOps?.() === false;

    return results;
  });

  assert(prodChecks.uMeBlocked, "prod: LS userId blocked");
  assert(prodChecks.builderRoleBlocked, "prod: LS builder role blocked");
  assert(prodChecks.connectLsBlocked, "prod: LS connect ready blocked");
  assert(prodChecks.marketLsBlocked, "prod: LS market seller blocked");
  assert(prodChecks.urlRoleBlocked, "prod: URL role blocked");
  assert(prodChecks.talkAdminBlocked, "prod: talkAdmin blocked");
  assert(prodChecks.anpiAdminBlocked, "prod: anpi_admin blocked");
  assert(prodChecks.identityEmpty, "prod: identity empty without JWT");
  assert(prodChecks.opsGuardDenied, "prod: ops guard denies");

  const demoCompat = await page.evaluate(() => {
    window.TASU_CHAT_SUPABASE_CONFIG.talkProductionMode = false;
    window.TASU_CHAT_SUPABASE_CONFIG.talkDevMode = true;
    window.history.replaceState({}, "", `${location.pathname}?talkDev=1&userId=u_me`);
    window.TasuConnectState?.invalidateConnectStateCache?.();
    window.TasuMarketIdentity?.invalidateMarketIdentityCache?.();
    window.TasuChatUserIdentity?.applyToConfig?.();
    return {
      userId: window.TasuAuthCurrentUser.getCurrentUser().talkUserId,
      ls: window.TasuAuthCurrentUser.canUseLocalStorageFallback(),
      effective: window.TasuChatUserIdentity?.getEffectiveUserId?.(),
    };
  });
  assert(demoCompat.ls, "demo: LS allowed");
  assert(demoCompat.userId === "u_me" || demoCompat.effective === "u_me", "demo: u_me compat");

  console.log("  browser prod lockdown: PASS");
  console.log("  browser demo compat: PASS");
  console.log("\nSUMMARY: ALL PASS");
} finally {
  await browser.close();
}
