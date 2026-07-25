/**
 * OpenRouter Chat — Limited PoC（Phase 6）
 * Production 無効 · 一般 UI 非接続 · harness token + JWT 必須
 * AD-005: Workspace Gateway には接続しない
 */
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { trimAiText } from "../_shared/ai-search-context.ts";
import {
  enforceGuardOpenRouterPocEntry,
  finalizeGuardOpenRouterPocConsume,
  normalizeGuardFeature,
} from "../_shared/ai-usage-guard.ts";
import {
  USAGE_STATUS_DENIED,
  USAGE_STATUS_ERROR,
  USAGE_STATUS_SUCCESS,
  createUsageLogOnce,
  newUsageRequestId,
  resolveUsageActor,
  sanitizeRoutingMetadata,
} from "../_shared/ai-usage-log.ts";
import { callOpenRouterChat } from "../_shared/ai-openrouter-client.ts";
import {
  OPENROUTER_ERROR_CODES,
  OPENROUTER_POC_SURFACE,
  buildOpenRouterUsageMetadata,
  resolveOpenRouterPocModel,
} from "../_shared/ai-openrouter-poc.ts";

type HistoryItem = { role?: string; content?: string };

type RequestBody = {
  message?: string;
  history?: HistoryItem[];
  systemPrompt?: string;
  surface?: string;
  user_id?: string;
  userId?: string;
  model?: string;
  workspace_model?: string;
  workspaceModelId?: string;
  routing?: unknown;
  enable_openrouter?: boolean;
  enableOpenRouter?: boolean;
  plan_id?: string;
  planId?: string;
  admin_override?: boolean;
  adminOverride?: boolean;
  /** PoC fallback 実験フラグ（Production route では無効 · 最大1回） */
  poc_fallback?: "none" | "to_direct" | "from_direct";
};

function buildMessages(body: RequestBody) {
  const system = trimAiText(
    body.systemPrompt ||
      "あなたはTASFULのAIアシスタントです。日本語で簡潔に、正確に答えてください。",
    8000
  );
  const messages: { role: string; content: string }[] = [
    { role: "system", content: system },
  ];
  const history = Array.isArray(body.history) ? body.history : [];
  history.forEach((item) => {
    const content = trimAiText(item?.content, 4000);
    if (!content) return;
    const role = item?.role === "assistant" ? "assistant" : "user";
    messages.push({ role, content });
  });
  const message = trimAiText(body.message, 2000);
  if (message) messages.push({ role: "user", content: message });
  return { messages, message };
}

function resolveRequestedModel(body: RequestBody) {
  const routing =
    body.routing && typeof body.routing === "object"
      ? (body.routing as Record<string, unknown>)
      : null;
  const raw =
    body.workspaceModelId ||
    body.workspace_model ||
    body.model ||
    routing?.resolved_workspace_id ||
    routing?.resolvedWorkspaceId ||
    routing?.openrouter_model ||
    "";
  return resolveOpenRouterPocModel(String(raw));
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed", reply: "" }, 405);
  }

  const apiKey = Deno.env.get("OPENROUTER_API_KEY")?.trim();
  // secret 未設定でも gate/deny 経路は動かす（Provider 呼び出し直前で 503）

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body", reply: "" }, 400);
  }

  // 一般 workspace surface への誤接続を拒否
  const surface = String(body.surface || "").trim();
  if (surface && surface !== OPENROUTER_POC_SURFACE) {
    return jsonResponse(
      { error: "openrouter_poc_surface_required", reply: "", ok: false },
      403
    );
  }
  body.surface = OPENROUTER_POC_SURFACE;

  const entry = resolveRequestedModel(body);
  if (!entry) {
    return jsonResponse(
      {
        ok: false,
        error: OPENROUTER_ERROR_CODES.unknown_model,
        reply: "",
      },
      400
    );
  }

  const { messages, message } = buildMessages(body);
  if (!message) {
    return jsonResponse({ error: "message is required", reply: "" }, 400);
  }

  const requestId = newUsageRequestId();
  const usageOnce = createUsageLogOnce();
  const actor = await resolveUsageActor({
    req,
    bodyUserId: body.user_id ?? body.userId,
  });
  const usageFeature = normalizeGuardFeature(undefined, body);
  const routingMeta = sanitizeRoutingMetadata(body.routing);
  const orMeta = buildOpenRouterUsageMetadata(entry, {
    source: "openrouter-chat",
    surface: OPENROUTER_POC_SURFACE,
    ...routingMeta,
  });

  const quotaEntry = await enforceGuardOpenRouterPocEntry(req, {
    ...body,
    surface: OPENROUTER_POC_SURFACE,
    workspaceModelId: entry.workspaceId,
    enable_openrouter: body.enable_openrouter ?? body.enableOpenRouter,
    plan_id: body.plan_id ?? body.planId,
    admin_override: body.admin_override ?? body.adminOverride,
  });

  if (quotaEntry.blocked) {
    let denyCode = "quota_denied";
    try {
      const payload = await quotaEntry.blocked.clone().json();
      denyCode = String(payload?.error || denyCode).slice(0, 128);
    } catch {
      /* ignore */
    }
    await usageOnce.record({
      requestId,
      userId: actor.userId,
      anonymousId: actor.anonymousId,
      feature: usageFeature,
      provider: "openrouter",
      model: entry.openrouterModelSlug,
      status: USAGE_STATUS_DENIED,
      estimatedCost: null,
      errorCode: denyCode,
      metadata: {
        ...orMeta,
        http_status: quotaEntry.blocked.status,
      },
    });
    return quotaEntry.blocked;
  }

  if (!apiKey) {
    await usageOnce.record({
      requestId,
      userId: actor.userId,
      anonymousId: actor.anonymousId,
      feature: usageFeature,
      provider: "openrouter",
      model: entry.openrouterModelSlug,
      status: USAGE_STATUS_ERROR,
      estimatedCost: null,
      errorCode: OPENROUTER_ERROR_CODES.secret_missing,
      metadata: {
        ...orMeta,
        http_status: 503,
      },
    });
    return jsonResponse(
      {
        ok: false,
        error: OPENROUTER_ERROR_CODES.secret_missing,
        reply: "",
        usedOpenRouter: false,
      },
      503
    );
  }

  try {
    const result = await callOpenRouterChat({
      apiKey,
      modelSlug: entry.openrouterModelSlug,
      messages,
    });

    if (!result.ok) {
      await usageOnce.record({
        requestId,
        userId: actor.userId,
        anonymousId: actor.anonymousId,
        feature: usageFeature,
        provider: "openrouter",
        model: entry.openrouterModelSlug,
        status: USAGE_STATUS_ERROR,
        estimatedCost: null,
        errorCode: String(result.error).slice(0, 128),
        metadata: {
          ...orMeta,
          http_status: result.httpStatus,
        },
      });
      return jsonResponse(
        {
          ok: false,
          reply: "",
          usedOpenRouter: false,
          error: result.error,
          route_type: "openrouter",
        },
        result.httpStatus
      );
    }

    await finalizeGuardOpenRouterPocConsume(req, {
      ...body,
      surface: OPENROUTER_POC_SURFACE,
    });

    const usage = result.usage;
    await usageOnce.record({
      requestId,
      userId: actor.userId,
      anonymousId: actor.anonymousId,
      feature: usageFeature,
      provider: "openrouter",
      model: entry.openrouterModelSlug,
      status: USAGE_STATUS_SUCCESS,
      inputUnits: usage.inputUnits,
      outputUnits: usage.outputUnits,
      totalUnits: usage.totalUnits,
      estimatedCost: null,
      metadata: {
        ...orMeta,
        http_status: 200,
        usage_source: usage.usageSource,
      },
    });

    return jsonResponse({
      ok: true,
      reply: result.reply,
      usedOpenRouter: true,
      model: entry.openrouterModelSlug,
      executedModel: result.model,
      route_type: "openrouter",
      upstream_provider: entry.upstreamProvider,
      workspaceId: entry.workspaceId,
      // PoC fallback hooks are documented but Production-disabled
      fallback_used: false,
      productionEnabled: false,
    });
  } catch (err) {
    await usageOnce.record({
      requestId,
      userId: actor.userId,
      anonymousId: actor.anonymousId,
      feature: usageFeature,
      provider: "openrouter",
      model: entry.openrouterModelSlug,
      status: USAGE_STATUS_ERROR,
      estimatedCost: null,
      errorCode: "openrouter_exception",
      metadata: {
        ...orMeta,
        http_status: 502,
      },
    });
    console.error("[openrouter-chat] failed:", err);
    return jsonResponse(
      {
        ok: false,
        reply: "",
        usedOpenRouter: false,
        error: "openrouter_error",
      },
      502
    );
  }
});
