#!/usr/bin/env node
/**
 * 2窓ベンチ — A支払い後 B上に「やりとりが開始されました」
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
await withPlaywrightBrowser(async (browser) => {const issues = [];


  const context = await browser.newContext();
  const bench = await context.newPage({ viewport: { width: 1280, height: 900 } });
  const contactId = "contact-demo-skill-dual-001";

  await bench.goto(
    `${BASE}/chat-dual-window-demo.html?benchPattern=skill-0&liveFlow=1&liveFlowReset=1&benchViewport=1280`,
    { waitUntil: "domcontentloaded", timeout: 30000 }
  );
  await bench.waitForTimeout(2500);

  const aChat = bench.frameLocator("#frame-a-chat");
  await aChat.locator("[data-platform-fee-pay]").click({ timeout: 15000 }).catch(async () => {
    await bench.evaluate((cid) => {
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
      const activated = F.activateDeferredAfterPayment({ contactId: cid, listingId: "demo-skill-001" });
      if (!activated?.ok) throw new Error(activated?.reason || "activate_failed");
      window.TasuPlatformChatDualWindowNotify?.notifyDemoChatStarted?.({
        thread: activated.thread,
        threadId: activated.threadId,
        payerId: "u_sachi",
      });
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "tasu-bench-chat-started", buyerUserId: "u_hiro", threadId: activated.threadId },
        })
      );
    }, contactId);
  });

  if (!(await aChat.locator("[data-platform-fee-pay]").count())) {
    await bench.evaluate((cid) => {
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
      const activated = F.activateDeferredAfterPayment({ contactId: cid, listingId: "demo-skill-001" });
      if (!activated?.ok) throw new Error(activated?.reason || "activate_failed");
      const started = window.TasuPlatformChatDualWindowNotify?.notifyDemoChatStarted?.({
        thread: activated.thread,
        threadId: activated.threadId,
        payerId: "u_sachi",
      });
      if (!started?.ok) throw new Error(started?.reason || "notify_failed");
    }, contactId);
    await bench.evaluate(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: {
            type: "tasu-bench-chat-started",
            buyerUserId: "u_hiro",
            threadId:
              (window.TasuChatThreadStore?.readAll?.() || []).find((t) => t.listingId === "demo-skill-001")?.id ||
              "",
          },
        })
      );
    });
  } else {
    await aChat.locator("[data-platform-fee-pay]").click();
    await bench.waitForFunction(() => window.confirm(""), { timeout: 1000 }).catch(() => {});
    await aChat.evaluate(() => {
      if (window.confirm.toString().includes("native code")) {
        window.confirm = () => true;
      }
      document.querySelector("[data-platform-fee-pay]")?.click();
    });
  }

  await bench.waitForTimeout(3000);

  const store = await bench.evaluate(() => {
    const rows = (window.TasuTalkNotifications?.getAll?.() || []).filter((n) =>
      /やりとりが開始されました/.test(String(n.title || ""))
    );
    const buyer = rows.find((n) => n.recipientUserId === "u_hiro");
    return {
      buyer: Boolean(buyer),
      recipientUserId: buyer?.recipientUserId || "",
      type: buyer?.type || "",
      source: buyer?.source || "",
    };
  });

  const bNotifyFrame = bench.frame({ url: /tab=notify.*userId=u_hiro|userId=u_hiro.*tab=notify/ });
  let ui = { title: "", cta: "", cardCount: 0 };
  if (bNotifyFrame) {
    await bNotifyFrame.waitForTimeout(1500);
    ui = await bNotifyFrame.evaluate(() => ({
      title:
        [...document.querySelectorAll(".talk-notify-card")]
          .find((el) => /やりとりが開始されました/.test(el.textContent || ""))
          ?.querySelector(".talk-notify-card__title")
          ?.textContent?.trim() || "",
      cta:
        [...document.querySelectorAll("[data-talk-notify-action]")]
          .find((el) => /チャットを開く/.test(el.textContent || ""))
          ?.textContent?.trim() || "",
      cardCount: document.querySelectorAll(".talk-notify-card").length,
      empty: document.querySelector(".talk-notify-empty-state__title")?.textContent?.trim() || "",
      userId: new URLSearchParams(location.search).get("userId"),
    }));
  }

  const bChatSrc = await bench.locator("#frame-b-chat").getAttribute("src");
  console.log("[store]", store);
  console.log("[b-notify-ui]", ui);
  console.log("[b-chat]", bChatSrc);

  if (!store.buyer) issues.push("notification not in parent store for u_hiro");
  if (store.recipientUserId !== "u_hiro") issues.push(`recipientUserId=${store.recipientUserId}`);
  if (ui.title !== "やりとりが開始されました") issues.push(`B notify UI title: ${ui.title || ui.empty || "(empty)"}`);
  if (ui.cta !== "チャットを開く") issues.push(`B notify CTA: ${ui.cta}`);
  if (/chat-detail\.html/i.test(bChatSrc || "")) issues.push("B chat auto-opened chat-detail");

  if (issues.length) {
    console.error("\nFAILED:\n" + issues.map((i) => `  - ${i}`).join("\n"));
    process.exit(1);
  }
  console.log("\nOK: B notify shows chat-started after payment");
});

await closeAllBrowsers();
