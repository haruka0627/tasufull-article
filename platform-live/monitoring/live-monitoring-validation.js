/**
 * Live Platform Monitoring — 入力検証（throw 禁止）
 * Phase F · surface 必須
 */
(function (global) {
  "use strict";

  const CODES = global.PLATFORM_LIVE_MONITORING_ERROR_CODES || global.TasuLivePlatformMonitoringErrorCodes;
  const RecV = global.TasuLivePlatformRecordingValidation;

  /** @param {string} field @param {string} message @param {string} [code] */
  function fail(field, message, code) {
    return {
      ok: false,
      code: code || CODES?.MONITORING_STATE_ERROR || "MONITORING_STATE_ERROR",
      message: String(message || "validation failed"),
      field: String(field || ""),
    };
  }

  /** @param {unknown} value */
  function ok(value) {
    return { ok: true, value };
  }

  function validateSurface(value, opts = { required: true }) {
    if (RecV?.validateSurface) return RecV.validateSurface(value, opts);
    const s = String(value ?? "").trim().toLowerCase();
    if (!s) return fail("surface", "surface が必要です", CODES?.SURFACE_ERROR || "SURFACE_ERROR");
    return ok(s);
  }

  function validateEventName(name, eventsMap) {
    const n = String(name ?? "").trim();
    if (!n) return fail("eventName", "eventName が必要です");
    const events = eventsMap || global.PLATFORM_LIVE_MONITORING_EVENTS || global.TasuLivePlatformMonitoringEvents;
    if (!events || !Object.values(events).includes(n)) {
      return fail("eventName", `未知の eventName: ${n}`);
    }
    return ok(n);
  }

  global.TasuLivePlatformMonitoringValidation = Object.freeze({
    CODES,
    validateSurface,
    validateEventName,
  });
})(typeof window !== "undefined" ? window : globalThis);
