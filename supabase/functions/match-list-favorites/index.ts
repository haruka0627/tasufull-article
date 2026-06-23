import {
  handleMatchError,
  handleOptions,
  parseJsonBody,
  requirePost,
  requireUserAsync,
} from "../_shared/match-auth.ts";
import { createUserClient } from "../_shared/match-db.ts";
import { assertP15Enabled, clampLimit, p15Success } from "../_shared/match-p15.ts";

type Body = {
  limit?: unknown;
  cursor?: unknown;
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
    const limit = clampLimit(body.limit);

    let query = client
      .from("match_favorites")
      .select("id, target_user_id, source, created_at")
      .eq("owner_user_id", user.matchUserId)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (body.cursor && typeof body.cursor === "string" && body.cursor.trim()) {
      query = query.lt("created_at", body.cursor.trim());
    }

    const { data: favorites, error: favErr } = await query;
    if (favErr) throw favErr;

    const targetIds = (favorites ?? []).map((f) => f.target_user_id);
    /** @type {Record<string, object>} */
    const profileByUser = {};

    if (targetIds.length) {
      const { data: profiles, error: profErr } = await client
        .from("match_profiles_public")
        .select(
          "user_id, profile_id, display_name, age, prefecture, activity_label, main_photo_url",
        )
        .in("user_id", targetIds);
      if (profErr) throw profErr;
      for (const p of profiles ?? []) {
        profileByUser[p.user_id] = {
          profile_id: p.profile_id,
          display_name: p.display_name,
          age: p.age,
          prefecture: p.prefecture,
          activity_label: p.activity_label,
          main_photo_url: p.main_photo_url,
        };
      }
    }

    const items = (favorites ?? []).map((f) => ({
      favorite_id: f.id,
      target_user_id: f.target_user_id,
      source: f.source,
      created_at: f.created_at,
      profile: profileByUser[f.target_user_id] ?? null,
    }));

    const nextCursor =
      items.length >= limit ? items[items.length - 1]?.created_at ?? null : null;

    return p15Success(req, user, { items, next_cursor: nextCursor });
  } catch (err) {
    return handleMatchError(err, req);
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
