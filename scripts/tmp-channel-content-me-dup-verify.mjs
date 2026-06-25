#!/usr/bin/env node
/** ME icon count verification — channel-content.html */
import { chromium } from "playwright";

const URL = "http://127.0.0.1:8788/live/channel-content.html?talkDev=1&userId=u_me";
const browser = await chromium.launch();
const consoleErrors = [];

for (const width of [390, 768, 1280]) {
  const page = await browser.newPage();
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(`[${width}] ${m.text()}`);
  });

  await page.setViewportSize({ width, height: 900 });
  await page.goto(URL, { waitUntil: "networkidle", timeout: 120000 });
  await page.evaluate(() => localStorage.removeItem("tlvDevForceGuest"));
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  const data = await page.evaluate(() => {
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.display !== "none" && s.visibility !== "hidden";
    };

    const acctMenus = document.querySelectorAll("[data-tlv-studio-acct-menu]");
    const accts = document.querySelectorAll(".tlv-studio-acct");
    const mobileHeaderAccount = document.querySelectorAll(".tlv-studio-mobile-header__account");
    const visibleTriggers = [...document.querySelectorAll(".tlv-studio-acct__trigger-avatar")].filter(visible);
    const visibleInHeader = [...document.querySelectorAll(".tlv-studio-mobile-header .tlv-studio-acct__trigger-avatar")].filter(visible);
    const visibleInTopbar = [...document.querySelectorAll(".tlv-studio-topbar .tlv-studio-acct__trigger-avatar")].filter(visible);
    const uploadVisible = visible(document.querySelector(".tlv-studio-mobile-header__upload"));

    return {
      acctMenu: acctMenus.length,
      acct: accts.length,
      mobileHeaderAccount: mobileHeaderAccount.length,
      visibleMeTotal: visibleTriggers.length,
      visibleMeMobileHeader: visibleInHeader.length,
      visibleMeTopbar: visibleInTopbar.length,
      uploadVisible,
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      headerChildren: [...document.querySelector(".tlv-studio-mobile-header")?.children || []].map(
        (c) => c.className || c.tagName,
      ),
    };
  });

  console.log(JSON.stringify({ width, ...data }));
  await page.screenshot({
    path: `scripts/tmp-channel-content-me-dup/channel-content-me-${width}.png`,
    fullPage: false,
  });
  await page.close();
}

console.log("consoleErrors", [...new Set(consoleErrors)]);
await browser.close();
