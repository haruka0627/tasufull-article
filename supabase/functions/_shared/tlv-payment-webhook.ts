import type Stripe from "https://esm.sh/stripe@17.7.0?target=deno";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import {
  assertSkuMatchesChannel,
  coinsGranted,
  getCoinPack,
  resolveCoinPackSku,
  resolvePaymentChannel,
  TLV_STRIPE_ORDER_TYPE,
  type CoinPackSkuId,
  type PaymentChannel,
} from "./tlv-coin-packs.ts";
import { createTlvServiceClient, getActiveFeeConfig, sha256Hex } from "./tlv-payment-db.ts";
import { TlvPaymentError } from "./tlv-payment-errors.ts";
import { computePurchaseQuote } from "./tlv-payment-math.ts";

export type WebhookApplyResult = {
  ok: boolean;
  duplicate?: boolean;
  payment_id?: string;
  coin_balance?: number;
  status?: string;
};

export async function recordTerminalProviderEvent(
  client: SupabaseClient,
  input: {
    provider: "stripe" | "apple_iap" | "google_iap";
    providerEventId: string;
    eventType: string;
    payloadHash: string;
    status: "failed" | "ignored";
    errorMessage?: string;
  },
): Promise<WebhookApplyResult> {
  const { data: rpcData, error: rpcErr } = await client.rpc(
    "record_payment_provider_event_terminal",
    {
      p_provider: input.provider,
      p_provider_event_id: input.providerEventId,
      p_event_type: input.eventType,
      p_payload_hash: input.payloadHash,
      p_status: input.status,
      p_error_message: input.errorMessage ?? null,
    },
  );

  if (rpcErr) {
    // Fallback without RPC — direct insert
    const { data: existing } = await client
      .from("payment_provider_events")
      .select("id, status")
      .eq("provider", input.provider)
      .eq("provider_event_id", input.providerEventId)
      .maybeSingle();

    if (existing?.status === "processed") {
      return { ok: true, duplicate: true };
    }

    if (!existing) {
      await client.from("payment_provider_events").insert({
        provider: input.provider,
        provider_event_id: input.providerEventId,
        event_type: input.eventType,
        status: input.status,
        payload_hash: input.payloadHash,
        error_message: input.errorMessage ?? null,
        processed_at: new Date().toISOString(),
      });
    } else {
      await client.from("payment_provider_events").update({
        status: input.status,
        event_type: input.eventType,
        payload_hash: input.payloadHash,
        error_message: input.errorMessage ?? null,
        processed_at: new Date().toISOString(),
      }).eq("id", existing.id);
    }
    return { ok: true, status: input.status };
  }

  return { ok: true, ...(rpcData as Record<string, unknown>) };
}

/** W1-GAP-01 — payer_user_uuid preferred · wallet_user_id fallback. */
export function resolvePayerUserUuidFromMetadata(
  meta: Record<string, string | undefined>,
): string {
  const uuid = String(meta.payer_user_uuid || meta.wallet_user_id || "").trim();
  if (!uuid) {
    throw new TlvPaymentError(
      "invalid_metadata",
      "payer_user_uuid or wallet_user_id required",
      400,
    );
  }
  return uuid;
}

export async function applyStripePaymentIntentSucceeded(
  client: SupabaseClient,
  event: Stripe.Event,
  pi: Stripe.PaymentIntent,
): Promise<WebhookApplyResult> {
  const meta = pi.metadata ?? {};
  if (String(meta.order_type || "") !== TLV_STRIPE_ORDER_TYPE) {
    return recordTerminalProviderEvent(client, {
      provider: "stripe",
      providerEventId: event.id,
      eventType: event.type,
      payloadHash: await sha256Hex(JSON.stringify(event)),
      status: "ignored",
      errorMessage: "not_tlv_order",
    });
  }

  const skuId = resolveCoinPackSku(meta.sku_id);
  const channel = resolvePaymentChannel(meta.channel);
  if (!skuId || !channel) {
    throw new TlvPaymentError("invalid_metadata", "Missing sku_id or channel in PI metadata", 400);
  }

  const walletUserId = resolvePayerUserUuidFromMetadata(meta);
  const payerUserId = String(meta.payer_user_id || walletUserId).trim();

  const gross = Number(meta.gross_amount_jpy ?? pi.amount ?? 0);
  const fee = Number(meta.fee_amount_jpy ?? 0);
  const net = Number(meta.net_amount_jpy ?? gross - fee);
  const feeRate = Number(meta.fee_rate_applied ?? 0);
  const coins = Number(meta.coins_granted ?? 0);
  const isWeb = meta.is_web_payment === "true" || channel === "web_stripe";
  const creatorId = String(meta.creator_id || "").trim() || null;

  const payloadHash = await sha256Hex(JSON.stringify(event));

  const { data, error } = await client.rpc("handle_payment_webhook_success", {
    p_provider: "stripe",
    p_provider_event_id: event.id,
    p_event_type: event.type,
    p_payload_hash: payloadHash,
    p_payer_user_id: payerUserId,
    p_wallet_user_id: walletUserId,
    p_payer_user_uuid: walletUserId,
    p_creator_id: creatorId || null,
    p_channel: channel,
    p_gross: gross,
    p_fee: fee,
    p_net: net,
    p_fee_rate: feeRate,
    p_coins: coins,
    p_is_web: isWeb,
    p_stripe_payment_intent: pi.id,
    p_external_ref: pi.id,
    p_metadata: meta,
  });

  if (error) {
    throw new TlvPaymentError("internal_error", `webhook RPC failed: ${error.message}`, 500);
  }

  return data as WebhookApplyResult;
}

export async function applyStripePaymentIntentFailed(
  client: SupabaseClient,
  event: Stripe.Event,
  pi: Stripe.PaymentIntent,
): Promise<WebhookApplyResult> {
  if (String(pi.metadata?.order_type || "") !== TLV_STRIPE_ORDER_TYPE) {
    return { ok: true, status: "ignored" };
  }
  return recordTerminalProviderEvent(client, {
    provider: "stripe",
    providerEventId: event.id,
    eventType: event.type,
    payloadHash: await sha256Hex(JSON.stringify(event)),
    status: "failed",
    errorMessage: pi.last_payment_error?.message ?? "payment_failed",
  });
}

export function buildPaymentIntentMetadata(input: {
  skuId: CoinPackSkuId;
  channel: PaymentChannel;
  walletUserId: string;
  payerUserId: string;
  creatorId?: string | null;
  idempotencyKey: string;
  quote: ReturnType<typeof computePurchaseQuote>;
}): Record<string, string> {
  return {
    order_type: TLV_STRIPE_ORDER_TYPE,
    sku_id: input.skuId,
    channel: input.channel,
    wallet_user_id: input.walletUserId,
    payer_user_uuid: input.walletUserId,
    payer_user_id: input.payerUserId,
    creator_id: input.creatorId ?? "",
    idempotency_key: input.idempotencyKey,
    gross_amount_jpy: String(input.quote.grossAmountJpy),
    fee_amount_jpy: String(input.quote.feeAmountJpy),
    net_amount_jpy: String(input.quote.netAmountJpy),
    fee_rate_applied: String(input.quote.feeRateApplied),
    coins_granted: String(input.quote.coinsGranted),
    is_web_payment: String(input.quote.isWebPayment),
  };
}

export async function createStripeCoinPurchase(input: {
  skuId: CoinPackSkuId;
  channel: PaymentChannel;
  walletUserId: string;
  payerUserId: string;
  creatorId?: string | null;
  idempotencyKey: string;
  stripe: Stripe;
}): Promise<{
  quote: ReturnType<typeof computePurchaseQuote>;
  paymentIntentId: string;
  clientSecret: string | null;
}> {
  assertSkuMatchesChannel(input.skuId, input.channel);
  const pack = getCoinPack(input.skuId);
  const client = createTlvServiceClient();
  const cfg = await getActiveFeeConfig(client, input.channel);
  const quote = computePurchaseQuote(pack, cfg, input.channel);

  const metadata = buildPaymentIntentMetadata({
    skuId: input.skuId,
    channel: input.channel,
    walletUserId: input.walletUserId,
    payerUserId: input.payerUserId,
    creatorId: input.creatorId,
    idempotencyKey: input.idempotencyKey,
    quote,
  });

  const pi = await input.stripe.paymentIntents.create(
    {
      amount: quote.grossAmountJpy,
      currency: "jpy",
      automatic_payment_methods: { enabled: true },
      metadata,
    },
    { idempotencyKey: input.idempotencyKey },
  );

  return {
    quote,
    paymentIntentId: pi.id,
    clientSecret: pi.client_secret,
  };
}

function resolvePaymentIntentFromCharge(charge: Stripe.Charge): string | null {
  const pi = charge.payment_intent;
  if (typeof pi === "string" && pi) return pi;
  if (pi && typeof pi === "object" && "id" in pi) return pi.id;
  return null;
}

export async function applyStripeChargeRefunded(
  client: SupabaseClient,
  event: Stripe.Event,
  charge: Stripe.Charge,
): Promise<WebhookApplyResult> {
  const payloadHash = await sha256Hex(JSON.stringify(event));
  const paymentIntentId = resolvePaymentIntentFromCharge(charge) ?? "";

  const { data, error } = await client.rpc("handle_payment_refund", {
    p_provider: "stripe",
    p_provider_event_id: event.id,
    p_event_type: event.type,
    p_payload_hash: payloadHash,
    p_stripe_payment_intent: paymentIntentId,
    p_stripe_charge_id: charge.id,
    p_refund_jpy_cumulative: charge.amount_refunded ?? 0,
    p_metadata: { stripe_charge_id: charge.id, order_type: charge.metadata?.order_type ?? "" },
  });

  if (error) {
    if (error.message?.includes("payment_not_found")) {
      return recordTerminalProviderEvent(client, {
        provider: "stripe",
        providerEventId: event.id,
        eventType: event.type,
        payloadHash,
        status: "ignored",
        errorMessage: "payment_not_found",
      });
    }
    throw new TlvPaymentError("internal_error", `refund RPC failed: ${error.message}`, 500);
  }

  return data as WebhookApplyResult;
}

export async function applyStripeRefundUpdated(
  client: SupabaseClient,
  stripe: Stripe,
  event: Stripe.Event,
  refund: Stripe.Refund,
): Promise<WebhookApplyResult> {
  const payloadHash = await sha256Hex(JSON.stringify(event));
  const chargeId = typeof refund.charge === "string" ? refund.charge : refund.charge?.id ?? "";

  let cumulative = refund.amount ?? 0;
  if (chargeId) {
    try {
      const charge = await stripe.charges.retrieve(chargeId);
      cumulative = charge.amount_refunded ?? cumulative;
    } catch {
      // fall back to refund.amount — RPC delta may no-op if already processed
    }
  }

  const { data, error } = await client.rpc("handle_payment_refund", {
    p_provider: "stripe",
    p_provider_event_id: event.id,
    p_event_type: event.type,
    p_payload_hash: payloadHash,
    p_stripe_payment_intent: "",
    p_stripe_charge_id: chargeId,
    p_refund_jpy_cumulative: cumulative,
    p_metadata: {
      stripe_refund_id: refund.id,
      stripe_charge_id: chargeId,
      refund_status: refund.status ?? "",
    },
  });

  if (error) {
    if (error.message?.includes("payment_not_found")) {
      return recordTerminalProviderEvent(client, {
        provider: "stripe",
        providerEventId: event.id,
        eventType: event.type,
        payloadHash,
        status: "ignored",
        errorMessage: "payment_not_found",
      });
    }
    throw new TlvPaymentError("internal_error", `refund.updated RPC failed: ${error.message}`, 500);
  }

  return data as WebhookApplyResult;
}

export async function applyStripeDisputeEvent(
  client: SupabaseClient,
  event: Stripe.Event,
  dispute: Stripe.Dispute,
): Promise<WebhookApplyResult> {
  const payloadHash = await sha256Hex(JSON.stringify(event));
  const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id ?? "";

  let phase = "open";
  if (event.type === "charge.dispute.closed") {
    if (dispute.status === "won") phase = "won";
    else if (dispute.status === "lost") phase = "lost";
    else phase = dispute.status ?? "closed";
  }

  const { data, error } = await client.rpc("handle_payment_dispute", {
    p_provider: "stripe",
    p_provider_event_id: event.id,
    p_event_type: event.type,
    p_payload_hash: payloadHash,
    p_stripe_payment_intent: "",
    p_stripe_charge_id: chargeId,
    p_stripe_dispute_id: dispute.id,
    p_dispute_phase: phase,
    p_dispute_amount_jpy: dispute.amount ?? 0,
    p_metadata: {
      stripe_dispute_id: dispute.id,
      stripe_charge_id: chargeId,
      dispute_status: dispute.status ?? "",
    },
  });

  if (error) {
    if (error.message?.includes("payment_not_found")) {
      return recordTerminalProviderEvent(client, {
        provider: "stripe",
        providerEventId: event.id,
        eventType: event.type,
        payloadHash,
        status: "ignored",
        errorMessage: "payment_not_found",
      });
    }
    throw new TlvPaymentError("internal_error", `dispute RPC failed: ${error.message}`, 500);
  }

  return data as WebhookApplyResult;
}

export { coinsGranted, getCoinPack, resolveCoinPackSku, resolvePaymentChannel };
