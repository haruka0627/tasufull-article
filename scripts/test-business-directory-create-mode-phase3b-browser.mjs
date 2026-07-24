#!/usr/bin/env node
/**
 * Business Directory Phase 3b — creation mode browser E2E (8788)
 *   node scripts/test-business-directory-create-mode-phase3b-browser.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser } from "./lib/playwright-browser.mjs";
import { STANDARD_LOCAL_BASE, buildLocalPageUrl } from "./lib/dev-server-url.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = (process.env.BASE_URL || STANDARD_LOCAL_BASE).replace(/\/$/, "");
const PAGE_QS = "bdMock=1&devSkipAuth=1";
const SHOT_DIR = path.join(root, "reports", "business-directory-create-mode-phase3b-browser");
const VIEWPORTS = [
  { name: "390", width: 390, height: 844 },
  { name: "768", width: 768, height: 1024 },
  { name: "1280", width: 1280, height: 900 },
];

const results = [];

function pass(step, detail = "") {
  results.push({ step, ok: true, detail });
  console.log(`  OK  ${step}${detail ? `: ${detail}` : ""}`);
}

function fail(step, detail = "") {
  results.push({ step, ok: false, detail });
  console.error(`  NG  ${step}${detail ? `: ${detail}` : ""}`);
}

function pageUrl() {
  return buildLocalPageUrl(BASE, "business-directory/new.html", PAGE_QS);
}

async function main() {
  console.log("\nBusiness Directory Phase 3b — creation mode browser E2E\n");
  fs.mkdirSync(SHOT_DIR, { recursive: true });

  const res = await fetch(pageUrl());
  if (res.status === 200) pass("HTTP Status", "200");
  else fail("HTTP Status", String(res.status));

  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage({ viewport: VIEWPORTS[2] });
    const consoleErrors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push(String(err.message || err)));

    await page.goto(pageUrl(), { waitUntil: "domcontentloaded", timeout: 20000 });

    const pickerVisible = await page.locator("[data-bd-create-mode-picker]").isVisible();
    const formWrapHidden = await page.locator("[data-bd-new-form-wrap]").isHidden();
    if (pickerVisible && formWrapHidden) pass("Initial state shows mode picker only");
    else fail("Initial state", `picker=${pickerVisible} formHidden=${formWrapHidden}`);

    await page.locator('[data-bd-create-mode="manual"]').click();
    await page.waitForSelector("[data-bd-new-form]:visible", { timeout: 8000 });
    const manualMode = await page.locator("[data-bd-root]").getAttribute("data-bd-create-mode");
    if (manualMode === "manual") pass("Manual mode selected");
    else fail("Manual mode", manualMode || "");

    const aiDraftPanel = await page.locator("[data-bd-ai-draft-host] .bd-ai-draft").count();
    if (aiDraftPanel >= 1) pass("Manual mode shows existing AI draft panel");
    else fail("Manual mode AI draft panel");

    const photoInput = page.locator('[name="photo"]');
    if ((await photoInput.count()) === 1 && (await photoInput.isVisible())) {
      pass("Photo upload field visible in manual mode");
    } else fail("Photo upload field");

    await page.locator("[data-bd-create-mode-back]").click();
    await page.waitForSelector("[data-bd-create-mode-picker]:visible", { timeout: 8000 });
    if (await page.locator("[data-bd-new-form-wrap]").isHidden()) pass("Back returns to picker");
    else fail("Back to picker");

    await page.locator('[data-bd-create-mode="ai"]').click();
    await page.waitForSelector("[data-bd-ai-page-generate]:visible", { timeout: 8000 });
    const aiMode = await page.locator("[data-bd-root]").getAttribute("data-bd-create-mode");
    if (aiMode === "ai") pass("AI mode selected");
    else fail("AI mode", aiMode || "");

    const prepInline = await page.locator("[data-bd-ai-page-generate]").count();
    const liveGenerate = await page.locator("[data-bd-ai-generate]").count();
    if (prepInline >= 1 && liveGenerate === 0) pass("AI mode shows page generate (not manual draft panel)");
    else fail("AI mode generate button", `page=${prepInline} draft=${liveGenerate}`);

    if (await page.locator('[name="display_name"]').isVisible()) pass("AI mode still shows input form");
    else fail("AI mode form visibility");

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(pageUrl(), { waitUntil: "domcontentloaded" });
      await page.waitForSelector("[data-bd-create-mode-picker]", { timeout: 10000 });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
      );
      if (!overflow) pass(`viewport ${vp.name}px no horizontal overflow`);
      else fail(`viewport ${vp.name}px layout overflow`);
      await page.screenshot({
        path: path.join(SHOT_DIR, `new-mode-picker-${vp.name}.png`),
        fullPage: true,
      });
    }

    if (!consoleErrors.length) pass("Console errors", "none");
    else fail("Console errors", consoleErrors.slice(0, 3).join(" | "));
  });

  const ng = results.filter((r) => !r.ok);
  console.log(`\nScreenshots: ${path.relative(root, SHOT_DIR)}/`);
  console.log(`\n=== ${results.filter((r) => r.ok).length}/${results.length} checks passed ===\n`);
  if (ng.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
