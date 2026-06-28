/**
 * Live Platform — Provider 抽象境界
 * Phase A · UI / Service 層は本 Interface のみ参照（SDK 型を漏らさない）
 */
(function (global) {
  "use strict";

  const PROVIDER_IDS = global.TasuLivePlatformProviderTypes?.LIVE_PROVIDER_IDS || {
    STUB: "stub",
    ZEGO: "zego",
  };

  class PlatformLiveProviderInterface {
    /** @returns {string} */
    get providerId() {
      throw new Error("PlatformLiveProviderInterface: providerId not implemented");
    }

    /** @returns {string} */
    get state() {
      return "idle";
    }

    /** @param {import('./live-provider-types.js').LiveProviderInitOptions} _options */
    async initialize(_options) {
      throw new Error("PlatformLiveProviderInterface: initialize not implemented");
    }

    /** @param {import('./live-provider-types.js').LiveSessionOptions} _options */
    async startLive(_options) {
      throw new Error("PlatformLiveProviderInterface: startLive not implemented");
    }

    /** @param {import('./live-provider-types.js').LiveSessionOptions} _options */
    async joinLive(_options) {
      throw new Error("PlatformLiveProviderInterface: joinLive not implemented");
    }

    async leaveLive() {
      throw new Error("PlatformLiveProviderInterface: leaveLive not implemented");
    }

    async endLive() {
      throw new Error("PlatformLiveProviderInterface: endLive not implemented");
    }

    async reconnectLive() {
      throw new Error("PlatformLiveProviderInterface: reconnectLive not implemented");
    }

    /** @param {{ broadcastId: string, roomId: string, surface: string, userId?: string }} _options */
    async startBroadcast(_options) {
      throw new Error("PlatformLiveProviderInterface: startBroadcast not implemented");
    }

    /** @param {{ broadcastId: string, roomId: string, surface: string, reason?: string }} _options */
    async stopBroadcast(_options) {
      throw new Error("PlatformLiveProviderInterface: stopBroadcast not implemented");
    }

    /** @param {{ broadcastId: string, roomId: string, surface: string }} _options */
    async getBroadcastHealth(_options) {
      throw new Error("PlatformLiveProviderInterface: getBroadcastHealth not implemented");
    }

    /** @param {{ broadcastId: string, roomId: string, surface: string, count: number }} _options */
    async updateViewerCount(_options) {
      throw new Error("PlatformLiveProviderInterface: updateBroadcastViewerCount not implemented");
    }

    /** @param {{ surface: string, broadcastId: string, userId: string, roomId?: string }} _options */
    async joinViewer(_options) {
      throw new Error("PlatformLiveProviderInterface: joinViewer not implemented");
    }

    /** @param {{ surface: string, broadcastId: string, userId: string }} _options */
    async leaveViewer(_options) {
      throw new Error("PlatformLiveProviderInterface: leaveViewer not implemented");
    }

    /** @param {{ surface: string, broadcastId: string, userId: string }} _options */
    async reconnectViewer(_options) {
      throw new Error("PlatformLiveProviderInterface: reconnectViewer not implemented");
    }

    /** @param {{ surface: string, broadcastId: string, userId: string }} _options */
    async viewerHeartbeat(_options) {
      throw new Error("PlatformLiveProviderInterface: viewerHeartbeat not implemented");
    }

    /** @param {{ surface: string, broadcastId: string, userId: string, messageId: string, text: string }} _options */
    async sendChatMessage(_options) {
      throw new Error("PlatformLiveProviderInterface: sendChatMessage not implemented");
    }

    /** @param {{ surface: string, broadcastId: string, userId: string, messageId: string, reaction: string }} _options */
    async addChatReaction(_options) {
      throw new Error("PlatformLiveProviderInterface: addChatReaction not implemented");
    }

    /** @param {{ surface: string, broadcastId: string, userId: string, messageId: string, reaction: string }} _options */
    async removeChatReaction(_options) {
      throw new Error("PlatformLiveProviderInterface: removeChatReaction not implemented");
    }

    /** @param {{ surface: string, broadcastId: string, type: string, payload?: object }} _options */
    async emitChatSystemEvent(_options) {
      throw new Error("PlatformLiveProviderInterface: emitChatSystemEvent not implemented");
    }

    /** @param {{ surface: string, broadcastId: string, sessionId?: string, recordingId: string, roomId?: string }} _options */
    async startRecording(_options) {
      throw new Error("PlatformLiveProviderInterface: startRecording not implemented");
    }

    /** @param {{ surface: string, broadcastId: string, recordingId: string, storageKey?: string }} _options */
    async stopRecording(_options) {
      throw new Error("PlatformLiveProviderInterface: stopRecording not implemented");
    }

    /** @param {{ surface: string, recordingId: string }} _options */
    getRecordingStatus(_options) {
      throw new Error("PlatformLiveProviderInterface: getRecordingStatus not implemented");
    }

    /** @param {{ surface: string, recordingId: string, storageKey?: string }} _options */
    async getArchiveMetadata(_options) {
      throw new Error("PlatformLiveProviderInterface: getArchiveMetadata not implemented");
    }

    /** @param {{ surface: string }} _options */
    async getMonitoringProbe(_options) {
      throw new Error("PlatformLiveProviderInterface: getMonitoringProbe not implemented");
    }

    async dispose() {
      throw new Error("PlatformLiveProviderInterface: dispose not implemented");
    }

    /**
     * Provider → Session Manager signal コールバック登録
     * @param {(signal: string, payload?: object) => void} handler
     */
    onSignal(handler) {
      this._signalHandler = typeof handler === "function" ? handler : null;
    }

    /**
     * Provider → Broadcast Service signal コールバック登録
     * @param {(signal: string, payload?: object) => void} handler
     */
    onBroadcastSignal(handler) {
      this._broadcastSignalHandler = typeof handler === "function" ? handler : null;
    }

    /** @protected */
    _emitSignal(signal, payload = {}) {
      if (typeof this._signalHandler === "function") {
        this._signalHandler(signal, payload);
      }
    }

    /** @protected */
    _emitBroadcastSignal(signal, payload = {}) {
      if (typeof this._broadcastSignalHandler === "function") {
        this._broadcastSignalHandler(signal, payload);
      }
    }
  }

  global.PlatformLiveProviderInterface = PlatformLiveProviderInterface;
  global.PLATFORM_LIVE_PROVIDER_IDS = PROVIDER_IDS;
})(typeof window !== "undefined" ? window : globalThis);
