/**
 * POST /api/ai-exec-gate/create — Phase B3 Gate create + preflight (no executor).
 * Ops JWT only · Staging enforced via B1 preflight · service_role audit writes.
 */
import {
  gateOptionsResponse,
  gateJsonResponse,
  readJsonBody,
  requireGateRequestAuth,
  serviceResultToResponse,
} from "../../_shared/ai-exec-gate-http.mjs";
import { createGateExecution } from "../../_shared/ai-exec-gate-service.mjs";

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

  try {
    const result = await createGateExecution({
      env,
      body: parsed.body,
      userId: auth.userId,
    });
    return serviceResultToResponse(result, "POST, OPTIONS");
  } catch (e) {
    console.error("[ai-exec-gate-create]", { code: "internal_error" });
    return gateJsonResponse(
      { ok: false, error: "internal_error" },
      500,
      "POST, OPTIONS"
    );
  }
}
