#!/usr/bin/env node
/**
 * ベンチ — B下は通知CTA押下までチャットへ自動遷移しない
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
await withPlaywrightBrowser(async (browser) => {const issues = [];


  const context = await browser.newContext();
  const bench = await context.newPage({ viewport: { width: 1280, height: 900 } });

  await bench.goto(
    `${BASE}/chat-dual-window-demo.html?benchPattern=skill-0&liveFlow=1&liveFlowReset=1&benchViewport=1280`,
    { waitUntil: "domcontentloaded", timeout: 30000 }
  );
  await bench.waitForTimeout(2500);

  const initial = await bench.evaluate(() => {
    const src = document.getElementById("frame-b-chat")?.src || "";
    const resolved = window.TasuPlatformChatLiveFlow?.benchBuyerDetailUrl?.(
      window.TasuPlatformChatDualWindowDemo?.getProfile?.(),
      "u_hiro"
    );
    return { src, resolved, flowPhase: "initial" };
  });
  console.log("[initial]", initial);
  if (!/detail-skill\.html/i.test(initial.src)) {
    issues.push(`B chat blank/wrong on reset: ${initial.src || "(empty)"}`);
  }

  const bChatSrcBefore = initial.src;

  await bench.evaluate(() => {
    const cid = "contact-demo-skill-dual-001";
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
    const F = window.TasuPlatformChatFee;
    F.ensurePendingFeeDeferred({ listing: C.resolveListing("demo-skill-001"), contactId: cid, feeAmount: 550 });
    F.markFeePaid(`deferred:contact:${cid}`, { listingId: "demo-skill-001", feeAmount: 550 });
    const activated = F.activateDeferredAfterPayment({ contactId: cid, listingId: "demo-skill-001" });
    if (!activated?.ok) throw new Error(activated?.reason || "activate_failed");
    window.TasuPlatformChatDualWindowNotify?.notifyDemoChatStarted?.({
      thread: activated.thread,
      threadId: activated.threadId,
      payerId: "u_sachi",
    });
  });

  await bench.waitForFunction(
    () => {
      const rows = window.TasuTalkNotifications?.getAll?.() || [];
      return rows.some(
        (r) =>
          String(r.recipientUserId) === "u_hiro" &&
          String(r.title || "").includes("やりとりが開始されました")
      );
    },
    null,
    { timeout: 10000 }
  );
  await bench.locator("#frame-b-notify").evaluate((el) => {
    el.src = el.src;
  });
  await bench.waitForTimeout(2000);

  const bChatSrcAfterPay = await bench.locator("#frame-b-chat").getAttribute("src");
  const bNotifyFrame = bench.frame({ url: /tab=notify.*userId=u_hiro|userId=u_hiro.*tab=notify/ });

  const afterPay = {
    bChatSrc: bChatSrcAfterPay || "",
    bChatIsDetail: /chat-detail\.html/i.test(bChatSrcAfterPay || ""),
    bNotifyHasCard: false,
    notifyTitle: "",
    cta: "",
  };

  if (bNotifyFrame) {
    await bNotifyFrame.waitForSelector(".talk-notify-card", { timeout: 10000 });
    const ui = await bNotifyFrame.evaluate(() => {
      const card = [...document.querySelectorAll(".talk-notify-card")].find((el) =>
        /やりとりが開始されました/.test(el.textContent || "")
      );
      return {
        hasCard: Boolean(card),
        title: card?.querySelector(".talk-notify-card__title")?.textContent?.trim() || "",
        cta:
          card?.querySelector("[data-talk-notify-action], .talk-notify-card__minimal-action")?.textContent?.trim() ||
          "",
      };
    });
    afterPay.bNotifyHasCard = ui.hasCard;
    afterPay.notifyTitle = ui.title;
    afterPay.cta = ui.cta;
  }

  const bWaitUi = await bench.frame({ url: /platform-chat-bench-buyer-wait/ })?.evaluate(() => ({
    title: document.querySelector("[data-bench-wait-title]")?.textContent?.trim() || "",
    body: document.querySelector("[data-bench-wait-body]")?.textContent?.trim() || "",
    badge: document.querySelector("[data-bench-wait-badge]")?.textContent?.trim() || "",
    hasChatCta: Boolean(document.querySelector('a[href*="chat-detail"], button[data-talk-notify-action]')),
  }));
  console.log("[after-pay]", afterPay, "[b-wait]", bWaitUi, "before:", bChatSrcBefore);

  if (bWaitUi?.title !== "通知を確認してください") {
    issues.push(`B wait title should be 通知を確認してください: ${bWaitUi?.title}`);
  }
  if (/やりとりが開始されました/.test(`${bWaitUi?.title || ""}${bWaitUi?.body || ""}${bWaitUi?.badge || ""}`)) {
    issues.push("B wait must not show chat-started notification copy");
  }
  if (/チャットを開く/.test(`${bWaitUi?.body || ""}`)) {
    issues.push("B wait must not mention チャットを開く");
  }
  if (bWaitUi?.hasChatCta) issues.push("B wait must not have direct chat CTA");

  if (afterPay.bChatIsDetail) issues.push("B chat auto-navigated to chat-detail after payment");
  if (!afterPay.bNotifyHasCard) issues.push("B notify missing chat-started card");
  if (afterPay.notifyTitle !== "やりとりが開始されました") {
    issues.push(`B notify title: ${afterPay.notifyTitle}`);
  }
  if (afterPay.cta !== "チャットを開く") {
    issues.push(`B notify CTA: ${afterPay.cta}`);
  }

  if (bNotifyFrame && afterPay.bNotifyHasCard) {
    const clicked = await bNotifyFrame.evaluate(() => {
      const btn = [...document.querySelectorAll("[data-talk-notify-action]")].find((el) =>
        /チャットを開く/.test(el.textContent || "")
      );
      if (!btn) return false;
      btn.click();
      return true;
    });
    if (!clicked) issues.push("B notify CTA button not found for click");
    await bench.waitForFunction(
      () => /chat-detail\.html/i.test(document.getElementById("frame-b-chat")?.src || ""),
      null,
      { timeout: 10000 }
    );
    const bChatAfterCta = await bench.locator("#frame-b-chat").getAttribute("src");
    console.log("[after-cta]", bChatAfterCta);
    if (!/chat-detail\.html/i.test(bChatAfterCta || "")) {
      issues.push("B chat did not open after notify CTA click");
    }
  }

  if (issues.length) {
    console.error("\nFAILED:\n" + issues.map((i) => `  - ${i}`).join("\n"));
    process.exit(1);
  }
  console.log("\nOK: B chat gated until notify CTA");
});

await closeAllBrowsers();
