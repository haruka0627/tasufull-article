import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8788/live/channel-content.html?talkDev=1&userId=u_me";
const WIDTHS = [1280, 768, 390];
const SECTIONS = [
  "general",
  "channel",
  "upload-defaults",
  "permissions",
  "community",
  "creator",
  "contract",
];

async function openSettings(page) {
  const isMobile = (await page.viewportSize())?.width < 768;
  if (isMobile) {
    await page.click(".tlv-studio-mobile-header__menu");
    await page.waitForTimeout(300);
  }
  await page.evaluate(() => document.querySelector("[data-tlv-studio-settings-open]")?.click());
  await page.waitForSelector("[data-tlv-studio-settings]:not([hidden])");
  await page.waitForTimeout(200);
}

async function verifyWidth(page, width) {
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(String(err)));

  await page.setViewportSize({ width, height: 900 });
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);

  await openSettings(page);

  const shell = await page.evaluate(() => {
    const dialog = document.querySelector(".tlv-studio-settings__dialog");
    const navItem = document.querySelector(".tlv-studio-settings__nav-item");
    const title = document.querySelector(".tlv-studio-settings__panel-head-title");
    const footer = document.querySelector(".tlv-studio-settings__footer");
    const d = dialog?.getBoundingClientRect();
    const n = navItem?.getBoundingClientRect();
    const titleStyle = title ? getComputedStyle(title) : null;
    const footerStyle = footer ? getComputedStyle(footer) : null;
    const navStyle = navItem ? getComputedStyle(navItem) : null;
    return {
      dialogW: d ? Math.round(d.width) : 0,
      dialogH: d ? Math.round(d.height) : 0,
      navItemH: n ? Math.round(n.height) : 0,
      titleSize: titleStyle ? Math.round(parseFloat(titleStyle.fontSize)) : 0,
      titleWeight: titleStyle?.fontWeight,
      footerPad: footerStyle?.padding,
      navMinH: navStyle?.minHeight,
    };
  });

  const tabs = {};
  for (const id of SECTIONS) {
    await page.evaluate((sectionId) => {
      document.querySelector(`[data-tlv-studio-settings-section="${sectionId}"]`)?.click();
    }, id);
    await page.waitForTimeout(120);
    tabs[id] = await page.evaluate((sectionId) => {
      const panel = document.querySelector(`[data-tlv-studio-settings-panel="${sectionId}"]`);
      const communityCards = panel?.querySelectorAll(".tlv-studio-settings-community__card")?.length || 0;
      const creatorCards = panel?.querySelectorAll(".tlv-studio-settings-creator__profile-card")?.length || 0;
      const channelCard = !!panel?.querySelector(".tlv-studio-settings-channel__card");
      return {
        visible: panel && !panel.hidden,
        desc: panel?.querySelector(".tlv-studio-settings__panel-head-desc")?.textContent?.trim() || null,
        overflow: panel ? panel.scrollWidth > panel.clientWidth + 1 : false,
        communityCards,
        creatorCards,
        channelCard,
      };
    }, id);
  }

  // community buttons
  await page.evaluate(() => {
    document.querySelector('[data-tlv-studio-settings-section="community"]')?.click();
  });
  await page.waitForTimeout(100);
  let communityBtnOk = false;
  page.once("dialog", async (dialog) => {
    communityBtnOk = dialog.message().includes("今後追加");
    await dialog.accept();
  });
  await page.click("[data-tlv-studio-community-edit-words]");
  await page.waitForTimeout(150);

  const saveDisabled = await page.evaluate(
    () => document.querySelector("[data-tlv-studio-settings-save]")?.disabled,
  );

  await page.click("[data-tlv-studio-settings-close]");
  await page.waitForTimeout(150);
  const closed = await page.evaluate(() => document.querySelector("[data-tlv-studio-settings]")?.hidden);

  return {
    viewport: width,
    ...shell,
    tabs,
    communityBtnOk,
    saveDisabled,
    modalClosed: closed === true,
    consoleErrors,
  };
}

const browser = await chromium.launch();
const page = await browser.newPage();
const results = [];
for (const width of WIDTHS) {
  results.push(await verifyWidth(page, width));
}
await browser.close();
console.log(JSON.stringify(results, null, 2));
