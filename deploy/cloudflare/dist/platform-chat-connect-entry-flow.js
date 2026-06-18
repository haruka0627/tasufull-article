/**
 * Connectあり — skill / product / worker 入口決済（既存完了フローへ接続）
 */
(function (global) {
  "use strict";

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function resolveCategoryKey(listing) {
    return global.TasuPlatformChatFee?.resolveCategoryKey?.(listing) || "";
  }

  function usesConnectEntryPayment(listing, options) {
    return global.TasuPlatformChatCategoryFlow?.usesConnectEntryPayment?.(listing, options) === true;
  }

  function resolveListingAmountYen(listing) {
    if (!listing || typeof listing !== "object") return 0;
    const fd = listing.form_data && typeof listing.form_data === "object" ? listing.form_data : {};
    const listingId = pickStr(listing.id, listing.listing_id);
    const fromListing = Math.round(
      Number(
        pickStr(
          listing.price_amount,
          listing.priceAmount,
          listing.price,
          listing.amount,
          fd.price_amount,
          fd.price,
          fd.amount
        )
      ) || 0
    );
    if (fromListing > 0) return fromListing;
    const demo = listingId ? global.TasuListingDemoCatalog?.STORE_BY_ID?.[listingId] : null;
    if (demo) {
      const demoAmount = Math.round(Number(demo.price_amount || demo.price || 0) || 0);
      if (demoAmount > 0) return demoAmount;
    }
    return 0;
  }

  function calcConnectEntryFeeBreakdown(listing) {
    const grossAmount = resolveListingAmountYen(listing);
    const Fee = global.TasuPlatformChatFee;
    const platformFeeAmount = Fee?.calcPlatformFee?.(grossAmount) || Math.max(550, Math.round(grossAmount * 0.05));
    const sellerNetAmount = Math.max(0, grossAmount - platformFeeAmount);
    return { grossAmount, platformFeeAmount, sellerNetAmount };
  }

  function buildConnectEntryPayUrl(detail) {
    const Fee = global.TasuPlatformChatFee;
    const u = new URL("platform-chat-fee-pay.html", global.location?.href || "http://localhost/");
    const contactId = pickStr(detail?.contactId, detail?.contact_id);
    const requestId = pickStr(detail?.requestId, detail?.request_id);
    const listingId = pickStr(detail?.listingId, detail?.listing_id, detail?.listing?.id);
    const category = Fee?.normalizeCategoryKey?.(
      detail?.category || resolveCategoryKey(detail?.listing)
    );
    if (contactId) u.searchParams.set("contactId", contactId);
    if (requestId) u.searchParams.set("requestId", requestId);
    if (listingId) u.searchParams.set("listingId", listingId);
    if (category) u.searchParams.set("category", category);
    u.searchParams.set("phase", "connect_entry");
    const from = pickStr(detail?.from);
    if (from) u.searchParams.set("from", from);
    return u.pathname + u.search;
  }

  function ensurePendingConnectEntry(detail) {
    const Fee = global.TasuPlatformChatFee;
    if (!Fee?.upsertFeeRecord || !Fee?.resolveFeeKey) return null;
    const listing = detail?.listing || global.TasuListingContactRequestsStore?.resolveListing?.(detail?.listingId);
    const breakdown = calcConnectEntryFeeBreakdown(listing);
    const feeKey = Fee.resolveFeeKey({
      contactId: detail?.contactId,
      requestId: detail?.requestId,
      applicationId: detail?.applicationId,
    });
    if (!feeKey) return null;
    return Fee.upsertFeeRecord({
      threadId: feeKey,
      contactId: pickStr(detail?.contactId) || undefined,
      requestId: pickStr(detail?.requestId) || undefined,
      listingId: pickStr(detail?.listingId, listing?.id, listing?.listing_id),
      listingTitle: pickStr(detail?.listingTitle, listing?.title),
      category: resolveCategoryKey(listing),
      feeAmount: breakdown.grossAmount,
      agreedAmount: breakdown.grossAmount,
      platformFeeAmount: breakdown.platformFeeAmount,
      sellerNetAmount: breakdown.sellerNetAmount,
      connectMode: "connect_entry",
      feePhase: "connect_entry",
      status: "pending",
      deferred: true,
    });
  }

  function applyConnectEntryThreadPatch(thread, listing) {
    if (!thread || typeof thread !== "object") return thread;
    const breakdown = calcConnectEntryFeeBreakdown(listing);
    const now = new Date().toISOString();
    const patch = {
      connectEntryPayment: true,
      connectEntryPaidAt: now,
      connectEntryAmount: breakdown.grossAmount,
      platformFeeAmount: breakdown.platformFeeAmount,
      sellerNetAmount: breakdown.sellerNetAmount,
      platformConnectMode: "entry",
    };
    const Category = global.TasuPlatformChatCategoryFlow;
    if (Category?.isProductPurchaseFlowEnabled?.(listing) === true) {
      const Purchase = global.TasuPlatformChatPurchasePaymentFlow;
      if (Purchase?.createInitialPurchaseThreadFields) {
        Object.assign(
          patch,
          Purchase.createInitialPurchaseThreadFields(Purchase.PAYMENT_METHODS?.PREPAID || "prepaid")
        );
        patch.paymentConfirmed = true;
        patch.paymentConfirmedAt = now;
      }
    }
    return { ...thread, ...patch };
  }

  function patchThreadInStore(threadId, patch) {
    const store = global.TasuChatThreadStore;
    if (!store?.readAll || !store?.writeAll || !threadId || !patch) return null;
    const list = store.readAll();
    const idx = list.findIndex((row) => String(row.id) === String(threadId));
    if (idx < 0) return null;
    list[idx] = { ...list[idx], ...patch, updatedAt: new Date().toISOString() };
    store.writeAll(list);
    return list[idx];
  }

  function submitConnectEntry(listing, options) {
    const opts = options || {};
    if (!usesConnectEntryPayment(listing)) {
      return { ok: false, reason: "not_connect_entry" };
    }
    const breakdown = calcConnectEntryFeeBreakdown(listing);
    if (breakdown.grossAmount <= 0) {
      return { ok: false, reason: "missing_listing_amount" };
    }

    const store = global.TasuListingContactRequestsStore;
    if (!store?.submitContact) return { ok: false, reason: "contact_store_missing" };
    const result = store.submitContact(listing, opts);
    if (!result?.ok) return result;

    ensurePendingConnectEntry({
      listing,
      contactId: result.contact.contact_id,
      listingId: pickStr(listing.id, listing.listing_id),
      listingTitle: pickStr(listing.title),
    });

    let pageFrom = "";
    try {
      pageFrom = String(new URLSearchParams(global.location?.search || "").get("from") || "").trim();
    } catch {
      pageFrom = "";
    }

    const payUrl = buildConnectEntryPayUrl({
      contactId: result.contact.contact_id,
      listingId: pickStr(listing.id, listing.listing_id),
      category: resolveCategoryKey(listing),
      from: pageFrom || "detail",
    });

    return {
      ok: true,
      contact: result.contact,
      payUrl,
      feeAmount: breakdown.grossAmount,
      platformFeeAmount: breakdown.platformFeeAmount,
    };
  }

  function shouldAwaitSellerPurchaseConfirmAfterConnectEntry(listing, thread) {
    if (!usesConnectEntryPayment(listing || thread)) return false;
    const cat = resolveCategoryKey(listing || thread);
    return global.TasuPlatformChatCategoryFlow?.isMarketplaceConnectCategory?.(cat) === true;
  }

  function notifySellerAfterConnectEntryPayment({ listing, contact, thread, threadId, request }) {
    const cat = resolveCategoryKey(listing || thread);
    const Notify = global.TasuTalkPlatformNotify;
    const detail = {
      listing,
      contact,
      request,
      thread: { ...(thread || {}), id: threadId },
      threadId,
    };
    if (cat === "skill") return Notify?.notifySkillPurchased?.(detail);
    if (cat === "product") return Notify?.notifyProductPurchased?.(detail);
    if (cat === "worker") return Notify?.notifyWorkerRequestReceived?.(detail);
    return Notify?.notifyListingPurchased?.(detail, { type: cat });
  }

  function activateConnectEntryAfterPayment(ctx) {
    const Fee = global.TasuPlatformChatFee;
    const feeRow = Fee?.getFeeRecordByContext?.(ctx);
    const feeKey = pickStr(feeRow?.threadId);
    const contactId = pickStr(ctx?.contactId, feeRow?.contactId);
    const requestId = pickStr(ctx?.requestId, feeRow?.requestId);
    const listingId = pickStr(ctx?.listingId, feeRow?.listingId);
    const threadStore = global.TasuChatThreadStore;
    if (!threadStore) return { ok: false, reason: "thread_store_missing" };

    let threadResult = null;
    let listing = null;

    if (contactId) {
      const Contacts = global.TasuListingContactRequestsStore;
      const contact = Contacts?.findById?.(contactId);
      if (!contact) return { ok: false, reason: "contact_not_found" };
      listing = Contacts.resolveListing(contact.listing_id);
      threadResult = threadStore.createThreadFromContact?.(listing, contact);
      if (!threadResult?.ok || !threadResult.thread) return threadResult || { ok: false };
      Contacts.finalizeContactAfterPayment?.(contactId, threadResult.thread.id);
    } else if (requestId) {
      const workerStore = global.TasuWorkerRequestsStore;
      listing = workerStore?.resolveListing?.(listingId);
      const req = workerStore?.findRequest?.(listingId, requestId);
      if (!listing || !req) return { ok: false, reason: "request_not_found" };
      threadResult = threadStore.createWorkerRequestThread?.(listing, req, { feePending: false });
      if (!threadResult?.ok || !threadResult.thread) return threadResult || { ok: false };
      workerStore.finalizeRequestAfterPayment?.(requestId, threadResult.thread.id);
    } else {
      return { ok: false, reason: "missing_deferred_context" };
    }

    const realThreadId = threadResult.thread.id;
    const patched = applyConnectEntryThreadPatch(threadResult.thread, listing);
    patchThreadInStore(realThreadId, patched);

    if (feeKey) Fee?.migrateFeeRecordToThread?.(feeKey, realThreadId);
    else {
      Fee?.markFeePaid?.(realThreadId, {
        activatedAt: new Date().toISOString(),
        connectMode: "connect_entry",
        feePhase: "connect_entry",
      });
    }

    if (shouldAwaitSellerPurchaseConfirmAfterConnectEntry(listing, patched)) {
      const Gate = global.TasuPlatformChatContactGate;
      const awaitingThread =
        Gate?.ensureThreadDefaults?.(patched, {
          feePending: true,
          intent: pickStr(patched?.platformContactKind, "purchase"),
        }) || {
          ...patched,
          platformStartPhase: "awaiting_partner",
          platformContactKind: pickStr(patched?.platformContactKind, "purchase"),
          roomStatus: "fee_pending",
          status: "fee_pending",
        };
      patchThreadInStore(realThreadId, awaitingThread);
      try {
        const Contacts = global.TasuListingContactRequestsStore;
        const contact = Contacts?.findById?.(contactId);
        const workerStore = global.TasuWorkerRequestsStore;
        const request = requestId ? workerStore?.findRequest?.(listingId, requestId) : null;
        notifySellerAfterConnectEntryPayment({
          listing,
          contact,
          request,
          thread: { ...awaitingThread, id: realThreadId },
          threadId: realThreadId,
        });
      } catch (err) {
        console.warn("[TasuPlatformChatConnectEntryFlow] purchase notify skipped:", err);
      }
      return {
        ok: true,
        threadId: realThreadId,
        awaitingSellerConfirm: true,
        thread: { ...awaitingThread, id: realThreadId },
      };
    }

    const activated = threadStore.activateThreadAfterFeePaid?.(realThreadId);
    if (!activated?.ok) return activated || { ok: false, reason: "activate_failed" };

    try {
      const isDemoThread = global.TasuPlatformChatDualWindowDemo?.isDemoThread?.(realThreadId) === true;
      if (isDemoThread) {
        const started = Fee?.notifyNonJobDemoChatStartedAfterPayment?.({
          ...activated,
          threadId: realThreadId,
        });
        if (!started?.ok) {
          Fee?.postBenchChatStartedFromThread?.(activated.thread);
        }
      } else {
        global.TasuTalkPlatformFeeNotify?.notifyChatActivated?.({
          thread: activated.thread,
          listing: {
            id: activated.thread?.listingId,
            title: activated.thread?.listingTitle,
            listing_type: activated.thread?.listingType,
          },
          notifyRequesterOnly: false,
        });
        Fee?.postBenchChatStartedFromThread?.(activated.thread);
      }
    } catch (err) {
      console.warn("[TasuPlatformChatConnectEntryFlow] post-pay notify skipped:", err);
    }

    return { ...activated, threadId: realThreadId };
  }

  function isConnectEntryThread(thread) {
    return Boolean(thread?.connectEntryPayment);
  }

  function readConnectEntryPaymentFromUrl(loc) {
    try {
      const params = new URLSearchParams((loc || global.location)?.search || "");
      const v = pickStr(params.get("connectEntryPayment")).toLowerCase();
      if (v === "1" || v === "true") return true;
      if (v === "0" || v === "false") return false;
    } catch {
      /* ignore */
    }
    return null;
  }

  function readEntryProfileFromUrl(loc) {
    try {
      return pickStr(new URLSearchParams((loc || global.location)?.search || "").get("entryProfile"));
    } catch {
      return "";
    }
  }

  /** Connect入口チャット遷移URL — 初回描画で550円ゲートを誤判定しないための query */
  function appendConnectEntryUrlParams(href, detail) {
    const raw = String(href || "").trim();
    if (!raw || !/chat-detail\.html/i.test(raw)) return raw;
    try {
      const u = new URL(raw, global.location?.href || "http://localhost/");
      const Category = global.TasuPlatformChatCategoryFlow;
      const thread = detail?.thread;
      const listing = detail?.listing;
      const cat =
        pickStr(detail?.category, detail?.entryProfile, resolveCategoryKey(listing || thread)) ||
        readEntryProfileFromUrl();
      u.searchParams.set("demoConnect", "1");
      u.searchParams.set("platform_connect", "1");
      u.searchParams.set("connectEntryPayment", "1");
      if (cat) u.searchParams.set("entryProfile", cat);
      const demoProfile = pickStr(detail?.demoProfile, detail?.profile, cat);
      if (demoProfile) u.searchParams.set("demoProfile", demoProfile);
      const benchPattern = pickStr(detail?.benchPattern);
      if (benchPattern) u.searchParams.set("benchPattern", benchPattern);
      const threadId = pickStr(detail?.threadId, thread?.id);
      const listingId = pickStr(detail?.listingId, thread?.listingId, listing?.id, listing?.listing_id);
      if (threadId) u.searchParams.set("thread", threadId);
      if (listingId) u.searchParams.set("listingId", listingId);
      if (!u.searchParams.get("from") && detail?.from) u.searchParams.set("from", pickStr(detail.from));
      return `${u.pathname}${u.search}${u.hash}`;
    } catch {
      return raw;
    }
  }

  function shouldAppendConnectEntryUrlParams(detail) {
    if (detail?.connectEntryPayment === true) return true;
    const thread = detail?.thread;
    const Category = global.TasuPlatformChatCategoryFlow;
    if (Category?.isMarketplaceConnectEntryThread?.(thread) === true) return true;
    const listing = detail?.listing;
    if (listing && usesConnectEntryPayment(listing, detail?.options)) return true;
    if (thread) {
      const rs = pickStr(thread.roomStatus, thread.status).toLowerCase();
      const awaiting =
        rs === "fee_pending" || pickStr(thread.platformStartPhase) === "awaiting_partner";
      if (awaiting && isConnectEntryThread(thread)) return true;
    }
    return false;
  }

  function getConnectEntrySetupMessage(options) {
    return global.TasuPlatformChatCategoryFlow?.getMarketplaceConnectSetupMessage?.(options) || "";
  }

  global.TasuPlatformChatConnectEntryFlow = {
    usesConnectEntryPayment,
    resolveListingAmountYen,
    calcConnectEntryFeeBreakdown,
    buildConnectEntryPayUrl,
    ensurePendingConnectEntry,
    submitConnectEntry,
    activateConnectEntryAfterPayment,
    applyConnectEntryThreadPatch,
    isConnectEntryThread,
    readConnectEntryPaymentFromUrl,
    readEntryProfileFromUrl,
    appendConnectEntryUrlParams,
    shouldAppendConnectEntryUrlParams,
    getConnectEntrySetupMessage,
  };
})(typeof window !== "undefined" ? window : globalThis);
