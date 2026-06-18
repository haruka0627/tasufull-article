/**
 * 飲食・カフェ口コミの評価色検証 + 工具店の口コミ回帰
 * Usage: node scripts/verify-detail-shop-restaurant-reviews.mjs [baseUrl]
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const base = (process.argv[2] || "http://127.0.0.1:5173").replace(/\/$/, "");

function fail(msg) {
  console.error("FAIL:", msg);
  process.exitCode = 1;
}
function pass(msg) {
  console.log("PASS:", msg);
}

function parseRgb(color) {
  const m = String(color || "").match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return null;
  return { r: +m[1], g: +m[2], b: +m[3] };
}

function isGoldish(rgb) {
  if (!rgb) return false;
  return rgb.r >= 200 && rgb.g >= 140 && rgb.b <= 180;
}

function isDarkInk(rgb) {
  if (!rgb) return false;
  return rgb.r <= 30 && rgb.g <= 35 && rgb.b <= 45;
}

function isMutedGray(rgb) {
  if (!rgb) return false;
  return rgb.r >= 90 && rgb.r <= 120 && rgb.g >= 100 && rgb.g <= 130 && rgb.b >= 110 && rgb.b <= 140;
}

async function checkReviews(page, label, url, width) {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
  await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    const el = document.getElementById("section-reviews");
    if (el) el.scrollIntoView({ block: "center" });
  });
  await page.waitForTimeout(200);

  const state = await page.evaluate(() => {
    const num = document.querySelector(".food-reviews-scoreblock__num");
    const stars = document.querySelector(".food-reviews-scoreblock__stars");
    const count = document.querySelector(".food-reviews-scoreblock__count");
    const beautyStars = document.querySelector(".beauty-review-score__stars");
    const cs = (el) => (el ? getComputedStyle(el) : null);
    return {
      categoryKey: document.body.dataset.shopCategoryKey,
      numText: num?.textContent?.trim() || "",
      countText: count?.textContent?.trim() || "",
      starsText: stars?.textContent?.trim() || "",
      numColor: cs(num)?.color || "",
      starsColor: cs(stars)?.color || "",
      countColor: cs(count)?.color || "",
      starsDisplay: cs(stars)?.display || "",
      hasFoodReviews: !!document.querySelector(".food-reviews-top"),
      beautyStarsColor: cs(beautyStars)?.color || "",
    };
  });

  const prefix = `${label} ${width}px`;
  if (!state.hasFoodReviews) {
    fail(`${prefix}: food-reviews block missing`);
    return;
  }
  if (!state.numText || !/^\d(\.\d)?$/.test(state.numText)) {
    fail(`${prefix}: rating number missing (${state.numText})`);
  } else pass(`${prefix}: rating number ${state.numText}`);

  if (!state.starsText.includes("★")) fail(`${prefix}: star glyphs missing`);
  else pass(`${prefix}: star glyphs present`);

  if (!state.countText.includes("口コミ")) fail(`${prefix}: review count missing`);
  else pass(`${prefix}: review count shown`);

  const numRgb = parseRgb(state.numColor);
  const starsRgb = parseRgb(state.starsColor);
  const countRgb = parseRgb(state.countColor);

  if (!isDarkInk(numRgb)) fail(`${prefix}: rating color ${state.numColor}`);
  else pass(`${prefix}: rating color dark (${state.numColor})`);

  if (!isGoldish(starsRgb)) fail(`${prefix}: stars color ${state.starsColor}`);
  else pass(`${prefix}: stars gold (${state.starsColor})`);

  if (!isMutedGray(countRgb)) fail(`${prefix}: count color ${state.countColor}`);
  else pass(`${prefix}: count muted (${state.countColor})`);
}

async function checkToolsRetail(page, width) {
  const url = `${base}/detail-shop.html?id=demo-shop-reworks`;
  await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
  await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(800);
  const state = await page.evaluate(() => {
    const stars = document.querySelector(".beauty-review-score__stars");
    const num = document.querySelector(".beauty-review-score__num");
    const cs = (el) => (el ? getComputedStyle(el) : null);
    return {
      visible: stars && getComputedStyle(document.getElementById("section-reviews")).display !== "none",
      starsColor: cs(stars)?.color || "",
      numText: num?.textContent?.trim() || "",
    };
  });
  const starsRgb = parseRgb(state.starsColor);
  const prefix = `tools ${width}px`;
  if (!state.visible) fail(`${prefix}: reviews hidden`);
  else pass(`${prefix}: reviews visible`);
  if (!state.numText) fail(`${prefix}: beauty score num missing`);
  else pass(`${prefix}: beauty score ${state.numText}`);
  if (!isGoldish(starsRgb) && state.starsColor !== "rgb(212, 175, 55)") {
    // retail-gold may be #d4af37
    const ok = starsRgb && starsRgb.r >= 180 && starsRgb.g >= 120;
    if (!ok) fail(`${prefix}: retail stars color ${state.starsColor}`);
    else pass(`${prefix}: retail stars goldish`);
  } else pass(`${prefix}: retail stars gold (${state.starsColor})`);
}

await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage();
const restaurantUrl = `${base}/detail-shop.html?id=demo-shop-haru-cafe`;

  await checkReviews(page, "restaurant", restaurantUrl, 1280);
  await checkReviews(page, "restaurant", restaurantUrl, 390);
  await checkToolsRetail(page, 1280);
  await checkToolsRetail(page, 390);
  if (process.exitCode) console.error("\nSome checks failed.");
  else console.log("\nAll checks passed.");
});

await closeAllBrowsers();
