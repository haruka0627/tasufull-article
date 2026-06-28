/**
 * Live Platform Integration — Session · Broadcast · Viewer · Provider 正式配線
 * Phase 3 · ZEGO Adapter · stub fallback 維持 · Interface 非変更
 * Phase 4 P4-2 · useEdgeSync opt-in（デフォルト false）
 * Phase 4 P4-3 · Chat Gateway + joinLive set_watching（opt-in）
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
     * @param {{
     *   surface?: string,
     *   providerId?: string,
     *   allowStubFallback?: boolean,
     *   useEdgeSync?: boolean,
     *   edgeBaseUrl?: string,
     *   edgeSync?: object,
     *   broadcastEdgeClient?: object,
     *   viewerEdgeClient?: object,
     *   chatEdgeClient?: object,
     *   recordingEdgeClient?: object,
     *   monitoringEdgeClient?: object,
     *   chatGateway?: object,
     * }} [options]
     */
    constructor(options = {}) {
      /** @private */
      this._surface = String(options.surface || MVP_SURFACE).trim().toLowerCase();
      /** @private */
      this._providerId = String(options.providerId || "stub").trim().toLowerCase();
      /** @private */
      this._allowStubFallback = options.allowStubFallback !== false;
      /** @private */
      this._useEdgeSync = options.useEdgeSync === true;
      /** @private @type {object|null} */
      this._edgeSync = null;
      /** @private */
      this._edgeBaseUrl = String(options.edgeBaseUrl || "").trim();
      /** @private @type {object|null} */
      this._edgeClientOverrides = {
        broadcast: options.broadcastEdgeClient || null,
        viewer: options.viewerEdgeClient || null,
        chat: options.chatEdgeClient || null,
        recording: options.recordingEdgeClient || null,
        monitoring: options.monitoringEdgeClient || null,
      };
      /** @private @type {object|null} */
      this._injectedEdgeSync = options.edgeSync || null;
      /** @private @type {object|null} */
      this._chatGateway = options.chatGateway || null;
      /** @private @type {object|null} */
      this._injectedChatGateway = options.chatGateway || null;
      /** @private @type {object|null} */
      this._chatEdgeClient = null;
      /** @private @type {object|null} */
      this._watchingSyncLastResult = null;
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

    /** Phase 4 P4-2 · Edge sync opt-in（デフォルト false） */
    get useEdgeSync() {
      return this._useEdgeSync === true;
    }

    /** @returns {object|null} */
    get edgeSync() {
      return this._edgeSync;
    }

    /** @returns {object|null} */
    get chatGateway() {
      return this._chatGateway;
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
        useEdgeSync: this.useEdgeSync,
        edgeSyncStatus: this._edgeSync?.getStatus?.() || null,
        edgeSyncLastResult: this._edgeSync?.getLastResult?.() || null,
        chatGatewayReady: Boolean(this._chatGateway),
        watchingSyncLastResult: this._watchingSyncLastResult ? { ...this._watchingSyncLastResult } : null,
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

    /** @private @param {Record<string, unknown>} options */
    _edgeClient(name, ClientCtor) {
      const injected = this._edgeClientOverrides?.[name];
      if (injected) return injected;
      if (!ClientCtor) return null;
      return new ClientCtor({ baseUrl: this._edgeBaseUrl || undefined });
    }

    /** @private */
    _setupEdgeSync(options = {}) {
      if (options.useEdgeSync === true) this._useEdgeSync = true;
      if (options.useEdgeSync === false) this._useEdgeSync = false;

      const EdgeSync = global.TasuLivePlatformEdgeSync;
      if (this._injectedEdgeSync) {
        this._edgeSync = this._injectedEdgeSync;
        this._useEdgeSync = this._edgeSync.enabled === true;
        return;
      }

      if (!this._useEdgeSync) {
        this._edgeSync = null;
        return;
      }

      if (!EdgeSync) {
        this._diagnostics?.recordEdgeSync?.("failed", {
          reason: "TasuLivePlatformEdgeSync が未ロードです",
        });
        this._edgeSync = null;
        return;
      }

      this._edgeSync = new EdgeSync({
        useEdgeSync: true,
        diagnostics: this._diagnostics,
        broadcastEdgeClient: this._edgeClient("broadcast", global.TasuLivePlatformBroadcastEdgeClient),
        viewerEdgeClient: this._edgeClient("viewer", global.TasuLivePlatformViewerEdgeClient),
        chatEdgeClient: this._edgeClient("chat", global.TasuLivePlatformChatEdgeClient),
        recordingEdgeClient: this._edgeClient("recording", global.TasuLivePlatformRecordingEdgeClient),
        monitoringEdgeClient: this._edgeClient("monitoring", global.TasuLivePlatformMonitoringEdgeClient),
      });
    }

    /** @private */
    _setupChatGateway(options = {}) {
      if (options.chatGateway) {
        this._injectedChatGateway = options.chatGateway;
        this._chatGateway = options.chatGateway;
        return;
      }
      if (this._injectedChatGateway) {
        this._chatGateway = this._injectedChatGateway;
        return;
      }

      const ChatGateway = global.TasuLivePlatformChatGateway;
      if (!ChatGateway) return;

      this._chatGateway = new ChatGateway({
        broadcastService: this._broadcast,
        viewerService: this._viewer,
        sessionManager: this._session,
        provider: this._provider,
      });
    }

    /** @private */
    _getChatEdgeClient() {
      if (!this._useEdgeSync) return null;
      if (this._chatEdgeClient) return this._chatEdgeClient;
      const injected = this._edgeClientOverrides?.chat;
      if (injected) {
        this._chatEdgeClient = injected;
        return injected;
      }
      const ChatEdgeClient = global.TasuLivePlatformChatEdgeClient;
      if (!ChatEdgeClient) return null;
      this._chatEdgeClient = new ChatEdgeClient({ baseUrl: this._edgeBaseUrl || undefined });
      return this._chatEdgeClient;
    }

    /** @private @param {Record<string, unknown>} ctx */
    _watchingSyncContext(ctx) {
      return {
        surface: String(ctx.surface || this._surface).trim().toLowerCase(),
        broadcastId: String(ctx.broadcastId || "").trim(),
        userId: ctx.userId ? String(ctx.userId).trim() : null,
        roomId: ctx.roomId ? String(ctx.roomId).trim() : null,
      };
    }

    /** @private @param {Record<string, unknown>} ctx */
    async _runEdgeSetWatching(ctx) {
      if (!this._useEdgeSync) {
        this._diagnostics?.recordChatEdge?.("skipped", {
          op: "setWatching",
          reason: "useEdgeSync_disabled",
          ...this._watchingSyncContext(ctx),
        });
        return null;
      }

      const client = this._getChatEdgeClient();
      const safeCtx = this._watchingSyncContext(ctx);
      if (!client || typeof client.setWatching !== "function") {
        this._diagnostics?.recordChatEdge?.("failed", {
          op: "setWatching",
          error: "chat edge client missing",
          ...safeCtx,
        });
        const res = { ok: true, partial: true, noop: true, reason: "client_missing" };
        this._watchingSyncLastResult = res;
        return res;
      }

      this._diagnostics?.recordChatEdge?.("attempted", { op: "setWatching", ...safeCtx });
      try {
        const syncRes = await client.setWatching({
          surface: safeCtx.surface,
          broadcastId: safeCtx.broadcastId,
          userId: safeCtx.userId,
          watching: true,
        });
        const failed = syncRes?.ok === false;
        this._diagnostics?.recordChatEdge?.(failed ? "failed" : "succeeded", {
          op: "setWatching",
          partial: failed,
          ...safeCtx,
        });
        this._diagnostics?.recordLifecycle("chatEdge:setWatching", {
          partial: failed,
          broadcastId: safeCtx.broadcastId,
          userId: safeCtx.userId,
        });
        const result = failed
          ? { ok: true, partial: true, edgeSyncThrew: false, ...syncRes }
          : { ok: true, ...syncRes };
        this._watchingSyncLastResult = result;
        return result;
      } catch (err) {
        const message = err?.message || String(err);
        this._diagnostics?.recordChatEdge?.("failed", { op: "setWatching", error: message, ...safeCtx });
        const result = { ok: true, partial: true, edgeSyncThrew: true, error: message };
        this._watchingSyncLastResult = result;
        return result;
      }
    }

    /** @private @param {Record<string, unknown>} options */
    async _runChatEdgeSend(options) {
      if (!this._useEdgeSync) return null;
      const client = this._getChatEdgeClient();
      if (!client || typeof client.sendMessage !== "function") return null;

      const surface = String(options.surface || this._surface).trim().toLowerCase();
      const broadcastId = String(options.broadcastId || "").trim();
      const userId = String(options.userId || "").trim();
      const text = String(options.text || "").trim();
      const messageId = options.messageId ? String(options.messageId).trim() : null;
      if (!broadcastId || !userId || !text || !messageId) return null;

      this._diagnostics?.recordChatEdge?.("attempted", {
        op: "sendMessage",
        surface,
        broadcastId,
        userId,
        messageId,
      });
      try {
        const edgeRes = await client.sendMessage({ surface, broadcastId, userId, text, messageId });
        const failed = edgeRes?.ok === false;
        this._diagnostics?.recordChatEdge?.(failed ? "failed" : "succeeded", {
          op: "sendMessage",
          partial: failed,
          surface,
          broadcastId,
          userId,
          messageId,
        });
        return failed ? { ok: true, partial: true, ...edgeRes } : { ok: true, ...edgeRes };
      } catch (err) {
        const message = err?.message || String(err);
        this._diagnostics?.recordChatEdge?.("failed", { op: "sendMessage", error: message, messageId });
        return { ok: true, partial: true, edgeSyncThrew: true, error: message };
      }
    }

    /** @private @param {Record<string, unknown>} ctx */
    _edgeSyncContext(ctx) {
      return {
        surface: String(ctx.surface || this._surface).trim().toLowerCase(),
        broadcastId: String(ctx.broadcastId || "").trim(),
        roomId: ctx.roomId ? String(ctx.roomId).trim() : this._broadcast?.broadcast?.roomId || null,
        hostUserId: ctx.hostUserId || ctx.userId || this._broadcast?.broadcast?.hostUserId || null,
        userId: ctx.userId || null,
        sessionId: ctx.sessionId || this._session?.session?.id || this._session?.session?.sessionId || null,
        streamId: ctx.streamId || null,
        providerState: ctx.providerState || this.canonicalProviderState,
        sessionActive: ctx.sessionActive != null ? ctx.sessionActive : this.sessionState !== (global.PLATFORM_LIVE_SESSION_STATES?.IDLE || "IDLE"),
        reason: ctx.reason || null,
      };
    }

    /** @private @param {Record<string, unknown>} ctx */
    async _runEdgeSetLive(ctx) {
      if (!this._useEdgeSync || !this._edgeSync) return null;
      try {
        const syncRes = await this._edgeSync.setLive(this._edgeSyncContext(ctx));
        this._diagnostics?.recordLifecycle("edgeSync:setLive", {
          partial: Boolean(syncRes?.partial),
          skipped: Boolean(syncRes?.skipped),
          idempotent: Boolean(syncRes?.idempotent),
          broadcastId: ctx.broadcastId,
        });
        return syncRes;
      } catch (err) {
        const message = err?.message || String(err);
        this._diagnostics?.recordEdgeSync?.("failed", { op: "setLive", error: message, broadcastId: ctx.broadcastId });
        return { ok: true, partial: true, edgeSyncThrew: true, error: message };
      }
    }

    /** @private @param {Record<string, unknown>} ctx */
    async _runEdgeClearLive(ctx) {
      if (!this._useEdgeSync || !this._edgeSync) return null;
      try {
        const syncRes = await this._edgeSync.clearLive(this._edgeSyncContext(ctx));
        this._diagnostics?.recordLifecycle("edgeSync:clearLive", {
          partial: Boolean(syncRes?.partial),
          skipped: Boolean(syncRes?.skipped),
          idempotent: Boolean(syncRes?.alreadyClear),
          broadcastId: ctx.broadcastId,
        });
        return syncRes;
      } catch (err) {
        const message = err?.message || String(err);
        this._diagnostics?.recordEdgeSync?.("failed", { op: "clearLive", error: message, broadcastId: ctx.broadcastId });
        return { ok: true, partial: true, edgeSyncThrew: true, error: message };
      }
    }

    /** @private @param {Record<string, unknown>} ctx */
    async _runEdgePatchLive(ctx) {
      if (!this._useEdgeSync || !this._edgeSync) return null;
      try {
        return await this._edgeSync.patchLive(this._edgeSyncContext(ctx));
      } catch (err) {
        const message = err?.message || String(err);
        this._diagnostics?.recordEdgeSync?.("failed", { op: "patchLive", error: message });
        return { ok: true, partial: true, edgeSyncThrew: true, error: message };
      }
    }

    /**
     * @param {{
     *   surface?: string,
     *   providerId?: string,
     *   allowStubFallback?: boolean,
     *   useEdgeSync?: boolean,
     *   edgeBaseUrl?: string,
     *   edgeSync?: object,
     *   broadcastEdgeClient?: object,
     *   viewerEdgeClient?: object,
     *   chatEdgeClient?: object,
     *   recordingEdgeClient?: object,
     *   monitoringEdgeClient?: object,
     *   chatGateway?: object,
     * }} [options]
     */
    async initialize(options = {}) {
      if (options.surface) this._surface = String(options.surface).trim().toLowerCase();
      if (options.providerId) this._providerId = String(options.providerId).trim().toLowerCase();
      if (options.allowStubFallback === false) this._allowStubFallback = false;
      if (options.edgeBaseUrl) this._edgeBaseUrl = String(options.edgeBaseUrl).trim();
      if (options.edgeSync) this._injectedEdgeSync = options.edgeSync;
      if (options.broadcastEdgeClient) this._edgeClientOverrides.broadcast = options.broadcastEdgeClient;
      if (options.viewerEdgeClient) this._edgeClientOverrides.viewer = options.viewerEdgeClient;
      if (options.chatEdgeClient) this._edgeClientOverrides.chat = options.chatEdgeClient;
      if (options.recordingEdgeClient) this._edgeClientOverrides.recording = options.recordingEdgeClient;
      if (options.monitoringEdgeClient) this._edgeClientOverrides.monitoring = options.monitoringEdgeClient;
      if (options.chatGateway) this._injectedChatGateway = options.chatGateway;

      this._createStack();
      this._setupEdgeSync(options);

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
      this._setupChatGateway(options);
      this._wireTelemetry();
      this._initialized = true;
      this._diagnostics?.recordLifecycle("initialize", {
        providerId: this.providerId,
        stubFallback: this._stubFallback,
        canonicalState: this.canonicalProviderState,
        useEdgeSync: this.useEdgeSync,
      });

      return {
        ...(initRes && typeof initRes === "object" ? initRes : { ok: true }),
        stubFallback: this._stubFallback,
        canonicalProviderState: this.canonicalProviderState,
        useEdgeSync: this.useEdgeSync,
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

      const edgeSyncResult = await this._runEdgeSetLive({
        surface,
        broadcastId,
        roomId,
        userId,
        streamId: options.streamId,
      });

      return {
        ...sr,
        sessionState: this.sessionState,
        canonicalProviderState: this.canonicalProviderState,
        providerState: this.providerState,
        edgeSync: edgeSyncResult,
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
      const broadcastId = String(options.broadcastId || this._broadcast?.broadcast?.id || "").trim();
      const roomId = this._broadcast?.broadcast?.roomId || null;
      this._diagnostics?.recordLifecycle("publish:stop", { reason: options.reason });
      const res = await this._broadcast.stopBroadcast({ surface, reason: options.reason });

      let edgeSyncResult = null;
      if (res?.ok !== false && broadcastId) {
        edgeSyncResult = await this._runEdgeClearLive({
          surface,
          broadcastId,
          roomId,
          reason: options.reason,
        });
      }

      return {
        ...res,
        canonicalProviderState: this.canonicalProviderState,
        edgeSync: edgeSyncResult,
        diagnostics: this.getDiagnostics(),
      };
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

      if (this.useEdgeSync && this._broadcast?.broadcast?.id) {
        await this._runEdgePatchLive({
          surface,
          broadcastId: this._broadcast.broadcast.id,
          roomId: this._broadcast.broadcast.roomId,
          providerState: this.canonicalProviderState,
          sessionActive: true,
          broadcastLive: this.broadcastState === (global.PLATFORM_LIVE_BROADCAST_STATES?.LIVE || "live"),
        });
      }

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

      let watchingSyncResult = null;
      if (this._useEdgeSync && providerRes?.ok !== false && sessionRes.ok) {
        watchingSyncResult = await this._runEdgeSetWatching({
          surface,
          broadcastId,
          userId,
          roomId,
        });
      }

      return {
        ...(providerRes && typeof providerRes === "object" ? providerRes : { ok: true }),
        sessionState: this.sessionState,
        canonicalProviderState: this.canonicalProviderState,
        watchingSync: watchingSyncResult,
        diagnostics: this.getDiagnostics(),
      };
    }

    /**
     * @param {{ surface?: string, broadcastId: string, userId: string, text: string }} options
     */
    async sendChatMessage(options = {}) {
      this._ensureReady();
      if (!this._chatGateway) {
        return { ok: false, error: "Chat Gateway が未ロードです", diagnostics: this.getDiagnostics() };
      }
      const surface = String(options.surface || this._surface).trim().toLowerCase();
      const gwRes = await this._chatGateway.sendMessage({ ...options, surface });
      if (gwRes?.ok === false) {
        return { ...gwRes, diagnostics: this.getDiagnostics() };
      }

      const chatEdgeResult = await this._runChatEdgeSend({
        surface,
        broadcastId: options.broadcastId,
        userId: options.userId,
        text: options.text,
        messageId: gwRes.message?.id,
      });

      return {
        ...gwRes,
        chatEdge: chatEdgeResult,
        diagnostics: this.getDiagnostics(),
      };
    }

    /**
     * @param {{ surface?: string, broadcastId: string, limit?: number }} options
     */
    getChatMessages(options = {}) {
      this._ensureReady();
      if (!this._chatGateway) {
        return { ok: false, error: "Chat Gateway が未ロードです" };
      }
      const surface = String(options.surface || this._surface).trim().toLowerCase();
      return this._chatGateway.getMessages({ ...options, surface });
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
        useEdgeSync: this.useEdgeSync,
        chatGatewayReady: Boolean(this._chatGateway),
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
      this._edgeSync = null;
      this._chatGateway = null;
      this._chatEdgeClient = null;
      this._watchingSyncLastResult = null;
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
