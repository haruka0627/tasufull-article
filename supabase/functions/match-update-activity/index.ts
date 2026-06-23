import {
  handleMatchError,
  handleOptions,
  parseJsonBody,
  requirePost,
  requireUserAsync,
} from "../_shared/match-auth.ts";
import { createUserClient } from "../_shared/match-db.ts";
import { assertP15Enabled, p15Success, rpcActivityLabel } from "../_shared/match-p15.ts";

type Body = Record<string, never>;

const DEBOUNCE_MS = 15 * 60 * 1000;

export async function handler(req: Request): Promise<Response> {
  const options = handleOptions(req);
  if (options) return options;

  try {
    assertP15Enabled(req);
    requirePost(req);
    const user = await requireUserAsync(req);
    const { client } = createUserClient(req);
    await parseJsonBody<Body>(req).catch(() => ({}));

    const { data: profile, error: readErr } = await client
      .from("match_profiles")
      .select("last_active_at")
      .eq("user_id", user.matchUserId)
      .is("archived_at", null)
      .maybeSingle();

    if (readErr) throw readErr;

    const previousAt = profile?.last_active_at ? String(profile.last_active_at) : null;
    const previousMs = previousAt ? new Date(previousAt).getTime() : 0;
    const now = new Date();
    const bumped = !previousMs || now.getTime() - previousMs >= DEBOUNCE_MS;

    let labelSource: string | null = previousAt;

    if (bumped) {
      const iso = now.toISOString();
      const { error: updErr } = await client
        .from("match_profiles")
        .update({ last_active_at: iso })
        .eq("user_id", user.matchUserId)
        .is("archived_at", null);
      if (updErr) throw updErr;
      labelSource = iso;
    }

    const activityLabel = await rpcActivityLabel(client, labelSource);

    return p15Success(req, user, {
      activity_label: activityLabel,
      bumped,
    });
  } catch (err) {
    return handleMatchError(err, req);
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
