/**
 * TASFUL市場 — admin-ai 向けイベント集約（注文・決済・キャンセル・返金）
 */
(function (global) {
  "use strict";

  const EVENTS_KEY = "tasu_market_admin_events_v1";
  const ORDER_HISTORY_KEY = "tasu_market_order_history";
  const SHOP_ORDERS_KEY = "tasu_shop_orders";
  const EVENT_NAME = "tasu-market-events-changed";

  const EVENT_TYPES = new Set([
    "order_created",
    "payment_completed",
    "order_cancelled",
    "refund_requested",
    "refund_completed",
  ]);

  function readJson(key, fallback) {
    try {
      const raw = global.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(key, data) {
    try {
      global.localStorage.setItem(key, JSON.stringify(data));
    } catch {
      /* ignore */
    }
  }

  function emitChange() {
    try {
      global.dispatchEvent(new CustomEvent(EVENT_NAME));
    } catch {
      /* ignore */
    }
  }

  function todayKey(d) {
    return (d || new Date()).toISOString().slice(0, 10);
  }

  function resolveAmount(entry) {
    const subtotal = Number(entry?.subtotal);
    if (Number.isFinite(subtotal) && subtotal > 0) return Math.round(subtotal);
    const total = Number(entry?.orderTotal ?? entry?.total ?? entry?.totals?.total);
    if (Number.isFinite(total) && total > 0) return Math.round(total);
    const price = Math.max(0, Number(entry?.price) || 0);
    const qty = Math.max(1, Number(entry?.quantity) || 1);
    const lineSum = (Array.isArray(entry?.lines) ? entry.lines : []).reduce((acc, line) => {
      const unit = Math.max(0, Number(line?.unitPrice ?? line?.price) || 0);
      const q = Math.max(1, Number(line?.qty ?? line?.quantity) || 1);
      return acc + Math.round(unit * q);
    }, 0);
    if (lineSum > 0) return lineSum;
    return Math.round(price * qty);
  }

  function readStoredEvents() {
    const arr = readJson(EVENTS_KEY, []);
    return Array.isArray(arr) ? arr : [];
  }

  function writeStoredEvents(events) {
    writeJson(EVENTS_KEY, (Array.isArray(events) ? events : []).slice(0, 500));
  }

  function appendMarketEvent(evt) {
    if (!evt || typeof evt !== "object") return null;
    const eventType = String(evt.event_type || evt.eventType || "").trim();
    if (!EVENT_TYPES.has(eventType)) return null;

    const orderId = String(evt.order_id || evt.orderId || "").trim();
    const row = {
      id: String(evt.id || `mkt_${eventType}_${orderId || Date.now()}`),
      event_type: eventType,
      order_id: orderId,
      amount: Math.max(0, Math.round(Number(evt.amount) || 0)),
      shop_id: String(evt.shop_id || evt.shopId || "").trim(),
      product_name: String(evt.product_name || evt.productName || evt.title || "").trim(),
      channel: String(evt.channel || "market").trim(),
      note: String(evt.note || "").trim(),
      created_at: evt.created_at || evt.createdAt || new Date().toISOString(),
    };

    const events = readStoredEvents();
    const idx = events.findIndex((e) => e.id === row.id);
    if (idx >= 0) events[idx] = { ...events[idx], ...row };
    else events.unshift(row);
    writeStoredEvents(events);
    emitChange();
    return row;
  }

  function recordCheckout(order, historyEntries) {
    const entries = Array.isArray(historyEntries) ? historyEntries : [];
    const base = order && typeof order === "object" ? order : {};
    const orderId = String(base.id || entries[0]?.orderId || "").trim();
    if (!orderId) return [];

    const amount = resolveAmount(base);
    const channel = String(base.channel || entries[0]?.channel || "market").trim();
    const common = {
      order_id: orderId,
      amount,
      channel,
      shop_id: entries[0]?.shopId || base.lines?.[0]?.shopId || "",
      product_name: entries[0]?.productName || base.lines?.[0]?.title || "",
      created_at: base.createdAt || new Date().toISOString(),
    };

    return [
      appendMarketEvent({ ...common, id: `mkt_order_created_${orderId}`, event_type: "order_created" }),
      appendMarketEvent({ ...common, id: `mkt_payment_completed_${orderId}`, event_type: "payment_completed" }),
    ].filter(Boolean);
  }

  function recordShopOrderPaid(order) {
    if (!order || typeof order !== "object") return null;
    const orderId = String(order.id || order.order_id || "").trim();
    if (!orderId) return null;
    const amount = Math.max(
      0,
      Math.round(Number(order.amount_total || order.total_amount_jpy || order.amount) || 0)
    );
    const common = {
      order_id: orderId,
      amount,
      channel: "shop_stripe",
      shop_id: String(order.shop_id || order.shop_listing_id || "").trim(),
      product_name: String(order.product_name || "").trim(),
      created_at: order.created_at || order.paid_at || new Date().toISOString(),
    };
    appendMarketEvent({ ...common, id: `mkt_order_created_${orderId}`, event_type: "order_created" });
    return appendMarketEvent({
      ...common,
      id: `mkt_payment_completed_${orderId}`,
      event_type: "payment_completed",
    });
  }

  function recordOrderCancelled(entry, note) {
    if (!entry || typeof entry !== "object") return null;
    const orderId = String(entry.orderId || entry.order_id || entry.id || "").trim();
    if (!orderId) return null;
    return appendMarketEvent({
      id: `mkt_order_cancelled_${orderId}`,
      event_type: "order_cancelled",
      order_id: orderId,
      amount: resolveAmount(entry),
      shop_id: entry.shopId || "",
      product_name: entry.productName || entry.title || "",
      channel: entry.channel || "market",
      note: note || "注文キャンセル",
      created_at: new Date().toISOString(),
    });
  }

  function recordRefundRequested(entry, note) {
    const orderId = String(entry?.order_id || entry?.orderId || entry?.id || "").trim();
    if (!orderId) return null;
    return appendMarketEvent({
      id: `mkt_refund_requested_${orderId}`,
      event_type: "refund_requested",
      order_id: orderId,
      amount: resolveAmount(entry),
      shop_id: entry?.shop_id || entry?.shopId || "",
      product_name: entry?.product_name || entry?.productName || "",
      channel: entry?.channel || "market",
      note: note || "返金申請",
      created_at: new Date().toISOString(),
    });
  }

  function recordRefundCompleted(entry, note) {
    const orderId = String(entry?.order_id || entry?.orderId || entry?.id || "").trim();
    if (!orderId) return null;
    return appendMarketEvent({
      id: `mkt_refund_completed_${orderId}`,
      event_type: "refund_completed",
      order_id: orderId,
      amount: resolveAmount(entry),
      shop_id: entry?.shop_id || entry?.shopId || "",
      product_name: entry?.product_name || entry?.productName || "",
      channel: entry?.channel || "market",
      note: note || "返金完了",
      created_at: new Date().toISOString(),
    });
  }

  function synthesizeFromOrderHistory() {
    const rows = [];
    const history = readJson(ORDER_HISTORY_KEY, []);
    (Array.isArray(history) ? history : []).forEach((entry) => {
      const orderId = String(entry.orderId || entry.id || "").trim();
      if (!orderId) return;
      const amount = resolveAmount(entry);
      const base = {
        order_id: orderId,
        amount,
        shop_id: entry.shopId || "",
        product_name: entry.productName || entry.title || "",
        channel: entry.channel || "market",
        created_at: entry.createdAt || new Date().toISOString(),
      };
      rows.push({ ...base, id: `hist_order_created_${orderId}`, event_type: "order_created" });
      rows.push({ ...base, id: `hist_payment_completed_${orderId}`, event_type: "payment_completed" });
      if (String(entry.status || "") === "キャンセル") {
        rows.push({
          ...base,
          id: `hist_order_cancelled_${orderId}`,
          event_type: "order_cancelled",
          note: "注文キャンセル",
        });
      }
    });
    return rows;
  }

  function synthesizeFromShopOrders() {
    const rows = [];
    const orders = readJson(SHOP_ORDERS_KEY, []);
    (Array.isArray(orders) ? orders : []).forEach((order) => {
      const orderId = String(order.id || order.order_id || "").trim();
      if (!orderId) return;
      const amount = Math.max(
        0,
        Math.round(Number(order.amount_total || order.total_amount_jpy || order.amount) || 0)
      );
      const base = {
        order_id: orderId,
        amount,
        shop_id: String(order.shop_id || order.shop_listing_id || "").trim(),
        product_name: String(order.product_name || "").trim(),
        channel: "shop_stripe",
        created_at: order.created_at || order.paid_at || new Date().toISOString(),
      };
      rows.push({ ...base, id: `shop_order_created_${orderId}`, event_type: "order_created" });
      if (String(order.payment_status || "paid") === "paid" || amount > 0) {
        rows.push({ ...base, id: `shop_payment_completed_${orderId}`, event_type: "payment_completed" });
      }
      if (String(order.payment_status || "").includes("cancel")) {
        rows.push({
          ...base,
          id: `shop_order_cancelled_${orderId}`,
          event_type: "order_cancelled",
          note: "注文キャンセル",
        });
      }
      if (String(order.payment_status || "").includes("refund")) {
        rows.push({
          ...base,
          id: `shop_refund_requested_${orderId}`,
          event_type: "refund_requested",
          note: "返金申請",
        });
        rows.push({
          ...base,
          id: `shop_refund_completed_${orderId}`,
          event_type: "refund_completed",
          note: "返金完了",
        });
      }
    });
    return rows;
  }

  function listMarketEvents() {
    const stored = readStoredEvents();
    const seen = new Set(stored.map((e) => e.id));
    const merged = [...stored];

    [...synthesizeFromOrderHistory(), ...synthesizeFromShopOrders()].forEach((row) => {
      if (!row?.id || seen.has(row.id)) return;
      seen.add(row.id);
      merged.push(row);
    });

    return merged.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
  }

  function countTodayByType(events, type) {
    const today = todayKey();
    return (events || []).filter(
      (e) => e.event_type === type && String(e.created_at || "").slice(0, 10) === today
    ).length;
  }

  function collectMarketMetrics() {
    const events = listMarketEvents();
    const today = todayKey();
    const todayEvents = events.filter((e) => String(e.created_at || "").slice(0, 10) === today);
    return {
      orderCreated: countTodayByType(events, "order_created"),
      paymentCompleted: countTodayByType(events, "payment_completed"),
      cancelled: countTodayByType(events, "order_cancelled"),
      refundRequested: countTodayByType(events, "refund_requested"),
      refundCompleted: countTodayByType(events, "refund_completed"),
      todayRevenue: todayEvents
        .filter((e) => e.event_type === "payment_completed")
        .reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
      totalEvents: events.length,
    };
  }

  function clearForTests() {
    writeJson(EVENTS_KEY, []);
  }

  global.TasuMarketEventStore = {
    EVENTS_KEY,
    EVENT_NAME,
    EVENT_TYPES,
    appendMarketEvent,
    recordCheckout,
    recordShopOrderPaid,
    recordOrderCancelled,
    recordRefundRequested,
    recordRefundCompleted,
    listMarketEvents,
    collectMarketMetrics,
    clearForTests,
  };
})(typeof window !== "undefined" ? window : globalThis);
