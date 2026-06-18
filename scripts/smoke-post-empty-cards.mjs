/**
 * Smoke test: empty shop/field-service cards hidden correctly
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const url = `file://${path.join(root, "post.html").replace(/\\/g, "/")}`;

await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage();
const errors = [];
page.on("pageerror", (err) => errors.push(String(err)));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});

await page.goto(url, { waitUntil: "networkidle" });

async function countVisible(selector) {
  return page.locator(selector).evaluateAll((nodes) =>
    nodes.filter((el) => {
      const style = window.getComputedStyle(el);
      return (
        !el.hidden &&
        !el.classList.contains("is-hidden") &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        el.getClientRects().length > 0
      );
    }).length
  );
}

async function emptyVisibleMounts(flowSelector, mountAttr) {
  return page.locator(`${flowSelector} [${mountAttr}]`).evaluateAll((nodes) =>
    nodes.filter((mount) => {
      const style = window.getComputedStyle(mount);
      const visible =
        !mount.hidden &&
        !mount.classList.contains("is-hidden") &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        mount.getClientRects().length > 0;
      if (!visible) return false;
      const hasControl = mount.querySelector(
        "input:not([type='hidden']), textarea, select, button, img, .post-images-block, [data-shop-product-row]"
      );
      return !hasControl;
    }).length
  );
}

const form = page.locator("#listingForm");

// Shop store + subcategory
await form.locator('[data-post-type="shop-store"]').click();
await page.waitForTimeout(400);
await form.locator('[data-shop-store-category="retail"] .post-category-pick__label').click();
await page.waitForTimeout(800);

const shopResults = {
  visibleShopFlow: await countVisible("[data-shop-store-flow]"),
  visibleEmptyShopMounts: await emptyVisibleMounts("[data-shop-store-flow]", "data-shop-mount"),
  visibleEmptyShopCards: await page.locator(".post-shop-store-card").evaluateAll((cards) =>
    cards.filter((card) => {
      const style = window.getComputedStyle(card);
      const visible =
        !card.hidden &&
        !card.classList.contains("is-hidden") &&
        style.display !== "none" &&
        card.getClientRects().length > 0;
      if (!visible) return false;
      const mount = card.querySelector("[data-shop-mount]");
      const hasControl = mount?.querySelector(
        "input:not([type='hidden']), textarea, select, button, img, .post-images-block, [data-shop-product-row]"
      );
      return !hasControl;
    }).length
  ),
};

// Field service — shop flow must be fully hidden
await form.locator('[data-post-type="business-service"]').click();
await page.waitForTimeout(300);
await form.locator('[data-category="cleaning"] .post-category-pick__label').click();
await page.waitForTimeout(800);

const fsResults = {
  visibleShopFlow: await countVisible("[data-shop-store-flow]"),
  visibleShopCards: await countVisible(".post-shop-store-card"),
  visibleFsFlow: await countVisible("[data-field-service-flow]"),
  visibleEmptyFsMounts: await emptyVisibleMounts("[data-field-service-flow]", "data-fs-mount"),
  headerOnlyFsCards: await page
    .locator("[data-field-service-flow] .post-field-service-card")
    .evaluateAll((cards) =>
      cards.filter((card) => {
        const style = window.getComputedStyle(card);
        const visible =
          !card.hidden &&
          !card.classList.contains("is-hidden") &&
          style.display !== "none" &&
          card.getClientRects().length > 0;
        if (!visible) return false;
        const body = card.querySelector(".post-field-service-card__body");
        const hasControl = body?.querySelector(
          "input:not([type='hidden']), textarea, select, button, img"
        );
        return !hasControl;
      }).length
    ),
};

// Subcategory change should not resurrect empty cards
await form.locator("[data-business-subcategory]").selectOption({ index: 1 }).catch(() => {});
await page.waitForTimeout(400);

const afterSubcategory = {
  visibleShopFlow: await countVisible("[data-shop-store-flow]"),
  visibleEmptyFsMounts: await emptyVisibleMounts("[data-field-service-flow]", "data-fs-mount"),
};

console.log(JSON.stringify({ errors, shopResults, fsResults, afterSubcategory }, null, 2));

});
const failed =
  errors.length > 0 ||
  shopResults.visibleEmptyShopMounts > 0 ||
  shopResults.visibleEmptyShopCards > 0 ||
  fsResults.visibleShopFlow > 0 ||
  fsResults.visibleShopCards > 0 ||
  fsResults.visibleEmptyFsMounts > 0 ||
  fsResults.headerOnlyFsCards > 0 ||
  afterSubcategory.visibleShopFlow > 0 ||
  afterSubcategory.visibleEmptyFsMounts > 0;

await closeAllBrowsers();
process.exit(failed ? 1 : 0);
