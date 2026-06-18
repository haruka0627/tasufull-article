/**
 * 店舗商品 — 購入フロー（Stripe Connect / 店舗売上 + プラットフォーム手数料）
 */
(function () {
  "use strict";

  const LOCAL_ORDERS_KEY = "tasu_shop_orders";

  function getStripeCfg() {
    return window.TasuStripeShopConfig || window.TasuStripeFeaturedConfig || null;
  }

  function getPublishableAnonKey() {
    const cfg = getStripeCfg();
    const key =
      cfg?.getPublishableAnonKey?.() ||
      cfg?.anonKey ||
      window.TasuSupabasePublicKey?.resolvePublishableAnonKey?.(
        window.TASU_CHAT_SUPABASE_CONFIG || window.TASU_SUPABASE_CONFIG || {}
      ) ||
      "";
    if (window.TasuSupabasePublicKey?.isForbiddenKey?.(key)) return "";
    return key;
  }

  function stripeHeaders() {
    const anonKey = getPublishableAnonKey();
    if (!anonKey) {
      throw new Error("Supabase の公開キーが未設定です。");
    }
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${anonKey}`,
      apikey: anonKey,
    };
  }

  function parsePriceYen(raw) {
    if (raw == null || raw === "") return 0;
    if (typeof raw === "number" && Number.isFinite(raw)) return Math.max(0, Math.round(raw));
    const m = String(raw).replace(/,/g, "").match(/(\d+)/);
    return m ? Math.max(0, parseInt(m[1], 10)) : 0;
  }

  function formatYen(amount) {
    const n = Math.max(0, Math.round(Number(amount) || 0));
    return `¥${n.toLocaleString("ja-JP")}`;
  }

  function clampQuantity(q) {
    const n = Math.floor(Number(q) || 1);
    return Math.min(99, Math.max(1, n));
  }

  function calcFees(amountTotal, platformFeeRate) {
    if (window.TasuShopPayout?.calcFees) {
      return window.TasuShopPayout.calcFees(amountTotal, platformFeeRate);
    }
    const total = Math.max(0, Math.round(Number(amountTotal) || 0));
    const rate = Number(platformFeeRate) || 0.1;
    const platform_fee_amount = Math.round(total * rate);
    return {
      amount_total: total,
      platform_fee_amount,
      seller_amount: total - platform_fee_amount,
    };
  }

  function buildProductDetailUrl(shopId, productId) {
    const shop = String(shopId || "").trim();
    const product = String(productId || "").trim();
    if (!shop || !product) return "detail-shop-product.html";
    const u = new URL("detail-shop-product.html", window.location.href);
    u.searchParams.set("shopId", shop);
    u.searchParams.set("productId", product);
    return u.pathname + u.search;
  }

  function readUrlFlag(name) {
    try {
      const v = String(new URLSearchParams(window.location.search).get(name) || "").trim().toLowerCase();
      if (v === "1" || v === "true") return true;
      if (v === "0" || v === "false") return false;
    } catch {
      /* ignore */
    }
    return null;
  }

  function buildCheckoutUrl(params) {
    const shopId = String(params?.shopId || params?.shop_id || "").trim();
    const productId = String(params?.productId || params?.product_id || "").trim();
    const quantity = clampQuantity(params?.quantity);
    const priceYen = parsePriceYen(params?.price ?? params?.priceYen ?? params?.unit_price);
    const u = new URL("checkout.html", window.location.href);
    if (shopId) u.searchParams.set("shopId", shopId);
    if (productId) u.searchParams.set("productId", productId);
    u.searchParams.set("quantity", String(quantity));
    if (priceYen > 0) u.searchParams.set("price", String(priceYen));
    const name = String(params?.productName || params?.product_name || "").trim();
    if (name) u.searchParams.set("productName", name);
    ["demoConnect", "talkDev", "userId", "benchEmbed", "paymentMethod"].forEach((key) => {
      const fromParams = params?.[key];
      if (fromParams != null && String(fromParams).trim() !== "") {
        u.searchParams.set(key, String(fromParams));
        return;
      }
      try {
        const cur = new URLSearchParams(window.location.search).get(key);
        if (cur != null && String(cur).trim() !== "") u.searchParams.set(key, String(cur));
      } catch {
        /* ignore */
      }
    });
    return u.pathname + u.search;
  }

  function resolveShopConnectContext(params) {
    const demoConnect = params?.demoConnect === true || readUrlFlag("demoConnect") === true;
    return { demoConnect };
  }

  function isShopConnectPurchaseMode(listing, params) {
    const Category = window.TasuPlatformChatCategoryFlow;
    if (!Category?.isShopPurchaseConnectEnabled) return false;
    return Category.isShopPurchaseConnectEnabled(listing, {
      context: resolveShopConnectContext(params),
    });
  }

  function recordShopPurchaseContact(params) {
    const shopId = String(params?.shopId || params?.shop_id || "").trim();
    const Contacts = window.TasuListingContactRequestsStore;
    const listing = params?.shop || Contacts?.resolveListing?.(shopId);
    if (!listing) return { ok: false, reason: "missing_listing" };
    if (!isShopConnectPurchaseMode(listing, params)) {
      return { ok: false, reason: "connect_disabled" };
    }

    const enriched = {
      ...listing,
      listing_type: String(listing.listing_type || listing.listingType || "shop_store").trim() || "shop_store",
      listingType: String(listing.listingType || listing.listing_type || "shop_store").trim() || "shop_store",
    };

    const submit = Contacts?.submitContact?.(enriched, {
      intent: "purchase",
      productId: params?.productId,
      productName: params?.productName,
    });
    if (!submit?.ok && submit?.reason !== "already_submitted") return submit;

    const contact =
      submit?.contact ||
      (Contacts?.listByListing?.(shopId) || []).find((row) => row.status === "applied") ||
      null;
    if (!contact) return { ok: false, reason: "contact_missing" };

    const Gate = window.TasuPlatformChatFeeGateFlow;
    Gate?.notifyConnectFreeSeller?.(enriched, contact, { intent: "purchase" });
    Gate?.afterConnectFreeBuyerSubmitted?.(enriched, contact);
    return { ok: true, contact, listing: enriched };
  }

  function buildInquiryUrl(shopId, productId, productName) {
    const u = new URL("chat.html", window.location.href);
    const shop = String(shopId || "").trim();
    const product = String(productId || "").trim();
    if (shop) u.searchParams.set("shop_id", shop);
    if (product) u.searchParams.set("product_id", product);
    const name = String(productName || "").trim();
    if (name) u.searchParams.set("subject", `商品のお問い合わせ: ${name}`);
    return u.pathname + u.search;
  }

  function buildOrderCompleteUrl(extra) {
    const u = new URL("order-complete.html", window.location.href);
    if (extra && typeof extra === "object") {
      Object.entries(extra).forEach(([k, v]) => {
        if (v != null && String(v).trim() !== "") u.searchParams.set(k, String(v));
      });
    }
    return u.pathname + u.search;
  }

  function isStripeConfigured() {
    const cfg = getStripeCfg();
    return Boolean(
      cfg?.createShopCheckoutUrl &&
      cfg?.confirmShopCheckoutUrl &&
      getPublishableAnonKey()
    );
  }

  function loadLocalOrders() {
    try {
      const raw = localStorage.getItem(LOCAL_ORDERS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveLocalOrder(order) {
    const list = loadLocalOrders();
    list.unshift(order);
    try {
      localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(list.slice(0, 200)));
    } catch (err) {
      console.warn("[TasuShopCheckout] local order save failed:", err);
    }
    return order;
  }

  function createDemoOrder(params) {
    const shopId = String(params.shopId || "").trim();
    const productId = String(params.productId || "").trim();
    const quantity = clampQuantity(params.quantity);
    const unitPrice = parsePriceYen(params.price ?? params.unit_price);
    const amount_total = unitPrice * quantity;
    const payout = params.payout || window.TasuShopPayout?.extractShopPayout?.(params.shop);
    const feeRate = payout?.platform_fee_rate;
    const fees = calcFees(amount_total, feeRate);

    const order = {
      id: `demo-order-${Date.now()}`,
      shop_id: shopId,
      shop_listing_id: shopId,
      product_id: productId,
      product_name: String(params.productName || "").trim() || "商品",
      quantity,
      unit_price_jpy: unitPrice,
      amount_total: fees.amount_total,
      total_amount_jpy: fees.amount_total,
      platform_fee_amount: fees.platform_fee_amount,
      seller_amount: fees.seller_amount,
      seller_user_id: payout?.seller_user_id || null,
      seller_stripe_account_id: payout?.stripe_account_id || null,
      payment_status: "paid",
      payout_status: "paid",
      source: "demo",
      shop_notified: false,
      created_at: new Date().toISOString(),
    };
    saveLocalOrder(order);
    try {
      global.TasuMarketEventStore?.recordShopOrderPaid?.(order);
    } catch (err) {
      console.warn("[TasuShopCheckout] market event skipped:", err);
    }
    try {
      const purchaseRecorded = recordShopPurchaseContact({
        shopId,
        productId,
        productName: order.product_name,
        shop: params.shop,
        demoConnect: resolveShopConnectContext(params).demoConnect,
      });
      if (!purchaseRecorded?.ok) {
        window.TasuTalkPlatformNotify?.notifyShopOrder?.({ order });
      }
    } catch (err) {
      console.warn("[TasuShopCheckout] TALK notify skipped:", err);
    }
    return order;
  }

  async function createCheckoutSession(params) {
    const cfg = getStripeCfg();
    if (!cfg?.createShopCheckoutUrl) {
      throw new Error("店舗商品 Checkout API が未設定です。");
    }

    const shopId = String(params.shopId || "").trim();
    const productId = String(params.productId || "").trim();
    const quantity = clampQuantity(params.quantity);
    const unitPrice = parsePriceYen(params.price ?? params.unit_price);
    const payout = params.payout || null;

    if (!shopId || !productId) {
      throw new Error("shopId と productId が必要です");
    }
    if (unitPrice < 1) {
      throw new Error("有効な価格が設定されていません");
    }

    const res = await fetch(cfg.createShopCheckoutUrl, {
      method: "POST",
      headers: stripeHeaders(),
      body: JSON.stringify({
        shop_id: shopId,
        product_id: productId,
        product_name: String(params.productName || "").trim() || "店舗商品",
        quantity,
        unit_amount_jpy: unitPrice,
        platform_fee_rate: payout?.platform_fee_rate,
        seller_stripe_account_id: payout?.stripe_account_id,
        origin: window.location.origin,
      }),
    });

    const data = await res.json().catch(() => ({}));
    const checkoutUrl = data.checkout_url || data.url;

    if (data.use_demo_checkout) {
      const err = new Error(data.error || "デモ決済に切り替えてください");
      err.useDemoCheckout = true;
      throw err;
    }

    if (data.payout_not_ready) {
      const err = new Error(
        data.error || window.TasuShopPayout?.PAYOUT_NOT_READY_MSG || "決済の準備中です"
      );
      err.payoutNotReady = true;
      throw err;
    }

    if (!res.ok || !checkoutUrl) {
      throw new Error(data.error || "Checkout Session の作成に失敗しました");
    }
    return { ...data, url: checkoutUrl };
  }

  async function confirmCheckoutSession(sessionId) {
    const cfg = getStripeCfg();
    if (!cfg?.confirmShopCheckoutUrl) {
      throw new Error("注文確認 API が未設定です");
    }

    const res = await fetch(cfg.confirmShopCheckoutUrl, {
      method: "POST",
      headers: stripeHeaders(),
      body: JSON.stringify({ session_id: String(sessionId || "").trim() }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      throw new Error(data.error || "決済の確認に失敗しました");
    }
    return data;
  }

  function readCheckoutParams(search) {
    const params = search instanceof URLSearchParams ? search : new URLSearchParams(search || "");
    return {
      shopId: params.get("shopId") || params.get("shop_id") || "",
      productId: params.get("productId") || params.get("product_id") || "",
      productName: params.get("productName") || params.get("product_name") || "",
      quantity: clampQuantity(params.get("quantity")),
      price: parsePriceYen(params.get("price")),
    };
  }

  window.TasuShopCheckout = {
    LOCAL_ORDERS_KEY,
    parsePriceYen,
    formatYen,
    clampQuantity,
    calcFees,
    buildProductDetailUrl,
    buildCheckoutUrl,
    buildInquiryUrl,
    buildOrderCompleteUrl,
    isStripeConfigured,
    createDemoOrder,
    recordShopPurchaseContact,
    isShopConnectPurchaseMode,
    createCheckoutSession,
    confirmCheckoutSession,
    loadLocalOrders,
    saveLocalOrder,
    readCheckoutParams,
  };
})();
