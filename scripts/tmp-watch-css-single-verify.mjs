#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightSession } from "./lib/playwright-browser.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "scripts", "tmp-watch-ratio-shots");
const URL =
  "http://127.0.0.1:8788/live/watch-video?id=4d7e3650-b441-4598-9723-475a956cf68a";
const VIEWPORTS = [1280, 1440, 1920];

fs.mkdirSync(OUT, { recursive: true });

const report = [];

for (const w of VIEWPORTS) {
  await withPlaywrightSession(
    async ({ page }) => {
      await page.goto(URL, { waitUntil: "networkidle", timeout: 120000 });
      await page.waitForSelector(".tlv-watch-layout", { timeout: 60000 });
      await page.waitForTimeout(2000);
      const shot = path.join(OUT, `css-single-source-${w}.png`);
      await page.screenshot({ path: shot, fullPage: false });
      const data = await page.evaluate(() => {
        const layout = document.querySelector(".tlv-watch-layout");
        const sidebar = document.querySelector(".tlv-watch-sidebar");
        const player = document.querySelector(".live-watch__player-wrap");
        const thumb = document.querySelector(".tlv-related-list--yt .tlv-related-list__thumb");
        const thumbImg = document.querySelector(".tlv-related-list--yt .tlv-related-list__thumb img");

        const ruleSource = (el, prop) => {
          if (!el) return null;
          for (const sheet of document.styleSheets) {
            let rules;
            try {
              rules = sheet.cssRules;
            } catch {
              continue;
            }
            for (const rule of rules) {
              if (!rule.selectorText || !rule.style) continue;
              try {
                if (el.matches(rule.selectorText) && rule.style.getPropertyValue(prop)) {
                  return sheet.href || "inline";
                }
              } catch {
                /* skip */
              }
            }
          }
          return null;
        };

        return {
          styleInjected: !!document.getElementById("tlv-watch-youtube-layout-styles"),
          cssHref: [...document.querySelectorAll('link[rel="stylesheet"]')]
            .map((l) => l.href)
            .find((h) => h.includes("live.css")),
          gridCols: layout ? getComputedStyle(layout).gridTemplateColumns : null,
          gap: layout ? getComputedStyle(layout).gap : null,
          mainMaxW: getComputedStyle(document.querySelector(".tlv-desktop-main--watch")).maxWidth,
          sidebarW: sidebar ? Math.round(sidebar.getBoundingClientRect().width) : null,
          playerW: player ? Math.round(player.getBoundingClientRect().width) : null,
          thumbW: thumb ? Math.round(thumb.getBoundingClientRect().width) : null,
          thumbH: thumb ? Math.round(thumb.getBoundingClientRect().height) : null,
          gridFromLiveCss: ruleSource(layout, "grid-template-columns")?.includes("live.css") ?? false,
          hasVideo: !!document.querySelector("video"),
          hasLike: !!document.querySelector("[data-live-video-like]"),
        };
      });
      report.push({ viewport: w, screenshot: shot, ...data });
    },
    { viewport: { width: w, height: 900 } }
  );
}

const out = path.join(OUT, "report-css-single-source.json");
fs.writeFileSync(out, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
