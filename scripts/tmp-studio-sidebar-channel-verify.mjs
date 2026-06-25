#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { withPlaywrightSession } from "./lib/playwright-browser.mjs";

const OUT = path.resolve("scripts/tmp-studio-verify");
const errors = [];
fs.mkdirSync(OUT, { recursive: true });

const pages = [
  "studio-dashboard.html",
  "studio-analytics.html",
  "studio-community.html",
  "studio-subtitles.html",
  "studio-monetization.html",
  "studio-customization.html",
  "studio-audio-library.html",
];

const viewports = [
  { w: 1280, tag: "1280" },
  { w: 390, tag: "390" },
];

await withPlaywrightSession(async ({ browser }) => {
  for (const vp of viewports) {
    for (const pageName of pages) {
      const page = await browser.newPage({ viewport: { width: vp.w, height: 900 } });
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(`[${vp.w}/${pageName}] ${m.text()}`);
      });
      await page.goto(`http://127.0.0.1:8788/live/${pageName}`, {
        waitUntil: "networkidle",
        timeout: 120000,
      });
      await page.waitForTimeout(1200);

      const m = await page.evaluate(() => {
        const channel = document.querySelector(".tlv-studio-sidebar__channel");
        return {
          hasChannel: !!channel,
          channelMeta: document.querySelectorAll(".tlv-studio-sidebar__channel-meta").length,
          channelLabel: document.querySelector(".tlv-studio-sidebar__channel-label")?.textContent?.trim() || null,
          channelName: document.querySelector(".tlv-studio-sidebar__channel-name")?.textContent?.trim() || null,
          avatarSize: (() => {
            const el = document.querySelector(".tlv-studio-sidebar__channel-avatar");
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return { w: Math.round(r.width), h: Math.round(r.height) };
          })(),
          channelFlexDir: channel ? getComputedStyle(channel).flexDirection : null,
          horizontalScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        };
      });

      const shot =
        pageName === "studio-dashboard.html"
          ? path.join(OUT, `studio-sidebar-channel-${vp.tag}.png`)
          : null;
      if (shot) await page.screenshot({ path: shot, fullPage: false });

      console.log(
        JSON.stringify({ viewport: vp.w, page: pageName, ...m, screenshot: shot }, null, 2),
      );
      await page.close();
    }
  }
});

console.log("\nconsoleErrors:", errors.length ? errors : "0");
