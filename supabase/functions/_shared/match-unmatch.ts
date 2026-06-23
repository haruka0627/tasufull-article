/**
 * MATCH unmatch — end mutual match (live)
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  authResponseFields,
  jsonResponse,
  MatchFunctionError,
  type MatchAuthUser,
} from "./match-auth.ts";
import { createMatchServiceClient, createUserClient } from "./match-db.ts";
import { isLiveCoreEnabled } from "./match-core.ts";
import { cancelLinkedTalkRooms, type MatchPairRow } from "./match-talk-room.ts";

export type UnmatchPairResult = {
  pair_id: string;
  status: string;
  room_status: string | null;
  already_unmatched: boolean;
};

export function isLiveUnmatchEnabled(): boolean {
  return isLiveCoreEnabled();
}

export function unmatchSuccess(
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

async function loadPairForParticipant(
  userClient: SupabaseClient,
  callerId: string,
  pairId: string,
): Promise<MatchPairRow> {
  const { data: pair, error } = await userClient
    .from("match_pairs")
    .select("id, user_low_id, user_high_id, status, talk_room_id, blocked_by_user_id, archived_at")
    .eq("id", pairId)
    .maybeSingle();

  if (error) throw new MatchFunctionError("internal_error", error.message, 500);
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
  return row;
}

export async function unmatchPairLive(
  req: Request,
  user: MatchAuthUser,
  pairId: string,
): Promise<UnmatchPairResult> {
  const { client: userClient } = createUserClient(req);
  const serviceClient = createMatchServiceClient();
  const pair = await loadPairForParticipant(userClient, user.matchUserId, pairId);

  if (pair.status === "blocked") {
    throw new MatchFunctionError("conflict", "Blocked pairs cannot be unmatched", 409);
  }

  if (pair.status === "unmatched") {
    return {
      pair_id: pair.id,
      status: "unmatched",
      room_status: null,
      already_unmatched: true,
    };
  }

  if (pair.status !== "active") {
    throw new MatchFunctionError("conflict", `Match pair status is ${pair.status}`, 409);
  }

  const { error: updErr } = await serviceClient
    .from("match_pairs")
    .update({
      status: "unmatched",
      blocked_by_user_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", pair.id);

  if (updErr) throw new MatchFunctionError("internal_error", updErr.message, 500);

  const roomStatus = await cancelLinkedTalkRooms(serviceClient, pair.id, pair.talk_room_id);

  return {
    pair_id: pair.id,
    status: "unmatched",
    room_status: roomStatus,
    already_unmatched: false,
  };
}
