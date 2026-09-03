/**
 * one-tlv-go-live-media-controller.js
 * Formal Go Live media runtime — local camera/mic + Formal MediaStream Output / Publish Input.
 *
 * Ownership:
 * - Controller owns tracks created via getUserMedia (startPreview).
 * - Callers of getActiveMediaStream / getPublishStream MUST NOT stop() tracks.
 * - stopPreview / pagehide / beforeunload are the only release paths for owned tracks.
 * - setPublishStream(stream) does NOT transfer ownership (Scene Compositor may own compositedStream later).
 *
 * Pipeline (current):
 *   getUserMedia → Formal MediaStream Output → Preview + Formal Publish Input
 * Future Scene Editor:
 *   Formal Output → Scene Compositor → compositedStream → Preview + Publish Input
 */
(function (global) {
  "use strict";

  var OWNER = "TasuOneTlvGoLiveMedia";

  var state = {
    stream: null,
    /** @type {MediaStream|null} Formal Publish Input (defaults to Formal Output reference) */
    publishStream: null,
    videoEl: null,
    cameraOn: true,
    micOn: true,
    devices: { videoinput: [], audioinput: [], audiooutput: [] },
    selected: { videoinput: "", audioinput: "", audiooutput: "" },
    permission: "unknown", // unknown | granted | denied | unsupported
    error: null,
    sinkIdSupported: false,
    /** Monotonic id for Formal Output revisions (device change / restart) */
    streamGeneration: 0,
    /** Concurrent owned getUserMedia streams (must stay 0..1) */
    activeOwnedStreams: 0,
    /** Cumulative getUserMedia invocations (includes ephemeral permission probe) */
    gumInvokeCount: 0,
    /** Ephemeral probe invocations (released immediately) */
    gumProbeCount: 0,
    lastGumError: null,
    lastConstraints: null,
    lastStaleDropped: { videoinput: false, audioinput: false },
  };

  /** @type {Array<function(object): void>} */
  var streamListeners = [];
  /** @type {Array<function(object): void>} */
  var deviceListListeners = [];
  var deviceChangeWired = false;

  function hasMediaApi() {
    return Boolean(global.navigator?.mediaDevices?.getUserMedia);
  }

  function markOwnedTrack(track) {
    if (!track) return;
    try {
      track._tlvOwner = OWNER;
      track._tlvDoNotStop = true;
    } catch (_) {}
  }

  function stopOwnedTracks(stream) {
    if (!stream) return;
    try {
      stream.getTracks().forEach(function (t) {
        try {
          t.stop();
        } catch (_) {}
      });
    } catch (_) {}
  }

  function notifyStreamChange(reason) {
    var payload = {
      reason: reason || "update",
      generation: state.streamGeneration,
      hasStream: Boolean(state.stream),
      cameraOn: state.cameraOn,
      micOn: state.micOn,
    };
    streamListeners.slice().forEach(function (fn) {
      try {
        fn(payload);
      } catch (err) {
        console.warn("[GoLiveMedia] stream listener:", err);
      }
    });
  }

  function clearOwnedStream(reason) {
    var owned = state.stream;
    if (state.publishStream === owned) {
      state.publishStream = null;
    }
    if (owned) {
      stopOwnedTracks(owned);
      state.stream = null;
      state.activeOwnedStreams = 0;
    }
    if (state.videoEl) {
      try {
        state.videoEl.srcObject = null;
      } catch (_) {}
    }
    notifyStreamChange(reason || "clear");
  }

  function syncPublishFromFormalOutput() {
    state.publishStream = state.stream;
    return { ok: true, stream: state.publishStream, generation: state.streamGeneration };
  }

  function notifyDeviceList(reason) {
    var payload = {
      reason: reason || "devices",
      devices: state.devices,
      selected: Object.assign({}, state.selected),
      permission: state.permission,
    };
    deviceListListeners.slice().forEach(function (fn) {
      try {
        fn(payload);
      } catch (err) {
        console.warn("[GoLiveMedia] device listener:", err);
      }
    });
  }

  function isNotFoundError(err) {
    var name = err && err.name ? String(err.name) : "";
    return name === "NotFoundError" || name === "DevicesNotFoundError";
  }

  function recordGumError(err, constraints) {
    var name = err && err.name ? String(err.name) : "";
    var msg = err && err.message ? String(err.message) : String(err || "");
    state.lastGumError = {
      name: name || null,
      message: msg.slice(0, 300),
      constraint: err && err.constraint != null ? String(err.constraint) : null,
      constraints: constraints
        ? {
            video: summarizeConstraint(constraints.video),
            audio: summarizeConstraint(constraints.audio),
          }
        : null,
      selected: Object.assign({}, state.selected),
    };
    state.error = name ? name + (msg && msg !== name ? ": " + msg : "") : msg;
  }

  function summarizeConstraint(node) {
    if (node === true) return { requested: true, exact: "" };
    if (!node) return { requested: false, exact: "" };
    var exact = "";
    try {
      if (node.deviceId && typeof node.deviceId === "object") exact = String(node.deviceId.exact || "");
      else if (typeof node.deviceId === "string") exact = node.deviceId;
    } catch (_) {}
    return { requested: true, exact: exact ? exact.slice(0, 12) : "" };
  }

  function deviceExists(kind, deviceId) {
    var id = String(deviceId || "");
    if (!id) return false;
    return (state.devices[kind] || []).some(function (d) {
      return d && d.deviceId === id;
    });
  }

  function resolveSelected(kind) {
    var id = String(state.selected[kind] || "");
    if (id && deviceExists(kind, id)) {
      state.lastStaleDropped[kind] = false;
      return id;
    }
    if (id) {
      state.lastStaleDropped[kind] = true;
      state.selected[kind] = "";
    }
    var first = (state.devices[kind] || []).find(function (d) {
      return d && d.deviceId;
    });
    if (first) {
      state.selected[kind] = first.deviceId;
      return first.deviceId;
    }
    return "";
  }

  function dropStaleSelected() {
    ["videoinput", "audioinput"].forEach(function (kind) {
      if (state.selected[kind] && !deviceExists(kind, state.selected[kind])) {
        state.lastStaleDropped[kind] = true;
        state.selected[kind] = "";
      }
    });
    if (!state.selected.videoinput && state.devices.videoinput[0] && state.devices.videoinput[0].deviceId) {
      state.selected.videoinput = state.devices.videoinput[0].deviceId;
    }
    if (!state.selected.audioinput && state.devices.audioinput[0] && state.devices.audioinput[0].deviceId) {
      state.selected.audioinput = state.devices.audioinput[0].deviceId;
    }
    if (!state.selected.audiooutput && state.devices.audiooutput[0] && state.devices.audiooutput[0].deviceId) {
      state.selected.audiooutput = state.devices.audiooutput[0].deviceId;
    }
  }

  function ingestDeviceList(list) {
    state.devices = { videoinput: [], audioinput: [], audiooutput: [] };
    (list || []).forEach(function (d) {
      if (!d || !d.kind) return;
      if (state.devices[d.kind]) {
        state.devices[d.kind].push({
          deviceId: d.deviceId || "",
          label: d.label || d.kind + " (" + String(d.deviceId || "").slice(0, 6) + "…)",
          kind: d.kind,
          groupId: d.groupId || "",
        });
      }
    });
    dropStaleSelected();
  }

  async function enumerateNow() {
    var list = await navigator.mediaDevices.enumerateDevices();
    ingestDeviceList(list);
    return list;
  }

  function labeledCount(kind) {
    return (state.devices[kind] || []).filter(function (d) {
      return d.label && d.label.indexOf(kind + " (") !== 0;
    }).length;
  }

  function wireDeviceChange() {
    if (deviceChangeWired) return;
    var md = global.navigator && global.navigator.mediaDevices;
    if (!md) return;
    var onChange = function () {
      ensurePermissionAndList({ skipProbe: true, reason: "devicechange" })
        .then(function () {
          notifyDeviceList("devicechange");
          if (!state.stream && state.cameraOn && state.devices.videoinput.length) {
            return startPreview(state.videoEl);
          }
          return null;
        })
        .catch(function () {});
    };
    if (typeof md.addEventListener === "function") {
      md.addEventListener("devicechange", onChange);
      deviceChangeWired = true;
    } else if (typeof md.ondevicechange !== "undefined") {
      md.ondevicechange = onChange;
      deviceChangeWired = true;
    }
  }

  function trackDeviceId(track) {
    if (!track || typeof track.getSettings !== "function") return "";
    try {
      return String(track.getSettings().deviceId || "");
    } catch (_) {
      return "";
    }
  }

  function streamMatchesSelection(stream) {
    if (!stream) return false;
    var v = stream.getVideoTracks()[0];
    var a = stream.getAudioTracks()[0];
    if (state.cameraOn) {
      if (!v) return false;
      if (state.selected.videoinput && trackDeviceId(v) && trackDeviceId(v) !== state.selected.videoinput) {
        return false;
      }
    }
    if (state.micOn) {
      if (!a) return false;
      if (state.selected.audioinput && trackDeviceId(a) && trackDeviceId(a) !== state.selected.audioinput) {
        return false;
      }
    }
    return true;
  }

  function applyTrackEnabledFlags(stream) {
    if (!stream) return;
    stream.getVideoTracks().forEach(function (t) {
      t.enabled = state.cameraOn;
      markOwnedTrack(t);
    });
    stream.getAudioTracks().forEach(function (t) {
      t.enabled = state.micOn;
      markOwnedTrack(t);
    });
  }

  async function bindPreviewElement(videoEl) {
    if (videoEl) state.videoEl = videoEl;
    if (!state.videoEl) return { ok: false, error: "no_video_el" };
    if (!state.stream) {
      try {
        state.videoEl.srcObject = null;
      } catch (_) {}
      return { ok: false, error: "no_formal_stream" };
    }
    try {
      state.videoEl.srcObject = state.stream;
      state.videoEl.muted = true;
      await state.videoEl.play().catch(function () {});
      if (state.sinkIdSupported && state.selected.audiooutput && typeof state.videoEl.setSinkId === "function") {
        try {
          await state.videoEl.setSinkId(state.selected.audiooutput);
        } catch (sinkErr) {
          console.warn("[GoLiveMedia] setSinkId:", sinkErr?.message || sinkErr);
        }
      }
      return { ok: true, stream: state.stream };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  }

  async function ensurePermissionAndList(opts) {
    opts = opts || {};
    wireDeviceChange();
    if (!hasMediaApi()) {
      state.permission = "unsupported";
      state.error = "mediaDevices 非対応";
      return { ok: false, error: state.error, devices: state.devices };
    }
    if (!navigator.mediaDevices.enumerateDevices) {
      state.permission = "unsupported";
      state.error = "enumerateDevices 非対応";
      return { ok: false, error: state.error, devices: state.devices };
    }

    state.permission = "unknown";
    if (!opts.keepError) state.error = null;

    var permSnap = { camera: null, microphone: null };
    try {
      if (navigator.permissions && navigator.permissions.query) {
        try {
          var camP = await navigator.permissions.query({ name: "camera" });
          permSnap.camera = camP.state;
        } catch (_) {}
        try {
          var micP = await navigator.permissions.query({ name: "microphone" });
          permSnap.microphone = micP.state;
        } catch (_) {}
      }
    } catch (_) {}

    try {
      await enumerateNow();
    } catch (errEnum) {
      state.error = errEnum?.message || String(errEnum);
      return { ok: false, error: state.error, devices: state.devices };
    }

    var alreadyHaveIds =
      state.devices.videoinput.some(function (d) {
        return d.deviceId;
      }) ||
      state.devices.audioinput.some(function (d) {
        return d.deviceId;
      });
    var queryGranted = permSnap.camera === "granted" || permSnap.microphone === "granted";

    if (!opts.skipProbe && !alreadyHaveIds) {
      state.gumInvokeCount += 1;
      state.gumProbeCount += 1;
      var probe = null;
      var probeErr = null;
      try {
        probe = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      } catch (errVideo) {
        probeErr = errVideo;
        recordGumError(errVideo, { video: true, audio: false });
        try {
          state.gumInvokeCount += 1;
          state.gumProbeCount += 1;
          probe = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          probeErr = null;
        } catch (errBoth) {
          probeErr = errBoth;
          recordGumError(errBoth, { video: true, audio: true });
        }
      }
      if (probe) {
        stopOwnedTracks(probe);
        state.permission = "granted";
        state.error = null;
        state.lastGumError = null;
        try {
          await enumerateNow();
        } catch (_) {}
      } else {
        var name = probeErr?.name || "";
        var msg = probeErr?.message || String(probeErr || "");
        if (name === "NotAllowedError" || name === "PermissionDeniedError" || /Permission denied/i.test(msg)) {
          state.permission = "denied";
        } else if (isNotFoundError(probeErr) || name === "NotReadableError" || name === "TrackStartError") {
          state.permission = queryGranted ? "granted" : "unknown";
        } else {
          state.permission = queryGranted ? "granted" : "denied";
        }
      }
    } else if (alreadyHaveIds || queryGranted || labeledCount("videoinput") > 0) {
      state.permission = "granted";
      if (alreadyHaveIds) {
        state.error = null;
        state.lastGumError = null;
      }
    }

    state.sinkIdSupported = Boolean(
      global.HTMLMediaElement && HTMLMediaElement.prototype && "setSinkId" in HTMLMediaElement.prototype
    );

    var hasLabeledVideo = labeledCount("videoinput") > 0;
    if (state.permission === "denied" && hasLabeledVideo && permSnap.camera === "granted") {
      state.permission = "granted";
    }

    return {
      ok: state.permission !== "unsupported",
      permission: state.permission,
      devices: state.devices,
      selected: Object.assign({}, state.selected),
      sinkIdSupported: state.sinkIdSupported,
      error: state.error,
      lastGumError: state.lastGumError || null,
      permissionsQuery: permSnap,
      staleDropped: Object.assign({}, state.lastStaleDropped),
    };
  }

  function buildConstraints(mode) {
    var videoId = state.cameraOn ? resolveSelected("videoinput") : "";
    var audioId = state.micOn ? resolveSelected("audioinput") : "";
    var wantVideo = mode === "audio-only" ? false : Boolean(state.cameraOn);
    var wantAudio = mode === "video-only" ? false : Boolean(state.micOn);
    var video = false;
    var audio = false;
    if (wantVideo) {
      if (videoId) video = { deviceId: { exact: videoId } };
      else if (state.devices.videoinput.length) video = true;
    }
    if (wantAudio) {
      if (audioId) audio = { deviceId: { exact: audioId } };
      else if (state.devices.audioinput.length) audio = true;
    }
    return { video: video, audio: audio, videoId: videoId, audioId: audioId };
  }

  /**
   * Start or reuse Formal MediaStream Output and bind Preview to the same stream.
   * Does not create a Preview-only MediaStream.
   */
  async function startPreview(videoEl) {
    if (!hasMediaApi()) {
      state.error = "mediaDevices 非対応";
      return { ok: false, error: state.error };
    }
    if (!state.cameraOn && !state.micOn) {
      clearOwnedStream("both_off");
      state.error = "camera/mic both off";
      return { ok: false, error: state.error };
    }
    if (videoEl) state.videoEl = videoEl;

    // Reuse Formal Output when selection still matches — avoid duplicate getUserMedia.
    if (state.stream && streamMatchesSelection(state.stream)) {
      applyTrackEnabledFlags(state.stream);
      syncPublishFromFormalOutput();
      var rebound = await bindPreviewElement(state.videoEl);
      if (!rebound.ok && state.videoEl) {
        state.error = rebound.error;
        return { ok: false, error: rebound.error };
      }
      state.error = null;
      return { ok: true, stream: state.stream, reused: true, generation: state.streamGeneration };
    }

    try {
      await enumerateNow();
    } catch (_) {}

    var built = buildConstraints();
    if (!built.video && !built.audio) {
      state.error = "NO_MEDIA_INPUT";
      state.lastGumError = {
        name: "NO_MEDIA_INPUT",
        message: "no videoinput/audioinput after enumerate",
        constraint: null,
        constraints: { video: { requested: false, exact: "" }, audio: { requested: false, exact: "" } },
        selected: Object.assign({}, state.selected),
      };
      return { ok: false, error: state.error, lastGumError: state.lastGumError };
    }

    clearOwnedStream("replace");

    async function acquire(constraints) {
      var gumConstraints = { video: constraints.video, audio: constraints.audio };
      state.lastConstraints = gumConstraints;
      state.gumInvokeCount += 1;
      try {
        var stream = await navigator.mediaDevices.getUserMedia(gumConstraints);
        return { ok: true, stream: stream, constraints: gumConstraints };
      } catch (err) {
        recordGumError(err, gumConstraints);
        return { ok: false, err: err, constraints: gumConstraints };
      }
    }

    var got = await acquire(built);
    if (!got.ok && isNotFoundError(got.err) && built.video && built.audio) {
      got = await acquire(buildConstraints("video-only"));
    }
    if (!got.ok && isNotFoundError(got.err) && built.audio && !got.constraints.video) {
      got = await acquire(buildConstraints("audio-only"));
    }

    if (!got.ok) {
      state.activeOwnedStreams = 0;
      console.warn("[GoLiveMedia] getUserMedia:", state.error);
      return {
        ok: false,
        error: state.error || (got.err && got.err.name) || "getUserMedia_failed",
        lastGumError: state.lastGumError,
      };
    }

    state.stream = got.stream;
    state.activeOwnedStreams = 1;
    state.streamGeneration += 1;
    applyTrackEnabledFlags(got.stream);
    syncPublishFromFormalOutput();
    await bindPreviewElement(state.videoEl);
    state.error = null;
    state.lastGumError = null;
    notifyStreamChange("start");
    return { ok: true, stream: got.stream, reused: false, generation: state.streamGeneration };
  }

  async function setDevice(kind, deviceId) {
    if (!state.devices[kind]) return { ok: false, error: "unknown kind" };
    state.selected[kind] = String(deviceId || "");
    if (kind === "audiooutput") {
      if (state.videoEl && state.sinkIdSupported && state.selected.audiooutput) {
        try {
          await state.videoEl.setSinkId(state.selected.audiooutput);
          return { ok: true };
        } catch (e) {
          return { ok: false, error: e?.message || String(e) };
        }
      }
      return { ok: true, skipped: !state.sinkIdSupported };
    }
    return startPreview(state.videoEl);
  }

  function setCameraOn(on) {
    state.cameraOn = Boolean(on);
    if (state.stream) {
      var hasVideo = state.stream.getVideoTracks().length > 0;
      if (state.cameraOn && !hasVideo) {
        return startPreview(state.videoEl);
      }
      state.stream.getVideoTracks().forEach(function (t) {
        t.enabled = state.cameraOn;
      });
      syncPublishFromFormalOutput();
      notifyStreamChange("camera");
      return Promise.resolve({ ok: true });
    }
    return startPreview(state.videoEl);
  }

  function setMicOn(on) {
    state.micOn = Boolean(on);
    if (state.stream) {
      var hasAudio = state.stream.getAudioTracks().length > 0;
      if (state.micOn && !hasAudio) {
        return startPreview(state.videoEl);
      }
      state.stream.getAudioTracks().forEach(function (t) {
        t.enabled = state.micOn;
      });
      syncPublishFromFormalOutput();
      notifyStreamChange("mic");
      return Promise.resolve({ ok: true });
    }
    return startPreview(state.videoEl);
  }

  function stopPreview() {
    clearOwnedStream("stopPreview");
    return { ok: true };
  }

  /** Formal MediaStream Output — same reference Preview uses. Do not stop tracks. */
  function getActiveMediaStream() {
    return state.stream;
  }

  function getFormalMediaStreamOutput() {
    return state.stream;
  }

  function getVideoTrack() {
    return state.stream ? state.stream.getVideoTracks()[0] || null : null;
  }

  function getAudioTrack() {
    return state.stream ? state.stream.getAudioTracks()[0] || null : null;
  }

  /**
   * Formal Publish Input.
   * Current phase: same as Formal Output (or Scene compositedStream after setPublishStream).
   * Callers MUST NOT stop tracks unless they own a distinct composited stream.
   */
  function getPublishStream() {
    return state.publishStream || state.stream;
  }

  /**
   * Scene Editor hook: replace Publish Input with compositedStream.
   * Does not stop previous Formal Output. Does not take ownership of `stream`.
   */
  function setPublishStream(stream) {
    state.publishStream = stream || null;
    notifyStreamChange("publish_input");
    return { ok: true, stream: state.publishStream };
  }

  function clearPublishStream() {
    if (state.publishStream && state.publishStream !== state.stream) {
      state.publishStream = null;
    } else {
      state.publishStream = state.stream;
    }
    notifyStreamChange("publish_clear");
    return { ok: true };
  }

  /**
   * Subscribe to Formal Output / Publish Input changes (Scene Source 購読用).
   * @returns {function(): void} unsubscribe
   */
  function onMediaStreamChange(listener) {
    if (typeof listener !== "function") return function () {};
    streamListeners.push(listener);
    return function unsubscribe() {
      var i = streamListeners.indexOf(listener);
      if (i >= 0) streamListeners.splice(i, 1);
    };
  }

  function getState() {
    return {
      permission: state.permission,
      error: state.error,
      cameraOn: state.cameraOn,
      micOn: state.micOn,
      devices: state.devices,
      selected: Object.assign({}, state.selected),
      sinkIdSupported: state.sinkIdSupported,
      hasStream: Boolean(state.stream),
      hasPublishStream: Boolean(getPublishStream()),
      streamGeneration: state.streamGeneration,
      activeOwnedStreams: state.activeOwnedStreams,
      gumInvokeCount: state.gumInvokeCount,
      gumProbeCount: state.gumProbeCount,
      lastGumError: state.lastGumError,
      lastConstraints: state.lastConstraints,
      staleDropped: Object.assign({}, state.lastStaleDropped),
      ownership: OWNER,
      formalOutput: "getActiveMediaStream|getFormalMediaStreamOutput",
      formalPublishInput: "getPublishStream|setPublishStream",
    };
  }

  function getDiagnostics() {
    var out = getActiveMediaStream();
    var pub = getPublishStream();
    return {
      ownership: OWNER,
      streamGeneration: state.streamGeneration,
      activeOwnedStreams: state.activeOwnedStreams,
      gumInvokeCount: state.gumInvokeCount,
      gumProbeCount: state.gumProbeCount,
      formalEqualsPublish: Boolean(out && pub && out === pub),
      videoTrackId: getVideoTrack()?.id || null,
      audioTrackId: getAudioTrack()?.id || null,
      videoEnabled: getVideoTrack() ? getVideoTrack().enabled : null,
      audioEnabled: getAudioTrack() ? getAudioTrack().enabled : null,
    };
  }

  global.addEventListener("pagehide", function () {
    clearOwnedStream("pagehide");
  });
  global.addEventListener("beforeunload", function () {
    clearOwnedStream("beforeunload");
  });

  global.TasuOneTlvGoLiveMedia = {
    ensurePermissionAndList: ensurePermissionAndList,
    startPreview: startPreview,
    stopPreview: stopPreview,
    setDevice: setDevice,
    setCameraOn: setCameraOn,
    setMicOn: setMicOn,
    getState: getState,
    // Formal MediaStream Output
    getActiveMediaStream: getActiveMediaStream,
    getFormalMediaStreamOutput: getFormalMediaStreamOutput,
    getVideoTrack: getVideoTrack,
    getAudioTrack: getAudioTrack,
    bindPreviewElement: bindPreviewElement,
    onMediaStreamChange: onMediaStreamChange,
    onDeviceListChange: function (listener) {
      if (typeof listener !== "function") return function () {};
      deviceListListeners.push(listener);
      return function unsubscribe() {
        var i = deviceListListeners.indexOf(listener);
        if (i >= 0) deviceListListeners.splice(i, 1);
      };
    },
    // Formal Publish Input
    getPublishStream: getPublishStream,
    setPublishStream: setPublishStream,
    clearPublishStream: clearPublishStream,
    syncPublishFromFormalOutput: syncPublishFromFormalOutput,
    getDiagnostics: getDiagnostics,
  };
})(typeof window !== "undefined" ? window : globalThis);
