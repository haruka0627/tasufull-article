import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { createTlvServiceClient } from "../_shared/tlv-payment-db.ts";
import { handleTlvPaymentError } from "../_shared/tlv-payment-errors.ts";
import {
  applyStripeChargeRefunded,
  applyStripeDisputeEvent,
  applyStripePaymentIntentFailed,
  applyStripePaymentIntentSucceeded,
  applyStripeRefundUpdated,
  recordTerminalProviderEvent,
} from "../_shared/tlv-payment-webhook.ts";
import { sha256Hex } from "../_shared/tlv-payment-db.ts";

export async function handler(req: Request): Promise<Response> {
  const options = handleOptions(req);
  if (options) return options;

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405, req);
  }

  const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET_TLV") ||
    Deno.env.get("STRIPE_WEBHOOK_SECRET");

  if (!stripeSecret || !webhookSecret) {
    return jsonResponse({ ok: false, error: "stripe_not_configured" }, 500, req);
  }

  const stripe = new Stripe(stripeSecret, {
    apiVersion: "2025-01-27.acacia",
    httpClient: Stripe.createFetchHttpClient(),
  });

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return jsonResponse({ ok: false, error: "missing_signature" }, 400, req);
  }

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    console.error("[tlv-payment-webhook] signature failed", err);
    return jsonResponse({ ok: false, error: "invalid_signature" }, 400, req);
  }

  try {
    const client = createTlvServiceClient();
    let result: Record<string, unknown> = { ok: true };

    if (event.type === "payment_intent.succeeded") {
      result = await applyStripePaymentIntentSucceeded(
        client,
        event,
        event.data.object as Stripe.PaymentIntent,
      );
    } else if (
      event.type === "payment_intent.payment_failed" ||
      event.type === "payment_intent.canceled"
    ) {
      result = await applyStripePaymentIntentFailed(
        client,
        event,
        event.data.object as Stripe.PaymentIntent,
      );
    } else if (event.type === "charge.refunded") {
      result = await applyStripeChargeRefunded(
        client,
        event,
        event.data.object as Stripe.Charge,
      );
    } else if (event.type === "refund.updated") {
      result = await applyStripeRefundUpdated(
        client,
        stripe,
        event,
        event.data.object as Stripe.Refund,
      );
    } else if (
      event.type === "charge.dispute.created" ||
      event.type === "charge.dispute.closed"
    ) {
      result = await applyStripeDisputeEvent(
        client,
        event,
        event.data.object as Stripe.Dispute,
      );
    } else {
      result = await recordTerminalProviderEvent(client, {
        provider: "stripe",
        providerEventId: event.id,
        eventType: event.type,
        payloadHash: await sha256Hex(JSON.stringify(event)),
        status: "ignored",
        errorMessage: "unsupported_event",
      });
    }

    return jsonResponse({ received: true, ...result }, 200, req);
  } catch (err) {
    return handleTlvPaymentError(err, req);
  }
}

if (import.meta.main) Deno.serve(handler);
