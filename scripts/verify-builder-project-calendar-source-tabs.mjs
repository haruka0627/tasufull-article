#!/usr/bin/env node
/**
 * project-calendar — 表示切替タブ検証
 *
 *   node scripts/verify-builder-project-calendar-source-tabs.mjs
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl, buildLocalPageUrl } from "./lib/dev-server-url.mjs";

const base = await findDevServerBaseUrl({ probePath: "builder/project-calendar.html" });
const url = buildLocalPageUrl(base, "builder/project-calendar.html");
const VIEWPORTS = [
  { name: "1280", width: 1280, height: 900 },
  { name: "768", width: 768, height: 1024 },
  { name: "390", width: 390, height: 844 },
];

const errors = [];
const pass = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => {
  errors.push(m);
  console.log(`  ✗ ${m}`);
};

console.log("URL:", url);

await withPlaywrightBrowser(async (browser) => {
  for (const vp of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    const consoleErrors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    const status = res?.status() ?? 0;
    if (status === 200) pass(`${vp.name}px HTTP 200`);
    else fail(`${vp.name}px HTTP ${status}`);

    const tabs = page.locator(".builder-pc-source-tabs");
    if ((await tabs.count()) === 1) pass(`${vp.name}px source tabs container`);
    else fail(`${vp.name}px source tabs container missing`);

    const partnerBtn = page.locator('[data-builder-pc-source="partner"]');
    const standardBtn = page.locator('[data-builder-pc-source="standard"]');
    if ((await partnerBtn.count()) === 1 && (await standardBtn.count()) === 1) {
      pass(`${vp.name}px partner/standard buttons present`);
    } else {
      fail(`${vp.name}px toggle buttons missing`);
    }

    const partnerVisible = await partnerBtn.isVisible();
    const standardVisible = await standardBtn.isVisible();
    if (partnerVisible && standardVisible) pass(`${vp.name}px toggle buttons visible`);
    else fail(`${vp.name}px toggle buttons not visible`);

    const partnerBox = await partnerBtn.boundingBox();
    if (partnerBox && partnerBox.y < vp.height) pass(`${vp.name}px toggle in initial viewport`);
    else fail(`${vp.name}px toggle below fold (y=${partnerBox?.y})`);

    const partnerText = (await partnerBtn.textContent())?.trim();
    const standardText = (await standardBtn.textContent())?.trim();
    if (partnerText === "パートナー案件" && standardText === "通常カレンダー") {
      pass(`${vp.name}px toggle labels`);
    } else {
      fail(`${vp.name}px labels got "${partnerText}" / "${standardText}"`);
    }

    await partnerBtn.click();
    await page.waitForTimeout(300);
    const partnerSection = page.locator("[data-builder-cal-partner][data-admin-cal-embed]");
    if (await partnerSection.isVisible()) pass(`${vp.name}px partner admin-cal embed visible`);
    else fail(`${vp.name}px partner admin-cal embed hidden after switch`);

    const grid = partnerSection.locator("[data-admin-cal-grid] .admin-cal-monthHead, [data-admin-cal-grid] .admin-cal-weekHead");
    if ((await grid.count()) >= 1) pass(`${vp.name}px admin-cal grid rendered`);
    else fail(`${vp.name}px admin-cal grid missing`);

    const standardSection = page.locator("[data-builder-cal-standard]");
    if (await standardSection.isHidden()) pass(`${vp.name}px standard view hidden in partner mode`);
    else fail(`${vp.name}px standard view still visible in partner mode`);

    await standardBtn.click();
    await page.waitForTimeout(150);
    if (await standardSection.isVisible()) pass(`${vp.name}px standard view visible`);
    else fail(`${vp.name}px standard view hidden after switch`);

    if (consoleErrors.length === 0) pass(`${vp.name}px no console errors`);
    else fail(`${vp.name}px console errors: ${consoleErrors.join(" | ")}`);

    await page.close();
  }
});

await closeAllBrowsers();

console.log(`\n${errors.length === 0 ? "PASS" : "FAIL"} (${errors.length} errors)`);
if (errors.length) process.exitCode = 1;
