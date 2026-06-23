/**
 * TASFUL LIVE — long-form video view counter (YouTube P1 Phase 2)
 *
 * POST { video_id: uuid }
 * → { ok, views_count }
 */
import {
  assertVideoViewAccess,
  createServiceClient,
  handleLiveVideoError,
  handleOptions,
  jsonResponse,
  loadVideo,
  parseJsonBody,
  parseVideoId,
  requirePost,
  requireVerifiedUser,
} from "../_shared/live-video-auth.ts";

type RequestBody = {
  video_id?: unknown;
};

export async function handler(req: Request): Promise<Response> {
  const options = handleOptions(req);
  if (options) return options;

  try {
    requirePost(req);
    const viewer = await requireVerifiedUser(req);

    let body: RequestBody;
    try {
      body = await parseJsonBody<RequestBody>(req);
    } catch (err) {
      return handleLiveVideoError(err, req);
    }

    const videoId = parseVideoId(body.video_id);
    const supabase = createServiceClient();
    const video = await loadVideo(supabase, videoId);

    if (!video) {
      return jsonResponse({ error: "Video not found" }, 404, req);
    }

    if (video.status !== "published") {
      return jsonResponse({ error: "Video is not published", code: "not_published" }, 403, req);
    }

    try {
      await assertVideoViewAccess(supabase, video, viewer);
    } catch (err) {
      return handleLiveVideoError(err, req);
    }

    const { data, error } = await supabase.rpc("live_increment_video_views", {
      p_video_id: videoId,
    });

    if (error) {
      return jsonResponse(
        { error: "Failed to increment views", details: error.message },
        500,
        req,
      );
    }

    return jsonResponse(
      {
        ok: true,
        video_id: videoId,
        views_count: Number(data ?? 0),
      },
      200,
      req,
    );
  } catch (err) {
    return handleLiveVideoError(err, req);
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
