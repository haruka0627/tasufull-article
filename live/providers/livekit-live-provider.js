/**
 * TLV LiveKit Cloud Formal provider — PRIMARY publish/subscribe (AD-039).
 * Publishes Formal compositedStream / Formal audio only.
 * NEVER calls getUserMedia / createStream({camera}).
 * ZEGO kept as FALLBACK elsewhere — this file does not delete or dual-publish ZEGO.
 */
(function (global) {
  "use strict";

  var DEFAULT_SDK =
    "https://cdn.jsdelivr.net/npm/livekit-client@2.15.8/dist/livekit-client.umd.min.js";
  var SDK_VERSION = "2.15.8";

  function cfg() {
    var c = global.__TLV_LIVEKIT_POC__ || global.__TLV_LIVEKIT__;
    return c && typeof c === "object" ? c : {};
  }

  class LiveKitLiveProvider {
    constructor() {
      this._state = "idle";
      this._room = null;
      this._url = "";
      this._roomName = "";
      this._identity = "";
      this._role = "viewer";
      this._videoPub = null;
      this._audioPub = null;
      this._videoTrack = null;
      this._audioTrack = null;
      this._publishStream = null;
      this._videoContainer = null;
      this._remoteEl = null;
      this._sdk = null;
      this._listeners = [];
      this._lastError = null;
      this._statsSnapshot = null;
      this._cycleCount = 0;
      /** @type {Map<string, HTMLMediaElement>} */
      this._remoteAudioEls = new Map();
      /** Viewer UI mute preference (autoplay-safe default: muted until Human unmute). */
      this._remoteAudioMutedPreferred = true;
      /** Formal reconnect V1 */
      this._intentionalStop = false;
      this._sessionAlive = false;
      this._token = "";
      this._tokenExpiresAt = 0;
      this._simulcast = true;
      this._reconnectCount = 0;
      this._reconnectStartedAt = 0;
      this._lastReconnectDurationMs = null;
      this._connectionQuality = null;
      this._cameraReacquire = 0;
      this._audioDuplicatePublish = 0;
      this._softRejoinInFlight = false;
      /** @type {null|((reason: string) => Promise<{url?: string, token?: string, identity?: string}|null>)} */
      this._tokenRefreshHook = null;
      /** @type {null|((evt: object) => void)} */
      this._reconnectHook = null;
    }

    get providerId() {
      return "livekit";
    }

    get state() {
      return this._state;
    }

    get sdkPackage() {
      return "livekit-client";
    }

    get sdkVersion() {
      return String(cfg().sdkVersionPinned || SDK_VERSION);
    }

    _log(msg) {
      console.info("[TlvLiveKitFormal]", msg);
    }

    async initialize() {
      await this._loadSdk();
      this._state = "ready";
      return { ok: true, state: this._state };
    }

    async _loadSdk() {
      if (global.LivekitClient && global.LivekitClient.Room) {
        this._sdk = global.LivekitClient;
        return this._sdk;
      }
      var src = String(cfg().sdkCdn || DEFAULT_SDK);
      await new Promise(function (resolve, reject) {
        var existing = document.querySelector('script[data-tlv-livekit-sdk="1"]');
        if (existing) {
          existing.addEventListener("load", function () {
            resolve(undefined);
          });
          existing.addEventListener("error", function () {
            reject(new Error("LiveKit SDK load failed"));
          });
          if (global.LivekitClient && global.LivekitClient.Room) resolve(undefined);
          return;
        }
        var script = document.createElement("script");
        script.src = src;
        script.async = true;
        script.dataset.tlvLivekitSdk = "1";
        script.onload = function () {
          resolve(undefined);
        };
        script.onerror = function () {
          reject(new Error("LiveKit SDK load failed: " + src));
        };
        document.head.appendChild(script);
      });
      if (!global.LivekitClient || !global.LivekitClient.Room) {
        throw new Error("LivekitClient.Room missing after SDK load");
      }
      this._sdk = global.LivekitClient;
      return this._sdk;
    }

    /**
     * @param {{ tokenPath?: string, roomName: string, role: "broadcaster"|"viewer", bearerToken: string, ttlSec?: number }} opts
     */
    async fetchAccessToken(opts) {
      var path = String(opts.tokenPath || cfg().tokenPath || "/api/tlv-livekit-token");
      var res = await fetch(path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + opts.bearerToken,
        },
        body: JSON.stringify({
          roomName: opts.roomName,
          role: opts.role,
          ttlSec: opts.ttlSec || 900,
        }),
      });
      var data = null;
      try {
        data = await res.json();
      } catch (_) {
        data = null;
      }
      if (!res.ok) {
        var code = (data && (data.code || data.error)) || "http_" + res.status;
        var err = new Error(String(code));
        err.code = code;
        err.status = res.status;
        err.detail = (data && data.detail) || "";
        throw err;
      }
      if (!data || !data.token || !data.url) {
        var inv = new Error("token_response_invalid");
        inv.code = "token_response_invalid";
        throw inv;
      }
      return data;
    }

    _ensureStyles() {
      if (document.getElementById("tlv-livekit-formal-css")) return;
      var style = document.createElement("style");
      style.id = "tlv-livekit-formal-css";
      style.textContent =
        ".tlv-livekit-formal__video{position:relative;z-index:1;width:100%;height:100%;object-fit:contain;background:#000;display:block}" +
        // display:none can pause media in some browsers — keep off-screen but playable.
        ".tlv-livekit-formal__audio{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;left:0;top:0}" +
        "[data-tlv-livekit-formal-mount]{position:relative;z-index:1;width:100%;height:100%;min-height:12rem;background:#000}";
      document.head.appendChild(style);
    }

    _clearContainer() {
      if (this._videoContainer) this._videoContainer.innerHTML = "";
      this._remoteEl = null;
      this._remoteAudioEls = new Map();
    }

    _mountLocal(stream) {
      if (!this._videoContainer || !stream) return;
      this._ensureStyles();
      var video = document.createElement("video");
      video.className = "tlv-livekit-formal__video tlv-livekit-formal__video--local";
      video.autoplay = true;
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;
      this._videoContainer.appendChild(video);
    }

    _attachRemoteTrack(track) {
      if (!this._videoContainer || !track) return;
      // Detached / 1px probe containers must not receive Formal A/V (audio can still play from hidden DOM).
      try {
        if (!this._videoContainer.isConnected) return;
        var rect = this._videoContainer.getBoundingClientRect && this._videoContainer.getBoundingClientRect();
        if (rect && rect.width > 0 && rect.width < 2 && rect.height > 0 && rect.height < 2) return;
      } catch (_) {}
      this._ensureStyles();
      if (track.kind === "video") {
        var el = this._remoteEl;
        if (!el || !el.isConnected || !this._videoContainer.contains(el)) {
          el = document.createElement("video");
          el.className = "tlv-livekit-formal__video tlv-livekit-formal__video--remote";
          el.autoplay = true;
          el.playsInline = true;
          // Audio is on a separate <audio> element — keep video muted for autoplay policy.
          el.muted = true;
          el.setAttribute("muted", "");
          el.setAttribute("playsinline", "");
          el.setAttribute("webkit-playsinline", "");
          el.setAttribute("data-live-watch-video", "");
          this._videoContainer.appendChild(el);
          this._remoteEl = el;
          // Do not detach() before first attach — detach can leave a live pub with no sink (0×0 black).
          track.attach(el);
        } else {
          // Same visible element (layout relocate) — attach is idempotent; avoid detach flicker.
          track.attach(el);
        }
        try {
          var p = el.play();
          if (p && typeof p.catch === "function") p.catch(function () {});
        } catch (_) {}
      } else if (track.kind === "audio") {
        var sid = String(track.sid || (track.mediaStreamTrack && track.mediaStreamTrack.id) || "");
        var existing = sid ? this._remoteAudioEls.get(sid) : null;
        if (existing && existing.isConnected && this._videoContainer.contains(existing)) {
          track.attach(existing);
          existing.muted = Boolean(this._remoteAudioMutedPreferred);
          try {
            var ap0 = existing.play();
            if (ap0 && typeof ap0.catch === "function") ap0.catch(function () {});
          } catch (_) {}
          return;
        }
        if (sid && existing && !existing.isConnected) this._remoteAudioEls.delete(sid);
        try {
          if (typeof track.detach === "function") track.detach();
        } catch (_) {}
        var audio = track.attach();
        audio.className = "tlv-livekit-formal__audio";
        audio.autoplay = true;
        audio.muted = Boolean(this._remoteAudioMutedPreferred);
        audio.dataset.tlvLivekitTrackSid = sid;
        this._videoContainer.appendChild(audio);
        if (sid) this._remoteAudioEls.set(sid, audio);
        try {
          var ap = audio.play();
          if (ap && typeof ap.catch === "function") ap.catch(function () {});
        } catch (_) {}
      }
    }

    /**
     * After Vertical↔Landscape DOM remount: point provider at the rescued Formal mount
     * and re-attach remote tracks without room reconnect / getUserMedia.
     */
    relocateVideoContainer(container) {
      if (!container) return { ok: false, code: "no_container" };
      this._ensureStyles();
      var sameContainer = this._videoContainer === container;
      var videoOk =
        this._remoteEl &&
        this._remoteEl.isConnected &&
        container.contains(this._remoteEl) &&
        this._remoteEl.readyState >= 2;
      if (sameContainer && videoOk) {
        try {
          var p0 = this._remoteEl.play();
          if (p0 && typeof p0.catch === "function") p0.catch(function () {});
        } catch (_) {}
        return {
          ok: true,
          skipped: true,
          hasRemoteVideo: true,
          remoteAudioCount: this._remoteAudioEls.size,
          videoWidth: this._remoteEl.videoWidth,
          videoHeight: this._remoteEl.videoHeight,
        };
      }
      this._videoContainer = container;
      if (this._remoteEl && !this._remoteEl.isConnected) this._remoteEl = null;
      // Prefer existing <video> already inside rescued mount (avoid recreating sink).
      if (!this._remoteEl) {
        this._remoteEl = container.querySelector("video.tlv-livekit-formal__video--remote") || container.querySelector("video");
      }
      var self = this;
      this._remoteAudioEls.forEach(function (el, sid) {
        if (!el || !el.isConnected) self._remoteAudioEls.delete(sid);
      });
      this._reattachRemoteTracks();
      if (this._remoteEl) {
        try {
          this._remoteEl.style.width = "100%";
          this._remoteEl.style.height = "100%";
          var p = this._remoteEl.play();
          if (p && typeof p.catch === "function") p.catch(function () {});
        } catch (_) {}
      }
      this._log("viewer relocated container connected=" + Boolean(container.isConnected));
      return {
        ok: true,
        hasRemoteVideo: Boolean(this._remoteEl),
        remoteAudioCount: this._remoteAudioEls.size,
        videoWidth: this._remoteEl ? this._remoteEl.videoWidth : 0,
        videoHeight: this._remoteEl ? this._remoteEl.videoHeight : 0,
      };
    }

    setRemoteAudioMuted(muted) {
      var on = Boolean(muted);
      this._remoteAudioMutedPreferred = on;
      this._remoteAudioEls.forEach(function (el) {
        try {
          el.muted = on;
          if (!on) {
            var ap = el.play();
            if (ap && typeof ap.catch === "function") ap.catch(function () {});
          }
        } catch (_) {}
      });
      if (this._videoContainer) {
        this._videoContainer.querySelectorAll("audio.tlv-livekit-formal__audio").forEach(function (el) {
          el.muted = on;
          if (!on) {
            try {
              var ap2 = el.play();
              if (ap2 && typeof ap2.catch === "function") ap2.catch(function () {});
            } catch (_) {}
          }
        });
      }
    }

    /**
     * Prefer LiveKit native reconnect. Do not rebuild Room on Reconnecting.
     * Root cause (Migration V1 FAIL): only Disconnected was handled; page leave
     * default + no Reconnected track recovery → Formal publications dropped.
     */
    _bindRoomEvents(room) {
      var self = this;
      var RoomEvent = this._sdk.RoomEvent;

      var onSubscribed = function (track, _pub, participant) {
        if (participant && participant.isLocal) return;
        self._attachRemoteTrack(track);
      };

      // replaceFormalVideo may not re-fire TrackSubscribed — re-attach only when sink is missing.
      var onPubRefresh = function (pub, participant) {
        if (participant && participant.isLocal) return;
        if (!pub || !pub.track) return;
        var kind = pub.track.kind;
        if (kind === "video") {
          if (self._remoteEl && self._remoteEl.isConnected && self._videoContainer && self._videoContainer.contains(self._remoteEl)) {
            try {
              pub.track.attach(self._remoteEl);
            } catch (_) {}
            return;
          }
        }
        self._attachRemoteTrack(pub.track);
      };

      var onReconnecting = function () {
        if (self._intentionalStop) return;
        if (!self._reconnectStartedAt) self._reconnectStartedAt = Date.now();
        self._state = "reconnecting";
        self._reconnectCount += 1;
        self._log("native reconnecting #" + self._reconnectCount);
        self._emitReconnect({ phase: "reconnecting", native: true });
      };

      var onReconnected = function () {
        if (self._intentionalStop) return;
        if (self._reconnectStartedAt) {
          self._lastReconnectDurationMs = Date.now() - self._reconnectStartedAt;
          self._reconnectStartedAt = 0;
        }
        self._state = self._role === "broadcaster" ? "live" : "watching";
        self._log("native reconnected durationMs=" + self._lastReconnectDurationMs);
        self._emitReconnect({
          phase: "reconnected",
          native: true,
          durationMs: self._lastReconnectDurationMs,
        });
        void self._recoverAfterReconnect("native_reconnected");
      };

      var onDisconnected = function (reason) {
        self._state = "disconnected";
        self._log("room disconnected reason=" + String(reason || ""));
        self._emitReconnect({ phase: "disconnected", reason: String(reason || "") });
        if (self._intentionalStop || !self._sessionAlive) return;
        // Full drop after SDK gave up — soft rejoin same room (no new broadcast)
        void self._softRejoin("disconnected");
      };

      var onQuality = function (quality, participant) {
        if (participant && participant.isLocal) {
          self._connectionQuality = quality;
        }
      };

      room.on(RoomEvent.TrackSubscribed, onSubscribed);
      if (RoomEvent.TrackMuted) room.on(RoomEvent.TrackMuted, onPubRefresh);
      if (RoomEvent.TrackUnmuted) room.on(RoomEvent.TrackUnmuted, onPubRefresh);
      if (RoomEvent.TrackStreamStateChanged) {
        room.on(RoomEvent.TrackStreamStateChanged, function onStreamState(_track, state, participant) {
          if (participant && participant.isLocal) return;
          // Only recover when stream is active again and sink is missing/paused — avoid flicker loops.
          if (state && String(state).toLowerCase() === "paused") return;
          if (
            self._remoteEl &&
            self._remoteEl.isConnected &&
            self._videoContainer &&
            self._videoContainer.contains(self._remoteEl) &&
            !self._remoteEl.paused &&
            self._remoteEl.readyState >= 2
          ) {
            return;
          }
          self._reattachRemoteTracks();
        });
      }
      if (RoomEvent.Reconnecting) room.on(RoomEvent.Reconnecting, onReconnecting);
      if (RoomEvent.Reconnected) room.on(RoomEvent.Reconnected, onReconnected);
      room.on(RoomEvent.Disconnected, onDisconnected);
      if (RoomEvent.ConnectionQualityChanged) {
        room.on(RoomEvent.ConnectionQualityChanged, onQuality);
      }

      this._listeners.push(function () {
        room.off(RoomEvent.TrackSubscribed, onSubscribed);
        if (RoomEvent.TrackMuted) room.off(RoomEvent.TrackMuted, onPubRefresh);
        if (RoomEvent.TrackUnmuted) room.off(RoomEvent.TrackUnmuted, onPubRefresh);
        if (RoomEvent.Reconnecting) room.off(RoomEvent.Reconnecting, onReconnecting);
        if (RoomEvent.Reconnected) room.off(RoomEvent.Reconnected, onReconnected);
        room.off(RoomEvent.Disconnected, onDisconnected);
        if (RoomEvent.ConnectionQualityChanged) {
          room.off(RoomEvent.ConnectionQualityChanged, onQuality);
        }
      });
    }

    setTokenRefreshHook(fn) {
      this._tokenRefreshHook = typeof fn === "function" ? fn : null;
    }

    setReconnectHook(fn) {
      this._reconnectHook = typeof fn === "function" ? fn : null;
    }

    _emitReconnect(evt) {
      try {
        if (this._reconnectHook) this._reconnectHook(Object.assign({ role: this._role }, evt || {}));
      } catch (_) {}
    }

    _trackLive(track) {
      return Boolean(track && track.readyState === "live");
    }

    _currentFormalStream() {
      return this._publishStream || null;
    }

    /**
     * After native reconnect / soft rejoin: keep Formal track refs.
     * Only replaceTrack / republish if publication missing. Never getUserMedia.
     */
    async _recoverAfterReconnect(reason) {
      if (this._intentionalStop || !this._sessionAlive) return { ok: false, code: "session_ended" };
      if (this._role === "viewer") {
        this._reattachRemoteTracks();
        return { ok: true, role: "viewer", reason: reason };
      }
      if (this._role !== "broadcaster" || !this._room) {
        return { ok: false, code: "not_broadcasting" };
      }

      var stream = this._currentFormalStream();
      if (!stream) {
        try {
          stream =
            (global.TasuOneTlvGoLiveService &&
              global.TasuOneTlvGoLiveService.attachFormalPublishInput &&
              global.TasuOneTlvGoLiveService.attachFormalPublishInput().publishStream) ||
            (global.TasuOneTlvGoLiveMedia && global.TasuOneTlvGoLiveMedia.getPublishStream && global.TasuOneTlvGoLiveMedia.getPublishStream()) ||
            null;
        } catch (_) {
          stream = null;
        }
      }
      if (!stream) return { ok: false, code: "no_formal_stream", reason: reason };

      var formal = this._extractFormalTracks(stream);
      this._publishStream = stream;
      var Track = this._sdk.Track;
      var local = this._room.localParticipant;

      // Video: prefer replaceTrack on existing publication
      if (this._videoPub && this._videoPub.track && typeof this._videoPub.track.replaceTrack === "function") {
        if (!this._trackLive(this._videoTrack) || this._videoTrack !== formal.video) {
          await this._videoPub.track.replaceTrack(formal.video);
          this._videoTrack = formal.video;
        }
      } else if (!this._videoPub) {
        this._videoTrack = formal.video;
        this._videoPub = await local.publishTrack(formal.video, {
          name: "tlv-formal-composited",
          source: Track.Source.Camera,
          simulcast: this._simulcast !== false,
        });
      }

      if (formal.audio) {
        if (this._audioPub && this._audioPub.track && typeof this._audioPub.track.replaceTrack === "function") {
          if (!this._trackLive(this._audioTrack) || this._audioTrack !== formal.audio) {
            await this._audioPub.track.replaceTrack(formal.audio);
            this._audioTrack = formal.audio;
          }
        } else if (!this._audioPub) {
          this._audioTrack = formal.audio;
          this._audioPub = await local.publishTrack(formal.audio, {
            name: "tlv-formal-audio",
            source: Track.Source.Microphone,
          });
          // first publish only — not duplicate while pub exists
        }
      }

      this._state = "live";
      this._mountLocal(stream);
      this._log("formal pubs recovered reason=" + reason);
      return {
        ok: true,
        reason: reason,
        cameraReacquire: this._cameraReacquire,
        publishingVideo: Boolean(this._videoPub),
        publishingAudio: Boolean(this._audioPub),
      };
    }

    _reattachRemoteTracks() {
      var self = this;
      if (!this._room) return;
      this._room.remoteParticipants.forEach(function (p) {
        p.trackPublications.forEach(function (pub) {
          if (pub.track) self._attachRemoteTrack(pub.track);
        });
      });
    }

    /**
     * Soft rejoin: same room / same Formal stream. New Room only after SDK disconnect.
     * Refreshes token via hook when near expiry or missing.
     */
    async _softRejoin(reason) {
      if (this._intentionalStop || !this._sessionAlive) return { ok: false, code: "session_ended" };
      if (this._softRejoinInFlight) return { ok: false, code: "rejoin_in_flight" };
      this._softRejoinInFlight = true;
      if (!this._reconnectStartedAt) this._reconnectStartedAt = Date.now();
      this._state = "reconnecting";
      this._emitReconnect({ phase: "soft_rejoin_start", reason: reason });

      try {
        var url = this._url;
        var token = this._token;
        var identity = this._identity;
        var needFresh =
          !token || (this._tokenExpiresAt && Date.now() > this._tokenExpiresAt - 60_000);
        if (needFresh && this._tokenRefreshHook) {
          var minted = await this._tokenRefreshHook(reason);
          if (minted && minted.token) {
            token = minted.token;
            this._token = token;
            if (minted.url) {
              url = minted.url;
              this._url = url;
            }
            if (minted.identity) identity = minted.identity;
            if (minted.expiresAt) this._tokenExpiresAt = Number(minted.expiresAt) || this._tokenExpiresAt;
          }
        }
        if (!url || !token || !this._roomName) {
          throw new Error("soft_rejoin_missing_session");
        }

        // Tear down dead Room instance only (Formal tracks untouched)
        this._listeners.forEach(function (off) {
          try {
            off();
          } catch (_) {}
        });
        this._listeners = [];
        try {
          if (this._room) await this._room.disconnect(true);
        } catch (_) {}
        this._room = null;
        this._videoPub = null;
        this._audioPub = null;

        var Room = this._sdk.Room;
        var room = new Room({
          adaptiveStream: this._role !== "viewer",
          dynacast: true,
          disconnectOnPageLeave: false,
        });
        this._room = room;
        this._bindRoomEvents(room);
        await room.connect(url, token);
        this._identity = identity || this._identity;

        if (this._role === "broadcaster") {
          await this._recoverAfterReconnect("soft_rejoin");
        } else {
          // Keep Formal mount DOM — wipe caused black video after layout/aspect recovery.
          this._reattachRemoteTracks();
          this._state = "watching";
        }

        if (this._reconnectStartedAt) {
          this._lastReconnectDurationMs = Date.now() - this._reconnectStartedAt;
          this._reconnectStartedAt = 0;
        }
        this._reconnectCount += 1;
        this._emitReconnect({
          phase: "soft_rejoin_done",
          reason: reason,
          durationMs: this._lastReconnectDurationMs,
        });
        return { ok: true, durationMs: this._lastReconnectDurationMs };
      } catch (err) {
        this._lastError = String(err && err.message ? err.message : err);
        this._state = "error";
        this._emitReconnect({ phase: "soft_rejoin_failed", error: this._lastError });
        return { ok: false, error: this._lastError };
      } finally {
        this._softRejoinInFlight = false;
      }
    }

    _extractFormalTracks(publishStream) {
      if (!publishStream || typeof publishStream.getVideoTracks !== "function") {
        throw new Error("formal_publish_stream_required");
      }
      var video = publishStream.getVideoTracks()[0] || null;
      var audio = publishStream.getAudioTracks()[0] || null;
      if (!video) throw new Error("formal_video_track_missing");
      return { video: video, audio: audio };
    }

    /**
     * Broadcaster: Formal tracks only (no device capture).
     * @param {{ url: string, token: string, roomName: string, identity: string, publishStream: MediaStream, videoContainer?: HTMLElement|null, simulcast?: boolean }} opts
     */
    async startBroadcast(opts) {
      await this._loadSdk();
      var Room = this._sdk.Room;
      var Track = this._sdk.Track;
      var formal = this._extractFormalTracks(opts.publishStream);

      await this.stop({ intentional: true, clearSession: false });

      this._intentionalStop = false;
      this._sessionAlive = true;
      this._publishStream = opts.publishStream;
      this._videoContainer = opts.videoContainer || null;
      this._roomName = opts.roomName;
      this._identity = opts.identity;
      this._role = "broadcaster";
      this._url = opts.url;
      this._token = opts.token || "";
      this._tokenExpiresAt = Number(opts.expiresAt) || 0;
      this._simulcast = opts.simulcast !== false;
      this._state = "connecting";
      this._cameraReacquire = 0;
      this._audioDuplicatePublish = 0;

      var room = new Room({
        adaptiveStream: true,
        dynacast: true,
        // Critical: default true disconnects on Safari pagehide / background
        disconnectOnPageLeave: false,
      });
      this._room = room;
      this._bindRoomEvents(room);

      await room.connect(opts.url, opts.token);
      this._state = "connected";
      this._mountLocal(opts.publishStream);

      this._videoTrack = formal.video;
      this._videoPub = await room.localParticipant.publishTrack(formal.video, {
        name: "tlv-formal-composited",
        source: Track.Source.Camera,
        simulcast: this._simulcast,
      });

      if (formal.audio) {
        this._audioTrack = formal.audio;
        this._audioPub = await room.localParticipant.publishTrack(formal.audio, {
          name: "tlv-formal-audio",
          source: Track.Source.Microphone,
        });
      }

      this._state = "live";
      this._cycleCount += 1;
      this._log("publishing formal composited room=" + opts.roomName);
      return { ok: true, state: this._state, diagnostics: this.getDiagnostics() };
    }

    /** LiveProviderInterface — Formal publishStream required in options */
    async startLive(options) {
      options = options || {};
      var publishStream = options.publishStream || options.mediaStream || null;
      if (!publishStream) {
        return { ok: false, error: "formal_publish_stream_required", state: this._state };
      }
      if (!options.url || !options.token || !options.roomName) {
        return { ok: false, error: "livekit_session_required", state: this._state };
      }
      try {
        return await this.startBroadcast({
          url: options.url,
          token: options.token,
          roomName: options.roomName,
          identity: options.identity || "",
          publishStream: publishStream,
          videoContainer: options.videoContainer || null,
          simulcast: options.simulcast,
        });
      } catch (err) {
        this._lastError = String(err && err.message ? err.message : err);
        this._state = "error";
        return { ok: false, error: this._lastError, state: this._state };
      }
    }

    async replaceFormalVideo(publishStream) {
      if (!this._room || this._role !== "broadcaster") {
        throw new Error("not_broadcasting");
      }
      var formal = this._extractFormalTracks(publishStream);
      this._publishStream = publishStream;
      var Track = this._sdk.Track;

      if (this._videoPub && this._videoPub.track && typeof this._videoPub.track.replaceTrack === "function") {
        await this._videoPub.track.replaceTrack(formal.video);
        this._videoTrack = formal.video;
      } else {
        if (this._videoPub) {
          await this._room.localParticipant.unpublishTrack(this._videoPub.track || this._videoTrack);
        }
        this._videoTrack = formal.video;
        this._videoPub = await this._room.localParticipant.publishTrack(formal.video, {
          name: "tlv-formal-composited",
          source: Track.Source.Camera,
          simulcast: true,
        });
      }

      if (formal.audio && this._audioPub && this._audioPub.track && typeof this._audioPub.track.replaceTrack === "function") {
        try {
          await this._audioPub.track.replaceTrack(formal.audio);
          this._audioTrack = formal.audio;
        } catch (_) {
          /* keep prior audio */
        }
      }

      this._mountLocal(publishStream);
      return this.getDiagnostics();
    }

    /**
     * Viewer auto-subscribe (no manual Join).
     */
    async startViewer(opts) {
      await this._loadSdk();
      var Room = this._sdk.Room;
      var RoomEvent = this._sdk.RoomEvent;
      await this.stop({ intentional: true, clearSession: false });

      this._intentionalStop = false;
      this._sessionAlive = true;
      this._videoContainer = opts.videoContainer || null;
      this._roomName = opts.roomName;
      this._identity = opts.identity;
      this._role = "viewer";
      this._url = opts.url;
      this._token = opts.token || "";
      this._tokenExpiresAt = Number(opts.expiresAt) || 0;
      this._state = "connecting";
      this._clearContainer();

      var room = new Room({
        // Formal Viewer: keep layers alive across Vertical↔Landscape relocate.
        // adaptiveStream previously dropped video while the mount sat in a hidden stash
        // (9:16→16:9 return = black UI, audio still OK).
        adaptiveStream: false,
        dynacast: true,
        disconnectOnPageLeave: false,
      });
      this._room = room;
      this._bindRoomEvents(room);

      var waitMs = Math.max(0, Number(opts.waitForRemoteMs != null ? opts.waitForRemoteMs : 8000) || 0);
      var remoteReady = waitMs
        ? new Promise(function (resolve) {
            var onTrack = function (track, _pub, participant) {
              if (participant && participant.isLocal) return;
              if (track && track.kind === "video") {
                room.off(RoomEvent.TrackSubscribed, onTrack);
                resolve(true);
              }
            };
            room.on(RoomEvent.TrackSubscribed, onTrack);
            setTimeout(function () {
              room.off(RoomEvent.TrackSubscribed, onTrack);
              resolve(false);
            }, waitMs);
          })
        : Promise.resolve(false);

      await room.connect(opts.url, opts.token);
      this._state = "watching";

      var self = this;
      var earlyRemote = false;
      room.remoteParticipants.forEach(function (p) {
        p.trackPublications.forEach(function (pub) {
          if (pub.track) {
            self._attachRemoteTrack(pub.track);
            if (pub.track.kind === "video") earlyRemote = true;
          }
        });
      });

      var gotRemote = earlyRemote || (await remoteReady);
      var hasRemoteVideoEl = Boolean(
        this._remoteEl || (this._videoContainer && this._videoContainer.querySelector && this._videoContainer.querySelector("video")),
      );
      this._state = "watching";
      this._cycleCount += 1;
      this._log("viewer room=" + opts.roomName + " remoteVideo=" + (gotRemote || hasRemoteVideoEl ? "yes" : "waiting"));

      return {
        ok: true,
        state: this._state,
        remoteTrackSubscribed: Boolean(gotRemote || hasRemoteVideoEl),
        diagnostics: this.getDiagnostics(),
      };
    }

    async joinLive(options) {
      options = options || {};
      if (!options.url || !options.token || !options.roomName) {
        return { ok: false, error: "livekit_session_required", state: this._state };
      }
      try {
        return await this.startViewer({
          url: options.url,
          token: options.token,
          roomName: options.roomName,
          identity: options.identity || "",
          videoContainer: options.videoContainer || null,
          waitForRemoteMs: options.waitForRemoteMs,
        });
      } catch (err) {
        this._lastError = String(err && err.message ? err.message : err);
        this._state = "error";
        return { ok: false, error: this._lastError, state: this._state };
      }
    }

    async leaveLive() {
      await this.stop();
      return { ok: true, state: this._state };
    }

    async endLive() {
      await this.stop();
      return { ok: true, state: this._state };
    }

    async toggleCamera() {
      return { ok: false, error: "formal_scene_owns_camera" };
    }

    async toggleMic() {
      return { ok: false, error: "formal_media_owns_mic" };
    }

    async switchCamera() {
      return { ok: false, error: "formal_scene_owns_camera" };
    }

    async dispose() {
      await this.stop();
      this._state = "disposed";
      return { ok: true };
    }

    getPublishedVideoSettings() {
      var t = this._videoTrack;
      var s = t && typeof t.getSettings === "function" ? t.getSettings() : null;
      return {
        width: (s && s.width) || null,
        height: (s && s.height) || null,
        frameRate: (s && s.frameRate) || null,
        readyState: (t && t.readyState) || null,
        usedGetUserMedia: false,
        source: "formal_compositedStream",
      };
    }

    /**
     * Read-only participant snapshot for Broadcaster UX / CCU.
     * Does not alter publish/subscribe/reconnect paths.
     * Host/local identity is excluded via TasuTlvLiveViewerCountContract when available.
     */
    getParticipantStats() {
      var remotes = [];
      var localIdentity =
        (this._room && this._room.localParticipant && this._room.localParticipant.identity) ||
        this._identity ||
        "";
      if (this._room && this._room.remoteParticipants) {
        this._room.remoteParticipants.forEach(function (p) {
          remotes.push({
            identity: p && p.identity ? String(p.identity) : "",
            sid: p && p.sid ? String(p.sid) : "",
          });
        });
      }
      var contract = global.TasuTlvLiveViewerCountContract;
      if (contract && typeof contract.fromRoomSnapshot === "function") {
        return contract.fromRoomSnapshot({
          localIdentity: localIdentity,
          remotes: remotes,
        });
      }
      var viewerCount = remotes.filter(function (r) {
        return String(r.identity || "").indexOf("host_") !== 0;
      }).length;
      return {
        source: "livekit_remote_participants",
        localIdentity: localIdentity,
        remoteCount: remotes.length,
        viewerCount: viewerCount,
        identities: remotes
          .filter(function (r) {
            return String(r.identity || "").indexOf("host_") !== 0;
          })
          .map(function (r) {
            return r.identity;
          }),
        excludedHosts: remotes
          .filter(function (r) {
            return String(r.identity || "").indexOf("host_") === 0;
          })
          .map(function (r) {
            return r.identity;
          }),
        hostExcluded: true,
        fakeForbidden: true,
      };
    }

    /**
     * Subscribe to participant join/leave (read-only). Returns unsubscribe fn.
     * @param {(stats: object) => void} listener
     */
    subscribeParticipantStats(listener) {
      var self = this;
      if (typeof listener !== "function") return function () {};
      var room = this._room;
      if (!room || !this._sdk || !this._sdk.RoomEvent) {
        try {
          listener(self.getParticipantStats());
        } catch (_) {}
        return function () {};
      }
      var RoomEvent = this._sdk.RoomEvent;
      var emit = function () {
        try {
          listener(self.getParticipantStats());
        } catch (_) {}
      };
      var onConnected = function () {
        emit();
      };
      var onDisconnected = function () {
        emit();
      };
      if (RoomEvent.ParticipantConnected) room.on(RoomEvent.ParticipantConnected, onConnected);
      if (RoomEvent.ParticipantDisconnected) room.on(RoomEvent.ParticipantDisconnected, onDisconnected);
      if (RoomEvent.Reconnected) room.on(RoomEvent.Reconnected, onConnected);
      emit();
      return function () {
        try {
          if (RoomEvent.ParticipantConnected) room.off(RoomEvent.ParticipantConnected, onConnected);
          if (RoomEvent.ParticipantDisconnected) room.off(RoomEvent.ParticipantDisconnected, onDisconnected);
          if (RoomEvent.Reconnected) room.off(RoomEvent.Reconnected, onConnected);
        } catch (_) {}
      };
    }

    getDiagnostics() {
      var participantStats = this.getParticipantStats();
      return {
        providerId: this.providerId,
        sdkPackage: this.sdkPackage,
        sdkVersion: this.sdkVersion,
        state: this._state,
        role: this._role,
        roomName: this._roomName,
        identity: this._identity,
        cycleCount: this._cycleCount,
        hasRoom: Boolean(this._room),
        publishingVideo: Boolean(this._videoPub),
        publishingAudio: Boolean(this._audioPub),
        videoPublicationName: (this._videoPub && (this._videoPub.trackName || this._videoPub.name)) || null,
        audioPublicationName: (this._audioPub && (this._audioPub.trackName || this._audioPub.name)) || null,
        formalVideoSettings: this.getPublishedVideoSettings(),
        lastError: this._lastError,
        cameraReacquire: this._cameraReacquire,
        audioDuplicatePublish: this._audioDuplicatePublish,
        reconnectCount: this._reconnectCount,
        lastReconnectDurationMs: this._lastReconnectDurationMs,
        connectionQuality: this._connectionQuality,
        sessionAlive: this._sessionAlive,
        intentionalStop: this._intentionalStop,
        disconnectOnPageLeave: false,
        viewerCount: participantStats.viewerCount,
        participantStats: participantStats,
      };
    }

    /**
     * @param {{ intentional?: boolean, clearSession?: boolean }|boolean} [opts]
     */
    async stop(opts) {
      var intentional = true;
      var clearSession = true;
      if (opts && typeof opts === "object") {
        intentional = opts.intentional !== false;
        clearSession = opts.clearSession !== false;
      }
      this._intentionalStop = intentional;
      if (clearSession) this._sessionAlive = false;
      this._listeners.forEach(function (off) {
        try {
          off();
        } catch (_) {}
      });
      this._listeners = [];
      try {
        if (this._room) await this._room.disconnect(true);
      } catch (_) {}
      this._room = null;
      this._videoPub = null;
      this._audioPub = null;
      // Do NOT stop Formal tracks — Scene/Media owns them
      this._videoTrack = null;
      this._audioTrack = null;
      if (clearSession) {
        this._publishStream = null;
        this._token = "";
        this._tokenExpiresAt = 0;
      }
      this._clearContainer();
      this._state = "idle";
    }

    /** Visibility / network recovery probe — no getUserMedia */
    async probeAndRecover(reason) {
      if (this._intentionalStop || !this._sessionAlive) {
        return { ok: false, code: "session_ended" };
      }
      if (this._state === "reconnecting" || this._softRejoinInFlight) {
        return { ok: true, deferred: true, state: this._state };
      }
      var roomState = this._room && this._room.state;
      // LiveKit Room.state: Connected=1 typically; treat missing room as soft rejoin
      if (!this._room || this._state === "disconnected" || this._state === "error") {
        return this._softRejoin(reason || "probe");
      }
      if (this._role === "broadcaster") {
        return this._recoverAfterReconnect(reason || "probe");
      }
      this._reattachRemoteTracks();
      return { ok: true, state: this._state, roomState: roomState };
    }
  }

  global.TlvLiveKitLiveProvider = LiveKitLiveProvider;
  global.TasuTlvLiveKitLiveProvider = LiveKitLiveProvider;
})(typeof window !== "undefined" ? window : globalThis);
