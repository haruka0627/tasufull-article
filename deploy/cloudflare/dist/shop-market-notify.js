/**
 * TASFUL市場 — 注文フロー通知 → TASFUL TALK
 */
(function (global) {
  "use strict";

  const SOURCE = "shop_market_order_v1";
  const SENT_KEY = "tasu_market_notify_sent_v1";
  const BUYER_USER_ID = "u_me";
  const SELLER_BY_SHOP = {
    "demo-shop-tasful-bakery": "u_bakery",
    "demo-shop-haru-cafe": "u_shop_demo",
    "demo-shop-reworks": "u_shop_demo",
  };
  const DEFAULT_SELLER_USER_ID = "u_bakery";

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function readSent() {
    try {
      const raw = JSON.parse(global.localStorage.getItem(SENT_KEY) || "{}");
      return raw && typeof raw === "object" ? raw : {};
    } catch {
      return {};
    }
  }

  function writeSent(map) {
    try {
      global.localStorage.setItem(SENT_KEY, JSON.stringify(map || {}));
    } catch {
      /* ignore */
    }
  }

  function sentKey(orderId, kind) {
    return `${String(orderId || "").trim()}::${kind}`;
  }

  function wasSent(orderId, kind) {
    return Boolean(readSent()[sentKey(orderId, kind)]);
  }

  function markSent(orderId, kind) {
    const map = readSent();
    map[sentKey(orderId, kind)] = new Date().toISOString();
    writeSent(map);
  }

  function resolveSellerUserId(shopId) {
    const sid = String(shopId || "").trim();
    return pickStr(SELLER_BY_SHOP[sid], DEFAULT_SELLER_USER_ID);
  }

  function resolveBuyerUserId() {
    const fromUrl = pickStr(new URLSearchParams(global.location?.search || "").get("userId"));
    if (fromUrl) return fromUrl;
    const cfg = global.TASU_CHAT_SUPABASE_CONFIG || {};
    return pickStr(cfg.currentUserId, cfg.me?.id, BUYER_USER_ID);
  }

  function buildUrl(page, params) {
    try {
      const u = new URL(page, global.location?.href || "http://localhost/");
      Object.entries(params || {}).forEach(([k, v]) => {
        if (v != null && String(v).trim() !== "") u.searchParams.set(k, String(v));
      });
      return u.pathname + u.search + (u.hash || "");
    } catch {
      const q = new URLSearchParams(params || "").toString();
      return q ? `${page}?${q}` : page;
    }
  }

  function sellerOrdersUrl(entry) {
    return buildUrl("shop-market-seller-orders.html", { shopId: entry?.shopId });
  }

  function orderHistoryUrl(entry, detail) {
    const params = { orderId: entry?.orderId };
    if (detail) params.detail = "1";
    return buildUrl("shop-market-order-history.html", params);
  }

  function reviewUrl(entry) {
    return (
      buildUrl("detail-shop-product.html", {
        shopId: entry?.shopId,
        productId: entry?.productId,
        review: "1",
      }) + "#tasful-product-review-compose"
    );
  }

  function resolveShopLabel(entry) {
    return pickStr(entry?.shopName, entry?.sellerName, "出品者");
  }

  function resolveProductLabel(entry) {
    return pickStr(entry?.productName, entry?.title, "商品");
  }

  function isShopStoreChannel(entry) {
    return pickStr(entry?.channel) === "shop_store";
  }

  function resolvePurchaseAmount(entry) {
    const subtotal = Number(entry?.subtotal);
    if (Number.isFinite(subtotal) && subtotal > 0) return Math.round(subtotal);
    const total = Number(entry?.total);
    if (Number.isFinite(total) && total > 0) return Math.round(total);
    const lines = Array.isArray(entry?.lines) ? entry.lines : [];
    if (lines.length) {
      const sum = lines.reduce((acc, line) => {
        const price = Math.max(0, Number(line?.unitPrice ?? line?.price) || 0);
        const qty = Math.max(1, Number(line?.qty ?? line?.quantity) || 1);
        return acc + Math.round(price * qty);
      }, 0);
      if (sum > 0) return sum;
    }
    const price = Math.max(0, Number(entry?.price) || 0);
    const qty = Math.max(1, Number(entry?.quantity) || 1);
    return Math.round(price * qty);
  }

  function formatYen(amount) {
    const n = Math.max(0, Math.round(Number(amount) || 0));
    return `¥${n.toLocaleString("ja-JP")}`;
  }

  function buildShopStorePurchaseTitle(entry) {
    const shop = resolveShopLabel(entry);
    return shop ? `${shop}の商品が購入されました` : "店舗販売の新しい注文が入りました";
  }

  function buildShopStoreNotifyPayload(entry) {
    const orderNumber = pickStr(entry?.orderId);
    const shopName = resolveShopLabel(entry);
    const productName = resolveProductLabel(entry);
    const amount = resolvePurchaseAmount(entry);
    return {
      channel: "shop_store",
      shopName,
      productName,
      amount,
      orderNumber,
      notifyListingTitle: shopName,
    };
  }

  function isShopStorePurchaseNotification(n) {
    if (!isMarketOrderNotification(n)) return false;
    if (resolveMarketNotifySubType(n) !== "market_purchase") return false;
    const channel = pickStr(n?.channel);
    const category = pickStr(n?.category);
    return channel === "shop_store" || category === "店舗販売";
  }

  function resolveShopStoreNotifyFields(n) {
    const shopName = pickStr(
      n?.shopName,
      n?.notifyListingTitle,
      resolveShopLabel({ shopName: n?.shopName, sellerName: n?.sellerName })
    );
    const productName = pickStr(
      n?.productName,
      resolveProductLabel({ productName: n?.productName, title: n?.title })
    );
    const amount =
      n?.amount != null && Number(n.amount) > 0
        ? formatYen(n.amount)
        : formatYen(resolvePurchaseAmount(n));
    const orderNumber = pickStr(
      n?.orderNumber,
      n?.orderId,
      String(n?.id || "").replace(/^market-order-purchase-/, "")
    );
    return { shopName, productName, amount, orderNumber };
  }

  function formatShopStoreOrderNumberDisplay(orderNumber) {
    const raw = pickStr(orderNumber);
    if (!raw) return "";
    return raw.startsWith("#") ? raw : `#${raw}`;
  }

  function renderShopStorePurchaseHeadRowHtml(options) {
    const parts = [];
    if (options?.isLatest) {
      parts.push(
        '<span class="talk-notify-card__market-badge talk-notify-card__market-badge--new">NEW</span>'
      );
    }
    parts.push(
      '<span class="talk-notify-card__category-chip talk-notify-card__type talk-notify-card__scope-chip talk-notify-card__type--gold">店舗販売</span>'
    );
    return `<div class="talk-notify-card__shop-store-head">${parts.join("")}</div>`;
  }

  function renderShopStorePurchaseDetailsHtml(n) {
    const { shopName, productName, amount, orderNumber } = resolveShopStoreNotifyFields(n);
    return `
      <div class="talk-notify-card__shop-store-details">
        <p class="talk-notify-card__shop-name">${escHtml(shopName)}</p>
        <p class="talk-notify-card__product-name">${escHtml(productName)}</p>
        <p class="talk-notify-card__amount">${escHtml(amount)}</p>
        <p class="talk-notify-card__order-number">${escHtml(formatShopStoreOrderNumberDisplay(orderNumber))}</p>
      </div>`;
  }

  function renderShopStorePurchaseCardBodyHtml(n, options) {
    if (!isShopStorePurchaseNotification(n)) return "";
    return `${renderShopStorePurchaseHeadRowHtml(options)}${renderShopStorePurchaseDetailsHtml(n)}`;
  }

  function resolveShopStorePurchaseAriaLabel(n, actionLabel) {
    const { shopName, productName, amount, orderNumber } = resolveShopStoreNotifyFields(n);
    return [
      "店舗販売",
      pickStr(n?.title),
      shopName,
      productName,
      amount,
      orderNumber ? formatShopStoreOrderNumberDisplay(orderNumber) : "",
      pickStr(actionLabel, "注文を確認する"),
    ]
      .filter(Boolean)
      .join(" ");
  }

  /** @param {object} entry @param {string} messageSuffix 商品名の直後（例: 「 を発送しました。」） */
  function formatMarketNotifyBody(entry, messageSuffix) {
    const shop = resolveShopLabel(entry);
    const product = resolveProductLabel(entry);
    return `${shop}\n${product}${messageSuffix}`;
  }

  function parseMarketNotifyBody(body) {
    const text = pickStr(body);
    const nl = text.indexOf("\n");
    if (nl < 0) return { shopLine: "", messageLine: text };
    return {
      shopLine: text.slice(0, nl).trim(),
      messageLine: text.slice(nl + 1).trim(),
    };
  }

  function escHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderMarketNotifyBodyHtml(body) {
    const { shopLine, messageLine } = parseMarketNotifyBody(body);
    if (!shopLine) {
      return messageLine
        ? `<p class="talk-notify-card__text talk-notify-card__text--market">${escHtml(messageLine)}</p>`
        : "";
    }
    return `<p class="talk-notify-card__shop">${escHtml(shopLine)}</p><p class="talk-notify-card__text talk-notify-card__text--market">${escHtml(messageLine)}</p>`;
  }

  function pushNotification(input) {
    if (!input || typeof input !== "object") return null;
    const row = {
      type: "shop",
      category: "TASFUL市場",
      priority: "important",
      source: SOURCE,
      sendNotification: true,
      sendTalkMessage: true,
      officialRoomId: "official_tasful",
      minimalNotifyCard: true,
      ...input,
      actionLabel:
        pickStr(input.actionLabel) ||
        global.TasuPlatformNotifyActionLabels?.resolvePlatformNotifyActionLabel?.(input) ||
        "詳細を見る",
      targetUrl: pickStr(input.targetUrl, input.href) || "#",
      href: pickStr(input.href, input.targetUrl) || "#",
    };
    try {
      if (typeof global.TasuTalkData?.addNotification === "function") {
        return global.TasuTalkData.addNotification(row);
      }
      if (typeof global.TasuTalkNotifications?.add === "function") {
        return global.TasuTalkNotifications.add(row);
      }
      console.warn("[TasfulMarketNotify] notification store unavailable");
      return null;
    } catch (err) {
      console.warn("[TasfulMarketNotify] push failed:", err);
      return null;
    }
  }

  function notifyPurchase(entry) {
    const orderId = pickStr(entry?.orderId);
    if (!orderId || wasSent(orderId, "purchase")) return null;
    const shopStore = isShopStoreChannel(entry);
    const shopPayload = shopStore ? buildShopStoreNotifyPayload(entry) : null;
    const row = pushNotification({
      id: `market-order-purchase-${orderId}`,
      recipientUserId: resolveSellerUserId(entry?.shopId),
      title: shopStore ? buildShopStorePurchaseTitle(entry) : "新しい注文が入りました",
      body: shopStore
        ? ""
        : `${formatMarketNotifyBody(entry, ` の注文（${orderId}）が入りました。`)}\n注文管理で確認してください。`,
      targetUrl: sellerOrdersUrl(entry),
      actionLabel: "注文を確認する",
      category: shopStore ? "店舗販売" : "TASFUL市場",
      shopId: entry?.shopId,
      orderId,
      subType: "market_purchase",
      ...(shopPayload || {}),
    });
    if (row) markSent(orderId, "purchase");
    return row;
  }

  function notifyOrderAccepted(entry) {
    const orderId = pickStr(entry?.orderId);
    if (!orderId || wasSent(orderId, "accepted")) return null;
    const row = pushNotification({
      id: `market-order-accepted-${orderId}`,
      recipientUserId: resolveBuyerUserId(),
      title: "注文を受け付けました",
      body: formatMarketNotifyBody(entry, " のご注文を受け付けました。"),
      targetUrl: orderHistoryUrl(entry, false),
      actionLabel: "注文履歴を見る",
      shopId: entry?.shopId,
      orderId,
      subType: "market_accepted",
    });
    if (row) markSent(orderId, "accepted");
    return row;
  }

  function notifyPreparing(entry) {
    const orderId = pickStr(entry?.orderId);
    if (!orderId || wasSent(orderId, "preparing")) return null;
    const row = pushNotification({
      id: `market-order-preparing-${orderId}`,
      recipientUserId: resolveBuyerUserId(),
      title: "発送準備中です",
      body: formatMarketNotifyBody(entry, " を発送準備中です。"),
      targetUrl: orderHistoryUrl(entry, true),
      actionLabel: "注文詳細を見る",
      shopId: entry?.shopId,
      orderId,
      subType: "market_preparing",
    });
    if (row) markSent(orderId, "preparing");
    return row;
  }

  function notifyShipped(entry) {
    const orderId = pickStr(entry?.orderId);
    if (!orderId || wasSent(orderId, "shipped")) return null;
    const row = pushNotification({
      id: `market-order-shipped-${orderId}`,
      recipientUserId: resolveBuyerUserId(),
      title: "商品を発送しました",
      body: formatMarketNotifyBody(entry, " を発送しました。"),
      targetUrl: orderHistoryUrl(entry, true),
      actionLabel: "注文詳細を見る",
      shopId: entry?.shopId,
      orderId,
      subType: "market_shipped",
    });
    if (row) markSent(orderId, "shipped");
    return row;
  }

  function notifyDelivered(entry) {
    const orderId = pickStr(entry?.orderId);
    if (!orderId || wasSent(orderId, "delivered")) return null;
    const row = pushNotification({
      id: `market-order-delivered-${orderId}`,
      recipientUserId: resolveBuyerUserId(),
      title: "配達が完了しました",
      body: formatMarketNotifyBody(entry, " の配達が完了しました。"),
      targetUrl: orderHistoryUrl(entry, false),
      actionLabel: "注文履歴を見る",
      shopId: entry?.shopId,
      orderId,
      subType: "market_delivered",
    });
    if (row) markSent(orderId, "delivered");
    return row;
  }

  function notifyReviewRequest(entry) {
    const orderId = pickStr(entry?.orderId);
    if (!orderId || wasSent(orderId, "review")) return null;
    const row = pushNotification({
      id: `market-order-review-${orderId}`,
      recipientUserId: resolveBuyerUserId(),
      title: "レビューをお願いします",
      body: formatMarketNotifyBody(
        entry,
        " のお取引ありがとうございました。レビューで取引を締めくくれます。"
      ),
      targetUrl: reviewUrl(entry),
      actionLabel: "レビューをする",
      shopId: entry?.shopId,
      orderId,
      subType: "market_review",
    });
    if (row) markSent(orderId, "review");
    return row;
  }

  function onPurchaseEntries(entries) {
    (entries || []).forEach((entry) => notifyPurchase(entry));
  }

  function onSellerStatusAction(orderId, productId, status) {
    const Data = global.TasfulMarketProductData;
    const entry = Data?.findOrderHistoryEntry?.(orderId, productId);
    if (!entry) return null;

    if (status === "注文受付") return notifyOrderAccepted(entry);
    if (status === "発送準備中") return notifyPreparing(entry);
    if (status === "発送済み") return notifyShipped(entry);
    if (status === "配達完了") {
      notifyDelivered(entry);
      return notifyReviewRequest(entry);
    }
    return null;
  }

  function clearSentForDemo() {
    try {
      global.localStorage.removeItem(SENT_KEY);
    } catch {
      /* ignore */
    }
  }

  const MARKET_NOTIFY_UI = Object.freeze({
    market_purchase: { accent: "purchase" },
    market_accepted: { accent: "accepted" },
    market_preparing: { accent: "preparing", badge: "準備中" },
    market_shipped: { accent: "shipped" },
    market_delivered: { accent: "delivered", badge: "配達完了" },
    market_review: { accent: "review", badge: "レビュー" },
  });

  function isMarketOrderNotification(n) {
    if (!n || typeof n !== "object") return false;
    const source = String(n.source || "").toLowerCase();
    const id = String(n.id || "");
    return source === SOURCE || id.startsWith("market-order-");
  }

  function resolveMarketNotifySubType(n) {
    const sub = pickStr(n?.subType, n?.sub_type);
    if (sub && MARKET_NOTIFY_UI[sub]) return sub;
    const id = pickStr(n?.id);
    if (id.includes("market-order-purchase-")) return "market_purchase";
    if (id.includes("market-order-accepted-")) return "market_accepted";
    if (id.includes("market-order-preparing-")) return "market_preparing";
    if (id.includes("market-order-shipped-")) return "market_shipped";
    if (id.includes("market-order-delivered-")) return "market_delivered";
    if (id.includes("market-order-review-")) return "market_review";
    return "";
  }

  function resolveMarketNotifyAccentClass(n) {
    if (!isMarketOrderNotification(n)) return "";
    const meta = MARKET_NOTIFY_UI[resolveMarketNotifySubType(n)];
    return meta ? ` talk-notify-card--market-${meta.accent}` : "";
  }

  function findLatestMarketNotifyId(rows) {
    for (let i = 0; i < (rows || []).length; i += 1) {
      const n = rows[i];
      if (isMarketOrderNotification(n)) return pickStr(n.id);
    }
    return "";
  }

  /** @param {object} n @param {{ isLatest?: boolean }} [options] */
  function renderMarketNotifyBadgesHtml(n, options) {
    if (!isMarketOrderNotification(n)) return "";
    const meta = MARKET_NOTIFY_UI[resolveMarketNotifySubType(n)];
    const parts = [];
    if (options?.isLatest) {
      parts.push(
        '<span class="talk-notify-card__market-badge talk-notify-card__market-badge--new">NEW</span>'
      );
    }
    if (meta?.badge) {
      parts.push(
        `<span class="talk-notify-card__market-badge talk-notify-card__market-badge--${meta.accent}">${meta.badge}</span>`
      );
    }
    if (!parts.length) return "";
    return `<div class="talk-notify-card__market-badges">${parts.join("")}</div>`;
  }

  global.TasfulMarketNotify = {
    SOURCE,
    SENT_KEY,
    BUYER_USER_ID,
    resolveSellerUserId,
    resolveBuyerUserId,
    notifyPurchase,
    notifyOrderAccepted,
    notifyPreparing,
    notifyShipped,
    notifyDelivered,
    notifyReviewRequest,
    onPurchaseEntries,
    onSellerStatusAction,
    clearSentForDemo,
    sellerOrdersUrl,
    orderHistoryUrl,
    reviewUrl,
    isMarketOrderNotification,
    resolveMarketNotifySubType,
    resolveMarketNotifyAccentClass,
    findLatestMarketNotifyId,
    renderMarketNotifyBadgesHtml,
    formatMarketNotifyBody,
    parseMarketNotifyBody,
    renderMarketNotifyBodyHtml,
    resolveShopLabel,
    resolveProductLabel,
    isShopStorePurchaseNotification,
    renderShopStorePurchaseCardBodyHtml,
    renderShopStorePurchaseDetailsHtml,
    resolveShopStoreNotifyFields,
    resolveShopStorePurchaseAriaLabel,
  };
})(typeof window !== "undefined" ? window : globalThis);
