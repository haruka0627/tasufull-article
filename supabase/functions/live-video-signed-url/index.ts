/**
 * TASFUL LIVE — long-form video signed URL (YouTube P1 Phase 2)
 *
 * POST { video_id: uuid }
 * → { video_signed_url, thumbnail_signed_url?, expires_in, video }
 */
import {
  assertVideoViewAccess,
  createServiceClient,
  handleLiveVideoError,
  handleOptions,
  jsonResponse,
  LiveVideoFunctionError,
  loadVideo,
  parseJsonBody,
  parseVideoId,
  requirePost,
  requireVerifiedUser,
} from "../_shared/live-video-auth.ts";

const SIGNED_URL_TTL_SEC = 300;
const VIDEO_BUCKET = "live-videos";
const THUMB_BUCKETS = ["live-thumbnails", "live-videos"] as const;

type RequestBody = {
  video_id?: unknown;
};

async function createThumbSignedUrl(
  supabase: ReturnType<typeof createServiceClient>,
  thumbPath: string,
): Promise<string | null> {
  const path = String(thumbPath || "").trim();
  if (!path) return null;

  for (const bucket of THUMB_BUCKETS) {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, SIGNED_URL_TTL_SEC);
    if (!error && data?.signedUrl) return data.signedUrl;
  }
  return null;
}

function videoMetadata(video: Awaited<ReturnType<typeof loadVideo>>) {
  if (!video) return null;
  return {
    id: video.id,
    talk_user_id: video.talk_user_id,
    title: video.title,
    description: video.description,
    duration_sec: video.duration_sec,
    status: video.status,
    visibility: video.visibility,
    views_count: video.views_count,
    likes_count: video.likes_count,
    published_at: video.published_at,
  };
}

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

    try {
      await assertVideoViewAccess(supabase, video, viewer);
    } catch (err) {
      if (
        err instanceof LiveVideoFunctionError &&
        err.status === 403 &&
        ["hidden", "removed"].includes(String(video.status || ""))
      ) {
        return jsonResponse({ error: "Video not found" }, 404, req);
      }
      return handleLiveVideoError(err, req);
    }

    const videoPath = String(video.video_path || "").trim();
    if (!videoPath) {
      return jsonResponse({ error: "video_path missing" }, 500, req);
    }

    const { data, error } = await supabase.storage
      .from(VIDEO_BUCKET)
      .createSignedUrl(videoPath, SIGNED_URL_TTL_SEC);

    if (error || !data?.signedUrl) {
      return jsonResponse(
        { error: "createSignedUrl failed", details: error?.message || "no signedUrl" },
        500,
        req,
      );
    }

    const thumbnailSignedUrl = await createThumbSignedUrl(supabase, String(video.thumbnail_path || ""));

    return jsonResponse(
      {
        ok: true,
        video_id: videoId,
        video_signed_url: data.signedUrl,
        thumbnail_signed_url: thumbnailSignedUrl,
        expires_in: SIGNED_URL_TTL_SEC,
        expires_at: data.expiresAt ?? null,
        video: videoMetadata(video),
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
