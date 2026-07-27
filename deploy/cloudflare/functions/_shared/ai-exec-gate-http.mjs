/**
 * AI Execution Gate — Phase B3 HTTP helpers (create / execute / get).
 */

import { authCorsHeaders } from "./supabase-jwt-auth.mjs";
import { requireGateOpsUser } from "./ai-exec-gate-ops-auth.mjs";
import { PHASE_B_MAX_BODY_BYTES } from "./ai-exec-gate-policy.mjs";

export function gateJsonResponse(body, status = 200, methods = "POST, OPTIONS") {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...authCorsHeaders(methods),
    },
  });
}

export function gateOptionsResponse(methods = "POST, OPTIONS") {
  return new Response(null, {
    status: 204,
    headers: authCorsHeaders(methods),
  });
}

export function readContentLength(request) {
  const raw = request.headers.get("Content-Length");
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {Request} request
 * @param {number} [maxBytes]
 */
export async function readJsonBody(request, maxBytes = PHASE_B_MAX_BODY_BYTES) {
  const ct = String(request.headers.get("Content-Type") || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (ct && ct !== "application/json") {
    return { ok: false, error: "unsupported_media_type", http: 415 };
  }

  const contentLength = readContentLength(request);
  if (contentLength != null && contentLength > maxBytes) {
    return { ok: false, error: "payload_too_large", http: 413 };
  }

  let text;
  try {
    text = await request.text();
  } catch {
    return { ok: false, error: "invalid_request", http: 400 };
  }
  if (text.length > maxBytes) {
    return { ok: false, error: "payload_too_large", http: 413 };
  }
  if (!text.trim()) {
    return { ok: false, error: "invalid_json", http: 400 };
  }
  try {
    return { ok: true, body: JSON.parse(text) };
  } catch {
    return { ok: false, error: "invalid_json", http: 400 };
  }
}

/**
 * Auth + ops before body/secrets.
 * @param {Request} request
 * @param {Record<string, unknown>} env
 * @param {{ fetchImpl?: typeof fetch }} [opts]
 */
export async function requireGateRequestAuth(request, env, opts = {}) {
  return requireGateOpsUser(request, env, opts);
}

/**
 * Map service result to Response.
 * @param {{ ok: boolean, http?: number, error?: string, body?: Record<string, unknown> }} result
 * @param {string} [methods]
 */
export function serviceResultToResponse(result, methods = "POST, OPTIONS") {
  if (result.body) {
    return gateJsonResponse(result.body, result.http || 200, methods);
  }
  return gateJsonResponse(
    {
      ok: false,
      error: result.error || "internal_error",
    },
    result.http || 500,
    methods
  );
}
