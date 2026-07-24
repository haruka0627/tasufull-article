import { chromium } from "playwright";
import fs from "fs";

const URL = "http://127.0.0.1:8788/ai-workspace/";
const dir = "screenshots/ai-workspace-send-button";
fs.mkdirSync(dir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const consoleErrors = [];
page.on("pageerror", (e) => consoleErrors.push(e.message));

const res = await page.goto(URL, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForSelector("[data-ai-chat-input]", { timeout: 30000 });
await page.locator("[data-ai-chat-input]").fill("テスト送信");

const send = page.locator(".ai-ref-composer__send");
await send.waitFor({ state: "visible", timeout: 10000 });

const styles = await page.evaluate(() => {
  const sendBtn = document.querySelector(".ai-ref-composer__send");
  const sendIcon = sendBtn?.querySelector(".material-symbols-outlined");
  const micBtn = document.querySelector("[data-ai-composer-mic]");
  const composer = document.querySelector("[data-ai-composer-frame]");
  const sendStyle = sendBtn ? getComputedStyle(sendBtn) : null;
  const iconStyle = sendIcon ? getComputedStyle(sendIcon) : null;
  const micStyle = micBtn ? getComputedStyle(micBtn) : null;
  const composerStyle = composer ? getComputedStyle(composer) : null;

  return {
    sendBackgroundImage: sendStyle?.backgroundImage ?? null,
    sendBackgroundColor: sendStyle?.backgroundColor ?? null,
    sendColor: sendStyle?.color ?? null,
    sendWidth: sendStyle?.width ?? null,
    sendHeight: sendStyle?.height ?? null,
    sendBorderRadius: sendStyle?.borderRadius ?? null,
    sendBoxShadow: sendStyle?.boxShadow ?? null,
    iconColor: iconStyle?.color ?? null,
    micBackground: micStyle?.background ?? micStyle?.backgroundColor ?? null,
    composerBackground: composerStyle?.backgroundColor ?? null,
  };
});

await send.screenshot({ path: `${dir}/send-button-1280.png` });

const hasPurpleGradient =
  styles.sendBackgroundImage.includes("124, 58, 237") ||
  styles.sendBackgroundImage.includes("7c3aed") ||
  styles.sendBackgroundImage.includes("139, 92, 246") ||
  styles.sendBackgroundImage.includes("8b5cf6");

const checks = {
  httpOk: res?.status() === 200,
  noConsoleErrors: consoleErrors.length === 0,
  sendVisible: true,
  purpleGradient: hasPurpleGradient,
  iconWhite: styles.iconColor === "rgb(255, 255, 255)",
  sizeUnchanged:
    (styles.sendWidth === "42px" && styles.sendHeight === "42px") ||
    (styles.sendWidth === "36px" && styles.sendHeight === "36px"),
  roundShape: styles.sendBorderRadius.includes("999") || parseFloat(styles.sendBorderRadius) >= 20,
  subtleShadow: styles.sendBoxShadow !== "none",
  micNotPurpleGradient: !String(styles.micBackground).includes("124, 58, 237"),
};

const pass = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ pass, checks, styles, consoleErrors }, null, 2));
await browser.close();
process.exitCode = pass ? 0 : 1;
