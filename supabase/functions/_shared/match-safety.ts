/**
 * MATCH safety — block · report (live)
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  authResponseFields,
  jsonResponse,
  MatchFunctionError,
  type MatchAuthUser,
} from "./match-auth.ts";
import { createMatchServiceClient, createUserClient } from "./match-db.ts";
import { isLiveCoreEnabled, orderedPairUsers } from "./match-core.ts";
import { assertNotSelf } from "./match-p15.ts";
import { cancelLinkedTalkRooms } from "./match-talk-room.ts";

const BLOCK_SOURCES = new Set(["swipe", "profile", "chat", "report"]);
const REPORT_REASONS = new Set([
  "inappropriate_message",
  "impersonation",
  "harassment",
  "other",
]);
const REPORT_CONTEXTS = new Set(["profile", "swipe", "chat"]);

export type BlockUserInput = {
  blocked_user_id: string;
  blocked_profile_id?: string | null;
  reason?: string | null;
  source?: string | null;
  match_pair_id?: string | null;
};

export type BlockUserResult = {
  block_id: string;
  blocked: boolean;
  created: boolean;
  pair_status: string | null;
  room_status: string | null;
};

export type SubmitReportInput = {
  reported_user_id: string;
  reported_profile_id?: string | null;
  reason: string;
  detail?: string | null;
  context_type?: string | null;
};

export type SubmitReportResult = {
  report_id: string;
  status: string;
};

export function isLiveSafetyEnabled(): boolean {
  return isLiveCoreEnabled();
}

export function safetySuccess(
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

export function normalizeBlockSource(reason?: string | null, source?: string | null): string | null {
  const raw = String(source ?? reason ?? "").trim().toLowerCase();
  if (!raw) return null;
  const mapped: Record<string, string> = {
    swipe_modal: "swipe",
    swipe_card: "swipe",
    swipe: "swipe",
    profile: "profile",
    chat: "chat",
    report: "report",
    report_page: "report",
  };
  const value = mapped[raw] ?? raw;
  return BLOCK_SOURCES.has(value) ? value : null;
}

export function normalizeReportContext(value?: string | null): string {
  const raw = String(value ?? "profile").trim().toLowerCase();
  return REPORT_CONTEXTS.has(raw) ? raw : "profile";
}

async function assertProfileBelongsToUser(
  serviceClient: SupabaseClient,
  profileId: string,
  userId: string,
): Promise<void> {
  const { data, error } = await serviceClient
    .from("match_profiles")
    .select("id, user_id")
    .eq("id", profileId)
    .is("archived_at", null)
    .maybeSingle();
  if (error) throw new MatchFunctionError("internal_error", error.message, 500);
  if (!data || String(data.user_id) !== userId) {
    throw new MatchFunctionError("validation_error", "Profile does not match target user", 422);
  }
}

async function findActiveBlock(
  userClient: SupabaseClient,
  blockerId: string,
  blockedId: string,
): Promise<{ id: string; block_status: string; archived_at: string | null } | null> {
  const { data, error } = await userClient
    .from("match_blocks")
    .select("id, block_status, archived_at")
    .eq("blocker_user_id", blockerId)
    .eq("blocked_user_id", blockedId)
    .maybeSingle();
  if (error) throw new MatchFunctionError("internal_error", error.message, 500);
  return data
    ? {
      id: String(data.id),
      block_status: String(data.block_status),
      archived_at: data.archived_at ? String(data.archived_at) : null,
    }
    : null;
}

async function syncPairBlocked(
  serviceClient: SupabaseClient,
  blockerId: string,
  blockedId: string,
  matchPairId?: string | null,
): Promise<{ pair_id: string | null; pair_status: string | null; talk_room_id: string | null }> {
  let pair: {
    id: string;
    status: string;
    talk_room_id: string | null;
  } | null = null;

  if (matchPairId) {
    const { data, error } = await serviceClient
      .from("match_pairs")
      .select("id, status, talk_room_id, user_low_id, user_high_id")
      .eq("id", matchPairId)
      .maybeSingle();
    if (error) throw new MatchFunctionError("internal_error", error.message, 500);
    if (data) {
      const low = String(data.user_low_id);
      const high = String(data.user_high_id);
      const participants = new Set([low, high]);
      if (!participants.has(blockerId) || !participants.has(blockedId)) {
        throw new MatchFunctionError("forbidden", "Not a participant of this match pair", 403);
      }
      pair = {
        id: String(data.id),
        status: String(data.status),
        talk_room_id: data.talk_room_id ? String(data.talk_room_id) : null,
      };
    }
  }

  if (!pair) {
    const { low, high } = orderedPairUsers(blockerId, blockedId);
    const { data, error } = await serviceClient
      .from("match_pairs")
      .select("id, status, talk_room_id")
      .eq("user_low_id", low)
      .eq("user_high_id", high)
      .is("archived_at", null)
      .maybeSingle();
    if (error) throw new MatchFunctionError("internal_error", error.message, 500);
    if (data) {
      pair = {
        id: String(data.id),
        status: String(data.status),
        talk_room_id: data.talk_room_id ? String(data.talk_room_id) : null,
      };
    }
  }

  if (!pair || pair.status === "blocked") {
    return {
      pair_id: pair?.id ?? null,
      pair_status: pair?.status ?? null,
      talk_room_id: pair?.talk_room_id ?? null,
    };
  }

  const { error: updErr } = await serviceClient
    .from("match_pairs")
    .update({
      status: "blocked",
      blocked_by_user_id: blockerId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", pair.id);

  if (updErr) throw new MatchFunctionError("internal_error", updErr.message, 500);

  return {
    pair_id: pair.id,
    pair_status: "blocked",
    talk_room_id: pair.talk_room_id,
  };
}

export async function blockUserLive(
  req: Request,
  user: MatchAuthUser,
  input: BlockUserInput,
): Promise<BlockUserResult> {
  const blockerId = user.matchUserId;
  const blockedId = input.blocked_user_id;
  assertNotSelf(blockerId, blockedId, "blocked_user_id");

  const { client: userClient } = createUserClient(req);
  const serviceClient = createMatchServiceClient();

  if (input.blocked_profile_id) {
    await assertProfileBelongsToUser(serviceClient, String(input.blocked_profile_id), blockedId);
  }

  const source = normalizeBlockSource(input.reason, input.source);
  const existing = await findActiveBlock(userClient, blockerId, blockedId);

  let blockId = existing?.id ?? "";
  let created = false;

  if (existing && existing.block_status === "active" && !existing.archived_at) {
    // idempotent success
  } else if (existing) {
    const { data, error } = await userClient
      .from("match_blocks")
      .update({
        block_status: "active",
        archived_at: null,
        source: source ?? undefined,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select("id")
      .single();
    if (error) throw new MatchFunctionError("internal_error", error.message, 500);
    blockId = String(data.id);
    created = false;
  } else {
    const { data, error } = await userClient
      .from("match_blocks")
      .insert({
        blocker_user_id: blockerId,
        blocked_user_id: blockedId,
        source,
        block_status: "active",
      })
      .select("id")
      .single();

    if (error) {
      if (/duplicate|unique/i.test(error.message)) {
        const raced = await findActiveBlock(userClient, blockerId, blockedId);
        if (!raced) throw new MatchFunctionError("internal_error", error.message, 500);
        blockId = raced.id;
      } else {
        throw new MatchFunctionError("internal_error", error.message, 500);
      }
    } else {
      blockId = String(data.id);
      created = true;
    }
  }

  const pairSync = await syncPairBlocked(
    serviceClient,
    blockerId,
    blockedId,
    input.match_pair_id ? String(input.match_pair_id) : null,
  );

  const roomStatus = await cancelLinkedTalkRooms(
    serviceClient,
    pairSync.pair_id,
    pairSync.talk_room_id,
  );

  return {
    block_id: blockId,
    blocked: true,
    created,
    pair_status: pairSync.pair_status,
    room_status: roomStatus,
  };
}

export async function submitReportLive(
  req: Request,
  user: MatchAuthUser,
  input: SubmitReportInput,
): Promise<SubmitReportResult> {
  const reporterId = user.matchUserId;
  const reportedId = input.reported_user_id;
  assertNotSelf(reporterId, reportedId, "reported_user_id");

  if (!REPORT_REASONS.has(input.reason)) {
    throw new MatchFunctionError("validation_error", "Invalid report reason", 422);
  }

  const { client: userClient } = createUserClient(req);
  const serviceClient = createMatchServiceClient();

  if (input.reported_profile_id) {
    await assertProfileBelongsToUser(serviceClient, String(input.reported_profile_id), reportedId);
  }

  const contextType = normalizeReportContext(input.context_type);
  const detail = input.detail ? String(input.detail).trim() : null;

  const { data, error } = await userClient
    .from("match_reports")
    .insert({
      reporter_user_id: reporterId,
      reported_user_id: reportedId,
      reason: input.reason,
      detail: detail || null,
      context_type: contextType,
      context_id: input.reported_profile_id ? String(input.reported_profile_id) : null,
      status: "open",
    })
    .select("id, status")
    .single();

  if (error) throw new MatchFunctionError("internal_error", error.message, 500);

  return {
    report_id: String(data.id),
    status: String(data.status),
  };
}
