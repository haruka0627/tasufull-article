#!/usr/bin/env node
/** fee-pay iframe 経由の chatStarted — 実データ切り分け */
import { chromium } from "./lib/playwright-browser.mjs";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const browser = await chromium.launch({ headless: true });

try {
  const bench = await (await browser.newContext()).newPage({ viewport: { width: 1280, height: 900 } });
  const contactId = "contact-demo-skill-dual-001";

  await bench.goto(
    `${BASE}/chat-dual-window-demo.html?benchPattern=skill-0&liveFlow=1&liveFlowReset=1`,
    { waitUntil: "domcontentloaded" }
  );
  await bench.waitForTimeout(2500);

  const feeUrl =
    `${BASE}/platform-chat-fee-pay.html?contactId=${contactId}&listingId=demo-skill-001&category=skill` +
    `&talkDev=1&review=chat-demo&liveFlow=1&demoProfile=skill&demoConnect=0&userId=u_sachi&from=notify&benchEmbed=1`;

  await bench.locator("#frame-a-chat").evaluate((el, url) => {
    el.src = url;
  }, feeUrl);
  await bench.waitForTimeout(2500);

  const aFrame = bench.frame({ url: /platform-chat-fee-pay/ });
  await aFrame.evaluate((cid) => {
    const C = window.TasuListingContactRequestsStore;
    const now = new Date().toISOString();
    const list = C.readAll().filter((r) => String(r.contact_id) !== cid);
    list.unshift({
      contact_id: cid,
      listing_id: "demo-skill-001",
      listing_type: "skill",
      requester_id: "u_hiro",
      requester_name: "ひろ",
      contact_kind: "purchase",
      status: "awaiting_fee",
      thread_id: null,
      created_at: now,
      updated_at: now,
    });
    localStorage.setItem(C.STORAGE_KEY, JSON.stringify(list));
    window.TasuPlatformChatFee.ensurePendingFeeDeferred({
      listing: C.resolveListing("demo-skill-001"),
      contactId: cid,
      feeAmount: 550,
    });
  }, contactId);

  await aFrame.evaluate(() => {
    window.confirm = () => true;
    document.querySelector("[data-platform-fee-pay]")?.click();
  });

  await bench.waitForTimeout(5000);

  const parentStore = await bench.evaluate(() => {
    const rows = (window.TasuTalkNotifications?.getAll?.() || []).filter((n) =>
      /やりとりが開始/.test(String(n.title || ""))
    );
    return rows.map((n) => ({
      id: n.id,
      title: n.title,
      recipientUserId: n.recipientUserId,
      category: n.category,
      type: n.type,
      createdAt: n.createdAt,
    }));
  });

  const bNotify = bench.frame({ url: /userId=u_hiro.*tab=notify|tab=notify.*userId=u_hiro/ });
  const iframeData = bNotify
    ? await bNotify.evaluate(() => {
        window.TasuTalkData?.invalidateNotificationsBootstrap?.();
        const pipeline = window.TasuTalkData?.getNotifications?.({ filter: "all", applySettings: false }) || [];
        const filtered =
          window.TasuTalkJobFullReviewMode?.filterJobFullReviewNotifications?.(pipeline) || pipeline;
        const started = filtered.filter((n) => /やりとりが開始/.test(n.title || ""));
        const dom = [...document.querySelectorAll(".talk-notify-card")];
        return {
          getNotificationsCount: pipeline.length,
          filteredCount: filtered.length,
          filteredStartedCount: started.length,
          domCardCount: dom.length,
          emptyState: document.querySelector(".talk-notify-empty-state__title")?.textContent?.trim() || null,
          started: started.map((n) => ({
            id: n.id,
            title: n.title,
            recipientUserId: n.recipientUserId,
            category: n.category,
            type: n.type,
            createdAt: n.createdAt,
          })),
        };
      })
    : null;

  console.log("=== fee-pay path: parent store ===");
  console.log(JSON.stringify(parentStore, null, 2));
  console.log("\n=== fee-pay path: B上 iframe ===");
  console.log(JSON.stringify(iframeData, null, 2));

  const gen = parentStore.length > 0 && parentStore[0]?.recipientUserId === "u_hiro";
  const render = iframeData && iframeData.domCardCount > 0;
  console.log("\n切り分け:", !gen ? "生成失敗" : !render ? "描画/同期失敗" : "成功");
} finally {
  await browser.close();
}
