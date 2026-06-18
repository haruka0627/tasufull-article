#!/usr/bin/env node
/**
 * product/shop — 完了レビュー通知 → chat-detail 自動モーダル表示
 * 再現元: product-cash_on_delivery（全 payment 方式も同パス）
 */
import { launchHeadlessBrowser } from "./lib/playwright-browser.mjs";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const PAUSE = 300;

const CASES = [
  { profile: "product", method: "cash_on_delivery" },
  { profile: "product", method: "prepaid" },
  { profile: "product", method: "bank_transfer" },
  { profile: "shop", method: "cash_on_delivery" },
];

function benchUrl(profile, method) {
  const u = new URL(`${BASE}/chat-dual-window-demo.html`);
  u.searchParams.set("talkDev", "1");
  u.searchParams.set("review", "chat-demo");
  u.searchParams.set("demoProfile", profile);
  u.searchParams.set("demoConnect", "0");
  u.searchParams.set("liveFlow", "1");
  u.searchParams.set("userId", "u_hiro");
  u.searchParams.set("benchViewport", "390");
  u.searchParams.set("benchPattern", `${profile}-0`);
  u.searchParams.set("liveFlowReset", "1");
  if (method !== "prepaid") u.searchParams.set("paymentMethod", method);
  return u.toString();
}

async function bootstrapAndComplete(page, profileId, method) {
  const boot = await page.evaluate((profileId) => {
    const Demo = window.TasuPlatformChatDualWindowDemo;
    const Live = window.TasuPlatformChatLiveFlow;
    const Contacts = window.TasuListingContactRequestsStore;
    const Fee = window.TasuPlatformChatFee;
    const profile = Demo?.getProfile?.(profileId, false);
    if (!profile) return { ok: false, reason: "no_profile" };
    Live?.resetLiveFlow?.({ profile: profileId, connect: false });
    let listing = Contacts?.resolveListing?.(profile.listingId) || {
      id: profile.listingId,
      listing_type: profile.listingType,
      listingType: profile.listingType,
      title: profile.listingTitle,
    };
    let contact = Live?.readBenchPreStartRecord?.(profile);
    if (!contact) {
      const submitted = Contacts?.submitContact?.(listing, { intent: "purchase" });
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
    return { ok: true, threadId: String(activated.threadId || activated.thread?.id || "") };
  }, profileId);
  if (!boot.ok) throw new Error(`bootstrap: ${boot.reason}`);

  const threadId = boot.threadId;
  const profile = await page.evaluate((id) => window.TasuPlatformChatDualWindowDemo?.getProfile?.(id, false), profileId);

  const run = async (action) => {
    await page.evaluate(
      ({ profileId, threadId, action }) => {
        const profile = window.TasuPlatformChatDualWindowDemo?.getProfile?.(profileId, false);
        const thread = (window.TasuChatThreadStore?.readAll?.() || []).find((t) => String(t.id) === String(threadId));
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
        return map[action]?.();
      },
      { profileId, threadId, action }
    );
    await page.waitForTimeout(PAUSE);
  };

  if (method === "bank_transfer") {
    await run("bank_report");
    await run("payment_confirm");
    await run("ship");
    await run("receive");
  } else if (method === "cash_on_delivery") {
    await run("ship");
    await run("receive");
  } else {
    await run("ship");
    await run("receive");
  }

  const thread = await page.evaluate((threadId) => {
    const t = (window.TasuChatThreadStore?.readAll?.() || []).find((r) => String(r.id) === String(threadId));
    return {
      completed: Boolean(t?.completed),
      roomStatus: String(t?.roomStatus || t?.status || ""),
      shouldShowReview:
        window.TasuPlatformChatCategoryFlow?.shouldShowReviewPrompt?.(t) === true ||
        window.TasuPlatformChatDualWindowDemo?.shouldShowReviewPrompt?.(t) === true,
    };
  }, threadId);

  if (!thread.completed || thread.roomStatus !== "completed") {
    throw new Error(`thread not completed: ${JSON.stringify(thread)}`);
  }
  if (!thread.shouldShowReview) {
    throw new Error(`shouldShowReviewPrompt false: ${JSON.stringify(thread)}`);
  }

  return { threadId, buyerId: profile.partnerBId };
}

async function findReviewNotifyHref(page, buyerId, threadId) {
  return page.evaluate(
    ({ buyerId, threadId }) => {
      const trim = (v) => (v != null && String(v).trim() !== "" ? String(v).trim() : "");
      const rows = window.TasuTalkNotifications?.getAll?.() || [];
      const hit = rows.find(
        (n) =>
          String(n.recipientUserId) === String(buyerId) &&
          String(n.threadId) === String(threadId) &&
          /レビュー/.test(trim(n.actionLabel)) &&
          /完了/.test(trim(n.title))
      );
      return hit ? trim(hit.href, hit.targetUrl) : "";
    },
    { buyerId, threadId }
  );
}

async function waitChatReady(page, frameId, timeoutMs = 15000) {
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

async function mountChatFromNotifyHref(page, href, frameId = "frame-b-chat") {
  const abs = href.startsWith("http") ? href : new URL(href, BASE).toString();
  await page.evaluate(
    ({ href, frameId }) => {
      const frame = document.getElementById(frameId);
      if (frame && href) frame.src = href;
    },
    { href: abs, frameId }
  );
  await waitChatReady(page, frameId);
  await page.waitForTimeout(1200);
  await page
    .waitForFunction(
      (frameId) => {
        const modal = document.getElementById(frameId)?.contentWindow?.document?.getElementById("chatReviewModal");
        return modal != null && modal.hidden === false;
      },
      frameId,
      { timeout: 6000 }
    )
    .catch(() => null);
}

async function readReviewModalState(page, frameId = "frame-b-chat") {
  return page.evaluate((frameId) => {
    const doc = document.getElementById(frameId)?.contentWindow?.document;
    const win = document.getElementById(frameId)?.contentWindow;
    const modal = doc?.getElementById("chatReviewModal");
    const toast = doc?.getElementById("chatReportToast");
    const params = new URLSearchParams(win?.location?.search || "");
    return {
      href: win?.location?.href || "",
      from: params.get("from") || "",
      openReview: params.get("openReview") || "",
      demoState: params.get("demoState") || "",
      modalHidden: modal?.hidden !== false,
      modalVisible: modal != null && modal.hidden === false,
      toastText: String(toast?.textContent || "").trim(),
      cardBtn: Boolean(
        doc?.querySelector("[data-platform-review-open], [data-platform-job-review-open]")
      ),
    };
  }, frameId);
}

async function submitReviewInModal(page, frameId = "frame-b-chat") {
  await page.evaluate((frameId) => {
    const doc = document.getElementById(frameId)?.contentWindow?.document;
    const star = doc?.querySelector(".chat-review-star[data-star='5']");
    star?.click?.();
    const submit = doc?.getElementById("chatReviewSubmit") || doc?.querySelector("[data-review-submit]");
    submit?.click?.();
  }, frameId);
  await page.waitForTimeout(600);
}

const browser = await launchHeadlessBrowser();
const page = await browser.newPage();
const results = [];

try {
  for (const c of CASES) {
    const key = `${c.profile}-${c.method}`;
    console.log(`verify: ${key}`);
    const item = { key, ok: false, errors: [] };
    try {
      await page.goto(benchUrl(c.profile, c.method), { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForTimeout(800);

      const { threadId, buyerId } = await bootstrapAndComplete(page, c.profile, c.method);
      const href = await findReviewNotifyHref(page, buyerId, threadId);
      if (!href) item.errors.push("review_notify_href_missing");
      if (!/from=notify/.test(href)) item.errors.push("href_missing_from_notify");
      if (!/openReview=1/.test(href)) item.errors.push("href_missing_openReview");

      await mountChatFromNotifyHref(page, href);
      let state = await readReviewModalState(page);
      if (!state.modalVisible) item.errors.push(`modal_not_auto_open:${JSON.stringify(state)}`);

      await submitReviewInModal(page);
      const reviewed = await page.evaluate(
        ({ threadId, buyerId }) =>
          window.TasuPlatformChatReviewFlow?.hasUserSubmittedReviewForRoom?.(
            (window.TasuChatThreadStore?.readAll?.() || []).find((t) => String(t.id) === String(threadId)),
            buyerId
          ) === true,
        { threadId, buyerId }
      );
      if (!reviewed) item.errors.push("review_not_persisted");

      await mountChatFromNotifyHref(page, href);
      state = await readReviewModalState(page);
      if (state.modalVisible) item.errors.push("modal_reopened_after_submit");
      if (!/レビュー済み/.test(state.toastText)) item.errors.push(`no_reviewed_toast:${state.toastText}`);

      item.ok = item.errors.length === 0;
      console.log(item.ok ? `  OK` : `  NG ${item.errors.join("; ")}`);
    } catch (err) {
      item.errors.push(String(err?.message || err));
      console.log(`  NG ${item.errors.join("; ")}`);
    }
    results.push(item);
  }

  const ok = results.every((r) => r.ok);
  console.log(JSON.stringify({ ok, results }, null, 2));
  process.exit(ok ? 0 : 1);
} finally {
  await browser.close();
}
