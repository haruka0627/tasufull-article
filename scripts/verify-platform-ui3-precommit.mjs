#!/usr/bin/env node
/**
 * Pre-commit final check — Phase UI-3 batch 1
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

const PAGES = [
  "listing-category-page.html",
  "listing-category-page.html?q=test",
  "shop-store.html",
  "shop-search.html",
  "shop-market-cart.html",
  "shop-market-checkout.html",
  "shop-market-order-history.html",
];

function pageUrl(rel) {
  const [pathPart, query = ""] = rel.split("?");
  const file = path.join(root, "deploy/cloudflare/dist", pathPart);
  const href = pathToFileURL(file).href;
  return query ? `${href}?${query}` : href;
}

function fail(msg) {
  console.error("FAIL:", msg);
  closeAllBrowsers().finally(() => process.exit(1));
}

async function main() {
  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage();
    const consoleErrors = [];

    page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));
    page.on("console", (msg) => {
      if (msg.type() !== "error") return;
      const text = msg.text();
      if (/Failed to load resource/i.test(text)) return;
      if (/favicon/i.test(text)) return;
      consoleErrors.push(`console: ${text}`);
    });

    for (const vp of VIEWPORTS) {
      console.log(`\n=== ${vp.name}px ===`);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      consoleErrors.length = 0;

      for (const rel of PAGES) {
        await page.goto(pageUrl(rel), { waitUntil: "domcontentloaded", timeout: 90000 });
        await page.waitForTimeout(800);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
        );
        if (overflow) fail(`${vp.name}px ${rel} horizontal scroll`);
      }

      await page.goto(pageUrl("shop-store.html"), { waitUntil: "domcontentloaded" });
      const orderHref = await page.locator('[data-tasu-market-tabbar] a:has-text("注文")').getAttribute("href");
      if (!orderHref?.includes("shop-market-order-history")) {
        fail(`${vp.name}px orders link wrong: ${orderHref}`);
      }

      if (consoleErrors.length) {
        fail(`${vp.name}px JS errors:\n  ${consoleErrors.join("\n  ")}`);
      }
      console.log(`PASS: ${vp.name}px — ${PAGES.length} pages, no overflow, no JS errors`);
    }

    // tabbar.js without mount / data-page — must not throw
    await page.goto(pageUrl("index.html"), { waitUntil: "domcontentloaded" });
    const tabbarJs = await page.evaluate(async () => {
      try {
        await new Promise((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "shop-market-tabbar.js";
          s.onload = resolve;
          s.onerror = () => reject(new Error("load failed"));
          document.body.appendChild(s);
        });
        return { ok: true, hasTabbar: !!document.querySelector("[data-tasu-market-tabbar]") };
      } catch (e) {
        return { ok: false, err: String(e) };
      }
    });
    if (!tabbarJs.ok) fail(`tabbar.js load error on index: ${tabbarJs.err}`);
    if (tabbarJs.hasTabbar) fail("tabbar rendered on index.html without mount");
    console.log("PASS: shop-market-tabbar.js no-op without mount on index.html");

    console.log("\nAll pre-commit checks passed.");
  });
}

main().catch((e) => {
  console.error(e);
  closeAllBrowsers().finally(() => process.exit(1));
});
