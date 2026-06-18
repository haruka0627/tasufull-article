/**
 * Admin calendar: partner-specific assignment + notification + partner calendar visibility
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const builder = path.join(root, "builder");
const MVP_KEY = "tasful:builder:mvp:v1";
const NOTIF_KEY = "tasful:builder:mvp:notifications:v1";
const ROLE_KEY = "tasful:builder:mvp:role";
const PARTNER_KEY = "tasful:builder:mvp:partner_id";
const ADMIN_CAL = `file://${path.join(builder, "admin-calendar.html")}`;
const PARTNER_CAL = `file://${path.join(builder, "mvp-calendar.html")}`;

const TEST_TITLE = "E2Eカレンダー手配テスト";
const PARTNER_A = "demo-partner-001";
const PARTNER_B = "demo-partner-002";

async function setPartnerContext(page, partnerId) {
  await page.evaluate(
    ({ roleKey, partnerKey, partnerId }) => {
      localStorage.setItem(roleKey, "partner");
      localStorage.setItem(partnerKey, partnerId);
    },
    { roleKey: ROLE_KEY, partnerKey: PARTNER_KEY, partnerId }
  );
  await page.reload();
  await page.waitForSelector("[data-builder-mvp-cal-kpi]");
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on("dialog", async (d) => d.accept());

  await page.goto(ADMIN_CAL);
  await page.waitForSelector("[data-admin-cal-grid]");

  await page.evaluate(
    ({ mvpKey, notifKey, title, partnerA }) => {
      const state = JSON.parse(localStorage.getItem(mvpKey) || "{}");
      state.projects = (state.projects || []).filter((p) => p.title !== title);
      localStorage.setItem(mvpKey, JSON.stringify(state));

      const notifs = JSON.parse(localStorage.getItem(notifKey) || "[]").filter(
        (n) => !(n.type === "calendar_assignment" && (n.projectTitle === title || n.body?.includes(title)))
      );
      localStorage.setItem(notifKey, JSON.stringify(notifs));
    },
    { mvpKey: MVP_KEY, notifKey: NOTIF_KEY, title: TEST_TITLE, partnerA: PARTNER_A }
  );
  await page.reload();
  await page.waitForSelector("[data-admin-cal-add-open]");

  await page.locator("[data-admin-cal-add-open]").click();
  await page.waitForSelector("[data-admin-cal-add-modal]:not([hidden])");

  const testDate = await page.evaluate(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });

  await page.locator("[data-admin-cal-add-title]").fill(TEST_TITLE);
  await page.locator("[data-admin-cal-add-start]").fill(testDate);
  await page.locator("[data-admin-cal-add-end]").fill(testDate);
  await page.locator("[data-admin-cal-add-partner]").selectOption(PARTNER_A);
  await page.locator("[data-admin-cal-add-location]").fill("東京都渋谷区テスト1-1");
  await page.locator("[data-admin-cal-add-instructions]").fill("E2Eテスト用指示書");
  await page.locator("[data-admin-cal-add-form]").evaluate((f) => f.requestSubmit());

  await page.waitForFunction(
    ({ mvpKey, title }) => {
      const state = JSON.parse(localStorage.getItem(mvpKey) || "{}");
      return (state.projects || []).some((p) => p.title === title && p.calendar_assigned_partner_id);
    },
    { mvpKey: MVP_KEY, title: TEST_TITLE }
  );

  const projectMeta = await page.evaluate(
    ({ mvpKey, title, partnerA }) => {
      const state = JSON.parse(localStorage.getItem(mvpKey) || "{}");
      const p = (state.projects || []).find((x) => x.title === title);
      return {
        projectId: p?.project_id || null,
        assigned: p?.calendar_assigned_partner_id || null,
      };
    },
    { mvpKey: MVP_KEY, title: TEST_TITLE, partnerA: PARTNER_A }
  );
  if (projectMeta.assigned !== PARTNER_A) {
    throw new Error(`Expected calendar_assigned_partner_id=${PARTNER_A}, got ${projectMeta.assigned}`);
  }

  const notifCheck = await page.evaluate(
    ({ notifKey, partnerA, partnerB, projectId }) => {
      const rows = JSON.parse(localStorage.getItem(notifKey) || "[]");
      const pid = (n) => n.projectId || n.project_id;
      const match = rows.filter((n) => n.type === "calendar_assignment" && pid(n) === projectId);
      const forA = match.filter((n) => n.to === partnerA);
      const forB = match.filter((n) => n.to === partnerB);
      return {
        count: match.length,
        forA: forA.length,
        forB: forB.length,
        bodyOk: forA.some((n) => /カレンダー/.test(String(n.body || ""))),
      };
    },
    { notifKey: NOTIF_KEY, partnerA: PARTNER_A, partnerB: PARTNER_B, projectId: projectMeta.projectId }
  );
  if (notifCheck.forA < 1) throw new Error("No calendar_assignment notification for assigned partner");
  if (notifCheck.forB > 0) throw new Error("Notification incorrectly sent to other partner");
  if (!notifCheck.bodyOk) throw new Error("Notification body mismatch");

  const partnerPageA = await context.newPage();
  await partnerPageA.goto(`${PARTNER_CAL}?role=partner`);
  await setPartnerContext(partnerPageA, PARTNER_A);
  const textA = await partnerPageA.locator("[data-builder-mvp-cal-list]").textContent();
  if (!textA?.includes(TEST_TITLE)) throw new Error("Assigned partner calendar missing project");

  const partnerPageB = await context.newPage();
  await partnerPageB.goto(`${PARTNER_CAL}?role=partner`);
  await setPartnerContext(partnerPageB, PARTNER_B);
  const textB = await partnerPageB.locator("[data-builder-mvp-cal-list]").textContent();
  if (textB?.includes(TEST_TITLE)) throw new Error("Other partner should not see assigned project");

  const page2 = await context.newPage();
  await page2.goto(ADMIN_CAL);
  await page2.waitForSelector("[data-admin-cal-grid]");
  const synced = await page2.evaluate(
    ({ mvpKey, title }) => {
      const state = JSON.parse(localStorage.getItem(mvpKey) || "{}");
      return (state.projects || []).some((p) => p.title === title);
    },
    { mvpKey: MVP_KEY, title: TEST_TITLE }
  );
  if (!synced) throw new Error("Cross-tab sync: new project not visible in second admin tab");

  await page.waitForSelector("[data-admin-cal-assign-notify]");
  const detailText = await page.locator("[data-admin-cal-detail]").textContent();
  if (!detailText?.includes("担当パートナー選択")) throw new Error("Partner pick section missing");
  if (!detailText?.includes(TEST_TITLE)) {
    await page.locator(".admin-cal-badge").filter({ hasText: TEST_TITLE }).first().click();
    await page.waitForSelector("[data-admin-cal-assign-notify]");
  }

  await page.locator('input[name="admin-cal-partner"][value="' + PARTNER_B + '"]').check();
  await page.locator("[data-admin-cal-assign-notify]").click();

  await page.waitForFunction(
    ({ mvpKey, title, partnerB }) => {
      const state = JSON.parse(localStorage.getItem(mvpKey) || "{}");
      const p = (state.projects || []).find((x) => x.title === title);
      return p?.calendar_assigned_partner_id === partnerB;
    },
    { mvpKey: MVP_KEY, title: TEST_TITLE, partnerB: PARTNER_B }
  );

  await setPartnerContext(partnerPageA, PARTNER_A);
  const textAfterA = await partnerPageA.locator("[data-builder-mvp-cal-list]").textContent();
  if (textAfterA?.includes(TEST_TITLE)) throw new Error("Partner A should lose calendar after reassignment");

  await setPartnerContext(partnerPageB, PARTNER_B);
  const textAfterB = await partnerPageB.locator("[data-builder-mvp-cal-list]").textContent();
  if (!textAfterB?.includes(TEST_TITLE)) throw new Error("Partner B should see calendar after reassignment");

  console.log("OK: admin calendar partner assignment test passed");
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
