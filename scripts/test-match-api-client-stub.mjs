/**
 * TASFUL MATCH API client stub — smoke tests (match-review.html)
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
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  let fetchCalled = false;
  await page.addInitScript(() => {
    const originalFetch = window.fetch;
    window.fetch = function () {
      window.__matchApiFetchCalled = true;
      return originalFetch.apply(this, arguments);
    };
  });

  const res = await page.goto(BASE, { waitUntil: "networkidle", timeout: 30000 });
  if (!res || res.status() >= 400) bad(`match-review HTTP ${res?.status()}`);
  else ok("match-review loads");

  const apiExists = await page.evaluate(() => typeof window.TasfulMatchAPI === "object");
  if (apiExists) ok("window.TasfulMatchAPI exists");
  else bad("window.TasfulMatchAPI missing");

  const modeText = await page.textContent("[data-match-api-mode]");
  if (modeText === "client_stub") ok('UI shows mode "client_stub"');
  else bad(`UI mode text: ${modeText}`);

  const availText = await page.textContent("[data-match-api-available]");
  if (availText && availText.includes("available")) ok("UI shows TasfulMatchAPI available");
  else bad(`UI availability text: ${availText}`);

  const methodChecks = await page.evaluate(async () => {
    const api = window.TasfulMatchAPI;
    const methods = [
      "recordSwipe",
      "ensureTalkRoom",
      "submitReport",
      "blockUser",
      "submitVerification",
      "adminReview",
      "moderationLog",
    ];
    const promises = methods.map((m) => api[m]({}));
    const allPromise = promises.every((p) => p && typeof p.then === "function");
    await Promise.all(promises);

    const like = await api.recordSwipe({ target_user_id: "user-a", action: "like" });
    const superLike = await api.recordSwipe({ target_user_id: "user-a", action: "super_like" });
    const missing = await api.recordSwipe({});
    const badEnum = await api.submitReport({
      reported_user_id: "user-b",
      reason: "invalid",
    });

    return {
      allPromise,
      likeOk: like.ok === true && like.mode === "client_stub",
      superLikePhase:
        superLike.ok === false &&
        superLike.code === "phase_not_enabled" &&
        superLike.mode === "client_stub",
      missingValidation: missing.ok === false && missing.code === "validation_error",
      badEnumValidation: badEnum.ok === false && badEnum.code === "validation_error",
      fetchCalled: Boolean(window.__matchApiFetchCalled),
    };
  });

  if (methodChecks.allPromise) ok("all methods return Promises");
  else bad("some methods do not return Promises");

  if (methodChecks.likeOk) ok("recordSwipe like succeeds with client_stub");
  else bad("recordSwipe like unexpected result");

  if (methodChecks.superLikePhase) ok("recordSwipe super_like returns phase_not_enabled");
  else bad("recordSwipe super_like unexpected result");

  if (methodChecks.missingValidation) ok("missing required fields return validation_error");
  else bad("missing validation unexpected");

  if (methodChecks.badEnumValidation) ok("invalid enum returns validation_error");
  else bad("enum validation unexpected");

  if (!methodChecks.fetchCalled) ok("fetch not called during tests");
  else bad("fetch was called");

  if (errors.length) bad(`console errors: ${errors.join(" | ")}`);
  else ok("no console errors");

  await page.close();
});

await closeAllBrowsers();
console.log(`\nResult: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
