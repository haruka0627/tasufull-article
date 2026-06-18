#!/usr/bin/env node
/**
 * chatStarted 後の通知レコードと B上 iframe 参照件数を実データで切り分け
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const browser = await chromium.launch({ headless: true });

try {
  const bench = await (await browser.newContext()).newPage({ viewport: { width: 1280, height: 900 } });
  const contactId = "contact-demo-skill-dual-001";

  await bench.goto(
    `${BASE}/chat-dual-window-demo.html?benchPattern=skill-0&liveFlow=1&liveFlowReset=1&benchViewport=1280`,
    { waitUntil: "domcontentloaded", timeout: 30000 }
  );
  await bench.waitForTimeout(2500);

  const activated = await bench.evaluate((cid) => {
    const Contacts = window.TasuListingContactRequestsStore;
    const now = new Date().toISOString();
    const list = Contacts.readAll().filter((r) => String(r.contact_id) !== cid);
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
    localStorage.setItem(Contacts.STORAGE_KEY, JSON.stringify(list));
    const F = window.TasuPlatformChatFee;
    F.ensurePendingFeeDeferred({
      listing: Contacts.resolveListing("demo-skill-001"),
      contactId: cid,
      feeAmount: 550,
    });
    F.markFeePaid(`deferred:contact:${cid}`, { listingId: "demo-skill-001", feeAmount: 550 });
    const result = F.activateDeferredAfterPayment({ contactId: cid, listingId: "demo-skill-001" });
    if (!result?.ok) throw new Error(result?.reason || "activate_failed");
    const started = window.TasuPlatformChatDualWindowNotify?.notifyDemoChatStarted?.({
      thread: result.thread,
      threadId: result.threadId,
      payerId: "u_sachi",
    });
    return { threadId: result.threadId, notifyResult: started };
  }, contactId);

  await bench.waitForTimeout(2000);

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
      source: n.source,
    }));
  });

  console.log("\n=== PARENT localStorage (chat-started records) ===");
  console.log(JSON.stringify(parentStore, null, 2));
  console.log(`parent chat-started count: ${parentStore.length}`);

  const bNotifyFrame = bench.frame({ url: /userId=u_hiro.*tab=notify|tab=notify.*userId=u_hiro/ });
  if (!bNotifyFrame) {
    console.log("\n=== B上 iframe: NOT FOUND ===");
    process.exit(1);
  }

  await bNotifyFrame.waitForTimeout(1500);

  const iframeData = await bNotifyFrame.evaluate(() => {
    const params = new URLSearchParams(location.search);
    const uid = params.get("userId") || "";
    const rawStore = (() => {
      try {
        return JSON.parse(localStorage.getItem("tasful_talk_notifications") || "[]");
      } catch {
        return [];
      }
    })();
    const chatStartedRaw = rawStore.filter((n) => /やりとりが開始/.test(String(n.title || "")));

    window.TasuTalkData?.invalidateNotificationsBootstrap?.();
    const allOpts = { filter: "all", applySettings: false, showMuted: true };
    const pipeline = window.TasuTalkData?.getNotifications?.(allOpts) || [];
    const filtered = window.TasuTalkJobFullReviewMode?.filterJobFullReviewNotifications?.(pipeline) || pipeline;
    const chatStartedVisible = filtered.filter((n) => /やりとりが開始/.test(String(n.title || "")));

    const domCards = [...document.querySelectorAll(".talk-notify-card")];
    const domStarted = domCards.filter((el) => /やりとりが開始/.test(el.textContent || ""));

    return {
      iframeUserId: uid,
      demoProfile: params.get("demoProfile"),
      review: params.get("review"),
      liveFlow: params.get("liveFlow"),
      benchEmbed: params.get("benchEmbed"),
      rawStoreCount: rawStore.length,
      rawChatStartedCount: chatStartedRaw.length,
      rawChatStarted: chatStartedRaw.map((n) => ({
        id: n.id,
        title: n.title,
        recipientUserId: n.recipientUserId,
        category: n.category,
        type: n.type,
        createdAt: n.createdAt,
      })),
      getNotificationsCount: pipeline.length,
      filteredCount: filtered.length,
      filteredChatStartedCount: chatStartedVisible.length,
      filteredChatStarted: chatStartedVisible.map((n) => ({
        id: n.id,
        title: n.title,
        recipientUserId: n.recipientUserId,
        category: n.category,
        type: n.type,
        createdAt: n.createdAt,
      })),
      domCardCount: domCards.length,
      domStartedCount: domStarted.length,
      domStartedTitles: domStarted.map(
        (el) => el.querySelector(".talk-notify-card__title")?.textContent?.trim() || ""
      ),
      emptyState: document.querySelector(".talk-notify-empty-state__title")?.textContent?.trim() || null,
    };
  });

  console.log("\n=== B上 iframe context ===");
  console.log(JSON.stringify(iframeData, null, 2));

  console.log("\n=== 切り分け ===");
  const genOk =
    parentStore.length > 0 &&
    parentStore.some((n) => n.recipientUserId === "u_hiro" && n.title === "やりとりが開始されました");
  const storeInIframe = iframeData.rawChatStartedCount > 0;
  const pipelineOk = iframeData.filteredChatStartedCount > 0;
  const renderOk = iframeData.domStartedCount > 0;

  if (!genOk) {
    console.log("判定: 生成処理失敗 — parent store に期待レコードなし");
  } else if (!storeInIframe) {
    console.log("判定: 生成は成功したが iframe が store を読めていない");
  } else if (!pipelineOk) {
    console.log("判定: store にあるが getNotifications/filter で除外されている → 描画前フィルタ失敗");
  } else if (!renderOk) {
    console.log("判定: pipeline にはあるが DOM に出ていない → 描画処理失敗");
  } else {
    console.log("判定: 生成・参照・描画 すべて成功");
  }

  const buyer = parentStore.find((n) => n.recipientUserId === "u_hiro");
  if (buyer) {
    console.log("\n=== 期待レコード (u_hiro) ===");
    console.log(`id: ${buyer.id}`);
    console.log(`title: ${buyer.title}`);
    console.log(`recipientUserId: ${buyer.recipientUserId}`);
    console.log(`category: ${buyer.category}`);
    console.log(`type: ${buyer.type}`);
    console.log(`createdAt: ${buyer.createdAt}`);
  }
  console.log(`\nB上 getNotifications 件数: ${iframeData.getNotificationsCount}`);
  console.log(`B上 filter後 件数: ${iframeData.filteredCount}`);
  console.log(`B上 DOMカード 件数: ${iframeData.domCardCount}`);
} finally {
  await browser.close();
}
