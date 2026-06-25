/**
 * TASFUL LIVE — long-form video Edge auth (verified user JWT only)
 */
import { createClient, type SupabaseClient, type User } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { corsHeadersFor, handleOptions, jsonResponse } from "./cors.ts";

export { handleOptions, jsonResponse };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class LiveVideoFunctionError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "LiveVideoFunctionError";
    this.code = code;
    this.status = status;
  }
}

export type LiveVideoAuthUser = {
  talkUserId: string;
  isAdmin: boolean;
  user: User;
  token: string;
};

export function getBearerToken(req: Request): string {
  const auth = String(req.headers.get("Authorization") || "").trim();
  if (!auth.toLowerCase().startsWith("bearer ")) return "";
  return auth.slice(7).trim();
}

export function getSupabaseEnv() {
  const url = String(Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");
  const anonKey = String(Deno.env.get("SUPABASE_ANON_KEY") ?? "").trim();
  const serviceRoleKey = String(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();
  return { url, anonKey, serviceRoleKey };
}

export function createServiceClient(): SupabaseClient {
  const { url, serviceRoleKey } = getSupabaseEnv();
  if (!url || !serviceRoleKey) {
    throw new LiveVideoFunctionError(
      "internal_error",
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
      500,
    );
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function pickString(...values: unknown[]): string {
  for (const v of values) {
    const s = String(v ?? "").trim();
    if (s) return s;
  }
  return "";
}

export function readTalkUserIdFromUser(user: User): string {
  const appMeta =
    user.app_metadata && typeof user.app_metadata === "object" && !Array.isArray(user.app_metadata)
      ? (user.app_metadata as Record<string, unknown>)
      : {};
  return pickString(appMeta.talk_user_id, appMeta.member_id, user.user_metadata?.talk_user_id);
}

export function isAdminUser(user: User): boolean {
  const appMeta =
    user.app_metadata && typeof user.app_metadata === "object" && !Array.isArray(user.app_metadata)
      ? (user.app_metadata as Record<string, unknown>)
      : {};
  const role = pickString(appMeta.role, appMeta.platform_role).toLowerCase();
  const isOps = appMeta.is_ops === true || String(appMeta.is_ops ?? "").toLowerCase() === "true";
  return role === "tasu_admin" || role === "match_admin" || isOps;
}

function isPrivilegedKey(token: string, anonKey: string, serviceRoleKey: string): boolean {
  const t = String(token || "").trim();
  if (!t) return true;
  if (anonKey && t === anonKey) return true;
  if (serviceRoleKey && t === serviceRoleKey) return true;
  return false;
}

export async function requireVerifiedUser(req: Request): Promise<LiveVideoAuthUser> {
  const token = getBearerToken(req);
  if (!token) {
    throw new LiveVideoFunctionError("unauthorized", "Authorization header required", 401);
  }

  const { url, anonKey, serviceRoleKey } = getSupabaseEnv();
  if (!url || !anonKey) {
    throw new LiveVideoFunctionError(
      "internal_error",
      "Missing SUPABASE_URL or SUPABASE_ANON_KEY",
      500,
    );
  }

  if (isPrivilegedKey(token, anonKey, serviceRoleKey)) {
    throw new LiveVideoFunctionError("unauthorized", "Valid user JWT required", 401);
  }

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await userClient.auth.getUser();
  if (error || !data?.user) {
    throw new LiveVideoFunctionError("unauthorized", "Invalid or expired JWT", 401);
  }

  const talkUserId = readTalkUserIdFromUser(data.user);
  if (!talkUserId) {
    throw new LiveVideoFunctionError("forbidden", "JWT talk_user_id claim required", 403);
  }

  return {
    talkUserId,
    isAdmin: isAdminUser(data.user),
    user: data.user,
    token,
  };
}

export async function requireVerifiedAdmin(req: Request): Promise<LiveVideoAuthUser> {
  const auth = await requireVerifiedUser(req);
  if (!auth.isAdmin) {
    throw new LiveVideoFunctionError("forbidden", "Admin access required", 403);
  }
  return auth;
}

/** JWT optional — returns null for anon/service key without user */
export async function optionalVerifiedUser(req: Request): Promise<LiveVideoAuthUser | null> {
  const token = getBearerToken(req);
  if (!token) return null;

  const { url, anonKey, serviceRoleKey } = getSupabaseEnv();
  if (!url || !anonKey) return null;
  if (isPrivilegedKey(token, anonKey, serviceRoleKey)) return null;

  const userClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data, error } = await userClient.auth.getUser();
  if (error || !data?.user) return null;

  const talkUserId = readTalkUserIdFromUser(data.user);
  if (!talkUserId) return null;

  return {
    talkUserId,
    isAdmin: isAdminUser(data.user),
    user: data.user,
    token,
  };
}

export function requirePost(req: Request): void {
  if (req.method !== "POST") {
    throw new LiveVideoFunctionError("method_not_allowed", "Method Not Allowed", 405);
  }
}

export async function parseJsonBody<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new LiveVideoFunctionError("invalid_json", "Invalid JSON body", 400);
  }
}

export function parseVideoId(raw: unknown): string {
  const videoId = String(raw ?? "").trim();
  if (!videoId) {
    throw new LiveVideoFunctionError("invalid_request", "video_id is required", 400);
  }
  if (!UUID_RE.test(videoId)) {
    throw new LiveVideoFunctionError("invalid_request", "video_id must be a valid uuid", 400);
  }
  return videoId;
}

export type LiveVideoRow = {
  id: string;
  talk_user_id: string;
  creator_profile_id: string | null;
  title: string;
  description: string | null;
  video_path: string;
  thumbnail_path: string | null;
  duration_sec: number | null;
  file_size_bytes: number | null;
  mime_type: string | null;
  status: string;
  visibility: string;
  views_count: number;
  likes_count: number;
  reports_count: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function loadVideo(
  supabase: SupabaseClient,
  videoId: string,
): Promise<LiveVideoRow | null> {
  const { data, error } = await supabase
    .from("live_videos")
    .select(
      "id, talk_user_id, creator_profile_id, title, description, video_path, thumbnail_path, duration_sec, file_size_bytes, mime_type, status, visibility, views_count, likes_count, reports_count, published_at, created_at, updated_at",
    )
    .eq("id", videoId)
    .maybeSingle();

  if (error) {
    throw new LiveVideoFunctionError("internal_error", "Failed to load video", 500);
  }
  return (data as LiveVideoRow | null) ?? null;
}

export async function isPublicCreator(
  supabase: SupabaseClient,
  talkUserId: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("live_is_public_creator", {
    p_user_id: talkUserId,
  });
  if (error) {
    console.warn("[live-video] live_is_public_creator failed", error.message);
    return false;
  }
  return Boolean(data);
}

const RESTRICTED_STATUSES = new Set(["draft", "processing", "hidden", "removed"]);

/** Anonymous / anon-JWT playback — published public or unlisted from a public creator */
export async function assertPublicVideoViewAccess(
  supabase: SupabaseClient,
  video: LiveVideoRow,
): Promise<void> {
  if (RESTRICTED_STATUSES.has(String(video.status || ""))) {
    throw new LiveVideoFunctionError("forbidden", "Video is not available for playback", 403);
  }

  if (video.status !== "published") {
    throw new LiveVideoFunctionError("forbidden", "Video is not available for playback", 403);
  }

  if (video.visibility === "private") {
    throw new LiveVideoFunctionError("forbidden", "Video is not available for playback", 403);
  }

  if (!(await isPublicCreator(supabase, video.talk_user_id))) {
    throw new LiveVideoFunctionError("forbidden", "Video is not available for playback", 403);
  }
}

export async function assertVideoViewAccess(
  supabase: SupabaseClient,
  video: LiveVideoRow,
  viewer: LiveVideoAuthUser,
): Promise<void> {
  const isOwner = video.talk_user_id === viewer.talkUserId;
  if (viewer.isAdmin || isOwner) return;

  await assertPublicVideoViewAccess(supabase, video);
}

export function handleLiveVideoError(err: unknown, req?: Request): Response {
  if (err instanceof LiveVideoFunctionError) {
    return jsonResponse({ error: err.message, code: err.code }, err.status, req);
  }
  const message = err instanceof Error ? err.message : String(err);
  console.error("[live-video]", message);
  return jsonResponse({ error: message }, 500, req);
}
