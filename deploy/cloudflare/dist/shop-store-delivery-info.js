/**
 * 店舗販売 — 配送・受け渡し情報（出品フォーム / 詳細 / 注文確認）
 */
(function (global) {
  "use strict";

  const DELIVERY_METHODS = Object.freeze([
    "宅配便",
    "レターパック",
    "店頭受け取り",
    "自社配送",
    "その他",
  ]);

  const SHIPPING_ESTIMATES = Object.freeze([
    "当日〜翌日",
    "1〜2日",
    "2〜3日",
    "1週間以内",
    "店舗に確認",
  ]);

  const SHIPPING_FEES = Object.freeze([
    "送料無料",
    "全国一律",
    "地域別",
    "店頭受け取り無料",
    "要確認",
  ]);

  const HANDOFF_METHODS = Object.freeze(["配送", "店頭受け取り", "配送・店頭どちらも可"]);

  const DEFAULT_RETURN_POLICY = "店舗の返品条件をご確認ください";

  const FALLBACK_DISPLAY = Object.freeze({
    delivery_method: "店舗指定",
    shipping_estimate: "店舗に確認",
    shipping_fee: "要確認",
    handoff_method: "配送",
    return_policy: DEFAULT_RETURN_POLICY,
  });

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function normalizeDeliveryInfo(raw) {
    if (!raw || typeof raw !== "object") {
      return {
        delivery_method: "",
        shipping_estimate: "",
        shipping_fee: "",
        handoff_method: "",
        return_policy: "",
      };
    }
    return {
      delivery_method: pickStr(raw.delivery_method, raw.deliveryMethod),
      shipping_estimate: pickStr(raw.shipping_estimate, raw.shippingEstimate),
      shipping_fee: pickStr(raw.shipping_fee, raw.shippingFee),
      handoff_method: pickStr(raw.handoff_method, raw.handoffMethod),
      return_policy: pickStr(raw.return_policy, raw.returnPolicy),
    };
  }

  function resolveReturnPolicy(raw) {
    const info = normalizeDeliveryInfo(raw);
    return info.return_policy || DEFAULT_RETURN_POLICY;
  }

  function resolveDisplayDelivery(raw) {
    const info = normalizeDeliveryInfo(raw);
    return {
      delivery_method: info.delivery_method || FALLBACK_DISPLAY.delivery_method,
      shipping_estimate: info.shipping_estimate || FALLBACK_DISPLAY.shipping_estimate,
      shipping_fee: info.shipping_fee || FALLBACK_DISPLAY.shipping_fee,
      handoff_method: info.handoff_method || FALLBACK_DISPLAY.handoff_method,
      return_policy: resolveReturnPolicy(info),
    };
  }

  function hasDisplayableDeliveryInfo(raw) {
    return true;
  }

  /** 商品詳細 — 配送・受け渡し */
  function buildDetailRows(raw) {
    const info = resolveDisplayDelivery(raw);
    return [
      { label: "配送方法", value: info.delivery_method },
      { label: "発送目安", value: info.shipping_estimate },
      { label: "送料", value: info.shipping_fee },
      { label: "受け渡し方法", value: info.handoff_method },
      { label: "返品・キャンセル条件", value: info.return_policy },
    ];
  }

  /** 注文確認 — 受け渡し方法は省略 */
  function buildCheckoutRows(raw) {
    const info = resolveDisplayDelivery(raw);
    return [
      { label: "配送方法", value: info.delivery_method },
      { label: "発送目安", value: info.shipping_estimate },
      { label: "送料", value: info.shipping_fee },
      { label: "返品・キャンセル条件", value: info.return_policy },
    ];
  }

  /** @returns {{ label: string, value: string }[]} */
  function buildDisplayRows(raw) {
    return buildDetailRows(raw);
  }

  function optionHtml(values, selected) {
    const sel = String(selected || "").trim();
    return values
      .map((v) => {
        const esc = String(v)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;");
        return `<option value="${esc}"${sel === v ? " selected" : ""}>${esc}</option>`;
      })
      .join("");
  }

  function escHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderRowsHtml(raw) {
    const rows = buildDisplayRows(raw);
    if (!rows.length) return "";
    return rows
      .map(
        (row) =>
          `<div class="shop-store-delivery__row"><dt>${escHtml(row.label)}</dt><dd>${escHtml(row.value)}</dd></div>`
      )
      .join("");
  }

  function renderCheckoutBlockHtml(title, raw) {
    const rows = buildCheckoutRows(raw);
    if (!rows.length) return "";
    const inner = rows
      .map(
        (row) =>
          `<div class="shop-store-delivery__row"><dt>${escHtml(row.label)}</dt><dd>${escHtml(row.value)}</dd></div>`
      )
      .join("");
    const titleHtml = title
      ? `<p class="shop-store-delivery__product-title">${escHtml(title)}</p>`
      : "";
    return `<div class="shop-store-delivery__block">${titleHtml}<dl class="shop-store-delivery__list">${inner}</dl></div>`;
  }

  const DEFAULT_DEMO_DELIVERY = Object.freeze({
    delivery_method: "宅配便",
    shipping_estimate: "1〜2日",
    shipping_fee: "送料無料",
    handoff_method: "配送・店頭どちらも可",
    return_policy: "",
  });

  global.TasuShopStoreDeliveryInfo = {
    DELIVERY_METHODS,
    SHIPPING_ESTIMATES,
    SHIPPING_FEES,
    HANDOFF_METHODS,
    DEFAULT_RETURN_POLICY,
    FALLBACK_DISPLAY,
    DEFAULT_DEMO_DELIVERY,
    normalizeDeliveryInfo,
    resolveDisplayDelivery,
    resolveReturnPolicy,
    hasDisplayableDeliveryInfo,
    buildDetailRows,
    buildCheckoutRows,
    buildDisplayRows,
    optionHtml,
    renderRowsHtml,
    renderCheckoutBlockHtml,
  };
})(typeof window !== "undefined" ? window : globalThis);
