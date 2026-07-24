#!/usr/bin/env node
/**
 * talkAdmin=1 の運営用 TALK — Builder アイコン遷移先検証
 *
 *   node scripts/verify-talk-admin-builder-nav.mjs
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl, buildLocalPageUrl } from "./lib/dev-server-url.mjs";

const base = await findDevServerBaseUrl({ probePath: "talk-home.html" });
const ADMIN_PATH =
  "?audience=admin_ops&tab=chat&filter=ops_watch&talkAdmin=1";
const USER_PATH = "?tab=chat&talkDev=1";
const ADMIN_BUILDER_HREF = "builder-admin/admin-index.html";
const USER_BUILDER_HREF = "builder/index.html";

function adminUrl() {
  return buildLocalPageUrl(base, "talk-home", ADMIN_PATH);
}

function userUrl() {
  return buildLocalPageUrl(base, "talk-home.html", USER_PATH);
}

const errors = [];
const pass = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => {
  errors.push(m);
  console.log(`  ✗ ${m}`);
};

await withPlaywrightBrowser(async (browser) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  console.log("Admin URL:", adminUrl());
  await page.goto(adminUrl(), { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForSelector('[data-talk-line-nav="builder"]', { timeout: 15000 });

  const adminHref = await page.locator('[data-talk-line-nav="builder"]').getAttribute("href");
  if (adminHref === ADMIN_BUILDER_HREF) {
    pass(`talkAdmin=1 Builder href = ${ADMIN_BUILDER_HREF}`);
  } else {
    fail(`talkAdmin=1 Builder href expected ${ADMIN_BUILDER_HREF}, got ${adminHref}`);
  }

  await Promise.all([
    page.waitForURL(/builder-admin\/admin-index/, { timeout: 15000 }),
    page.locator('[data-talk-line-nav="builder"]').click(),
  ]);
  if (/builder-admin\/admin-index/.test(page.url())) {
    pass(`talkAdmin=1 click navigates to admin Builder (${page.url()})`);
  } else {
    fail(`talkAdmin=1 click landed on ${page.url()}`);
  }

  const userPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  console.log("User URL:", userUrl());
  await userPage.goto(userUrl(), { waitUntil: "domcontentloaded", timeout: 20000 });
  await userPage.waitForSelector('[data-talk-line-nav="builder"]', { timeout: 15000 });

  const userHref = await userPage.locator('[data-talk-line-nav="builder"]').getAttribute("href");
  if (userHref === USER_BUILDER_HREF) {
    pass(`talkDev=1 Builder href = ${USER_BUILDER_HREF}`);
  } else {
    fail(`talkDev=1 Builder href expected ${USER_BUILDER_HREF}, got ${userHref}`);
  }

  await Promise.all([
    userPage.waitForURL(/\/builder(\/index\.html)?\/?$/, { timeout: 15000 }),
    userPage.locator('[data-talk-line-nav="builder"]').click(),
  ]);
  if (/\/builder(\/index\.html)?\/?$/.test(userPage.url())) {
    pass(`talkDev=1 click navigates to user Builder (${userPage.url()})`);
  } else {
    fail(`talkDev=1 click landed on ${userPage.url()}`);
  }

  if (consoleErrors.length) {
    fail(`console errors on admin page: ${consoleErrors.join(" | ")}`);
  } else {
    pass("no console errors on admin page");
  }

  for (const width of [768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(adminUrl(), { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForSelector('[data-talk-line-nav="builder"]', {
      timeout: 15000,
      state: "attached",
    });
    const href = await page.locator('[data-talk-line-nav="builder"]').getAttribute("href");
    if (href === ADMIN_BUILDER_HREF) {
      pass(`viewport ${width}px: talkAdmin=1 Builder href OK`);
    } else {
      fail(`viewport ${width}px: expected ${ADMIN_BUILDER_HREF}, got ${href}`);
    }
  }
});

await closeAllBrowsers();

if (errors.length) {
  console.error("\nFAIL:", errors.length);
  process.exit(1);
}
console.log("\nPASS: talk admin Builder nav");
