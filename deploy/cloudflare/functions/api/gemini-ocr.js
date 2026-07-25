/**
 * Gemini OCR プロキシ（Cloudflare Pages Function）
 *
 * Secret: GEMINI_API_KEY（クライアントへ渡さない）
 * Auth: Authorization Bearer → Supabase `/auth/v1/user` で検証（全 surface）
 * Origin: same-origin + production / preview / local allowlist
 * IP rate limit: CF-Connecting-IP · HMAC bucket · atomic RPC（auth / quota / Gemini より前）
 * Payload: MIME · base64 · size · magic bytes（guard / Gemini より前）
 * Upstream: fixed timeout + sanitized errors
 * Quota: upstream 実行前に atomic 予約 → 成功のみ確定 · 失敗系は解放
 * SAFE-05: 許可 surface すべて Usage Guard（user ID / feature は server-derived）
 */
import {
  enforceCfOcrGuard,
  finalizeCfOcrConsume,
  getOcrQuotaFeature,
  normalizeOcrSurface,
  releaseCfOcrReservation,
} from "../_shared/ai-usage-guard.mjs";
import { enforceOcrIpRateLimit } from "../_shared/ocr-ip-rate-limit.mjs";
import { validateOcrPayload } from "../_shared/ocr-payload-validation.mjs";

const PRODUCTION_ORIGINS = new Set([
  "https://tasful.jp",
  "https://www.tasful.jp",
  "https://tasufull-article.pages.dev",
]);
const LOCAL_ORIGINS = new Set([
  "http://127.0.0.1:8788",
  "http://localhost:8788",
]);
const PAGES_PREVIEW_HOST =
  /^(?:cf-pages-deploy|[a-f0-9]{8})\.tasufull-article\.pages\.dev$/;
const GEMINI_UPSTREAM_TIMEOUT_MS = 15_000;

function corsHeaders(origin) {
  if (!origin) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    Vary: "Origin",
  };
}

function jsonResponse(body, status = 200, origin = "") {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...corsHeaders(origin),
    },
  });
}

function withCors(response, origin) {
  const headers = new Headers(response.headers);
  Object.entries(corsHeaders(origin)).forEach(([name, value]) => headers.set(name, value));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function isAllowedOrigin(origin) {
  if (PRODUCTION_ORIGINS.has(origin) || LOCAL_ORIGINS.has(origin)) return true;
  try {
    const parsed = new URL(origin);
    return (
      parsed.origin === origin &&
      parsed.protocol === "https:" &&
      parsed.port === "" &&
      PAGES_PREVIEW_HOST.test(parsed.hostname)
    );
  } catch {
    return false;
  }
}

function resolveRequestOrigin(request) {
  const rawOrigin = request.headers.get("Origin");
  if (!rawOrigin || rawOrigin === "null" || rawOrigin !== rawOrigin.trim()) return "";
  if (!isAllowedOrigin(rawOrigin)) return "";
  try {
    if (new URL(request.url).origin !== rawOrigin) return "";
  } catch {
    return "";
  }
  return rawOrigin;
}

function originForbidden() {
  return jsonResponse({ ok: false, error: "origin_forbidden", provider: "gemini" }, 403);
}

function handleOptions(origin) {
  return new Response(null, {
    status: 204,
    headers: {
      ...corsHeaders(origin),
      "Access-Control-Allow-Methods": "POST",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Max-Age": "600",
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
    let data;
    try {
      data = await res.json();
    } catch {
      return { ok: false, error: "auth_unavailable", status: 503 };
    }
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
async function requireAuthenticatedUser(request, env, origin) {
  const parsed = parseBearerToken(request);
  if (parsed.error) {
    return jsonResponse({ ok: false, error: parsed.error, provider: "gemini" }, 401, origin);
  }

  const { url, anonKey } = getSupabaseAuthConfig(env);
  if (!url || !anonKey) {
    return jsonResponse(
      { ok: false, error: "auth_unavailable", provider: "gemini" },
      503,
      origin
    );
  }

  const verified = await verifySupabaseJwt(parsed.token, url, anonKey);
  if (!verified.ok) {
    return jsonResponse(
      { ok: false, error: verified.error, provider: "gemini" },
      verified.status,
      origin
    );
  }
  return { ok: true, userId: verified.userId };
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== "POST" && request.method !== "OPTIONS") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  }

  const origin = resolveRequestOrigin(request);
  if (!origin) return originForbidden();
  if (request.method === "OPTIONS") return handleOptions(origin);

  // IP rate limit — auth / payload / quota / Gemini より前（DoS · burst 抑制）
  const rate = await enforceOcrIpRateLimit(request, env, origin);
  if (rate.blocked) return withCors(rate.blocked, origin);

  const auth = await requireAuthenticatedUser(request, env, origin);
  if (auth instanceof Response) return auth;
  const authenticatedUserId = auth.userId;

  const apiKey = String(env.GEMINI_API_KEY || "").trim();
  if (!apiKey) {
    return jsonResponse(
      { ok: false, error: "provider_configuration_error", provider: "gemini" },
      503,
      origin
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(
      { ok: false, error: "invalid_request", provider: "gemini" },
      400,
      origin
    );
  }

  const surface = normalizeOcrSurface(body?.surface);
  if (!surface) {
    return jsonResponse(
      { ok: false, error: "invalid_surface", provider: "gemini" },
      400,
      origin
    );
  }

  // 案A: payload 検証 → guard → Gemini（不正 payload で quota RPC を叩かない）
  const payload = validateOcrPayload(body);
  if (!payload.ok) {
    return jsonResponse(
      { ok: false, error: payload.error, provider: "gemini" },
      payload.status,
      origin
    );
  }

  const guardBody = Object.assign({}, body && typeof body === "object" ? body : {}, {
    user_id: authenticatedUserId,
    surface,
    feature: getOcrQuotaFeature(),
  });

  const guard = await enforceCfOcrGuard(request, guardBody, env);
  if (guard.blocked) return withCors(guard.blocked, origin);

  const outcome = await requestGeminiOcr(apiKey, payload);

  if (!outcome.ok) {
    // 予約は必ずここ一箇所で解放する（catch/finally の二重解放を作らない）
    await releaseCfOcrReservation(guard.reservation);
    return jsonResponse(
      { ok: false, error: outcome.error, provider: "gemini" },
      outcome.status,
      origin
    );
  }

  if (guard.shouldConsume) {
    await finalizeCfOcrConsume(guard.meta, guard.reservation);
  }

  return jsonResponse({
    ok: true,
    text: outcome.text,
    provider: "gemini",
  }, 200, origin);
}

/**
 * Gemini upstream 呼び出し（固定 timeout · sanitized error taxonomy）
 * @returns {Promise<{ ok: true, text: string } | { ok: false, error: string, status: number }>}
 */
async function requestGeminiOcr(apiKey, payload) {
  const url = `${GEMINI_API_BASE}/${GEMINI_OCR_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const controller = new AbortController();
  let timer = null;

  try {
    timer = setTimeout(() => controller.abort(), GEMINI_UPSTREAM_TIMEOUT_MS);
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
      signal: controller.signal,
    });

    if (!geminiRes.ok) {
      if (geminiRes.status === 400) {
        return { ok: false, error: "upstream_request_failed", status: 502 };
      }
      if (geminiRes.status === 401 || geminiRes.status === 403) {
        return { ok: false, error: "provider_configuration_error", status: 503 };
      }
      if (geminiRes.status === 429) {
        return { ok: false, error: "upstream_rate_limited", status: 503 };
      }
      return { ok: false, error: "upstream_unavailable", status: 502 };
    }

    let geminiJson;
    try {
      geminiJson = await geminiRes.json();
    } catch {
      return { ok: false, error: "invalid_upstream_response", status: 502 };
    }

    const candidate = geminiJson?.candidates?.[0];
    const finishReason = String(candidate?.finishReason || "").toUpperCase();
    if (["SAFETY", "BLOCKLIST", "PROHIBITED_CONTENT", "RECITATION"].includes(finishReason)) {
      return { ok: false, error: "ocr_unavailable", status: 422 };
    }
    const parts = candidate?.content?.parts;
    if (!Array.isArray(parts) || !parts.some((part) => typeof part?.text === "string")) {
      return { ok: false, error: "invalid_upstream_response", status: 502 };
    }
    const text = parts
      .filter((part) => typeof part?.text === "string")
      .map((part) => part.text)
      .join("\n")
      .trim();

    return { ok: true, text };
  } catch (error) {
    if (error?.name === "AbortError") {
      return { ok: false, error: "upstream_timeout", status: 504 };
    }
    return { ok: false, error: "upstream_unavailable", status: 502 };
  } finally {
    if (timer !== null) clearTimeout(timer);
  }
}
