/**
 * MATCH core E2E — swipe · mutual match · pair list
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  authResponseFields,
  jsonResponse,
  MatchFunctionError,
  type MatchAuthUser,
} from "./match-auth.ts";
import { createMatchServiceClient, createUserClient, getMatchSupabaseEnv } from "./match-db.ts";
import { areUsersBlocked, assertNotBlocked } from "./match-p15.ts";

export type SwipeAction = "like" | "skip";

export type RecordSwipeResult = {
  swipe_recorded: boolean;
  action: SwipeAction;
  matched: boolean;
  pair_id: string | null;
  swipe_id?: string;
};

export type MatchPairListItem = {
  pair_id: string;
  partner_user_id: string;
  partner_display_name: string;
  partner_photo_url: string | null;
  status: "active" | "new";
  talk_room_id: string | null;
  unread_count: number;
  last_message: string | null;
  updated_at: string;
  matched_at: string;
};

export function isLiveCoreEnabled(): boolean {
  const env = getMatchSupabaseEnv();
  return Boolean(env.url && env.anonKey && env.serviceRoleKey);
}

export function orderedPairUsers(userA: string, userB: string): { low: string; high: string } {
  return userA < userB
    ? { low: userA, high: userB }
    : { low: userB, high: userA };
}

export function coreSuccess(
  req: Request,
  user: MatchAuthUser,
  data: Record<string, unknown>,
  status = 200,
): Response {
  return jsonResponse(
    {
      ok: true,
      mode: "live",
      ...authResponseFields(user),
      ...data,
    },
    status,
    req,
  );
}

async function assertSwiperProfileActive(client: SupabaseClient, userId: string): Promise<void> {
  const { data, error } = await client
    .from("match_profiles")
    .select("id, profile_status, archived_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new MatchFunctionError("internal_error", error.message, 500);
  if (!data || data.archived_at) {
    throw new MatchFunctionError("profile_required", "Active match profile required", 403);
  }
  if (data.profile_status !== "active" && data.profile_status !== "draft") {
    throw new MatchFunctionError("profile_required", "Profile is not available for swipe", 403);
  }
}

async function assertTargetDiscoverable(
  serviceClient: SupabaseClient,
  swiperId: string,
  targetUserId: string,
): Promise<void> {
  const { data, error } = await serviceClient
    .from("match_profiles")
    .select("user_id, profile_status, archived_at")
    .eq("user_id", targetUserId)
    .maybeSingle();

  if (error) throw new MatchFunctionError("internal_error", error.message, 500);
  if (!data || data.archived_at || data.profile_status !== "active") {
    throw new MatchFunctionError("not_found", "Target profile not found", 404);
  }

  const { data: blocked, error: blockErr } = await serviceClient.rpc("match_users_are_blocked", {
    p_user_a: swiperId,
    p_user_b: targetUserId,
  });
  if (blockErr) throw new MatchFunctionError("internal_error", blockErr.message, 500);
  if (blocked) {
    throw new MatchFunctionError("blocked", "Users are blocked", 409);
  }
}

async function findExistingSwipe(
  client: SupabaseClient,
  swiperId: string,
  targetUserId: string,
): Promise<{ id: string; action: string } | null> {
  const { data, error } = await client
    .from("match_swipes")
    .select("id, action")
    .eq("swiper_user_id", swiperId)
    .eq("target_user_id", targetUserId)
    .maybeSingle();

  if (error) throw new MatchFunctionError("internal_error", error.message, 500);
  return data ? { id: String(data.id), action: String(data.action) } : null;
}

async function createMatchPairIfMutual(
  serviceClient: SupabaseClient,
  swiperId: string,
  targetUserId: string,
): Promise<string | null> {
  const { data: reverse, error: reverseErr } = await serviceClient
    .from("match_swipes")
    .select("id")
    .eq("swiper_user_id", targetUserId)
    .eq("target_user_id", swiperId)
    .eq("action", "like")
    .maybeSingle();

  if (reverseErr) throw new MatchFunctionError("internal_error", reverseErr.message, 500);
  if (!reverse) return null;

  const { low, high } = orderedPairUsers(swiperId, targetUserId);

  const { data: existingPair, error: findPairErr } = await serviceClient
    .from("match_pairs")
    .select("id, status")
    .eq("user_low_id", low)
    .eq("user_high_id", high)
    .maybeSingle();

  if (findPairErr) throw new MatchFunctionError("internal_error", findPairErr.message, 500);
  if (existingPair?.id) {
    if (existingPair.status === "active") return String(existingPair.id);
    throw new MatchFunctionError("conflict", "Match pair is not active", 409);
  }

  const { data: inserted, error: insErr } = await serviceClient
    .from("match_pairs")
    .insert({
      user_low_id: low,
      user_high_id: high,
      status: "active",
    })
    .select("id")
    .single();

  if (insErr) {
    if (/duplicate|unique/i.test(insErr.message)) {
      const { data: raced } = await serviceClient
        .from("match_pairs")
        .select("id")
        .eq("user_low_id", low)
        .eq("user_high_id", high)
        .maybeSingle();
      if (raced?.id) return String(raced.id);
    }
    throw new MatchFunctionError("internal_error", insErr.message, 500);
  }

  return String(inserted.id);
}

export async function recordSwipeLive(
  req: Request,
  user: MatchAuthUser,
  targetUserId: string,
  action: SwipeAction,
): Promise<RecordSwipeResult> {
  const { client: userClient } = createUserClient(req);
  const serviceClient = createMatchServiceClient();

  await assertSwiperProfileActive(userClient, user.matchUserId);
  await assertTargetDiscoverable(serviceClient, user.matchUserId, targetUserId);
  await assertNotBlocked(userClient, user.matchUserId, targetUserId);

  const existing = await findExistingSwipe(userClient, user.matchUserId, targetUserId);
  if (existing) {
    throw new MatchFunctionError("conflict", "Swipe already recorded for this user", 409);
  }

  const { data: insertedSwipe, error: swipeErr } = await userClient
    .from("match_swipes")
    .insert({
      swiper_user_id: user.matchUserId,
      target_user_id: targetUserId,
      action,
    })
    .select("id")
    .single();

  if (swipeErr) {
    if (/duplicate|unique/i.test(swipeErr.message)) {
      throw new MatchFunctionError("conflict", "Swipe already recorded for this user", 409);
    }
    throw new MatchFunctionError("internal_error", swipeErr.message, 500);
  }

  let pairId: string | null = null;
  if (action === "like") {
    pairId = await createMatchPairIfMutual(serviceClient, user.matchUserId, targetUserId);
  }

  return {
    swipe_recorded: true,
    action,
    matched: Boolean(pairId),
    pair_id: pairId,
    swipe_id: String(insertedSwipe.id),
  };
}

function partnerUserIdFromPair(
  pair: { user_low_id: string; user_high_id: string },
  viewerId: string,
): string {
  return viewerId === pair.user_low_id ? pair.user_high_id : pair.user_low_id;
}

function isNewMatch(matchedAt: string): boolean {
  const matchedMs = Date.parse(matchedAt);
  if (!Number.isFinite(matchedMs)) return false;
  return Date.now() - matchedMs < 48 * 60 * 60 * 1000;
}

async function loadPartnerSummaries(
  serviceClient: SupabaseClient,
  partnerIds: string[],
): Promise<Map<string, { display_name: string; photo_url: string | null }>> {
  const map = new Map<string, { display_name: string; photo_url: string | null }>();
  if (!partnerIds.length) return map;

  const { data: profiles, error } = await serviceClient
    .from("match_profiles")
    .select("user_id, nickname, main_photo_id")
    .in("user_id", partnerIds)
    .is("archived_at", null);

  if (error) throw new MatchFunctionError("internal_error", error.message, 500);

  const photoIds = (profiles ?? [])
    .map((p) => p.main_photo_id)
    .filter((id): id is string => Boolean(id));

  const photoMap = new Map<string, string>();
  if (photoIds.length) {
    const { data: photos, error: photoErr } = await serviceClient
      .from("match_profile_photos")
      .select("id, storage_path")
      .in("id", photoIds);
    if (photoErr) throw new MatchFunctionError("internal_error", photoErr.message, 500);
    for (const ph of photos ?? []) {
      photoMap.set(String(ph.id), String(ph.storage_path));
    }
  }

  for (const profile of profiles ?? []) {
    const userId = String(profile.user_id);
    const nickname = String(profile.nickname ?? "マッチ相手").trim() || "マッチ相手";
    const photoId = profile.main_photo_id ? String(profile.main_photo_id) : "";
    map.set(userId, {
      display_name: nickname,
      photo_url: photoId && photoMap.has(photoId) ? photoMap.get(photoId)! : null,
    });
  }

  return map;
}

export async function listPairsLive(
  req: Request,
  user: MatchAuthUser,
): Promise<MatchPairListItem[]> {
  const { client: userClient } = createUserClient(req);
  const serviceClient = createMatchServiceClient();

  const { data: pairs, error } = await userClient
    .from("match_pairs")
    .select("id, user_low_id, user_high_id, status, talk_room_id, matched_at, updated_at")
    .eq("status", "active")
    .is("archived_at", null)
    .order("matched_at", { ascending: false });

  if (error) throw new MatchFunctionError("internal_error", error.message, 500);

  const rows = pairs ?? [];
  const visible: { row: (typeof rows)[number]; partnerId: string }[] = [];

  for (const row of rows) {
    const partnerId = partnerUserIdFromPair(
      { user_low_id: String(row.user_low_id), user_high_id: String(row.user_high_id) },
      user.matchUserId,
    );
    if (await areUsersBlocked(userClient, user.matchUserId, partnerId)) continue;
    visible.push({ row, partnerId });
  }

  const partnerMap = await loadPartnerSummaries(
    serviceClient,
    visible.map((item) => item.partnerId),
  );

  return visible.map(({ row, partnerId }) => {
    const summary = partnerMap.get(partnerId) ?? {
      display_name: "マッチ相手",
      photo_url: null,
    };
    const matchedAt = String(row.matched_at ?? row.updated_at ?? new Date().toISOString());
    return {
      pair_id: String(row.id),
      partner_user_id: partnerId,
      partner_display_name: summary.display_name,
      partner_photo_url: summary.photo_url,
      status: isNewMatch(matchedAt) ? "new" : "active",
      talk_room_id: row.talk_room_id ? String(row.talk_room_id) : null,
      unread_count: 0,
      last_message: null,
      updated_at: String(row.updated_at ?? matchedAt),
      matched_at: matchedAt,
    };
  });
}
