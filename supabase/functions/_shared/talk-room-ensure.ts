/**
 * Generic TALK room ensure — transaction_rooms idempotent create/reuse
 * Ref: match-talk-room.ts · reports/talk-chat-unify-p0-p1-plan.md P1
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { TalkRoomFunctionError, type TalkAuthUser } from "./talk-room-auth.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export type EnsureListingTalkRoomInput = {
  listing_type: string;
  listing_id: string;
  title: string;
  buyer_id: string;
  seller_id: string;
  contact_id?: string;
  source?: string;
  service_type?: string;
  service_ref_id?: string;
  service_deal_id?: string;
  expires_at?: string;
  status?: string;
  participants?: string[];
};

export type EnsureListingTalkRoomResult = {
  room_id: string;
  redirect_url: string;
  created: boolean;
  reused: boolean;
};

export function buildTalkRedirectUrl(roomId: string, from?: string): string {
  const base = `../chat-detail.html?room=${encodeURIComponent(roomId)}&roomId=${encodeURIComponent(roomId)}`;
  if (!from) return base;
  return `${base}&from=${encodeURIComponent(from)}`;
}

function getSupabaseEnv() {
  const url = String(Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");
  const serviceRoleKey = String(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();
  return { url, serviceRoleKey };
}

export function createTalkRoomServiceClient(): SupabaseClient {
  const { url, serviceRoleKey } = getSupabaseEnv();
  if (!url || !serviceRoleKey) {
    throw new TalkRoomFunctionError(
      "internal_error",
      "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured",
      500,
    );
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function pickString(...values: unknown[]): string {
  for (let i = 0; i < values.length; i += 1) {
    const v = String(values[i] ?? "").trim();
    if (v) return v;
  }
  return "";
}

function normalizeParticipants(input: EnsureListingTalkRoomInput): string[] {
  const fromList = Array.isArray(input.participants)
    ? input.participants.map((p) => String(p || "").trim()).filter(Boolean)
    : [];
  const buyer = pickString(input.buyer_id);
  const seller = pickString(input.seller_id);
  const merged = [...new Set([buyer, seller, ...fromList].filter(Boolean))];
  return merged;
}

function assertCallerIsParticipant(user: TalkAuthUser, participants: string[]): void {
  if (user.tokenMode === "stub" || user.tokenMode === "anon") return;
  // P0-3 / D1: compare JWT sub (auth.uid), not talk_user_id.
  const caller = pickString(user.sub);
  if (!caller) {
    throw new TalkRoomFunctionError("unauthorized", "JWT sub (auth.uid) missing in token", 401);
  }
  if (!participants.includes(caller)) {
    throw new TalkRoomFunctionError("forbidden", "Not a participant of this room", 403);
  }
}

/** Rewrite caller-side talk/demo ids in ownership fields to JWT sub. */
function rewriteOwnershipToAuthUid(
  input: EnsureListingTalkRoomInput,
  user: TalkAuthUser,
): EnsureListingTalkRoomInput {
  const sub = pickString(user.sub);
  const talk = pickString(user.talkUserId);
  if (!sub) return input;
  const rewrite = (val: string): string => {
    const v = pickString(val);
    if (!v) return v;
    if (talk && v === talk) return sub;
    if (v === "u_me") return sub;
    if (/^u_[a-z0-9_]+$/i.test(v) && (!talk || v === talk)) return sub;
    return v;
  };
  const buyer_id = rewrite(input.buyer_id);
  const seller_id = rewrite(input.seller_id);
  const participants = normalizeParticipants({ ...input, buyer_id, seller_id });
  if (!participants.includes(sub)) participants.push(sub);
  return { ...input, buyer_id, seller_id, participants };
}

async function findExistingRoom(
  client: SupabaseClient,
  input: EnsureListingTalkRoomInput,
): Promise<string | null> {
  const contactId = pickString(input.contact_id);
  if (contactId) {
    const { data, error } = await client
      .from("transaction_rooms")
      .select("id")
      .eq("contact_id", contactId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error && !/column|schema cache/i.test(error.message)) {
      throw new TalkRoomFunctionError("internal_error", error.message, 500);
    }
    if (data?.id) return String(data.id);
  }

  const dealId = pickString(input.service_deal_id);
  if (dealId) {
    const { data, error } = await client
      .from("transaction_rooms")
      .select("id")
      .eq("service_deal_id", dealId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error && !/column|schema cache/i.test(error.message)) {
      throw new TalkRoomFunctionError("internal_error", error.message, 500);
    }
    if (data?.id) return String(data.id);
  }

  const serviceType = pickString(input.service_type);
  const serviceRefId = pickString(input.service_ref_id);
  if (serviceType && serviceRefId) {
    const { data, error } = await client
      .from("transaction_rooms")
      .select("id")
      .eq("service_type", serviceType)
      .eq("service_ref_id", serviceRefId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error && !/column|schema cache/i.test(error.message)) {
      throw new TalkRoomFunctionError("internal_error", error.message, 500);
    }
    if (data?.id) return String(data.id);
  }

  const listingType = pickString(input.listing_type);
  const listingId = pickString(input.listing_id);
  const buyerId = pickString(input.buyer_id);
  const sellerId = pickString(input.seller_id);
  if (listingType && listingId && buyerId && sellerId) {
    const { data, error } = await client
      .from("transaction_rooms")
      .select("id")
      .eq("listing_type", listingType)
      .eq("listing_id", listingId)
      .in("status", ["active", "fee_pending", "open"])
      .eq("buyer_id", buyerId)
      .eq("seller_id", sellerId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error && !/column|schema cache/i.test(error.message)) {
      throw new TalkRoomFunctionError("internal_error", error.message, 500);
    }
    if (data?.id) return String(data.id);
  }

  return null;
}

/** P0-2 / D5: sole transaction_rooms INSERT path (service_role). Browser PostgREST INSERT abolished. */
async function insertTransactionRoom(
  client: SupabaseClient,
  input: EnsureListingTalkRoomInput,
): Promise<string> {
  const expiresAt =
    pickString(input.expires_at) ||
    new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString();
  const status = pickString(input.status, "fee_pending") || "fee_pending";

  const base: Record<string, unknown> = {
    listing_id: pickString(input.listing_id),
    listing_type: pickString(input.listing_type),
    buyer_id: pickString(input.buyer_id),
    seller_id: pickString(input.seller_id),
    expires_at: expiresAt,
    status,
  };

  const withMeta: Record<string, unknown> = {
    ...base,
    contact_id: pickString(input.contact_id) || undefined,
    source: pickString(input.source) || undefined,
    service_type: pickString(input.service_type) || undefined,
    service_ref_id: pickString(input.service_ref_id) || undefined,
    service_deal_id: pickString(input.service_deal_id) || undefined,
  };

  const title = pickString(input.title, "やりとり") || "やりとり";
  const withTitle: Record<string, unknown> = {
    ...withMeta,
    title,
    partner_id: pickString(input.seller_id),
  };

  const candidates = [withTitle, withMeta, base];
  let lastMsg = "transaction_rooms insert failed";

  for (const row of candidates) {
    const cleaned = Object.fromEntries(
      Object.entries(row).filter(([, v]) => v !== undefined && v !== ""),
    );
    const { data, error } = await client
      .from("transaction_rooms")
      .insert(cleaned)
      .select("id")
      .single();

    if (!error && data?.id) return String(data.id);

    if (error && /could not find|column|schema cache/i.test(error.message)) {
      lastMsg = error.message;
      continue;
    }
    if (error) {
      throw new TalkRoomFunctionError("internal_error", lastMsg, 500);
    }
  }

  throw new TalkRoomFunctionError("internal_error", lastMsg, 500);
}

export async function ensureListingTalkRoom(
  user: TalkAuthUser,
  input: EnsureListingTalkRoomInput,
  options: { from?: string } = {},
): Promise<EnsureListingTalkRoomResult> {
  const listingType = pickString(input.listing_type);
  const listingId = pickString(input.listing_id);
  const buyerId = pickString(input.buyer_id);
  const sellerId = pickString(input.seller_id);

  if (!listingType || !listingId || !buyerId || !sellerId) {
    throw new TalkRoomFunctionError(
      "invalid_request",
      "listing_type, listing_id, buyer_id, seller_id are required",
      400,
    );
  }

  // P0-3: coerce ownership ids to auth uid before assert/find/insert.
  // P0-2: this Edge path is the ONLY writer of transaction_rooms rows for Browser flows.
  const rewritten = rewriteOwnershipToAuthUid(input, user);
  const participants = normalizeParticipants(rewritten);
  assertCallerIsParticipant(user, participants);
  // D1 align: authenticated inserts must persist JWT sub into buyer_id or seller_id.
  if (user.tokenMode !== "stub" && user.tokenMode !== "anon") {
    const sub = pickString(user.sub);
    if (sub && rewritten.buyer_id !== sub && rewritten.seller_id !== sub) {
      throw new TalkRoomFunctionError(
        "invalid_request",
        "buyer_id/seller_id must include auth.uid (sub) after P0-3 rewrite",
        400,
      );
    }
  }

  const client = createTalkRoomServiceClient();
  let roomId = await findExistingRoom(client, rewritten);
  let created = false;
  let reused = false;

  if (roomId) {
    reused = true;
  } else {
    roomId = await insertTransactionRoom(client, rewritten);
    created = true;
  }

  return {
    room_id: roomId,
    redirect_url: buildTalkRedirectUrl(roomId, options.from),
    created,
    reused,
  };
}
