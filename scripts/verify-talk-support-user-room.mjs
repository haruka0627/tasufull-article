import { chromium } from "playwright";

const URL = "http://127.0.0.1:8788/talk-home?tab=chat&talkDev=1";
const SUPPORT_ID = "talk-hub-support";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const consoleErrors = [];
page.on("pageerror", (e) => consoleErrors.push(e.message));

const res = await page.goto(URL, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForSelector(`[data-talk-thread-id="${SUPPORT_ID}"]`, { timeout: 30000 });

const beforeClick = await page.evaluate((supportId) => {
  const support = window.TasuTalkData?.getStaticChatHubCards?.().find((c) => c.id === supportId);
  return {
    href: window.TasuTalkData?.resolveChatTalkHref?.(support || {}),
    external: window.TasuTalkData?.resolveThreadExternalHref?.(support || {}),
  };
}, SUPPORT_ID);

await page.locator(`[data-talk-select-thread][data-talk-thread-id="${SUPPORT_ID}"]`).click();
await page.waitForSelector("[data-talk-line-room-active]:not([hidden])", { timeout: 10000 });

const afterClick = await page.evaluate(() => ({
  url: window.location.href,
  onTroubleCenter: /support-trouble-center\.html/.test(window.location.href),
  peerName: document.querySelector("[data-talk-line-peer-name]")?.textContent?.trim() || "",
  welcome: document.querySelector("[data-talk-line-messages]")?.textContent || "",
  composerVisible: document.querySelector("[data-talk-line-composer]")?.hidden !== true,
  roomActive: document.querySelector("[data-talk-line-room-active]")?.hidden !== true,
}));

await page.screenshot({ path: "screenshots/talk-support-user-room-1280.png" });

const checks = {
  httpOk: res?.status() === 200,
  noConsoleErrors: consoleErrors.length === 0,
  inlineHref: beforeClick.href?.includes("#thread=talk-hub-support"),
  noExternalHref: !beforeClick.external?.includes("support-trouble-center"),
  stayedOnTalkHome: /talk-home/.test(afterClick.url),
  notTroubleCenter: !afterClick.onTroubleCenter,
  peerNameOk: afterClick.peerName === "TASFULサポート",
  welcomeOk: /TASFULサポートです/.test(afterClick.welcome),
  composerVisible: afterClick.composerVisible,
  roomActive: afterClick.roomActive,
};

const pass = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ pass, checks, beforeClick, afterClick, consoleErrors }, null, 2));
await browser.close();
process.exitCode = pass ? 0 : 1;
