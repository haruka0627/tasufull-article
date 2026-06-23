/**
 * TASFUL LIVE — monetization admin (TLV Phase 12)
 *
 * POST { action | intent, ... }
 *   list_applications
 *   get_application_detail — user_id
 *   review_application — user_id, review_action: approve|reject|suspend|resume|save_note, note?
 *   list_rpm_settings
 *   update_rpm_setting — id, rpm_yen?, active?
 *   create_rpm_setting — scope, target_id?, rpm_yen
 */
import {
  createServiceClient,
  handleLiveVideoError,
  handleOptions,
  jsonResponse,
  LiveVideoFunctionError,
  parseJsonBody,
  requirePost,
  requireVerifiedAdmin,
} from "../_shared/live-video-auth.ts";

const ACTIONS = new Set([
  "list_applications",
  "get_application_detail",
  "review_application",
  "list_rpm_settings",
  "update_rpm_setting",
  "create_rpm_setting",
]);

const REVIEW_ACTIONS = new Set(["approve", "reject", "suspend", "resume", "save_note"]);

type MonetizationRow = {
  id: string;
  user_id: string;
  status: string;
  note: string | null;
  applied_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
};

type RequestBody = {
  action?: unknown;
  intent?: unknown;
  user_id?: unknown;
  review_action?: unknown;
  note?: unknown;
  id?: unknown;
  scope?: unknown;
  target_id?: unknown;
  rpm_yen?: unknown;
  active?: unknown;
  limit?: unknown;
  offset?: unknown;
  source_page?: unknown;
};

function parseAction(raw: unknown, alt: unknown): string {
  const action = String(raw ?? alt ?? "")
    .trim()
    .toLowerCase();
  if (!action || !ACTIONS.has(action)) {
    throw new LiveVideoFunctionError(
      "invalid_request",
      `action must be one of: ${[...ACTIONS].join(", ")}`,
      400,
    );
  }
  return action;
}

function parseTalkUserId(raw: unknown): string {
  const id = String(raw ?? "").trim();
  if (!id) {
    throw new LiveVideoFunctionError("invalid_request", "user_id is required", 400);
  }
  return id;
}

function parseReviewAction(raw: unknown): string {
  const action = String(raw ?? "").trim().toLowerCase();
  if (!action || !REVIEW_ACTIONS.has(action)) {
    throw new LiveVideoFunctionError(
      "invalid_request",
      "review_action must be one of: approve, reject, suspend, resume, save_note",
      400,
    );
  }
  return action;
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

function parseRpm(raw: unknown, fallback = 100): number {
  const n = Number(raw ?? fallback);
  if (!Number.isFinite(n) || n < 0) {
    throw new LiveVideoFunctionError("invalid_request", "rpm_yen must be a non-negative number", 400);
  }
  return n;
}

async function insertAudit(
  supabase: ReturnType<typeof createServiceClient>,
  row: {
    actor_id: string;
    target_user_id: string | null;
    action: string;
    before_status?: string | null;
    after_status?: string | null;
    note?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await supabase.from("live_monetization_audit_logs").insert({
    actor_id: row.actor_id,
    target_user_id: row.target_user_id,
    action: row.action,
    before_status: row.before_status ?? null,
    after_status: row.after_status ?? null,
    note: row.note ?? null,
    metadata: row.metadata ?? {},
  });
  if (error) {
    console.error("[live-monetization-admin] audit insert failed", error.message);
  }
}

async function aggregateCreatorStats(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
) {
  const { data: videos, error } = await supabase
    .from("live_videos")
    .select("id, status, views_count, likes_count, reports_count")
    .eq("talk_user_id", userId);

  if (error) {
    throw new LiveVideoFunctionError("internal_error", "Failed to load creator videos", 500);
  }

  const list = videos || [];
  const active = list.filter((v) => v.status !== "removed");
  return {
    videoCount: active.length,
    totalViews: active.reduce((s, v) => s + Number(v.views_count || 0), 0),
    totalLikes: active.reduce((s, v) => s + Number(v.likes_count || 0), 0),
    totalReports: active.reduce((s, v) => s + Number(v.reports_count || 0), 0),
    hiddenCount: active.filter((v) => v.status === "hidden").length,
    removedCount: list.filter((v) => v.status === "removed").length,
    videos: list,
  };
}

function summarizeMonetization(row: MonetizationRow) {
  return {
    id: row.id,
    user_id: row.user_id,
    status: row.status,
    note: row.note,
    applied_at: row.applied_at,
    reviewed_at: row.reviewed_at,
    reviewed_by: row.reviewed_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function handleListApplications(
  supabase: ReturnType<typeof createServiceClient>,
  body: RequestBody,
  req: Request,
): Promise<Response> {
  const limit = parseLimit(body.limit);
  const offset = parseOffset(body.offset);

  const { data, error, count } = await supabase
    .from("live_creator_monetization")
    .select(
      "id, user_id, status, note, applied_at, reviewed_at, reviewed_by, created_at, updated_at",
      { count: "exact" },
    )
    .neq("status", "not_applied")
    .order("applied_at", { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return jsonResponse({ error: "Failed to list applications", details: error.message }, 500, req);
  }

  const items = [];
  for (const row of data || []) {
    const stats = await aggregateCreatorStats(supabase, row.user_id);
    items.push({
      ...summarizeMonetization(row as MonetizationRow),
      stats: {
        videoCount: stats.videoCount,
        totalViews: stats.totalViews,
        totalLikes: stats.totalLikes,
        totalReports: stats.totalReports,
        hiddenCount: stats.hiddenCount,
      },
    });
  }

  return jsonResponse(
    { ok: true, action: "list_applications", items, count: count ?? items.length, limit, offset },
    200,
    req,
  );
}

async function handleGetApplicationDetail(
  supabase: ReturnType<typeof createServiceClient>,
  body: RequestBody,
  req: Request,
): Promise<Response> {
  const userId = parseTalkUserId(body.user_id);

  const { data: row, error } = await supabase
    .from("live_creator_monetization")
    .select(
      "id, user_id, status, note, applied_at, reviewed_at, reviewed_by, created_at, updated_at",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return jsonResponse({ error: "Failed to load application", details: error.message }, 500, req);
  }

  const stats = await aggregateCreatorStats(supabase, userId);

  const { data: profile } = await supabase
    .from("live_creator_profiles")
    .select("user_id, display_name, bio, follower_count, creator_status")
    .eq("user_id", userId)
    .maybeSingle();

  const { data: auditLogs } = await supabase
    .from("live_monetization_audit_logs")
    .select("id, actor_id, action, before_status, after_status, note, metadata, created_at")
    .eq("target_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  return jsonResponse(
    {
      ok: true,
      action: "get_application_detail",
      application: row ? summarizeMonetization(row as MonetizationRow) : null,
      profile: profile || null,
      stats: {
        videoCount: stats.videoCount,
        totalViews: stats.totalViews,
        totalLikes: stats.totalLikes,
        totalReports: stats.totalReports,
        hiddenCount: stats.hiddenCount,
        removedCount: stats.removedCount,
      },
      videos: stats.videos.slice(0, 20),
      audit_logs: auditLogs || [],
    },
    200,
    req,
  );
}

function resolveReviewTransition(
  reviewAction: string,
  currentStatus: string,
): { nextStatus: string | null; auditAction: string } {
  switch (reviewAction) {
    case "approve":
      if (currentStatus !== "pending") {
        throw new LiveVideoFunctionError(
          "invalid_request",
          `approve requires pending status (current: ${currentStatus})`,
          400,
        );
      }
      return { nextStatus: "approved", auditAction: "approve" };
    case "reject":
      if (currentStatus !== "pending") {
        throw new LiveVideoFunctionError(
          "invalid_request",
          `reject requires pending status (current: ${currentStatus})`,
          400,
        );
      }
      return { nextStatus: "rejected", auditAction: "reject" };
    case "suspend":
      if (currentStatus !== "approved") {
        throw new LiveVideoFunctionError(
          "invalid_request",
          `suspend requires approved status (current: ${currentStatus})`,
          400,
        );
      }
      return { nextStatus: "suspended", auditAction: "suspend" };
    case "resume":
      if (currentStatus !== "suspended") {
        throw new LiveVideoFunctionError(
          "invalid_request",
          `resume requires suspended status (current: ${currentStatus})`,
          400,
        );
      }
      return { nextStatus: "approved", auditAction: "resume" };
    case "save_note":
      return { nextStatus: null, auditAction: "save_note" };
    default:
      throw new LiveVideoFunctionError("invalid_request", "invalid review_action", 400);
  }
}

async function handleReviewApplication(
  supabase: ReturnType<typeof createServiceClient>,
  body: RequestBody,
  adminTalkUserId: string,
  req: Request,
): Promise<Response> {
  const userId = parseTalkUserId(body.user_id);
  const reviewAction = parseReviewAction(body.review_action);
  const note = body.note != null ? String(body.note) : null;
  const sourcePage = String(body.source_page || "admin_videos").trim();

  const { data: existing, error: loadErr } = await supabase
    .from("live_creator_monetization")
    .select(
      "id, user_id, status, note, applied_at, reviewed_at, reviewed_by, created_at, updated_at",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (loadErr) {
    return jsonResponse({ error: "Failed to load application", details: loadErr.message }, 500, req);
  }
  if (!existing) {
    return jsonResponse({ error: "Application not found" }, 404, req);
  }

  const beforeStatus = String(existing.status || "");
  const { nextStatus, auditAction } = resolveReviewTransition(reviewAction, beforeStatus);

  const patch: Record<string, unknown> = {};
  if (note !== null) patch.note = note;
  if (nextStatus) {
    patch.status = nextStatus;
    patch.reviewed_at = new Date().toISOString();
    patch.reviewed_by = adminTalkUserId;
  }

  const { data: updated, error: updateErr } = await supabase
    .from("live_creator_monetization")
    .update(patch)
    .eq("user_id", userId)
    .select(
      "id, user_id, status, note, applied_at, reviewed_at, reviewed_by, created_at, updated_at",
    )
    .maybeSingle();

  if (updateErr || !updated) {
    return jsonResponse(
      { error: "Failed to update application", details: updateErr?.message || "update failed" },
      500,
      req,
    );
  }

  await insertAudit(supabase, {
    actor_id: adminTalkUserId,
    target_user_id: userId,
    action: auditAction,
    before_status: beforeStatus,
    after_status: nextStatus ?? beforeStatus,
    note,
    metadata: {
      intent: reviewAction,
      action: "review_application",
      source_page: sourcePage,
      previous_note: existing.note,
      new_note: note,
    },
  });

  return jsonResponse(
    {
      ok: true,
      action: "review_application",
      review_action: reviewAction,
      application: summarizeMonetization(updated as MonetizationRow),
    },
    200,
    req,
  );
}

async function handleListRpmSettings(
  supabase: ReturnType<typeof createServiceClient>,
  req: Request,
): Promise<Response> {
  const { data, error } = await supabase
    .from("live_ad_rpm_settings")
    .select("id, scope, target_id, rpm_yen, active, updated_by, created_at, updated_at")
    .order("scope", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    return jsonResponse({ error: "Failed to list RPM settings", details: error.message }, 500, req);
  }

  return jsonResponse({ ok: true, action: "list_rpm_settings", items: data || [] }, 200, req);
}

async function handleUpdateRpmSetting(
  supabase: ReturnType<typeof createServiceClient>,
  body: RequestBody,
  adminTalkUserId: string,
  req: Request,
): Promise<Response> {
  const id = String(body.id ?? "").trim();
  if (!id) {
    throw new LiveVideoFunctionError("invalid_request", "id is required", 400);
  }

  const { data: existing, error: loadErr } = await supabase
    .from("live_ad_rpm_settings")
    .select("id, scope, target_id, rpm_yen, active, updated_by, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();

  if (loadErr) {
    return jsonResponse({ error: "Failed to load RPM setting", details: loadErr.message }, 500, req);
  }
  if (!existing) {
    return jsonResponse({ error: "RPM setting not found" }, 404, req);
  }

  const patch: Record<string, unknown> = { updated_by: adminTalkUserId };
  if (body.rpm_yen != null) patch.rpm_yen = parseRpm(body.rpm_yen);
  if (body.active != null) patch.active = Boolean(body.active);

  const { data: updated, error: updateErr } = await supabase
    .from("live_ad_rpm_settings")
    .update(patch)
    .eq("id", id)
    .select("id, scope, target_id, rpm_yen, active, updated_by, created_at, updated_at")
    .maybeSingle();

  if (updateErr || !updated) {
    return jsonResponse(
      { error: "Failed to update RPM setting", details: updateErr?.message || "update failed" },
      500,
      req,
    );
  }

  await insertAudit(supabase, {
    actor_id: adminTalkUserId,
    target_user_id: null,
    action: "update_rpm",
    before_status: null,
    after_status: null,
    note: null,
    metadata: {
      intent: "update_rpm",
      action: "update_rpm_setting",
      source_page: String(body.source_page || "admin_videos"),
      previous_value: existing,
      new_value: updated,
    },
  });

  return jsonResponse({ ok: true, action: "update_rpm_setting", setting: updated }, 200, req);
}

async function handleCreateRpmSetting(
  supabase: ReturnType<typeof createServiceClient>,
  body: RequestBody,
  adminTalkUserId: string,
  req: Request,
): Promise<Response> {
  const scope = String(body.scope ?? "global").trim().toLowerCase();
  if (!["global", "ad", "video"].includes(scope)) {
    throw new LiveVideoFunctionError("invalid_request", "scope must be global, ad, or video", 400);
  }

  const targetId = body.target_id != null ? String(body.target_id).trim() || null : null;
  if ((scope === "ad" || scope === "video") && !targetId) {
    throw new LiveVideoFunctionError("invalid_request", "target_id is required for ad/video scope", 400);
  }

  const rpmYen = parseRpm(body.rpm_yen, 100);

  if (scope === "global") {
    await supabase
      .from("live_ad_rpm_settings")
      .update({ active: false, updated_by: adminTalkUserId })
      .eq("scope", "global")
      .eq("active", true);
  }

  const { data: created, error } = await supabase
    .from("live_ad_rpm_settings")
    .insert({
      scope,
      target_id: targetId,
      rpm_yen: rpmYen,
      active: true,
      updated_by: adminTalkUserId,
    })
    .select("id, scope, target_id, rpm_yen, active, updated_by, created_at, updated_at")
    .maybeSingle();

  if (error || !created) {
    return jsonResponse(
      { error: "Failed to create RPM setting", details: error?.message || "insert failed" },
      500,
      req,
    );
  }

  await insertAudit(supabase, {
    actor_id: adminTalkUserId,
    target_user_id: null,
    action: "create_rpm",
    before_status: null,
    after_status: null,
    note: null,
    metadata: {
      intent: "create_rpm",
      action: "create_rpm_setting",
      source_page: String(body.source_page || "admin_videos"),
      new_value: created,
    },
  });

  return jsonResponse({ ok: true, action: "create_rpm_setting", setting: created }, 200, req);
}

export async function handler(req: Request): Promise<Response> {
  const options = handleOptions(req);
  if (options) return options;

  try {
    requirePost(req);
    const admin = await requireVerifiedAdmin(req);

    let body: RequestBody;
    try {
      body = await parseJsonBody<RequestBody>(req);
    } catch (err) {
      return handleLiveVideoError(err, req);
    }

    const action = parseAction(body.action, body.intent);
    const supabase = createServiceClient();

    switch (action) {
      case "list_applications":
        return await handleListApplications(supabase, body, req);
      case "get_application_detail":
        return await handleGetApplicationDetail(supabase, body, req);
      case "review_application":
        return await handleReviewApplication(supabase, body, admin.talkUserId, req);
      case "list_rpm_settings":
        return await handleListRpmSettings(supabase, req);
      case "update_rpm_setting":
        return await handleUpdateRpmSetting(supabase, body, admin.talkUserId, req);
      case "create_rpm_setting":
        return await handleCreateRpmSetting(supabase, body, admin.talkUserId, req);
      default:
        throw new LiveVideoFunctionError("invalid_request", "unknown action", 400);
    }
  } catch (err) {
    return handleLiveVideoError(err, req);
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
