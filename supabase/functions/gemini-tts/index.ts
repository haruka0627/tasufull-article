/**
 * Gemini TTS Edge Function
 * フロントからテキストを受け取り、Gemini API で音声合成して base64 で返す。
 * APIキーはサーバーサイドのみで参照し、フロントに露出させない。
 */
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { WORKSPACE_FEATURE_TEXT } from "../_shared/ai-workspace-quota.ts";
import { enforceGuardFeatureEntry, finalizeGuardFeatureConsume } from "../_shared/ai-usage-guard.ts";
import {
  createUsageLogOnce,
  newUsageRequestId,
  USAGE_STATUS_DENIED,
  USAGE_STATUS_ERROR,
  USAGE_STATUS_SUCCESS,
} from "../_shared/ai-usage-log.ts";

const GEMINI_TTS_MODEL = "gemini-2.5-flash-preview-tts";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const MAX_TEXT_LENGTH = 5000;
const DEFAULT_VOICE = "Puck"; // Gemini のデフォルト音声
const DEFAULT_LANGUAGE = "ja-JP";

interface TtsRequestBody {
  text?: string;
  voice?: string;
  language?: string;
  surface?: string;
  session_id?: string;
  user_id?: string;
  userId?: string;
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, req);
  }

  let body: TtsRequestBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400, req);
  }

  const text = String(body?.text || "").trim();
  if (!text) {
    return jsonResponse({ error: "text is required" }, 400, req);
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return jsonResponse({ error: `text exceeds ${MAX_TEXT_LENGTH} characters` }, 400, req);
  }
  const guardBody = { ...body, surface: String(body.surface || "").trim() || "ai-workspace" };
  const requestId = newUsageRequestId();
  const usageOnce = createUsageLogOnce();
  const guard = await enforceGuardFeatureEntry(req, guardBody, {
    edgeName: "gemini-tts",
    quotaFeature: WORKSPACE_FEATURE_TEXT,
    requireSurface: true,
  });
  if (guard.blocked) {
    await usageOnce.record({
      requestId,
      feature: WORKSPACE_FEATURE_TEXT,
      provider: "gemini",
      model: GEMINI_TTS_MODEL,
      status: USAGE_STATUS_DENIED,
      errorCode: guard.status?.error || "guard_denied",
      metadata: { surface: "ai-workspace", use_case: "tts" },
    });
    return guard.blocked;
  }
  const userId = guard.status?.userId || null;
  const apiKey = Deno.env.get("GEMINI_API_KEY")?.trim();
  if (!apiKey) {
    await usageOnce.record({
      requestId, userId, feature: WORKSPACE_FEATURE_TEXT, provider: "gemini",
      model: GEMINI_TTS_MODEL, status: USAGE_STATUS_ERROR, errorCode: "provider_unavailable",
      metadata: { surface: "ai-workspace", use_case: "tts" },
    });
    return jsonResponse({ error: "provider_unavailable" }, 503, req);
  }

  const voice = String(body?.voice || DEFAULT_VOICE).trim();
  const language = String(body?.language || DEFAULT_LANGUAGE).trim();

  const prompt = `以下のテキストを自然な日本語で読み上げてください。読み上げ以外の応答は一切不要です。\n\n${text}`;

  const url = `${GEMINI_API_BASE}/${GEMINI_TTS_MODEL}:generateContent?key=${apiKey}`;

  try {
    const geminiRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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

    if (!geminiRes.ok) {
      await usageOnce.record({
        requestId, userId, feature: WORKSPACE_FEATURE_TEXT, provider: "gemini",
        model: GEMINI_TTS_MODEL, status: USAGE_STATUS_ERROR, errorCode: "provider_error",
        metadata: { surface: "ai-workspace", use_case: "tts", http_status: geminiRes.status },
      });
      return jsonResponse(
        { error: "provider_unavailable" },
        502,
        req,
      );
    }

    const data = await geminiRes.json();

    // Gemini の応答から音声データ（base64）を抽出
    let audioBase64 = "";
    const parts = data?.candidates?.[0]?.content?.parts;
    if (Array.isArray(parts)) {
      for (const part of parts) {
        if (part.inlineData?.mimeType?.startsWith("audio/") && part.inlineData?.data) {
          audioBase64 = part.inlineData.data;
          break;
        }
      }
    }

    if (!audioBase64) {
      await usageOnce.record({
        requestId, userId, feature: WORKSPACE_FEATURE_TEXT, provider: "gemini",
        model: GEMINI_TTS_MODEL, status: USAGE_STATUS_ERROR, errorCode: "invalid_provider_response",
        metadata: { surface: "ai-workspace", use_case: "tts" },
      });
      return jsonResponse(
        { error: "provider_unavailable" },
        502,
        req,
      );
    }

    const consumed = await finalizeGuardFeatureConsume(req, guardBody, WORKSPACE_FEATURE_TEXT);
    if (consumed && !consumed.ok) return jsonResponse({ error: "quota_exceeded" }, 402, req);
    await usageOnce.record({
      requestId, userId, feature: WORKSPACE_FEATURE_TEXT, provider: "gemini",
      model: GEMINI_TTS_MODEL, status: USAGE_STATUS_SUCCESS,
      metadata: { surface: "ai-workspace", use_case: "tts" },
    });
    return jsonResponse(
      {
        ok: true,
        audioBase64,
        mimeType: "audio/wav",
        voice,
        language,
        textLength: text.length,
      },
      200,
      req,
    );
  } catch {
    await usageOnce.record({
      requestId, userId, feature: WORKSPACE_FEATURE_TEXT, provider: "gemini",
      model: GEMINI_TTS_MODEL, status: USAGE_STATUS_ERROR, errorCode: "provider_unavailable",
      metadata: { surface: "ai-workspace", use_case: "tts" },
    });
    return jsonResponse({ error: "provider_unavailable" }, 502, req);
  }
});