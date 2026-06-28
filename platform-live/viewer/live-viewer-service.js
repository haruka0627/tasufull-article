/**
 * Live Platform Viewer Service — join/leave/reconnect/heartbeat/CCU 正本
 * Phase C · platform-live/viewer · surface 必須 · TLV 非接続
 */
(function (global) {
  "use strict";

  const VS = global.PLATFORM_LIVE_VIEWER_STATES || global.TasuLivePlatformViewerStates;
  const VE = global.PLATFORM_LIVE_VIEWER_EVENTS || global.TasuLivePlatformViewerEvents;
  const BS = global.PLATFORM_LIVE_BROADCAST_STATES || global.TasuLivePlatformBroadcastStates;
  const EventBus = global.TasuLivePlatformSessionEventBus;
  const V = () => global.TasuLivePlatformViewerValidation;
  const EC = () => global.PLATFORM_LIVE_VIEWER_ERROR_CODES || global.TasuLivePlatformViewerErrorCodes;
  const checkPerm = () => global.TasuLivePlatformViewerPermission?.checkViewerPermission;
  const CcuRegistry = global.TasuLivePlatformViewerCcuRegistry;

  if (!VS || !VE || !EventBus) {
    throw new Error("TasuLivePlatformViewerService: load viewer states/events and core event-bus first");
  }

  /** @readonly */
  const TRANSITIONS = Object.freeze({
    [VS.IDLE]: [VS.JOINING],
    [VS.JOINING]: [VS.WATCHING, VS.FAILED],
    [VS.WATCHING]: [VS.LEFT, VS.KICKED, VS.EXPIRED, VS.RECONNECTING],
    [VS.RECONNECTING]: [VS.WATCHING, VS.EXPIRED, VS.FAILED, VS.LEFT],
    [VS.LEFT]: [VS.IDLE],
    [VS.KICKED]: [VS.IDLE],
    [VS.EXPIRED]: [VS.IDLE],
    [VS.FAILED]: [VS.IDLE],
  });

  class TasuLivePlatformViewerService {
    /**
     * @param {{
     *   broadcastService?: object,
     *   sessionManager?: object,
     *   provider?: object,
     *   ccuRegistry?: object,
     *   heartbeatTtlMs?: number,
     *   bannedUserIds?: string[],
     *   kickedUserIds?: string[],
     * }} [options]
     */
    constructor(options = {}) {
      /** @private */
      this._bus = new EventBus();
      /** @private @type {Map<string, object>} */
      this._viewers = new Map();
      /** @private */
      this._surface = null;
      /** @private */
      this._broadcastService = options.broadcastService || null;
      /** @private */
      this._sessionManager = options.sessionManager || null;
      /** @private */
      this._provider = options.provider || null;
      /** @private */
      this._ccuRegistry =
        options.ccuRegistry || (CcuRegistry ? new CcuRegistry({ heartbeatTtlMs: options.heartbeatTtlMs }) : null);
      /** @private */
      this._heartbeatTtlMs = Number(options.heartbeatTtlMs) > 0 ? Number(options.heartbeatTtlMs) : 30_000;
      /** @private @type {Set<string>} */
      this._banned = new Set((options.bannedUserIds || []).map((x) => String(x).trim()).filter(Boolean));
      /** @private @type {Set<string>} */
      this._kicked = new Set((options.kickedUserIds || []).map((x) => String(x).trim()).filter(Boolean));
      /** @private */
      this._disposed = false;
    }

    /** @param {object} broadcastService */
    setBroadcastService(broadcastService) {
      this._broadcastService = broadcastService || null;
      return this;
    }

    /** @param {object} sessionManager */
    setSessionManager(sessionManager) {
      this._sessionManager = sessionManager || null;
      return this;
    }

    /** @param {object} provider */
    setProvider(provider) {
      this._provider = provider || null;
      return this;
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
          message: `surface 不一致（service: ${this._surface}, request: ${sv.value}）`,
          field: "surface",
        });
      }
      this._surface = this._surface || sv.value;
      return { ok: true, surface: sv.value };
    }

    /** @private */
    _viewerKey(userId) {
      return String(userId).trim();
    }

    /** @private */
    _getViewer(userId) {
      return this._viewers.get(this._viewerKey(userId)) || null;
    }

    /** @private */
    _canTransition(from, to) {
      if (!from) return to === VS.IDLE;
      const allowed = TRANSITIONS[from];
      return Array.isArray(allowed) && allowed.includes(to);
    }

    /** @private */
    _setViewerState(viewer, next) {
      const from = viewer.state;
      if (!this._canTransition(from, next)) {
        return this._stateFail(`状態遷移不可: ${from} → ${next}`);
      }
      viewer.state = next;
      viewer.updatedAt = new Date().toISOString();
      this._bus.emit(VE.STATE_CHANGED, {
        from,
        to: next,
        userId: viewer.userId,
        broadcastId: viewer.broadcastId,
        surface: viewer.surface,
      });
      return { ok: true, state: next };
    }

    /** @private */
    _broadcastState() {
      return this._broadcastService?.state || null;
    }

    /** @private */
    _broadcastId() {
      return this._broadcastService?.broadcast?.id || null;
    }

    /** @private */
    _permission(ctx) {
      const fn = checkPerm();
      if (!fn) return { ok: true, allowed: true };
      return fn({
        ...ctx,
        bannedUserIds: this._banned,
        kickedUserIds: this._kicked,
      });
    }

    /** @private */
    async _syncCcuToBroadcast(surface, broadcastId) {
      if (!this._ccuRegistry || !this._broadcastService) return { ok: true };
      const count = this._ccuRegistry.getCcu(surface, broadcastId);
      const bcId = this._broadcastId();
      if (bcId && bcId === broadcastId && this._broadcastService.state === BS.LIVE) {
        await this._broadcastService.updateViewerCount({ surface, count });
      }
      this._bus.emit(VE.CCU_UPDATED, { surface, broadcastId, ccu: count, source: "viewer-registry" });
      return { ok: true, ccu: count };
    }

    /**
     * @param {{ surface: string, userId: string, broadcastId?: string, action?: 'join'|'reconnect' }} options
     */
    checkPermission(options = {}) {
      const surfaceCheck = this._requireSurface(options);
      if (!surfaceCheck.ok) return surfaceCheck;

      const uv = V()?.validateUserId(options.userId);
      if (uv && !uv.ok) return this._validationFail(uv);

      const userId = uv?.value || String(options.userId).trim();
      const broadcastId = options.broadcastId || this._broadcastId() || "";
      const viewer = this._getViewer(userId);
      const action = String(options.action || "join").trim().toLowerCase();

      const perm = this._permission({
        surface: surfaceCheck.surface,
        broadcastId,
        userId,
        action,
        broadcastState: this._broadcastState(),
        viewerState: viewer?.state || VS.IDLE,
      });

      if (!perm.ok) {
        this._bus.emit(VE.PERMISSION_DENIED, {
          surface: surfaceCheck.surface,
          userId,
          broadcastId,
          code: perm.code,
          message: perm.message,
        });
        return { ok: false, allowed: false, code: perm.code, error: perm.message };
      }

      return { ok: true, allowed: true };
    }

    /**
     * @param {{ surface: string, userId: string, broadcastId?: string }} options
     */
    async joinViewer(options = {}) {
      const surfaceCheck = this._requireSurface(options);
      if (!surfaceCheck.ok) return surfaceCheck;
      if (this._disposed) return this._stateFail("dispose 済みです");

      const uv = V()?.validateUserId(options.userId);
      if (uv && !uv.ok) return this._validationFail(uv);
      const userId = uv?.value || String(options.userId).trim();

      let broadcastId = options.broadcastId || this._broadcastId() || "";
      if (V()?.validateBroadcastId && broadcastId) {
        const br = V().validateBroadcastId(broadcastId);
        if (!br.ok) return this._validationFail(br);
        broadcastId = br.value;
      }

      const perm = this.checkPermission({
        surface: surfaceCheck.surface,
        userId,
        broadcastId,
        action: "join",
      });
      if (!perm.ok) return perm;

      let viewer = this._getViewer(userId);
      if (!viewer) {
        viewer = {
          userId,
          surface: surfaceCheck.surface,
          broadcastId,
          state: VS.IDLE,
          lastHeartbeatAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        this._viewers.set(this._viewerKey(userId), viewer);
      } else if (viewer.state !== VS.IDLE && viewer.state !== VS.LEFT && viewer.state !== VS.FAILED) {
        if (viewer.state === VS.WATCHING && viewer.broadcastId === broadcastId) {
          return { ok: true, state: viewer.state, viewer: { ...viewer }, alreadyJoined: true };
        }
        return this._stateFail(`join 不可（現在: ${viewer.state}）`);
      }

      viewer.broadcastId = broadcastId;
      viewer.surface = surfaceCheck.surface;

      const tr = this._setViewerState(viewer, VS.JOINING);
      if (!tr.ok) return tr;

      this._bus.emit(VE.VIEWER_JOINING, { userId, broadcastId, surface: surfaceCheck.surface });

      if (this._provider?.joinViewer) {
        const pr = await this._provider.joinViewer({
          surface: surfaceCheck.surface,
          broadcastId,
          userId,
          roomId: options.roomId || this._broadcastService?.broadcast?.roomId,
          userName: options.userName,
          videoContainer: options.videoContainer,
          manualToken: options.manualToken,
        });
        if (pr?.ok === false) {
          this._setViewerState(viewer, VS.FAILED);
          this._bus.emit(VE.VIEWER_FAILED, { userId, broadcastId, error: pr.error });
          return { ok: false, state: viewer.state, error: pr.error, code: EC()?.PROVIDER_ERROR || "PROVIDER_ERROR" };
        }
      }

      if (this._sessionManager) {
        const SESSION_STATES = global.PLATFORM_LIVE_SESSION_STATES;
        const roomId = this._broadcastService?.broadcast?.roomId;
        if (roomId && this._sessionManager.state === SESSION_STATES?.IDLE) {
          await this._sessionManager.createSession({
            surface: surfaceCheck.surface,
            roomId,
            role: "viewer",
            userId,
          });
        }
        if (this._sessionManager.join) {
          const jr = await this._sessionManager.join({ surface: surfaceCheck.surface });
          if (!jr.ok) {
            this._setViewerState(viewer, VS.FAILED);
            this._bus.emit(VE.VIEWER_FAILED, { userId, broadcastId, error: jr.error });
            return { ok: false, state: viewer.state, error: jr.error, code: jr.code };
          }
        }
      }

      this._setViewerState(viewer, VS.WATCHING);
      const now = new Date().toISOString();
      viewer.lastHeartbeatAt = now;
      viewer.joinedAt = now;

      if (this._ccuRegistry) {
        this._ccuRegistry.register(surfaceCheck.surface, broadcastId, userId);
        await this._syncCcuToBroadcast(surfaceCheck.surface, broadcastId);
      }

      this._bus.emit(VE.VIEWER_JOINED, { userId, broadcastId, surface: surfaceCheck.surface, joinedAt: now });

      return { ok: true, state: viewer.state, viewer: { ...viewer }, ccu: this.getCcu({ surface: surfaceCheck.surface, broadcastId }) };
    }

    /**
     * @param {{ surface: string, userId: string }} options
     */
    async leaveViewer(options = {}) {
      const surfaceCheck = this._requireSurface(options);
      if (!surfaceCheck.ok) return surfaceCheck;
      if (this._disposed) return this._stateFail("dispose 済みです");

      const uv = V()?.validateUserId(options.userId);
      if (uv && !uv.ok) return this._validationFail(uv);
      const userId = uv?.value || String(options.userId).trim();
      const viewer = this._getViewer(userId);
      if (!viewer) return this._stateFail("viewer がありません");
      if (![VS.WATCHING, VS.RECONNECTING].includes(viewer.state)) {
        return this._stateFail(`leave 不可（現在: ${viewer.state}）`);
      }

      if (this._provider?.leaveViewer) {
        await this._provider.leaveViewer({
          surface: surfaceCheck.surface,
          broadcastId: viewer.broadcastId,
          userId,
        });
      }

      if (this._sessionManager?.leave) {
        await this._sessionManager.leave({ surface: surfaceCheck.surface });
      }

      const { broadcastId } = viewer;
      this._setViewerState(viewer, VS.LEFT);

      if (this._ccuRegistry) {
        this._ccuRegistry.unregister(surfaceCheck.surface, broadcastId, userId);
        await this._syncCcuToBroadcast(surfaceCheck.surface, broadcastId);
      }

      this._bus.emit(VE.VIEWER_LEFT, {
        userId,
        broadcastId,
        surface: surfaceCheck.surface,
        leftAt: new Date().toISOString(),
      });

      this._setViewerState(viewer, VS.IDLE);
      return { ok: true, state: viewer.state, viewer: { ...viewer } };
    }

    /**
     * @param {{ surface: string, userId: string }} options
     */
    async reconnectViewer(options = {}) {
      const surfaceCheck = this._requireSurface(options);
      if (!surfaceCheck.ok) return surfaceCheck;
      if (this._disposed) return this._stateFail("dispose 済みです");

      const uv = V()?.validateUserId(options.userId);
      if (uv && !uv.ok) return this._validationFail(uv);
      const userId = uv?.value || String(options.userId).trim();
      const viewer = this._getViewer(userId);
      if (!viewer) return this._stateFail("viewer がありません");

      const perm = this.checkPermission({
        surface: surfaceCheck.surface,
        userId,
        broadcastId: viewer.broadcastId,
        action: "reconnect",
        viewerState: viewer.state,
      });
      if (!perm.ok) return perm;

      if (viewer.state !== VS.WATCHING && viewer.state !== VS.RECONNECTING) {
        return this._stateFail(`reconnect 不可（現在: ${viewer.state}）`);
      }

      this._setViewerState(viewer, VS.RECONNECTING);
      this._bus.emit(VE.VIEWER_RECONNECTING, {
        userId,
        broadcastId: viewer.broadcastId,
        surface: surfaceCheck.surface,
      });

      if (this._provider?.reconnectViewer) {
        await this._provider.reconnectViewer({
          surface: surfaceCheck.surface,
          broadcastId: viewer.broadcastId,
          userId,
        });
      }

      if (this._sessionManager?.reconnect) {
        const rr = await this._sessionManager.reconnect({ surface: surfaceCheck.surface });
        if (!rr.ok) {
          this._setViewerState(viewer, VS.FAILED);
          return { ok: false, state: viewer.state, error: rr.error, code: rr.code };
        }
      }

      this._setViewerState(viewer, VS.WATCHING);
      viewer.lastHeartbeatAt = new Date().toISOString();

      if (this._ccuRegistry) {
        this._ccuRegistry.heartbeat(surfaceCheck.surface, viewer.broadcastId, userId);
        await this._syncCcuToBroadcast(surfaceCheck.surface, viewer.broadcastId);
      }

      this._bus.emit(VE.VIEWER_RECONNECTED, {
        userId,
        broadcastId: viewer.broadcastId,
        surface: surfaceCheck.surface,
      });

      return { ok: true, state: viewer.state, viewer: { ...viewer } };
    }

    /**
     * @param {{ surface: string, userId: string }} options
     */
    async heartbeat(options = {}) {
      const surfaceCheck = this._requireSurface(options);
      if (!surfaceCheck.ok) return surfaceCheck;
      if (this._disposed) return this._stateFail("dispose 済みです");

      const uv = V()?.validateUserId(options.userId);
      if (uv && !uv.ok) return this._validationFail(uv);
      const userId = uv?.value || String(options.userId).trim();
      const viewer = this._getViewer(userId);
      if (!viewer) return this._stateFail("viewer がありません");
      if (viewer.state !== VS.WATCHING) {
        return this._stateFail(`heartbeat 不可（現在: ${viewer.state}）`);
      }

      const now = new Date().toISOString();
      viewer.lastHeartbeatAt = now;
      viewer.updatedAt = now;

      if (this._provider?.viewerHeartbeat) {
        await this._provider.viewerHeartbeat({
          surface: surfaceCheck.surface,
          broadcastId: viewer.broadcastId,
          userId,
        });
      }

      if (this._ccuRegistry) {
        this._ccuRegistry.heartbeat(surfaceCheck.surface, viewer.broadcastId, userId);
        this._ccuRegistry.expireStale(surfaceCheck.surface, viewer.broadcastId);
        await this._syncCcuToBroadcast(surfaceCheck.surface, viewer.broadcastId);
      }

      this._bus.emit(VE.VIEWER_HEARTBEAT, {
        userId,
        broadcastId: viewer.broadcastId,
        surface: surfaceCheck.surface,
        at: now,
      });

      return {
        ok: true,
        state: viewer.state,
        lastHeartbeatAt: now,
        ccu: this.getCcu({ surface: surfaceCheck.surface, broadcastId: viewer.broadcastId }),
      };
    }

    /**
     * @param {{ surface: string, userId: string, reason?: string }} options
     */
    async kickViewer(options = {}) {
      const surfaceCheck = this._requireSurface(options);
      if (!surfaceCheck.ok) return surfaceCheck;

      const uv = V()?.validateUserId(options.userId);
      if (uv && !uv.ok) return this._validationFail(uv);
      const userId = uv?.value || String(options.userId).trim();
      this._kicked.add(userId);

      const viewer = this._getViewer(userId);
      if (viewer && [VS.WATCHING, VS.RECONNECTING, VS.JOINING].includes(viewer.state)) {
        const { broadcastId } = viewer;
        this._setViewerState(viewer, VS.KICKED);
        if (this._ccuRegistry) {
          this._ccuRegistry.unregister(surfaceCheck.surface, broadcastId, userId);
          await this._syncCcuToBroadcast(surfaceCheck.surface, broadcastId);
        }
        this._bus.emit(VE.VIEWER_KICKED, {
          userId,
          broadcastId,
          surface: surfaceCheck.surface,
          reason: options.reason || "moderation",
        });
      }

      return { ok: true, kicked: userId };
    }

    /**
     * TTL 超過 viewer を expired に（テスト / cron 用）
     * @param {{ surface: string, broadcastId: string, nowMs?: number }} options
     */
    async expireStaleViewers(options = {}) {
      const surfaceCheck = this._requireSurface(options);
      if (!surfaceCheck.ok) return surfaceCheck;
      const broadcastId = options.broadcastId || this._broadcastId() || "";
      if (!this._ccuRegistry) return { ok: true, expired: [] };

      const { expired } = this._ccuRegistry.expireStale(
        surfaceCheck.surface,
        broadcastId,
        options.nowMs || Date.now()
      );

      for (const userId of expired) {
        const viewer = this._getViewer(userId);
        if (viewer && viewer.state === VS.WATCHING) {
          this._setViewerState(viewer, VS.EXPIRED);
          this._bus.emit(VE.VIEWER_EXPIRED, { userId, broadcastId, surface: surfaceCheck.surface });
        }
      }

      await this._syncCcuToBroadcast(surfaceCheck.surface, broadcastId);
      return { ok: true, expired };
    }

    /**
     * @param {{ surface: string, userId: string }} options
     */
    getWatchState(options = {}) {
      const surfaceCheck = this._requireSurface(options);
      if (!surfaceCheck.ok) return surfaceCheck;

      const uv = V()?.validateUserId(options.userId);
      if (uv && !uv.ok) return this._validationFail(uv);
      const userId = uv?.value || String(options.userId).trim();
      const viewer = this._getViewer(userId);

      const broadcastId = viewer?.broadcastId || this._broadcastId() || "";
      const ccu = broadcastId ? this.getCcu({ surface: surfaceCheck.surface, broadcastId }) : 0;

      const viewerState = viewer?.state || VS.IDLE;
      const canReconnect =
        viewerState === VS.WATCHING ||
        (viewerState === VS.RECONNECTING && viewerState !== VS.EXPIRED && viewerState !== VS.KICKED);

      return {
        ok: true,
        watchState: {
          viewerState,
          broadcastId,
          broadcastState: this._broadcastState(),
          sessionState: this._sessionManager?.state || null,
          ccu,
          lastHeartbeatAt: viewer?.lastHeartbeatAt || null,
          canReconnect: viewerState !== VS.EXPIRED && viewerState !== VS.KICKED && viewerState !== VS.IDLE,
          surface: surfaceCheck.surface,
        },
      };
    }

    /**
     * @param {{ surface: string, broadcastId?: string }} options
     */
    getCcu(options = {}) {
      const surfaceCheck = this._requireSurface(options);
      if (!surfaceCheck.ok) return 0;
      const broadcastId = options.broadcastId || this._broadcastId() || "";
      if (!broadcastId || !this._ccuRegistry) return 0;
      return this._ccuRegistry.getCcu(surfaceCheck.surface, broadcastId);
    }

    /** @param {string} userId */
    banViewer(userId) {
      const uid = String(userId).trim();
      if (uid) this._banned.add(uid);
      return this;
    }

    async dispose() {
      this._disposed = true;
      this._viewers.clear();
      this._ccuRegistry?.clearAll?.();
      this._bus.clear();
      this._surface = null;
      return { ok: true };
    }

    /** @private */
    _stateFail(message) {
      const code = EC()?.VIEWER_STATE_ERROR || "VIEWER_STATE_ERROR";
      return { ok: false, error: String(message || "unknown"), code };
    }

    /** @private */
    _validationFail(vr) {
      const code = vr.code || EC()?.VALIDATION_ERROR || "VALIDATION_ERROR";
      const message = String(vr.message || "validation failed");
      this._bus.emit(VE.ERROR, { code, message, field: vr.field });
      return { ok: false, error: message, code };
    }
  }

  global.TasuLivePlatformViewerService = TasuLivePlatformViewerService;
  global.PLATFORM_LIVE_VIEWER_TRANSITIONS = TRANSITIONS;
})(typeof window !== "undefined" ? window : globalThis);
