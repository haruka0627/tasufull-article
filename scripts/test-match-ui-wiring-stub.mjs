/**
 * TASFUL MATCH UI wiring stub — integration smoke tests
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const BASE = "http://127.0.0.1:8788/match";

const WIRED_PAGES = [
  { slug: "match-swipe", file: "match-swipe" },
  { slug: "match-talk-bridge", file: "match-talk-bridge" },
  { slug: "match-list", file: "match-list" },
  { slug: "match-report", file: "match-report" },
  { slug: "match-block", file: "match-block" },
  { slug: "match-verify", file: "match-verify" },
];

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
  for (const p of WIRED_PAGES) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));

    await page.addInitScript(() => {
      window.__matchWiringFetchCalled = false;
      const originalFetch = window.fetch;
      window.fetch = function () {
        window.__matchWiringFetchCalled = true;
        return originalFetch.apply(this, arguments);
      };
    });

    const res = await page.goto(`${BASE}/${p.file}`, { waitUntil: "networkidle", timeout: 30000 });
    if (!res || res.status() >= 400) bad(`${p.slug} loads`);
    else ok(`${p.slug} loads`);

    const scripts = await page.evaluate(() => ({
      api: typeof window.TasfulMatchAPI === "object",
      wiring: typeof window.MatchWiring === "object",
      hasMatchApiScript: Boolean(document.querySelector('script[src*="match-api.js"]')),
      hasWiringScript: Boolean(document.querySelector('script[src*="match-wiring.js"]')),
      fetchCalled: Boolean(window.__matchWiringFetchCalled),
    }));

    if (scripts.hasMatchApiScript) ok(`${p.slug} loads match-api.js`);
    else bad(`${p.slug} missing match-api.js`);

    if (scripts.hasWiringScript) ok(`${p.slug} loads match-wiring.js`);
    else bad(`${p.slug} missing match-wiring.js`);

    if (scripts.api) ok(`${p.slug} TasfulMatchAPI available`);
    else bad(`${p.slug} TasfulMatchAPI missing`);

    if (scripts.wiring) ok(`${p.slug} MatchWiring available`);
    else bad(`${p.slug} MatchWiring missing`);

    if (!scripts.fetchCalled) ok(`${p.slug} fetch not called on load`);
    else bad(`${p.slug} fetch called on load`);

    const hScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    if (!hScroll) ok(`${p.slug} no horizontal scroll (390px)`);
    else bad(`${p.slug} horizontal scroll (390px)`);

    if (errors.length) bad(`${p.slug} console: ${errors.join(" | ")}`);
    else ok(`${p.slug} no console errors`);

    await page.close();
  }

  const swipePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await swipePage.goto(`${BASE}/match-swipe`, { waitUntil: "networkidle" });

  const skipResult = await swipePage.evaluate(async () => {
    const api = window.TasfulMatchAPI;
    const calls = [];
    const orig = api.recordSwipe;
    api.recordSwipe = async (payload) => {
      calls.push(payload);
      return orig(payload);
    };
    const btn = document.querySelector('[data-match-swipe-action="skip"]');
    btn?.click();
    await new Promise((r) => setTimeout(r, 50));
    return { calls, promise: calls.length > 0 };
  });
  if (skipResult.promise) ok("swipe skip triggers recordSwipe");
  else bad("swipe skip does not trigger recordSwipe");

  const superResult = await swipePage.evaluate(async () => {
    const result = await window.TasfulMatchAPI.recordSwipe({
      target_user_id: "stub-user-yui",
      action: "super_like",
    });
    return result;
  });
  if (superResult?.code === "phase_not_enabled") ok("super_like returns phase_not_enabled");
  else bad("super_like unexpected result");

  await swipePage.close();

  const reportPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await reportPage.goto(`${BASE}/match-report`, { waitUntil: "networkidle" });

  const reportCall = await reportPage.evaluate(async () => {
    const calls = [];
    const orig = window.TasfulMatchAPI.submitReport;
    window.TasfulMatchAPI.submitReport = async (payload) => {
      calls.push(payload);
      return orig(payload);
    };
    document.querySelector("[data-report-submit]")?.click();
    await new Promise((r) => setTimeout(r, 80));
    return calls.length > 0;
  });
  if (reportCall) ok("report submit triggers submitReport");
  else bad("report submit does not trigger submitReport");
  await reportPage.close();

  const verifyPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await verifyPage.addInitScript(() => {
    window.__verifyTypes = [];
    const wrap = () => {
      const api = window.TasfulMatchAPI;
      if (!api || api.__verifyWrapped) return;
      const orig = api.submitVerification.bind(api);
      api.submitVerification = async (payload) => {
        window.__verifyTypes.push(payload.verification_type);
        return orig(payload);
      };
      api.__verifyWrapped = true;
    };
    document.addEventListener("DOMContentLoaded", wrap);
    wrap();
  });
  await verifyPage.goto(`${BASE}/match-verify`, { waitUntil: "networkidle" });

  const verifyCalls = await verifyPage.evaluate(async () => {
    await new Promise((r) => setTimeout(r, 80));
    document.querySelector('[data-verify-type="identity_document"]')?.click();
    await new Promise((r) => setTimeout(r, 80));
    return window.__verifyTypes || [];
  });
  if (verifyCalls.includes("phone")) ok("verify calls phone submitVerification on load");
  else bad("verify missing phone submitVerification");
  if (verifyCalls.includes("identity_document")) ok("verify identity step calls submitVerification");
  else bad("verify missing identity submitVerification");
  await verifyPage.close();

  const talkPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await talkPage.goto(`${BASE}/match-talk-bridge`, { waitUntil: "networkidle" });

  const talkCall = await talkPage.evaluate(async () => {
    const calls = [];
    const orig = window.TasfulMatchAPI.ensureTalkRoom;
    window.TasfulMatchAPI.ensureTalkRoom = async (payload) => {
      calls.push(payload);
      return orig(payload);
    };
    document.querySelector("[data-match-talk-cta]")?.click();
    await new Promise((r) => setTimeout(r, 80));
    return calls.length > 0;
  });
  if (talkCall) ok("talk bridge triggers ensureTalkRoom");
  else bad("talk bridge does not trigger ensureTalkRoom");
  await talkPage.close();
});

await closeAllBrowsers();
console.log(`\nResult: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
