/**
 * POST /api/tasful-option-access
 *
 * Staging-only Premium Option access check (Phase 8E).
 * Authorization: Bearer <Supabase access_token>
 * Body: { option_id } — user_id optional (mismatch detect only; never trusted)
 *
 * Does not authorize via localStorage / client flags.
 * Cache-Control: no-store.
 */
import {
  handleOptions,
  jsonResponse,
  resolveOptionAccessRequest,
} from "../_shared/tasful-option-access.mjs";

export async function onRequest(context) {
  const { request } = context;
  if (request.method === "OPTIONS") return handleOptions();
  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const result = await resolveOptionAccessRequest(request, context.env, body);
  if (!result.ok) {
    return jsonResponse(
      {
        ok: false,
        error: result.error,
        access: null,
      },
      result.http || 403,
    );
  }

  return jsonResponse({
    ok: true,
    access: result.access,
    detail: result.detail,
  });
}
