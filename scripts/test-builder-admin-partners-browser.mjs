/**
 * Builder Admin partners search smoke test (Playwright)
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const builder = path.join(root, "builder");
const builderAdmin = path.join(root, "builder-admin");
const PARTNERS_KEY = "tasful:builder:admin:partners:v1";
const CANDIDATES_KEY = "tasful:builder:admin:dispatchCandidates:v1";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(`file://${path.join(builder, "index.html")}`);
  const userHasAdminLink = await page.locator('a[href*="admin-partners"]').count();
  if (userHasAdminLink > 0) throw new Error("User index.html must not link to admin-partners");

  await page.goto(`file://${path.join(builderAdmin, "admin-index.html")}`);
  const partnerLink = page.locator('[data-builder-quick="partner-search"]');
  const href = await partnerLink.getAttribute("href");
  if (href !== "../builder/admin-partners.html") throw new Error(`Expected ../builder/admin-partners.html, got ${href}`);

  await page.evaluate(({ pk, ck }) => {
    localStorage.removeItem(pk);
    localStorage.removeItem(ck);
  }, { pk: PARTNERS_KEY, ck: CANDIDATES_KEY });

  await page.goto(`file://${path.join(builder, "admin-partners.html")}`);
  await page.waitForSelector("[data-builder-admin-partner-list]");

  const countText = await page.locator("[data-builder-admin-partner-count]").textContent();
  if (!countText?.includes("6")) throw new Error(`Expected 6 partners, got ${countText}`);

  await page.locator("[data-builder-admin-search-q]").fill("関東外装");
  await page.locator("[data-builder-admin-partner-search-form]").evaluate((f) => f.requestSubmit());
  await page.waitForFunction(() => document.querySelectorAll("[data-builder-admin-partner-card]").length === 1);

  await page.locator("[data-builder-admin-search-reset]").click();
  await page.waitForFunction(() => document.querySelectorAll("[data-builder-admin-partner-card]").length === 6);

  await page.locator("[data-builder-admin-search-area]").selectOption("神奈川県");
  await page.waitForFunction(() => document.querySelectorAll("[data-builder-admin-partner-card]").length >= 1);

  await page.locator("[data-builder-admin-search-reset]").click();
  await page.locator("[data-builder-admin-search-trade]").selectOption("足場");
  await page.waitForFunction(() => {
    const cards = [...document.querySelectorAll("[data-builder-admin-partner-card]")];
    return cards.length === 1 && cards[0].textContent.includes("足場ワークス");
  });

  await page.locator("[data-builder-admin-search-reset]").click();
  await page.locator("[data-builder-admin-search-review]").selectOption("approved");
  await page.waitForFunction(() => document.querySelectorAll("[data-builder-admin-partner-card]").length === 2);

  await page.locator("[data-builder-admin-search-reset]").click();
  await page.locator("[data-builder-admin-search-availability]").selectOption("closed");
  await page.waitForFunction(() => document.querySelectorAll("[data-builder-admin-partner-card]").length === 2);

  await page.locator("[data-builder-admin-search-reset]").click();
  await page.locator('[data-builder-admin-partner-detail="partner-demo-001"]').click();
  const detailVisible = await page.locator("[data-builder-admin-partner-detail-panel]:not([hidden])").isVisible();
  if (!detailVisible) throw new Error("Detail panel not visible");
  const detailText = await page.locator("[data-builder-admin-partner-detail-panel]").textContent();
  if (!detailText?.includes("090-0000-0000")) throw new Error("Detail missing phone");

  page.once("dialog", (d) => d.accept());
  await page.locator('[data-builder-admin-partner-candidate="partner-demo-001"]').first().click();

  const candidates = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) || "[]"),
    CANDIDATES_KEY
  );
  if (candidates.length !== 1 || candidates[0].partnerId !== "partner-demo-001") {
    throw new Error(`Candidate not saved: ${JSON.stringify(candidates)}`);
  }

  console.log("OK: builder admin partners smoke test passed");
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
