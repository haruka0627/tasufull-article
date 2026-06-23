import {
  handleMatchError,
  handleOptions,
  jsonResponse,
  parseJsonBody,
  requirePost,
  requireUserAsync,
  validateUuidLike,
} from "../_shared/match-auth.ts";
import { createUserClient } from "../_shared/match-db.ts";
import { assertP15Enabled, p15Success } from "../_shared/match-p15.ts";

type Body = {
  id?: unknown;
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
    const searchId = validateUuidLike("id", body.id);

    const { data, error } = await client
      .from("match_saved_searches")
      .update({
        archived_at: new Date().toISOString(),
        is_default: false,
      })
      .eq("id", searchId)
      .eq("user_id", user.matchUserId)
      .is("archived_at", null)
      .select("id")
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return jsonResponse(
        { ok: false, code: "not_found", message: "Saved search not found" },
        404,
        req,
      );
    }

    return p15Success(req, user, { deleted: true, id: data.id });
  } catch (err) {
    return handleMatchError(err, req);
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
