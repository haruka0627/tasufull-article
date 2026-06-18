/**
 * LINE Login トークン交換クライアント
 */
(function (global) {
  "use strict";

  const TOKEN_MOCK_KEY = "tasu_anpi_line_token_mock_v1";

  const ERROR_CODES = {
    INVALID_REQUEST: "INVALID_REQUEST",
    INVALID_CODE: "INVALID_CODE",
    NONCE_MISMATCH: "NONCE_MISMATCH",
    TOKEN_EXCHANGE_FAILED: "TOKEN_EXCHANGE_FAILED",
    ID_TOKEN_INVALID: "ID_TOKEN_INVALID",
    CONFIG_MISSING: "CONFIG_MISSING",
    NETWORK_ERROR: "NETWORK_ERROR",
    UNKNOWN: "UNKNOWN",
  };

  function isTokenMockEnabled() {
    try {
      return global.localStorage.getItem(TOKEN_MOCK_KEY) === "1";
    } catch {
      return false;
    }
  }

  function setTokenMockEnabled(enabled) {
    try {
      if (enabled) global.localStorage.setItem(TOKEN_MOCK_KEY, "1");
      else global.localStorage.removeItem(TOKEN_MOCK_KEY);
    } catch {
      /* ignore */
    }
  }

  function getTokenExchangeEndpoint() {
    const raw = global.TASU_CHAT_SUPABASE_CONFIG || global.TASU_SUPABASE_CONFIG || {};
    const base = String(raw.url || raw.SUPABASE_URL || "")
      .trim()
      .replace(/\/$/, "");
    const resolveKey =
      global.TasuSupabasePublicKey?.resolvePublishableAnonKey ||
      function fallbackResolve(config) {
        const k = String(config?.anonKey || config?.anon_key || "").trim();
        if (/^sb_secret_/i.test(k)) return "";
        return k;
      };
    const anonKey = resolveKey(raw);
    return {
      url: base ? `${base}/functions/v1/anpi-line-token-exchange` : "",
      anonKey,
    };
  }

  /**
   * @param {{ code?: string, redirectUri?: string, nonce?: string }} body
   */
  function clientMockTokenExchange(body) {
    const code = String(body?.code || "").trim();
    const nonce = String(body?.nonce || "").trim();
    const expectedNonce = global.TasuAnpiLineLoginConfig?.getSavedNonce?.() || "";

    if (!code) {
      return {
        success: false,
        error_code: ERROR_CODES.INVALID_CODE,
        error_message: "認可コードがありません。",
        mock: true,
      };
    }

    if (code === "invalid_code_e2e" || code.startsWith("invalid_")) {
      return {
        success: false,
        error_code: ERROR_CODES.INVALID_CODE,
        error_message: "認可コードが無効です。",
        mock: true,
      };
    }

    if (expectedNonce && nonce !== expectedNonce) {
      return {
        success: false,
        error_code: ERROR_CODES.NONCE_MISMATCH,
        error_message: "nonce が一致しません。",
        mock: true,
      };
    }

    const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();
    const userId = `U_e2e_${code.slice(0, 12).replace(/[^a-zA-Z0-9]/g, "")}`;

    return {
      success: true,
      userId,
      access_token: `mock_access_${Date.now()}`,
      expires_at: expiresAt,
      mock: true,
    };
  }

  /**
   * @param {{ code: string, redirectUri: string, nonce: string }} body
   */
  async function exchangeAuthCode(body) {
    const code = String(body?.code || "").trim();
    const redirectUri = String(body?.redirectUri || "").trim();
    const nonce = String(body?.nonce || "").trim();

    if (!code || !redirectUri) {
      return {
        success: false,
        error_code: ERROR_CODES.INVALID_REQUEST,
        error_message: "認可コードまたは redirectUri が不足しています。",
      };
    }

    if (isTokenMockEnabled()) {
      return clientMockTokenExchange({ code, redirectUri, nonce });
    }

    const { url, anonKey } = getTokenExchangeEndpoint();
    if (!url || !anonKey) {
      return clientMockTokenExchange({ code, redirectUri, nonce });
    }

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
        body: JSON.stringify({ code, redirectUri, nonce }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return {
          success: false,
          error_code: data.error_code || ERROR_CODES.TOKEN_EXCHANGE_FAILED,
          error_message: String(data.error_message || data.message || `HTTP ${res.status}`),
        };
      }
      return data;
    } catch (err) {
      return {
        success: false,
        error_code: ERROR_CODES.NETWORK_ERROR,
        error_message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  global.TasuAnpiLineTokenClient = {
    TOKEN_MOCK_KEY,
    ERROR_CODES,
    isTokenMockEnabled,
    setTokenMockEnabled,
    getTokenExchangeEndpoint,
    exchangeAuthCode,
  };
})(typeof window !== "undefined" ? window : globalThis);
