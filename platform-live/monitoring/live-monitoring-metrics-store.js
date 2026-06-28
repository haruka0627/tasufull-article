/**
 * Live Platform Monitoring — in-memory Metrics 正本
 * Phase F · surface 別集計
 */
(function (global) {
  "use strict";

  /** @returns {object} */
  function emptyMetrics() {
    return {
      activeSessions: 0,
      liveBroadcasts: 0,
      activeViewers: 0,
      ccu: 0,
      messagesSent: 0,
      messagesBlocked: 0,
      reactions: 0,
      activeRecordings: 0,
      completedRecordings: 0,
      providerStatus: "unknown",
      lastHeartbeatAt: null,
      errors: [],
    };
  }

  class TasuLivePlatformMonitoringMetricsStore {
    constructor() {
      /** @private @type {Map<string, ReturnType<emptyMetrics>>} */
      this._bySurface = new Map();
    }

    /** @private */
    _bucket(surface) {
      const key = String(surface || "").trim().toLowerCase();
      if (!this._bySurface.has(key)) {
        this._bySurface.set(key, emptyMetrics());
      }
      return this._bySurface.get(key);
    }

    /** @param {string} surface @param {string} key @param {number} [delta] */
    increment(surface, key, delta = 1) {
      const b = this._bucket(surface);
      if (typeof b[key] === "number") {
        b[key] += Number(delta) || 0;
      }
      return b;
    }

    /** @param {string} surface @param {string} key @param {unknown} value */
    set(surface, key, value) {
      const b = this._bucket(surface);
      b[key] = value;
      return b;
    }

    /**
     * @param {string} surface
     * @param {{ code?: string, message?: string, at?: string }} error
     */
    recordError(surface, error) {
      const b = this._bucket(surface);
      const entry = {
        code: String(error?.code || "UNKNOWN_ERROR"),
        message: String(error?.message || "error"),
        at: error?.at || new Date().toISOString(),
      };
      b.errors.push(entry);
      if (b.errors.length > 100) b.errors.splice(0, b.errors.length - 100);
      return entry;
    }

    /**
     * @param {string} surface
     * @param {Partial<ReturnType<emptyMetrics>>} patch
     */
    patch(surface, patch) {
      const b = this._bucket(surface);
      Object.assign(b, patch || {});
      return { ...b, errors: [...b.errors] };
    }

    /** @param {string} [surface] */
    snapshot(surface) {
      if (surface != null && String(surface).trim()) {
        const b = this._bucket(surface);
        return { surface: String(surface).trim().toLowerCase(), ...b, errors: [...b.errors] };
      }
      const all = {};
      for (const [key, val] of this._bySurface.entries()) {
        all[key] = { surface: key, ...val, errors: [...val.errors] };
      }
      return all;
    }

    clear(surface) {
      if (surface != null && String(surface).trim()) {
        this._bySurface.delete(String(surface).trim().toLowerCase());
        return;
      }
      this._bySurface.clear();
    }
  }

  global.TasuLivePlatformMonitoringMetricsStore = TasuLivePlatformMonitoringMetricsStore;
  global.PLATFORM_LIVE_MONITORING_EMPTY_METRICS = emptyMetrics;
})(typeof window !== "undefined" ? window : globalThis);
