import {
  authResponseFields,
  handleMatchError,
  handleOptions,
  jsonResponse,
  parseJsonBody,
  requirePost,
  requireUserAsync,
  validateUuidLike,
} from "../_shared/match-auth.ts";
import { requireMatchBetaAllowed } from "../_shared/match-beta.ts";
import { getMatchSupabaseEnv } from "../_shared/match-db.ts";
import { ensureTalkRoomForPair } from "../_shared/match-talk-room.ts";

type TalkRoomBody = {
  pair_id?: unknown;
};

function isLiveBridgeConfigured(): boolean {
  const env = getMatchSupabaseEnv();
  return Boolean(env.url && env.anonKey && env.serviceRoleKey);
}

export async function handler(req: Request): Promise<Response> {
  const options = handleOptions(req);
  if (options) return options;

  try {
    requirePost(req);
    const user = await requireUserAsync(req);
    await requireMatchBetaAllowed(req, user);

    const body = await parseJsonBody<TalkRoomBody>(req);
    const pairId = validateUuidLike("pair_id", body.pair_id);

    if (!isLiveBridgeConfigured() || user.tokenMode === "stub") {
      const roomId = "stub-room-id";
      return jsonResponse(
        {
          ok: true,
          mode: "stub",
          ...authResponseFields(user),
          room_id: roomId,
          redirect_url: `../chat-detail.html?room=${roomId}`,
          created: false,
          reused: true,
        },
        200,
        req,
      );
    }

    const result = await ensureTalkRoomForPair(req, user, pairId);

    return jsonResponse(
      {
        ok: true,
        mode: "live",
        auth_mode: "jwt",
        ...authResponseFields(user),
        room_id: result.room_id,
        redirect_url: result.redirect_url,
        created: result.created,
        reused: result.reused,
      },
      200,
      req,
    );
  } catch (err) {
    return handleMatchError(err, req);
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
