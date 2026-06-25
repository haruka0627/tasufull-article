#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { withPlaywrightSession } from "./lib/playwright-browser.mjs";

const OUT = path.resolve("scripts/tmp-studio-verify");
const errors = [];
fs.mkdirSync(OUT, { recursive: true });

const pages = [
  "studio-dashboard.html",
  "channel-content.html",
  "studio-analytics.html",
  "studio-community.html",
  "studio-subtitles.html",
  "studio-copyright.html",
  "studio-monetization.html",
  "studio-customization.html",
  "studio-audio-library.html",
];

async function openSettings(page) {
  const isMobile = await page.evaluate(() => window.innerWidth < 1024);
  if (isMobile) {
    await page.click(".tlv-studio-mobile-header__menu");
    await page.waitForTimeout(400);
  }
  return page.evaluate(() => {
    const btn = document.querySelector("[data-tlv-studio-settings-open]");
    if (btn) {
      btn.click();
      return "button";
    }
    const links = [...document.querySelectorAll(".tlv-studio-sidebar a.tlv-studio-sidebar__link")];
    const legacy = links.find((a) => a.querySelector(".tlv-studio-sidebar__link-label")?.textContent?.trim() === "設定");
    if (legacy) {
      legacy.click();
      return "legacy-anchor";
    }
    return null;
  });
}

await withPlaywrightSession(async ({ browser }) => {
  for (const vp of [{ w: 1280, tag: "1280" }, { w: 390, tag: "390" }]) {
    const page = await browser.newPage({ viewport: { width: vp.w, height: 900 } });
    page.on("console", (m) => {
      if (m.type() === "error" && !m.text().includes("401")) errors.push(`[${vp.w}] ${m.text()}`);
    });
    await page.goto("http://127.0.0.1:8788/live/studio-analytics.html", {
      waitUntil: "networkidle",
      timeout: 120000,
    });
    await page.waitForTimeout(1200);
    const urlBefore = page.url();
    await openSettings(page);
    await page.waitForTimeout(500);
    const openState = await page.evaluate(() => ({
      url: location.href,
      modalOpen: !document.querySelector("[data-tlv-studio-settings]")?.hidden,
      studioSidebar: !!document.querySelector(".tlv-studio-sidebar"),
      tlvVideosSidebar: !!document.querySelector(".tlv-videos-sidebar"),
      activeNav: document.querySelector(".tlv-studio-sidebar__link.is-active")?.textContent?.trim() || null,
    }));
    await page.evaluate(() => {
      document.querySelector('[data-tlv-studio-settings-section="permissions"]')?.click();
    });
    await page.waitForTimeout(200);
    const permPanel = await page.evaluate(
      () => document.querySelector('[data-tlv-studio-settings-panel="permissions"]')?.hidden === false,
    );
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    const closed = await page.evaluate(() => document.querySelector("[data-tlv-studio-settings]")?.hidden);
    const shot = path.join(OUT, `studio-settings-nav-${vp.tag}.png`);
    await page.screenshot({ path: shot, fullPage: false });
    console.log(
      JSON.stringify(
        {
          viewport: vp.w,
          urlBefore,
          urlAfterOpen: openState.url,
          urlUnchanged: urlBefore === openState.url,
          modalOpen: openState.modalOpen,
          studioSidebarKept: openState.studioSidebar && !openState.tlvVideosSidebar,
          activeNav: openState.activeNav,
          permPanel,
          modalClosed: closed,
          screenshot: shot,
        },
        null,
        2,
      ),
    );
    await page.close();
  }

  for (const pageName of pages) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.on("console", (m) => {
      if (m.type() === "error" && !m.text().includes("401")) errors.push(`[${pageName}] ${m.text()}`);
    });
    await page.goto(`http://127.0.0.1:8788/live/${pageName}`, {
      waitUntil: "networkidle",
      timeout: 120000,
    });
    await page.waitForTimeout(1000);
    const before = page.url();
    const trigger = await page.evaluate(() => {
      const btn = document.querySelector("[data-tlv-studio-settings-open]");
      return btn
        ? { type: "button", href: btn.getAttribute("href") }
        : { type: "missing", href: null };
    });
    await openSettings(page);
    await page.waitForTimeout(400);
    const after = await page.evaluate(() => ({
      url: location.href,
      modalOpen: !document.querySelector("[data-tlv-studio-settings]")?.hidden,
      dataPage: document.body.getAttribute("data-page"),
    }));
    console.log(
      JSON.stringify(
        {
          page: pageName,
          trigger,
          urlUnchanged: before === after.url,
          modalOpen: after.modalOpen,
          dataPage: after.dataPage,
        },
        null,
        2,
      ),
    );
    await page.close();
  }
});

console.log("\nconsoleErrors:", errors.length ? errors : "0");
