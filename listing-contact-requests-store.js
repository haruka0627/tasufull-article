/**
 * 出品詳細 — 購入者 / 依頼者 / 問い合わせ（550円支払い前はチャット未作成）
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "tasful_listing_contact_requests_v1";
  const EVENT_NAME = "tasu:listing-contacts-changed";

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function newContactId() {
    return `contact-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function getRequesterId() {
    return (
      global.TasuChatUserIdentity?.getEffectiveUserId?.() ||
      global.TASU_CHAT_SUPABASE_CONFIG?.currentUserId ||
      "u_me"
    );
  }

  function getRequesterName(userId) {
    const id = pickStr(userId);
    const profile = global.TasuChatUserIdentity?.getProfileForUserId?.(id);
    if (profile?.displayName) return profile.displayName;
    try {
      const params = new URLSearchParams(global.location?.search || "");
      const demoProfile = global.TasuPlatformChatDualWindowDemo?.getProfile?.(
        params.get("demoProfile"),
        params.get("demoConnect") === "1"
      );
      if (demoProfile?.partnerBId === id) return pickStr(demoProfile.partnerBName, id);
      if (demoProfile?.partnerAId === id) return pickStr(demoProfile.partnerAName, id);
    } catch {
      /* ignore */
    }
    return id || "購入者";
  }

  function readAll() {
    try {
      const raw = global.localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeAll(list) {
    const safe = Array.isArray(list) ? list : [];
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
      global.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { list: safe } }));
    } catch (err) {
      console.warn("[TasuListingContactRequestsStore] save failed:", err);
    }
    return safe;
  }

  function resolveListing(listingId) {
    const id = pickStr(listingId);
    const local = global.TasuListingLocalStore?.fetchById?.(id);
    if (local) return global.TasuListingLocalStore?.toDetailListing?.(local) || local;
    const storeRow = global.TasuListingStore?.fetchById?.(id);
    if (storeRow) return storeRow;
    const shopDemo = global.TasuShopStoreDemo?.getById?.(id);
    if (shopDemo) {
      const listingType = pickStr(shopDemo.listing_type, shopDemo.listingType, "shop_store");
      return { ...shopDemo, listing_type: listingType, listingType };
    }
    const demo = global.TasuListingDemoCatalog?.STORE_BY_ID?.[id];
    if (demo) return demo;
    return { id, listing_id: id, title: id };
  }

  function resolveSellerId(listing) {
    return pickStr(
      listing?.user_id,
      listing?.seller_user_id,
      listing?.author_user_id,
      listing?.owner_user_id
    );
  }

  function isListingOwner(listing) {
    const ownerId = resolveSellerId(listing || resolveListing(pickStr(listing?.id, listing?.listing_id)));
    const me = getRequesterId();
    if (!ownerId || !me) return false;
    return ownerId === me;
  }

  function listByListing(listingId) {
    const lid = pickStr(listingId);
    return readAll()
      .filter((r) => String(r.listing_id) === lid)
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  }

  function findContact(listingId, contactId) {
    const lid = pickStr(listingId);
    const cid = pickStr(contactId);
    return readAll().find((r) => String(r.listing_id) === lid && String(r.contact_id) === cid) || null;
  }

  function findById(contactId) {
    const cid = pickStr(contactId);
    return readAll().find((r) => String(r.contact_id) === cid) || null;
  }

  function hasPendingContact(listingId, requesterId) {
    const lid = pickStr(listingId);
    const rid = pickStr(requesterId || getRequesterId());
    return readAll().some(
      (r) =>
        String(r.listing_id) === lid &&
        String(r.requester_id) === rid &&
        r.status !== "rejected" &&
        r.status !== "active"
    );
  }

  function submitContact(listing, options) {
    const listingId = pickStr(listing?.id, listing?.listing_id);
    if (!listingId) return { ok: false, reason: "missing_listing_id" };

    const requesterId = getRequesterId();
    const sellerId = resolveSellerId(listing);
    if (sellerId && sellerId === requesterId) {
      return { ok: false, reason: "owner_cannot_contact" };
    }

    if (hasPendingContact(listingId, requesterId)) {
      return { ok: false, reason: "already_submitted" };
    }

    const intent = pickStr(options?.intent, "purchase");
    const Category = global.TasuPlatformChatCategoryFlow;
    const cat = global.TasuPlatformChatFee?.resolveCategoryKey?.(listing) || "";
    if (
      Category?.isConnectRequiredCategory?.(cat) &&
      Category?.isConnectRequiredRequestIntent?.(intent) &&
      Category?.shouldAllowConnectRequiredRequest?.(listing) !== true
    ) {
      return {
        ok: false,
        reason: "connect_required",
        message: Category.getConnectRequiredSetupMessage?.(cat),
      };
    }

    const row = {
      contact_id: newContactId(),
      listing_id: listingId,
      listing_type: pickStr(
        listing?.listing_type,
        listing?.listingType,
        listing?.category,
        global.document?.body?.dataset?.detailType
      ),
      requester_id: requesterId,
      requester_name: getRequesterName(requesterId),
      contact_kind: intent,
      status: "applied",
      memo: pickStr(options?.memo),
      product_id: pickStr(options?.productId),
      product_name: pickStr(options?.productName),
      thread_id: null,
      created_at: nowIso(),
      updated_at: nowIso(),
    };

    const list = readAll();
    list.unshift(row);
    writeAll(list);
    return { ok: true, contact: row, created: true };
  }

  async function activateShopConnectPurchaseChat(listing, contact) {
    const Category = global.TasuPlatformChatCategoryFlow;
    const cat = global.TasuPlatformChatFee?.resolveCategoryKey?.(listing) || "";
    if (!Category?.isShopStoreCategory?.(cat)) return { ok: false, reason: "not_shop" };
    if (Category?.isShopPurchaseConnectEnabled?.(listing) !== true) {
      return { ok: false, reason: "connect_disabled" };
    }
    if (pickStr(contact?.contact_kind) !== "purchase") {
      return { ok: false, reason: "not_purchase" };
    }

    const Fee = global.TasuPlatformChatFee;
    const threadStore = global.TasuChatThreadStore;
    if (!threadStore?.createThreadFromContact || !threadStore.activateThreadAfterFeePaid) {
      return { ok: false, reason: "thread_store_missing" };
    }

    if (contact.status === "active" && contact.thread_id) {
      return {
        ok: true,
        contact,
        threadId: contact.thread_id,
        feePending: false,
        payUrl:
          Fee?.buildChatDetailUrl?.({ threadId: contact.thread_id }) ||
          `chat-detail.html?thread=${encodeURIComponent(contact.thread_id)}`,
      };
    }

    const enriched = {
      ...listing,
      listing_type: pickStr(listing?.listing_type, listing?.listingType, "shop_store"),
      listingType: pickStr(listing?.listingType, listing?.listing_type, "shop_store"),
    };
    const threadResult = await Promise.resolve(
      threadStore.createThreadFromContact(enriched, contact, { feePending: false })
    );
    if (!threadResult?.ok || !threadResult.thread) {
      return threadResult || { ok: false, reason: "thread_create_failed" };
    }

    const threadId = pickStr(threadResult.thread.id);
    const Purchase = global.TasuPlatformChatPurchasePaymentFlow;
    const paymentMethod =
      Purchase?.resolvePaymentMethodFromContext?.({ listing: enriched }) ||
      Purchase?.PAYMENT_METHODS?.PREPAID ||
      "prepaid";
    const purchasePatch = {
      ...(Purchase?.createInitialPurchaseThreadFields?.(paymentMethod) || {}),
      paymentConfirmed: paymentMethod === (Purchase?.PAYMENT_METHODS?.PREPAID || "prepaid"),
      paymentConfirmedAt:
        paymentMethod === (Purchase?.PAYMENT_METHODS?.PREPAID || "prepaid")
          ? new Date().toISOString()
          : "",
      platformConnectMode: "shop_checkout",
      shopProductId: pickStr(contact?.product_id),
      shopProductName: pickStr(contact?.product_name),
    };

    const list = threadStore.readAll?.() || [];
    const idx = list.findIndex((row) => String(row.id) === threadId);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...purchasePatch };
      threadStore.writeAll(list);
    }

    finalizeContactAfterPayment(contact.contact_id, threadId);
    const activated = await Promise.resolve(threadStore.activateThreadAfterFeePaid(threadId));
    if (!activated?.ok) return activated || { ok: false, reason: "activate_failed" };

    try {
      global.TasuTalkPlatformNotify?.notifyPurchaseChatStartedAfterPayment?.({
        thread: activated.thread,
        listing: enriched,
        contact,
        categoryKey: cat,
      });
    } catch (err) {
      console.warn("[TasuListingContactRequestsStore] shop purchase chat notify skipped:", err);
    }

    const nextContact = findContact(enriched.id || enriched.listing_id, contact.contact_id) || contact;
    return {
      ok: true,
      contact: nextContact,
      threadId,
      feePending: false,
      payUrl:
        Fee?.buildChatDetailUrl?.({ threadId }) ||
        `chat-detail.html?thread=${encodeURIComponent(threadId)}`,
    };
  }

  function beginContactChat(listingId, contactId) {
    const listing = resolveListing(listingId);
    const contact = findContact(listingId, contactId);
    if (!contact) return { ok: false, reason: "contact_not_found" };
    if (contact.status === "rejected") return { ok: false, reason: "already_rejected" };

    const Category = global.TasuPlatformChatCategoryFlow;
    const cat = global.TasuPlatformChatFee?.resolveCategoryKey?.(listing) || "";
    if (
      Category?.isShopStoreCategory?.(cat) &&
      Category?.isShopPurchaseConnectEnabled?.(listing) === true &&
      pickStr(contact?.contact_kind) === "purchase"
    ) {
      return activateShopConnectPurchaseChat(listing, contact);
    }

    const Fee = global.TasuPlatformChatFee;
    const threadStore = global.TasuChatThreadStore;
    const Entry = global.TasuPlatformChatConnectEntryFlow;
    const connectEntryListing = Category?.usesConnectEntryPayment?.(listing) === true;

    if (connectEntryListing && contact.status === "active" && contact.thread_id) {
      const threadId = pickStr(contact.thread_id);
      const thread = (threadStore?.readAll?.() || []).find((row) => String(row.id) === threadId);
      const rs = pickStr(thread?.roomStatus, thread?.status).toLowerCase();
      const awaitingSeller =
        rs === "fee_pending" || pickStr(thread?.platformStartPhase) === "awaiting_partner";
      const isConnectEntry =
        Entry?.isConnectEntryThread?.(thread) === true ||
        (awaitingSeller && Fee.isFeePaid?.(threadId));

      if (thread && isConnectEntry && awaitingSeller) {
        const activated = threadStore?.activateThreadAfterFeePaid?.(threadId);
        if (!activated?.ok) return activated || { ok: false, reason: "activate_failed" };
        try {
          Fee?.notifyNonJobDemoChatStartedAfterPayment?.({
            ...activated,
            threadId,
            listing,
            contact,
          });
        } catch (err) {
          console.warn("[TasuListingContactRequestsStore] connect entry chat notify skipped:", err);
        }
        return {
          ok: true,
          contact,
          threadId,
          feePending: false,
          payUrl:
            Fee.buildChatDetailUrl?.({
              threadId,
              thread: activated.thread || thread,
              listing,
              connectEntryPayment: true,
              category: cat,
            }) || `chat-detail.html?thread=${encodeURIComponent(threadId)}`,
        };
      }

      if (thread && Fee.isFeePaid?.(threadId)) {
        return {
          ok: true,
          contact,
          threadId: contact.thread_id,
          feePending: false,
          payUrl:
            Fee.buildChatDetailUrl?.({
              threadId,
              thread,
              listing,
              connectEntryPayment: true,
              category: cat,
            }) ||
            `chat-detail.html?thread=${encodeURIComponent(contact.thread_id)}`,
        };
      }
    }

    if (!Fee?.shouldGateChatStart?.(listing)) {
      return { ok: false, reason: "fee_gate_not_applicable" };
    }
    if (!Fee?.ensurePendingFeeDeferred || !Fee?.buildFeePayUrl) {
      return { ok: false, reason: "fee_module_missing" };
    }

    if (contact.status === "active" && contact.thread_id && Fee.isFeePaid?.(contact.thread_id)) {
      const threadId = pickStr(contact.thread_id);
      const thread = (threadStore?.readAll?.() || []).find((row) => String(row.id) === threadId);
      return {
        ok: true,
        contact,
        threadId: contact.thread_id,
        feePending: false,
        payUrl:
          Fee.buildChatDetailUrl?.({ threadId, thread, listing, category: cat }) ||
          `chat-detail.html?thread=${encodeURIComponent(contact.thread_id)}`,
      };
    }

    const list = readAll();
    const idx = list.findIndex((r) => String(r.contact_id) === String(contactId));
    if (idx < 0) return { ok: false, reason: "contact_not_found" };

    list[idx] = {
      ...list[idx],
      status: "awaiting_fee",
      updated_at: nowIso(),
    };
    writeAll(list);

    const feeAmount = Fee.calcPreChatFee?.(listing) || Fee.MIN_FEE_YEN || 550;
    Fee.ensurePendingFeeDeferred({
      listing,
      contactId: contact.contact_id,
      feeAmount,
    });

    let pageFrom = "";
    try {
      pageFrom = String(new URLSearchParams(global.location?.search || "").get("from") || "").trim();
    } catch {
      pageFrom = "";
    }

    const payUrl = Fee.buildFeePayUrl({
      contactId: contact.contact_id,
      listingId,
      category: Fee.resolveCategoryKey?.(listing),
      listing,
      from: pageFrom || "notify",
    });

    return {
      ok: true,
      feePending: true,
      contact: list[idx],
      payUrl,
      feeAmount,
    };
  }

  function rejectContact(listingId, contactId) {
    const listing = resolveListing(listingId);
    const list = readAll();
    const idx = list.findIndex(
      (r) => String(r.listing_id) === String(listingId) && String(r.contact_id) === String(contactId)
    );
    if (idx < 0) return { ok: false, reason: "contact_not_found" };
    if (list[idx].status === "rejected") return { ok: true, contact: list[idx] };

    list[idx] = {
      ...list[idx],
      status: "rejected",
      updated_at: nowIso(),
    };
    writeAll(list);

    try {
      global.TasuTalkPlatformNotify?.notifyListingContactDeclined?.({
        listing,
        contact: list[idx],
        thread: {
          sellerName: pickStr(listing?.seller_name, listing?.company_name, "出品者"),
        },
      });
    } catch (err) {
      console.warn("[TasuListingContactRequestsStore] decline notify skipped:", err);
    }

    return { ok: true, contact: list[idx] };
  }

  function finalizeContactAfterPayment(contactId, threadId) {
    const cid = pickStr(contactId);
    const tid = pickStr(threadId);
    if (!cid || !tid) return { ok: false, reason: "missing_ids" };

    const list = readAll();
    const idx = list.findIndex((r) => String(r.contact_id) === cid);
    if (idx < 0) return { ok: false, reason: "contact_not_found" };

    list[idx] = {
      ...list[idx],
      status: "active",
      thread_id: tid,
      updated_at: nowIso(),
    };
    writeAll(list);
    return { ok: true, contact: list[idx] };
  }

  global.TasuListingContactRequestsStore = {
    STORAGE_KEY,
    EVENT_NAME,
    readAll,
    listByListing,
    findContact,
    findById,
    hasPendingContact,
    isListingOwner,
    resolveListing,
    submitContact,
    beginContactChat,
    activateShopConnectPurchaseChat,
    rejectContact,
    finalizeContactAfterPayment,
    getRequesterId,
    getRequesterName,
  };
})(typeof window !== "undefined" ? window : globalThis);
