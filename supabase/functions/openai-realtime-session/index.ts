/**
 * Voice Core Phase 5-C — OpenAI Realtime ephemeral session token (Edge only)
 * POST /functions/v1/openai-realtime-session
 */
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import {
  checkVoiceRealtimeRateLimit,
  extractVoiceRealtimeClientIp,
  isVoiceRealtimeEdgeEnabled,
  voiceRealtimeDisabledFailure,
  VOICE_REALTIME_KILL_SWITCH_ENV,
} from "../_shared/voice-realtime-edge-guard.ts";
import {
  createOpenAiRealtimeSession,
  normalizeRealtimeSessionRequest,
  type RealtimeSessionRequest,
} from "../_shared/openai-realtime-session.ts";

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405, req);
  }

  if (!isVoiceRealtimeEdgeEnabled(Deno.env.get(VOICE_REALTIME_KILL_SWITCH_ENV))) {
    const disabled = voiceRealtimeDisabledFailure();
    return jsonResponse(disabled.body, disabled.status, req);
  }

  const clientIp = extractVoiceRealtimeClientIp(req);
  const rateLimit = checkVoiceRealtimeRateLimit(clientIp);
  if (!rateLimit.ok) {
    return jsonResponse(rateLimit.body, rateLimit.status, req);
  }

  const apiKey = Deno.env.get("OPENAI_API_KEY")?.trim();
  if (!apiKey) {
    return jsonResponse(
      { ok: false, error: "OPENAI_API_KEY not configured" },
      503,
      req
    );
  }

  let body: RealtimeSessionRequest;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON body" }, 400, req);
  }

  const normalized = normalizeRealtimeSessionRequest(body);
  if (!normalized.ok) {
    return jsonResponse({ ok: false, error: normalized.error }, 400, req);
  }

  const result = await createOpenAiRealtimeSession({
    apiKey,
    surface: normalized.surface,
    model: normalized.model,
    voice: normalized.voice,
  });

  return jsonResponse(result.body, result.status, req);
});
