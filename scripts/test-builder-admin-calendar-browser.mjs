/**
 * Builder Admin Calendar smoke test
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const builder = path.join(root, "builder");
const MVP_KEY = "tasful:builder:mvp:v1";
const PAGE = `file://${path.join(builder, "admin-calendar.html")}`;

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on("dialog", async (d) => d.accept());

  await page.goto(PAGE);
  await page.waitForSelector("[data-admin-cal-grid]");

  await page.evaluate((key) => {
    const state = JSON.parse(localStorage.getItem(key) || "{}");
    for (const t of Object.values(state.threads || {})) {
      if (!t || typeof t !== "object") continue;
      t.siteData = { photos: [], completed: false, completionConsent: false, completedAt: null };
      if (t.status === "completed") t.status = "open";
      t.pdf_outputs = (t.pdf_outputs || []).filter((p) => p.kind !== "invoice");
    }
    localStorage.setItem(key, JSON.stringify(state));
  }, MVP_KEY);
  await page.reload();
  await page.waitForSelector("[data-admin-cal-grid]");

  const monthBadges = await page.locator(".admin-cal-badge").count();
  if (monthBadges < 1) throw new Error("Expected calendar badges in month view");

  await page.locator("[data-admin-cal-view='week']").click();
  await page.waitForSelector(".admin-cal-weekBody");
  const weekBadges = await page.locator(".admin-cal-weekBody .admin-cal-badge").count();
  if (weekBadges < 1) throw new Error("Week view empty");

  await page.locator("[data-admin-cal-view='day']").click();
  await page.waitForSelector(".admin-cal-dayView");

  await page.locator("[data-admin-cal-view='month']").click();
  await page.locator(".admin-cal-badge").first().click();
  await page.waitForSelector("[data-admin-cal-detail] .admin-cal-card");

  const attachCount = await page.locator("[data-admin-cal-attach-index]").count();
  if (attachCount > 0) {
    await page.locator("[data-admin-cal-attach-index='0']").click();
    await page.waitForSelector("[data-admin-cal-preview-modal]:not([hidden])");
    await page.locator("[data-admin-cal-preview-close]").click();
  }

  const detailText = await page.locator("[data-admin-cal-detail]").textContent();
  if (!detailText?.includes("指示書")) throw new Error("Detail panel missing instructions");
  if (!detailText?.includes("現場住所")) throw new Error("Detail panel missing location");

  const threadHref = await page.locator("[data-admin-cal-thread-link]").getAttribute("href");
  if (!threadHref?.includes("mvp-thread.html")) throw new Error("Thread link missing");
  if (!threadHref?.includes("role=owner")) throw new Error("Thread link missing role=owner");

  const hasStatusColors = await page.evaluate(() => {
    const classes = Array.from(document.querySelectorAll(".admin-cal-badge")).map((el) => el.className);
    return classes.some((c) => c.includes("unassigned") || c.includes("assigned") || c.includes("completed"));
  });
  if (!hasStatusColors) throw new Error("Status color badges missing");

  await page.locator("[data-admin-cal-complete-open]").click();
  await page.locator("[data-admin-cal-complete-consent]").check();
  await page.locator("[data-admin-cal-complete-form]").evaluate((f) => f.requestSubmit());

  await page.waitForFunction(
    (key) => {
      const state = JSON.parse(localStorage.getItem(key) || "{}");
      return Object.values(state.threads || {}).some((t) => t.siteData?.completed);
    },
    MVP_KEY
  );

  const pdfOk = await page.evaluate((key) => {
    const state = JSON.parse(localStorage.getItem(key) || "{}");
    return Object.values(state.threads || {}).some((t) => (t.pdf_outputs || []).some((p) => p.kind === "invoice"));
  }, MVP_KEY);
  if (!pdfOk) throw new Error("Invoice PDF not generated from calendar complete");

  const page2 = await context.newPage();
  await page2.goto(PAGE);
  await page2.waitForSelector("[data-admin-cal-grid]");
  const synced = await page2.evaluate((key) => {
    const state = JSON.parse(localStorage.getItem(key) || "{}");
    return Object.values(state.threads || {}).some((t) => t.siteData?.completed);
  }, MVP_KEY);
  if (!synced) throw new Error("Cross-tab sync: completed state not visible");

  console.log("OK: builder admin calendar smoke test passed");
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
