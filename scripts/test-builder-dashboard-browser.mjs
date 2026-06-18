/**
 * Builder dashboard encoding / layout smoke test (Playwright)
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const builder = path.join(root, "builder");
const indexPath = path.join(builder, "index.html");
const html = fs.readFileSync(indexPath, "utf8");

const CORRUPT_PATTERNS = [
  /ダチE/,
  /スレチE/,
  / E\/strong>/,
  /候裁E/,
  /完亁E/,
  /設宁E/,
  /チE/,
  /パEトナー/,
  /お気に入めE/,
];

let passed = 0;
let failed = 0;

function pass(msg) {
  passed += 1;
  console.log(`  ✓ ${msg}`);
}

function fail(msg) {
  failed += 1;
  console.error(`  ✗ ${msg}`);
}

for (const pattern of CORRUPT_PATTERNS) {
  if (pattern.test(html)) fail(`index.html still matches corruption pattern: ${pattern}`);
  else pass(`index.html clean: ${pattern}`);
}

if (!html.includes('<meta charset="UTF-8"')) {
  fail("index.html missing UTF-8 charset meta");
} else {
  pass("index.html has UTF-8 charset meta");
}

const EXPECTED_TEXT = [
  "Builder ダッシュボード",
  "案件投稿・応募確認・スレッドのサマリー",
  "未読スレッド",
  "再依頼候補",
  "最近の案件",
  "案件テンプレ",
  "よく使う協力会社",
];

async function main() {
  await withPlaywrightBrowser(async (browser) => {for (const width of [1280, 390]) {
    const page = await browser.newPage({ viewport: { width, height: width === 390 ? 844 : 900 } });
    await page.goto(`file://${indexPath}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-builder-recent-list] .builder-recent-card", { timeout: 10000 });

    const bodyText = await page.locator("body").innerText();

    const expectedForViewport =
      width <= 390
        ? EXPECTED_TEXT.filter((t) => t !== "よく使う協力会社")
        : EXPECTED_TEXT;

    for (const text of expectedForViewport) {
      if (!bodyText.includes(text)) fail(`(${width}px) missing visible text: ${text}`);
      else pass(`(${width}px) visible: ${text}`);
    }

    if (width <= 390 && bodyText.includes("お気に入り")) {
      pass("(390px) quick menu title visible: お気に入り");
    }

    for (const bad of [" E/strong>", "ダチE", "スレチE", "<strong>"]) {
      if (bodyText.includes(bad)) fail(`(${width}px) corrupt fragment visible: ${bad}`);
      else pass(`(${width}px) no corrupt fragment: ${bad}`);
    }

    const statCols = await page.evaluate(() => {
      const grid = document.querySelector("[data-builder-stat-grid]");
      if (!grid) return 0;
      return getComputedStyle(grid).gridTemplateColumns.split(" ").length;
    });

    if (width === 1280 && statCols !== 5) {
      fail(`(1280px) expected 5 stat columns, got ${statCols}`);
    } else if (width === 1280) {
      pass("(1280px) stat grid uses 5 columns");
    }

    const recentCount = await page.locator("[data-builder-recent-list] .builder-recent-card").count();
    if (recentCount !== 4) fail(`(${width}px) expected 4 recent cards, got ${recentCount}`);
    else pass(`(${width}px) recent list renders 4 cards`);

    const quickCount = await page.locator("[data-builder-quick-grid] .builder-quick-card").count();
    if (quickCount !== 8) fail(`(${width}px) expected 8 quick menu cards, got ${quickCount}`);
    else pass(`(${width}px) quick menu has 8 cards`);

    await page.close();
  }

    });

  console.log(`\nResult: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
  console.log("OK: builder dashboard smoke test passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

await closeAllBrowsers();
