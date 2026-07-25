#!/usr/bin/env node
/**
 * TLV view/studio account menu verify (localhost :8788)
 * Usage: node scripts/verify-tlv-view-account-menu.mjs
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const PAGES = ["videos.html", "watch-video.html", "shorts.html", "channel-content.html"];
const WIDTHS = [390, 768, 1280];
const OUT_DIR = path.resolve("scripts/tmp-view-acct-menu-verify");
fs.mkdirSync(OUT_DIR, { recursive: true });

const REQUIRED_VIEW = ["マイページ", "チャンネル", "TLV Studio", "動画を管理", "収益・分析"];
const REQUIRED_GUEST = ["ログイン", "アカウント作成"];

async function mockAuth(page) {
  await page.evaluate(() => {
    window.TasuAuthCurrentUser = window.TasuAuthCurrentUser || {};
    window.TasuAuthCurrentUser.getCurrentUser = () => ({
      authenticated: true,
      talkUserId: "u_me",
      displayName: "テストユーザー",
    });
  });
}

async function openAccountMenu(page, width, isStudio) {
  const selector = isStudio
    ? width >= 1024
      ? "[data-tlv-studio-acct-toggle]"
      : ".tlv-studio-mobile-header [data-tlv-studio-acct-toggle]"
    : width >= 1024
      ? ".tlv-videos-topbar__end [data-tlv-view-acct-toggle]"
      : ".tlv-mobile-videos-toprow__actions [data-tlv-view-acct-toggle]";
  if (isStudio) {
    await page.waitForSelector("[data-tlv-studio-acct-menu]", { timeout: 12000 }).catch(() => {});
  }
  const toggle = page.locator(selector).first();
  await toggle.waitFor({ state: "visible", timeout: 12000 });
  await toggle.click();
  await page.waitForTimeout(400);
}

async function verifyPage(browser, pageName, width, consoleErrors) {
  const page = await browser.newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(`[${pageName}@${width}] ${msg.text()}`);
  });
  await page.setViewportSize({ width, height: 900 });
  const url = `http://127.0.0.1:8788/live/${pageName}?talkDev=1&userId=u_me`;
  await page.goto(url, { waitUntil: "networkidle" });
  await mockAuth(page);

  const isStudio = pageName === "channel-content.html";
  const menuType = isStudio ? "studio" : "view";

  if (menuType === "view") {
    await openAccountMenu(page, width, false);
    const labels = await page.evaluate(() =>
      [
        ...document.querySelectorAll(
          ".tlv-view-acct__row-label, .tlv-view-acct__guest-text, .tlv-view-acct__guest-actions a",
        ),
      ].map((el) => el.textContent.trim()),
    );
    const hrefs = await page.evaluate(() =>
      [...document.querySelectorAll(".tlv-view-acct__row[href]")].map((el) => ({
        label: el.querySelector(".tlv-view-acct__row-label")?.textContent?.trim(),
        href: el.getAttribute("href"),
      })),
    );
    const overflow = await page.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth,
      vw: window.innerWidth,
      panelOverflow: (() => {
        const panel = document.querySelector(".tlv-view-acct__panel:not([hidden])");
        if (!panel) return null;
        const r = panel.getBoundingClientRect();
        return r.right > window.innerWidth || r.left < 0;
      })(),
    }));
    const missing = REQUIRED_VIEW.filter((t) => !labels.some((l) => l.includes(t)));
    const shot = path.join(OUT_DIR, `view-${pageName.replace(".html", "")}-${width}.png`);
    await page.screenshot({ path: shot, fullPage: false });
    await page.close();
    return {
      page: pageName,
      width,
      menuType,
      labels,
      hrefs,
      hasRequired: missing.length === 0,
      missing,
      overflow,
      screenshot: shot,
    };
  }

  await openAccountMenu(page, width, true);
  const labels = await page.evaluate(() =>
    [
      ...document.querySelectorAll(
        ".tlv-studio-acct__row-label, .tlv-studio-acct__guest-text, .tlv-studio-acct__guest-actions a",
      ),
    ].map((el) => el.textContent.trim()),
  );
  const overflow = await page.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    vw: window.innerWidth,
  }));
  const shot = path.join(OUT_DIR, `studio-${pageName.replace(".html", "")}-${width}.png`);
  await page.screenshot({ path: shot, fullPage: false });
  await page.close();
  return {
    page: pageName,
    width,
    menuType,
    labels,
    overflow,
    screenshot: shot,
    hasMenuItems: labels.length > 0,
  };
}

async function verifyGuest(browser, consoleErrors) {
  const page = await browser.newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(`[guest@1280] ${msg.text()}`);
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("http://127.0.0.1:8788/live/videos.html?talkDev=1", { waitUntil: "networkidle" });
  await page.evaluate(() => {
    window.TasuAuthCurrentUser = window.TasuAuthCurrentUser || {};
    window.TasuAuthCurrentUser.getCurrentUser = () => ({ authenticated: false });
  });
  await openAccountMenu(page, 1280, false);
  const labels = await page.evaluate(() =>
    [...document.querySelectorAll(".tlv-view-acct__guest-actions a")].map((el) =>
      el.textContent.trim(),
    ),
  );
  const missing = REQUIRED_GUEST.filter((t) => !labels.includes(t));
  await page.close();
  return { guest: true, labels, hasGuest: missing.length === 0, missing };
}

const consoleErrors = [];
const results = [];
const failures = [];
let browser;

try {
  browser = await chromium.launch();
  for (const pageName of PAGES) {
    for (const width of WIDTHS) {
      results.push(await verifyPage(browser, pageName, width, consoleErrors));
    }
  }
  results.push(await verifyGuest(browser, consoleErrors));
  await browser.close();
  browser = null;

  for (const r of results) console.log(JSON.stringify(r, null, 2));
  console.log(`\nconsoleErrors: ${consoleErrors.length}`);
  if (consoleErrors.length) consoleErrors.forEach((e) => console.log(e));

  for (const r of results) {
    if (r.guest) {
      if (!r.hasGuest) {
        failures.push(
          `guest@1280: missing guest actions ${JSON.stringify(r.missing || [])} (got ${JSON.stringify(r.labels)})`,
        );
      }
      continue;
    }
    if (r.menuType === "view") {
      if (!r.hasRequired) {
        failures.push(
          `${r.page}@${r.width}: missing required labels ${JSON.stringify(r.missing || [])}`,
        );
      }
    } else if (r.menuType === "studio") {
      if (!r.hasMenuItems) {
        failures.push(`${r.page}@${r.width}: studio account menu empty`);
      }
    }
  }
} catch (err) {
  console.error(err);
  process.exitCode = 1;
} finally {
  if (browser) {
    try {
      await browser.close();
    } catch {
      /* ignore */
    }
  }
}

if (failures.length) {
  console.error("verification failed:");
  for (const f of failures) console.error(` - ${f}`);
  process.exitCode = 1;
} else if (!process.exitCode) {
  console.log("verification passed");
}
