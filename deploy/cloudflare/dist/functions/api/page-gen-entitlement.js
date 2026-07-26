/**
 * POST /api/page-gen-entitlement
 *
 * Server-side paid GenAI → ai_page_gen_paid entitlement check.
 * Authorization: Bearer <Supabase access_token>
 * Body may include user_id only for mismatch detection (never trusted).
 */
import {
  handleOptions,
  jsonResponse,
  resolvePageGenEntitlement,
} from "../_shared/page-gen-entitlement.mjs";

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

  const result = await resolvePageGenEntitlement(request, context.env, body);
  if (!result.ok) {
    return jsonResponse(
      {
        ok: false,
        error: result.error,
        entitlement: result.entitlement || null,
      },
      result.http || 403,
    );
  }

  return jsonResponse({
    ok: true,
    entitlement: result.entitlement,
  });
}
