/**
 * Gemini TTS プロキシ（Cloudflare Pages Function）
 * Secret: GEMINI_API_KEY · クライアントへキーは渡さない
 */
import { policyFromGenAiPlan, isFeatureAllowedForPolicy } from "../_shared/ai-plan-policy.mjs";
import { recordAiUsageEvent, newUsageRequestId } from "../_shared/ai-usage-log.mjs";

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

const GEMINI_TTS_MODEL = "gemini-2.5-flash-preview-tts";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const MAX_TEXT_LENGTH = 5000;

/**
 * PCM base64 → WAV base64 変換（16bit mono PCM → WAV ヘッダー付与）
 */
function pcmToWavBase64(pcmBase64, sampleRate) {
  const pcmBytes = Uint8Array.from(atob(pcmBase64), (c) => c.charCodeAt(0));
  const dataLen = pcmBytes.length;
  const headerLen = 44;
  const wav = new Uint8Array(headerLen + dataLen);
  const view = new DataView(wav.buffer);

  // RIFF header
  writeStr(view, 0, "RIFF");
  view.setUint32(4, 36 + dataLen, true);
  writeStr(view, 8, "WAVE");

  // fmt chunk
  writeStr(view, 12, "fmt ");
  view.setUint32(16, 16, true);        // chunk size
  view.setUint16(20, 1, true);         // PCM format
  view.setUint16(22, 1, true);         // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true);         // block align
  view.setUint16(34, 16, true);        // bits per sample

  // data chunk
  writeStr(view, 36, "data");
  view.setUint32(40, dataLen, true);
  wav.set(pcmBytes, 44);

  // base64 encode
  let binary = "";
  for (let i = 0; i < wav.length; i++) {
    binary += String.fromCharCode(wav[i]);
  }
  return btoa(binary);
}

function writeStr(view, offset, str) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

async function resolveAuthenticatedUser(request, env, body) {
  const match = String(request.headers.get("Authorization") || "").match(/^Bearer\s+(\S+)$/i);
  const token = match?.[1] || "";
  const url = String(env.TASFUL_SUPABASE_URL || env.SUPABASE_URL || "").replace(/\/$/, "");
  const anonKey = String(env.TASFUL_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || "").trim();
  if (!token || !url || !anonKey) return { ok: false, error: "auth_required", http: 401 };
  try {
    const res = await fetch(`${url}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
    });
    const user = res.ok ? await res.json() : null;
    const userId = String(user?.id || "").trim();
    if (!userId) return { ok: false, error: "auth_required", http: 401 };
    const claimed = String(body?.user_id ?? body?.userId ?? "").trim();
    if (claimed && claimed !== userId) return { ok: false, error: "user_mismatch", http: 403 };
    return { ok: true, userId, url };
  } catch {
    return { ok: false, error: "auth_required", http: 401 };
  }
}

async function enforceTtsGuard(request, env, body) {
  const actor = await resolveAuthenticatedUser(request, env, body);
  if (!actor.ok) return actor;
  const serviceRoleKey = String(env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!serviceRoleKey) return { ok: false, error: "usage_guard_unavailable", http: 503 };
  try {
    const planRes = await fetch(`${actor.url}/rest/v1/gen_ai_subscriptions?user_id=eq.${encodeURIComponent(actor.userId)}&select=plan_code,plan_label,daily_text_limit,status,subscription_status&limit=1`, {
      headers: { Authorization: `Bearer ${serviceRoleKey}`, apikey: serviceRoleKey },
    });
    const rows = planRes.ok ? await planRes.json() : null;
    if (!Array.isArray(rows)) throw new Error("plan_unavailable");
    const row = rows[0];
    const policy = policyFromGenAiPlan(row ? {
      plan: row.plan_code, label: row.plan_label, dailyTextLimit: row.daily_text_limit,
      status: row.status, subscriptionStatus: row.subscription_status,
    } : null);
    if (!isFeatureAllowedForPolicy(policy, "text_to_speech")) {
      return { ok: false, error: "plan_feature_denied", http: 403, userId: actor.userId, planId: policy.planId };
    }
    const limit = Number(policy.dailyTextLimit);
    const quota = await fetch(`${actor.url}/rest/v1/rpc/check_ai_workspace_quota`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRoleKey}`, apikey: serviceRoleKey },
      body: JSON.stringify({ p_user_id: actor.userId, p_date_jst: new Date().toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" }), p_feature: "text_turn", p_limit: limit }),
    });
    const status = quota.ok ? await quota.json() : null;
    if (!status || status.allowed !== true) return { ok: false, error: "quota_exceeded", http: 402, userId: actor.userId };
    return { ok: true, userId: actor.userId, url: actor.url, serviceRoleKey, limit };
  } catch {
    return { ok: false, error: "usage_guard_unavailable", http: 503, userId: actor.userId };
  }
}

async function consumeTtsQuota(guard) {
  const res = await fetch(`${guard.url}/rest/v1/rpc/consume_ai_workspace_quota`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${guard.serviceRoleKey}`, apikey: guard.serviceRoleKey },
    body: JSON.stringify({ p_user_id: guard.userId, p_date_jst: new Date().toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" }), p_feature: "text_turn", p_limit: guard.limit }),
  });
  const row = res.ok ? await res.json() : null;
  return row?.ok === true;
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === "OPTIONS") return handleOptions();
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const text = String(body?.text || "").trim();
  if (!text) {
    return jsonResponse({ error: "text is required" }, 400);
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return jsonResponse({ error: `text exceeds ${MAX_TEXT_LENGTH} characters` }, 400);
  }
  const requestId = newUsageRequestId();
  const guard = await enforceTtsGuard(request, env, { ...body, surface: "ai-workspace" });
  if (!guard.ok) {
    await recordAiUsageEvent({
      requestId, userId: guard.userId || null, feature: "text_turn", provider: "gemini",
      model: GEMINI_TTS_MODEL, status: "denied", errorCode: guard.error,
      metadata: { surface: "ai-workspace", use_case: "tts" },
    }, env);
    return jsonResponse({ ok: false, error: guard.error, planId: guard.planId }, guard.http);
  }

  const apiKey = String(env.GEMINI_API_KEY || "").trim();
  if (!apiKey) {
    return jsonResponse({ error: "provider_configuration_error", provider: "gemini" }, 503);
  }

  const voice = String(body?.voice || "Puck").trim();

  // Gemini TTS 用のプロンプト：読み上げのみを指示
  const prompt = `以下のテキストを自然な日本語で読み上げてください。読み上げ以外の応答は一切不要です。\n\n${text}`;

  const url = `${GEMINI_API_BASE}/${GEMINI_TTS_MODEL}:generateContent`;

  try {
    const geminiRes = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: voice,
              },
            },
          },
        },
      }),
    });

    const data = await geminiRes.json().catch(() => ({}));

    if (!geminiRes.ok) {
      await recordAiUsageEvent({
        requestId, userId: guard.userId, feature: "text_turn", provider: "gemini",
        model: GEMINI_TTS_MODEL, status: "error", errorCode: "provider_error",
        metadata: { surface: "ai-workspace", use_case: "tts", http_status: geminiRes.status },
      }, env);
      return jsonResponse(
        { error: "provider_unavailable" },
        502,
      );
    }

    // 音声データを抽出
    let audioBase64 = "";
    let audioMimeType = "";
    const parts = data?.candidates?.[0]?.content?.parts;
    if (Array.isArray(parts)) {
      for (const part of parts) {
        if (part.inlineData?.mimeType?.startsWith("audio/") && part.inlineData?.data) {
          audioBase64 = part.inlineData.data;
          audioMimeType = part.inlineData.mimeType || "";
          break;
        }
      }
    }

    if (!audioBase64) {
      await recordAiUsageEvent({
        requestId, userId: guard.userId, feature: "text_turn", provider: "gemini",
        model: GEMINI_TTS_MODEL, status: "error", errorCode: "invalid_provider_response",
        metadata: { surface: "ai-workspace", use_case: "tts" },
      }, env);
      return jsonResponse(
        { error: "provider_unavailable" },
        502,
      );
    }

    // PCM → WAV 変換（ブラウザ再生用）
    const pcmMatch = audioMimeType.match(/rate=(\d+)/);
    const sampleRate = pcmMatch ? parseInt(pcmMatch[1], 10) : 24000;
    const wavBase64 = pcmToWavBase64(audioBase64, sampleRate);
    if (!(await consumeTtsQuota(guard))) return jsonResponse({ error: "quota_exceeded" }, 402);
    await recordAiUsageEvent({
      requestId, userId: guard.userId, feature: "text_turn", provider: "gemini",
      model: GEMINI_TTS_MODEL, status: "success",
      metadata: { surface: "ai-workspace", use_case: "tts" },
    }, env);

    return jsonResponse({
      ok: true,
      audioBase64: wavBase64,
      mimeType: "audio/wav",
      voice,
      textLength: text.length,
    });
  } catch {
    await recordAiUsageEvent({
      requestId, userId: guard.userId, feature: "text_turn", provider: "gemini",
      model: GEMINI_TTS_MODEL, status: "error", errorCode: "provider_unavailable",
      metadata: { surface: "ai-workspace", use_case: "tts" },
    }, env);
    return jsonResponse({ error: "provider_unavailable" }, 502);
  }
}
