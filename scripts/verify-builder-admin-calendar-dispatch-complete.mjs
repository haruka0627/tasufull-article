#!/usr/bin/env node
/**
 * admin-calendar — 手配完了（パートナー受諾後）表示検証
 *
 *   node scripts/verify-builder-admin-calendar-dispatch-complete.mjs
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl, buildLocalPageUrl } from "./lib/dev-server-url.mjs";

const base = await findDevServerBaseUrl({ probePath: "builder/admin-calendar.html" });
const url = buildLocalPageUrl(base, "builder/admin-calendar.html");

const errors = [];
const pass = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => {
  errors.push(m);
  console.log(`  ✗ ${m}`);
};

console.log("URL:", url);

await withPlaywrightBrowser(async (browser) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
  if ((res?.status() ?? 0) === 200) pass("HTTP 200");
  else fail(`HTTP ${res?.status() ?? 0}`);

  await page.locator(".admin-cal-monthHead").waitFor({ state: "visible", timeout: 10000 });

  const acceptBtn = page.locator("[data-partner-cal-accept], [data-mvp-cal-accept]");
  if ((await acceptBtn.count()) === 0) pass("no 受ける/受けない on admin-calendar");
  else fail("accept/decline buttons must not appear on admin-calendar");

  // 月表示は1日3件まで — 手配完了デモ（7/10）を日ビューで確認
  await page.locator('[data-admin-cal-date="2026-07-10"]').click();
  await page.locator('[data-admin-cal-view="day"]').click();
  await page.waitForTimeout(300);

  const targetBadge = page
    .locator(".admin-cal-badge--dispatch_complete")
    .filter({ hasText: /^店舗内装リニューアル · 手配完了$/ })
    .first();
  if ((await targetBadge.count()) >= 1) pass("dispatch_complete badge for accepted demo on day view");
  else fail("no dispatch_complete badge for 店舗内装リニューアル demo (check 2026-07-10)");

  await targetBadge.click();
  await page.waitForTimeout(300);

  const statusBadge = page.locator(".admin-cal-card__status");
  const statusText = (await statusBadge.first().textContent())?.trim() || "";
  if (statusText.includes("手配完了")) pass(`detail status: ${statusText}`);
  else fail(`detail status expected 手配完了, got: ${statusText}`);

  const cardMeta = (await page.locator(".admin-cal-card__meta").first().textContent()) || "";
  const hasAssignee =
    (cardMeta.includes("担当:") || cardMeta.includes("担当パートナー:")) && !cardMeta.includes("未割当");
  if (hasAssignee) pass(`assignee in meta: ${cardMeta.trim()}`);
  else fail(`assignee not resolved: ${cardMeta}`);

  const notifyBtn = page.locator("[data-admin-cal-assign-notify]");
  if ((await notifyBtn.count()) === 0) pass("手配して通知 hidden for dispatch_complete");
  else fail("手配して通知 should be hidden after dispatch complete");

  const lockedPartner = page.locator(".admin-cal-partnerSection--locked");
  if ((await lockedPartner.count()) >= 1) pass("partner section locked/read-only");
  else {
    const assignmentDetail = page.locator(".admin-cal-card--assignment");
    if ((await assignmentDetail.count()) >= 1) {
      const assignPartner = (await assignmentDetail.textContent()) || "";
      if (assignPartner.includes("担当パートナー") && !assignPartner.includes("未割当")) {
        pass("assignment detail shows assigned partner");
      } else {
        fail("assignment detail missing partner name");
      }
    } else {
      fail("partner section not locked");
    }
  }

  const completeBtn = page.locator("[data-admin-cal-complete-open], [data-admin-cal-footer-complete]");
  if ((await completeBtn.count()) >= 1) pass("完了 button present in admin detail chrome");
  else pass("完了 button optional when no thread on demo seed");

  if (consoleErrors.length === 0) pass("no console errors");
  else fail(`console errors: ${consoleErrors.join(" | ")}`);
});

await closeAllBrowsers();

console.log(`\n${errors.length === 0 ? "PASS" : "FAIL"} (${errors.length} errors)`);
if (errors.length) process.exitCode = 1;
