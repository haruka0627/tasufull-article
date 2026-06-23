import {
  handleMatchError,
  handleOptions,
  jsonResponse,
  parseJsonBody,
  requirePost,
  requireUserAsync,
  validateString,
  validateTextLength,
} from "../_shared/match-auth.ts";
import { requireMatchBetaAllowed } from "../_shared/match-beta.ts";
import {
  blockUserLive,
  isLiveSafetyEnabled,
  safetySuccess,
} from "../_shared/match-safety.ts";

type BlockBody = {
  blocked_user_id?: unknown;
  blocked_profile_id?: unknown;
  target_profile_id?: unknown;
  reason?: unknown;
  source?: unknown;
  match_pair_id?: unknown;
};

export async function handler(req: Request): Promise<Response> {
  const options = handleOptions(req);
  if (options) return options;

  try {
    requirePost(req);
    const user = await requireUserAsync(req);
    await requireMatchBetaAllowed(req, user);

    const body = await parseJsonBody<BlockBody>(req);
    const blockedUserId = validateString("blocked_user_id", body.blocked_user_id, {
      maxLength: 128,
    });
    validateTextLength("reason", body.reason, 500, { required: false });

    const profileRaw = body.blocked_profile_id ?? body.target_profile_id;
    const blockedProfileId = profileRaw === undefined || profileRaw === null
      ? null
      : validateString("blocked_profile_id", profileRaw, { maxLength: 64 });

    const sourceRaw = body.source === undefined || body.source === null
      ? null
      : validateString("source", body.source, { maxLength: 32 });
    validateTextLength("source", sourceRaw, 32, { required: false });

    const matchPairId = body.match_pair_id === undefined || body.match_pair_id === null
      ? null
      : validateString("match_pair_id", body.match_pair_id, { maxLength: 64 });

    if (blockedUserId === user.matchUserId) {
      return jsonResponse(
        { ok: false, code: "validation_error", message: "Cannot block yourself" },
        422,
        req,
      );
    }

    if (!isLiveSafetyEnabled() || user.tokenMode === "stub") {
      return jsonResponse(
        {
          ok: true,
          mode: "stub",
          blocked: true,
          pair_status: "blocked",
          room_status: "cancelled",
        },
        200,
        req,
      );
    }

    const reasonText = body.reason === undefined || body.reason === null
      ? null
      : String(body.reason);

    const result = await blockUserLive(req, user, {
      blocked_user_id: blockedUserId,
      blocked_profile_id: blockedProfileId,
      reason: reasonText,
      source: sourceRaw,
      match_pair_id: matchPairId,
    });

    return safetySuccess(req, user, {
      ...result,
      message: "ブロックしました",
    });
  } catch (err) {
    return handleMatchError(err, req);
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
