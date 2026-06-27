/**
 * AI秘書 Phase 6-B — Google OAuth Edge (connect · callback · status · disconnect · refresh skeleton)
 * POST JSON { action } or GET ?action=callback for Google redirect
 */
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import {
  buildGoogleAuthUrl,
  consumeOAuthPending,
  DEFAULT_GOOGLE_OAUTH_SCOPES,
  deleteTokenVault,
  exchangeGoogleCode,
  generatePkcePair,
  getSecretaryGoogleConfig,
  getServiceSupabase,
  mockTokenExchange,
  readVaultPublicStatus,
  refreshGoogleToken,
  resolveSecretaryUserId,
  sanitizeForClient,
  saveOAuthPending,
  upsertTokenVault,
} from "../_shared/secretary-google-oauth.ts";

type JsonAction =
  | "connect"
  | "status"
  | "disconnect"
  | "refresh"
  | "mock_callback";

function dashboardRedirectUrl(params: Record<string, string>): string {
  const base =
    Deno.env.get("SECRETARY_GOOGLE_POST_CONNECT_URL")?.trim() ||
    "http://127.0.0.1:8788/admin-operations-dashboard.html";
  const u = new URL(base);
  u.hash = "ops-ai-command-center";
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return u.toString();
}

async function handleConnect(req: Request, body: Record<string, unknown>) {
  const userId = resolveSecretaryUserId(req);
  if (!userId) {
    return jsonResponse({ ok: false, error: "unauthorized" }, 401, req);
  }

  const config = getSecretaryGoogleConfig(
    typeof body.redirectUri === "string" ? body.redirectUri : undefined
  );
  const scopes = String(body.scopes || DEFAULT_GOOGLE_OAUTH_SCOPES);
  const pkce = await generatePkcePair();

  if (!config.redirectUri) {
    return jsonResponse({ ok: false, error: "redirect_uri_not_configured" }, 503, req);
  }

  if (config.mock) {
    await saveOAuthPending({
      state: pkce.state,
      userId,
      codeVerifier: pkce.codeVerifier,
      redirectUri: config.redirectUri,
      scopes,
    });
    return jsonResponse(
      sanitizeForClient({
        ok: true,
        mock: true,
        configured: false,
        state: pkce.state,
        authUrl: `${config.redirectUri}?code=mock_code_${pkce.state.slice(0, 8)}&state=${pkce.state}`,
      }),
      200,
      req
    );
  }

  if (!config.configured) {
    return jsonResponse({ ok: false, error: "google_oauth_not_configured" }, 503, req);
  }

  const saved = await saveOAuthPending({
    state: pkce.state,
    userId,
    codeVerifier: pkce.codeVerifier,
    redirectUri: config.redirectUri,
    scopes,
  });
  if (!saved.ok) {
    return jsonResponse({ ok: false, error: saved.error || "pending_save_failed" }, 500, req);
  }

  const authUrl = buildGoogleAuthUrl({
    clientId: config.clientId,
    redirectUri: config.redirectUri,
    state: pkce.state,
    codeChallenge: pkce.codeChallenge,
    scopes,
    prompt: body.promptConsent === false ? "select_account" : "consent",
  });

  return jsonResponse(
    sanitizeForClient({ ok: true, mock: false, configured: true, state: pkce.state, authUrl }),
    200,
    req
  );
}

async function handleCallback(req: Request, params: URLSearchParams) {
  const code = String(params.get("code") || "").trim();
  const state = String(params.get("state") || "").trim();
  const oauthError = String(params.get("error") || "").trim();

  if (oauthError) {
    return Response.redirect(dashboardRedirectUrl({ google_oauth: "error", reason: oauthError }), 302);
  }
  if (!code || !state) {
    return Response.redirect(dashboardRedirectUrl({ google_oauth: "error", reason: "missing_code" }), 302);
  }

  const pending = await consumeOAuthPending(state);
  if (!pending.ok || !pending.userId || !pending.codeVerifier || !pending.redirectUri) {
    return Response.redirect(
      dashboardRedirectUrl({ google_oauth: "error", reason: pending.error || "invalid_state" }),
      302
    );
  }

  const config = getSecretaryGoogleConfig(pending.redirectUri);
  let tokenResult;
  if (config.mock) {
    tokenResult = mockTokenExchange(code);
  } else {
    if (!config.configured) {
      return Response.redirect(dashboardRedirectUrl({ google_oauth: "error", reason: "not_configured" }), 302);
    }
    tokenResult = await exchangeGoogleCode({
      code,
      redirectUri: pending.redirectUri,
      codeVerifier: pending.codeVerifier,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
    });
  }

  if (!tokenResult.ok || !tokenResult.accessToken) {
    return Response.redirect(
      dashboardRedirectUrl({ google_oauth: "error", reason: tokenResult.error || "exchange_failed" }),
      302
    );
  }

  const saved = await upsertTokenVault({
    userId: pending.userId,
    email: tokenResult.email,
    accessToken: tokenResult.accessToken,
    refreshToken: tokenResult.refreshToken,
    scope: tokenResult.scope,
    expiresAt: tokenResult.expiresAt,
  });
  if (!saved.ok) {
    return Response.redirect(dashboardRedirectUrl({ google_oauth: "error", reason: saved.error || "vault_failed" }), 302);
  }

  return Response.redirect(dashboardRedirectUrl({ google_oauth: "success" }), 302);
}

async function handleStatus(req: Request) {
  const userId = resolveSecretaryUserId(req);
  if (!userId) {
    return jsonResponse({ ok: false, error: "unauthorized" }, 401, req);
  }
  const status = await readVaultPublicStatus(userId);
  return jsonResponse(sanitizeForClient(status as unknown as Record<string, unknown>), status.ok ? 200 : 503, req);
}

async function handleDisconnect(req: Request) {
  const userId = resolveSecretaryUserId(req);
  if (!userId) {
    return jsonResponse({ ok: false, error: "unauthorized" }, 401, req);
  }
  const result = await deleteTokenVault(userId);
  if (!result.ok) {
    return jsonResponse({ ok: false, error: result.error || "disconnect_failed" }, 500, req);
  }
  return jsonResponse({ ok: true, disconnected: true }, 200, req);
}

async function handleRefresh(req: Request) {
  const userId = resolveSecretaryUserId(req);
  if (!userId) {
    return jsonResponse({ ok: false, error: "unauthorized" }, 401, req);
  }

  const config = getSecretaryGoogleConfig();
  if (config.mock) {
    return jsonResponse(
      sanitizeForClient({
        ok: true,
        mock: true,
        refreshed: true,
        expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
      }),
      200,
      req
    );
  }

  const sb = getServiceSupabase();
  if (!sb) {
    return jsonResponse({ ok: false, error: "supabase_service_unconfigured" }, 503, req);
  }

  const { data, error } = await sb
    .from("secretary_google_token_vault")
    .select("refresh_token, google_account_email, scope")
    .eq("user_id", userId)
    .eq("provider", "google")
    .maybeSingle();

  if (error) {
    return jsonResponse({ ok: false, error: error.message }, 500, req);
  }
  const refreshToken = String(data?.refresh_token || "").trim();
  if (!refreshToken) {
    return jsonResponse({ ok: false, error: "not_connected" }, 404, req);
  }
  if (!config.configured) {
    return jsonResponse({ ok: false, error: "google_oauth_not_configured" }, 503, req);
  }

  const refreshed = await refreshGoogleToken({
    refreshToken,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
  });
  if (!refreshed.ok || !refreshed.accessToken) {
    return jsonResponse({ ok: false, error: refreshed.error || "refresh_failed" }, 502, req);
  }

  const saved = await upsertTokenVault({
    userId,
    email: data?.google_account_email ? String(data.google_account_email) : undefined,
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken,
    scope: refreshed.scope || (data?.scope ? String(data.scope) : undefined),
    expiresAt: refreshed.expiresAt,
  });
  if (!saved.ok) {
    return jsonResponse({ ok: false, error: saved.error || "vault_update_failed" }, 500, req);
  }

  return jsonResponse(
    sanitizeForClient({
      ok: true,
      refreshed: true,
      expiresAt: refreshed.expiresAt,
    }),
    200,
    req
  );
}

async function handleMockCallback(req: Request, body: Record<string, unknown>) {
  const userId = resolveSecretaryUserId(req);
  if (!userId) {
    return jsonResponse({ ok: false, error: "unauthorized" }, 401, req);
  }
  const state = String(body.state || "").trim();
  const code = String(body.code || `mock_code_${state.slice(0, 8)}`).trim();
  if (!state) {
    return jsonResponse({ ok: false, error: "state_required" }, 400, req);
  }

  const config = getSecretaryGoogleConfig();
  if (!config.mock) {
    return jsonResponse({ ok: false, error: "mock_mode_disabled" }, 403, req);
  }

  const pending = await consumeOAuthPending(state);
  if (!pending.ok) {
    return jsonResponse({ ok: false, error: pending.error || "invalid_state" }, 400, req);
  }

  const tokenResult = mockTokenExchange(code);
  if (!tokenResult.ok || !tokenResult.accessToken) {
    return jsonResponse({ ok: false, error: tokenResult.error || "mock_exchange_failed" }, 400, req);
  }

  const saved = await upsertTokenVault({
    userId: pending.userId || userId,
    email: tokenResult.email,
    accessToken: tokenResult.accessToken,
    refreshToken: tokenResult.refreshToken,
    scope: tokenResult.scope,
    expiresAt: tokenResult.expiresAt,
  });
  if (!saved.ok) {
    return jsonResponse({ ok: false, error: saved.error || "vault_failed" }, 500, req);
  }

  const status = await readVaultPublicStatus(pending.userId || userId);
  return jsonResponse(sanitizeForClient({ ...status, mockCallback: true }), 200, req);
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  const url = new URL(req.url);
  const queryAction = url.searchParams.get("action");

  if (req.method === "GET" && queryAction === "callback") {
    return handleCallback(req, url.searchParams);
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405, req);
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const action = String(body.action || queryAction || "").trim();

  switch (action) {
    case "connect":
      return handleConnect(req, body);
    case "status":
      return handleStatus(req);
    case "disconnect":
      return handleDisconnect(req);
    case "refresh":
      return handleRefresh(req);
    case "mock_callback":
      return handleMockCallback(req, body);
    default:
      return jsonResponse({ ok: false, error: "unknown_action" }, 400, req);
  }
});
