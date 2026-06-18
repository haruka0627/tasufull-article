/**
 * TASFUL TALK — WebRTC PeerConnection（音声 / STUN + optional TURN）
 */
(function (global) {
  "use strict";

  const Ice = () => global.TasuTalkCallIceConfig;

  /** @type {RTCPeerConnection|null} */
  let pc = null;
  /** @type {MediaStream|null} */
  let localStream = null;
  /** @type {HTMLAudioElement|null} */
  let remoteAudio = null;
  /** @type {((candidate: RTCIceCandidateInit) => void)|null} */
  let onIceCandidate = null;
  /** @type {((stream: MediaStream) => void)|null} */
  let onRemoteStream = null;
  /** @type {((state: string) => void)|null} */
  let onConnectionState = null;

  const iceCandidateCounts = { host: 0, srflx: 0, relay: 0, prflx: 0, unknown: 0 };
  /** @type {Set<string>} */
  const iceCandidateTypesSeen = new Set();

  function resetIceCandidateStats() {
    iceCandidateCounts.host = 0;
    iceCandidateCounts.srflx = 0;
    iceCandidateCounts.relay = 0;
    iceCandidateCounts.prflx = 0;
    iceCandidateCounts.unknown = 0;
    iceCandidateTypesSeen.clear();
  }

  function inferCandidateType(candidate) {
    const explicit = String(candidate?.type || "").toLowerCase();
    if (explicit) return explicit;
    const line = String(candidate?.candidate || "");
    if (/\btyp relay\b/i.test(line)) return "relay";
    if (/\btyp srflx\b/i.test(line)) return "srflx";
    if (/\btyp host\b/i.test(line)) return "host";
    if (/\btyp prflx\b/i.test(line)) return "prflx";
    return "unknown";
  }

  function recordIceCandidate(candidate) {
    const type = inferCandidateType(candidate);
    if (Object.prototype.hasOwnProperty.call(iceCandidateCounts, type)) {
      iceCandidateCounts[type] += 1;
    } else {
      iceCandidateCounts.unknown += 1;
    }
    iceCandidateTypesSeen.add(type);
    Ice()?.logIceDebug?.("icecandidate-recorded", {
      type,
      counts: { ...iceCandidateCounts },
    });
  }

  function ensureRemoteAudio() {
    if (remoteAudio) return remoteAudio;
    remoteAudio = document.createElement("audio");
    remoteAudio.autoplay = true;
    remoteAudio.setAttribute("playsinline", "true");
    remoteAudio.hidden = true;
    document.body.appendChild(remoteAudio);
    return remoteAudio;
  }

  async function acquireLocalAudio() {
    if (localStream) return localStream;
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("このブラウザはマイク入力に対応していません。");
    }
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    return localStream;
  }

  function attachIceDebugHandlers(connection) {
    if (!connection) return;
    connection.onicecandidate = (event) => {
      if (event.candidate) {
        recordIceCandidate(event.candidate);
        Ice()?.logIceDebug?.("icecandidate", {
          type: event.candidate.type,
          protocol: event.candidate.protocol,
          candidate: event.candidate.candidate,
        });
        if (onIceCandidate) {
          onIceCandidate(event.candidate.toJSON());
        }
      }
    };
    connection.oniceconnectionstatechange = () => {
      Ice()?.logIceDebug?.("iceconnectionstate", { state: connection.iceConnectionState });
    };
    connection.onconnectionstatechange = () => {
      Ice()?.logIceDebug?.("connectionstate", { state: connection.connectionState });
      if (onConnectionState) {
        onConnectionState(connection.connectionState);
      }
    };
  }

  function createPeerConnection(handlers) {
    onIceCandidate = handlers?.onIceCandidate || null;
    onRemoteStream = handlers?.onRemoteStream || null;
    onConnectionState = handlers?.onConnectionState || null;
    resetIceCandidateStats();

    const rtcConfig = Ice()?.buildTalkCallPeerConnectionConfig?.() || {
      iceServers: [{ urls: Ice()?.DEFAULT_STUN_URL || "stun:stun.l.google.com:19302" }],
    };

    Ice()?.logIceDebug?.("rtc-config", Ice()?.getConfigSummary?.() || { iceServerCount: rtcConfig.iceServers?.length });

    pc = new RTCPeerConnection(rtcConfig);

    attachIceDebugHandlers(pc);

    pc.ontrack = (event) => {
      const stream = event.streams?.[0];
      if (!stream) return;
      const audio = ensureRemoteAudio();
      audio.srcObject = stream;
      audio.play().catch(() => {});
      if (onRemoteStream) onRemoteStream(stream);
    };

    return pc;
  }

  async function attachLocalTracks() {
    const stream = await acquireLocalAudio();
    if (!pc) throw new Error("PeerConnection が未初期化です");
    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });
    return stream;
  }

  async function createOffer() {
    if (!pc) throw new Error("PeerConnection が未初期化です");
    const offer = await pc.createOffer({ offerToReceiveAudio: true });
    await pc.setLocalDescription(offer);
    return pc.localDescription;
  }

  async function acceptOffer(offerInit) {
    if (!pc) throw new Error("PeerConnection が未初期化です");
    await pc.setRemoteDescription(new RTCSessionDescription(offerInit));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    return pc.localDescription;
  }

  async function acceptAnswer(answerInit) {
    if (!pc) throw new Error("PeerConnection が未初期化です");
    await pc.setRemoteDescription(new RTCSessionDescription(answerInit));
  }

  async function addIceCandidate(candidateInit) {
    if (!pc || !candidateInit) return;
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidateInit));
    } catch (err) {
      console.warn("[TasuTalkCallWebRtc] addIceCandidate:", err);
    }
  }

  function setMuted(muted) {
    if (!localStream) return;
    localStream.getAudioTracks().forEach((t) => {
      t.enabled = !muted;
    });
  }

  function isMuted() {
    if (!localStream) return false;
    const tracks = localStream.getAudioTracks();
    return tracks.length > 0 && tracks.every((t) => !t.enabled);
  }

  function getConnectionDiagnostics() {
    return {
      candidateCounts: { ...iceCandidateCounts },
      typesSeen: [...iceCandidateTypesSeen],
      hasHost: iceCandidateCounts.host > 0,
      hasSrflx: iceCandidateCounts.srflx > 0,
      hasRelay: iceCandidateCounts.relay > 0,
      connectionState: pc?.connectionState || null,
      iceConnectionState: pc?.iceConnectionState || null,
      iceGatheringState: pc?.iceGatheringState || null,
    };
  }

  function close() {
    if (localStream) {
      localStream.getTracks().forEach((t) => t.stop());
      localStream = null;
    }
    if (pc) {
      try {
        pc.close();
      } catch {
        /* ignore */
      }
      pc = null;
    }
    if (remoteAudio) {
      remoteAudio.srcObject = null;
    }
    onIceCandidate = null;
    onRemoteStream = null;
    onConnectionState = null;
  }

  global.TasuTalkCallWebRtc = {
    STUN_URL: Ice()?.DEFAULT_STUN_URL || "stun:stun.l.google.com:19302",
    createPeerConnection,
    attachLocalTracks,
    createOffer,
    acceptOffer,
    acceptAnswer,
    addIceCandidate,
    setMuted,
    isMuted,
    close,
    getPeerConnection: () => pc,
    getConnectionDiagnostics,
  };
})(typeof window !== "undefined" ? window : globalThis);
