/**
 * Builder TOP — public-board導線・フッター復元スモークテスト
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const topPath = path.join(root, "builder", "builder-top.html");
const topUrl = `file://${topPath}`;

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

const PUBLIC_BOARD_LINKS = [
  'a.builder-top-nav__link[href="../public-board.html"]',
  'a.builder-top-btn--primary[href="../public-board.html"]',
  'a.builder-top-link[href="../public-board.html"]',
  'a.builder-top-route__btn[href="../public-board.html"]',
  'a.builder-top-footer__link[href="../public-board.html"]',
];

const FOOTER_REQUIRED = ["利用規約", "プライバシーポリシー", "会社概要", "お問い合わせ"];

async function main() {
  await withPlaywrightBrowser(async (browser) => {for (const width of [1280, 390]) {
    const page = await browser.newPage({ viewport: { width, height: width === 390 ? 844 : 900 } });
    await page.goto(topUrl, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-builder-top-projects] .builder-top-project-card", { timeout: 10000 });

    for (const sel of PUBLIC_BOARD_LINKS) {
      const count = await page.locator(sel).count();
      if (count < 1) fail(`(${width}px) missing link: ${sel}`);
      else pass(`(${width}px) link present: ${sel}`);
    }

    const heroHref = await page.locator('a.builder-top-btn--primary').first().getAttribute("href");
    if (heroHref !== "../public-board.html") fail(`(${width}px) hero CTA href: ${heroHref}`);
    else pass(`(${width}px) hero「案件を探す」→ public-board.html`);

    const gridVisible = await page.evaluate(() => {
      const grid = document.querySelector(".builder-top-footer__grid");
      if (!grid) return false;
      return getComputedStyle(grid).display !== "none";
    });
    if (!gridVisible) fail(`(${width}px) footer grid hidden`);
    else pass(`(${width}px) footer grid visible`);

    const footerText = await page.locator(".builder-top-footer").innerText();
    for (const label of FOOTER_REQUIRED) {
      if (!footerText.includes(label)) fail(`(${width}px) footer missing: ${label}`);
      else pass(`(${width}px) footer has: ${label}`);
    }

    if (!footerText.includes("©")) fail(`(${width}px) footer missing copyright`);
    else pass(`(${width}px) footer has copyright`);

    if (width === 390) {
      await page.click("[data-builder-top-menu-toggle]");
      await page.waitForTimeout(300);
      const drawerHref = await page.locator('.builder-top-drawer__link[href="../public-board.html"]').getAttribute("href");
      if (drawerHref !== "../public-board.html") fail("(390px) drawer 案件を探す link missing");
      else pass("(390px) drawer「案件を探す」→ public-board.html");
    }

    const moreCardHref = await page
      .locator(".builder-top-project-card--more")
      .getAttribute("href");
    if (moreCardHref !== "../public-board.html") fail(`(${width}px) more card href: ${moreCardHref}`);
    else pass(`(${width}px) more card → public-board.html`);

    await page.close();
  }

    });
  console.log(`\nResult: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
  console.log("OK: builder TOP smoke test passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

await closeAllBrowsers();
