/**
 * Live Platform Monitoring Service — health / metrics / smoke 横断監視
 * Phase F · platform-live/monitoring · surface 必須 · TLV 非接続
 */
(function (global) {
  "use strict";

  const HS = global.PLATFORM_LIVE_MONITORING_HEALTH_STATES || global.TasuLivePlatformMonitoringHealthStates;
  const ME = global.PLATFORM_LIVE_MONITORING_EVENTS || global.TasuLivePlatformMonitoringEvents;
  const SS = global.PLATFORM_LIVE_SESSION_STATES || global.TasuLivePlatformSessionStates;
  const BS = global.PLATFORM_LIVE_BROADCAST_STATES || global.TasuLivePlatformBroadcastStates;
  const VS = global.PLATFORM_LIVE_VIEWER_STATES || global.TasuLivePlatformViewerStates;
  const RS = global.PLATFORM_LIVE_RECORDING_STATES || global.TasuLivePlatformRecordingStates;
  const CE = global.PLATFORM_LIVE_CHAT_EVENTS || global.TasuLivePlatformChatEvents;
  const EventBus = global.TasuLivePlatformSessionEventBus;
  const MetricsStore = global.TasuLivePlatformMonitoringMetricsStore;
  const SmokeRunner = global.TasuLivePlatformMonitoringSmokeRunner;
  const V = () => global.TasuLivePlatformMonitoringValidation;
  const EC = () => global.PLATFORM_LIVE_MONITORING_ERROR_CODES || global.TasuLivePlatformMonitoringErrorCodes;

  if (!HS || !ME || !EventBus || !MetricsStore) {
    throw new Error("TasuLivePlatformMonitoringService: load monitoring states/events/metrics-store first");
  }

  const ACTIVE_SESSION_STATES = new Set([
    SS?.READY,
    SS?.STARTING,
    SS?.LIVE,
    SS?.JOINING,
    SS?.CONNECTED,
    SS?.LEAVING,
    SS?.RECONNECTING,
  ].filter(Boolean));

  class TasuLivePlatformMonitoringService {
    /**
     * @param {{
     *   sessionManager?: object,
     *   broadcastService?: object,
     *   viewerService?: object,
     *   chatGateway?: object,
     *   recordingService?: object,
     *   provider?: object,
     *   ccuRegistry?: object,
     *   metricsStore?: object,
     *   smokeRunner?: object,
     * }} [options]
     */
    constructor(options = {}) {
      /** @private */
      this._bus = new EventBus();
      /** @private */
      this._metrics = options.metricsStore || new MetricsStore();
      /** @private */
      this._smokeRunner = options.smokeRunner || (SmokeRunner ? new SmokeRunner() : null);
      /** @private */
      this._wired = false;
      /** @private */
      this._disposed = false;
      /** @private @type {string|null} */
      this._surface = null;

      this._sessionManager = options.sessionManager || null;
      this._broadcastService = options.broadcastService || null;
      this._viewerService = options.viewerService || null;
      this._chatGateway = options.chatGateway || null;
      this._recordingService = options.recordingService || null;
      this._provider = options.provider || null;
      this._ccuRegistry = options.ccuRegistry || null;

      /** @private @type {Function[]} */
      this._unwire = [];
    }

    /** @param {object} services */
    wire(services = {}) {
      this._sessionManager =
        services.sessionManager ?? services.session ?? this._sessionManager;
      this._broadcastService =
        services.broadcastService ?? services.broadcast ?? this._broadcastService;
      this._viewerService =
        services.viewerService ?? services.viewer ?? this._viewerService;
      this._chatGateway =
        services.chatGateway ?? services.chat ?? this._chatGateway;
      this._recordingService =
        services.recordingService ?? services.recording ?? this._recordingService;
      this._provider = services.provider ?? this._provider;
      this._ccuRegistry = services.ccuRegistry ?? this._ccuRegistry;
      this.wireEvents();
      return this;
    }

    wireEvents() {
      this._unwire.forEach((fn) => {
        try {
          fn();
        } catch {
          /* ignore */
        }
      });
      this._unwire = [];
      this._wired = true;

      const surface = this._inferSurface();
      if (!surface) return this;

      if (this._chatGateway?.on) {
        const onSent = () => this._metrics.increment(surface, "messagesSent");
        const onBlocked = () => this._metrics.increment(surface, "messagesBlocked");
        const onReaction = () => this._metrics.increment(surface, "reactions");
        const onError = (p) =>
          this.recordError({ surface, code: p?.code, message: p?.message || p?.error });

        this._chatGateway.on(CE?.MESSAGE_SENT || "MESSAGE_SENT", onSent);
        this._chatGateway.on(CE?.MESSAGE_BLOCKED || "MESSAGE_BLOCKED", onBlocked);
        this._chatGateway.on(CE?.REACTION_ADDED || "REACTION_ADDED", onReaction);
        this._chatGateway.on(CE?.ERROR || "ERROR", onError);

        this._unwire.push(() => {
          /* event bus clear on dispose handles cleanup */
        });
      }

      return this;
    }

    on(event, handler) {
      if (typeof handler !== "function") return this;
      const val = V()?.validateEventName(event);
      if (val && !val.ok) return this;
      this._bus.on(val?.value || String(event || "").trim(), handler);
      return this;
    }

    /** @private */
    _requireSurface(options) {
      const sv = V()?.validateSurface(options?.surface);
      if (!sv?.ok) return this._validationFail(sv);
      if (this._surface && this._surface !== sv.value) {
        return this._validationFail({
          ok: false,
          code: EC()?.SURFACE_ERROR || "SURFACE_ERROR",
          message: `surface 不一致（monitoring: ${this._surface}, request: ${sv.value}）`,
          field: "surface",
        });
      }
      this._surface = this._surface || sv.value;
      return { ok: true, surface: sv.value };
    }

    /** @private */
    _inferSurface() {
      return (
        this._surface ||
        this._broadcastService?.broadcast?.surface ||
        this._sessionManager?.session?.surface ||
        null
      );
    }

    /**
     * @param {{ surface: string, code?: string, message?: string }} options
     */
    recordError(options = {}) {
      const surfaceCheck = this._requireSurface(options);
      if (!surfaceCheck.ok) return surfaceCheck;
      const entry = this._metrics.recordError(surfaceCheck.surface, {
        code: options.code || EC()?.MONITORING_SERVICE_ERROR,
        message: options.message || "error",
      });
      this._bus.emit(ME.ERROR_RECORDED, { surface: surfaceCheck.surface, ...entry });
      return { ok: true, error: entry };
    }

    /**
     * @param {{ surface: string }} options
     */
    async getProviderStatus(options = {}) {
      const surfaceCheck = this._requireSurface(options);
      if (!surfaceCheck.ok) return surfaceCheck;

      const provider = this._provider;
      if (!provider) {
        return { ok: true, status: "unknown", providerId: null, stub: true };
      }

      if (provider._state === "disposed" || provider.state === "disposed") {
        return { ok: false, status: "failed", providerId: provider.providerId, error: "provider disposed" };
      }

      let probe = null;
      if (provider.getMonitoringProbe) {
        probe = await provider.getMonitoringProbe({ surface: surfaceCheck.surface });
      } else if (provider.getBroadcastHealth) {
        probe = await provider.getBroadcastHealth({
          surface: surfaceCheck.surface,
          broadcastId: this._broadcastService?.broadcast?.id,
          roomId: this._broadcastService?.broadcast?.roomId,
        });
      }

      const status = probe?.ok === false ? "degraded" : probe?.status || "healthy";
      this._metrics.set(surfaceCheck.surface, "providerStatus", status);

      return {
        ok: probe?.ok !== false,
        status,
        providerId: provider.providerId || "unknown",
        stub: probe?.stub === true || provider.providerId === "stub",
        probe,
      };
    }

    /**
     * @param {{ surface: string }} options
     */
    getServiceStatus(options = {}) {
      const surfaceCheck = this._requireSurface(options);
      if (!surfaceCheck.ok) return surfaceCheck;

      const broadcastId = this._broadcastService?.broadcast?.id || null;

      return {
        ok: true,
        surface: surfaceCheck.surface,
        services: {
          session: {
            state: this._sessionManager?.state || "unknown",
            active: ACTIVE_SESSION_STATES.has(this._sessionManager?.state),
            status: this._sessionManager?.getStatus?.() || null,
          },
          broadcast: {
            state: this._broadcastService?.state || "unknown",
            live: this._broadcastService?.state === BS?.LIVE,
            broadcastId,
            viewerCount: this._broadcastService?.broadcast?.viewerCount ?? this._broadcastService?._viewerCount ?? 0,
          },
          viewer: {
            wired: !!this._viewerService,
            watchState: this._viewerService?.getWatchState?.({ surface: surfaceCheck.surface, userId: "monitor" }) || null,
          },
          chat: {
            wired: !!this._chatGateway,
          },
          recording: {
            state: this._recordingService?.state || "unknown",
            recording: this._recordingService?.state === RS?.RECORDING,
            metadata: this._recordingService?.metadata || null,
          },
        },
      };
    }

    /**
     * @private
     * @param {string} surface
     */
    _collectLiveMetrics(surface) {
      const broadcastId = this._broadcastService?.broadcast?.id;
      const sessionState = this._sessionManager?.state;
      const activeSessions = sessionState && ACTIVE_SESSION_STATES.has(sessionState) ? 1 : 0;
      const liveBroadcasts = this._broadcastService?.state === BS?.LIVE ? 1 : 0;

      let ccu = 0;
      if (broadcastId && this._viewerService?.getCcu) {
        ccu = this._viewerService.getCcu({ surface, broadcastId });
      } else if (broadcastId && this._ccuRegistry?.getCcu) {
        ccu = this._ccuRegistry.getCcu(surface, broadcastId);
      }

      const activeViewers = ccu;
      const activeRecordings = this._recordingService?.state === RS?.RECORDING ? 1 : 0;
      const completedRecordings =
        this._recordingService?.state === RS?.COMPLETED || this._recordingService?.state === RS?.EXPIRED ? 1 : 0;

      let lastHeartbeatAt = null;
      if (ccu > 0) {
        lastHeartbeatAt = new Date().toISOString();
      }

      this._metrics.patch(surface, {
        activeSessions,
        liveBroadcasts,
        activeViewers,
        ccu,
        activeRecordings,
        completedRecordings,
        lastHeartbeatAt,
      });

      return this._metrics.snapshot(surface);
    }

    /**
     * @param {{ surface: string }} options
     */
    async getMetrics(options = {}) {
      const surfaceCheck = this._requireSurface(options);
      if (!surfaceCheck.ok) return surfaceCheck;

      await this.getProviderStatus({ surface: surfaceCheck.surface });
      const metrics = this._collectLiveMetrics(surfaceCheck.surface);
      this._bus.emit(ME.METRICS_UPDATED, { surface: surfaceCheck.surface, metrics });
      return { ok: true, surface: surfaceCheck.surface, metrics };
    }

    /**
     * @param {{ surface: string }} options
     */
    async getHealth(options = {}) {
      const surfaceCheck = this._requireSurface(options);
      if (!surfaceCheck.ok) return surfaceCheck;

      const issues = [];
      let health = HS.HEALTHY;

      const hasAny =
        this._sessionManager ||
        this._broadcastService ||
        this._viewerService ||
        this._chatGateway ||
        this._recordingService;

      if (!hasAny) {
        health = HS.UNKNOWN;
        issues.push("no services wired");
      }

      const sessionState = this._sessionManager?.state;
      if (sessionState === SS?.ERROR) {
        health = HS.FAILED;
        issues.push("session ERROR");
      } else if (sessionState === SS?.RECONNECTING && health !== HS.FAILED) {
        health = HS.DEGRADED;
        issues.push("session RECONNECTING");
      }

      const broadcastState = this._broadcastService?.state;
      if (broadcastState === BS?.FAILED) {
        health = HS.FAILED;
        issues.push("broadcast FAILED");
      }

      const recordingState = this._recordingService?.state;
      if (recordingState && recordingState === RS?.FAILED) {
        health = HS.FAILED;
        issues.push("recording FAILED");
      }

      const providerStatus = await this.getProviderStatus({ surface: surfaceCheck.surface });
      if (providerStatus.status === "failed") {
        health = HS.FAILED;
        issues.push(providerStatus.error || "provider failed");
      } else if (providerStatus.status === "degraded" && health === HS.HEALTHY) {
        health = HS.DEGRADED;
        issues.push("provider degraded");
      } else if (providerStatus.status === "unknown" && !hasAny) {
        health = HS.UNKNOWN;
      }

      const metrics = this._collectLiveMetrics(surfaceCheck.surface);
      if (metrics.errors?.length > 10 && health === HS.HEALTHY) {
        health = HS.DEGRADED;
        issues.push("high error count");
      }

      const result = {
        healthy: health === HS.HEALTHY,
        health,
        surface: surfaceCheck.surface,
        issues,
        checkedAt: new Date().toISOString(),
        services: this.getServiceStatus({ surface: surfaceCheck.surface }).services,
        providerStatus: providerStatus.status,
      };

      this._bus.emit(ME.HEALTH_CHANGED, { ...result });
      return { ok: true, ...result };
    }

    /**
     * @param {{ surface: string, failAtStep?: string }} options
     */
    async runSmoke(options = {}) {
      const surfaceCheck = this._requireSurface(options);
      if (!surfaceCheck.ok) return surfaceCheck;
      if (!this._smokeRunner) {
        return { ok: false, error: "smoke runner unavailable", code: EC()?.MONITORING_SMOKE_FAILED };
      }

      this._bus.emit(ME.SMOKE_STARTED, { surface: surfaceCheck.surface });
      const result = await this._smokeRunner.run({
        surface: surfaceCheck.surface,
        failAtStep: options.failAtStep,
      });

      for (const step of result.steps || []) {
        this._bus.emit(ME.SMOKE_STEP, { surface: surfaceCheck.surface, ...step });
      }

      if (result.ok) {
        this._bus.emit(ME.SMOKE_COMPLETED, { surface: surfaceCheck.surface, ...result });
      } else {
        this.recordError({
          surface: surfaceCheck.surface,
          code: EC()?.MONITORING_SMOKE_FAILED,
          message: `smoke failed at ${result.failedStep || "unknown"}`,
        });
        this._bus.emit(ME.SMOKE_FAILED, { surface: surfaceCheck.surface, ...result });
      }

      return { ok: result.ok, smoke: result, code: result.ok ? undefined : EC()?.MONITORING_SMOKE_FAILED };
    }

    async dispose() {
      this._disposed = true;
      this._unwire = [];
      this._sessionManager = null;
      this._broadcastService = null;
      this._viewerService = null;
      this._chatGateway = null;
      this._recordingService = null;
      this._provider = null;
      this._ccuRegistry = null;
      this._surface = null;
      this._bus.clear();
      return { ok: true };
    }

    /** @private */
    _validationFail(vr) {
      const code = vr.code || EC()?.VALIDATION_ERROR || "VALIDATION_ERROR";
      return { ok: false, error: vr.message, code };
    }
  }

  global.TasuLivePlatformMonitoringService = TasuLivePlatformMonitoringService;
})(typeof window !== "undefined" ? window : globalThis);
