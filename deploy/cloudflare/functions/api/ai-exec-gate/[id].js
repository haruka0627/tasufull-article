/**
 * GET /api/ai-exec-gate/:id — Phase B3 sanitized execution status.
 */
import {
  gateOptionsResponse,
  gateJsonResponse,
  requireGateRequestAuth,
  serviceResultToResponse,
} from "../../_shared/ai-exec-gate-http.mjs";
import { getGateExecution } from "../../_shared/ai-exec-gate-service.mjs";

export async function onRequest(context) {
  const { request, env, params } = context;
  if (request.method === "OPTIONS") {
    return gateOptionsResponse("GET, OPTIONS");
  }
  if (request.method !== "GET") {
    return gateJsonResponse(
      { ok: false, error: "method_not_allowed" },
      405,
      "GET, OPTIONS"
    );
  }

  const auth = await requireGateRequestAuth(request, env);
  if (!auth.ok) {
    return gateJsonResponse(
      { ok: false, error: auth.error },
      auth.http || 401,
      "GET, OPTIONS"
    );
  }

  const executionId = String(params?.id || "").trim();
  try {
    const result = await getGateExecution({
      env,
      executionId,
      userId: auth.userId,
    });
    return serviceResultToResponse(result, "GET, OPTIONS");
  } catch (e) {
    console.error("[ai-exec-gate-get]", { code: "internal_error" });
    return gateJsonResponse(
      { ok: false, error: "internal_error" },
      500,
      "GET, OPTIONS"
    );
  }
}
