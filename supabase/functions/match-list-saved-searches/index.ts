import {
  handleMatchError,
  handleOptions,
  parseJsonBody,
  requirePost,
  requireUserAsync,
} from "../_shared/match-auth.ts";
import { createUserClient } from "../_shared/match-db.ts";
import { assertP15Enabled, p15Success } from "../_shared/match-p15.ts";

type Body = {
  include_archived?: unknown;
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
    const includeArchived = Boolean(body.include_archived);

    let query = client
      .from("match_saved_searches")
      .select("id, name, filters_json, is_default, last_used_at, updated_at, archived_at")
      .eq("user_id", user.matchUserId)
      .order("updated_at", { ascending: false });

    if (!includeArchived) {
      query = query.is("archived_at", null);
    }

    const { data, error } = await query;
    if (error) throw error;

    const items = (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      filters_json: row.filters_json,
      is_default: row.is_default,
      last_used_at: row.last_used_at,
      updated_at: row.updated_at,
    }));

    return p15Success(req, user, { items });
  } catch (err) {
    return handleMatchError(err, req);
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
