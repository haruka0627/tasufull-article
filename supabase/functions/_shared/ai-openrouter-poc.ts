/**
 * TASFUL AI — OpenRouter Limited PoC（Edge 共有）
 * Production / 一般 UI 非公開 · Phase 6
 */
export const OPENROUTER_POC_VERSION = 1;

export const OPENROUTER_API_ENDPOINT =
  "https://openrouter.ai/api/v1/chat/completions";

export const OPENROUTER_POC_SURFACE = "openrouter_poc";

export const OPENROUTER_POC_HARNESS_HEADER = "x-tasful-openrouter-poc";

export const OPENROUTER_POC_MODELS: Record<string, {
  workspaceId: string;
  uiLabel: string;
  routeType: "openrouter";
  gatewayProviderId: "openrouter";
  openrouterModelSlug: string;
  upstreamProvider: string;
  costLedgerProvider: "openrouter";
  costLedgerModel: string;
  compareDirectWorkspaceId: string;
  available: false;
  pocOnly: true;
  productionEnabled: false;
}> = {
  "or-gemini-flash": {
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
  },
  "or-gpt": {
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
  },
};

const SLUG_TO_WORKSPACE: Record<string, string> = Object.fromEntries(
  Object.values(OPENROUTER_POC_MODELS).map((e) => [e.openrouterModelSlug, e.workspaceId])
);

export function getOpenRouterPocEntry(workspaceId: string | null | undefined) {
  const id = String(workspaceId || "").trim();
  return OPENROUTER_POC_MODELS[id] || null;
}

export function resolveOpenRouterPocModel(raw: string | null | undefined) {
  const value = String(raw || "").trim();
  if (!value) return null;
  if (OPENROUTER_POC_MODELS[value]) return OPENROUTER_POC_MODELS[value];
  const bySlug = SLUG_TO_WORKSPACE[value];
  if (bySlug) return OPENROUTER_POC_MODELS[bySlug];
  return null;
}

export function isAllowedOpenRouterSlug(slug: string | null | undefined) {
  return Boolean(SLUG_TO_WORKSPACE[String(slug || "").trim()]);
}

export type OpenRouterPocGateInput = {
  pocEnabled?: string | null;
  harnessTokenExpected?: string | null;
  harnessTokenProvided?: string | null;
  userId?: string | null;
  allowlistCsv?: string | null;
  clientEnableFlag?: boolean;
  clientPlanId?: string | null;
  clientAdminOverride?: boolean;
};

export function evaluateOpenRouterPocGate(input: OpenRouterPocGateInput = {}) {
  const enabled = String(input.pocEnabled ?? "").trim().toLowerCase();
  if (enabled !== "1" && enabled !== "true" && enabled !== "yes") {
    return { ok: false as const, error: "openrouter_poc_disabled", http: 403 };
  }

  const expected = String(input.harnessTokenExpected || "").trim();
  const provided = String(input.harnessTokenProvided || "").trim();
  if (!expected || !provided || provided !== expected) {
    return { ok: false as const, error: "openrouter_poc_forbidden", http: 403 };
  }

  const userId = String(input.userId || "").trim();
  if (!userId) {
    return { ok: false as const, error: "auth_required", http: 401 };
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
      return { ok: false as const, error: "openrouter_poc_user_denied", http: 403 };
    }
  }

  if (input.clientEnableFlag || input.clientPlanId || input.clientAdminOverride) {
    return {
      ok: false as const,
      error: "openrouter_poc_client_flag_rejected",
      http: 403,
    };
  }

  return { ok: true as const };
}

export const OPENROUTER_ERROR_CODES = {
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
} as const;

export function classifyOpenRouterHttpStatus(status: number) {
  const code = Number(status) || 0;
  if (code === 401) {
    return { publicCode: OPENROUTER_ERROR_CODES.unauthorized, http: 401 };
  }
  if (code === 402) {
    return { publicCode: OPENROUTER_ERROR_CODES.payment_required, http: 402 };
  }
  if (code === 403) {
    return { publicCode: OPENROUTER_ERROR_CODES.forbidden, http: 403 };
  }
  if (code === 404) {
    return { publicCode: OPENROUTER_ERROR_CODES.not_found, http: 404 };
  }
  if (code === 408) {
    return { publicCode: OPENROUTER_ERROR_CODES.request_timeout, http: 408 };
  }
  if (code === 429) {
    return { publicCode: OPENROUTER_ERROR_CODES.rate_limited, http: 429 };
  }
  if (code >= 500) {
    return { publicCode: OPENROUTER_ERROR_CODES.upstream_5xx, http: 502 };
  }
  if (code >= 400) {
    return { publicCode: "openrouter_client_error", http: code };
  }
  return { publicCode: "openrouter_error", http: 502 };
}

export function buildOpenRouterUsageMetadata(
  entry: { workspaceId?: string; upstreamProvider?: string; openrouterModelSlug?: string } | null,
  extra: Record<string, unknown> = {}
) {
  if (!entry) return { ...extra, route_type: "openrouter" };
  return {
    route_type: "openrouter",
    upstream_provider: String(entry.upstreamProvider || "").slice(0, 64),
    openrouter_model: String(entry.openrouterModelSlug || "").slice(0, 64),
    resolved_workspace_id: String(entry.workspaceId || "").slice(0, 64),
    ...extra,
  };
}

export function extractOpenRouterUsageUnits(providerUsage: unknown) {
  if (!providerUsage || typeof providerUsage !== "object") {
    return {
      inputUnits: null as number | null,
      outputUnits: null as number | null,
      totalUnits: null as number | null,
      usageSource: "unavailable",
    };
  }
  const u = providerUsage as Record<string, unknown>;
  const prompt = Number(u.prompt_tokens);
  const completion = Number(u.completion_tokens);
  const total = Number(u.total_tokens);
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

/** Deno.env から PoC gate 入力を構築 */
export function readOpenRouterPocEnvGate(req: Request, userId: string | null) {
  return evaluateOpenRouterPocGate({
    pocEnabled: Deno.env.get("OPENROUTER_POC_ENABLED"),
    harnessTokenExpected: Deno.env.get("OPENROUTER_POC_HARNESS_TOKEN"),
    harnessTokenProvided: req.headers.get(OPENROUTER_POC_HARNESS_HEADER),
    userId,
    allowlistCsv: Deno.env.get("OPENROUTER_POC_ALLOWLIST"),
  });
}
