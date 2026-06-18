#!/usr/bin/env node
/**
 * NB-3 STEP 4 — Connect 状態 helper 検証
 *   node scripts/test-connect-state.mjs
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl, buildLocalPageUrl } from "./lib/dev-server-url.mjs";
import {
  snapshotFromDbRow,
  isConnectReadyStep,
  shouldBlockLsConnectReady,
} from "./lib/connect-state-core.mjs";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(isConnectReadyStep("ready"), "core: ready step");
assert(!isConnectReadyStep("identity"), "core: identity not ready");
assert(
  snapshotFromDbRow({
    stripe_account_id: "acct_1",
    payout_account_status: "active",
    payout_enabled: true,
  })?.ready === true,
  "core: db active ready"
);
assert(
  snapshotFromDbRow({ stripe_account_id: "acct_1", payout_account_status: "pending" })?.ready === false,
  "core: db pending not ready"
);
assert(shouldBlockLsConnectReady({ hostname: "tasful.jp" }), "core: prod blocks LS");

let base;
try {
  base = await findDevServerBaseUrl({ probePath: "connect-state.js" });
} catch (err) {
  console.warn("[test-connect-state] dev server unavailable:", err.message);
  console.log("SUMMARY: core PASS · browser SKIPPED");
  await closeAllBrowsers();
  process.exit(0);
}

await withPlaywrightBrowser(async (browser) => {
  const url = buildLocalPageUrl(
    base,
    "payment-settings.html",
    "?talkDev=1&userId=u_sachi&connectStep=identity"
  );
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForFunction(() => typeof window.TasuConnectState !== "undefined", {
    timeout: 15000,
  });
  await page.evaluate(async () => {
    await window.TasuConnectState.refreshConnectStateFromDb();
    window.TasuPaymentSettings?.renderConnectOnboarding?.();
  });

  const demoIdentity = await page.evaluate(() => ({
    step: window.TasuConnectState.getConnectStep(),
    ready: window.TasuConnectState.isConnectReady(),
    source: window.TasuConnectState.getConnectStateSource(),
    badge: document.querySelector("[data-connect-status-badge]")?.textContent || "",
  }));
  assert(demoIdentity.step === "identity", "demo: identity step");
  assert(!demoIdentity.ready, "demo: not ready at identity");
  assert(demoIdentity.badge.length > 0, "demo: badge visible");

  const demoReady = await page.evaluate(() => {
    localStorage.setItem(
      "tasful_connect_onboarding_v1",
      JSON.stringify({ step: "ready", updatedAt: new Date().toISOString() })
    );
    window.TasuConnectState.invalidateConnectStateCache();
    return {
      step: window.TasuConnectState.getConnectStep(),
      ready: window.TasuConnectState.isConnectReady(),
      source: window.TasuConnectState.getConnectStateSource(),
    };
  });
  assert(demoReady.ready, "demo LS: ready");
  assert(demoReady.step === "ready", "demo LS: step ready");

  const prodBlocked = await page.evaluate(() => {
    window.TASU_CHAT_SUPABASE_CONFIG = window.TASU_CHAT_SUPABASE_CONFIG || {};
    window.TASU_CHAT_SUPABASE_CONFIG.talkProductionMode = true;
    localStorage.setItem(
      "tasful_connect_onboarding_v1",
      JSON.stringify({ step: "ready" })
    );
    window.TasuConnectState.invalidateConnectStateCache();
    return {
      ready: window.TasuConnectState.isConnectReady(),
      source: window.TasuConnectState.getConnectStateSource(),
      lsIgnored: window.TasuConnectState.readDemoOnboardingLs().step,
    };
  });
  assert(!prodBlocked.ready, "prod: LS ready ignored");
  assert(prodBlocked.source !== "demo_localStorage", "prod: not demo source");

  const prodUnauth = await page.evaluate(() => {
    window.TASU_CHAT_SUPABASE_CONFIG.talkProductionMode = true;
    localStorage.removeItem("tasu-supabase-auth");
    window.TasuConnectState.invalidateConnectStateCache();
    const state = window.TasuConnectState.getConnectState();
    return { source: state.source, onboarding: state.onboardingRequired };
  });
  assert(prodUnauth.onboarding, "prod unauth: onboarding required");

  const prodJwtNoDb = await page.evaluate(async () => {
    window.TASU_CHAT_SUPABASE_CONFIG.talkProductionMode = true;
    const header = btoa(JSON.stringify({ alg: "none" })).replace(/=/g, "");
    const body = btoa(
      JSON.stringify({
        sub: "seller-1",
        app_metadata: { talk_user_id: "u_seller_step4", member_id: "u_seller_step4" },
      })
    ).replace(/=/g, "");
    localStorage.setItem("tasu-supabase-auth", JSON.stringify({ access_token: `${header}.${body}.x` }));
    window.TasuConnectState.invalidateConnectStateCache();
    await window.TasuConnectState.refreshConnectStateFromDb();
    const state = window.TasuConnectState.getConnectState();
    const claims = window.TasuAuthCurrentUser?.getCurrentUserClaims?.() || {};
    return {
      ready: state.ready,
      source: state.source,
      claimId: claims.talk_user_id || "",
      onboarding: state.onboardingRequired,
    };
  });
  assert(!prodJwtNoDb.ready, "prod JWT no DB: onboarding required");
  assert(prodJwtNoDb.onboarding, "prod JWT no DB: onboarding flag");

  const uiOk = await page.evaluate(() => {
    window.TASU_CHAT_SUPABASE_CONFIG.talkProductionMode = false;
    window.TASU_CHAT_SUPABASE_CONFIG.talkDevMode = true;
    localStorage.setItem(
      "tasful_connect_onboarding_v1",
      JSON.stringify({ step: "identity" })
    );
    window.TasuConnectState.invalidateConnectStateCache();
    window.TasuPaymentSettings?.renderConnectOnboarding?.();
    return {
      hasSteps: Boolean(document.querySelector("[data-connect-steps] li")),
      hasOnboarding: Boolean(document.querySelector("[data-connect-onboarding]")),
    };
  });
  assert(uiOk.hasOnboarding, "UI: onboarding root");
  assert(uiOk.hasSteps, "UI: steps rendered");

  console.log("  demo identity: PASS");
  console.log("  demo LS ready: PASS");
  console.log("  prod LS blocked: PASS");
  console.log("  prod unauth: PASS");
  console.log("  prod JWT no DB: PASS");
  console.log("  payment-settings UI: PASS");
  console.log("\nSUMMARY: ALL PASS");
});

await closeAllBrowsers();
