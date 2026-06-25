import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8788/live/channel-content.html?talkDev=1&userId=u_me";
const WIDTHS = [1280, 768, 390];

async function openSettingsUploadTab(page) {
  const isMobile = (await page.viewportSize())?.width < 768;
  if (isMobile) {
    await page.click(".tlv-studio-mobile-header__menu");
    await page.waitForTimeout(300);
  }
  await page.evaluate(() => document.querySelector("[data-tlv-studio-settings-open]")?.click());
  await page.waitForSelector("[data-tlv-studio-settings]:not([hidden])");
  await page.click('[data-tlv-studio-settings-section="upload-defaults"]');
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
  await openSettingsUploadTab(page);

  const metrics = await page.evaluate(() => {
    const cards = [...document.querySelectorAll(".tlv-studio-settings-upload__card")];
    const heights = cards.map((c) => Math.round(c.getBoundingClientRect().height));
    const badges = document.querySelectorAll(".tlv-studio-settings-upload__card-badge").length;
    const notice = document.querySelector(".tlv-studio-settings-upload__notice")?.textContent?.trim();
    const save = document.querySelector("[data-tlv-studio-settings-save]");
    const saveStyle = save ? getComputedStyle(save) : null;
    const grid = document.querySelector(".tlv-studio-settings-upload__grid");
    const panel = document.querySelector('[data-tlv-studio-settings-panel="upload-defaults"]');
    const firstCard = cards[0];
    const labelStyle = firstCard?.querySelector(".tlv-studio-settings-upload__card-label")
      ? getComputedStyle(firstCard.querySelector(".tlv-studio-settings-upload__card-label"))
      : null;
    const valueStyle = firstCard?.querySelector(".tlv-studio-settings-upload__card-value")
      ? getComputedStyle(firstCard.querySelector(".tlv-studio-settings-upload__card-value"))
      : null;
    return {
      cardCount: cards.length,
      cardHeights: heights,
      heightsUniform: heights.length > 0 && heights.every((h) => h === heights[0]),
      badges,
      notice,
      gridOverflow: grid ? grid.scrollWidth > grid.clientWidth + 1 : false,
      panelOverflow: panel ? panel.scrollWidth > panel.clientWidth + 1 : false,
      cardCursor: firstCard ? getComputedStyle(firstCard).cursor : null,
      cardMinH: firstCard ? getComputedStyle(firstCard).minHeight : null,
      labelSize: labelStyle ? Math.round(parseFloat(labelStyle.fontSize)) : 0,
      valueWeight: valueStyle?.fontWeight,
      saveMinW: saveStyle?.minWidth,
      saveWeight: saveStyle?.fontWeight,
    };
  });

  // hover test on first card
  const hoverOk = await page.evaluate(() => {
    const card = document.querySelector(".tlv-studio-settings-upload__card");
    if (!card) return false;
    card.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    const bg = getComputedStyle(card).backgroundColor;
    card.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
    return bg !== "rgba(0, 0, 0, 0)";
  });

  await page.hover(".tlv-studio-settings-upload__card");
  await page.waitForTimeout(100);
  const hoverBorder = await page.evaluate(() => {
    const card = document.querySelector(".tlv-studio-settings-upload__card");
    return card ? getComputedStyle(card).borderColor : null;
  });

  return {
    viewport: width,
    ...metrics,
    hoverOk,
    hoverBorder,
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
