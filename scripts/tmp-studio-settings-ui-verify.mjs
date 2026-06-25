import { chromium } from "playwright";
import path from "node:path";

const BASE = "http://127.0.0.1:8788/live/channel-content.html?talkDev=1&userId=u_me";
const OUT = path.resolve("scripts/tmp-studio-verify");
const WIDTHS = [1280, 768, 390];

async function openSettings(page) {
  const isMobile = await page.evaluate(() => window.innerWidth < 1024);
  if (isMobile) {
    await page.click(".tlv-studio-mobile-header__menu");
    await page.waitForTimeout(350);
  }
  await page.evaluate(() => document.querySelector("[data-tlv-studio-settings-open]")?.click());
  await page.waitForSelector("[data-tlv-studio-settings]:not([hidden])", { timeout: 5000 });
  await page.waitForTimeout(250);
}

async function verifyWidth(page, width) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  const urlBefore = page.url();
  await openSettings(page);

  const metrics = await page.evaluate(() => {
    const dialog = document.querySelector(".tlv-studio-settings__dialog");
    const nav = document.querySelector(".tlv-studio-settings__nav");
    const input = document.querySelector(".tlv-studio-settings__input");
    const save = document.querySelector("[data-tlv-studio-settings-save]");
    const saveStyle = save ? getComputedStyle(save) : null;
    const dRect = dialog?.getBoundingClientRect();
    const navRect = nav?.getBoundingClientRect();
    const inputRect = input?.getBoundingClientRect();
    const bodyFilter = getComputedStyle(document.body).filter;
    const app = document.querySelector(".tlv-studio-app");
    const appOpacity = app ? getComputedStyle(app).opacity : null;
    return {
      dialogW: dRect ? Math.round(dRect.width) : 0,
      dialogH: dRect ? Math.round(dRect.height) : 0,
      navW: navRect ? Math.round(navRect.width) : 0,
      inputH: inputRect ? Math.round(inputRect.height) : 0,
      saveFontWeight: saveStyle?.fontWeight,
      savePadding: saveStyle?.padding,
      bodyFilter,
      appOpacity,
      docScrollW: document.documentElement.scrollWidth,
      viewportW: window.innerWidth,
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    };
  });

  await page.screenshot({ path: path.join(OUT, `studio-settings-ui-${width}.png`) });

  // Tab persistence: switch to channel, close, reopen
  await page.evaluate(() => {
    document.querySelector('[data-tlv-studio-settings-section="channel"]')?.click();
  });
  await page.waitForTimeout(150);
  await page.evaluate(() => document.querySelector("[data-tlv-studio-settings-close]")?.click());
  await page.waitForTimeout(150);
  await openSettings(page);
  const tabRestore = await page.evaluate(() => {
    const active = document.querySelector("[data-tlv-studio-settings-section].is-active");
    const stored = localStorage.getItem("tlv-studio-settings-last-section");
    return {
      active: active?.getAttribute("data-tlv-studio-settings-section"),
      stored,
    };
  });

  return {
    viewport: width,
    urlUnchanged: page.url() === urlBefore,
    ...metrics,
    tabRestore,
  };
}

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});

for (const w of WIDTHS) {
  console.log(JSON.stringify(await verifyWidth(page, w), null, 2));
}
console.log(`consoleErrors: ${errors.length}`);
await browser.close();
