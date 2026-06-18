#!/usr/bin/env node
/**
 * talk-home 通知タブ初期化の計測（review=chat-demo / skill / u_hiro）
 */
import { chromium, devices } from "./lib/playwright-browser.mjs";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const URL =
  `${BASE}/talk-home.html?tab=notify&talkDev=1&review=chat-demo&demoProfile=skill&userId=u_hiro&talkPerf=1`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  ...devices["iPhone 13"],
  viewport: { width: 390, height: 844 },
});

await page.addInitScript(() => {
  window.__tasuTalkConsoleLogCount = 0;
  window.__tasuTalkRafCount = 0;
  window.__tasuTalkIntervalCount = 0;
  const origLog = console.log;
  console.log = (...args) => {
    window.__tasuTalkConsoleLogCount += 1;
    return origLog.apply(console, args);
  };
  const origRaf = window.requestAnimationFrame;
  window.requestAnimationFrame = (cb) => {
    window.__tasuTalkRafCount += 1;
    return origRaf.call(window, cb);
  };
  const origSetInterval = window.setInterval;
  window.setInterval = (...args) => {
    window.__tasuTalkIntervalCount += 1;
    return origSetInterval.apply(window, args);
  };
});

page.on("console", (msg) => {
  const text = msg.text();
  if (text.includes("[TasuTalkPerf]")) console.log(text);
});

const t0 = Date.now();
await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForSelector(".talk-notify-card", { timeout: 30000 });
await page.waitForTimeout(500);

const audit = await page.evaluate(async () => {
  const counts = {
    ensureNotifications: 0,
    syncDemoNotifications: 0,
    getNotifications: 0,
    saveAll: 0,
    notifyChangedEvents: 0,
  };

  const origEnsure = window.TasuTalkData?.ensureNotifications;
  if (origEnsure) {
    window.TasuTalkData.ensureNotifications = function (...args) {
      counts.ensureNotifications += 1;
      return origEnsure.apply(this, args);
    };
  }
  const origGet = window.TasuTalkData?.getNotifications;
  if (origGet) {
    window.TasuTalkData.getNotifications = function (...args) {
      counts.getNotifications += 1;
      return origGet.apply(this, args);
    };
  }
  const Flow = window.TasuPlatformChatDualWindowFlow;
  const origSync = Flow?.syncDemoNotifications;
  if (origSync) {
    Flow.syncDemoNotifications = function (...args) {
      counts.syncDemoNotifications += 1;
      return origSync.apply(this, args);
    };
  }
  const store = window.TasuTalkNotifications;
  const origSave = store?.saveAll;
  if (origSave) {
    store.saveAll = function (...args) {
      counts.saveAll += 1;
      return origSave.apply(this, args);
    };
  }

  const onChange = () => {
    counts.notifyChangedEvents += 1;
  };
  window.addEventListener("tasful-talk-notifications-changed", onChange);

  const tRefresh = performance.now();
  window.TasuTalkHomeUi?.refreshTalkSurfaces?.({ notifyOnly: true });
  const refreshMs = Math.round(performance.now() - tRefresh);

  window.removeEventListener("tasful-talk-notifications-changed", onChange);

  return {
    ...counts,
    refreshMs,
    cards: document.querySelectorAll(".talk-notify-card").length,
    bootstrapped: window.__tasuTalkNotificationsBootstrapped === true,
    chatThreadsLoaded: window.__tasuTalkChatThreadsLoadedProbe === true,
    demoRows: (window.TasuTalkNotifications?.getAll?.() || []).filter(
      (n) => n.source === "platform_chat_demo_v1"
    ).length,
    consoleLogCount: window.__tasuTalkConsoleLogCount || 0,
    rafCount: window.__tasuTalkRafCount || 0,
    intervalCount: window.__tasuTalkIntervalCount || 0,
  };
});

console.log("\n=== talk-home notify profile ===");
console.log("initial wall ms:", Date.now() - t0);
console.log(JSON.stringify(audit, null, 2));

await browser.close();

let failed = false;
if (!audit.bootstrapped) {
  console.log("NG notifications not bootstrapped once");
  failed = true;
}
if (audit.refreshMs > 80) {
  console.log(`NG refreshTalkSurfaces(notifyOnly) slow: ${audit.refreshMs}ms`);
  failed = true;
}
if (audit.syncDemoNotifications > 1) {
  console.log(`NG syncDemoNotifications called ${audit.syncDemoNotifications}x on refresh`);
  failed = true;
}
if (audit.saveAll > 0) {
  console.log(`NG saveAll called ${audit.saveAll}x on refresh (should be 0 when synced)`);
  failed = true;
}
if (audit.getNotifications > 4) {
  console.log(`NG getNotifications called ${audit.getNotifications}x on single refresh`);
  failed = true;
}
if (audit.notifyChangedEvents > 1) {
  console.log(`NG notify-changed events ${audit.notifyChangedEvents} on refresh`);
  failed = true;
}
if (audit.chatThreadsLoaded) {
  console.log("NG chat threads loaded on notify-first tab (should defer)");
  failed = true;
}
if (audit.consoleLogCount > 30) {
  console.log(`NG excessive console.log: ${audit.consoleLogCount}`);
  failed = true;
}

if (failed) process.exit(1);
console.log("\nPROFILE OK");
