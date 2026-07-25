/**
 * Live Platform Broadcast — 入力検証（throw 禁止 · 結果オブジェクトのみ）
 * Phase B · surface 必須
 */
(function (global) {
  "use strict";

  const CODES = global.PLATFORM_LIVE_BROADCAST_ERROR_CODES || global.TasuLivePlatformBroadcastErrorCodes;
  const SessionV = global.TasuLivePlatformSessionValidation;
  const MAX_TITLE_LEN = 256;
  const MAX_ID_LEN = 128;
  const ID_PATTERN = /^[a-zA-Z0-9._-]+$/;

  /** @param {string} field @param {string} message @param {string} [code] */
  function fail(field, message, code) {
    return {
      ok: false,
      code: code || CODES?.VALIDATION_ERROR || "VALIDATION_ERROR",
      message: String(message || "validation failed"),
      field: String(field || ""),
    };
  }

  /** @param {unknown} value */
  function ok(value) {
    return { ok: true, value };
  }

  /**
   * @param {unknown} value
   * @param {{ required?: boolean }} [opts]
   */
  function validateSurface(value, opts = { required: true }) {
    if (SessionV?.validateSurface) return SessionV.validateSurface(value, opts);
    const s = String(value ?? "").trim().toLowerCase();
    if (!s) return fail("surface", "surface が必要です", CODES?.SURFACE_ERROR || "SURFACE_ERROR");
    const allowed = ["platform", "tlv", "talk", "builder"];
    if (!allowed.includes(s)) {
      return fail("surface", `surface は ${allowed.join("|")} のいずれかです`, CODES?.SURFACE_ERROR || "SURFACE_ERROR");
    }
    return ok(s);
  }

  /** @param {unknown} value @param {string} [fieldName] */
  function validateBroadcastId(value, fieldName = "broadcastId") {
    const s = String(value ?? "").trim();
    if (!s) return fail(fieldName, `${fieldName} が必要です`);
    if (s.length > MAX_ID_LEN) return fail(fieldName, `${fieldName} が長すぎます`);
    if (!ID_PATTERN.test(s)) return fail(fieldName, `${fieldName} の形式が不正です`);
    return ok(s);
  }

  /** @param {unknown} value */
  function validateTitle(value) {
    if (value == null || value === "") return ok("");
    const s = String(value).trim();
    if (s.length > MAX_TITLE_LEN) return fail("title", "title が長すぎます");
    return ok(s);
  }

  /** @param {unknown} value */
  function validateViewerCount(value) {
    if (value == null || value === "") return ok(0);
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
      return fail("viewerCount", "viewerCount は 0 以上の整数です");
    }
    return ok(n);
  }

  /**
   * @param {unknown} name
   * @param {Record<string, string>} [eventsMap]
   */
  function validateEventName(name, eventsMap) {
    const n = String(name ?? "").trim();
    if (!n) return fail("eventName", "eventName が必要です");
    const events = eventsMap || global.PLATFORM_LIVE_BROADCAST_EVENTS || global.TasuLivePlatformBroadcastEvents;
    if (!events || !Object.values(events).includes(n)) {
      return fail("eventName", `未知の eventName: ${n}`);
    }
    return ok(n);
  }

  /**
   * @param {unknown} signal
   * @param {Record<string, string>} [signalsMap]
   */
  function validateProviderSignal(signal, signalsMap) {
    const s = String(signal ?? "").trim();
    if (!s) return fail("providerSignal", "providerSignal が必要です");
    const signals =
      signalsMap || global.PLATFORM_LIVE_BROADCAST_PROVIDER_SIGNALS || global.TasuLivePlatformBroadcastProviderSignals;
    if (!signals || !Object.values(signals).includes(s)) {
      return fail("providerSignal", `未知の providerSignal: ${s}`);
    }
    return ok(s);
  }

  global.TasuLivePlatformBroadcastValidation = Object.freeze({
    CODES,
    validateSurface,
    validateBroadcastId,
    validateTitle,
    validateViewerCount,
    validateEventName,
    validateProviderSignal,
  });
})(typeof window !== "undefined" ? window : globalThis);
