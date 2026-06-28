/**
 * Live Platform Session — Event Bus（SDK 非依存）
 * Phase A · platform-live/core
 */
(function (global) {
  "use strict";

  class TasuLivePlatformSessionEventBus {
    constructor() {
      /** @private @type {Map<string, Set<{ fn: Function, once: boolean }>>} */
      this._handlers = new Map();
    }

    /**
     * @param {string} event
     * @param {unknown} [payload]
     */
    emit(event, payload) {
      const name = String(event || "").trim();
      if (!name) return;
      const bucket = this._handlers.get(name);
      if (!bucket || bucket.size === 0) return;

      const toRun = Array.from(bucket);
      for (const entry of toRun) {
        try {
          entry.fn(payload);
        } catch (err) {
          console.error(`[TasuLivePlatformSessionEventBus] handler error (${name}):`, err);
        }
        if (entry.once) bucket.delete(entry);
      }
    }

    /**
     * @param {string} event
     * @param {Function} handler
     */
    on(event, handler) {
      const name = String(event || "").trim();
      if (!name || typeof handler !== "function") return this;
      if (!this._handlers.has(name)) this._handlers.set(name, new Set());
      this._handlers.get(name).add({ fn: handler, once: false });
      return this;
    }

    /**
     * @param {string} event
     * @param {Function} handler
     */
    off(event, handler) {
      const name = String(event || "").trim();
      if (!name || typeof handler !== "function") return this;
      const bucket = this._handlers.get(name);
      if (!bucket) return this;
      for (const entry of bucket) {
        if (entry.fn === handler) bucket.delete(entry);
      }
      if (bucket.size === 0) this._handlers.delete(name);
      return this;
    }

    /**
     * @param {string} event
     * @param {Function} handler
     */
    once(event, handler) {
      const name = String(event || "").trim();
      if (!name || typeof handler !== "function") return this;
      if (!this._handlers.has(name)) this._handlers.set(name, new Set());
      this._handlers.get(name).add({ fn: handler, once: true });
      return this;
    }

    /** @private */
    clear() {
      this._handlers.clear();
    }
  }

  global.TasuLivePlatformSessionEventBus = TasuLivePlatformSessionEventBus;
})(typeof window !== "undefined" ? window : globalThis);
