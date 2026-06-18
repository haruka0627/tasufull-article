/**
 * LINE Login 設定（クライアント）
 */
(function (global) {
  "use strict";

  const LINE_LOGIN_CHANNEL_ID = "";
  const LINE_LOGIN_SCOPES = "profile openid";
  const LINE_LOGIN_STATE_KEY = "tasu_anpi_line_login_state_v1";
  const LINE_LOGIN_NONCE_KEY = "tasu_anpi_line_login_nonce_v1";
  const LINE_AUTH_CODE_KEY = "tasu_anpi_line_auth_code_v1";

  const LINE_AUTHORIZE_URL = "https://access.line.me/oauth2/v2.1/authorize";

  function getChannelId() {
    const fromGlobal = String(global.TASU_ANPI_LINE_LOGIN_CHANNEL_ID || "").trim();
    return fromGlobal || String(LINE_LOGIN_CHANNEL_ID || "").trim();
  }

  function getRedirectUri() {
    try {
      const origin = String(global.location?.origin || "").trim();
      if (!origin || origin === "null") return "";
      return `${origin.replace(/\/$/, "")}/anpi-line-callback.html`;
    } catch {
      return "";
    }
  }

  function randomToken() {
    if (global.crypto?.getRandomValues) {
      const arr = new Uint8Array(16);
      global.crypto.getRandomValues(arr);
      return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
    }
    return `${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
  }

  function sessionGet(key) {
    try {
      return global.sessionStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function sessionSet(key, value) {
    try {
      global.sessionStorage.setItem(key, value);
    } catch {
      /* ignore */
    }
  }

  function sessionRemove(key) {
    try {
      global.sessionStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }

  function getConfig() {
    const channelId = getChannelId();
    return {
      channelId,
      redirectUri: getRedirectUri(),
      scopes: LINE_LOGIN_SCOPES,
      stateKey: LINE_LOGIN_STATE_KEY,
      nonceKey: LINE_LOGIN_NONCE_KEY,
      authCodeKey: LINE_AUTH_CODE_KEY,
      isConfigured: Boolean(channelId),
    };
  }

  /**
   * @returns {{ state: string, nonce: string }}
   */
  function saveStateNonce() {
    const state = randomToken();
    const nonce = randomToken();
    sessionSet(LINE_LOGIN_STATE_KEY, state);
    sessionSet(LINE_LOGIN_NONCE_KEY, nonce);
    return { state, nonce };
  }

  /**
   * @param {string} state
   * @returns {boolean}
   */
  function verifyState(state) {
    const expected = sessionGet(LINE_LOGIN_STATE_KEY);
    const received = String(state || "").trim();
    if (!expected || !received) return false;
    const ok = expected === received;
    if (ok) sessionRemove(LINE_LOGIN_STATE_KEY);
    return ok;
  }

  function getSavedNonce() {
    return sessionGet(LINE_LOGIN_NONCE_KEY) || "";
  }

  function clearNonce() {
    sessionRemove(LINE_LOGIN_NONCE_KEY);
  }

  /**
   * @returns {string|null}
   */
  function createAuthUrl() {
    const config = getConfig();
    if (!config.isConfigured || !config.redirectUri) return null;

    const { state, nonce } = saveStateNonce();
    const params = new URLSearchParams({
      response_type: "code",
      client_id: config.channelId,
      redirect_uri: config.redirectUri,
      state,
      scope: config.scopes,
      nonce,
    });
    return `${LINE_AUTHORIZE_URL}?${params.toString()}`;
  }

  /**
   * @param {string} code
   */
  function saveAuthCode(code) {
    const trimmed = String(code || "").trim();
    if (!trimmed) return;
    sessionSet(LINE_AUTH_CODE_KEY, trimmed);
  }

  function getAuthCode() {
    return sessionGet(LINE_AUTH_CODE_KEY) || "";
  }

  function clearAuthCode() {
    sessionRemove(LINE_AUTH_CODE_KEY);
  }

  function hasAuthCodePending() {
    return Boolean(getAuthCode());
  }

  /**
   * @param {string} lineUserId
   */
  function maskLineUserId(lineUserId) {
    const id = String(lineUserId || "").trim();
    if (!id) return "";
    if (id.length <= 8) return `${id.slice(0, 2)}***`;
    return `${id.slice(0, 4)}***${id.slice(-4)}`;
  }

  global.TasuAnpiLineLoginConfig = {
    LINE_LOGIN_CHANNEL_ID,
    LINE_LOGIN_SCOPES,
    LINE_LOGIN_STATE_KEY,
    LINE_LOGIN_NONCE_KEY,
    LINE_AUTH_CODE_KEY,
    getConfig,
    getChannelId,
    getRedirectUri,
    saveStateNonce,
    verifyState,
    getSavedNonce,
    clearNonce,
    createAuthUrl,
    saveAuthCode,
    getAuthCode,
    clearAuthCode,
    hasAuthCodePending,
    maskLineUserId,
  };
})(typeof window !== "undefined" ? window : globalThis);
