/**
 * Live Platform Chat — Edge API クライアント（local fallback）
 * Phase D · DB 非接続
 */
(function (global) {
  "use strict";

  const DEFAULT_PATH = "/functions/v1/live-platform-chat";

  class TasuLivePlatformChatEdgeClient {
    /**
     * @param {{ baseUrl?: string, apiKey?: string, localGateway?: object }} [options]
     */
    constructor(options = {}) {
      this._baseUrl = String(options.baseUrl || "").trim().replace(/\/$/, "");
      this._apiKey = String(options.apiKey || "").trim();
      this._localGateway = options.localGateway || null;
    }

    useLocalGateway(gateway) {
      this._localGateway = gateway || null;
      return this;
    }

    /** @private */
    async _post(body) {
      if (this._localGateway) return this._invokeLocal(body);
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
        return { ok: false, error: "baseUrl または localGateway が必要です" };
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
      const gw = this._localGateway;
      const surface = String(body.surface || "platform").trim().toLowerCase();
      const action = String(body.action || "").trim().toLowerCase();

      switch (action) {
        case "send_message":
          return gw.sendMessage({
            surface,
            broadcastId: body.broadcastId,
            userId: body.userId,
            text: body.text,
            messageId: body.messageId,
          });
        case "add_reaction":
          return gw.addReaction({
            surface,
            broadcastId: body.broadcastId,
            userId: body.userId,
            messageId: body.messageId,
            reaction: body.reaction,
          });
        case "remove_reaction":
          return gw.removeReaction({
            surface,
            broadcastId: body.broadcastId,
            userId: body.userId,
            messageId: body.messageId,
            reaction: body.reaction,
          });
        case "system_event":
          return gw.emitSystemEvent({
            surface,
            broadcastId: body.broadcastId,
            type: body.type,
            payload: body.payload,
            userId: body.userId,
          });
        case "messages":
          return gw.getMessages({ surface, broadcastId: body.broadcastId, limit: body.limit });
        case "set_live":
          return {
            ok: true,
            noop: true,
            broadcastLive: body.live !== false,
            surface,
            broadcastId: body.broadcastId,
          };
        case "set_watching":
          return {
            ok: true,
            noop: true,
            stub: true,
            surface,
            broadcastId: body.broadcastId,
            userId: body.userId,
            watching: body.watching !== false,
          };
        default:
          return { ok: false, error: `未知の action: ${action}` };
      }
    }

    sendMessage(params) {
      const body = { action: "send_message", ...params };
      if (params?.messageId) body.messageId = String(params.messageId).trim();
      return this._post(body);
    }

    addReaction(params) {
      return this._post({ action: "add_reaction", ...params });
    }

    removeReaction(params) {
      return this._post({ action: "remove_reaction", ...params });
    }

    systemEvent(params) {
      return this._post({ action: "system_event", ...params });
    }

    messages(params) {
      return this._post({ action: "messages", ...params });
    }

    /** @param {object} params */
    setLive(params) {
      return this._post({ action: "set_live", live: true, ...params });
    }

    /** @param {object} params */
    clearLive(params) {
      return this._post({ action: "set_live", live: false, ...params });
    }

    /** @param {{ surface: string, broadcastId: string, userId: string, watching?: boolean }} params */
    setWatching(params) {
      return this._post({ action: "set_watching", watching: params?.watching !== false, ...params });
    }

    /** @param {{ surface: string, broadcastId: string, userId: string }} params */
    clearWatching(params) {
      return this._post({ action: "set_watching", watching: false, ...params });
    }
  }

  global.TasuLivePlatformChatEdgeClient = TasuLivePlatformChatEdgeClient;
})(typeof window !== "undefined" ? window : globalThis);
