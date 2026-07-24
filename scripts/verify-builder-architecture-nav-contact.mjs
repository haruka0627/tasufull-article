#!/usr/bin/env node
/**
 * Builder architecture: unified nav · contact reveal · calendar regression smoke
 *
 *   node scripts/verify-builder-architecture-nav-contact.mjs
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl, buildLocalPageUrl } from "./lib/dev-server-url.mjs";
import { BUILDER_QA_VIEWPORTS } from "./lib/playwright-viewport.mjs";

const REVEAL_KEY = "tasful:builder:contact-reveals:v1";

const base = await findDevServerBaseUrl({ probePath: "builder/project-calendar.html" });
const calendarUrl = buildLocalPageUrl(base, "builder/project-calendar.html");
const vendorPagesUrl = buildLocalPageUrl(base, "builder/vendor-pages.html");
const workersUrl = buildLocalPageUrl(base, "builder/find-workers.html");
const partnerDetailUrl = buildLocalPageUrl(
  base,
  "builder/partner.html?partner_id=demo-partner-001"
);

const errors = [];
const pass = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => {
  errors.push(m);
  console.log(`  ✗ ${m}`);
};

const EXPECT_NAV_IDS = [
  "dashboard",
  "calendar",
  "projects",
  "worker-search",
  "vendor-search",
  "vendor-pages",
  "invoices",
  "documents",
  "notifications",
  "settings",
];

async function resetReveals(page) {
  await page.evaluate((key) => localStorage.removeItem(key), REVEAL_KEY);
}

for (const vp of BUILDER_QA_VIEWPORTS) {
  console.log(`\n=== viewport ${vp.width}x${vp.height} ===`);

  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    const consoleErrors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    // ── Nav on project-calendar ──
    await page.goto(calendarUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
    for (const id of EXPECT_NAV_IDS) {
      const link = page.locator(`[data-builder-nav-id="${id}"]`);
      if ((await link.count()) >= 1) pass(`nav link ${id} on calendar`);
      else fail(`nav link ${id} missing on calendar`);
    }

    const partnerTab = page.locator('[data-builder-pc-source="partner"]');
    if ((await partnerTab.count()) >= 1) pass("partner calendar tab present");
    else fail("partner calendar tab missing");

    // ── Vendor pages placeholder ──
    await page.goto(vendorPagesUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
    const vendorTitle = await page.locator("h1").first().textContent();
    if (/業者ページ/.test(vendorTitle || "")) pass("vendor-pages placeholder title");
    else fail(`vendor-pages title unexpected: ${vendorTitle}`);

    // ── Worker contact reveal ──
    await page.goto(workersUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
    await resetReveals(page);
    await page.locator("[data-builder-fw-search-form]").dispatchEvent("submit");
    await page.locator("[data-builder-fw-results]").waitFor({ state: "visible", timeout: 10000 });
    await page.locator("[data-builder-fw-detail]").first().click();
    await page.locator("[data-builder-fw-profile]").waitFor({ state: "visible", timeout: 5000 });

    const locked = page.locator(".builder-contact-reveal--locked");
    if ((await locked.count()) >= 1) pass("worker contact masked before reveal");
    else fail("worker contact should be masked before reveal");

    const maskedText = await locked.first().textContent();
    if (!/090-\d{4}-\d{4}/.test(maskedText || "")) pass("no real phone before reveal");
    else fail("real phone visible before reveal");

    page.once("dialog", (d) => d.accept());
    await page.locator("[data-builder-contact-reveal]").first().click();
    await page.locator(".builder-contact-reveal--open").waitFor({ state: "visible", timeout: 5000 });
    const openText = await page.locator(".builder-contact-reveal--open").first().textContent();
    if (/090-1234-5678|080-|070-/.test(openText || "")) pass("worker contact revealed after payment");
    else fail("worker contact not revealed after payment");

    const chatForm = page.locator("[data-builder-mvp-thread-form]");
    if ((await chatForm.count()) === 0) pass("no Builder chat UI on worker profile");
    else fail("Builder chat UI should not appear");

    // ── Partner contact reveal ──
    await page.goto(partnerDetailUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
    await resetReveals(page);
    const partnerLocked = page.locator(".builder-contact-reveal--locked");
    if ((await partnerLocked.count()) >= 1) pass("partner contact masked before reveal");
    else fail("partner contact reveal panel missing");

    page.once("dialog", (d) => d.accept());
    await page.locator("[data-builder-contact-reveal]").first().click();
    await page.locator(".builder-contact-reveal--open").waitFor({ state: "visible", timeout: 5000 });
    const partnerOpen = await page.locator(".builder-contact-reveal--open").first().textContent();
    if (/03-5555|@/.test(partnerOpen || "")) pass("partner contact revealed");
    else fail("partner contact not revealed");

    if (consoleErrors.length === 0) pass("console errors: 0");
    else fail(`console errors: ${consoleErrors.join(" | ")}`);
  });
}

await closeAllBrowsers();

console.log("\n=== summary ===");
if (errors.length) {
  console.error(`FAIL (${errors.length}):`);
  errors.forEach((e) => console.error(`  - ${e}`));
  process.exit(1);
}
console.log("PASS verify-builder-architecture-nav-contact");
