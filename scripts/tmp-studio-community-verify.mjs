import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8788/live/channel-content.html?talkDev=1&userId=u_me";

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: 1280, height: 900 });
await page.goto(BASE, { waitUntil: "networkidle" });
await page.evaluate(() => document.querySelector("[data-tlv-studio-settings-open]")?.click());
await page.waitForSelector("[data-tlv-studio-settings]:not([hidden])");
await page.evaluate(() => document.querySelector('[data-tlv-studio-settings-section="community"]')?.click());
await page.waitForTimeout(200);

const snapshot = await page.evaluate(() => ({
  title: document.querySelector(".tlv-studio-settings-community__title")?.textContent?.trim(),
  sections: [...document.querySelectorAll(".tlv-studio-settings-community__section-title")].map((el) =>
    el.textContent?.trim(),
  ),
  selects: [...document.querySelectorAll("[data-tlv-studio-community-field]")].map((el) => ({
    key: el.getAttribute("data-tlv-studio-community-field"),
    value: el.selectedOptions?.[0]?.textContent?.trim(),
  })),
  ngWords: document.querySelector(".tlv-studio-settings-community__stat")?.textContent?.trim(),
  moderators: [...document.querySelectorAll(".tlv-studio-settings-community__mod-name")].map((el) =>
    el.textContent?.trim(),
  ),
  saveDisabled: document.querySelector("[data-tlv-studio-settings-save]")?.disabled,
}));

await page.selectOption('[data-tlv-studio-community-field="comments"]', "hold");
await page.waitForTimeout(100);
const afterChange = await page.evaluate(() => document.querySelector("[data-tlv-studio-settings-save]")?.disabled);

console.log(JSON.stringify({ snapshot, saveEnabledAfterChange: afterChange === false }, null, 2));
await browser.close();
