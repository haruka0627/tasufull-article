/**
 * MATCH → TASFUL TALK bridge (transaction_rooms 1-on-1 DM)
 * Ref: reports/match-edge-functions-design.md §2
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  type MatchAuthUser,
  MatchFunctionError,
} from "./match-auth.ts";
import { createMatchServiceClient, createUserClient } from "./match-db.ts";

export const MATCH_LISTING_TYPE = "match";
export const MATCH_ROOM_FAR_FUTURE_EXPIRES_AT = "2099-12-31T23:59:59.000Z";

export type MatchPairRow = {
  id: string;
  user_low_id: string;
  user_high_id: string;
  status: string;
  talk_room_id: string | null;
  blocked_by_user_id: string | null;
  archived_at: string | null;
};

export type EnsureTalkRoomResult = {
  room_id: string;
  redirect_url: string;
  created: boolean;
  reused: boolean;
};

export function buildTalkRedirectUrl(roomId: string): string {
  return `../chat-detail.html?room=${encodeURIComponent(roomId)}`;
}

function partnerUserId(pair: MatchPairRow, callerId: string): string {
  return callerId === pair.user_low_id ? pair.user_high_id : pair.user_low_id;
}

async function assertPairAccessible(
  userClient: SupabaseClient,
  callerId: string,
  pairId: string,
): Promise<MatchPairRow> {
  const { data: pair, error } = await userClient
    .from("match_pairs")
    .select("id, user_low_id, user_high_id, status, talk_room_id, blocked_by_user_id, archived_at")
    .eq("id", pairId)
    .maybeSingle();

  if (error) {
    throw new MatchFunctionError("internal_error", error.message, 500);
  }
  if (!pair) {
    throw new MatchFunctionError("forbidden", "Not a participant of this match pair", 403);
  }

  const row = pair as MatchPairRow;
  if (row.user_low_id !== callerId && row.user_high_id !== callerId) {
    throw new MatchFunctionError("forbidden", "Not a participant of this match pair", 403);
  }
  if (row.archived_at) {
    throw new MatchFunctionError("conflict", "Match pair is archived", 409);
  }
  if (row.status === "unmatched") {
    throw new MatchFunctionError("conflict", "Match pair is unmatched", 409);
  }
  if (row.status === "blocked") {
    throw new MatchFunctionError("conflict", "Match pair is blocked", 409);
  }
  if (row.status !== "active") {
    throw new MatchFunctionError("conflict", `Match pair status is ${row.status}`, 409);
  }

  const { data: blocked, error: blockErr } = await userClient.rpc("match_users_are_blocked", {
    p_user_a: row.user_low_id,
    p_user_b: row.user_high_id,
  });
  if (blockErr) {
    throw new MatchFunctionError("internal_error", blockErr.message, 500);
  }
  if (blocked) {
    throw new MatchFunctionError("blocked", "Users are blocked", 409);
  }

  return row;
}

async function assertParticipantsActiveProfiles(
  serviceClient: SupabaseClient,
  userLow: string,
  userHigh: string,
): Promise<void> {
  const { data, error } = await serviceClient
    .from("match_profiles")
    .select("user_id, profile_status, archived_at")
    .in("user_id", [userLow, userHigh])
    .is("archived_at", null);

  if (error) {
    throw new MatchFunctionError("internal_error", error.message, 500);
  }

  const rows = data ?? [];
  if (rows.length < 2) {
    throw new MatchFunctionError("profile_required", "Both participants need active profiles", 403);
  }

  for (const row of rows) {
    if (String(row.profile_status) !== "active") {
      throw new MatchFunctionError(
        "profile_suspended",
        "Participant profile is not available for messaging",
        403,
      );
    }
  }
}

async function loadPartnerProfile(
  serviceClient: SupabaseClient,
  partnerId: string,
): Promise<{ nickname: string; main_photo_url: string | null }> {
  const { data, error } = await serviceClient
    .from("match_profiles")
    .select("id, nickname, main_photo_id")
    .eq("user_id", partnerId)
    .is("archived_at", null)
    .maybeSingle();

  if (error) {
    console.warn("[match-talk-room] partner profile load failed", error.message);
    return { nickname: "マッチ相手", main_photo_url: null };
  }
  if (!data) {
    return { nickname: "マッチ相手", main_photo_url: null };
  }

  const nickname = String(data.nickname ?? "マッチ相手").trim() || "マッチ相手";
  let mainPhotoUrl: string | null = null;

  if (data.main_photo_id) {
    const { data: photo } = await serviceClient
      .from("match_profile_photos")
      .select("storage_path")
      .eq("id", data.main_photo_id)
      .maybeSingle();
    if (photo?.storage_path) {
      mainPhotoUrl = String(photo.storage_path);
    }
  }

  return { nickname, main_photo_url: mainPhotoUrl };
}

async function findExistingMatchRoom(
  serviceClient: SupabaseClient,
  pair: MatchPairRow,
): Promise<string | null> {
  if (pair.talk_room_id) {
    const { data: linked, error } = await serviceClient
      .from("transaction_rooms")
      .select("id")
      .eq("id", pair.talk_room_id)
      .maybeSingle();
    if (error) {
      throw new MatchFunctionError("internal_error", error.message, 500);
    }
    if (linked?.id) return String(linked.id);
  }

  const { data: byListing, error: listErr } = await serviceClient
    .from("transaction_rooms")
    .select("id")
    .eq("listing_type", MATCH_LISTING_TYPE)
    .eq("listing_id", pair.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (listErr) {
    throw new MatchFunctionError("internal_error", listErr.message, 500);
  }
  return byListing?.id ? String(byListing.id) : null;
}

export async function cancelLinkedTalkRooms(
  serviceClient: SupabaseClient,
  pairId: string | null,
  talkRoomId: string | null,
): Promise<string | null> {
  const roomIds = new Set<string>();
  if (talkRoomId) roomIds.add(talkRoomId);

  if (pairId) {
    const { data: byPair, error } = await serviceClient
      .from("transaction_rooms")
      .select("id")
      .eq("match_pair_id", pairId);
    if (error && !/column|schema cache/i.test(error.message)) {
      throw new MatchFunctionError("internal_error", error.message, 500);
    }
    for (const row of byPair ?? []) roomIds.add(String(row.id));

    const { data: byListing, error: listErr } = await serviceClient
      .from("transaction_rooms")
      .select("id")
      .eq("listing_type", MATCH_LISTING_TYPE)
      .eq("listing_id", pairId);
    if (listErr && !/column|schema cache/i.test(listErr.message)) {
      throw new MatchFunctionError("internal_error", listErr.message, 500);
    }
    for (const row of byListing ?? []) roomIds.add(String(row.id));
  }

  let roomStatus: string | null = null;
  for (const roomId of roomIds) {
    const { error } = await serviceClient
      .from("transaction_rooms")
      .update({ status: "cancelled" })
      .eq("id", roomId);
    if (error) {
      if (/column|schema cache/i.test(error.message)) continue;
      throw new MatchFunctionError("internal_error", error.message, 500);
    }
    roomStatus = "cancelled";
  }
  return roomStatus;
}

async function linkPairToRoom(
  serviceClient: SupabaseClient,
  pairId: string,
  roomId: string,
): Promise<void> {
  const { error } = await serviceClient
    .from("match_pairs")
    .update({ talk_room_id: roomId, updated_at: new Date().toISOString() })
    .eq("id", pairId);

  if (error) {
    throw new MatchFunctionError("internal_error", error.message, 500);
  }
}

async function createMatchTransactionRoom(
  serviceClient: SupabaseClient,
  pair: MatchPairRow,
  callerId: string,
): Promise<string> {
  const partnerId = partnerUserId(pair, callerId);
  const partner = await loadPartnerProfile(serviceClient, partnerId);

  const core: Record<string, unknown> = {
    listing_id: pair.id,
    listing_type: MATCH_LISTING_TYPE,
    buyer_id: pair.user_low_id,
    seller_id: pair.user_high_id,
    expires_at: MATCH_ROOM_FAR_FUTURE_EXPIRES_AT,
    status: "active",
  };

  const candidates: Record<string, unknown>[] = [
    {
      ...core,
      match_pair_id: pair.id,
      title: `【マッチ】${partner.nickname}`,
      partner_id: partnerId,
      partner_display_name: partner.nickname,
      partner_avatar_url: partner.main_photo_url,
    },
    { ...core, match_pair_id: pair.id, title: `【マッチ】${partner.nickname}` },
    { ...core, match_pair_id: pair.id },
    core,
  ];

  let lastMsg = "transaction_rooms insert failed";
  for (const row of candidates) {
    const { data, error } = await serviceClient
      .from("transaction_rooms")
      .insert(row)
      .select("id")
      .single();

    if (!error && data?.id) return String(data.id);

    if (error && /could not find|column|schema cache/i.test(error.message)) {
      lastMsg = error.message;
      continue;
    }
    if (error) {
      throw new MatchFunctionError("internal_error", error.message, 500);
    }
  }

  throw new MatchFunctionError("internal_error", lastMsg, 500);
}

export async function ensureTalkRoomForPair(
  req: Request,
  user: MatchAuthUser,
  pairId: string,
): Promise<EnsureTalkRoomResult> {
  const { client: userClient } = createUserClient(req);
  const pair = await assertPairAccessible(userClient, user.matchUserId, pairId);

  const serviceClient = createMatchServiceClient();
  await assertParticipantsActiveProfiles(serviceClient, pair.user_low_id, pair.user_high_id);

  let roomId = await findExistingMatchRoom(serviceClient, pair);
  let created = false;
  let reused = false;

  if (roomId) {
    reused = true;
    if (!pair.talk_room_id || pair.talk_room_id !== roomId) {
      await linkPairToRoom(serviceClient, pair.id, roomId);
    }
  } else {
    roomId = await createMatchTransactionRoom(serviceClient, pair, user.matchUserId);
    created = true;
    await linkPairToRoom(serviceClient, pair.id, roomId);
  }

  return {
    room_id: roomId,
    redirect_url: buildTalkRedirectUrl(roomId),
    created,
    reused,
  };
}
