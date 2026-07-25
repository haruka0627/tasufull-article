/**
 * Gemini OCR プロキシ（Cloudflare Pages Function）
 *
 * Secret: GEMINI_API_KEY（クライアントへ渡さない）
 * Auth: Authorization Bearer → Supabase `/auth/v1/user` で検証（全 surface）
 * Payload: MIME · base64 · size · magic bytes（guard / Gemini より前）
 * SAFE-05: 許可 surface すべて Usage Guard（user ID / feature は server-derived）
 */
import {
  enforceCfOcrGuard,
  finalizeCfOcrConsume,
  getOcrQuotaFeature,
  normalizeOcrSurface,
} from "../_shared/ai-usage-guard.mjs";
import { validateOcrPayload } from "../_shared/ocr-payload-validation.mjs";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}

const GEMINI_OCR_MODEL = "gemini-2.5-flash";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const OCR_PROMPT =
  "Extract all visible text from this document or image. " +
  "Return plain text only. Do not summarize, translate, interpret, or add commentary. " +
  "If there is no text, return an empty string.";

function getSupabaseAuthConfig(env) {
  const url = String(env.TASFUL_SUPABASE_URL || env.SUPABASE_URL || "")
    .trim()
    .replace(/\/$/, "");
  const anonKey = String(env.TASFUL_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || "").trim();
  return { url, anonKey };
}

/**
 * Authorization: Bearer <token> を取り出す。不正構文は null。
 * @param {Request} request
 * @returns {{ token: string } | { error: string }}
 */
function parseBearerToken(request) {
  const raw = String(request.headers.get("Authorization") || "").trim();
  if (!raw) return { error: "auth_required" };
  const m = raw.match(/^Bearer\s+(\S+)$/i);
  if (!m) return { error: "auth_required" };
  const token = String(m[1] || "").trim();
  if (!token || token.toLowerCase() === "bearer") return { error: "auth_required" };
  return { token };
}

/**
 * Supabase Auth で JWT を検証し user id を返す（decode-only 禁止）
 * @returns {Promise<{ ok: true, userId: string } | { ok: false, error: string, status: number }>}
 */
async function verifySupabaseJwt(bearerToken, supabaseUrl, anonKey) {
  try {
    const res = await fetch(supabaseUrl + "/auth/v1/user", {
      headers: {
        Authorization: "Bearer " + bearerToken,
        apikey: anonKey,
      },
    });
    if (res.status >= 500) {
      return { ok: false, error: "auth_unavailable", status: 503 };
    }
    if (!res.ok) {
      return { ok: false, error: "auth_required", status: 401 };
    }
    const data = await res.json().catch(() => null);
    const userId = String(data?.id || "").trim();
    if (!userId) {
      return { ok: false, error: "auth_required", status: 401 };
    }
    return { ok: true, userId };
  } catch {
    return { ok: false, error: "auth_unavailable", status: 503 };
  }
}

/**
 * @param {Request} request
 * @param {Record<string, string>} env
 * @returns {Promise<{ ok: true, userId: string } | Response>}
 */
async function requireAuthenticatedUser(request, env) {
  const parsed = parseBearerToken(request);
  if (parsed.error) {
    return jsonResponse({ ok: false, error: parsed.error, provider: "gemini" }, 401);
  }

  const { url, anonKey } = getSupabaseAuthConfig(env);
  if (!url || !anonKey) {
    return jsonResponse({ ok: false, error: "auth_unavailable", provider: "gemini" }, 503);
  }

  const verified = await verifySupabaseJwt(parsed.token, url, anonKey);
  if (!verified.ok) {
    return jsonResponse(
      { ok: false, error: verified.error, provider: "gemini" },
      verified.status
    );
  }
  return { ok: true, userId: verified.userId };
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === "OPTIONS") return handleOptions();
  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  }

  const auth = await requireAuthenticatedUser(request, env);
  if (auth instanceof Response) return auth;
  const authenticatedUserId = auth.userId;

  const apiKey = String(env.GEMINI_API_KEY || "").trim();
  if (!apiKey) {
    return jsonResponse({ ok: false, error: "GEMINI_API_KEY not configured", provider: "gemini" }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "invalid_request", provider: "gemini" }, 400);
  }

  const surface = normalizeOcrSurface(body?.surface);
  if (!surface) {
    return jsonResponse({ ok: false, error: "invalid_surface", provider: "gemini" }, 400);
  }

  // 案A: payload 検証 → guard → Gemini（不正 payload で quota RPC を叩かない）
  const payload = validateOcrPayload(body);
  if (!payload.ok) {
    return jsonResponse({ ok: false, error: payload.error, provider: "gemini" }, payload.status);
  }

  const guardBody = Object.assign({}, body && typeof body === "object" ? body : {}, {
    user_id: authenticatedUserId,
    surface,
    feature: getOcrQuotaFeature(),
  });

  const guard = await enforceCfOcrGuard(request, guardBody, env);
  if (guard.blocked) return guard.blocked;

  const url = `${GEMINI_API_BASE}/${GEMINI_OCR_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;

  try {
    const geminiRes = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: OCR_PROMPT },
              {
                inlineData: {
                  mimeType: payload.mimeType,
                  data: payload.base64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 4096,
        },
      }),
    });

    const geminiJson = await geminiRes.json().catch(() => ({}));
    if (!geminiRes.ok) {
      return jsonResponse(
        {
          ok: false,
          error: "gemini_upstream_error",
          provider: "gemini",
          status: geminiRes.status,
        },
        502
      );
    }

    const parts = geminiJson?.candidates?.[0]?.content?.parts || [];
    const text = parts
      .map((p) => String(p?.text || ""))
      .join("\n")
      .trim();

    if (guard.shouldConsume && guard.meta) {
      await finalizeCfOcrConsume(guard.meta);
    }

    return jsonResponse({
      ok: true,
      text,
      provider: "gemini",
    });
  } catch {
    return jsonResponse({ ok: false, error: "ocr_request_failed", provider: "gemini" }, 502);
  }
}
