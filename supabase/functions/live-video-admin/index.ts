/**
 * TASFUL LIVE — long-form video admin (YouTube P1 Phase 2)
 *
 * POST { action, ... }
 *   list   — status / visibility / q / limit / offset
 *   hide   — video_id → status=hidden
 *   restore — video_id → status=published
 *   remove — video_id → status=removed
 *
 * TODO: live_moderation_logs content_type is limited to live_short | live_broadcast_chat | live_profile.
 *       Audit rows for live_video require a follow-up migration to extend the CHECK constraint.
 */
import {
  createServiceClient,
  handleLiveVideoError,
  handleOptions,
  jsonResponse,
  LiveVideoFunctionError,
  loadVideo,
  parseJsonBody,
  parseVideoId,
  requirePost,
  requireVerifiedAdmin,
  type LiveVideoRow,
} from "../_shared/live-video-auth.ts";

const ADMIN_ACTIONS = new Set(["list", "hide", "restore", "remove"]);

type RequestBody = {
  action?: unknown;
  video_id?: unknown;
  status?: unknown;
  visibility?: unknown;
  q?: unknown;
  limit?: unknown;
  offset?: unknown;
};

function parseLimit(raw: unknown, fallback = 50): number {
  const n = Number(raw ?? fallback);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(100, Math.max(1, Math.floor(n)));
}

function parseOffset(raw: unknown): number {
  const n = Number(raw ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

function parseAction(raw: unknown): string {
  const action = String(raw ?? "").trim().toLowerCase();
  if (!action || !ADMIN_ACTIONS.has(action)) {
    throw new LiveVideoFunctionError(
      "invalid_request",
      "action must be one of: list, hide, restore, remove",
      400,
    );
  }
  return action;
}

function summarizeVideo(row: LiveVideoRow) {
  return {
    id: row.id,
    talk_user_id: row.talk_user_id,
    title: row.title,
    status: row.status,
    visibility: row.visibility,
    views_count: row.views_count,
    likes_count: row.likes_count,
    reports_count: row.reports_count,
    published_at: row.published_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function handleList(
  supabase: ReturnType<typeof createServiceClient>,
  body: RequestBody,
  req: Request,
): Promise<Response> {
  const status = String(body.status ?? "").trim();
  const visibility = String(body.visibility ?? "").trim();
  const q = String(body.q ?? "").trim();
  const limit = parseLimit(body.limit);
  const offset = parseOffset(body.offset);

  let query = supabase
    .from("live_videos")
    .select(
      "id, talk_user_id, title, status, visibility, views_count, likes_count, reports_count, published_at, created_at, updated_at",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq("status", status);
  if (visibility) query = query.eq("visibility", visibility);
  if (q) {
    const safe = q.replace(/[%_,]/g, "").trim();
    if (safe) {
      query = query.ilike("title", `%${safe}%`);
    }
  }

  const { data, error, count } = await query;
  if (error) {
    return jsonResponse({ error: "Failed to list videos", details: error.message }, 500, req);
  }

  return jsonResponse(
    {
      ok: true,
      action: "list",
      items: (data || []).map((row) => summarizeVideo(row as LiveVideoRow)),
      count: count ?? 0,
      limit,
      offset,
    },
    200,
    req,
  );
}

async function handleStatusUpdate(
  supabase: ReturnType<typeof createServiceClient>,
  videoId: string,
  status: string,
  req: Request,
  action: string,
): Promise<Response> {
  const existing = await loadVideo(supabase, videoId);
  if (!existing) {
    return jsonResponse({ error: "Video not found" }, 404, req);
  }

  const patch: Record<string, unknown> = { status };
  if (status === "published" && !existing.published_at) {
    patch.published_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("live_videos")
    .update(patch)
    .eq("id", videoId)
    .select(
      "id, talk_user_id, title, status, visibility, views_count, likes_count, reports_count, published_at, created_at, updated_at",
    )
    .maybeSingle();

  if (error || !data) {
    return jsonResponse(
      { error: "Failed to update video", details: error?.message || "update failed" },
      500,
      req,
    );
  }

  return jsonResponse(
    {
      ok: true,
      action,
      video: summarizeVideo(data as LiveVideoRow),
    },
    200,
    req,
  );
}

export async function handler(req: Request): Promise<Response> {
  const options = handleOptions(req);
  if (options) return options;

  try {
    requirePost(req);
    await requireVerifiedAdmin(req);

    let body: RequestBody;
    try {
      body = await parseJsonBody<RequestBody>(req);
    } catch (err) {
      return handleLiveVideoError(err, req);
    }

    const action = parseAction(body.action);
    const supabase = createServiceClient();

    if (action === "list") {
      return await handleList(supabase, body, req);
    }

    const videoId = parseVideoId(body.video_id);
    if (action === "hide") {
      return await handleStatusUpdate(supabase, videoId, "hidden", req, action);
    }
    if (action === "restore") {
      return await handleStatusUpdate(supabase, videoId, "published", req, action);
    }
    return await handleStatusUpdate(supabase, videoId, "removed", req, action);
  } catch (err) {
    return handleLiveVideoError(err, req);
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
