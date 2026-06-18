#!/usr/bin/env node
/**
 * 支払い後チャット — composer 入力 390px 検証
 */
import { devices, withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";

const OUT = path.join("screenshots", "platform-chat-composer-input");
const JOB_ID = "job_demo_full_001";
const POSTER_ID = "u_job_demo_full";

async function resolveDevBase() {
  for (const port of [5174, 5173]) {
    const base = `http://localhost:${port}`;
    try {
      const res = await fetch(`${base}/`, { method: "HEAD" });
      if (res.ok) return base;
    } catch {
      /* next */
    }
  }
  throw new Error("Dev server not reachable");
}

const BASE = await resolveDevBase();
fs.mkdirSync(OUT, { recursive: true });

await withPlaywrightBrowser(async (browser) => {const context = await browser.newContext({
  ...devices["iPhone 13"],
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();
page.on("dialog", async (d) => d.accept());

await page.goto(`${BASE}/talk-home.html?tab=notify&userId=${POSTER_ID}&talkDev=1`, {
  waitUntil: "domcontentloaded",
});
await page.waitForTimeout(300);
await page.evaluate(() => {
  localStorage.removeItem("tasful_chat_threads");
  localStorage.removeItem("tasful_chat_messages");
  localStorage.removeItem("tasful_platform_chat_fees_v1");
});

await page.goto(
  `${BASE}/detail-job.html?id=${JOB_ID}&userId=${POSTER_ID}&talkDev=1&view=applications&from=talk#applications`,
  { waitUntil: "domcontentloaded", timeout: 60000 }
);
await page.waitForFunction(() => document.body.dataset.listingLoaded === "true", { timeout: 45000 });
await page.waitForFunction(() => document.querySelector("[data-job-app-proceed]"), { timeout: 45000 });
await Promise.all([
  page.waitForURL(/platform-chat-fee-pay/, { timeout: 20000 }),
  page.evaluate(() => document.querySelector("[data-job-app-proceed]")?.click()),
]);
await page.click("[data-platform-fee-pay]");
await page.waitForFunction(() => document.querySelector("[data-platform-fee-complete]:not([hidden])"), {
  timeout: 15000,
});
await page.click("[data-platform-fee-chat-link]");
await page.waitForURL(/chat-detail\.html/, { timeout: 20000 });
await page.waitForSelector("#chatInput:not([disabled])", { timeout: 45000 });
await page.waitForTimeout(700);

const before = await page.evaluate(() => {
  const input = document.getElementById("chatInput");
  const tabbar = document.querySelector("[data-tasu-app-tabbar]");
  const inputRect = input?.getBoundingClientRect();
  const tabbarRect = tabbar?.getBoundingClientRect();
  const composer = document.querySelector(".chat-composer");
  const style = composer ? getComputedStyle(composer) : null;
  return {
    url: location.href,
    disabled: input?.disabled ?? true,
    readOnly: input?.readOnly ?? true,
    composerPointerEvents: style?.pointerEvents || "",
    composerBackdrop: style?.backdropFilter || style?.webkitBackdropFilter || "",
    composerZ: style?.zIndex || "",
    ctaAboveTabbar: Boolean(inputRect && tabbarRect && inputRect.bottom <= tabbarRect.top + 2),
  };
});

const input = page.locator("#chatInput");
await input.tap();
await page.waitForTimeout(250);
await input.pressSequentially("了解しました。日程調整お願いします。", { delay: 15 });
const typed = await input.inputValue();
await page.screenshot({ path: path.join(OUT, "01-input-filled-390.png"), fullPage: false });
await page.locator(".chat-composer").screenshot({
  path: path.join(OUT, "03-composer-tabbar-390.png"),
});

await page.locator("#chatSend").tap();
await page.waitForTimeout(1200);

const after = await page.evaluate(() => {
  const input = document.getElementById("chatInput");
  const lastMsg = [...document.querySelectorAll(".chat-msg--me .chat-bubble__text")].pop();
  const inlineErr = document.getElementById("chatInlineError")?.textContent?.trim() || "";
  const alert = document.getElementById("chatAlert")?.textContent?.trim() || "";
  return {
    inputValue: input?.value || "",
    lastMessage: lastMsg?.textContent?.trim() || "",
    inlineErr,
    alert,
    inputDisabled: input?.disabled ?? true,
  };
});

await page.screenshot({ path: path.join(OUT, "02-after-send-390.png"), fullPage: false });
});

const inputOk =
  !before.disabled &&
  !before.readOnly &&
  before.composerPointerEvents !== "none" &&
  typed.includes("了解しました");
const sendOk = after.lastMessage.includes("了解しました") || after.inputValue === "";

const ok = inputOk && sendOk;

console.log(
  JSON.stringify(
    {
      baseUrl: BASE,
      before,
      typed,
      after,
      ok,
      inputOk,
      sendOk,
      screenshots: [
        path.join(OUT, "01-input-filled-390.png"),
        path.join(OUT, "02-after-send-390.png"),
        path.join(OUT, "03-composer-tabbar-390.png"),
      ],
    },
    null,
    2
  )
);
await closeAllBrowsers();
process.exit(ok ? 0 : 1);
