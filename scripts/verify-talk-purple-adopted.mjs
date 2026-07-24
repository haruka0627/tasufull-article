import { chromium } from "playwright";
import fs from "fs";

const URL = "http://127.0.0.1:8788/talk-home?tab=chat&talkDev=1";
const shotDir = "screenshots/talk-brand-purple-adopted";
fs.mkdirSync(shotDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const res = await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector("[data-talk-select-thread]", { timeout: 30000 });

const listDom = await page.evaluate(() => {
  const el = document.querySelector(".talk-line-list__avatar--initials, .talk-line-list__avatar-initials");
  const all = [...document.querySelectorAll("[class*='talk-line-list__avatar']")].slice(0, 6);
  return {
    matched: el?.className || null,
    samples: all.map((n) => n.className),
  };
});

const friend = page.locator("[data-talk-select-thread][data-talk-thread-id='talk-mock-friend-001']");
if ((await friend.count()) > 0) await friend.click();
else await page.locator("[data-talk-select-thread]").first().click();

await page.waitForSelector(".talk-line-room-header__avatar--initials", { timeout: 15000 });
await page.waitForSelector(".talk-line-messages .chat-msg--me .chat-bubble", { timeout: 15000 });

const styles = await page.evaluate(() => {
  const pick = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const s = getComputedStyle(el);
    return {
      selector: sel,
      className: el.className,
      width: Math.round(el.getBoundingClientRect().width),
      height: Math.round(el.getBoundingClientRect().height),
      color: s.color,
      backgroundImage: s.backgroundImage,
      borderColor: s.borderColor,
      boxShadow: s.boxShadow,
    };
  };
  const activeBtn = document.querySelector(".talk-line-list__btn.is-active");
  const tab = document.querySelector(".talk-line-category-tab.is-active");
  const root = getComputedStyle(document.querySelector(".talk-home-page"));
  return {
    listAvatar: pick(".talk-line-list__avatar--initials"),
    headerAvatar: pick(".talk-line-room-header__avatar--initials"),
    meBubble: pick(".talk-line-messages .chat-msg--me .chat-bubble"),
    peerBubble: pick(".talk-line-messages .message-row.peer .chat-bubble"),
    activeBtnBg: activeBtn ? getComputedStyle(activeBtn).backgroundColor : null,
    tabColor: tab ? getComputedStyle(tab).color : null,
    accent: root.getPropertyValue("--talk-accent").trim(),
  };
});

await page.screenshot({ path: `${shotDir}/talk-purple-adopted-1280.png`, fullPage: false });

const hasPurple = (s) =>
  /124,\s*58,\s*237|109,\s*40,\s*217|243,\s*232,\s*255|233,\s*213,\s*255|196,\s*181,\s*253|250,\s*245,\s*255/.test(s || "");
const hasBlue = (s) => /37,\s*99,\s*235|29,\s*78,\s*216|219,\s*234,\s*254|191,\s*219,\s*254/.test(s || "");

const checks = {
  httpOk: res?.status() === 200,
  listAvatarPurple:
    styles.listAvatar?.color === "rgb(109, 40, 217)" && hasPurple(styles.listAvatar?.backgroundImage),
  headerAvatarPurple:
    styles.headerAvatar?.color === "rgb(109, 40, 217)" && hasPurple(styles.headerAvatar?.backgroundImage),
  meBubblePurple: hasPurple(styles.meBubble?.backgroundImage) && styles.meBubble?.borderColor === "rgba(124, 58, 237, 0.24)",
  peerUnchanged: styles.peerBubble?.backgroundImage === "none",
  activeGold: styles.activeBtnBg === "rgb(255, 251, 235)",
  tabGold: styles.tabColor === "rgb(150, 118, 34)",
  accentGold: styles.accent === "#967622",
  noBlueOnTargets:
    !hasBlue(styles.listAvatar?.color) &&
    !hasBlue(styles.listAvatar?.backgroundImage) &&
    !hasBlue(styles.meBubble?.backgroundImage),
};

console.log(JSON.stringify({ pass: Object.values(checks).every(Boolean), checks, listDom, styles, screenshot: `${shotDir}/talk-purple-adopted-1280.png` }, null, 2));
await browser.close();
process.exitCode = Object.values(checks).every(Boolean) ? 0 : 1;
