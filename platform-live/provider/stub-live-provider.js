/**
 * Live Platform — Stub Provider（ZEGO 非依存 · lifecycle 検証用）
 * Phase A · MVP デフォルト
 */
(function (global) {
  "use strict";

  const Base = global.PlatformLiveProviderInterface;
  const SIG = global.PLATFORM_LIVE_PROVIDER_SIGNALS || global.TasuLivePlatformProviderSignals;
  const bsig = () =>
    global.PLATFORM_LIVE_BROADCAST_PROVIDER_SIGNALS || global.TasuLivePlatformBroadcastProviderSignals;

  if (!Base) {
    throw new Error("StubLiveProvider: load live-provider-interface.js first");
  }

  class StubLiveProvider extends Base {
    constructor() {
      super();
      /** @private */
      this._state = "idle";
      /** @private */
      this._surface = null;
      /** @private */
      this._roomId = null;
      /** @private */
      this._broadcastId = null;
      /** @private */
      this._viewerCount = 0;
      /** @private @type {object|null} */
      this._activeRecording = null;
    }

    /** @returns {string} */
    get providerId() {
      return "stub";
    }

    /** @returns {string} */
    get state() {
      return this._state;
    }

    /** @param {{ surface?: string }} options */
    async initialize(options = {}) {
      this._surface = String(options.surface || "platform").trim().toLowerCase() || "platform";
      this._state = "ready";
      return { ok: true, state: this._state, providerId: this.providerId, stub: true };
    }

    /** @param {{ roomId: string, userId: string, surface: string }} options */
    async startLive(options = {}) {
      if (this._state === "disposed") {
        return { ok: false, error: "Provider disposed", state: this._state };
      }
      const roomId = String(options.roomId || "").trim();
      if (!roomId) return { ok: false, error: "roomId が必要です", state: this._state };

      this._roomId = roomId;
      this._state = "live";
      if (SIG) {
        this._emitSignal(SIG.PROVIDER_CONNECTING, { surface: options.surface, roomId });
        this._emitSignal(SIG.PROVIDER_CONNECTED, {
          surface: options.surface,
          roomId,
          userId: options.userId || null,
        });
      }
      return { ok: true, state: this._state, providerId: this.providerId, stub: true };
    }

    /** @private @param {HTMLElement|null} container @param {object} [options] */
    _mountPlayerSurface(container, options = {}) {
      if (!container || typeof container.appendChild !== "function") {
        return { ok: false, error: "videoContainer unavailable", playerMounted: false };
      }
      try {
        container.innerHTML = "";
        const video = document.createElement("video");
        video.className = "live-watch__video";
        video.setAttribute("data-live-platform-player-video", "");
        video.setAttribute("playsinline", "");
        video.setAttribute("autoplay", "");
        video.muted = true;
        video.controls = true;
        video.setAttribute("aria-label", "ライブ配信");
        video.setAttribute(
          "data-platform-live-provider",
          String(options.providerId || this.providerId || "stub"),
        );
        container.appendChild(video);
        return { ok: true, playerMounted: true, providerId: this.providerId, stub: true };
      } catch (err) {
        return { ok: false, error: err?.message || String(err), playerMounted: false };
      }
    }

    /** @param {{ roomId: string, userId: string, surface: string, videoContainer?: HTMLElement }} options */
    async joinLive(options = {}) {
      if (this._state === "disposed") {
        return { ok: false, error: "Provider disposed", state: this._state };
      }
      const roomId = String(options.roomId || "").trim();
      if (!roomId) return { ok: false, error: "roomId が必要です", state: this._state };

      this._roomId = roomId;
      this._state = "watching";
      if (SIG) {
        this._emitSignal(SIG.PROVIDER_CONNECTING, { surface: options.surface, roomId });
        this._emitSignal(SIG.PROVIDER_CONNECTED, {
          surface: options.surface,
          roomId,
          userId: options.userId || null,
        });
      }
      const mount = this._mountPlayerSurface(options.videoContainer, options);
      return {
        ok: true,
        state: this._state,
        providerId: this.providerId,
        stub: true,
        playerMounted: mount.playerMounted === true,
        ...(mount.playerMounted ? {} : { mountSkipped: true, mountError: mount.error || null }),
      };
    }

    async leaveLive() {
      if (this._state === "disposed") return { ok: true, state: this._state };
      if (SIG && this._roomId) {
        this._emitSignal(SIG.PROVIDER_DISCONNECTED, { roomId: this._roomId, surface: this._surface });
      }
      this._state = "ready";
      this._roomId = null;
      return { ok: true, state: this._state, providerId: this.providerId, stub: true };
    }

    async endLive() {
      if (this._state === "disposed") return { ok: true, state: this._state };
      if (SIG && this._roomId) {
        this._emitSignal(SIG.PROVIDER_DISCONNECTED, { roomId: this._roomId, surface: this._surface, reason: "host_end" });
      }
      this._state = "ready";
      this._roomId = null;
      return { ok: true, state: this._state, providerId: this.providerId, stub: true };
    }

    async reconnectLive() {
      if (this._state === "disposed") {
        return { ok: false, error: "Provider disposed", state: this._state };
      }
      if (SIG) {
        this._emitSignal(SIG.PROVIDER_RECONNECTING, { roomId: this._roomId, surface: this._surface });
        this._emitSignal(SIG.PROVIDER_RECONNECTED, { roomId: this._roomId, surface: this._surface });
      }
      return { ok: true, state: this._state, providerId: this.providerId, stub: true };
    }

    /** @param {{ broadcastId: string, roomId: string, surface: string, userId?: string }} options */
    async startBroadcast(options = {}) {
      if (this._state === "disposed") {
        return { ok: false, error: "Provider disposed", state: this._state };
      }
      const roomId = String(options.roomId || "").trim();
      const broadcastId = String(options.broadcastId || "").trim();
      if (!roomId || !broadcastId) {
        return { ok: false, error: "roomId / broadcastId が必要です", state: this._state };
      }

      this._roomId = roomId;
      this._broadcastId = broadcastId;
      this._state = "live";
      const BSIG = bsig();
      if (BSIG) {
        this._emitBroadcastSignal(BSIG.BROADCAST_PROVIDER_STARTING, { surface: options.surface, roomId, broadcastId });
        this._emitBroadcastSignal(BSIG.BROADCAST_PROVIDER_STARTED, { surface: options.surface, roomId, broadcastId });
      }
      return { ok: true, state: this._state, providerId: this.providerId, stub: true };
    }

    /** @param {{ broadcastId: string, roomId: string, surface: string, reason?: string }} options */
    async stopBroadcast(options = {}) {
      if (this._state === "disposed") {
        return { ok: false, error: "Provider disposed", state: this._state };
      }
      const BSIG = bsig();
      if (BSIG) {
        this._emitBroadcastSignal(BSIG.BROADCAST_PROVIDER_STOPPING, {
          surface: options.surface,
          roomId: options.roomId || this._roomId,
          broadcastId: options.broadcastId || this._broadcastId,
          reason: options.reason,
        });
        this._emitBroadcastSignal(BSIG.BROADCAST_PROVIDER_STOPPED, {
          surface: options.surface,
          roomId: options.roomId || this._roomId,
          broadcastId: options.broadcastId || this._broadcastId,
        });
      }
      this._state = "ready";
      this._broadcastId = null;
      this._viewerCount = 0;
      return { ok: true, state: this._state, providerId: this.providerId, stub: true };
    }

    /** @param {{ broadcastId: string, roomId: string, surface: string }} options */
    async getBroadcastHealth(options = {}) {
      if (this._state === "disposed") {
        return { ok: false, error: "Provider disposed", stub: true };
      }
      const ok = this._state === "live" || this._state === "ready" || this._state === "watching";
      const BSIG = bsig();
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
        state: this._state,
        viewerCount: this._viewerCount,
        stub: true,
        error: ok ? undefined : "provider not live",
      };
    }

    /** @param {{ broadcastId: string, roomId: string, surface: string, count: number }} options */
    async updateViewerCount(options = {}) {
      if (this._state === "disposed") {
        return { ok: false, error: "Provider disposed", stub: true };
      }
      const count = Math.max(0, Math.floor(Number(options.count) || 0));
      this._viewerCount = count;
      const BSIG = bsig();
      if (BSIG) {
        this._emitBroadcastSignal(BSIG.BROADCAST_PROVIDER_VIEWER_COUNT, {
          surface: options.surface,
          broadcastId: options.broadcastId,
          roomId: options.roomId,
          count,
        });
      }
      return { ok: true, viewerCount: count, providerId: this.providerId, stub: true };
    }

    /** @param {{ surface: string, broadcastId: string, userId: string, roomId?: string, videoContainer?: HTMLElement }} options */
    async joinViewer(options = {}) {
      if (this._state === "disposed") return { ok: false, error: "Provider disposed", stub: true };
      this._state = "watching";
      this._broadcastId = String(options.broadcastId || "").trim();
      this._roomId = String(options.roomId || this._roomId || "").trim();
      if (SIG) {
        this._emitSignal(SIG.PROVIDER_CONNECTING, { surface: options.surface, roomId: this._roomId });
        this._emitSignal(SIG.PROVIDER_CONNECTED, {
          surface: options.surface,
          roomId: this._roomId,
          userId: options.userId,
        });
      }
      const mount = this._mountPlayerSurface(options.videoContainer, options);
      return {
        ok: true,
        state: this._state,
        providerId: this.providerId,
        stub: true,
        playerMounted: mount.playerMounted === true,
        ...(mount.playerMounted ? {} : { mountSkipped: true, mountError: mount.error || null }),
      };
    }

    /** @param {{ surface: string, broadcastId: string, userId: string }} options */
    async leaveViewer(options = {}) {
      if (this._state === "disposed") return { ok: true, state: this._state, stub: true };
      if (SIG && this._roomId) {
        this._emitSignal(SIG.PROVIDER_DISCONNECTED, { roomId: this._roomId, surface: options.surface });
      }
      this._state = "ready";
      return { ok: true, state: this._state, providerId: this.providerId, stub: true };
    }

    /** @param {{ surface: string, broadcastId: string, userId: string }} options */
    async reconnectViewer(options = {}) {
      if (this._state === "disposed") return { ok: false, error: "Provider disposed", stub: true };
      if (SIG) {
        this._emitSignal(SIG.PROVIDER_RECONNECTING, { roomId: this._roomId, surface: options.surface });
        this._emitSignal(SIG.PROVIDER_RECONNECTED, { roomId: this._roomId, surface: options.surface });
      }
      return { ok: true, state: this._state, providerId: this.providerId, stub: true };
    }

    /** @param {{ surface: string, broadcastId: string, userId: string }} options */
    async viewerHeartbeat(_options = {}) {
      if (this._state === "disposed") return { ok: false, error: "Provider disposed", stub: true };
      return { ok: true, providerId: this.providerId, stub: true };
    }

    /** @param {{ surface: string, broadcastId: string, userId: string, messageId: string, text: string }} options */
    async sendChatMessage(options = {}) {
      if (this._state === "disposed") return { ok: false, error: "Provider disposed", stub: true };
      return { ok: true, providerId: this.providerId, stub: true, messageId: options.messageId };
    }

    /** @param {{ surface: string, broadcastId: string, userId: string, messageId: string, reaction: string }} options */
    async addChatReaction(_options = {}) {
      if (this._state === "disposed") return { ok: false, error: "Provider disposed", stub: true };
      return { ok: true, providerId: this.providerId, stub: true };
    }

    /** @param {{ surface: string, broadcastId: string, userId: string, messageId: string, reaction: string }} options */
    async removeChatReaction(_options = {}) {
      if (this._state === "disposed") return { ok: false, error: "Provider disposed", stub: true };
      return { ok: true, providerId: this.providerId, stub: true };
    }

    /** @param {{ surface: string, broadcastId: string, type: string, payload?: object }} options */
    async emitChatSystemEvent(_options = {}) {
      if (this._state === "disposed") return { ok: false, error: "Provider disposed", stub: true };
      return { ok: true, providerId: this.providerId, stub: true };
    }

    /** @param {{ surface: string, broadcastId: string, sessionId?: string, recordingId: string, roomId?: string }} options */
    async startRecording(options = {}) {
      if (this._state === "disposed") return { ok: false, error: "Provider disposed", stub: true };
      const recordingId = String(options.recordingId || "").trim();
      const storageKey = `stub-rec://${options.surface}/${options.broadcastId}/${recordingId}`;
      this._activeRecording = {
        recordingId,
        broadcastId: options.broadcastId,
        surface: options.surface,
        storageKey,
        startedAt: new Date().toISOString(),
        state: "recording",
        _startedMs: Date.now(),
      };
      return { ok: true, providerId: this.providerId, stub: true, storageKey, recordingId };
    }

    /** @param {{ surface: string, broadcastId: string, recordingId: string, storageKey?: string }} options */
    async stopRecording(options = {}) {
      if (this._state === "disposed") return { ok: false, error: "Provider disposed", stub: true };
      const recordingId = String(options.recordingId || "").trim();
      const playbackUrl = `stub-playback://${options.surface}/${options.broadcastId}/${recordingId}.mp4`;
      const durationSec = this._activeRecording?._startedMs
        ? Math.max(0, Math.floor((Date.now() - this._activeRecording._startedMs) / 1000))
        : 1;
      this._activeRecording = null;
      return { ok: true, providerId: this.providerId, stub: true, playbackUrl, durationSec };
    }

    /** @param {{ surface: string, recordingId: string }} options */
    getRecordingStatus(options = {}) {
      if (this._state === "disposed") return { ok: false, error: "Provider disposed", stub: true };
      const active = this._activeRecording?.recordingId === options.recordingId;
      return {
        ok: true,
        providerId: this.providerId,
        stub: true,
        state: active ? "recording" : "idle",
      };
    }

    /** @param {{ surface: string, recordingId: string, storageKey?: string }} options */
    async getArchiveMetadata(options = {}) {
      if (this._state === "disposed") return { ok: false, error: "Provider disposed", stub: true };
      return {
        ok: true,
        providerId: this.providerId,
        stub: true,
        archive: {
          archiveId: `arc-${options.recordingId}`,
          storageKey: options.storageKey || `stub-rec://${options.surface}/${options.recordingId}`,
          provider: "stub",
        },
      };
    }

    /** @param {{ surface: string }} options */
    async getMonitoringProbe(options = {}) {
      if (this._state === "disposed") {
        return { ok: false, status: "failed", error: "Provider disposed", stub: true };
      }
      const healthy = this._state === "live" || this._state === "ready" || this._state === "watching";
      return {
        ok: healthy,
        status: healthy ? "healthy" : "degraded",
        providerId: this.providerId,
        state: this._state,
        stub: true,
        surface: options.surface,
      };
    }

    async dispose() {
      this._state = "disposed";
      this._roomId = null;
      this._broadcastId = null;
      this._signalHandler = null;
      this._broadcastSignalHandler = null;
      return { ok: true, state: this._state, providerId: this.providerId };
    }
  }

  global.StubLiveProvider = StubLiveProvider;
})(typeof window !== "undefined" ? window : globalThis);
