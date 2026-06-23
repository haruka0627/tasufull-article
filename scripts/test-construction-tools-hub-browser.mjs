import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const url = `file://${path.join(root, "builder/construction-tools.html")}`;

let failed = 0;
function ok(msg) {
  console.log(`  ✓ ${msg}`);
}
function bad(msg) {
  failed += 1;
  console.error(`  ✗ ${msg}`);
}

await withPlaywrightBrowser(async (browser) => {
  for (const width of [390, 768, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    page.on("pageerror", (e) => errors.push(String(e)));

    await page.goto(url, { waitUntil: "domcontentloaded" });

    const metrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    if (metrics.scrollWidth > metrics.clientWidth + 1) {
      bad(`(${width}px) horizontal scroll`);
    } else {
      ok(`(${width}px) no horizontal scroll`);
    }

    const betaValue = await page.locator(".builder-ct-stat-card--beta .builder-ct-stat-card__value").innerText();
    if (betaValue.trim() !== "4") bad(`(${width}px) beta stat ${betaValue}`);
    else ok(`(${width}px) β版 stat is 4`);

    const soonValue = await page.locator(".builder-ct-stat-card--soon .builder-ct-stat-card__value").innerText();
    if (soonValue.trim() !== "0") bad(`(${width}px) soon stat ${soonValue}`);
    else ok(`(${width}px) 準備中 stat is 0`);

    const betaLinks = page.locator("a.builder-btn--beta[href]");
    if ((await betaLinks.count()) !== 4) {
      bad(`(${width}px) beta link count ${await betaLinks.count()}`);
    } else {
      ok(`(${width}px) 4 beta links`);
    }

    const hrefs = await betaLinks.evaluateAll((els) => els.map((el) => el.getAttribute("href")));
    const expected = [
      "tool-ai-estimate.html",
      "tool-ai-quantity-support.html",
      "tool-ai-schedule-suggest.html",
      "tool-ai-cost-analysis.html",
    ];
    expected.forEach((href) => {
      if (!hrefs.includes(href)) bad(`(${width}px) missing beta link ${href}`);
      else ok(`(${width}px) link OK: ${href}`);
    });

    const disabled = await page.locator('button[disabled]:has-text("準備中")').count();
    if (disabled !== 0) bad(`(${width}px) disabled count ${disabled}`);
    else ok(`(${width}px) 0 disabled 準備中 buttons`);

    const betaBadges = await page.locator(".builder-ct-card__status--beta").count();
    if (betaBadges !== 4) bad(`(${width}px) beta badge count ${betaBadges}`);
    else ok(`(${width}px) 4 β版 badges`);

    if (errors.length) errors.forEach((e) => bad(`(${width}px) console: ${e}`));
    else ok(`(${width}px) no console errors`);

    await page.close();
  }
});

await closeAllBrowsers();
console.log(failed ? `\nResult: ${failed} failed` : "\nResult: all passed");
process.exit(failed ? 1 : 0);
