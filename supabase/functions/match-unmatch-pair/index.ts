import {
  handleMatchError,
  handleOptions,
  jsonResponse,
  parseJsonBody,
  requirePost,
  requireUserAsync,
  validateString,
} from "../_shared/match-auth.ts";
import { requireMatchBetaAllowed } from "../_shared/match-beta.ts";
import {
  isLiveUnmatchEnabled,
  unmatchPairLive,
  unmatchSuccess,
} from "../_shared/match-unmatch.ts";

type UnmatchBody = {
  pair_id?: unknown;
};

export async function handler(req: Request): Promise<Response> {
  const options = handleOptions(req);
  if (options) return options;

  try {
    requirePost(req);
    const user = await requireUserAsync(req);
    await requireMatchBetaAllowed(req, user);
    const body = await parseJsonBody<UnmatchBody>(req);
    const pairId = validateString("pair_id", body.pair_id, { maxLength: 64 });

    if (!isLiveUnmatchEnabled() || user.tokenMode === "stub") {
      return jsonResponse(
        {
          ok: true,
          mode: "stub",
          pair_id: pairId,
          status: "unmatched",
          room_status: "cancelled",
          already_unmatched: false,
        },
        200,
        req,
      );
    }

    const result = await unmatchPairLive(req, user, pairId);
    return unmatchSuccess(req, user, {
      ...result,
      message: result.already_unmatched ? "既にマッチ解除済みです" : "マッチを解除しました",
    });
  } catch (err) {
    return handleMatchError(err, req);
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
