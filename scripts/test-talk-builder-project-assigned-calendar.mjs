/**
 * Builder admin_ops 新着案件 → カレンダーで対象案件が自動選択されること（390px）
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import {
  auditPartnerAssignmentPage,
  BUILDER_DEMO_ASSIGNMENT_PROJECT,
} from "./lib/audit-partner-assignment.mjs";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const base = await requireDevServer();
console.log("Base URL:", base);

const STORAGE_KEYS = [
  "tasful_talk_notifications",
  "tasful_platform_notify_master_v1",
  "tasful_builder_notify_master_v1",
  "tasful_anpi_notify_master_v1",
  "tasful_talk_notifications_seeded_v2",
  "tasful_chat_messages",
  "tasful_official_room_last_seen_v1",
];

await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

await page.goto(`${base}/talk-home.html`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.evaluate((keys) => keys.forEach((k) => localStorage.removeItem(k)), STORAGE_KEYS);

await page.goto(`${base}/talk-home.html?tab=notify&talkAdmin=1`, {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await page.waitForSelector('[data-talk-notify-id="builder-ops-flow-001"]', {
  timeout: 20000,
});
await page.waitForTimeout(600);

const notifyAudit = await page.evaluate(() => {
  const card = document.querySelector('[data-talk-notify-id="builder-ops-flow-001"]');
  const action = card?.querySelector("[data-talk-notify-action]");
  return {
    title: card?.querySelector(".talk-notify-card__title")?.textContent?.trim(),
    project: card?.querySelector(".talk-notify-card__project")?.textContent?.trim(),
    actionHref: action?.getAttribute("href"),
  };
});

console.log("Notify audit:", JSON.stringify(notifyAudit, null, 2));

let failed = false;
if (notifyAudit.title !== "新着案件が入りました") failed = true;
if (!notifyAudit.actionHref?.includes("builder/partner-assignment.html")) failed = true;

await page.locator('article[data-talk-notify-id="builder-ops-flow-001"]').click();
await page.waitForLoadState("domcontentloaded");

const calAudit = await auditPartnerAssignmentPage(page, BUILDER_DEMO_ASSIGNMENT_PROJECT);
console.log("Partner assignment audit:", JSON.stringify(calAudit, null, 2));

if (!calAudit.ok) failed = true;

});
await closeAllBrowsers();
process.exit(failed ? 1 : 0);
