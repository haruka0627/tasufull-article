import { handleOptions, jsonResponse } from "../_shared/cors.ts";

type RequestBody = {
  code?: string;
  redirectUri?: string;
  nonce?: string;
};

const ERROR_CODES = {
  INVALID_REQUEST: "INVALID_REQUEST",
  INVALID_CODE: "INVALID_CODE",
  NONCE_MISMATCH: "NONCE_MISMATCH",
  TOKEN_EXCHANGE_FAILED: "TOKEN_EXCHANGE_FAILED",
  ID_TOKEN_INVALID: "ID_TOKEN_INVALID",
  CONFIG_MISSING: "CONFIG_MISSING",
  NETWORK_ERROR: "NETWORK_ERROR",
  UNKNOWN: "UNKNOWN",
} as const;

function trim(value: unknown, maxLen = 4000): string {
  return String(value ?? "").trim().slice(0, maxLen);
}

function isMockMode(): boolean {
  const flag = Deno.env.get("ANPI_LINE_TOKEN_MOCK")?.trim();
  if (flag === "1" || flag === "true") return true;
  const secret = Deno.env.get("LINE_LOGIN_CHANNEL_SECRET")?.trim();
  const channelId = Deno.env.get("LINE_LOGIN_CHANNEL_ID")?.trim();
  return !secret || !channelId;
}

function b64UrlDecode(segment: string): Uint8Array {
  const padded = segment.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? padded : padded + "=".repeat(4 - (padded.length % 4));
  const binary = atob(pad);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

function decodeJwtPart<T>(segment: string): T {
  const json = new TextDecoder().decode(b64UrlDecode(segment));
  return JSON.parse(json) as T;
}

type JwkKey = { kid?: string; kty?: string; alg?: string; use?: string; n?: string; e?: string };

async function verifyIdTokenSignature(
  idToken: string,
  channelId: string
): Promise<Record<string, unknown>> {
  const parts = idToken.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid ID token format");
  }

  const header = decodeJwtPart<{ alg?: string; kid?: string }>(parts[0]);
  const payload = decodeJwtPart<Record<string, unknown>>(parts[1]);

  if (header.alg !== "RS256") {
    throw new Error("Unsupported ID token algorithm");
  }

  const certsRes = await fetch("https://api.line.me/oauth2/v2.1/certs");
  if (!certsRes.ok) {
    throw new Error("Failed to fetch LINE certs");
  }
  const certsJson = (await certsRes.json()) as { keys?: JwkKey[] };
  const jwk = (certsJson.keys || []).find((k) => k.kid === header.kid);
  if (!jwk?.n || !jwk?.e) {
    throw new Error("LINE cert key not found");
  }

  const key = await crypto.subtle.importKey(
    "jwk",
    { kty: "RSA", n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const signature = b64UrlDecode(parts[2]);
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    signature,
    data
  );
  if (!valid) {
    throw new Error("ID token signature invalid");
  }

  const iss = String(payload.iss || "");
  const aud = String(payload.aud || "");
  const exp = Number(payload.exp || 0);
  const sub = String(payload.sub || "").trim();

  if (iss !== "https://access.line.me") {
    throw new Error("Invalid iss");
  }
  if (aud !== channelId) {
    throw new Error("Invalid aud");
  }
  if (!exp || exp * 1000 < Date.now()) {
    throw new Error("ID token expired");
  }
  if (!sub) {
    throw new Error("Missing sub");
  }

  return payload;
}

function verifyNonce(payload: Record<string, unknown>, nonce: string) {
  const expected = trim(nonce, 200);
  if (!expected) return;
  if (String(payload.nonce || "") !== expected) {
    throw new Error("Nonce mismatch");
  }
}

function failResponse(
  error_code: string,
  error_message: string,
  extra: Record<string, unknown> = {}
) {
  return jsonResponse({
    success: false,
    error_code,
    error_message,
    ...extra,
  });
}

function mockExchange(code: string, nonce: string) {
  if (code === "invalid_code_e2e" || code.startsWith("invalid_")) {
    return failResponse(ERROR_CODES.INVALID_CODE, "Invalid authorization code", { mock: true });
  }
  if (nonce === "bad_nonce_e2e") {
    return failResponse(ERROR_CODES.NONCE_MISMATCH, "Nonce mismatch", { mock: true });
  }
  const expires_at = new Date(Date.now() + 3600 * 1000).toISOString();
  return jsonResponse({
    success: true,
    userId: `U_mock_${code.slice(0, 16)}`,
    access_token: `mock_at_${Date.now()}`,
    expires_at,
    mock: true,
  });
}

async function exchangeLineToken(
  code: string,
  redirectUri: string,
  channelId: string,
  channelSecret: string
) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: channelId,
    client_secret: channelSecret,
  });

  const res = await fetch("https://api.line.me/oauth2/v2.1/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    return {
      ok: false as const,
      error_message: String(data.error_description || data.error || `HTTP ${res.status}`),
    };
  }

  const access_token = trim(data.access_token, 500);
  const id_token = trim(data.id_token, 8000);
  const expires_in = Number(data.expires_in || 0);

  if (!access_token || !id_token) {
    return { ok: false as const, error_message: "Token response incomplete" };
  }

  const expires_at = new Date(
    Date.now() + (expires_in > 0 ? expires_in * 1000 : 3600 * 1000)
  ).toISOString();

  return {
    ok: true as const,
    access_token,
    id_token,
    expires_at,
  };
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  if (req.method !== "POST") {
    return jsonResponse({ success: false, message: "Method not allowed" }, 405);
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return failResponse(ERROR_CODES.INVALID_REQUEST, "Invalid JSON body");
  }

  const code = trim(body.code, 500);
  const redirectUri = trim(body.redirectUri, 500);
  const nonce = trim(body.nonce, 200);

  if (!code || !redirectUri) {
    return failResponse(ERROR_CODES.INVALID_REQUEST, "code and redirectUri are required");
  }

  if (isMockMode()) {
    return mockExchange(code, nonce);
  }

  const channelId = Deno.env.get("LINE_LOGIN_CHANNEL_ID")?.trim() || "";
  const channelSecret = Deno.env.get("LINE_LOGIN_CHANNEL_SECRET")?.trim() || "";

  if (!channelId || !channelSecret) {
    return failResponse(ERROR_CODES.CONFIG_MISSING, "LINE Login credentials not configured");
  }

  try {
    const tokenResult = await exchangeLineToken(code, redirectUri, channelId, channelSecret);
    if (!tokenResult.ok) {
      return failResponse(
        ERROR_CODES.TOKEN_EXCHANGE_FAILED,
        tokenResult.error_message || "LINE token exchange failed"
      );
    }

    let payload: Record<string, unknown>;
    try {
      payload = await verifyIdTokenSignature(tokenResult.id_token, channelId);
      verifyNonce(payload, nonce);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const codeKey = msg.includes("Nonce")
        ? ERROR_CODES.NONCE_MISMATCH
        : ERROR_CODES.ID_TOKEN_INVALID;
      return failResponse(codeKey, msg);
    }

    const userId = String(payload.sub || "").trim();
    if (!userId) {
      return failResponse(ERROR_CODES.ID_TOKEN_INVALID, "userId (sub) missing in ID token");
    }

    return jsonResponse({
      success: true,
      userId,
      access_token: tokenResult.access_token,
      expires_at: tokenResult.expires_at,
      mock: false,
    });
  } catch (err) {
    const error_message = err instanceof Error ? err.message : String(err);
    return failResponse(ERROR_CODES.NETWORK_ERROR, error_message);
  }
});
