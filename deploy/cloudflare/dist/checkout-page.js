/**
 * 店舗商品 checkout.html — 店舗売上 + TASFUL 手数料（Stripe Connect）
 */
(function () {
  "use strict";

  const params = window.TasuShopCheckout.readCheckoutParams(window.location.search);
  let shopRecord = null;
  let purchaseEval = null;

  function $(sel) {
    return document.querySelector(sel);
  }

  function setStatus(msg, isError) {
    const el = $("[data-checkout-status]");
    if (el) {
      el.textContent = msg;
      el.style.color = isError ? "#b91c1c" : "#64748b";
    }
  }

  async function loadShop(shopId) {
    if (window.TasuDetailShopStoreLoader?.fetchShopStoreDetailById) {
      return window.TasuDetailShopStoreLoader.fetchShopStoreDetailById(shopId);
    }
    if (window.TasuShopStoreDemo?.getById) {
      return window.TasuShopStoreDemo.getById(shopId);
    }
    return null;
  }

  function shopDisplayName(shop) {
    const extra = shop?.category_extra?.shop_store || shop?.form_data || {};
    return String(extra.shop_name || shop?.company_name || shop?.title || "").trim() || "店舗";
  }

  function renderSummary(shop) {
    const qty = params.quantity;
    const unit = params.price;
    const total = unit * qty;
    const payout = purchaseEval?.payout || window.TasuShopPayout?.extractShopPayout?.(shop);
    const fees = window.TasuShopCheckout.calcFees(total, payout?.platform_fee_rate);

    $("[data-checkout-card]")?.removeAttribute("hidden");
    $("[data-checkout-shop-name]").textContent = shopDisplayName(shop);
    $("[data-checkout-product-name]").textContent = params.productName || "商品";
    $("[data-checkout-unit-price]").textContent = window.TasuShopCheckout.formatYen(unit);
    $("[data-checkout-quantity]").textContent = String(qty);
    $("[data-checkout-total]").textContent = window.TasuShopCheckout.formatYen(fees.amount_total);

    const feeEl = $("[data-checkout-platform-fee]");
    if (feeEl) feeEl.textContent = window.TasuShopCheckout.formatYen(fees.platform_fee_amount);
    const sellerEl = $("[data-checkout-seller-amount]");
    if (sellerEl) sellerEl.textContent = window.TasuShopCheckout.formatYen(fees.seller_amount);

    const recipient = $("[data-checkout-recipient-note]");
    if (recipient) {
      recipient.textContent = payout?.isDemo
        ? "（デモ）商品代金は店舗売上として記録されます。TASFUL は手数料のみ取得する設計です。"
        : "商品代金は店舗の Stripe Connect 口座へ入金され、TASFUL はプラットフォーム手数料のみを受け取ります。";
    }

    const back = $("[data-checkout-back]");
    if (back && params.shopId && params.productId) {
      back.href = window.TasuShopCheckout.buildProductDetailUrl(
        params.shopId,
        params.productId
      );
    }

    const demoNote = $("[data-checkout-demo-note]");
    if (demoNote && purchaseEval?.useDemoCheckout) {
      demoNote.hidden = false;
      demoNote.textContent =
        "デモ環境: Stripe Connect 未接続のため、注文データをローカルに保存して完了画面へ進みます。";
    }

    const payBtn = $("[data-checkout-pay]");
    if (payBtn) {
      if (!purchaseEval?.ok) {
        payBtn.disabled = true;
        payBtn.textContent = "オンライン決済の準備中";
      } else {
        payBtn.disabled = false;
        payBtn.textContent = purchaseEval.useDemoCheckout
          ? "購入する（デモ完了）"
          : "購入する（Stripe 決済へ）";
      }
    }
  }

  async function handlePay() {
    const payBtn = $("[data-checkout-pay]");
    if (payBtn) payBtn.disabled = true;

    try {
      if (!purchaseEval?.ok) {
        throw new Error(
          purchaseEval?.reason || window.TasuShopPayout?.PAYOUT_NOT_READY_MSG
        );
      }
      if (!params.shopId || !params.productId) {
        throw new Error("注文情報が不足しています");
      }
      if (params.price < 1) {
        throw new Error("価格が設定されていません");
      }

      const payload = {
        shopId: params.shopId,
        productId: params.productId,
        productName: params.productName,
        price: params.price,
        quantity: params.quantity,
        payout: purchaseEval.payout,
        shop: shopRecord,
      };

      if (purchaseEval.useDemoCheckout) {
        setStatus("デモ注文を処理しています…", false);
        const order = window.TasuShopCheckout.createDemoOrder(payload);
        window.location.href = window.TasuShopCheckout.buildOrderCompleteUrl({
          demo: "1",
          order_id: order.id,
          shopId: params.shopId,
          productId: params.productId,
        });
        return;
      }

      setStatus("Stripe 決済ページへ移動しています（店舗口座へ入金）…", false);
      const session = await window.TasuShopCheckout.createCheckoutSession(payload);
      window.location.href = session.url;
    } catch (err) {
      console.error("[checkout]", err);
      setStatus(err.message || "決済の開始に失敗しました", true);
      if (payBtn && purchaseEval?.ok) payBtn.disabled = false;
    }
  }

  async function init() {
    const cancelled = new URLSearchParams(window.location.search).get("shop_checkout");
    if (cancelled === "cancelled") {
      setStatus("決済がキャンセルされました。内容をご確認のうえ、再度お試しください。", true);
    }

    if (!params.shopId || !params.productId) {
      setStatus("商品情報がありません。商品詳細から再度お試しください。", true);
      return;
    }
    if (params.price < 1) {
      setStatus("価格未設定の商品です。お問い合わせからご相談ください。", true);
      return;
    }

    shopRecord = await loadShop(params.shopId);
    purchaseEval = window.TasuShopPayout?.evaluatePurchase?.(shopRecord) || { ok: false };

    if (!shopRecord) {
      setStatus("店舗が見つかりませんでした。", true);
      return;
    }

    if (!purchaseEval.ok) {
      renderSummary(shopRecord);
      setStatus(purchaseEval.reason || window.TasuShopPayout.PAYOUT_NOT_READY_MSG, true);
      return;
    }

    renderSummary(shopRecord);
    setStatus("", false);
    $("[data-checkout-pay]")?.addEventListener("click", () => void handlePay());
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => void init());
  } else {
    void init();
  }
})();
