/**
 * Live Platform Service — Session Manager + Provider 接点
 * Phase A · surface 必須 · TLV Wallet/Tip 非接続
 *
 * UI → LivePlatformService → Session Manager → Provider Interface → Stub/ZEGO
 */
(function (global) {
  "use strict";

  const SESSION_STATES = global.PLATFORM_LIVE_SESSION_STATES || global.TasuLivePlatformSessionStates;
  const SIG = global.PLATFORM_LIVE_PROVIDER_SIGNALS || global.TasuLivePlatformProviderSignals;
  const MVP_SURFACE = global.LIVE_SURFACE_MVP || "platform";

  class TasuLivePlatformService {
    constructor() {
      /** @private */
      this._provider = null;
      /** @private */
      this._providerId = "stub";
      /** @private @type {import('./live-session-manager.js')|null} */
      this._session = null;
      /** @private @type {string|null} */
      this._surface = null;
      /** @private @type {{ event: string, payload: unknown, at: string }|null} */
      this._lastSessionEvent = null;
      /** @private */
      this._stubFallback = false;
    }

    /** @returns {string} */
    get providerId() {
      return this._provider?.providerId || this._providerId;
    }

    /** @returns {boolean} */
    get isStubFallback() {
      return this._stubFallback;
    }

    /** Provider 状態 */
    get state() {
      return this._provider?.state || "idle";
    }

    /** @returns {string|null} */
    get surface() {
      return this._surface;
    }

    /** @private */
    _ensureSessionManager() {
      if (this._session) return;
      const Manager = global.TasuLivePlatformSessionManager;
      if (!Manager) {
        throw new Error("TasuLivePlatformSessionManager が未ロードです（platform-live/core/* を先に読み込んでください）");
      }
      this._session = new Manager();
      this._wireSessionTelemetry();
    }

    /** @private */
    _wireSessionTelemetry() {
      const events = global.PLATFORM_LIVE_SESSION_EVENTS || global.TasuLivePlatformSessionEvents;
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

    /** @private */
    _wireProviderSignals() {
      if (!this._provider || !this._session) return;
      this._provider.onSignal((signal, payload) => {
        this._session.handleProviderSignal(signal, {
          ...payload,
          surface: payload?.surface || this._surface,
        });
      });
    }

    /** @returns {string} */
    getSessionState() {
      if (!this._session) return SESSION_STATES?.IDLE || "IDLE";
      return this._session.state;
    }

    /** @returns {{ state: string, session: object|null, providerState: string, surface: string|null, lastEvent: object|null, stubFallback: boolean }} */
    getSessionSnapshot() {
      return {
        state: this.getSessionState(),
        session: this._session?.session ? { ...this._session.session } : null,
        providerState: this._provider?.state || "idle",
        surface: this._surface,
        lastEvent: this._lastSessionEvent ? { ...this._lastSessionEvent } : null,
        stubFallback: this._stubFallback,
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
     * Provider signal テレメトリ（PoC / E2E 用 · Interface 非変更）
     * @param {Function} handler
     */
    onProviderSignal(handler) {
      if (typeof handler !== "function" || !this._provider?.onSignal) return this;
      this._provider.onSignal(handler);
      return this;
    }

    /**
     * Broadcast provider signal テレメトリ（PoC / E2E 用）
     * @param {Function} handler
     */
    onBroadcastSignal(handler) {
      if (typeof handler !== "function" || !this._provider?.onBroadcastSignal) return this;
      this._provider.onBroadcastSignal(handler);
      return this;
    }

    /**
     * @param {{ surface: string, providerId?: string, allowStubFallback?: boolean }} options
     */
    async initialize(options = {}) {
      this._ensureSessionManager();
      const surface = String(options.surface || MVP_SURFACE).trim().toLowerCase();
      this._surface = surface;
      this._providerId = String(options.providerId || "stub").trim().toLowerCase();

      if (!global.createPlatformLiveProvider) {
        throw new Error("createPlatformLiveProvider が未ロードです");
      }

      this._provider = global.createPlatformLiveProvider(this._providerId, {
        allowStubFallback: options.allowStubFallback !== false,
      });
      this._stubFallback = global.isPlatformLiveStubFallback?.(this._provider) || this._provider.providerId === "stub";

      const providerResult = await this._provider.initialize({ surface });
      if (providerResult?.ok === false) {
        return { ...providerResult, sessionState: this.getSessionState(), surface };
      }

      this._wireProviderSignals();

      return {
        ...(providerResult && typeof providerResult === "object" ? providerResult : { ok: true }),
        sessionState: this.getSessionState(),
        surface,
        stubFallback: this._stubFallback,
      };
    }

    /**
     * @param {{ surface: string, roomId: string, role?: 'host'|'viewer', userId?: string }} options
     */
    async createSession(options) {
      this._ensureSessionManager();
      const surface = String(options.surface || this._surface || MVP_SURFACE).trim().toLowerCase();
      this._surface = surface;
      return this._session.createSession({
        surface,
        roomId: options.roomId,
        role: options.role,
        userId: options.userId,
      });
    }

    /**
     * @param {{ surface: string, roomId: string, userId: string, userName?: string }} params
     */
    async startLive(params) {
      if (!this._provider) return { ok: false, error: "initialize を先に呼んでください" };
      this._ensureSessionManager();
      const surface = String(params.surface || this._surface || MVP_SURFACE).trim().toLowerCase();
      this._surface = surface;

      if (this._session.state === SESSION_STATES.IDLE) {
        const cr = await this._session.createSession({ surface, roomId: params.roomId, role: "host", userId: params.userId });
        if (!cr.ok) return { ok: false, error: cr.error, sessionState: this.getSessionState() };
      }

      const providerRes = await this._provider.startLive({
        roomId: params.roomId,
        userId: params.userId,
        userName: params.userName,
        surface,
        videoContainer: params.videoContainer,
        manualToken: params.manualToken,
        streamId: params.streamId,
        broadcastId: params.broadcastId,
      });
      if (providerRes?.ok === false) {
        return { ...providerRes, sessionState: this.getSessionState() };
      }

      const sessionRes = await this._session.start({ surface });
      if (!sessionRes.ok) {
        return { ok: false, error: sessionRes.error, sessionState: this.getSessionState() };
      }

      return {
        ...(providerRes && typeof providerRes === "object" ? providerRes : { ok: true }),
        sessionState: this.getSessionState(),
        session: this._session.session,
        surface,
        stubFallback: this._stubFallback,
      };
    }

    /**
     * @param {{ surface: string, roomId: string, userId: string, userName?: string }} params
     */
    async joinLive(params) {
      if (!this._provider) return { ok: false, error: "initialize を先に呼んでください" };
      this._ensureSessionManager();
      const surface = String(params.surface || this._surface || MVP_SURFACE).trim().toLowerCase();
      this._surface = surface;

      if (this._session.state === SESSION_STATES.IDLE) {
        const cr = await this._session.createSession({ surface, roomId: params.roomId, role: "viewer", userId: params.userId });
        if (!cr.ok) return { ok: false, error: cr.error, sessionState: this.getSessionState() };
      }

      const providerRes = await this._provider.joinLive({
        roomId: params.roomId,
        userId: params.userId,
        userName: params.userName,
        surface,
        videoContainer: params.videoContainer,
        manualToken: params.manualToken,
        broadcastId: params.broadcastId,
      });
      if (providerRes?.ok === false) {
        return { ...providerRes, sessionState: this.getSessionState() };
      }

      const sessionRes = await this._session.join({ surface });
      if (!sessionRes.ok) {
        return { ok: false, error: sessionRes.error, sessionState: this.getSessionState() };
      }

      return {
        ...(providerRes && typeof providerRes === "object" ? providerRes : { ok: true }),
        sessionState: this.getSessionState(),
        session: this._session.session,
        surface,
        stubFallback: this._stubFallback,
      };
    }

    /** @param {{ surface: string }} [params] */
    async leaveLive(params = {}) {
      this._ensureSessionManager();
      const surface = String(params.surface || this._surface || MVP_SURFACE).trim().toLowerCase();

      let providerRes = { ok: true };
      if (this._provider) {
        providerRes = await this._provider.leaveLive();
      }

      const sessionRes = await this._maybeSessionLeave(surface);
      return {
        ...(providerRes && typeof providerRes === "object" ? providerRes : { ok: true }),
        sessionState: this.getSessionState(),
        ...sessionRes,
      };
    }

    /** @param {{ surface: string }} [params] */
    async endLive(params = {}) {
      this._ensureSessionManager();
      const surface = String(params.surface || this._surface || MVP_SURFACE).trim().toLowerCase();

      let providerRes = { ok: true };
      if (this._provider) {
        providerRes = await this._provider.endLive();
      }

      const sessionRes = await this._maybeSessionEnd(surface);
      return {
        ...(providerRes && typeof providerRes === "object" ? providerRes : { ok: true }),
        sessionState: this.getSessionState(),
        ...sessionRes,
      };
    }

    /** @param {{ surface: string }} params */
    async reconnect(params) {
      this._ensureSessionManager();
      const surface = String(params.surface || this._surface || MVP_SURFACE).trim().toLowerCase();

      if (this._provider?.reconnectLive) {
        await this._provider.reconnectLive();
      }

      return this._session.reconnect({ surface });
    }

    /** @param {{ surface: string, status?: string, userId?: string }} params */
    async updatePresence(params) {
      this._ensureSessionManager();
      const surface = String(params.surface || this._surface || MVP_SURFACE).trim().toLowerCase();
      return this._session.updatePresence({
        surface,
        status: params.status,
        userId: params.userId,
      });
    }

    /** @private */
    async _maybeSessionLeave(surface) {
      if (!this._session) return {};
      const allowed = [SESSION_STATES.LIVE, SESSION_STATES.CONNECTED, SESSION_STATES.RECONNECTED, SESSION_STATES.RECONNECTING];
      if (!allowed.includes(this._session.state)) return {};
      const res = await this._session.leave({ surface });
      return { session: res.ok ? this._session.session : null };
    }

    /** @private */
    async _maybeSessionEnd(surface) {
      if (!this._session) return {};
      const allowed = [SESSION_STATES.LIVE, SESSION_STATES.RECONNECTED];
      if (!allowed.includes(this._session.state)) return {};
      const res = await this._session.end({ surface });
      return { session: res.ok ? this._session.session : null };
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
      this._surface = null;
      this._stubFallback = false;
      return {
        ...(providerRes && typeof providerRes === "object" ? providerRes : { ok: true }),
        sessionState: SESSION_STATES?.IDLE || "IDLE",
      };
    }
  }

  global.TasuLivePlatformService = TasuLivePlatformService;
})(typeof window !== "undefined" ? window : globalThis);
