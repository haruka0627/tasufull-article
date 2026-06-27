/**
 * Voice Core — Realtime config injection boundary
 * Secrets / endpoints / models are supplied via injectors only (never hardcoded).
 */
(function (global) {
  "use strict";

  const { getRuntimeInjectors } = global.TasuVoiceCoreRealtimeConnectPolicy || {};

  /**
   * @typedef {object} VoiceRealtimeCredential
   * @property {string} type — ephemeral_token | bearer | custom
   * @property {string} value — short-lived token from server (not a repo secret)
   * @property {number} [expiresAt] — epoch ms
   */

  /**
   * @param {object} [injectors]
   * @returns {object}
   */
  function createRealtimeConfig(injectors) {
    const src = injectors || (getRuntimeInjectors ? getRuntimeInjectors() : null) || {};

    return {
      /**
       * @param {object} [ctx]
       * @returns {string|null}
       */
      getEndpoint(ctx) {
        if (typeof src.getEndpoint === "function") {
          const v = src.getEndpoint(ctx);
          return v ? String(v) : null;
        }
        return null;
      },

      /**
       * @param {object} [ctx]
       * @returns {string}
       */
      getModel(ctx) {
        if (typeof src.getModel === "function") {
          const v = src.getModel(ctx);
          if (v) return String(v);
        }
        if (ctx?.model) return String(ctx.model);
        return "";
      },

      /**
       * @param {object} [ctx]
       * @returns {Promise<VoiceRealtimeCredential|null>}
       */
      async getSessionCredential(ctx) {
        if (typeof src.getSessionCredential === "function") {
          const cred = await src.getSessionCredential(ctx);
          if (!cred || !cred.value) return null;
          return {
            type: String(cred.type || "ephemeral_token"),
            value: String(cred.value),
            expiresAt: cred.expiresAt ? Number(cred.expiresAt) : undefined,
          };
        }
        return null;
      },

      /**
       * @param {object} [ctx]
       * @returns {object}
       */
      getSessionOptions(ctx) {
        if (typeof src.getSessionOptions === "function") {
          const opts = src.getSessionOptions(ctx);
          return opts && typeof opts === "object" ? { ...opts } : {};
        }
        return {};
      },
    };
  }

  global.TasuVoiceCoreRealtimeConfig = {
    createRealtimeConfig,
  };
})(typeof window !== "undefined" ? window : globalThis);
