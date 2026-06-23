/**
 * 建設ツール導線監査 — 一般/パートナーダッシュボード
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const OUT = path.join(root, "reports", "screenshots", "builder-ct-routes-audit");
const BASE = "http://127.0.0.1:8788/builder";
const WIDTH = { width: 1280, height: 900 };

fs.mkdirSync(OUT, { recursive: true });

const PAGES = [
  {
    slug: "user-dashboard",
    url: `${BASE}/user-dashboard`,
    label: "一般ユーザーダッシュボード",
    quickSelector: 'a.builder-quick-card[href="construction-tools.html"]',
  },
  {
    slug: "partner-dashboard",
    url: `${BASE}/index`,
    label: "パートナーダッシュボード",
    quickSelector: 'a.builder-quick-card[href="construction-tools.html"]',
  },
];

function auditLinks(page) {
  return page.evaluate(() => {
    const hits = [];
    document.querySelectorAll('a[href*="construction-tools"]').forEach((a) => {
      const section = a.closest("section")?.getAttribute("aria-label")
        || a.closest("nav")?.getAttribute("aria-label")
        || a.closest("aside")?.getAttribute("aria-label")
        || a.closest("[class]")?.className?.split(" ")[0]
        || "unknown";
      const text = (a.textContent || "").replace(/\s+/g, " ").trim();
      hits.push({ href: a.getAttribute("href"), text, section });
    });
    return hits;
  });
}

await withPlaywrightBrowser(async (browser) => {
  const report = [];

  for (const p of PAGES) {
    const page = await browser.newPage({ viewport: WIDTH });
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));

    await page.goto(p.url, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForSelector(".builder-quick-section", { timeout: 15000 });
    await page.waitForTimeout(500);

    const links = await auditLinks(page);

    // 1) ファーストビュー（サイドメニュー + サマリーカード）
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(OUT, `${p.slug}-fold-1280.png`) });

    // 2) サイドバーメニュー（クリップ）
    const sidebar = page.locator(".builder-partner-sidebar__nav");
    if (await sidebar.count()) {
      await sidebar.screenshot({ path: path.join(OUT, `${p.slug}-sidebar-menu-1280.png`) });
    }

    // 3) サマリーステータスカード
    const stats = page.locator(".builder-stat-grid");
    if (await stats.count()) {
      await stats.screenshot({ path: path.join(OUT, `${p.slug}-stat-cards-1280.png`) });
    }

    // 4) メインメニュー（建設ツールカードを含む）
    const quick = page.locator(".builder-quick-section");
    await quick.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await quick.screenshot({ path: path.join(OUT, `${p.slug}-quick-menu-1280.png`) });

    // 5) 建設ツールカード単体ハイライト
    const ctCard = page.locator(p.quickSelector);
    if (await ctCard.count()) {
      await ctCard.scrollIntoViewIfNeeded();
      await ctCard.evaluate((el) => el.style.outline = "3px solid #f97316");
      await ctCard.screenshot({ path: path.join(OUT, `${p.slug}-construction-tools-card-1280.png`) });
    }

    report.push({ page: p.label, slug: p.slug, links, errors });
    await page.close();
  }

  fs.writeFileSync(path.join(OUT, "audit-links.json"), JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify(report, null, 2));
});

await closeAllBrowsers();
console.log(`Saved screenshots to ${OUT}`);
