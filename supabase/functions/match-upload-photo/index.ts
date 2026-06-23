import {
  handleMatchError,
  handleOptions,
  MatchFunctionError,
  parseJsonBody,
  requirePost,
  requireUserAsync,
  validateString,
} from "../_shared/match-auth.ts";
import { requireMatchBetaAllowed } from "../_shared/match-beta.ts";
import {
  isLiveProfileEnabled,
  profileSuccess,
  uploadPhotoLive,
} from "../_shared/match-profile.ts";

type Body = {
  content_base64?: unknown;
  content_type?: unknown;
  is_main?: unknown;
  display_order?: unknown;
  profile_id?: unknown;
};

export async function handler(req: Request): Promise<Response> {
  const options = handleOptions(req);
  if (options) return options;

  try {
    requirePost(req);
    const user = await requireUserAsync(req);
    await requireMatchBetaAllowed(req, user);
    const body = await parseJsonBody<Body>(req);

    if (body.profile_id !== undefined && body.profile_id !== null && body.profile_id !== "") {
      throw new MatchFunctionError(
        "forbidden",
        "profile_id is not accepted; photos attach to JWT owner only",
        403,
      );
    }

    if (!isLiveProfileEnabled() || user.tokenMode === "stub") {
      return profileSuccess(req, user, {
        mode: "stub",
        photo_id: "stub-photo-id",
        storage_path: `${user.matchUserId}/stub-photo.jpg`,
        is_main: true,
        display_order: 0,
      });
    }

    const result = await uploadPhotoLive(req, user, {
      content_base64: validateString("content_base64", body.content_base64, { maxLength: 3_000_000 }),
      content_type: validateString("content_type", body.content_type, { maxLength: 32 }),
      is_main: body.is_main === true,
      display_order: body.display_order === undefined || body.display_order === null
        ? undefined
        : Number(body.display_order),
    });

    return profileSuccess(req, user, result);
  } catch (err) {
    return handleMatchError(err, req);
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
