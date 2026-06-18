/**
 * Builder Admin reviews smoke test (Playwright)
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const builder = path.join(root, "builder");
const builderAdmin = path.join(root, "builder-admin");
const PARTNERS_KEY = "tasful:builder:admin:partners:v1";
const NOTIF_KEY = "tasful:builder:mvp:notifications:v1";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(`file://${path.join(builderAdmin, "admin-index.html")}`);
  const reviewsLink = page.locator('[data-builder-stat-action="reviews"]');
  if ((await reviewsLink.getAttribute("href")) !== "../builder/admin-reviews.html") {
    throw new Error("Admin dashboard missing reviews link");
  }
  const unreviewedStat = await page.locator('[data-builder-stat-value="unreviewedReviews"]').textContent();
  if (!unreviewedStat || !unreviewedStat.includes("件")) {
    throw new Error(`Expected unreviewed count on dashboard, got ${unreviewedStat}`);
  }

  await page.evaluate((key) => localStorage.removeItem(key), NOTIF_KEY);
  await page.goto(`file://${path.join(builder, "admin-reviews.html")}`);
  await page.waitForSelector("[data-builder-admin-review-list]");

  const unreviewed = await page.locator("[data-builder-admin-review-stat-unreviewed]").textContent();
  if (!unreviewed || Number(unreviewed) < 1) {
    throw new Error(`Expected at least 1 unreviewed partner, got ${unreviewed}`);
  }

  const cardCount = await page.locator("[data-builder-admin-review-card]").count();
  if (cardCount < 6) throw new Error(`Expected at least 6 review cards, got ${cardCount}`);

  await page.locator("[data-builder-admin-review-search-q]").fill("スマート");
  await page.waitForFunction(() => document.querySelectorAll("[data-builder-admin-review-card]").length === 1);

  await page.locator("[data-builder-admin-review-search-reset]").click();
  await page.waitForFunction(() => document.querySelectorAll("[data-builder-admin-review-card]").length >= 6);

  await page.locator("[data-builder-admin-review-search-status]").selectOption("unreviewed");
  await page.waitForFunction(() => document.querySelectorAll("[data-builder-admin-review-card]").length >= 1);

  await page.locator("[data-builder-admin-review-search-reset]").click();
  await page.locator("[data-builder-admin-review-search-trade]").selectOption("足場");
  await page.waitForFunction(() => document.querySelectorAll("[data-builder-admin-review-card]").length >= 1);

  await page.locator("[data-builder-admin-review-search-reset]").click();
  await page.locator("[data-builder-admin-review-search-area]").selectOption("東京");
  await page.waitForFunction(() => document.querySelectorAll("[data-builder-admin-review-card]").length >= 1);

  await page.locator("[data-builder-admin-review-search-reset]").click();
  await page.locator("[data-builder-admin-review-search-status]").selectOption("unreviewed");
  await page.waitForFunction(() => document.querySelectorAll("[data-builder-admin-review-card]").length >= 1);

  const firstCard = page.locator("[data-builder-admin-review-card]").first();
  const partnerId = await firstCard.getAttribute("data-partner-id");
  await firstCard.click();
  const detailVisible = await page.locator("[data-builder-admin-review-detail-panel]:not([hidden])").isVisible();
  if (!detailVisible) throw new Error("Review detail panel not visible");

  await page.locator(`[data-builder-admin-review-status="${partnerId}"][data-review-status="approved"]`).click();

  await page.waitForFunction(
    ({ key, id }) => {
      const list = JSON.parse(localStorage.getItem(key) || "[]");
      const p = list.find((x) => x.id === id);
      return p?.reviewStatus === "approved" && p?.reviewStatusLabel === "承認済み";
    },
    { key: PARTNERS_KEY, id: partnerId }
  );

  const notifsAfterApprove = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "[]"), NOTIF_KEY);
  if (!notifsAfterApprove.some((n) => n.type === "review" && n.label === "審査承認")) {
    throw new Error("Approve notification missing");
  }

  await page.locator(`[data-builder-admin-review-status="${partnerId}"][data-review-status="returned"]`).click();
  await page.waitForFunction(
    ({ key, id }) => {
      const list = JSON.parse(localStorage.getItem(key) || "[]");
      const p = list.find((x) => x.id === id);
      return p?.reviewStatus === "returned";
    },
    { key: PARTNERS_KEY, id: partnerId }
  );

  const notifsAfterReturn = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "[]"), NOTIF_KEY);
  if (!notifsAfterReturn.some((n) => n.label === "審査差し戻し")) {
    throw new Error("Return notification missing");
  }

  await page.locator(`[data-builder-admin-review-status="${partnerId}"][data-review-status="suspended"]`).click();
  await page.waitForFunction(
    ({ key, id }) => {
      const list = JSON.parse(localStorage.getItem(key) || "[]");
      const p = list.find((x) => x.id === id);
      return p?.reviewStatus === "suspended";
    },
    { key: PARTNERS_KEY, id: partnerId }
  );

  const notifsAfterSuspend = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "[]"), NOTIF_KEY);
  if (!notifsAfterSuspend.some((n) => n.label === "審査停止")) {
    throw new Error("Suspend notification missing");
  }

  await page.goto(`file://${path.join(builder, "admin-partners.html")}`);
  await page.waitForSelector("[data-builder-admin-partner-list]");
  const partnerListText = await page.locator("[data-builder-admin-partner-list]").textContent();
  if (!partnerListText?.includes("停止中")) {
    throw new Error("Partner search page not reflecting review status");
  }

  console.log("OK: builder admin reviews smoke test passed");
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
