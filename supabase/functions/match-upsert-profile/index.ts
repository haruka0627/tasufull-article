import {
  handleMatchError,
  handleOptions,
  MatchFunctionError,
  parseJsonBody,
  requirePost,
  requireUserAsync,
} from "../_shared/match-auth.ts";
import { requireMatchBetaAllowed } from "../_shared/match-beta.ts";
import {
  isLiveProfileEnabled,
  parseUpsertProfileBody,
  profileSuccess,
  upsertProfileLive,
} from "../_shared/match-profile.ts";

type Body = Record<string, unknown>;

export async function handler(req: Request): Promise<Response> {
  const options = handleOptions(req);
  if (options) return options;

  try {
    requirePost(req);
    const user = await requireUserAsync(req);
    await requireMatchBetaAllowed(req, user);
    const body = await parseJsonBody<Body>(req);

    if (body.profile_id !== undefined || body.user_id !== undefined) {
      const foreignUser = String(body.user_id ?? "").trim();
      const foreignProfile = String(body.profile_id ?? "").trim();
      if (foreignUser && foreignUser !== user.matchUserId) {
        throw new MatchFunctionError("forbidden", "Cannot modify another user's profile", 403);
      }
      if (foreignProfile) {
        throw new MatchFunctionError("forbidden", "profile_id cannot be set by client", 403);
      }
    }

    if (!isLiveProfileEnabled() || user.tokenMode === "stub") {
      return profileSuccess(req, user, {
        mode: "stub",
        profile_id: "stub-profile-id",
        created: true,
        profile_status: "active",
        completion_score: 72,
        public_profile: null,
      });
    }

    const input = parseUpsertProfileBody(body);
    const result = await upsertProfileLive(req, user, input);
    return profileSuccess(req, user, result);
  } catch (err) {
    return handleMatchError(err, req);
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
