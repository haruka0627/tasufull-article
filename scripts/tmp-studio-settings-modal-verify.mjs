#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { withPlaywrightSession } from "./lib/playwright-browser.mjs";

const OUT = path.resolve("scripts/tmp-studio-verify");
const errors = [];
fs.mkdirSync(OUT, { recursive: true });

const pages = [
  "studio-analytics.html",
  "studio-community.html",
  "studio-subtitles.html",
  "studio-monetization.html",
  "studio-customization.html",
  "studio-audio-library.html",
];

await withPlaywrightSession(async ({ browser }) => {
  async function openMobileSidebar(page) {
    const isMobile = await page.evaluate(() => window.innerWidth < 1024);
    if (!isMobile) return;
    await page.click(".tlv-studio-mobile-header__menu");
    await page.waitForTimeout(400);
  }

  for (const vp of [{ w: 1280, tag: "1280" }, { w: 390, tag: "390" }]) {
    const page = await browser.newPage({ viewport: { width: vp.w, height: 900 } });
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(`[${vp.w}] ${m.text()}`);
    });
    await page.goto("http://127.0.0.1:8788/live/studio-analytics.html", {
      waitUntil: "networkidle",
      timeout: 120000,
    });
    await page.waitForTimeout(1200);

    if (vp.w < 1024) {
      await openMobileSidebar(page);
    }

    await page.click("[data-tlv-studio-settings-open]");
    await page.waitForTimeout(400);
    const openShot = path.join(OUT, `studio-settings-open-${vp.tag}.png`);
    await page.screenshot({ path: openShot, fullPage: false });

    await page.click('[data-tlv-studio-settings-section="channel"]');
    await page.waitForTimeout(300);
    const channelShot = path.join(OUT, `studio-settings-channel-${vp.tag}.png`);
    await page.screenshot({ path: channelShot, fullPage: false });

    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);

    if (vp.w < 1024) {
      await openMobileSidebar(page);
    }
    await page.click("[data-tlv-studio-settings-open]");
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      document.querySelector("[data-tlv-studio-settings-overlay]")?.click();
    });
    await page.waitForTimeout(300);

    const m = await page.evaluate(() => ({
      settingsLinkHref: document.querySelector("[data-tlv-studio-settings-open]")?.getAttribute("href") ?? null,
      modalExists: !!document.querySelector("[data-tlv-studio-settings]"),
      modalHidden: document.querySelector("[data-tlv-studio-settings]")?.hidden ?? null,
      navItems: document.querySelectorAll("[data-tlv-studio-settings-section]").length,
      activePanel: document.querySelector(".tlv-studio-settings__panel.is-active")?.getAttribute("data-tlv-studio-settings-panel") || null,
      horizontalScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }));

    console.log(JSON.stringify({ viewport: vp.w, ...m, screenshots: [openShot, channelShot] }, null, 2));
    await page.close();
  }

  for (const pageName of pages) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(`[1280/${pageName}] ${m.text()}`);
    });
    await page.goto(`http://127.0.0.1:8788/live/${pageName}`, {
      waitUntil: "networkidle",
      timeout: 120000,
    });
    await page.waitForTimeout(1000);
    if (pageName !== "studio-analytics.html") {
      // already tested analytics above
    }
    const menuNeeded = await page.evaluate(() => window.innerWidth < 1024);
    if (menuNeeded) await openMobileSidebar(page);
    await page.click("[data-tlv-studio-settings-open]");
    await page.waitForTimeout(400);
    const ok = await page.evaluate(() => ({
      page: document.body.getAttribute("data-page"),
      modalOpen: !document.querySelector("[data-tlv-studio-settings]")?.hidden,
      mainTitle: document.querySelector(".tlv-studio-placeholder__title")?.textContent?.trim() || null,
    }));
    console.log(JSON.stringify({ check: pageName, ...ok }, null, 2));
    await page.close();
  }
});

console.log("\nconsoleErrors:", errors.length ? errors : "0");
