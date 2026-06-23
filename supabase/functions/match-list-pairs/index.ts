import {
  handleMatchError,
  handleOptions,
  requirePost,
  requireUserAsync,
} from "../_shared/match-auth.ts";
import { requireMatchBetaAllowed } from "../_shared/match-beta.ts";
import { coreSuccess, isLiveCoreEnabled, listPairsLive } from "../_shared/match-core.ts";

export async function handler(req: Request): Promise<Response> {
  const options = handleOptions(req);
  if (options) return options;

  try {
    requirePost(req);
    const user = await requireUserAsync(req);
    await requireMatchBetaAllowed(req, user);

    if (!isLiveCoreEnabled() || user.tokenMode === "stub") {
      return coreSuccess(req, user, {
        mode: "stub",
        pairs: [],
      });
    }

    const pairs = await listPairsLive(req, user);
    return coreSuccess(req, user, { pairs });
  } catch (err) {
    return handleMatchError(err, req);
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
