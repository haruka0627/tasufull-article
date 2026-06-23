/**
 * TASFUL LIVE — security events (TLV Phase 13)
 *
 * POST { action | intent, ... }
 *   record_view_event — video_id, watched_seconds, watched_ratio, device_key?
 *   record_ad_impression — video_id, ad_id, device_key?
 *   record_report_signal — video_id, reason, detail?, device_key?
 *   list_risk_flags — admin
 *   update_risk_flag — admin · id, intent, note?
 *   resolve_risk_flag — admin · id, note?
 */
import {
  assertVideoViewAccess,
  createServiceClient,
  handleLiveVideoError,
  handleOptions,
  jsonResponse,
  LiveVideoFunctionError,
  loadVideo,
  optionalVerifiedUser,
  parseJsonBody,
  parseVideoId,
  requirePost,
  requireVerifiedAdmin,
  requireVerifiedUser,
} from "../_shared/live-video-auth.ts";

const PUBLIC_ACTIONS = new Set(["record_view_event", "record_ad_impression", "record_report_signal"]);
const ADMIN_ACTIONS = new Set(["list_risk_flags", "update_risk_flag", "resolve_risk_flag"]);
const ALL_ACTIONS = new Set([...PUBLIC_ACTIONS, ...ADMIN_ACTIONS]);

const VIEW_MIN_SECONDS = 10;
const VIEW_MIN_RATIO = 0.3;
const VIEW_DEDUP_MINUTES = 30;
const AD_DEDUP_MINUTES = 5;
const REPORT_BURST_MINUTES = 10;
const REPORT_BURST_COUNT = 5;
const DEVICE_VIEW_BURST_MINUTES = 5;
const DEVICE_VIEW_BURST_COUNT = 10;
const REPORT_REASONS = new Set(["spam", "abuse", "copyright", "illegal", "other"]);
const REPORT_DETAIL_MIN = 8;

type RequestBody = {
  action?: unknown;
  intent?: unknown;
  video_id?: unknown;
  ad_id?: unknown;
  watched_seconds?: unknown;
  watched_ratio?: unknown;
  device_key?: unknown;
  reason?: unknown;
  detail?: unknown;
  id?: unknown;
  note?: unknown;
  status?: unknown;
  limit?: unknown;
  offset?: unknown;
};

function parseAction(raw: unknown, alt: unknown): string {
  const action = String(raw ?? alt ?? "")
    .trim()
    .toLowerCase();
  if (!action || !ALL_ACTIONS.has(action)) {
    throw new LiveVideoFunctionError(
      "invalid_request",
      `action must be one of: ${[...ALL_ACTIONS].join(", ")}`,
      400,
    );
  }
  return action;
}

function parseDeviceKey(raw: unknown): string | null {
  const key = String(raw ?? "").trim().toLowerCase();
  if (!key) return null;
  if (!/^[a-f0-9]{32,64}$/.test(key)) {
    throw new LiveVideoFunctionError("invalid_request", "device_key must be a hex hash", 400);
  }
  return key;
}

function parseAdId(raw: unknown): string {
  const id = String(raw ?? "").trim();
  if (!id) {
    throw new LiveVideoFunctionError("invalid_request", "ad_id is required", 400);
  }
  return id;
}

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

function minutesAgo(min: number): string {
  return new Date(Date.now() - min * 60 * 1000).toISOString();
}

async function createRiskFlag(
  supabase: ReturnType<typeof createServiceClient>,
  row: {
    target_type: string;
    target_id: string;
    severity: string;
    reason: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  const { data: existing } = await supabase
    .from("live_risk_flags")
    .select("id")
    .eq("target_type", row.target_type)
    .eq("target_id", row.target_id)
    .eq("reason", row.reason)
    .in("status", ["open", "watching"])
    .limit(1)
    .maybeSingle();

  if (existing?.id) return;

  await supabase.from("live_risk_flags").insert({
    target_type: row.target_type,
    target_id: row.target_id,
    severity: row.severity,
    reason: row.reason,
    metadata: row.metadata ?? {},
    status: "open",
  });
}

async function handleRecordViewEvent(
  supabase: ReturnType<typeof createServiceClient>,
  body: RequestBody,
  viewer: { talkUserId: string } | null,
  req: Request,
): Promise<Response> {
  if (!viewer) {
    throw new LiveVideoFunctionError("unauthorized", "Login required for view counting", 401);
  }

  const videoId = parseVideoId(body.video_id);
  const watchedSeconds = Math.max(0, Math.floor(Number(body.watched_seconds ?? 0)));
  const watchedRatio = Math.min(1, Math.max(0, Number(body.watched_ratio ?? 0)));
  const deviceKey = parseDeviceKey(body.device_key);
  const userId = viewer.talkUserId;

  const video = await loadVideo(supabase, videoId);
  if (!video) return jsonResponse({ error: "Video not found" }, 404, req);
  if (video.status !== "published") {
    return jsonResponse({ error: "Video is not published", code: "not_published" }, 403, req);
  }

  await assertVideoViewAccess(supabase, video, {
    talkUserId: userId,
    isAdmin: false,
    user: {} as never,
    token: "",
  });

  const qualified =
    watchedSeconds >= VIEW_MIN_SECONDS ||
    watchedRatio >= VIEW_MIN_RATIO ||
    (video.duration_sec != null && watchedSeconds >= Math.floor(Number(video.duration_sec) * VIEW_MIN_RATIO));

  let reason = qualified ? "qualified" : "watch_threshold_not_met";
  let counted = false;
  let viewsCount = Number(video.views_count ?? 0);

  if (qualified) {
    const since = minutesAgo(VIEW_DEDUP_MINUTES);
    let isDup = false;

    if (userId) {
      const { data: byUser } = await supabase
        .from("live_video_view_events")
        .select("id")
        .eq("video_id", videoId)
        .eq("user_id", userId)
        .eq("counted", true)
        .gte("created_at", since)
        .limit(1);
      if ((byUser || []).length > 0) isDup = true;
    }

    if (!isDup && deviceKey) {
      const { data: byDevice } = await supabase
        .from("live_video_view_events")
        .select("id")
        .eq("video_id", videoId)
        .eq("device_key", deviceKey)
        .eq("counted", true)
        .gte("created_at", since)
        .limit(1);
      if ((byDevice || []).length > 0) isDup = true;
    }

    if (isDup) {
      reason = "dedup_window";
    } else {
      const { data: newCount, error: incErr } = await supabase.rpc("live_increment_video_views", {
        p_video_id: videoId,
      });
      if (incErr) {
        return jsonResponse({ error: "Failed to increment views", details: incErr.message }, 500, req);
      }
      counted = true;
      viewsCount = Number(newCount ?? viewsCount + 1);
      reason = "counted";

      if (deviceKey) {
        const burstSince = minutesAgo(DEVICE_VIEW_BURST_MINUTES);
        const { count } = await supabase
          .from("live_video_view_events")
          .select("id", { count: "exact", head: true })
          .eq("device_key", deviceKey)
          .eq("counted", true)
          .gte("created_at", burstSince);
        if ((count ?? 0) >= DEVICE_VIEW_BURST_COUNT) {
          await createRiskFlag(supabase, {
            target_type: "user",
            target_id: userId,
            severity: "medium",
            reason: "device_view_burst",
            metadata: {
              device_key_prefix: deviceKey.slice(0, 8),
              counted_views: count,
              window_minutes: DEVICE_VIEW_BURST_MINUTES,
            },
          });
        }
      }
    }
  }

  await supabase.from("live_video_view_events").insert({
    video_id: videoId,
    user_id: userId,
    device_key: deviceKey,
    watched_seconds: watchedSeconds,
    watched_ratio: watchedRatio,
    counted,
    reason,
  });

  return jsonResponse(
    {
      ok: true,
      action: "record_view_event",
      counted,
      reason,
      views_count: viewsCount,
      video_id: videoId,
    },
    200,
    req,
  );
}

async function handleRecordAdImpression(
  supabase: ReturnType<typeof createServiceClient>,
  body: RequestBody,
  viewer: { talkUserId: string } | null,
  req: Request,
): Promise<Response> {
  const videoId = parseVideoId(body.video_id);
  const adId = parseAdId(body.ad_id);
  const deviceKey = parseDeviceKey(body.device_key);
  const userId = viewer?.talkUserId ?? null;

  const since = minutesAgo(AD_DEDUP_MINUTES);
  let isDup = false;

  if (userId) {
    const { data: byUser } = await supabase
      .from("live_ad_impression_events")
      .select("id")
      .eq("video_id", videoId)
      .eq("ad_id", adId)
      .eq("user_id", userId)
      .eq("counted", true)
      .gte("created_at", since)
      .limit(1);
    if ((byUser || []).length > 0) isDup = true;
  }

  if (!isDup && deviceKey) {
    const { data: byDevice } = await supabase
      .from("live_ad_impression_events")
      .select("id")
      .eq("video_id", videoId)
      .eq("ad_id", adId)
      .eq("device_key", deviceKey)
      .eq("counted", true)
      .gte("created_at", since)
      .limit(1);
    if ((byDevice || []).length > 0) isDup = true;
  }

  const counted = !isDup;
  const reason = counted ? "counted" : "dedup_window";

  await supabase.from("live_ad_impression_events").insert({
    video_id: videoId,
    ad_id: adId,
    user_id: userId,
    device_key: deviceKey,
    counted,
    reason,
  });

  if (counted) {
    const { count: impCount } = await supabase
      .from("live_ad_impression_events")
      .select("id", { count: "exact", head: true })
      .eq("video_id", videoId)
      .eq("counted", true)
      .gte("created_at", minutesAgo(60));

    const video = await loadVideo(supabase, videoId);
    const views = Number(video?.views_count ?? 0);
    if (views > 0 && (impCount ?? 0) > views * 1.2) {
      await createRiskFlag(supabase, {
        target_type: "video",
        target_id: videoId,
        severity: "high",
        reason: "ad_impression_spike",
        metadata: { impressions: impCount, views, ratio: (impCount ?? 0) / views },
      });
    }
  }

  return jsonResponse(
    { ok: true, action: "record_ad_impression", counted, reason, video_id: videoId, ad_id: adId },
    200,
    req,
  );
}

async function handleRecordReportSignal(
  supabase: ReturnType<typeof createServiceClient>,
  body: RequestBody,
  viewer: { talkUserId: string },
  req: Request,
): Promise<Response> {
  const videoId = parseVideoId(body.video_id);
  const reason = String(body.reason ?? "").trim();
  const detail = String(body.detail ?? "").trim();
  const deviceKey = parseDeviceKey(body.device_key);
  const userId = viewer.talkUserId;

  if (!REPORT_REASONS.has(reason)) {
    throw new LiveVideoFunctionError("invalid_request", "Invalid report reason", 400);
  }

  const { data: existing } = await supabase
    .from("live_video_reports")
    .select("id")
    .eq("video_id", videoId)
    .eq("reporter_talk_user_id", userId)
    .maybeSingle();

  if (existing?.id) {
    throw new LiveVideoFunctionError("duplicate_report", "この動画は既に通報済みです", 409);
  }

  let lowTrust = false;
  if (reason === "other" && detail.length < REPORT_DETAIL_MIN) {
    throw new LiveVideoFunctionError(
      "invalid_request",
      `「その他」を選ぶ場合は詳細を${REPORT_DETAIL_MIN}文字以上入力してください`,
      400,
    );
  }
  if (reason === "spam" && detail.length > 0 && detail.length < 4) {
    lowTrust = true;
  }

  const { error: insertErr } = await supabase.from("live_video_reports").insert({
    video_id: videoId,
    reporter_talk_user_id: userId,
    reason,
    detail: detail || null,
    status: lowTrust ? "reviewing" : "open",
  });

  if (insertErr) {
    if (insertErr.code === "23505") {
      throw new LiveVideoFunctionError("duplicate_report", "この動画は既に通報済みです", 409);
    }
    return jsonResponse({ error: "Failed to submit report", details: insertErr.message }, 500, req);
  }

  const burstSince = minutesAgo(REPORT_BURST_MINUTES);
  const { count } = await supabase
    .from("live_video_reports")
    .select("id", { count: "exact", head: true })
    .eq("reporter_talk_user_id", userId)
    .gte("created_at", burstSince);

  if ((count ?? 0) >= REPORT_BURST_COUNT) {
    await createRiskFlag(supabase, {
      target_type: "user",
      target_id: userId,
      severity: "high",
      reason: "report_spam_burst",
      metadata: {
        reports_in_window: count,
        window_minutes: REPORT_BURST_MINUTES,
        device_key_prefix: deviceKey?.slice(0, 8) ?? null,
      },
    });
  }

  const video = await loadVideo(supabase, videoId);

  return jsonResponse(
    {
      ok: true,
      action: "record_report_signal",
      video_id: videoId,
      low_trust: lowTrust,
      reports_count: Number(video?.reports_count ?? 0),
    },
    200,
    req,
  );
}

async function handleListRiskFlags(
  supabase: ReturnType<typeof createServiceClient>,
  body: RequestBody,
  req: Request,
): Promise<Response> {
  const limit = parseLimit(body.limit);
  const offset = parseOffset(body.offset);
  const status = String(body.status ?? "").trim();

  let query = supabase
    .from("live_risk_flags")
    .select(
      "id, target_type, target_id, severity, reason, metadata, status, note, created_at, updated_at",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq("status", status);

  const { data, error, count } = await query;
  if (error) {
    return jsonResponse({ error: "Failed to list risk flags", details: error.message }, 500, req);
  }

  return jsonResponse(
    { ok: true, action: "list_risk_flags", items: data || [], count: count ?? 0, limit, offset },
    200,
    req,
  );
}

async function handleUpdateRiskFlag(
  supabase: ReturnType<typeof createServiceClient>,
  body: RequestBody,
  adminTalkUserId: string,
  req: Request,
): Promise<Response> {
  const id = String(body.id ?? "").trim();
  if (!id) throw new LiveVideoFunctionError("invalid_request", "id is required", 400);

  const intent = String(body.intent ?? body.status ?? "").trim().toLowerCase();
  const note = body.note != null ? String(body.note) : undefined;

  const { data: existing, error: loadErr } = await supabase
    .from("live_risk_flags")
    .select("id, target_type, target_id, severity, reason, status, note, metadata")
    .eq("id", id)
    .maybeSingle();

  if (loadErr || !existing) {
    return jsonResponse({ error: "Risk flag not found" }, 404, req);
  }

  const patch: Record<string, unknown> = {};
  if (note !== undefined) patch.note = note;

  if (intent === "watch" || intent === "watching") patch.status = "watching";
  else if (intent === "resolve" || intent === "resolved" || intent === "confirm") {
    patch.status = "resolved";
  } else if (intent === "open") patch.status = "open";
  else if (intent === "save_note") {
    if (note === undefined) {
      throw new LiveVideoFunctionError("invalid_request", "note required for save_note", 400);
    }
  }

  if (intent === "suspend_monetization" && existing.target_type === "user") {
    await supabase
      .from("live_creator_monetization")
      .update({
        status: "suspended",
        reviewed_at: new Date().toISOString(),
        reviewed_by: adminTalkUserId,
      })
      .eq("user_id", existing.target_id);
    patch.status = "resolved";
    patch.note = note ?? "収益化停止を実行";
  }

  if (intent === "hide_video" && existing.target_type === "video") {
    await supabase
      .from("live_videos")
      .update({ status: "hidden" })
      .eq("id", existing.target_id);
    patch.status = "resolved";
    patch.note = note ?? "動画を非表示にしました";
  }

  if (!Object.keys(patch).length && note === undefined) {
    throw new LiveVideoFunctionError("invalid_request", "intent or note required", 400);
  }

  const { data: updated, error: updateErr } = await supabase
    .from("live_risk_flags")
    .update(patch)
    .eq("id", id)
    .select("id, target_type, target_id, severity, reason, metadata, status, note, created_at, updated_at")
    .maybeSingle();

  if (updateErr || !updated) {
    return jsonResponse({ error: "Failed to update risk flag", details: updateErr?.message }, 500, req);
  }

  return jsonResponse({ ok: true, action: "update_risk_flag", intent, flag: updated }, 200, req);
}

async function handleResolveRiskFlag(
  supabase: ReturnType<typeof createServiceClient>,
  body: RequestBody,
  req: Request,
): Promise<Response> {
  return handleUpdateRiskFlag(
    supabase,
    { ...body, intent: "resolve" },
    "",
    req,
  );
}

export async function handler(req: Request): Promise<Response> {
  const options = handleOptions(req);
  if (options) return options;

  try {
    requirePost(req);

    let body: RequestBody;
    try {
      body = await parseJsonBody<RequestBody>(req);
    } catch (err) {
      return handleLiveVideoError(err, req);
    }

    const action = parseAction(body.action, body.intent);
    const supabase = createServiceClient();

    if (ADMIN_ACTIONS.has(action)) {
      const admin = await requireVerifiedAdmin(req);
      if (action === "list_risk_flags") return await handleListRiskFlags(supabase, body, req);
      if (action === "resolve_risk_flag") return await handleResolveRiskFlag(supabase, body, req);
      return await handleUpdateRiskFlag(supabase, body, admin.talkUserId, req);
    }

    const viewer = await optionalVerifiedUser(req);

    if (action === "record_view_event") {
      return await handleRecordViewEvent(supabase, body, viewer, req);
    }
    if (action === "record_ad_impression") {
      return await handleRecordAdImpression(supabase, body, viewer, req);
    }
    if (action === "record_report_signal") {
      if (!viewer) {
        throw new LiveVideoFunctionError("unauthorized", "Login required for reports", 401);
      }
      return await handleRecordReportSignal(supabase, body, viewer, req);
    }

    throw new LiveVideoFunctionError("invalid_request", "unknown action", 400);
  } catch (err) {
    return handleLiveVideoError(err, req);
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
