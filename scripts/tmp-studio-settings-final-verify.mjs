import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8788/live/channel-content.html?talkDev=1&userId=u_me";
const SECTIONS = ["general", "channel", "permissions", "community"];

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: 1280, height: 900 });
await page.goto(BASE, { waitUntil: "networkidle" });
await page.evaluate(() => document.querySelector("[data-tlv-studio-settings-open]")?.click());
await page.waitForSelector("[data-tlv-studio-settings]:not([hidden])");

const dialog = await page.evaluate(() => {
  const el = document.querySelector(".tlv-studio-settings__dialog");
  const r = el?.getBoundingClientRect();
  return { w: Math.round(r?.width || 0), h: Math.round(r?.height || 0) };
});

const tabs = {};
for (const id of SECTIONS) {
  await page.evaluate((sectionId) => {
    document.querySelector(`[data-tlv-studio-settings-section="${sectionId}"]`)?.click();
  }, id);
  await page.waitForTimeout(120);
  tabs[id] = await page.evaluate(() => ({
    title: document.querySelector(".tlv-studio-settings__panel-head-title")?.textContent?.trim(),
    desc: document.querySelector(".tlv-studio-settings__panel-head-desc")?.textContent?.trim(),
    fields: [...document.querySelectorAll(".tlv-studio-settings__field-label")].map((el) => el.textContent?.trim()),
  }));
}

console.log(JSON.stringify({ dialog, tabs }, null, 2));
await browser.close();
