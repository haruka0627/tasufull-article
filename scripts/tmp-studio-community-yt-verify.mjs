import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8788/live/channel-content.html?talkDev=1&userId=u_me";
const WIDTHS = [1280, 768, 390];

async function openCommunityTab(page) {
  const isMobile = (await page.viewportSize())?.width < 768;
  if (isMobile) {
    await page.click(".tlv-studio-mobile-header__menu");
    await page.waitForTimeout(300);
  }
  await page.evaluate(() => document.querySelector("[data-tlv-studio-settings-open]")?.click());
  await page.waitForSelector("[data-tlv-studio-settings]:not([hidden])");
  await page.click('[data-tlv-studio-settings-section="community"]');
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
  await openCommunityTab(page);

  const metrics = await page.evaluate(() => {
    const panel = document.querySelector('[data-tlv-studio-settings-panel="community"]');
    const panels = document.querySelector(".tlv-studio-settings__panels");
    const grid = document.querySelector(".tlv-studio-settings-community__grid");
    const cards = document.querySelectorAll(".tlv-studio-settings-community__card");
    const gridStyle = grid ? getComputedStyle(grid) : null;
    const cardHeights = [...cards].map((c) => Math.round(c.getBoundingClientRect().height));
    const btns = document.querySelectorAll(".tlv-studio-settings-community__card-btn");
    return {
      desc: panel?.querySelector(".tlv-studio-settings__panel-head-desc")?.textContent?.trim(),
      cardCount: cards.length,
      cardTitles: [...cards].map((c) => c.querySelector(".tlv-studio-settings-community__card-title")?.textContent?.trim()),
      btnCount: btns.length,
      btnLabels: [...btns].map((b) => b.textContent?.trim()),
      gridCols: gridStyle?.gridTemplateColumns,
      panelOverflow: panel ? panel.scrollWidth > panel.clientWidth + 1 : false,
      gridOverflow: grid ? grid.scrollWidth > grid.clientWidth + 1 : false,
      panelsScrollable: panels ? panels.scrollHeight > panels.clientHeight + 2 : false,
      panelsScrollH: panels ? panels.scrollHeight - panels.clientHeight : 0,
      cardHeights,
      scrollbarW: panels ? getComputedStyle(panels).scrollbarWidth : null,
    };
  });

  await page.click('[data-tlv-studio-settings-section="general"]');
  await page.waitForTimeout(80);
  await page.click('[data-tlv-studio-settings-section="community"]');
  await page.waitForTimeout(80);
  const tabOk = await page.evaluate(
    () => !document.querySelector('[data-tlv-studio-settings-panel="community"]')?.hidden,
  );

  await page.click("[data-tlv-studio-settings-close]");
  await page.waitForTimeout(150);
  const closed = await page.evaluate(() => document.querySelector("[data-tlv-studio-settings]")?.hidden);

  return {
    viewport: width,
    ...metrics,
    tabOk,
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
