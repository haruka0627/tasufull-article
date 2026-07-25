import { getServiceSupabase } from "./apply-featured-listing.ts";
import { getGenAiPlanForUser } from "./apply-genai-plan.ts";
import { jsonResponse } from "./cors.ts";
import { attachUsageGaugeToStatus } from "./ai-usage-gauge.ts";
import { resolveUsageActor } from "./ai-usage-log.ts";
import {
  buildPublicPlanSummary,
  getAnonymousPolicy,
  getPlanPolicy,
  isFeatureAllowedForPolicy,
  isModelAllowedForPolicy,
  isPlanExecutable,
  policyFromGenAiPlan,
  type PlanPolicy,
} from "./ai-plan-policy.ts";

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
  policy?: PlanPolicy;
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
  policy: PlanPolicy;
}> {
  const planResult = await getGenAiPlanForUser(userId);
  if (!planResult.ok) {
    const policy = getPlanPolicy("free");
    return {
      planCode: policy.planId,
      planLabel: policy.displayName,
      dailyTextLimit: policy.dailyTextLimit,
      dailyVisionLimit: policy.dailyTextLimit,
      policy,
    };
  }
  const policy = policyFromGenAiPlan(planResult.plan);
  const textLimit = Math.max(0, Number(policy.dailyTextLimit) || 0);
  return {
    planCode: policy.planId,
    planLabel: policy.displayName,
    dailyTextLimit: textLimit,
    dailyVisionLimit: textLimit,
    policy,
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
  const executable = isPlanExecutable(limits.policy);
  const allowed = executable && remaining > 0;

  return {
    ok: true,
    allowed,
    feature,
    userId,
    planCode: limits.planCode,
    planLabel: limits.planLabel,
    dailyLimit: limit,
    used,
    remaining,
    dateJst,
    policy: limits.policy,
    error: allowed
      ? undefined
      : executable
        ? "quota_exceeded"
        : `plan_${limits.policy.status}`,
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
  const executable = isPlanExecutable(limits.policy);
  const allowed = executable && row.allowed === true;
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
    policy: limits.policy,
    error: allowed
      ? undefined
      : executable
        ? String(row.error || "quota_exceeded")
        : `plan_${limits.policy.status}`,
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
  if (!isPlanExecutable(limits.policy)) {
    return {
      ok: false,
      allowed: false,
      feature,
      userId,
      planCode: limits.planCode,
      planLabel: limits.planLabel,
      dailyLimit: limitForFeature(feature, limits),
      used: 0,
      remaining: 0,
      dateJst,
      policy: limits.policy,
      error: `plan_${limits.policy.status}`,
    };
  }
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
    policy: limits.policy,
    error: success ? undefined : String(row.error || "quota_exceeded"),
  };
}

/** Chat Edge 入口 — JWT 必須 · quota 超過時は 402 Response、通過時は status */
export async function enforceWorkspaceQuotaEntry(
  req: Request,
  body: WorkspaceQuotaBody
): Promise<{ blocked: Response | null; status: WorkspaceQuotaStatus | null }> {
  if (!isWorkspaceSurface(body)) {
    return { blocked: null, status: null };
  }

  const actor = await resolveAuthenticatedWorkspaceUser(req, body);
  if (!actor.ok) {
    return {
      blocked: jsonResponse(
        {
          ok: false,
          error: actor.error,
          reply: "",
        },
        actor.http,
        req
      ),
      status: { ok: false, error: actor.error },
    };
  }

  const feature = resolveWorkspaceFeature(body);

  try {
    const status = await checkWorkspaceQuota({ userId: actor.userId, feature });
    if (!status.allowed) {
      return { blocked: quotaExceededResponse(status, req), status };
    }
    return { blocked: null, status };
  } catch (err) {
    console.error("[ai-workspace-quota] entry enforce failed:", err);
    return { blocked: null, status: null };
  }
}

/** Chat Edge 成功後 — usage increment（JWT user のみ） */
export async function finalizeWorkspaceQuotaConsume(
  req: Request | undefined,
  body: WorkspaceQuotaBody
): Promise<WorkspaceQuotaStatus | null> {
  if (!isWorkspaceSurface(body)) return null;

  let userId = "";
  if (req) {
    const actor = await resolveAuthenticatedWorkspaceUser(req, body);
    if (!actor.ok) return null;
    userId = actor.userId;
  } else {
    // backward-compatible call sites without req — refuse claimed body
    return null;
  }

  const feature = resolveWorkspaceFeature(body);

  try {
    return await consumeWorkspaceQuota({ userId, feature });
  } catch (err) {
    console.error("[ai-workspace-quota] finalize consume failed:", err);
    return null;
  }
}

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "").trim()
  );
}

/**
 * JWT 検証済み user のみ許可。body の user_id は帰属に使わない（claimed-only 廃止）。
 * JWT ありで body が別 UUID を名乗ったら拒否。
 */
async function resolveQuotaActor(
  req: Request,
  body: WorkspaceQuotaBody
): Promise<
  | { ok: true; userId: string; authMode: "jwt" }
  | { ok: false; error: string; http: number }
> {
  const claimed = resolveWorkspaceUserId(body);
  const actor = await resolveUsageActor({
    req,
    bodyUserId: body.user_id ?? body.userId,
  });

  if (!actor.userId) {
    return { ok: false, error: "auth_required", http: 401 };
  }

  if (
    claimed &&
    claimed !== "anonymous" &&
    isUuidLike(claimed) &&
    claimed !== actor.userId
  ) {
    return { ok: false, error: "user_mismatch", http: 403 };
  }

  return { ok: true, userId: actor.userId, authMode: "jwt" };
}

function publicQuotaError(code: string): string {
  const allow = new Set([
    "missing_user_id",
    "auth_required",
    "user_mismatch",
    "quota_exceeded",
    "invalid_action",
    "usage_unavailable",
    "plan_feature_denied",
    "plan_model_denied",
    "plan_suspended",
    "plan_expired",
    "plan_inactive",
  ]);
  return allow.has(code) ? code : "usage_unavailable";
}

function enrichQuotaPayload(
  status: WorkspaceQuotaStatus,
  authMode: string
): Record<string, unknown> {
  const policy = status.policy || getPlanPolicy(status.planCode || "free");
  const gaugePayload = attachUsageGaugeToStatus(status, {
    authoritative: authMode === "jwt",
    authMode,
  });
  const plan = buildPublicPlanSummary(policy, {
    used: status.used,
    remaining: status.remaining,
  });
  const { userId: _u, policy: _p, ...rest } = status as Record<string, unknown>;
  return {
    ...gaugePayload,
    ...rest,
    plan,
    authMode,
  };
}

export async function handleWorkspaceQuotaAction(
  req: Request,
  body: WorkspaceQuotaBody
): Promise<Response> {
  const action = String(body.action || "status").trim().toLowerCase();
  const feature = resolveWorkspaceFeature(body);
  const actor = await resolveQuotaActor(req, body);

  if (!actor.ok) {
    return jsonResponse(
      { ok: false, error: publicQuotaError(actor.error) },
      actor.http,
      req
    );
  }

  const { userId, authMode } = actor;

  try {
    if (action === "check") {
      const status = await checkWorkspaceQuota({ userId, feature });
      return jsonResponse(enrichQuotaPayload(status, authMode), 200, req);
    }

    if (action === "consume") {
      const status = await consumeWorkspaceQuota({ userId, feature });
      const http = status.ok ? 200 : 402;
      return jsonResponse(
        { ...enrichQuotaPayload(status, authMode), ok: status.ok },
        http,
        req
      );
    }

    if (action !== "status" && action !== "") {
      return jsonResponse({ ok: false, error: "invalid_action" }, 400, req);
    }

    const status = await getWorkspaceQuotaStatus({ userId, feature });
    return jsonResponse(enrichQuotaPayload(status, authMode), 200, req);
  } catch (err) {
    console.error("[ai-workspace-quota] action failed:", err);
    return jsonResponse({ ok: false, error: "usage_unavailable" }, 500, req);
  }
}

/** Guard / Chat 用 — JWT 必須の user 解決（claimed 廃止） */
export async function resolveAuthenticatedWorkspaceUser(
  req: Request,
  body: WorkspaceQuotaBody
): Promise<
  | { ok: true; userId: string }
  | { ok: false; error: string; http: number }
> {
  return resolveQuotaActor(req, body);
}

export {
  isModelAllowedForPolicy,
  isFeatureAllowedForPolicy,
  getAnonymousPolicy,
  buildPublicPlanSummary,
};
