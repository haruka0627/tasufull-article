import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { tlvDb } from "./tlv-payment-db.ts";
import { TlvPaymentError } from "./tlv-payment-errors.ts";

export type CreateTipInput = {
  streamId: string;
  creatorId: string;
  walletUserId: string;
  payerUserId: string;
  coinsAmount: number;
  tipKind: "gift" | "extension" | "cheer";
  idempotencyKey: string;
  message?: string | null;
  deviceId?: string | null;
  botScore?: number;
};

export type CreateTipResult = {
  ok: true;
  tip_id: string;
  wr_at_tip: number | null;
  fraud_excluded: boolean;
  review_required: boolean;
  extension_unlocks: number;
  coin_balance: number;
  duplicate?: boolean;
};

export type FraudAssessment = {
  selfGiftFlag: boolean;
  botSuspectFlag: boolean;
  fraudExcluded: boolean;
  reviewRequired: boolean;
};

/** Pure fraud assessment — Edge only; RPC receives flags. */
export function assessFraud(input: {
  payerUserId: string;
  creatorUserId: string;
  botScore: number;
}): FraudAssessment {
  const selfGiftFlag = input.payerUserId === input.creatorUserId;
  const botSuspectFlag = input.botScore >= 0.7;
  const fraudExcluded = botSuspectFlag;
  const reviewRequired = selfGiftFlag && !fraudExcluded;
  return { selfGiftFlag, botSuspectFlag, fraudExcluded, reviewRequired };
}

/** §3.4 grant guard — pure mirror for tests (ENGINE v1.5). */
export function extensionGrantAllowed(input: {
  adjustedGaugePct: number;
  paidExtensionCoins: number;
  effectiveCcu: number;
}): boolean {
  return (
    (input.adjustedGaugePct >= 100 && input.paidExtensionCoins >= 500) ||
    (input.paidExtensionCoins >= 500 && input.effectiveCcu >= 5)
  );
}

const RPC_ERROR_MAP: Record<string, { code: string; status: number }> = {
  invalid_coin_amount: { code: "invalid_request", status: 400 },
  payer_user_uuid_required: { code: "invalid_request", status: 400 },
  payer_user_id_required: { code: "invalid_request", status: 400 },
  stream_not_found: { code: "not_found", status: 404 },
  creator_id_mismatch: { code: "invalid_request", status: 400 },
  stream_not_live: { code: "stream_not_live", status: 409 },
  wallet_not_found: { code: "wallet_unavailable", status: 403 },
  wallet_not_active: { code: "wallet_unavailable", status: 403 },
  insufficient_balance: { code: "insufficient_balance", status: 402 },
  insufficient_lots: { code: "insufficient_balance", status: 402 },
  gauge_state_missing: { code: "internal_error", status: 500 },
  lot_race_conflict: { code: "internal_error", status: 500 },
};

function mapRpcError(message: string): TlvPaymentError {
  const key = message.split("\n")[0]?.trim() ?? message;
  const mapped = RPC_ERROR_MAP[key];
  if (mapped) {
    return new TlvPaymentError(mapped.code, key, mapped.status);
  }
  return new TlvPaymentError("internal_error", message, 500);
}

export async function createTip(
  client: SupabaseClient,
  input: CreateTipInput,
): Promise<CreateTipResult> {
  if (!Number.isInteger(input.coinsAmount) || input.coinsAmount < 1 || input.coinsAmount > 10_000) {
    throw new TlvPaymentError("invalid_request", "coins must be 1..10000", 400);
  }

  if (!input.idempotencyKey?.trim()) {
    throw new TlvPaymentError("invalid_request", "idempotency_key required", 400);
  }

  const db = tlvDb(client);

  const { data: creator, error: creatorErr } = await db
    .from("creators")
    .select("id, user_id")
    .eq("id", input.creatorId)
    .maybeSingle();
  if (creatorErr || !creator) {
    throw new TlvPaymentError("not_found", "creator not found", 404);
  }

  const fraud = assessFraud({
    payerUserId: input.payerUserId,
    creatorUserId: String(creator.user_id),
    botScore: Number(input.botScore ?? 0),
  });

  const { data, error } = await client.rpc("create_tip_transaction", {
    p_stream_id: input.streamId,
    p_creator_id: input.creatorId,
    p_payer_user_uuid: input.walletUserId,
    p_payer_user_id: input.payerUserId,
    p_tip_kind: input.tipKind,
    p_coin_amount: input.coinsAmount,
    p_idempotency_key: input.idempotencyKey,
    p_metadata: {},
    p_tip_id: null,
    p_creator_user_id: null,
    p_message: input.message ?? null,
    p_device_id: input.deviceId ?? null,
    p_self_gift_flag: fraud.selfGiftFlag,
    p_fraud_excluded: fraud.fraudExcluded,
    p_bot_flag: fraud.botSuspectFlag,
  });

  if (error) {
    throw mapRpcError(error.message);
  }

  const row = data as Record<string, unknown>;
  if (!row?.ok) {
    throw new TlvPaymentError("internal_error", "create_tip_transaction failed", 500);
  }

  return {
    ok: true,
    tip_id: String(row.tip_id),
    wr_at_tip: row.wr_at_tip != null ? Number(row.wr_at_tip) : null,
    fraud_excluded: Boolean(row.fraud_excluded),
    review_required: Boolean(row.review_required),
    extension_unlocks: Number(row.extension_blocks_granted ?? 0),
    coin_balance: Number(row.wallet_balance_after),
    duplicate: Boolean(row.duplicate),
  };
}
