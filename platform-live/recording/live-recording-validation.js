/**
 * Live Platform Recording — 入力検証（throw 禁止）
 * Phase E · surface 必須
 */
(function (global) {
  "use strict";

  const CODES = global.PLATFORM_LIVE_RECORDING_ERROR_CODES || global.TasuLivePlatformRecordingErrorCodes;
  const ChatV = global.TasuLivePlatformChatValidation;

  /** @param {string} field @param {string} message @param {string} [code] */
  function fail(field, message, code) {
    return {
      ok: false,
      code: code || CODES?.RECORDING_STATE_ERROR || "RECORDING_STATE_ERROR",
      message: String(message || "validation failed"),
      field: String(field || ""),
    };
  }

  /** @param {unknown} value */
  function ok(value) {
    return { ok: true, value };
  }

  function validateSurface(value, opts = { required: true }) {
    if (ChatV?.validateSurface) return ChatV.validateSurface(value, opts);
    const s = String(value ?? "").trim().toLowerCase();
    if (!s) return fail("surface", "surface が必要です", CODES?.SURFACE_ERROR || "SURFACE_ERROR");
    return ok(s);
  }

  function validateBroadcastId(value) {
    if (ChatV?.validateBroadcastId) return ChatV.validateBroadcastId(value);
    const s = String(value ?? "").trim();
    if (!s) return fail("broadcastId", "broadcastId が必要です");
    return ok(s);
  }

  function validateRecordingId(value, opts = { required: true }) {
    const s = String(value ?? "").trim();
    if (!s) {
      return opts.required ? fail("recordingId", "recordingId が必要です") : ok("");
    }
    return ok(s);
  }

  function validateSessionId(value) {
    const s = String(value ?? "").trim();
    if (!s) return ok(null);
    return ok(s);
  }

  function validateEventName(name, eventsMap) {
    const n = String(name ?? "").trim();
    if (!n) return fail("eventName", "eventName が必要です");
    const events = eventsMap || global.PLATFORM_LIVE_RECORDING_EVENTS || global.TasuLivePlatformRecordingEvents;
    if (!events || !Object.values(events).includes(n)) {
      return fail("eventName", `未知の eventName: ${n}`);
    }
    return ok(n);
  }

  global.TasuLivePlatformRecordingValidation = Object.freeze({
    CODES,
    validateSurface,
    validateBroadcastId,
    validateRecordingId,
    validateSessionId,
    validateEventName,
  });
})(typeof window !== "undefined" ? window : globalThis);
