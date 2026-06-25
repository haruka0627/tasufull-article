#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { withPlaywrightSession } from "./lib/playwright-browser.mjs";

const VIDEO_ID = "4d7e3650-b441-4598-9723-475a956cf68a";
const BASE = `http://127.0.0.1:8788/live/watch-video?id=${VIDEO_ID}`;
const OUT_DIR = path.resolve("scripts/tmp-watch-ratio-shots");

const errors = [];

function layoutMetrics(page, isMobile) {
  const layoutSel = isMobile
    ? ".tlv-mobile-shell .tlv-watch-layout"
    : ".tlv-desktop-shell .tlv-watch-layout";
  return page.evaluate((sel) => {
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
      layoutW: layout ? Math.round(layout.getBoundingClientRect().width) : null,
      player: r(".live-watch__player-wrap", root),
      sidebar: r(".tlv-watch-sidebar", root),
      thumb: r(".tlv-related-list--yt .tlv-related-list__thumb", root),
    };
  }, layoutSel);
}

await withPlaywrightSession(
  async ({ browser }) => {
    for (const vp of [
      { w: 1280, h: 900, name: "drawer-1280" },
      { w: 390, h: 844, name: "drawer-390" },
    ]) {
      const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(`[${vp.w}] ${m.text()}`);
      });
      page.on("pageerror", (e) => errors.push(`[${vp.w}] ${String(e)}`));

      const isMobile = vp.w < 1024;
      const menuSel = isMobile
        ? ".tlv-mobile-shell .tlv-videos-mobile-menu"
        : ".tlv-videos-topbar__menu";

      await page.goto(BASE, { waitUntil: "networkidle", timeout: 120000 });
      await page.waitForSelector(menuSel, { state: "visible", timeout: 60000 });
      await page.waitForTimeout(2000);

      const before = await layoutMetrics(page, isMobile);

      await page.click(menuSel);
      await page.waitForTimeout(400);

      const openState = await page.evaluate(() => {
        const drawer = document.querySelector("[data-tlv-watch-drawer]");
        const backdrop = document.querySelector("[data-tlv-watch-drawer-backdrop]");
        const dcs = drawer ? getComputedStyle(drawer) : null;
        const bcs = backdrop ? getComputedStyle(backdrop) : null;
        const db = drawer?.getBoundingClientRect();
        return {
          bodyOpen: document.body.classList.contains("tlv-drawer-open"),
          drawerVisible: drawer ? dcs.display !== "none" && dcs.transform === "none" || drawer.classList.contains("is-open") : false,
          drawerW: db ? Math.round(db.width) : null,
          drawerTransform: dcs?.transform,
          backdropOpacity: bcs?.opacity,
          backdropPointerEvents: bcs?.pointerEvents,
          ariaHidden: drawer?.getAttribute("aria-hidden"),
        };
      });

      const shotOpen = path.join(OUT_DIR, `watch-${vp.name}-open.png`);
      fs.mkdirSync(OUT_DIR, { recursive: true });
      await page.screenshot({ path: shotOpen, fullPage: false });

      await page.click("[data-tlv-watch-drawer-backdrop]");
      await page.waitForTimeout(300);
      const afterBackdrop = await page.evaluate(() => document.body.classList.contains("tlv-drawer-open"));

      await page.click(menuSel);
      await page.waitForTimeout(300);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
      const afterEsc = await page.evaluate(() => document.body.classList.contains("tlv-drawer-open"));

      const after = await layoutMetrics(page, isMobile);

      const shotClosed = path.join(OUT_DIR, `watch-${vp.name}-closed.png`);
      await page.screenshot({ path: shotClosed, fullPage: false });

      console.log(
        JSON.stringify(
          {
            viewport: vp.w,
            layoutBefore: before,
            layoutAfter: after,
            drawerOpen: openState,
            closedByBackdrop: !afterBackdrop,
            closedByEsc: !afterEsc,
            screenshots: { open: shotOpen, closed: shotClosed },
          },
          null,
          2,
        ),
      );
      await page.close();
    }
  },
  { viewport: { width: 1280, height: 900 } },
);

console.log("\nconsoleErrors:", errors.length ? errors : "0");
