/**
 * TLV ↔ Platform Live 境界 Adapter（Phase 5 P5-2）
 *
 * TLV 本番 UI / bridge から TasuLivePlatformIntegration のみを呼ぶ。
 * ZEGO SDK / Provider への直接依存禁止 · retry は Integration 側に委譲。
 *
 * P5-3: TLV_FEATURE_FLAGS.usePlatformLive === true 時のみ本番経路有効（default false）。
 */
(function (global) {
  "use strict";

  const SURFACE = global.LIVE_SURFACES?.TLV || "tlv";
  const CODE_DISABLED = "PLATFORM_LIVE_DISABLED";
  const CODE_NOT_LOADED = "PLATFORM_INTEGRATION_NOT_LOADED";
  const CODE_VALIDATION = "VALIDATION_ERROR";

  /** @returns {boolean} P5-3 feature flag hook */
  function isPlatformLiveFlagEnabled() {
    return global.TLV_FEATURE_FLAGS?.usePlatformLive === true;
  }

  /**
   * @param {Record<string, unknown>} [input]
   * @returns {{ broadcastId: string, liveId: string, roomId: string }}
   */
  function normalizeIds(input = {}) {
    const rawBroadcast = String(input.broadcastId || input.liveId || input.id || "").trim();
    const rawLive = String(input.liveId || rawBroadcast).trim();
    const rawRoom = String(input.roomId || rawBroadcast || rawLive).trim();
    const roomId = rawRoom;
    const broadcastId = rawBroadcast || (roomId ? `bc-${roomId}` : "");
    const liveId = rawLive || broadcastId;
    return { broadcastId, liveId, roomId };
  }

  /**
   * @param {Record<string, unknown>} [input]
   */
  function normalizeHostContext(input = {}) {
    const ids = normalizeIds(input);
    const userId = String(input.userId || input.creatorId || input.hostUserId || "").trim();
    return {
      surface: SURFACE,
      broadcastId: ids.broadcastId,
      liveId: ids.liveId,
      roomId: ids.roomId,
      userId,
      userName: input.userName != null ? String(input.userName) : undefined,
      videoContainer: input.videoContainer || null,
      manualToken: input.manualToken != null ? String(input.manualToken) : undefined,
      streamId: input.streamId != null ? String(input.streamId) : undefined,
    };
  }

  /**
   * @param {Record<string, unknown>} [input]
   */
  function normalizeViewerContext(input = {}) {
    const ids = normalizeIds(input);
    const userId = String(input.userId || input.viewerId || "").trim();
    return {
      surface: SURFACE,
      broadcastId: ids.broadcastId,
      liveId: ids.liveId,
      roomId: ids.roomId,
      userId,
      userName: input.userName != null ? String(input.userName) : undefined,
      videoContainer: input.videoContainer || null,
      manualToken: input.manualToken != null ? String(input.manualToken) : undefined,
    };
  }

  /**
   * @param {Record<string, unknown>} [input]
   */
  function normalizeChatContext(input = {}) {
    const ids = normalizeIds(input);
    return {
      surface: SURFACE,
      broadcastId: ids.broadcastId,
      liveId: ids.liveId,
      roomId: ids.roomId,
      userId: String(input.userId || "").trim(),
      text: String(input.text || "").trim(),
    };
  }

  /**
   * @param {Record<string, unknown>} [input]
   */
  function normalizeRecordingContext(input = {}) {
    const ids = normalizeIds(input);
    return {
      surface: SURFACE,
      broadcastId: ids.broadcastId,
      liveId: ids.liveId,
      roomId: ids.roomId,
      sessionId: input.sessionId != null ? String(input.sessionId) : undefined,
      recordingId: input.recordingId != null ? String(input.recordingId) : undefined,
      userId: input.userId != null ? String(input.userId) : undefined,
      streamId: input.streamId != null ? String(input.streamId) : undefined,
    };
  }

  /**
   * @param {Record<string, unknown>} [input]
   */
  function normalizeMonitoringContext(input = {}) {
    const ids = normalizeIds(input);
    return {
      surface: SURFACE,
      broadcastId: ids.broadcastId,
      liveId: ids.liveId,
      roomId: ids.roomId,
      streamId: input.streamId != null ? String(input.streamId) : undefined,
      reason: input.reason != null ? String(input.reason) : undefined,
    };
  }

  class TlvPlatformLiveAdapter {
    /**
     * @param {{
     *   integration?: object,
     *   providerId?: string,
     *   allowStubFallback?: boolean,
     *   useEdgeSync?: boolean,
     *   integrationOptions?: object,
     * }} [options]
     */
    constructor(options = {}) {
      /** @private @type {object|null} */
      this._integration = options.integration || null;
      /** @private */
      this._providerId = String(options.providerId || "stub").trim().toLowerCase();
      /** @private */
      this._allowStubFallback = options.allowStubFallback !== false;
      /** @private */
      this._useEdgeSync = options.useEdgeSync === true;
      /** @private @type {object} */
      this._integrationOptions = options.integrationOptions || {};
      /** @private */
      this._initialized = false;
    }

    /** @returns {string} */
    get surface() {
      return SURFACE;
    }

    /** P5-3 flag hook — default false until flag added */
    isEnabled() {
      return isPlatformLiveFlagEnabled();
    }

    /** @returns {boolean} */
    isIntegrationAvailable() {
      return Boolean(global.TasuLivePlatformIntegration);
    }

    /** @returns {object|null} */
    get integration() {
      return this._integration;
    }

    normalizeIds(input = {}) {
      return normalizeIds(input);
    }

    normalizeHostContext(input = {}) {
      return normalizeHostContext(input);
    }

    normalizeViewerContext(input = {}) {
      return normalizeViewerContext(input);
    }

    normalizeChatContext(input = {}) {
      return normalizeChatContext(input);
    }

    normalizeRecordingContext(input = {}) {
      return normalizeRecordingContext(input);
    }

    normalizeMonitoringContext(input = {}) {
      return normalizeMonitoringContext(input);
    }

    /**
     * @private
     * @param {{ skipFlagCheck?: boolean }} [options]
     */
    _gate(options = {}) {
      if (!options.skipFlagCheck && !isPlatformLiveFlagEnabled()) {
        return {
          ok: false,
          skipped: true,
          reason: CODE_DISABLED,
          code: CODE_DISABLED,
          surface: SURFACE,
        };
      }
      if (!global.TasuLivePlatformIntegration && !this._integration) {
        return {
          ok: false,
          error: "TasuLivePlatformIntegration が未ロードです",
          code: CODE_NOT_LOADED,
          surface: SURFACE,
        };
      }
      return { ok: true, surface: SURFACE };
    }

    /**
     * @private
     * @param {{ skipFlagCheck?: boolean, useEdgeSync?: boolean, providerId?: string }} [options]
     */
    _resolveIntegration(options = {}) {
      const gate = this._gate(options);
      if (!gate.ok) return { gate, integration: null };
      if (!this._integration) {
        const Integration = global.TasuLivePlatformIntegration;
        this._integration = new Integration({
          surface: SURFACE,
          providerId: options.providerId || this._providerId,
          allowStubFallback: this._allowStubFallback,
          useEdgeSync: options.useEdgeSync === true || this._useEdgeSync,
          ...this._integrationOptions,
        });
      }
      return { gate, integration: this._integration };
    }

    /**
     * @param {{ skipFlagCheck?: boolean, providerId?: string, useEdgeSync?: boolean }} [options]
     */
    async initialize(options = {}) {
      const { gate, integration } = this._resolveIntegration(options);
      if (!gate.ok) return gate;
      if (this._initialized) {
        return {
          ok: true,
          alreadyInitialized: true,
          surface: SURFACE,
          diagnostics: integration.getDiagnostics?.() || null,
        };
      }
      const res = await integration.initialize({
        surface: SURFACE,
        providerId: options.providerId || this._providerId,
        useEdgeSync: options.useEdgeSync === true || this._useEdgeSync,
        allowStubFallback: this._allowStubFallback,
      });
      this._initialized = res?.ok !== false;
      return {
        ...(res && typeof res === "object" ? res : { ok: true }),
        surface: SURFACE,
      };
    }

    /**
     * Host publish 入口（将来 bindStudioActions から）
     * @param {Record<string, unknown>} [options]
     */
    async startHost(options = {}) {
      const ctx = normalizeHostContext(options);
      if (!ctx.roomId || !ctx.userId) {
        return { ok: false, error: "roomId / userId が必要です", code: CODE_VALIDATION, surface: SURFACE };
      }
      const { gate, integration } = this._resolveIntegration(options);
      if (!gate.ok) return gate;
      if (!this._initialized) {
        const initRes = await this.initialize(options);
        if (initRes?.ok === false && !initRes.skipped) return initRes;
      }
      return integration.startPublish({
        surface: SURFACE,
        roomId: ctx.roomId,
        broadcastId: ctx.broadcastId,
        userId: ctx.userId,
        userName: ctx.userName,
        videoContainer: ctx.videoContainer,
        manualToken: ctx.manualToken,
        streamId: ctx.streamId,
      });
    }

    /**
     * Viewer join 入口（将来 mountWatchPage から）
     * @param {Record<string, unknown>} [options]
     */
    async joinViewer(options = {}) {
      const ctx = normalizeViewerContext(options);
      if (!ctx.roomId || !ctx.userId) {
        return { ok: false, error: "roomId / userId が必要です", code: CODE_VALIDATION, surface: SURFACE };
      }
      const { gate, integration } = this._resolveIntegration(options);
      if (!gate.ok) return gate;
      if (!this._initialized) {
        const initRes = await this.initialize(options);
        if (initRes?.ok === false && !initRes.skipped) return initRes;
      }
      return integration.joinLive({
        surface: SURFACE,
        roomId: ctx.roomId,
        broadcastId: ctx.broadcastId,
        userId: ctx.userId,
        userName: ctx.userName,
        videoContainer: ctx.videoContainer,
        manualToken: ctx.manualToken,
      });
    }

    /**
     * @param {Record<string, unknown>} [options]
     */
    async stopHost(options = {}) {
      const ctx = normalizeHostContext(options);
      const { gate, integration } = this._resolveIntegration(options);
      if (!gate.ok) return gate;
      if (!this._initialized) {
        return { ok: false, error: "initialize を先に呼んでください", code: CODE_NOT_LOADED, surface: SURFACE };
      }
      return integration.stopPublish({
        surface: SURFACE,
        broadcastId: ctx.broadcastId,
        reason: options.reason != null ? String(options.reason) : undefined,
      });
    }

    /**
     * @param {Record<string, unknown>} [options]
     */
    async leaveViewer(options = {}) {
      const ctx = normalizeViewerContext(options);
      const { gate, integration } = this._resolveIntegration(options);
      if (!gate.ok) return gate;
      if (!this._initialized) {
        return { ok: false, error: "initialize を先に呼んでください", code: CODE_NOT_LOADED, surface: SURFACE };
      }
      return integration.leaveLive({
        surface: SURFACE,
        userId: ctx.userId,
      });
    }

    /**
     * Chat 入口 — Platform Chat Gateway 経由（Supabase comments とは別経路）
     * @param {Record<string, unknown>} [options]
     */
    async sendChatMessage(options = {}) {
      const ctx = normalizeChatContext(options);
      if (!ctx.broadcastId || !ctx.userId || !ctx.text) {
        return {
          ok: false,
          error: "broadcastId / userId / text が必要です",
          code: CODE_VALIDATION,
          surface: SURFACE,
        };
      }
      const { gate, integration } = this._resolveIntegration(options);
      if (!gate.ok) return gate;
      if (!this._initialized) {
        const initRes = await this.initialize(options);
        if (initRes?.ok === false && !initRes.skipped) return initRes;
      }
      return integration.sendChatMessage({
        surface: SURFACE,
        broadcastId: ctx.broadcastId,
        userId: ctx.userId,
        text: ctx.text,
      });
    }

    /**
     * @param {Record<string, unknown>} [options]
     */
    async startRecording(options = {}) {
      const ctx = normalizeRecordingContext(options);
      const { gate, integration } = this._resolveIntegration(options);
      if (!gate.ok) return gate;
      if (!this._initialized) {
        const initRes = await this.initialize(options);
        if (initRes?.ok === false && !initRes.skipped) return initRes;
      }
      return integration.startRecording({
        surface: SURFACE,
        broadcastId: ctx.broadcastId,
        sessionId: ctx.sessionId,
        recordingId: ctx.recordingId,
      });
    }

    /**
     * @param {Record<string, unknown>} [options]
     */
    async getMonitoringHealth(options = {}) {
      const ctx = normalizeMonitoringContext(options);
      const { gate, integration } = this._resolveIntegration(options);
      if (!gate.ok) return gate;
      if (!this._initialized) {
        const initRes = await this.initialize(options);
        if (initRes?.ok === false && !initRes.skipped) return initRes;
      }
      return integration.getMonitoringHealth({ surface: SURFACE, ...ctx });
    }

    /** @returns {object} diagnostics snapshot（Integration 委譲 · token/secret 非露出） */
    getDiagnostics() {
      const base = {
        surface: SURFACE,
        enabled: this.isEnabled(),
        integrationAvailable: this.isIntegrationAvailable(),
        initialized: this._initialized,
        providerId: this._providerId,
      };
      if (this._integration?.getDiagnostics) {
        return { ...this._integration.getDiagnostics(), adapter: base };
      }
      return { adapter: base };
    }

    /** @param {{ skipFlagCheck?: boolean }} [options] */
    async dispose(options = {}) {
      const gate = this._gate(options);
      if (!gate.ok && !this._integration) return gate.ok === false ? gate : { ok: true, surface: SURFACE };
      if (this._integration?.dispose) {
        await this._integration.dispose();
      }
      this._integration = null;
      this._initialized = false;
      return { ok: true, surface: SURFACE };
    }
  }

  /**
   * @param {ConstructorParameters<typeof TlvPlatformLiveAdapter>[0]} [options]
   */
  function createTlvPlatformLiveAdapter(options = {}) {
    return new TlvPlatformLiveAdapter(options);
  }

  global.TlvPlatformLiveAdapter = TlvPlatformLiveAdapter;
  global.createTlvPlatformLiveAdapter = createTlvPlatformLiveAdapter;
  global.TlvPlatformLiveAdapterUtils = Object.freeze({
    SURFACE,
    CODE_DISABLED,
    CODE_NOT_LOADED,
    isPlatformLiveFlagEnabled,
    normalizeIds,
    normalizeHostContext,
    normalizeViewerContext,
    normalizeChatContext,
    normalizeRecordingContext,
    normalizeMonitoringContext,
  });
})(typeof window !== "undefined" ? window : globalThis);
