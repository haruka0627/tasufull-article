/**
 * TASFUL MATCH auth stub — smoke tests
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const BASE = "http://127.0.0.1:8788/match/match-review";

let passed = 0;
let failed = 0;

function ok(msg) {
  passed += 1;
  console.log(`  ✓ ${msg}`);
}

function bad(msg) {
  failed += 1;
  console.error(`  ✗ ${msg}`);
}

await withPlaywrightBrowser(async (browser) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.addInitScript(() => {
    window.__authStubFetchCalled = false;
    const originalFetch = window.fetch;
    window.fetch = function () {
      window.__authStubFetchCalled = true;
      return originalFetch.apply(this, arguments);
    };
  });

  await page.goto(BASE, { waitUntil: "networkidle", timeout: 30000 });

  const checks = await page.evaluate(async () => {
    const auth = window.TasfulMatchAuth;
    const api = window.TasfulMatchAPI;
    if (!auth || !api) {
      return { missing: true };
    }

    const headers = auth.getAuthHeaders();
    const swipe = await api.recordSwipe({ target_user_id: "stub-user-yui", action: "like" });

    const providerFn =
      typeof api.getAuthHeadersProvider === "function" ? api.getAuthHeadersProvider() : null;
    const providerHeaders = typeof providerFn === "function" ? providerFn() : null;

    auth.configure({ sanctionStatus: "banned" });
    const bannedSwipe = auth.canUseSwipe();
    const bannedTalk = auth.canUseTalk();
    const bannedRequire = auth.requireNotBanned();

    return {
      missing: false,
      matchUserId: auth.getMatchUserId(),
      talkUserId: auth.getTalkUserId(),
      headers,
      canSwipeBeforeBan: true,
      canSwipe: auth.configure({ sanctionStatus: "none" }) && auth.canUseSwipe(),
      canTalk: auth.canUseTalk(),
      bannedSwipe,
      bannedTalk,
      bannedRequire,
      hasConfigure: typeof api.configure === "function",
      providerIsFunction: typeof api.getAuthHeadersProvider === "function",
      providerInnerIsFunction: typeof providerFn === "function",
      providerHeaders,
      swipeAuthMode: swipe.auth_mode,
      swipeMatchUserId: swipe.match_user_id,
      fetchCalled: Boolean(window.__authStubFetchCalled),
      providerConnected: Boolean(document.querySelector("[data-match-auth-provider-status]")?.textContent === "connected"),
    };
  });

  if (!checks.missing) ok("TasfulMatchAuth and TasfulMatchAPI exist");
  else bad("TasfulMatchAuth or TasfulMatchAPI missing");

  if (checks.matchUserId === "stub-user-current") ok("getMatchUserId returns stub-user-current");
  else bad(`getMatchUserId unexpected: ${checks.matchUserId}`);

  if (checks.talkUserId === "stub-user-current") ok("getTalkUserId returns stub-user-current");
  else bad(`getTalkUserId unexpected: ${checks.talkUserId}`);

  if (checks.headers?.Authorization === "Bearer stub-match-token") {
    ok("getAuthHeaders returns Authorization");
  } else bad("getAuthHeaders missing Authorization");

  if (checks.headers?.["x-match-user-id"] === "stub-user-current") {
    ok("getAuthHeaders returns x-match-user-id");
  } else bad("getAuthHeaders missing x-match-user-id");

  if (checks.canSwipe) ok("canUseSwipe true by default");
  else bad("canUseSwipe not true by default");

  if (checks.canTalk) ok("canUseTalk true by default");
  else bad("canUseTalk not true by default");

  if (!checks.bannedSwipe && !checks.bannedTalk) ok("banned state disables swipe/talk");
  else bad("banned state did not disable swipe/talk");

  if (checks.bannedRequire?.ok === false) ok("requireNotBanned false when banned");
  else bad("requireNotBanned did not fail when banned");

  if (checks.hasConfigure) ok("TasfulMatchAPI.configure exists");
  else bad("TasfulMatchAPI.configure missing");

  if (checks.providerIsFunction && checks.providerInnerIsFunction) {
    ok("TasfulMatchAPI keeps auth header provider");
  } else bad("auth header provider missing");

  if (checks.providerHeaders?.Authorization) ok("provider returns auth headers");
  else bad("provider headers missing");

  if (checks.swipeAuthMode === "auth_stub") ok("API response includes auth_mode");
  else bad(`API auth_mode unexpected: ${checks.swipeAuthMode}`);

  if (checks.swipeMatchUserId === "stub-user-current") ok("API response includes match_user_id");
  else bad(`API match_user_id unexpected: ${checks.swipeMatchUserId}`);

  if (!checks.fetchCalled) ok("fetch not called");
  else bad("fetch was called");

  if (checks.providerConnected) ok("match-review shows API auth provider connected");
  else bad("match-review provider status not connected");

  await page.close();
});

await closeAllBrowsers();
console.log(`\nResult: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
