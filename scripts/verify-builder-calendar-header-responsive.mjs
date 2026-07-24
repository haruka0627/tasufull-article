#!/usr/bin/env node
/**
 * project-calendar / admin-calendar — ヘッダー折り返し・余白（390/768/1280）
 *
 *   node scripts/verify-builder-calendar-header-responsive.mjs
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import {
  BUILDER_QA_VIEWPORTS,
  assertBrowserLikeEnv,
  capturePageViewportScreenshot,
  createBrowserLikePage,
} from "./lib/playwright-viewport.mjs";
import { findDevServerBaseUrl, buildLocalPageUrl } from "./lib/dev-server-url.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "screenshots", "builder-calendar-header-fix");

const projectCalUrl = buildLocalPageUrl(
  await findDevServerBaseUrl({ probePath: "builder/project-calendar.html" }),
  "builder/project-calendar.html?role=partner",
);
const adminCalUrl = buildLocalPageUrl(
  await findDevServerBaseUrl({ probePath: "builder/admin-calendar.html" }),
  "builder/admin-calendar.html",
);

const errors = [];
const pass = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => {
  errors.push(m);
  console.log(`  ✗ ${m}`);
};

fs.mkdirSync(OUT_DIR, { recursive: true });

/** @param {import('playwright').Page} page */
async function readTopbarTextLayout(page) {
  return page.evaluate(() => {
    const heading = document.querySelector(".builder-cal-topbar__heading");
    const sub = document.querySelector("[data-builder-cal-header-sub]");
    const measureLines = (el) => {
      if (!el) return { lines: 0, width: 0, wordBreak: "", overflowWrap: "" };
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      const lh = parseFloat(s.lineHeight) || 20;
      return {
        lines: Math.max(1, Math.round(r.height / lh)),
        width: Math.round(r.width),
        wordBreak: s.wordBreak,
        overflowWrap: s.overflowWrap,
      };
    };
    return {
      heading: measureLines(heading),
      sub: measureLines(sub),
      headingText: heading?.textContent?.trim() || "",
      subText: sub?.textContent?.trim() || "",
    };
  });
}

/** @param {import('playwright').Page} page */
async function readAdminHeaderSpacing(page) {
  return page.evaluate(() => {
    const inner = document.querySelector(".builder-header__inner");
    const sub = document.querySelector(".builder-header__sub");
    const innerStyle = inner ? getComputedStyle(inner) : null;
    const subStyle = sub ? getComputedStyle(sub) : null;
    return {
      paddingTop: innerStyle ? parseFloat(innerStyle.paddingTop) : 0,
      paddingBottom: innerStyle ? parseFloat(innerStyle.paddingBottom) : 0,
      subMarginTop: subStyle ? parseFloat(subStyle.marginTop) : 0,
    };
  });
}

console.log("Project calendar:", projectCalUrl);
console.log("Admin calendar:", adminCalUrl);

await withPlaywrightBrowser(
  async (browser) => {
    for (const vp of BUILDER_QA_VIEWPORTS) {
      console.log(`\n[project-calendar ${vp.label}]`);
      const { context, page } = await createBrowserLikePage(browser, vp);
      const consoleErrors = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });

      try {
        await page.goto(projectCalUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
        await assertBrowserLikeEnv(page, vp);

        // 通常カレンダー
        let layout = await readTopbarTextLayout(page);
        if (vp.id === "390") {
          if (layout.heading.lines <= 2) pass(`heading ≤2 lines (${layout.heading.lines})`);
          else fail(`heading ${layout.heading.lines} lines (char-per-line?)`);
          if (layout.heading.width >= 72) pass(`heading width ${layout.heading.width}px`);
          else fail(`heading too narrow ${layout.heading.width}px`);
          if (layout.heading.wordBreak !== "break-all" && layout.heading.overflowWrap !== "anywhere") {
            pass("heading no extreme word-break");
          } else fail(`heading word-break: ${layout.heading.wordBreak} / ${layout.heading.overflowWrap}`);
          if (layout.sub.lines <= 3) pass(`sub ≤3 lines (${layout.sub.lines})`);
          else fail(`sub ${layout.sub.lines} lines`);
        } else {
          if (layout.heading.lines <= 2) pass(`heading lines ${layout.heading.lines}`);
          else fail(`heading ${layout.heading.lines} lines at ${vp.label}`);
        }

        await capturePageViewportScreenshot(
          page,
          path.join(OUT_DIR, `project-standard-header-${vp.id}.png`),
        );

        // パートナー案件タブ
        await page.locator('[data-builder-pc-source="partner"]').click();
        await page.waitForTimeout(250);
        layout = await readTopbarTextLayout(page);
        if (layout.subText.includes("届いた案件")) pass("partner sub title shown");
        else fail(`partner sub unexpected: ${layout.subText}`);

        if (vp.id === "390") {
          if (layout.heading.lines <= 2) pass(`partner tab heading ≤2 lines`);
          else fail(`partner tab heading ${layout.heading.lines} lines`);
          if (layout.sub.lines <= 3) pass(`partner sub ≤3 lines (${layout.sub.lines})`);
          else fail(`partner sub ${layout.sub.lines} lines`);
        }

        await capturePageViewportScreenshot(
          page,
          path.join(OUT_DIR, `project-partner-header-${vp.id}.png`),
        );

        if (consoleErrors.length === 0) pass("no console errors");
        else fail(`console errors: ${consoleErrors.join(" | ")}`);
      } finally {
        await context.close();
      }
    }

    console.log("\n[admin-calendar 1280×900]");
    const { context, page } = await createBrowserLikePage(browser, BUILDER_QA_VIEWPORTS[0]);
    const consoleErrors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    try {
      await page.goto(adminCalUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
      const spacing = await readAdminHeaderSpacing(page);
      if (spacing.subMarginTop >= 14) pass(`title/sub gap ${spacing.subMarginTop}px`);
      else fail(`title/sub gap too tight: ${spacing.subMarginTop}px`);
      if (spacing.paddingTop >= 34) pass(`header padding-top ${spacing.paddingTop}px`);
      else fail(`header padding-top ${spacing.paddingTop}px`);
      if (spacing.paddingBottom >= 30) pass(`header padding-bottom ${spacing.paddingBottom}px`);
      else fail(`header padding-bottom ${spacing.paddingBottom}px`);

      await capturePageViewportScreenshot(page, path.join(OUT_DIR, "admin-calendar-header-1280.png"));

      if (consoleErrors.length === 0) pass("no console errors");
      else fail(`console errors: ${consoleErrors.join(" | ")}`);
    } finally {
      await context.close();
    }
  },
  { channel: "chrome" },
);

await closeAllBrowsers();

console.log(`\n${errors.length === 0 ? "PASS" : "FAIL"} (${errors.length} errors)`);
if (errors.length) process.exitCode = 1;
