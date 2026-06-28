/**
 * TLV ↔ Platform Live 条件付きブリッジ（Phase 5 P5-3）
 *
 * usePlatformLive === true のときのみ Platform Live スクリプトを lazy load し Adapter を呼ぶ。
 * false / 未定義 · 未ロード時は no-op（既存 Supabase フロー維持）。
 */
(function (global) {
  "use strict";

  /** @returns {boolean} 未定義は false */
  function isEnabled() {
    return global.TLV_FEATURE_FLAGS?.usePlatformLive === true;
  }

  /** @type {object|null} */
  let _lastResult = null;
  /** @type {Promise<object>|null} */
  let _loadPromise = null;
  /** @type {object|null} */
  let _adapter = null;

  /** Platform Live stub 経路（ZEGO SDK 非必須） */
  const PLATFORM_LIVE_SCRIPTS = Object.freeze([
    "../platform-live/core/live-surfaces.js",
    "../platform-live/core/live-session-states.js",
    "../platform-live/core/live-session-events.js",
    "../platform-live/core/live-session-event-bus.js",
    "../platform-live/core/live-session-error-codes.js",
    "../platform-live/core/live-provider-signals.js",
    "../platform-live/core/live-session-validation.js",
    "../platform-live/core/live-session-manager.js",
    "../platform-live/core/live-provider-state-map.js",
    "../platform-live/core/live-platform-diagnostics.js",
    "../platform-live/core/live-platform-edge-sync.js",
    "../platform-live/core/live-platform-retry.js",
    "../platform-live/broadcast/live-broadcast-states.js",
    "../platform-live/broadcast/live-broadcast-events.js",
    "../platform-live/broadcast/live-broadcast-provider-signals.js",
    "../platform-live/broadcast/live-broadcast-error-codes.js",
    "../platform-live/broadcast/live-broadcast-validation.js",
    "../platform-live/broadcast/live-broadcast-service.js",
    "../platform-live/broadcast/live-broadcast-edge-client.js",
    "../platform-live/viewer/live-viewer-states.js",
    "../platform-live/viewer/live-viewer-events.js",
    "../platform-live/viewer/live-viewer-error-codes.js",
    "../platform-live/viewer/live-viewer-validation.js",
    "../platform-live/viewer/live-viewer-permission.js",
    "../platform-live/viewer/live-viewer-ccu-registry.js",
    "../platform-live/viewer/live-viewer-service.js",
    "../platform-live/viewer/live-viewer-edge-client.js",
    "../platform-live/chat/live-chat-message-states.js",
    "../platform-live/chat/live-chat-system-events.js",
    "../platform-live/chat/live-chat-events.js",
    "../platform-live/chat/live-chat-error-codes.js",
    "../platform-live/chat/live-chat-validation.js",
    "../platform-live/chat/live-chat-moderation-hook.js",
    "../platform-live/chat/live-chat-rate-limit-hook.js",
    "../platform-live/chat/live-chat-gateway.js",
    "../platform-live/chat/live-chat-edge-client.js",
    "../platform-live/recording/live-recording-states.js",
    "../platform-live/recording/live-recording-events.js",
    "../platform-live/recording/live-recording-error-codes.js",
    "../platform-live/recording/live-recording-validation.js",
    "../platform-live/recording/live-recording-service.js",
    "../platform-live/recording/live-recording-edge-client.js",
    "../platform-live/monitoring/live-monitoring-states.js",
    "../platform-live/monitoring/live-monitoring-events.js",
    "../platform-live/monitoring/live-monitoring-error-codes.js",
    "../platform-live/monitoring/live-monitoring-validation.js",
    "../platform-live/monitoring/live-monitoring-metrics-store.js",
    "../platform-live/monitoring/live-monitoring-smoke-runner.js",
    "../platform-live/monitoring/live-monitoring-service.js",
    "../platform-live/monitoring/live-monitoring-edge-client.js",
    "../platform-live/provider/zego-platform-error-map.js",
    "../platform-live/provider/live-provider-types.js",
    "../platform-live/provider/live-provider-interface.js",
    "../platform-live/provider/stub-live-provider.js",
    "../platform-live/provider/create-platform-live-provider.js",
    "../platform-live/core/live-platform-integration.js",
    "tlv-platform-live-adapter.js",
  ]);

  /** @private @param {object} result */
  function _recordResult(result) {
    _lastResult = {
      ...(result && typeof result === "object" ? result : { ok: false, error: String(result) }),
      at: new Date().toISOString(),
    };
    return _lastResult;
  }

  /** @private @param {string} src */
  function _loadScript(src) {
    return new Promise((resolve, reject) => {
      const doc = global.document;
      if (!doc?.createElement) {
        reject(new Error("document が利用できません"));
        return;
      }
      const absolute = new URL(src, global.location?.href || "http://127.0.0.1:8788/live/studio.html").href;
      const existing = doc.querySelector(`script[data-tlv-platform-live="${absolute}"]`);
      if (existing) {
        resolve();
        return;
      }
      const el = doc.createElement("script");
      el.src = src;
      el.defer = true;
      el.setAttribute("data-tlv-platform-live", absolute);
      el.onload = () => resolve();
      el.onerror = () => reject(new Error(`script load failed: ${src}`));
      doc.head.appendChild(el);
    });
  }

  /** @returns {Promise<{ ok: boolean, error?: string }>} */
  async function ensurePlatformLiveLoaded() {
    if (global.TasuLivePlatformIntegration && global.TlvPlatformLiveAdapter) {
      return { ok: true };
    }
    if (_loadPromise) return _loadPromise;

    _loadPromise = (async () => {
      for (const src of PLATFORM_LIVE_SCRIPTS) {
        await _loadScript(src);
      }
      if (!global.TasuLivePlatformIntegration || !global.TlvPlatformLiveAdapter) {
        throw new Error("Platform Live Integration / Adapter のロードに失敗しました");
      }
      return { ok: true };
    })().catch((err) => {
      _loadPromise = null;
      return { ok: false, error: err?.message || String(err) };
    });

    return _loadPromise;
  }

  /** @returns {Promise<object|null>} */
  async function _getAdapter() {
    const loaded = await ensurePlatformLiveLoaded();
    if (!loaded.ok) {
      _recordResult({ ok: false, error: loaded.error, code: "PLATFORM_LIVE_LOAD_FAILED" });
      return null;
    }
    if (!_adapter) {
      _adapter = new global.TlvPlatformLiveAdapter({
        providerId: "stub",
        allowStubFallback: true,
      });
    }
    return _adapter;
  }

  /** @returns {object|null} */
  function getLastResult() {
    return _lastResult ? { ..._lastResult } : null;
  }

  /** @returns {object} */
  function getDiagnostics() {
    const adapterDiag = _adapter?.getDiagnostics?.() || null;
    return {
      enabled: isEnabled(),
      integrationLoaded: Boolean(global.TasuLivePlatformIntegration),
      adapterReady: Boolean(_adapter),
      lastResult: getLastResult(),
      adapterDiagnostics: adapterDiag,
    };
  }

  /** @param {object} [payload] */
  async function onStudioStart(payload = {}) {
    if (!isEnabled()) {
      return _recordResult({ ok: true, skipped: true, reason: "usePlatformLive_disabled" });
    }
    try {
      const adapter = await _getAdapter();
      if (!adapter) {
        return _recordResult({ ok: false, partial: true, error: "adapter unavailable" });
      }
      const res = await adapter.startHost({
        broadcastId: payload.broadcastId,
        liveId: payload.broadcastId,
        creatorId: payload.creatorId,
        userId: payload.creatorId,
        userName: payload.creatorName,
        videoContainer: payload.videoContainer || null,
      });
      return _recordResult({ ...res, via: "platform-live", op: "startHost" });
    } catch (err) {
      console.warn("[TlvPlatformLiveBridge] onStudioStart:", err);
      return _recordResult({ ok: false, partial: true, error: err?.message || String(err), op: "startHost" });
    }
  }

  /** @param {object} [payload] */
  async function onStudioEnd(payload = {}) {
    if (!isEnabled()) {
      return _recordResult({ ok: true, skipped: true, reason: "usePlatformLive_disabled" });
    }
    try {
      const adapter = await _getAdapter();
      if (!adapter) {
        return _recordResult({ ok: false, partial: true, error: "adapter unavailable" });
      }
      const res = await adapter.stopHost({
        broadcastId: payload.broadcastId,
        reason: payload.reason || "studio:end",
      });
      return _recordResult({ ...res, via: "platform-live", op: "stopHost" });
    } catch (err) {
      console.warn("[TlvPlatformLiveBridge] onStudioEnd:", err);
      return _recordResult({ ok: false, partial: true, error: err?.message || String(err), op: "stopHost" });
    }
  }

  /** @param {object} [payload] */
  async function onWatchJoin(payload = {}) {
    if (!isEnabled()) {
      return _recordResult({ ok: true, skipped: true, reason: "usePlatformLive_disabled" });
    }
    const viewerId = String(payload.viewerId || payload.userId || "").trim();
    if (!viewerId) {
      return _recordResult({ ok: false, partial: true, error: "viewerId が必要です", op: "joinViewer" });
    }
    try {
      const adapter = await _getAdapter();
      if (!adapter) {
        return _recordResult({ ok: false, partial: true, error: "adapter unavailable" });
      }
      const res = await adapter.joinViewer({
        broadcastId: payload.broadcastId,
        liveId: payload.broadcastId,
        userId: viewerId,
        userName: payload.viewerName,
        videoContainer: payload.videoContainer || null,
      });
      return _recordResult({ ...res, via: "platform-live", op: "joinViewer" });
    } catch (err) {
      console.warn("[TlvPlatformLiveBridge] onWatchJoin:", err);
      return _recordResult({ ok: false, partial: true, error: err?.message || String(err), op: "joinViewer" });
    }
  }

  /** @param {object} [payload] */
  async function onWatchLeave(payload = {}) {
    if (!isEnabled()) {
      return _recordResult({ ok: true, skipped: true, reason: "usePlatformLive_disabled" });
    }
    const viewerId = String(payload.viewerId || payload.userId || "").trim();
    if (!viewerId) {
      return _recordResult({ ok: true, skipped: true, reason: "no_viewer" });
    }
    try {
      const adapter = await _getAdapter();
      if (!adapter) {
        return _recordResult({ ok: false, partial: true, error: "adapter unavailable" });
      }
      const res = await adapter.leaveViewer({ userId: viewerId, broadcastId: payload.broadcastId });
      return _recordResult({ ...res, via: "platform-live", op: "leaveViewer" });
    } catch (err) {
      console.warn("[TlvPlatformLiveBridge] onWatchLeave:", err);
      return _recordResult({ ok: false, partial: true, error: err?.message || String(err), op: "leaveViewer" });
    }
  }

  global.TlvPlatformLiveBridge = {
    isEnabled,
    ensurePlatformLiveLoaded,
    getLastResult,
    getDiagnostics,
    onStudioStart,
    onStudioEnd,
    onWatchJoin,
    onWatchLeave,
  };
})(typeof window !== "undefined" ? window : globalThis);
