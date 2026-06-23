/**
 * Final UI audit — construction tools hub + 8 tool pages
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const builderDir = path.join(root, "builder");

const PAGES = [
  { id: "hub", file: "construction-tools.html", type: "hub" },
  { id: "manpower-calculator", file: "tool-manpower-calculator.html", type: "available" },
  { id: "material-calculator", file: "tool-material-calculator.html", type: "available" },
  { id: "profit-calculator", file: "tool-profit-calculator.html", type: "available" },
  { id: "estimate-helper", file: "tool-estimate-helper.html", type: "available" },
  { id: "ai-estimate", file: "tool-ai-estimate.html", type: "beta" },
  { id: "ai-cost-analysis", file: "tool-ai-cost-analysis.html", type: "beta" },
  { id: "ai-quantity-support", file: "tool-ai-quantity-support.html", type: "beta" },
  { id: "ai-schedule-suggest", file: "tool-ai-schedule-suggest.html", type: "beta" },
];

const WIDTHS = [390, 768, 1280];
let passed = 0;
let failed = 0;
const issues = [];

function pass(msg) {
  passed += 1;
  console.log(`  ✓ ${msg}`);
}
function fail(msg) {
  failed += 1;
  issues.push(msg);
  console.error(`  ✗ ${msg}`);
}

await withPlaywrightBrowser(async (browser) => {
  for (const width of WIDTHS) {
    console.log(`\n=== viewport ${width}px ===`);

    // Hub card metrics at this viewport
    {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });
      page.on("pageerror", (e) => errors.push(String(e)));

      await page.goto(`file://${path.join(builderDir, "construction-tools.html")}`, {
        waitUntil: "domcontentloaded",
      });

      const scroll = await page.evaluate(() => ({
        sw: document.documentElement.scrollWidth,
        cw: document.documentElement.clientWidth,
      }));
      if (scroll.sw > scroll.cw + 1) fail(`(${width}px) hub horizontal scroll`);
      else pass(`(${width}px) hub no horizontal scroll`);

      const cardMetrics = await page.evaluate(() => {
        const available = Array.from(document.querySelectorAll(".builder-ct-card--available")).map((el) => ({
          h: el.getBoundingClientRect().height,
          title: el.querySelector(".builder-ct-card__title")?.textContent?.trim(),
        }));
        const beta = Array.from(document.querySelectorAll(".builder-ct-card--beta")).map((el) => ({
          h: el.getBoundingClientRect().height,
          title: el.querySelector(".builder-ct-card__title")?.textContent?.trim(),
        }));
        return { available, beta };
      });

      const availHeights = cardMetrics.available.map((c) => c.h);
      const betaHeights = cardMetrics.beta.map((c) => c.h);
      const availSpread = Math.max(...availHeights) - Math.min(...availHeights);
      const betaSpread = Math.max(...betaHeights) - Math.min(...betaHeights);

      if (availSpread > 48) {
        fail(`(${width}px) hub 利用可能 card height spread ${availSpread.toFixed(0)}px: ${JSON.stringify(cardMetrics.available)}`);
      } else {
        pass(`(${width}px) hub 利用可能 card heights within ${availSpread.toFixed(0)}px`);
      }

      if (betaSpread > 48) {
        fail(`(${width}px) hub β版 card height spread ${betaSpread.toFixed(0)}px: ${JSON.stringify(cardMetrics.beta)}`);
      } else {
        pass(`(${width}px) hub β版 card heights within ${betaSpread.toFixed(0)}px`);
      }

      const availBtn = await page.locator(".builder-ct-card--available .builder-ct-card__action").first().innerText();
      const betaBtn = await page.locator(".builder-ct-card--beta .builder-ct-card__action").first().innerText();
      if (availBtn.trim() !== "今すぐ使う") fail(`(${width}px) hub available button: ${availBtn}`);
      else pass(`(${width}px) hub available buttons: 今すぐ使う`);
      if (betaBtn.trim() !== "β版を使う") fail(`(${width}px) hub beta button: ${betaBtn}`);
      else pass(`(${width}px) hub beta buttons: β版を使う`);

      if (errors.length) errors.forEach((e) => fail(`(${width}px) hub console: ${e}`));
      else pass(`(${width}px) hub no console errors`);

      await page.close();
    }

    for (const pg of PAGES.filter((p) => p.type !== "hub")) {
      const page = await browser.newPage({
        viewport: { width, height: width === 390 ? 844 : 900 },
      });
      const errors = [];
      const debugLogs = [];
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
        if (m.text().includes("[BuilderAIEngine]")) debugLogs.push(m.text());
      });
      page.on("pageerror", (e) => errors.push(String(e)));

      const url = `file://${path.join(builderDir, pg.file)}`;
      await page.goto(url, { waitUntil: "domcontentloaded" });

      const scroll = await page.evaluate(() => ({
        sw: document.documentElement.scrollWidth,
        cw: document.documentElement.clientWidth,
      }));
      if (scroll.sw > scroll.cw + 1) fail(`(${width}px) ${pg.file} horizontal scroll`);
      else pass(`(${width}px) ${pg.file} no horizontal scroll`);

      const nav = await page.evaluate(() => ({
        backHref: document.querySelector(".builder-brand")?.getAttribute("href"),
        breadcrumb: document.querySelector("[data-breadcrumb]")?.innerText?.trim() || "",
        heroTitle: document.querySelector("[class*='-hero__title']")?.textContent?.trim(),
        heroKicker: document.querySelector("[class*='-hero__kicker']")?.textContent?.trim(),
        headerTitle: document.querySelector(".builder-header__title")?.textContent?.trim(),
      }));

      if (nav.backHref !== "./construction-tools.html") {
        fail(`(${width}px) ${pg.file} back link: ${nav.backHref}`);
      } else {
        pass(`(${width}px) ${pg.file} back link OK`);
      }

      if (!nav.breadcrumb.includes("建設ツール")) {
        fail(`(${width}px) ${pg.file} breadcrumb missing 建設ツール: "${nav.breadcrumb}"`);
      } else {
        pass(`(${width}px) ${pg.file} breadcrumb OK`);
      }

      if (pg.type === "beta" && nav.heroKicker && !nav.heroKicker.includes("β版")) {
        fail(`(${width}px) ${pg.file} hero kicker should include β版: "${nav.heroKicker}"`);
      } else if (pg.type === "beta") {
        pass(`(${width}px) ${pg.file} hero kicker β版 OK`);
      }

      // Trigger calculation / diagnostic
      await page.evaluate(() => {
        window.__calcEvents = [];
        document.addEventListener("builder-tool:calculated", (e) => window.__calcEvents.push(e.detail));
      });

      const input = page.locator("[data-builder-mc-workers], [data-builder-mat-area], [data-builder-pc-contract-amount], [data-builder-est-row] input, [data-builder-ae-project-name], [data-builder-aca-contract-amount], [data-builder-aqs-area], [data-builder-ass-work-days]").first();
      if (await input.count()) {
        const tag = await input.evaluate((el) => el.tagName);
        if (tag === "INPUT") {
          await input.fill(" ");
          await input.dispatchEvent("input");
          await page.waitForTimeout(120);
        }
      }

      const calcCount = await page.evaluate(() => window.__calcEvents?.length || 0);
      if (calcCount < 1) {
        fail(`(${width}px) ${pg.file} builder-tool:calculated not fired`);
      } else {
        pass(`(${width}px) ${pg.file} calculation event OK`);
      }

      if (pg.type === "beta" || ["estimate-helper", "manpower-calculator", "material-calculator", "profit-calculator"].includes(pg.id)) {
        await page.waitForFunction(() => window.BuilderAIEngine?.ready === true, null, { timeout: 8000 }).catch(() => {});
        const hasEngine = await page.evaluate(() => !!window.BuilderAIEngine?.ready);
        if (!hasEngine) fail(`(${width}px) ${pg.file} BuilderAIEngine not ready`);
        else pass(`(${width}px) ${pg.file} BuilderAIEngine ready`);
      }

      if (errors.length) errors.forEach((e) => fail(`(${width}px) ${pg.file} console: ${e}`));
      else pass(`(${width}px) ${pg.file} no console errors`);

      await page.close();
    }
  }
});

await closeAllBrowsers();

console.log(`\n=== Audit summary ===`);
console.log(`Passed: ${passed}, Failed: ${failed}`);
if (issues.length) {
  console.log("\nIssues found:");
  issues.forEach((i) => console.log(` - ${i}`));
}
process.exit(failed > 0 ? 1 : 0);
