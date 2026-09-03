/**
 * one-tlv-go-live-data-adapter.js
 * Maps Stitch Go Live Studio DOM ↔ media controller + existing broadcast service.
 * Does not alter layout/colors/structure — only values, options, preview video node, status text.
 */
(function (global) {
  "use strict";

  function norm(s) {
    return String(s || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function statusLine(msg) {
    var p = document.querySelector("main h1 + p");
    if (p) p.textContent = msg;
    if (document.body) document.body.setAttribute("data-go-live-status", String(msg || "").slice(0, 180));
  }

  function tt(key, vars) {
    var L = global.TasuTlvGoLiveLabelsJa;
    return L && typeof L.t === "function" ? L.t(key, vars) : key;
  }

  function userMsg(code, fallback) {
    var L = global.TasuTlvGoLiveLabelsJa;
    if (L && typeof L.userMessage === "function") return L.userMessage(code, fallback);
    return fallback || tt("code.unknown");
  }

  function fieldAfterLabel(labelMatch) {
    var labels = document.querySelectorAll("label");
    for (var i = 0; i < labels.length; i++) {
      if (labelMatch.test(norm(labels[i].textContent))) {
        var wrap = labels[i].closest(".space-y-2, .space-y-1, .space-y-5") || labels[i].parentElement;
        var el = wrap && wrap.querySelector("input, textarea, select");
        if (el) return el;
      }
    }
    return null;
  }

  function fieldCamera() {
    return fieldAfterLabel(/Camera Device|^Camera$|カメラ/i);
  }
  function fieldMic() {
    return fieldAfterLabel(/Microphone Device|^Microphone$|マイク/i);
  }
  function fieldOutput() {
    return fieldAfterLabel(/Audio Output|^Audio output$|音声出力/i);
  }

  function toggleRow(labelText) {
    var aliases = {
      "Camera Feed": ["Camera Feed", "カメラ"],
      "Mic Feed": ["Mic Feed", "マイク"],
      "Auto Quality": ["Auto Quality", "自動画質"],
      "Noise Cancel": ["Noise Cancel", "ノイズ抑制"],
      "Echo Cancel": ["Echo Cancel", "エコー抑制"],
    };
    var keys = aliases[labelText] || [labelText];
    var rows = document.querySelectorAll(".flex.items-center.justify-between");
    for (var i = 0; i < rows.length; i++) {
      var text = norm(rows[i].textContent);
      for (var k = 0; k < keys.length; k++) {
        if (text.indexOf(keys[k]) >= 0) return rows[i];
      }
    }
    return null;
  }

  function setToggleVisual(row, on) {
    if (!row) return;
    var track = row.querySelector(".rounded-full.relative, .w-10.h-5, .w-8.h-4");
    var knob = row.querySelector(".absolute");
    if (!track || !knob) return;
    if (on) {
      track.classList.add("bg-primary/80", "bg-primary/60");
      track.classList.remove("bg-white/10");
      knob.classList.add("right-0.5");
      knob.classList.remove("left-0.5");
      knob.classList.add("bg-white");
      knob.classList.remove("bg-white/40");
    } else {
      track.classList.remove("bg-primary/80", "bg-primary/60");
      track.classList.add("bg-white/10");
      knob.classList.add("left-0.5");
      knob.classList.remove("right-0.5");
      knob.classList.add("bg-white/40");
    }
    row.setAttribute("data-toggle-on", on ? "1" : "0");
  }

  function isToggleOn(row) {
    if (!row) return false;
    if (row.getAttribute("data-toggle-on") != null) return row.getAttribute("data-toggle-on") === "1";
    var knob = row.querySelector(".absolute");
    return Boolean(knob && /\bright-0/.test(knob.className));
  }

  function fillSelect(select, devices, selectedId, emptyLabel) {
    if (!select) return;
    select.innerHTML = "";
    if (!devices.length) {
      var o = document.createElement("option");
      o.value = "";
      o.textContent = emptyLabel || "デバイスなし";
      select.appendChild(o);
      select.disabled = true;
      return;
    }
    select.disabled = false;
    devices.forEach(function (d) {
      var opt = document.createElement("option");
      opt.value = d.deviceId;
      opt.textContent = d.label;
      if (d.deviceId === selectedId) opt.selected = true;
      select.appendChild(opt);
    });
  }

  function ensurePreviewVideo() {
    var host = document.querySelector("main .aspect-video.bg-black, main .aspect-video");
    if (!host) return null;
    host.setAttribute("data-go-live-preview-host", "1");
    var existing = host.querySelector("video[data-go-live-preview]");
    if (existing) return existing;
    var video = document.createElement("video");
    video.setAttribute("data-go-live-preview", "1");
    video.setAttribute("autoplay", "");
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.className = "absolute inset-0 z-[1] h-full w-full object-cover bg-black";
    host.appendChild(video);
    var poster = host.querySelector(".absolute.inset-0.bg-cover");
    if (poster) poster.style.opacity = "0.25";
    return video;
  }

  /**
   * LIVE PREVIEW expand control.
   * Audit (iPhone / iOS Safari):
   * - Element.requestFullscreen on div/wrapper: typically unsupported → Promise reject / no-op
   * - HTMLVideoElement.webkitEnterFullscreen: may exist, but expands <video> only (Scene canvas not included)
   * - DEV QA fallback: CSS fixed inset:0 on preview host (wrapper) — no native fullscreen required
   * Does not touch Beauty / Tencent / Scene / Publish contracts.
   */
  function wirePreviewFullscreen() {
    var STYLE_ID = "tlv-go-live-preview-expand-style";
    var EXPAND_CLASS = "tlv-go-live-preview-expanded";
    var BODY_LOCK = "tlv-go-live-preview-expanded-lock";

    function ensureStyle() {
      if (document.getElementById(STYLE_ID)) return;
      var style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent =
        "." +
        EXPAND_CLASS +
        '[data-go-live-preview-host]{position:fixed!important;inset:0!important;z-index:2147483000!important;width:100vw!important;height:100vh!important;height:100dvh!important;max-width:none!important;aspect-ratio:auto!important;border-radius:0!important;background:#000!important;}' +
        "body." +
        BODY_LOCK +
        "{overflow:hidden!important;touch-action:none;}" +
        "." +
        EXPAND_CLASS +
        " [data-go-live-preview-fullscreen-icon]{font-variation-settings:'FILL' 1;}";
      document.head.appendChild(style);
    }

    function probeCaps(video) {
      var elProto = typeof Element !== "undefined" ? Element.prototype : null;
      return {
        requestFullscreen: Boolean(elProto && typeof elProto.requestFullscreen === "function"),
        webkitRequestFullscreen: Boolean(elProto && typeof elProto.webkitRequestFullscreen === "function"),
        videoWebkitEnterFullscreen: Boolean(video && typeof video.webkitEnterFullscreen === "function"),
        isiOS: /iPad|iPhone|iPod/i.test(String(navigator.userAgent || "")) ||
          (navigator.platform === "MacIntel" && Number(navigator.maxTouchPoints || 0) > 1),
      };
    }

    function setExpanded(host, on) {
      ensureStyle();
      host.classList.toggle(EXPAND_CLASS, on);
      document.body.classList.toggle(BODY_LOCK, on);
      var icon = document.querySelector("[data-go-live-preview-fullscreen-icon]");
      if (icon) icon.textContent = on ? "fullscreen_exit" : "fullscreen";
      var btn = document.querySelector("[data-go-live-preview-fullscreen]");
      if (btn) {
        btn.setAttribute("aria-pressed", on ? "true" : "false");
        btn.title = on ? "拡大を終了" : "プレビューを拡大";
      }
    }

    function isCssExpanded(host) {
      return host.classList.contains(EXPAND_CLASS);
    }

    async function tryNativeHostFullscreen(host) {
      var fn = host.requestFullscreen || host.webkitRequestFullscreen || host.msRequestFullscreen;
      if (typeof fn !== "function") {
        return { ok: false, method: "none", error: "Element.requestFullscreen unsupported" };
      }
      try {
        var ret = fn.call(host);
        if (ret && typeof ret.then === "function") await ret;
        return { ok: true, method: host.requestFullscreen ? "requestFullscreen" : "webkitRequestFullscreen" };
      } catch (err) {
        return {
          ok: false,
          method: "requestFullscreen",
          error: (err && err.name ? err.name + ": " : "") + String((err && err.message) || err),
        };
      }
    }

    function tryVideoWebkitFullscreen(video) {
      if (!video || typeof video.webkitEnterFullscreen !== "function") {
        return { ok: false, method: "webkitEnterFullscreen", error: "unsupported" };
      }
      try {
        video.webkitEnterFullscreen();
        return { ok: true, method: "webkitEnterFullscreen" };
      } catch (err) {
        return {
          ok: false,
          method: "webkitEnterFullscreen",
          error: (err && err.name ? err.name + ": " : "") + String((err && err.message) || err),
        };
      }
    }

    function resolveHost() {
      ensurePreviewVideo();
      return (
        document.querySelector("[data-go-live-preview-host]") ||
        document.querySelector("main .aspect-video.bg-black, main .aspect-video")
      );
    }

    function resolveButton() {
      var host = resolveHost();
      var btn =
        document.querySelector("[data-go-live-preview-fullscreen]") ||
        (host && host.querySelector('button [data-icon="fullscreen"]')
          ? host.querySelector('button [data-icon="fullscreen"]').closest("button")
          : null);
      if (btn && !btn.getAttribute("data-go-live-preview-fullscreen")) {
        btn.setAttribute("data-go-live-preview-fullscreen", "1");
      }
      return btn;
    }

    var btn = resolveButton();
    if (!btn || btn.getAttribute("data-go-live-fs-wired") === "1") return;
    btn.setAttribute("data-go-live-fs-wired", "1");
    btn.type = "button";

    document.addEventListener("keydown", function (ev) {
      if (ev.key !== "Escape") return;
      var host = resolveHost();
      if (host && isCssExpanded(host)) {
        setExpanded(host, false);
        statusLine(tt("previewExpandOff"));
      }
    });

    document.addEventListener("fullscreenchange", function () {
      var host = resolveHost();
      if (!host) return;
      if (!document.fullscreenElement && isCssExpanded(host) === false) {
        var icon = document.querySelector("[data-go-live-preview-fullscreen-icon]");
        if (icon) icon.textContent = "fullscreen";
      }
    });

    btn.addEventListener("click", function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      var host = resolveHost();
      if (!host) {
        statusLine("Preview expand: host not found");
        return;
      }
      host.setAttribute("data-go-live-preview-host", "1");
      var video = host.querySelector("video[data-go-live-preview]");
      var caps = probeCaps(video);

      // Toggle CSS expand off if already expanded
      if (isCssExpanded(host)) {
        setExpanded(host, false);
        statusLine("Preview expand: CSS off");
        return;
      }

      // iOS / no Element fullscreen: skip native div fullscreen (unsupported) → CSS fallback.
      // Prefer CSS host expand so Scene canvas + video stay visible together.
      if (caps.isiOS || !caps.requestFullscreen) {
        var webkitTry = null;
        // Optional: attempt video webkit first only if no Scene canvas overlay (video-only preview).
        var hasSceneCanvas = Boolean(host.querySelector("canvas"));
        if (!hasSceneCanvas && caps.videoWebkitEnterFullscreen) {
          webkitTry = tryVideoWebkitFullscreen(video);
          if (webkitTry.ok) {
            statusLine("Preview fullscreen: webkitEnterFullscreen");
            return;
          }
        }
        setExpanded(host, true);
        statusLine(
          "Preview expand: CSS fallback" +
            (webkitTry && webkitTry.error ? " · webkit=" + webkitTry.error : "") +
            (caps.isiOS ? " · iOS" : " · no requestFullscreen")
        );
        return;
      }

      // Desktop / supporting browsers: try native host fullscreen, then CSS fallback.
      Promise.resolve(tryNativeHostFullscreen(host)).then(function (native) {
        if (native.ok) {
          statusLine("Preview fullscreen: " + native.method);
          return;
        }
        setExpanded(host, true);
        statusLine("Preview expand: CSS fallback · native=" + (native.error || "fail"));
      });
    });
  }

  function collectDetails() {
    var titleEl = fieldAfterLabel(/Stream Title|配信タイトル/i);
    var descEl = fieldAfterLabel(/^Description$|^説明$/i);
    var catEl = fieldAfterLabel(/^Category$|^カテゴリ$/i);
    var visEl = fieldAfterLabel(/^Visibility$|^公開範囲$/i);
    var resEl = fieldAfterLabel(/^Resolution$/i);
    var fpsEl = fieldAfterLabel(/^FPS$/i);
    var bitLabel = null;
    var labels = document.querySelectorAll("label");
    for (var li = 0; li < labels.length; li++) {
      if (/Bitrate/i.test(norm(labels[li].textContent))) {
        bitLabel = labels[li];
        break;
      }
    }
    var bitWrap = bitLabel ? bitLabel.closest(".space-y-2") || bitLabel.parentElement : null;
    var bitEl = bitWrap ? bitWrap.querySelector('input[type="range"]') : null;

    var tags = [];
    document.querySelectorAll(".flex.flex-wrap.gap-2 span").forEach(function (s) {
      var t = norm(s.textContent);
      if (t && t.indexOf("+") !== 0 && t.charAt(0) === "#") tags.push(t);
    });

    return {
      title: titleEl ? titleEl.value : "",
      description: descEl ? descEl.value : "",
      category: catEl ? catEl.value : "",
      visibility: visEl ? visEl.value : "",
      tags: tags,
      resolution: resEl ? resEl.value : "",
      fps: fpsEl ? fpsEl.value : "",
      bitrate: bitEl ? String(bitEl.value) : "",
      autoQuality: isToggleOn(toggleRow("Auto Quality")),
      noiseCancel: isToggleOn(toggleRow("Noise Cancel")),
      echoCancel: isToggleOn(toggleRow("Echo Cancel")),
      titleEl: titleEl,
    };
  }

  function wireThumbnailLocal() {
    var box = null;
    var allLabels = document.querySelectorAll("label");
    for (var i = 0; i < allLabels.length; i++) {
      if (/Thumbnail|サムネイル/i.test(norm(allLabels[i].textContent))) {
        box = allLabels[i];
        break;
      }
    }
    var wrap = box ? box.closest(".space-y-2") || box.parentElement : null;
    var drop = wrap ? wrap.querySelector(".aspect-video, .border-dashed") : null;
    if (!drop || drop.getAttribute("data-thumb-wired")) return;
    drop.setAttribute("data-thumb-wired", "1");
    var input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp";
    input.className = "hidden";
    input.setAttribute("data-go-live-thumb-input", "1");
    drop.appendChild(input);
    var objectUrl = null;
    drop.addEventListener("click", function () {
      input.click();
    });
    input.addEventListener("change", function () {
      var file = input.files && input.files[0];
      if (!file) return;
      if (!/^image\/(png|jpeg|webp)$/i.test(file.type)) {
        statusLine(tt("statusThumbType"));
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        statusLine(tt("statusThumbSize"));
        return;
      }
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = URL.createObjectURL(file);
      drop.style.backgroundImage = "url('" + objectUrl + "')";
      drop.style.backgroundSize = "cover";
      drop.style.backgroundPosition = "center";
      statusLine(tt("statusThumbLocal"));
      global.addEventListener(
        "pagehide",
        function () {
          if (objectUrl) URL.revokeObjectURL(objectUrl);
        },
        { once: true }
      );
    });
  }

  function startButtons() {
    var marked = document.querySelectorAll("[data-tlv-go-live-cta]");
    if (marked.length) return Array.prototype.slice.call(marked);
    var out = [];
    var L = global.TasuTlvGoLiveLabelsJa && global.TasuTlvGoLiveLabelsJa.LABELS;
    document.querySelectorAll("button").forEach(function (b) {
      var t = norm(b.textContent);
      if (
        /^START LIVE/i.test(t) ||
        /START LIVE NOW/i.test(t) ||
        /^END LIVE/i.test(t) ||
        /^Start Live/i.test(t) ||
        /^End Live/i.test(t) ||
        (L &&
          (t === L.startLive ||
            t === L.startLiveNow ||
            t === L.endLive ||
            t === "配信開始" ||
            t === "今すぐ配信開始" ||
            t === "配信終了"))
      ) {
        out.push(b);
      }
    });
    return out;
  }

  function setStartButtonsLabel(live) {
    var endLabel = tt("endLive");
    var nowLabel = tt("startLiveNow");
    var startLabel = tt("startLive");
    startButtons().forEach(function (b) {
      var kind = b.getAttribute("data-tlv-go-live-cta");
      var t = norm(b.textContent);
      var isNow =
        kind === "start-now" ||
        /NOW/i.test(t) ||
        t.indexOf("今すぐ") >= 0 ||
        t === nowLabel;
      if (live) b.textContent = endLabel;
      else b.textContent = isNow ? nowLabel : startLabel;
    });
  }

  async function refreshDevicesIntoUi() {
    var media = global.TasuOneTlvGoLiveMedia;
    var res = await media.ensurePermissionAndList();
    var st = media.getState();
    var cam = fieldCamera();
    var mic = fieldMic();
    var out = fieldOutput();
    fillSelect(cam, st.devices.videoinput, st.selected.videoinput, tt("emptyCamera"));
    fillSelect(mic, st.devices.audioinput, st.selected.audioinput, tt("emptyMic"));
    fillSelect(out, st.devices.audiooutput, st.selected.audiooutput, st.sinkIdSupported ? tt("emptyOutput") : tt("sinkUnsupported"));
    if (out) {
      out.disabled = !st.sinkIdSupported || !st.devices.audiooutput.length;
      if (!st.sinkIdSupported) {
        out.title = tt("sinkUnsupported");
      }
    }
    if (res.permission === "denied") statusLine(tt("statusPermDenied"));
    else if (res.permission === "unsupported") statusLine(tt("statusMediaUnsupported"));
    else if (!st.devices.videoinput.length) statusLine(tt("statusNoCamera"));
    return res;
  }

  async function applyPreview() {
    var video = ensurePreviewVideo();
    if (!video) return;
    var mediaApi = global.TasuOneTlvGoLiveMedia;
    var r = await mediaApi.startPreview(video);
    if (!r.ok) {
      var gum = r.lastGumError || mediaApi.getState?.().lastGumError || {};
      var detail = [userMsg(r.error, r.error || tt("statusPreviewFail"))];
      if (gum.message && String(gum.message) !== String(r.error) && !/constraint|NotAllowed|NotFound|Overconstrained/i.test(String(gum.message))) {
        detail.push(String(gum.message).slice(0, 80));
      }
      if (gum.constraints && gum.constraints.video && gum.constraints.video.exact) {
        detail.push("cam=" + gum.constraints.video.exact);
      }
      if (gum.constraints && gum.constraints.audio && gum.constraints.audio.exact) {
        detail.push("mic=" + gum.constraints.audio.exact);
      }
      statusLine(tt("statusPreviewFail"));
      var poster = document.querySelector("[data-go-live-preview-host] .absolute.inset-0.bg-cover");
      if (poster) poster.style.opacity = "0.8";
      return;
    }
    // Preview must display Formal MediaStream Output (single stream contract) unless Scene Editor takes over.
    var formal = mediaApi.getFormalMediaStreamOutput?.() || mediaApi.getActiveMediaStream?.();
    if (formal && video.srcObject !== formal) {
      await mediaApi.bindPreviewElement?.(video);
    }
    global.TasuOneTlvGoLiveService?.attachFormalPublishInput?.();

    var scene = global.TasuOneTlvSceneEditor;
    if (scene) {
      if (document.querySelector("[data-tlv-scene-root]")) {
        scene.onFormalStreamReady?.();
      } else {
        scene.boot?.();
      }
      var sdiag = scene.getDiagnostics?.() || {};
      statusLine(tt("statusPreviewReady"));
      return;
    }

    var diag = mediaApi.getDiagnostics?.() || {};
    var reuseNote = r.reused ? "reuse" : "new";
    statusLine(tt("statusPreviewReady"));
  }

  function wireDeviceChanges() {
    var cam = fieldCamera();
    var mic = fieldMic();
    var out = fieldOutput();
    if (cam)
      cam.addEventListener("change", function () {
        global.TasuOneTlvGoLiveMedia.setDevice("videoinput", cam.value).then(function (r) {
          if (!r.ok) statusLine(tt("statusCamSwitchFail"));
        });
      });
    if (mic)
      mic.addEventListener("change", function () {
        global.TasuOneTlvGoLiveMedia.setDevice("audioinput", mic.value).then(function (r) {
          if (!r.ok) statusLine(tt("statusMicSwitchFail"));
        });
      });
    if (out)
      out.addEventListener("change", function () {
        global.TasuOneTlvGoLiveMedia.setDevice("audiooutput", out.value).then(function (r) {
          if (!r.ok) statusLine(tt("statusOutSwitchFail"));
        });
      });
  }

  function wireToggles() {
    var camRow = toggleRow("Camera Feed");
    var micRow = toggleRow("Mic Feed");
    setToggleVisual(camRow, true);
    setToggleVisual(micRow, true);
    if (camRow) {
      camRow.style.cursor = "pointer";
      camRow.addEventListener("click", function () {
        var next = !isToggleOn(camRow);
        setToggleVisual(camRow, next);
        global.TasuOneTlvGoLiveMedia.setCameraOn(next);
      });
    }
    if (micRow) {
      micRow.style.cursor = "pointer";
      micRow.addEventListener("click", function () {
        var next = !isToggleOn(micRow);
        setToggleVisual(micRow, next);
        global.TasuOneTlvGoLiveMedia.setMicOn(next);
      });
    }
    ["Auto Quality", "Noise Cancel", "Echo Cancel"].forEach(function (label) {
      var row = toggleRow(label);
      if (!row) return;
      row.style.cursor = "pointer";
      if (row.getAttribute("data-toggle-on") == null) {
        setToggleVisual(row, isToggleOn(row));
      }
      row.addEventListener("click", function () {
        setToggleVisual(row, !isToggleOn(row));
        syncUiOnly();
      });
    });
  }

  function syncUiOnly() {
    var d = collectDetails();
    global.TasuOneTlvGoLiveService.setUiDetails({
      description: d.description,
      category: d.category,
      visibility: d.visibility,
      tags: d.tags,
      resolution: d.resolution,
      fps: d.fps,
      bitrate: d.bitrate,
      autoQuality: d.autoQuality,
      noiseCancel: d.noiseCancel,
      echoCancel: d.echoCancel,
    });
  }

  async function onStartOrStop(e) {
    if (e) e.preventDefault();
    var svc = global.TasuOneTlvGoLiveService;
    var sess = svc.getSession();
    if (sess.phase === "live") {
      statusLine(tt("statusStopping"));
      var stop = await svc.controlledStop();
      if (!stop.ok) {
        statusLine(userMsg(stop.code, stop.message) || tt("statusStopFail"));
        return;
      }
      setStartButtonsLabel(false);
      try {
        global.TasuTlvBroadcasterHud?.stop?.();
      } catch (_) {}
      statusLine(tt("statusStopped"));
      return;
    }

    syncUiOnly();
    var d = collectDetails();
    if (!svc.validateTitle(d.title).ok) {
      statusLine(svc.validateTitle(d.title).message);
      if (d.titleEl) d.titleEl.focus();
      return;
    }

    statusLine(tt("statusStarting"));
    var previewHost = document.querySelector("[data-go-live-preview-host]");
    var result = await svc.controlledStart({
      title: d.title,
      requireMedia: false,
      confirm: true,
      videoContainer: previewHost,
    });

    if (!result.ok) {
      statusLine(userMsg(result.code, result.message));
      return;
    }

    setStartButtonsLabel(true);
    var id = result.broadcast?.id || "";
    try {
      global.TasuTlvBroadcasterHud?.start?.({
        broadcastId: id,
        startedAt: result.broadcast?.started_at || null,
        broadcast: result.broadcast || null,
      });
    } catch (hudErr) {
      console.warn("[GoLiveAdapter] broadcaster HUD:", hudErr);
    }
    statusLine(tt("statusLiveStarted"));
    if (document.body) {
      document.body.setAttribute("data-broadcast-id", id);
      document.body.setAttribute("data-formal-publish", result.formalPublishReady ? "1" : "0");
    }
    global.TasuOneTlvSceneCommentsAdapter?.syncFromGoLive?.();
  }

  function wireStartButtons() {
    startButtons().forEach(function (b) {
      // Remove prior mock handlers by cloning
      var nb = b.cloneNode(true);
      b.parentNode.replaceChild(nb, b);
      nb.addEventListener("click", onStartOrStop);
      nb.setAttribute("data-go-live-start", "1");
    });
  }

  function applyLaunchCameraAdjustIdentity(beauty) {
    if (!beauty || typeof beauty.setParams !== "function") return;
    beauty.setParams({ smoothing: 0, skinTone: 0, intensity: 100 });
  }

  function refreshCameraAdjustAfterVtuber() {
    try {
      global.TasuOneTlvGoLiveBeauty?.resyncProcessing?.();
    } catch (_) {}
    try {
      global.TasuOneTlvSceneEditor?.refreshCameraSource?.();
    } catch (_) {}
  }

  function isSnapEffectsLaunchSurface() {
    try {
      var q = new URLSearchParams(global.location.search || "");
      return q.get("tlvEffectsQa") === "1" || q.get("tlvEffectsDebug") === "1";
    } catch (_) {
      return false;
    }
  }

  function wireBeautyControls() {
    var beauty = global.TasuOneTlvGoLiveBeauty;
    if (!beauty) return;
    beauty.boot?.();
    try {
      var pocQ = new URLSearchParams(global.location.search || "");
      if (pocQ.get("tlvBeautyPoc") !== "1") applyLaunchCameraAdjustIdentity(beauty);
    } catch (_) {
      applyLaunchCameraAdjustIdentity(beauty);
    }

    var panel = document.querySelector("[data-tlv-beauty-panel]");
    var toggleRowEl = document.querySelector("[data-tlv-beauty-toggle-row]");
    var toggleTrack = document.querySelector("[data-tlv-beauty-toggle]");
    var sliders = document.querySelector("[data-tlv-beauty-sliders]");
    if (!panel || !toggleRowEl) return;

    function syncUiFromState() {
      var p = beauty.getParams?.() || {};
      var st = beauty.getState?.() || {};
      var on = Boolean(p.enabled);
      if (toggleTrack) {
        var knob = toggleTrack.querySelector("[data-tlv-beauty-toggle-knob]") || toggleTrack.querySelector(".absolute");
        if (on) {
          toggleTrack.classList.add("bg-primary/80");
          toggleTrack.classList.remove("bg-white/10");
          if (knob) {
            knob.classList.add("right-0.5");
            knob.classList.remove("left-0.5");
            knob.classList.add("bg-white");
            knob.classList.remove("bg-white/40");
          }
        } else {
          toggleTrack.classList.remove("bg-primary/80");
          toggleTrack.classList.add("bg-white/10");
          if (knob) {
            knob.classList.add("left-0.5");
            knob.classList.remove("right-0.5");
            knob.classList.add("bg-white/40");
            knob.classList.remove("bg-white");
          }
        }
      }
      if (sliders) {
        if (on) sliders.classList.remove("hidden");
        else sliders.classList.add("hidden");
      }
      ["brightness", "smoothing", "skinTone", "intensity"].forEach(function (key) {
        var input = panel.querySelector('[data-tlv-beauty-param="' + key + '"]');
        var val = panel.querySelector('[data-tlv-beauty-val="' + key + '"]');
        if (input && p[key] != null) input.value = String(p[key]);
        if (val && p[key] != null) val.textContent = String(p[key]);
      });
      panel.setAttribute("data-tlv-beauty-enabled", on ? "1" : "0");
      panel.setAttribute("data-tlv-beauty-fallback", st.fallbackReason || "");
    }

    toggleRowEl.style.cursor = "pointer";
    toggleRowEl.addEventListener("click", function (e) {
      if (e.target && e.target.closest && e.target.closest("[data-tlv-beauty-param]")) return;
      if (e.target && e.target.closest && e.target.closest("[data-tlv-camera-adjust-reset]")) return;
      var next = !(beauty.getParams?.().enabled);
      if (next) applyLaunchCameraAdjustIdentity(beauty);
      beauty.setEnabled(next);
      syncUiFromState();
      if (next && beauty.getState?.().fallbackReason) {
        statusLine(tt("statusBeautyOff"));
      } else {
        statusLine(next ? tt("statusBeautyOn") : tt("statusBeautyOff"));
      }
    });

    var resetBtn = panel.querySelector("[data-tlv-camera-adjust-reset]");
    if (resetBtn) {
      resetBtn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        beauty.setParams({ brightness: 0, smoothing: 0, skinTone: 0, intensity: 100 });
        syncUiFromState();
      });
    }

    panel.querySelectorAll("[data-tlv-beauty-param]").forEach(function (input) {
      input.addEventListener("input", function () {
        var key = input.getAttribute("data-tlv-beauty-param");
        var num = Number(input.value);
        var patch = {};
        patch[key] = num;
        if (key === "brightness") {
          patch.smoothing = 0;
          patch.skinTone = 0;
          patch.intensity = 100;
        }
        beauty.setParams(patch);
        var val = panel.querySelector('[data-tlv-beauty-val="' + key + '"]');
        if (val) val.textContent = String(num);
      });
      // Prevent toggle row click when dragging slider
      input.addEventListener("click", function (e) {
        e.stopPropagation();
      });
    });

    beauty.onChange?.(function () {
      syncUiFromState();
    });
    syncUiFromState();
  }

  function wireBeautyPocControls() {
    var poc = global.TasuOneTlvGoLiveBeautyTencentPoc;
    if (!poc) return;

    var panels = Array.prototype.slice.call(document.querySelectorAll("[data-tlv-beauty-poc-panel]"));
    var docks = Array.prototype.slice.call(document.querySelectorAll("[data-tlv-beauty-poc-mobile-dock]"));
    var statusEls = Array.prototype.slice.call(document.querySelectorAll("[data-tlv-beauty-poc-status]"));
    var modeButtons = Array.prototype.slice.call(document.querySelectorAll("[data-tlv-beauty-poc-mode]"));
    if (!panels.length && !docks.length) return;

    // Never activate PoC wiring outside Dev / QA surface — keeps Production / normal Go Live clean.
    if (!poc.isPocSurface?.()) {
      panels.forEach(function (el) {
        el.classList.add("hidden");
      });
      docks.forEach(function (el) {
        el.classList.add("hidden");
      });
      return;
    }

    poc.boot?.();
    panels.forEach(function (el) {
      el.classList.remove("hidden");
    });
    docks.forEach(function (el) {
      el.classList.remove("hidden");
    });

    // PoC selector is SSOT during QA — disable master Beauty toggle so it cannot fight modes.
    var beautyToggle = document.querySelector("[data-tlv-beauty-toggle]");
    var beautyToggleRow = document.querySelector("[data-tlv-beauty-toggle-row]");
    var beautySliders = document.querySelector("[data-tlv-beauty-sliders]");
    if (beautyToggle) {
      beautyToggle.style.opacity = "0.35";
      beautyToggle.style.pointerEvents = "none";
      beautyToggle.setAttribute("aria-disabled", "true");
      beautyToggle.title = "Beauty PoC (Dev) 比較中は PoC セレクタを使用";
    }
    if (beautyToggleRow) {
      beautyToggleRow.style.opacity = "0.55";
    }
    if (beautySliders) {
      beautySliders.classList.add("hidden");
    }

    function syncPocUi() {
      var st = poc.getState?.() || {};
      modeButtons.forEach(function (btn) {
        var mode = btn.getAttribute("data-tlv-beauty-poc-mode");
        var active = st.mode === mode;
        btn.classList.toggle("bg-amber-500/30", active);
        btn.classList.toggle("border-amber-400/50", active);
        btn.classList.toggle("bg-white/5", !active);
      });
      statusEls.forEach(function (statusEl) {
        var parts = [];
        if (st.mode === "premium_tencent" && st.premiumAccessAllowed) {
          parts.push(st.premiumAccessLabel || "Premium利用中");
        } else if (st.blockedCode === "PREMIUM_ACCESS_DENIED") {
          parts.push("Premium Option");
        } else {
          parts.push("mode=" + (st.mode || "off"));
        }
        if (st.blockedCode && st.blockedCode !== "PREMIUM_ACCESS_DENIED") {
          parts.push(st.blockedCode);
        }
        if (st.lastError && st.blockedCode === "PREMIUM_ACCESS_DENIED") {
          /* keep label short — no internal grant economics */
        } else if (st.lastError) {
          parts.push(String(st.lastError).slice(0, 80));
        }
        if (st.ready) parts.push("ready");
        statusEl.textContent = parts.join(" · ");
      });
      panels.forEach(function (panel) {
        panel.setAttribute("data-tlv-beauty-poc-mode", st.mode || "off");
        panel.setAttribute("data-tlv-beauty-poc-blocked", st.blockedCode || "");
      });
    }

    modeButtons.forEach(function (btn) {
      if (btn.getAttribute("data-tlv-beauty-poc-wired") === "1") return;
      btn.setAttribute("data-tlv-beauty-poc-wired", "1");
      btn.addEventListener("click", function () {
        var mode = btn.getAttribute("data-tlv-beauty-poc-mode");
        statusLine("Beauty PoC → " + mode + " …");
        Promise.resolve(poc.setMode(mode)).then(function (r) {
          syncPocUi();
          if (r && r.ok) statusLine("Beauty PoC mode: " + (r.mode || mode));
          else statusLine("Beauty PoC blocked: " + ((r && r.code) || "error"));
        });
      });
    });

    poc.onChange?.(function () {
      syncPocUi();
    });
    syncPocUi();
  }

  function wireBeautySnowPocControls() {
    var core = global.TasuOneTlvGoLiveBeautyTencentPoc;
    var snow = global.TasuOneTlvGoLiveBeautyTencentSnowPoc;
    if (!core || !snow) return;
    if (!core.isPocSurface?.()) {
      document.querySelectorAll("[data-tlv-beauty-snow-panel]").forEach(function (el) {
        el.classList.add("hidden");
      });
      return;
    }

    var STYLE_ID = "tlv-beauty-snow-sheet-style";
    if (!document.getElementById(STYLE_ID)) {
      var style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent =
        "body.tlv-go-live-preview-expanded-lock [data-tlv-beauty-snow-sheet]," +
        "body.tlv-go-live-preview-expanded-lock [data-tlv-beauty-poc-mobile-dock]{" +
        "z-index:2147483600!important;bottom:0.75rem!important;max-height:46vh!important;}" +
        "[data-tlv-beauty-snow-panel]{scroll-margin-bottom:8rem;}";
      document.head.appendChild(style);
    }

    document.querySelectorAll("[data-tlv-beauty-snow-panel]").forEach(function (el) {
      el.classList.remove("hidden");
    });

    var SLIDER_KEYS = [
      ["whiten", "Whiten"],
      ["dermabrasion", "Smooth"],
      ["lift", "Face Slim"],
      ["shave", "Jaw/V-line"],
      ["eye", "Big Eyes"],
      ["chin", "Chin"],
      ["nose", "Nose"],
      ["cheekbone", "Cheekbone"],
      ["forehead", "Forehead"],
      ["head", "Head"],
    ];

    function ensureFaceSliders(root) {
      if (!root || root.getAttribute("data-wired") === "1") return;
      root.setAttribute("data-wired", "1");
      SLIDER_KEYS.forEach(function (pair) {
        var key = pair[0];
        var label = pair[1];
        var row = document.createElement("div");
        row.className = "space-y-0.5";
        row.innerHTML =
          '<div class="flex justify-between text-[10px] text-on-surface-variant">' +
          "<span>" +
          label +
          '</span><span data-tlv-beauty-snow-face-val="' +
          key +
          '">0.00</span></div>' +
          '<input data-tlv-beauty-snow-face-param="' +
          key +
          '" type="range" min="0" max="100" value="0" class="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-400"/>';
        root.appendChild(row);
      });
    }

    document.querySelectorAll("[data-tlv-beauty-snow-face-sliders]").forEach(ensureFaceSliders);

    function clamp01(n) {
      n = Number(n);
      if (!isFinite(n)) return 0;
      return Math.max(0, Math.min(1, n));
    }

    function formatStatus(st) {
      return [
        "SDK:" + (st.sdk || "?"),
        "Auth:" + (st.auth || "?"),
        "License:" + (st.license || "?"),
        "Effect:" + (st.effect || "?"),
        st.pageHostname ? "Host:" + st.pageHostname : null,
        st.hasProcessedOutput ? "OutStream:YES" : "OutStream:NO",
        st.effectId ? "ID:" + String(st.effectId).slice(0, 24) : null,
        st.category ? "Cat:" + st.category : null,
        st.errorCode ? "Err:" + st.errorCode : null,
        st.errorMessage ? String(st.errorMessage).slice(0, 72) : null,
        st.outputTrackState ? "Track:" + st.outputTrackState : null,
        st.catalogCounts
          ? "lists f=" +
            st.catalogCounts.filters +
            " m=" +
            st.catalogCounts.makeup +
            " s=" +
            st.catalogCounts.stickers +
            " cat=" +
            st.catalogCounts.catAnimalHits
          : null,
      ]
        .filter(Boolean)
        .join(" · ");
    }

    function syncPanes(tab) {
      document.querySelectorAll("[data-tlv-beauty-snow-pane]").forEach(function (pane) {
        var name = pane.getAttribute("data-tlv-beauty-snow-pane");
        pane.classList.toggle("hidden", name !== tab || tab === "OFF");
      });
      document.querySelectorAll("[data-tlv-beauty-snow-tab]").forEach(function (btn) {
        var active = btn.getAttribute("data-tlv-beauty-snow-tab") === tab;
        btn.classList.toggle("bg-cyan-500/30", active);
        btn.classList.toggle("border-cyan-300/60", active);
      });
    }

    function fillEffectButtons(listEls, emptyEls, items, category, emptyLabel) {
      listEls.forEach(function (list) {
        list.innerHTML = "";
        if (!items.length) return;
        items.slice(0, 40).forEach(function (item) {
          var btn = document.createElement("button");
          btn.type = "button";
          btn.className =
            "min-h-11 w-full text-left text-[10px] sm:text-xs px-3 py-2 rounded-xl bg-white/5 border border-white/10";
          var badge = item.catAnimalHint ? " · CAT/ANIMAL?" : "";
          btn.textContent = (item.name || item.id) + badge;
          btn.setAttribute("data-effect-id", item.id);
          btn.addEventListener("click", function () {
            statusLine("Snow " + category + " → " + item.name);
            snow.setEffectById(item.id, category).then(function (r) {
              refresh();
              if (!r || !r.ok) statusLine("Snow effect fail: " + ((r && r.code) || "error"));
            });
          });
          list.appendChild(btn);
        });
      });
      emptyEls.forEach(function (el) {
        if (!items.length) {
          el.textContent = emptyLabel;
          el.classList.remove("hidden");
        } else {
          el.classList.add("hidden");
        }
      });
    }

    function fillFilters(items) {
      document.querySelectorAll("[data-tlv-beauty-snow-filter-list]").forEach(function (list) {
        list.innerHTML = "";
        var none = document.createElement("button");
        none.type = "button";
        none.className =
          "min-h-11 w-full text-left text-xs px-3 py-2 rounded-xl bg-white/5 border border-white/10";
        none.textContent = "None";
        none.addEventListener("click", function () {
          snow.setFilter(null).then(refresh);
        });
        list.appendChild(none);
        if (!items.length) {
          var miss = document.createElement("div");
          miss.className = "text-[10px] text-on-surface-variant";
          miss.textContent = "MATERIAL_REQUIRED · getCommonFilter empty / not probed";
          list.appendChild(miss);
          return;
        }
        items.slice(0, 40).forEach(function (item) {
          var btn = document.createElement("button");
          btn.type = "button";
          btn.className =
            "min-h-11 w-full text-left text-[10px] sm:text-xs px-3 py-2 rounded-xl bg-white/5 border border-white/10";
          btn.textContent = item.name || item.id;
          btn.addEventListener("click", function () {
            var intensity =
              Number(
                (document.querySelector("[data-tlv-beauty-snow-filter-intensity]") || {}).value || 50
              ) / 100;
            snow.setFilter(item.id, intensity).then(function (r) {
              refresh();
              if (!r || !r.ok) statusLine("Filter fail: " + ((r && r.code) || "error"));
            });
          });
          list.appendChild(btn);
        });
      });
    }

    function refresh() {
      var st = snow.getStatus() || {};
      document.querySelectorAll("[data-tlv-beauty-snow-status]").forEach(function (el) {
        el.textContent = formatStatus(st);
      });
      syncPanes(st.tab || "OFF");
      var params = st.faceParams || {};
      Object.keys(params).forEach(function (k) {
        document.querySelectorAll('[data-tlv-beauty-snow-face-val="' + k + '"]').forEach(function (el) {
          el.textContent = Number(params[k] || 0).toFixed(2);
        });
        document.querySelectorAll('[data-tlv-beauty-snow-face-param="' + k + '"]').forEach(function (input) {
          if (document.activeElement === input) return;
          input.value = String(Math.round(clamp01(params[k]) * 100));
        });
      });
      document.querySelectorAll("[data-tlv-beauty-snow-face]").forEach(function (btn) {
        var active = btn.getAttribute("data-tlv-beauty-snow-face") === st.facePreset;
        btn.classList.toggle("bg-cyan-500/30", active);
      });
      var cat = snow.getCatalog?.() || {};
      fillEffectButtons(
        Array.prototype.slice.call(document.querySelectorAll("[data-tlv-beauty-snow-makeup-list]")),
        Array.prototype.slice.call(document.querySelectorAll("[data-tlv-beauty-snow-makeup-empty]")),
        cat.makeup || [],
        "makeup",
        "MATERIAL_REQUIRED · Trial makeup list empty"
      );
      var arItems = (cat.catAnimalHits && cat.catAnimalHits.length ? cat.catAnimalHits : []).concat(
        cat.stickers || []
      );
      var seen = {};
      arItems = arItems.filter(function (x) {
        if (seen[x.id]) return false;
        seen[x.id] = true;
        return true;
      });
      fillEffectButtons(
        Array.prototype.slice.call(document.querySelectorAll("[data-tlv-beauty-snow-ar-list]")),
        Array.prototype.slice.call(document.querySelectorAll("[data-tlv-beauty-snow-ar-empty]")),
        arItems,
        "sticker",
        "CUSTOM_MATERIAL_REQUIRED / no cat·animal sticker in Trial list"
      );
      fillFilters(cat.filters || []);
    }

    document.querySelectorAll("[data-tlv-beauty-snow-tab]").forEach(function (btn) {
      if (btn.getAttribute("data-snow-wired") === "1") return;
      btn.setAttribute("data-snow-wired", "1");
      btn.addEventListener("click", function () {
        var tab = btn.getAttribute("data-tlv-beauty-snow-tab");
        statusLine("Snow tab → " + tab);
        snow.setTab(tab).then(function (r) {
          if (tab !== "OFF") {
            return snow.probeCapabilityCatalog().then(function () {
              refresh();
              if (r && r.ok === false) statusLine("Snow: " + (r.code || "blocked"));
            });
          }
          refresh();
          if (r && r.ok === false) statusLine("Snow: " + (r.code || "blocked"));
        });
      });
    });

    document.querySelectorAll("[data-tlv-beauty-snow-face]").forEach(function (btn) {
      if (btn.getAttribute("data-snow-wired") === "1") return;
      btn.setAttribute("data-snow-wired", "1");
      btn.addEventListener("click", function () {
        var preset = btn.getAttribute("data-tlv-beauty-snow-face");
        snow.setFacePreset(preset).then(function (r) {
          refresh();
          statusLine(r && r.ok ? "FACE " + preset : "FACE fail: " + ((r && r.code) || "err"));
        });
      });
    });

    document.querySelectorAll("[data-tlv-beauty-snow-face-param]").forEach(function (input) {
      if (input.getAttribute("data-snow-wired") === "1") return;
      input.setAttribute("data-snow-wired", "1");
      input.addEventListener("input", function () {
        var key = input.getAttribute("data-tlv-beauty-snow-face-param");
        var val = Number(input.value) / 100;
        snow.setFaceParam(key, val).then(refresh);
      });
    });

    document.querySelectorAll("[data-tlv-beauty-snow-filter-intensity]").forEach(function (input) {
      if (input.getAttribute("data-snow-wired") === "1") return;
      input.setAttribute("data-snow-wired", "1");
      input.addEventListener("input", function () {
        var v = Number(input.value) / 100;
        document.querySelectorAll("[data-tlv-beauty-snow-filter-val]").forEach(function (el) {
          el.textContent = v.toFixed(2);
        });
        var st = snow.getStatus() || {};
        if (st.filterId) snow.setFilter(st.filterId, v).then(refresh);
      });
    });

    document.querySelectorAll("[data-tlv-beauty-snow-adv]").forEach(function (btn) {
      if (btn.getAttribute("data-snow-wired") === "1") return;
      btn.setAttribute("data-snow-wired", "1");
      btn.addEventListener("click", function () {
        var kind = btn.getAttribute("data-tlv-beauty-snow-adv");
        snow.tryAdvanced(kind).then(function (r) {
          refresh();
          if (r && r.code === "LICENSE_EDITION_BLOCK") {
            btn.disabled = true;
            btn.classList.add("opacity-50");
            btn.title = "REQUIRES_HIGHER_EDITION";
            statusLine("ADVANCED blocked: REQUIRES_HIGHER_EDITION");
          } else if (!r || !r.ok) {
            statusLine("ADVANCED: " + ((r && r.code) || "fail"));
          } else {
            statusLine("ADVANCED invoked · confirm visually");
          }
        });
      });
    });

    core.onChange?.(function () {
      refresh();
    });
    refresh();
  }

  function wireSnapEffectsControls() {
    var panel = document.querySelector("[data-tlv-effects-panel]");
    if (!panel) return;
    if (!isSnapEffectsLaunchSurface()) {
      panel.classList.add("hidden");
      panel.setAttribute("hidden", "");
      panel.setAttribute("data-tlv-launch-hidden", "1");
      return;
    }
    panel.classList.remove("hidden");
    panel.removeAttribute("hidden");
    panel.removeAttribute("data-tlv-launch-hidden");

    function api() {
      return global.TasuOneTlvGoLiveSnapEffects || null;
    }

    function catalogApi() {
      return global.TasuOneTlvSnapEffectsCatalog || null;
    }

    function escapeHtml(s) {
      return String(s || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }

    function formatSnapEffectsError(err) {
      if (!err) return "";
      var code = String(err.code || "").trim();
      var msg = String(err.message || "").trim();
      if (code === "NO_TOKEN") return "TOKEN_UNAVAILABLE";
      if (!msg || msg === code) return code;
      return (code + " · " + msg).slice(0, 180);
    }

    function statusLabel(st) {
      var selected = st.selectedEffectId || "";
      var pending = st.pendingEffectId || "";
      if (st.lastError && !selected && !st.loading) return "FAILED";
      if (st.loading || (pending && pending !== selected)) {
        return st.catalogLoading ? "APPLYING · catalog" : "APPLYING";
      }
      if (selected) return "ACTIVE";
      return "OFF";
    }

    function syncUi() {
      var fx = api();
      var cat = catalogApi();
      var st = fx?.getState?.() || {};
      var items = fx?.getCatalog?.() || [];
      var statusEl = panel.querySelector("[data-tlv-effects-status]");
      var emptyEl = panel.querySelector("[data-tlv-effects-empty]");
      var errEl = panel.querySelector("[data-tlv-effects-error]");
      var grid = panel.querySelector("[data-tlv-effects-grid]");
      var candBox = panel.querySelector("[data-tlv-effects-candidates]");
      var candGrid = panel.querySelector("[data-tlv-effects-candidates-grid]");
      var qaLabel = panel.querySelector("[data-tlv-effects-qa-label]");
      var offBtn = panel.querySelector("[data-tlv-effects-off]");
      var debugBox = panel.querySelector("[data-tlv-effects-debug]");
      var selected = st.selectedEffectId || "";
      var candidateItems = cat && cat.beautyCandidates ? cat.beautyCandidates(items) : items.filter(function (row) { return row && row.beauty_candidate; });
      var remainderItems = cat && cat.qaCatalogRemainder ? cat.qaCatalogRemainder(items) : items.filter(function (row) { return !(row && row.beauty_candidate); });
      if (!st.qaSurface) {
        candidateItems = [];
        remainderItems = items;
      }
      if (statusEl) {
        var parts = [statusLabel(st)];
        if (st.origin && st.origin.code === "TRUSTED_ORIGIN_MISMATCH") parts.push("use HTTPS tunnel");
        if (st.fallbackReason) parts.push(st.fallbackReason);
        statusEl.textContent = parts.join(" · ");
      }
      if (offBtn) {
        var offActive = !selected;
        offBtn.classList.toggle("bg-primary/40", offActive);
        offBtn.classList.toggle("border-primary/50", offActive);
        offBtn.setAttribute("aria-pressed", offActive ? "true" : "false");
      }
      if (emptyEl) {
        emptyEl.classList.toggle("hidden", items.length > 0 || st.loading);
      }
      if (errEl) {
        var errText = formatSnapEffectsError(st.lastError);
        errEl.textContent = errText.slice(0, 180);
        errEl.hidden = !errText;
      }
      if (debugBox) {
        var debugOn = Boolean(st.debugSurface);
        debugBox.classList.toggle("hidden", !debugOn);
        panel.setAttribute("data-debug", debugOn ? "1" : "0");
      }
      function renderEffectTiles(target, rows, stamp) {
        if (!target) return;
        if (target.getAttribute("data-tlv-effects-rendered") === stamp) return;
        target.setAttribute("data-tlv-effects-rendered", stamp);
        target.innerHTML = rows
          .map(function (row) {
            var access = fx?.canUseEffect?.(row.effect_id) || cat?.canUseEffect?.(row) || {};
            var locked = Boolean(access.locked);
            var active = row.effect_id === selected;
            var title = escapeHtml(row.title || row.effect_id);
            var thumb = row.thumbnail && /^https?:\/\//i.test(row.thumbnail) ? row.thumbnail : "";
            var catLabel = row.category ? '<div class="text-[9px] text-on-surface-variant truncate">' + escapeHtml(row.category) + "</div>" : "";
            var lockLabel = locked ? '<div class="text-[9px] text-amber-300">LOCKED</div>' : "";
            var img = thumb
              ? '<img src="' + escapeHtml(thumb) + '" alt="" class="w-full aspect-square object-cover rounded-md bg-white/5"/>'
              : '<div class="w-full aspect-square rounded-md bg-white/10 flex items-center justify-center text-[10px] text-on-surface-variant">Fx</div>';
            return (
              '<button type="button" data-tlv-effects-tile="' +
              escapeHtml(row.effect_id) +
              '" data-locked="' +
              (locked ? "1" : "0") +
              '" class="min-h-11 min-w-0 w-full text-left rounded-lg border px-1.5 py-1.5 ' +
              (active ? "bg-primary/40 border-primary/50" : "bg-white/5 border-white/10") +
              (locked ? " opacity-60" : "") +
              '">' +
              img +
              '<div class="mt-1 text-[10px] leading-tight truncate">' +
              title +
              "</div>" +
              catLabel +
              lockLabel +
              "</button>"
            );
          })
          .join("");
      }
      var stamp = [items.length, candidateItems.length, remainderItems.length, selected, Boolean(st.loading)].join(":");
      if (candBox) candBox.classList.toggle("hidden", candidateItems.length === 0);
      if (qaLabel) qaLabel.classList.toggle("hidden", !(st.qaSurface && remainderItems.length));
      renderEffectTiles(candGrid, candidateItems, stamp + ":c");
      renderEffectTiles(grid, remainderItems, stamp + ":q");
      panel.querySelectorAll("[data-tlv-effects-tile]").forEach(function (btn) {
        if (btn.getAttribute("data-tlv-effects-bound") === "1") return;
        btn.setAttribute("data-tlv-effects-bound", "1");
        btn.addEventListener("click", function (e) {
          requestEffect(btn.getAttribute("data-tlv-effects-tile"), "tile", e);
        });
      });
    }

    var queuedEffectId = null;
    var wired = false;

    function requestEffect(id, source, ev) {
      if (ev) {
        if (ev.__tlvEffectsHandled) return;
        ev.__tlvEffectsHandled = true;
        try {
          ev.preventDefault();
        } catch (_) {}
      }
      var effectId = String(id || "").trim();
      if (!effectId) return;
      var statusEl = panel.querySelector("[data-tlv-effects-status]");
      var errEl = panel.querySelector("[data-tlv-effects-error]");
      var tile = panel.querySelector('[data-tlv-effects-tile="' + effectId + '"]');
      if (tile && tile.getAttribute("data-locked") === "1") {
        if (statusEl) statusEl.textContent = tt("statusEffectsLocked");
        statusLine(tt("statusEffectsLocked"));
        syncUi();
        return;
      }
      if (statusEl) statusEl.textContent = "APPLYING";
      if (errEl) {
        errEl.hidden = true;
        errEl.textContent = "";
      }
      var fx = api();
      var fn = fx && (fx.selectEffect || fx.applyEffect);
      if (!fx || typeof fn !== "function") {
        queuedEffectId = effectId;
        if (statusEl) statusEl.textContent = "APPLYING · waiting";
        return;
      }
      Promise.resolve(fn.call(fx, effectId, { source: source || "click" }))
        .then(function (r) {
          syncUi();
          if (r && r.ok) statusLine(tt("statusEffectOn"));
          else statusLine(userMsg((r && r.code) || "unknown"));
        })
        .catch(function (err) {
          if (statusEl) statusEl.textContent = "FAILED";
          if (errEl) {
            errEl.hidden = false;
            errEl.textContent = String((err && err.message) || err || "apply_failed").slice(0, 180);
          }
          statusLine(tt("statusEffectsOff"));
          syncUi();
        });
    }

    function waitApi(cb) {
      if (api()) return cb(api());
      var n = 0;
      var t = setInterval(function () {
        n += 1;
        if (api() || n > 120) {
          clearInterval(t);
          if (api()) cb(api());
          else syncUi();
        }
      }, 250);
    }

    function attach(fx) {
      if (!fx) return;
      if (wired) {
        if (queuedEffectId) {
          var replay = queuedEffectId;
          queuedEffectId = null;
          requestEffect(replay, "queued");
        }
        syncUi();
        return;
      }
      wired = true;
      fx.boot?.();
      panel.querySelector("[data-tlv-effects-off]")?.addEventListener("click", function () {
        queuedEffectId = null;
        Promise.resolve(fx.removeEffect())
          .then(function () {
            syncUi();
            statusLine(tt("statusEffectsOff"));
          })
          .catch(function (err) {
            statusLine("Effects OFF failed: " + String((err && err.message) || err).slice(0, 80));
            syncUi();
          });
      });
      panel.addEventListener("click", function (e) {
        var tile = e.target && e.target.closest && e.target.closest("[data-tlv-effects-tile]");
        if (!tile || !panel.contains(tile)) return;
        requestEffect(tile.getAttribute("data-tlv-effects-tile"), "delegate", e);
      });
      panel.querySelector("[data-tlv-effects-debug-apply]")?.addEventListener("click", function () {
        var lens = panel.querySelector("[data-tlv-effects-debug-lens]");
        var group = panel.querySelector("[data-tlv-effects-debug-group]");
        Promise.resolve(fx.applyDebugLens(lens && lens.value, group && group.value)).then(function (r) {
          syncUi();
          statusLine(r && r.ok ? "Debug Lens applied" : "Debug: " + ((r && r.code) || "denied"));
        });
      });
      fx.onChange?.(syncUi);
      syncUi();
      if (queuedEffectId) {
        var queued = queuedEffectId;
        queuedEffectId = null;
        requestEffect(queued, "queued");
      }
    }

    if (document.documentElement.getAttribute("data-tlv-effects-doc-wired") !== "1") {
      document.documentElement.setAttribute("data-tlv-effects-doc-wired", "1");
      document.addEventListener(
        "click",
        function (e) {
          var tile = e.target && e.target.closest && e.target.closest("[data-tlv-effects-tile]");
          if (!tile) return;
          requestEffect(tile.getAttribute("data-tlv-effects-tile"), "document", e);
        },
        true
      );
    }

    waitApi(attach);
    window.addEventListener("tlv-snap-effects-ready", function () {
      if (api()) attach(api());
    });
  }

  function wireVtuberBasicControls() {
    var panel = document.querySelector("[data-tlv-vtuber-panel]");
    if (!panel) return;

    function api() {
      return global.TasuOneTlvGoLiveVtuberBasic || null;
    }

    function syncUi() {
      var vt = api();
      var st = vt?.getState?.() || { enabled: false, tracking: true, mirror: true, cameraVisMode: "both" };
      panel.querySelectorAll("[data-tlv-vtuber-mode]").forEach(function (btn) {
        var mode = btn.getAttribute("data-tlv-vtuber-mode");
        var active = mode === "basic" ? Boolean(st.enabled) : !st.enabled;
        btn.classList.toggle("bg-primary/40", active);
        btn.classList.toggle("border-primary/50", active);
      });
      var statusEl = panel.querySelector("[data-tlv-vtuber-status]");
      if (statusEl) {
        var parts = [st.enabled ? tt("vtuber") : tt("vtuberStatusOff")];
        if (st.hasVrm) parts.push("VRM");
        statusEl.textContent = parts.join(" · ");
      }
      var licEl = panel.querySelector("[data-tlv-vtuber-license]");
      if (licEl) {
        var lic = st.licenseMeta || null;
        if (!lic) {
          licEl.textContent = tt("licenseLineEmpty");
        } else {
          var bits = [];
          if (lic.title) bits.push(String(lic.title).slice(0, 40));
          if (lic.author) bits.push(tt("licenseBy", { name: String(lic.author).slice(0, 28) }));
          bits.push(tt("licenseCommercial", { value: lic.commercialUsage || "—" }));
          if (lic.incomplete) bits.push(tt("licenseIncomplete"));
          bits.push(tt("licenseNoAutoOk"));
          licEl.textContent = bits.join(" · ");
        }
      }
      var trackBtn = panel.querySelector("[data-tlv-vtuber-tracking]");
      if (trackBtn) trackBtn.textContent = st.tracking ? tt("trackingOn") : tt("trackingOff");
      var mirrorBtn = panel.querySelector("[data-tlv-vtuber-mirror]");
      if (mirrorBtn) mirrorBtn.textContent = st.mirror ? tt("mirrorOn") : tt("mirrorOff");
      panel.querySelectorAll("[data-tlv-vtuber-camvis]").forEach(function (btn) {
        var active = btn.getAttribute("data-tlv-vtuber-camvis") === st.cameraVisMode;
        btn.classList.toggle("bg-primary/40", active);
      });
    }

    function withApi(fn, timeoutMs) {
      var vt = api();
      if (vt) return Promise.resolve(fn(vt));
      var max = Math.max(8, Math.ceil((timeoutMs || 20000) / 250));
      return new Promise(function (resolve) {
        var n = 0;
        var t = setInterval(function () {
          n += 1;
          var ready = api();
          if (ready || n > max) {
            clearInterval(t);
            if (!ready) {
              resolve({ ok: false, error: "VTuber runtime not loaded" });
              return;
            }
            resolve(fn(ready));
          }
        }, 250);
      });
    }

    if (panel.getAttribute("data-tlv-vtuber-mode-wired") !== "1") {
      panel.setAttribute("data-tlv-vtuber-mode-wired", "1");
      panel.addEventListener("click", function (ev) {
        var btn = ev.target && ev.target.closest && ev.target.closest("[data-tlv-vtuber-mode]");
        if (!btn || !panel.contains(btn)) return;
        var mode = btn.getAttribute("data-tlv-vtuber-mode");
        statusLine(mode === "basic" ? tt("statusVtuberStarting") : tt("statusVtuberStopping"));
        withApi(function (vt) {
          vt.boot?.();
          return Promise.resolve(vt.setEnabled(mode === "basic")).then(function (r) {
            syncUi();
            if (r && r.ok === false) statusLine(userMsg(r.error, r.error) || tt("statusVtuberFail"));
            else statusLine(mode === "basic" ? tt("statusVtuberOn") : tt("statusVtuberOff"));
            return r;
          });
        }).then(function (r) {
          if (r && r.ok === false) statusLine(userMsg(r.error, r.error) || tt("statusVtuberFail"));
        });
      });
    }

    function waitApi(cb) {
      if (api()) return cb(api());
      var n = 0;
      var t = setInterval(function () {
        n += 1;
        if (api() || n > 80) {
          clearInterval(t);
          if (api()) cb(api());
          else syncUi();
        }
      }, 250);
    }

    waitApi(function (vt) {
      vt.boot?.();
      var file = panel.querySelector("[data-tlv-vtuber-file]");
      if (file) {
        file.addEventListener("change", function () {
          var f = file.files && file.files[0];
          if (!f) return;
          Promise.resolve(vt.loadVrmFile(f)).then(function (r) {
            syncUi();
            statusLine(r && r.ok ? tt("statusVrmLoaded") : userMsg((r && r.error) || "VRM_LOAD_FAILURE"));
          });
        });
      }
      panel.querySelector("[data-tlv-vtuber-preset]")?.addEventListener("click", function () {
        Promise.resolve(vt.loadPresetVrm?.()).then(function (r) {
          syncUi();
          statusLine(r && r.ok ? tt("statusPresetLoaded") : userMsg((r && r.error) || "VRM_LOAD_FAILURE"));
        });
      });
      panel.querySelector("[data-tlv-vtuber-tracking]")?.addEventListener("click", function () {
        var next = !(vt.getState?.().tracking);
        vt.setTracking(next);
        syncUi();
      });
      panel.querySelector("[data-tlv-vtuber-mirror]")?.addEventListener("click", function () {
        var next = !(vt.getState?.().mirror);
        vt.setMirror(next);
        syncUi();
      });
      panel.querySelectorAll("[data-tlv-vtuber-camvis]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          vt.setCameraVisMode(btn.getAttribute("data-tlv-vtuber-camvis"));
          syncUi();
          refreshCameraAdjustAfterVtuber();
        });
      });
      vt.onChange?.(function () {
        syncUi();
        refreshCameraAdjustAfterVtuber();
      });
      syncUi();
    });
  }

  async function boot() {
    if (document.body) {
      document.body.setAttribute("data-go-live-adapter", "1");
    }
    try {
      global.TasuTlvGoLiveLabelsJa?.applyStaticDom?.(document);
    } catch (_) {}
    statusLine(tt("statusInit"));

    wireThumbnailLocal();
    wireToggles();
    wireBeautyControls();
    wireBeautyPocControls();
    wireBeautySnowPocControls();
    wireSnapEffectsControls();
    wirePreviewFullscreen();
    wireVtuberBasicControls();
    // Apply JA after cloning start buttons
    wireStartButtons();
    try {
      global.TasuTlvGoLiveLabelsJa?.applyStaticDom?.(document);
      setStartButtonsLabel(false);
    } catch (_) {}

    var auth = await global.TasuOneTlvGoLiveService.checkAuth();
    if (!auth.ok) {
      statusLine(userMsg(auth.code, auth.message));
    } else {
      var perm = await global.TasuOneTlvGoLiveService.checkPermission(auth.userId);
      if (!perm.ok) statusLine(userMsg(perm.code, perm.message));
      else statusLine(tt("statusPermOk"));
    }

    await refreshDevicesIntoUi();
    wireDeviceChanges();
    syncUiOnly();

    var mediaCtl = global.TasuOneTlvGoLiveMedia;
    if (mediaCtl?.onDeviceListChange) {
      mediaCtl.onDeviceListChange(function () {
        refreshDevicesIntoUi().then(function () {
          var stNow = mediaCtl.getState();
          if (!stNow.hasStream && stNow.devices.videoinput.length) applyPreview();
        });
      });
    }

    // Auto-start preview only when a camera was actually enumerated.
    if (mediaCtl.getState().devices.videoinput.length) {
      await applyPreview();
    } else {
      // Allow user gesture: click preview host
      var host = document.querySelector("main .aspect-video");
      if (host) {
        host.style.cursor = "pointer";
        host.title = tt("previewClickToStart");
        host.addEventListener(
          "click",
          async function () {
            await refreshDevicesIntoUi();
            await applyPreview();
          },
          { once: true }
        );
      }
    }

    // Scene Editor V1 — mount layout even before camera (geometry restore)
    if (global.TasuOneTlvSceneEditor?.boot) {
      global.TasuOneTlvSceneEditor.boot();
      if (global.TasuOneTlvGoLiveMedia.getState().hasStream) {
        global.TasuOneTlvSceneEditor.onFormalStreamReady();
      }
      global.TasuOneTlvSceneCommentsAdapter?.syncFromGoLive?.();
    }

    global.__ONE_TLV_GO_LIVE_DATA__ = {
      session: global.TasuOneTlvGoLiveService.getSession(),
      media: global.TasuOneTlvGoLiveMedia.getState(),
      scene: global.TasuOneTlvSceneEditor?.getDiagnostics?.() || null,
      beauty: global.TasuOneTlvGoLiveBeauty?.getDiagnostics?.() || null,
      snapEffects: global.TasuOneTlvGoLiveSnapEffects?.getDiagnostics?.() || null,
    };

    if (document.documentElement.getAttribute("data-tlv-golive-i18n-wired") !== "1") {
      document.documentElement.setAttribute("data-tlv-golive-i18n-wired", "1");
      document.addEventListener("tasful:ui-locale-change", function () {
        try {
          global.TasuTlvGoLiveLabelsJa?.applyStaticDom?.(document);
          var live = global.TasuOneTlvGoLiveService?.getSession?.().phase === "live";
          setStartButtonsLabel(Boolean(live));
          if (global.TasuTlvVroidHubClient && typeof global.TasuTlvVroidHubClient.relabel === "function") {
            global.TasuTlvVroidHubClient.relabel();
          }
        } catch (_) {}
      });
    }
  }

  global.TasuOneTlvGoLiveDataAdapter = {
    boot: boot,
    collectDetails: collectDetails,
    refreshDevicesIntoUi: refreshDevicesIntoUi,
    applyPreview: applyPreview,
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () {
    setTimeout(boot, 0);
  });
  else setTimeout(boot, 0);
})(typeof window !== "undefined" ? window : globalThis);
