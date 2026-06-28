/**
 * Live Platform — ZEGO Provider Adapter
 * Phase 1 · TLV PoC delegate · PlatformLiveProviderInterface 適合
 * PoC（live/providers/zego-live-provider.js）は変更しない
 */
(function (global) {
  "use strict";

  const Base = global.PlatformLiveProviderInterface;
  const SIG = global.PLATFORM_LIVE_PROVIDER_SIGNALS || global.TasuLivePlatformProviderSignals;
  const BSIG =
    global.PLATFORM_LIVE_BROADCAST_PROVIDER_SIGNALS || global.TasuLivePlatformBroadcastProviderSignals;

  if (!Base) {
    throw new Error("ZegoLiveProviderAdapter: load live-provider-interface.js first");
  }

  const DEFAULT_TOKEN_PATH = "/api/tlv-zego-token";
  const DEFAULT_PUBLISH_TIMEOUT_MS = 90000;

  /** @param {unknown} err */
  function formatSdkError(err) {
    if (!err) return "unknown error";
    if (typeof err === "string") return err;
    if (err instanceof Error) return err.message || err.name;
    if (typeof err === "object") {
      const o = /** @type {{ message?: string, errorCode?: number, code?: number }} */ (err);
      if (o.message && typeof o.message === "string") return o.message;
      if (o.errorCode != null) return `ZEGO errorCode=${o.errorCode}`;
      if (o.code != null) return `ZEGO code=${o.code}`;
      try {
        return JSON.stringify(err);
      } catch {
        return String(err);
      }
    }
    return String(err);
  }

  /** @param {string} step @param {Record<string, unknown>} [meta] */
  function diagStep(diag, step, meta = {}) {
    if (!diag) return;
    const entry = { step, at: new Date().toISOString(), t: Date.now(), ...meta };
    diag.steps.push(entry);
    if (typeof console !== "undefined" && console.info) {
      console.info("[ZegoAdapterPublishDiag]", step, meta?.detail || meta?.error || "");
    }
  }

  /** @param {string} event @param {unknown[]} payload */
  function summarizeSdkPayload(event, payload) {
    try {
      if (event === "roomStateUpdate") {
        return { roomId: payload[0], state: payload[1] };
      }
      if (event === "roomStreamUpdate") {
        return {
          roomId: payload[0],
          updateType: payload[1],
          streamCount: Array.isArray(payload[2]) ? payload[2].length : 0,
        };
      }
      if (event === "publisherStateUpdate") {
        return { streamId: payload[0], state: payload[1] };
      }
      if (event === "playerStateUpdate") {
        return { streamId: payload[0], state: payload[1] };
      }
      return { argCount: payload.length };
    } catch {
      return { argCount: payload?.length || 0 };
    }
  }

  class ZegoLiveProviderAdapter extends Base {
    /**
     * @param {{ pocDelegate?: object, fetchImpl?: typeof fetch, config?: object }} [options]
     */
    constructor(options = {}) {
      super();
      /** @private */
      this._poc =
        options.pocDelegate ||
        (global.TlvZegoLiveProvider ? new global.TlvZegoLiveProvider() : null);
      /** @private */
      this._fetch =
        options.fetchImpl || (typeof global.fetch === "function" ? global.fetch.bind(global) : null);
      /** @private */
      this._configOverride = options.config || null;
      /** @private */
      this._state = "idle";
      /** @private */
      this._surface = null;
      /** @private @type {'host'|'viewer'|null} */
      this._role = null;
      /** @private @type {object|null} */
      this._sessionCache = null;
      /** @private */
      this._disposed = false;
      /** @private @type {{ steps: object[], sdkEvents: object[], errors: object[], engineWrapped: boolean, timeoutMs: number, lastStep: string|null, blockedAt: string|null }} */
      this._publishDiag = {
        steps: [],
        sdkEvents: [],
        errors: [],
        engineWrapped: false,
        timeoutMs: DEFAULT_PUBLISH_TIMEOUT_MS,
        lastStep: null,
        blockedAt: null,
      };
      /** @private @type {Map<string, Function>} */
      this._engineRestore = new Map();
    }

    /** PoC / verify 用 · publish 診断スナップショット */
    getPublishDiagnostics() {
      const poc = this._poc;
      const engine = poc?._engine || null;
      return {
        steps: this._publishDiag.steps.slice(),
        sdkEvents: this._publishDiag.sdkEvents.slice(),
        errors: this._publishDiag.errors.slice(),
        lastStep: this._publishDiag.lastStep,
        blockedAt: this._publishDiag.blockedAt,
        timeoutMs: this._publishDiag.timeoutMs,
        engineWrapped: this._publishDiag.engineWrapped,
        pocState: poc?.state || null,
        roomId: poc?._roomId || null,
        userId: poc?._userId || null,
        streamId: poc?._publishStreamId || null,
        hasLocalStream: Boolean(poc?._localStream),
        hasVideoContainer: Boolean(poc?._videoContainer),
        enginePresent: Boolean(engine),
        engineApis: engine
          ? {
              loginRoom: typeof engine.loginRoom === "function",
              createZegoStream: typeof engine.createZegoStream === "function",
              createStream: typeof engine.createStream === "function",
              startPublishingStream: typeof engine.startPublishingStream === "function",
            }
          : null,
      };
    }

    /** @private */
    _resetPublishDiag(timeoutMs = DEFAULT_PUBLISH_TIMEOUT_MS) {
      this._publishDiag = {
        steps: [],
        sdkEvents: [],
        errors: [],
        engineWrapped: false,
        timeoutMs,
        lastStep: null,
        blockedAt: null,
      };
      this._restoreEnginePatches();
    }

    /** @private */
    _restoreEnginePatches() {
      const engine = this._poc?._engine;
      if (!engine) {
        this._engineRestore.clear();
        return;
      }
      for (const [name, fn] of this._engineRestore.entries()) {
        engine[name] = fn;
      }
      this._engineRestore.clear();
      this._publishDiag.engineWrapped = false;
    }

    /** @private */
    _wrapEngineMethod(engine, methodName, diag) {
      if (!engine || typeof engine[methodName] !== "function") return false;
      if (this._engineRestore.has(methodName)) return true;
      const original = engine[methodName].bind(engine);
      this._engineRestore.set(methodName, engine[methodName]);
      engine[methodName] = async (...args) => {
        const meta = { method: methodName };
        if (methodName === "loginRoom") {
          meta.roomId = String(args[0] || "");
          meta.userId = args[2]?.userID || args[2]?.userId || null;
        }
        if (methodName === "startPublishingStream") {
          meta.streamId = String(args[0] || "");
        }
        diagStep(diag, `${methodName}:start`, meta);
        this._publishDiag.lastStep = `${methodName}:start`;
        try {
          const result = await original(...args);
          diagStep(diag, `${methodName}:done`, {
            ...meta,
            resultType: typeof result,
            resultIsFalse: result === false,
          });
          this._publishDiag.lastStep = `${methodName}:done`;
          return result;
        } catch (err) {
          const message = formatSdkError(err);
          diagStep(diag, `${methodName}:error`, { ...meta, error: message });
          this._publishDiag.errors.push({ method: methodName, message, at: new Date().toISOString() });
          this._publishDiag.blockedAt = `${methodName}:error`;
          throw err;
        }
      };
      return true;
    }

    /** @private */
    _attachSdkEventListeners(engine, diag) {
      if (!engine || typeof engine.on !== "function") return;
      const events = [
        "roomStateUpdate",
        "roomStreamUpdate",
        "publisherStateUpdate",
        "playerStateUpdate",
        "roomUserUpdate",
        "roomOnlineUserCountUpdate",
        "IMRecvBroadcastMessage",
        "tokenWillExpire",
      ];
      for (const ev of events) {
        try {
          engine.on(ev, (...payload) => {
            const entry = { event: ev, at: new Date().toISOString(), payloadSummary: summarizeSdkPayload(ev, payload) };
            diag.sdkEvents.push(entry);
            if (typeof console !== "undefined" && console.info) {
              console.info("[ZegoAdapterSdkEvent]", ev, entry.payloadSummary);
            }
          });
        } catch (_) {
          /* noop */
        }
      }
    }

    /** @private */
    _wrapEngineForPublishTrace() {
      const engine = this._poc?._engine;
      const diag = this._publishDiag;
      if (!engine) {
        diagStep(diag, "engine:missing");
        return;
      }
      diagStep(diag, "engine:present", {
        apis: {
          loginRoom: typeof engine.loginRoom === "function",
          createZegoStream: typeof engine.createZegoStream === "function",
          createStream: typeof engine.createStream === "function",
          startPublishingStream: typeof engine.startPublishingStream === "function",
        },
      });
      this._attachSdkEventListeners(engine, diag);
      const wrapped = ["loginRoom", "createZegoStream", "createStream", "startPublishingStream"].filter((m) =>
        this._wrapEngineMethod(engine, m, diag),
      );
      diag.engineWrapped = wrapped.length > 0;
      diagStep(diag, "engine:wrapped", { methods: wrapped });
    }

    /** @private */
    async _startLiveWithDiagnostics(options, timeoutMs) {
      this._wrapEngineForPublishTrace();
      diagStep(this._publishDiag, "poc:startLive:begin", {
        roomId: options.roomId,
        userId: options.userId,
        streamId: options.streamId || null,
        hasVideoContainer: Boolean(options.videoContainer),
      });
      this._publishDiag.lastStep = "poc:startLive:begin";

      let timer;
      const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => {
          const blocked = this._publishDiag.lastStep || "poc:startLive:unknown";
          this._publishDiag.blockedAt = blocked;
          reject(new Error(`startLive timeout after ${timeoutMs}ms at ${blocked}`));
        }, timeoutMs);
      });

      try {
        const result = await Promise.race([this._poc.startLive(options), timeoutPromise]);
        clearTimeout(timer);
        diagStep(this._publishDiag, "poc:startLive:done", {
          ok: result?.ok !== false,
          state: result?.state || this._poc?.state,
          error: result?.error || null,
        });
        this._publishDiag.lastStep = "poc:startLive:done";
        return result;
      } catch (err) {
        clearTimeout(timer);
        const message = formatSdkError(err);
        diagStep(this._publishDiag, "poc:startLive:fail", { error: message });
        if (!this._publishDiag.blockedAt) {
          this._publishDiag.blockedAt = this._publishDiag.lastStep || "poc:startLive:fail";
        }
        return { ok: false, error: message, diagnostics: this.getPublishDiagnostics() };
      } finally {
        this._restoreEnginePatches();
      }
    }

    /** @returns {boolean} */
    get isZegoAdapter() {
      return true;
    }

    /** @returns {string} */
    get providerId() {
      return "zego";
    }

    /** @returns {string} */
    get state() {
      if (this._disposed) return "disposed";
      return this._poc?.state || this._state;
    }

    /** @private */
    _readConfig() {
      const cfg =
        this._configOverride ||
        global.PLATFORM_LIVE_ZEGO_CONFIG ||
        global.TLV_LIVE_ZEGO_CONFIG ||
        {};
      return {
        appId: Number(cfg.appId || 0),
        server: String(cfg.server || "").trim(),
        tokenApiPath: String(cfg.tokenApiPath || DEFAULT_TOKEN_PATH).trim(),
      };
    }

    /** @private */
    _ensurePoc() {
      if (!this._poc) {
        throw new Error("TlvZegoLiveProvider delegate が未ロードです");
      }
      if (this._disposed) {
        throw new Error("Adapter は dispose 済みです");
      }
    }

    /**
     * @param {{ roomId: string, userId: string, role?: string, manualToken?: string }} params
     */
    async fetchToken(params) {
      const manual = String(params?.manualToken || "").trim();
      if (manual) {
        return { ok: true, token: manual, source: "manual" };
      }

      const roomId = String(params?.roomId || "").trim();
      const userId = String(params?.userId || "").trim();
      const role = String(params?.role || "audience").trim().toLowerCase();
      if (!roomId || !userId) {
        return { ok: false, error: "roomId / userId が必要です" };
      }

      if (!this._fetch) {
        return { ok: false, error: "fetch が利用できません" };
      }

      const cfg = this._readConfig();
      let res;
      try {
        res = await this._fetch(cfg.tokenApiPath, {
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

      return {
        ok: true,
        token,
        source: "api",
        appId: body.appId,
        server: body.server,
        role: body.role,
      };
    }

    /** @private */
    _cacheSession(params, role) {
      this._sessionCache = {
        surface: String(params.surface || this._surface || "platform").trim().toLowerCase(),
        roomId: String(params.roomId || "").trim(),
        userId: String(params.userId || "").trim(),
        userName: String(params.userName || params.userId || "").trim(),
        videoContainer: params.videoContainer || null,
        streamId: params.streamId ? String(params.streamId).trim() : undefined,
        manualToken: params.manualToken ? String(params.manualToken).trim() : undefined,
        broadcastId: params.broadcastId ? String(params.broadcastId).trim() : undefined,
      };
      this._role = role;
      this._surface = this._sessionCache.surface;
    }

    /** @private */
    _emitConnecting(payload) {
      if (SIG) this._emitSignal(SIG.PROVIDER_CONNECTING, payload);
    }

    /** @private */
    _emitConnected(payload) {
      if (SIG) this._emitSignal(SIG.PROVIDER_CONNECTED, payload);
    }

    /** @private */
    _emitDisconnected(payload) {
      if (SIG) this._emitSignal(SIG.PROVIDER_DISCONNECTED, payload);
    }

    /** @private */
    _emitReconnecting(payload) {
      if (SIG) this._emitSignal(SIG.PROVIDER_RECONNECTING, payload);
    }

    /** @private */
    _emitReconnected(payload) {
      if (SIG) this._emitSignal(SIG.PROVIDER_RECONNECTED, payload);
    }

    /** @private */
    _emitError(payload) {
      if (SIG) this._emitSignal(SIG.PROVIDER_ERROR, payload);
    }

    /** @param {{ surface?: string, appId?: number, server?: string }} options */
    async initialize(options = {}) {
      this._ensurePoc();
      const cfg = this._readConfig();
      const appId = Number(options.appId ?? cfg.appId);
      const server = String(options.server ?? cfg.server).trim();
      this._surface = String(options.surface || "platform").trim().toLowerCase() || "platform";

      if (!appId || !server) {
        this._state = "error";
        return {
          ok: false,
          error: "appId と server が必要です（ZEGO config を確認）",
          providerId: this.providerId,
          adapter: true,
        };
      }

      try {
        const result = await this._poc.initialize({ appId, server });
        if (result?.ok === false) {
          this._state = "error";
          this._emitError({ surface: this._surface, message: result.error });
          return { ...result, providerId: this.providerId, adapter: true };
        }
        this._state = this._poc.state || "ready";
        return {
          ok: true,
          state: this._state,
          providerId: this.providerId,
          adapter: true,
          surface: this._surface,
        };
      } catch (err) {
        this._state = "error";
        this._emitError({ surface: this._surface, message: err?.message || String(err) });
        return { ok: false, error: err?.message || String(err), providerId: this.providerId, adapter: true };
      }
    }

    /** @private */
    async _rtcPublish(options, role = "host") {
      this._ensurePoc();
      const surface = String(options.surface || this._surface || "platform").trim().toLowerCase();
      const roomId = String(options.roomId || "").trim();
      const userId = String(options.userId || "").trim();
      if (!roomId || !userId) {
        return { ok: false, error: "roomId / userId が必要です", providerId: this.providerId, adapter: true };
      }

      this._cacheSession(options, role);
      this._emitConnecting({ surface, roomId, userId });

      const tokenRes = await this.fetchToken({
        roomId,
        userId,
        role: role === "host" ? "host" : "audience",
        manualToken: options.manualToken,
      });
      if (!tokenRes.ok) {
        this._emitError({ surface, roomId, message: tokenRes.error });
        return { ...tokenRes, providerId: this.providerId, adapter: true };
      }

      this._resetPublishDiag(options.publishTimeoutMs || DEFAULT_PUBLISH_TIMEOUT_MS);
      diagStep(this._publishDiag, "token:ok", {
        source: tokenRes.source,
        role: tokenRes.role || role,
        tokenLen: tokenRes.token ? String(tokenRes.token).length : 0,
      });

      if (BSIG && options.broadcastId) {
        this._emitBroadcastSignal(BSIG.BROADCAST_PROVIDER_STARTING, {
          surface,
          roomId,
          broadcastId: options.broadcastId,
        });
      }

      const publishStreamId =
        options.streamId ? String(options.streamId).trim() : `${roomId}_${userId}_main`;

      const pocRes = await this._startLiveWithDiagnostics(
        {
          roomId,
          userId,
          userName: options.userName || userId,
          token: tokenRes.token,
          videoContainer: options.videoContainer,
          streamId: publishStreamId,
        },
        this._publishDiag.timeoutMs,
      );

      if (!pocRes?.ok) {
        const diag = this.getPublishDiagnostics();
        this._emitError({
          surface,
          roomId,
          message: pocRes?.error || "startLive failed",
          blockedAt: diag.blockedAt,
          lastStep: diag.lastStep,
        });
        if (BSIG && options.broadcastId) {
          this._emitBroadcastSignal(BSIG.BROADCAST_PROVIDER_ERROR, {
            surface,
            broadcastId: options.broadcastId,
            message: pocRes?.error,
            blockedAt: diag.blockedAt,
          });
        }
        return {
          ...(pocRes || { ok: false }),
          providerId: this.providerId,
          adapter: true,
          diagnostics: diag,
          blockedAt: diag.blockedAt,
        };
      }

      this._state = this._poc.state || "live";
      this._emitConnected({ surface, roomId, userId });
      if (BSIG && options.broadcastId) {
        this._emitBroadcastSignal(BSIG.BROADCAST_PROVIDER_STARTED, {
          surface,
          roomId,
          broadcastId: options.broadcastId,
        });
      }

      return {
        ...(pocRes && typeof pocRes === "object" ? pocRes : { ok: true }),
        providerId: this.providerId,
        adapter: true,
        surface,
      };
    }

    /** @private */
    async _rtcSubscribe(options) {
      this._ensurePoc();
      const surface = String(options.surface || this._surface || "platform").trim().toLowerCase();
      const roomId = String(options.roomId || "").trim();
      const userId = String(options.userId || "").trim();
      if (!roomId || !userId) {
        return { ok: false, error: "roomId / userId が必要です", providerId: this.providerId, adapter: true };
      }

      this._cacheSession(options, "viewer");
      this._emitConnecting({ surface, roomId, userId });

      const tokenRes = await this.fetchToken({
        roomId,
        userId,
        role: "audience",
        manualToken: options.manualToken,
      });
      if (!tokenRes.ok) {
        this._emitError({ surface, roomId, message: tokenRes.error });
        return { ...tokenRes, providerId: this.providerId, adapter: true };
      }

      const pocRes = await this._poc.joinLive({
        roomId,
        userId,
        userName: options.userName || userId,
        token: tokenRes.token,
        videoContainer: options.videoContainer,
      });

      if (!pocRes?.ok) {
        this._emitError({ surface, roomId, message: pocRes?.error || "joinLive failed" });
        return { ...(pocRes || { ok: false }), providerId: this.providerId, adapter: true };
      }

      this._state = this._poc.state || "watching";
      this._emitConnected({ surface, roomId, userId });
      return {
        ...(pocRes && typeof pocRes === "object" ? pocRes : { ok: true }),
        providerId: this.providerId,
        adapter: true,
        surface,
      };
    }

    /** @param {import('../live-provider-types.js').LiveSessionOptions} options */
    async startLive(options = {}) {
      return this._rtcPublish(options, "host");
    }

    /** @param {import('../live-provider-types.js').LiveSessionOptions} options */
    async joinLive(options = {}) {
      return this._rtcSubscribe(options);
    }

    async leaveLive() {
      if (this._disposed || !this._poc) return { ok: true, state: this.state, providerId: this.providerId, adapter: true };
      const surface = this._surface;
      const roomId = this._sessionCache?.roomId;
      const pocRes = await this._poc.leaveLive();
      this._state = this._poc.state || "ready";
      this._role = null;
      if (roomId) this._emitDisconnected({ surface, roomId });
      return {
        ...(pocRes && typeof pocRes === "object" ? pocRes : { ok: true }),
        providerId: this.providerId,
        adapter: true,
      };
    }

    async endLive() {
      if (this._disposed || !this._poc) return { ok: true, state: this.state, providerId: this.providerId, adapter: true };
      const surface = this._surface;
      const roomId = this._sessionCache?.roomId;
      const broadcastId = this._sessionCache?.broadcastId;

      if (BSIG && broadcastId) {
        this._emitBroadcastSignal(BSIG.BROADCAST_PROVIDER_STOPPING, { surface, roomId, broadcastId });
      }

      const pocRes = await this._poc.endLive();
      this._state = this._poc.state || "ready";
      this._role = null;

      if (BSIG && broadcastId) {
        this._emitBroadcastSignal(BSIG.BROADCAST_PROVIDER_STOPPED, { surface, roomId, broadcastId });
      }
      if (roomId) this._emitDisconnected({ surface, roomId, reason: "host_end" });

      return {
        ...(pocRes && typeof pocRes === "object" ? pocRes : { ok: true }),
        providerId: this.providerId,
        adapter: true,
      };
    }

    async reconnectLive() {
      if (!this._sessionCache) {
        return { ok: false, error: "reconnect 用 session cache がありません", providerId: this.providerId, adapter: true };
      }
      const cache = { ...this._sessionCache };
      const role = this._role || "viewer";
      const surface = cache.surface || this._surface;

      this._emitReconnecting({ surface, roomId: cache.roomId });

      if (role === "host") {
        await this._poc.endLive();
        const res = await this._rtcPublish({ ...cache, surface }, "host");
        if (res.ok) this._emitReconnected({ surface, roomId: cache.roomId });
        return res;
      }

      await this._poc.leaveLive();
      const res = await this._rtcSubscribe({ ...cache, surface });
      if (res.ok) this._emitReconnected({ surface, roomId: cache.roomId });
      return res;
    }

    /** @param {{ broadcastId: string, roomId: string, surface: string, userId?: string, videoContainer?: HTMLElement, manualToken?: string }} options */
    async startBroadcast(options = {}) {
      return this._rtcPublish(
        {
          ...options,
          roomId: options.roomId,
          userId: options.userId || this._sessionCache?.userId,
          videoContainer: options.videoContainer || this._sessionCache?.videoContainer,
        },
        "host",
      );
    }

    /** @param {{ broadcastId: string, roomId: string, surface: string, reason?: string }} options */
    async stopBroadcast(options = {}) {
      return this.endLive();
    }

    /** @param {{ broadcastId: string, roomId: string, surface: string }} options */
    async getBroadcastHealth(options = {}) {
      if (this._disposed) {
        return { ok: false, error: "Adapter disposed", adapter: true };
      }
      const ok = this.state === "live" || this.state === "ready" || this.state === "watching";
      if (BSIG && ok) {
        this._emitBroadcastSignal(BSIG.BROADCAST_PROVIDER_HEALTH_OK, {
          surface: options.surface,
          broadcastId: options.broadcastId,
          roomId: options.roomId,
        });
      }
      return {
        ok,
        providerId: this.providerId,
        adapter: true,
        state: this.state,
        error: ok ? undefined : "provider not live",
      };
    }

    /** @param {{ broadcastId: string, roomId: string, surface: string, count: number }} options */
    async updateViewerCount(options = {}) {
      if (BSIG) {
        this._emitBroadcastSignal(BSIG.BROADCAST_PROVIDER_VIEWER_COUNT, {
          surface: options.surface,
          broadcastId: options.broadcastId,
          roomId: options.roomId,
          count: Math.max(0, Math.floor(Number(options.count) || 0)),
        });
      }
      return {
        ok: true,
        viewerCount: Math.max(0, Math.floor(Number(options.count) || 0)),
        providerId: this.providerId,
        adapter: true,
      };
    }

    /** @param {{ surface: string, broadcastId: string, userId: string, roomId?: string, videoContainer?: HTMLElement, manualToken?: string }} options */
    async joinViewer(options = {}) {
      return this._rtcSubscribe({
        surface: options.surface,
        roomId: options.roomId || this._sessionCache?.roomId,
        userId: options.userId,
        userName: options.userName,
        videoContainer: options.videoContainer,
        manualToken: options.manualToken,
        broadcastId: options.broadcastId,
      });
    }

    /** @param {{ surface: string, broadcastId: string, userId: string }} options */
    async leaveViewer(options = {}) {
      return this.leaveLive();
    }

    /** @param {{ surface: string, broadcastId: string, userId: string }} options */
    async reconnectViewer(_options = {}) {
      return this.reconnectLive();
    }

    /** @param {{ surface: string, broadcastId: string, userId: string }} _options */
    async viewerHeartbeat(_options = {}) {
      return { ok: true, providerId: this.providerId, adapter: true, future: true };
    }

    /** @param {{ surface: string, broadcastId: string, userId: string, messageId: string, text: string }} options */
    async sendChatMessage(options = {}) {
      return { ok: true, providerId: this.providerId, adapter: true, future: true, messageId: options.messageId };
    }

    async addChatReaction(_options = {}) {
      return { ok: true, providerId: this.providerId, adapter: true, future: true };
    }

    async removeChatReaction(_options = {}) {
      return { ok: true, providerId: this.providerId, adapter: true, future: true };
    }

    async emitChatSystemEvent(_options = {}) {
      return { ok: true, providerId: this.providerId, adapter: true, future: true };
    }

    /** @param {{ surface: string, broadcastId: string, recordingId: string, roomId?: string }} options */
    async startRecording(options = {}) {
      return {
        ok: true,
        providerId: this.providerId,
        adapter: true,
        future: true,
        recordingId: options.recordingId,
        storageKey: `adapter-future://${options.surface}/${options.broadcastId}/${options.recordingId}`,
      };
    }

    async stopRecording(options = {}) {
      return {
        ok: true,
        providerId: this.providerId,
        adapter: true,
        future: true,
        playbackUrl: `adapter-future://${options.surface}/${options.broadcastId}/${options.recordingId}.mp4`,
        durationSec: 0,
      };
    }

    getRecordingStatus(_options = {}) {
      return { ok: true, providerId: this.providerId, adapter: true, future: true, state: "idle" };
    }

    async getArchiveMetadata(options = {}) {
      return {
        ok: true,
        providerId: this.providerId,
        adapter: true,
        future: true,
        archive: {
          archiveId: `arc-${options.recordingId}`,
          storageKey: options.storageKey || `adapter-future://${options.surface}/${options.recordingId}`,
          provider: "zego-adapter-future",
        },
      };
    }

    /** @param {{ surface: string }} options */
    async getMonitoringProbe(options = {}) {
      const healthy = this.state === "live" || this.state === "ready" || this.state === "watching";
      return {
        ok: healthy,
        status: healthy ? "healthy" : "degraded",
        providerId: this.providerId,
        adapter: true,
        future: true,
        state: this.state,
        surface: options.surface,
      };
    }

    async dispose() {
      if (this._disposed) return { ok: true, state: "disposed", providerId: this.providerId, adapter: true };
      const surface = this._surface;
      const roomId = this._sessionCache?.roomId;
      let pocRes = { ok: true };
      if (this._poc) {
        pocRes = await this._poc.dispose();
      }
      this._disposed = true;
      this._state = "disposed";
      this._sessionCache = null;
      this._role = null;
      if (roomId) this._emitDisconnected({ surface, roomId, reason: "dispose" });
      return {
        ...(pocRes && typeof pocRes === "object" ? pocRes : { ok: true }),
        state: "disposed",
        providerId: this.providerId,
        adapter: true,
      };
    }
  }

  global.ZegoLiveProviderAdapter = ZegoLiveProviderAdapter;
})(typeof window !== "undefined" ? window : globalThis);
