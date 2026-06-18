/**
 * 「応募がありました」通知 → board-project-detail 遷移の検証＋スクショ
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "screenshots", "builder-apply-notify-verify");
const PORTS = [5173, 5176, 5174, 5199, 5200, 5188];

async function findBaseUrl() {
  for (const port of PORTS) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/talk-home.html?tab=notify`, { method: "HEAD" });
      if (res.ok) return `http://127.0.0.1:${port}`;
    } catch {
      /* next */
    }
  }
  throw new Error("No dev server found");
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const base = await findBaseUrl();
console.log("Base URL:", base);

await withPlaywrightBrowser(async (browser) => {async function captureFlow(viewport, tag) {
  const page = await browser.newPage({ viewport });
  await page.addInitScript(() => {
    [
      "tasful_talk_notifications",
      "tasful_platform_notify_master_v1",
      "tasful_builder_notify_master_v1",
      "tasful_anpi_notify_master_v1",
      "tasful_talk_notifications_seeded_v2",
    ].forEach((k) => localStorage.removeItem(k));
    sessionStorage.clear();
    try {
      localStorage.setItem("tasful_builder_mvp_role", "owner");
    } catch {
      /* ignore */
    }
  });

  await page.goto(`${base}/talk-home.html?tab=notify`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector('[data-talk-notify-id="builder-board-apply-001"]', { timeout: 25000 });
  await page.waitForTimeout(800);

  await page.screenshot({
    path: path.join(OUT_DIR, `01-talk-notify-list-${tag}.png`),
    fullPage: false,
  });

  const notifyMeta = await page.evaluate(() => {
    const card = document.querySelector('[data-talk-notify-id="builder-board-apply-001"]');
    const action = card?.querySelector('[data-talk-notify-action="navigate"]');
    return {
      title: card?.querySelector(".talk-notify-card__title")?.textContent?.trim(),
      actionLabel: action?.textContent?.trim(),
      href: action?.getAttribute("href"),
    };
  });
  console.log(`[${tag}] notify:`, notifyMeta);

  await page.locator('article[data-talk-notify-id="builder-board-apply-001"]').click();
  await page.waitForURL(/board-project-detail\.html/, { timeout: 25000 });
  await page.waitForTimeout(1500);

  const audit = await page.evaluate(() => {
    const url = new URL(window.location.href);
    const appsSection = document.querySelector("[data-builder-board-pd-apps-section]");
    const appList = document.querySelector("[data-builder-mvp-pd-app-list]");
    const selectBtns = [...document.querySelectorAll("[data-builder-board-pd-select]")];
    const rejectBtns = [...document.querySelectorAll("[data-builder-board-pd-reject]")];
    const appItems = [...document.querySelectorAll(".mvp-pd-appItem:not(.mvp-pd-appItem--empty)")];
    return {
      url: window.location.href,
      pathname: url.pathname,
      id: url.searchParams.get("id"),
      view: url.searchParams.get("view"),
      from: url.searchParams.get("from"),
      pageTitle: document.querySelector("[data-builder-mvp-pd-title]")?.textContent?.trim(),
      headerSub: document.querySelector("[data-builder-mvp-pd-sub]")?.textContent?.trim(),
      appsSectionHidden: appsSection?.hidden === true,
      appsSectionVisible: appsSection ? getComputedStyle(appsSection).display !== "none" : false,
      appCount: appItems.length,
      appNames: appItems.map((el) => el.querySelector(".mvp-pd-appItem__name")?.textContent?.trim()),
      selectCount: selectBtns.length,
      rejectCount: rejectBtns.length,
      selectLabels: selectBtns.map((b) => b.textContent?.trim()),
      rejectLabels: rejectBtns.map((b) => b.textContent?.trim()),
      appListHtml: appList?.innerHTML?.slice(0, 400) || "",
      role: window.localStorage?.getItem("tasful_builder_mvp_role"),
      bodyPage: document.body?.dataset?.page,
    };
  });

  console.log(`[${tag}] destination audit:`, JSON.stringify(audit, null, 2));

  await page.screenshot({
    path: path.join(OUT_DIR, `02-board-project-detail-full-${tag}.png`),
    fullPage: true,
  });

  const appsSection = page.locator("[data-builder-board-pd-apps-section]");
  if (await appsSection.count()) {
    await appsSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await page.screenshot({
      path: path.join(OUT_DIR, `03-applications-section-${tag}.png`),
      fullPage: false,
    });
  }

  return { notifyMeta, audit };
}

const pc = await captureFlow({ width: 1280, height: 900 }, "pc1280");
const mobile = await captureFlow({ width: 390, height: 844 }, "mobile390");

});

const report = {
  notification: {
    id: "builder-board-apply-001",
    notifyType: "application_received",
    title: pc.notifyMeta.title,
    actionLabel: pc.notifyMeta.actionLabel,
    href: pc.notifyMeta.href,
  },
  checks: {
    url_has_view_applications: /view=applications/.test(pc.audit.url),
    view_param_value: pc.audit.view,
    applications_section_visible: pc.audit.appsSectionVisible && !pc.audit.appsSectionHidden,
    applicant_count: pc.audit.appCount,
    has_select_buttons: pc.audit.selectCount > 0,
    has_reject_buttons: pc.audit.rejectCount > 0,
    view_param_used_by_page: false,
  },
  pc: pc.audit,
  mobile: mobile.audit,
  screenshots: [
    "screenshots/builder-apply-notify-verify/01-talk-notify-list-pc1280.png",
    "screenshots/builder-apply-notify-verify/02-board-project-detail-full-pc1280.png",
    "screenshots/builder-apply-notify-verify/03-applications-section-pc1280.png",
    "screenshots/builder-apply-notify-verify/01-talk-notify-list-mobile390.png",
    "screenshots/builder-apply-notify-verify/02-board-project-detail-full-mobile390.png",
    "screenshots/builder-apply-notify-verify/03-applications-section-mobile390.png",
  ],
};

fs.writeFileSync(path.join(OUT_DIR, "audit.json"), JSON.stringify(report, null, 2));
console.log("\nReport:", JSON.stringify(report.checks, null, 2));
console.log("Saved audit:", path.join(OUT_DIR, "audit.json"));

await closeAllBrowsers();
