/**
 * Admin CSV export + calendar partner search filters
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const builder = path.join(root, "builder");
const ADMIN_CAL = `file://${path.join(builder, "admin-calendar.html")}`;

async function main() {
  await withPlaywrightBrowser(async (browser) => {const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  page.on("dialog", async (d) => d.accept());

  await page.goto(ADMIN_CAL);
  await page.waitForSelector("[data-admin-cal-assignment-open]");

  await page.waitForSelector("[data-admin-csv-export-toggle]");
  await page.locator("[data-admin-csv-export-toggle]").click();
  await page.waitForSelector("[data-admin-csv-export-menu]:not([hidden])");

  const menuItems = await page.evaluate(() => {
    const items = [...document.querySelectorAll("[data-admin-csv-export-type]")].map((el) => el.textContent.trim());
    const last = document.querySelector('[data-admin-csv-export-type="completed_projects"]');
    const lr = last?.getBoundingClientRect();
    const topEl =
      lr && document.elementFromPoint(lr.left + lr.width / 2, lr.top + lr.height / 2);
    return {
      items,
      completedClickable: topEl === last || last?.contains(topEl),
    };
  });
  if (menuItems.items.length !== 5) throw new Error(`Expected 5 CSV menu items, got ${menuItems.items.length}`);
  if (!menuItems.items.includes("完了案件CSV")) throw new Error("Missing 完了案件CSV in menu");
  if (!menuItems.completedClickable) throw new Error("完了案件CSV is covered by another element");

  const downloadPromise = page.waitForEvent("download");
  await page.locator('[data-admin-csv-export-type="partners"]').click();
  const download = await downloadPromise;
  const suggested = download.suggestedFilename();
  if (!suggested.includes("パートナー一覧")) throw new Error(`Unexpected partners CSV name: ${suggested}`);
  const tmpPath = path.join(root, "scripts", "_tmp-partners.csv");
  await download.saveAs(tmpPath);
  const csvText = fs.readFileSync(tmpPath, "utf8");
  fs.unlinkSync(tmpPath);
  if (!csvText.startsWith("\uFEFF")) throw new Error("CSV missing UTF-8 BOM");
  if (!csvText.includes("会社名")) throw new Error("Partners CSV missing header");
  if (!csvText.includes("関東外装パートナーズ")) throw new Error("Partners CSV missing demo partner");

  await page.locator("[data-admin-cal-assignment-open]").click();
  await page.waitForSelector("[data-admin-cal-assignment-modal]:not([hidden])");
  await page.waitForSelector("[data-admin-cal-partner-filter-prefecture]");

  const favOnlyCount = await page.locator(".admin-cal-partnerSearchItem").count();
  await page.locator("[data-admin-cal-partner-filter-favorite]").check();
  await page.waitForFunction(() => document.querySelectorAll(".admin-cal-partnerSearchItem").length <= 2);
  const filteredCount = await page.locator(".admin-cal-partnerSearchItem").count();
  if (filteredCount >= favOnlyCount) throw new Error("Favorite filter did not reduce partner list");

  await page.locator("[data-admin-cal-partner-filter-prefecture]").selectOption("埼玉県");
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll(".admin-cal-partnerSearchItem__main")].every((el) =>
        el.closest(".admin-cal-partnerSearchItem") ? true : false
      ) && document.querySelectorAll(".admin-cal-partnerSearchItem").length >= 1
  );

  await page.locator("[data-admin-cal-partner-filter-sort]").selectOption("rating");
  await page.locator('[data-admin-cal-partner-filter-keyword]').fill("存在しないXYZ");
  await page.waitForSelector(".admin-cal-partnerSearch__empty");

  await page.locator('[data-admin-cal-partner-filter-keyword]').fill("");
  await page.locator("[data-admin-cal-partner-filter-approved]").check();
  await page.locator("[data-admin-cal-partner-filter-active]").check();
  await page.locator('input[name="admin-cal-assignment-partner"]').first().check();

  await page.locator("[data-admin-cal-assignment-house-name]").fill("E2E CSV検索邸");
  await page.locator("[data-admin-cal-assignment-work-date]").fill("2026-09-15");
  await page.locator("[data-admin-cal-assignment-form]").evaluate((f) => f.requestSubmit());
  await page.waitForFunction(
    () => document.querySelector("[data-admin-cal-assignment-modal]")?.hidden === true
  );

  console.log("OK: admin CSV export and partner search test passed");
    });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

await closeAllBrowsers();
