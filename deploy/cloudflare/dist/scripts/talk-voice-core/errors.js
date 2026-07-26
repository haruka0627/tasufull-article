/**
 * TASFUL talk-voice-core — shared error codes (Provider / Core)
 */
(function (global) {
  "use strict";

  const CODES = Object.freeze({
    MEDIA_PERMISSION_DENIED: "media_permission_denied",
    MICROPHONE_UNAVAILABLE: "microphone_unavailable",
    SIGNALING_FAILED: "signaling_failed",
    CONNECTION_TIMEOUT: "connection_timeout",
    PEER_UNAVAILABLE: "peer_unavailable",
    NETWORK_DISCONNECTED: "network_disconnected",
    PROVIDER_UNAVAILABLE: "provider_unavailable",
    SESSION_CONFLICT: "session_conflict",
    PERMISSION_DENIED: "permission_denied",
    AUTH_REQUIRED: "auth_required",
    FEATURE_DISABLED: "feature_disabled",
    NOT_ELIGIBLE: "not_eligible",
    DAILY_LIMIT_REACHED: "daily_limit_reached",
    MONTHLY_LIMIT_REACHED: "monthly_limit_reached",
    INVALID_TRANSITION: "invalid_transition",
    UNKNOWN_VOICE_ERROR: "unknown_voice_error",
  });

  function mapProviderError(err) {
    const msg = String(err?.message || err || "").toLowerCase();
    const name = String(err?.name || "");
    if (name === "NotAllowedError" || /permission|denied|notallowed/.test(msg)) {
      return { code: CODES.MEDIA_PERMISSION_DENIED, message: "マイクの使用が許可されていません" };
    }
    if (name === "NotFoundError" || /device|microphone|notfound/.test(msg)) {
      return { code: CODES.MICROPHONE_UNAVAILABLE, message: "マイクを利用できません" };
    }
    if (/timeout/.test(msg)) {
      return { code: CODES.CONNECTION_TIMEOUT, message: "通話接続がタイムアウトしました" };
    }
    if (/network|ice|failed/.test(msg)) {
      return { code: CODES.NETWORK_DISCONNECTED, message: "ネットワーク接続に失敗しました" };
    }
    return {
      code: CODES.UNKNOWN_VOICE_ERROR,
      message: "通話でエラーが発生しました",
    };
  }

  global.TasuTalkVoiceErrors = { CODES, mapProviderError };
})(typeof window !== "undefined" ? window : globalThis);
