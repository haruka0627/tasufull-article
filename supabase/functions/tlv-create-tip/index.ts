import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import {
  handleLiveVideoError,
  parseJsonBody,
  requirePost,
  requireVerifiedUser,
} from "../_shared/live-video-auth.ts";
import { createTip } from "../_shared/tlv-create-tip.ts";
import { createTlvServiceClient, parseAuthUserUuid } from "../_shared/tlv-payment-db.ts";
import { handleTlvPaymentError, TlvPaymentError } from "../_shared/tlv-payment-errors.ts";

type Body = {
  stream_id?: string;
  creator_id?: string;
  coins?: number;
  tip_kind?: "gift" | "extension" | "cheer";
  message?: string;
  device_id?: string;
  bot_score?: number;
  idempotency_key?: string;
};

export async function handler(req: Request): Promise<Response> {
  const options = handleOptions(req);
  if (options) return options;

  try {
    requirePost(req);
    const auth = await requireVerifiedUser(req);
    const body = await parseJsonBody<Body>(req);

    const streamId = String(body.stream_id ?? "").trim();
    const creatorId = String(body.creator_id ?? "").trim();
    const coins = Number(body.coins);
    const tipKind = (body.tip_kind ?? "gift") as "gift" | "extension" | "cheer";

    if (!streamId) throw new TlvPaymentError("invalid_request", "stream_id required", 400);
    if (!creatorId) throw new TlvPaymentError("invalid_request", "creator_id required", 400);
    if (!["gift", "extension", "cheer"].includes(tipKind)) {
      throw new TlvPaymentError("invalid_request", "invalid tip_kind", 400);
    }

    const walletUserId = parseAuthUserUuid(auth.user.id);
    const payerUserId = auth.talkUserId || auth.user.id;
    const idempotencyKey = String(body.idempotency_key ?? crypto.randomUUID()).trim();

    const result = await createTip(createTlvServiceClient(), {
      streamId,
      creatorId,
      walletUserId,
      payerUserId,
      coinsAmount: coins,
      tipKind,
      idempotencyKey,
      message: body.message ?? null,
      deviceId: body.device_id ?? null,
      botScore: Number(body.bot_score ?? 0),
    });

    return jsonResponse(result, 200, req);
  } catch (err) {
    if (err instanceof TlvPaymentError) return handleTlvPaymentError(err, req);
    return handleLiveVideoError(err, req);
  }
}

if (import.meta.main) Deno.serve(handler);
