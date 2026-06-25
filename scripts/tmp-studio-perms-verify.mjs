import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8788/live/channel-content.html?talkDev=1&userId=u_me";

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: 1280, height: 900 });
const urlBefore = BASE;
await page.goto(BASE, { waitUntil: "networkidle" });
await page.evaluate(() => document.querySelector("[data-tlv-studio-settings-open]")?.click());
await page.waitForSelector("[data-tlv-studio-settings]:not([hidden])");
await page.evaluate(() => document.querySelector('[data-tlv-studio-settings-section="permissions"]')?.click());
await page.waitForTimeout(200);

const snapshot = await page.evaluate(() => ({
  url: location.href,
  title: document.querySelector(".tlv-studio-settings-perms__title")?.textContent?.trim(),
  desc: document.querySelector(".tlv-studio-settings-perms__desc")?.textContent?.includes("チャンネルの権限"),
  invite: !!document.querySelector("[data-tlv-studio-perms-invite]"),
  rows: document.querySelectorAll(".tlv-studio-settings-perms__row").length,
  saveDisabled: document.querySelector("[data-tlv-studio-settings-save]")?.disabled,
  roles: [...document.querySelectorAll(".tlv-studio-settings-perms__row")].map((row) => ({
    name: row.querySelector(".tlv-studio-settings-perms__cell--name")?.textContent?.trim(),
    email: row.querySelector(".tlv-studio-settings-perms__cell--email")?.textContent?.trim(),
    role:
      row.querySelector(".tlv-studio-settings-perms__badge")?.textContent?.trim() ||
      row.querySelector("[data-tlv-studio-perms-role]")?.selectedOptions?.[0]?.textContent?.trim(),
  })),
}));

await page.selectOption('[data-tlv-studio-perms-role="staff"]', "viewer");
await page.waitForTimeout(100);
const afterChange = await page.evaluate(() => document.querySelector("[data-tlv-studio-settings-save]")?.disabled);
await page.click("[data-tlv-studio-settings-save]");
await page.waitForTimeout(100);
const afterSave = await page.evaluate(() => document.querySelector("[data-tlv-studio-settings-save]")?.disabled);

console.log(
  JSON.stringify(
    {
      urlUnchanged: page.url() === urlBefore,
      snapshot,
      saveEnabledAfterChange: afterChange === false,
      saveDisabledAfterSave: afterSave === true,
    },
    null,
    2,
  ),
);

await browser.close();
