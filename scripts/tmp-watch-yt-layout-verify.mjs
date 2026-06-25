#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { withPlaywrightSession } from "./lib/playwright-browser.mjs";

const VIDEO_ID = "4d7e3650-b441-4598-9723-475a956cf68a";
const BASE = `http://127.0.0.1:8788/live/watch-video?id=${VIDEO_ID}`;
const OUT_DIR = path.resolve("scripts/tmp-watch-ratio-shots");

const errors = [];

await withPlaywrightSession(
  async ({ browser }) => {
    for (const vp of [
      { w: 1280, h: 900, name: "yt-layout-1280" },
      { w: 768, h: 1024, name: "yt-layout-768" },
      { w: 390, h: 844, name: "yt-layout-390" },
    ]) {
      const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(`[${vp.w}] ${m.text()}`);
      });
      page.on("pageerror", (e) => errors.push(`[${vp.w}] ${String(e)}`));

      const isMobile = vp.w < 1024;
      const layoutSel = isMobile
        ? ".tlv-mobile-shell .tlv-watch-layout"
        : ".tlv-desktop-shell .tlv-watch-layout";

      await page.goto(BASE, { waitUntil: "networkidle", timeout: 120000 });
      await page.waitForSelector(layoutSel, { state: "visible", timeout: 60000 });
      await page.waitForTimeout(2000);

      const m = await page.evaluate((sel) => {
        const layout = document.querySelector(sel);
        const cs = layout ? getComputedStyle(layout) : null;
        const root = layout?.closest(".tlv-desktop-shell, .tlv-mobile-shell");
        const r = (s, scope) => {
          const el = (scope || document).querySelector(s);
          const b = el?.getBoundingClientRect();
          return b ? { w: Math.round(b.width), h: Math.round(b.height) } : null;
        };
        return {
          gridTemplateColumns: cs?.gridTemplateColumns,
          gap: cs?.gap,
          layoutW: layout ? Math.round(layout.getBoundingClientRect().width) : null,
          player: r(".live-watch__player-wrap", root),
          sidebar: r(".tlv-watch-sidebar", root),
          thumb: r(".tlv-related-list--yt .tlv-related-list__thumb", root),
          mobileShellVisible: getComputedStyle(document.querySelector(".tlv-mobile-shell")).display !== "none",
          desktopShellVisible: getComputedStyle(document.querySelector(".tlv-desktop-shell")).display !== "none",
        };
      }, layoutSel);

      const shot = path.join(OUT_DIR, `watch-${vp.name}.png`);
      fs.mkdirSync(OUT_DIR, { recursive: true });
      await page.screenshot({ path: shot, fullPage: false });
      console.log(JSON.stringify({ viewport: vp.w, ...m, screenshot: shot }, null, 2));
      await page.close();
    }
  },
  { viewport: { width: 1280, height: 900 } }
);

console.log("\nconsoleErrors:", errors.length ? errors : "0");
