#!/usr/bin/env node
/**
 * 550円支払い後 — B（購入者）へ「やりとりが開始されました」通知
 */
import { launchHeadlessBrowser } from "./lib/playwright-browser.mjs";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const browser = await launchHeadlessBrowser();
const context = await browser.newContext();
const issues = [];
let page = null;
let bPage = null;

try {
  page = await context.newPage({ viewport: { width: 1280, height: 420 } });
  const contactId = "contact-demo-skill-dual-001";
  const feeUrl =
    `${BASE}/platform-chat-fee-pay.html?contactId=${contactId}&listingId=demo-skill-001&category=skill` +
    `&talkDev=1&review=chat-demo&liveFlow=1&demoProfile=skill&demoConnect=0&userId=u_sachi&from=notify`;

  await page.goto(feeUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForFunction(() => window.TasuPlatformChatFee?.activateDeferredAfterPayment, null, {
    timeout: 8000,
  });
  await page.waitForTimeout(500);

  const prep = await page.evaluate((cid) => {
    const Contacts = window.TasuListingContactRequestsStore;
    const listing = Contacts.resolveListing("demo-skill-001");
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
    window.TasuPlatformChatFee.ensurePendingFeeDeferred?.({
      listing,
      contactId: cid,
      feeAmount: 550,
    });
    return { listing: Boolean(listing), contact: Boolean(Contacts.findContact?.("demo-skill-001", cid)) };
  }, contactId);

  if (!prep.listing || !prep.contact) issues.push(`prep failed: ${JSON.stringify(prep)}`);

  await page.evaluate((cid) => {
    window.TasuPlatformChatFee.markFeePaid(`deferred:contact:${cid}`, {
      listingId: "demo-skill-001",
      feeAmount: 550,
    });
    const activated = window.TasuPlatformChatFee.activateDeferredAfterPayment({
      contactId: cid,
      listingId: "demo-skill-001",
    });
    if (!activated?.ok) throw new Error(activated?.reason || "activate_failed");
  }, contactId);

  const storeCheck = await page.evaluate(() => {
    const Demo = window.TasuPlatformChatDualWindowDemo;
    const profile = Demo.getProfile("skill", false);
    const rows = (window.TasuTalkNotifications?.getAll?.() || []).filter((n) =>
      String(n.title || "").includes("やりとりが開始されました")
    );
    const buyerRow = rows.find((n) => n.recipientUserId === profile.partnerBId);
    const sellerRow = rows.find((n) => n.recipientUserId === profile.partnerAId);
    return {
      buyer: Boolean(buyerRow),
      seller: Boolean(sellerRow),
      body: buyerRow?.body || "",
      type: buyerRow?.type || "",
      threadId: buyerRow?.threadId || "",
      cta: buyerRow?.actionLabel || "",
      href: buyerRow?.href || "",
    };
  });

  console.log("[store]", storeCheck);

  const bNotifyUrl =
    `${BASE}/talk-home.html?tab=notify&userId=u_hiro&talkDev=1&review=chat-demo&demoProfile=skill` +
    `&liveFlow=1&demoConnect=0&benchEmbed=1&benchViewport=1280`;
  bPage = await context.newPage({ viewport: { width: 1280, height: 420 } });
  await bPage.goto(bNotifyUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
  await bPage.waitForSelector("[data-talk-notify-list]", { timeout: 8000 });
  await bPage.waitForFunction(
    () =>
      [...document.querySelectorAll(".talk-notify-card")].some((el) =>
        /やりとりが開始されました/.test(el.textContent || "")
      ),
    { timeout: 8000 }
  );

  const ui = await bPage.evaluate(() => {
    const card = [...document.querySelectorAll(".talk-notify-card")].find((el) =>
      /やりとりが開始されました/.test(el.textContent || "")
    );
    const cta = card?.querySelector("[data-talk-notify-action], .talk-notify-card__minimal-action");
    return {
      title: card?.querySelector(".talk-notify-card__title")?.textContent?.trim() || null,
      cta: cta?.textContent?.trim() || null,
      href: cta?.getAttribute("href") || "",
    };
  });

  console.log("[b-notify-ui]", ui);

  if (!storeCheck.buyer) issues.push("buyer notification missing");
  if (storeCheck.seller) issues.push("seller incorrectly notified");
  if (storeCheck.type !== "chat-started" && storeCheck.type !== "system") {
    issues.push(`type=${storeCheck.type}`);
  }
  if (!storeCheck.body.includes("出品者が確認し")) issues.push(`body=${storeCheck.body}`);
  if (storeCheck.cta !== "チャットを開く") issues.push(`cta=${storeCheck.cta}`);
  if (!storeCheck.threadId || !storeCheck.href.includes(storeCheck.threadId)) {
    issues.push(`href missing threadId (${storeCheck.threadId})`);
  }
  if (!ui.title) issues.push("B notify UI card missing");
  if (ui.cta !== "チャットを開く") issues.push(`B UI cta=${ui.cta}`);

  if (issues.length) {
    console.error("\nFAILED:\n" + issues.map((i) => `  - ${i}`).join("\n"));
    process.exit(1);
  }
  console.log("\nOK: buyer chat-started notification after fee payment");
} finally {
  if (bPage) await bPage.close().catch(() => null);
  if (page) await page.close().catch(() => null);
  await context.close().catch(() => null);
  await browser.close().catch(() => null);
}
