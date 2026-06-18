/**
 * Site photo history: thread, admin calendar, partner calendar, completion, notification
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const builder = path.join(root, "builder");
const MVP_KEY = "tasful:builder:mvp:v1";
const NOTIF_KEY = "tasful:builder:mvp:notifications:v1";
const THREAD_PAGE = `file://${path.join(builder, "mvp-thread.html")}`;
const ADMIN_CAL = `file://${path.join(builder, "admin-calendar.html")}`;
const PARTNER_CAL = `file://${path.join(builder, "mvp-calendar.html")}`;

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on("dialog", async (d) => d.accept());

  const threadId = await page.goto(`${THREAD_PAGE}?thread_id=thread-demo-001&role=partner`).then(() =>
    page.evaluate((key) => {
      const state = JSON.parse(localStorage.getItem(key) || "{}");
      const thread = state.threads?.["thread-demo-001"];
      if (!thread) return null;
      thread.siteData = { photos: [], completed: false, completionConsent: false, completedAt: null };
      if (thread.status === "completed") thread.status = "open";
      localStorage.setItem(key, JSON.stringify(state));
      return "thread-demo-001";
    }, MVP_KEY)
  );

  if (!threadId) throw new Error("Demo thread not found");
  await page.reload();
  await page.waitForSelector("[data-builder-mvp-site-photos]");

  const addPhoto = async (stage, fileName, memo) => {
    await page.locator("[data-site-photo-add]").click();
    await page.waitForSelector("[data-builder-mvp-site-photo-modal]:not([hidden])");
    await page.locator("[data-builder-mvp-site-photo-stage]").selectOption(stage);
    await page.locator("[data-builder-mvp-site-photo-filename]").fill(fileName);
    await page.locator("[data-builder-mvp-site-photo-memo]").fill(memo);
    await page.locator("[data-builder-mvp-site-photo-form]").evaluate((f) => f.requestSubmit());
    await page.waitForFunction(
      () => document.querySelector("[data-builder-mvp-site-photo-modal]")?.hidden === true
    );
  };

  await addPhoto("before", "着工前_玄関.jpg", "玄関前の状態");
  await addPhoto("progress", "施工中_外壁.jpg", "足場設置後");
  await addPhoto("after", "完了後_全体.jpg", "清掃完了");

  const threadPhotos = await page.evaluate((key) => {
    const thread = JSON.parse(localStorage.getItem(key) || "{}").threads?.["thread-demo-001"];
    return thread?.siteData?.photos || [];
  }, MVP_KEY);
  if (threadPhotos.length < 3) throw new Error("Expected 3 site photos in thread.siteData.photos");
  const stages = new Set(threadPhotos.map((p) => p.stage || p.label));
  if (!threadPhotos.some((p) => p.stage === "before" || p.label === "着工前")) throw new Error("Missing before photo");
  if (!threadPhotos.some((p) => p.stage === "progress")) throw new Error("Missing progress photo");
  if (!threadPhotos.some((p) => p.stage === "after")) throw new Error("Missing after photo");

  const threadHtml = await page.locator("[data-builder-mvp-site-photos]").textContent();
  if (!threadHtml?.includes("着工前_玄関.jpg")) throw new Error("Thread UI missing before photo");
  if (!threadHtml?.includes("施工中_外壁.jpg")) throw new Error("Thread UI missing progress photo");

  const notifCount = await page.evaluate((key) => {
    return JSON.parse(localStorage.getItem(key) || "[]").filter((n) => n.type === "site_photo").length;
  }, NOTIF_KEY);
  if (notifCount < 3) throw new Error("Expected site_photo notifications");

  const adminPage = await context.newPage();
  await adminPage.goto(ADMIN_CAL);
  await adminPage.waitForSelector("[data-admin-cal-grid]");
  const projectTitle = await adminPage.evaluate((key) => {
    const state = JSON.parse(localStorage.getItem(key) || "{}");
    return (state.projects || []).find((p) => p.main_thread_id === "thread-demo-001")?.title || "";
  }, MVP_KEY);
  if (projectTitle) {
    await adminPage.locator(".admin-cal-badge").filter({ hasText: projectTitle }).first().click();
  } else {
    await adminPage.locator(".admin-cal-badge").first().click();
  }
  await adminPage.waitForSelector(".builder-sitePhotoSection, .builder-sitePhoto");
  const adminDetail = await adminPage.locator("[data-admin-cal-detail]").textContent();
  if (!adminDetail?.includes("着工前_玄関.jpg")) throw new Error("Admin calendar detail missing site photos");

  const calPage = await context.newPage();
  await calPage.goto(`${PARTNER_CAL}?role=partner`);
  await calPage.evaluate(({ key }) => {
    localStorage.setItem("tasful:builder:mvp:role", "partner");
    localStorage.setItem("tasful:builder:mvp:partner_id", "demo-partner-001");
    const state = JSON.parse(localStorage.getItem(key) || "{}");
    const p = (state.projects || []).find((x) => x.main_thread_id === "thread-demo-001");
    if (p) {
      p.calendar_assigned_partner_id = "demo-partner-001";
      localStorage.setItem(key, JSON.stringify(state));
    }
  }, { key: MVP_KEY });
  await calPage.reload();
  await calPage.waitForSelector("[data-builder-mvp-cal-detail]");
  const siteItem = calPage.locator('[data-mvp-cal-item^="site-"]').first();
  if (await siteItem.count()) await siteItem.click();
  const calDetail = await calPage.locator("[data-builder-mvp-cal-detail]").textContent();
  if (!calDetail?.includes("着工前_玄関.jpg")) throw new Error("Partner calendar detail missing site photos");

  await page.locator("[data-builder-mvp-thread-complete-open]").click();
  await page.locator("[data-builder-mvp-thread-complete-photos]").setInputFiles({
    name: "完了写真.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from("fake"),
  });
  await page.locator("[data-builder-mvp-thread-complete-consent]").check();
  await page.locator("[data-builder-mvp-thread-complete-form]").evaluate((f) => f.requestSubmit());

  await page.waitForFunction((key) => {
    const thread = JSON.parse(localStorage.getItem(key) || "{}").threads?.["thread-demo-001"];
    return thread?.siteData?.completed && thread.siteData.photos?.some((p) => p.fileName === "完了写真.jpg" && p.stage === "after");
  }, MVP_KEY);

  console.log("OK: builder site photo history test passed");
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
