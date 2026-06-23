import {
  handleMatchError,
  handleOptions,
  parseJsonBody,
  requirePost,
  requireUserAsync,
} from "../_shared/match-auth.ts";
import { requireMatchBetaAllowed } from "../_shared/match-beta.ts";
import { createUserClient } from "../_shared/match-db.ts";
import { assertP15Enabled, p15Success } from "../_shared/match-p15.ts";

type Body = Record<string, never>;

export async function handler(req: Request): Promise<Response> {
  const options = handleOptions(req);
  if (options) return options;

  try {
    assertP15Enabled(req);
    requirePost(req);
    const user = await requireUserAsync(req);
    await requireMatchBetaAllowed(req, user);
    const { client } = createUserClient(req);
    try {
      await parseJsonBody<Body>(req);
    } catch {
      // empty body allowed
    }

    const { data, error } = await client.rpc("match_profile_completeness", {
      p_user_id: user.matchUserId,
    });
    if (error) throw error;

    const row = (data ?? {}) as Record<string, unknown>;

    return p15Success(req, user, {
      percent: row.percent ?? 0,
      done_count: row.done_count ?? 0,
      total_count: row.total_count ?? 8,
      items: row.items ?? [],
    });
  } catch (err) {
    return handleMatchError(err, req);
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
