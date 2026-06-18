/**
 * Work report PDF / completion report PDF: thread UI, completion auto-gen, calendar, notifications
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const builder = path.join(root, "builder");
const MVP_KEY = "tasful:builder:mvp:v1";
const NOTIF_KEY = "tasful:builder:mvp:notifications:v1";
const THREAD_ID = "thread-demo-001";
const THREAD_PAGE = `file://${path.join(builder, "mvp-thread.html")}`;
const ADMIN_CAL = `file://${path.join(builder, "admin-calendar.html")}`;
const PARTNER_CAL = `file://${path.join(builder, "mvp-calendar.html")}`;

async function resetThread(page) {
  return page.evaluate(
    ({ key, threadId }) => {
      const state = JSON.parse(localStorage.getItem(key) || "{}");
      const thread = state.threads?.[threadId];
      if (!thread) return false;
      thread.siteData = { photos: [], completed: false, completionConsent: false, completedAt: null };
      thread.status = "open";
      thread.pdf_outputs = (thread.pdf_outputs || []).filter((p) => {
        const k = p.kind || p.type;
        return k !== "work_report" && k !== "completion_report" && k !== "invoice";
      });
      localStorage.setItem(key, JSON.stringify(state));
      const notifs = JSON.parse(localStorage.getItem("tasful:builder:mvp:notifications:v1") || "[]").filter(
        (n) => n.type !== "work_report" && n.type !== "completion_report"
      );
      localStorage.setItem("tasful:builder:mvp:notifications:v1", JSON.stringify(notifs));
      return true;
    },
    { key: MVP_KEY, threadId: THREAD_ID }
  );
}

async function main() {
  await withPlaywrightBrowser(async (browser) => {const context = await browser.newContext();
  const page = await context.newPage();
  page.on("dialog", async (d) => d.accept());

  await page.goto(`${THREAD_PAGE}?thread_id=${THREAD_ID}&role=partner`);
  await page.waitForFunction(
    ({ key, threadId }) => Boolean(JSON.parse(localStorage.getItem(key) || "{}").threads?.[threadId]),
    { key: MVP_KEY, threadId: THREAD_ID }
  );
  const ok = await resetThread(page);
  if (!ok) throw new Error("Demo thread not found");
  await page.reload();
  await page.waitForSelector("[data-builder-mvp-thread-reports]");

  const completionBtn = page.locator('[data-thread-report-generate="completion_report"]');
  if (!(await completionBtn.isDisabled())) throw new Error("Completion report button should be disabled before completion");

  await page.locator('[data-thread-report-generate="work_report"]').click();
  await page.waitForFunction(
    ({ key, threadId }) => {
      const thread = JSON.parse(localStorage.getItem(key) || "{}").threads?.[threadId];
      return (thread?.pdf_outputs || []).some((p) => (p.kind || p.type) === "work_report");
    },
    { key: MVP_KEY, threadId: THREAD_ID }
  );

  const workReport = await page.evaluate(
    ({ key, threadId }) => {
      const thread = JSON.parse(localStorage.getItem(key) || "{}").threads?.[threadId];
      return (thread?.pdf_outputs || []).find((p) => (p.kind || p.type) === "work_report");
    },
    { key: MVP_KEY, threadId: THREAD_ID }
  );
  if (!workReport?.fileName?.includes("作業報告書")) throw new Error("Work report missing fileName");
  if (!(workReport.dataUrl || workReport.url)?.startsWith("data:application/pdf")) {
    throw new Error("Work report missing dataUrl");
  }

  const reportsHtml = await page.locator("[data-builder-mvp-thread-reports]").textContent();
  if (!reportsHtml?.includes("作業報告書")) throw new Error("Reports UI missing work report list");

  const workNotif = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) || "[]").some((n) => n.type === "work_report"),
    NOTIF_KEY
  );
  if (!workNotif) throw new Error("Missing work_report notification");

  await page.locator("[data-builder-mvp-thread-complete-open]").click();
  await page.locator("[data-builder-mvp-thread-complete-consent]").check();
  await page.locator("[data-builder-mvp-thread-complete-form]").evaluate((f) => f.requestSubmit());

  await page.waitForFunction(
    ({ key, threadId }) => {
      const thread = JSON.parse(localStorage.getItem(key) || "{}").threads?.[threadId];
      const outputs = thread?.pdf_outputs || [];
      return (
        thread?.siteData?.completed &&
        outputs.some((p) => (p.kind || p.type) === "invoice") &&
        outputs.some((p) => (p.kind || p.type) === "completion_report")
      );
    },
    { key: MVP_KEY, threadId: THREAD_ID }
  );

  if (await completionBtn.isDisabled()) {
    // re-query after render
  }
  const completionBtnAfter = page.locator('[data-thread-report-generate="completion_report"]');
  if (await completionBtnAfter.isDisabled()) throw new Error("Completion report button should be enabled after completion");

  await completionBtnAfter.click();
  await page.waitForFunction(
    ({ key, threadId }) => {
      const outputs = JSON.parse(localStorage.getItem(key) || "{}").threads?.[threadId]?.pdf_outputs || [];
      return outputs.filter((p) => (p.kind || p.type) === "completion_report").length >= 2;
    },
    { key: MVP_KEY, threadId: THREAD_ID }
  );

  const completionNotif = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) || "[]").filter((n) => n.type === "completion_report").length >= 1,
    NOTIF_KEY
  );
  if (!completionNotif) throw new Error("Missing completion_report notification");

  const adminPage = await context.newPage();
  await adminPage.goto(ADMIN_CAL);
  await adminPage.waitForSelector("[data-admin-cal-grid]");
  const projectTitle = await adminPage.evaluate(
    ({ key, threadId }) => {
      const state = JSON.parse(localStorage.getItem(key) || "{}");
      return (state.projects || []).find((p) => p.main_thread_id === threadId)?.title || "";
    },
    { key: MVP_KEY, threadId: THREAD_ID }
  );
  if (projectTitle) {
    await adminPage.locator(".admin-cal-badge").filter({ hasText: projectTitle }).first().click();
  } else {
    await adminPage.locator(".admin-cal-badge").first().click();
  }
  await adminPage.waitForSelector(".mvp-threadReportsSection");
  const adminDetail = await adminPage.locator("[data-admin-cal-detail]").textContent();
  if (!adminDetail?.includes("作業報告書")) throw new Error("Admin calendar missing work report PDF");
  if (!adminDetail?.includes("完了報告書")) throw new Error("Admin calendar missing completion report PDF");
  if (!adminDetail?.includes("請求書")) throw new Error("Admin calendar missing invoice PDF");

  const calPage = await context.newPage();
  await calPage.goto(`${PARTNER_CAL}?role=partner`);
  await calPage.evaluate(
    ({ key, threadId }) => {
      localStorage.setItem("tasful:builder:mvp:role", "partner");
      localStorage.setItem("tasful:builder:mvp:partner_id", "demo-partner-001");
      const state = JSON.parse(localStorage.getItem(key) || "{}");
      const p = (state.projects || []).find((x) => x.main_thread_id === threadId);
      if (p) {
        p.calendar_assigned_partner_id = "demo-partner-001";
        localStorage.setItem(key, JSON.stringify(state));
      }
    },
    { key: MVP_KEY, threadId: THREAD_ID }
  );
  await calPage.reload();
  await calPage.waitForSelector("[data-builder-mvp-cal-detail]");
  const siteItem = calPage.locator('[data-mvp-cal-item^="site-"]').first();
  if (await siteItem.count()) await siteItem.click();
  const calDetail = await calPage.locator("[data-builder-mvp-cal-detail]").textContent();
  if (!calDetail?.includes("作業報告書")) throw new Error("Partner calendar missing work report PDF");
  if (!calDetail?.includes("請求書")) throw new Error("Partner calendar missing invoice PDF");

  console.log("OK: builder report PDF test passed");
    });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

await closeAllBrowsers();
