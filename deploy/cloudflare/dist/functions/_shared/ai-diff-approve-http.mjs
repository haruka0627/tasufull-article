/**
 * Diff & Approve — Staging read-only HTTP helpers (GET-only).
 */

import { authCorsHeaders } from "./supabase-jwt-auth.mjs";
import { requireGateOpsUser } from "./ai-exec-gate-ops-auth.mjs";
import { newRequestId } from "./ai-diff-approve-ops-read.mjs";

const READ_METHODS = "GET, OPTIONS";

/**
 * @param {unknown} body
 * @param {number} [status]
 * @param {string} [requestId]
 */
export function diffApproveJsonResponse(body, status = 200, requestId = "") {
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
      ...authCorsHeaders(READ_METHODS),
    },
  });
}

export function diffApproveOptionsResponse() {
  return new Response(null, {
    status: 204,
    headers: authCorsHeaders(READ_METHODS),
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
    return diffApproveOptionsResponse();
  }
  if (request.method !== "GET") {
    return diffApproveJsonResponse(
      { ok: false, error: "method_not_allowed" },
      405,
      requestId
    );
  }
  return null;
}

/**
 * @param {{ ok: boolean, http?: number, error?: string, body?: Record<string, unknown> }} result
 * @param {string} [requestId]
 */
export function opsResultToResponse(result, requestId = "") {
  if (result.ok && result.body) {
    return diffApproveJsonResponse(result.body, result.http || 200, requestId);
  }
  return diffApproveJsonResponse(
    { ok: false, error: result.error || "internal_error" },
    result.http || 500,
    requestId
  );
}
