/**
 * Admin calendar: site assignment registration (calendarAssignments storage)
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const builder = path.join(root, "builder");
const ASSIGNMENTS_KEY = "tasful:builder:admin:calendarAssignments:v1";
const NOTIF_KEY = "tasful:builder:mvp:notifications:v1";
const ROLE_KEY = "tasful:builder:mvp:role";
const PARTNER_KEY = "tasful:builder:mvp:partner_id";
const ADMIN_CAL = `file://${path.join(builder, "admin-calendar.html")}`;
const PARTNER_CAL = `file://${path.join(builder, "mvp-calendar.html")}`;

const HOUSE_A = "E2E山田様邸";
const HOUSE_B = "E2E佐藤マンション101";
const ADMIN_PARTNER_A = "partner-demo-001";
const ADMIN_PARTNER_B = "partner-demo-002";
const MVP_PARTNER_A = "demo-partner-001";
const MVP_PARTNER_B = "demo-partner-002";

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

async function registerAssignment(page, { houseName, partnerRadioValue, workDate }) {
  await page.locator("[data-admin-cal-assignment-open]").click();
  await page.waitForSelector("[data-admin-cal-assignment-modal]:not([hidden])");
  await page.locator(`input[name="admin-cal-assignment-partner"][value="${partnerRadioValue}"]`).check();
  await page.locator("[data-admin-cal-assignment-house-name]").fill(houseName);
  await page.locator("[data-admin-cal-assignment-work-date]").fill(workDate);
  await page.locator("[data-admin-cal-assignment-start-time]").fill("09:00");
  await page.locator("[data-admin-cal-assignment-end-time]").fill("17:00");
  await page.locator("[data-admin-cal-assignment-site-address]").fill("埼玉県さいたま市テスト1-2-3");
  await page.locator("[data-admin-cal-assignment-notes]").fill("敷地内駐車不可");
  await page.locator("[data-admin-cal-assignment-form]").evaluate((f) => f.requestSubmit());
}

async function main() {
  await withPlaywrightBrowser(async (browser) => {const context = await browser.newContext();
  const page = await context.newPage();
  page.on("dialog", async (d) => d.accept());

  await page.goto(ADMIN_CAL);
  await page.waitForSelector("[data-admin-cal-assignment-open]");

  await page.evaluate(
    ({ key, houses }) => {
      const rows = JSON.parse(localStorage.getItem(key) || "[]").filter(
        (a) => !houses.includes(a.houseName)
      );
      localStorage.setItem(key, JSON.stringify(rows));
    },
    { key: ASSIGNMENTS_KEY, houses: [HOUSE_A, HOUSE_B] }
  );
  await page.reload();

  const workDate = await page.evaluate(() => {
    const d = new Date();
    d.setDate(d.getDate() + 10);
    return d.toISOString().slice(0, 10);
  });

  await registerAssignment(page, { houseName: HOUSE_A, partnerRadioValue: ADMIN_PARTNER_A, workDate });
  await page.waitForFunction(
    ({ key, house }) => JSON.parse(localStorage.getItem(key) || "[]").some((a) => a.houseName === house),
    { key: ASSIGNMENTS_KEY, house: HOUSE_A }
  );
  await page.waitForSelector(".admin-cal-card--assignment");
  const detailA = await page.locator("[data-admin-cal-detail]").textContent();
  if (!detailA?.includes(HOUSE_A)) throw new Error("Detail missing house A after registration");
  if (!detailA?.includes("埼玉")) throw new Error("Detail missing address");
  if (!detailA?.includes("敷地内駐車不可")) throw new Error("Detail missing notes");
  if (!detailA?.includes("担当パートナー")) throw new Error("Detail missing partner info");

  await registerAssignment(page, { houseName: HOUSE_B, partnerRadioValue: ADMIN_PARTNER_B, workDate });
  await page.waitForFunction(
    ({ key, house }) => JSON.parse(localStorage.getItem(key) || "[]").some((a) => a.houseName === house),
    { key: ASSIGNMENTS_KEY, house: HOUSE_B }
  );

  const sameDayCount = await page.evaluate(
    ({ key, date }) => JSON.parse(localStorage.getItem(key) || "[]").filter((a) => a.workDate === date).length,
    { key: ASSIGNMENTS_KEY, date: workDate }
  );
  if (sameDayCount < 2) throw new Error("Expected two assignments on same workDate for different partners");

  const stored = await page.evaluate(
    ({ key, house }) => JSON.parse(localStorage.getItem(key) || "[]").find((a) => a.houseName === house),
    { key: ASSIGNMENTS_KEY, house: HOUSE_A }
  );
  if (!stored?.instructionPdf && stored?.instructionPdf !== null) {
    /* optional pdf ok */
  }
  if (!stored?.siteAddress?.includes("埼玉")) throw new Error("siteAddress not saved");
  if (!stored?.googleMapUrl?.includes("google.com/maps")) throw new Error("googleMapUrl missing");

  const notifA = await page.evaluate(
    ({ notifKey, mvpPartner, house }) => {
      const rows = JSON.parse(localStorage.getItem(notifKey) || "[]");
      return rows.filter(
        (n) =>
          n.type === "calendar_assignment" &&
          (n.recipientPartnerId === mvpPartner || n.to === mvpPartner) &&
          n.body?.includes(house)
      );
    },
    { notifKey: NOTIF_KEY, mvpPartner: MVP_PARTNER_A, house: HOUSE_A }
  );
  if (notifA.length < 1) throw new Error("Notification not sent to partner A");

  const notifBForA = await page.evaluate(
    ({ notifKey, mvpPartner, house }) => {
      const rows = JSON.parse(localStorage.getItem(notifKey) || "[]");
      return rows.filter(
        (n) =>
          n.type === "calendar_assignment" &&
          (n.recipientPartnerId === mvpPartner || n.to === mvpPartner) &&
          n.body?.includes(house)
      );
    },
    { notifKey: NOTIF_KEY, mvpPartner: MVP_PARTNER_B, house: HOUSE_A }
  );
  if (notifBForA.length > 0) throw new Error("Partner B incorrectly notified for partner A assignment");

  const partnerPageA = await context.newPage();
  await partnerPageA.goto(`${PARTNER_CAL}?role=partner`);
  await setPartnerContext(partnerPageA, MVP_PARTNER_A);
  const textA = await partnerPageA.locator("[data-builder-mvp-cal-list]").textContent();
  if (!textA?.includes(HOUSE_A)) throw new Error("Partner A calendar missing assignment");
  if (textA?.includes(HOUSE_B)) throw new Error("Partner A should not see partner B assignment");

  const partnerPageB = await context.newPage();
  await partnerPageB.goto(`${PARTNER_CAL}?role=partner`);
  await setPartnerContext(partnerPageB, MVP_PARTNER_B);
  const textB = await partnerPageB.locator("[data-builder-mvp-cal-list]").textContent();
  if (!textB?.includes(HOUSE_B)) throw new Error("Partner B calendar missing assignment");
  if (textB?.includes(HOUSE_A)) throw new Error("Partner B should not see partner A assignment");

  console.log("OK: admin calendar site assignment test passed");
    });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

await closeAllBrowsers();
