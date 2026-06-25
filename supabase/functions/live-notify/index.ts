/**
 * TASFUL LIVE — 通知 fanout（Phase 7）
 *
 * POST { event, payload }
 *   follow_created | tip_created | comment_created | live_started | video_published | system | broadcast_started | like_changed
 *
 * talk_notifications へ type=live を service_role で INSERT。
 * live_notify_dedupe で重複防止。
 */
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import {
  getBearerToken,
  requireTalkUser,
  TalkRoomFunctionError,
} from "../_shared/talk-room-auth.ts";

const NOTIFY_TYPE = "live";
const NOTIFY_SOURCE = "tasful_live";
const BROADCAST_FANOUT_MAX = 50;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type EventName =
  | "follow_created"
  | "comment_created"
  | "live_started"
  | "video_published"
  | "system"
  | "tip_created"
  | "broadcast_started"
  | "like_changed";

type RequestBody = {
  event?: unknown;
  payload?: Record<string, unknown>;
};

function createServiceClient(): SupabaseClient {
  const supabaseUrl = String(Deno.env.get("SUPABASE_URL") ?? "").trim();
  const serviceKey = String(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();
  if (!supabaseUrl || !serviceKey) {
    throw Object.assign(new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"), { status: 500 });
  }
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function parseEvent(raw: unknown): EventName {
  const event = String(raw ?? "").trim() as EventName;
  if (
    event === "follow_created" ||
    event === "comment_created" ||
    event === "live_started" ||
    event === "video_published" ||
    event === "system" ||
    event === "tip_created" ||
    event === "broadcast_started" ||
    event === "like_changed"
  ) {
    return event;
  }
  throw new TalkRoomFunctionError("invalid_request", "event is invalid", 400);
}

function buildPayload(extra: Record<string, unknown>) {
  return {
    service_type: "live",
    ...extra,
  };
}

function formatBody(displayText: string, payload: Record<string, unknown>) {
  return `${displayText}\n${JSON.stringify(payload)}`;
}

function notifyIdFromKey(eventKey: string) {
  const safe = eventKey.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 100);
  return `live-n-${safe}`;
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message?: unknown }).message || err);
  }
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

async function tryDedupe(supabase: SupabaseClient, eventKey: string): Promise<boolean> {
  const { error } = await supabase.from("live_notify_dedupe").insert({ event_key: eventKey });
  if (!error) return true;
  const code = String((error as { code?: string }).code || "");
  const msg = String(error.message || "");
  if (code === "23505" || msg.includes("duplicate key")) return false;
  throw error;
}

async function insertNotification(
  supabase: SupabaseClient,
  opts: { id: string; userId: string; title: string; body: string; targetUrl: string; priority?: string },
) {
  const priority = String(opts.priority || "normal").trim().toLowerCase();
  const normalizedPriority = priority === "high" || priority === "important" || priority === "urgent" ? "high" : "normal";
  const { error } = await supabase.from("talk_notifications").insert({
    id: opts.id,
    user_id: opts.userId,
    type: NOTIFY_TYPE,
    title: opts.title,
    body: opts.body,
    target_url: opts.targetUrl,
    source: NOTIFY_SOURCE,
    priority: normalizedPriority,
  });
  if (error) {
    const code = String((error as { code?: string }).code || "");
    const msg = String(error.message || "");
    if (code === "23505" || msg.includes("duplicate key")) return;
    throw new Error(msg || "talk_notifications insert failed");
  }
}

async function handleFollowCreated(
  supabase: SupabaseClient,
  actorId: string,
  payload: Record<string, unknown>,
) {
  const creatorId = String(payload.creator_id || "").trim();
  const followerId = String(payload.follower_id || actorId).trim();
  if (!creatorId || !followerId) {
    throw new TalkRoomFunctionError("invalid_request", "creator_id and follower_id required", 400);
  }
  if (actorId !== followerId) {
    throw new TalkRoomFunctionError("forbidden", "actor must be follower", 403);
  }

  const { error: countErr } = await supabase.rpc("live_refresh_creator_follower_count", {
    p_creator_id: creatorId,
  });
  if (countErr) throw new Error(countErr.message || "follower_count refresh failed");

  const eventKey = `follow_created:${creatorId}:${followerId}`;
  const isNew = await tryDedupe(supabase, eventKey);
  if (!isNew) return { ok: true, deduped: true, event: "follow_created" };

  const followerName = String(payload.follower_name || followerId).trim();
  const followerAvatar = String(payload.follower_avatar || "").trim();
  const notifyPayload = buildPayload({
    service_ref_id: creatorId,
    event: "follow_created",
    type: "follow",
    actor_id: followerId,
    actor_name: followerName,
    actor_avatar: followerAvatar,
    target_user_id: creatorId,
  });

  await insertNotification(supabase, {
    id: notifyIdFromKey(eventKey),
    userId: creatorId,
    title: "新しいフォロワー",
    body: formatBody(`${followerName}さんがあなたをフォローしました`, notifyPayload),
    targetUrl: `live/profile.html?userId=${encodeURIComponent(followerId)}`,
  });

  return { ok: true, notified: true, event: "follow_created" };
}

async function handleCommentCreated(
  supabase: SupabaseClient,
  actorId: string,
  payload: Record<string, unknown>,
) {
  const videoId = String(payload.video_id || "").trim();
  const commentId = String(payload.comment_id || "").trim();
  if (!videoId || !UUID_RE.test(videoId)) {
    throw new TalkRoomFunctionError("invalid_request", "video_id uuid required", 400);
  }
  if (!commentId) {
    throw new TalkRoomFunctionError("invalid_request", "comment_id required", 400);
  }

  const { data: video, error: videoErr } = await supabase
    .from("live_videos")
    .select("id, talk_user_id")
    .eq("id", videoId)
    .maybeSingle();

  if (videoErr) throw new Error(videoErr.message || "video lookup failed");
  if (!video) throw new TalkRoomFunctionError("not_found", "video not found", 404);

  const creatorId = String(payload.creator_id || video.talk_user_id || "").trim();
  if (!creatorId) {
    throw new TalkRoomFunctionError("invalid_request", "creator_id required", 400);
  }
  if (actorId === creatorId) {
    return { ok: true, skipped: true, reason: "self_comment", event: "comment_created" };
  }

  const eventKey = `comment_created:${videoId}:${commentId}:${actorId}`;
  const isNew = await tryDedupe(supabase, eventKey);
  if (!isNew) return { ok: true, deduped: true, event: "comment_created" };

  const actorName = String(payload.actor_name || actorId).trim();
  const notifyPayload = buildPayload({
    service_ref_id: videoId,
    event: "comment_created",
    type: "comment",
    actor_id: actorId,
    actor_name: actorName,
    video_id: videoId,
    comment_id: commentId,
    target_user_id: creatorId,
  });

  await insertNotification(supabase, {
    id: notifyIdFromKey(eventKey),
    userId: creatorId,
    title: "新しいコメント",
    body: formatBody(`${actorName}さんがあなたの動画にコメントしました`, notifyPayload),
    targetUrl: `live/watch-video.html?id=${encodeURIComponent(videoId)}`,
  });

  return { ok: true, notified: true, event: "comment_created" };
}

async function handleTipCreated(
  supabase: SupabaseClient,
  actorId: string,
  payload: Record<string, unknown>,
) {
  const tipId = String(payload.tip_id || "").trim();
  const creatorId = String(payload.creator_id || "").trim();
  if (!tipId || !UUID_RE.test(tipId)) {
    throw new TalkRoomFunctionError("invalid_request", "tip_id uuid required", 400);
  }

  const { data: tip, error: tipErr } = await supabase
    .from("live_tips")
    .select("id, tipper_id, creator_id, target_type, target_id, amount_yen, message")
    .eq("id", tipId)
    .maybeSingle();

  if (tipErr) {
    throw Object.assign(new Error(tipErr.message), { status: 500 });
  }
  if (!tip) {
    throw new TalkRoomFunctionError("not_found", "tip not found", 404);
  }
  if (String(tip.tipper_id) !== actorId) {
    throw new TalkRoomFunctionError("forbidden", "actor must be tipper", 403);
  }

  const resolvedCreator = creatorId || String(tip.creator_id || "");
  if (resolvedCreator && resolvedCreator !== String(tip.creator_id)) {
    throw new TalkRoomFunctionError("invalid_request", "creator_id mismatch", 400);
  }

  if (String(tip.target_type) === "broadcast" && tip.target_id) {
    const { error: tipCountErr } = await supabase.rpc("live_refresh_broadcast_tip_total_stub", {
      p_broadcast_id: tip.target_id,
    });
    if (tipCountErr) throw new Error(tipCountErr.message || "tip_total refresh failed");
  }

  const eventKey = `tip_created:${tipId}`;
  const isNew = await tryDedupe(supabase, eventKey);
  if (!isNew) return { ok: true, deduped: true, event: "tip_created" };

  const tipperName = String(payload.tipper_name || actorId).trim();
  const amount = Number(tip.amount_yen || 0);
  const notifyPayload = buildPayload({
    service_ref_id: String(tip.target_id || tip.id),
    event: "tip_created",
    actor_id: actorId,
    tip_id: tipId,
    amount_yen: amount,
  });

  await insertNotification(supabase, {
    id: notifyIdFromKey(eventKey),
    userId: String(tip.creator_id),
    title: "応援ギフトが届きました",
    body: formatBody(`${tipperName} から ¥${amount.toLocaleString("ja-JP")} の応援`, notifyPayload),
    targetUrl: `live/tips.html`,
  });

  return { ok: true, notified: true, event: "tip_created" };
}

async function handleBroadcastStarted(
  supabase: SupabaseClient,
  actorId: string,
  payload: Record<string, unknown>,
) {
  const broadcastId = String(payload.broadcast_id || "").trim();
  if (!broadcastId || !UUID_RE.test(broadcastId)) {
    throw new TalkRoomFunctionError("invalid_request", "broadcast_id uuid required", 400);
  }

  const { data: broadcast, error: bcErr } = await supabase
    .from("live_broadcasts")
    .select("id, creator_id, title, status")
    .eq("id", broadcastId)
    .maybeSingle();

  if (bcErr) {
    throw Object.assign(new Error(bcErr.message), { status: 500 });
  }
  if (!broadcast) {
    throw new TalkRoomFunctionError("not_found", "broadcast not found", 404);
  }
  if (String(broadcast.creator_id) !== actorId) {
    throw new TalkRoomFunctionError("forbidden", "actor must be broadcast creator", 403);
  }

  const globalKey = `broadcast_started:${broadcastId}`;
  const globalNew = await tryDedupe(supabase, globalKey);
  if (!globalNew) {
    return { ok: true, deduped: true, event: "broadcast_started", fanout: 0 };
  }

  const { data: followers, error: folErr } = await supabase
    .from("live_creator_follows")
    .select("follower_id")
    .eq("creator_id", actorId)
    .eq("notify_enabled", true)
    .limit(BROADCAST_FANOUT_MAX);

  if (folErr) {
    throw Object.assign(new Error(folErr.message), { status: 500 });
  }

  const creatorName = String(payload.creator_name || actorId).trim();
  const title = String(broadcast.title || "ライブ配信").trim();
  let fanout = 0;

  for (const row of followers || []) {
    const followerId = String(row.follower_id || "").trim();
    if (!followerId || followerId === actorId) continue;

    const perKey = `broadcast_started:${broadcastId}:${followerId}`;
    const isNew = await tryDedupe(supabase, perKey);
    if (!isNew) continue;

    const notifyPayload = buildPayload({
      service_ref_id: broadcastId,
      event: "broadcast_started",
      actor_id: actorId,
      broadcast_id: broadcastId,
    });

    await insertNotification(supabase, {
      id: notifyIdFromKey(perKey),
      userId: followerId,
      title: "ライブ配信が始まりました",
      body: formatBody(`${creatorName} が「${title}」を配信開始`, notifyPayload),
      targetUrl: `live/watch.html?broadcast_id=${encodeURIComponent(broadcastId)}`,
    });
    fanout += 1;
  }

  return { ok: true, notified: true, event: "broadcast_started", fanout, fanout_cap: BROADCAST_FANOUT_MAX };
}

async function handleLiveStarted(
  supabase: SupabaseClient,
  actorId: string,
  payload: Record<string, unknown>,
) {
  const broadcastId = String(payload.broadcast_id || payload.live_id || "").trim();
  if (!broadcastId || !UUID_RE.test(broadcastId)) {
    throw new TalkRoomFunctionError("invalid_request", "broadcast_id uuid required", 400);
  }

  const { data: broadcast, error: bcErr } = await supabase
    .from("live_broadcasts")
    .select("id, creator_id, title, status")
    .eq("id", broadcastId)
    .maybeSingle();

  if (bcErr) {
    throw Object.assign(new Error(bcErr.message), { status: 500 });
  }
  if (!broadcast) {
    throw new TalkRoomFunctionError("not_found", "broadcast not found", 404);
  }

  const creatorId = String(payload.creator_id || broadcast.creator_id || actorId || "").trim();
  if (!creatorId) {
    throw new TalkRoomFunctionError("invalid_request", "creator_id required", 400);
  }
  if (String(broadcast.creator_id) !== actorId) {
    throw new TalkRoomFunctionError("forbidden", "actor must be broadcast creator", 403);
  }

  const globalKey = `live_started:${broadcastId}`;
  const globalNew = await tryDedupe(supabase, globalKey);
  if (!globalNew) {
    return { ok: true, deduped: true, event: "live_started", fanout: 0 };
  }

  const { data: followers, error: folErr } = await supabase
    .from("live_creator_follows")
    .select("follower_id")
    .eq("creator_id", creatorId)
    .eq("notify_enabled", true)
    .limit(BROADCAST_FANOUT_MAX);

  if (folErr) {
    throw Object.assign(new Error(folErr.message), { status: 500 });
  }

  const creatorName = String(payload.creator_name || creatorId).trim();
  const broadcastTitle = String(payload.title || broadcast.title || "").trim();
  const displayText = `${creatorName}さんがライブ配信を開始しました`;
  const defaultTargetUrl = `live/watch-live.html?id=${encodeURIComponent(broadcastId)}`;
  const targetUrl = String(payload.target_url || defaultTargetUrl).trim() || defaultTargetUrl;
  let fanout = 0;

  for (const row of followers || []) {
    const followerId = String(row.follower_id || "").trim();
    if (!followerId || followerId === creatorId) continue;

    const perKey = `live_started:${broadcastId}:${creatorId}:${followerId}`;
    const isNew = await tryDedupe(supabase, perKey);
    if (!isNew) continue;

    const notifyPayload = buildPayload({
      service_ref_id: broadcastId,
      event: "live_started",
      type: "live_started",
      actor_id: creatorId,
      actor_name: creatorName,
      broadcast_id: broadcastId,
      live_id: broadcastId,
      title: broadcastTitle || undefined,
      target_user_id: followerId,
    });

    await insertNotification(supabase, {
      id: `live-n-live-started:${broadcastId}:${creatorId}:${followerId}`,
      userId: followerId,
      title: broadcastTitle || "ライブ配信が始まりました",
      body: formatBody(displayText, notifyPayload),
      targetUrl: targetUrl.startsWith("live/") ? targetUrl : `live/${targetUrl.replace(/^\//, "")}`,
    });
    fanout += 1;
  }

  if (!fanout) {
    return { ok: true, skipped: true, reason: "no_followers", event: "live_started", fanout: 0 };
  }

  return {
    ok: true,
    notified: true,
    event: "live_started",
    fanout,
    fanout_cap: BROADCAST_FANOUT_MAX,
  };
}

async function handleVideoPublished(
  supabase: SupabaseClient,
  actorId: string,
  payload: Record<string, unknown>,
) {
  const videoId = String(payload.video_id || "").trim();
  if (!videoId || !UUID_RE.test(videoId)) {
    throw new TalkRoomFunctionError("invalid_request", "video_id uuid required", 400);
  }

  const { data: video, error: videoErr } = await supabase
    .from("live_videos")
    .select("id, talk_user_id, title, status, visibility")
    .eq("id", videoId)
    .maybeSingle();

  if (videoErr) {
    throw Object.assign(new Error(videoErr.message), { status: 500 });
  }
  if (!video) {
    throw new TalkRoomFunctionError("not_found", "video not found", 404);
  }

  const creatorId = String(payload.creator_id || video.talk_user_id || actorId || "").trim();
  if (!creatorId) {
    throw new TalkRoomFunctionError("invalid_request", "creator_id required", 400);
  }
  if (String(video.talk_user_id) !== actorId) {
    throw new TalkRoomFunctionError("forbidden", "actor must be video creator", 403);
  }
  if (String(video.status) !== "published") {
    return { ok: true, skipped: true, reason: "not_published", event: "video_published", fanout: 0 };
  }

  const globalKey = `video_published:${videoId}`;
  const globalNew = await tryDedupe(supabase, globalKey);
  if (!globalNew) {
    return { ok: true, deduped: true, event: "video_published", fanout: 0 };
  }

  const { data: followers, error: folErr } = await supabase
    .from("live_creator_follows")
    .select("follower_id")
    .eq("creator_id", creatorId)
    .eq("notify_enabled", true)
    .limit(BROADCAST_FANOUT_MAX);

  if (folErr) {
    throw Object.assign(new Error(folErr.message), { status: 500 });
  }

  const creatorName = String(payload.creator_name || creatorId).trim();
  const videoTitle = String(payload.title || video.title || "").trim();
  const displayText = `${creatorName}さんが新しい動画を公開しました`;
  const defaultTargetUrl = `live/watch-video.html?id=${encodeURIComponent(videoId)}`;
  const targetUrl = String(payload.target_url || defaultTargetUrl).trim() || defaultTargetUrl;
  let fanout = 0;

  for (const row of followers || []) {
    const followerId = String(row.follower_id || "").trim();
    if (!followerId || followerId === creatorId) continue;

    const perKey = `video_published:${videoId}:${creatorId}:${followerId}`;
    const isNew = await tryDedupe(supabase, perKey);
    if (!isNew) continue;

    const notifyPayload = buildPayload({
      service_ref_id: videoId,
      event: "video_published",
      type: "video_published",
      actor_id: creatorId,
      actor_name: creatorName,
      video_id: videoId,
      title: videoTitle || undefined,
      target_user_id: followerId,
    });

    await insertNotification(supabase, {
      id: `live-n-video-published:${videoId}:${creatorId}:${followerId}`,
      userId: followerId,
      title: videoTitle || "新しい動画が公開されました",
      body: formatBody(displayText, notifyPayload),
      targetUrl: targetUrl.startsWith("live/") ? targetUrl : `live/${targetUrl.replace(/^\//, "")}`,
    });
    fanout += 1;
  }

  if (!fanout) {
    return { ok: true, skipped: true, reason: "no_followers", event: "video_published", fanout: 0 };
  }

  return {
    ok: true,
    notified: true,
    event: "video_published",
    fanout,
    fanout_cap: BROADCAST_FANOUT_MAX,
  };
}

async function handleSystem(
  supabase: SupabaseClient,
  _actorId: string,
  payload: Record<string, unknown>,
) {
  const targetUserId = String(payload.target_user_id || payload.targetUserId || "").trim();
  const title = String(payload.title || "").trim();
  const bodyText = String(payload.body || "").trim();
  if (!targetUserId) {
    throw new TalkRoomFunctionError("invalid_request", "target_user_id required", 400);
  }
  if (!title) {
    throw new TalkRoomFunctionError("invalid_request", "title required", 400);
  }

  const priorityRaw = String(payload.priority || "normal").trim().toLowerCase();
  const priority = priorityRaw === "high" || priorityRaw === "important" || priorityRaw === "urgent" ? "high" : "normal";
  const creator = String(payload.creator || payload.creator_name || "TLV運営").trim();
  const timestamp = String(payload.timestamp || Date.now());
  const defaultTargetUrl = "#";
  const targetUrlRaw = String(payload.target_url || payload.targetUrl || defaultTargetUrl).trim() || defaultTargetUrl;
  const targetUrl =
    targetUrlRaw.startsWith("live/") || targetUrlRaw === "#"
      ? targetUrlRaw
      : `live/${targetUrlRaw.replace(/^\//, "")}`;

  const eventKey = `system:${targetUserId}:${timestamp}`;
  const isNew = await tryDedupe(supabase, eventKey);
  if (!isNew) {
    return { ok: true, deduped: true, event: "system" };
  }

  const notifyPayload = buildPayload({
    service_ref_id: targetUserId,
    event: "system",
    type: "system",
    title,
    body: bodyText,
    priority,
    creator,
    target_user_id: targetUserId,
  });

  await insertNotification(supabase, {
    id: `live-n-system:${targetUserId}:${timestamp}`,
    userId: targetUserId,
    title,
    body: formatBody(bodyText || title, notifyPayload),
    targetUrl,
    priority,
  });

  return { ok: true, notified: true, event: "system", id: `live-n-system:${targetUserId}:${timestamp}` };
}

async function handleLikeChanged(
  supabase: SupabaseClient,
  _actorId: string,
  payload: Record<string, unknown>,
) {
  const shortId = String(payload.short_id || "").trim();
  if (!shortId || !UUID_RE.test(shortId)) {
    throw new TalkRoomFunctionError("invalid_request", "short_id uuid required", 400);
  }

  const { data, error } = await supabase.rpc("live_refresh_short_like_count", {
    p_short_id: shortId,
  });
  if (error) {
    throw Object.assign(new Error(error.message), { status: 500 });
  }

  return { ok: true, event: "like_changed", like_count: data ?? null };
}

export async function handler(req: Request): Promise<Response> {
  const options = handleOptions(req);
  if (options) return options;

  try {
    if (req.method !== "POST") {
      return jsonResponse({ error: "Method Not Allowed" }, 405, req);
    }

    const token = getBearerToken(req);
    if (!token) {
      return jsonResponse({ error: "Authorization header required" }, 401, req);
    }

    const auth = requireTalkUser(req);
    if (!auth.talkUserId) {
      return jsonResponse({ error: "Valid user JWT required" }, 401, req);
    }

    let body: RequestBody;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400, req);
    }

    const event = parseEvent(body.event);
    const payload = body.payload && typeof body.payload === "object" ? body.payload : {};
    const supabase = createServiceClient();

    let result: Record<string, unknown>;
    switch (event) {
      case "follow_created":
        result = await handleFollowCreated(supabase, auth.talkUserId, payload);
        break;
      case "comment_created":
        result = await handleCommentCreated(supabase, auth.talkUserId, payload);
        break;
      case "tip_created":
        result = await handleTipCreated(supabase, auth.talkUserId, payload);
        break;
      case "broadcast_started":
        result = await handleBroadcastStarted(supabase, auth.talkUserId, payload);
        break;
      case "live_started":
        result = await handleLiveStarted(supabase, auth.talkUserId, payload);
        break;
      case "video_published":
        result = await handleVideoPublished(supabase, auth.talkUserId, payload);
        break;
      case "system":
        result = await handleSystem(supabase, auth.talkUserId, payload);
        break;
      case "like_changed":
        result = await handleLikeChanged(supabase, auth.talkUserId, payload);
        break;
      default:
        return jsonResponse({ error: "Unknown event" }, 400, req);
    }

    return jsonResponse(result, 200, req);
  } catch (err) {
    if (err instanceof TalkRoomFunctionError) {
      return jsonResponse({ ok: false, code: err.code, error: err.message }, err.status, req);
    }
    const status = Number((err as { status?: number })?.status || 500);
    const message = errorMessage(err);
    return jsonResponse({ ok: false, error: message }, status >= 400 && status < 600 ? status : 500, req);
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
