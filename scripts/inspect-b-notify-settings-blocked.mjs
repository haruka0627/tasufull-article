#!/usr/bin/env node
/** system通知OFF → pipeline(applySettings:true)空 / store有り の再現 */
import { chromium } from "./lib/playwright-browser.mjs";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const EXACT_URL =
  `${BASE}/chat-dual-window-demo.html?talkDev=1&review=chat-demo&demoProfile=skill&demoConnect=0&liveFlow=1&userId=u_hiro&benchViewport=1280&benchPattern=skill-0`;

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext()).newPage();
try {
  await page.goto(EXACT_URL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);

  await page.evaluate(() => {
    const settings = window.TasuTalkNotificationSettings?.read?.() || {};
    settings.types = { ...(settings.types || {}), system: false };
    window.TasuTalkNotificationSettings?.write?.(settings);
    window.TasuPlatformChatDualWindowNotify?.notifyDemoChatStarted?.({
      threadId: "chat-settings-block-test",
      thread: {
        id: "chat-settings-block-test",
        sellerId: "u_sachi",
        buyerId: "u_hiro",
        listingId: "demo-skill-001",
        listingType: "skill",
      },
      payerId: "u_sachi",
    });
  });
  await page.waitForTimeout(1000);

  const audit = await page.evaluate(() => {
    const w = document.getElementById("frame-b-notify")?.contentWindow;
    const doc = w?.document;
    const titles = [...(doc?.querySelectorAll(".talk-notify-card__title") || [])].map((n) =>
      n.textContent?.trim()
    );
    const empty = doc?.querySelector(".talk-notify-empty-state__title")?.textContent?.trim() || null;
    w?.TasuTalkData?.invalidateNotificationsBootstrap?.();
    const strict = w?.TasuTalkData?.getNotifications?.({ filter: "all", applySettings: true }) || [];
    const relaxed = w?.TasuTalkData?.getNotifications?.({ filter: "all", applySettings: false }) || [];
    return { empty, domTitles: titles, strict: strict.map((n) => n.title), relaxed: relaxed.map((n) => n.title) };
  });
  console.log(JSON.stringify(audit, null, 2));
} finally {
  await browser.close();
}
