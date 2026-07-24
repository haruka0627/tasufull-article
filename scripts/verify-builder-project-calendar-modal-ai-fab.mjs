#!/usr/bin/env node
/**
 * project-calendar — 390px モーダル表示時に Site Assistant FAB が保存ボタンと被らない
 *
 *   node scripts/verify-builder-project-calendar-modal-ai-fab.mjs
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import {
  BUILDER_QA_VIEWPORTS,
  assertBrowserLikeEnv,
  createBrowserLikePage,
} from "./lib/playwright-viewport.mjs";
import { findDevServerBaseUrl, buildLocalPageUrl } from "./lib/dev-server-url.mjs";

const url = buildLocalPageUrl(
  await findDevServerBaseUrl({ probePath: "builder/project-calendar.html" }),
  "builder/project-calendar.html",
);

const errors = [];
const pass = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => {
  errors.push(m);
  console.log(`  ✗ ${m}`);
};

/** @param {import('playwright').Page} page */
async function readFabOverlap(page) {
  return page.evaluate(() => {
    const assist = document.querySelector(".tasu-site-assist");
    const submit = document.querySelector("[data-builder-cal-modal-submit]");
    const cancel = document.querySelector("[data-builder-cal-modal-cancel]");
    const modalOpen = document.body.classList.contains("builder-cal-modal-open");
    const assistDisplay = assist ? getComputedStyle(assist).display : "";
    const assistHidden = !assist || assistDisplay === "none";

    function overlaps(a, b) {
      if (!a || !b) return false;
      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      return !(ar.right <= br.left || ar.left >= br.right || ar.bottom <= br.top || ar.top >= br.bottom);
    }

    const fab = assist?.querySelector("[data-tasu-site-fab]");
    return {
      modalOpen,
      assistHidden,
      assistDisplay,
      submitOverlap: overlaps(fab, submit),
      cancelOverlap: overlaps(fab, cancel),
    };
  });
}

console.log("URL:", url);

await withPlaywrightBrowser(
  async (browser) => {
    for (const vp of BUILDER_QA_VIEWPORTS) {
      console.log(`\n[viewport ${vp.label}]`);
      const { context, page } = await createBrowserLikePage(browser, vp);
      try {
        const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
        if ((res?.status() ?? 0) === 200) pass("HTTP 200");
        else fail(`HTTP ${res?.status() ?? 0}`);

        await page.locator("[data-builder-cal-standard]").waitFor({ state: "visible", timeout: 10000 });

        const before = await readFabOverlap(page);
        if (vp.id === "390") {
          if (!before.assistHidden) pass("site assistant visible before modal (390)");
          else fail("site assistant should be visible before modal at 390");
        } else if (!before.assistHidden) {
          pass("site assistant visible before modal");
        } else {
          fail(`site assistant hidden before modal at ${vp.label}`);
        }

        await page.locator("[data-builder-cal-add-event]").click();
        await page.locator("[data-builder-cal-modal]").waitFor({ state: "visible", timeout: 5000 });

        const envCheck = await assertBrowserLikeEnv(page, vp);
        if (envCheck.ok) pass(`browser-like env OK`);
        else fail(`browser-like env: ${envCheck.errors.join("; ")}`);

        const during = await readFabOverlap(page);
        if (during.modalOpen) pass("body.builder-cal-modal-open set");
        else fail("body.builder-cal-modal-open missing while modal open");

        if (during.assistHidden) pass("site assistant hidden while modal open");
        else fail(`site assistant still visible (display=${during.assistDisplay})`);

        if (!during.submitOverlap && !during.cancelOverlap) pass("FAB does not overlap save/cancel");
        else fail(`FAB overlaps actions submit=${during.submitOverlap} cancel=${during.cancelOverlap}`);

        await page.locator("[data-builder-cal-modal-cancel]").click();
        await page.locator("[data-builder-cal-modal]").waitFor({ state: "hidden", timeout: 5000 });

        const after = await readFabOverlap(page);
        if (!after.modalOpen) pass("body class cleared after close");
        else fail("body.builder-cal-modal-open still set after close");

        if (!after.assistHidden) pass("site assistant visible again after close");
        else fail("site assistant still hidden after modal close");
      } finally {
        await context.close();
      }
    }
  },
  { channel: "chrome" },
);

await closeAllBrowsers();

console.log(`\n${errors.length === 0 ? "PASS" : "FAIL"} (${errors.length} errors)`);
if (errors.length) process.exitCode = 1;
