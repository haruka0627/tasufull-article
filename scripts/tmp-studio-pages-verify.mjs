#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { withPlaywrightSession } from "./lib/playwright-browser.mjs";

const BASE = "http://127.0.0.1:8788/live";
const OUT_DIR = path.resolve("scripts/tmp-studio-verify");
const errors = [];

const PAGES = [
  { url: "studio-dashboard.html", navId: "dashboard", label: "ダッシュボード" },
  { url: "studio-analytics.html", navId: "analytics", label: "アナリティクス" },
  { url: "studio-community.html", navId: "community", label: "コミュニティ" },
  { url: "studio-subtitles.html", navId: "subtitles", label: "字幕" },
  { url: "studio-copyright.html", navId: "content-id", label: "コンテンツ検出" },
  { url: "studio-monetization.html", navId: "monetization", label: "収益化" },
  { url: "studio-customization.html", navId: "customization", label: "カスタマイズ" },
  { url: "studio-audio-library.html", navId: "audio", label: "オーディオライブラリ" },
];

await withPlaywrightSession(
  async ({ browser }) => {
    fs.mkdirSync(OUT_DIR, { recursive: true });

    for (const vp of [
      { w: 1280, h: 900, tag: "1280" },
      { w: 390, h: 844, tag: "390" },
    ]) {
      const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(`[${vp.w}] ${m.text()}`);
      });
      page.on("pageerror", (e) => errors.push(`[${vp.w}] ${String(e)}`));

      const results = [];

      for (const item of PAGES) {
        const res = await page.goto(`${BASE}/${item.url}`, {
          waitUntil: "networkidle",
          timeout: 120000,
        });
        await page.waitForTimeout(1200);

        const state = await page.evaluate((navId) => {
          const isMobile = window.matchMedia("(max-width: 1023px)").matches;
          const active = document.querySelector(".tlv-studio-sidebar__link.is-active");
          const placeholder = document.querySelector("[data-tlv-studio-placeholder-page]");
          const dashboard = document.querySelector("[data-tlv-studio-dashboard-page]");
          const content = document.querySelector("[data-tlv-studio-content-page]");
          const title = document.querySelector(
            isMobile
              ? ".tlv-studio-mobile-header__title"
              : ".tlv-studio-placeholder__title, .tlv-studio-dashboard__welcome, .tlv-studio-page__title",
          );
          return {
            status: document.readyState,
            httpOk: true,
            activeId: active?.querySelector(".tlv-studio-sidebar__link-label")?.textContent?.trim() || null,
            activeHref: active?.getAttribute("href") || null,
            expectedNav: navId,
            hasPlaceholder: !!placeholder,
            hasDashboard: !!dashboard,
            hasContent: !!content,
            pageTitle: title?.textContent?.trim() || null,
            mobileShell: getComputedStyle(document.querySelector(".tlv-studio-mobile-shell")).display !== "none",
            desktopShell: getComputedStyle(document.querySelector(".tlv-studio-shell")).display !== "none",
          };
        }, item.navId);

        results.push({
          page: item.url,
          httpStatus: res?.status?.(),
          ...state,
          activeOk:
            item.navId === "dashboard"
              ? state.activeId === "ダッシュボード"
              : item.navId === "content-id"
                ? state.activeId === "コンテンツ検出"
                : state.activeId === item.label,
        });
      }

      const shot = path.join(OUT_DIR, `studio-nav-${vp.tag}.png`);
      await page.goto(`${BASE}/studio-community.html`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1000);
      await page.screenshot({ path: shot, fullPage: false });

      console.log(JSON.stringify({ viewport: vp.w, results, screenshot: shot }, null, 2));
      await page.close();
    }
  },
  { viewport: { width: 1280, height: 900 } },
);

console.log("\nconsoleErrors:", errors.length ? errors : "0");
