/**
 * Live Platform Broadcast — Edge API クライアント（stub フォールバック）
 * Phase B · DB 非接続 · ローカル service へフォールバック可
 */
(function (global) {
  "use strict";

  const DEFAULT_PATH = "/functions/v1/live-platform-broadcast";

  class TasuLivePlatformBroadcastEdgeClient {
    /**
     * @param {{ baseUrl?: string, apiKey?: string, localService?: object }} [options]
     */
    constructor(options = {}) {
      this._baseUrl = String(options.baseUrl || "").trim().replace(/\/$/, "");
      this._apiKey = String(options.apiKey || "").trim();
      /** @private @type {object|null} in-memory fallback */
      this._localService = options.localService || null;
    }

    /** @param {object} localService TasuLivePlatformBroadcastService instance */
    useLocalService(localService) {
      this._localService = localService || null;
      return this;
    }

    /** @private */
    async _post(body) {
      if (this._localService) {
        return this._invokeLocal(body);
      }
      if (!this._baseUrl) {
        return { ok: false, error: "baseUrl または localService が必要です" };
      }

      const url = `${this._baseUrl}${DEFAULT_PATH}`;
      const headers = { "Content-Type": "application/json" };
      if (this._apiKey) headers.apikey = this._apiKey;

      let res;
      try {
        res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
      } catch (err) {
        return { ok: false, error: `Edge 接続失敗: ${err?.message || err}` };
      }

      let data = {};
      try {
        data = await res.json();
      } catch {
        data = {};
      }
      if (!res.ok) {
        return { ok: false, error: data.error || `HTTP ${res.status}`, ...data };
      }
      return { ok: true, ...data };
    }

    /** @private */
    async _invokeLocal(body) {
      const svc = this._localService;
      const surface = String(body.surface || "platform").trim().toLowerCase();
      const action = String(body.action || "").trim().toLowerCase();

      switch (action) {
        case "create":
          return svc.createBroadcast({
            surface,
            title: body.title,
            roomId: body.roomId,
            broadcastId: body.broadcastId,
            hostUserId: body.hostUserId,
          });
        case "start":
          return svc.startBroadcast({ surface, userId: body.userId });
        case "stop":
          return svc.stopBroadcast({ surface, reason: body.reason });
        case "health":
          return svc.getBroadcastHealth({ surface });
        case "viewer_count":
          return svc.updateViewerCount({ surface, count: body.count });
        case "state":
          return svc.getBroadcastState({ surface });
        default:
          return { ok: false, error: `未知の action: ${action}` };
      }
    }

    /** @param {object} params */
    create(params) {
      return this._post({ action: "create", ...params });
    }

    /** @param {object} params */
    start(params) {
      return this._post({ action: "start", ...params });
    }

    /** @param {object} params */
    stop(params) {
      return this._post({ action: "stop", ...params });
    }

    /** @param {object} params */
    health(params) {
      return this._post({ action: "health", ...params });
    }

    /** @param {object} params */
    updateViewerCount(params) {
      return this._post({ action: "viewer_count", ...params });
    }

    /** @param {object} params */
    state(params) {
      return this._post({ action: "state", ...params });
    }
  }

  global.TasuLivePlatformBroadcastEdgeClient = TasuLivePlatformBroadcastEdgeClient;
})(typeof window !== "undefined" ? window : globalThis);
