import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { upsertShopOrderFromCheckout } from "../_shared/apply-shop-order.ts";
import { calcPlatformFees } from "../_shared/resolve-shop-payout.ts";

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecret) {
      return jsonResponse({ error: "STRIPE_SECRET_KEY が未設定です" }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const sessionId = String(body.session_id || "").trim();
    if (!sessionId) {
      return jsonResponse({ error: "session_id が必要です" }, 400);
    }

    const stripe = new Stripe(stripeSecret, {
      apiVersion: "2025-01-27.acacia",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return jsonResponse(
        {
          ok: false,
          error: "決済が完了していません",
          payment_status: session.payment_status,
        },
        402
      );
    }

    const meta = session.metadata || {};
    if (meta.order_type && meta.order_type !== "shop_product") {
      return jsonResponse({ error: "店舗商品注文のセッションではありません" }, 400);
    }

    const shopId = String(meta.shop_id || meta.shop_listing_id || "").trim();
    const productId = String(meta.product_id || "").trim();
    const productName = String(meta.product_name || "店舗商品").trim();
    const quantity = Math.min(
      99,
      Math.max(1, Math.floor(Number(meta.quantity) || 1))
    );
    const unitPrice = Math.round(Number(meta.unit_amount_jpy) || 0);
    const amountTotal =
      session.amount_total != null
        ? Number(session.amount_total)
        : unitPrice * quantity;

    const platformFeeFromMeta = Number(meta.platform_fee_amount);
    const sellerAmountFromMeta = Number(meta.seller_amount);
    const feeRate = Number(meta.platform_fee_rate);

    const fees =
      Number.isFinite(platformFeeFromMeta) && platformFeeFromMeta >= 0
        ? {
            amount_total: amountTotal,
            platform_fee_amount: Math.round(platformFeeFromMeta),
            seller_amount: Number.isFinite(sellerAmountFromMeta)
              ? Math.round(sellerAmountFromMeta)
              : amountTotal - Math.round(platformFeeFromMeta),
            platform_fee_rate: feeRate,
          }
        : calcPlatformFees(amountTotal, feeRate);

    if (!shopId || !productId) {
      return jsonResponse({ error: "セッション metadata が不足しています" }, 400);
    }

    const result = await upsertShopOrderFromCheckout({
      shop_id: shopId,
      shop_listing_id: String(meta.shop_listing_id || shopId).trim(),
      product_id: productId,
      product_name: productName,
      quantity,
      unit_price_jpy: unitPrice,
      amount_total: fees.amount_total,
      platform_fee_amount: fees.platform_fee_amount,
      seller_amount: fees.seller_amount,
      seller_user_id: String(meta.seller_user_id || "").trim() || null,
      seller_stripe_account_id: String(meta.seller_stripe_account_id || "").trim() || null,
      buyer_email: session.customer_details?.email ?? session.customer_email ?? null,
      payment_status: "paid",
      payout_status: "paid",
      stripe_checkout_session_id: session.id,
      metadata: { ...meta },
    });

    if (!result.ok) {
      return jsonResponse({ error: result.error }, result.status ?? 500);
    }

    return jsonResponse({
      ok: true,
      order_id: result.order_id,
      shop_id: shopId,
      product_id: productId,
      product_name: productName,
      quantity,
      amount_total: fees.amount_total,
      platform_fee_amount: fees.platform_fee_amount,
      seller_amount: fees.seller_amount,
      seller_stripe_account_id: meta.seller_stripe_account_id || null,
      shop_notified: false,
    });
  } catch (err) {
    console.error("[stripe-confirm-shop-checkout]", err);
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});
