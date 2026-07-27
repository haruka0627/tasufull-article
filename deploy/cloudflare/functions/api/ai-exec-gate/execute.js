/**
 * POST /api/ai-exec-gate/execute — Phase B4 pipeline executor.
 * Deterministic collect → report → result. No external AI provider.
 */
import {
  gateOptionsResponse,
  gateJsonResponse,
  readJsonBody,
  requireGateRequestAuth,
  serviceResultToResponse,
} from "../../_shared/ai-exec-gate-http.mjs";
import { executeGatePipeline } from "../../_shared/ai-exec-gate-executor.mjs";

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === "OPTIONS") return gateOptionsResponse("POST, OPTIONS");
  if (request.method !== "POST") {
    return gateJsonResponse(
      { ok: false, error: "method_not_allowed" },
      405,
      "POST, OPTIONS"
    );
  }

  const auth = await requireGateRequestAuth(request, env);
  if (!auth.ok) {
    return gateJsonResponse(
      { ok: false, error: auth.error },
      auth.http || 401,
      "POST, OPTIONS"
    );
  }

  const parsed = await readJsonBody(request);
  if (!parsed.ok) {
    return gateJsonResponse(
      { ok: false, error: parsed.error },
      parsed.http || 400,
      "POST, OPTIONS"
    );
  }

  const executionId = String(
    parsed.body?.execution_id ?? parsed.body?.executionId ?? ""
  ).trim();

  try {
    const result = await executeGatePipeline({
      env,
      executionId,
      userId: auth.userId,
    });
    return serviceResultToResponse(result, "POST, OPTIONS");
  } catch (e) {
    console.error("[ai-exec-gate-execute]", { code: "internal_error" });
    return gateJsonResponse(
      { ok: false, error: "internal_error" },
      500,
      "POST, OPTIONS"
    );
  }
}
