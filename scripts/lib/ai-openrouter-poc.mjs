/**
 * TASFUL AI — OpenRouter Limited PoC（Phase 6）
 * Production / 一般 UI / Auto Mode / プラン商品化は対象外。
 * 正本: docs/tasful-ai-core-august-2026-plan.md · Phase 6
 */

export const OPENROUTER_POC_VERSION = 1;

/** Fixed endpoint — SSRF 防止（動的 URL 禁止） */
export const OPENROUTER_API_ENDPOINT =
  "https://openrouter.ai/api/v1/chat/completions";

export const OPENROUTER_POC_SURFACE = "openrouter_poc";

/** Internal harness header（サーバー env と一致必須 · クライアント独自有効化不可） */
export const OPENROUTER_POC_HARNESS_HEADER = "x-tasful-openrouter-poc";

/**
 * PoC 対象（最大 2）· 現行 direct モデルと対応比較用
 * 公式価格は埋め込まない · Cost Ledger は provisional / unknown_rate
 */
export const OPENROUTER_POC_MODELS = Object.freeze({
  "or-gemini-flash": Object.freeze({
    workspaceId: "or-gemini-flash",
    uiLabel: "OpenRouter Gemini Flash (PoC)",
    routeType: "openrouter",
    gatewayProviderId: "openrouter",
    openrouterModelSlug: "google/gemini-2.5-flash",
    upstreamProvider: "google",
    costLedgerProvider: "openrouter",
    costLedgerModel: "google/gemini-2.5-flash",
    compareDirectWorkspaceId: "gemini-flash",
    available: false,
    pocOnly: true,
    productionEnabled: false,
  }),
  "or-gpt": Object.freeze({
    workspaceId: "or-gpt",
    uiLabel: "OpenRouter GPT-4o mini (PoC)",
    routeType: "openrouter",
    gatewayProviderId: "openrouter",
    openrouterModelSlug: "openai/gpt-4o-mini",
    upstreamProvider: "openai",
    costLedgerProvider: "openrouter",
    costLedgerModel: "openai/gpt-4o-mini",
    compareDirectWorkspaceId: "gpt",
    available: false,
    pocOnly: true,
    productionEnabled: false,
  }),
});

export const OPENROUTER_POC_WORKSPACE_IDS = Object.freeze(
  Object.keys(OPENROUTER_POC_MODELS)
);

const SLUG_TO_WORKSPACE = Object.freeze(
  Object.fromEntries(
    OPENROUTER_POC_WORKSPACE_IDS.map((id) => [
      OPENROUTER_POC_MODELS[id].openrouterModelSlug,
      id,
    ])
  )
);

export function getOpenRouterPocEntry(workspaceId) {
  const id = String(workspaceId || "").trim();
  return OPENROUTER_POC_MODELS[id] || null;
}

export function isOpenRouterPocWorkspaceId(workspaceId) {
  return Boolean(getOpenRouterPocEntry(workspaceId));
}

export function resolveOpenRouterPocModel(raw) {
  const value = String(raw || "").trim();
  if (!value) return null;
  if (OPENROUTER_POC_MODELS[value]) return OPENROUTER_POC_MODELS[value];
  const bySlug = SLUG_TO_WORKSPACE[value];
  if (bySlug) return OPENROUTER_POC_MODELS[bySlug];
  return null;
}

export function isAllowedOpenRouterSlug(slug) {
  return Boolean(SLUG_TO_WORKSPACE[String(slug || "").trim()]);
}

/**
 * Production plan では常に OpenRouter 不可。
 * 許可は server env + harness token のみ（クライアント flag 無視）。
 */
export function evaluateOpenRouterPocGate(input = {}) {
  const enabled = String(input.pocEnabled ?? "").trim().toLowerCase();
  if (enabled !== "1" && enabled !== "true" && enabled !== "yes") {
    return { ok: false, error: "openrouter_poc_disabled", http: 403 };
  }

  const expected = String(input.harnessTokenExpected || "").trim();
  const provided = String(input.harnessTokenProvided || "").trim();
  if (!expected || !provided || provided !== expected) {
    return { ok: false, error: "openrouter_poc_forbidden", http: 403 };
  }

  const userId = String(input.userId || "").trim();
  if (!userId) {
    return { ok: false, error: "auth_required", http: 401 };
  }

  const allowlistRaw = String(input.allowlistCsv || "").trim();
  if (allowlistRaw) {
    const allowed = new Set(
      allowlistRaw
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
    );
    if (!allowed.has(userId.toLowerCase())) {
      return { ok: false, error: "openrouter_poc_user_denied", http: 403 };
    }
  }

  // クライアント申告の enable / plan / admin override は無視
  if (input.clientEnableFlag || input.clientPlanId || input.clientAdminOverride) {
    return { ok: false, error: "openrouter_poc_client_flag_rejected", http: 403 };
  }

  return { ok: true };
}

export const OPENROUTER_ERROR_CODES = Object.freeze({
  secret_missing: "openrouter_secret_missing",
  timeout: "openrouter_timeout",
  abort: "openrouter_aborted",
  malformed_json: "openrouter_malformed_json",
  invalid_content_type: "openrouter_invalid_content_type",
  oversized_response: "openrouter_oversized_response",
  unauthorized: "openrouter_unauthorized",
  payment_required: "openrouter_payment_required",
  forbidden: "openrouter_forbidden",
  not_found: "openrouter_not_found",
  request_timeout: "openrouter_request_timeout",
  rate_limited: "openrouter_rate_limited",
  upstream_5xx: "openrouter_upstream_5xx",
  unknown_model: "openrouter_unknown_model",
  endpoint_injection: "openrouter_endpoint_injection_denied",
  slug_injection: "openrouter_slug_injection_denied",
});

/**
 * HTTP status → 公開エラー分類（内部 endpoint / secret 名は出さない）
 */
export function classifyOpenRouterHttpStatus(status) {
  const code = Number(status) || 0;
  if (code === 401) return { publicCode: OPENROUTER_ERROR_CODES.unauthorized, http: 401 };
  if (code === 402) return { publicCode: OPENROUTER_ERROR_CODES.payment_required, http: 402 };
  if (code === 403) return { publicCode: OPENROUTER_ERROR_CODES.forbidden, http: 403 };
  if (code === 404) return { publicCode: OPENROUTER_ERROR_CODES.not_found, http: 404 };
  if (code === 408) return { publicCode: OPENROUTER_ERROR_CODES.request_timeout, http: 408 };
  if (code === 429) return { publicCode: OPENROUTER_ERROR_CODES.rate_limited, http: 429 };
  if (code >= 500) return { publicCode: OPENROUTER_ERROR_CODES.upstream_5xx, http: 502 };
  if (code >= 400) return { publicCode: "openrouter_client_error", http: code >= 500 ? 502 : code };
  return { publicCode: "openrouter_error", http: 502 };
}

export function buildOpenRouterUsageMetadata(entry, extra = {}) {
  if (!entry) return { ...extra, route_type: "openrouter" };
  return {
    route_type: "openrouter",
    upstream_provider: String(entry.upstreamProvider || "").slice(0, 64),
    openrouter_model: String(entry.openrouterModelSlug || "").slice(0, 64),
    resolved_workspace_id: String(entry.workspaceId || "").slice(0, 64),
    ...extra,
  };
}

/**
 * Provider usage が無い場合は null（推定を実測として保存しない）
 * @returns {{ inputUnits: number|null, outputUnits: number|null, totalUnits: number|null, usageSource: string }}
 */
export function extractOpenRouterUsageUnits(providerUsage) {
  if (!providerUsage || typeof providerUsage !== "object") {
    return {
      inputUnits: null,
      outputUnits: null,
      totalUnits: null,
      usageSource: "unavailable",
    };
  }
  const prompt = Number(providerUsage.prompt_tokens);
  const completion = Number(providerUsage.completion_tokens);
  const total = Number(providerUsage.total_tokens);
  const hasPrompt = Number.isFinite(prompt) && prompt >= 0;
  const hasCompletion = Number.isFinite(completion) && completion >= 0;
  if (!hasPrompt && !hasCompletion && !(Number.isFinite(total) && total >= 0)) {
    return {
      inputUnits: null,
      outputUnits: null,
      totalUnits: null,
      usageSource: "unavailable",
    };
  }
  const inputUnits = hasPrompt ? prompt : null;
  const outputUnits = hasCompletion ? completion : null;
  const totalUnits =
    Number.isFinite(total) && total >= 0
      ? total
      : inputUnits != null || outputUnits != null
        ? (inputUnits || 0) + (outputUnits || 0)
        : null;
  return {
    inputUnits,
    outputUnits,
    totalUnits,
    usageSource: "provider_tokens",
  };
}

/**
 * Cost Ledger lookup 形状検証用 test-only provisional fixture。
 * 公式 OpenRouter 単価ではない · Production DB には載せない · 0 円にしない。
 */
export const OPENROUTER_POC_TEST_ONLY_RATES = Object.freeze([
  {
    provider: "openrouter",
    model: "google/gemini-2.5-flash",
    unitType: "input",
    perUnits: "1000000",
    unitPrice: "0.15",
    currency: "USD",
    unitBasis: "token",
    provisional: true,
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    effectiveTo: null,
  },
  {
    provider: "openrouter",
    model: "google/gemini-2.5-flash",
    unitType: "output",
    perUnits: "1000000",
    unitPrice: "0.60",
    currency: "USD",
    unitBasis: "token",
    provisional: true,
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    effectiveTo: null,
  },
]);

export default {
  OPENROUTER_POC_VERSION,
  OPENROUTER_API_ENDPOINT,
  OPENROUTER_POC_SURFACE,
  OPENROUTER_POC_HARNESS_HEADER,
  OPENROUTER_POC_MODELS,
  OPENROUTER_POC_WORKSPACE_IDS,
  getOpenRouterPocEntry,
  isOpenRouterPocWorkspaceId,
  resolveOpenRouterPocModel,
  isAllowedOpenRouterSlug,
  evaluateOpenRouterPocGate,
  OPENROUTER_ERROR_CODES,
  classifyOpenRouterHttpStatus,
  buildOpenRouterUsageMetadata,
  extractOpenRouterUsageUnits,
  OPENROUTER_POC_TEST_ONLY_RATES,
};
