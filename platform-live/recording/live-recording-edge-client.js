/**
 * Live Platform Recording — Edge API クライアント（local fallback）
 * Phase E · DB 非接続
 */
(function (global) {
  "use strict";

  const DEFAULT_PATH = "/functions/v1/live-platform-recording";

  class TasuLivePlatformRecordingEdgeClient {
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
      if (!this._baseUrl) return { ok: false, error: "baseUrl または localService が必要です" };

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
        case "start":
          return svc.startRecording({ surface, broadcastId: body.broadcastId, sessionId: body.sessionId });
        case "stop":
          return svc.stopRecording({ surface, recordingId: body.recordingId });
        case "status":
          return svc.getRecordingStatus({ surface, recordingId: body.recordingId });
        case "archive":
          return svc.createArchiveMetadata({ surface, recordingId: body.recordingId, ttlSec: body.ttlSec });
        default:
          return { ok: false, error: `未知の action: ${action}` };
      }
    }

    start(params) {
      return this._post({ action: "start", ...params });
    }

    stop(params) {
      return this._post({ action: "stop", ...params });
    }

    status(params) {
      return this._post({ action: "status", ...params });
    }

    archive(params) {
      return this._post({ action: "archive", ...params });
    }
  }

  global.TasuLivePlatformRecordingEdgeClient = TasuLivePlatformRecordingEdgeClient;
})(typeof window !== "undefined" ? window : globalThis);
