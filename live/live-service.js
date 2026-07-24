/**
 * TLV Live Service — UI と Session Manager / Provider の接点
 * Phase2-02: Session Manager 配線 · Payment / Wallet / Coin とは分離
 *
 * UI → Live Service → Session Manager → Provider Interface → ZEGO Provider
 */
(function (global) {
  "use strict";

  const SESSION_STATES = global.LIVE_SESSION_STATES || global.TlvLiveSessionStates;

  class TlvLiveService {
    constructor() {
      /** @private */
      this._provider = null;
      /** @private */
      this._providerId = "zego";
      /** @private */
      this._config = null;
      /** @private @type {import('./session/live-session-manager.js')|null} */
      this._session = null;
      /** @private @type {{ event: string, payload: unknown, at: string }|null} */
      this._lastSessionEvent = null;
    }

    /** @returns {string} */
    get providerId() {
      return this._providerId;
    }

    /** Provider 状態（後方互換） */
    get state() {
      return this._provider?.state || "idle";
    }

    /** @private */
    _readConfig() {
      const cfg = global.TLV_LIVE_ZEGO_CONFIG || {};
      return {
        provider: String(cfg.provider || "zego").trim().toLowerCase(),
        appId: Number(cfg.appId || 0),
        server: String(cfg.server || "").trim(),
        tokenApiPath: String(cfg.tokenApiPath || "/api/tlv-zego-token").trim(),
      };
    }

    /** @private */
    _ensureSessionManager() {
      if (this._session) return;
      const Manager = global.TlvLiveSessionManager;
      if (!Manager) {
        throw new Error("TlvLiveSessionManager が未ロードです（live/session/* を先に読み込んでください）");
      }
      this._session = new Manager();
      this._wireSessionTelemetry();
    }

    /** @private */
    _wireSessionTelemetry() {
      const events = global.LIVE_SESSION_EVENTS || global.TlvLiveSessionEvents;
      if (!events || !this._session) return;
      for (const name of Object.values(events)) {
        this._session.on(name, (payload) => {
          this._lastSessionEvent = {
            event: name,
            payload,
            at: new Date().toISOString(),
          };
        });
      }
    }

    /**
     * @param {string} [roomId]
     * @param {'host'|'viewer'|null} [role]
     * @private
     */
    async _syncSessionRoom(roomId, role = null) {
      this._ensureSessionManager();
      const sm = this._session;
      const rid = String(roomId || "").trim();
      if (!rid) throw new Error("roomId が必要です");

      const cur = sm.session;
      if (sm.state === SESSION_STATES.IDLE) {
        return sm.createSession({ roomId: rid, role });
      }
      if (cur?.roomId !== rid) {
        await sm.destroySession();
        return sm.createSession({ roomId: rid, role });
      }
      if (sm.state === SESSION_STATES.ENDED) {
        await sm.reset();
      }
      return { ok: true, state: sm.state, session: sm.session };
    }

    /** @returns {string} */
    getSessionState() {
      if (!this._session) return SESSION_STATES?.IDLE || "IDLE";
      return this._session.state;
    }

    /** @returns {{ state: string, session: object|null, providerState: string, lastEvent: object|null }} */
    getSessionSnapshot() {
      return {
        state: this.getSessionState(),
        session: this._session?.session ? { ...this._session.session } : null,
        providerState: this._provider?.state || "idle",
        lastEvent: this._lastSessionEvent ? { ...this._lastSessionEvent } : null,
      };
    }

    /**
     * @param {string} event
     * @param {Function} handler
     */
    onSessionEvent(event, handler) {
      this._ensureSessionManager();
      this._session.on(event, handler);
      return this;
    }

    /**
     * @param {string} event
     * @param {Function} handler
     */
    offSessionEvent(event, handler) {
      if (!this._session) return this;
      this._session.off(event, handler);
      return this;
    }

    /**
     * @param {string} [providerId]
     * @param {{ appId?: number, server?: string, roomId?: string }} [override]
     */
    async initialize(providerId, override) {
      this._ensureSessionManager();
      this._config = this._readConfig();
      this._providerId = String(providerId || this._config.provider || "zego").trim().toLowerCase();
      if (!global.createTlvLiveProvider) {
        throw new Error("createTlvLiveProvider が未ロードです");
      }
      this._provider = global.createTlvLiveProvider(this._providerId);
      const appId = Number(override?.appId ?? this._config.appId);
      const server = String(override?.server ?? this._config.server).trim();
      const providerResult = await this._provider.initialize({ appId, server });
      if (providerResult?.ok === false) {
        return { ...providerResult, sessionState: this.getSessionState() };
      }

      const roomId = String(override?.roomId || "").trim();
      if (this._session.state === SESSION_STATES.IDLE) {
        const sessionResult = await this._session.createSession(
          roomId ? { roomId } : undefined
        );
        if (!sessionResult.ok) {
          return {
            ok: false,
            error: sessionResult.error || "Session createSession 失敗",
            sessionState: this.getSessionState(),
          };
        }
      }

      return {
        ...(providerResult && typeof providerResult === "object" ? providerResult : { ok: true }),
        sessionState: this.getSessionState(),
        session: this._session.session,
      };
    }

    /**
     * Token をサーバー API から取得（serverSecret はクライアント非保持）
     * @param {{ roomId: string, userId: string, role?: 'host'|'audience', manualToken?: string }} params
     */
    async fetchToken(params) {
      const manual = String(params?.manualToken || "").trim();
      if (manual) {
        return { ok: true, token: manual, source: "manual" };
      }

      const cfg = this._config || this._readConfig();
      const roomId = String(params?.roomId || "").trim();
      const userId = String(params?.userId || "").trim();
      const role = String(params?.role || "audience").trim().toLowerCase();
      if (!roomId || !userId) {
        return { ok: false, error: "roomId / userId が必要です" };
      }

      let res;
      try {
        res = await fetch(cfg.tokenApiPath, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId, userId, role }),
        });
      } catch (err) {
        return { ok: false, error: `Token API 接続失敗: ${err?.message || err}` };
      }

      let body = {};
      try {
        body = await res.json();
      } catch {
        body = {};
      }

      if (!res.ok) {
        return {
          ok: false,
          error: body.error || `Token API HTTP ${res.status}`,
          hint: body.hint,
        };
      }

      const token = String(body.token || "").trim();
      if (!token) {
        return { ok: false, error: "Token API が空 token を返しました" };
      }
      return { ok: true, token, source: "api", appId: body.appId, server: body.server };
    }

    /** @param {{ roomId: string, userId: string, userName: string, videoContainer: HTMLElement, manualToken?: string }} params */
    async startLive(params) {
      if (!this._provider) throw new Error("initialize を先に呼んでください");
      this._ensureSessionManager();

      const sync = await this._syncSessionRoom(params.roomId, "host");
      if (!sync.ok) {
        return { ok: false, error: sync.error, sessionState: this.getSessionState() };
      }

      const tokenRes = await this.fetchToken({
        roomId: params.roomId,
        userId: params.userId,
        role: "host",
        manualToken: params.manualToken,
      });
      if (!tokenRes.ok) return { ...tokenRes, sessionState: this.getSessionState() };

      const providerRes = await this._provider.startLive({
        roomId: params.roomId,
        userId: params.userId,
        userName: params.userName,
        token: tokenRes.token,
        videoContainer: params.videoContainer,
      });
      if (providerRes?.ok === false) {
        return { ...providerRes, sessionState: this.getSessionState() };
      }

      const sessionRes = await this._session.start();
      if (!sessionRes.ok) {
        return {
          ok: false,
          error: sessionRes.error || "Session start 失敗",
          sessionState: this.getSessionState(),
        };
      }

      return {
        ...(providerRes && typeof providerRes === "object" ? providerRes : { ok: true }),
        sessionState: this.getSessionState(),
        session: this._session.session,
      };
    }

    /** @param {{ roomId: string, userId: string, userName: string, videoContainer: HTMLElement, manualToken?: string }} params */
    async joinLive(params) {
      if (!this._provider) throw new Error("initialize を先に呼んでください");
      this._ensureSessionManager();

      const sync = await this._syncSessionRoom(params.roomId, "viewer");
      if (!sync.ok) {
        return { ok: false, error: sync.error, sessionState: this.getSessionState() };
      }

      const tokenRes = await this.fetchToken({
        roomId: params.roomId,
        userId: params.userId,
        role: "audience",
        manualToken: params.manualToken,
      });
      if (!tokenRes.ok) return { ...tokenRes, sessionState: this.getSessionState() };

      const providerRes = await this._provider.joinLive({
        roomId: params.roomId,
        userId: params.userId,
        userName: params.userName,
        token: tokenRes.token,
        videoContainer: params.videoContainer,
      });
      if (providerRes?.ok === false) {
        return { ...providerRes, sessionState: this.getSessionState() };
      }

      const sessionRes = await this._session.join();
      if (!sessionRes.ok) {
        return {
          ok: false,
          error: sessionRes.error || "Session join 失敗",
          sessionState: this.getSessionState(),
        };
      }

      return {
        ...(providerRes && typeof providerRes === "object" ? providerRes : { ok: true }),
        sessionState: this.getSessionState(),
        session: this._session.session,
      };
    }

    async leaveLive() {
      this._ensureSessionManager();
      if (!this._provider) {
        const sessionRes = await this._maybeSessionLeave();
        return { ok: true, state: this.state, sessionState: this.getSessionState(), ...sessionRes };
      }

      const providerRes = await this._provider.leaveLive();
      const sessionRes = await this._maybeSessionLeave();
      return {
        ...(providerRes && typeof providerRes === "object" ? providerRes : { ok: true }),
        sessionState: this.getSessionState(),
        ...sessionRes,
      };
    }

    async endLive() {
      this._ensureSessionManager();
      if (!this._provider) {
        const sessionRes = await this._maybeSessionEnd();
        return { ok: true, state: this.state, sessionState: this.getSessionState(), ...sessionRes };
      }

      const providerRes = await this._provider.endLive();
      const sessionRes = await this._maybeSessionEnd();
      return {
        ...(providerRes && typeof providerRes === "object" ? providerRes : { ok: true }),
        sessionState: this.getSessionState(),
        ...sessionRes,
      };
    }

    /** @private */
    async _maybeSessionLeave() {
      if (!this._session) return {};
      const allowed = [SESSION_STATES.LIVE, SESSION_STATES.CONNECTED, SESSION_STATES.RECONNECTED];
      if (!allowed.includes(this._session.state)) return {};
      const res = await this._session.leave();
      return { session: res.ok ? this._session.session : null };
    }

    /** @private */
    async _maybeSessionEnd() {
      if (!this._session) return {};
      const allowed = [SESSION_STATES.LIVE, SESSION_STATES.RECONNECTED];
      if (!allowed.includes(this._session.state)) return {};
      const res = await this._session.end();
      return { session: res.ok ? this._session.session : null };
    }

    toggleCamera() {
      if (!this._provider) throw new Error("Provider 未初期化");
      return this._provider.toggleCamera();
    }

    toggleMic() {
      if (!this._provider) throw new Error("Provider 未初期化");
      return this._provider.toggleMic();
    }

    switchCamera() {
      if (!this._provider) throw new Error("Provider 未初期化");
      return this._provider.switchCamera();
    }

    async dispose() {
      let providerRes = { ok: true, state: "idle" };
      if (this._provider) {
        providerRes = await this._provider.dispose();
        this._provider = null;
      }
      if (this._session) {
        await this._session.dispose();
        this._session = null;
      }
      this._lastSessionEvent = null;
      return {
        ...(providerRes && typeof providerRes === "object" ? providerRes : { ok: true }),
        sessionState: SESSION_STATES?.IDLE || "IDLE",
      };
    }

    probeBasicBeauty() {
      if (!this._provider) {
        return Promise.resolve({ supported: false, reason: "Provider 未初期化" });
      }
      return this._provider.probeBasicBeauty();
    }
  }

  global.TlvLiveService = TlvLiveService;
})(typeof window !== "undefined" ? window : globalThis);
