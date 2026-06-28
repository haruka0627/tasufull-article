/**
 * Live Platform Recording Service — start/stop/status/metadata/archive
 * Phase E · platform-live/recording · surface 必須 · TLV/VOD 非接続
 */
(function (global) {
  "use strict";

  const RS = global.PLATFORM_LIVE_RECORDING_STATES || global.TasuLivePlatformRecordingStates;
  const RE = global.PLATFORM_LIVE_RECORDING_EVENTS || global.TasuLivePlatformRecordingEvents;
  const BS = global.PLATFORM_LIVE_BROADCAST_STATES || global.TasuLivePlatformBroadcastStates;
  const EventBus = global.TasuLivePlatformSessionEventBus;
  const V = () => global.TasuLivePlatformRecordingValidation;
  const EC = () => global.PLATFORM_LIVE_RECORDING_ERROR_CODES || global.TasuLivePlatformRecordingErrorCodes;

  if (!RS || !RE || !EventBus) {
    throw new Error("TasuLivePlatformRecordingService: load recording states/events and core event-bus first");
  }

  /** @readonly */
  const TRANSITIONS = Object.freeze({
    [RS.IDLE]: [RS.STARTING],
    [RS.STARTING]: [RS.RECORDING, RS.FAILED],
    [RS.RECORDING]: [RS.STOPPING, RS.FAILED],
    [RS.STOPPING]: [RS.COMPLETED, RS.FAILED],
    [RS.COMPLETED]: [RS.EXPIRED, RS.IDLE],
    [RS.FAILED]: [RS.IDLE],
    [RS.EXPIRED]: [RS.IDLE],
  });

  class TasuLivePlatformRecordingService {
    /**
     * @param {{ broadcastService?: object, sessionManager?: object, provider?: object }} [options]
     */
    constructor(options = {}) {
      /** @private */
      this._bus = new EventBus();
      /** @private */
      this._state = RS.IDLE;
      /** @private @type {object|null} */
      this._recording = null;
      /** @private @type {object|null} */
      this._archive = null;
      /** @private */
      this._surface = null;
      /** @private */
      this._disposed = false;
      /** @private */
      this._recSeq = 0;
      this._broadcastService = options.broadcastService || null;
      this._sessionManager = options.sessionManager || null;
      this._provider = options.provider || null;
    }

    setBroadcastService(s) {
      this._broadcastService = s || null;
      return this;
    }
    setSessionManager(s) {
      this._sessionManager = s || null;
      return this;
    }
    setProvider(p) {
      this._provider = p || null;
      return this;
    }

    /** @returns {string} */
    get state() {
      return this._state;
    }

    /** @returns {object|null} */
    get metadata() {
      return this._recording ? { ...this._recording } : null;
    }

    /** @returns {object|null} */
    get archive() {
      return this._archive ? { ...this._archive } : null;
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
          message: `surface 不一致（recording: ${this._surface}, request: ${sv.value}）`,
          field: "surface",
        });
      }
      this._surface = this._surface || sv.value;
      return { ok: true, surface: sv.value };
    }

    /** @private */
    _canTransition(from, to) {
      const allowed = TRANSITIONS[from];
      return Array.isArray(allowed) && allowed.includes(to);
    }

    /** @private */
    _transition(next) {
      const from = this._state;
      if (from === next) return { ok: true, state: next };
      if (!this._canTransition(from, next)) {
        return this._stateFail(`状態遷移不可: ${from} → ${next}`);
      }
      this._state = next;
      if (this._recording) this._recording.status = next;
      this._bus.emit(RE.STATE_CHANGED, {
        from,
        to: next,
        recordingId: this._recording?.recordingId,
        surface: this._surface,
      });
      return { ok: true, state: next };
    }

    /** @private */
    _assertBroadcastLive() {
      const bcState = this._broadcastService?.state;
      if (bcState !== BS?.LIVE) {
        return {
          ok: false,
          code: EC()?.BROADCAST_NOT_LIVE || "BROADCAST_NOT_LIVE",
          error: "broadcast が live ではありません",
        };
      }
      return { ok: true };
    }

    /** @private */
    _nextRecordingId() {
      this._recSeq += 1;
      return `rec-${Date.now()}-${this._recSeq}`;
    }

    /** @private */
    _buildMetadata(partial) {
      return {
        recordingId: partial.recordingId,
        broadcastId: partial.broadcastId,
        sessionId: partial.sessionId || null,
        surface: partial.surface,
        provider: partial.provider || this._provider?.providerId || "stub",
        startedAt: partial.startedAt || null,
        stoppedAt: partial.stoppedAt || null,
        durationSec: partial.durationSec ?? null,
        storageKey: partial.storageKey || null,
        playbackUrl: partial.playbackUrl || null,
        status: partial.status || this._state,
        errorCode: partial.errorCode || null,
      };
    }

    /**
     * @param {{ surface: string, broadcastId: string, sessionId?: string, recordingId?: string }} options
     */
    async startRecording(options = {}) {
      const surfaceCheck = this._requireSurface(options);
      if (!surfaceCheck.ok) return surfaceCheck;
      if (this._disposed) return this._stateFail("dispose 済みです");
      if (this._state !== RS.IDLE && this._state !== RS.FAILED && this._state !== RS.COMPLETED && this._state !== RS.EXPIRED) {
        return this._stateFail(`startRecording は ${RS.IDLE} 等のみ可能です（現在: ${this._state}）`);
      }

      const br = V()?.validateBroadcastId(options.broadcastId);
      if (br && !br.ok) return this._validationFail(br);
      const broadcastId = br?.value || String(options.broadcastId).trim();

      const liveCheck = this._assertBroadcastLive();
      if (!liveCheck.ok) return liveCheck;

      let recordingId = this._nextRecordingId();
      if (options.recordingId != null && String(options.recordingId).trim()) {
        const rr = V()?.validateRecordingId(options.recordingId);
        if (rr && !rr.ok) return this._validationFail(rr);
        recordingId = rr.value;
      }

      const sessionId =
        options.sessionId != null
          ? (V()?.validateSessionId(options.sessionId)?.value ?? (String(options.sessionId).trim() || null))
          : this._sessionManager?.session?.id || this._broadcastService?.broadcast?.id || null;

      if (this._state !== RS.IDLE) {
        this._recording = null;
        this._archive = null;
        this._state = RS.IDLE;
      }

      const tr = this._transition(RS.STARTING);
      if (!tr.ok) return tr;

      this._bus.emit(RE.RECORDING_STARTING, { recordingId, broadcastId, surface: surfaceCheck.surface });

      let storageKey = `stub://${surfaceCheck.surface}/${broadcastId}/${recordingId}`;
      if (this._provider?.startRecording) {
        const pr = await this._provider.startRecording({
          surface: surfaceCheck.surface,
          broadcastId,
          sessionId,
          recordingId,
          roomId: this._broadcastService?.broadcast?.roomId,
        });
        if (pr?.ok === false) {
          this._recording = this._buildMetadata({
            recordingId,
            broadcastId,
            sessionId,
            surface: surfaceCheck.surface,
            status: RS.FAILED,
            errorCode: pr.code || EC()?.RECORDING_PROVIDER_ERROR,
          });
          this._transition(RS.FAILED);
          this._bus.emit(RE.RECORDING_FAILED, { ...this._recording, error: pr.error });
          return {
            ok: false,
            state: this._state,
            error: pr.error || "provider start failed",
            code: EC()?.RECORDING_PROVIDER_ERROR || "RECORDING_PROVIDER_ERROR",
            metadata: { ...this._recording },
          };
        }
        storageKey = pr.storageKey || storageKey;
      }

      const startedAt = new Date().toISOString();
      this._recording = this._buildMetadata({
        recordingId,
        broadcastId,
        sessionId,
        surface: surfaceCheck.surface,
        provider: this._provider?.providerId || "stub",
        startedAt,
        storageKey,
        status: RS.RECORDING,
      });
      this._recording._startedMs = Date.now();

      const tr2 = this._transition(RS.RECORDING);
      if (!tr2.ok) return tr2;

      this._bus.emit(RE.RECORDING_STARTED, { ...this._recording });
      return { ok: true, state: this._state, metadata: { ...this._recording } };
    }

    /**
     * @param {{ surface: string, recordingId?: string }} options
     */
    async stopRecording(options = {}) {
      const surfaceCheck = this._requireSurface(options);
      if (!surfaceCheck.ok) return surfaceCheck;
      if (this._disposed) return this._stateFail("dispose 済みです");
      if (!this._recording) return this._notFoundFail();
      if (this._state !== RS.RECORDING) {
        return this._stateFail(`stopRecording は ${RS.RECORDING} のみ可能です（現在: ${this._state}）`);
      }

      if (options.recordingId && String(options.recordingId).trim() !== this._recording.recordingId) {
        return this._notFoundFail();
      }

      const tr = this._transition(RS.STOPPING);
      if (!tr.ok) return tr;

      this._bus.emit(RE.RECORDING_STOPPING, {
        recordingId: this._recording.recordingId,
        surface: surfaceCheck.surface,
      });

      const stoppedAt = new Date().toISOString();
      let durationSec = Math.max(
        0,
        Math.floor((Date.now() - (this._recording._startedMs || Date.now())) / 1000)
      );

      let playbackUrl = `stub-playback://${surfaceCheck.surface}/${this._recording.broadcastId}/${this._recording.recordingId}`;
      if (this._provider?.stopRecording) {
        const pr = await this._provider.stopRecording({
          surface: surfaceCheck.surface,
          broadcastId: this._recording.broadcastId,
          recordingId: this._recording.recordingId,
          storageKey: this._recording.storageKey,
        });
        if (pr?.ok === false) {
          this._recording.stoppedAt = stoppedAt;
          this._recording.durationSec = durationSec;
          this._recording.errorCode = pr.code || EC()?.RECORDING_PROVIDER_ERROR;
          this._recording.status = RS.FAILED;
          this._transition(RS.FAILED);
          this._bus.emit(RE.RECORDING_FAILED, { ...this._recording, error: pr.error });
          return {
            ok: false,
            state: this._state,
            error: pr.error,
            code: EC()?.RECORDING_PROVIDER_ERROR,
            metadata: { ...this._stripInternal(this._recording) },
          };
        }
        playbackUrl = pr.playbackUrl || playbackUrl;
        if (pr.durationSec != null) durationSec = Math.max(0, Math.floor(Number(pr.durationSec)));
      }

      this._recording.stoppedAt = stoppedAt;
      this._recording.durationSec = durationSec;
      this._recording.playbackUrl = playbackUrl;
      this._recording.status = RS.COMPLETED;

      this._transition(RS.COMPLETED);
      this._bus.emit(RE.RECORDING_STOPPED, { ...this._stripInternal(this._recording) });
      this._bus.emit(RE.RECORDING_COMPLETED, { ...this._stripInternal(this._recording) });

      return { ok: true, state: this._state, metadata: { ...this._stripInternal(this._recording) } };
    }

    /**
     * @param {{ surface: string, recordingId?: string }} options
     */
    getRecordingStatus(options = {}) {
      const surfaceCheck = this._requireSurface(options);
      if (!surfaceCheck.ok) return surfaceCheck;
      if (!this._recording) {
        return { ok: true, state: this._state, metadata: null };
      }
      if (options.recordingId && String(options.recordingId).trim() !== this._recording.recordingId) {
        return this._notFoundFail();
      }

      let providerStatus = null;
      if (this._provider?.getRecordingStatus && this._state === RS.RECORDING) {
        providerStatus = this._provider.getRecordingStatus({
          surface: surfaceCheck.surface,
          recordingId: this._recording.recordingId,
        });
      }

      return {
        ok: true,
        state: this._state,
        metadata: { ...this._stripInternal(this._recording) },
        providerStatus,
      };
    }

    /**
     * @param {{ surface: string, recordingId?: string }} options
     */
    getRecordingMetadata(options = {}) {
      return this.getRecordingStatus(options);
    }

    /**
     * @param {{ surface: string, recordingId?: string, ttlSec?: number }} options
     */
    async createArchiveMetadata(options = {}) {
      const surfaceCheck = this._requireSurface(options);
      if (!surfaceCheck.ok) return surfaceCheck;
      if (!this._recording) return this._notFoundFail();
      if (this._state !== RS.COMPLETED && this._state !== RS.EXPIRED) {
        return this._stateFail(`createArchiveMetadata は ${RS.COMPLETED} のみ可能です（現在: ${this._state}）`);
      }

      if (options.recordingId && String(options.recordingId).trim() !== this._recording.recordingId) {
        return this._notFoundFail();
      }

      const meta = { ...this._stripInternal(this._recording) };
      let archiveExtra = {};
      if (this._provider?.getArchiveMetadata) {
        const pr = await this._provider.getArchiveMetadata({
          surface: surfaceCheck.surface,
          recordingId: meta.recordingId,
          storageKey: meta.storageKey,
        });
        if (pr?.ok === false) {
          return { ok: false, error: pr.error, code: EC()?.RECORDING_PROVIDER_ERROR };
        }
        archiveExtra = pr.archive || pr.metadata || {};
      }

      const ttlSec = Number(options.ttlSec) > 0 ? Number(options.ttlSec) : 86400;
      const now = Date.now();
      this._archive = {
        archiveId: `arc-${meta.recordingId}`,
        recordingId: meta.recordingId,
        broadcastId: meta.broadcastId,
        surface: meta.surface,
        storageKey: meta.storageKey,
        playbackUrl: meta.playbackUrl,
        durationSec: meta.durationSec,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(now + ttlSec * 1000).toISOString(),
        ...archiveExtra,
      };

      this._bus.emit(RE.ARCHIVE_CREATED, { ...this._archive });
      return { ok: true, archive: { ...this._archive }, metadata: meta };
    }

    /**
     * @param {{ surface: string }} options
     */
    async markExpired(options = {}) {
      const surfaceCheck = this._requireSurface(options);
      if (!surfaceCheck.ok) return surfaceCheck;
      if (this._state !== RS.COMPLETED) {
        return this._stateFail(`markExpired は ${RS.COMPLETED} のみ可能です`);
      }
      this._transition(RS.EXPIRED);
      if (this._recording) {
        this._recording.status = RS.EXPIRED;
        this._recording.playbackUrl = null;
      }
      this._bus.emit(RE.RECORDING_EXPIRED, { recordingId: this._recording?.recordingId, surface: surfaceCheck.surface });
      return { ok: true, state: this._state, metadata: this._recording ? { ...this._stripInternal(this._recording) } : null };
    }

    /**
     * @param {{ surface: string }} options
     */
    async resetRecording(options = {}) {
      const surfaceCheck = this._requireSurface(options);
      if (!surfaceCheck.ok) return surfaceCheck;
      if (![RS.COMPLETED, RS.FAILED, RS.EXPIRED, RS.IDLE].includes(this._state)) {
        return this._stateFail(`resetRecording は terminal 状態のみ可能です（現在: ${this._state}）`);
      }
      this._recording = null;
      this._archive = null;
      this._state = RS.IDLE;
      return { ok: true, state: RS.IDLE };
    }

    async dispose() {
      this._disposed = true;
      this._recording = null;
      this._archive = null;
      this._state = RS.IDLE;
      this._surface = null;
      this._bus.clear();
      return { ok: true };
    }

    /** @private */
    _stripInternal(rec) {
      if (!rec) return null;
      const { _startedMs, ...rest } = rec;
      return { ...rest };
    }

    /** @private */
    _stateFail(message) {
      return { ok: false, state: this._state, error: String(message), code: EC()?.RECORDING_STATE_ERROR || "RECORDING_STATE_ERROR" };
    }

    /** @private */
    _notFoundFail() {
      return { ok: false, state: this._state, error: "recording がありません", code: EC()?.RECORDING_NOT_FOUND || "RECORDING_NOT_FOUND" };
    }

    /** @private */
    _validationFail(vr) {
      const code = vr.code || EC()?.VALIDATION_ERROR || "VALIDATION_ERROR";
      this._bus.emit(RE.ERROR, { code, message: vr.message, field: vr.field });
      return { ok: false, error: vr.message, code };
    }
  }

  global.TasuLivePlatformRecordingService = TasuLivePlatformRecordingService;
  global.PLATFORM_LIVE_RECORDING_TRANSITIONS = TRANSITIONS;
})(typeof window !== "undefined" ? window : globalThis);
