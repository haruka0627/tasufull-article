/**
 * TASFUL talk-voice-core — WebRTC VoiceProviderAdapter
 *
 * Wraps existing TasuTalkCallWebRtc. No billing / permission logic here.
 */
(function (global) {
  "use strict";

  const Errors = () => global.TasuTalkVoiceErrors;
  const WebRtc = () => global.TasuTalkCallWebRtc;

  function createWebRtcVoiceAdapter(options) {
    /** @type {((ev: object) => void)|null} */
    let emit = typeof options?.onEvent === "function" ? options.onEvent : null;
    let initialized = false;

    function fire(type, detail) {
      try {
        emit?.({ type, detail: detail || {} });
      } catch {
        /* ignore */
      }
    }

    const adapter = {
      providerId: "webrtc",

      async initialize() {
        if (!WebRtc()) {
          return { ok: false, error: "provider_unavailable" };
        }
        initialized = true;
        return { ok: true };
      },

      /**
       * Caller path: PC + local tracks + offer SDP
       * @param {{ onIceCandidate?: Function }} params
       */
      async createOutgoingConnection(params) {
        if (!initialized) await adapter.initialize();
        try {
          WebRtc().createPeerConnection({
            onIceCandidate: (candidate) => {
              fire("onLocalSignal", { signalType: "candidate", payload: candidate });
              params?.onIceCandidate?.(candidate);
            },
            onRemoteStream: (stream) => fire("onRemoteTrack", { stream }),
            onConnectionState: (state) => {
              if (state === "connected" || state === "completed") fire("onConnected", { state });
              else if (state === "disconnected") fire("onDisconnected", { state });
              else if (state === "connecting") fire("onReconnecting", { state });
              else if (state === "failed") {
                fire("onError", { code: "network_disconnected", state });
              }
              params?.onConnectionState?.(state);
            },
          });
          await WebRtc().attachLocalTracks();
          // Ensure mute API has tracks in mock environments
          if (params?.muted != null) WebRtc().setMuted(Boolean(params.muted));
          const localDesc = await WebRtc().createOffer();
          fire("onLocalSignal", {
            signalType: "offer",
            payload: { type: localDesc.type, sdp: localDesc.sdp },
          });
          return {
            ok: true,
            localDescription: { type: localDesc.type, sdp: localDesc.sdp },
          };
        } catch (err) {
          const mapped = Errors()?.mapProviderError?.(err) || {
            code: "unknown_voice_error",
            message: String(err?.message || err),
          };
          fire("onError", mapped);
          return { ok: false, ...mapped };
        }
      },

      /**
       * Callee path: PC + local tracks (offer applied separately)
       */
      async acceptIncomingConnection(params) {
        if (!initialized) await adapter.initialize();
        try {
          if (!WebRtc().getPeerConnection()) {
            WebRtc().createPeerConnection({
              onIceCandidate: (candidate) => {
                fire("onLocalSignal", { signalType: "candidate", payload: candidate });
                params?.onIceCandidate?.(candidate);
              },
              onRemoteStream: (stream) => fire("onRemoteTrack", { stream }),
              onConnectionState: (state) => {
                if (state === "connected" || state === "completed") fire("onConnected", { state });
                else if (state === "failed") fire("onError", { code: "network_disconnected", state });
                params?.onConnectionState?.(state);
              },
            });
          }
          await WebRtc().attachLocalTracks();
          return { ok: true };
        } catch (err) {
          const mapped = Errors()?.mapProviderError?.(err) || {
            code: "unknown_voice_error",
            message: String(err?.message || err),
          };
          fire("onError", mapped);
          return { ok: false, ...mapped };
        }
      },

      async applyRemoteDescription(params) {
        const desc = params?.description || params;
        const type = String(desc?.type || "").toLowerCase();
        if (type === "offer") {
          const answer = await WebRtc().acceptOffer(desc);
          fire("onLocalSignal", {
            signalType: "answer",
            payload: { type: answer.type, sdp: answer.sdp },
          });
          return { ok: true, localDescription: { type: answer.type, sdp: answer.sdp } };
        }
        if (type === "answer") {
          await WebRtc().acceptAnswer(desc);
          return { ok: true };
        }
        return { ok: false, error: "invalid_description" };
      },

      async addIceCandidate(params) {
        const candidate = params?.candidate || params;
        await WebRtc().addIceCandidate(candidate);
      },

      setMuted(value) {
        WebRtc()?.setMuted?.(Boolean(value));
      },

      isMuted() {
        return Boolean(WebRtc()?.isMuted?.());
      },

      getConnectionState() {
        return WebRtc()?.getPeerConnection?.()?.connectionState || null;
      },

      getPeerConnection() {
        return WebRtc()?.getPeerConnection?.() || null;
      },

      getConnectionDiagnostics() {
        return WebRtc()?.getConnectionDiagnostics?.() || null;
      },

      async disconnect() {
        WebRtc()?.close?.();
        fire("onDisconnected", { reason: "disconnect" });
      },

      async dispose() {
        WebRtc()?.close?.();
        initialized = false;
        emit = null;
      },
    };

    return adapter;
  }

  function getDefaultAdapter() {
    if (!global.__tasuTalkVoiceWebRtcAdapter) {
      global.__tasuTalkVoiceWebRtcAdapter = createWebRtcVoiceAdapter();
    }
    return global.__tasuTalkVoiceWebRtcAdapter;
  }

  global.TasuTalkVoiceWebRtcAdapter = {
    create: createWebRtcVoiceAdapter,
    getDefault: getDefaultAdapter,
  };
})(typeof window !== "undefined" ? window : globalThis);
