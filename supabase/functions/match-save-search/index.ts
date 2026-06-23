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
  id?: unknown;
  name?: unknown;
  filters_json?: unknown;
  is_default?: unknown;
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

    const name = validateString("name", body.name, { maxLength: 40 });
    const isDefault = Boolean(body.is_default);
    const filters =
      body.filters_json === undefined || body.filters_json === null
        ? {}
        : body.filters_json;

    if (typeof filters !== "object" || Array.isArray(filters)) {
      return jsonResponse(
        { ok: false, code: "validation_error", message: "filters_json must be an object" },
        422,
        req,
      );
    }

    if (isDefault) {
      const { error: clearErr } = await client
        .from("match_saved_searches")
        .update({ is_default: false })
        .eq("user_id", user.matchUserId)
        .is("archived_at", null);
      if (clearErr) throw clearErr;
    }

    const idRaw = body.id;
    if (idRaw) {
      const searchId = validateUuidLike("id", idRaw);
      const { data: updated, error: updErr } = await client
        .from("match_saved_searches")
        .update({
          name,
          filters_json: filters,
          is_default: isDefault,
          updated_at: new Date().toISOString(),
        })
        .eq("id", searchId)
        .eq("user_id", user.matchUserId)
        .is("archived_at", null)
        .select("id")
        .maybeSingle();
      if (updErr) throw updErr;
      if (!updated) {
        return jsonResponse({ ok: false, code: "not_found", message: "Saved search not found" }, 404, req);
      }
      return p15Success(req, user, { search_id: updated.id, updated: true });
    }

    const { data: inserted, error: insErr } = await client
      .from("match_saved_searches")
      .insert({
        user_id: user.matchUserId,
        name,
        filters_json: filters,
        is_default: isDefault,
      })
      .select("id")
      .single();
    if (insErr) throw insErr;

    return p15Success(req, user, { search_id: inserted.id, updated: false });
  } catch (err) {
    return handleMatchError(err, req);
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
