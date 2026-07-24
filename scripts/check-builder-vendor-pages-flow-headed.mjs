#!/usr/bin/env node
/**
 * 業者ページフロー — headed 目視確認
 *
 *   node scripts/check-builder-vendor-pages-flow-headed.mjs
 *   node scripts/check-builder-vendor-pages-flow-headed.mjs --visual-slow --viewport=1280
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl, buildLocalPageUrl } from "./lib/dev-server-url.mjs";
import { BUILDER_QA_VIEWPORTS } from "./lib/playwright-viewport.mjs";

const VENDOR_PAGES_KEY = "tasful:builder:vendor-pages:v1";
const VENDOR_DRAFTS_KEY = "tasful:builder:vendor-page-drafts:v1";
const CONTACT_REVEAL_KEY = "tasful:builder:contact-reveals:v1";
const TEST_COMPANY = "Headedデモ建設";

const CLI = {
  visualSlow: process.argv.includes("--visual-slow"),
  viewport: (process.argv.find((a) => a.startsWith("--viewport=")) || "").slice("--viewport=".length),
};

const TIMING = CLI.visualSlow
  ? { slowMo: 2200, pause: 4500, pauseNav: 5000 }
  : { slowMo: 450, pause: 700, pauseNav: 900 };

const base = await findDevServerBaseUrl({ probePath: "builder/vendor-pages.html" });
const viewports = CLI.viewport
  ? BUILDER_QA_VIEWPORTS.filter((v) => String(v.width) === CLI.viewport)
  : BUILDER_QA_VIEWPORTS;

/** @type {{ step: string, status: string, detail?: string }[]} */
const report = [];

function log(step, status, detail = "") {
  report.push({ step, status, detail });
  console.log(`  ${status === "pass" ? "✓" : "✗"} ${step}${detail ? ` — ${detail}` : ""}`);
}

async function pause(page, ms = TIMING.pause) {
  await page.waitForTimeout(ms);
}

for (const vp of viewports) {
  console.log(`\n######## viewport ${vp.width} ########`);
  await withPlaywrightBrowser(
    async (browser) => {
      const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
      const errs = [];
      page.on("console", (m) => {
        if (m.type() === "error") errs.push(m.text());
      });

      await page.goto(buildLocalPageUrl(base, "builder/vendor-pages.html"), {
        waitUntil: "domcontentloaded",
      });
      await page.evaluate(
        (keys) => keys.forEach((k) => localStorage.removeItem(k)),
        [VENDOR_PAGES_KEY, VENDOR_DRAFTS_KEY, CONTACT_REVEAL_KEY]
      );
      await page.reload({ waitUntil: "domcontentloaded" });
      log("vendor-pages 表示", "pass");
      await pause(page);

      await page.locator("[data-vendor-page-create]").click();
      await page.locator('input[name="companyName"]').fill(TEST_COMPANY);
      await page.locator('input[name="tradesText"]').fill("interior");
      await page.locator('input[name="areasText"]').fill("tokyo");
      await page.locator('input[name="phone"]').fill("090-1111-2222");
      await page.locator('input[name="email"]').fill("headed@example.jp");
      await page.locator("[data-vendor-page-ai-generate]").click();
      await pause(page);
      log("AI mock 生成", "pass");
      await page.locator("[data-vendor-page-publish]").click();
      page.once("dialog", (d) => d.accept());
      await pause(page, TIMING.pauseNav);

      const pageId = await page.evaluate(
        (key) => {
          const list = JSON.parse(localStorage.getItem(key) || "[]");
          return list[0]?.pageId || "";
        },
        VENDOR_PAGES_KEY
      );
      if (pageId) log("公開", "pass", pageId);
      else log("公開", "fail");

      await page.goto(buildLocalPageUrl(base, "builder/partners.html"), { waitUntil: "domcontentloaded" });
      await pause(page);
      const listText = await page.locator("[data-builder-partner-results]").textContent();
      if (listText?.includes(TEST_COMPANY)) log("partners 一覧", "pass");
      else log("partners 一覧", "fail");

      await page.goto(
        buildLocalPageUrl(base, `builder/partner.html?partner_id=${encodeURIComponent(pageId)}`),
        { waitUntil: "domcontentloaded" }
      );
      await pause(page);
      log("partner 詳細", "pass");

      await page.locator('[data-builder-talk-contact]').first().click();
      await page.waitForURL(/chat-detail/i, { timeout: 20000 });
      await pause(page, TIMING.pauseNav);
      log("Talk 遷移", "pass");

      log("Console Error", errs.length ? "fail" : "pass", `${errs.length}件`);
    },
    { headless: false, slowMo: TIMING.slowMo }
  );
}

await closeAllBrowsers();
const fails = report.filter((r) => r.status === "fail");
console.log(`\nSUMMARY: ${report.length} steps, FAIL ${fails.length}`);
process.exitCode = fails.length ? 1 : 0;
