import {
  handleMatchError,
  handleOptions,
  jsonResponse,
  MatchFunctionError,
  parseJsonBody,
  requirePost,
  requireUserAsync,
  validateEnum,
  validateString,
} from "../_shared/match-auth.ts";
import { requireMatchBetaAllowed } from "../_shared/match-beta.ts";
import {
  coreSuccess,
  isLiveCoreEnabled,
  recordSwipeLive,
  type SwipeAction,
} from "../_shared/match-core.ts";

type SwipeBody = {
  target_user_id?: unknown;
  action?: unknown;
};

const ACTIONS = ["like", "skip", "super_like"] as const;

export async function handler(req: Request): Promise<Response> {
  const options = handleOptions(req);
  if (options) return options;

  try {
    requirePost(req);
    const user = await requireUserAsync(req);
    await requireMatchBetaAllowed(req, user);

    const body = await parseJsonBody<SwipeBody>(req);
    const targetUserId = validateString("target_user_id", body.target_user_id, { maxLength: 128 });
    const action = validateEnum("action", body.action, ACTIONS);

    if (action === "super_like") {
      throw new MatchFunctionError("phase_not_enabled", "super_like is not enabled in Phase 1", 422);
    }

    if (targetUserId === user.matchUserId) {
      throw new MatchFunctionError("validation_error", "Cannot swipe yourself", 422);
    }

    if (!isLiveCoreEnabled() || user.tokenMode === "stub") {
      return jsonResponse(
        {
          ok: true,
          mode: "stub",
          swipe_recorded: true,
          matched: false,
          pair_id: null,
        },
        200,
        req,
      );
    }

    const result = await recordSwipeLive(req, user, targetUserId, action as SwipeAction);
    return coreSuccess(req, user, result);
  } catch (err) {
    return handleMatchError(err, req);
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
