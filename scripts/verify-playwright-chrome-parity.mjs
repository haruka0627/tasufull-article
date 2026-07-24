#!/usr/bin/env node
/**
 * Playwright（headless chromium）と実 Chrome の表示条件・レイアウト一致検証
 *
 *   node scripts/verify-playwright-chrome-parity.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { playwrightChromium, closeAllBrowsers, HEADLESS_LAUNCH_ARGS } from "./lib/playwright-browser.mjs";
import {
  BUILDER_QA_VIEWPORTS,
  assertBrowserLikeEnv,
  capturePageViewportScreenshot,
  createBrowserLikePage,
  preparePageForScreenshot,
  readPngCssDimensions,
} from "./lib/playwright-viewport.mjs";
import { findDevServerBaseUrl, buildLocalPageUrl } from "./lib/dev-server-url.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "screenshots", "builder-project-calendar-add-event", "_parity");
const url = buildLocalPageUrl(
  await findDevServerBaseUrl({ probePath: "builder/project-calendar.html" }),
  "builder/project-calendar.html",
);

const errors = [];
const pass = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => {
  errors.push(m);
  console.log(`  ✗ ${m}`);
};

/** @param {import('playwright').Page} page */
async function readLayoutMetrics(page) {
  return page.evaluate(() => {
    const grid = document.querySelector(".builder-cal-standard__grid");
    const topbar = document.querySelector(".builder-cal-topbar");
    const modal = document.querySelector("[data-builder-cal-modal]");
    const gridStyle = grid ? getComputedStyle(grid) : null;
    return {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
      mq960: window.matchMedia("(max-width: 960px)").matches,
      mq480: window.matchMedia("(max-width: 480px)").matches,
      mq1200: window.matchMedia("(max-width: 1200px)").matches,
      gridTemplateColumns: gridStyle?.gridTemplateColumns ?? "",
      gridWidth: grid ? Math.round(grid.getBoundingClientRect().width) : 0,
      topbarHeight: topbar ? Math.round(topbar.getBoundingClientRect().height) : 0,
      modalDisplay: modal ? getComputedStyle(modal).display : "",
    };
  });
}

/**
 * @param {string} engineLabel
 * @param {import('playwright').LaunchOptions} launchOptions
 */
async function captureEngine(engineLabel, launchOptions) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await playwrightChromium.launch({
    headless: true,
    args: HEADLESS_LAUNCH_ARGS,
    ...launchOptions,
  });
  try {
    const results = [];
    for (const vp of BUILDER_QA_VIEWPORTS) {
      const { context, page } = await createBrowserLikePage(browser, vp);
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
        await page.locator("[data-builder-cal-standard]").waitFor({ state: "visible", timeout: 10000 });
        await preparePageForScreenshot(page);

        const env = await assertBrowserLikeEnv(page, vp);
        const metrics = await readLayoutMetrics(page);

        const shotPath = path.join(OUT_DIR, `${engineLabel}-standard-${vp.id}.png`);
        await capturePageViewportScreenshot(page, shotPath);
        const dim = readPngCssDimensions(shotPath);

        results.push({ vp, env, metrics, shotPath, dim });
      } finally {
        await context.close();
      }
    }
    return results;
  } finally {
    await browser.close();
  }
}

function compareMetrics(a, b, vpLabel) {
  const keys = [
    "innerWidth",
    "innerHeight",
    "devicePixelRatio",
    "mq960",
    "mq480",
    "mq1200",
    "gridTemplateColumns",
    "gridWidth",
    "topbarHeight",
  ];
  let ok = true;
  for (const key of keys) {
    if (a[key] !== b[key]) {
      fail(`${vpLabel} ${key}: chromium=${JSON.stringify(a[key])} chrome=${JSON.stringify(b[key])}`);
      ok = false;
    }
  }
  if (ok) pass(`${vpLabel} layout metrics match (grid=${a.gridWidth}px cols=${a.gridTemplateColumns})`);
  return ok;
}

console.log("URL:", url);
console.log("Parity OUT:", OUT_DIR);

const chromiumResults = await captureEngine("chromium", {});
pass("chromium captures done");

let chromeResults = null;
try {
  chromeResults = await captureEngine("chrome", { channel: "chrome" });
  pass("chrome channel captures done");
} catch (err) {
  fail(`chrome channel unavailable: ${err instanceof Error ? err.message : err}`);
}

if (chromeResults) {
  for (let i = 0; i < BUILDER_QA_VIEWPORTS.length; i += 1) {
    const vp = BUILDER_QA_VIEWPORTS[i];
    const cr = chromiumResults[i];
    const kr = chromeResults[i];

    if (!cr.env.ok) fail(`${vp.label} chromium env: ${cr.env.errors.join("; ")}`);
    else pass(`${vp.label} chromium env OK`);

    if (!kr.env.ok) fail(`${vp.label} chrome env: ${kr.env.errors.join("; ")}`);
    else pass(`${vp.label} chrome env OK`);

    compareMetrics(cr.metrics, kr.metrics, vp.label);

    if (cr.dim?.width === vp.width && kr.dim?.width === vp.width) {
      pass(`${vp.label} PNG css size ${vp.width}×${vp.height}`);
    } else {
      fail(`${vp.label} PNG size mismatch chromium=${cr.dim?.width}×${cr.dim?.height} chrome=${kr.dim?.width}×${kr.dim?.height}`);
    }
  }
}

await closeAllBrowsers();

console.log(`\n${errors.length === 0 ? "PASS" : "FAIL"} (${errors.length} errors)`);
if (errors.length) process.exitCode = 1;
