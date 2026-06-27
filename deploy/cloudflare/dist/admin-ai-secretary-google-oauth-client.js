/**
 * AI秘書 Phase 6-B — Google OAuth client (Edge only · tokens never exposed)
 */
(function (global) {
  "use strict";

  const OAUTH_FN = "secretary-google-oauth";
  const TOOLS_FN = "secretary-google-tools";
  const DEV_USER_KEY = "tasu_secretary_google_dev_user_v1";
  const AUTH_USER_UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  function trim(value, max) {
    return String(value ?? "").trim().slice(0, max || 4000);
  }

  function isValidAuthUserUuid(value) {
    return AUTH_USER_UUID_RE.test(trim(value, 80));
  }

  function decodeJwtSub(token) {
    const raw = trim(token, 12000);
    if (!raw || raw.split(".").length < 2) return "";
    try {
      const part = raw.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      const pad = part.length % 4 === 0 ? part : part + "=".repeat(4 - (part.length % 4));
      const payload = JSON.parse(global.atob(pad));
      return trim(payload.sub, 80);
    } catch {
      return "";
    }
  }

  function readStoredDevUserId() {
    try {
      const stored = trim(global.sessionStorage?.getItem(DEV_USER_KEY));
      if (!stored) return "";
      if (!isValidAuthUserUuid(stored)) {
        global.sessionStorage?.removeItem(DEV_USER_KEY);
        return "";
      }
      return stored;
    } catch {
      return "";
    }
  }

  function persistDevUserId(uid) {
    if (!isValidAuthUserUuid(uid)) return;
    try {
      global.sessionStorage?.setItem(DEV_USER_KEY, uid);
    } catch {
      /* ignore */
    }
  }

  /** Dev E2E: ?secretary_auth_uid=<auth.users.id> を一度だけ取り込み URL から除去 */
  function consumeBootstrapAuthUserFromQuery() {
    try {
      const params = new URLSearchParams(global.location?.search || "");
      const raw = trim(params.get("secretary_auth_uid"));
      if (!isValidAuthUserUuid(raw)) return;
      global.__SECRETARY_GOOGLE_AUTH_USER_ID__ = raw;
      persistDevUserId(raw);
      params.delete("secretary_auth_uid");
      const next = `${global.location.pathname}${params.toString() ? `?${params}` : ""}${global.location.hash || ""}`;
      global.history?.replaceState?.({}, "", next);
    } catch {
      /* ignore */
    }
  }

  /** auth.users.id (UUID) — TALK u_me / demo id は使わない */
  function resolveSecretaryAuthUserId() {
    consumeBootstrapAuthUserFromQuery();

    const explicit = trim(global.__SECRETARY_GOOGLE_AUTH_USER_ID__);
    if (isValidAuthUserUuid(explicit)) return explicit;

    const cfgId = trim(global.TASU_CHAT_SUPABASE_CONFIG?.secretaryGoogleAuthUserId);
    if (isValidAuthUserUuid(cfgId)) return cfgId;

    try {
      const opsToken = trim(global.sessionStorage?.getItem("tasu_ops_admin_access_token"));
      const opsSub = decodeJwtSub(opsToken);
      if (isValidAuthUserUuid(opsSub)) return opsSub;
    } catch {
      /* ignore */
    }

    try {
      const auth = global.TasuAuthCurrentUser;
      const session = auth?.readSupabaseAuthSession?.();
      const sessionUserId = trim(session?.user?.id);
      if (isValidAuthUserUuid(sessionUserId)) return sessionUserId;
      const claimsSub = trim(auth?.getCurrentUserClaims?.()?.sub);
      if (isValidAuthUserUuid(claimsSub)) return claimsSub;
    } catch {
      /* ignore */
    }

    return readStoredDevUserId();
  }

  function getDevUserId() {
    const uid = resolveSecretaryAuthUserId();
    if (uid) persistDevUserId(uid);
    return uid;
  }

  function clearDevUserIdCache() {
    try {
      global.sessionStorage?.removeItem(DEV_USER_KEY);
    } catch {
      /* ignore */
    }
  }

  function getFunctionsBase() {
    const explicit = trim(global.__SECRETARY_GOOGLE_FUNCTIONS_BASE__);
    if (explicit) return explicit.replace(/\/$/, "");
    const match = trim(global.__MATCH_FUNCTIONS_BASE__);
    if (match) return match.replace(/\/$/, "");
    const cfg = global.TASU_CHAT_SUPABASE_CONFIG || {};
    const url = trim(cfg.url).replace(/\/$/, "");
    return url ? `${url}/functions/v1` : "";
  }

  function getAnonKey() {
    return trim(global.TASU_CHAT_SUPABASE_CONFIG?.anonKey, 8000);
  }

  function getAuthBearer() {
    try {
      const ops = trim(global.sessionStorage?.getItem("tasu_ops_admin_access_token"));
      if (ops) return ops;
    } catch {
      /* ignore */
    }
    return getAnonKey();
  }

  function edgeHeaders(extra) {
    const headers = {
      "Content-Type": "application/json",
      apikey: getAnonKey(),
      Authorization: `Bearer ${getAuthBearer()}`,
      "x-secretary-dev-user-id": getDevUserId(),
    };
    if (extra && typeof extra === "object") Object.assign(headers, extra);
    return headers;
  }

  function fnUrl(name) {
    const base = getFunctionsBase();
    return base ? `${base}/${name}` : "";
  }

  async function postAction(fnName, payload) {
    const url = fnUrl(fnName);
    if (!url) {
      return { ok: false, error: "functions_base_unconfigured" };
    }
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: edgeHeaders(),
        body: JSON.stringify(payload || {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { ok: false, error: trim(data.error || `http_${res.status}`), data, httpStatus: res.status };
      }
      return { ok: data.ok !== false, data, httpStatus: res.status };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  function getOAuthCallbackUrl() {
    const configured = trim(global.__SECRETARY_GOOGLE_OAUTH_CALLBACK_URL__);
    if (configured) return configured;
    const base = fnUrl(OAUTH_FN);
    return base ? `${base}?action=callback` : "";
  }

  async function fetchStatus() {
    const result = await postAction(OAUTH_FN, { action: "status" });
    if (!result.ok) return { ok: false, connected: false, error: result.error, data: result.data };
    const d = result.data || {};
    return {
      ok: true,
      connected: Boolean(d.connected),
      configured: Boolean(d.configured),
      mock: Boolean(d.mock),
      googleAccountEmail: d.googleAccountEmail || null,
      scope: d.scope || null,
      expiresAt: d.expiresAt || null,
    };
  }

  async function startConnect() {
    const redirectUri = getOAuthCallbackUrl();
    const result = await postAction(OAUTH_FN, {
      action: "connect",
      redirectUri,
      promptConsent: true,
    });
    if (!result.ok) return result;
    const d = result.data || {};
    if (d.mock && d.state) {
      const mockCb = await postAction(OAUTH_FN, {
        action: "mock_callback",
        state: d.state,
        code: `mock_code_${String(d.state).slice(0, 8)}`,
      });
      return mockCb;
    }
  if (d.authUrl) {
    return { ok: true, redirect: true, authUrl: String(d.authUrl) };
  }
    return { ok: false, error: "connect_response_invalid" };
  }

  async function disconnect() {
    return postAction(OAUTH_FN, { action: "disconnect" });
  }

  async function refresh() {
    return postAction(OAUTH_FN, { action: "refresh" });
  }

  async function fetchToolsHealth() {
    return postAction(TOOLS_FN, { action: "health" });
  }

  function scanForSecrets(obj) {
    const text = JSON.stringify(obj || {});
    return /refresh_token|access_token|client_secret|code_verifier|mock_refresh_|mock_access_/i.test(text);
  }

  global.TasuSecretaryGoogleOAuthClient = {
    OAUTH_FN,
    TOOLS_FN,
    getFunctionsBase,
    getOAuthCallbackUrl,
    isValidAuthUserUuid,
    resolveSecretaryAuthUserId,
    getDevUserId,
    clearDevUserIdCache,
    postAction,
    fetchStatus,
    startConnect,
    disconnect,
    refresh,
    fetchToolsHealth,
    scanForSecrets,
  };
})(typeof window !== "undefined" ? window : globalThis);
