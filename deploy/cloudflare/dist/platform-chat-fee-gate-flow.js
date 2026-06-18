/**
 * Connectなし — 購入/依頼 → 出品者通知 → 管理一覧 → 550円 → チャット開始（カテゴリ共通）
 * 文言差分は TasuPlatformChatCategoryFlow.CATEGORY_SPECS のみ
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

  const BENCH_PARTNER_A_BY_PROFILE = Object.freeze({
    skill: "u_sachi",
    job: "u_job_demo_full",
    worker: "demo-worker-001",
    general: "u_general_demo",
    product: "u_product",
    shop: "u_shop_demo",
    shop_store: "u_shop_demo",
    business: "u_business_demo",
    business_service: "u_business_demo",
    builder: "u_builder_demo",
  });

  function resolveCategoryKey(listing) {
    return global.TasuPlatformChatFee?.resolveCategoryKey?.(listing) || "";
  }

  function resolveBenchProfileIdFromContext(params) {
    const p = params || new URLSearchParams(global.location?.search || "");
    const explicit = pickStr(p.get("demoProfile"));
    if (explicit) return explicit;
    return pickStr(global.TasuPlatformChatDualWindowDemo?.getProfile?.()?.id);
  }

  function resolveBenchSellerUserId(listing, params) {
    const p = params || new URLSearchParams(global.location?.search || "");
    const Demo = global.TasuPlatformChatDualWindowDemo;
    const profileId = resolveBenchProfileIdFromContext(p);
    const profile = Demo?.getProfile?.(profileId, p.get("demoConnect") === "1");
    const cat = resolveCategoryKey(listing);
    const catalogId = pickStr(listing?.id, listing?.listing_id);
    const catalog =
      global.TasuListingDemoCatalog?.STORE_BY_ID?.[catalogId] ||
      global.TasuListingContactRequestsStore?.resolveListing?.(catalogId);
    return pickStr(
      profile?.partnerAId,
      BENCH_PARTNER_A_BY_PROFILE[profileId],
      BENCH_PARTNER_A_BY_PROFILE[cat],
      listing?.user_id,
      listing?.seller_user_id,
      listing?.author_user_id,
      catalog?.user_id,
      catalog?.seller_user_id
    );
  }

  /** pushNotification 行 / listing から A 側 notify refresh 先を解決 */
  function resolveBenchSellerRecipientId(row, listing, params) {
    const explicit = pickStr(row?.recipientUserId);
    if (explicit) return explicit;
    const fromListing = resolveBenchSellerUserId(listing, params);
    if (fromListing) return fromListing;
    const p = params || new URLSearchParams(global.location?.search || "");
    const role = pickStr(row?.recipientRole).toLowerCase();
    if (!role || !["seller", "worker", "provider", "poster"].includes(role)) return "";
    let profileId = resolveBenchProfileIdFromContext(p);
    if (!profileId) {
      const lid = pickStr(row?.listingId, row?.listing_id, listing?.id, listing?.listing_id);
      const map = global.TasuPlatformChatLiveFlow?.DETAIL_LISTING_BY_CATEGORY;
      if (lid && map) {
        for (const [key, val] of Object.entries(map)) {
          if (val === lid) {
            profileId = key;
            break;
          }
        }
      }
    }
    return pickStr(BENCH_PARTNER_A_BY_PROFILE[profileId]);
  }

  /** 初回CTA後 — A上 notify iframe を refresh（全カテゴリ共通） */
  function postBenchSellerNotifyRefresh(row, listing) {
    if (global.TasuPlatformChatBenchEmbed?.postBenchInitialNotifyRefresh?.(row)) {
      return true;
    }
    if (!global.parent || global.parent === global) return false;
    const recipientUserId = resolveBenchSellerRecipientId(row, listing);
    if (!recipientUserId) return false;
    try {
      global.parent.postMessage(
        { type: "tasu-bench-worker-requested", recipientUserId },
        "*"
      );
      return true;
    } catch {
      return false;
    }
  }

  function usesConnectFreeFeeGate(listing) {
    if (global.TasuPlatformChatConnectEntryFlow?.usesConnectEntryPayment?.(listing) === true) {
      return false;
    }
    const cat = resolveCategoryKey(listing);
    if (!cat || cat === "job") return false;
    return global.TasuPlatformChatFee?.shouldGateChatStart?.(listing) === true;
  }

  function gateCopy(listing) {
    const cat = resolveCategoryKey(listing);
    return global.TasuPlatformChatCategoryFlow?.getConnectFreeGateCopy?.(cat) || {};
  }

  function submitConnectFreeContact(listing, options) {
    const opts = options || {};
    if (!usesConnectFreeFeeGate(listing)) {
      return { ok: false, reason: "not_fee_gate_category" };
    }

    const store = global.TasuListingContactRequestsStore;
    if (!store?.submitContact) return { ok: false, reason: "contact_store_missing" };
    const result = store.submitContact(listing, opts);
    if (!result?.ok) return result;
    notifyConnectFreeSeller(listing, result.contact, opts);
    afterConnectFreeBuyerSubmitted(listing, result.contact);
    return result;
  }

  function notifyConnectFreeSeller(listing, contact, options) {
    const opts = options || {};
    const notify = global.TasuTalkPlatformNotify;
    if (!notify?.notifyListingPurchased) return null;
    const cat = resolveCategoryKey(listing);
    const Fee = global.TasuPlatformChatFee;
    const intent = pickStr(opts.intent, contact?.contact_kind);
    return notify.notifyListingPurchased(
      { listing, contact, intent },
      {
        type: Fee?.getNotifyType?.(cat) || cat,
        categoryLabel: Fee?.getCategoryLabel?.(cat) || cat,
      }
    );
  }

  function afterConnectFreeBuyerSubmitted(listing, contact) {
    if (global.TasuPlatformChatBenchEmbed?.postBenchBuyerPurchased?.()) {
      /* bench parent navigates B-chat to buyer-wait */
    } else {
      try {
        const params = new URLSearchParams(global.location.search);
        if (params.get("benchEmbed") === "1") {
          const Live = global.TasuPlatformChatLiveFlow;
          const Demo = global.TasuPlatformChatDualWindowDemo;
          const profileId = params.get("demoProfile");
          const connect = params.get("demoConnect") === "1";
          const profile = Demo?.getProfile?.(profileId, connect);
          const href =
            profile && Live?.benchBuyerWaitingUrl
              ? Live.benchBuyerWaitingUrl(profile, profile.partnerBId)
              : "";
          if (href) {
            global.parent.postMessage(
              {
                type: "tasu-bench-frame-navigate",
                slot: "b-chat",
                href,
                opensBuyerWaiting: true,
              },
              "*"
            );
          }
        }
      } catch {
        /* ignore */
      }
    }

    try {
      postBenchSellerNotifyRefresh(
        { recipientUserId: resolveBenchSellerUserId(listing), recipientRole: "seller" },
        listing
      );
    } catch {
      /* ignore */
    }

    try {
      const params = new URLSearchParams(global.location.search);
      const Demo = global.TasuPlatformChatDualWindowDemo;
      const profile = Demo?.getProfile?.(
        resolveBenchProfileIdFromContext(params),
        params.get("demoConnect") === "1"
      );
      global.TasuPlatformChatLiveFlow?.ensureBenchPreStartSellerNotify?.(profile, { refresh: true });
    } catch {
      /* ignore */
    }

    const eventName =
      global.TasuListingContactRequestsStore?.EVENT_NAME || "tasu:listing-contacts-changed";
    global.dispatchEvent(new CustomEvent(eventName, { detail: { listing } }));
    global.TasuListingDetailContacts?.refresh?.(listing);
  }

  function buyerSubmittedToast(listing) {
    return pickStr(gateCopy(listing).buyerSubmittedToast, "送信しました");
  }

  function alreadySubmittedReason() {
    return "already_submitted";
  }

  function alreadySubmittedToast(listing) {
    return pickStr(gateCopy(listing).alreadySubmittedToast, "すでに送信済みです");
  }

  function ownerCannotSubmitToast(listing) {
    return pickStr(gateCopy(listing).ownerCannotSubmitToast, "送信できません");
  }

  function clearConnectFreeGateRecords(profile) {
    if (!profile) return;
    const Demo = global.TasuPlatformChatDualWindowDemo;
    if (Demo?.clearContactRequestPreStart) {
      Demo.clearContactRequestPreStart(profile);
      return;
    }
    try {
      const listingId = pickStr(profile.listingId);
      const raw = global.localStorage.getItem("tasful_listing_contact_requests_v1");
      const list = raw ? JSON.parse(raw) : [];
      const next = (Array.isArray(list) ? list : []).filter(
        (r) => String(r.listing_id) !== listingId
      );
      global.localStorage.setItem("tasful_listing_contact_requests_v1", JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  global.TasuPlatformChatFeeGateFlow = {
    usesConnectFreeFeeGate,
    submitConnectFreeContact,
    notifyConnectFreeSeller,
    afterConnectFreeBuyerSubmitted,
    postBenchSellerNotifyRefresh,
    resolveBenchSellerRecipientId,
    resolveBenchProfileIdFromContext,
    buyerSubmittedToast,
    alreadySubmittedReason,
    alreadySubmittedToast,
    ownerCannotSubmitToast,
    clearConnectFreeGateRecords,
    resolveCategoryKey,
    resolveBenchSellerUserId,
    BENCH_PARTNER_A_BY_PROFILE,
  };
})(typeof window !== "undefined" ? window : globalThis);
