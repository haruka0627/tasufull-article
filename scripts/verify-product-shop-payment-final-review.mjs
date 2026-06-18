#!/usr/bin/env node
/**
 * product / shop × prepaid / bank_transfer / cash_on_delivery
 * 最終確認（スクショ禁止）— DOM / textContent / localStorage / notify iframe / postMessage / NG全部コピー
 *
 * 運用ルール: スクショ禁止 / 並列禁止 / 1 CASE ずつ / finally close / 長時間 wait 禁止
 * NG全部コピーはテキストファイルのみ（ng-bulk-copy.txt）
 *
 * ① A側ボタン ② B側ボタン ③ 通知 ④ チャット内ステータス ⑤ 完了後レビュー ⑥ NG全部コピー
 */
const GOTO_TIMEOUT_MS = 20000;
const CHAT_READY_TIMEOUT_MS = 6000;
const STEP_PAUSE_MS = 250;
const BOOT_PAUSE_MS = 800;

import { launchHeadlessBrowser } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const OUT_DIR = path.join("reports", "product-shop-payment-final-verify");
fs.mkdirSync(OUT_DIR, { recursive: true });

function pickStr(...vals) {
  for (const v of vals) {
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

const PROFILES = [
  { id: "product", pattern: "product-0", partnerA: "u_product", partnerB: "u_hiro" },
  { id: "shop", pattern: "shop-1", partnerA: "u_shop_demo", partnerB: "u_hiro" },
];
const METHODS = ["prepaid", "bank_transfer", "cash_on_delivery"];

const FLOW_STEPS = {
  prepaid: [
    { id: "01-start", label: "開始直後", actions: [] },
    { id: "02-after-ship", label: "A発送後", actions: ["ship"] },
    { id: "03-after-receive", label: "B受取/完了後", actions: ["receive"] },
  ],
  bank_transfer: [
    { id: "01-start", label: "開始直後", actions: [] },
    { id: "02-after-bank-report", label: "B振込報告後", actions: ["bank_report"] },
    { id: "03-after-payment-confirm", label: "A入金確認後", actions: ["payment_confirm"] },
    { id: "04-after-ship", label: "A発送後", actions: ["ship"] },
    { id: "05-after-receive", label: "B受取/完了後", actions: ["receive"] },
  ],
  cash_on_delivery: [
    { id: "01-start", label: "開始直後", actions: [] },
    { id: "02-after-ship", label: "A発送後", actions: ["ship"] },
    { id: "03-after-receive", label: "B受取/完了後", actions: ["receive"] },
  ],
};

const IGNORE_NG = new Set([
  "chat_diag_ok_but_composer",
  "chat_diag_ok_but_composer_missing_dom",
  "chat_detail_script_not_loaded",
  "a_chat_load_ready_missing",
  "product_shipping_postmessage_missing",
  "product_receive_ui_blocked_by_frozen_iframe",
  // purchase payment verify はチャット手入力メッセージを送らない
  "notification_store_not_written",
]);

function benchUrl(profile, method) {
  const u = new URL(`${BASE}/chat-dual-window-demo.html`);
  u.searchParams.set("talkDev", "1");
  u.searchParams.set("review", "chat-demo");
  u.searchParams.set("demoProfile", profile.id);
  u.searchParams.set("demoConnect", profile.id === "shop" ? "1" : "0");
  u.searchParams.set("liveFlow", "1");
  u.searchParams.set("userId", profile.partnerB);
  u.searchParams.set("benchViewport", "390");
  u.searchParams.set("benchPattern", profile.pattern);
  u.searchParams.set("liveFlowReset", "1");
  if (method !== "prepaid") u.searchParams.set("paymentMethod", method);
  return u.toString();
}

async function bootstrapPurchaseChat(page, profileId) {
  return page.evaluate((profileId) => {
    const Demo = window.TasuPlatformChatDualWindowDemo;
    const Live = window.TasuPlatformChatLiveFlow;
    const Contacts = window.TasuListingContactRequestsStore;
    const Fee = window.TasuPlatformChatFee;
    const isShop = profileId === "shop";
    const useConnect = isShop;
    const profile = Demo?.getProfile?.(profileId, useConnect);
    if (!profile) return { ok: false, reason: "no_profile" };
    Live?.resetLiveFlow?.({ profile: profileId, connect: useConnect });
    let listing = Contacts?.resolveListing?.(profile.listingId) || {
      id: profile.listingId,
      listing_type: profile.listingType,
      listingType: profile.listingType,
      title: profile.listingTitle,
    };
    if (!String(listing.listing_type || listing.listingType || "").trim()) {
      listing = { ...listing, listing_type: profile.listingType, listingType: profile.listingType };
    }

    if (isShop && useConnect) {
      Demo?.seedPreStartDemoState?.(profile);
      let contact = Live?.readBenchPreStartRecord?.(profile);
      if (!contact) {
        const submitted = Contacts?.submitContact?.(listing, {
          intent: "purchase",
          productId: "0",
          productName: profile.listingTitle,
        });
        if (!submitted?.ok && submitted?.reason !== "already_submitted") {
          return { ok: false, reason: submitted?.reason || "submit_failed" };
        }
        contact = submitted?.contact || Live?.readBenchPreStartRecord?.(profile);
      }
      if (!contact?.contact_id) return { ok: false, reason: "no_contact" };
      const activated = Contacts?.beginContactChat?.(profile.listingId, contact.contact_id);
      if (!activated?.ok) return { ok: false, reason: activated?.reason || "activate_failed" };
      const threadId = String(activated.threadId || activated.contact?.thread_id || "");
      if (!threadId) return { ok: false, reason: "no_thread" };
      const aUrl = Live?.chatUrl?.(profile, profile.partnerAId, { threadId });
      const bUrl = Live?.chatUrl?.(profile, profile.partnerBId, { threadId });
      const aFrame = document.getElementById("frame-a-chat");
      const bFrame = document.getElementById("frame-b-chat");
      if (aUrl && aFrame) aFrame.src = aUrl;
      if (bUrl && bFrame) bFrame.src = bUrl;
      return {
        ok: true,
        threadId,
        paymentMethod: new URLSearchParams(location.search).get("paymentMethod") || "prepaid",
      };
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
    if (!activated?.ok) return { ok: false, reason: activated?.reason || "activate_failed" };
    const threadId = String(activated.threadId || activated.thread?.id || "");
    const aUrl = Live?.chatUrl?.(profile, profile.partnerAId, { threadId });
    const bUrl = Live?.chatUrl?.(profile, profile.partnerBId, { threadId });
    const aFrame = document.getElementById("frame-a-chat");
    const bFrame = document.getElementById("frame-b-chat");
    if (aUrl && aFrame) aFrame.src = aUrl;
    if (bUrl && bFrame) bFrame.src = bUrl;
    return { ok: true, threadId, paymentMethod: new URLSearchParams(location.search).get("paymentMethod") || "prepaid" };
  }, profileId);
}

async function runAction(page, profileId, threadId, action) {
  return page.evaluate(
    ({ profileId, threadId, action }) => {
      const profile = window.TasuPlatformChatDualWindowDemo?.getProfile?.(
        profileId,
        profileId === "shop"
      );
      const thread = (window.TasuChatThreadStore?.readAll?.() || []).find((t) => String(t.id) === String(threadId));
      if (!thread) return { ok: false, reason: "no_thread" };
      const Purchase = window.TasuPlatformChatPurchasePaymentFlow;
      const Completion = window.TasuPlatformChatCompletionFlow;
      const sellerId = profile.partnerAId;
      const buyerId = profile.partnerBId;
      const id = thread.id;
      const map = {
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
      const res = map[action]?.();
      return res || { ok: false, reason: "unknown_action" };
    },
    { profileId, threadId, action }
  );
}

async function waitForBenchSettled(page, timeoutMs = 8000) {
  await page
    .waitForFunction(
      () => {
        const ids = ["frame-a-chat", "frame-b-chat", "frame-a-notify", "frame-b-notify"];
        return ids.every((id) => {
          const el = document.getElementById(id);
          return el && !el.dataset.benchNavigating;
        });
      },
      null,
      { timeout: timeoutMs }
    )
    .catch(() => null);
  await page.waitForTimeout(300);
}

function isPurchasePaymentProfileId(profileId) {
  return profileId === "product" || profileId === "shop";
}

async function softSyncChatFrames(page, threadId, reason) {
  await page.evaluate(
    ({ threadId, reason }) => {
      const trim = (v) => (v != null && String(v).trim() !== "" ? String(v).trim() : "");
      const chatFrameIds = ["frame-a-chat", "frame-b-chat"];
      const softSync = (frameId) => {
        const href =
          document.getElementById(frameId)?.contentWindow?.location?.href ||
          document.getElementById(frameId)?.src ||
          "";
        if (!/chat-detail\.html/i.test(href)) return false;
        const syncReason = trim(reason) || "verify_soft_sync";
        if (typeof window.softSyncBenchChatRoomState === "function") {
          return window.softSyncBenchChatRoomState(frameId, threadId, {
            force: true,
            reason: syncReason,
          });
        }
        const win = document.getElementById(frameId)?.contentWindow;
        if (!win) return false;
        win.postMessage?.({ type: "tasu-chat-reload-room", threadId, reason: syncReason }, "*");
        if (typeof win.__tasuChatDetailReload === "function") {
          win.__tasuChatDetailReload({ threadId, forceStoreResync: true });
        }
        return true;
      };
      chatFrameIds.forEach(softSync);
    },
    { threadId, reason }
  );
}

async function refreshFrames(page, profileId, threadId) {
  await page.mouse.click(8, 8).catch(() => null);

  const result = await page.evaluate(
    ({ profileId, threadId }) => {
      const trim = (v) => (v != null && String(v).trim() !== "" ? String(v).trim() : "");
      const relPath = (raw) => {
        const href = trim(raw);
        if (!href) return "";
        try {
          const u = new URL(href, location.origin);
          return `${u.pathname}${u.search}`;
        } catch {
          return href;
        }
      };
      const isChatDetailHref = (href) => /chat-detail\.html/i.test(href || "");
      const readMountedHref = (frameId) => {
        const el = document.getElementById(frameId);
        if (!el) return "";
        try {
          return trim(el.contentWindow?.location?.href, el.src);
        } catch {
          return trim(el.src);
        }
      };

      const profile = window.TasuPlatformChatDualWindowDemo?.getProfile?.(
        profileId,
        profileId === "shop"
      );
      const Live = window.TasuPlatformChatLiveFlow;
      const useSoftSync = profile?.id === "product" || profile?.id === "shop";
      const chatFrameIds = ["frame-a-chat", "frame-b-chat"];
      const srcBefore = Object.fromEntries(chatFrameIds.map((id) => [id, trim(document.getElementById(id)?.src)]));

      const softSync = (frameId) => {
        if (!isChatDetailHref(readMountedHref(frameId))) return false;
        if (typeof window.softSyncBenchChatRoomState === "function") {
          return window.softSyncBenchChatRoomState(frameId, threadId, {
            force: true,
            reason: "verify_refresh_frames_soft_sync",
          });
        }
        const win = document.getElementById(frameId)?.contentWindow;
        if (!win) return false;
        win.postMessage?.(
          { type: "tasu-chat-reload-room", threadId, reason: "verify_refresh_frames_soft_sync" },
          "*"
        );
        if (typeof win.__tasuChatDetailReload === "function") {
          win.__tasuChatDetailReload({ threadId, forceStoreResync: true });
        }
        return true;
      };

      const appendEmbedParams = (raw, uid) => {
        try {
          const u = new URL(raw, location.origin);
          u.searchParams.set("benchEmbed", "1");
          u.searchParams.set("liveFlow", "1");
          u.searchParams.set("review", "chat-demo");
          u.searchParams.set("demoProfile", profileId);
          u.searchParams.set("demoConnect", profileId === "shop" ? "1" : "0");
          if (uid) u.searchParams.set("userId", uid);
          return `${u.pathname}${u.search}`;
        } catch {
          return relPath(raw);
        }
      };

      const ensurePurchaseChatFrame = (frameId, uid) => {
        const frame = document.getElementById(frameId);
        if (!frame || !profile) return { action: "missing_frame" };
        const mounted = readMountedHref(frameId);
        const targetRaw = Live?.chatUrl?.(profile, uid, { threadId }) || "";
        const target = appendEmbedParams(targetRaw, uid);
        if (!target) return { action: "no_target", mounted, target: "" };

        if (isChatDetailHref(mounted)) {
          softSync(frameId);
          return { action: "soft_sync", mounted, target, srcTouched: false, forcedReload: false };
        }

        const prevSrc = trim(frame.src);
        frame.src = target;
        return {
          action: "mount",
          mounted,
          target,
          srcTouched: prevSrc !== target,
          forcedReload: false,
          wasBlank: mounted === "about:blank" || !mounted,
        };
      };

      const ensureNotifyFrame = (frameId, uid) => {
        const frame = document.getElementById(frameId);
        if (!frame || !profile) return { action: "missing_frame" };
        const mounted = readMountedHref(frameId);
        if (mounted && mounted !== "about:blank") {
          frame.contentWindow?.postMessage?.({ type: "tasu-bench-notify-refresh" }, "*");
          return { action: "notify_refresh", mounted, srcTouched: false, forcedReload: false };
        }
        const targetRaw = Live?.notifyTabUrl?.(profile, uid) || "";
        const target = appendEmbedParams(targetRaw, uid);
        if (!target) return { action: "no_target", mounted, target: "" };
        const prevSrc = trim(frame.src);
        frame.src = target;
        return {
          action: "notify_mount",
          mounted,
          target,
          srcTouched: prevSrc !== target,
          forcedReload: false,
        };
      };

      const chatActions = [];
      if (useSoftSync) {
        chatActions.push(ensurePurchaseChatFrame("frame-a-chat", profile.partnerAId));
        chatActions.push(ensurePurchaseChatFrame("frame-b-chat", profile.partnerBId));
      } else {
        const bump = (frameId, uid) => {
          const frame = document.getElementById(frameId);
          if (!frame) return;
          const raw = Live?.chatUrl?.(profile, uid, { threadId }) || "";
          const url = new URL(raw, location.origin);
          url.searchParams.set("_ts", String(Date.now()));
          frame.src = `${url.pathname}${url.search}`;
        };
        bump("frame-a-chat", profile.partnerAId);
        bump("frame-b-chat", profile.partnerBId);
        chatActions.push({ action: "src_reload" }, { action: "src_reload" });
      }

      const notifyActions = [
        ensureNotifyFrame("frame-a-notify", profile?.partnerAId),
        ensureNotifyFrame("frame-b-notify", profile?.partnerBId),
      ];

      if (useSoftSync) {
        window.__tasuBenchReconcile?.({ skipRender: true });
      } else {
        window.__tasuBenchReconcile?.({ skipRender: false });
      }

      const srcAfter = Object.fromEntries(chatFrameIds.map((id) => [id, trim(document.getElementById(id)?.src)]));
      const chatDetailSrcReloaded = chatFrameIds.some((id) => {
        const before = srcBefore[id];
        const after = srcAfter[id];
        return before !== after && isChatDetailHref(before) && isChatDetailHref(after);
      });

      return {
        mode: useSoftSync ? "soft_sync" : "src_reload",
        srcReloaded: chatFrameIds.some((id) => srcBefore[id] !== srcAfter[id]),
        chatDetailSrcReloaded,
        forcedReload: chatDetailSrcReloaded,
        srcBefore,
        srcAfter,
        chatActions,
        notifyActions,
      };
    },
    { profileId, threadId }
  );

  if (result?.mode === "soft_sync") {
    await page.waitForTimeout(400);
    await softSyncChatFrames(page, threadId, "verify_soft_sync_retry_400");
    await page.waitForTimeout(850);
    await softSyncChatFrames(page, threadId, "verify_soft_sync_retry_1200");
    await waitChatReady(page, "frame-a-chat", 10000);
    await waitChatReady(page, "frame-b-chat", 10000);
    await page.waitForTimeout(STEP_PAUSE_MS);
  }

  return result;
}

async function waitChatReady(page, frameId, timeoutMs = CHAT_READY_TIMEOUT_MS) {
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

async function analyzeVerdict(page, profileId, threadId) {
  return page.evaluate(
    ({ profileId, threadId, ignoreNg }) => {
      const profile = window.TasuPlatformChatDualWindowDemo?.getProfile?.(
        profileId,
        profileId === "shop"
      );
      const sides = window.TasuPlatformChatDualWindowDemo?.getSideMeta?.(profile);
      const FlowDiag = window.TasuPlatformChatBenchFlowDiag;
      const thread = (window.TasuChatThreadStore?.readAll?.() || []).find((t) => String(t.id) === String(threadId));
      if (!FlowDiag?.analyzeStageVerdicts || !profile || !sides) {
        return { ok: false, reason: "diag_unavailable" };
      }
      const panel = FlowDiag.analyzeStageVerdicts(
        { profile, sides, threadId, thread },
        { diagFocus: "completion", lightMode: true }
      );
      window.__tasuBenchStageVerdicts = panel;
      window.__tasuBenchNgBlocksBulkCopyText = panel?.ngBlocksBulkCopyText || "";
      const { failures } = FlowDiag.evaluateBenchDisplayFailures(panel.snapshot, panel.stages, { lightMode: true });
      const skip = Array.isArray(ignoreNg) ? ignoreNg : [];
      const isIgnored = (f) => {
        const code = String(f.code || "");
        const cause = String(f.cause || "");
        return skip.some((ig) => code.includes(ig) || cause.includes(ig));
      };
      const business = failures.filter((f) => !f.isDomConsistency && !isIgnored(f));
      const diagnostic = failures.filter((f) => !f.isDomConsistency && isIgnored(f));
      return {
        ok: true,
        ngCount: business.length,
        ngCodes: business.map((f) => `${f.code}:${f.cause}`),
        diagnosticNgCount: diagnostic.length,
        diagnosticNgCodes: diagnostic.map((f) => `${f.code}:${f.cause}`),
        ngBulkCopy: String(panel.ngBlocksBulkCopyText || "").slice(0, 12000),
      };
    },
    { profileId, threadId, ignoreNg: [...IGNORE_NG] }
  );
}

async function readChatDom(page, frameId) {
  return page.evaluate((id) => {
    const trim = (v) => (v != null && String(v).trim() !== "" ? String(v).trim() : "");
    const doc = document.getElementById(id)?.contentWindow?.document;
    if (!doc) {
      return {
        button: { visible: false, text: "", mode: "", reason: "no_frame" },
        status: { visible: false, text: "", reason: "no_frame" },
        review: { visible: false, text: "", reason: "no_frame" },
      };
    }
    const probeVisible = (el) => {
      if (!el || el.hidden) return false;
      const st = doc.defaultView?.getComputedStyle?.(el);
      if (!st || st.display === "none" || st.visibility === "hidden") return false;
      const r = el.getBoundingClientRect?.();
      return Boolean(r && r.width > 20 && r.height > 8);
    };
    const completeBtn = doc.getElementById("chatCompleteBtn");
    const barBtn = doc.getElementById("chatJobEndBarBtn");
    const notice = doc.getElementById("chatRoomStatusNotice");
    const shippingCard = doc.querySelector("[data-platform-shipping-card]");
    const readShippingRow = (label) => {
      if (!shippingCard) return "";
      const rows = shippingCard.querySelectorAll(".chat-shipping-card__rows > div");
      for (const row of rows) {
        const dt = row.querySelector("dt");
        if (trim(dt?.textContent) === label) {
          return trim(row.querySelector("dd")?.textContent);
        }
      }
      return "";
    };
    const review = doc.querySelector(
      "[data-platform-review-open], [data-platform-job-review-open], .chat-review-btn, [data-platform-job-review-prompt]"
    );
    const barVisible = Boolean(
      barBtn &&
        (barBtn.classList.contains("chat-job-end-bar__btn--visible") ||
          (!barBtn.hidden && trim(barBtn.textContent)))
    );
    const topVisible = probeVisible(completeBtn);
    const buttonVisible = barVisible || topVisible;
    const readBtnText = (el) =>
      trim(el?.innerText, el?.textContent, el?.getAttribute("aria-label"));
    const buttonText = trim(
      barVisible ? readBtnText(barBtn) : "",
      topVisible ? readBtnText(completeBtn) : ""
    );
    const buttonMode = trim(
      barVisible ? barBtn?.getAttribute("data-primary-action") : "",
      topVisible ? completeBtn?.getAttribute("data-primary-action") : ""
    );
    return {
      button: {
        visible: buttonVisible,
        text: buttonText,
        mode: buttonMode,
      },
      status: {
        visible: probeVisible(notice),
        text: probeVisible(notice) ? trim(notice.textContent) : "",
      },
      shippingCard: {
        visible: Boolean(shippingCard),
        title: trim(shippingCard?.querySelector(".chat-shipping-card__title")?.textContent),
        carrier: readShippingRow("配送会社"),
        tracking: readShippingRow("追跡番号"),
      },
      review: {
        visible: probeVisible(review),
        text: trim(review?.textContent),
      },
    };
  }, frameId);
}

async function readBenchDiagPanel(page) {
  return page.evaluate(() => {
    const trim = (v) => (v != null && String(v).trim() !== "" ? String(v).trim() : "");
    const fold = document.getElementById("benchVerdictFold");
    const panel = document.getElementById("benchRootCausePanel");
    const text = trim(panel?.textContent);
    const ngBulk = trim(window.__tasuBenchNgBlocksBulkCopyText);
    const receiveNg = (() => {
      try {
        const FlowDiag = window.TasuPlatformChatBenchFlowDiag;
        const panelData = window.__tasuBenchStageVerdicts;
        const { failures } = FlowDiag?.evaluateBenchDisplayFailures?.(
          panelData?.snapshot,
          panelData?.stages,
          { lightMode: true, includePurchaseRuntime: true }
        ) || { failures: [] };
        return failures
          .filter((f) => f.code === "product_bank_transfer_receive_ui_missing")
          .map((f) => `${f.code}:${f.cause}`);
      } catch {
        return [];
      }
    })();
    return {
      verdictFoldOpen: fold?.open === true,
      panelInitialized:
        window.__tasuBenchDiagInitialized === true ||
        (fold?.open === true && ngBulk.length > 40),
      panelStillBooting: /診断中…/.test(text) && ngBulk.length < 1,
      panelTextHead: text.slice(0, 120),
      ngBulkCopyLen: ngBulk.length,
      ngBulkHasCause: /cause:|原因:/.test(ngBulk),
      receiveUiNgCodes: receiveNg,
    };
  });
}

async function ensureBenchDiagPanel(page, profileId, threadId) {
  await page.evaluate(
    ({ profileId, threadId }) => {
      const fold = document.getElementById("benchVerdictFold");
      if (fold) fold.open = true;
      const profile = window.TasuPlatformChatDualWindowDemo?.getProfile?.(
        profileId,
        profileId === "shop"
      );
      const sides = window.TasuPlatformChatDualWindowDemo?.getSideMeta?.(profile);
      const FlowDiag = window.TasuPlatformChatBenchFlowDiag;
      const thread = (window.TasuChatThreadStore?.readAll?.() || []).find(
        (t) => String(t.id) === String(threadId)
      );
      if (!FlowDiag?.analyzeStageVerdicts || !profile || !sides) return;
      const panel = FlowDiag.analyzeStageVerdicts(
        { profile, sides, threadId, thread },
        { diagFocus: "completion", lightMode: true, includePurchaseRuntime: true }
      );
      window.__tasuBenchStageVerdicts = panel;
      window.__tasuBenchNgBlocksBulkCopyText = panel?.ngBlocksBulkCopyText || "";
      window.__tasuBenchDiagInitialized = true;
      const el = document.getElementById("benchRootCausePanel");
      if (el && !/診断中/.test(String(el.textContent || ""))) return;
      const ngCount = FlowDiag.evaluateBenchDisplayFailures?.(panel.snapshot, panel.stages, {
        lightMode: true,
        includePurchaseRuntime: true,
      })?.failures?.filter((f) => !f.isDomConsistency)?.length;
      if (el) {
        el.textContent =
          Number(ngCount) > 0
            ? `NG ${ngCount}件 — verify diag ready`
            : "診断 OK（verify）";
      }
    },
    { profileId, threadId }
  );
  await page.waitForTimeout(400);
}

function validateShippingCardUi(cp, method) {
  const errors = [];
  const thread = cp.thread || {};
  const expectTracking = Boolean(thread.trackingNumber) || method === "cash_on_delivery";
  for (const side of ["sideA", "sideB"]) {
    const label = side === "sideA" ? "A" : "B";
    const card = cp[side]?.shippingCard;
    if (!card?.visible) {
      errors.push(`${label}側配送情報カードなし`);
      continue;
    }
    if (!card.carrier) {
      errors.push(`${label}側配送会社なし`);
    }
    if (expectTracking && !card.tracking) {
      errors.push(`${label}側追跡番号なし`);
    }
  }
  return errors;
}

function validateBankTransferBShipUi(cp, diag) {
  const errors = [];
  if (!cp.sideB.status.visible || !cp.sideB.status.text) {
    errors.push("B側ステータス通知なし");
  }
  if (!cp.sideB.shippingCard?.visible) {
    errors.push("B側配送情報カードなし");
  }
  const receiveBtnOk =
    cp.sideB.button.mode === "purchase_receive" ||
    (/受け取り|受取|商品を受け取り/.test(cp.sideB.button.text || "") &&
      cp.sideB.button.visible === true);
  if (!receiveBtnOk) {
    errors.push("B側「商品を受け取りました」ボタンなし");
  }
  if (!diag?.panelInitialized && diag?.panelStillBooting) {
    errors.push("原因パネル未初期化");
  }
  if (!diag?.ngBulkCopyLen) {
    errors.push("NG全部コピー空");
  }
  const receiveNg = cp.verdict?.ngCodes?.filter((c) => c.includes("product_bank_transfer_receive_ui_missing")) || [];
  if (errors.length > 0 && receiveNg.length === 0) {
    errors.push("product_bank_transfer_receive_ui_missing が未検出");
  }
  return errors;
}

async function readNotifySide(page, frameId, uid) {
  const dom = await page.evaluate((id) => {
    const trim = (v) => (v != null && String(v).trim() !== "" ? String(v).trim() : "");
    const doc = document.getElementById(id)?.contentWindow?.document;
    const cards = doc ? [...doc.querySelectorAll(".talk-notify-card")] : [];
    return {
      domCardCount: cards.length,
      domTitles: cards
        .slice(0, 8)
        .map((c) => trim(c.querySelector(".talk-notify-card__title, .talk-notify-card__title--job-event")?.textContent)),
    };
  }, frameId);
  const storage = await page.evaluate((recipientId) => {
    const trim = (v) => (v != null && String(v).trim() !== "" ? String(v).trim() : "");
    let rows = [];
    try {
      rows = JSON.parse(localStorage.getItem("tasful_talk_notifications") || "[]");
    } catch {
      rows = [];
    }
    const storeApi = (() => {
      try {
        return (window.TasuTalkNotifications?.getAll?.() || []).filter(
          (n) => String(n.recipientUserId) === recipientId
        );
      } catch {
        return [];
      }
    })();
    const filter = (list) =>
      list
        .filter((n) => String(n.recipientUserId) === recipientId)
        .slice(0, 8)
        .map((n) => ({
          title: trim(n.title),
          actionLabel: trim(n.actionLabel),
          source: trim(n.source),
        }));
    return { localStorage: filter(rows), storeApi: filter(storeApi) };
  }, uid);
  return { ...dom, ...storage };
}

async function readPostMessageLog(page, uid, threadId) {
  return page.evaluate(
    ({ uid, threadId }) => {
      const log = window.__tasuBenchRuntimeNotifyLog || {};
      const deliveries = Array.isArray(log.deliveries) ? log.deliveries : [];
      return deliveries
        .filter((d) => String(d.recipientUserId) === uid)
        .filter((d) => !threadId || !d.threadId || String(d.threadId) === String(threadId))
        .slice(0, 12)
        .map((d) => ({
          title: String(d.title || ""),
          kind: String(d.kind || ""),
          source: String(d.source || ""),
          threadId: String(d.threadId || ""),
        }));
    },
    { uid, threadId }
  );
}

async function readThreadState(page, threadId) {
  return page.evaluate((threadId) => {
    const thread = (window.TasuChatThreadStore?.readAll?.() || []).find((t) => String(t.id) === String(threadId));
    return {
      id: thread?.id,
      paymentMethod: thread?.paymentMethod,
      productShipped: thread?.productShipped,
      shippingCarrier: thread?.shippingCarrier,
      trackingNumber: thread?.trackingNumber,
      productReceived: thread?.productReceived,
      shippingReady: thread?.shippingReady,
      bankTransferReported: thread?.bankTransferReported,
      paymentConfirmed: thread?.paymentConfirmed,
      codPaymentReported: thread?.codPaymentReported,
      cashOnDeliveryConfirmed: thread?.cashOnDeliveryConfirmed,
      completed: thread?.completed === true || String(thread?.roomStatus || thread?.status) === "completed",
    };
  }, threadId);
}

async function readPurchaseActionDom(page, frameId, threadId) {
  return page.evaluate(
    ({ frameId, threadId }) => {
      const trim = (v) => (v != null && String(v).trim() !== "" ? String(v).trim() : "");
      const win = document.getElementById(frameId)?.contentWindow;
      if (!win) return { mode: "", label: "" };
      const Purchase = win.TasuPlatformChatPurchasePaymentFlow;
      const thread = (win.TasuChatThreadStore?.readAll?.() || []).find(
        (t) => String(t.id) === String(threadId)
      );
      let userId = "";
      try {
        userId = trim(new URL(win.location.href).searchParams.get("userId"));
      } catch {
        userId = "";
      }
      if (!Purchase || !thread) return { mode: "", label: "" };
      return {
        mode: trim(Purchase.getPrimaryActionMode?.(thread, userId)),
        label: trim(Purchase.getPrimaryActionLabel?.(thread, userId)),
      };
    },
    { frameId, threadId }
  );
}

async function readCheckpoint(page, profile, threadId) {
  const chatA = await readChatDom(page, "frame-a-chat");
  const chatB = await readChatDom(page, "frame-b-chat");
  const bPurchaseAction = await readPurchaseActionDom(page, "frame-b-chat", threadId);
  if (bPurchaseAction.mode || bPurchaseAction.label) {
    chatB.button = {
      visible: true,
      text: bPurchaseAction.label || chatB.button.text,
      mode: bPurchaseAction.mode || chatB.button.mode,
    };
  }
  const notifyA = await readNotifySide(page, "frame-a-notify", profile.partnerA);
  const notifyB = await readNotifySide(page, "frame-b-notify", profile.partnerB);
  const postA = await readPostMessageLog(page, profile.partnerA, threadId);
  const postB = await readPostMessageLog(page, profile.partnerB, threadId);
  const thread = await readThreadState(page, threadId);
  const verdict = await analyzeVerdict(page, profile.id, threadId);

  const diagPanel = await readBenchDiagPanel(page);

  return {
    thread,
    sideA: {
      button: chatA.button,
      status: chatA.status,
      shippingCard: chatA.shippingCard,
      review: chatA.review,
    },
    sideB: {
      button: chatB.button,
      status: chatB.status,
      shippingCard: chatB.shippingCard,
      review: chatB.review,
    },
    notifyA: { ...notifyA, postMessage: postA },
    notifyB: { ...notifyB, postMessage: postB },
    verdict,
    diagPanel,
  };
}

async function verifyCase(page, profile, method) {
  const key = `${profile.id}-${method}`;
  const report = { key, url: benchUrl(profile, method), checkpoints: [], ngBulkCopy: "", ok: true, errors: [] };

  await page.goto(report.url, { waitUntil: "domcontentloaded", timeout: GOTO_TIMEOUT_MS });
  await page
    .waitForFunction(
      () =>
        window.__tasuBenchRunMeta?.framesReloadedAfterReset === true ||
        Boolean(document.getElementById("frame-a-chat")?.src && document.getElementById("frame-a-chat")?.src !== "about:blank"),
      null,
      { timeout: 15000 }
    )
    .catch(() => null);
  await page.waitForTimeout(BOOT_PAUSE_MS);

  const boot = await bootstrapPurchaseChat(page, profile.id);
  if (!boot?.ok) {
    report.ok = false;
    report.errors.push(`bootstrap: ${boot?.reason}`);
    return report;
  }
  const threadId = boot.threadId;
  const steps = FLOW_STEPS[method];
  const pending = new Set();

  for (const step of steps) {
    console.log(`  step ${step.id}`);
    for (const act of step.actions) {
      if (!pending.has(act)) {
        const res = await runAction(page, profile.id, threadId, act);
        if (!res?.ok) {
          report.ok = false;
          report.errors.push(`${step.id}/${act}: ${res?.reason}`);
        }
        pending.add(act);
        await page.evaluate((tid) => {
          if (typeof window.scheduleSoftSyncBenchChatPeers === "function") {
            window.scheduleSoftSyncBenchChatPeers(tid, { reason: "verify_action_peer_soft" });
          }
        }, threadId);
        await page.waitForTimeout(STEP_PAUSE_MS);
      }
    }

    let refreshMeta = await refreshFrames(page, profile.id, threadId);
    await waitForBenchSettled(page);
    await waitChatReady(page, "frame-a-chat");
    await waitChatReady(page, "frame-b-chat");
    await page.waitForTimeout(STEP_PAUSE_MS);

    let cp = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        cp = await readCheckpoint(page, profile, threadId);
        if ((cp.verdict?.ngCount || 0) === 0 || attempt >= 3) break;
        refreshMeta = await refreshFrames(page, profile.id, threadId);
        await waitForBenchSettled(page);
        await waitChatReady(page, "frame-a-chat");
        await waitChatReady(page, "frame-b-chat");
        await page.waitForTimeout(STEP_PAUSE_MS);
      } catch (err) {
        const msg = String(err?.message || err);
        if (!/Execution context was destroyed|navigation/i.test(msg) || attempt >= 3) throw err;
        await waitForBenchSettled(page, 12000);
        await waitChatReady(page, "frame-a-chat");
        await waitChatReady(page, "frame-b-chat");
      }
    }
    if (refreshMeta?.forcedReload) {
      report.ok = false;
      report.errors.push(`${step.id}: chat iframe src was force-reloaded`);
    }
    if (/after-ship$/i.test(step.id)) {
      const shipCardErrors = validateShippingCardUi(cp, method);
      if (shipCardErrors.length) {
        report.ok = false;
        report.errors.push(`${step.id}: ${shipCardErrors.join("; ")}`);
      }
    }
    if (step.id === "05-after-ship" && method === "bank_transfer") {
      await page
        .waitForFunction(
          () => {
            const doc = document.getElementById("frame-b-chat")?.contentWindow?.document;
            const barBtn = doc?.getElementById("chatJobEndBarBtn");
            const completeBtn = doc?.getElementById("chatCompleteBtn");
            const text = String(barBtn?.innerText || barBtn?.textContent || completeBtn?.textContent || "").trim();
            const mode = String(
              barBtn?.getAttribute("data-primary-action") ||
                completeBtn?.getAttribute("data-primary-action") ||
                ""
            );
            return /受け取り|受取/.test(text) || mode === "purchase_receive";
          },
          null,
          { timeout: 8000 }
        )
        .catch(() => null);
      await ensureBenchDiagPanel(page, profile.id, threadId);
      cp = await readCheckpoint(page, profile, threadId);
      const shipUiErrors = validateBankTransferBShipUi(cp, cp.diagPanel);
      if (shipUiErrors.length) {
        report.ok = false;
        report.errors.push(`${step.id}: ${shipUiErrors.join("; ")}`);
      }
    }
    const summary = {
      id: step.id,
      label: step.label,
      aButton: { visible: cp.sideA.button.visible, text: cp.sideA.button.text, mode: cp.sideA.button.mode },
      bButton: { visible: cp.sideB.button.visible, text: cp.sideB.button.text, mode: cp.sideB.button.mode },
      notifyA: {
        domCards: cp.notifyA.domCardCount,
        domTitles: cp.notifyA.domTitles,
        localStorage: cp.notifyA.localStorage,
        storeApi: cp.notifyA.storeApi,
        postMessage: cp.notifyA.postMessage,
      },
      notifyB: {
        domCards: cp.notifyB.domCardCount,
        domTitles: cp.notifyB.domTitles,
        localStorage: cp.notifyB.localStorage,
        storeApi: cp.notifyB.storeApi,
        postMessage: cp.notifyB.postMessage,
      },
      statusA: cp.sideA.status.text || (cp.sideA.status.visible ? "(visible)" : ""),
      statusB: cp.sideB.status.text || (cp.sideB.status.visible ? "(visible)" : ""),
      aShippingCard: cp.sideA.shippingCard || null,
      bShippingCard: cp.sideB.shippingCard || null,
      shippingCarrier: cp.thread?.shippingCarrier || "",
      trackingNumber: cp.thread?.trackingNumber || "",
      reviewA: cp.sideA.review.visible,
      reviewB: cp.sideB.review.visible,
      thread: cp.thread,
      ngCount: cp.verdict?.ngCount ?? -1,
      ngCodes: cp.verdict?.ngCodes || [],
      diagPanel: cp.diagPanel || null,
    };
    report.checkpoints.push(summary);

    if (cp.verdict?.ngCount > 0) {
      report.ok = false;
      report.errors.push(`${step.id}: ng=${cp.verdict.ngCodes.join("; ")}`);
    }
  }

  await ensureBenchDiagPanel(page, profile.id, threadId);
  await page.waitForTimeout(STEP_PAUSE_MS);

  await waitForBenchSettled(page);
  let final = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      final = await readCheckpoint(page, profile, threadId);
      break;
    } catch (err) {
      const msg = String(err?.message || err);
      if (!/Execution context was destroyed|navigation/i.test(msg) || attempt >= 2) throw err;
      await waitForBenchSettled(page, 12000);
      await Promise.all([waitChatReady(page, "frame-a-chat"), waitChatReady(page, "frame-b-chat")]);
    }
  }
  report.ngBulkCopy = final.verdict?.ngBulkCopy || "";
  fs.writeFileSync(path.join(OUT_DIR, `${key}-ng-bulk-copy.txt`), report.ngBulkCopy || "(empty)");

  if (!final.thread?.completed) {
    report.ok = false;
    report.errors.push("final: not completed");
  }
  if ((final.verdict?.ngCount || 0) > 0) {
    report.ok = false;
    report.errors.push(`final businessNg=${(final.verdict.ngCodes || []).join("; ")}`);
  }
  if (!report.ngBulkCopy.trim()) {
    report.ok = false;
    report.errors.push("final: ngBulkCopy empty");
  }
  if (!/cause:|原因:/.test(report.ngBulkCopy)) {
    report.ok = false;
    report.errors.push("final: ngBulkCopy missing cause fields");
  }
  if (!final.diagPanel?.panelInitialized && final.diagPanel?.panelStillBooting) {
    report.ok = false;
    report.errors.push("final: diag panel not initialized");
  }

  report.final = {
    thread: final.thread,
    ngCount: final.verdict?.ngCount ?? -1,
    ngCodes: final.verdict?.ngCodes || [],
    diagnosticNgCount: final.verdict?.diagnosticNgCount ?? 0,
    diagnosticNgCodes: final.verdict?.diagnosticNgCodes || [],
    reviewA: final.sideA.review.visible,
    reviewB: final.sideB.review.visible,
    diagPanel: final.diagPanel || null,
    bShippingCard: final.sideB.shippingCard?.visible === true,
    statusB: final.sideB.status.text || "",
  };

  fs.writeFileSync(path.join(OUT_DIR, `${key}.json`), JSON.stringify(report, null, 2));
  return report;
}

function buildIndex(reports) {
  const lines = [
    "# product / shop 支払い方式別 最終確認（DOM検証）",
    "",
    `Base: ${BASE}`,
    `Generated: ${new Date().toISOString()}`,
    "",
  ];
  for (const r of reports) {
    lines.push(`## ${r.key} ${r.ok ? "✅" : "❌"}`);
    lines.push("");
    lines.push(`URL: ${r.url}`);
    if (r.errors.length) lines.push(`Errors: ${r.errors.join("; ")}`);
    lines.push("");
    for (const cp of r.checkpoints) {
      lines.push(`### ${cp.id} — ${cp.label}`);
      lines.push("");
      lines.push("**① A側ボタン**");
      lines.push(`- visible: ${cp.aButton.visible} / text: ${cp.aButton.text || "—"} / mode: ${cp.aButton.mode || "—"}`);
      lines.push("");
      lines.push("**② B側ボタン**");
      lines.push(`- visible: ${cp.bButton.visible} / text: ${cp.bButton.text || "—"} / mode: ${cp.bButton.mode || "—"}`);
      lines.push("");
      lines.push("**③ 通知**");
      lines.push(`- A dom: ${cp.notifyA.domCards} — ${cp.notifyA.domTitles.join(" | ") || "—"}`);
      lines.push(`- B dom: ${cp.notifyB.domCards} — ${cp.notifyB.domTitles.join(" | ") || "—"}`);
      lines.push(`- A localStorage: ${cp.notifyA.localStorage.map((n) => n.title).join(" | ") || "—"}`);
      lines.push(`- B localStorage: ${cp.notifyB.localStorage.map((n) => n.title).join(" | ") || "—"}`);
      lines.push(`- A postMessage: ${cp.notifyA.postMessage.map((n) => n.title).join(" | ") || "—"}`);
      lines.push(`- B postMessage: ${cp.notifyB.postMessage.map((n) => n.title).join(" | ") || "—"}`);
      lines.push("");
      lines.push("**④ チャット内ステータス**");
      lines.push(`- A: ${cp.statusA || "—"}`);
      lines.push(`- B: ${cp.statusB || "—"}`);
      lines.push("");
      lines.push("**⑤ レビュー**");
      lines.push(`- A review visible: ${cp.reviewA} / B review visible: ${cp.reviewB}`);
      lines.push("");
      lines.push("**⑥ NG**");
      lines.push(`- count: ${cp.ngCount} ${cp.ngCodes.length ? `(${cp.ngCodes.join(", ")})` : ""}`);
      lines.push("");
    }
    lines.push(`**NG全部コピー**: [${r.key}-ng-bulk-copy.txt](${r.key}-ng-bulk-copy.txt)`);
    lines.push("");
  }
  return lines.join("\n");
}

const onlyCase = pickStr(process.env.CASE, process.argv[2]);
const freshRun = process.env.FRESH === "1";
const cases = [];
for (const profile of PROFILES) {
  for (const method of METHODS) {
    cases.push({ profile, method, key: `${profile.id}-${method}` });
  }
}
const targets = onlyCase
  ? cases.filter((c) => c.key === onlyCase || c.key === onlyCase.replace("/", "-"))
  : cases;
if (!targets.length) {
  console.error(`Unknown CASE=${onlyCase}. Use product-prepaid, shop-bank_transfer, etc.`);
  process.exit(1);
}

const prior = onlyCase
  ? []
  : (() => {
      try {
        return JSON.parse(fs.readFileSync(path.join(OUT_DIR, "summary.json"), "utf8")).reports || [];
      } catch {
        return [];
      }
    })();

const reports = [...prior.filter((r) => !targets.some((t) => t.key === r.key))];

for (const { profile, method, key } of targets) {
  console.log(`verify: ${key}`);
  const browser = await launchHeadlessBrowser();
  const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
  const page = await context.newPage();
  page.on("dialog", async (d) => d.accept());
  try {
    const r = await verifyCase(page, profile, method);
    reports.push(r);
    console.log(`  ${r.ok ? "OK" : "NG"} checkpoints=${r.checkpoints.length} errors=${r.errors.length}`);
  } catch (err) {
    reports.push({
      key,
      url: benchUrl(profile, method),
      checkpoints: [],
      ngBulkCopy: "",
      ok: false,
      errors: [String(err?.message || err)],
    });
    console.log(`  CRASH ${err?.message || err}`);
  } finally {
    await page.close().catch(() => null);
    await context.close().catch(() => null);
    await browser.close().catch(() => null);
  }
  const reportsOut = onlyCase ? reports.filter((r) => targets.some((t) => t.key === r.key)) : reports;
  fs.writeFileSync(path.join(OUT_DIR, "index.md"), buildIndex(reportsOut));
  fs.writeFileSync(
    path.join(OUT_DIR, "summary.json"),
    JSON.stringify({ ok: reportsOut.every((r) => r.ok), base: BASE, case: onlyCase || "all", reports: reportsOut }, null, 2)
  );
}

const runReports = onlyCase ? reports.filter((r) => targets.some((t) => t.key === r.key)) : reports;
const allOk = runReports.every((r) => r.ok);
console.log(
  JSON.stringify(
    { ok: allOk, case: onlyCase || "all", out: OUT_DIR, base: BASE, cases: runReports.map((r) => ({ key: r.key, ok: r.ok })) },
    null,
    2
  )
);
process.exit(allOk ? 0 : 1);
