import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8788/live/channel-content.html?talkDev=1&userId=u_me";

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: 1280, height: 900 });
await page.goto(BASE, { waitUntil: "networkidle" });
await page.evaluate(() => document.querySelector("[data-tlv-studio-settings-open]")?.click());
await page.waitForSelector("[data-tlv-studio-settings]:not([hidden])");
await page.evaluate(() => document.querySelector('[data-tlv-studio-settings-section="creator"]')?.click());
await page.waitForTimeout(200);

const snapshot = await page.evaluate(() => ({
  title: document.querySelector(".tlv-studio-settings-creator__title")?.textContent?.trim(),
  selects: [...document.querySelectorAll("[data-tlv-studio-creator-field]")].map((el) => ({
    key: el.getAttribute("data-tlv-studio-creator-field"),
    value: el.selectedOptions?.[0]?.textContent?.trim(),
  })),
  checks: [...document.querySelectorAll("[data-tlv-studio-creator-checkbox]")].map((el) => ({
    key: el.getAttribute("data-tlv-studio-creator-checkbox"),
    checked: el.checked,
  })),
  infoList: [...document.querySelectorAll(".tlv-studio-settings-creator__info-list li")].map((el) =>
    el.textContent?.trim(),
  ),
  saveDisabled: document.querySelector("[data-tlv-studio-settings-save]")?.disabled,
}));

await page.selectOption('[data-tlv-studio-creator-field="channelType"]', "creator");
await page.waitForTimeout(100);
const afterChange = await page.evaluate(() => document.querySelector("[data-tlv-studio-settings-save]")?.disabled);

console.log(JSON.stringify({ snapshot, saveEnabledAfterChange: afterChange === false }, null, 2));
await browser.close();
