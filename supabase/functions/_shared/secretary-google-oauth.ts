/**
 * AI秘書 Phase 6-B — Google OAuth helpers (PKCE · token exchange · refresh skeleton)
 * Secrets: SECRETARY_GOOGLE_CLIENT_ID / SECRETARY_GOOGLE_CLIENT_SECRET / SECRETARY_GOOGLE_REDIRECT_URI
 */
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export const SECRETARY_GOOGLE_CLIENT_ID_ENV = "SECRETARY_GOOGLE_CLIENT_ID";
export const SECRETARY_GOOGLE_CLIENT_SECRET_ENV = "SECRETARY_GOOGLE_CLIENT_SECRET";
export const SECRETARY_GOOGLE_REDIRECT_URI_ENV = "SECRETARY_GOOGLE_REDIRECT_URI";
export const SECRETARY_GOOGLE_OAUTH_MOCK_ENV = "SECRETARY_GOOGLE_OAUTH_MOCK";

export const DEFAULT_GOOGLE_OAUTH_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/contacts.readonly",
].join(" ");

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

export type SecretaryGoogleConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  mock: boolean;
  configured: boolean;
};

export type PkcePair = {
  codeVerifier: string;
  codeChallenge: string;
  state: string;
};

export type TokenExchangeResult = {
  ok: boolean;
  accessToken?: string;
  refreshToken?: string;
  scope?: string;
  expiresAt?: string;
  email?: string;
  error?: string;
  mock?: boolean;
};

export type PublicConnectionStatus = {
  ok: boolean;
  connected: boolean;
  configured: boolean;
  mock: boolean;
  provider: "google";
  googleAccountEmail: string | null;
  scope: string | null;
  expiresAt: string | null;
  error?: string;
};

function trim(value: unknown, max = 4000): string {
  return String(value ?? "").trim().slice(0, max);
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomString(byteLen = 32): string {
  const bytes = new Uint8Array(byteLen);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

export function isSecretaryGoogleMockMode(): boolean {
  const flag = trim(Deno.env.get(SECRETARY_GOOGLE_OAUTH_MOCK_ENV));
  if (flag === "1" || flag.toLowerCase() === "true") return true;
  const clientId = trim(Deno.env.get(SECRETARY_GOOGLE_CLIENT_ID_ENV));
  const clientSecret = trim(Deno.env.get(SECRETARY_GOOGLE_CLIENT_SECRET_ENV));
  return !clientId || !clientSecret;
}

export function getSecretaryGoogleConfig(overrideRedirectUri?: string): SecretaryGoogleConfig {
  const clientId = trim(Deno.env.get(SECRETARY_GOOGLE_CLIENT_ID_ENV));
  const clientSecret = trim(Deno.env.get(SECRETARY_GOOGLE_CLIENT_SECRET_ENV));
  const redirectUri = trim(overrideRedirectUri || Deno.env.get(SECRETARY_GOOGLE_REDIRECT_URI_ENV));
  const mock = isSecretaryGoogleMockMode();
  return {
    clientId,
    clientSecret,
    redirectUri,
    mock,
    configured: Boolean(clientId && clientSecret && redirectUri),
  };
}

export async function generatePkcePair(): Promise<PkcePair> {
  const codeVerifier = randomString(32);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(codeVerifier));
  const codeChallenge = base64UrlEncode(new Uint8Array(digest));
  const state = randomString(24);
  return { codeVerifier, codeChallenge, state };
}

export function buildGoogleAuthUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  scopes?: string;
  prompt?: string;
}): string {
  const params = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: "code",
    scope: input.scopes || DEFAULT_GOOGLE_OAUTH_SCOPES,
    state: input.state,
    code_challenge: input.codeChallenge,
    code_challenge_method: "S256",
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: input.prompt || "consent",
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = trim(token).split(".");
  if (parts.length < 2) return {};
  const padded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? padded : padded + "=".repeat(4 - (padded.length % 4));
  try {
    return JSON.parse(atob(pad)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function resolveUserIdFromJwt(authHeader: string | null): string | null {
  const raw = trim(authHeader);
  if (!raw.toLowerCase().startsWith("bearer ")) return null;
  const token = raw.slice(7).trim();
  if (!token || token.split(".").length < 2) return null;
  const payload = decodeJwtPayload(token);
  const sub = trim(payload.sub, 80);
  return sub || null;
}

export function resolveDevUserId(req: Request): string | null {
  return trim(req.headers.get("x-secretary-dev-user-id"), 80) || null;
}

export function resolveSecretaryUserId(req: Request): string | null {
  return resolveUserIdFromJwt(req.headers.get("Authorization")) || resolveDevUserId(req);
}

export function getServiceSupabase(): SupabaseClient | null {
  const url = trim(Deno.env.get("SUPABASE_URL"));
  const key = trim(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function saveOAuthPending(input: {
  state: string;
  userId: string;
  codeVerifier: string;
  redirectUri: string;
  scopes: string;
  ttlMs?: number;
}): Promise<{ ok: boolean; error?: string }> {
  const sb = getServiceSupabase();
  if (!sb) return { ok: false, error: "supabase_service_unconfigured" };
  const expiresAt = new Date(Date.now() + (input.ttlMs ?? 10 * 60 * 1000)).toISOString();
  const { error } = await sb.from("secretary_google_oauth_pending").upsert({
    state: input.state,
    user_id: input.userId,
    code_verifier: input.codeVerifier,
    redirect_uri: input.redirectUri,
    scopes: input.scopes,
    expires_at: expiresAt,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function consumeOAuthPending(state: string): Promise<{
  ok: boolean;
  userId?: string;
  codeVerifier?: string;
  redirectUri?: string;
  scopes?: string;
  error?: string;
}> {
  const sb = getServiceSupabase();
  if (!sb) return { ok: false, error: "supabase_service_unconfigured" };
  const { data, error } = await sb
    .from("secretary_google_oauth_pending")
    .select("user_id, code_verifier, redirect_uri, scopes, expires_at")
    .eq("state", state)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "oauth_state_not_found" };
  if (new Date(String(data.expires_at)).getTime() < Date.now()) {
    await sb.from("secretary_google_oauth_pending").delete().eq("state", state);
    return { ok: false, error: "oauth_state_expired" };
  }
  await sb.from("secretary_google_oauth_pending").delete().eq("state", state);
  return {
    ok: true,
    userId: String(data.user_id),
    codeVerifier: String(data.code_verifier),
    redirectUri: String(data.redirect_uri),
    scopes: String(data.scopes || ""),
  };
}

export async function upsertTokenVault(input: {
  userId: string;
  email?: string;
  accessToken: string;
  refreshToken?: string;
  scope?: string;
  expiresAt?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const sb = getServiceSupabase();
  if (!sb) return { ok: false, error: "supabase_service_unconfigured" };
  const row: Record<string, unknown> = {
    user_id: input.userId,
    provider: "google",
    google_account_email: input.email || null,
    access_token: input.accessToken,
    scope: input.scope || null,
    expires_at: input.expiresAt || null,
  };
  if (input.refreshToken) row.refresh_token = input.refreshToken;
  const { error } = await sb.from("secretary_google_token_vault").upsert(row, {
    onConflict: "user_id,provider",
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteTokenVault(userId: string): Promise<{ ok: boolean; error?: string }> {
  const sb = getServiceSupabase();
  if (!sb) return { ok: false, error: "supabase_service_unconfigured" };
  const { error } = await sb
    .from("secretary_google_token_vault")
    .delete()
    .eq("user_id", userId)
    .eq("provider", "google");
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function readVaultPublicStatus(userId: string): Promise<PublicConnectionStatus> {
  const config = getSecretaryGoogleConfig();
  const sb = getServiceSupabase();
  if (!sb) {
    return {
      ok: false,
      connected: false,
      configured: config.configured,
      mock: config.mock,
      provider: "google",
      googleAccountEmail: null,
      scope: null,
      expiresAt: null,
      error: "supabase_service_unconfigured",
    };
  }
  const { data, error } = await sb
    .from("secretary_google_token_vault")
    .select("google_account_email, scope, expires_at, refresh_token")
    .eq("user_id", userId)
    .eq("provider", "google")
    .maybeSingle();
  if (error) {
    return {
      ok: false,
      connected: false,
      configured: config.configured,
      mock: config.mock,
      provider: "google",
      googleAccountEmail: null,
      scope: null,
      expiresAt: null,
      error: error.message,
    };
  }
  const connected = Boolean(data?.refresh_token);
  return {
    ok: true,
    connected,
    configured: config.configured,
    mock: config.mock,
    provider: "google",
    googleAccountEmail: data?.google_account_email ? String(data.google_account_email) : null,
    scope: data?.scope ? String(data.scope) : null,
    expiresAt: data?.expires_at ? String(data.expires_at) : null,
  };
}

export async function exchangeGoogleCode(input: {
  code: string;
  redirectUri: string;
  codeVerifier: string;
  clientId: string;
  clientSecret: string;
}): Promise<TokenExchangeResult> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: input.redirectUri,
    client_id: input.clientId,
    client_secret: input.clientSecret,
    code_verifier: input.codeVerifier,
  });
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    return {
      ok: false,
      error: trim(data.error_description || data.error || `http_${res.status}`, 300),
    };
  }
  const accessToken = trim(data.access_token, 8000);
  const refreshToken = trim(data.refresh_token, 8000);
  const scope = trim(data.scope, 2000);
  const expiresIn = Number(data.expires_in || 0);
  if (!accessToken) return { ok: false, error: "token_response_incomplete" };
  const expiresAt = new Date(
    Date.now() + (expiresIn > 0 ? expiresIn * 1000 : 3600 * 1000)
  ).toISOString();
  let email: string | undefined;
  if (data.id_token) {
    const payload = decodeJwtPayload(String(data.id_token));
    email = trim(payload.email, 320) || undefined;
  }
  return { ok: true, accessToken, refreshToken, scope, expiresAt, email };
}

export async function refreshGoogleToken(input: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<TokenExchangeResult> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: input.refreshToken,
    client_id: input.clientId,
    client_secret: input.clientSecret,
  });
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    return {
      ok: false,
      error: trim(data.error_description || data.error || `http_${res.status}`, 300),
    };
  }
  const accessToken = trim(data.access_token, 8000);
  const refreshToken = trim(data.refresh_token, 8000) || input.refreshToken;
  const scope = trim(data.scope, 2000);
  const expiresIn = Number(data.expires_in || 0);
  if (!accessToken) return { ok: false, error: "refresh_response_incomplete" };
  const expiresAt = new Date(
    Date.now() + (expiresIn > 0 ? expiresIn * 1000 : 3600 * 1000)
  ).toISOString();
  return { ok: true, accessToken, refreshToken, scope, expiresAt };
}

export function mockTokenExchange(code: string): TokenExchangeResult {
  if (!code || code.startsWith("invalid_")) {
    return { ok: false, error: "invalid_grant", mock: true };
  }
  const email = `mock.${code.slice(0, 8)}@gmail.com`;
  return {
    ok: true,
    accessToken: `mock_access_${Date.now()}`,
    refreshToken: `mock_refresh_${code.slice(0, 16)}`,
    scope: DEFAULT_GOOGLE_OAUTH_SCOPES,
    expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
    email,
    mock: true,
  };
}

/** Strip tokens from objects before logging or client response */
export function sanitizeForClient<T extends Record<string, unknown>>(obj: T): T {
  const forbidden = new Set([
    "access_token",
    "refresh_token",
    "accessToken",
    "refreshToken",
    "client_secret",
    "clientSecret",
    "code_verifier",
    "codeVerifier",
  ]);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (forbidden.has(k)) continue;
    out[k] = v;
  }
  return out as T;
}

/** Read vault row with tokens — Edge-only (never return to client). */
export async function readTokenVaultRow(userId: string): Promise<{
  ok: boolean;
  accessToken?: string;
  refreshToken?: string;
  email?: string;
  scope?: string;
  expiresAt?: string;
  error?: string;
}> {
  const sb = getServiceSupabase();
  if (!sb) return { ok: false, error: "supabase_service_unconfigured" };
  const { data, error } = await sb
    .from("secretary_google_token_vault")
    .select("access_token, refresh_token, google_account_email, scope, expires_at")
    .eq("user_id", userId)
    .eq("provider", "google")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data?.refresh_token && !data?.access_token) return { ok: false, error: "not_connected" };
  return {
    ok: true,
    accessToken: trim(data.access_token, 8000) || undefined,
    refreshToken: trim(data.refresh_token, 8000) || undefined,
    email: data.google_account_email ? String(data.google_account_email) : undefined,
    scope: data.scope ? String(data.scope) : undefined,
    expiresAt: data.expires_at ? String(data.expires_at) : undefined,
  };
}

/** Ensure valid access token — refresh when expired/near expiry. */
export async function ensureGoogleAccessToken(userId: string): Promise<{
  ok: boolean;
  accessToken?: string;
  mock?: boolean;
  refreshed?: boolean;
  error?: string;
}> {
  const config = getSecretaryGoogleConfig();
  if (config.mock || isSecretaryGoogleMockMode()) {
    return { ok: true, accessToken: "mock_gmail_access", mock: true };
  }

  const row = await readTokenVaultRow(userId);
  if (!row.ok) return { ok: false, error: row.error || "not_connected" };

  const expiresMs = row.expiresAt ? new Date(row.expiresAt).getTime() : 0;
  const needsRefresh = !row.accessToken || !expiresMs || expiresMs < Date.now() + 60_000;

  if (!needsRefresh && row.accessToken) {
    return { ok: true, accessToken: row.accessToken, refreshed: false };
  }

  if (!row.refreshToken) {
    return { ok: false, error: "refresh_token_missing" };
  }
  if (!config.configured) {
    return { ok: false, error: "google_oauth_not_configured" };
  }

  const refreshed = await refreshGoogleToken({
    refreshToken: row.refreshToken,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
  });
  if (!refreshed.ok || !refreshed.accessToken) {
    return { ok: false, error: refreshed.error || "refresh_failed" };
  }

  const saved = await upsertTokenVault({
    userId,
    email: row.email,
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken || row.refreshToken,
    scope: refreshed.scope || row.scope,
    expiresAt: refreshed.expiresAt,
  });
  if (!saved.ok) return { ok: false, error: saved.error || "vault_update_failed" };

  return { ok: true, accessToken: refreshed.accessToken, refreshed: true };
}
