import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = "http://127.0.0.1:8788/live/my-videos.html";
const OUT_DIR = path.resolve("scripts/tmp-studio-verify");
const WIDTHS = [390, 768, 1280];

async function verifyWidth(page, width) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`${BASE}?talkDev=1&userId=u_me`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);

  if (width >= 1024) {
    const menu = page.locator(".tlv-videos-topbar__menu, .tlv-videos-drawer__menu-btn").first();
    if (await menu.isVisible()) {
      await menu.click();
      await page.waitForTimeout(500);
    }
    await page.waitForSelector("body.tlv-videos-sidebar-expanded", { timeout: 5000 }).catch(() => {});
  } else {
    const menu = page.locator(".tlv-videos-mobile-menu").first();
    if (await menu.isVisible()) {
      await menu.click();
      await page.waitForTimeout(500);
    }
    await page.waitForSelector(".tlv-videos-drawer--mobile-overlay.is-open", { timeout: 5000 }).catch(() => {});
  }

  await page.waitForSelector("[data-tlv-mypage-sidebar-profile]", { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(300);

  const metrics = await page.evaluate(() => {
    const profile = document.querySelector("[data-tlv-mypage-sidebar-profile]");
    const avatar = profile?.querySelector(".tlv-sidebar-channel-profile__avatar");
    const name = profile?.querySelector("[data-tlv-mypage-profile-name]")?.textContent?.trim() || "";
    const handle = profile?.querySelector("[data-tlv-mypage-profile-handle]")?.textContent?.trim() || "";
    const subs = profile?.querySelector("[data-tlv-mypage-profile-subs]")?.textContent?.trim() || "";
    const avatarRect = avatar?.getBoundingClientRect();
    const uuidFull = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(name);
    const order = profile
      ? [...profile.querySelectorAll(".tlv-sidebar-channel-profile__avatar, .tlv-sidebar-channel-profile__label, .tlv-sidebar-channel-profile__name, .tlv-sidebar-channel-profile__handle, .tlv-sidebar-channel-profile__subs")].map(
          (el) => el.className.split("__").pop()?.split(" ")[0] || el.tagName,
        )
      : [];
    return {
      hasProfile: Boolean(profile),
      avatarW: avatarRect ? Math.round(avatarRect.width) : 0,
      avatarH: avatarRect ? Math.round(avatarRect.height) : 0,
      name,
      handle,
      subs,
      uuidAsName: uuidFull,
      order,
    };
  });

  const shot = path.join(OUT_DIR, `mypage-sidebar-profile-${width}.png`);
  await page.screenshot({ path: shot, fullPage: false });

  return { viewport: width, ...metrics, screenshot: shot };
}

const browser = await chromium.launch();
const page = await browser.newPage();
const consoleErrors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});

const results = [];
for (const width of WIDTHS) {
  results.push(await verifyWidth(page, width));
}

await browser.close();

for (const r of results) {
  console.log(JSON.stringify(r, null, 2));
}
console.log(`\nconsoleErrors: ${consoleErrors.length}`);
if (consoleErrors.length) consoleErrors.forEach((e) => console.log(e));
