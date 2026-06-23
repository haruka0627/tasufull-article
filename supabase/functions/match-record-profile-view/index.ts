import {
  handleMatchError,
  handleOptions,
  parseJsonBody,
  requirePost,
  requireUserAsync,
  validateEnum,
  validateString,
} from "../_shared/match-auth.ts";
import { createUserClient } from "../_shared/match-db.ts";
import {
  assertNotBlocked,
  assertNotSelf,
  assertP15Enabled,
  jstDateString,
  p15Success,
  viewerFootprintsEnabled,
} from "../_shared/match-p15.ts";
import { upsertProfileView } from "../_shared/match-footprint.ts";

type Body = {
  viewed_user_id?: unknown;
  source?: unknown;
};

const SOURCES = ["swipe_card", "profile_detail", "favorites"] as const;

export async function handler(req: Request): Promise<Response> {
  const options = handleOptions(req);
  if (options) return options;

  try {
    assertP15Enabled(req);
    requirePost(req);
    const user = await requireUserAsync(req);
    const { client } = createUserClient(req);
    const body = await parseJsonBody<Body>(req);

    const viewedUserId = validateString("viewed_user_id", body.viewed_user_id, { maxLength: 128 });
    const source = body.source === undefined || body.source === ""
      ? "profile_detail"
      : validateEnum("source", body.source, SOURCES);

    assertNotSelf(user.matchUserId, viewedUserId, "viewed_user_id");
    await assertNotBlocked(client, user.matchUserId, viewedUserId);

    const footprintsEnabled = await viewerFootprintsEnabled(client, user.matchUserId);
    if (!footprintsEnabled) {
      return p15Success(req, user, {
        recorded: false,
        dedupe_bucket: jstDateString(),
      });
    }

    const dedupeBucket = jstDateString();
    await upsertProfileView({
      viewerUserId: user.matchUserId,
      viewedUserId,
      source,
      dedupeBucket,
    });

    return p15Success(req, user, {
      recorded: true,
      dedupe_bucket: dedupeBucket,
    });
  } catch (err) {
    return handleMatchError(err, req);
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
