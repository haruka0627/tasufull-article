#!/usr/bin/env node
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { mkdirSync } from "fs";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const OUT_DIR = "screenshots/builder-attendance-notify";
const THREAD_ID = "builder_thread_demo_001";
mkdirSync(OUT_DIR, { recursive: true });

await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

async function openNotifyAdminOps() {
  await page.goto(`${BASE}/talk-home.html?tab=notify`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForSelector("[data-talk-notify-mobile-chip]", { timeout: 20000 });
  await page.evaluate(() => {
    document.querySelector('[data-talk-notify-mobile-chip="project"]')?.click();
  });
  await page.waitForTimeout(700);
}

async function findAttendanceNotify(title) {
  return page.evaluate((expectedTitle) => {
    const live = (window.TasuTalkData?.getNotifications?.({ filter: "all" }) || []).find(
      (n) => n.source === "builder-mvp" && n.title === expectedTitle
    );
    const cards = [...document.querySelectorAll("[data-talk-notify-id]")];
    const card =
      (live?.id ? cards.find((el) => el.getAttribute("data-talk-notify-id") === live.id) : null) ||
      cards.find((el) => el.querySelector(".talk-notify-card__title")?.textContent?.trim() === expectedTitle);
    const action = card?.querySelector("[data-talk-notify-action]");
    return {
      found: Boolean(card),
      live: Boolean(live),
      id: card?.getAttribute("data-talk-notify-id") || live?.id || "",
      actionLabel: action?.textContent?.trim() || live?.actionLabel || "",
      href: action?.getAttribute("href") || card?.getAttribute("data-talk-notify-target") || live?.href || "",
      scope: card?.querySelector(".talk-notify-card__scope-chip")?.textContent?.trim() || "",
      source: live?.source || "",
    };
  }, title);
}

const results = [];

for (const { action, title } of [
  { action: "enter", title: "パートナーが現場に入場しました" },
  { action: "leave", title: "パートナーが現場を退場しました" },
]) {
  await page.goto(
    `${BASE}/builder/mvp-thread.html?thread_id=${THREAD_ID}&role=partner`,
    { waitUntil: "domcontentloaded", timeout: 60000 }
  );
  await page.waitForSelector(`[data-builder-mvp-thread-${action}]`, { timeout: 20000 });
  await page.click(`[data-builder-mvp-thread-${action}]`);
  await page.waitForTimeout(800);

  await openNotifyAdminOps();
  await page.screenshot({ path: `${OUT_DIR}/${action}-notify-390.png`, fullPage: true });

  const info = await findAttendanceNotify(title);
  const hrefOk = info.href.includes("mvp-thread.html") && info.href.includes(THREAD_ID);
  const ok =
    info.found &&
    (info.live || info.source === "builder-mvp") &&
    info.actionLabel === "確認する" &&
    hrefOk &&
    info.scope === "Builder運営";
  results.push({ action, title, ok, info });
  console.log(action, ok ? "OK" : "NG", JSON.stringify(info));
}

});
const failed = results.filter((r) => !r.ok);
console.log(`\n結果: ${results.length - failed.length}/${results.length} OK`);
await closeAllBrowsers();
process.exit(failed.length ? 1 : 0);
