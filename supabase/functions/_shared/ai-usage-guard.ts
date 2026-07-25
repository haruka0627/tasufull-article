/**
 * SAFE-05 — TASFUL AI 統一 Usage Guard（既存 quota ラッパー + Plan Policy）
 * 正本 quota: ai-workspace-quota.ts · plan: ai-plan-policy.ts · AD-005 Gateway 契約は変更しない
 */
import { jsonResponse } from "./cors.ts";
import {
  WORKSPACE_FEATURE_TEXT,
  WORKSPACE_FEATURE_VISION,
  WORKSPACE_SURFACE,
  checkWorkspaceQuota,
  consumeWorkspaceQuota,
  finalizeWorkspaceQuotaConsume,
  isWorkspaceSurface,
  quotaExceededResponse,
  resolveAuthenticatedWorkspaceUser,
  resolveWorkspaceFeature,
  type WorkspaceFeatureKey,
  type WorkspaceQuotaBody,
  type WorkspaceQuotaStatus,
} from "./ai-workspace-quota.ts";
import {
  featureForEdge,
  isFeatureAllowedForPolicy,
  isModelAllowedForPolicy,
  type PlanPolicy,
} from "./ai-plan-policy.ts";

export const GUARD_FEATURE_OCR = "ocr_turn";

export type GuardFeatureKey = WorkspaceFeatureKey | typeof GUARD_FEATURE_OCR;

export type GuardBody = WorkspaceQuotaBody & {
  feature?: string;
  routing?: Record<string, unknown> | null;
  model?: string;
  workspace_model?: string;
  workspaceModelId?: string;
};

/** ocr_turn は Phase 1 では vision_turn バケットを共有（DB 変更なし） */
export function normalizeGuardFeature(
  feature?: string,
  body?: GuardBody | null
): WorkspaceFeatureKey {
  const explicit = String(feature || body?.feature || "").trim();
  if (explicit === GUARD_FEATURE_OCR || explicit === WORKSPACE_FEATURE_VISION) {
    return WORKSPACE_FEATURE_VISION;
  }
  if (explicit === WORKSPACE_FEATURE_TEXT) {
    return WORKSPACE_FEATURE_TEXT;
  }
  return resolveWorkspaceFeature(body);
}

function extractWorkspaceModelId(body: GuardBody | null | undefined): string {
  const routing = body?.routing && typeof body.routing === "object" ? body.routing : null;
  const fromRouting = String(
    routing?.resolved_workspace_id ||
      routing?.resolvedWorkspaceId ||
      routing?.gatewayModelId ||
      ""
  ).trim();
  if (fromRouting) return fromRouting;
  return String(
    body?.workspaceModelId || body?.workspace_model || body?.model || ""
  ).trim();
}

function planDeniedResponse(
  error: string,
  req?: Request,
  extra: Record<string, unknown> = {}
): Response {
  return jsonResponse(
    {
      ok: false,
      error,
      reply: "",
      ...extra,
    },
    403,
    req
  );
}

/**
 * API 実行前チェック（consume なし）· JWT 必須 · plan feature/model 再検証
 */
export async function enforceAiUsageGuard(input: {
  req?: Request;
  body: GuardBody;
  feature?: GuardFeatureKey;
  requireSurface?: boolean;
  edgeName?: string;
}): Promise<{ blocked: Response | null; status: WorkspaceQuotaStatus | null }> {
  const body = input.body || {};
  const displayFeature = String(input.feature || body.feature || "").trim() || undefined;

  if (input.requireSurface !== false && !isWorkspaceSurface(body)) {
    return { blocked: null, status: null };
  }

  if (!input.req) {
    return {
      blocked: jsonResponse(
        { ok: false, error: "auth_required", reply: "" },
        401,
        input.req
      ),
      status: { ok: false, error: "auth_required" },
    };
  }

  const actor = await resolveAuthenticatedWorkspaceUser(input.req, body);
  if (!actor.ok) {
    return {
      blocked: jsonResponse(
        {
          ok: false,
          error: actor.error,
          reply: "",
          feature: displayFeature || GUARD_FEATURE_OCR,
        },
        actor.http,
        input.req
      ),
      status: { ok: false, error: actor.error, feature: displayFeature },
    };
  }

  const quotaFeature = normalizeGuardFeature(displayFeature, body);

  try {
    const status = await checkWorkspaceQuota({
      userId: actor.userId,
      feature: quotaFeature,
    });
    const policy = status.policy as PlanPolicy | undefined;

    if (policy) {
      const edgeFeature = input.edgeName
        ? featureForEdge(input.edgeName)
        : displayFeature === GUARD_FEATURE_OCR
          ? "ocr"
          : "workspace_chat";
      if (edgeFeature && !isFeatureAllowedForPolicy(policy, edgeFeature)) {
        return {
          blocked: planDeniedResponse("plan_feature_denied", input.req, {
            feature: edgeFeature,
            planId: policy.planId,
          }),
          status: { ...status, allowed: false, error: "plan_feature_denied" },
        };
      }

      const workspaceModel = extractWorkspaceModelId(body);
      if (
        workspaceModel &&
        edgeFeature !== "ocr" &&
        !isModelAllowedForPolicy(policy, workspaceModel)
      ) {
        return {
          blocked: planDeniedResponse("plan_model_denied", input.req, {
            model: workspaceModel,
            planId: policy.planId,
            allowedModels: policy.allowedWorkspaceModels,
          }),
          status: { ...status, allowed: false, error: "plan_model_denied" },
        };
      }
    }

    if (!status.allowed) {
      return {
        blocked: guardQuotaExceededResponse(status, input.req, displayFeature || quotaFeature),
        status,
      };
    }
    return { blocked: null, status };
  } catch (err) {
    console.error("[ai-usage-guard] enforce failed:", err);
    return { blocked: null, status: null };
  }
}

export function guardQuotaExceededResponse(
  status: WorkspaceQuotaStatus,
  req?: Request,
  displayFeature?: string
): Response {
  const feature = displayFeature || status.feature || WORKSPACE_FEATURE_TEXT;
  return quotaExceededResponse({ ...status, feature }, req);
}

/** Chat Edge — surface=ai-workspace · JWT · plan model/feature */
export async function enforceGuardChatEntry(
  req: Request,
  body: GuardBody,
  edgeName?: string
): Promise<{ blocked: Response | null; status: WorkspaceQuotaStatus | null }> {
  return enforceAiUsageGuard({
    req,
    body,
    requireSurface: true,
    edgeName: edgeName || "gemini-chat",
  });
}

/** OCR Edge — surface=ai-workspace 必須 · ocr_turn 表示 */
export async function enforceGuardOcrEntry(
  req: Request,
  body: GuardBody
): Promise<{ blocked: Response | null; status: WorkspaceQuotaStatus | null }> {
  const normalized = {
    ...body,
    surface: String(body?.surface || "").trim() || WORKSPACE_SURFACE,
    feature: GUARD_FEATURE_OCR,
  };
  return enforceAiUsageGuard({
    req,
    body: normalized,
    feature: GUARD_FEATURE_OCR,
    requireSurface: true,
    edgeName: "gemini-ocr",
  });
}

/** 成功後 consume（Chat） */
export async function finalizeGuardChatConsume(
  req: Request,
  body: GuardBody
): Promise<WorkspaceQuotaStatus | null> {
  return finalizeWorkspaceQuotaConsume(req, body);
}

/** 成功後 consume（OCR） */
export async function finalizeGuardOcrConsume(
  req: Request,
  body: GuardBody
): Promise<WorkspaceQuotaStatus | null> {
  if (!isWorkspaceSurface({ ...body, surface: body?.surface || WORKSPACE_SURFACE })) {
    return null;
  }
  const actor = await resolveAuthenticatedWorkspaceUser(req, {
    ...body,
    surface: body?.surface || WORKSPACE_SURFACE,
  });
  if (!actor.ok) return null;
  try {
    return await consumeWorkspaceQuota({
      userId: actor.userId,
      feature: WORKSPACE_FEATURE_VISION,
    });
  } catch (err) {
    console.error("[ai-usage-guard] ocr consume failed:", err);
    return null;
  }
}
