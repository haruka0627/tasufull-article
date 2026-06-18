/**
 * プラット通知 v3 — Connectなし手数料デモスレッド（fee_pending）
 */
(function (global) {
  "use strict";

  const BOOT_MARKER = "tasful_platform_verify_fee_threads_v1";

  const NOTIFY_SPECS = Object.freeze({
    "platform-verify-worker-request-001": {
      threadId: "chat-demo-worker-fee-001",
      listingId: "demo-worker-001",
      category: "worker",
      contactKind: "request",
      notifyTitle: "依頼が届きました",
    },
    "platform-verify-worker-accept-001": {
      threadId: "chat-demo-worker-fee-001",
      listingId: "demo-worker-001",
      category: "worker",
      contactKind: "accept",
      notifyTitle: "依頼を受諾しました",
    },
    "platform-verify-skill-consult-001": {
      threadId: "chat-demo-skill-fee-001",
      listingId: "demo-skill-001",
      category: "skill",
      contactKind: "consult",
      notifyTitle: "相談が届きました",
    },
    "platform-verify-skill-purchase-001": {
      threadId: "chat-demo-skill-fee-001",
      listingId: "demo-skill-001",
      category: "skill",
      contactKind: "purchase",
      notifyTitle: "スキルが購入されました",
    },
    "platform-verify-product-inquiry-001": {
      threadId: "chat-demo-product-fee-001",
      listingId: "demo-product-001",
      category: "product",
      contactKind: "inquiry",
      notifyTitle: "商品について問い合わせがありました",
    },
    "platform-verify-product-purchase-001": {
      threadId: "chat-demo-product-fee-001",
      listingId: "demo-product-001",
      category: "product",
      contactKind: "purchase",
      notifyTitle: "商品が購入されました",
    },
    "platform-verify-business-consult-001": {
      threadId: "chat-demo-business-fee-001",
      listingId: "demo-business-service-001",
      category: "business_service",
      contactKind: "consult",
      notifyTitle: "相談が届きました",
    },
    "platform-verify-shop-inquiry-001": {
      threadId: "chat-demo-shop-fee-001",
      listingId: "demo-shop-reworks",
      category: "shop_store",
      contactKind: "inquiry",
      notifyTitle: "問い合わせが届きました",
    },
    "platform-verify-shop-purchase-001": {
      threadId: "chat-demo-shop-fee-001",
      listingId: "demo-shop-reworks",
      category: "shop_store",
      contactKind: "purchase",
      notifyTitle: "商品が購入されました",
    },
  });

  const THREAD_IDS = Object.freeze([
    "chat-demo-worker-fee-001",
    "chat-demo-skill-fee-001",
    "chat-demo-product-fee-001",
    "chat-demo-business-fee-001",
    "chat-demo-shop-fee-001",
  ]);

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function resolveListing(listingId) {
    const id = pickStr(listingId);
    const catalog = global.TasuListingDemoCatalog?.STORE_BY_ID?.[id];
    if (catalog) return { ...catalog, id, listing_id: id };

    const shop = global.TasuShopStoreDemo?.getById?.(id);
    if (shop) {
      const priceDigits = String(shop.priceRange || shop.products?.[0]?.price || "").replace(
        /[^\d]/g,
        ""
      );
      return {
        id,
        listing_id: id,
        listing_type: "shop_store",
        title: pickStr(shop.title, shop.shopName) || id,
        company_name: pickStr(shop.shopName, shop.title),
        user_id: pickStr(shop.user_id, "u_shop_demo"),
        price_amount: priceDigits ? Number(priceDigits) : 5500,
        category: "店舗販売",
      };
    }

    const local = global.TasuListingLocalStore?.fetchById?.(id);
    if (local) {
      return global.TasuListingLocalStore?.toDetailListing?.(local) || local;
    }
    return { id, listing_id: id, listing_type: "general", title: id };
  }

  function resolveBuyer() {
    const buyerId =
      global.TasuChatUserIdentity?.getEffectiveUserId?.() ||
      global.TASU_CHAT_SUPABASE_CONFIG?.currentUserId ||
      "u_me";
    const buyerName =
      global.TasuChatUserIdentity?.getEffectiveDisplayName?.() || "依頼者（デモ）";
    return { buyerId, buyerName };
  }

  function resolveBuyerForSpec(spec) {
    const contactKind = pickStr(spec?.contactKind);
    if (contactKind === "purchase") {
      return { buyerId: "u_hiro", buyerName: "ひろ" };
    }
    return resolveBuyer();
  }

  function resolveSeller(listing) {
    const store = global.TasuChatThreadStore;
    if (store?.resolveSeller) {
      const resolved = store.resolveSeller?.(listing);
      if (resolved?.sellerId) return resolved;
    }
    const extra = listing?.category_extra?.shop_store || {};
    return {
      sellerId: pickStr(listing?.user_id, listing?.seller_user_id) || "demo-seller",
      sellerName: pickStr(listing?.company_name, extra.shop_name, listing?.seller_name) || "掲載者",
    };
  }

  function buildThreadRow(spec, listing, options) {
    const notifyId = pickStr(options?.notifyId, spec.id);
    const { buyerId, buyerName } = resolveBuyerForSpec(spec);
    const { sellerId, sellerName } = resolveSeller(listing);
    const store = global.TasuChatThreadStore;
    const listingType = store?.resolveListingTypeKey?.(listing) || spec.category;
    const detailUrl = store?.buildDetailUrl?.(listing) || "#";
    const now = new Date().toISOString();
    const contactKind = pickStr(options?.contactKind, spec.contactKind) || "consult";
    const notifyTitle = pickStr(options?.notifyTitle, spec.notifyTitle);

    return {
      id: spec.threadId,
      chatDomain: "work",
      threadKind: spec.category === "worker" ? "worker_request" : "listing_inquiry",
      listingId: spec.listingId,
      listingType,
      listingTitle: pickStr(listing.title, listing.service_name) || spec.listingId,
      category:
        global.TasuPlatformChatFee?.getCategoryLabel?.(spec.category) ||
        pickStr(listing.category) ||
        spec.category,
      image: pickStr(listing.image_url, listing.thumbnail_url, listing.image),
      detailUrl,
      sellerId,
      sellerName,
      partnerUserId: sellerId,
      buyerId,
      buyerName,
      status: "fee_pending",
      roomStatus: "fee_pending",
      source: "platform-verify-fee-demo",
      platformStartPhase: "awaiting_partner",
      platformContactKind: contactKind,
      platformNotifyTitle: notifyTitle,
      platformNotifyId: pickStr(options?.notifyId) || notifyId,
      lastMessage: global.TasuChatThreadStore?.resolveInitialMessage?.(listing, {
        intent: contactKind,
      }),
      createdAt: now,
      updatedAt: now,
      _feePending: true,
    };
  }

  function resetMessages(threadId) {
    const store = global.TasuChatThreadStore;
    if (!store?.MESSAGES_KEY) return;
    try {
      const raw = global.localStorage.getItem(store.MESSAGES_KEY);
      const map = raw ? JSON.parse(raw) : {};
      if (map && typeof map === "object") {
        delete map[threadId];
        global.localStorage.setItem(store.MESSAGES_KEY, JSON.stringify(map));
      }
    } catch {
      /* ignore */
    }
  }

  function resetFee(threadId) {
    try {
      const raw = global.localStorage.getItem("tasful_platform_chat_fees_v1");
      const parsed = raw ? JSON.parse(raw) : [];
      const list = (Array.isArray(parsed) ? parsed : []).filter(
        (row) => pickStr(row.threadId, row.thread_id) !== threadId
      );
      global.localStorage.setItem("tasful_platform_chat_fees_v1", JSON.stringify(list));
    } catch {
      /* ignore */
    }
  }

  /**
   * @param {string} notifyId
   * @param {{ force?: boolean }} [options]
   */
  function resetVerifyFeeThread(notifyId, options) {
    const spec = NOTIFY_SPECS[notifyId];
    if (!spec) return { ok: false, reason: "unknown_notify" };

    const listing = resolveListing(spec.listingId);
    const store = global.TasuChatThreadStore;
    if (!store?.readAll || !store?.STORAGE_KEY) return { ok: false, reason: "no_store" };

    const thread = buildThreadRow(spec, listing, { ...options, notifyId });
    const threads = store.readAll().filter((row) => String(row.id) !== spec.threadId);
    threads.unshift(thread);
    global.localStorage.setItem(store.STORAGE_KEY, JSON.stringify(threads));
    global.dispatchEvent?.(
      new CustomEvent(store.EVENT_NAME || "tasful-chat-threads-changed", {
        detail: { list: threads },
      })
    );

    resetMessages(spec.threadId);
    resetFee(spec.threadId);

    const Fee = global.TasuPlatformChatFee;
    const feeRow = Fee?.ensurePendingFee?.(listing, thread, {});
    return { ok: true, spec, thread, feeRow, feeAmount: feeRow?.feeAmount };
  }

  function ensureVerifyFeeDemoThreads() {
    try {
      if (global.localStorage.getItem(BOOT_MARKER) === "1") return [];
    } catch {
      /* ignore */
    }
    const results = [];
    const seen = new Set();
    Object.keys(NOTIFY_SPECS).forEach((notifyId) => {
      const spec = NOTIFY_SPECS[notifyId];
      if (seen.has(spec.threadId)) return;
      seen.add(spec.threadId);
      results.push(resetVerifyFeeThread(notifyId, { force: false }));
    });
    try {
      global.localStorage.setItem(BOOT_MARKER, "1");
    } catch {
      /* ignore */
    }
    return results;
  }

  function ensureThreadForFeePay(params) {
    const threadId = pickStr(params?.threadId, params?.thread);
    if (!threadId) return null;
    const store = global.TasuChatThreadStore;
    const existing = store?.readAll?.().find((row) => String(row.id) === threadId);
    if (existing) return existing;

    const notifyEntry = Object.entries(NOTIFY_SPECS).find(([, spec]) => spec.threadId === threadId);
    if (notifyEntry) {
      return resetVerifyFeeThread(notifyEntry[0], { force: true })?.thread || null;
    }
    return null;
  }

  function getNotifySpec(notifyId) {
    return NOTIFY_SPECS[notifyId] || null;
  }

  global.TasuPlatformChatDemoSeed = {
    NOTIFY_SPECS,
    THREAD_IDS,
    resetVerifyFeeThread,
    ensureVerifyFeeDemoThreads,
    ensureThreadForFeePay,
    getNotifySpec,
    resolveListing,
  };
})(typeof window !== "undefined" ? window : globalThis);
