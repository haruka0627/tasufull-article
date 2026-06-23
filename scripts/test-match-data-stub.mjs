/**
 * TASFUL MATCH data stub — smoke tests
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import {
  MATCH_SCREENSHOT_VIEWPORT,
  MATCH_UI_VIEWPORTS,
  assertMatchNoHorizontalOverflow,
  matchViewportSize,
} from "./lib/match-viewports.mjs";

const BASE = "http://127.0.0.1:8788/match";

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
  const page = await browser.newPage({ viewport: matchViewportSize(MATCH_SCREENSHOT_VIEWPORT) });
  await page.goto(`${BASE}/match-review`, { waitUntil: "networkidle" });

  const stubCheck = await page.evaluate(() => {
    const stub = window.TasfulMatchDataStub;
    if (!stub) return { exists: false };
    const profiles = stub.getSwipeProfiles();
    const pairs = stub.getPairs();
    const blocked = stub.getBlockedUsers();
    const reports = stub.getReports();
    const current = stub.getCurrentUser();
    const defaultTarget = stub.getDefaultTargetUserId();
    const defaultPair = stub.getDefaultPairId();
    const profileIds = profiles.map((p) => p.user_id);
    const pairIds = pairs.map((p) => p.pair_id);
    return {
      exists: true,
      currentUser: current?.user_id,
      profileCount: profiles.length,
      pairCount: pairs.length,
      blockedCount: blocked.length,
      reportCount: reports.length,
      defaultTarget,
      defaultPair,
      targetInProfiles: profileIds.includes(defaultTarget),
      pairExists: pairIds.includes(defaultPair),
      verification: stub.getCurrentVerification()?.verification_id,
    };
  });

  if (stubCheck.exists) ok("TasfulMatchDataStub exists");
  else bad("TasfulMatchDataStub missing");

  if (stubCheck.currentUser === "stub-user-current") ok("currentUser available");
  else bad(`currentUser unexpected: ${stubCheck.currentUser}`);

  if (stubCheck.profileCount >= 3) ok(`swipeProfiles count ${stubCheck.profileCount}`);
  else bad(`swipeProfiles count ${stubCheck.profileCount}`);

  if (stubCheck.pairCount >= 2) ok(`pairs count ${stubCheck.pairCount}`);
  else bad(`pairs count ${stubCheck.pairCount}`);

  if (stubCheck.blockedCount >= 2) ok(`blockedUsers count ${stubCheck.blockedCount}`);
  else bad(`blockedUsers count ${stubCheck.blockedCount}`);

  if (stubCheck.reportCount >= 2) ok(`reports count ${stubCheck.reportCount}`);
  else bad(`reports count ${stubCheck.reportCount}`);

  if (stubCheck.targetInProfiles) ok("getDefaultTargetUserId returns valid profile id");
  else bad("getDefaultTargetUserId invalid");

  if (stubCheck.pairExists) ok("getDefaultPairId returns valid pair id");
  else bad("getDefaultPairId invalid");

  if (stubCheck.verification) ok("getCurrentVerification available");
  else bad("getCurrentVerification missing");

  await page.close();

  const swipePage = await browser.newPage({ viewport: matchViewportSize(MATCH_SCREENSHOT_VIEWPORT) });
  await swipePage.addInitScript(() => {
    window.__swipePayloads = [];
    document.addEventListener("DOMContentLoaded", () => {
      const api = window.TasfulMatchAPI;
      if (!api) return;
      const orig = api.recordSwipe.bind(api);
      api.recordSwipe = async (payload) => {
        window.__swipePayloads.push(payload);
        return orig(payload);
      };
    });
  });
  await swipePage.goto(`${BASE}/match-swipe`, { waitUntil: "networkidle" });

  const swipePayload = await swipePage.evaluate(async () => {
    const cardId = document
      .querySelector("[data-match-target-user-id]")
      ?.getAttribute("data-match-target-user-id");
    document.querySelector('[data-match-swipe-action="skip"]')?.click();
    await new Promise((r) => setTimeout(r, 100));
    const payload = window.__swipePayloads[0];
    return { cardId, payload };
  });

  if (swipePayload.payload?.target_user_id === swipePayload.cardId) {
    ok("recordSwipe uses displayed profile user_id");
  } else {
    bad(
      `recordSwipe target mismatch: ${swipePayload.payload?.target_user_id} vs ${swipePayload.cardId}`,
    );
  }
  if (swipePayload.cardId) ok(`swipe card user_id from data stub: ${swipePayload.cardId}`);
  else bad("swipe card missing user_id");

  await swipePage.close();

  const listPage = await browser.newPage({ viewport: matchViewportSize(MATCH_SCREENSHOT_VIEWPORT) });
  await listPage.addInitScript(() => {
    window.__talkPayloads = [];
    document.addEventListener("DOMContentLoaded", () => {
      const api = window.TasfulMatchAPI;
      if (!api) return;
      const orig = api.ensureTalkRoom.bind(api);
      api.ensureTalkRoom = async (payload) => {
        window.__talkPayloads.push(payload);
        return orig(payload);
      };
    });
  });
  await listPage.goto(`${BASE}/match-list`, { waitUntil: "networkidle" });

  const talkPayload = await listPage.evaluate(async () => {
    const cta = document.querySelector("[data-match-talk-cta]");
    const expectedPair = cta?.getAttribute("data-match-pair-id");
    cta?.click();
    await new Promise((r) => setTimeout(r, 100));
    return { expectedPair, payload: window.__talkPayloads[0] };
  });

  if (talkPayload.payload?.pair_id === talkPayload.expectedPair) {
    ok("ensureTalkRoom uses rendered pair_id");
  } else {
    bad(
      `ensureTalkRoom pair mismatch: ${talkPayload.payload?.pair_id} vs ${talkPayload.expectedPair}`,
    );
  }

  const fetchUsed = await listPage.evaluate(() => Boolean(window.__matchWiringFetchCalled));
  if (!fetchUsed) ok("fetch not called on list page");
  else bad("fetch called on list page");

  for (const viewport of MATCH_UI_VIEWPORTS) {
    const vp = await browser.newPage({ viewport: matchViewportSize(viewport) });
    await vp.goto(`${BASE}/match-swipe`, { waitUntil: "networkidle" });
    try {
      await assertMatchNoHorizontalOverflow(vp, "match-swipe", viewport);
      ok(`match-swipe ${viewport.label} no horizontal scroll`);
    } catch (err) {
      bad(String(err.message || err));
    }
    await vp.close();
  }

  await listPage.close();
});

await closeAllBrowsers();
console.log(`\nResult: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
