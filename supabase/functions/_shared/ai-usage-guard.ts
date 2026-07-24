/**
 * SAFE-05 — TASFUL AI 統一 Usage Guard（既存 quota ラッパー）
 * 正本 quota: ai-workspace-quota.ts · AD-005 Gateway 契約は変更しない
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
  resolveWorkspaceFeature,
  resolveWorkspaceUserId,
  type WorkspaceFeatureKey,
  type WorkspaceQuotaBody,
  type WorkspaceQuotaStatus,
} from "./ai-workspace-quota.ts";

export const GUARD_FEATURE_OCR = "ocr_turn";

export type GuardFeatureKey = WorkspaceFeatureKey | typeof GUARD_FEATURE_OCR;

export type GuardBody = WorkspaceQuotaBody & {
  feature?: string;
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

export function resolveGuardUserId(body: GuardBody | null | undefined): string {
  return resolveWorkspaceUserId(body);
}

export function guardQuotaExceededResponse(
  status: WorkspaceQuotaStatus,
  req?: Request,
  displayFeature?: string
): Response {
  const feature = displayFeature || status.feature || WORKSPACE_FEATURE_TEXT;
  return quotaExceededResponse({ ...status, feature }, req);
}

/**
 * API 実行前チェック（consume なし）
 */
export async function enforceAiUsageGuard(input: {
  req?: Request;
  body: GuardBody;
  feature?: GuardFeatureKey;
  requireSurface?: boolean;
}): Promise<{ blocked: Response | null; status: WorkspaceQuotaStatus | null }> {
  const body = input.body || {};
  const displayFeature = String(input.feature || body.feature || "").trim() || undefined;

  if (input.requireSurface !== false && !isWorkspaceSurface(body)) {
    return { blocked: null, status: null };
  }

  const userId = resolveGuardUserId(body);
  if (!userId || userId === "anonymous") {
    return {
      blocked: jsonResponse(
        {
          ok: false,
          error: "guard_missing_user_id",
          reply: "",
          feature: displayFeature || GUARD_FEATURE_OCR,
        },
        401,
        input.req
      ),
      status: { ok: false, error: "missing_user_id", feature: displayFeature },
    };
  }

  const quotaFeature = normalizeGuardFeature(displayFeature, body);

  try {
    const status = await checkWorkspaceQuota({ userId, feature: quotaFeature });
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

/** Chat Edge — 既存 enforceWorkspaceQuotaEntry と同等（guard 経由） */
export async function enforceGuardChatEntry(
  req: Request,
  body: GuardBody
): Promise<{ blocked: Response | null; status: WorkspaceQuotaStatus | null }> {
  return enforceAiUsageGuard({ req, body, requireSurface: true });
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
  });
}

/** 成功後 consume（Chat） */
export async function finalizeGuardChatConsume(
  body: GuardBody
): Promise<WorkspaceQuotaStatus | null> {
  return finalizeWorkspaceQuotaConsume(body);
}

/** 成功後 consume（OCR） */
export async function finalizeGuardOcrConsume(
  body: GuardBody
): Promise<WorkspaceQuotaStatus | null> {
  if (!isWorkspaceSurface({ ...body, surface: body?.surface || WORKSPACE_SURFACE })) {
    return null;
  }
  const userId = resolveGuardUserId(body);
  try {
    return await consumeWorkspaceQuota({
      userId,
      feature: WORKSPACE_FEATURE_VISION,
    });
  } catch (err) {
    console.error("[ai-usage-guard] ocr consume failed:", err);
    return null;
  }
}
