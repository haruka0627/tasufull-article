import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import {
  handleLiveVideoError,
  parseJsonBody,
  requirePost,
  requireVerifiedUser,
} from "../_shared/live-video-auth.ts";
import { resolveCoinPackSku, resolvePaymentChannel } from "../_shared/tlv-coin-packs.ts";
import { parseAuthUserUuid } from "../_shared/tlv-payment-db.ts";
import { handleTlvPaymentError, TlvPaymentError } from "../_shared/tlv-payment-errors.ts";
import { createStripeCoinPurchase } from "../_shared/tlv-payment-webhook.ts";

type Body = {
  sku_id?: string;
  channel?: string;
  creator_id?: string | null;
  idempotency_key?: string;
};

export async function handler(req: Request): Promise<Response> {
  const options = handleOptions(req);
  if (options) return options;

  try {
    requirePost(req);
    const auth = await requireVerifiedUser(req);
    const body = await parseJsonBody<Body>(req);

    const skuId = resolveCoinPackSku(body.sku_id);
    const channel = resolvePaymentChannel(body.channel ?? "web_stripe");
    const idempotencyKey = String(body.idempotency_key ?? "").trim();

    if (!skuId) throw new TlvPaymentError("invalid_request", "Invalid sku_id", 400);
    if (!channel) throw new TlvPaymentError("invalid_request", "Invalid channel", 400);
    if (!idempotencyKey) {
      throw new TlvPaymentError("invalid_request", "idempotency_key required", 400);
    }

    const walletUserId = parseAuthUserUuid(auth.user.id);
    const payerUserId = auth.talkUserId || auth.user.id;

    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecret) {
      throw new TlvPaymentError("internal_error", "STRIPE_SECRET_KEY not configured", 500);
    }

    const stripe = new Stripe(stripeSecret, {
      apiVersion: "2025-01-27.acacia",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const result = await createStripeCoinPurchase({
      skuId,
      channel,
      walletUserId,
      payerUserId,
      creatorId: body.creator_id ? String(body.creator_id) : null,
      idempotencyKey,
      stripe,
    });

    return jsonResponse(
      {
        ok: true,
        status: "pending",
        payment_intent_id: result.paymentIntentId,
        client_secret: result.clientSecret,
        quote: {
          gross_amount_jpy: result.quote.grossAmountJpy,
          fee_amount_jpy: result.quote.feeAmountJpy,
          net_amount_jpy: result.quote.netAmountJpy,
          coins_granted: result.quote.coinsGranted,
          is_web_payment: result.quote.isWebPayment,
        },
      },
      200,
      req,
    );
  } catch (err) {
    if (err instanceof TlvPaymentError) return handleTlvPaymentError(err, req);
    return handleLiveVideoError(err, req);
  }
}

if (import.meta.main) Deno.serve(handler);
