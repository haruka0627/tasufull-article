import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8788/live/channel-content.html?talkDev=1&userId=u_me";

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: 1280, height: 900 });
await page.goto(BASE, { waitUntil: "networkidle" });
await page.evaluate(() => document.querySelector("[data-tlv-studio-settings-open]")?.click());
await page.waitForSelector("[data-tlv-studio-settings]:not([hidden])");
await page.evaluate(() => document.querySelector('[data-tlv-studio-settings-section="contract"]')?.click());
await page.waitForTimeout(200);

const snapshot = await page.evaluate(() => ({
  title: document.querySelector(".tlv-studio-settings-contract__title")?.textContent?.trim(),
  cards: [...document.querySelectorAll(".tlv-studio-settings-contract__card-title")].map((el) => el.textContent?.trim()),
  badges: [...document.querySelectorAll(".tlv-studio-settings-contract__badge")].map((el) => el.textContent?.trim()),
  rows: [...document.querySelectorAll(".tlv-studio-settings-contract__row")].map((el) => ({
    label: el.querySelector(".tlv-studio-settings-contract__row-label")?.textContent?.trim(),
    value:
      el.querySelector(".tlv-studio-settings-contract__row-value")?.textContent?.trim() ||
      el.querySelector(".tlv-studio-settings-contract__badge")?.textContent?.trim(),
  })),
  updatedAt: document.querySelector(".tlv-studio-settings-contract__meta-row dd")?.textContent?.trim(),
  buttons: [...document.querySelectorAll("[data-tlv-studio-contract-view-terms], [data-tlv-studio-contract-view-agreement]")].map(
    (el) => el.textContent?.trim(),
  ),
  cardCount: document.querySelectorAll(".tlv-studio-settings-contract__card").length,
}));

console.log(JSON.stringify(snapshot, null, 2));
await browser.close();
