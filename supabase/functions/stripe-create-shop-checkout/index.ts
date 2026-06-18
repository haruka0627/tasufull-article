import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import {
  calcPlatformFees,
  resolveShopPayout,
} from "../_shared/resolve-shop-payout.ts";

const PAYOUT_NOT_READY =
  "この店舗は現在オンライン決済の準備中です。お問い合わせからご確認ください。";

function resolveSiteOrigin(req: Request, body: { origin?: string }): string {
  const fromBody = String(body.origin || "").trim().replace(/\/$/, "");
  if (fromBody && /^https?:\/\//i.test(fromBody)) return fromBody;

  const envOrigin = String(Deno.env.get("SITE_URL") || "").trim().replace(/\/$/, "");
  if (envOrigin) return envOrigin;

  const referer = req.headers.get("referer") || req.headers.get("origin") || "";
  try {
    return new URL(referer).origin;
  } catch {
    return "http://localhost:5173";
  }
}

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
    const shopId = String(body.shop_id || body.shopId || "").trim();
    const productId = String(body.product_id || body.productId || "").trim();
    const productName = String(body.product_name || body.productName || "店舗商品").trim();
    const quantity = Math.min(99, Math.max(1, Math.floor(Number(body.quantity) || 1)));
    const unitAmount = Math.round(Number(body.unit_amount_jpy ?? body.price) || 0);

    if (!shopId || !productId) {
      return jsonResponse({ error: "shop_id と product_id が必要です" }, 400);
    }
    if (unitAmount < 1) {
      return jsonResponse({ error: "unit_amount_jpy は 1 以上が必要です" }, 400);
    }

    const resolved = await resolveShopPayout(shopId);
    if (!resolved.ok) {
      return jsonResponse({ error: resolved.error }, resolved.status);
    }

    const payout = resolved.payout;

    if (payout.is_demo && !payout.stripe_account_id) {
      return jsonResponse(
        {
          error: "デモ店舗はローカル注文フローをご利用ください",
          use_demo_checkout: true,
        },
        400
      );
    }

    if (!payout.is_demo && (!payout.payout_enabled || !payout.stripe_account_id)) {
      return jsonResponse({ error: PAYOUT_NOT_READY, payout_not_ready: true }, 400);
    }

    const amountTotal = unitAmount * quantity;
    const feeRate =
      body.platform_fee_rate != null
        ? Number(body.platform_fee_rate)
        : payout.platform_fee_rate;
    const fees = calcPlatformFees(amountTotal, feeRate);

    const siteOrigin = resolveSiteOrigin(req, body);
    const checkoutBase = `${siteOrigin}/checkout.html`;
    const checkoutQs = new URLSearchParams({
      shopId,
      productId,
      quantity: String(quantity),
      price: String(unitAmount),
      productName,
    });
    const cancelUrl = `${checkoutBase}?${checkoutQs.toString()}&shop_checkout=cancelled`;
    const successUrl =
      `${siteOrigin}/order-complete.html?shop_checkout=success&session_id={CHECKOUT_SESSION_ID}`;

    const stripe = new Stripe(stripeSecret, {
      apiVersion: "2025-01-27.acacia",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      locale: "ja",
      metadata: {
        order_type: "shop_product",
        shop_id: shopId,
        shop_listing_id: payout.shop_listing_id,
        product_id: productId,
        product_name: productName,
        quantity: String(quantity),
        unit_amount_jpy: String(unitAmount),
        seller_user_id: payout.seller_user_id || "",
        seller_stripe_account_id: payout.stripe_account_id,
        platform_fee_amount: String(fees.platform_fee_amount),
        seller_amount: String(fees.seller_amount),
        platform_fee_rate: String(fees.platform_fee_rate),
        amount_total: String(fees.amount_total),
      },
      payment_intent_data: {
        application_fee_amount: fees.platform_fee_amount,
        transfer_data: {
          destination: payout.stripe_account_id,
        },
        metadata: {
          order_type: "shop_product",
          shop_id: shopId,
          product_id: productId,
        },
      },
      line_items: [
        {
          quantity,
          price_data: {
            currency: "jpy",
            unit_amount: unitAmount,
            product_data: { name: productName },
          },
        },
      ],
    });

    return jsonResponse({
      ok: true,
      session_id: session.id,
      checkout_url: session.url,
      url: session.url,
      amount_total: fees.amount_total,
      platform_fee_amount: fees.platform_fee_amount,
      seller_amount: fees.seller_amount,
      seller_stripe_account_id: payout.stripe_account_id,
    });
  } catch (err) {
    console.error("[stripe-create-shop-checkout]", err);
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});
