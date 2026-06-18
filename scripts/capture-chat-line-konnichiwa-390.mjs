#!/usr/bin/env node
/**
 * LINE風チャット UI — 「こんにちは」送信フロー 390px スクショ（6枚）
 */
import { chromium, devices } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { requireDevServer, devUrl } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const OUT = path.join("screenshots", "platform-chat-line-konnichiwa");
const CHAT_URL =
  "chat-detail.html?thread=chat-demo-job-hired-001&userId=u_hiro&talkDev=1&from=talk";
const SEND_TEXT = "こんにちは";

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  ...devices["iPhone 13"],
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();
page.on("dialog", async (dialog) => {
  await dialog.accept();
});

async function scrollChatToLatest() {
  await page.evaluate(() => {
    const wrap = document.getElementById("chatMessages");
    if (!wrap) return;
    wrap.scrollTop = wrap.scrollHeight;
    const last =
      [...wrap.querySelectorAll(".chat-msg--me")].at(-1) ||
      [...wrap.querySelectorAll(".chat-msg")].at(-1);
    if (!last) return;
    const wrapRect = wrap.getBoundingClientRect();
    const composerTop =
      document.querySelector(".chat-composer")?.getBoundingClientRect().top ?? wrapRect.bottom;
    const visibleBottom = Math.min(wrapRect.bottom, composerTop) - 10;
    const lastRect = last.getBoundingClientRect();
    if (lastRect.bottom > visibleBottom) {
      wrap.scrollTop += lastRect.bottom - visibleBottom;
    }
  });
}

async function waitChatReady() {
  await page.waitForFunction(
    () => document.body.dataset.chatDetailReady === "true",
    { timeout: 45000 }
  );
  await page.waitForTimeout(600);
  await scrollChatToLatest();
  await page.waitForTimeout(300);
}

async function capture(name) {
  await page.screenshot({ path: path.join(OUT, name) });
}

await page.goto(devUrl(CHAT_URL), { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForFunction(() => window.TasuPlatformChatJobCard?.ensureJobHireNotifyDemo?.(), {
  timeout: 30000,
});
await page.reload({ waitUntil: "domcontentloaded" });
await waitChatReady();
await capture("01-before-input-390.png");

const input = page.locator("#chatInput");
await input.click();
await page.waitForTimeout(250);
await input.fill(SEND_TEXT);
await page.waitForTimeout(350);
await capture("02-typing-konnichiwa-390.png");

await page.click("#chatSend");
await page.waitForTimeout(400);
await page.waitForFunction(
  () => {
    const me = [...document.querySelectorAll(".chat-msg--me")];
    const last = me.at(-1)?.querySelector(".chat-bubble__text")?.textContent || "";
    return last === "こんにちは";
  },
  { timeout: 8000 }
);
await scrollChatToLatest();
await page.waitForTimeout(500);
await capture("03-after-send-390.png");

await page.evaluate(() => {
  const wrap = document.getElementById("chatMessages");
  const peer = [...wrap.querySelectorAll(".chat-msg:not(.chat-msg--me)")].find((el) =>
    el.querySelector(".chat-bubble__text")
  );
  if (wrap && peer) {
    const top =
      peer.offsetTop - Math.max(0, wrap.clientHeight - wrap.clientHeight * 0.62);
    wrap.scrollTop = Math.max(0, top);
  }
});
await page.waitForTimeout(400);
await capture("04-self-right-peer-left-390.png");

const postSendAudit = await page.evaluate((sendText) => {
  const inputEl = document.getElementById("chatInput");
  const meMsgs = [...document.querySelectorAll(".chat-msg--me")];
  const lastMe = meMsgs.at(-1);
  const bubbleText = lastMe?.querySelector(".chat-bubble__text")?.textContent || "";
  const bubbleRect = lastMe?.querySelector(".chat-bubble")?.getBoundingClientRect();
  const themBubbleRect = [...document.querySelectorAll(".chat-msg:not(.chat-msg--me)")]
    .filter((el) => el.querySelector(".chat-bubble__text"))
    .at(-1)
    ?.querySelector(".chat-bubble")
    ?.getBoundingClientRect();
  const viewportW = window.innerWidth;
  return {
    lastMeText: bubbleText,
    textMatchesInput: bubbleText === sendText,
    inputEmptyAfterSend: inputEl ? inputEl.value === "" : null,
    meOnRight: bubbleRect ? bubbleRect.left + bubbleRect.width / 2 > viewportW * 0.55 : null,
    themOnLeft: themBubbleRect ? themBubbleRect.left < viewportW * 0.35 : null,
    themBubbleLeftPx: themBubbleRect ? Math.round(themBubbleRect.left) : null,
    themBubbleWidthPx: themBubbleRect ? Math.round(themBubbleRect.width) : null,
    themBubbleNotVertical: themBubbleRect
      ? themBubbleRect.width > themBubbleRect.height * 0.35
      : null,
    bubbleWidthPx: bubbleRect ? Math.round(bubbleRect.width) : null,
    bubbleNotVertical: bubbleRect ? bubbleRect.width > bubbleRect.height * 0.35 : null,
  };
}, SEND_TEXT);

await input.click();
await input.fill(SEND_TEXT);
await page.evaluate(() => {
  const el = document.getElementById("chatInput");
  el?.focus();
  const existing = document.getElementById("pw-keyboard-demo");
  if (existing) existing.remove();
  const kb = document.createElement("div");
  kb.id = "pw-keyboard-demo";
  kb.setAttribute("aria-hidden", "true");
  kb.style.cssText =
    "position:fixed;left:0;right:0;bottom:0;height:38vh;background:linear-gradient(180deg,#eceff3 0%,#d8dee6 100%);border-top:1px solid #c5ccd6;z-index:40;pointer-events:none;";
  document.body.appendChild(kb);
  const wrap = document.getElementById("chatMessages");
  if (wrap) {
    wrap.scrollTop = wrap.scrollHeight;
    const last = [...wrap.querySelectorAll(".chat-msg--me")].at(-1);
    if (last) {
      const wrapRect = wrap.getBoundingClientRect();
      const composerTop =
        document.querySelector(".chat-composer")?.getBoundingClientRect().top ?? wrapRect.bottom;
      const visibleBottom = Math.min(wrapRect.bottom, composerTop) - 10;
      const lastRect = last.getBoundingClientRect();
      if (lastRect.bottom > visibleBottom) {
        wrap.scrollTop += lastRect.bottom - visibleBottom;
      }
    }
  }
});
await page.waitForTimeout(400);
await capture("05-keyboard-open-390.png");

await page.evaluate(() => {
  document.getElementById("pw-keyboard-demo")?.remove();
});
await input.blur();
await page.waitForTimeout(250);
await scrollChatToLatest();
await page.waitForTimeout(300);
await capture("06-tabbar-visible-390.png");

const audit = await page.evaluate(() => {
  const wrap = document.getElementById("chatMessages");
  const composer = document.querySelector(".chat-composer");
  const tabbar = document.querySelector("[data-tasu-app-tabbar]");
  const composerRect = composer?.getBoundingClientRect();
  const tabbarRect = tabbar?.getBoundingClientRect();
  return {
    scrollBottom:
      wrap && wrap.scrollHeight - wrap.scrollTop - wrap.clientHeight < 16,
    meCount: document.querySelectorAll(".chat-msg--me").length,
    themCount: [...document.querySelectorAll(".chat-msg:not(.chat-msg--me)")].filter((el) =>
      el.querySelector(".chat-bubble__text")
    ).length,
    composerAboveTabbar: Boolean(
      composerRect && tabbarRect && composerRect.bottom <= tabbarRect.top + 2
    ),
    composerTabGapPx:
      composerRect && tabbarRect ? Math.round(tabbarRect.top - composerRect.bottom) : null,
  };
});

const report = {
  generatedAt: new Date().toISOString(),
  baseUrl: BASE,
  chatUrl: devUrl(CHAT_URL),
  sendText: SEND_TEXT,
  audit: { ...audit, ...postSendAudit },
  screenshots: [
    "01-before-input-390.png",
    "02-typing-konnichiwa-390.png",
    "03-after-send-390.png",
    "04-self-right-peer-left-390.png",
    "05-keyboard-open-390.png",
    "06-tabbar-visible-390.png",
  ],
};

fs.writeFileSync(path.join(OUT, "capture-report.json"), JSON.stringify(report, null, 2));
await browser.close();
console.log(JSON.stringify(report, null, 2));

if (!postSendAudit.textMatchesInput) {
  throw new Error(`sent bubble text mismatch: "${postSendAudit.lastMeText}" !== "${SEND_TEXT}"`);
}
if (!postSendAudit.inputEmptyAfterSend) {
  throw new Error("input not cleared after send");
}
if (!postSendAudit.bubbleNotVertical) {
  throw new Error("self bubble appears too narrow (vertical character break)");
}
if (!postSendAudit.themBubbleNotVertical) {
  throw new Error("peer bubble appears too narrow (vertical character break)");
}
if (!audit.composerAboveTabbar) {
  throw new Error("composer overlaps tabbar");
}
if (!postSendAudit.meOnRight) {
  throw new Error("self message not right-aligned");
}
