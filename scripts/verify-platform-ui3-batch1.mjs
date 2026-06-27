#!/usr/bin/env node
/**
 * Phase UI-3 batch 1 verification
 */
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const VIEWPORTS = [
  { name: "390", width: 390, height: 844 },
  { name: "768", width: 768, height: 1024 },
  { name: "1280", width: 1280, height: 900 },
];

function pageUrl(rel) {
  const base = process.env.BUILDER_BASE_URL;
  if (base) return `${base.replace(/\/$/, "")}/${rel.replace(/^\//, "")}`;
  const [pathPart, query = ""] = rel.split("?");
  const file = path.join(root, "deploy/cloudflare/dist", pathPart);
  const href = pathToFileURL(file).href;
  return query ? `${href}?${query}` : href;
}

function fail(msg) {
  console.error("FAIL:", msg);
  closeAllBrowsers().finally(() => process.exit(1));
}

function pass(msg) {
  console.log("PASS:", msg);
}

async function checkOverflow(page, vp) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  );
  if (overflow) fail(`${vp.name}px horizontal scroll`);
  pass(`${vp.name}px no horizontal scroll`);
}

async function main() {
  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage();

    for (const vp of VIEWPORTS) {
      console.log(`\n=== ${vp.name}px ===`);
      await page.setViewportSize({ width: vp.width, height: vp.height });

      await page.goto(pageUrl("listing-category-page.html"), { waitUntil: "domcontentloaded", timeout: 60000 });
      const hubTitle = await page.locator("[data-category-title]").textContent();
      if (!hubTitle?.includes("掲載")) fail(`${vp.name}px listing hub title missing`);
      pass(`${vp.name}px listing-category-page loads (${hubTitle})`);
      const emptyVisible = await page.locator("[data-category-empty]").isVisible();
      pass(`${vp.name}px empty-state visible=${emptyVisible}`);
      await checkOverflow(page, vp);

      await page.goto(pageUrl("index.html"), { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.goto(pageUrl("listing-category-page.html?q=test"), { waitUntil: "domcontentloaded" });
      pass(`${vp.name}px listing-category-page?q=test not 404`);

      for (const [rel, label] of [
        ["shop-store.html", "home"],
        ["shop-search.html", "search"],
        ["shop-market-cart.html", "cart"],
        ["shop-market-order-history.html", "orders"],
      ]) {
        await page.goto(pageUrl(rel), { waitUntil: "domcontentloaded", timeout: 60000 });
        await page.waitForSelector("[data-tasu-market-tabbar]", { state: "attached", timeout: 15000 });
        const display = await page.evaluate(() => getComputedStyle(document.querySelector("[data-tasu-market-tabbar]")).display);
        if (vp.width <= 1024 && display === "none") {
          fail(`${vp.name}px ${rel} tabbar hidden on SP`);
        }
        if (vp.width > 1024 && display === "none") {
          pass(`${vp.name}px ${rel} tabbar hidden on PC (expected)`);
        } else {
          pass(`${vp.name}px ${rel} tabbar present (display=${display})`);
        }
      }

      await page.goto(pageUrl("shop-store.html"), { waitUntil: "domcontentloaded" });
      const orderHref = await page.locator('[data-tasu-market-tabbar] a:has-text("注文")').getAttribute("href");
      if (!orderHref?.includes("shop-market-order-history")) {
        fail(`${vp.name}px tabbar order href wrong: ${orderHref}`);
      }
      pass(`${vp.name}px tabbar order -> ${orderHref}`);
    }

    console.log("\nAll Phase UI-3 batch 1 checks passed.");
  });
}

main().catch((e) => {
  console.error(e);
  closeAllBrowsers().finally(() => process.exit(1));
});
