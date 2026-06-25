import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const WIDTHS = [390, 768, 1280];
const OUT_DIR = path.resolve("scripts/tmp-acct-menu-patch-verify");
fs.mkdirSync(OUT_DIR, { recursive: true });

async function mockAuth(page, loggedIn = true) {
  await page.evaluate((auth) => {
    window.TasuAuthCurrentUser = window.TasuAuthCurrentUser || {};
    window.TasuAuthCurrentUser.getCurrentUser = () =>
      auth
        ? { authenticated: true, talkUserId: "u_me", displayName: "テストユーザー" }
        : { authenticated: false };
  }, loggedIn);
}

async function openViewMenu(page, width) {
  const sel =
    width >= 1024
      ? ".tlv-videos-topbar__end [data-tlv-view-acct-toggle]"
      : ".tlv-mobile-videos-toprow__actions [data-tlv-view-acct-toggle]";
  await page.locator(sel).first().click();
  await page.waitForTimeout(350);
}

async function openStudioMenu(page, width) {
  const sel =
    width >= 1024
      ? "[data-tlv-studio-acct-toggle]"
      : ".tlv-studio-mobile-header [data-tlv-studio-acct-toggle]";
  await page.waitForSelector("[data-tlv-studio-acct-menu]", { timeout: 12000 }).catch(() => {});
  await page.locator(sel).first().click();
  await page.waitForTimeout(350);
}

const browser = await chromium.launch();
const consoleErrors = [];

async function check(pageName, width, fn) {
  const page = await browser.newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(`[${pageName}@${width}] ${msg.text()}`);
  });
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`http://127.0.0.1:8788/live/${pageName}?talkDev=1&userId=u_me`, {
    waitUntil: "networkidle",
  });
  const result = await fn(page, width);
  const overflow = await page.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    vw: window.innerWidth,
  }));
  await page.screenshot({ path: path.join(OUT_DIR, `${pageName.replace(".html", "")}-${width}.png`) });
  await page.close();
  return { page: pageName, width, ...result, overflow };
}

const results = [];

for (const width of WIDTHS) {
  results.push(
    await check("videos.html", width, async (page) => {
      await mockAuth(page, false);
      await openViewMenu(page, width);
      const guest = await page.evaluate(() =>
        [...document.querySelectorAll(".tlv-view-acct__guest-actions a")].map((a) => a.textContent.trim()),
      );
      return { guest, guestOk: guest.includes("ログイン") && guest.includes("アカウント作成") };
    }),
  );
}

for (const width of WIDTHS) {
  results.push(
    await check("videos.html", width, async (page, w) => {
      await mockAuth(page, true);
      await openViewMenu(page, w);
      const labels = await page.evaluate(() =>
        [...document.querySelectorAll(".tlv-view-acct__row-label")].map((el) => el.textContent.trim()),
      );
      const required = ["マイページ", "通知", "チャンネル", "TLV Studio"];
      return { labels, viewOk: required.every((t) => labels.some((l) => l.includes(t))) };
    }),
  );
}

for (const width of WIDTHS) {
  results.push(
    await check("channel-content.html", width, async (page, w) => {
      await mockAuth(page, false);
      await openStudioMenu(page, w);
      const guest = await page.evaluate(() =>
        [...document.querySelectorAll(".tlv-studio-acct__guest-actions a")].map((a) => a.textContent.trim()),
      );
      return { guest, guestOk: guest.includes("ログイン") };
    }),
  );
}

for (const width of WIDTHS) {
  results.push(
    await check("channel-content.html", width, async (page, w) => {
      await mockAuth(page, true);
      await openStudioMenu(page, w);
      const labels = await page.evaluate(() =>
        [...document.querySelectorAll(".tlv-studio-acct__row-label")].map((el) => el.textContent.trim()),
      );
      const required = ["チャンネル", "TLVに戻る", "Studio設定", "アカウントを切り替える", "ログアウト"];
      return { labels, studioOk: required.every((t) => labels.includes(t)) };
    }),
  );
}

// Studio設定 opens modal
{
  const page = await browser.newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(`[studio-settings] ${msg.text()}`);
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("http://127.0.0.1:8788/live/channel-content.html?talkDev=1&userId=u_me", {
    waitUntil: "networkidle",
  });
  await mockAuth(page, true);
  await openStudioMenu(page, 1280);
  await page.locator("[data-tlv-studio-settings-open]").first().click();
  await page.waitForTimeout(400);
  const modalOpen = await page.evaluate(() => ({
    bodyClass: document.body.classList.contains("tlv-studio-settings-open"),
    modalHidden: document.querySelector("[data-tlv-studio-settings]")?.hidden,
  }));
  results.push({ test: "studio-settings-modal", ...modalOpen, settingsOk: modalOpen.bodyClass && modalOpen.modalHidden === false });
  await page.close();
}

// Mypage nav 7 items
for (const width of WIDTHS) {
  results.push(
    await check("my-videos.html", width, async (page) => {
      await page.waitForTimeout(1200);
      const labels = await page.evaluate(() => {
        const shell =
          window.innerWidth >= 1024
            ? document.querySelector(".tlv-desktop-shell")
            : document.querySelector(".tlv-mobile-shell");
        return [...(shell?.querySelectorAll(".tlv-mypage-nav__label") || [])].map((el) => el.textContent.trim());
      });
      const required = ["高く評価した動画", "作成した動画", "オフライン"];
      return { labels, mypageOk: required.every((t) => labels.includes(t)) };
    }),
  );
}

// video-upload studio menu
results.push(
  await check("video-upload.html", 1280, async (page) => {
    await mockAuth(page, true);
    const hasStudio = await page.evaluate(() => Boolean(document.querySelector("[data-tlv-studio-acct-menu]")));
    const hasView = await page.evaluate(() => Boolean(document.querySelector("[data-tlv-view-acct-menu]")));
    return { hasStudio, hasView, uploadContextOk: hasStudio && !hasView };
  }),
);

// notifications page
results.push(
  await check("notifications.html", 1280, async (page) => {
    const title = await page.evaluate(() => document.querySelector(".live-empty__title")?.textContent?.trim());
    return { notificationsOk: title === "通知はまだありません" };
  }),
);

await browser.close();

for (const r of results) console.log(JSON.stringify(r));
console.log(`\nconsoleErrors: ${consoleErrors.length}`);
if (consoleErrors.length) consoleErrors.forEach((e) => console.log(e));
