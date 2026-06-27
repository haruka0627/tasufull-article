import { getServiceSupabase } from "./apply-featured-listing.ts";
import { getGenAiPlanForUser } from "./apply-genai-plan.ts";
import { jsonResponse } from "./cors.ts";

export const WORKSPACE_SURFACE = "ai-workspace";

export const WORKSPACE_FEATURE_TEXT = "text_turn";
export const WORKSPACE_FEATURE_VISION = "vision_turn";

export type WorkspaceFeatureKey =
  | typeof WORKSPACE_FEATURE_TEXT
  | typeof WORKSPACE_FEATURE_VISION;

export type WorkspaceQuotaBody = {
  surface?: string;
  user_id?: string;
  userId?: string;
  feature?: string;
  action?: string;
  attachments?: unknown;
};

export type WorkspaceQuotaStatus = {
  ok: boolean;
  allowed?: boolean;
  error?: string;
  feature?: string;
  userId?: string;
  planCode?: string;
  planLabel?: string;
  dailyLimit?: number;
  used?: number;
  remaining?: number;
  dateJst?: string;
};

export function getTokyoDateKey(now = new Date()): string {
  try {
    return new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

export function isWorkspaceSurface(body: WorkspaceQuotaBody | null | undefined): boolean {
  return String(body?.surface || "").trim() === WORKSPACE_SURFACE;
}

export function resolveWorkspaceUserId(body: WorkspaceQuotaBody | null | undefined): string {
  const id = String(body?.user_id ?? body?.userId ?? "").trim();
  return id || "anonymous";
}

export function resolveWorkspaceFeature(
  body: WorkspaceQuotaBody | null | undefined
): WorkspaceFeatureKey {
  const explicit = String(body?.feature || "").trim();
  if (explicit === WORKSPACE_FEATURE_VISION) return WORKSPACE_FEATURE_VISION;
  if (Array.isArray(body?.attachments) && body.attachments.length > 0) {
    const hasImage = body.attachments.some(
      (item) =>
        item &&
        typeof item === "object" &&
        String((item as { kind?: string }).kind || "") === "image"
    );
    if (hasImage) return WORKSPACE_FEATURE_VISION;
  }
  return WORKSPACE_FEATURE_TEXT;
}

export function quotaExceededResponse(
  status: WorkspaceQuotaStatus,
  req?: Request
): Response {
  return jsonResponse(
    {
      error: "quota_exceeded",
      feature: status.feature || WORKSPACE_FEATURE_TEXT,
      reply: "",
      plan: status.planCode || "free",
      planLabel: status.planLabel || "無料枠",
      dailyLimit: status.dailyLimit ?? 0,
      used: status.used ?? status.dailyLimit ?? 0,
      remaining: 0,
      dateJst: status.dateJst,
      userId: status.userId,
    },
    402,
    req
  );
}

async function getDailyLimitForUser(userId: string): Promise<{
  planCode: string;
  planLabel: string;
  dailyTextLimit: number;
  dailyVisionLimit: number;
}> {
  const planResult = await getGenAiPlanForUser(userId);
  if (!planResult.ok) {
    return {
      planCode: "free",
      planLabel: "無料枠",
      dailyTextLimit: 5,
      dailyVisionLimit: 5,
    };
  }
  const plan = planResult.plan;
  const textLimit = Math.max(0, Number(plan.dailyTextLimit) || 5);
  return {
    planCode: plan.plan || "free",
    planLabel: plan.label || "無料枠",
    dailyTextLimit: textLimit,
    dailyVisionLimit: textLimit,
  };
}

function limitForFeature(
  feature: WorkspaceFeatureKey,
  limits: { dailyTextLimit: number; dailyVisionLimit: number }
): number {
  return feature === WORKSPACE_FEATURE_VISION
    ? limits.dailyVisionLimit
    : limits.dailyTextLimit;
}

async function readUsageRow(userId: string, dateJst: string) {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("ai_workspace_usage_daily")
    .select("text_used, vision_used")
    .eq("user_id", userId)
    .eq("date_jst", dateJst)
    .maybeSingle();

  if (error) {
    console.error("[ai-workspace-quota] read usage failed:", error);
    throw new Error(error.message);
  }

  return {
    textUsed: Math.max(0, Number(data?.text_used) || 0),
    visionUsed: Math.max(0, Number(data?.vision_used) || 0),
  };
}

export async function getWorkspaceQuotaStatus(input: {
  userId: string;
  feature?: WorkspaceFeatureKey;
}): Promise<WorkspaceQuotaStatus> {
  const userId = String(input.userId || "").trim();
  const feature = input.feature || WORKSPACE_FEATURE_TEXT;
  const dateJst = getTokyoDateKey();

  if (!userId) {
    return { ok: false, error: "missing_user_id", feature };
  }

  const limits = await getDailyLimitForUser(userId);
  const limit = limitForFeature(feature, limits);
  const usage = await readUsageRow(userId, dateJst);
  const used =
    feature === WORKSPACE_FEATURE_VISION ? usage.visionUsed : usage.textUsed;
  const remaining = Math.max(0, limit - used);

  return {
    ok: true,
    allowed: remaining > 0,
    feature,
    userId,
    planCode: limits.planCode,
    planLabel: limits.planLabel,
    dailyLimit: limit,
    used,
    remaining,
    dateJst,
    error: remaining > 0 ? undefined : "quota_exceeded",
  };
}

export async function checkWorkspaceQuota(input: {
  userId: string;
  feature?: WorkspaceFeatureKey;
}): Promise<WorkspaceQuotaStatus> {
  const userId = String(input.userId || "").trim();
  const feature = input.feature || WORKSPACE_FEATURE_TEXT;
  const dateJst = getTokyoDateKey();

  if (!userId) {
    return { ok: false, error: "missing_user_id", feature };
  }

  const limits = await getDailyLimitForUser(userId);
  const limit = limitForFeature(feature, limits);
  const supabase = getServiceSupabase();
  const { data, error } = await supabase.rpc("check_ai_workspace_quota", {
    p_user_id: userId,
    p_date_jst: dateJst,
    p_feature: feature,
    p_limit: limit,
  });

  if (error) {
    console.error("[ai-workspace-quota] check rpc failed:", error);
    throw new Error(error.message);
  }

  const row = (data || {}) as Record<string, unknown>;
  const allowed = row.allowed === true;
  return {
    ok: true,
    allowed,
    feature,
    userId,
    planCode: limits.planCode,
    planLabel: limits.planLabel,
    dailyLimit: limit,
    used: Math.max(0, Number(row.used) || 0),
    remaining: Math.max(0, Number(row.remaining) || 0),
    dateJst,
    error: allowed ? undefined : String(row.error || "quota_exceeded"),
  };
}

export async function consumeWorkspaceQuota(input: {
  userId: string;
  feature?: WorkspaceFeatureKey;
}): Promise<WorkspaceQuotaStatus> {
  const userId = String(input.userId || "").trim();
  const feature = input.feature || WORKSPACE_FEATURE_TEXT;
  const dateJst = getTokyoDateKey();

  if (!userId) {
    return { ok: false, error: "missing_user_id", feature };
  }

  const limits = await getDailyLimitForUser(userId);
  const limit = limitForFeature(feature, limits);
  const supabase = getServiceSupabase();
  const { data, error } = await supabase.rpc("consume_ai_workspace_quota", {
    p_user_id: userId,
    p_date_jst: dateJst,
    p_feature: feature,
    p_limit: limit,
  });

  if (error) {
    console.error("[ai-workspace-quota] consume rpc failed:", error);
    throw new Error(error.message);
  }

  const row = (data || {}) as Record<string, unknown>;
  const success = row.ok === true;
  return {
    ok: success,
    allowed: success,
    feature,
    userId,
    planCode: limits.planCode,
    planLabel: limits.planLabel,
    dailyLimit: limit,
    used: Math.max(0, Number(row.used) || 0),
    remaining: Math.max(0, Number(row.remaining) || 0),
    dateJst,
    error: success ? undefined : String(row.error || "quota_exceeded"),
  };
}

/** Chat Edge 入口 — quota 超過時は 402 Response、通過時は status */
export async function enforceWorkspaceQuotaEntry(
  req: Request,
  body: WorkspaceQuotaBody
): Promise<{ blocked: Response | null; status: WorkspaceQuotaStatus | null }> {
  if (!isWorkspaceSurface(body)) {
    return { blocked: null, status: null };
  }

  const userId = resolveWorkspaceUserId(body);
  const feature = resolveWorkspaceFeature(body);

  try {
    const status = await checkWorkspaceQuota({ userId, feature });
    if (!status.allowed) {
      return { blocked: quotaExceededResponse(status, req), status };
    }
    return { blocked: null, status };
  } catch (err) {
    console.error("[ai-workspace-quota] entry enforce failed:", err);
    return { blocked: null, status: null };
  }
}

/** Chat Edge 成功後 — usage increment */
export async function finalizeWorkspaceQuotaConsume(
  body: WorkspaceQuotaBody
): Promise<WorkspaceQuotaStatus | null> {
  if (!isWorkspaceSurface(body)) return null;

  const userId = resolveWorkspaceUserId(body);
  const feature = resolveWorkspaceFeature(body);

  try {
    return await consumeWorkspaceQuota({ userId, feature });
  } catch (err) {
    console.error("[ai-workspace-quota] finalize consume failed:", err);
    return null;
  }
}

export async function handleWorkspaceQuotaAction(
  req: Request,
  body: WorkspaceQuotaBody
): Promise<Response> {
  const action = String(body.action || "status").trim().toLowerCase();
  const userId = resolveWorkspaceUserId(body);
  const feature = resolveWorkspaceFeature(body);

  if (!userId || userId === "anonymous") {
    return jsonResponse({ ok: false, error: "missing_user_id" }, 400, req);
  }

  try {
    if (action === "check") {
      const status = await checkWorkspaceQuota({ userId, feature });
      return jsonResponse({ ok: true, ...status }, 200, req);
    }

    if (action === "consume") {
      const status = await consumeWorkspaceQuota({ userId, feature });
      const http = status.ok ? 200 : 402;
      return jsonResponse({ ok: status.ok, ...status }, http, req);
    }

    const status = await getWorkspaceQuotaStatus({ userId, feature });
    return jsonResponse({ ok: true, ...status }, 200, req);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ ok: false, error: message }, 500, req);
  }
}
