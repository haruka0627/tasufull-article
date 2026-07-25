/**
 * Live Platform Viewer — Edge API クライアント（local fallback）
 * Phase C · DB 非接続
 */
(function (global) {
  "use strict";

  const DEFAULT_PATH = "/functions/v1/live-platform-viewer";

  class TasuLivePlatformViewerEdgeClient {
    /**
     * @param {{ baseUrl?: string, apiKey?: string, localService?: object }} [options]
     */
    constructor(options = {}) {
      this._baseUrl = String(options.baseUrl || "").trim().replace(/\/$/, "");
      this._apiKey = String(options.apiKey || "").trim();
      this._localService = options.localService || null;
    }

    useLocalService(localService) {
      this._localService = localService || null;
      return this;
    }

    /** @private */
    async _post(body) {
      if (this._localService) return this._invokeLocal(body);
      if (!this._baseUrl) {
        const action = String(body.action || "").toLowerCase();
        if (action === "set_live") {
          return {
            ok: true,
            noop: true,
            stub: true,
            broadcastLive: body.live !== false,
            surface: body.surface,
            broadcastId: body.broadcastId,
          };
        }
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
      if (!res.ok) return { ok: false, error: data.error || `HTTP ${res.status}`, ...data };
      return { ok: true, ...data };
    }

    /** @private */
    async _invokeLocal(body) {
      const svc = this._localService;
      const surface = String(body.surface || "platform").trim().toLowerCase();
      const action = String(body.action || "").trim().toLowerCase();
      const userId = body.userId;

      switch (action) {
        case "join":
          return svc.joinViewer({ surface, userId, broadcastId: body.broadcastId });
        case "leave":
          return svc.leaveViewer({ surface, userId });
        case "reconnect":
          return svc.reconnectViewer({ surface, userId });
        case "heartbeat":
          return svc.heartbeat({ surface, userId });
        case "permission":
          return svc.checkPermission({ surface, userId, broadcastId: body.broadcastId, action: body.permAction || "join" });
        case "watch_state":
          return svc.getWatchState({ surface, userId });
        case "ccu":
          return { ok: true, ccu: svc.getCcu({ surface, broadcastId: body.broadcastId }) };
        case "kick":
          return svc.kickViewer({ surface, userId, reason: body.reason });
        case "set_live":
          return {
            ok: true,
            noop: true,
            broadcastLive: body.live !== false,
            surface,
            broadcastId: body.broadcastId,
          };
        default:
          return { ok: false, error: `未知の action: ${action}` };
      }
    }

    join(params) {
      return this._post({ action: "join", ...params });
    }

    leave(params) {
      return this._post({ action: "leave", ...params });
    }

    reconnect(params) {
      return this._post({ action: "reconnect", ...params });
    }

    heartbeat(params) {
      return this._post({ action: "heartbeat", ...params });
    }

    permission(params) {
      return this._post({ action: "permission", ...params });
    }

    watchState(params) {
      return this._post({ action: "watch_state", ...params });
    }

    ccu(params) {
      return this._post({ action: "ccu", ...params });
    }

    kick(params) {
      return this._post({ action: "kick", ...params });
    }

    /** @param {object} params */
    setLive(params) {
      return this._post({ action: "set_live", live: true, ...params });
    }

    /** @param {object} params */
    clearLive(params) {
      return this._post({ action: "set_live", live: false, ...params });
    }
  }

  global.TasuLivePlatformViewerEdgeClient = TasuLivePlatformViewerEdgeClient;
})(typeof window !== "undefined" ? window : globalThis);
