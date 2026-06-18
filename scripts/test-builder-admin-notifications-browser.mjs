/**
 * Builder Admin notifications smoke test (Playwright)
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const builder = path.join(root, "builder");
const builderAdmin = path.join(root, "builder-admin");
const ADMIN_NOTIF_KEY = "tasful:builder:admin:notifications:v1";
const MVP_NOTIF_KEY = "tasful:builder:mvp:notifications:v1";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on("dialog", async (dialog) => {
    await dialog.accept();
  });

  await page.goto(`file://${path.join(builderAdmin, "admin-index.html")}`);
  await page.evaluate((keys) => {
    keys.forEach((k) => localStorage.removeItem(k));
  }, [ADMIN_NOTIF_KEY]);

  const sendLink = page.locator('[data-builder-stat-action="adminNotifications"]');
  if ((await sendLink.getAttribute("href")) !== "../builder/admin-notifications.html") {
    throw new Error("Admin dashboard missing notification send link");
  }

  await page.goto(`file://${path.join(builder, "admin-notifications.html")}`);
  await page.waitForSelector("[data-builder-admin-notification-form]");

  await page.locator("[data-builder-admin-notif-to]").selectOption("users");
  await page.locator("[data-builder-admin-notif-project]").selectOption("demo-project-001");
  await page.locator("[data-builder-admin-notif-title]").fill("メンテナンスのお知らせ");
  await page.locator("[data-builder-admin-notif-body]").fill("本日メンテナンスのお知らせです。");
  await page.locator("[data-builder-admin-notif-attachment]").fill("お知らせ.pdf");
  await page.locator("[data-builder-admin-notification-form]").evaluate((form) => form.requestSubmit());

  await page.waitForFunction(
    (key) => {
      const list = JSON.parse(localStorage.getItem(key) || "[]");
      return list.some((n) => n.body?.includes("メンテナンス"));
    },
    ADMIN_NOTIF_KEY
  );

  const adminRows = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "[]"), ADMIN_NOTIF_KEY);
  const sent = adminRows.find((n) => n.body?.includes("メンテナンス"));
  if (!sent) throw new Error("Admin notification not saved");
  if (sent.to !== "users") throw new Error("Recipient not saved");
  if (sent.project_id !== "demo-project-001") throw new Error("Project not linked");
  if (!sent.attachments?.some((a) => a.name === "お知らせ.pdf")) throw new Error("Attachment not saved");

  const historyText = await page.locator("[data-builder-admin-notification-history]").textContent();
  if (!historyText?.includes("お知らせ.pdf")) throw new Error("Attachment not shown in history");
  if (!historyText?.includes("案件詳細")) throw new Error("Project link missing in history");

  await page.goto(`file://${path.join(builder, "mvp-notifications.html")}`);
  await page.waitForFunction(() => document.querySelector("[data-builder-mvp-notif-list]")?.textContent?.includes("メンテナンス"));
  const mvpListText = await page.locator("[data-builder-mvp-notif-list]").textContent();
  if (!mvpListText?.includes("メンテナンス")) throw new Error("Notification not in MVP list");
  if (!mvpListText?.includes("お知らせ.pdf")) throw new Error("Attachment not in MVP list");

  const mvpRows = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "[]"), MVP_NOTIF_KEY);
  const mvpSent = mvpRows.find((n) => n.id === sent.id);
  if (!mvpSent) throw new Error("MVP notification not synced");
  if (!mvpSent.href?.includes("demo-project-001")) throw new Error("MVP notification missing project href");

  await page.goto(`file://${path.join(builderAdmin, "admin-index.html")}`);
  await page.waitForSelector('[data-builder-stat-value="adminNotifications"]');
  const countText = await page.locator('[data-builder-stat-value="adminNotifications"]').textContent();
  if (!countText?.includes("1")) throw new Error(`Dashboard count expected 1, got ${countText}`);

  console.log("OK: builder admin notifications smoke test passed");
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
