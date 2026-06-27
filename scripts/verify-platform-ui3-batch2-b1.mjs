#!/usr/bin/env node
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";
import fs from "fs";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "deploy/cloudflare/dist");
const VPs = [
  { name: "390", width: 390, height: 844 },
  { name: "768", width: 768, height: 1024 },
  { name: "1280", width: 1280, height: 900 },
];

function url(rel) {
  return pathToFileURL(path.join(dist, rel)).href;
}

function fail(m) {
  console.error("FAIL:", m);
  closeAllBrowsers().finally(() => process.exit(1));
}

async function main() {
  const redirects = fs.readFileSync(path.join(dist, "_redirects"), "utf8");
  if (!redirects.includes("/contact") || !redirects.includes("iwasho/contact.html")) {
    fail("_redirects missing /contact rule");
  }
  console.log("PASS: _redirects has /contact → iwasho/contact.html");

  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage();
    const errs = [];
    page.on("pageerror", (e) => errs.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error" && !/Failed to load resource/i.test(m.text())) errs.push(m.text());
    });

    for (const vp of VPs) {
      console.log(`\n=== ${vp.name}px ===`);
      errs.length = 0;
      await page.setViewportSize({ width: vp.width, height: vp.height });

      await page.goto(url("index.html"), { waitUntil: "domcontentloaded", timeout: 60000 });
      const topNav = await page.locator(".top-site-header__nav").evaluate((el) => getComputedStyle(el).display);
      const tab = page.locator("[data-tasu-portal-tabbar]");
      const tabN = await tab.count();
      const tabD = tabN ? await tab.evaluate((el) => getComputedStyle(el).display) : "missing";
      if (vp.width <= 900 && tabD === "none") fail(`${vp.name}px / tabbar hidden`);
      if (vp.width > 900 && tabD === "grid") fail(`${vp.name}px / tabbar visible on PC`);
      if (vp.width > 900 && topNav === "none") fail(`${vp.name}px / PC nav hidden`);
      const href = await page.locator('.top-site-header__nav a:has-text("掲載を探す")').getAttribute("href");
      if (!href?.includes("/market")) fail(`掲載 href=${href}`);
      console.log(`PASS: / tabbar=${tabD} nav=${topNav} 掲載→${href}`);

      await page.goto(url("market/index.html"), { waitUntil: "domcontentloaded", timeout: 60000 });
      const assets = await page.evaluate(() => ({
        css: !!document.querySelector('link[href="/index-home.css"]'),
        js: !!document.querySelector('script[src="/index-home.js"]'),
        tabbar: !!document.querySelector('script[src="/platform-portal-tabbar.js"]'),
        header: !!document.querySelector(".home-header.top-portal-header"),
      }));
      if (!assets.css || !assets.js || !assets.header) fail(`${vp.name}px market assets ${JSON.stringify(assets)}`);
      const ov = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
      );
      if (ov) fail(`${vp.name}px market overflow`);
      const mTabD = (await page.locator("[data-tasu-portal-tabbar]").count())
        ? await page.locator("[data-tasu-portal-tabbar]").evaluate((el) => getComputedStyle(el).display)
        : "missing";
      if (vp.width <= 900 && mTabD === "none") fail(`${vp.name}px market tabbar hidden`);
      console.log(`PASS: /market/ assets=${JSON.stringify(assets)} tabbar=${mTabD} overflow=false`);

      if (errs.length) fail(`${vp.name}px ${errs.join("; ")}`);
    }
    console.log("\nAll file:// checks passed.");
  });
}

main().catch((e) => {
  console.error(e);
  closeAllBrowsers().finally(() => process.exit(1));
});
