import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const PORTS = [5173, 5176, 5174, 5188, 5182, 5199];
let base = null;
for (const port of PORTS) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/detail-job.html`, {
      method: "HEAD",
      signal: AbortSignal.timeout(2000),
    });
    if (res.ok) {
      base = `http://127.0.0.1:${port}`;
      break;
    }
  } catch {
    /* next */
  }
}
if (!base) {
  console.error("No server found");
  await closeAllBrowsers();
  process.exit(1);
}
console.log("Base:", base);

await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage();
const logs = [];
page.on("console", (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
page.on("pageerror", (err) => logs.push(`[pageerror] ${err.message}`));

for (const id of ["demo-job-001", "9c950eea-409d-4d1b-9d72-7728d91960f8"]) {
  logs.length = 0;
  await page.goto(`${base}/detail-job.html?id=${id}`, {
    waitUntil: "commit",
    timeout: 20000,
  });
  await page.waitForTimeout(12000);
  const state = await page.evaluate(() => ({
    listingLoaded: document.body.dataset.listingLoaded,
    statusHidden: document.getElementById("listing-detail-status")?.hidden,
    statusText: document.getElementById("listing-detail-status")?.textContent?.trim(),
    mainVisible: getComputedStyle(document.querySelector(".detail-page-main") || document.body).visibility,
    hasHero: !!document.querySelector(".job-hero-section"),
    heroHidden: document.querySelector(".job-hero-section")?.hidden,
    title: document.querySelector("[data-listing-title]")?.textContent?.trim(),
    company: document.querySelector("[data-seller-display-name]")?.textContent?.trim(),
  }));
  console.log(`\n=== ${id} ===`);
  console.log("state:", JSON.stringify(state, null, 2));
  console.log("errors:", logs.filter((l) => l.includes("error") || l.includes("pageerror")).slice(0, 10));
  console.log("last logs:", logs.slice(-8));
}

});
