/**
 * Live Platform Monitoring — Edge API クライアント（local fallback）
 * Phase F · DB 非接続
 */
(function (global) {
  "use strict";

  const DEFAULT_PATH = "/functions/v1/live-platform-monitoring";

  class TasuLivePlatformMonitoringEdgeClient {
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
        if (action === "patch") {
          return {
            ok: true,
            noop: true,
            stub: true,
            surface: body.surface,
            broadcastLive: body.broadcastLive,
            sessionActive: body.sessionActive,
            providerState: body.providerState,
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

      switch (action) {
        case "health":
          return svc.getHealth({ surface });
        case "metrics":
          return svc.getMetrics({ surface });
        case "status":
          return svc.getServiceStatus({ surface });
        case "provider":
          return svc.getProviderStatus({ surface });
        case "smoke":
          return svc.runSmoke({ surface, failAtStep: body.failAtStep });
        case "patch":
          return {
            ok: true,
            noop: true,
            stub: true,
            surface,
            broadcastLive: body.broadcastLive,
            sessionActive: body.sessionActive,
            recordingActive: body.recordingActive,
            providerState: body.providerState,
          };
        default:
          return { ok: false, error: `未知の action: ${action}` };
      }
    }

    health(params) {
      return this._post({ action: "health", ...params });
    }

    metrics(params) {
      return this._post({ action: "metrics", ...params });
    }

    status(params) {
      return this._post({ action: "status", ...params });
    }

    provider(params) {
      return this._post({ action: "provider", ...params });
    }

    smoke(params) {
      return this._post({ action: "smoke", ...params });
    }

    /**
     * P4-1 · monitoring edge patch adapter
     * @param {object} params
     */
    patchLive(params) {
      return this._post({
        action: "patch",
        surface: params.surface,
        broadcastLive: params.broadcastLive,
        sessionActive: params.sessionActive,
        recordingActive: params.recordingActive,
        providerStatus: params.providerState || params.providerStatus,
        broadcastId: params.broadcastId,
        sessionId: params.sessionId,
        streamId: params.streamId,
      });
    }
  }

  global.TasuLivePlatformMonitoringEdgeClient = TasuLivePlatformMonitoringEdgeClient;
})(typeof window !== "undefined" ? window : globalThis);
