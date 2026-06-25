import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const WIDTHS = [390, 768, 1280];
const OUT = path.resolve("scripts/tmp-notifications-verify");
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const consoleErrors = [];
const results = [];

async function withPage(name, fn) {
  const page = await browser.newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(`[${name}] ${msg.text()}`);
  });
  const r = await fn(page);
  await page.close();
  results.push({ name, ...r });
}

for (const width of WIDTHS) {
  await withPage(`logged-in-${width}`, async (page) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("http://127.0.0.1:8788/live/notifications.html?talkDev=1", {
      waitUntil: "networkidle",
    });
    await page.evaluate(() => localStorage.removeItem("tlvDevForceGuest"));
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    const data = await page.evaluate(() => ({
      title: document.querySelector(".tlv-notifications-page__title")?.textContent?.trim(),
      filters: [...document.querySelectorAll(".tlv-notifications-filter")].map((b) => b.textContent.trim()),
      empty: Boolean(document.querySelector(".tlv-notifications-empty")),
      guest: Boolean(document.querySelector(".tlv-notifications-guest")),
      scrollW: document.documentElement.scrollWidth,
      vw: window.innerWidth,
      hasTopbar: Boolean(document.querySelector(".tlv-videos-topbar, .tlv-mobile-videos-toprow")),
      hasSidebar: Boolean(document.querySelector(".tlv-videos-mini-sidebar, .tlv-videos-drawer")),
    }));
    await page.screenshot({ path: path.join(OUT, `notifications-${width}.png`) });
    return {
      ...data,
      ok:
        data.title === "通知" &&
        data.filters.length === 5 &&
        !data.guest &&
        data.scrollW <= data.vw,
    };
  });
}

await withPage("guest-state", async (page) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("http://127.0.0.1:8788/live/notifications.html?talkDev=1", {
    waitUntil: "networkidle",
  });
  await page.evaluate(() => localStorage.setItem("tlvDevForceGuest", "1"));
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  const data = await page.evaluate(() => ({
    guestTitle: document.querySelector(".tlv-notifications-guest__title")?.textContent?.trim(),
    login: [...document.querySelectorAll(".tlv-notifications-guest__actions a")].map((a) => a.textContent.trim()),
  }));
  await page.evaluate(() => localStorage.removeItem("tlvDevForceGuest"));
  return { ...data, ok: data.guestTitle?.includes("ログイン") && data.login.includes("ログイン") };
});

await withPage("account-menu-link", async (page) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("http://127.0.0.1:8788/live/videos.html?talkDev=1", { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.removeItem("tlvDevForceGuest"));
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector(".tlv-videos-topbar__end [data-tlv-view-acct-toggle]", { timeout: 15000 });
  await page.click(".tlv-videos-topbar__end [data-tlv-view-acct-toggle]");
  await page.waitForTimeout(300);
  const notify = await page.evaluate(() => {
    const row = [...document.querySelectorAll(".tlv-view-acct__row")].find((el) =>
      el.textContent.includes("通知"),
    );
    return row?.getAttribute("href") || null;
  });
  return { notifyHref: notify, ok: notify === "notifications.html" };
});

await browser.close();

for (const r of results) console.log(JSON.stringify(r));
console.log(`\nconsoleErrors: ${consoleErrors.length}`);
if (consoleErrors.length) consoleErrors.forEach((e) => console.log(e));
