import { chromium } from "playwright";
import fs from "fs";

const URL = "http://127.0.0.1:8788/talk-home?tab=chat&talkDev=1";
const dir = "screenshots/talk-brand-purple-trial";
fs.mkdirSync(dir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const res = await page.goto(URL, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForSelector(".talk-line-list__item", { timeout: 30000 });

const tokens = await page.evaluate(() => {
  const root = document.querySelector(".talk-home-page") || document.body;
  const cs = getComputedStyle(root);
  return {
    accent: cs.getPropertyValue("--talk-accent").trim(),
    accentSoft: cs.getPropertyValue("--talk-accent-soft").trim(),
    accentBorder: cs.getPropertyValue("--talk-accent-border").trim(),
  };
});

const firstThread = page.locator("[data-talk-select-thread]").first();
await firstThread.click();
await page.waitForSelector(".talk-line-list__btn.is-active, .talk-line-list__btn[aria-current='true']", {
  timeout: 10000,
});

const activeStyles = await page.evaluate(() => {
  const btn = document.querySelector(".talk-line-list__btn.is-active, .talk-line-list__btn[aria-current='true']");
  const rail = document.querySelector(".talk-line-rail");
  const btnStyle = btn ? getComputedStyle(btn) : null;
  const railStyle = rail ? getComputedStyle(rail) : null;
  return {
    activeBg: btnStyle?.backgroundColor,
    activeShadow: btnStyle?.boxShadow,
    railBg: railStyle?.backgroundColor,
  };
});

const tabStyles = await page.evaluate(() => {
  const tab = document.querySelector(".talk-line-category-tab.is-active");
  const tabStyle = tab ? getComputedStyle(tab) : null;
  return {
    tabColor: tabStyle?.color,
    tabBorder: tabStyle?.borderBottomColor,
  };
});

await page.screenshot({ path: `${dir}/talk-chat-purple-1280.png`, fullPage: false });

const rgb = (hex) => {
  const h = hex.replace("#", "");
  const n = parseInt(h, 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};

const checks = {
  httpOk: res?.status() === 200,
  accentToken: tokens.accent.toLowerCase() === "#7c3aed" || tokens.accent === "rgb(124, 58, 237)",
  softToken:
    tokens.accentSoft.toLowerCase() === "#f3e8ff" || tokens.accentSoft === "rgb(243, 232, 255)",
  activeUsesPurpleBg: activeStyles.activeBg === rgb("#F3E8FF"),
  activeHasLeftAccent: /124, 58, 237|124,58,237/.test(activeStyles.activeShadow || ""),
  tabUsesPurple: tabStyles.tabColor === rgb("#7C3AED"),
  railStillNavy: /rgb\(15,|rgb\(17,|rgb\(30,/.test(activeStyles.railBg || ""),
};

const pass = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ pass, checks, tokens, activeStyles, tabStyles }, null, 2));
await browser.close();
process.exitCode = pass ? 0 : 1;
