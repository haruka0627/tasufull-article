/**
 * AI 運営秘書 — DeepSeek プロキシ（Cloudflare Pages Function）
 * Secret: DEEPSEEK_API_KEY · クライアントへキーは渡さない
 */
import {
  buildSecretaryMessages,
  callDeepSeekChatCompletions,
  jsonResponse,
  resolveDeepSeekModel,
} from "../_shared/secretary-deepseek.mjs";

const SURFACE = "ops_secretary";

function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === "OPTIONS") return handleOptions();
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed", reply: "" }, 405);
  }

  const apiKey = String(env.DEEPSEEK_API_KEY || "").trim();
  if (!apiKey) {
    return jsonResponse(
      {
        error: "DEEPSEEK_API_KEY not configured",
        reply: "",
        usedDeepSeek: false,
        configured: false,
      },
      503
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body", reply: "" }, 400);
  }

  const surface = String(body.surface || body.mode || "").trim();
  if (surface && surface !== SURFACE) {
    return jsonResponse(
      { error: `surface must be ${SURFACE}`, reply: "", usedDeepSeek: false },
      400
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
      status
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
