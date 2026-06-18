/**
 * Builder Admin applications smoke test (Playwright)
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const builder = path.join(root, "builder");
const builderAdmin = path.join(root, "builder-admin");
const MVP_KEY = "tasful:builder:mvp:v1";
const NOTIF_KEY = "tasful:builder:mvp:notifications:v1";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(`file://${path.join(builderAdmin, "admin-index.html")}`);
  const link = page.locator('[data-builder-quick="applications"]');
  if ((await link.getAttribute("href")) !== "../builder/admin-applications.html") {
    throw new Error("Admin dashboard missing applications link");
  }

  await page.evaluate((key) => localStorage.removeItem(key), NOTIF_KEY);
  await page.goto(`file://${path.join(builder, "admin-applications.html")}`);
  await page.waitForSelector("[data-builder-admin-application-list]");

  const total = await page.locator("[data-builder-admin-app-stat-total]").textContent();
  if (!total || Number(total) < 2) throw new Error(`Expected at least 2 applications, got ${total}`);

  await page.locator("[data-builder-admin-app-search-q]").fill("オレンジ");
  await page.waitForFunction(() => document.querySelectorAll("[data-builder-admin-application-card]").length === 1);

  await page.locator("[data-builder-admin-app-search-reset]").click();
  await page.waitForFunction(() => document.querySelectorAll("[data-builder-admin-application-card]").length >= 2);

  await page.locator("[data-builder-admin-app-search-status]").selectOption("pending");
  await page.waitForFunction(() => document.querySelectorAll("[data-builder-admin-application-card]").length >= 2);

  await page.locator("[data-builder-admin-app-search-reset]").click();
  await page.locator("[data-builder-admin-app-search-area]").selectOption("東京");
  await page.waitForFunction(() => document.querySelectorAll("[data-builder-admin-application-card]").length >= 1);

  await page.locator("[data-builder-admin-app-search-reset]").click();
  await page.locator('[data-application-id="app-demo-001"]').click();
  const detailVisible = await page.locator("[data-builder-admin-application-detail-panel]:not([hidden])").isVisible();
  if (!detailVisible) throw new Error("Detail panel not visible");
  const detailText = await page.locator("[data-builder-admin-application-detail-panel]").textContent();
  if (!detailText?.includes("見積概算.pdf")) throw new Error("Attachments not in detail");

  await page.locator('[data-builder-admin-app-select="app-demo-001"]').click();
  await page.waitForFunction(() => {
    const badge = document.querySelector("[data-builder-admin-application-detail-panel] .builder-admin-application-status");
    return badge?.textContent?.includes("選定");
  });

  const mvpAfterSelect = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "{}"), MVP_KEY);
  const app1 = (mvpAfterSelect.applications || []).find((a) => a.application_id === "app-demo-001");
  if (app1?.status !== "selected") throw new Error("User-side application not selected");

  const notifsAfterSelect = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "[]"), NOTIF_KEY);
  if (!notifsAfterSelect.some((n) => n.label === "案件応募承認")) throw new Error("Select notification missing");

  const autoRejected = await page.evaluate((key) => {
    const state = JSON.parse(localStorage.getItem(key) || "{}");
    return (state.applications || []).some((a) => a.application_id === "app-demo-002" && a.status === "rejected");
  }, MVP_KEY);
  if (!autoRejected) throw new Error("Partner 002 should be auto-rejected when required_partners=1");

  await page.locator('[data-builder-admin-app-pending="app-demo-001"]').click();
  await page.waitForFunction((key) => {
    const state = JSON.parse(localStorage.getItem(key) || "{}");
    const app = (state.applications || []).find((a) => a.application_id === "app-demo-001");
    return app?.status === "applied";
  }, MVP_KEY);

  const notifs = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "[]"), NOTIF_KEY);
  if (!notifs.some((n) => n.label === "応募保留")) throw new Error("Pending notification missing");

  await page.goto(`file://${path.join(builder, "mvp-project-detail.html")}?id=demo-project-001`);
  await page.waitForSelector("[data-builder-mvp-pd-app-list]");
  const userList = await page.locator("[data-builder-mvp-pd-app-list]").textContent();
  if (!userList?.includes("応募中")) throw new Error("User project detail not reflecting pending status");

  console.log("OK: builder admin applications smoke test passed");
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
