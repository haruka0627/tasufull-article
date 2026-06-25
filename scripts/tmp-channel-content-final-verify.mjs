#!/usr/bin/env node
/** channel-content.html — mojibake + ME icon verification */
import { chromium } from "playwright";
import fs from "node:fs";

const URL = "http://127.0.0.1:8788/live/channel-content.html?talkDev=1&userId=u_me";
const BAD = ["\uFFFD", "作E", "作E", "チャンネルE検索", "コンチEチE", "EE/a", "E/h1", "作", "冁E"];
const OUT = "scripts/tmp-channel-content-final-verify";
fs.mkdirSync(OUT, { recursive: true });

// Source file sanity
const src = fs.readFileSync("live/channel-content.html", "utf8");
const dist = fs.readFileSync("deploy/cloudflare/dist/live/channel-content.html", "utf8");
const srcBad = BAD.filter((s) => src.includes(s));
const distBad = BAD.filter((s) => dist.includes(s));

const browser = await chromium.launch();
const consoleErrors = [];
const widths = [];

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

  const data = await page.evaluate((badPatterns) => {
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.display !== "none" && s.visibility !== "hidden";
    };
    const bodyText = document.body.innerText;
    const foundBad = badPatterns.filter((s) => bodyText.includes(s));
    const searchPh = document.querySelector("[data-tlv-studio-search-input]")?.getAttribute("placeholder") || "";
    const createSpan = document.querySelector(".tlv-studio-topbar__create span")?.textContent?.trim() || "";
    const mobileTitle = document.querySelector(".tlv-studio-mobile-header__title")?.textContent?.trim() || "";
    const uploadAria = document.querySelector(".tlv-studio-mobile-header__upload")?.getAttribute("aria-label") || "";
    const uploadText = document.querySelector(".tlv-studio-mobile-header__upload")?.textContent?.trim() || "";

    return {
      acctMenu: document.querySelectorAll("[data-tlv-studio-acct-menu]").length,
      acct: document.querySelectorAll(".tlv-studio-acct").length,
      mobileHeaderAccount: document.querySelectorAll(".tlv-studio-mobile-header__account").length,
      visibleMe: [...document.querySelectorAll(".tlv-studio-acct__trigger-avatar")].filter(visible).length,
      visibleMeMobile: [...document.querySelectorAll(".tlv-studio-mobile-header .tlv-studio-acct__trigger-avatar")].filter(visible).length,
      visibleMeTopbar: [...document.querySelectorAll(".tlv-studio-topbar .tlv-studio-acct__trigger-avatar")].filter(visible).length,
      uploadVisible: visible(document.querySelector(".tlv-studio-mobile-header__upload")),
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      searchPlaceholder: searchPh,
      createLabel: createSpan,
      mobileTitle,
      uploadAria,
      uploadText,
      foundBad,
      title: document.title,
    };
  }, BAD);

  await page.screenshot({ path: `${OUT}/channel-content-${width}.png`, fullPage: false });
  widths.push({ width, ...data });
  await page.close();
}

await browser.close();

console.log(
  JSON.stringify(
    {
      sourceBadPatterns: srcBad,
      distBadPatterns: distBad,
      widths,
      consoleErrorCount: consoleErrors.length,
      consoleErrors: [...new Set(consoleErrors)],
    },
    null,
    2,
  ),
);
