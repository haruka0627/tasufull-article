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
  await page.setViewportSize({ width, height: 900 });
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);

  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  await openSettings(page);

  const dialogMetrics = await page.evaluate(() => {
    const dialog = document.querySelector(".tlv-studio-settings__dialog");
    const layout = document.querySelector(".tlv-studio-settings__layout");
    const nav = document.querySelector(".tlv-studio-settings__nav");
    const panels = document.querySelector(".tlv-studio-settings__panels");
    const input = document.querySelector(".tlv-studio-settings__input");
    const save = document.querySelector("[data-tlv-studio-settings-save]");
    const overlay = document.querySelector(".tlv-studio-settings__overlay");
    const d = dialog?.getBoundingClientRect();
    const n = nav?.getBoundingClientRect();
    const p = panels?.getBoundingClientRect();
    const inputStyle = input ? getComputedStyle(input) : null;
    const saveStyle = save ? getComputedStyle(save) : null;
    const overlayStyle = overlay ? getComputedStyle(overlay) : null;
    const layoutStyle = layout ? getComputedStyle(layout) : null;
    return {
      dialogW: d ? Math.round(d.width) : 0,
      dialogH: d ? Math.round(d.height) : 0,
      navW: n ? Math.round(n.width) : 0,
      panelW: p ? Math.round(p.width) : 0,
      navRatio: d && n ? Math.round((n.width / d.width) * 100) : 0,
      inputH: inputStyle ? Math.round(parseFloat(inputStyle.height)) : 0,
      saveMinW: saveStyle?.minWidth,
      saveFontWeight: saveStyle?.fontWeight,
      overlayBlur: overlayStyle?.backdropFilter || overlayStyle?.webkitBackdropFilter,
      layoutCols: layoutStyle?.gridTemplateColumns,
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
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
      return {
        visible: panel && !panel.hidden,
        desc: panel?.querySelector(".tlv-studio-settings__panel-head-desc")?.textContent?.trim() || null,
        overflow: panel ? panel.scrollWidth > panel.clientWidth + 1 : false,
      };
    }, id);
  }

  // save button disabled state (default)
  const saveDisabled = await page.evaluate(
    () => document.querySelector("[data-tlv-studio-settings-save]")?.disabled,
  );

  // close works
  await page.click("[data-tlv-studio-settings-close]");
  await page.waitForTimeout(150);
  const closed = await page.evaluate(() => document.querySelector("[data-tlv-studio-settings]")?.hidden);

  return {
    viewport: width,
    ...dialogMetrics,
    tabs,
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
