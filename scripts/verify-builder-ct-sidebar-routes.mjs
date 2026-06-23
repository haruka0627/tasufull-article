/**
 * サイドメニュー「建設ツール」導線確認
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const OUT = path.join(root, "reports", "screenshots", "builder-ct-sidebar-routes");
const BASE = "http://127.0.0.1:8788/builder";

fs.mkdirSync(OUT, { recursive: true });

const CASES = [
  { slug: "user", url: `${BASE}/user-dashboard`, label: "一般ユーザー" },
  { slug: "partner", url: `${BASE}/index`, label: "パートナー" },
];

await withPlaywrightBrowser(async (browser) => {
  for (const c of CASES) {
    for (const vp of [{ width: 1280, height: 900, tag: "1280" }, { width: 390, height: 844, tag: "390" }]) {
      const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
      const errors = [];
      page.on("pageerror", (e) => errors.push(String(e)));

      await page.goto(c.url, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForSelector('[data-builder-sidebar-key="construction-tools"]', { timeout: 10000 });

      if (vp.width < 768) {
        await page.click("[data-builder-sidebar-toggle]");
        await page.waitForSelector(".builder-partner-sidebar-open", { timeout: 5000 });
        await page.waitForTimeout(300);
      }

      const sidebarNav = page.locator(".builder-partner-sidebar__nav");
      await sidebarNav.screenshot({
        path: path.join(OUT, `${c.slug}-sidebar-${vp.tag}.png`),
      });

      const ctLink = page.locator('[data-builder-sidebar-key="construction-tools"]');
      await ctLink.scrollIntoViewIfNeeded();
      await ctLink.evaluate((el) => {
        el.style.outline = "3px solid #f97316";
      });
      await ctLink.screenshot({
        path: path.join(OUT, `${c.slug}-construction-tools-link-${vp.tag}.png`),
      });

      await ctLink.click();
      await page.waitForURL(/construction-tools/, { timeout: 15000 });
      await page.waitForSelector(".builder-ct-summary", { timeout: 10000 });
      await page.waitForTimeout(400);

      const hScroll = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
      );

      await page.screenshot({
        path: path.join(OUT, `${c.slug}-after-nav-${vp.tag}.png`),
        fullPage: true,
      });

      console.log(`✓ ${c.label} ${vp.tag}px → ${page.url()}`);
      console.log(`  horizontal scroll: ${hScroll ? "YES" : "no"}`);
      if (errors.length) console.log(`  errors: ${errors.join(" | ")}`);

      await page.close();
    }
  }
});

await closeAllBrowsers();
console.log(`Done: ${OUT}`);
