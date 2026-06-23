/**
 * TASFUL MATCH UI mock — responsive audit + screenshots (390×844 baseline)
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import {
  MATCH_SCREENSHOT_VIEWPORT,
  MATCH_UI_VIEWPORTS,
  assertMatchNoHorizontalOverflow,
  isMatchMinViewport,
  matchViewportSize,
} from "./lib/match-viewports.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const OUT = path.join(root, "reports", "screenshots", "match-mock-review");
const BASE = "http://127.0.0.1:8788/match";

const PAGES = [
  { slug: "match-top", file: "match-top" },
  { slug: "match-profile-create", file: "match-profile-create" },
  { slug: "match-swipe", file: "match-swipe" },
  { slug: "match-list", file: "match-list" },
  { slug: "match-talk-bridge", file: "match-talk-bridge" },
  { slug: "match-safety", file: "match-safety" },
  { slug: "match-mypage", file: "match-mypage" },
  { slug: "match-verify", file: "match-verify" },
  { slug: "match-report", file: "match-report" },
  { slug: "match-block", file: "match-block" },
  { slug: "match-review", file: "match-review" },
];

fs.mkdirSync(OUT, { recursive: true });

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
  for (const p of PAGES) {
    for (const viewport of MATCH_UI_VIEWPORTS) {
      const page = await browser.newPage({ viewport: matchViewportSize(viewport) });
      const errors = [];
      page.on("pageerror", (e) => errors.push(String(e)));

      const res = await page.goto(`${BASE}/${p.file}`, { waitUntil: "networkidle", timeout: 30000 });
      if (!res || res.status() >= 400) bad(`${p.slug} ${viewport.label} HTTP ${res?.status()}`);
      else ok(`${p.slug} ${viewport.label} loads`);

      try {
        await assertMatchNoHorizontalOverflow(page, p.slug, viewport);
        ok(`${p.slug} ${viewport.label} no horizontal scroll`);
      } catch (err) {
        bad(String(err.message || err));
      }

      if (!isMatchMinViewport(viewport)) {
        if (errors.length) bad(`${p.slug} ${viewport.label} console: ${errors.join(" | ")}`);
        else ok(`${p.slug} ${viewport.label} no console errors`);
      }

      if (viewport.id === MATCH_SCREENSHOT_VIEWPORT.id) {
        await page.screenshot({
          path: path.join(OUT, `${p.slug}-${viewport.id}.png`),
          fullPage: true,
        });
      }

      await page.close();
    }
  }
});

await closeAllBrowsers();
console.log(`\nResult: ${passed} passed, ${failed} failed`);
console.log(`Screenshots: ${OUT}`);
if (failed) process.exit(1);
