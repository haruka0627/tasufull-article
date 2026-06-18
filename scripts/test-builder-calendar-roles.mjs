/**
 * Builderカレンダー / 案件確認 — role別表示 Playwright 検証（390px）
 * 受諾判断は partner-assignment.html（mvp-calendar の旧 accept UI は使用しない）
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl, buildLocalPageUrl } from "./lib/dev-server-url.mjs";

const MVP_KEY = "tasful:builder:mvp:v1";
const PROJECT_ID = "builder_demo_001";
const PARTNER_ID = "demo-partner-001";
const OPS_NOTIFY_ID = "builder-ops-route-001";

const base = await findDevServerBaseUrl({ probePath: "talk-home.html" });
console.log("Base URL:", base);

await withPlaywrightBrowser(async (browser) => {let failed = false;
const fail = (msg) => {
  console.log("NG", msg);
  failed = true;
};
const ok = (msg) => console.log("OK", msg);

function partnerAssignmentInitScript() {
  localStorage.setItem("tasful:builder:mvp:role", "partner");
  localStorage.setItem("tasful:builder:mvp:partner_id", PARTNER_ID);
  try {
    const raw = localStorage.getItem(MVP_KEY);
    if (!raw) return;
    const state = JSON.parse(raw);
    const idx = (state.projects || []).findIndex((p) => p.project_id === PROJECT_ID);
    if (idx >= 0) {
      state.projects[idx].assignment_status = "pending";
      state.projects[idx].selected_partner_ids = [PARTNER_ID];
      state.projects[idx].calendar_assigned_partner_id = PARTNER_ID;
      localStorage.setItem(MVP_KEY, JSON.stringify(state));
    }
  } catch {
    /* ignore */
  }
}

async function auditPartnerCalendar(page) {
  await page.goto(
    buildLocalPageUrl(
      base,
      "builder/mvp-calendar.html",
      `?role=partner&projectId=${PROJECT_ID}&talkDev=1`
    ),
    { waitUntil: "domcontentloaded", timeout: 60000 }
  );
  await page.waitForTimeout(1200);
  return page.evaluate(() => ({
    role: new URLSearchParams(window.location.search).get("role") || "(none)",
    hasLegacyAccept: Boolean(document.querySelector("[data-mvp-cal-accept]")),
    hasPartnerSchedule: Boolean(document.querySelector("[data-mvp-cal-partner-schedule]:not([hidden])")),
    hasOpsLayout: Boolean(document.querySelector("[data-mvp-cal-ops-layout]:not([hidden])")),
    isPartnerBody: document.body.classList.contains("mvp-cal--partner"),
  }));
}

async function auditPartnerAssignment(page, roleQuery = "") {
  await page.addInitScript(partnerAssignmentInitScript);
  await page.goto(
    buildLocalPageUrl(
      base,
      "builder/partner-assignment.html",
      `?role=partner&partnerId=${PARTNER_ID}&projectId=${PROJECT_ID}${roleQuery}&talkDev=1`
    ),
    { waitUntil: "domcontentloaded", timeout: 60000 }
  );
  await page.waitForSelector("[data-partner-assignment-accept]", { timeout: 30000 });
  await page.waitForTimeout(600);
  return page.evaluate(() => ({
    hasAccept: Boolean(document.querySelector("[data-partner-assignment-accept]")),
    hasDecline: Boolean(document.querySelector("[data-partner-assignment-decline]")),
    hasPartnerCard: Boolean(document.querySelector(".mvp-cal-assignment--partner")),
    hasLegacyCalAccept: Boolean(document.querySelector("[data-mvp-cal-accept]")),
    statusText: document.querySelector(".mvp-cal-assignment__status")?.textContent?.trim() || "",
  }));
}

async function auditCalendarAdmin(page, role) {
  await page.goto(
    buildLocalPageUrl(base, "builder/mvp-calendar.html", `?role=${role}&projectId=${PROJECT_ID}`),
    { waitUntil: "domcontentloaded", timeout: 60000 }
  );
  await page.waitForTimeout(1200);
  return page.evaluate(() => ({
    hasAccept: Boolean(document.querySelector("[data-mvp-cal-accept], [data-partner-assignment-accept]")),
    hasDecline: Boolean(document.querySelector("[data-mvp-cal-decline], [data-partner-assignment-decline]")),
    hasAdminChat: Boolean(
      document.querySelector('.mvp-cal-assignment--admin a[href*="mvp-thread"], .mvp-cal-assignment--admin a[href*="thread"]')
    ),
    hasAdminDetail: Boolean(document.querySelector('.mvp-cal-assignment--admin a[href*="mvp-project-detail"]')),
    isAdminPanel: Boolean(document.querySelector(".mvp-cal-assignment--admin")),
    isPartnerPanel: Boolean(document.querySelector(".mvp-cal-assignment--partner")),
  }));
}

// partner calendar — 予定一覧ビュー（旧 accept UI なし）
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const partnerCal = await auditPartnerCalendar(page);
  console.log("partner calendar:", JSON.stringify(partnerCal));
  if (partnerCal.hasLegacyAccept) fail("partner calendar: 旧 data-mvp-cal-accept が残っている");
  else ok("partner calendar: 旧 accept UI なし");
  if (!partnerCal.isPartnerBody) fail("partner calendar: mvp-cal--partner なし");
  else ok("partner calendar: パートナービュー");
  await page.close();
}

// partner-assignment — 受諾
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const before = await auditPartnerAssignment(page);
  console.log("partner assignment:", JSON.stringify(before));
  if (!before.hasAccept || !before.hasDecline) fail("partner assignment: 受ける/受けないなし");
  else ok("partner assignment: 受ける/受けない表示");
  if (before.hasLegacyCalAccept) fail("partner assignment: 旧カレンダー accept が混在");
  else ok("partner assignment: 案件確認UIのみ");

  await page.locator("[data-partner-assignment-accept]").click();
  await page.waitForURL(/mvp-thread\.html/, { timeout: 20000 });
  if (!page.url().includes("mvp-thread.html")) fail(`partner accept: 遷移先 ${page.url()}`);
  else ok("partner accept: スレッドへ遷移");
  await page.close();
}

// worker (= partner calendar view)
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const workerCal = await auditPartnerCalendar(page);
  console.log("worker calendar:", JSON.stringify(workerCal));
  if (workerCal.hasLegacyAccept) fail("worker calendar: 旧 accept UI");
  else ok("worker calendar: 旧 accept UI なし");
  await page.close();
}

// partner-assignment — 辞退ボタン存在（クリック後状態はデモ再シードのため監査対象外）
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const pending = await auditPartnerAssignment(page);
  if (!pending.hasDecline) fail("partner assignment: 受けないボタンなし");
  else ok("partner assignment: 受けないボタン表示（辞退フローは製品側で別途）");
  await page.close();
}

// admin / ops
for (const role of ["admin", "ops"]) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const audit = await auditCalendarAdmin(page, role);
  console.log(`${role}:`, JSON.stringify(audit));
  if (audit.hasAccept || audit.hasDecline) fail(`${role}: 受ける/受けないが表示`);
  else ok(`${role}: 受ける/受けない非表示`);
  if (!audit.isAdminPanel || !audit.hasAdminChat || !audit.hasAdminDetail) fail(`${role}: 管理パネル不足`);
  else ok(`${role}: 管理パネル表示`);
  if (audit.isPartnerPanel) fail(`${role}: パートナーパネルが混在`);
  await page.close();
}

// notify → partner-assignment
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.addInitScript(() => {
    [
      "tasful_talk_notifications",
      "tasful_builder_notify_master_v1",
      "tasful_talk_notifications_seeded_v2",
    ].forEach((k) => localStorage.removeItem(k));
  });
  await page.goto(buildLocalPageUrl(base, "talk-home.html", "?tab=notify&talkDev=1"), {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForSelector(`[data-talk-notify-id="${OPS_NOTIFY_ID}"]`, { timeout: 20000 });
  const deprecatedVisible = await page.locator('[data-talk-notify-id="builder-project-new-001"]').count();
  if (deprecatedVisible > 0) fail("notify: builder-project-new-001 が表示されている");
  else ok("notify: builder-project-new-001 非表示（DEPRECATED）");

  const href = await page.evaluate((id) => {
    const btn = document.querySelector(
      `article[data-talk-notify-id="${id}"] [data-talk-notify-action="navigate"]`
    );
    return btn?.getAttribute("data-talk-notify-href") || "";
  }, OPS_NOTIFY_ID);

  if (!href.includes("partner-assignment.html")) fail(`notify href: ${href}`);
  else ok(`notify → partner-assignment: ${href}`);

  const nav = page.locator(
    `article[data-talk-notify-id="${OPS_NOTIFY_ID}"] [data-talk-notify-action="navigate"]`
  );
  if (await nav.count()) await nav.first().click();
  else await page.locator(`article[data-talk-notify-id="${OPS_NOTIFY_ID}"]`).click();
  await page.waitForURL(/partner-assignment\.html/, { timeout: 20000 });

  const notifyFlow = await page.evaluate((projectId) => ({
    projectInUrl: window.location.href.includes(`projectId=${projectId}`),
    hasAccept: Boolean(document.querySelector("[data-partner-assignment-accept]")),
    hasLegacyCalAccept: Boolean(document.querySelector("[data-mvp-cal-accept]")),
  }), PROJECT_ID);
  console.log("notify flow:", JSON.stringify(notifyFlow));
  if (!notifyFlow.projectInUrl || !notifyFlow.hasAccept) fail("notify flow: 案件確認UIなし");
  else ok("notify flow: partner-assignment で受諾UI表示");
  if (notifyFlow.hasLegacyCalAccept) fail("notify flow: 旧カレンダー accept");
  await page.close();
}

});
await closeAllBrowsers();
process.exit(failed ? 1 : 0);
