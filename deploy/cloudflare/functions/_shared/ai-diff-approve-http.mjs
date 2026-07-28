/**
 * Diff & Approve — Staging HTTP helpers (GET read + POST decision write).
 */

import { authCorsHeaders } from "./supabase-jwt-auth.mjs";
import { requireGateOpsUser } from "./ai-exec-gate-ops-auth.mjs";
import { newRequestId } from "./ai-diff-approve-ops-read.mjs";
import { PHASE_B_MAX_BODY_BYTES } from "./ai-exec-gate-policy.mjs";
import { readJsonBody } from "./ai-exec-gate-http.mjs";
import { assertDecisionWriteOrigin } from "./ai-diff-approve-ops-decision-write.mjs";

const READ_METHODS = "GET, OPTIONS";
const WRITE_METHODS = "POST, OPTIONS";

/**
 * @param {unknown} body
 * @param {number} [status]
 * @param {string} [requestId]
 * @param {string} [methods]
 */
export function diffApproveJsonResponse(
  body,
  status = 200,
  requestId = "",
  methods = READ_METHODS
) {
  const rid = newRequestId(requestId);
  const payload =
    body && typeof body === "object" && !Array.isArray(body)
      ? { .../** @type {object} */ (body), request_id: rid }
      : { ok: false, error: "internal_error", request_id: rid };
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Request-Id": rid,
      ...authCorsHeaders(methods),
    },
  });
}

export function diffApproveOptionsResponse(methods = READ_METHODS) {
  return new Response(null, {
    status: 204,
    headers: authCorsHeaders(methods),
  });
}

/**
 * @param {Request} request
 * @param {Record<string, unknown>} env
 * @param {{ fetchImpl?: typeof fetch }} [opts]
 */
export async function requireDiffApproveOpsAuth(request, env, opts = {}) {
  return requireGateOpsUser(request, env, opts);
}

/**
 * Reject non-GET write methods for Diff & Approve read routes.
 * @param {Request} request
 * @param {string} [requestId]
 */
export function rejectNonGet(request, requestId = "") {
  if (request.method === "OPTIONS") {
    return diffApproveOptionsResponse(READ_METHODS);
  }
  if (request.method !== "GET") {
    return diffApproveJsonResponse(
      { ok: false, error: "method_not_allowed" },
      405,
      requestId,
      READ_METHODS
    );
  }
  return null;
}

/**
 * Reject non-POST for decision write routes.
 * @param {Request} request
 * @param {string} [requestId]
 */
export function rejectNonPost(request, requestId = "") {
  if (request.method === "OPTIONS") {
    return diffApproveOptionsResponse(WRITE_METHODS);
  }
  if (request.method !== "POST") {
    return diffApproveJsonResponse(
      { ok: false, error: "method_not_allowed" },
      405,
      requestId,
      WRITE_METHODS
    );
  }
  return null;
}

/**
 * Origin + JSON body guards for decision write.
 * @param {Request} request
 * @param {string} [requestId]
 */
export async function prepareDecisionWriteRequest(request, requestId = "") {
  const origin = assertDecisionWriteOrigin(request);
  if (!origin.ok) {
    return {
      ok: false,
      response: diffApproveJsonResponse(
        { ok: false, error: origin.error },
        origin.http || 403,
        requestId,
        WRITE_METHODS
      ),
    };
  }
  const parsed = await readJsonBody(request, PHASE_B_MAX_BODY_BYTES);
  if (!parsed.ok) {
    return {
      ok: false,
      response: diffApproveJsonResponse(
        { ok: false, error: parsed.error },
        parsed.http || 400,
        requestId,
        WRITE_METHODS
      ),
    };
  }
  const headerKey = String(request.headers.get("Idempotency-Key") || "").trim();
  const body =
    parsed.body && typeof parsed.body === "object" && !Array.isArray(parsed.body)
      ? { .../** @type {object} */ (parsed.body) }
      : {};
  if (!body.idempotencyKey && headerKey) {
    body.idempotencyKey = headerKey;
  }
  return { ok: true, body };
}

/**
 * @param {{ ok: boolean, http?: number, error?: string, body?: Record<string, unknown> }} result
 * @param {string} [requestId]
 * @param {string} [methods]
 */
export function opsResultToResponse(
  result,
  requestId = "",
  methods = READ_METHODS
) {
  if (result.ok && result.body) {
    return diffApproveJsonResponse(
      result.body,
      result.http || 200,
      requestId,
      methods
    );
  }
  return diffApproveJsonResponse(
    { ok: false, error: result.error || "internal_error" },
    result.http || 500,
    requestId,
    methods
  );
}
