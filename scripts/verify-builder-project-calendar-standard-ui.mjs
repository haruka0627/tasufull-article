#!/usr/bin/env node
/**
 * project-calendar — 通常カレンダー UI 検証（参考画像 SSOT）
 *
 *   node scripts/verify-builder-project-calendar-standard-ui.mjs
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import {
  BUILDER_QA_VIEWPORTS,
  assertBrowserLikeEnv,
  createBrowserLikePage,
} from "./lib/playwright-viewport.mjs";
import { findDevServerBaseUrl, buildLocalPageUrl } from "./lib/dev-server-url.mjs";

const base = await findDevServerBaseUrl({ probePath: "builder/project-calendar.html" });
const url = buildLocalPageUrl(base, "builder/project-calendar.html");

const errors = [];
const pass = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => {
  errors.push(m);
  console.log(`  ✗ ${m}`);
};

console.log("URL:", url);

await withPlaywrightBrowser(async (browser) => {
  const vp = BUILDER_QA_VIEWPORTS.find((v) => v.id === "1280");
  const { context, page } = await createBrowserLikePage(browser, vp);
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  try {
  const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
  if ((res?.status() ?? 0) === 200) pass("HTTP 200");
  else fail(`HTTP ${res?.status() ?? 0}`);

  const envCheck = await assertBrowserLikeEnv(page, vp);
  if (envCheck.ok) pass(`browser-like env dpr=${envCheck.env.devicePixelRatio} mq960=${envCheck.env.mq960}`);
  else fail(`browser-like env: ${envCheck.errors.join("; ")}`);

  const checks = [
    [".builder-partner-sidebar", "common sidebar"],
    ['a.builder-partner-sidebar__link[href="project-calendar.html"].is-active', "calendar nav active"],
    [".builder-partner-layout", "partner layout"],
    [".builder-cal-topbar", "topbar"],
    [".builder-cal-standard__grid", "3-column grid"],
    ["[data-builder-cal-card-today]", "today card"],
    ["[data-builder-cal-card-week]", "week card"],
    ["[data-builder-cal-card-delayed]", "delayed card"],
    [".builder-cal-center", "calendar center"],
    ["[data-builder-cal-detail]", "detail panel"],
    [".builder-cal-legend", "legend footer"],
    ['[data-builder-pc-source="standard"].is-active', "standard tab active"],
  ];

  for (const [sel, label] of checks) {
    const count = await page.locator(sel).count();
    if (count >= 1) pass(`${label} present`);
    else fail(`${label} missing (${sel})`);
  }

  const grid = page.locator(".builder-cal-standard__grid");
  const box = await grid.boundingBox();
  if (box && box.width >= 900) pass(`grid width ${Math.round(box.width)}px`);
  else fail(`grid too narrow (${box?.width})`);

  const tabsBox = await page.locator(".builder-pc-source-tabs").boundingBox();
  if (tabsBox && tabsBox.y < 900) pass("source tabs in viewport");
  else fail("source tabs below fold");

  const monthLabel = await page.locator("[data-builder-pc-period-label]").textContent();
  if (monthLabel && /\d{4}年\d{1,2}月/.test(monthLabel.trim())) pass(`month label: ${monthLabel.trim()}`);
  else fail(`month label invalid: ${monthLabel}`);

  const todayCount = await page.locator("[data-builder-cal-today-count]").textContent();
  if (todayCount && /件/.test(todayCount)) pass(`today count: ${todayCount.trim()}`);
  else fail(`today count missing: ${todayCount}`);

  const firstEvent = page.locator("[data-builder-cal-event]").first();
  if ((await firstEvent.count()) > 0) {
    pass("calendar events rendered");
    await firstEvent.click();
    await page.waitForTimeout(150);
    const detailTitle = page.locator(".builder-cal-detail__title");
    if ((await detailTitle.count()) > 0 && (await detailTitle.isVisible())) {
      pass(`detail panel: ${(await detailTitle.textContent())?.trim()}`);
    } else {
      fail("detail panel not shown after click");
    }
  } else {
    fail("no calendar events rendered");
  }

  if (consoleErrors.length === 0) pass("no console errors");
  else fail(`console errors: ${consoleErrors.join(" | ")}`);
  } finally {
    await context.close();
  }
});

await closeAllBrowsers();

console.log(`\n${errors.length === 0 ? "PASS" : "FAIL"} (${errors.length} errors)`);
if (errors.length) process.exitCode = 1;
