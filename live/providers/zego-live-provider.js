/**
 * ZEGO Live Provider — SDK 依存は本ファイル内に閉じ込める
 * 上位層へ ZegoExpressEngine / stream インスタンスを露出しない
 */
(function (global) {
  "use strict";

  const ZEGO_SDK_URL =
    "https://cdn.jsdelivr.net/npm/zego-express-engine-webrtc@3.12.0/ZegoExpressWebRTC.js";

  class ZegoLiveProvider {
    constructor() {
      /** @private */
      this._state = "idle";
      /** @private */
      this._engine = null;
      /** @private */
      this._roomId = "";
      /** @private */
      this._userId = "";
      /** @private */
      this._localStream = null;
      /** @private */
      this._publishStreamId = "";
      /** @private @type {Set<string>} */
      this._playingStreamIds = new Set();
      /** @private */
      this._videoContainer = null;
      /** @private */
      this._cameraEnabled = true;
      /** @private */
      this._micEnabled = true;
      /** @private */
      this._useFrontCamera = true;
      /** @private @type {Map<string, HTMLElement>} */
      this._remoteContainers = new Map();
    }

    get providerId() {
      return "zego";
    }

    get state() {
      return this._state;
    }

    /** @private */
    _log(message) {
      console.info("[TlvZegoLiveProvider]", message);
    }

    /** @private */
    async _loadSdk() {
      if (global.ZegoExpressEngine) return global.ZegoExpressEngine;
      await new Promise((resolve, reject) => {
        const existing = document.querySelector('script[data-tlv-zego-sdk="1"]');
        if (existing) {
          existing.addEventListener("load", () => resolve(undefined));
          existing.addEventListener("error", () => reject(new Error("ZEGO SDK load failed")));
          if (global.ZegoExpressEngine) resolve(undefined);
          return;
        }
        const script = document.createElement("script");
        script.src = ZEGO_SDK_URL;
        script.async = true;
        script.dataset.tlvZegoSdk = "1";
        script.onload = () => resolve(undefined);
        script.onerror = () => reject(new Error(`ZEGO SDK の読込に失敗: ${ZEGO_SDK_URL}`));
        document.head.appendChild(script);
      });
      if (!global.ZegoExpressEngine) {
        throw new Error("ZegoExpressEngine が見つかりません");
      }
      return global.ZegoExpressEngine;
    }

    /** @private */
    _ensureEngine() {
      if (!this._engine) throw new Error("Provider が initialize されていません");
    }

    /** @private */
    _defaultStreamId(roomId, userId) {
      return `${roomId}_${userId}_main`;
    }

    /** @private */
    _clearVideoContainer() {
      if (!this._videoContainer) return;
      this._videoContainer.innerHTML = "";
    }

    /** @private */
    _mountLocalPreview(mediaStream) {
      if (!this._videoContainer || !mediaStream) return;
      const video = document.createElement("video");
      video.className = "live-zego-poc__video live-zego-poc__video--local";
      video.autoplay = true;
      video.muted = true;
      video.playsInline = true;
      video.srcObject = mediaStream;
      this._videoContainer.appendChild(video);
    }

    /** @private */
    _mountRemotePlayer(streamId, player) {
      if (!this._videoContainer) return;
      let wrap = this._remoteContainers.get(streamId);
      if (!wrap) {
        wrap = document.createElement("div");
        wrap.className = "live-zego-poc__remote";
        wrap.dataset.streamId = streamId;
        const label = document.createElement("span");
        label.className = "live-zego-poc__remote-label";
        label.textContent = `視聴: ${streamId}`;
        wrap.appendChild(label);
        this._videoContainer.appendChild(wrap);
        this._remoteContainers.set(streamId, wrap);
      }
      if (player && typeof player === "object") {
        if (typeof this._engine.setPlayView === "function") {
          this._engine.setPlayView(streamId, wrap);
        } else if (player.tagName === "VIDEO") {
          wrap.appendChild(player);
        }
      }
    }

    /** @private */
    _bindRoomEvents() {
      this._ensureEngine();
      this._engine.on("roomStreamUpdate", async (roomId, updateType, streamList) => {
        if (roomId !== this._roomId) return;
        if (updateType !== "ADD") return;
        for (const item of streamList || []) {
          const streamId = String(item.streamID || item.streamId || "").trim();
          if (!streamId || streamId === this._publishStreamId) continue;
          if (this._playingStreamIds.has(streamId)) continue;
          try {
            const player = await this._engine.startPlayingStream(streamId);
            this._playingStreamIds.add(streamId);
            this._mountRemotePlayer(streamId, player);
            this._log(`playing stream ${streamId}`);
          } catch (err) {
            console.warn("[TlvZegoLiveProvider] startPlayingStream failed", streamId, err);
          }
        }
      });
    }

    /** @param {{ appId: number, server: string }} options */
    async initialize(options) {
      if (this._state === "disposed") {
        throw new Error("Provider は dispose 済みです");
      }
      this._state = "initializing";
      const appId = Number(options?.appId);
      const server = String(options?.server || "").trim();
      if (!appId || !server) {
        this._state = "error";
        throw new Error("appId と server が必要です（live-zego-config.js を確認）");
      }

      const ZegoExpressEngine = await this._loadSdk();
      if (this._engine) {
        try {
          this._engine.destroyEngine?.();
        } catch (_) {
          /* noop */
        }
      }
      this._engine = new ZegoExpressEngine(appId, server);
      this._bindRoomEvents();
      this._state = "ready";
      this._log("initialize OK");
      return { ok: true, state: this._state };
    }

    /** @param {{ roomId: string, userId: string, userName: string, token: string, videoContainer: HTMLElement, streamId?: string }} options */
    async startLive(options) {
      this._ensureEngine();
      const roomId = String(options.roomId || "").trim();
      const userId = String(options.userId || "").trim();
      const userName = String(options.userName || userId).trim();
      const token = String(options.token || "").trim();
      if (!roomId || !userId || !token) {
        return { ok: false, error: "roomId / userId / token が必要です" };
      }

      this._roomId = roomId;
      this._userId = userId;
      this._videoContainer = options.videoContainer;
      this._clearVideoContainer();
      this._publishStreamId = String(options.streamId || "").trim() || this._defaultStreamId(roomId, userId);

      const login = await this._engine.loginRoom(
        roomId,
        token,
        { userID: userId, userName },
        { userUpdate: true },
      );
      if (login === false) {
        this._state = "error";
        return { ok: false, error: "loginRoom に失敗しました" };
      }

      if (typeof this._engine.createZegoStream === "function") {
        this._localStream = await this._engine.createZegoStream({
          camera: { video: true, audio: true },
        });
      } else if (typeof this._engine.createStream === "function") {
        this._localStream = await this._engine.createStream({
          camera: { video: true, audio: true },
        });
      } else {
        this._state = "error";
        return { ok: false, error: "createStream API が見つかりません" };
      }

      const mediaStream = this._localStream?.getMediaStream?.() || this._localStream?.mediaStream;
      this._mountLocalPreview(mediaStream);

      await this._engine.startPublishingStream(this._publishStreamId, this._localStream);
      this._state = "live";
      this._log(`startLive room=${roomId} stream=${this._publishStreamId}`);
      return { ok: true, state: this._state };
    }

    /** @param {{ roomId: string, userId: string, userName: string, token: string, videoContainer: HTMLElement }} options */
    async joinLive(options) {
      this._ensureEngine();
      const roomId = String(options.roomId || "").trim();
      const userId = String(options.userId || "").trim();
      const userName = String(options.userName || userId).trim();
      const token = String(options.token || "").trim();
      if (!roomId || !userId || !token) {
        return { ok: false, error: "roomId / userId / token が必要です" };
      }

      this._roomId = roomId;
      this._userId = userId;
      this._videoContainer = options.videoContainer;
      this._clearVideoContainer();
      this._playingStreamIds.clear();
      this._remoteContainers.clear();

      const login = await this._engine.loginRoom(
        roomId,
        token,
        { userID: userId, userName },
        { userUpdate: true },
      );
      if (login === false) {
        this._state = "error";
        return { ok: false, error: "loginRoom に失敗しました" };
      }

      this._state = "watching";
      this._log(`joinLive room=${roomId}`);
      return { ok: true, state: this._state };
    }

    async leaveLive() {
      if (!this._engine) return { ok: true, state: this._state };
      try {
        for (const streamId of this._playingStreamIds) {
          try {
            await this._engine.stopPlayingStream(streamId);
          } catch (_) {
            /* noop */
          }
        }
        this._playingStreamIds.clear();
        if (this._roomId) {
          await this._engine.logoutRoom(this._roomId);
        }
      } catch (err) {
        console.warn("[TlvZegoLiveProvider] leaveLive", err);
      }
      this._localStream = null;
      this._publishStreamId = "";
      this._roomId = "";
      this._clearVideoContainer();
      this._state = "ready";
      return { ok: true, state: this._state };
    }

    async endLive() {
      if (!this._engine) return { ok: true, state: this._state };
      try {
        if (this._publishStreamId) {
          await this._engine.stopPublishingStream(this._publishStreamId);
        }
        if (this._localStream && typeof this._engine.destroyStream === "function") {
          await this._engine.destroyStream(this._localStream);
        }
        for (const streamId of this._playingStreamIds) {
          try {
            await this._engine.stopPlayingStream(streamId);
          } catch (_) {
            /* noop */
          }
        }
        if (this._roomId) {
          await this._engine.logoutRoom(this._roomId);
        }
      } catch (err) {
        console.warn("[TlvZegoLiveProvider] endLive", err);
      }
      this._localStream = null;
      this._publishStreamId = "";
      this._playingStreamIds.clear();
      this._roomId = "";
      this._clearVideoContainer();
      this._state = "ready";
      return { ok: true, state: this._state };
    }

    async toggleCamera() {
      this._ensureEngine();
      this._cameraEnabled = !this._cameraEnabled;
      if (typeof this._engine.enableCamera === "function") {
        await this._engine.enableCamera(this._cameraEnabled);
      } else if (this._localStream?.enableVideoCapture) {
        await this._localStream.enableVideoCapture(this._cameraEnabled);
      }
      return { ok: true, enabled: this._cameraEnabled };
    }

    async toggleMic() {
      this._ensureEngine();
      this._micEnabled = !this._micEnabled;
      if (typeof this._engine.muteMicrophone === "function") {
        await this._engine.muteMicrophone(!this._micEnabled);
      } else if (this._localStream?.enableAudioCapture) {
        await this._localStream.enableAudioCapture(this._micEnabled);
      }
      return { ok: true, enabled: this._micEnabled };
    }

    async switchCamera() {
      this._ensureEngine();
      this._useFrontCamera = !this._useFrontCamera;
      if (typeof this._engine.useFrontCamera === "function") {
        await this._engine.useFrontCamera(this._useFrontCamera);
      } else if (this._localStream?.useVideoDevice) {
        await this._localStream.useVideoDevice(this._useFrontCamera ? "front" : "back");
      }
      return { ok: true, front: this._useFrontCamera };
    }

    async dispose() {
      await this.endLive();
      try {
        this._engine?.destroyEngine?.();
      } catch (_) {
        /* noop */
      }
      this._engine = null;
      this._state = "disposed";
      return { ok: true, state: this._state };
    }

    async probeBasicBeauty() {
      this._ensureEngine();
      const engine = this._engine;
      const candidates = [
        "setEffectsBeauty",
        "setBeautyEffect",
        "enableBeautify",
        "setEffectsBeautyParam",
        "startEffectsBeauty",
      ];
      const available = candidates.filter((name) => typeof engine[name] === "function");
      if (available.length > 0) {
        return {
          supported: true,
          features: available,
          reason: "SDK API 検出 — PoC 時点で Basic Beauty 操作可能な可能性あり（ライセンス要確認）",
        };
      }
      return {
        supported: false,
        reason:
          "PoC 時点: 標準 Express CDN 一括ロードに Basic Beauty API 未検出。ESM beauty-effect モジュールまたは UIKit / AI Effects + ライセンス要確認",
        features: [],
      };
    }
  }

  global.TlvZegoLiveProvider = ZegoLiveProvider;
})(typeof window !== "undefined" ? window : globalThis);
