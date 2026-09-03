/**
 * one-tlv-go-live-beauty.js
 * TLV Camera Adjust (Launch) / Beauty Prototype V1 — Browser-local WebGL only.
 * AD-040: keep this module. Launch names it Camera Adjust; internals stay Beauty.
 *
 * Pipeline:
 *   Formal Camera MediaStream (owned by TasuOneTlvGoLiveMedia — never stop)
 *     → Beauty input <video>
 *     → WebGL fragment shader (brightness / smoothing / skinTone × intensity)
 *     → canvas.captureStream(fps) video-only
 *     → Scene Camera Source (via getOutputStream)
 *     → Scene Compositor → compositedStream + Formal Mic
 *
 * Launch UI: Brightness only (default OFF). Hidden grade params stay at identity.
 * avatar_only VTuber: skip camera GPU pass (do not shade VRM).
 *
 * Forbidden: getUserMedia, face-ML runtimes, GPU-next APIs, external Beauty SDK, audio re-acquire.
 */
(function (global) {
  "use strict";

  var VERSION = 1;
  var STORAGE_KEY = "tlv_go_live_beauty_v1";
  var OWNER = "TasuOneTlvGoLiveBeauty";
  var TARGET_FPS = 30;

  var DEFAULT_STATE = {
    enabled: false,
    brightness: 0, // -20..20 (UI units)
    smoothing: 0, // 0..100 — Launch identity (hidden)
    skinTone: 0, // -20..20 — Launch identity (hidden)
    intensity: 100, // 0..100 — Launch identity so brightness is 1:1
    quality: "standard", // low | standard | high
  };

  var state = {
    booted: false,
    params: cloneParams(DEFAULT_STATE),
    fallbackReason: null,
    fallbackCount: 0,
    webglOk: false,
    contextLost: false,
    restoreAttempts: 0,
    inputVideo: null,
    canvas: null,
    gl: null,
    program: null,
    tex: null,
    loc: {},
    rafId: 0,
    loopRunning: false,
    outputStream: null,
    ownedTracks: [],
    lastFrameAt: 0,
    frameCount: 0,
    fpsEstimate: 0,
    lastProcessMs: 0,
    droppedFrames: 0,
    inputW: 0,
    inputH: 0,
    outputW: 0,
    outputH: 0,
    formalGeneration: -1,
    unsubMedia: null,
  };

  var listeners = [];

  function cloneParams(p) {
    return {
      enabled: Boolean(p.enabled),
      brightness: Number(p.brightness) || 0,
      smoothing: Number(p.smoothing) || 0,
      skinTone: Number(p.skinTone) || 0,
      intensity: Number(p.intensity) || 0,
      quality: ["low", "standard", "high"].indexOf(p.quality) >= 0 ? p.quality : "standard",
    };
  }

  function clamp(n, lo, hi) {
    n = Number(n);
    if (!isFinite(n)) return lo;
    return Math.max(lo, Math.min(hi, n));
  }

  function media() {
    return global.TasuOneTlvGoLiveMedia || null;
  }

  function isAvatarOnlyVtuber() {
    try {
      var vt = global.TasuOneTlvGoLiveVtuberBasic;
      var st = vt && typeof vt.getState === "function" ? vt.getState() : null;
      return Boolean(st && st.enabled && st.cameraVisMode === "avatar_only");
    } catch (_) {
      return false;
    }
  }

  function haltCameraAdjustGpu() {
    stopLoop();
    stopOwnedOutputTracks();
  }

  function resyncProcessing() {
    if (isAvatarOnlyVtuber()) {
      haltCameraAdjustGpu();
      notify("avatar_only_skip");
      try {
        global.TasuOneTlvSceneEditor?.refreshCameraSource?.();
      } catch (_) {}
      return { ok: true, skipped: true, reason: "avatar_only" };
    }
    if (state.params.enabled) return startProcessing();
    haltCameraAdjustGpu();
    return { ok: true, skipped: false };
  }

  function notify(reason) {
    var payload = { reason: reason || "update", state: getPublicState() };
    listeners.slice().forEach(function (fn) {
      try {
        fn(payload);
      } catch (_) {}
    });
  }

  function loadPersisted() {
    try {
      var raw = global.localStorage?.getItem(STORAGE_KEY);
      if (!raw) return;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return;
      state.params = cloneParams({
        enabled: Boolean(parsed.enabled),
        brightness: clamp(parsed.brightness, -20, 20),
        smoothing: clamp(parsed.smoothing, 0, 100),
        skinTone: clamp(parsed.skinTone, -20, 20),
        intensity: clamp(parsed.intensity, 0, 100),
        quality: parsed.quality,
      });
    } catch (_) {}
  }

  function persist() {
    try {
      global.localStorage?.setItem(
        STORAGE_KEY,
        JSON.stringify({
          enabled: state.params.enabled,
          brightness: state.params.brightness,
          smoothing: state.params.smoothing,
          skinTone: state.params.skinTone,
          intensity: state.params.intensity,
          quality: state.params.quality,
        })
      );
    } catch (_) {}
  }

  var VS_SRC =
    "attribute vec2 a_pos;\n" +
    "varying vec2 v_uv;\n" +
    "void main(){\n" +
    "  v_uv = a_pos * 0.5 + 0.5;\n" +
    "  v_uv.y = 1.0 - v_uv.y;\n" +
    "  gl_Position = vec4(a_pos, 0.0, 1.0);\n" +
    "}\n";

  // Natural LIVE correction: mild brightness, edge-aware soft blur, subtle warm midtone lift.
  // Intensity scales all effects; caps keep Intensity=100 from looking heavily filtered.
  var FS_SRC =
    "precision mediump float;\n" +
    "varying vec2 v_uv;\n" +
    "uniform sampler2D u_tex;\n" +
    "uniform vec2 u_texel;\n" +
    "uniform float u_brightness;\n" +
    "uniform float u_smoothing;\n" +
    "uniform float u_skinTone;\n" +
    "uniform float u_intensity;\n" +
    "uniform float u_samples;\n" +
    "void main(){\n" +
    "  vec4 src = texture2D(u_tex, v_uv);\n" +
    "  float I = clamp(u_intensity, 0.0, 1.0);\n" +
    "  if (I < 0.001) { gl_FragColor = src; return; }\n" +
    "  float lum = dot(src.rgb, vec3(0.299, 0.587, 0.114));\n" +
    "  vec3 acc = src.rgb;\n" +
    "  float wsum = 1.0;\n" +
    "  float sm = clamp(u_smoothing, 0.0, 1.0) * I;\n" +
    "  if (sm > 0.01) {\n" +
    "    float radius = mix(0.5, 2.2, sm);\n" +
    "    float steps = max(1.0, u_samples);\n" +
    "    for (float i = 0.0; i < 8.0; i += 1.0) {\n" +
    "      if (i >= steps) break;\n" +
    "      float a = i * 2.399963;\n" +
    "      vec2 off = vec2(cos(a), sin(a)) * u_texel * radius * (1.0 + i * 0.35);\n" +
    "      vec3 s = texture2D(u_tex, v_uv + off).rgb;\n" +
    "      float sl = dot(s, vec3(0.299, 0.587, 0.114));\n" +
    "      float w = exp(-abs(sl - lum) * mix(18.0, 8.0, sm));\n" +
    "      acc += s * w;\n" +
    "      wsum += w;\n" +
    "    }\n" +
    "    acc /= wsum;\n" +
    "    // Keep high-frequency detail: do not fully replace edges.\n" +
    "    float edge = smoothstep(0.02, 0.12, abs(lum - dot(acc, vec3(0.299, 0.587, 0.114))));\n" +
    "    acc = mix(acc, src.rgb, edge * 0.65);\n" +
    "    acc = mix(src.rgb, acc, sm * 0.72);\n" +
    "  }\n" +
    "  float b = u_brightness * I;\n" +
    "  acc += vec3(b);\n" +
    "  float st = u_skinTone * I;\n" +
    "  // Midtone-biased warmth / cool — avoid crushing shadows/highlights.\n" +
    "  float mid = smoothstep(0.15, 0.35, lum) * (1.0 - smoothstep(0.7, 0.92, lum));\n" +
    "  acc.r += st * 0.045 * mid;\n" +
    "  acc.g += st * 0.02 * mid;\n" +
    "  acc.b -= st * 0.035 * mid;\n" +
    "  gl_FragColor = vec4(clamp(acc, 0.0, 1.0), src.a);\n" +
    "}\n";

  function compile(gl, type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      var info = gl.getShaderInfoLog(sh) || "compile_fail";
      gl.deleteShader(sh);
      throw new Error(info);
    }
    return sh;
  }

  function qualityScale(q) {
    if (q === "low") return 0.75;
    if (q === "high") return 1;
    return 0.85;
  }

  function qualitySamples(q) {
    if (q === "low") return 3;
    if (q === "high") return 7;
    return 5;
  }

  function destroyGl() {
    var gl = state.gl;
    if (gl) {
      try {
        if (state.tex) gl.deleteTexture(state.tex);
        if (state.program) gl.deleteProgram(state.program);
      } catch (_) {}
    }
    state.tex = null;
    state.program = null;
    state.loc = {};
    state.gl = null;
    state.webglOk = false;
  }

  function stopOwnedOutputTracks() {
    state.ownedTracks.forEach(function (t) {
      try {
        t.onended = null;
        t.stop();
      } catch (_) {}
    });
    state.ownedTracks = [];
    state.outputStream = null;
  }

  function stopLoop() {
    state.loopRunning = false;
    if (state.rafId) {
      global.cancelAnimationFrame(state.rafId);
      state.rafId = 0;
    }
  }

  function fallback(reason) {
    state.fallbackReason = String(reason || "unknown");
    state.fallbackCount += 1;
    state.params.enabled = false;
    stopLoop();
    stopOwnedOutputTracks();
    persist();
    notify("fallback:" + state.fallbackReason);
  }

  function initGl() {
    if (!state.canvas) {
      state.canvas = document.createElement("canvas");
      state.canvas.setAttribute("data-tlv-beauty-canvas", "1");
      state.canvas.width = 640;
      state.canvas.height = 360;
      state.canvas.style.cssText = "position:fixed;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;";
      (document.body || document.documentElement).appendChild(state.canvas);
      state.canvas.addEventListener(
        "webglcontextlost",
        function (e) {
          e.preventDefault();
          state.contextLost = true;
          stopLoop();
          destroyGl();
          fallback("webglcontextlost");
        },
        false
      );
      state.canvas.addEventListener(
        "webglcontextrestored",
        function () {
          if (state.restoreAttempts >= 2) return;
          state.restoreAttempts += 1;
          state.contextLost = false;
          try {
            if (!initGl()) return;
            if (state.params.enabled) startProcessing();
          } catch (_) {
            fallback("webglcontextrestored_fail");
          }
        },
        false
      );
    }

    destroyGl();
    var gl =
      state.canvas.getContext("webgl", { premultipliedAlpha: false, alpha: false, preserveDrawingBuffer: true }) ||
      state.canvas.getContext("experimental-webgl", {
        premultipliedAlpha: false,
        alpha: false,
        preserveDrawingBuffer: true,
      });
    if (!gl) {
      fallback("webgl_unsupported");
      return false;
    }
    state.gl = gl;

    try {
      var vs = compile(gl, gl.VERTEX_SHADER, VS_SRC);
      var fs = compile(gl, gl.FRAGMENT_SHADER, FS_SRC);
      var prog = gl.createProgram();
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(prog) || "link_fail");
      }
      gl.useProgram(prog);
      state.program = prog;

      var buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      var aPos = gl.getAttribLocation(prog, "a_pos");
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

      state.tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, state.tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

      state.loc = {
        tex: gl.getUniformLocation(prog, "u_tex"),
        texel: gl.getUniformLocation(prog, "u_texel"),
        brightness: gl.getUniformLocation(prog, "u_brightness"),
        smoothing: gl.getUniformLocation(prog, "u_smoothing"),
        skinTone: gl.getUniformLocation(prog, "u_skinTone"),
        intensity: gl.getUniformLocation(prog, "u_intensity"),
        samples: gl.getUniformLocation(prog, "u_samples"),
      };
      state.webglOk = true;
      state.fallbackReason = null;
      return true;
    } catch (err) {
      destroyGl();
      fallback("shader_init:" + (err && err.message ? err.message : String(err)));
      return false;
    }
  }

  function ensureInputVideo() {
    if (state.inputVideo) return state.inputVideo;
    var v = document.createElement("video");
    v.setAttribute("data-tlv-beauty-input", "1");
    v.muted = true;
    v.playsInline = true;
    v.autoplay = true;
    v.style.cssText = "position:fixed;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;";
    (document.body || document.documentElement).appendChild(v);
    state.inputVideo = v;
    return v;
  }

  function bindFormalInput(formal) {
    var v = ensureInputVideo();
    if (!formal) {
      v.srcObject = null;
      return { ok: false, error: "no_formal" };
    }
    if (v.srcObject !== formal) {
      v.srcObject = formal;
      v.muted = true;
      v.play().catch(function () {});
    }
    return { ok: true };
  }

  function resizeCanvas(vw, vh) {
    var scale = qualityScale(state.params.quality);
    var w = Math.max(160, Math.round(vw * scale));
    var h = Math.max(90, Math.round(vh * scale));
    // Cap High at 1920 edge for prototype safety.
    if (w > 1920) {
      h = Math.round((h * 1920) / w);
      w = 1920;
    }
    if (state.canvas.width !== w || state.canvas.height !== h) {
      state.canvas.width = w;
      state.canvas.height = h;
      if (state.gl) state.gl.viewport(0, 0, w, h);
    }
    state.inputW = vw;
    state.inputH = vh;
    state.outputW = w;
    state.outputH = h;
  }

  function drawFrame() {
    var gl = state.gl;
    var video = state.inputVideo;
    if (!gl || !video || video.readyState < 2) {
      state.droppedFrames += 1;
      return;
    }
    var t0 = performance.now();
    var vw = video.videoWidth || 640;
    var vh = video.videoHeight || 360;
    resizeCanvas(vw, vh);

    gl.bindTexture(gl.TEXTURE_2D, state.tex);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
    } catch (_) {
      state.droppedFrames += 1;
      return;
    }

    var p = state.params;
    var I = clamp(p.intensity, 0, 100) / 100;
    // Map UI units into gentle shader ranges.
    var brightness = (clamp(p.brightness, -20, 20) / 20) * 0.12;
    var smoothing = clamp(p.smoothing, 0, 100) / 100;
    var skinTone = clamp(p.skinTone, -20, 20) / 20;

    gl.useProgram(state.program);
    gl.uniform1i(state.loc.tex, 0);
    gl.uniform2f(state.loc.texel, 1 / state.outputW, 1 / state.outputH);
    gl.uniform1f(state.loc.brightness, brightness);
    gl.uniform1f(state.loc.smoothing, smoothing);
    gl.uniform1f(state.loc.skinTone, skinTone);
    gl.uniform1f(state.loc.intensity, I);
    gl.uniform1f(state.loc.samples, qualitySamples(p.quality));
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    state.lastProcessMs = performance.now() - t0;
    state.frameCount += 1;
    var now = performance.now();
    if (now - state.lastFrameAt >= 1000) {
      state.fpsEstimate = state.frameCount;
      state.frameCount = 0;
      state.lastFrameAt = now;
    }
  }

  function ensureOutputStream() {
    if (state.outputStream && state.ownedTracks.length) return state.outputStream;
    if (!state.canvas || typeof state.canvas.captureStream !== "function") {
      fallback("captureStream_unsupported");
      return null;
    }
    stopOwnedOutputTracks();
    try {
      var cap = state.canvas.captureStream(TARGET_FPS);
      var tracks = cap.getVideoTracks();
      tracks.forEach(function (t) {
        try {
          t._tlvOwner = OWNER;
          t._tlvDoNotStopFormal = true;
        } catch (_) {}
        state.ownedTracks.push(t);
      });
      // Video-only — Formal Mic remains Scene/compositor SSOT.
      state.outputStream = new MediaStream(tracks.slice());
      return state.outputStream;
    } catch (err) {
      fallback("captureStream:" + (err && err.message ? err.message : String(err)));
      return null;
    }
  }

  function loop() {
    if (!state.loopRunning) return;
    try {
      drawFrame();
    } catch (err) {
      fallback("draw:" + (err && err.message ? err.message : String(err)));
      return;
    }
    state.rafId = global.requestAnimationFrame(loop);
  }

  function startProcessing() {
    if (!state.params.enabled) return { ok: false, reason: "disabled" };
    if (isAvatarOnlyVtuber()) {
      haltCameraAdjustGpu();
      return { ok: false, reason: "avatar_only" };
    }
    if (state.contextLost) return { ok: false, reason: "context_lost" };
    var formal = media()?.getFormalMediaStreamOutput?.() || media()?.getActiveMediaStream?.();
    if (!formal) {
      // Soft: stay enabled in state but no output until Formal exists.
      stopLoop();
      stopOwnedOutputTracks();
      notify("waiting_formal");
      return { ok: false, reason: "no_formal" };
    }
    bindFormalInput(formal);
    if (!state.webglOk && !initGl()) return { ok: false, reason: state.fallbackReason || "webgl" };
    if (!ensureOutputStream()) return { ok: false, reason: state.fallbackReason || "capture" };
    if (!state.loopRunning) {
      state.loopRunning = true;
      state.lastFrameAt = performance.now();
      state.frameCount = 0;
      state.rafId = global.requestAnimationFrame(loop);
    }
    notify("processing");
    return { ok: true };
  }

  function stopProcessing() {
    stopLoop();
    stopOwnedOutputTracks();
    notify("stopped");
  }

  function syncFromFormal(reason) {
    var formal = media()?.getFormalMediaStreamOutput?.() || media()?.getActiveMediaStream?.();
    var gen = media()?.getDiagnostics?.()?.streamGeneration;
    if (typeof gen === "number") state.formalGeneration = gen;
    if (!state.params.enabled) {
      bindFormalInput(formal);
      return;
    }
    if (isAvatarOnlyVtuber()) {
      bindFormalInput(formal);
      haltCameraAdjustGpu();
      return;
    }
    if (!formal) {
      stopProcessing();
      notify("formal_cleared");
      return;
    }
    bindFormalInput(formal);
    startProcessing();
    notify(reason || "formal_change");
  }

  function subscribeMedia() {
    if (state.unsubMedia) {
      try {
        state.unsubMedia();
      } catch (_) {}
      state.unsubMedia = null;
    }
    var m = media();
    if (!m?.onMediaStreamChange) return;
    state.unsubMedia = m.onMediaStreamChange(function (payload) {
      // Never call getUserMedia — only follow Formal Output revisions.
      // Ignore publish_input to avoid Scene setPublishStream ↔ Beauty notify loops.
      if (payload && payload.reason === "publish_input") return;
      syncFromFormal("media_change");
      try {
        global.TasuOneTlvSceneEditor?.refreshCameraSource?.();
      } catch (_) {}
    });
  }

  function getPublicState() {
    return {
      version: VERSION,
      enabled: state.params.enabled && Boolean(state.outputStream) && !state.contextLost,
      desiredEnabled: state.params.enabled,
      brightness: state.params.brightness,
      smoothing: state.params.smoothing,
      skinTone: state.params.skinTone,
      intensity: state.params.intensity,
      quality: state.params.quality,
      fallbackReason: state.fallbackReason,
      fallbackCount: state.fallbackCount,
      webglOk: state.webglOk,
      contextLost: state.contextLost,
      processing: state.loopRunning,
      avatarOnlySkip: isAvatarOnlyVtuber(),
    };
  }

  function getMetrics() {
    return {
      inputResolution: { width: state.inputW, height: state.inputH },
      outputResolution: { width: state.outputW, height: state.outputH },
      renderFps: state.fpsEstimate,
      processMs: Number(state.lastProcessMs.toFixed(2)),
      droppedFrames: state.droppedFrames,
      webglInit: state.webglOk,
      fallbackCount: state.fallbackCount,
      fallbackReason: state.fallbackReason,
      loopRunning: state.loopRunning,
      ownedOutputTracks: state.ownedTracks.length,
    };
  }

  function getDiagnostics() {
    return {
      version: VERSION,
      storageKey: STORAGE_KEY,
      owner: OWNER,
      state: getPublicState(),
      metrics: getMetrics(),
      hasOutputStream: Boolean(state.outputStream),
      gumCallsForbidden: true,
      audioTracksOnBeautyStream: state.outputStream ? state.outputStream.getAudioTracks().length : 0,
      duplicateLoop: state.loopRunning && state.rafId ? 1 : 0,
    };
  }

  function setEnabled(on) {
    state.params.enabled = Boolean(on);
    if (!state.params.enabled) {
      state.fallbackReason = null;
      stopProcessing();
      persist();
      try {
        global.TasuOneTlvSceneEditor?.refreshCameraSource?.();
      } catch (_) {}
      notify("disabled");
      return { ok: true, enabled: false };
    }
    persist();
    var r = startProcessing();
    try {
      global.TasuOneTlvSceneEditor?.refreshCameraSource?.();
    } catch (_) {}
    return r;
  }

  function setParams( partial ) {
    partial = partial || {};
    if (partial.brightness != null) state.params.brightness = clamp(partial.brightness, -20, 20);
    if (partial.smoothing != null) state.params.smoothing = clamp(partial.smoothing, 0, 100);
    if (partial.skinTone != null) state.params.skinTone = clamp(partial.skinTone, -20, 20);
    if (partial.intensity != null) state.params.intensity = clamp(partial.intensity, 0, 100);
    if (partial.quality != null && ["low", "standard", "high"].indexOf(partial.quality) >= 0) {
      state.params.quality = partial.quality;
    }
    persist();
    notify("params");
    return { ok: true, params: cloneParams(state.params) };
  }

  /**
   * Stream Scene Camera should draw when Beauty is actively processing.
   * Returns null → Scene must use Formal Raw.
   */
  function getOutputStream() {
    if (isAvatarOnlyVtuber()) return null;
    if (!state.params.enabled || state.contextLost || !state.webglOk) return null;
    if (!state.outputStream) return null;
    return state.outputStream;
  }

  function getOutputCanvas() {
    return state.canvas;
  }

  function boot() {
    if (state.booted) return { ok: true, reused: true };
    loadPersisted();
    ensureInputVideo();
    subscribeMedia();
    global.addEventListener("pagehide", cleanup);
    global.addEventListener("beforeunload", cleanup);
    state.booted = true;
    if (state.params.enabled) startProcessing();
    notify("boot");
    return { ok: true };
  }

  function cleanup() {
    stopProcessing();
    destroyGl();
    if (state.unsubMedia) {
      try {
        state.unsubMedia();
      } catch (_) {}
      state.unsubMedia = null;
    }
    if (state.inputVideo) {
      try {
        state.inputVideo.srcObject = null;
      } catch (_) {}
    }
    // Do not remove canvas/video nodes aggressively on soft cleanup — Formal ownership untouched.
    notify("cleanup");
  }

  global.TasuOneTlvGoLiveBeauty = {
    VERSION: VERSION,
    STORAGE_KEY: STORAGE_KEY,
    boot: boot,
    setEnabled: setEnabled,
    setParams: setParams,
    getState: getPublicState,
    getParams: function () {
      return cloneParams(state.params);
    },
    getOutputStream: getOutputStream,
    resyncProcessing: resyncProcessing,
    getOutputCanvas: getOutputCanvas,
    getMetrics: getMetrics,
    getDiagnostics: getDiagnostics,
    syncFromFormal: syncFromFormal,
    onChange: function (fn) {
      if (typeof fn !== "function") return function () {};
      listeners.push(fn);
      return function () {
        listeners = listeners.filter(function (x) {
          return x !== fn;
        });
      };
    },
    cleanup: cleanup,
    /** QA: force fallback path without stopping Formal tracks */
    __qaForceFallback: function (reason) {
      fallback(reason || "qa");
      try {
        global.TasuOneTlvSceneEditor?.refreshCameraSource?.();
      } catch (_) {}
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
