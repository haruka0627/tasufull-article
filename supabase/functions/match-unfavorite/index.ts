import {
  handleMatchError,
  handleOptions,
  jsonResponse,
  parseJsonBody,
  requirePost,
  requireUserAsync,
  validateString,
  validateUuidLike,
} from "../_shared/match-auth.ts";
import { createUserClient } from "../_shared/match-db.ts";
import { assertP15Enabled, p15Success } from "../_shared/match-p15.ts";

type Body = {
  target_user_id?: unknown;
  favorite_id?: unknown;
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

    const favoriteIdRaw = body.favorite_id;
    const targetRaw = body.target_user_id;
    if (!favoriteIdRaw && !targetRaw) {
      return jsonResponse(
        { ok: false, code: "validation_error", message: "target_user_id or favorite_id is required" },
        422,
        req,
      );
    }

    let query = client
      .from("match_favorites")
      .update({ archived_at: new Date().toISOString() })
      .eq("owner_user_id", user.matchUserId)
      .is("archived_at", null);

    if (favoriteIdRaw) {
      const favoriteId = validateUuidLike("favorite_id", favoriteIdRaw);
      query = query.eq("id", favoriteId);
    } else {
      const targetUserId = validateString("target_user_id", targetRaw, { maxLength: 128 });
      query = query.eq("target_user_id", targetUserId);
    }

    const { data, error } = await query.select("id, target_user_id").maybeSingle();
    if (error) throw error;
    if (!data) {
      return jsonResponse(
        { ok: false, code: "not_found", message: "Favorite not found" },
        404,
        req,
      );
    }

    return p15Success(req, user, {
      unfavorited: true,
      target_user_id: data.target_user_id,
      favorite_id: data.id,
    });
  } catch (err) {
    return handleMatchError(err, req);
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
