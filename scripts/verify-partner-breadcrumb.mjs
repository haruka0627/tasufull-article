/**
 * Partner management breadcrumb — admin dashboard navigation + viewport screenshots
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.PRT_UI_BASE || "http://127.0.0.1:8788";
const OUT_DIR = path.join("reports", "screenshots", "partner-mgmt-ui", "breadcrumb-fix");

const VIEWPORTS = [
  { label: "390", width: 390, height: 844 },
  { label: "768", width: 768, height: 1024 },
  { label: "1280", width: 1280, height: 900 },
];

function expectedText(pageName) {
  return pageName === "mgmt"
    ? ["運営ダッシュボード", "協力パートナー管理"]
    : ["運営ダッシュボード", "協力パートナー管理", "パートナー詳細"];
}

async function navigateTo(page, pageName) {
  await page.goto(`${BASE}/builder-admin/admin-index.html`, { waitUntil: "networkidle", timeout: 30000 });
  await page.locator('[data-builder-quick="partner-management"]').click();
  await page.waitForURL(/partner-management\.html/, { timeout: 15000 });

  if (pageName === "mgmt") {
    await page.waitForSelector("[data-prt-mgmt-table]", { timeout: 15000 });
    return;
  }

  await page.goto(`${BASE}/builder/partner-management.html?mock=1`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForSelector("[data-prt-mgmt-tbody] .builder-prt-app-card", { timeout: 15000 });
  await page.locator("[data-prt-mgmt-tbody] .builder-prt-app-card").first().click();
  await page.waitForURL(/partner-detail\.html/, { timeout: 15000 });
  await page.waitForSelector("[data-prt-detail-content]:not([hidden])", { timeout: 15000 });
}

async function verifyViewport(browser, vp, pageName) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await context.newPage();

  await navigateTo(page, pageName);

  const metrics = await page.evaluate((labels) => {
    const nav = document.querySelector("nav[data-breadcrumb]");
    const content = document.querySelector(".builder-stat-grid, .builder-panel, [data-prt-detail-content]");
    const root = document.documentElement;
    const navBox = nav?.getBoundingClientRect();
    const contentBox = content?.getBoundingClientRect();
    const navHidden = !nav || nav.hidden || nav.offsetParent === null;
    const navText = nav?.textContent?.trim() || "";
    const leftDelta = navBox && contentBox ? Math.abs(navBox.left - contentBox.left) : null;
    const dashLink = nav?.querySelector('a[href*="admin-index"]');
    return {
      navHidden,
      navText,
      hasDashLink: !!dashLink,
      labelsOk: labels.every((label) => navText.includes(label)),
      noGenzai: navText.includes("現在地"),
      navLeft: navBox?.left ?? null,
      contentLeft: contentBox?.left ?? null,
      leftDelta,
      horizontalScroll: root.scrollWidth > root.clientWidth + 1,
      navInViewport: navBox ? navBox.left >= 0 && navBox.right <= root.clientWidth + 0.5 : false,
    };
  }, expectedText(pageName));

  const shot = path.join(OUT_DIR, `${pageName}-breadcrumb-${vp.label}.png`);
  await page.screenshot({ path: shot, clip: { x: 0, y: 0, width: vp.width, height: Math.min(vp.height, 460) } });

  await context.close();
  return {
    page: pageName,
    viewport: vp.label,
    screenshot: shot,
    ...metrics,
    ok:
      !metrics.navHidden &&
      metrics.hasDashLink &&
      metrics.labelsOk &&
      !metrics.noGenzai &&
      metrics.navInViewport &&
      !metrics.horizontalScroll &&
      (metrics.leftDelta ?? 99) <= 2,
  };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const results = [];

  for (const pageName of ["mgmt", "detail"]) {
    for (const vp of VIEWPORTS) {
      results.push(await verifyViewport(browser, vp, pageName));
    }
  }

  await browser.close();

  const report = {
    checkedAt: new Date().toISOString(),
    base: BASE,
    results,
    summary: {
      total: results.length,
      pass: results.filter((r) => r.ok).length,
      fail: results.filter((r) => !r.ok).length,
    },
  };

  await writeFile("reports/partner-breadcrumb-fix-verify.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.summary.fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
