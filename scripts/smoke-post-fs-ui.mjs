/**
 * Smoke test: post.html field service CTA toggles + empty cards + terms layout
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

const form = page.locator("#listingForm");
await form.locator('[data-post-type="business-service"]').click();
await page.waitForTimeout(300);
await form.locator('[data-category="cleaning"] .post-category-pick__label').click();
await page.waitForTimeout(800);

const fsResults = {
  toggleCount: await form.locator("[data-fs-show-estimate-chk]").count(),
  inquiryToggle: await form.locator("[data-fs-show-inquiry-chk]").count(),
  phoneToggle: await form.locator("[data-fs-show-phone-btn-chk]").count(),
  aiToggle: await form.locator("[data-fs-show-ai-chk]").count(),
  estimateText: await form.locator("#fsCtaEstimateText").count(),
  hiddenEmptyMounts: await form.locator("[data-fs-mount].is-hidden, [data-fs-mount][hidden]").count(),
  serviceMenuList: await form.locator("[data-service-menu-list]").count(),
  workCasesList: await form.locator("[data-work-cases-list]").count(),
};

await form.locator('[data-post-type="shop-store"]').click();
await page.waitForTimeout(800);

const shopResults = {
  termsCard: await form.locator(".post-terms-card").count(),
  termsFlex: await form.locator(".post-terms-check").evaluate((el) =>
    el ? getComputedStyle(el).alignItems : null
  ),
  businessNoteHidden: await form.locator("[data-business-terms-note]").evaluate((el) =>
    el ? el.hidden : null
  ),
};

await form.locator('[data-general-category][value="skill"]').click({ force: true });
await page.waitForTimeout(400);

const generalResults = {
  termsCard: await form.locator(".post-terms-card").count(),
  businessNoteHidden: await form.locator("[data-business-terms-note]").evaluate((el) =>
    el ? el.hidden : null
  ),
};

console.log(JSON.stringify({ errors, fsResults, shopResults, generalResults }, null, 2));

await browser.close();
process.exit(errors.length ? 1 : 0);
