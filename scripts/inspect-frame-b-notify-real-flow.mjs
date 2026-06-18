#!/usr/bin/env node
/**
 * 実フロー management → fee-pay → #frame-b-notify 6項目診断（message含む）
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const contactId = "contact-demo-skill-dual-001";

async function readBNotifyFrame(bench) {
  return bench.evaluate(() => {
    const el = document.getElementById("frame-b-notify");
    const src = el?.src || "";
    const win = el?.contentWindow;
    if (!win) return { src, error: "no contentWindow" };
    try {
      const params = new URLSearchParams(win.location.search);
      win.TasuTalkData?.invalidateNotificationsBootstrap?.();
      const pipeline =
        win.TasuTalkData?.getNotifications?.({
          filter: "all",
          applySettings: false,
          showMuted: true,
        }) || [];
      const doc = win.document;
      const cards = [...doc.querySelectorAll(".talk-notify-card__title")].map((e) =>
        e.textContent?.trim()
      );
      const parentStore = (window.TasuTalkNotifications?.getAll?.() || [])
        .filter((n) => n.recipientUserId === "u_hiro")
        .map((n) => ({
          title: n.title,
          id: n.id,
          recipient: n.recipientUserId,
          source: n.source,
        }));
      const iframeStore = (() => {
        try {
          return JSON.parse(win.localStorage.getItem("tasful_talk_notifications") || "[]")
            .filter((n) => n.recipientUserId === "u_hiro")
            .map((n) => ({ title: n.title, source: n.source }));
        } catch {
          return [];
        }
      })();
      let normSrc = src;
      try {
        const u = new URL(src);
        u.searchParams.delete("_ts");
        normSrc = u.pathname + u.search;
      } catch {
        /* ignore */
      }
      return {
        src: normSrc,
        iframeUserId: params.get("userId"),
        demoProfile: params.get("demoProfile"),
        review: params.get("review"),
        benchEmbed: params.get("benchEmbed"),
        pipelineCount: pipeline.length,
        pipelineTitles: pipeline.map((n) => n.title),
        domCards: cards,
        empty: doc.querySelector(".talk-notify-empty-state__title")?.textContent?.trim() || null,
        parentStoreForHiro: parentStore,
        iframeStoreForHiro: iframeStore,
        benchEmbedDataset: win.document.body?.dataset?.benchEmbed,
        tabNotify: win.document.body?.classList.contains("talk-home--tab-notify"),
        messageListenerReady: win.__benchNotifyMessageListenerReady === true,
      };
    } catch (e) {
      return { src, error: String(e) };
    }
  });
}

async function readAChatFrame(bench) {
  return bench.evaluate(() => {
    const el = document.getElementById("frame-a-chat");
    const win = el?.contentWindow;
    if (!win) return { error: "no a-chat contentWindow", src: el?.src || "" };
    return {
      src: win.location.pathname + win.location.search,
      isChatDetail: /chat-detail/.test(win.location.pathname),
      isFeePay: /platform-chat-fee-pay/.test(win.location.pathname),
      thread: new URLSearchParams(win.location.search).get("thread"),
    };
  });
}

async function sendFromAChat(bench) {
  return bench.evaluate(async () => {
    const el = document.getElementById("frame-a-chat");
    const win = el?.contentWindow;
    if (!win) return { ok: false, reason: "no a-chat window" };
    const tid = new URLSearchParams(win.location.search).get("thread");
    const svc = win.TasuChatService;
    if (!svc?.saveMessage || !tid) {
      return { ok: false, reason: "no service or thread", src: win.location.href };
    }
    const res = await svc.saveMessage(tid, {
      text: "テスト送信ベンチ実フロー",
      senderId: "u_sachi",
      senderName: "さちこ",
    });
    const parentNotifies = (window.TasuTalkNotifications?.getAll?.() || []).filter(
      (n) => n.recipientUserId === "u_hiro" && /メッセージ/.test(n.title || "")
    );
    return {
      ok: res?.ok === true,
      send: res,
      messageNotifiesInParent: parentNotifies.length,
      threadId: tid,
    };
  });
}

const browser = await chromium.launch({ headless: true });
const bench = await (await browser.newContext()).newPage({ viewport: { width: 390, height: 844 } });

try {
  await bench.goto(
    `${BASE}/chat-dual-window-demo.html?benchPattern=skill-0&liveFlow=1&benchViewport=390`,
    { waitUntil: "domcontentloaded", timeout: 30000 }
  );
  await bench.waitForTimeout(2500);

  // A下を管理ページへ（実画面と同じ導線）
  const mgmtUrl = await bench.evaluate(() => {
    const profile = window.TasuPlatformChatDualWindowDemo?.getProfile?.("skill", false);
    const Live = window.TasuPlatformChatLiveFlow;
    const href = Live?.managementPageUrl?.(profile, profile?.partnerAId) || "";
    return href;
  });
  await bench.locator("#frame-a-chat").evaluate((el, url) => {
    el.src = url;
  }, `${BASE}${mgmtUrl.startsWith("/") ? mgmtUrl : `/${mgmtUrl}`}`);
  await bench.waitForTimeout(2000);

  await bench.evaluate((cid) => {
    const C = window.TasuListingContactRequestsStore;
    const now = new Date().toISOString();
    localStorage.setItem(
      C.STORAGE_KEY,
      JSON.stringify([
        {
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
        },
      ])
    );
    window.TasuPlatformChatFee.ensurePendingFeeDeferred({
      listing: C.resolveListing("demo-skill-001"),
      contactId: cid,
      feeAmount: 550,
    });
  }, contactId);

  const feeUrl =
    `${BASE}/platform-chat-fee-pay.html?contactId=${contactId}&listingId=demo-skill-001&category=skill` +
    `&talkDev=1&review=chat-demo&liveFlow=1&demoProfile=skill&demoConnect=0&userId=u_sachi&from=notify&benchEmbed=1&benchViewport=390`;

  await bench.locator("#frame-a-chat").evaluate((el, url) => {
    el.src = url;
  }, feeUrl);
  await bench.waitForTimeout(2000);

  const aFrame = bench.frames().find((f) => /platform-chat-fee-pay/.test(f.url()));
  if (!aFrame) {
    const aState = await readAChatFrame(bench);
    throw new Error(`fee-pay frame missing; a-chat=${JSON.stringify(aState)}`);
  }

  await aFrame.evaluate(() => {
    window.confirm = () => true;
    document.querySelector("[data-platform-fee-pay]")?.click();
  });
  await bench.waitForTimeout(6000);

  console.log("\n=== A-chat after pay ===");
  let aChatState = await readAChatFrame(bench);
  console.log(JSON.stringify(aChatState, null, 2));

  if (!aChatState.isChatDetail) {
    await bench.evaluate(() => {
      const el = document.getElementById("frame-a-chat");
      const doc = el?.contentWindow?.document;
      const link = doc?.querySelector("[data-platform-fee-chat-link]");
      if (link?.href) {
        el.contentWindow.location.href = link.href;
        return;
      }
      const tid =
        (window.TasuTalkNotifications?.getAll?.() || []).find(
          (n) =>
            n.recipientUserId === "u_hiro" &&
            /やりとりが開始/.test(n.title || "") &&
            n.threadId
        )?.threadId || "";
      if (tid && el) {
        const Demo = window.TasuPlatformChatDualWindowDemo;
        const profile = Demo?.getProfile?.("skill", false);
        const href = Demo?.chatUrl?.(profile?.id, profile?.partnerAId, {
          review: "chat-demo",
          connect: false,
          state: "active",
          threadId: tid,
        });
        if (href) el.src = href;
      }
    });
    await bench.waitForTimeout(2500);
    aChatState = await readAChatFrame(bench);
    console.log("A-chat after open chat:", JSON.stringify(aChatState, null, 2));
  }

  console.log("\n=== 1. AFTER PAY (#frame-b-notify) ===");
  const afterPay = await readBNotifyFrame(bench);
  console.log(JSON.stringify(afterPay, null, 2));

  const sendResult = await sendFromAChat(bench);
  console.log("\n=== A-chat send result ===");
  console.log(JSON.stringify(sendResult, null, 2));
  await bench.waitForTimeout(3500);

  console.log("\n=== 2. AFTER MESSAGE (#frame-b-notify) ===");
  const afterMsg = await readBNotifyFrame(bench);
  console.log(JSON.stringify(afterMsg, null, 2));

  const checklist = {
    payRecordInParent: (afterPay.parentStoreForHiro || []).some((n) =>
      /やりとりが開始/.test(n.title || "")
    ),
    payRecipientIsHiro: (afterPay.parentStoreForHiro || []).some(
      (n) => /やりとりが開始/.test(n.title || "") && n.recipient === "u_hiro"
    ),
    payIframeUserId: afterPay.iframeUserId === "u_hiro",
    payPipelineHasStarted: (afterPay.pipelineTitles || []).some((t) =>
      /やりとりが開始/.test(t || "")
    ),
    payDomHasCard: (afterPay.domCards || []).some((t) => /やりとりが開始/.test(t || "")),
    payGetNotifications: (afterPay.pipelineTitles || []).length > 0,
    msgRecordInParent: (afterMsg.parentStoreForHiro || []).some((n) =>
      /メッセージ/.test(n.title || "")
    ),
    msgRecipientIsHiro: (afterMsg.parentStoreForHiro || []).some(
      (n) => /メッセージ/.test(n.title || "") && n.recipient === "u_hiro"
    ),
    msgPipelineHasMessage: (afterMsg.pipelineTitles || []).some((t) => /メッセージ/.test(t || "")),
    msgDomHasCard: (afterMsg.domCards || []).some((t) => /メッセージ/.test(t || "")),
    messageListenerReady: afterMsg.messageListenerReady === true,
  };
  console.log("\n=== CHECKLIST (6+ points) ===");
  console.log(JSON.stringify(checklist, null, 2));

  const failed = Object.entries(checklist).filter(([, v]) => !v).map(([k]) => k);
  if (failed.length) {
    console.error("\nFAILED:", failed.join(", "));
    process.exit(1);
  }
  console.log("\nOK: all B-notify checkpoints passed on #frame-b-notify");
} finally {
  await browser.close();
}
