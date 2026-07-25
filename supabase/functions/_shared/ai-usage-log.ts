/**
 * SAFE-06 — AI Usage Log ingest（Supabase Edge 共有）
 * service_role RPC のみ · 失敗は握りつぶし（AI 本処理を再実行しない）
 * 正本: docs/tasful-ai-core-august-2026-plan.md Phase 2 / SAFE-06
 */
import { getServiceSupabase } from "./apply-featured-listing.ts";

export const USAGE_STATUS_SUCCESS = "success";
export const USAGE_STATUS_ERROR = "error";
export const USAGE_STATUS_DENIED = "denied";

const ALLOWED_FEATURES = new Set([
  "text_turn",
  "vision_turn",
  "ocr_turn",
  "chat",
  "voice_live",
  "media_video",
  "media_music",
]);

const ALLOWED_PROVIDERS = new Set([
  "gemini",
  "openai",
  "claude",
  "brave",
  "serper",
  "deepseek",
  "unknown",
]);

const ALLOWED_STATUSES = new Set([
  USAGE_STATUS_SUCCESS,
  USAGE_STATUS_ERROR,
  USAGE_STATUS_DENIED,
]);

const METADATA_ALLOWLIST = new Set([
  "surface",
  "intent",
  "http_status",
  "source",
  "quota_feature",
  "requested_mode",
  "requested_model",
  "resolved_workspace_id",
  "routing_reason",
  "fallback_used",
  "fallback_from",
  "fallback_reason",
  "use_case",
]);

/** Client routing オブジェクトを安全な metadata 断片へ（本文・secret 禁止） */
export function sanitizeRoutingMetadata(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const src = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  const mode = String(src.requested_mode ?? src.requestedMode ?? "").trim().toLowerCase();
  if (mode === "auto" || mode === "manual") out.requested_mode = mode;
  const reqModel = String(src.requested_model ?? src.requestedModel ?? "").trim().slice(0, 64);
  if (reqModel) out.requested_model = reqModel;
  const ws = String(src.resolved_workspace_id ?? src.resolvedWorkspaceId ?? "").trim().slice(0, 64);
  if (ws) out.resolved_workspace_id = ws;
  const reason = String(src.routing_reason ?? src.routingReason ?? "").trim().slice(0, 64);
  if (reason) out.routing_reason = reason;
  if (src.fallback_used === true || src.fallbackUsed === true || src.fallback_used === "true") {
    out.fallback_used = true;
  } else if (src.fallback_used === false || src.fallbackUsed === false) {
    out.fallback_used = false;
  }
  const fbFrom = String(src.fallback_from ?? src.fallbackFrom ?? "").trim().slice(0, 64);
  if (fbFrom) out.fallback_from = fbFrom;
  const fbReason = String(src.fallback_reason ?? src.fallbackReason ?? "").trim().slice(0, 64);
  if (fbReason) out.fallback_reason = fbReason;
  const useCase = String(src.use_case ?? src.useCase ?? "").trim().slice(0, 32);
  if (useCase) out.use_case = useCase;
  return out;
}

const METADATA_FORBIDDEN = new Set([
  "message",
  "prompt",
  "reply",
  "text",
  "content",
  "body",
  "history",
  "attachments",
  "image",
  "base64",
  "ocr_text",
  "system_prompt",
  "search_context",
  "parts",
  "candidates",
]);

const MAX_METADATA_BYTES = 2048;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type UsageLogStatus =
  | typeof USAGE_STATUS_SUCCESS
  | typeof USAGE_STATUS_ERROR
  | typeof USAGE_STATUS_DENIED;

export type UsageLogInput = {
  requestId: string;
  userId?: string | null;
  anonymousId?: string | null;
  feature: string;
  provider: string;
  model?: string | null;
  status: UsageLogStatus | string;
  inputUnits?: number | null;
  outputUnits?: number | null;
  totalUnits?: number | null;
  estimatedCost?: number | null;
  currency?: string | null;
  errorCode?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type UsageLogResult =
  | { ok: true; duplicate: boolean }
  | { ok: false; error: string };

function trimStr(value: unknown, max: number): string {
  return String(value ?? "").trim().slice(0, max);
}

export function newUsageRequestId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `req_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
  }
}

export function isUuidLike(value: unknown): boolean {
  return typeof value === "string" && UUID_RE.test(value.trim());
}

/**
 * Authorization Bearer がユーザー JWT のときだけ user_id を確定。
 * クライアント申告の user_id は anonymous_id 候補に落とす（信用しない）。
 */
export async function resolveUsageActor(input: {
  req?: Request;
  bodyUserId?: string | null;
}): Promise<{ userId: string | null; anonymousId: string | null }> {
  const claimed = trimStr(input.bodyUserId, 128);
  const claimedAnon = isUuidLike(claimed) || (claimed && claimed !== "anonymous")
    ? claimed.slice(0, 128)
    : claimed === "anonymous"
    ? "anonymous"
    : null;

  const auth = String(input.req?.headers.get("Authorization") || "").trim();
  const m = auth.match(/^Bearer\s+(\S+)$/i);
  const token = m?.[1]?.trim() || "";
  if (!token) {
    return { userId: null, anonymousId: claimedAnon };
  }

  const supabaseUrl = String(Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
  const anonKey = String(
    Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("TASFUL_SUPABASE_ANON_KEY") || ""
  ).trim();
  if (!supabaseUrl || !anonKey) {
    return { userId: null, anonymousId: claimedAnon };
  }

  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: anonKey,
      },
    });
    if (!res.ok) {
      return { userId: null, anonymousId: claimedAnon };
    }
    const data = await res.json();
    const verified = trimStr(data?.id, 128);
    if (!isUuidLike(verified)) {
      return { userId: null, anonymousId: claimedAnon };
    }
    return { userId: verified, anonymousId: null };
  } catch {
    return { userId: null, anonymousId: claimedAnon };
  }
}

export function sanitizeUsageMetadata(
  raw: Record<string, unknown> | null | undefined
): { ok: true; metadata: Record<string, unknown> } | { ok: false; error: string } {
  if (raw == null) return { ok: true, metadata: {} };
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "invalid_metadata" };
  }

  for (const key of Object.keys(raw)) {
    if (METADATA_FORBIDDEN.has(key)) {
      return { ok: false, error: "metadata_forbidden_keys" };
    }
  }

  const out: Record<string, unknown> = {};
  for (const key of Object.keys(raw)) {
    if (!METADATA_ALLOWLIST.has(key)) continue;
    const value = raw[key];
    if (value == null) continue;
    if (typeof value === "string") {
      out[key] = value.trim().slice(0, 64);
    } else if (typeof value === "number" && Number.isFinite(value)) {
      out[key] = Math.trunc(value);
    } else if (typeof value === "boolean") {
      out[key] = value;
    }
  }

  const bytes = new TextEncoder().encode(JSON.stringify(out)).length;
  if (bytes > MAX_METADATA_BYTES) {
    return { ok: false, error: "metadata_too_large" };
  }
  return { ok: true, metadata: out };
}

function normalizeNonNegNumber(value: unknown): number | null | { error: string } {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return { error: "invalid_units" };
  if (n < 0) return { error: "invalid_units" };
  return n;
}

/**
 * クライアント公開用ではない。Edge 内からのみ呼ぶ。
 * 例外を投げない · AI 本処理の成否に影響させない。
 */
export async function recordAiUsageEvent(input: UsageLogInput): Promise<UsageLogResult> {
  try {
    const requestId = trimStr(input.requestId, 128);
    if (requestId.length < 8) {
      return { ok: false, error: "invalid_request_id" };
    }

    const feature = trimStr(input.feature, 64).toLowerCase();
    if (!ALLOWED_FEATURES.has(feature)) {
      return { ok: false, error: "invalid_feature" };
    }

    const provider = trimStr(input.provider, 64).toLowerCase();
    if (!ALLOWED_PROVIDERS.has(provider)) {
      return { ok: false, error: "invalid_provider" };
    }

    const status = trimStr(input.status, 32).toLowerCase();
    if (!ALLOWED_STATUSES.has(status)) {
      return { ok: false, error: "invalid_status" };
    }

    const inputUnits = normalizeNonNegNumber(input.inputUnits);
    if (inputUnits && typeof inputUnits === "object" && "error" in inputUnits) {
      return { ok: false, error: "invalid_input_units" };
    }
    const outputUnits = normalizeNonNegNumber(input.outputUnits);
    if (outputUnits && typeof outputUnits === "object" && "error" in outputUnits) {
      return { ok: false, error: "invalid_output_units" };
    }
    const totalUnits = normalizeNonNegNumber(input.totalUnits);
    if (totalUnits && typeof totalUnits === "object" && "error" in totalUnits) {
      return { ok: false, error: "invalid_total_units" };
    }
    const estimatedCost = normalizeNonNegNumber(input.estimatedCost);
    if (estimatedCost && typeof estimatedCost === "object" && "error" in estimatedCost) {
      return { ok: false, error: "invalid_estimated_cost" };
    }

    const meta = sanitizeUsageMetadata(input.metadata || null);
    if (!meta.ok) return { ok: false, error: meta.error };

    let userId: string | null = null;
    if (input.userId != null && String(input.userId).trim()) {
      const u = trimStr(input.userId, 128);
      if (!isUuidLike(u)) {
        return { ok: false, error: "invalid_user_id" };
      }
      userId = u;
    }

    const anonymousId = input.anonymousId
      ? trimStr(input.anonymousId, 128) || null
      : null;

    const supabase = getServiceSupabase();
    const { data, error } = await supabase.rpc("ingest_ai_usage_event", {
      p_request_id: requestId,
      p_user_id: userId,
      p_anonymous_id: anonymousId,
      p_feature: feature,
      p_provider: provider,
      p_model: input.model ? trimStr(input.model, 128) : null,
      p_status: status,
      p_input_units: inputUnits as number | null,
      p_output_units: outputUnits as number | null,
      p_total_units: totalUnits as number | null,
      p_estimated_cost: estimatedCost as number | null,
      p_currency: input.currency ? trimStr(input.currency, 8).toUpperCase() : "JPY",
      p_error_code: input.errorCode ? trimStr(input.errorCode, 128) : null,
      p_metadata: meta.metadata,
    });

    if (error) {
      console.error("[ai-usage-log] ingest rpc failed");
      return { ok: false, error: "ingest_failed" };
    }

    const row = data && typeof data === "object" ? data : null;
    if (row && row.ok === false) {
      return { ok: false, error: String(row.error || "ingest_rejected") };
    }
    return {
      ok: true,
      duplicate: Boolean(row && row.duplicate === true),
    };
  } catch (_err) {
    console.error("[ai-usage-log] ingest exception");
    return { ok: false, error: "ingest_failed" };
  }
}

/**
 * 1 リクエスト 1 回だけ記録（二重呼び出し防止）
 */
export function createUsageLogOnce() {
  let recorded = false;
  return {
    async record(input: UsageLogInput): Promise<UsageLogResult> {
      if (recorded) {
        return { ok: true, duplicate: true };
      }
      recorded = true;
      return recordAiUsageEvent(input);
    },
  };
}
