/**
 * Browser check: partner-management API mode without login
 */
import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";

const BASE = process.env.PRT_UI_BASE || "http://127.0.0.1:8788";

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  await context.clearCookies();
  const page = await context.newPage();
  await page.goto(`${BASE}/builder/partner-management.html`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForSelector("[data-prt-mgmt-table]", { timeout: 15000 });

  const ui = await page.evaluate(() => ({
    mode: document.querySelector("[data-prt-mgmt-mode]")?.textContent || "",
    errorText: document.querySelector(".builder-admin-empty__sub")?.textContent || "",
    pending: document.querySelector("[data-prt-mgmt-stat-pending]")?.textContent || "",
  }));

  await browser.close();
  const report = { checkedAt: new Date().toISOString(), ui };
  await writeFile("reports/partner-api-auth-ui-verify.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
