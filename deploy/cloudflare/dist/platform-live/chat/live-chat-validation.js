/**
 * Live Platform Chat — 入力検証（throw 禁止）
 * Phase D · surface 必須
 */
(function (global) {
  "use strict";

  const CODES = global.PLATFORM_LIVE_CHAT_ERROR_CODES || global.TasuLivePlatformChatErrorCodes;
  const ViewerV = global.TasuLivePlatformViewerValidation;
  const MAX_MSG_LEN = 512;
  const MAX_REACTION_LEN = 32;
  const ID_PATTERN = /^[a-zA-Z0-9._-]+$/;

  /** @param {string} field @param {string} message @param {string} [code] */
  function fail(field, message, code) {
    return {
      ok: false,
      code: code || CODES?.CHAT_VALIDATION_ERROR || "CHAT_VALIDATION_ERROR",
      message: String(message || "validation failed"),
      field: String(field || ""),
    };
  }

  /** @param {unknown} value */
  function ok(value) {
    return { ok: true, value };
  }

  function validateSurface(value, opts = { required: true }) {
    if (ViewerV?.validateSurface) return ViewerV.validateSurface(value, opts);
    const s = String(value ?? "").trim().toLowerCase();
    if (!s) return fail("surface", "surface が必要です", CODES?.SURFACE_ERROR || "SURFACE_ERROR");
    return ok(s);
  }

  function validateUserId(value, opts = { required: true }) {
    if (ViewerV?.validateUserId) return ViewerV.validateUserId(value, opts);
    const s = String(value ?? "").trim();
    if (!s) return opts.required ? fail("userId", "userId が必要です") : ok(null);
    return ok(s);
  }

  function validateBroadcastId(value) {
    if (ViewerV?.validateBroadcastId) return ViewerV.validateBroadcastId(value);
    const s = String(value ?? "").trim();
    if (!s) return fail("broadcastId", "broadcastId が必要です");
    return ok(s);
  }

  /** @param {unknown} value */
  function validateMessageText(value) {
    const s = String(value ?? "").trim();
    if (!s) return fail("text", "message が空です");
    if (s.length > MAX_MSG_LEN) return fail("text", "message が長すぎます");
    return ok(s);
  }

  /** @param {unknown} value */
  function validateReaction(value) {
    const s = String(value ?? "").trim();
    if (!s) return fail("reaction", "reaction が必要です");
    if (s.length > MAX_REACTION_LEN) return fail("reaction", "reaction が長すぎます");
    if (!ID_PATTERN.test(s)) return fail("reaction", "reaction の形式が不正です");
    return ok(s);
  }

  /** @param {unknown} value */
  function validateMessageId(value) {
    const s = String(value ?? "").trim();
    if (!s) return fail("messageId", "messageId が必要です");
    return ok(s);
  }

  /**
   * @param {unknown} type
   * @param {Record<string, string>} [typesMap]
   */
  function validateSystemEventType(type, typesMap) {
    const t = String(type ?? "").trim().toLowerCase();
    if (!t) return fail("systemEventType", "systemEventType が必要です");
    const types = typesMap || global.PLATFORM_LIVE_CHAT_SYSTEM_EVENT_TYPES || global.TasuLivePlatformChatSystemEventTypes;
    if (!types || !Object.values(types).includes(t)) {
      return fail("systemEventType", `未知の systemEventType: ${t}`);
    }
    return ok(t);
  }

  function validateEventName(name, eventsMap) {
    const n = String(name ?? "").trim();
    if (!n) return fail("eventName", "eventName が必要です");
    const events = eventsMap || global.PLATFORM_LIVE_CHAT_EVENTS || global.TasuLivePlatformChatEvents;
    if (!events || !Object.values(events).includes(n)) {
      return fail("eventName", `未知の eventName: ${n}`);
    }
    return ok(n);
  }

  global.TasuLivePlatformChatValidation = Object.freeze({
    CODES,
    validateSurface,
    validateUserId,
    validateBroadcastId,
    validateMessageText,
    validateReaction,
    validateMessageId,
    validateSystemEventType,
    validateEventName,
  });
})(typeof window !== "undefined" ? window : globalThis);
