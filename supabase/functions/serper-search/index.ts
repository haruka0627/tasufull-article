import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { executeWebSearch, trimQuery } from "../_shared/web-search-provider.ts";
import { WORKSPACE_FEATURE_TEXT, resolveAuthenticatedWorkspaceUser } from "../_shared/ai-workspace-quota.ts";
import { enforceGuardFeatureEntry, finalizeGuardFeatureConsume } from "../_shared/ai-usage-guard.ts";
import {
  createUsageLogOnce,
  newUsageRequestId,
  USAGE_STATUS_DENIED,
  USAGE_STATUS_ERROR,
  USAGE_STATUS_SUCCESS,
} from "../_shared/ai-usage-log.ts";

type RequestBody = {
  query?: string;
  num?: number;
  surface?: string;
  user_id?: string;
  userId?: string;
};

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, message: "Method not allowed" }, 405, req);
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return jsonResponse({ ok: false, message: "Invalid JSON body" }, 400, req);
  }

  const query = trimQuery(body.query);
  if (!query) {
    return jsonResponse({ ok: false, message: "query is required" }, 400, req);
  }

  const num = Math.min(10, Math.max(1, Number(body.num) || 5));
  const guardBody = { ...body, surface: String(body.surface || "").trim() || "ai-workspace" };
  const requestId = newUsageRequestId();
  const usageOnce = createUsageLogOnce();
  const actor = await resolveAuthenticatedWorkspaceUser(req, guardBody);
  if (!actor.ok) {
    await usageOnce.record({
      requestId,
      feature: WORKSPACE_FEATURE_TEXT,
      provider: "serper",
      status: USAGE_STATUS_DENIED,
      errorCode: actor.error,
      metadata: { surface: "ai-workspace", use_case: "search" },
    });
    return jsonResponse({ ok: false, error: actor.error }, actor.http, req);
  }
  const guard = await enforceGuardFeatureEntry(req, guardBody, {
    edgeName: "serper-search",
    quotaFeature: WORKSPACE_FEATURE_TEXT,
    requireSurface: true,
  });
  if (guard.blocked) {
    await usageOnce.record({
      requestId,
      userId: actor.userId,
      feature: WORKSPACE_FEATURE_TEXT,
      provider: "serper",
      status: USAGE_STATUS_DENIED,
      errorCode: guard.status?.error || "guard_denied",
      metadata: { surface: "ai-workspace", use_case: "search" },
    });
    return guard.blocked;
  }

  try {
    const result = await executeWebSearch(query, num, {
      WEB_SEARCH_PROVIDER: Deno.env.get("WEB_SEARCH_PROVIDER") ?? undefined,
      BRAVE_SEARCH_API_KEY: Deno.env.get("BRAVE_SEARCH_API_KEY") ?? undefined,
      SERPER_API_KEY: Deno.env.get("SERPER_API_KEY") ?? undefined,
      BRAVE_SEARCH_COUNTRY: Deno.env.get("BRAVE_SEARCH_COUNTRY") ?? undefined,
      BRAVE_SEARCH_LANG: Deno.env.get("BRAVE_SEARCH_LANG") ?? undefined,
    });

    if (!result.ok) {
      await usageOnce.record({
        requestId,
        userId: actor.userId,
        feature: WORKSPACE_FEATURE_TEXT,
        provider: "serper",
        status: USAGE_STATUS_ERROR,
        errorCode: "search_provider_error",
        metadata: { surface: "ai-workspace", use_case: "search", http_status: result.httpStatus },
      });
      return jsonResponse(
        {
          ok: false,
          error: "search_unavailable",
          provider: result.provider,
        },
        result.httpStatus,
        req
      );
    }
    await finalizeGuardFeatureConsume(req, guardBody, WORKSPACE_FEATURE_TEXT);
    await usageOnce.record({
      requestId,
      userId: actor.userId,
      feature: WORKSPACE_FEATURE_TEXT,
      provider: "serper",
      status: USAGE_STATUS_SUCCESS,
      metadata: { surface: "ai-workspace", use_case: "search" },
    });

    return jsonResponse(
      {
        ok: true,
        query: result.query,
        results: result.results,
        provider: result.provider,
      },
      200,
      req
    );
  } catch {
    await usageOnce.record({
      requestId,
      userId: actor.userId,
      feature: WORKSPACE_FEATURE_TEXT,
      provider: "serper",
      status: USAGE_STATUS_ERROR,
      errorCode: "search_unavailable",
      metadata: { surface: "ai-workspace", use_case: "search" },
    });
    return jsonResponse({ ok: false, error: "search_unavailable" }, 502, req);
  }
});
