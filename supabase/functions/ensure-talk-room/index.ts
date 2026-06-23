import {
  handleOptions,
  handleTalkRoomError,
  jsonResponse,
  parseJsonBody,
  requirePost,
  requireTalkUser,
} from "../_shared/talk-room-auth.ts";
import { ensureListingTalkRoom } from "../_shared/talk-room-ensure.ts";

type EnsureTalkRoomBody = {
  listing_type?: unknown;
  listing_id?: unknown;
  title?: unknown;
  buyer_id?: unknown;
  seller_id?: unknown;
  contact_id?: unknown;
  source?: unknown;
  service_type?: unknown;
  service_ref_id?: unknown;
  service_deal_id?: unknown;
  expires_at?: unknown;
  status?: unknown;
  participants?: unknown;
  from?: unknown;
};

function pickString(...values: unknown[]): string {
  for (let i = 0; i < values.length; i += 1) {
    const v = String(values[i] ?? "").trim();
    if (v) return v;
  }
  return "";
}

function isLiveConfigured(): boolean {
  const url = String(Deno.env.get("SUPABASE_URL") ?? "").trim();
  const key = String(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();
  return Boolean(url && key);
}

export async function handler(req: Request): Promise<Response> {
  const options = handleOptions(req);
  if (options) return options;

  try {
    requirePost(req);
    const user = requireTalkUser(req);
    const body = await parseJsonBody<EnsureTalkRoomBody>(req);

    if (!isLiveConfigured() || user.tokenMode === "stub") {
      const roomId = "00000000-0000-4000-8000-000000000099";
      return jsonResponse(
        {
          ok: true,
          mode: "stub",
          room_id: roomId,
          redirect_url: `../chat-detail.html?room=${roomId}&roomId=${roomId}`,
          created: false,
          reused: true,
        },
        200,
        req,
      );
    }

    const participants = Array.isArray(body.participants)
      ? body.participants.map((p) => String(p || "").trim()).filter(Boolean)
      : undefined;

    const result = await ensureListingTalkRoom(
      user,
      {
        listing_type: pickString(body.listing_type),
        listing_id: pickString(body.listing_id),
        title: pickString(body.title),
        buyer_id: pickString(body.buyer_id),
        seller_id: pickString(body.seller_id),
        contact_id: pickString(body.contact_id) || undefined,
        source: pickString(body.source) || undefined,
        service_type: pickString(body.service_type) || undefined,
        service_ref_id: pickString(body.service_ref_id) || undefined,
        service_deal_id: pickString(body.service_deal_id) || undefined,
        expires_at: pickString(body.expires_at) || undefined,
        status: pickString(body.status, "fee_pending") || "fee_pending",
        participants,
      },
      { from: pickString(body.from) || undefined },
    );

    return jsonResponse(
      {
        ok: true,
        mode: "live",
        room_id: result.room_id,
        redirect_url: result.redirect_url,
        created: result.created,
        reused: result.reused,
      },
      200,
      req,
    );
  } catch (err) {
    return handleTalkRoomError(err, req);
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
