/**
 * OpenAI Realtime Session — ephemeral client_secret issuance (Edge-only · no secrets in response body)
 */

export const VOICE_REALTIME_SURFACES = Object.freeze([
  "tasful_ai",
  "builder_ai",
  "ops_secretary",
] as const);

export type VoiceRealtimeSurface = (typeof VOICE_REALTIME_SURFACES)[number];

export type RealtimeSessionRequest = {
  surface?: string;
  model?: string;
  voice?: string;
};

export type RealtimeSessionCredential = {
  type: "ephemeral_token";
  value: string;
  expiresAt: string;
};

export type RealtimeSessionSuccess = {
  ok: true;
  endpoint: string;
  model: string;
  credential: RealtimeSessionCredential;
  surface: VoiceRealtimeSurface;
};

export type RealtimeSessionFailure = {
  ok: false;
  error: string;
  surface?: string;
};

export type RealtimeSessionResult =
  | { status: 200; body: RealtimeSessionSuccess }
  | { status: 400 | 429 | 502 | 503; body: RealtimeSessionFailure };

const DEFAULT_REALTIME_MODEL =
  Deno.env.get("OPENAI_REALTIME_MODEL")?.trim() || "gpt-realtime-2";

const DEFAULT_REALTIME_ENDPOINT =
  Deno.env.get("OPENAI_REALTIME_ENDPOINT")?.trim() || "wss://api.openai.com/v1/realtime";

const OPENAI_CLIENT_SECRETS_URL = "https://api.openai.com/v1/realtime/client_secrets";

const SK_PATTERN = /\bsk-[a-zA-Z0-9_-]{8,}\b/g;

function trimText(value: unknown, maxLen: number): string {
  return String(value ?? "").trim().slice(0, maxLen);
}

/** Strip accidental API key fragments from upstream error text. */
export function sanitizeErrorMessage(message: unknown): string {
  const raw = trimText(message, 500);
  if (!raw) return "realtime_session_failed";
  return raw.replace(SK_PATTERN, "[redacted]").replace(/\bsb_secret_[^\s]+/gi, "[redacted]");
}

export function isVoiceRealtimeSurface(value: string): value is VoiceRealtimeSurface {
  return (VOICE_REALTIME_SURFACES as readonly string[]).includes(value);
}

export function normalizeRealtimeSessionRequest(body: RealtimeSessionRequest): {
  ok: true;
  surface: VoiceRealtimeSurface;
  model: string;
  voice?: string;
} | {
  ok: false;
  error: string;
} {
  const surface = trimText(body?.surface, 64);
  if (!surface) {
    return { ok: false, error: "surface is required" };
  }
  if (!isVoiceRealtimeSurface(surface)) {
    return {
      ok: false,
      error: `surface must be one of: ${VOICE_REALTIME_SURFACES.join(", ")}`,
    };
  }

  const model = trimText(body?.model, 128) || DEFAULT_REALTIME_MODEL;
  const voice = trimText(body?.voice, 64);

  return {
    ok: true,
    surface,
    model,
    voice: voice || undefined,
  };
}

function epochSecondsToIso(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return new Date(Date.now() + 60_000).toISOString();
  const ms = n > 1e12 ? n : n * 1000;
  return new Date(ms).toISOString();
}

export function assertEphemeralCredentialValue(value: string): string {
  const token = trimText(value, 4096);
  if (!token) {
    throw new Error("missing_client_secret");
  }
  if (/^sk-/i.test(token)) {
    throw new Error("invalid_credential_type");
  }
  if (/^sb_secret_/i.test(token)) {
    throw new Error("invalid_credential_type");
  }
  return token;
}

type OpenAiClientSecretResponse = {
  value?: string;
  expires_at?: number;
  session?: {
    model?: string;
  };
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
};

export function mapOpenAiHttpStatus(httpStatus: number): 400 | 429 | 502 {
  if (httpStatus === 429) return 429;
  if (httpStatus >= 400 && httpStatus < 500) return 400;
  return 502;
}

/**
 * Create an OpenAI Realtime session and return only ephemeral client credentials.
 */
export async function createOpenAiRealtimeSession(input: {
  apiKey: string;
  surface: VoiceRealtimeSurface;
  model: string;
  voice?: string;
  endpoint?: string;
}): Promise<RealtimeSessionResult> {
  const apiKey = trimText(input.apiKey, 4096);
  if (!apiKey) {
    return {
      status: 503,
      body: { ok: false, error: "OPENAI_API_KEY not configured", surface: input.surface },
    };
  }

  const endpoint = trimText(input.endpoint, 512) || DEFAULT_REALTIME_ENDPOINT;
  const sessionBody: Record<string, unknown> = {
    session: {
      type: "realtime",
      model: input.model,
    },
  };
  if (input.voice) {
    (sessionBody.session as Record<string, unknown>).voice = input.voice;
  }

  let upstream: Response;
  try {
    upstream = await fetch(OPENAI_CLIENT_SECRETS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(sessionBody),
    });
  } catch (err) {
    return {
      status: 502,
      body: {
        ok: false,
        error: sanitizeErrorMessage(err instanceof Error ? err.message : "OpenAI request failed"),
        surface: input.surface,
      },
    };
  }

  const data = (await upstream.json().catch(() => ({}))) as OpenAiClientSecretResponse;

  if (!upstream.ok) {
    const message = sanitizeErrorMessage(data?.error?.message || `openai_${upstream.status}`);
    return {
      status: mapOpenAiHttpStatus(upstream.status),
      body: { ok: false, error: message, surface: input.surface },
    };
  }

  let tokenValue: string;
  try {
    tokenValue = assertEphemeralCredentialValue(String(data?.value || ""));
  } catch (err) {
    return {
      status: 502,
      body: {
        ok: false,
        error: sanitizeErrorMessage(err instanceof Error ? err.message : "missing_client_secret"),
        surface: input.surface,
      },
    };
  }

  const resolvedModel = trimText(data?.session?.model, 128) || input.model;
  const expiresAt = epochSecondsToIso(data?.expires_at);

  return {
    status: 200,
    body: {
      ok: true,
      endpoint,
      model: resolvedModel,
      surface: input.surface,
      credential: {
        type: "ephemeral_token",
        value: tokenValue,
        expiresAt,
      },
    },
  };
}
