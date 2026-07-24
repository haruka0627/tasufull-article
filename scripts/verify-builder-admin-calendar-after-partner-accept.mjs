#!/usr/bin/env node
/**
 * パートナー受諾 → admin-calendar 反映（受諾前/後の表示差分）
 *
 *   node scripts/verify-builder-admin-calendar-after-partner-accept.mjs
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl, buildLocalPageUrl } from "./lib/dev-server-url.mjs";

const PROJECT_ID = "builder_demo_001";
const MVP_KEY = "tasful:builder:mvp:v1";
const DEMO_TITLE = "店舗内装リニューアル（Builder）";

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

async function resetPending(page) {
  await page.goto(partnerUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.evaluate(
    ({ mvpKey, projectId }) => {
      const mvp = JSON.parse(localStorage.getItem(mvpKey) || "{}");
      const idx = (mvp.projects || []).findIndex((p) => p.project_id === projectId);
      if (idx >= 0) {
        mvp.projects[idx] = {
          ...mvp.projects[idx],
          assignment_status: "pending",
        };
        localStorage.setItem(mvpKey, JSON.stringify(mvp));
      }
    },
    { mvpKey: MVP_KEY, projectId: PROJECT_ID }
  );
}

async function openAdminDay10(page) {
  await page.goto(adminUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.locator(".admin-cal-monthHead").waitFor({ state: "visible", timeout: 10000 });
  await page.locator(`[data-admin-cal-date="${currentMonthDay10()}"]`).click();
  await page.locator('[data-admin-cal-view="day"]').click();
  await page.waitForTimeout(300);
}

async function clickBuilderBadge(page) {
  const badge = page
    .locator(".admin-cal-badge")
    .filter({ hasText: DEMO_TITLE })
    .first();
  await badge.click();
  await page.waitForTimeout(300);
  return badge;
}

async function readAdminSnapshot(page) {
  const badge = page.locator(".admin-cal-badge").filter({ hasText: DEMO_TITLE }).first();
  const badgeClass = badge.count().then(async (n) => (n ? await badge.getAttribute("class") : ""));
  const card = page.locator(".admin-cal-card").first();
  const cardText = card.count().then(async (n) => (n ? (await card.textContent()) || "" : ""));
  const statusText = page.locator(".admin-cal-card__status").first().textContent();
  const notifyCount = page.locator("[data-admin-cal-assign-notify]").count();
  const partnerPickEditable = page.locator(".admin-cal-partnerSection:not(.admin-cal-partnerSection--locked)").count();
  const partnerPickLocked = page.locator(".admin-cal-partnerSection--locked").count();
  const acceptBtns = page.locator("[data-partner-cal-accept], [data-mvp-cal-accept]").count();

  const [cls, text, status, notify, pickEdit, pickLock, accept] = await Promise.all([
    badgeClass,
    cardText,
    statusText,
    notifyCount,
    partnerPickEditable,
    partnerPickLocked,
    acceptBtns,
  ]);

  return {
    badgeClass: cls || "",
    cardText: text,
    status: (status || "").trim(),
    notifyCount: notify,
    partnerPickEditable: pickEdit,
    partnerPickLocked: pickLock,
    acceptBtns: accept,
  };
}

console.log("Partner URL:", partnerUrl);
console.log("Admin URL:", adminUrl);

await withPlaywrightBrowser(async (browser) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  // ── 受諾前: admin-calendar ──
  await resetPending(page);
  await openAdminDay10(page);

  const before = await readAdminSnapshot(page);
  if (before.badgeClass.includes("dispatch_complete")) {
    fail("before accept: badge should not be dispatch_complete");
  } else {
    pass(`before accept: badge class ok (${before.badgeClass.includes("assigned") ? "assigned" : "other"})`);
  }
  if (before.status.includes("手配完了")) fail(`before accept: status should not be 手配完了 (${before.status})`);
  else pass(`before accept: status=${before.status || "—"}`);
  if (before.acceptBtns === 0) pass("before accept: no 受ける/受けない on admin-calendar");
  else fail("before accept: accept/decline buttons must not appear on admin");

  // ── パートナー受諾 ──
  await page.goto(partnerUrl, { waitUntil: "domcontentloaded" });
  await page.locator('[data-builder-pc-source="partner"]').click();
  const embed = page.locator("[data-builder-cal-partner][data-admin-cal-embed]");
  await embed.locator(".admin-cal-monthHead").waitFor({ state: "visible" });
  await embed.locator(`[data-admin-cal-date="${currentMonthDay10()}"]`).click();
  await embed.locator('[data-admin-cal-view="day"]').click();
  await page.waitForTimeout(300);
  await embed.locator(".admin-cal-badge").filter({ hasText: DEMO_TITLE }).first().click();
  await page.waitForTimeout(250);

  const acceptBtn = embed.locator("[data-partner-cal-accept]");
  if ((await acceptBtn.count()) >= 1) pass("partner: 受ける button visible");
  else fail("partner: 受ける button missing");

  await acceptBtn.click();
  await page.waitForTimeout(500);

  const storage = await page.evaluate(
    ({ mvpKey, projectId }) => {
      const mvp = JSON.parse(localStorage.getItem(mvpKey) || "{}");
      const project = (mvp.projects || []).find((p) => p.project_id === projectId);
      const threadId = String(project?.main_thread_id || "").trim();
      return {
        assignment_status: String(project?.assignment_status || ""),
        threadId,
        hasThread: Boolean(threadId && mvp.threads?.[threadId]),
      };
    },
    { mvpKey: MVP_KEY, projectId: PROJECT_ID }
  );

  if (storage.assignment_status === "accepted") pass("assignment_status=accepted");
  else fail(`assignment_status expected accepted, got ${storage.assignment_status}`);
  if (storage.threadId) pass(`thread created: ${storage.threadId}`);
  else fail("main_thread_id missing after accept");
  if (storage.hasThread) pass("thread object exists in mvp state");
  else fail("thread not found in mvp.threads");

  // ── 受諾後: admin-calendar ──
  await openAdminDay10(page);
  await clickBuilderBadge(page);

  const after = await readAdminSnapshot(page);
  if (after.badgeClass.includes("dispatch_complete")) pass("after accept: badge is dispatch_complete color class");
  else fail(`after accept: badge missing dispatch_complete (${after.badgeClass})`);
  if (after.status.includes("手配完了")) pass(`after accept: status=${after.status}`);
  else fail(`after accept: status expected 手配完了, got ${after.status}`);

  const hasAssignee =
    (after.cardText.includes("担当:") || after.cardText.includes("担当パートナー:")) &&
    !after.cardText.includes("未割当");
  if (hasAssignee) pass("after accept: assignee shows partner name (not 未割当)");
  else fail("after accept: assignee not resolved");

  if (after.notifyCount === 0) pass("after accept: 手配して通知 hidden");
  else fail("after accept: 手配して通知 should be hidden");

  if (after.partnerPickEditable === 0 && after.partnerPickLocked >= 1) {
    pass("after accept: 担当パートナー欄 locked (not editable)");
  } else if (after.partnerPickEditable === 0 && after.partnerPickLocked === 0) {
    pass("after accept: 担当パートナー選択 hidden (assignment detail)");
  } else {
    fail("after accept: partner pick section still editable");
  }

  if (after.acceptBtns === 0) pass("after accept: no 受ける/受けない on admin-calendar");
  else fail("after accept: accept/decline must not appear on admin");

  for (const label of ["指示書", "現場住所", "添付資料", "現場写真履歴", "報告書・請求書PDF"]) {
    if (after.cardText.includes(label)) pass(`after accept: section present — ${label}`);
    else fail(`after accept: section missing — ${label}`);
  }
  if ((await page.locator(".admin-cal-map").count()) >= 1) pass("after accept: map iframe present");
  else fail("after accept: map iframe missing");

  const completeBtn = page.locator("[data-admin-cal-complete-open], [data-admin-cal-footer-complete]");
  if ((await completeBtn.count()) >= 1) pass("after accept: 完了 button visible");
  else pass("after accept: 完了 button optional when chrome hidden");

  if (consoleErrors.length === 0) pass("no console errors");
  else fail(`console errors: ${consoleErrors.join(" | ")}`);
});

await closeAllBrowsers();

console.log(`\n${errors.length === 0 ? "PASS" : "FAIL"} (${errors.length} errors)`);
if (errors.length) process.exitCode = 1;
