import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const url = "http://127.0.0.1:8788/materials/detail?slug=presentation-business";
const viewports = [
  { name: "1280", width: 1280, height: 900 },
  { name: "768", width: 768, height: 1024 },
  { name: "390", width: 390, height: 844 },
];
const required = [
  "[data-presentation-viewer]",
  "[data-pres-counter]",
  "[data-pres-prev]",
  "[data-pres-next]",
  ".mat-detail-pres-info",
  ".mat-detail-pres-setup",
  "#matDetailPresUsageTitle",
  ".mat-detail-pres-ai-cta__link",
  "#matDetailAiTitle",
  ".mat-detail-about",
];

await withPlaywrightBrowser(async (browser) => {
  const results = [];
  for (const vp of viewports) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e.message || e)));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    const resp = await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForSelector("[data-presentation-viewer]", { timeout: 15000 });
    const missing = [];
    for (const sel of required) {
      if (!(await page.locator(sel).count())) missing.push(sel);
    }
    await page.locator("[data-pres-next]").click();
    await page.waitForTimeout(200);
    const counterAfterNext = await page.locator("[data-pres-counter]").innerText();
    await page.locator('[data-pres-tab="2"]').click();
    await page.waitForTimeout(200);
    const counterAfterTab = await page.locator("[data-pres-counter]").innerText();
    results.push({
      viewport: vp.name,
      httpStatus: resp?.status() ?? null,
      consoleErrors: errors.length,
      errors,
      missing,
      counterAfterNext,
      counterAfterTab,
      pass: (resp?.status() === 200) && errors.length === 0 && missing.length === 0,
    });
    await page.close();
  }
  const allPass = results.every((r) => r.pass);
  console.log(JSON.stringify({ allPass, results }, null, 2));
  if (!allPass) process.exitCode = 1;
});

await closeAllBrowsers();
