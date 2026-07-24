#!/usr/bin/env node
/**
 * project-calendar パートナー案件 — 受ける / 受けない フロー
 *
 *   node scripts/verify-builder-project-calendar-partner-accept-decline.mjs
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl, buildLocalPageUrl } from "./lib/dev-server-url.mjs";

const BUILDER_DEMO_PROJECT_ID = "builder_demo_001";
const MVP_KEY = "tasful:builder:mvp:v1";

const base = await findDevServerBaseUrl({ probePath: "builder/project-calendar.html" });
const partnerUrl = buildLocalPageUrl(base, "builder/project-calendar.html?role=partner");
const adminUrl = buildLocalPageUrl(base, "builder/admin-calendar.html");

const errors = [];
const pass = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => {
  errors.push(m);
  console.log(`  ✗ ${m}`);
};

function currentMonthDay10() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-10`;
}

async function resetBuilderDemoPending(page) {
  const currentUrl = page.url();
  if (!currentUrl.includes("127.0.0.1") && !currentUrl.includes("localhost")) {
    await page.goto(partnerUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
  }
  await page.evaluate(
    ({ mvpKey, projectId }) => {
      const mvp = JSON.parse(localStorage.getItem(mvpKey) || "{}");
      const idx = (mvp.projects || []).findIndex((p) => p.project_id === projectId);
      if (idx >= 0) {
        mvp.projects[idx] = {
          ...mvp.projects[idx],
          assignment_status: "pending",
          main_thread_id: mvp.projects[idx].main_thread_id || null,
        };
        localStorage.setItem(mvpKey, JSON.stringify(mvp));
      }
    },
    { mvpKey: MVP_KEY, projectId: BUILDER_DEMO_PROJECT_ID }
  );
}

async function openPartnerEmbed(page) {
  await page.goto(partnerUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.locator('[data-builder-pc-source="partner"]').click();
  const embed = page.locator("[data-builder-cal-partner][data-admin-cal-embed]");
  await embed.locator(".admin-cal-monthHead").waitFor({ state: "visible", timeout: 10000 });
  return embed;
}

async function openPartnerDay10(embed, page) {
  const day10 = currentMonthDay10();
  await embed.locator(`[data-admin-cal-date="${day10}"]`).click();
  await embed.locator('[data-admin-cal-view="day"]').click();
  await page.waitForTimeout(300);
  return day10;
}

console.log("Partner URL:", partnerUrl);
console.log("Admin URL:", adminUrl);

await withPlaywrightBrowser(async (browser) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  // ── 受けない: カレンダーから非表示 ──
  await resetBuilderDemoPending(page);
  let embed = await openPartnerEmbed(page);
  await openPartnerDay10(embed, page);

  const builderBadge = embed
    .locator(".admin-cal-badge")
    .filter({ hasText: "店舗内装リニューアル（Builder）" })
    .first();
  if ((await builderBadge.count()) >= 1) pass("pending builder demo visible on partner calendar");
  else fail("builder demo not on partner calendar (seed missing?)");

  await builderBadge.click();
  await page.waitForTimeout(250);

  const declineBtn = embed.locator("[data-partner-cal-decline]");
  if ((await declineBtn.count()) >= 1) pass("受けない button visible");
  else fail("受けない button missing");

  const beforeDecline = await embed.locator(".admin-cal-badge").count();
  await declineBtn.click();
  await page.waitForTimeout(400);

  const afterDecline = await embed.locator(".admin-cal-badge").count();
  if (afterDecline < beforeDecline) pass(`declined case hidden from partner calendar (${beforeDecline} → ${afterDecline})`);
  else fail(`partner calendar count did not decrease after decline: ${beforeDecline} → ${afterDecline}`);

  const notifCount = await page.evaluate(
    ({ projectId }) => {
      const notifs = JSON.parse(localStorage.getItem("tasful:builder:mvp:notifications:v1") || "[]");
      return notifs.filter(
        (n) =>
          n.type === "request_declined" &&
          (String(n.project_id || "") === projectId || String(n.projectId || "") === projectId)
      ).length;
    },
    { projectId: BUILDER_DEMO_PROJECT_ID }
  );
  if (notifCount >= 1) pass("decline notification queued for ops");
  else fail("no request_declined notification for ops");

  // ── admin: 辞退後は未手配・再手配可能 ──
  await page.goto(adminUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.locator(".admin-cal-monthHead").waitFor({ state: "visible", timeout: 10000 });
  await page.locator(`[data-admin-cal-date="${currentMonthDay10()}"]`).click();
  await page.locator('[data-admin-cal-view="day"]').click();
  await page.waitForTimeout(300);

  const adminBuilderBadge = page
    .locator(".admin-cal-badge--unassigned")
    .filter({ hasText: "店舗内装リニューアル（Builder）" })
    .first();
  if ((await adminBuilderBadge.count()) >= 1) pass("admin calendar shows unassigned badge after decline");
  else fail("admin calendar missing unassigned badge after decline");

  await adminBuilderBadge.click();
  await page.waitForTimeout(300);

  const adminStatus = (await page.locator(".admin-cal-card__status").first().textContent())?.trim() || "";
  if (adminStatus.includes("未手配")) pass(`admin detail status: ${adminStatus}`);
  else fail(`admin status expected 未手配, got: ${adminStatus}`);

  const notifyBtn = page.locator("[data-admin-cal-assign-notify]");
  if ((await notifyBtn.count()) >= 1) pass("admin can re-dispatch (手配して通知 visible)");
  else fail("手配して通知 missing — re-dispatch not available after decline");

  const adminAccept = page.locator("[data-partner-cal-accept], [data-mvp-cal-accept]");
  if ((await adminAccept.count()) === 0) pass("no 受ける/受けない on admin-calendar");
  else fail("accept/decline must not appear on admin-calendar");

  // ── 受ける: 受諾後もカレンダーに残る + admin 手配完了 ──
  await resetBuilderDemoPending(page);
  embed = await openPartnerEmbed(page);
  await openPartnerDay10(embed, page);

  const pendingBadge = embed
    .locator(".admin-cal-badge")
    .filter({ hasText: "店舗内装リニューアル（Builder）" })
    .first();
  await pendingBadge.click();
  await page.waitForTimeout(250);

  const acceptBtn = embed.locator("[data-partner-cal-accept]");
  if ((await acceptBtn.count()) >= 1) pass("受ける button visible");
  else fail("受ける button missing after reset");

  await acceptBtn.click();
  await page.waitForTimeout(500);

  const acceptedStatus = (await embed.locator(".admin-cal-card__status").first().textContent())?.trim() || "";
  if (acceptedStatus.includes("受諾")) pass(`partner detail status after accept: ${acceptedStatus}`);
  else fail(`partner status expected 受諾, got: ${acceptedStatus}`);

  const stillVisible = embed
    .locator(".admin-cal-badge")
    .filter({ hasText: "店舗内装リニューアル（Builder）" });
  if ((await stillVisible.count()) >= 1) pass("accepted case remains on partner calendar");
  else fail("accepted case removed from partner calendar");

  await page.goto(adminUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.locator(".admin-cal-monthHead").waitFor({ state: "visible", timeout: 10000 });
  await page.locator(`[data-admin-cal-date="${currentMonthDay10()}"]`).click();
  await page.locator('[data-admin-cal-view="day"]').click();
  await page.waitForTimeout(300);

  const dispatchBadge = page
    .locator(".admin-cal-badge--dispatch_complete")
    .filter({ hasText: "店舗内装リニューアル（Builder）" })
    .first();
  if ((await dispatchBadge.count()) >= 1) pass("admin calendar dispatch_complete badge after accept");
  else fail("admin missing dispatch_complete after partner accept");

  await dispatchBadge.click();
  await page.waitForTimeout(300);

  const dispatchStatus = (await page.locator(".admin-cal-card__status").first().textContent())?.trim() || "";
  if (dispatchStatus.includes("手配完了")) pass(`admin detail status: ${dispatchStatus}`);
  else fail(`admin status expected 手配完了, got: ${dispatchStatus}`);

  const meta = (await page.locator(".admin-cal-card__meta").first().textContent()) || "";
  if (meta.includes("担当パートナー:") && !meta.includes("未割当")) pass("admin assignee resolved after accept");
  else fail(`admin assignee not resolved: ${meta}`);

  if (consoleErrors.length === 0) pass("no console errors");
  else fail(`console errors: ${consoleErrors.join(" | ")}`);
});

await closeAllBrowsers();

console.log(`\n${errors.length === 0 ? "PASS" : "FAIL"} (${errors.length} errors)`);
if (errors.length) process.exitCode = 1;
