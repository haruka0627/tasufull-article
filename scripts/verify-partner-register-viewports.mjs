/**
 * Verify partner registration pages at 390/768/1280px — console errors and basic layout.
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.PRT_REG_BASE || "http://127.0.0.1:8788";
const OUT_DIR = path.join("reports", "screenshots", "partner-register");

const FORM_PAGES = [
  { name: "tasful", url: "/partner-register.html" },
  { name: "iwasho", url: "/iwasho/partner-register.html" },
];

const PAGES = FORM_PAGES.concat([
  { name: "builder-mgmt", url: "/builder/partner-management.html?mock=1" },
]);

const VIEWPORTS = [
  { label: "390", width: 390, height: 844 },
  { label: "768", width: 768, height: 1024 },
  { label: "1280", width: 1280, height: 900 },
];

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const results = [];

  for (const pageDef of PAGES) {
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await context.newPage();
      const consoleErrors = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });
      page.on("pageerror", (err) => consoleErrors.push(String(err)));

      const fullUrl = BASE + pageDef.url;
      let loadOk = true;
      let loadError = "";
      try {
        const res = await page.goto(fullUrl, { waitUntil: "networkidle", timeout: 30000 });
        if (!res || !res.ok()) {
          loadOk = false;
          loadError = "HTTP " + (res ? res.status() : "no response");
        }
        await page.waitForSelector("[data-partner-register-form-el], [data-prt-mgmt-table]", { timeout: 10000 }).catch(() => {});
      } catch (e) {
        loadOk = false;
        loadError = String(e.message || e);
      }

      const shot = path.join(OUT_DIR, `${pageDef.name}-${vp.label}.png`);
      await page.screenshot({ path: shot, fullPage: true }).catch(() => {});

      const title = await page.title().catch(() => "");
      const hasForm = await page.locator("[data-partner-register-form-el]").count();
      const hasTable = await page.locator("[data-prt-mgmt-table]").count();

      let formWidth = null;
      let layoutMetrics = null;
      let hasFlowGuide = false;
      let hasDocsNote = false;
      let hasTradeTags = false;
      if (hasForm > 0) {
        formWidth = await page.evaluate(() => {
          const inner = document.querySelector(".prt-reg-main__inner");
          return inner ? Math.round(inner.getBoundingClientRect().width) : null;
        });
        layoutMetrics = await page.evaluate(() => {
          const docWidth = document.documentElement.scrollWidth;
          const viewWidth = window.innerWidth;
          const inlineRadios = document.querySelector('[data-prt-entity-type]');
          const inlineCs = inlineRadios ? getComputedStyle(inlineRadios) : null;
          const tagRow = document.querySelector(".prt-reg-tags");
          const tagCount = tagRow ? tagRow.querySelectorAll(".prt-reg-tag").length : 0;
          return {
            horizontalScroll: docWidth > viewWidth + 1,
            docWidth,
            viewWidth,
            entityTypeFlexDirection: inlineCs ? inlineCs.flexDirection : null,
            tradeTagCount: tagCount,
          };
        });
        hasFlowGuide = (await page.locator(".prt-reg-flow").count()) > 0;
        hasDocsNote = (await page.locator(".prt-reg-docs-note").count()) > 0;
        hasTradeTags = (await page.locator(".prt-reg-tags__heading").count()) > 0;
      }

      results.push({
        page: pageDef.name,
        url: fullUrl,
        viewport: vp.label,
        loadOk,
        loadError,
        title,
        hasForm: hasForm > 0,
        hasTable: hasTable > 0,
        formInnerWidth: formWidth,
        layoutMetrics,
        hasFlowGuide,
        hasDocsNote,
        hasTradeTags,
        consoleErrors,
        screenshot: shot,
      });

      await context.close();
    }
  }

  await browser.close();

  const report = {
    checkedAt: new Date().toISOString(),
    base: BASE,
    results,
    summary: {
      total: results.length,
      loadFailures: results.filter((r) => !r.loadOk).length,
      consoleErrorCount: results.reduce((n, r) => n + r.consoleErrors.length, 0),
    },
  };

  await writeFile("reports/partner-register-verify.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report.summary, null, 2));
  for (const r of results) {
    const errFlag = r.consoleErrors.length ? " ERR:" + r.consoleErrors.length : "";
    const w = r.formInnerWidth != null ? ` width=${r.formInnerWidth}` : "";
    const hs = r.layoutMetrics?.horizontalScroll ? " HSCROLL" : "";
    console.log(`${r.page}@${r.viewport}: load=${r.loadOk}${errFlag}${w}${hs}`);
  }
  process.exit(report.summary.loadFailures > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
