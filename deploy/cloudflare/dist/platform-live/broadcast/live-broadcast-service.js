/**
 * Live Platform Broadcast Service — 状態管理（SDK 非依存）
 * Phase B · platform-live/broadcast · surface 必須 · TLV 非接続
 */
(function (global) {
  "use strict";

  const STATES = global.PLATFORM_LIVE_BROADCAST_STATES || global.TasuLivePlatformBroadcastStates;
  const EVENTS = global.PLATFORM_LIVE_BROADCAST_EVENTS || global.TasuLivePlatformBroadcastEvents;
  const SIG = global.PLATFORM_LIVE_BROADCAST_PROVIDER_SIGNALS || global.TasuLivePlatformBroadcastProviderSignals;
  const EventBus = global.TasuLivePlatformSessionEventBus;
  const V = () => global.TasuLivePlatformBroadcastValidation;
  const EC = () => global.PLATFORM_LIVE_BROADCAST_ERROR_CODES || global.TasuLivePlatformBroadcastErrorCodes;

  if (!STATES || !EVENTS || !EventBus) {
    throw new Error(
      "TasuLivePlatformBroadcastService: load broadcast states/events and core event-bus first"
    );
  }

  /** @readonly allowed transitions */
  const TRANSITIONS = Object.freeze({
    [STATES.DRAFT]: [STATES.STARTING],
    [STATES.STARTING]: [STATES.LIVE, STATES.FAILED],
    [STATES.LIVE]: [STATES.STOPPING, STATES.FAILED],
    [STATES.STOPPING]: [STATES.ENDED, STATES.FAILED],
    [STATES.ENDED]: [STATES.DRAFT],
    [STATES.FAILED]: [STATES.DRAFT],
  });

  class TasuLivePlatformBroadcastService {
    /**
     * @param {{ sessionManager?: object, provider?: object }} [options]
     */
    constructor(options = {}) {
      /** @private */
      this._bus = new EventBus();
      /** @private */
      this._state = null;
      /** @private @type {object|null} */
      this._broadcast = null;
      /** @private */
      this._surface = null;
      /** @private */
      this._disposed = false;
      /** @private */
      this._sessionManager = options.sessionManager || null;
      /** @private */
      this._provider = options.provider || null;
      /** @private @type {{ code: string, message: string, at: string }|null} */
      this._lastError = null;
      /** @private */
      this._viewerCount = 0;
      /** @private @type {{ ok: boolean, checkedAt: string, providerOk: boolean, issues: string[] }|null} */
      this._lastHealth = null;
    }

    /** @param {object} provider */
    setProvider(provider) {
      this._provider = provider || null;
      if (this._provider?.onBroadcastSignal) {
        this._provider.onBroadcastSignal((signal, payload) => {
          this.handleProviderSignal(signal, payload);
        });
      }
      return this;
    }

    /** @param {object} sessionManager */
    setSessionManager(sessionManager) {
      this._sessionManager = sessionManager || null;
      return this;
    }

    /** @returns {string|null} */
    get state() {
      return this._state;
    }

    /** @returns {object|null} */
    get broadcast() {
      if (!this._broadcast) return null;
      return { ...this._broadcast, viewerCount: this._viewerCount };
    }

    /**
     * @param {string} event
     * @param {Function} handler
     */
    on(event, handler) {
      if (typeof handler !== "function") return this;
      const val = V()?.validateEventName(event);
      if (val && !val.ok) return this;
      this._bus.on(val?.value || String(event || "").trim(), handler);
      return this;
    }

    /** @private @param {Record<string, unknown>} options */
    _requireSurface(options) {
      const sv = V()?.validateSurface(options?.surface);
      if (!sv?.ok) return this._validationFail(sv);
      if (this._surface && this._surface !== sv.value) {
        return this._validationFail({
          ok: false,
          code: EC()?.SURFACE_ERROR || "SURFACE_ERROR",
          message: `surface 不一致（broadcast: ${this._surface}, request: ${sv.value}）`,
          field: "surface",
        });
      }
      return { ok: true, surface: sv.value };
    }

    /** @private */
    _canTransition(from, to) {
      if (!from) return to === STATES.DRAFT;
      const allowed = TRANSITIONS[from];
      return Array.isArray(allowed) && allowed.includes(to);
    }

    /** @private */
    _transition(next) {
      const from = this._state;
      if (from === next) return;
      if (from && !this._canTransition(from, next)) {
        throw new Error(`invalid broadcast transition: ${from} → ${next}`);
      }
      this._state = next;
      if (this._broadcast) this._broadcast.state = next;
      this._bus.emit(EVENTS.STATE_CHANGED, {
        from,
        to: next,
        broadcastId: this._broadcast?.id,
        surface: this._broadcast?.surface || this._surface,
      });
    }

    /** @private */
    _safeTransition(next) {
      const from = this._state;
      if (!this._canTransition(from, next)) {
        return this._stateFail(`状態遷移不可: ${from || "null"} → ${next}`);
      }
      this._transition(next);
      return { ok: true, state: this._state };
    }

    /**
     * @param {{ surface: string, title?: string, roomId?: string, hostUserId?: string, broadcastId?: string }} options
     */
    async createBroadcast(options = {}) {
      if (this._disposed) return this._stateFail("dispose 済みです");
      if (this._broadcast && this._state !== STATES.ENDED && this._state !== STATES.FAILED) {
        return this._stateFail("broadcast が既に存在します");
      }

      const surfaceCheck = this._requireSurface(options);
      if (!surfaceCheck.ok) return surfaceCheck;

      let id = `bc-${Date.now()}`;
      let title = "";
      let roomId = `room-${Date.now()}`;

      if (V()) {
        if (options.broadcastId != null && String(options.broadcastId).trim()) {
          const br = V().validateBroadcastId(options.broadcastId);
          if (!br.ok) return this._validationFail(br);
          id = br.value;
        }
        const tr = V().validateTitle(options.title);
        if (!tr.ok) return this._validationFail(tr);
        title = tr.value;
        if (options.roomId != null && String(options.roomId).trim()) {
          const rr = global.TasuLivePlatformSessionValidation?.validateRoomId(options.roomId, { required: true });
          if (rr && !rr.ok) return this._validationFail(rr);
          roomId = rr?.value || String(options.roomId).trim();
        }
      } else {
        id = String(options.broadcastId || id).trim();
        title = String(options.title || "").trim();
        roomId = String(options.roomId || roomId).trim();
      }

      this._surface = surfaceCheck.surface;
      this._viewerCount = 0;
      const now = new Date().toISOString();

      this._broadcast = {
        id,
        title,
        roomId,
        surface: surfaceCheck.surface,
        hostUserId: options.hostUserId ? String(options.hostUserId).trim() || null : null,
        state: STATES.DRAFT,
        createdAt: now,
        startedAt: null,
        endedAt: null,
      };
      this._state = STATES.DRAFT;
      this._lastError = null;
      this._lastHealth = null;

      this._bus.emit(EVENTS.BROADCAST_CREATED, {
        broadcastId: id,
        surface: surfaceCheck.surface,
        roomId,
        title,
        createdAt: now,
      });

      return { ok: true, state: this._state, broadcast: this.broadcast };
    }

    /**
     * @param {{ surface: string, broadcastId?: string, userId?: string }} options
     */
    async startBroadcast(options = {}) {
      const surfaceCheck = this._requireSurface(options);
      if (!surfaceCheck.ok) return surfaceCheck;
      if (this._disposed) return this._stateFail("dispose 済みです");
      if (!this._broadcast) return this._stateFail("broadcast がありません");
      if (this._state !== STATES.DRAFT) {
        return this._stateFail(`startBroadcast は ${STATES.DRAFT} のみ可能です（現在: ${this._state}）`);
      }

      const tr = this._safeTransition(STATES.STARTING);
      if (!tr.ok) return tr;

      this._bus.emit(EVENTS.BROADCAST_STARTING, {
        broadcastId: this._broadcast.id,
        surface: this._broadcast.surface,
        roomId: this._broadcast.roomId,
      });

      if (this._provider?.startBroadcast) {
        const pr = await this._provider.startBroadcast({
          broadcastId: this._broadcast.id,
          roomId: this._broadcast.roomId,
          surface: this._broadcast.surface,
          userId: options.userId || this._broadcast.hostUserId,
          userName: options.userName,
          videoContainer: options.videoContainer,
          manualToken: options.manualToken,
          streamId: options.streamId,
          publishTimeoutMs: options.publishTimeoutMs,
        });
        if (pr?.ok === false) {
          this._transition(STATES.FAILED);
          this._bus.emit(EVENTS.BROADCAST_FAILED, {
            broadcastId: this._broadcast.id,
            surface: this._broadcast.surface,
            error: pr.error || "provider start failed",
          });
          return { ok: false, state: this._state, error: pr.error, code: EC()?.PROVIDER_ERROR || "PROVIDER_ERROR" };
        }
      }

      if (this._sessionManager?.createSession) {
        const SESSION_STATES = global.PLATFORM_LIVE_SESSION_STATES;
        if (this._sessionManager.state === SESSION_STATES?.IDLE) {
          await this._sessionManager.createSession({
            surface: this._broadcast.surface,
            roomId: this._broadcast.roomId,
            role: "host",
            sessionId: `sess-${this._broadcast.id}`,
          });
        }
        if (this._sessionManager.start) {
          const sr = await this._sessionManager.start({ surface: this._broadcast.surface });
          if (!sr.ok) {
            this._transition(STATES.FAILED);
            this._bus.emit(EVENTS.BROADCAST_FAILED, {
              broadcastId: this._broadcast.id,
              surface: this._broadcast.surface,
              error: sr.error,
            });
            return { ok: false, state: this._state, error: sr.error, code: sr.code };
          }
        }
      }

      this._transition(STATES.LIVE);
      const startedAt = new Date().toISOString();
      this._broadcast.startedAt = startedAt;

      this._bus.emit(EVENTS.BROADCAST_STARTED, {
        broadcastId: this._broadcast.id,
        surface: this._broadcast.surface,
        roomId: this._broadcast.roomId,
        startedAt,
      });

      return { ok: true, state: this._state, broadcast: this.broadcast };
    }

    /**
     * @param {{ surface: string, reason?: string }} options
     */
    async stopBroadcast(options = {}) {
      const surfaceCheck = this._requireSurface(options);
      if (!surfaceCheck.ok) return surfaceCheck;
      if (this._disposed) return this._stateFail("dispose 済みです");
      if (!this._broadcast) return this._stateFail("broadcast がありません");
      if (this._state !== STATES.LIVE) {
        return this._stateFail(`stopBroadcast は ${STATES.LIVE} のみ可能です（現在: ${this._state}）`);
      }

      const tr = this._safeTransition(STATES.STOPPING);
      if (!tr.ok) return tr;

      this._bus.emit(EVENTS.BROADCAST_STOPPING, {
        broadcastId: this._broadcast.id,
        surface: this._broadcast.surface,
        reason: options.reason || "user",
      });

      if (this._provider?.stopBroadcast) {
        const pr = await this._provider.stopBroadcast({
          broadcastId: this._broadcast.id,
          roomId: this._broadcast.roomId,
          surface: this._broadcast.surface,
          reason: options.reason,
        });
        if (pr?.ok === false) {
          this._transition(STATES.FAILED);
          this._bus.emit(EVENTS.BROADCAST_FAILED, {
            broadcastId: this._broadcast.id,
            surface: this._broadcast.surface,
            error: pr.error || "provider stop failed",
          });
          return { ok: false, state: this._state, error: pr.error, code: EC()?.PROVIDER_ERROR || "PROVIDER_ERROR" };
        }
      }

      if (this._sessionManager?.end) {
        await this._sessionManager.end({ surface: this._broadcast.surface });
      }

      this._transition(STATES.ENDED);
      const endedAt = new Date().toISOString();
      this._broadcast.endedAt = endedAt;

      this._bus.emit(EVENTS.BROADCAST_STOPPED, {
        broadcastId: this._broadcast.id,
        surface: this._broadcast.surface,
        endedAt,
        reason: options.reason || "user",
      });

      return { ok: true, state: this._state, broadcast: this.broadcast };
    }

    /**
     * @param {{ surface: string }} options
     */
    getBroadcastState(options = {}) {
      const surfaceCheck = this._requireSurface(options);
      if (!surfaceCheck.ok) return surfaceCheck;
      return {
        ok: true,
        state: this._state,
        broadcast: this.broadcast,
      };
    }

    /**
     * @param {{ surface: string }} options
     */
    async getBroadcastHealth(options = {}) {
      const surfaceCheck = this._requireSurface(options);
      if (!surfaceCheck.ok) return surfaceCheck;
      if (!this._broadcast) {
        return this._stateFail("broadcast がありません");
      }

      const issues = [];
      let providerOk = true;
      let providerHealth = null;

      if (this._provider?.getBroadcastHealth) {
        providerHealth = await this._provider.getBroadcastHealth({
          broadcastId: this._broadcast.id,
          roomId: this._broadcast.roomId,
          surface: this._broadcast.surface,
        });
        providerOk = providerHealth?.ok !== false;
        if (!providerOk) issues.push(providerHealth?.error || "provider health degraded");
      }

      const sessionState = this._sessionManager?.state || null;
      if (this._state === STATES.LIVE && sessionState) {
        const SESSION_STATES = global.PLATFORM_LIVE_SESSION_STATES;
        if (SESSION_STATES && sessionState !== SESSION_STATES.LIVE && sessionState !== SESSION_STATES.RECONNECTED) {
          issues.push(`session state mismatch: ${sessionState}`);
        }
      }

      if (this._state === STATES.FAILED) {
        issues.push(this._lastError?.message || "broadcast failed");
      }

      const checkedAt = new Date().toISOString();
      const health = {
        ok: issues.length === 0 && this._state !== STATES.FAILED,
        broadcastState: this._state,
        providerOk,
        providerId: this._provider?.providerId || null,
        viewerCount: this._viewerCount,
        sessionState,
        checkedAt,
        issues,
        stub: providerHealth?.stub === true || this._provider?.providerId === "stub",
      };

      this._lastHealth = health;
      this._bus.emit(EVENTS.BROADCAST_HEALTH, {
        broadcastId: this._broadcast.id,
        surface: this._broadcast.surface,
        ...health,
      });

      return { ok: true, health };
    }

    /**
     * @param {{ surface: string, count: number }} options
     */
    async updateViewerCount(options = {}) {
      const surfaceCheck = this._requireSurface(options);
      if (!surfaceCheck.ok) return surfaceCheck;
      if (this._disposed) return this._stateFail("dispose 済みです");
      if (!this._broadcast) return this._stateFail("broadcast がありません");
      if (this._state !== STATES.LIVE) {
        return this._stateFail(`updateViewerCount は ${STATES.LIVE} のみ可能です（現在: ${this._state}）`);
      }

      let count = 0;
      if (V()) {
        const cv = V().validateViewerCount(options.count);
        if (!cv.ok) return this._validationFail(cv);
        count = cv.value;
      } else {
        count = Math.max(0, Math.floor(Number(options.count) || 0));
      }

      this._viewerCount = count;
      this._broadcast.viewerCount = count;

      if (this._provider?.updateViewerCount) {
        await this._provider.updateViewerCount({
          broadcastId: this._broadcast.id,
          roomId: this._broadcast.roomId,
          surface: this._broadcast.surface,
          count,
        });
      }

      this._bus.emit(EVENTS.VIEWER_COUNT_UPDATED, {
        broadcastId: this._broadcast.id,
        surface: this._broadcast.surface,
        viewerCount: count,
        updatedAt: new Date().toISOString(),
      });

      return { ok: true, state: this._state, viewerCount: count, source: options.source || "direct" };
    }

    /**
     * Viewer CCU Registry から同期（Phase C · 正本は viewer core）
     * @param {{ surface: string, count: number, source?: string }} options
     */
    async syncCcuFromViewerRegistry(options = {}) {
      return this.updateViewerCount({
        surface: options.surface,
        count: options.count,
      });
    }

    /**
     * @param {string} signal
     * @param {object} [payload]
     */
    async handleProviderSignal(signal, payload = {}) {
      if (!this._broadcast) return this._stateFail("broadcast がありません");

      let sig = String(signal || "").trim();
      if (V()) {
        const sv = V().validateProviderSignal(sig, SIG);
        if (!sv.ok) return this._validationFail(sv);
        sig = sv.value;
      }

      const { id, surface } = this._broadcast;

      switch (sig) {
        case SIG.BROADCAST_PROVIDER_STARTED:
          if (this._state === STATES.STARTING) this._transition(STATES.LIVE);
          return { ok: true, state: this._state, signal: sig };

        case SIG.BROADCAST_PROVIDER_STOPPED:
          if (this._state === STATES.STOPPING) this._transition(STATES.ENDED);
          return { ok: true, state: this._state, signal: sig };

        case SIG.BROADCAST_PROVIDER_HEALTH_DEGRADED:
          this._lastHealth = {
            ok: false,
            checkedAt: new Date().toISOString(),
            providerOk: false,
            issues: [payload.message || "health degraded"],
          };
          return { ok: true, state: this._state, signal: sig };

        case SIG.BROADCAST_PROVIDER_VIEWER_COUNT: {
          const count = Math.max(0, Math.floor(Number(payload.count) || 0));
          this._viewerCount = count;
          this._bus.emit(EVENTS.VIEWER_COUNT_UPDATED, {
            broadcastId: id,
            surface,
            viewerCount: count,
            source: "provider",
          });
          return { ok: true, state: this._state, viewerCount: count };
        }

        case SIG.BROADCAST_PROVIDER_ERROR:
          this._lastError = {
            code: EC()?.PROVIDER_ERROR || "PROVIDER_ERROR",
            message: String(payload.message || "provider error"),
            at: new Date().toISOString(),
          };
          if ([STATES.STARTING, STATES.LIVE, STATES.STOPPING].includes(this._state)) {
            this._transition(STATES.FAILED);
            this._bus.emit(EVENTS.BROADCAST_FAILED, {
              broadcastId: id,
              surface,
              error: this._lastError.message,
            });
          }
          return { ok: false, state: this._state, error: this._lastError.message, code: this._lastError.code };

        default:
          return { ok: true, state: this._state, signal: sig };
      }
    }

    /**
     * ENDED | FAILED → DRAFT（broadcast メタ保持）
     * @param {{ surface: string }} options
     */
    async resetBroadcast(options = {}) {
      const surfaceCheck = this._requireSurface(options);
      if (!surfaceCheck.ok) return surfaceCheck;
      if (![STATES.ENDED, STATES.FAILED].includes(this._state)) {
        return this._stateFail(`resetBroadcast は ${STATES.ENDED}|${STATES.FAILED} のみ可能です`);
      }
      this._state = STATES.DRAFT;
      if (this._broadcast) {
        this._broadcast.state = STATES.DRAFT;
        this._broadcast.startedAt = null;
        this._broadcast.endedAt = null;
      }
      this._viewerCount = 0;
      this._lastError = null;
      return { ok: true, state: this._state, broadcast: this.broadcast };
    }

    async dispose() {
      this._disposed = true;
      this._broadcast = null;
      this._state = null;
      this._surface = null;
      this._viewerCount = 0;
      this._lastError = null;
      this._lastHealth = null;
      this._bus.clear();
      return { ok: true };
    }

    /** @private */
    _stateFail(message) {
      const code = EC()?.BROADCAST_STATE_ERROR || "BROADCAST_STATE_ERROR";
      return { ok: false, state: this._state, error: String(message || "unknown"), code };
    }

    /** @private */
    _validationFail(vr) {
      const code = vr.code || EC()?.VALIDATION_ERROR || "VALIDATION_ERROR";
      const message = String(vr.message || "validation failed");
      this._lastError = { code, message, at: new Date().toISOString() };
      this._bus.emit(EVENTS.ERROR, {
        broadcastId: this._broadcast?.id,
        surface: this._broadcast?.surface || this._surface,
        code,
        message,
        field: vr.field,
      });
      return { ok: false, state: this._state, error: message, code };
    }
  }

  global.TasuLivePlatformBroadcastService = TasuLivePlatformBroadcastService;
  global.PLATFORM_LIVE_BROADCAST_TRANSITIONS = TRANSITIONS;
})(typeof window !== "undefined" ? window : globalThis);
