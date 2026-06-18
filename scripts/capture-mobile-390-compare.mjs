/**
 * 390px モバイル — 変更前(HEAD) / 変更後(作業ツリー) 比較キャプチャ
 */
import { execSync } from "child_process";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { assertPlaywrightLocalhostPage, buildLocalPageUrl, findDevServerBaseUrl } from "./lib/dev-server-url.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "screenshots", "market-top-pc-zones");
const TRACKED = ["shop-store.html", "shop-market-top.js", "shop-market-top.css"];
const VIEWPORT = { width: 390, height: 844 };

fs.mkdirSync(OUT_DIR, { recursive: true });

function readHeadFile(file) {
  return execSync(`git show HEAD:${file}`, { encoding: "utf8" });
}

function backupTracked() {
  const backup = {};
  for (const file of TRACKED) {
    backup[file] = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  }
  return backup;
}

function restoreTracked(backup) {
  for (const file of TRACKED) {
    fs.writeFileSync(path.join(__dirname, "..", file), backup[file], "utf8");
  }
}

function writeHeadTracked() {
  for (const file of TRACKED) {
    fs.writeFileSync(path.join(__dirname, "..", file), readHeadFile(file), "utf8");
  }
}

async function captureMobile(label) {
  const base = await findDevServerBaseUrl({ probePath: "shop-store.html" });
  const url = buildLocalPageUrl(base, "shop-store.html");
  await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({ viewport: VIEWPORT });
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await assertPlaywrightLocalhostPage(page);
  await page.waitForFunction(
    () =>
      document.querySelectorAll(".tasful-market-mobile-top .tasful-market-card, .tasful-market-main > .tasful-market-section .tasful-market-card")
        .length > 0,
    { timeout: 20000 }
  );
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.scrollTo(0, 0));
  const audit = await page.evaluate(() => {
    const mobileRoot = document.querySelector(".tasful-market-mobile-top") || document.querySelector(".tasful-market-main");
    const sections = [
      ...document.querySelectorAll(
        ".tasful-market-mobile-top > .tasful-market-section:not([hidden]), .tasful-market-main > .tasful-market-section:not([hidden])"
      ),
    ].map((el) => el.getAttribute("aria-label") || el.id);
    return {
      hasMobileWrapper: Boolean(document.querySelector(".tasful-market-mobile-top")),
      hasPcTop: Boolean(document.querySelector("[data-tasful-market-pc-top]")),
      sectionCount: sections.length,
      sections,
      cardCount: mobileRoot ? mobileRoot.querySelectorAll(".tasful-market-card").length : 0,
      searchHeight: Math.round(document.querySelector(".tasful-market-mall-header__search")?.getBoundingClientRect().height || 0),
      headerTotalH: Math.round(document.querySelector(".tasful-market-mall-header")?.getBoundingClientRect().height || 0),
      cardTitleWeight: getComputedStyle(
        document.querySelector(".tasful-market-mobile-top .tasful-market-card__title, .tasful-market-card__title")
      ).fontWeight,
    };
  });
  const outPath = path.join(OUT_DIR, label);
  await page.screenshot({ path: outPath, fullPage: false });
    });
  return audit;
}

const backup = backupTracked();
let beforeAudit;
let afterAudit;
try {
  writeHeadTracked();
  beforeAudit = await captureMobile("04-mobile-first-view-before.png");
} finally {
  restoreTracked(backup);
}

execSync("node scripts/build-shop-store-market-top.mjs", {
  cwd: path.join(__dirname, ".."),
  stdio: "inherit",
});

afterAudit = await captureMobile("04-mobile-first-view-after.png");

const report = {
  generatedAt: new Date().toISOString(),
  before: beforeAudit,
  after: afterAudit,
  sectionOrderMatch: JSON.stringify(beforeAudit.sections) === JSON.stringify(afterAudit.sections),
};
fs.writeFileSync(path.join(OUT_DIR, "mobile-390-compare.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

await closeAllBrowsers();
