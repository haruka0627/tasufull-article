import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8788/live/channel-content.html?talkDev=1&userId=u_me";
const WIDTHS = [1280, 768, 390];

async function openCreatorTab(page) {
  const isMobile = (await page.viewportSize())?.width < 768;
  if (isMobile) {
    await page.click(".tlv-studio-mobile-header__menu");
    await page.waitForTimeout(300);
  }
  await page.evaluate(() => document.querySelector("[data-tlv-studio-settings-open]")?.click());
  await page.waitForSelector("[data-tlv-studio-settings]:not([hidden])");
  await page.click('[data-tlv-studio-settings-section="creator"]');
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
  await openCreatorTab(page);

  const metrics = await page.evaluate(() => {
    const panel = document.querySelector('[data-tlv-studio-settings-panel="creator"]');
    const panels = document.querySelector(".tlv-studio-settings__panels");
    const cards = document.querySelectorAll(".tlv-studio-settings-creator__card");
    const tags = document.querySelectorAll(".tlv-studio-settings-creator__tag");
    const badges = document.querySelectorAll(".tlv-studio-settings-creator__badge");
    const title = document.querySelector(".tlv-studio-settings-creator__card-title");
    const titleStyle = title ? getComputedStyle(title) : null;
    const activeBadge = document.querySelector(".tlv-studio-settings-creator__badge--active");
    const pendingBadge = document.querySelector(".tlv-studio-settings-creator__badge--pending");
    const tagStyle = tags[0] ? getComputedStyle(tags[0]) : null;
    return {
      cardTitles: [...cards].map((c) => c.querySelector(".tlv-studio-settings-creator__card-title")?.textContent?.trim()),
      tagCount: tags.length,
      badgeCount: badges.length,
      activeBadge: activeBadge?.textContent?.trim(),
      pendingBadge: pendingBadge?.textContent?.trim(),
      titleSize: titleStyle ? Math.round(parseFloat(titleStyle.fontSize)) : 0,
      titleWeight: titleStyle?.fontWeight,
      tagMinH: tagStyle?.minHeight,
      panelOverflow: panel ? panel.scrollWidth > panel.clientWidth + 1 : false,
      panelsScrollable: panels ? panels.scrollHeight > panels.clientHeight + 2 : false,
      panelsScrollH: panels ? panels.scrollHeight - panels.clientHeight : 0,
      dialogH: Math.round(document.querySelector(".tlv-studio-settings__dialog")?.getBoundingClientRect().height || 0),
      saveDisabled: document.querySelector("[data-tlv-studio-settings-save]")?.disabled,
    };
  });

  await page.click("[data-tlv-studio-settings-close]");
  await page.waitForTimeout(150);
  const closed = await page.evaluate(() => document.querySelector("[data-tlv-studio-settings]")?.hidden);

  return {
    viewport: width,
    ...metrics,
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
