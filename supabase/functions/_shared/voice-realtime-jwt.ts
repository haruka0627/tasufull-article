/**
 * Voice Realtime Edge — optional JWT authorization (Hardening Phase 2)
 * Gateway / client contract unchanged — opt-in via VOICE_REALTIME_REQUIRE_JWT=1
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1?target=deno";

export const VOICE_REALTIME_REQUIRE_JWT_ENV = "VOICE_REALTIME_REQUIRE_JWT";

export type VoiceJwtAuthResult =
  | { ok: true; userId: string; skipped: boolean }
  | { ok: false; status: 401 | 503; error: string };

export function isVoiceRealtimeJwtRequired(envValue: string | undefined | null): boolean {
  return String(envValue ?? "").trim() === "1";
}

function extractBearerToken(req: Request): string {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || "";
}

/** When REQUIRE_JWT=0, returns skipped=true (backward compatible). */
export async function authorizeVoiceRealtimeRequest(req: Request): Promise<VoiceJwtAuthResult> {
  if (!isVoiceRealtimeJwtRequired(Deno.env.get(VOICE_REALTIME_REQUIRE_JWT_ENV))) {
    return { ok: true, userId: "anonymous", skipped: true };
  }

  const token = extractBearerToken(req);
  if (!token) {
    return { ok: false, status: 401, error: "missing_bearer_token" };
  }

  const url = Deno.env.get("SUPABASE_URL")?.trim();
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")?.trim();
  if (!url || !anonKey) {
    return { ok: false, status: 503, error: "supabase_auth_not_configured" };
  }

  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user?.id) {
    return { ok: false, status: 401, error: "invalid_jwt" };
  }

  return { ok: true, userId: data.user.id, skipped: false };
}

export function voiceJwtFailureResponse(result: Extract<VoiceJwtAuthResult, { ok: false }>) {
  return {
    status: result.status,
    body: { ok: false as const, error: result.error },
  };
}
