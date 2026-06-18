/**
 * 応募者確認 — 検索・フィルター・並び替え UI（390px）
 */
import { chromium } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { BASE_URL, requireDevServer } from "./lib/dev-base-url.mjs";

const OUT_DIR = "screenshots/platform-job-applications-toolbar";
const PAGE_URL =
  `${BASE_URL}/detail-job.html?id=job_demo_full_001&userId=u_job_demo_full&talkDev=1&view=applications&from=talk#applications`;

async function waitApplicationsReady(page) {
  await page.waitForFunction(() => document.body.dataset.listingLoaded === "true", { timeout: 45000 });
  await page.waitForFunction(
    () => {
      const toolbar = document.querySelector("[data-job-applications-toolbar]");
      return Boolean(toolbar && !toolbar.hidden && document.querySelector("[data-job-app-card]:not(.job-app-card--empty)"));
    },
    { timeout: 45000 }
  );
  await page.waitForTimeout(800);
}

async function scrollPanelTop(page) {
  await page.evaluate(() => {
    const section = document.querySelector("[data-job-applications-section]");
    const head = document.querySelector("[data-tasu-mobile-shell-head]");
    const offset = head ? head.getBoundingClientRect().height + 8 : 8;
    if (!section) return;
    const top = Math.max(0, window.scrollY + section.getBoundingClientRect().top - offset);
    window.scrollTo({ top, behavior: "instant" });
  });
  await page.waitForTimeout(400);
}

async function run() {
  await requireDevServer();
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  await page.goto(PAGE_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await waitApplicationsReady(page);
  await scrollPanelTop(page);
  await page.screenshot({ path: path.join(OUT_DIR, "01-default-390.png") });

  const searchInput = page.locator("[data-job-applications-search]");
  await searchInput.fill("Premiere");
  await page.waitForTimeout(400);
  await scrollPanelTop(page);
  await page.screenshot({ path: path.join(OUT_DIR, "02-search-390.png") });

  await searchInput.fill("");
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    window.TasuJobApplicationsStore?.commitReject?.("job_demo_full_001", "job-app-demo-002");
    window.TasuJobDetailApplications?.setListState?.({ filter: "all", query: "", sort: "newest" });
  });
  await page.waitForTimeout(300);
  const rejectedChip = page.locator('[data-job-applications-filter="rejected"]');
  await rejectedChip.click();
  await rejectedChip.evaluate((el) => el.scrollIntoView({ inline: "center", block: "nearest" }));
  await page.waitForTimeout(400);
  await scrollPanelTop(page);
  await page.screenshot({ path: path.join(OUT_DIR, "03-filter-rejected-390.png") });

  await page.evaluate(() => {
    window.TasuJobDetailApplications?.setListState?.({ filter: "all", sort: "name" });
  });
  await page.waitForTimeout(400);
  await scrollPanelTop(page);
  await page.screenshot({ path: path.join(OUT_DIR, "04-sort-name-390.png") });

  const audit = await page.evaluate(() => {
    const cards = [...document.querySelectorAll("[data-job-app-card]:not(.job-app-card--empty)")].map((el) =>
      el.querySelector(".job-app-card__name")?.textContent?.trim()
    );
    return {
      toolbarVisible: !document.querySelector("[data-job-applications-toolbar]")?.hidden,
      searchValue: document.querySelector("[data-job-applications-search]")?.value || "",
      activeFilter:
        document.querySelector("[data-job-applications-filter].is-active")?.getAttribute("data-job-applications-filter") ||
        "",
      sortValue: document.querySelector("[data-job-applications-sort]")?.value || "",
      count: document.querySelector("[data-job-applications-count]")?.textContent?.trim() || "",
      cards,
      workplaceHidden: getComputedStyle(document.querySelector("#section-workplace")).display === "none",
    };
  });

  await browser.close();

  console.log(JSON.stringify(audit, null, 2));
  const errors = [];
  if (!audit.toolbarVisible) errors.push("toolbar hidden");
  if (audit.sortValue !== "name") errors.push(`sort: ${audit.sortValue}`);
  if (audit.activeFilter !== "all") errors.push(`filter at end: ${audit.activeFilter}`);
  if (!audit.count.includes("2")) errors.push(`count: ${audit.count}`);
  if (!audit.workplaceHidden) errors.push("workplace visible");
  if (errors.length) {
    errors.forEach((e) => console.error(`NG: ${e}`));
    process.exit(1);
  }
  console.log("OK — job applications toolbar screenshots captured");
}

await run();
