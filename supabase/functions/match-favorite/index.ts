import {
  handleMatchError,
  handleOptions,
  parseJsonBody,
  requirePost,
  requireUserAsync,
  validateEnum,
  validateString,
  validateTextLength,
} from "../_shared/match-auth.ts";
import { createUserClient } from "../_shared/match-db.ts";
import {
  assertNotBlocked,
  assertNotSelf,
  assertP15Enabled,
  p15Success,
} from "../_shared/match-p15.ts";

type Body = {
  target_user_id?: unknown;
  source?: unknown;
  note?: unknown;
};

const SOURCES = ["swipe", "profile", "search"] as const;

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
    const source = body.source === undefined || body.source === ""
      ? "profile"
      : validateEnum("source", body.source, SOURCES);
    validateTextLength("note", body.note, 200, { required: false });

    assertNotSelf(user.matchUserId, targetUserId);
    await assertNotBlocked(client, user.matchUserId, targetUserId);

    const { data: existing, error: findErr } = await client
      .from("match_favorites")
      .select("id, archived_at")
      .eq("owner_user_id", user.matchUserId)
      .eq("target_user_id", targetUserId)
      .maybeSingle();

    if (findErr) throw findErr;

    if (existing && !existing.archived_at) {
      return p15Success(req, user, {
        favorite_id: existing.id,
        created: false,
        target_user_id: targetUserId,
      });
    }

    if (existing?.archived_at) {
      const { data: revived, error: reviveErr } = await client
        .from("match_favorites")
        .update({
          archived_at: null,
          source,
          note: body.note ? String(body.note).trim() : null,
        })
        .eq("id", existing.id)
        .select("id")
        .single();
      if (reviveErr) throw reviveErr;
      return p15Success(req, user, {
        favorite_id: revived.id,
        created: true,
        target_user_id: targetUserId,
      });
    }

    const { data: inserted, error: insErr } = await client
      .from("match_favorites")
      .insert({
        owner_user_id: user.matchUserId,
        target_user_id: targetUserId,
        source,
        note: body.note ? String(body.note).trim() : null,
      })
      .select("id")
      .single();

    if (insErr) throw insErr;

    return p15Success(req, user, {
      favorite_id: inserted.id,
      created: true,
      target_user_id: targetUserId,
    });
  } catch (err) {
    return handleMatchError(err, req);
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
