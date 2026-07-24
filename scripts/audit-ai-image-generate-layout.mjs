#!/usr/bin/env node
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const base = "http://127.0.0.1:8788/ai-workspace?uiReview=image&mode=cross-matching";
const fails = [];

await withPlaywrightBrowser(async (browser) => {
  for (const [tag, w, h] of [
    ["pc1280", 1280, 900],
    ["sp390", 390, 844],
  ]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    const consoleErrors = [];
    page.on("console", (m) => {
      if (m.type() === "error") consoleErrors.push(m.text());
    });
    page.on("pageerror", (e) => consoleErrors.push(String(e)));

    await page.goto(base, { waitUntil: "networkidle" });
    await page.waitForSelector(".ai-generate-panel--image", { timeout: 20000 });

    const panelStyle = await page.evaluate(() => {
      const panel = document.querySelector(".ai-generate-panel--image");
      const cs = panel ? getComputedStyle(panel) : null;
      return {
        bg: cs?.backgroundColor,
        borderWidth: cs?.borderWidth,
        hasSwitcher: !!panel?.querySelector("[data-ai-image-demo-switcher]"),
        actionCount: panel?.querySelectorAll(".ai-generate-panel__action").length || 0,
      };
    });

    if (panelStyle.borderWidth !== "0px" || panelStyle.actionCount < 4) {
      fails.push(`${tag} panel-style`);
      console.log(`FAIL ${tag} panel`, panelStyle);
    }

    for (const state of ["generated1", "generated2", "generated4"]) {
      await page.locator(`[data-ai-image-demo-state="${state}"]`).click();
      await page.waitForTimeout(200);
      const m = await page.evaluate((expected) => {
        const panel = document.querySelector(".ai-generate-panel--image");
        const grid = panel?.querySelector(".ai-image-result__panel--generated [data-ai-image-grid]");
        const tiles = panel?.querySelectorAll(".ai-image-result__panel--generated .ai-image-tile") || [];
        return {
          state: panel?.getAttribute("data-ai-image-state"),
          cols: grid ? getComputedStyle(grid).gridTemplateColumns : null,
          visibleTiles: [...tiles].filter((t) => t.offsetParent !== null).length,
          scrollOverflow: document.documentElement.scrollWidth > window.innerWidth,
        };
      }, state);
      const expectedTiles = state === "generated1" ? 1 : state === "generated2" ? 2 : 4;
      const ok = m.state === state && m.visibleTiles === expectedTiles && !m.scrollOverflow;
      console.log(`${ok ? "OK" : "FAIL"} ${tag} ${state}`, m);
      if (!ok) fails.push(`${tag}/${state}`);
    }

    console.log(`${tag} consoleErrors:`, consoleErrors.length ? consoleErrors : "none");
    if (consoleErrors.length) fails.push(`${tag}/console`);
    await page.close();
  }
});

await closeAllBrowsers();
console.log(fails.length ? `FAILED ${fails.join(", ")}` : "ALL PASSED");
process.exit(fails.length ? 1 : 0);
