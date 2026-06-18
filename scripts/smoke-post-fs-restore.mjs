/**
 * Smoke test: field service flow restoration after category switches
 */
import { chromium } from "./lib/playwright-browser.mjs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const url = `file://${path.join(root, "post.html").replace(/\\/g, "/")}`;

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (err) => errors.push(String(err)));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});

await page.goto(url, { waitUntil: "networkidle" });

async function fsFieldVisible(id) {
  return page.locator(`#${id}`).evaluate((el) => {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    return (
      !el.hidden &&
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      el.getClientRects().length > 0
    );
  });
}

async function countVisibleFsMounts() {
  return page.locator("[data-field-service-flow] [data-fs-mount]").evaluateAll((nodes) =>
    nodes.filter((el) => {
      const style = window.getComputedStyle(el);
      return (
        !el.hidden &&
        !el.classList.contains("is-hidden") &&
        style.display !== "none" &&
        el.getClientRects().length > 0
      );
    }).length
  );
}

const form = page.locator("#listingForm");

// Initial field service
await form.locator('[data-post-type="business-service"]').click();
await page.waitForTimeout(300);
await form.locator('[data-category="cleaning"] .post-category-pick__label').click();
await page.waitForTimeout(800);

const initial = {
  company: await fsFieldVisible("bizCompanyName"),
  catchCopy: await fsFieldVisible("fsCatchCopy"),
  cta: await page.locator("[data-fs-show-estimate-chk]").count(),
  mounts: await countVisibleFsMounts(),
};

// Switch category within field service
await form.locator('[data-category="repair_maintenance"] .post-category-pick__label').click();
await page.waitForTimeout(600);

const afterCategorySwitch = {
  company: await fsFieldVisible("bizCompanyName"),
  catchCopy: await fsFieldVisible("fsCatchCopy"),
  mounts: await countVisibleFsMounts(),
};

// Field service -> skill -> field service
await form.locator('[data-general-category][value="skill"]').click({ force: true });
await page.waitForTimeout(500);
await form.locator('[data-post-type="business-service"]').click();
await page.waitForTimeout(300);
await form.locator('[data-category="cleaning"] .post-category-pick__label').click();
await page.waitForTimeout(800);

const afterGeneralReturn = {
  company: await fsFieldVisible("bizCompanyName"),
  catchCopy: await fsFieldVisible("fsCatchCopy"),
  mounts: await countVisibleFsMounts(),
  shopCardsVisible: await page.locator(".post-shop-store-card").evaluateAll((cards) =>
    cards.filter((c) => {
      const s = window.getComputedStyle(c);
      return !c.hidden && s.display !== "none" && c.getClientRects().length > 0;
    }).length
  ),
};

// Field service -> shop -> field service
await form.locator('[data-post-type="shop-store"]').click();
await page.waitForTimeout(500);
await form.locator('[data-post-type="business-service"]').click();
await page.waitForTimeout(300);
await form.locator('[data-category="it_web"] .post-category-pick__label').click();
await page.waitForTimeout(800);

const afterShopReturn = {
  company: await fsFieldVisible("bizCompanyName"),
  serviceDesc: await fsFieldVisible("bizExtraFieldServiceDesc"),
  mounts: await countVisibleFsMounts(),
  shopFlowVisible: await page.locator("[data-shop-store-flow]").evaluate((el) => {
    if (!el) return false;
    const s = window.getComputedStyle(el);
    return !el.hidden && s.display !== "none" && el.getClientRects().length > 0;
  }),
};

console.log(
  JSON.stringify({ errors, initial, afterCategorySwitch, afterGeneralReturn, afterShopReturn }, null, 2)
);

await browser.close();

const failed =
  errors.length > 0 ||
  !initial.company ||
  !initial.catchCopy ||
  initial.mounts < 5 ||
  !afterCategorySwitch.company ||
  !afterGeneralReturn.company ||
  !afterShopReturn.company ||
  afterGeneralReturn.shopCardsVisible > 0 ||
  afterShopReturn.shopFlowVisible;

process.exit(failed ? 1 : 0);
