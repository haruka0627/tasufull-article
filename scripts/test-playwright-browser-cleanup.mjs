#!/usr/bin/env node
/**
 * Playwright browser leak regression — launch + forced error must leave 0 active browsers
 *   node scripts/test-playwright-browser-cleanup.mjs
 */
import {
  chromium,
  closeAllBrowsers,
  countChromeProcesses,
  getActiveBrowserCount,
  withPlaywrightBrowser,
} from "./lib/playwright-browser.mjs";

async function countChrome() {
  const n = await countChromeProcesses();
  return n ?? -1;
}

const beforeChrome = await countChrome();
console.log("[cleanup-test] chrome processes before:", beforeChrome);

let leakDetected = false;

try {
  await withPlaywrightBrowser(async () => {
    throw new Error("simulated script failure");
  });
} catch {
  /* expected */
}

if (getActiveBrowserCount() !== 0) {
  leakDetected = true;
  console.error("[cleanup-test] FAIL: active browsers after withPlaywrightBrowser error:", getActiveBrowserCount());
}

await closeAllBrowsers();

if (getActiveBrowserCount() !== 0) {
  leakDetected = true;
  console.error("[cleanup-test] FAIL: active browsers after closeAllBrowsers:", getActiveBrowserCount());
}

const browser = await chromium.launch({ headless: true });
await browser.close();
await closeAllBrowsers();

if (getActiveBrowserCount() !== 0) {
  leakDetected = true;
  console.error("[cleanup-test] FAIL: active browsers after manual close:", getActiveBrowserCount());
}

const afterChrome = await countChrome();
console.log("[cleanup-test] chrome processes after:", afterChrome);
console.log("[cleanup-test] active registry:", getActiveBrowserCount());

if (leakDetected) {
  console.error("[cleanup-test] SUMMARY: FAIL");
  process.exit(1);
}

console.log("[cleanup-test] SUMMARY: PASS");
process.exit(0);
