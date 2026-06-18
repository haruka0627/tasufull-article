/**
 * TASFUL市場 — buyer / seller identity（NB-3 STEP 5）
 * 本番: JWT talk_user_id + DB owner のみ。LS / URL / u_me 禁止。
 */
(function (global) {
  "use strict";

  const SELLER_PROFILE_KEY = "tasu_market_seller_profile";
  const DEFAULT_SELLER_SHOP_ID = "tasu-market-seller-me";

  const DEMO_SELLER_BY_SHOP = Object.freeze({
    "demo-shop-tasful-bakery": "u_bakery",
    "demo-shop-haru-cafe": "u_shop_demo",
    "demo-shop-reworks": "u_shop_demo",
    "demo-shop-bakery": "u_bakery",
    "demo-shop-sushi": "u_shop_demo",
  });

  let cachedIdentity = null;
  let shopOwnerCache = Object.create(null);
  let refreshPromise = null;

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function auth() {
    return global.TasuAuthCurrentUser || {};
  }

  function canUseLsFallback() {
    return auth().canUseLocalStorageFallback?.() === true;
  }

  function isProductionHost() {
    return auth().isProductionHost?.() === true;
  }

  function readDemoUserIdFromUrl() {
    if (!canUseLsFallback()) return "";
    try {
      return pickStr(new URLSearchParams(global.location?.search || "").get("userId"));
    } catch {
      return "";
    }
  }

  function readDemoSellerProfile() {
    if (!canUseLsFallback()) return {};
    try {
      const raw = JSON.parse(global.localStorage.getItem(SELLER_PROFILE_KEY) || "null");
      return raw && typeof raw === "object" ? raw : {};
    } catch {
      return {};
    }
  }

  function resolveBuyerId() {
    const jwtBuyer = pickStr(auth().getCurrentUser?.()?.talkUserId);
    if (isProductionHost()) return jwtBuyer;
    return pickStr(
      jwtBuyer,
      readDemoUserIdFromUrl(),
      global.TasuChatUserIdentity?.getEffectiveUserId?.(),
      readDemoMemberUserId(),
      readDemoConfigUserId(),
      "u_me"
    );
  }

  function readDemoMemberUserId() {
    if (!canUseLsFallback()) return "";
    try {
      const raw = global.localStorage.getItem("tasu_member_session");
      const member = raw ? JSON.parse(raw) : null;
      if (!member || typeof member !== "object") return "";
      return pickStr(
        member.talk_user_id,
        member.userId,
        member.user_id,
        member.id
      );
    } catch {
      return "";
    }
  }

  function readDemoConfigUserId() {
    if (!canUseLsFallback()) return "";
    const cfg = global.TASU_CHAT_SUPABASE_CONFIG || {};
    return pickStr(cfg.currentUserId, cfg.me?.id);
  }

  function resolveDemoSellerShopId() {
    const profile = readDemoSellerProfile();
    return pickStr(profile.shopId, DEFAULT_SELLER_SHOP_ID);
  }

  function resolveDemoSellerUserId(shopId) {
    const sid = pickStr(shopId);
    if (sid && DEMO_SELLER_BY_SHOP[sid]) return DEMO_SELLER_BY_SHOP[sid];
    return pickStr(readDemoSellerProfile().sellerUserId, readDemoSellerProfile().userId);
  }

  function listingOwnerId(row) {
    if (!row || typeof row !== "object") return "";
    const fd = row.form_data && typeof row.form_data === "object" ? row.form_data : {};
    return pickStr(
      row.user_id,
      row.seller_user_id,
      row.owner_id,
      row.partner_id,
      fd.user_id,
      fd.seller_user_id,
      fd.owner_id
    );
  }

  function listingShopId(row) {
    if (!row || typeof row !== "object") return "";
    const fd = row.form_data && typeof row.form_data === "object" ? row.form_data : {};
    return pickStr(row.shop_id, row.id, fd.shop_id);
  }

  async function fetchOwnedShopsFromDb(talkUserId) {
    const uid = pickStr(talkUserId);
    if (!uid) return [];
    const sb = global.TasuSupabase?.getClient?.();
    if (!sb?.from) return [];

    const owned = [];
    const tables = ["listings", "business_listings"];
    for (let i = 0; i < tables.length; i += 1) {
      const table = tables[i];
      try {
        const { data, error } = await sb
          .from(table)
          .select("id, user_id, seller_user_id, owner_id, partner_id, form_data, listing_type")
          .eq("user_id", uid)
          .limit(20);
        if (error || !Array.isArray(data)) continue;
        data.forEach((row) => {
          const shopId = listingShopId(row);
          if (!shopId) return;
          owned.push({
            shopId,
            ownerUserId: listingOwnerId(row) || uid,
            listingId: pickStr(row.id),
            table,
          });
          shopOwnerCache[shopId] = listingOwnerId(row) || uid;
        });
      } catch {
        /* ignore */
      }
    }
    return owned;
  }

  async function fetchShopOwnerUserIdFromDb(shopId) {
    const sid = pickStr(shopId);
    if (!sid) return "";
    if (shopOwnerCache[sid]) return shopOwnerCache[sid];

    const sb = global.TasuSupabase?.getClient?.();
    if (!sb?.from) return "";

    const tables = ["listings", "business_listings"];
    for (let i = 0; i < tables.length; i += 1) {
      const table = tables[i];
      try {
        const { data, error } = await sb
          .from(table)
          .select("id, user_id, seller_user_id, owner_id, partner_id, form_data")
          .eq("id", sid)
          .limit(1);
        if (error) continue;
        const row = Array.isArray(data) ? data[0] : data;
        const owner = listingOwnerId(row);
        if (owner) {
          shopOwnerCache[sid] = owner;
          return owner;
        }
      } catch {
        /* ignore */
      }
    }
    return "";
  }

  function buildIdentity(partial) {
    const buyerId = pickStr(partial?.buyerId);
    const sellerShopId = pickStr(partial?.sellerShopId);
    const sellerUserId = pickStr(partial?.sellerUserId);
    const ownedShopIds = Array.isArray(partial?.ownedShopIds) ? partial.ownedShopIds.slice() : [];
    return {
      buyerId,
      sellerShopId,
      sellerUserId,
      ownedShopIds,
      isBuyerAuthenticated: Boolean(buyerId),
      isSellerRegistered: Boolean(sellerShopId || ownedShopIds.length),
      source: pickStr(partial?.source, "none"),
      connectReady: global.TasuConnectState?.isConnectReady?.() === true,
      connectSource: global.TasuConnectState?.getConnectStateSource?.() || "",
    };
  }

  function computeIdentity(dbOwnedShops) {
    const buyerId = resolveBuyerId();
    const owned = Array.isArray(dbOwnedShops) ? dbOwnedShops : [];

    if (isProductionHost()) {
      const ownedShopIds = owned.map((o) => o.shopId).filter(Boolean);
      const primary = owned[0] || null;
      return buildIdentity({
        buyerId,
        sellerShopId: primary?.shopId || "",
        sellerUserId: primary?.ownerUserId || buyerId,
        ownedShopIds,
        source: buyerId ? (owned.length ? "jwt_db_owner" : "jwt") : "unauthenticated",
      });
    }

    const sellerShopId = resolveDemoSellerShopId();
    const sellerUserId = pickStr(resolveDemoSellerUserId(sellerShopId), buyerId);
    let source = "demo_fallback";
    if (readDemoUserIdFromUrl()) source = "demo_url";
    else if (auth().getCurrentUser?.()?.source === "jwt") source = "jwt_demo";
    else if (readDemoSellerProfile().shopId) source = "demo_localStorage";

    return buildIdentity({
      buyerId,
      sellerShopId,
      sellerUserId,
      ownedShopIds: sellerShopId ? [sellerShopId] : [],
      source,
    });
  }

  function getMarketIdentity() {
    if (!cachedIdentity) cachedIdentity = computeIdentity([]);
    return { ...cachedIdentity };
  }

  function getMarketIdentitySource() {
    return getMarketIdentity().source;
  }

  function getCurrentBuyerId() {
    return getMarketIdentity().buyerId;
  }

  function getCurrentSellerId() {
    return getMarketIdentity().sellerUserId;
  }

  function getCurrentSellerShopId() {
    return getMarketIdentity().sellerShopId;
  }

  function isCurrentBuyer(userId) {
    const target = pickStr(userId);
    const buyer = getCurrentBuyerId();
    if (!target || !buyer) return false;
    return target === buyer;
  }

  function isCurrentSeller(shopIdOrOwnerId) {
    const key = pickStr(shopIdOrOwnerId);
    if (!key) return false;
    const identity = getMarketIdentity();
    if (identity.ownedShopIds.includes(key)) return true;
    if (identity.sellerShopId && identity.sellerShopId === key) return true;
    if (identity.sellerUserId && identity.sellerUserId === key) return true;
    if (!isProductionHost() && shopOwnerCache[key] && shopOwnerCache[key] === identity.buyerId) return true;
    return false;
  }

  function requireBuyer(options) {
    const opts = options && typeof options === "object" ? options : {};
    const buyerId = getCurrentBuyerId();
    if (buyerId) return getMarketIdentity();
    const err = new Error("TasuMarketIdentity: buyer authentication required");
    err.code = "BUYER_REQUIRED";
    if (opts.redirect !== false) {
      try {
        global.location.assign(pickStr(opts.redirectUrl, "login.html?returnUrl=shop-market-mypage.html"));
      } catch {
        /* ignore */
      }
    }
    throw err;
  }

  function requireSeller(options) {
    const opts = options && typeof options === "object" ? options : {};
    const identity = getMarketIdentity();
    const shopId = pickStr(opts.shopId, identity.sellerShopId);
    if (shopId && isCurrentSeller(shopId)) return identity;
    if (identity.sellerUserId && identity.sellerUserId === identity.buyerId) return identity;
    const err = new Error("TasuMarketIdentity: seller authorization required");
    err.code = "SELLER_REQUIRED";
    throw err;
  }

  function resolveSellerUserIdForShop(shopId) {
    const sid = pickStr(shopId);
    if (!sid) return "";
    if (isProductionHost()) {
      return pickStr(shopOwnerCache[sid]);
    }
    return pickStr(DEMO_SELLER_BY_SHOP[sid], resolveDemoSellerUserId(sid), "u_bakery");
  }

  async function resolveSellerUserIdForShopAsync(shopId) {
    const sid = pickStr(shopId);
    if (!sid) return "";
    if (!isProductionHost()) {
      return pickStr(DEMO_SELLER_BY_SHOP[sid], resolveDemoSellerUserId(sid), "u_bakery");
    }
    const cached = shopOwnerCache[sid];
    if (cached) return cached;
    return fetchShopOwnerUserIdFromDb(sid);
  }

  function isListingOwnedByCurrentUser(listing) {
    const buyer = getCurrentBuyerId();
    if (!buyer || !listing) return false;
    return listingOwnerId(listing) === buyer;
  }

  function invalidateMarketIdentityCache() {
    cachedIdentity = null;
    shopOwnerCache = Object.create(null);
    refreshPromise = null;
  }

  async function refreshMarketIdentityFromDb(options) {
    const opts = options && typeof options === "object" ? options : {};
    if (refreshPromise && !opts.force) {
      await refreshPromise;
      return getMarketIdentity();
    }
    refreshPromise = (async () => {
      const buyerId = resolveBuyerId();
      let owned = [];
      if (buyerId && global.TasuSupabase?.isConfigured?.()) {
        owned = await fetchOwnedShopsFromDb(buyerId);
      }
      cachedIdentity = computeIdentity(owned);
      return cachedIdentity;
    })();
    try {
      await refreshPromise;
    } finally {
      refreshPromise = null;
    }
    return getMarketIdentity();
  }

  const MARKET_IDENTITY_SCRIPT = [
    "talk-runtime.js",
    "auth-current-user.js",
    "connect-state.js",
    "market-identity.js",
  ];

  global.TasuMarketIdentity = {
    SELLER_PROFILE_KEY,
    DEMO_SELLER_BY_SHOP,
    MARKET_IDENTITY_SCRIPT,
    isProductionHost,
    canUseLsFallback,
    getMarketIdentity,
    getMarketIdentitySource,
    getCurrentBuyerId,
    getCurrentSellerId,
    getCurrentSellerShopId,
    isCurrentBuyer,
    isCurrentSeller,
    isListingOwnedByCurrentUser,
    requireBuyer,
    requireSeller,
    resolveSellerUserIdForShop,
    resolveSellerUserIdForShopAsync,
    refreshMarketIdentityFromDb,
    invalidateMarketIdentityCache,
    listingOwnerId,
  };
})(typeof window !== "undefined" ? window : globalThis);
