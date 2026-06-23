import {
  handleMatchError,
  handleOptions,
  parseJsonBody,
  requirePost,
  requireUserAsync,
} from "../_shared/match-auth.ts";
import { requireMatchBetaAllowed } from "../_shared/match-beta.ts";
import {
  feedSuccess,
  isLiveFeedEnabled,
  parseSearchRequest,
  searchProfilesLive,
} from "../_shared/match-feed.ts";

type Body = Record<string, unknown>;

export async function handler(req: Request): Promise<Response> {
  const options = handleOptions(req);
  if (options) return options;

  try {
    requirePost(req);
    const user = await requireUserAsync(req);
    await requireMatchBetaAllowed(req, user);
    const body = await parseJsonBody<Body>(req);

    if (!isLiveFeedEnabled() || user.tokenMode === "stub") {
      return feedSuccess(req, user, {
        mode: "stub",
        items: [],
        total: 0,
        sort: "recommended",
        cursor: null,
        has_more: false,
      });
    }

    const parsed = parseSearchRequest(body);
    const result = await searchProfilesLive(req, user, parsed);
    return feedSuccess(req, user, result);
  } catch (err) {
    return handleMatchError(err, req);
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
