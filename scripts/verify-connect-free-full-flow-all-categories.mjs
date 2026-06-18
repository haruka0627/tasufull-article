#!/usr/bin/env node
/**
 * Connectなし — skill 基準の全6カテゴリ E2E
 * B下CTA → A通知 → 管理カード → チャットに進む → 支払い → A/Bチャット開始
 */
import { chromium } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const OUT_DIR = path.join("screenshots", "connect-free-full-flow");
fs.mkdirSync(OUT_DIR, { recursive: true });

const CATEGORIES = [
  {
    id: "skill",
    pattern: "skill-0",
    profile: "skill",
    notifyTitle: "購入されました",
    notifyCta: "購入者を確認する",
    frameRe: /detail-skill/i,
    ctaSelectors: ["[data-listing-primary-cta]", ".skill-cta-panel__primary.cta-consult"],
  },
  {
    id: "worker",
    pattern: "worker-0",
    profile: "worker",
    notifyTitle: "依頼が届きました",
    notifyCta: "依頼者を確認する",
    frameRe: /detail-worker/i,
    ctaSelectors: ["[data-listing-primary-cta]"],
  },
  {
    id: "general",
    pattern: "general-0",
    profile: "general",
    notifyTitle: "応募/依頼が届きました",
    notifyCta: "応募者/依頼者を確認する",
    frameRe: /detail-general/i,
    ctaSelectors: [
      "[data-tasu-mdetail-cta-dock] .tasu-mdetail-cta-dock__btn--primary",
      "[data-business-service-estimate]",
    ],
  },
  {
    id: "product",
    pattern: "product-0",
    profile: "product",
    notifyTitle: "商品が購入されました",
    notifyCta: "購入者を確認する",
    frameRe: /detail-product/i,
    ctaSelectors: [
      "[data-tasu-mdetail-cta-dock] .tasu-mdetail-cta-dock__btn--primary",
      "[data-listing-primary-cta]",
    ],
  },
  {
    id: "shop",
    pattern: "shop-0",
    profile: "shop",
    notifyTitle: "予約/注文が入りました",
    notifyCta: "利用者を確認する",
    frameRe: /detail-shop/i,
    ctaSelectors: [".shop-mobile-inquiry-dock__btn", "[data-biz-detail-inquiry]"],
  },
  {
    id: "business",
    pattern: "business-0",
    profile: "business",
    notifyTitle: "相談/依頼が届きました",
    notifyCta: "依頼者を確認する",
    frameRe: /detail-business-service/i,
    ctaSelectors: [
      "[data-tasu-mdetail-cta-dock] .tasu-mdetail-cta-dock__btn--primary",
      "[data-business-service-estimate]",
    ],
  },
];

const errors = [];
const pushErr = (cat, step, msg) => {
  const line = `${cat}: ${step} — ${msg}`;
  errors.push(line);
  console.error(`NG: ${line}`);
};

async function clickVisibleCta(frame, selectors) {
  return frame.evaluate((sels) => {
    const isVisible = (el) => {
      if (!el) return false;
      const st = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return st.visibility !== "hidden" && st.display !== "none" && rect.height > 0 && rect.width > 0;
    };
    for (const sel of sels) {
      const el = [...document.querySelectorAll(sel)].find(isVisible);
      if (el) {
        el.click();
        return { ok: true, selector: sel, text: String(el.textContent || "").trim() };
      }
    }
    return { ok: false };
  }, selectors);
}

async function runCategory(page, cat) {
  const url =
    `${BASE}/chat-dual-window-demo.html?talkDev=1&review=chat-demo&demoProfile=${cat.profile}` +
    `&demoConnect=0&liveFlow=1&userId=u_hiro&benchViewport=1280&benchPattern=${cat.pattern}&liveFlowReset=1`;

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(2500);

  const bFrame = page.frames().find((f) => cat.frameRe.test(f.url()));
  if (!bFrame) {
    pushErr(cat.id, "1-b-cta", "B detail frame missing");
    return;
  }

  const cta = await clickVisibleCta(bFrame, cat.ctaSelectors);
  if (!cta.ok) {
    pushErr(cat.id, "1-b-cta", `visible CTA not found (${cat.ctaSelectors.join(", ")})`);
    return;
  }
  await page.waitForTimeout(2500);

  const afterCta = await page.evaluate(
    ({ profileId, notifyTitle, notifyCta }) => {
      const profile = window.TasuPlatformChatDualWindowDemo?.getProfile?.(profileId, false);
      const contacts = JSON.parse(localStorage.getItem("tasful_listing_contact_requests_v1") || "[]");
      const listingId = profile?.listingId;
      const contact = contacts.find((r) => String(r.listing_id) === String(listingId));
      const notifs = JSON.parse(localStorage.getItem("tasful_talk_notifications") || "[]");
      const notify = notifs.find(
        (n) =>
          String(n.recipientUserId) === String(profile?.partnerAId) &&
          String(n.title || "").includes(String(notifyTitle).split("/")[0].slice(0, 4)) &&
          String(n.source) === "platform"
      );
      const bChat = document.getElementById("frame-b-chat")?.src || "";
      return {
        contactId: contact?.contact_id || "",
        contactStatus: contact?.status || "",
        notifyTitle: notify?.title || "",
        notifyCta: notify?.actionLabel || "",
        notifyHref: notify?.href || notify?.targetUrl || "",
        bBuyerWait: /platform-chat-bench-buyer-wait/i.test(bChat),
        partnerBName: profile?.partnerBName || "",
      };
    },
    { profileId: cat.profile, notifyTitle: cat.notifyTitle, notifyCta: cat.notifyCta }
  );

  if (!afterCta.contactId) pushErr(cat.id, "2-contact-record", "contact request not created");
  if (!afterCta.notifyTitle.includes(cat.notifyTitle.split("/")[0].slice(0, 4))) {
    pushErr(cat.id, "3-a-notify-store", `notify title=${afterCta.notifyTitle}`);
  }
  if (afterCta.notifyCta !== cat.notifyCta) {
    pushErr(cat.id, "3-a-notify-cta", `cta=${afterCta.notifyCta} expected=${cat.notifyCta}`);
  }
  if (!/view=contacts|benchManagement=1|#contacts/i.test(afterCta.notifyHref)) {
    pushErr(cat.id, "3-a-notify-href", `href missing contacts view: ${afterCta.notifyHref}`);
  }
  if (!afterCta.bBuyerWait) pushErr(cat.id, "7-b-buyer-wait", "B-chat not on buyer-wait");

  await page.evaluate(() => {
    const el = document.getElementById("frame-a-notify");
    if (el?.src) el.src = el.src;
    el?.contentWindow?.postMessage?.({ type: "tasu-bench-notify-refresh" }, "*");
  });
  await page.waitForTimeout(2000);

  const aNotify = page.frame({ url: /talk-home/ });
  if (!aNotify) {
    pushErr(cat.id, "3-a-notify-dom", "frame-a-notify missing");
    return;
  }

  await aNotify.waitForFunction(
    (title) => {
      const key = String(title).slice(0, 6);
      return Array.from(
        document.querySelectorAll(".talk-notify-card__title, [data-notify-title], .talk-notify-card")
      ).some((el) => String(el.textContent || "").includes(key));
    },
    cat.notifyTitle,
    { timeout: 12000 }
  ).catch(() => pushErr(cat.id, "3-a-notify-dom", "notify card not visible"));

  const notifyClicked = await aNotify.evaluate(() => {
    const btn = document.querySelector(
      "[data-talk-notify-action][data-talk-notify-href], .talk-notify-card__minimal-action"
    );
    if (!btn) return { ok: false };
    btn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    return { ok: true, label: btn.textContent?.trim() || "" };
  });
  if (!notifyClicked.ok) pushErr(cat.id, "4-notify-click", "notify CTA click failed");
  await page.waitForTimeout(5000);

  const aChat =
    page.frames().find((f) => /detail-|bench-seller-idle|platform-chat-fee-pay/.test(f.url())) ||
    page.frame({ url: /detail-/ });
  const mgmt = aChat
    ? await aChat.evaluate(() => ({
        href: location.href,
        benchManagement: document.body?.dataset?.benchManagement,
        listingLoaded: document.body?.dataset?.listingLoaded,
        cardCount: document.querySelectorAll("[data-listing-contact-card]").length,
        proceedBtn: Boolean(document.querySelector("[data-listing-contact-proceed]")),
        payBtn: Boolean(document.querySelector("[data-listing-contact-pay]")),
        contactsTitle: document.querySelector("[data-listing-contacts-title]")?.textContent?.trim() || "",
        bodyHead: (document.body?.innerText || "").slice(0, 300),
      }))
    : { href: "", proceedBtn: false, payBtn: false, cardCount: 0 };

  if (!mgmt.proceedBtn && !mgmt.payBtn) {
    pushErr(cat.id, "5-contact-card", `チャットに進む not shown (cards=${mgmt.cardCount}, loaded=${mgmt.listingLoaded})`);
  }
  if (!/view=contacts|benchManagement=1|#contacts/i.test(mgmt.href)) {
    pushErr(cat.id, "4-a-management-url", mgmt.href);
  }

  const freshAChat = () =>
    page.frames().find((f) =>
      /detail-(skill|worker|general|product|shop|business)|platform-chat-fee-pay/.test(f.url())
    );

  const proceedClick = await (freshAChat() || aChat)?.evaluate(() => {
    const proceed = document.querySelector("[data-listing-contact-proceed]");
    const pay = document.querySelector("[data-listing-contact-pay]");
    const target = proceed || pay;
    if (!target) {
      const store = window.TasuListingContactRequestsStore;
      const listingId = String(document.body.dataset.listingId || new URLSearchParams(location.search).get("id") || "");
      const contact = store?.listByListing?.(listingId)?.[0];
      if (!contact || contact.status !== "applied") return { ok: false, reason: "no_button" };
      const result = store.beginContactChat(listingId, contact.contact_id);
      if (!result?.payUrl) return { ok: false, reason: result?.reason || "begin_failed" };
      const navigated =
        window.TasuPlatformChatBenchEmbed?.tryPostBenchFrameNavigate?.(result.payUrl) === true;
      if (!navigated && new URLSearchParams(location.search).get("benchEmbed") === "1") {
        window.parent.postMessage(
          { type: "tasu-bench-frame-navigate", slot: "a-chat", href: result.payUrl },
          "*"
        );
      } else if (!navigated) {
        window.location.href = result.payUrl;
      }
      return { ok: true, mode: "beginContactChat" };
    }
    target.click();
    const parentHref = window.parent?.document?.getElementById?.("frame-a-chat")?.src || "";
    return {
      ok: true,
      mode: target === proceed ? "proceed" : "pay",
      parentHref: String(parentHref).slice(0, 120),
    };
  });
  if (!proceedClick?.ok) {
    pushErr(cat.id, "5-proceed-click", proceedClick?.reason || "proceed click failed");
  } else {
    console.log(`  proceed: ${cat.id} mode=${proceedClick.mode}`);
  }
  await page.waitForTimeout(3500);

  await page
    .waitForFunction(
      () => /platform-chat-fee-pay/.test(document.getElementById("frame-a-chat")?.src || ""),
      null,
      { timeout: 15000 }
    )
    .catch(() => null);
  const feeFrame =
    page.frame({ url: /platform-chat-fee-pay/ }) ||
    page.frames().find((f) => /platform-chat-fee-pay/.test(f.url()));
  if (!feeFrame) {
    const aSrc = await page.evaluate(() => document.getElementById("frame-a-chat")?.src || "");
    pushErr(cat.id, "6-fee-pay", `fee-pay frame not reached (a-chat=${aSrc})`);
    return;
  }

  feeFrame.on("dialog", async (d) => d.accept());
  await feeFrame.evaluate(() => {
    document.querySelector("[data-platform-fee-pay]")?.click();
  });
  await page.waitForTimeout(3000);

  const postPay = await page.evaluate((profileId) => {
    const profile = window.TasuPlatformChatDualWindowDemo?.getProfile?.(profileId, false);
    const threads = JSON.parse(localStorage.getItem("tasful_chat_threads") || "[]");
    const thread = threads.find(
      (t) =>
        String(t.listingId) === String(profile?.listingId) &&
        (String(t.buyerId) === String(profile?.partnerBId) ||
          String(t.sellerId) === String(profile?.partnerAId))
    );
    const notifs = JSON.parse(localStorage.getItem("tasful_talk_notifications") || "[]");
    const bStarted = notifs.find(
      (n) =>
        String(n.recipientUserId) === String(profile?.partnerBId) &&
        /やりとりが開始|チャットが開始/.test(String(n.title || ""))
    );
    const aChatSrc = document.getElementById("frame-a-chat")?.src || "";
    const bChatSrc = document.getElementById("frame-b-chat")?.src || "";
    return {
      threadId: thread?.id || "",
      threadStatus: thread?.roomStatus || thread?.status || "",
      bNotifyTitle: bStarted?.title || "",
      aChatOpen: /chat-detail/i.test(aChatSrc),
      bChatOpen: /chat-detail|buyer-wait/i.test(bChatSrc),
    };
  }, cat.profile);

  if (!postPay.threadId) pushErr(cat.id, "6-chat-thread", "thread not created after fee pay");
  if (!postPay.bNotifyTitle) pushErr(cat.id, "7-b-started-notify", "B chat-started notify missing");

  await page.screenshot({ path: path.join(OUT_DIR, `${cat.id}-done.png`), fullPage: false });
  console.log(`OK: ${cat.id}`, { cta: cta.text, ...postPay });
}

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
page.on("dialog", async (d) => d.accept());

try {
  for (const cat of CATEGORIES) {
    await runCategory(page, cat);
  }
  if (errors.length) {
    console.log(JSON.stringify({ ok: false, errors }, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify({ ok: true, categories: CATEGORIES.map((c) => c.id) }, null, 2));
} finally {
  await browser.close();
}
