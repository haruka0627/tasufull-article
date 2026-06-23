import {
  handleMatchError,
  handleOptions,
  parseJsonBody,
  requirePost,
  requireUserAsync,
} from "../_shared/match-auth.ts";
import { createUserClient } from "../_shared/match-db.ts";
import {
  assertP15Enabled,
  clampLimit,
  p15Success,
  rpcFootprintLabel,
} from "../_shared/match-p15.ts";

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
      .from("match_profile_views")
      .select("viewer_user_id, source, viewed_at")
      .eq("viewed_user_id", user.matchUserId)
      .order("viewed_at", { ascending: false })
      .limit(limit);

    if (body.cursor && typeof body.cursor === "string" && body.cursor.trim()) {
      query = query.lt("viewed_at", body.cursor.trim());
    }

    const { data: views, error: viewErr } = await query;
    if (viewErr) throw viewErr;

    const viewerIds = (views ?? []).map((v) => v.viewer_user_id);
    /** @type {Record<string, object>} */
    const profileByUser = {};

    if (viewerIds.length) {
      const { data: profiles, error: profErr } = await client
        .from("match_profiles_public")
        .select("user_id, display_name, age, activity_label, prefecture")
        .in("user_id", viewerIds);
      if (profErr) throw profErr;
      for (const p of profiles ?? []) {
        profileByUser[p.user_id] = {
          display_name: p.display_name,
          age: p.age,
          activity_label: p.activity_label,
          prefecture: p.prefecture,
        };
      }
    }

    const items = [];
    for (const v of views ?? []) {
      const footprintLabel = await rpcFootprintLabel(client, v.viewed_at);
      items.push({
        viewer_user_id: v.viewer_user_id,
        footprint_label: footprintLabel,
        source: v.source,
        profile: profileByUser[v.viewer_user_id] ?? null,
      });
    }

    const nextCursor =
      (views ?? []).length >= limit
        ? (views ?? [])[(views ?? []).length - 1]?.viewed_at ?? null
        : null;

    return p15Success(req, user, { items, next_cursor: nextCursor });
  } catch (err) {
    return handleMatchError(err, req);
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
