/**
 * Live Platform Integration — Session · Broadcast · Viewer · Provider 正式配線
 * Phase 3 · ZEGO Adapter · stub fallback 維持 · Interface 非変更
 *
 * UI / Edge → LivePlatformIntegration → Broadcast / Viewer / Session → Provider → Adapter → SDK
 */
(function (global) {
  "use strict";

  const MVP_SURFACE = global.LIVE_SURFACE_MVP || "platform";
  const SESSION_EVENTS = global.PLATFORM_LIVE_SESSION_EVENTS || global.TasuLivePlatformSessionEvents;
  const BROADCAST_EVENTS = global.PLATFORM_LIVE_BROADCAST_EVENTS || global.TasuLivePlatformBroadcastEvents;
  const VIEWER_EVENTS = global.PLATFORM_LIVE_VIEWER_EVENTS || global.TasuLivePlatformViewerEvents;
  const mapState = global.TasuLivePlatformProviderStateMap?.mapProviderState;
  const CANONICAL = global.PLATFORM_LIVE_CANONICAL_PROVIDER_STATES;

  class TasuLivePlatformIntegration {
    /**
     * @param {{ surface?: string, providerId?: string, allowStubFallback?: boolean }} [options]
     */
    constructor(options = {}) {
      /** @private */
      this._surface = String(options.surface || MVP_SURFACE).trim().toLowerCase();
      /** @private */
      this._providerId = String(options.providerId || "stub").trim().toLowerCase();
      /** @private */
      this._allowStubFallback = options.allowStubFallback !== false;
      /** @private */
      this._provider = null;
      /** @private */
      this._session = null;
      /** @private */
      this._broadcast = null;
      /** @private */
      this._viewer = null;
      /** @private */
      this._diagnostics = global.TasuLivePlatformDiagnostics
        ? new global.TasuLivePlatformDiagnostics()
        : null;
      /** @private */
      this._stubFallback = false;
      /** @private */
      this._reconnecting = false;
      /** @private */
      this._initialized = false;
      /** @private @type {{ event: string, payload: unknown, at: string }|null} */
      this._lastSessionEvent = null;
    }

    /** Provider 状態（PoC 互換） */
    get state() {
      return this.providerState;
    }

    /** @returns {object|null} diagnostics / E2E 用 */
    get provider() {
      return this._provider;
    }

    getSessionState() {
      return this.sessionState;
    }

    get providerId() {
      return this._provider?.providerId || this._providerId;
    }

    get isStubFallback() {
      return this._stubFallback;
    }

    get surface() {
      return this._surface;
    }

    /** @returns {string} raw provider state */
    get providerState() {
      return this._provider?.state || "idle";
    }

    /** @returns {string} canonical provider state */
    get canonicalProviderState() {
      if (this._provider?.getCanonicalProviderState) {
        return this._provider.getCanonicalProviderState();
      }
      return mapState ? mapState(this.providerState, { reconnecting: this._reconnecting }) : this.providerState;
    }

    get sessionState() {
      return this._session?.state || global.PLATFORM_LIVE_SESSION_STATES?.IDLE || "IDLE";
    }

    get broadcastState() {
      return this._broadcast?.state || null;
    }

    /** @returns {import('./live-platform-diagnostics.js')|null} */
    getDiagnostics() {
      const extra = {
        providerState: this.providerState,
        canonicalProviderState: this.canonicalProviderState,
        sessionState: this.sessionState,
        broadcastState: this.broadcastState,
        stubFallback: this._stubFallback,
        providerId: this.providerId,
      };
      if (this._provider?.getPublishDiagnostics) {
        extra.publishDiagnostics = this._provider.getPublishDiagnostics();
      }
      if (this._provider?.getIntegrationDiagnostics) {
        extra.providerDiagnostics = this._provider.getIntegrationDiagnostics();
      }
      return this._diagnostics ? this._diagnostics.snapshot(extra) : extra;
    }

    /** @private */
    _createStack() {
      const SessionManager = global.TasuLivePlatformSessionManager;
      const BroadcastService = global.TasuLivePlatformBroadcastService;
      const ViewerService = global.TasuLivePlatformViewerService;
      const CcuRegistry = global.TasuLivePlatformViewerCcuRegistry;
      if (!SessionManager || !BroadcastService || !ViewerService) {
        throw new Error("Platform Live Core (Session/Broadcast/Viewer) が未ロードです");
      }

      this._session = new SessionManager();
      this._broadcast = new BroadcastService({ sessionManager: this._session });
      this._viewer = new ViewerService({
        broadcastService: this._broadcast,
        sessionManager: this._session,
        ccuRegistry: CcuRegistry ? new CcuRegistry() : null,
      });
    }

    /** @private */
    _wireTelemetry() {
      if (!this._provider) return;

      if (this._provider.onSignal) {
        this._provider.onSignal(async (signal, payload) => {
          this._diagnostics?.recordProviderSignal(signal, payload);
          if (signal === global.PLATFORM_LIVE_PROVIDER_SIGNALS?.PROVIDER_RECONNECTING) {
            this._reconnecting = true;
          }
          if (signal === global.PLATFORM_LIVE_PROVIDER_SIGNALS?.PROVIDER_RECONNECTED) {
            this._reconnecting = false;
          }
          if (this._session?.handleProviderSignal) {
            await this._session.handleProviderSignal(signal, {
              ...payload,
              surface: payload?.surface || this._surface,
            });
          }
        });
      }

      if (this._provider.onBroadcastSignal) {
        this._provider.onBroadcastSignal((signal, payload) => {
          this._diagnostics?.recordBroadcastSignal(signal, payload);
          if (this._broadcast?.handleProviderSignal) {
            this._broadcast.handleProviderSignal(signal, payload);
          }
        });
      }

      if (SESSION_EVENTS && this._session) {
        for (const ev of Object.values(SESSION_EVENTS)) {
          this._session.on(ev, (payload) => {
            this._lastSessionEvent = { event: ev, payload, at: new Date().toISOString() };
            this._diagnostics?.recordSessionEvent(ev, payload);
          });
        }
      }
      if (BROADCAST_EVENTS && this._broadcast) {
        this._broadcast.on(BROADCAST_EVENTS.BROADCAST_STARTED, (p) =>
          this._diagnostics?.recordLifecycle("broadcast:started", p),
        );
        this._broadcast.on(BROADCAST_EVENTS.BROADCAST_STOPPED, (p) =>
          this._diagnostics?.recordLifecycle("broadcast:stopped", p),
        );
      }
      if (VIEWER_EVENTS && this._viewer) {
        for (const ev of [VIEWER_EVENTS.VIEWER_JOINED, VIEWER_EVENTS.VIEWER_LEFT, VIEWER_EVENTS.VIEWER_RECONNECTING]) {
          this._viewer.on(ev, (payload) => this._diagnostics?.recordViewerEvent(ev, payload));
        }
      }
    }

    /** @private */
    _attachProviderToStack() {
      this._broadcast?.setProvider?.(this._provider);
      this._viewer?.setProvider?.(this._provider);
    }

    /**
     * @param {{ surface?: string, providerId?: string, allowStubFallback?: boolean }} [options]
     */
    async initialize(options = {}) {
      if (options.surface) this._surface = String(options.surface).trim().toLowerCase();
      if (options.providerId) this._providerId = String(options.providerId).trim().toLowerCase();
      if (options.allowStubFallback === false) this._allowStubFallback = false;

      this._createStack();

      if (!global.createPlatformLiveProvider) {
        return { ok: false, error: "createPlatformLiveProvider が未ロードです" };
      }

      this._provider = global.createPlatformLiveProvider(this._providerId, {
        allowStubFallback: this._allowStubFallback,
      });
      this._stubFallback = global.isPlatformLiveStubFallback?.(this._provider) || this._provider.providerId === "stub";

      const initRes = await this._provider.initialize({ surface: this._surface });
      if (initRes?.ok === false) {
        return { ...initRes, stubFallback: this._stubFallback };
      }

      this._attachProviderToStack();
      this._wireTelemetry();
      this._initialized = true;
      this._diagnostics?.recordLifecycle("initialize", {
        providerId: this.providerId,
        stubFallback: this._stubFallback,
        canonicalState: this.canonicalProviderState,
      });

      return {
        ...(initRes && typeof initRes === "object" ? initRes : { ok: true }),
        stubFallback: this._stubFallback,
        canonicalProviderState: this.canonicalProviderState,
      };
    }

    /**
     * @param {{ surface?: string, broadcastId?: string, roomId: string, title?: string, hostUserId?: string }} options
     */
    async createBroadcast(options) {
      this._ensureReady();
      const surface = String(options.surface || this._surface).trim().toLowerCase();
      return this._broadcast.createBroadcast({
        surface,
        broadcastId: options.broadcastId,
        roomId: options.roomId,
        title: options.title,
        hostUserId: options.hostUserId,
      });
    }

    /**
     * Host publish — Broadcast.start + Provider RTC passthrough
     * @param {{
     *   surface?: string,
     *   broadcastId?: string,
     *   roomId: string,
     *   userId: string,
     *   userName?: string,
     *   videoContainer?: HTMLElement,
     *   manualToken?: string,
     *   streamId?: string,
     * }} options
     */
    async startPublish(options) {
      this._ensureReady();
      const surface = String(options.surface || this._surface).trim().toLowerCase();
      const broadcastId = String(options.broadcastId || `bc-${options.roomId}`).trim();
      const roomId = String(options.roomId || "").trim();
      const userId = String(options.userId || "").trim();

      if (!roomId || !userId) {
        return { ok: false, error: "roomId / userId が必要です" };
      }

      this._diagnostics?.recordLifecycle("publish:start", { broadcastId, roomId, userId });

      if (!this._broadcast.broadcast || this._broadcast.broadcast.roomId !== roomId) {
        const cr = await this.createBroadcast({
          surface,
          broadcastId,
          roomId,
          hostUserId: userId,
        });
        if (!cr.ok) return cr;
      }

      const sr = await this._broadcast.startBroadcast({
        surface,
        userId,
        videoContainer: options.videoContainer,
        manualToken: options.manualToken,
        userName: options.userName,
        streamId: options.streamId,
        roomId,
        broadcastId,
      });

      if (sr?.ok === false) {
        this._diagnostics?.recordLifecycle("publish:failed", { error: sr.error, code: sr.code });
        return { ...sr, canonicalProviderState: this.canonicalProviderState, diagnostics: this.getDiagnostics() };
      }

      this._diagnostics?.recordLifecycle("publish:success", {
        broadcastState: this.broadcastState,
        sessionState: this.sessionState,
        canonicalProviderState: this.canonicalProviderState,
      });

      return {
        ...sr,
        sessionState: this.sessionState,
        canonicalProviderState: this.canonicalProviderState,
        providerState: this.providerState,
        diagnostics: this.getDiagnostics(),
      };
    }

    /**
     * @param {{
     *   surface?: string,
     *   broadcastId?: string,
     *   userId: string,
     *   videoContainer?: HTMLElement,
     *   manualToken?: string,
     *   userName?: string,
     * }} options
     */
    async joinAsViewer(options) {
      this._ensureReady();
      const surface = String(options.surface || this._surface).trim().toLowerCase();
      const userId = String(options.userId || "").trim();
      const broadcastId = String(
        options.broadcastId || this._broadcast?.broadcast?.id || "",
      ).trim();

      if (!userId || !broadcastId) {
        return { ok: false, error: "userId / broadcastId が必要です" };
      }

      this._diagnostics?.recordLifecycle("viewer:join:start", { broadcastId, userId });

      const jr = await this._viewer.joinViewer({
        surface,
        broadcastId,
        userId,
        videoContainer: options.videoContainer,
        manualToken: options.manualToken,
        userName: options.userName,
        roomId: this._broadcast?.broadcast?.roomId,
      });

      if (jr?.ok === false) {
        this._diagnostics?.recordLifecycle("viewer:join:failed", { error: jr.error });
        return { ...jr, diagnostics: this.getDiagnostics() };
      }

      this._diagnostics?.recordLifecycle("viewer:join:success", {
        viewerState: jr.state,
        sessionState: this.sessionState,
      });

      return {
        ...jr,
        sessionState: this.sessionState,
        canonicalProviderState: this.canonicalProviderState,
        diagnostics: this.getDiagnostics(),
      };
    }

    /** @param {{ surface?: string, reason?: string }} [options] */
    async stopPublish(options = {}) {
      this._ensureReady();
      const surface = String(options.surface || this._surface).trim().toLowerCase();
      this._diagnostics?.recordLifecycle("publish:stop", { reason: options.reason });
      const res = await this._broadcast.stopBroadcast({ surface, reason: options.reason });
      return { ...res, canonicalProviderState: this.canonicalProviderState, diagnostics: this.getDiagnostics() };
    }

    /** @param {{ surface?: string, userId: string }} options */
    async leaveViewer(options) {
      this._ensureReady();
      const surface = String(options.surface || this._surface).trim().toLowerCase();
      this._diagnostics?.recordLifecycle("viewer:leave", { userId: options.userId });
      const res = await this._viewer.leaveViewer({ surface, userId: options.userId });
      return { ...res, diagnostics: this.getDiagnostics() };
    }

    /** @param {{ surface?: string, role?: 'host'|'viewer', userId?: string }} [options] */
    async reconnect(options = {}) {
      this._ensureReady();
      const surface = String(options.surface || this._surface).trim().toLowerCase();
      this._reconnecting = true;
      this._diagnostics?.recordLifecycle("reconnect:start", { role: options.role });

      if (this._provider?.reconnectLive) {
        const pr = await this._provider.reconnectLive();
        if (pr?.ok === false) {
          this._reconnecting = false;
          return { ...pr, diagnostics: this.getDiagnostics() };
        }
      }

      const sr = await this._session.reconnect({ surface });
      this._reconnecting = false;
      this._diagnostics?.recordLifecycle("reconnect:done", { sessionState: this.sessionState });

      return {
        ...(sr && typeof sr === "object" ? sr : { ok: true }),
        canonicalProviderState: this.canonicalProviderState,
        diagnostics: this.getDiagnostics(),
      };
    }

    /** PoC 互換 — createSession */
    async createSession(options) {
      this._ensureReady();
      return this._session.createSession({
        surface: options.surface || this._surface,
        roomId: options.roomId,
        role: options.role,
        userId: options.userId,
      });
    }

    /** PoC 互換 — startLive（Integration 経由 publish） */
    async startLive(params) {
      return this.startPublish({
        surface: params.surface,
        roomId: params.roomId,
        userId: params.userId,
        userName: params.userName,
        videoContainer: params.videoContainer,
        manualToken: params.manualToken,
        streamId: params.streamId,
        broadcastId: params.broadcastId,
      });
    }

    /** PoC 互換 — leaveLive（provider + session） */
    async leaveLive(options = {}) {
      this._ensureReady();
      const surface = String(options.surface || this._surface).trim().toLowerCase();
      this._diagnostics?.recordLifecycle("leaveLive", {});

      let providerRes = { ok: true };
      if (this._provider?.leaveLive) {
        providerRes = await this._provider.leaveLive();
      }

      const SESSION_STATES = global.PLATFORM_LIVE_SESSION_STATES;
      const allowed = [
        SESSION_STATES?.LIVE,
        SESSION_STATES?.CONNECTED,
        SESSION_STATES?.RECONNECTED,
        SESSION_STATES?.RECONNECTING,
      ].filter(Boolean);
      if (this._session && allowed.includes(this._session.state) && this._session.leave) {
        await this._session.leave({ surface });
      }

      return {
        ...(providerRes && typeof providerRes === "object" ? providerRes : { ok: true }),
        sessionState: this.sessionState,
        canonicalProviderState: this.canonicalProviderState,
        diagnostics: this.getDiagnostics(),
      };
    }

    /** PoC 互換 — joinLive（別クライアント audience · broadcast ローカル LIVE 不要） */
    async joinLive(params) {
      this._ensureReady();
      const surface = String(params.surface || this._surface).trim().toLowerCase();
      const userId = String(params.userId || "").trim();
      const roomId = String(params.roomId || "").trim();
      const broadcastId = String(params.broadcastId || (roomId ? `bc-${roomId}` : "")).trim();

      if (!roomId || !userId) {
        return { ok: false, error: "roomId / userId が必要です" };
      }

      this._diagnostics?.recordLifecycle("viewer:join:start", { broadcastId, userId, mode: "direct" });

      const SESSION_STATES = global.PLATFORM_LIVE_SESSION_STATES;
      if (this._session.state === SESSION_STATES?.IDLE) {
        const cr = await this._session.createSession({
          surface,
          roomId,
          role: "viewer",
          userId,
        });
        if (!cr.ok) return { ...cr, diagnostics: this.getDiagnostics() };
      }

      const providerRes = await this._provider.joinLive({
        roomId,
        userId,
        userName: params.userName,
        surface,
        videoContainer: params.videoContainer,
        manualToken: params.manualToken,
        broadcastId,
      });
      if (providerRes?.ok === false) {
        this._diagnostics?.recordLifecycle("viewer:join:failed", { error: providerRes.error });
        return { ...providerRes, diagnostics: this.getDiagnostics() };
      }

      const sessionRes = await this._session.join({ surface });
      if (!sessionRes.ok) {
        return { ok: false, error: sessionRes.error, diagnostics: this.getDiagnostics() };
      }

      this._diagnostics?.recordLifecycle("viewer:join:success", {
        sessionState: this.sessionState,
        mode: "direct",
      });

      return {
        ...(providerRes && typeof providerRes === "object" ? providerRes : { ok: true }),
        sessionState: this.sessionState,
        canonicalProviderState: this.canonicalProviderState,
        diagnostics: this.getDiagnostics(),
      };
    }

    getSessionSnapshot() {
      return {
        state: this.sessionState,
        session: this._session?.session ? { ...this._session.session } : null,
        providerState: this.providerState,
        canonicalProviderState: this.canonicalProviderState,
        broadcastState: this.broadcastState,
        surface: this._surface,
        stubFallback: this._stubFallback,
        lastEvent: this._lastSessionEvent ? { ...this._lastSessionEvent } : null,
        status: this._session?.getStatus?.() || null,
        diagnostics: this.getDiagnostics(),
      };
    }

    onSessionEvent(event, handler) {
      this._session?.on(event, handler);
      return this;
    }

    onProviderSignal(handler) {
      this._provider?.onSignal?.(handler);
      return this;
    }

    onBroadcastSignal(handler) {
      this._provider?.onBroadcastSignal?.(handler);
      return this;
    }

    onViewerEvent(event, handler) {
      this._viewer?.on(event, handler);
      return this;
    }

    /** @private */
    _ensureReady() {
      if (!this._initialized || !this._provider) {
        throw new Error("initialize を先に呼んでください");
      }
    }

    async dispose() {
      this._diagnostics?.recordLifecycle("dispose", {});
      if (this._viewer) await this._viewer.dispose?.();
      if (this._broadcast) await this._broadcast.dispose?.();
      if (this._session) await this._session.dispose?.();
      if (this._provider) await this._provider.dispose?.();
      this._viewer = null;
      this._broadcast = null;
      this._session = null;
      this._provider = null;
      this._initialized = false;
      this._reconnecting = false;
      return {
        ok: true,
        sessionState: global.PLATFORM_LIVE_SESSION_STATES?.IDLE || "IDLE",
        canonicalProviderState: CANONICAL?.STOPPED || "stopped",
      };
    }
  }

  global.TasuLivePlatformIntegration = TasuLivePlatformIntegration;
})(typeof window !== "undefined" ? window : globalThis);
