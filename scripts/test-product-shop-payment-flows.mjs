#!/usr/bin/env node
/**
 * product-0 / shop-0 — 支払い方式別フロー E2E（prepaid / bank_transfer / cash_on_delivery）
 */
import { withPlaywrightSession } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";

const BASE = process.env.BASE_URL || "http://localhost:5500";
const OUT_DIR = path.join("screenshots", "product-shop-payment-flows");
fs.mkdirSync(OUT_DIR, { recursive: true });

const PROFILES = [
  { id: "product", pattern: "product-0", partnerA: "u_product" },
  { id: "shop", pattern: "shop-0", partnerA: "u_shop_demo" },
];

const METHODS = ["prepaid", "bank_transfer", "cash_on_delivery"];

const errors = [];
const pushErr = (key, msg) => {
  errors.push(`${key}: ${msg}`);
  console.error(`NG ${key}: ${msg}`);
};

async function benchUrl(profile, method) {
  const u = new URL(`${BASE}/chat-dual-window-demo.html`);
  u.searchParams.set("talkDev", "1");
  u.searchParams.set("review", "chat-demo");
  u.searchParams.set("demoProfile", profile.id);
  u.searchParams.set("demoConnect", "0");
  u.searchParams.set("liveFlow", "1");
  u.searchParams.set("userId", "u_hiro");
  u.searchParams.set("benchViewport", "390");
  u.searchParams.set("benchPattern", profile.pattern);
  u.searchParams.set("liveFlowReset", "1");
  if (method !== "prepaid") u.searchParams.set("paymentMethod", method);
  return u.toString();
}

async function syncBenchChatFrames(page, profileId) {
  await page.evaluate((profileId) => {
    const Demo = window.TasuPlatformChatDualWindowDemo;
    const Live = window.TasuPlatformChatLiveFlow;
    const profile = Demo?.getProfile?.(profileId, false);
    if (!profile) return;
    const thread = (window.TasuChatThreadStore?.readAll?.() || []).find(
      (t) => String(t.listingId) === String(profile.listingId) && String(t.roomStatus || t.status) === "active"
    );
    if (!thread?.id) return;
    const aUrl = Live?.chatUrl?.(profile, profile.partnerAId, { threadId: thread.id });
    const bUrl = Live?.chatUrl?.(profile, profile.partnerBId, { threadId: thread.id });
    const aFrame = document.getElementById("frame-a-chat");
    const bFrame = document.getElementById("frame-b-chat");
    if (aUrl && aFrame && !/chat-detail\.html/i.test(aFrame.src || "")) aFrame.src = aUrl;
    if (bUrl && bFrame && !/chat-detail\.html/i.test(bFrame.src || "")) bFrame.src = bUrl;
  }, profileId);
}

async function waitForChatFrameReady(page, frameId, timeoutMs = 8000) {
  await page
    .waitForFunction(
      (id) => {
        const w = document.getElementById(id)?.contentWindow;
        return (
          w?.__tasuChatDetailLoadDiag?.chatDetailLoadOk === true ||
          w?.document?.body?.dataset?.chatDetailReady === "true"
        );
      },
      frameId,
      { timeout: timeoutMs }
    )
    .catch(() => null);
}

async function readActiveThread(page, profileId) {
  return page.evaluate((profileId) => {
    const profile = window.TasuPlatformChatDualWindowDemo?.getProfile?.(profileId, false);
    const method = new URLSearchParams(location.search).get("paymentMethod") || "prepaid";
    const rows = (window.TasuChatThreadStore?.readAll?.() || []).filter(
      (t) => String(t.listingId) === String(profile?.listingId)
    );
    const scoped = rows.filter((t) => String(t.paymentMethod || "prepaid") === method);
    const pool = scoped.length ? scoped : rows;
    const thread =
      pool.find((t) => String(t.roomStatus || t.status).toLowerCase() === "active") ||
      pool
        .slice()
        .sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")))[0] ||
      null;
    return { thread, profile };
  }, profileId);
}

async function refreshChatFramesFromStore(page, profileId) {
  await page.evaluate((profileId) => {
    const profile = window.TasuPlatformChatDualWindowDemo?.getProfile?.(profileId, false);
    const Live = window.TasuPlatformChatLiveFlow;
    const thread = (window.TasuChatThreadStore?.readAll?.() || []).find(
      (t) => String(t.listingId) === String(profile?.listingId)
    );
    if (!profile || !thread?.id) return;
    const open = (frameId, uid) => {
      const frame = document.getElementById(frameId);
      if (!frame) return;
      const raw = Live?.chatUrl?.(profile, uid, { threadId: thread.id }) || "";
      const url = new URL(raw, window.location.origin);
      url.searchParams.set("_ts", String(Date.now()));
      frame.src = `${url.pathname}${url.search}`;
    };
    open("frame-a-chat", profile.partnerAId);
    open("frame-b-chat", profile.partnerBId);
  }, profileId);
}

async function runPurchaseFlowAction(page, profileId, threadId, action) {
  return page.evaluate(({ profileId, threadId, action }) => {
    const profile = window.TasuPlatformChatDualWindowDemo?.getProfile?.(profileId, false);
    const thread = (window.TasuChatThreadStore?.readAll?.() || []).find(
      (t) => String(t.id) === String(threadId)
    );
    if (!thread?.id) return { ok: false, reason: "no_thread" };

    const Purchase = window.TasuPlatformChatPurchasePaymentFlow;
    const Completion = window.TasuPlatformChatCompletionFlow;
    const sellerId = profile.partnerAId;
    const buyerId = profile.partnerBId;
    const id = thread.id;

    const dispatch = {
      ship: () => {
        const payload = { threadId: id, thread, userId: sellerId };
        if (Purchase?.getPaymentMethod?.(thread) === "cash_on_delivery") {
          payload.carrier = "ヤマト運輸";
          payload.tracking = "1234567890";
        }
        return Completion?.markProductShipped?.(payload);
      },
      shipping_ready: () => Purchase?.markShippingReady?.({ threadId: id, thread, userId: sellerId }),
      bank_report: () => Purchase?.reportBankTransfer?.({ threadId: id, thread, userId: buyerId }),
      payment_confirm: () => Purchase?.confirmBankPayment?.({ threadId: id, thread, userId: sellerId }),
      receive: () => Purchase?.markProductReceived?.({ threadId: id, thread, userId: buyerId }),
      cod_report: () => Purchase?.reportCodPayment?.({ threadId: id, thread, userId: buyerId }),
      cod_confirm: () => Purchase?.confirmCodCollection?.({ threadId: id, thread, userId: sellerId }),
    };
    const fn = dispatch[action];
    if (!fn) return { ok: false, reason: "unknown_action" };
    const res = fn();
    const latest = (window.TasuChatThreadStore?.readAll?.() || []).find((t) => String(t.id) === String(id));
    return { ...(res || { ok: false }), thread: latest || thread };
  }, { profileId, threadId, action });
}

async function readThreadState(page, profileId) {
  return page.evaluate((profileId) => {
    const profile = window.TasuPlatformChatDualWindowDemo?.getProfile?.(profileId, false);
    const threads = JSON.parse(localStorage.getItem("tasful_chat_threads") || "[]");
    const thread = threads.find(
      (t) =>
        String(t.listingId) === String(profile?.listingId) &&
        (String(t.buyerId) === String(profile?.partnerBId) ||
          String(t.sellerId) === String(profile?.partnerAId))
    );
    return { thread, threadId: thread?.id || "" };
  }, profileId);
}

async function bootstrapPurchaseChat(page, profileId) {
  return page.evaluate((profileId) => {
    const Demo = window.TasuPlatformChatDualWindowDemo;
    const Live = window.TasuPlatformChatLiveFlow;
    const Contacts = window.TasuListingContactRequestsStore;
    const Fee = window.TasuPlatformChatFee;
    const profile = Demo?.getProfile?.(profileId, false);
    if (!profile) return { ok: false, reason: "no_profile" };

    Live?.resetLiveFlow?.({ profile: profileId, connect: false });

    const listing = Contacts?.resolveListing?.(profile.listingId) || {
      id: profile.listingId,
      listing_type: profile.listingType,
      listingType: profile.listingType,
      title: profile.listingTitle,
    };
    if (!String(listing.listing_type || listing.listingType || "").trim()) {
      listing.listing_type = profile.listingType;
      listing.listingType = profile.listingType;
    }

    let contact = Live?.readBenchPreStartRecord?.(profile);
    if (!contact) {
      const submitted = Contacts?.submitContact?.(listing, { intent: "purchase" });
      if (!submitted?.ok && submitted?.reason !== "already_submitted") {
        return { ok: false, reason: submitted?.reason || "submit_failed" };
      }
      contact = submitted?.contact || Live?.readBenchPreStartRecord?.(profile);
    }
    if (!contact?.contact_id) return { ok: false, reason: "no_contact" };

    Fee?.ensurePendingFeeDeferred?.({
      listing,
      contactId: contact.contact_id,
      feeAmount: Fee?.calcPreChatFee?.(listing) || 550,
    });
    Fee?.markFeePaid?.(contact.contact_id, { listingId: profile.listingId });

    const activated = Fee?.activateDeferredAfterPayment?.({
      contactId: contact.contact_id,
      listingId: profile.listingId,
    });
    if (!activated?.ok) {
      return { ok: false, reason: activated?.reason || "activate_failed" };
    }

    const threadId = String(activated.threadId || activated.thread?.id || "");
    if (!threadId) return { ok: false, reason: "no_thread_id" };

    const aUrl = Live?.chatUrl?.(profile, profile.partnerAId, { threadId });
    const bUrl = Live?.chatUrl?.(profile, profile.partnerBId, { threadId });
    const aFrame = document.getElementById("frame-a-chat");
    const bFrame = document.getElementById("frame-b-chat");
    if (aUrl && aFrame) aFrame.src = aUrl;
    if (bUrl && bFrame) bFrame.src = bUrl;

    return { ok: true, threadId, paymentMethod: new URLSearchParams(location.search).get("paymentMethod") || "prepaid" };
  }, profileId);
}

async function countNgFailures(page) {
  return page.evaluate(() => {
    const Diag = window.TasuPlatformChatBenchFlowDiag;
    const panel = window.__tasuBenchFlowDiagPanel;
    const snapshot = panel?.snapshot;
    if (!Diag?.evaluateBenchDisplayFailures || !snapshot) {
      return { count: -1, codes: [], reason: "diag_unavailable" };
    }
    const { failures } = Diag.evaluateBenchDisplayFailures(snapshot, panel?.stages || {});
    const purchase = failures.filter(
      (f) =>
        !f.isDomConsistency &&
        (/product_|purchase_/.test(String(f.code)) ||
          /bank_transfer|cod_|shipping_ready|payment_confirm/.test(String(f.cause)))
    );
    return {
      count: purchase.length || failures.filter((f) => !f.isDomConsistency).length,
      codes: purchase.map((f) => `${f.code}:${f.cause}`),
      total: failures.length,
    };
  });
}

async function runFlow(page, profile, method) {
  const key = `${profile.id}/${method}`;
  console.log(`\n--- ${key} ---`);

  await page.goto(await benchUrl(profile, method), { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(800);

  const started = await bootstrapPurchaseChat(page, profile.id);
  if (!started?.ok) {
    pushErr(key, `chat start failed: ${started?.reason}`);
    return;
  }
  const threadId = started.threadId;
  const steps =
    method === "bank_transfer"
      ? ["bank_report", "payment_confirm", "ship", "receive"]
      : method === "cash_on_delivery"
        ? ["ship", "receive"]
        : ["ship", "receive"];

  if (method === "bank_transfer") {
    const canEarlyShip = await page.evaluate(
      ({ threadId, sellerId }) => {
        const thread = (window.TasuChatThreadStore?.readAll?.() || []).find(
          (t) => String(t.id) === String(threadId)
        );
        return window.TasuPlatformChatPurchasePaymentFlow?.canMarkProductShipped?.(thread, sellerId) === true;
      },
      { threadId, sellerId: profile.partnerA }
    );
    if (canEarlyShip) {
      pushErr(key, "bank_transfer: ship allowed before payment confirm");
    }
    const blocked = await runPurchaseFlowAction(page, profile.id, threadId, "ship");
    if (blocked?.ok) {
      pushErr(key, "bank_transfer: ship succeeded before payment confirm");
    }
  }

  for (const action of steps) {
    const res = await runPurchaseFlowAction(page, profile.id, threadId, action);
    if (!res?.ok) {
      pushErr(key, `${action} failed: ${res?.reason || "unknown"}`);
      break;
    }
    await page.waitForTimeout(200);
  }

  const state = await page.evaluate(({ threadId }) => {
    const thread = (window.TasuChatThreadStore?.readAll?.() || []).find(
      (t) => String(t.id) === String(threadId)
    );
    return {
      threadId: thread?.id || "",
      paymentMethod: thread?.paymentMethod,
      productShipped: thread?.productShipped,
      productReceived: thread?.productReceived,
      shippingReady: thread?.shippingReady,
      bankTransferReported: thread?.bankTransferReported,
      paymentConfirmed: thread?.paymentConfirmed,
      codPaymentReported: thread?.codPaymentReported,
      cashOnDeliveryConfirmed: thread?.cashOnDeliveryConfirmed,
      completed: thread?.completed === true || String(thread?.roomStatus || thread?.status) === "completed",
    };
  }, { threadId });

  const ng = await countNgFailures(page);

  if (!state.completed) pushErr(key, `not completed: ${JSON.stringify(state)}`);
  if (ng.count > 0) pushErr(key, `NG count=${ng.count} ${ng.codes.join("; ")}`);

  console.log(`  state=${JSON.stringify(state)} ng=${ng.count}`);
}

const exitCode = await withPlaywrightSession(
  async ({ page }) => {
    page.on("dialog", async (d) => d.accept());
    for (const profile of PROFILES) {
      for (const method of METHODS) {
        await runFlow(page, profile, method);
      }
    }
    const report = { ok: errors.length === 0, errors, base: BASE };
    fs.writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    return errors.length ? 1 : 0;
  },
  { viewport: { width: 1440, height: 900 } }
);
process.exit(exitCode);
