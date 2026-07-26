/**
 * AI 運営秘書 — DeepSeek プロキシ（Cloudflare Pages Function）
 * Secret: DEEPSEEK_API_KEY · クライアントへキーは渡さない
 * Auth: Authorization Bearer <Supabase access_token> 必須（Provider 呼出前に fail-closed）
 */
import {
  buildSecretaryMessages,
  callDeepSeekChatCompletions,
  jsonResponse,
  resolveDeepSeekModel,
} from "../_shared/secretary-deepseek.mjs";
import {
  authCorsHeaders,
  requireSupabaseUser,
} from "../_shared/supabase-jwt-auth.mjs";

const SURFACE = "ops_secretary";
const MAX_BODY_BYTES = 64 * 1024;

function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: authCorsHeaders("POST, OPTIONS"),
  });
}

function readContentLength(request) {
  const raw = request.headers.get("Content-Length");
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === "OPTIONS") return handleOptions();
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed", reply: "", code: "method_not_allowed" }, 405);
  }

  // Auth before reading secrets / calling DeepSeek
  const auth = await requireSupabaseUser(request, env, {});
  if (!auth.ok) {
    return jsonResponse(
      {
        error: auth.error,
        code: auth.error,
        reply: "",
        usedDeepSeek: false,
      },
      auth.http || 401,
    );
  }

  const contentLength = readContentLength(request);
  if (contentLength != null && contentLength > MAX_BODY_BYTES) {
    return jsonResponse(
      { error: "payload_too_large", code: "payload_too_large", reply: "", usedDeepSeek: false },
      413,
    );
  }

  const apiKey = String(env.DEEPSEEK_API_KEY || "").trim();
  if (!apiKey) {
    return jsonResponse(
      {
        error: "DEEPSEEK_API_KEY not configured",
        code: "provider_not_configured",
        reply: "",
        usedDeepSeek: false,
        configured: false,
      },
      503,
    );
  }

  let body;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) {
      return jsonResponse(
        { error: "payload_too_large", code: "payload_too_large", reply: "", usedDeepSeek: false },
        413,
      );
    }
    body = text ? JSON.parse(text) : {};
  } catch {
    return jsonResponse({ error: "Invalid JSON body", code: "invalid_json", reply: "" }, 400);
  }

  // Client-claimed user id is never trusted; mismatch → 403
  const claimed = String(body.user_id ?? body.userId ?? "").trim();
  if (claimed && claimed !== auth.userId) {
    return jsonResponse(
      {
        error: "user_mismatch",
        code: "user_mismatch",
        reply: "",
        usedDeepSeek: false,
      },
      403,
    );
  }

  // Client must not override model (server env only)
  if (body.model != null && String(body.model).trim()) {
    return jsonResponse(
      {
        error: "model_not_allowed",
        code: "model_not_allowed",
        reply: "",
        usedDeepSeek: false,
      },
      400,
    );
  }

  const surface = String(body.surface || body.mode || "").trim();
  if (surface && surface !== SURFACE) {
    return jsonResponse(
      { error: `surface must be ${SURFACE}`, reply: "", usedDeepSeek: false },
      400,
    );
  }

  const { messages, message } = buildSecretaryMessages(body);
  if (messages.length <= 1 && !message) {
    return jsonResponse({ error: "message is required", reply: "" }, 400);
  }

  const model = resolveDeepSeekModel(env);
  const result = await callDeepSeekChatCompletions(apiKey, messages, model);
  if (!result.ok) {
    const status =
      result.httpStatus === 401 || result.httpStatus === 403
        ? result.httpStatus
        : result.httpStatus === 429
          ? 429
          : 502;
    return jsonResponse(
      {
        reply: "",
        usedDeepSeek: false,
        configured: true,
        error: result.error,
        model,
      },
      status,
    );
  }

  return jsonResponse({
    reply: result.reply,
    usedDeepSeek: true,
    configured: true,
    model,
    modelLabel: "DeepSeek",
  });
}
