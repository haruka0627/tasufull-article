#!/usr/bin/env node
/**
 * Compare Chrome process delta: raw playwright (no finally) vs lib wrapper.
 *   node scripts/test-playwright-leak-compare.mjs
 */
import { chromium as rawChromium } from "playwright";
import {
  countChromeProcesses,
  getActiveBrowserCount,
  withPlaywrightBrowser,
  closeAllBrowsers,
} from "./lib/playwright-browser.mjs";

async function countChrome() {
  const n = await countChromeProcesses();
  return n ?? -1;
}

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

console.log("[leak-compare] baseline chrome processes:", await countChrome());

// --- OLD pattern: launch without finally, throw before close ---
const beforeOld = await countChrome();
const orphans = [];
for (let i = 0; i < 3; i++) {
  try {
    const browser = await rawChromium.launch({ headless: true });
    orphans.push(browser);
    throw new Error("simulated failure before browser.close()");
  } catch {
    /* no finally — intentional leak */
  }
}
await sleep(1500);
const afterOld = await countChrome();
const deltaOld = afterOld - beforeOld;
console.log("[leak-compare] OLD pattern (3 launches, no close):", {
  before: beforeOld,
  after: afterOld,
  delta: deltaOld,
  orphanedBrowsers: orphans.filter((b) => b.isConnected()).length,
});

// cleanup orphans manually for next test
for (const b of orphans) {
  try {
    if (b.isConnected()) await b.close();
  } catch {
    /* ignore */
  }
}
await sleep(1500);

// --- NEW pattern: withPlaywrightBrowser + throw ---
const beforeNew = await countChrome();
for (let i = 0; i < 3; i++) {
  try {
    await withPlaywrightBrowser(async () => {
      throw new Error("simulated failure inside wrapper");
    });
  } catch {
    /* expected */
  }
}
await closeAllBrowsers();
await sleep(1500);
const afterNew = await countChrome();
const deltaNew = afterNew - beforeNew;
console.log("[leak-compare] NEW pattern (3 launches, withPlaywrightBrowser):", {
  before: beforeNew,
  after: afterNew,
  delta: deltaNew,
  activeRegistry: getActiveBrowserCount(),
});

console.log("[leak-compare] SUMMARY delta OLD vs NEW:", { deltaOld, deltaNew });
