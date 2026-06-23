import {
  handleMatchError,
  handleOptions,
  jsonResponse,
  parseJsonBody,
  requirePost,
  requireUserAsync,
  validateString,
} from "../_shared/match-auth.ts";
import { createUserClient } from "../_shared/match-db.ts";
import {
  assertNotSelf,
  assertP15Enabled,
  p15Success,
} from "../_shared/match-p15.ts";

type Body = {
  target_user_id?: unknown;
};

export async function handler(req: Request): Promise<Response> {
  const options = handleOptions(req);
  if (options) return options;

  try {
    assertP15Enabled(req);
    requirePost(req);
    const user = await requireUserAsync(req);
    const { client } = createUserClient(req);
    const body = await parseJsonBody<Body>(req);

    const targetUserId = validateString("target_user_id", body.target_user_id, { maxLength: 128 });
    assertNotSelf(user.matchUserId, targetUserId);

    const { data, error } = await client.rpc("match_compatibility_score", {
      p_viewer_user_id: user.matchUserId,
      p_target_user_id: targetUserId,
    });

    if (error) throw error;

    const row = data as Record<string, unknown> | null;
    const code = typeof row?.code === "string" ? row.code : null;

    if (code === "profile_not_found") {
      return jsonResponse(
        { ok: false, code: "profile_not_found", message: "Profile not found" },
        404,
        req,
      );
    }
    if (code === "blocked") {
      return jsonResponse({ ok: false, code: "blocked", message: "Users are blocked" }, 422, req);
    }
    if (code === "self") {
      return jsonResponse(
        { ok: false, code: "validation_error", message: "Cannot compare with yourself" },
        422,
        req,
      );
    }

    return p15Success(req, user, {
      percent: row?.percent ?? 0,
      score_raw: row?.score_raw ?? 0,
      common_points: row?.common_points ?? [],
      common_count: row?.common_count ?? 0,
    });
  } catch (err) {
    return handleMatchError(err, req);
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
