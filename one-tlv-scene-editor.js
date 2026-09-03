/**
 * one-tlv-scene-editor.js
 * Scene Editor — Camera + Screen/Game + Text + Image + Logo + Comments + Information + Timetable + VTuber
 * Sources · Canvas · Drag · Resize · Z-order · Save (schema v6)
 *
 * Pipeline:
 *   Formal Camera Output + Screen getDisplayMedia + overlay Sources (+ optional VTuber canvas)
 *   → Scene Compositor (Canvas 2D, zIndex order)
 *   → compositedStream (canvas video + Formal Mic audio SSOT)
 *        ├─ Preview
 *        └─ setPublishStream
 *
 * Ownership:
 * - Camera/Mic Formal Output: TasuOneTlvGoLiveMedia (do not stop)
 * - Screen capture tracks: Scene Editor (stop on Remove / cleanup / ended)
 * - Canvas capture video track: Scene Editor
 * - Formal audio only on Publish (Screen audio recognized but NOT mixed in V1)
 * - Image / Logo asset bytes: TasuOneTlvSceneAssetStore (IndexedDB) — scene only stores assetId
 * - VTuber canvas: TasuOneTlvGoLiveVtuberBasic (read-only draw source; no Formal ownership)
 */
(function (global) {
  "use strict";

  var VERSION = 6;
  var STORAGE_KEY = "tlv_scene_editor_v1";
  /** Broadcast aspect SSOT — reuses scene.canvas.aspectRatio / width / height. */
  var ASPECT_PRESETS = Object.freeze({
    "16:9": Object.freeze({ width: 1280, height: 720, css: "16 / 9" }),
    "9:16": Object.freeze({ width: 720, height: 1280, css: "9 / 16" }),
  });
  /** Built-in templates authored here; scaled into active canvas on apply. */
  var TEMPLATE_AUTHOR_W = 1920;
  var TEMPLATE_AUTHOR_H = 1080;
  var DESIGN_W = ASPECT_PRESETS["16:9"].width;
  var DESIGN_H = ASPECT_PRESETS["16:9"].height;
  var TARGET_FPS = 30;
  var MOBILE_COMPOSE_FPS = 15;

  function isMobileUa() {
    try {
      var ua = String((global.navigator && global.navigator.userAgent) || "");
      if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) return true;
      if (Number(global.navigator && global.navigator.maxTouchPoints) > 1 && /Macintosh/i.test(ua)) {
        return true;
      }
    } catch (_) {}
    return false;
  }

  /** Mobile Basic: lower compose rate without changing canvas contract sizes. */
  function resolveComposeFps() {
    return isMobileUa() ? MOBILE_COMPOSE_FPS : TARGET_FPS;
  }
  var MIN_W = 160;
  var MIN_H = 90;
  var CAMERA_LAYER_ID = "camera-1";
  var VTUBER_LAYER_ID = "vtuber-1";
  var OWNER_SCENE = "TasuOneTlvSceneEditor";
  var LOGO_WIDTH_RATIO = 0.12;
  var IMAGE_ACCEPT = "image/png,image/jpeg,image/webp";

  function resolveAspect(ar) {
    var v = String(ar || "16:9").trim();
    if (v === "9:16" || v === "portrait" || v === "PORTRAIT") return "9:16";
    return "16:9";
  }

  function canvasSpec(ar) {
    var key = resolveAspect(ar);
    var p = ASPECT_PRESETS[key];
    return { width: p.width, height: p.height, aspectRatio: key };
  }

  function setDesignSize(w, h) {
    DESIGN_W = Math.max(1, Number(w) || ASPECT_PRESETS["16:9"].width);
    DESIGN_H = Math.max(1, Number(h) || ASPECT_PRESETS["16:9"].height);
  }

  function scaleLayerGeometry(layer, fromW, fromH, toW, toH) {
    if (!layer) return layer;
    var sx = toW / fromW;
    var sy = toH / fromH;
    layer.x = Math.round(Number(layer.x || 0) * sx);
    layer.y = Math.round(Number(layer.y || 0) * sy);
    layer.width = Math.round(Number(layer.width || MIN_W) * sx);
    layer.height = Math.round(Number(layer.height || MIN_H) * sy);
    return layer;
  }

  function scaleLayersGeometry(layers, fromW, fromH, toW, toH) {
    if (!Array.isArray(layers)) return [];
    if (fromW === toW && fromH === toH) return layers;
    return layers.map(function (l) {
      return scaleLayerGeometry(Object.assign({}, l), fromW, fromH, toW, toH);
    });
  }

  function resizeCompositeCanvas() {
    var c = state.compositeCanvas;
    if (!c) return;
    if (c.width !== DESIGN_W) c.width = DESIGN_W;
    if (c.height !== DESIGN_H) c.height = DESIGN_H;
  }

  function applyStageAspect() {
    var ar = resolveAspect(state.scene && state.scene.canvas && state.scene.canvas.aspectRatio);
    var css = ASPECT_PRESETS[ar].css;
    if (state.stage && state.stage.style) {
      state.stage.style.aspectRatio = css;
      if (state.stage.setAttribute) state.stage.setAttribute("data-tlv-scene-aspect", ar);
    }
    if (state.host && state.host.style) {
      state.host.style.aspectRatio = css;
      if (state.host.classList && typeof state.host.classList.toggle === "function") {
        state.host.classList.toggle("aspect-video", ar === "16:9");
      }
      if (state.host.setAttribute) state.host.setAttribute("data-tlv-scene-aspect", ar);
    }
    if (state.root && state.root.setAttribute) state.root.setAttribute("data-tlv-scene-aspect", ar);
    resizeCompositeCanvas();
    if (typeof ensureStyles === "function") ensureStyles();
  }

  function getOutputDimensions() {
    var canvas = state.compositeCanvas
      ? { width: state.compositeCanvas.width, height: state.compositeCanvas.height }
      : { width: DESIGN_W, height: DESIGN_H };
    var track = null;
    var settings = null;
    try {
      var stream = state.compositedStream;
      var vt = stream && stream.getVideoTracks && stream.getVideoTracks()[0];
      if (vt && typeof vt.getSettings === "function") {
        settings = vt.getSettings() || null;
        track = {
          readyState: vt.readyState,
          width: settings && settings.width != null ? settings.width : null,
          height: settings && settings.height != null ? settings.height : null,
        };
      }
    } catch (_) {}
    return {
      aspectRatio: resolveAspect(state.scene && state.scene.canvas && state.scene.canvas.aspectRatio),
      canvas: canvas,
      compositedTrack: track,
      design: { width: DESIGN_W, height: DESIGN_H },
    };
  }

  /**
   * Switch broadcast aspect. Scales layer geometry; rebuilds captureStream.
   * @param {"16:9"|"9:16"} aspectRatio
   */
  function setAspectRatio(aspectRatio, opts) {
    opts = opts || {};
    var next = canvasSpec(aspectRatio);
    var prevW = DESIGN_W;
    var prevH = DESIGN_H;
    var prevAr = resolveAspect(state.scene && state.scene.canvas && state.scene.canvas.aspectRatio);
    if (next.aspectRatio === prevAr && next.width === prevW && next.height === prevH && !opts.force) {
      applyStageAspect();
      return { ok: true, reused: true, canvas: next, dimensions: getOutputDimensions() };
    }
    if (state.scene && Array.isArray(state.scene.layers)) {
      state.scene.layers = scaleLayersGeometry(state.scene.layers, prevW, prevH, next.width, next.height);
    }
    setDesignSize(next.width, next.height);
    if (!state.scene) state.scene = defaultScene();
    state.scene.canvas = { width: next.width, height: next.height, aspectRatio: next.aspectRatio };
    state.scene.version = VERSION;
    (state.scene.layers || []).forEach(clampLayer);
    applyStageAspect();
    persist();
    bindCameraSource();
    connectPreviewAndPublish();
    updateToolbar();
    updateTemplatePanel();
    try {
      global.TasuTlvLiveKitFormal?.onFormalStreamChanged?.();
    } catch (_e) {
      /* non-fatal */
    }
    try {
      // VTuber camera frustum follows Scene aspect (16:9 / 9:16) — not CSS.
      global.TasuOneTlvGoLiveVtuberBasic?.syncRendererToSceneAspect?.(true);
    } catch (_e2) {
      /* non-fatal */
    }
    return { ok: true, canvas: state.scene.canvas, dimensions: getOutputDimensions() };
  }

  var state = {
    enabled: true,
    selectedId: CAMERA_LAYER_ID,
    scene: null,
    host: null,
    stage: null,
    root: null,
    compositeCanvas: null,
    cameraVideo: null,
    previewVideo: null,
    overlay: null,
    toolbar: null,
    addMenu: null,
    templatePanel: null,
    propsPanel: null,
    fileInput: null,
    compositedStream: null,
    captureStream: null,
    ownedCaptureTracks: [],
    /** @type {Record<string, {stream: MediaStream, video: HTMLVideoElement, hasAudio: boolean, active: boolean, displayMediaCount: number}>} */
    screenRuntimes: {},
    /** @type {Record<string, HTMLImageElement>} decoded image bitmaps keyed by assetId */
    imageCache: {},
    /** @type {Array<{assetId:string, url:string}>} object URLs created for props-panel thumbnails — must be revoked */
    objectUrls: [],
    /** @type {Record<string, Promise<HTMLImageElement|null>>} in-flight asset decode dedupe */
    imageLoadPromises: {},
    displayMediaInvokeCount: 0,
    rafId: 0,
    loopRunning: false,
    lastComposeAt: 0,
    unsubMedia: null,
    unsubBeauty: null,
    unsubComments: null,
    drag: null,
    lastFrameAt: 0,
    frameCount: 0,
    fpsEstimate: 0,
    booted: false,
  };

  function uid(prefix) {
    return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
  }

  function supportsDisplayMedia() {
    return Boolean(global.navigator?.mediaDevices?.getDisplayMedia);
  }

  function assetStore() {
    return global.TasuOneTlvSceneAssetStore || null;
  }

  function commentsAdapter() {
    return global.TasuOneTlvSceneCommentsAdapter || null;
  }

  function templatesRegistry() {
    return global.TasuOneTlvSceneTemplates || null;
  }

  function hasCommentsLayer() {
    return (state.scene?.layers || []).some(function (l) {
      return l.type === "comments";
    });
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function defaultCameraLayer() {
    return {
      id: CAMERA_LAYER_ID,
      type: "camera",
      label: "Camera",
      x: 0,
      y: 0,
      width: DESIGN_W,
      height: DESIGN_H,
      zIndex: 1,
      visible: true,
      locked: false,
      keepAspect: true,
    };
  }

  function defaultTextLayer() {
    return {
      id: uid("text"),
      type: "text",
      label: "Text",
      x: Math.round(DESIGN_W * 0.08),
      y: Math.round(DESIGN_H * 0.08),
      width: 640,
      height: 160,
      zIndex: 1,
      visible: true,
      locked: false,
      keepAspect: false,
      text: "Your text",
      fontSize: 64,
      color: "#ffffff",
      align: "left",
      fontWeight: "normal",
    };
  }

  function defaultImageLayer(kind) {
    var isLogo = kind === "logo";
    var w = isLogo ? Math.round(DESIGN_W * LOGO_WIDTH_RATIO) : 480;
    var h = isLogo ? w : 270;
    var x = isLogo ? DESIGN_W - w - 48 : Math.round(DESIGN_W * 0.3);
    var y = isLogo ? 48 : Math.round(DESIGN_H * 0.3);
    return {
      id: uid(isLogo ? "logo" : "image"),
      type: isLogo ? "logo" : "image",
      label: isLogo ? "Logo" : "Image",
      x: x,
      y: y,
      width: w,
      height: h,
      zIndex: 1,
      visible: true,
      locked: false,
      keepAspect: true,
      assetId: null,
      assetStatus: "missing",
    };
  }

  function defaultCommentsLayer() {
    return {
      id: uid("comments"),
      type: "comments",
      label: "Comments",
      x: 1420,
      y: 180,
      width: 420,
      height: 720,
      zIndex: 1,
      visible: true,
      locked: false,
      keepAspect: false,
      maxItems: 5,
      fontSize: 28,
      showAvatar: true,
      showName: true,
      backgroundStyle: "soft", // transparent | soft | solid
    };
  }

  function defaultInformationLayer() {
    return {
      id: uid("information"),
      type: "information",
      label: "Information",
      x: 1280,
      y: 140,
      width: 520,
      height: 360,
      zIndex: 1,
      visible: true,
      locked: false,
      keepAspect: false,
      title: "Information",
      subtitle: "",
      body: "Add details for your stream.",
      rows: [{ label: "Label", value: "Value" }],
      align: "left", // left | center | right
      backgroundStyle: "soft", // transparent | soft | solid
      titleSize: 36,
      bodySize: 22,
    };
  }

  function defaultVtuberLayer() {
    return {
      id: VTUBER_LAYER_ID,
      type: "vtuber",
      label: "VTuber",
      x: Math.round(DESIGN_W * 0.62),
      y: Math.round(DESIGN_H * 0.12),
      width: Math.round(DESIGN_W * 0.32),
      height: Math.round(DESIGN_H * 0.78),
      zIndex: 5,
      visible: false,
      locked: false,
      keepAspect: true,
    };
  }

  function defaultTimetableLayer() {
    return {
      id: uid("timetable"),
      type: "timetable",
      label: "Timetable",
      x: 64,
      y: 120,
      width: 560,
      height: 640,
      zIndex: 1,
      visible: true,
      locked: false,
      keepAspect: false,
      title: "Today",
      items: [
        { time: "20:00", title: "Opening", active: true },
        { time: "20:30", title: "Main", active: false },
        { time: "21:00", title: "Closing", active: false },
      ],
      backgroundStyle: "soft", // transparent | soft | solid
      titleSize: 32,
      itemSize: 22,
    };
  }

  function defaultScene() {
    return {
      id: "scene-default",
      version: VERSION,
      canvas: { width: DESIGN_W, height: DESIGN_H, aspectRatio: "16:9" },
      layers: [defaultCameraLayer()],
    };
  }

  /** Foundation for future Game Template (Screen full + Camera PIP). */
  function gamePipTemplateLayers() {
    return [
      {
        id: "screen-template",
        type: "screen",
        label: "Screen / Game",
        x: 0,
        y: 0,
        width: DESIGN_W,
        height: DESIGN_H,
        zIndex: 1,
        visible: true,
        locked: false,
        keepAspect: true,
        captureState: "inactive",
      },
      {
        id: CAMERA_LAYER_ID,
        type: "camera",
        label: "Camera",
        x: DESIGN_W - 480 - 48,
        y: DESIGN_H - 270 - 48,
        width: 480,
        height: 270,
        zIndex: 2,
        visible: true,
        locked: false,
        keepAspect: true,
      },
    ];
  }

  function cloneScene(s) {
    return JSON.parse(JSON.stringify(s));
  }

  function media() {
    return global.TasuOneTlvGoLiveMedia;
  }

  function sortedLayers(scene) {
    return (scene.layers || []).slice().sort(function (a, b) {
      return (a.zIndex || 0) - (b.zIndex || 0);
    });
  }

  function getLayer(id) {
    if (!state.scene) return null;
    return (
      state.scene.layers.find(function (l) {
        return l.id === id;
      }) || null
    );
  }

  function nextZIndex() {
    var max = 0;
    (state.scene?.layers || []).forEach(function (l) {
      max = Math.max(max, Number(l.zIndex) || 0);
    });
    return max + 1;
  }

  function clampLayer(layer) {
    layer.width = Math.max(MIN_W, Math.min(DESIGN_W, Number(layer.width) || MIN_W));
    layer.height = Math.max(MIN_H, Math.min(DESIGN_H, Number(layer.height) || MIN_H));
    layer.x = Math.max(0, Math.min(DESIGN_W - layer.width, Number(layer.x) || 0));
    layer.y = Math.max(0, Math.min(DESIGN_H - layer.height, Number(layer.y) || 0));
    layer.zIndex = Number(layer.zIndex) || 1;
    layer.visible = layer.visible !== false;
    layer.locked = Boolean(layer.locked);
    layer.keepAspect = layer.keepAspect !== false;
    if (layer.type === "screen") {
      layer.captureState = layer.captureState === "active" ? "active" : "inactive";
      if (!supportsDisplayMedia()) layer.captureState = "unsupported";
      layer.label = layer.label || "Screen / Game";
    }
    if (layer.type === "camera") {
      layer.label = layer.label || "Camera";
      delete layer.captureState;
    }
    if (layer.type === "text") {
      layer.keepAspect = false;
      layer.label = layer.label || "Text";
      layer.text = typeof layer.text === "string" ? layer.text.slice(0, 500) : "Your text";
      var fs = Math.round(Number(layer.fontSize));
      layer.fontSize = Math.max(8, Math.min(400, fs || 64));
      layer.color = /^#[0-9a-fA-F]{3,8}$/.test(layer.color || "") ? layer.color : "#ffffff";
      layer.align = ["left", "center", "right"].indexOf(layer.align) >= 0 ? layer.align : "left";
      layer.fontWeight = layer.fontWeight === "bold" ? "bold" : "normal";
    }
    if (layer.type === "image" || layer.type === "logo") {
      layer.label = layer.label || (layer.type === "logo" ? "Logo" : "Image");
      layer.assetId = layer.assetId || null;
      if (["ready", "missing", "loading"].indexOf(layer.assetStatus) < 0) {
        layer.assetStatus = layer.assetId ? "loading" : "missing";
      }
    }
    if (layer.type === "comments") {
      layer.keepAspect = false;
      layer.label = layer.label || "Comments";
      var maxItems = Math.round(Number(layer.maxItems));
      layer.maxItems = [3, 5, 8, 10].indexOf(maxItems) >= 0 ? maxItems : 5;
      var commentsFontSize = Math.round(Number(layer.fontSize));
      layer.fontSize = Math.max(12, Math.min(96, commentsFontSize || 28));
      layer.showAvatar = layer.showAvatar !== false;
      layer.showName = layer.showName !== false;
      layer.backgroundStyle =
        ["transparent", "soft", "solid"].indexOf(layer.backgroundStyle) >= 0 ? layer.backgroundStyle : "soft";
    }
    if (layer.type === "information") {
      layer.keepAspect = false;
      layer.label = layer.label || "Information";
      layer.title = typeof layer.title === "string" ? layer.title.slice(0, 80) : "Information";
      layer.subtitle = typeof layer.subtitle === "string" ? layer.subtitle.slice(0, 120) : "";
      layer.body = typeof layer.body === "string" ? layer.body.slice(0, 800) : "";
      var infoRows = Array.isArray(layer.rows) ? layer.rows : [];
      layer.rows = infoRows.slice(0, 3).map(function (r) {
        return {
          label: typeof r?.label === "string" ? r.label.slice(0, 40) : "",
          value: typeof r?.value === "string" ? r.value.slice(0, 80) : "",
        };
      });
      layer.align = ["left", "center", "right"].indexOf(layer.align) >= 0 ? layer.align : "left";
      layer.backgroundStyle =
        ["transparent", "soft", "solid"].indexOf(layer.backgroundStyle) >= 0 ? layer.backgroundStyle : "soft";
      var infoTitleSize = Math.round(Number(layer.titleSize));
      layer.titleSize = Math.max(16, Math.min(96, infoTitleSize || 36));
      var infoBodySize = Math.round(Number(layer.bodySize));
      layer.bodySize = Math.max(12, Math.min(64, infoBodySize || 22));
    }
    if (layer.type === "timetable") {
      layer.keepAspect = false;
      layer.label = layer.label || "Timetable";
      layer.title = typeof layer.title === "string" ? layer.title.slice(0, 80) : "Today";
      var ttRawItems = Array.isArray(layer.items) ? layer.items : [];
      var seenActive = false;
      layer.items = ttRawItems.slice(0, 15).map(function (it) {
        var active = Boolean(it?.active) && !seenActive;
        if (active) seenActive = true;
        return {
          time: typeof it?.time === "string" ? it.time.slice(0, 16) : "",
          title: typeof it?.title === "string" ? it.title.slice(0, 80) : "",
          active: active,
        };
      });
      layer.backgroundStyle =
        ["transparent", "soft", "solid"].indexOf(layer.backgroundStyle) >= 0 ? layer.backgroundStyle : "soft";
      var ttTitleSize = Math.round(Number(layer.titleSize));
      layer.titleSize = Math.max(16, Math.min(96, ttTitleSize || 32));
      var ttItemSize = Math.round(Number(layer.itemSize));
      layer.itemSize = Math.max(12, Math.min(64, ttItemSize || 22));
    }
    if (layer.type === "vtuber") {
      layer.id = VTUBER_LAYER_ID;
      layer.label = layer.label || "VTuber";
      layer.keepAspect = layer.keepAspect !== false;
    }
    return layer;
  }

  function persistableScene() {
    var s = cloneScene(state.scene);
    s.version = VERSION;
    s.layers = (s.layers || []).map(function (l) {
      var out = clampLayer(Object.assign({}, l));
      // Never persist live capture as active — reload must not auto getDisplayMedia
      if (out.type === "screen") {
        out.captureState =
          out.captureState === "unsupported" || !supportsDisplayMedia() ? "unsupported" : "inactive";
      }
      return out;
    });
    if (state.scene?.templateId) {
      s.templateId = String(state.scene.templateId);
    } else {
      delete s.templateId;
    }
    return s;
  }

  function normalizeLayer(raw) {
    if (!raw || typeof raw !== "object") return null;
    if (raw.type === "camera") {
      return clampLayer({
        id: CAMERA_LAYER_ID,
        type: "camera",
        label: raw.label || "Camera",
        x: raw.x,
        y: raw.y,
        width: raw.width,
        height: raw.height,
        zIndex: raw.zIndex,
        visible: raw.visible,
        locked: raw.locked,
        keepAspect: raw.keepAspect,
      });
    }
    if (raw.type === "screen") {
      return clampLayer({
        id: String(raw.id || uid("screen")),
        type: "screen",
        label: raw.label || "Screen / Game",
        x: raw.x,
        y: raw.y,
        width: raw.width,
        height: raw.height,
        zIndex: raw.zIndex,
        visible: raw.visible,
        locked: raw.locked,
        keepAspect: raw.keepAspect,
        captureState: "inactive",
      });
    }
    if (raw.type === "text") {
      return clampLayer({
        id: String(raw.id || uid("text")),
        type: "text",
        label: raw.label || "Text",
        x: raw.x,
        y: raw.y,
        width: raw.width,
        height: raw.height,
        zIndex: raw.zIndex,
        visible: raw.visible,
        locked: raw.locked,
        keepAspect: false,
        text: raw.text,
        fontSize: raw.fontSize,
        color: raw.color,
        align: raw.align,
        fontWeight: raw.fontWeight,
      });
    }
    if (raw.type === "image" || raw.type === "logo") {
      return clampLayer({
        id: String(raw.id || uid(raw.type)),
        type: raw.type,
        label: raw.label || (raw.type === "logo" ? "Logo" : "Image"),
        x: raw.x,
        y: raw.y,
        width: raw.width,
        height: raw.height,
        zIndex: raw.zIndex,
        visible: raw.visible,
        locked: raw.locked,
        keepAspect: raw.keepAspect,
        // Reload never trusts a persisted "ready" status — hydrateAssets() re-verifies from the store.
        assetId: raw.assetId || null,
        assetStatus: raw.assetId ? "loading" : "missing",
      });
    }
    if (raw.type === "comments") {
      return clampLayer({
        id: String(raw.id || uid("comments")),
        type: "comments",
        label: raw.label || "Comments",
        x: raw.x,
        y: raw.y,
        width: raw.width,
        height: raw.height,
        zIndex: raw.zIndex,
        visible: raw.visible,
        locked: raw.locked,
        keepAspect: false,
        maxItems: raw.maxItems,
        fontSize: raw.fontSize,
        showAvatar: raw.showAvatar,
        showName: raw.showName,
        backgroundStyle: raw.backgroundStyle,
      });
    }
    if (raw.type === "information") {
      return clampLayer({
        id: String(raw.id || uid("information")),
        type: "information",
        label: raw.label || "Information",
        x: raw.x,
        y: raw.y,
        width: raw.width,
        height: raw.height,
        zIndex: raw.zIndex,
        visible: raw.visible,
        locked: raw.locked,
        keepAspect: false,
        title: raw.title,
        subtitle: raw.subtitle,
        body: raw.body,
        rows: raw.rows,
        align: raw.align,
        backgroundStyle: raw.backgroundStyle,
        titleSize: raw.titleSize,
        bodySize: raw.bodySize,
      });
    }
    if (raw.type === "timetable") {
      return clampLayer({
        id: String(raw.id || uid("timetable")),
        type: "timetable",
        label: raw.label || "Timetable",
        x: raw.x,
        y: raw.y,
        width: raw.width,
        height: raw.height,
        zIndex: raw.zIndex,
        visible: raw.visible,
        locked: raw.locked,
        keepAspect: false,
        title: raw.title,
        items: raw.items,
        backgroundStyle: raw.backgroundStyle,
        titleSize: raw.titleSize,
        itemSize: raw.itemSize,
      });
    }
    if (raw.type === "vtuber") {
      return clampLayer({
        id: VTUBER_LAYER_ID,
        type: "vtuber",
        label: raw.label || "VTuber",
        x: raw.x,
        y: raw.y,
        width: raw.width,
        height: raw.height,
        zIndex: raw.zIndex,
        visible: raw.visible,
        locked: raw.locked,
        keepAspect: raw.keepAspect !== false,
      });
    }
    return null;
  }

  function normalizeScene(raw) {
    var base = defaultScene();
    if (!raw || typeof raw !== "object") return base;
    var ver = Number(raw.version);
    if ([1, 2, 3, 4, 5, 6].indexOf(ver) < 0) return base;

    var fromW = Number(raw.canvas && raw.canvas.width) || TEMPLATE_AUTHOR_W;
    var fromH = Number(raw.canvas && raw.canvas.height) || TEMPLATE_AUTHOR_H;
    var ar = resolveAspect(raw.canvas && raw.canvas.aspectRatio);
    // Infer portrait from stored bitmap if metadata missing.
    if (!(raw.canvas && raw.canvas.aspectRatio) && fromH > fromW) ar = "9:16";
    var spec = canvasSpec(ar);
    setDesignSize(spec.width, spec.height);
    var next = {
      id: String(raw.id || base.id),
      version: VERSION,
      canvas: { width: spec.width, height: spec.height, aspectRatio: spec.aspectRatio },
      layers: [],
    };

    var layers = Array.isArray(raw.layers) ? raw.layers : [];
    var hasCam = false;
    var hasComments = false;
    var hasVtuber = false;
    layers.forEach(function (l) {
      // Scale into active canvas BEFORE normalize/clamp (clamp uses DESIGN_*).
      var scaled =
        fromW !== spec.width || fromH !== spec.height
          ? scaleLayerGeometry(Object.assign({}, l), fromW, fromH, spec.width, spec.height)
          : l;
      var n = normalizeLayer(scaled);
      if (!n) return;
      if (n.type === "camera") {
        if (hasCam) return;
        hasCam = true;
      }
      if (n.type === "comments") {
        if (hasComments) return;
        hasComments = true;
      }
      if (n.type === "vtuber") {
        if (hasVtuber) return;
        hasVtuber = true;
        n.id = VTUBER_LAYER_ID;
      }
      next.layers.push(n);
    });
    /* aspect-migrate-layers: applied pre-normalize above */
    if (!hasCam) next.layers.unshift(defaultCameraLayer());
    if (raw.templateId) {
      next.templateId = String(raw.templateId);
    }
    return next;
  }

  function loadScene() {
    try {
      var raw = global.localStorage?.getItem(STORAGE_KEY);
      if (!raw) return defaultScene();
      return normalizeScene(JSON.parse(raw));
    } catch (_) {
      return defaultScene();
    }
  }

  function saveScene() {
    try {
      global.localStorage?.setItem(STORAGE_KEY, JSON.stringify(persistableScene()));
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  }

  function persist() {
    (state.scene.layers || []).forEach(clampLayer);
    saveScene();
    renderOverlay();
    updateToolbar();
  }

  function designToCss(layer) {
    return {
      left: (layer.x / DESIGN_W) * 100 + "%",
      top: (layer.y / DESIGN_H) * 100 + "%",
      width: (layer.width / DESIGN_W) * 100 + "%",
      height: (layer.height / DESIGN_H) * 100 + "%",
    };
  }

  function clientToDesign(clientX, clientY) {
    var rect = state.stage.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * DESIGN_W,
      y: ((clientY - rect.top) / rect.height) * DESIGN_H,
    };
  }

  function ensureStyles() {
    var existing = document.getElementById("tlv-scene-editor-v1-css");
    var style = existing;
    if (!style) {
      style = document.createElement("style");
      style.id = "tlv-scene-editor-v1-css";
      document.head.appendChild(style);
    }
    style.textContent =
      "[data-tlv-scene-root]{display:flex;flex-direction:column;gap:0}" +
      "[data-tlv-scene-stage]{position:relative;width:100%;background:#000;overflow:hidden;touch-action:none}" +
      '[data-tlv-scene-stage][data-tlv-scene-aspect="16:9"]{aspect-ratio:16/9}' +
      '[data-tlv-scene-stage][data-tlv-scene-aspect="9:16"]{aspect-ratio:9/16}' +
      "[data-tlv-scene-composite]{position:absolute;left:-9999px;top:0;width:" +
      DESIGN_W +
      "px;height:" +
      DESIGN_H +
      "px;pointer-events:none}" +
      "[data-tlv-scene-camera-src],[data-tlv-scene-screen-src]{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}" +
      "[data-go-live-preview][data-tlv-scene-preview='1']{position:absolute;inset:0;z-index:1;width:100%;height:100%;object-fit:contain;background:#000}" +
      "[data-tlv-scene-overlay]{position:absolute;inset:0;z-index:3;pointer-events:auto}" +
      "[data-tlv-scene-layer]{position:absolute;box-sizing:border-box;border:2px solid transparent;cursor:move}" +
      "[data-tlv-scene-layer][data-selected='1']{border-color:#7dd3fc;box-shadow:0 0 0 1px rgba(125,211,252,.35)}" +
      "[data-tlv-scene-layer][data-type='screen'][data-selected='1']{border-color:#a78bfa}" +
      "[data-tlv-scene-layer][data-type='text'][data-selected='1']{border-color:#fbbf24}" +
      "[data-tlv-scene-layer][data-type='image'][data-selected='1']{border-color:#34d399}" +
      "[data-tlv-scene-layer][data-type='logo'][data-selected='1']{border-color:#f472b6}" +
      "[data-tlv-scene-layer][data-type='comments'][data-selected='1']{border-color:#22d3ee}" +
      "[data-tlv-scene-layer][data-type='information'][data-selected='1']{border-color:#fbbf24}" +
      "[data-tlv-scene-layer][data-type='timetable'][data-selected='1']{border-color:#34d399}" +
      "[data-tlv-scene-layer][data-type='vtuber'][data-selected='1']{border-color:#a78bfa}" +
      "[data-tlv-scene-layer][data-hidden='1']{opacity:.35;border-style:dashed}" +
      "[data-tlv-scene-layer][data-inactive='1']{outline:2px dashed rgba(248,113,113,.8)}" +
      "[data-tlv-scene-handle]{position:absolute;width:14px;height:14px;background:#7dd3fc;border:2px solid #0f172a;border-radius:3px;z-index:2;touch-action:none}" +
      "[data-tlv-scene-handle='nw']{left:-7px;top:-7px;cursor:nwse-resize}" +
      "[data-tlv-scene-handle='ne']{right:-7px;top:-7px;cursor:nesw-resize}" +
      "[data-tlv-scene-handle='sw']{left:-7px;bottom:-7px;cursor:nesw-resize}" +
      "[data-tlv-scene-handle='se']{right:-7px;bottom:-7px;cursor:nwse-resize}" +
      "[data-tlv-scene-toolbar]{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:10px 12px;border-top:1px solid rgba(255,255,255,.08);background:rgba(0,0,0,.35);position:relative}" +
      "[data-tlv-scene-toolbar] button{font-size:11px;line-height:1;padding:8px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:#e2e8f0;cursor:pointer}" +
      "[data-tlv-scene-toolbar] button[aria-pressed='true']{background:rgba(125,211,252,.18);border-color:rgba(125,211,252,.45)}" +
      "[data-tlv-scene-toolbar] button:disabled{opacity:.45;cursor:not-allowed}" +
      "[data-tlv-scene-toolbar] .tlv-scene-meta{font-size:10px;color:rgba(226,232,240,.65);margin-left:auto}" +
      "[data-tlv-scene-add-menu]{position:absolute;left:12px;bottom:calc(100% + 6px);display:none;flex-direction:column;gap:4px;min-width:180px;padding:8px;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:#0f172a;z-index:20}" +
      "[data-tlv-scene-add-menu][data-open='1']{display:flex}" +
      "[data-tlv-scene-add-menu] button{text-align:left;width:100%}" +
      "[data-tlv-scene-props]{display:flex;flex-direction:column;gap:8px;padding:10px 12px;border-top:1px solid rgba(255,255,255,.08);background:rgba(0,0,0,.25);font-size:12px;color:#e2e8f0}" +
      "[data-tlv-scene-props][data-empty='1']{display:none}" +
      "[data-tlv-scene-props] .tlv-scene-props-head{font-weight:600;font-size:11px;color:rgba(226,232,240,.8);text-transform:uppercase;letter-spacing:.04em;display:flex;align-items:center;gap:6px}" +
      "[data-tlv-scene-props] .tlv-scene-props-head::before{content:'';width:8px;height:8px;border-radius:2px;background:#7dd3fc;flex:none}" +
      "[data-tlv-scene-props][data-layer-type='text'] .tlv-scene-props-head::before{background:#fbbf24}" +
      "[data-tlv-scene-props][data-layer-type='image'] .tlv-scene-props-head::before{background:#34d399}" +
      "[data-tlv-scene-props][data-layer-type='logo'] .tlv-scene-props-head::before{background:#f472b6}" +
      "[data-tlv-scene-props][data-layer-type='screen'] .tlv-scene-props-head::before{background:#a78bfa}" +
      "[data-tlv-scene-props][data-layer-type='comments'] .tlv-scene-props-head::before{background:#22d3ee}" +
      "[data-tlv-scene-props][data-layer-type='information'] .tlv-scene-props-head::before{background:#fbbf24}" +
      "[data-tlv-scene-props][data-layer-type='timetable'] .tlv-scene-props-head::before{background:#34d399}" +
      "[data-tlv-scene-props] .tlv-scene-prop-row{display:flex;align-items:center;gap:8px}" +
      "[data-tlv-scene-props] .tlv-scene-prop-row>span:first-child{min-width:64px;color:rgba(226,232,240,.65);flex:none}" +
      "[data-tlv-scene-props] input[type='text'],[data-tlv-scene-props] textarea,[data-tlv-scene-props] input[type='number'],[data-tlv-scene-props] select{flex:1;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-radius:8px;color:#e2e8f0;padding:6px 8px;font-size:12px;min-width:0}" +
      "[data-tlv-scene-props] textarea{resize:vertical;min-height:44px;font-family:inherit}" +
      "[data-tlv-scene-props] input[type='color']{width:36px;height:28px;padding:0;border-radius:6px;border:1px solid rgba(255,255,255,.14);background:transparent}" +
      "[data-tlv-scene-props] input[type='checkbox']{width:16px;height:16px;flex:none}" +
      "[data-tlv-scene-props] label.tlv-scene-prop-row{cursor:pointer}" +
      "[data-tlv-scene-props] button{font-size:11px;padding:6px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.08);color:#e2e8f0;cursor:pointer}" +
      "[data-tlv-scene-props] .tlv-scene-prop-thumb img{width:64px;height:36px;object-fit:contain;background:#0f172a;border-radius:6px;border:1px solid rgba(255,255,255,.14)}" +
      "[data-tlv-scene-props] .tlv-scene-item-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap}" +
      "[data-tlv-scene-props] .tlv-scene-item-row input[type='text']{flex:1;min-width:60px}" +
      "[data-tlv-scene-props] .tlv-scene-item-time{max-width:70px;flex:none!important}" +
      "[data-tlv-scene-props] .tlv-scene-item-active{display:flex;align-items:center;gap:4px;flex:none;cursor:pointer}" +
      "[data-tlv-scene-props] .tlv-scene-item-row button{padding:6px 8px;flex:none}" +
      "[data-tlv-scene-props] .tlv-scene-prop-sub{font-size:10px;color:rgba(226,232,240,.55);text-transform:uppercase;letter-spacing:.04em}" +
      "[data-tlv-scene-templates]{display:none;flex-direction:column;gap:10px;padding:12px;border-top:1px solid rgba(255,255,255,.08);background:rgba(0,0,0,.3)}" +
      "[data-tlv-scene-templates][data-open='1']{display:flex}" +
      "[data-tlv-scene-templates] .tlv-tpl-head{font-weight:600;font-size:11px;color:rgba(226,232,240,.8);text-transform:uppercase;letter-spacing:.04em}" +
      "[data-tlv-scene-templates] .tlv-tpl-cards{display:flex;flex-wrap:wrap;gap:10px}" +
      "[data-tlv-scene-templates] .tlv-tpl-card{flex:1 1 200px;min-width:180px;display:flex;flex-direction:column;gap:8px;padding:10px;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04)}" +
      "[data-tlv-scene-templates] .tlv-tpl-card[data-active='1']{border-color:#7dd3fc;background:rgba(125,211,252,.12)}" +
      "[data-tlv-scene-templates] .tlv-tpl-title{font-size:12px;font-weight:600;color:#e2e8f0}" +
      "[data-tlv-scene-templates] .tlv-tpl-desc{font-size:10px;color:rgba(226,232,240,.6);line-height:1.4}" +
      "[data-tlv-scene-templates] .tlv-tpl-card button{align-self:flex-start;font-size:11px;padding:6px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.08);color:#e2e8f0;cursor:pointer}" +
      ".tlv-tpl-diagram{position:relative;width:100%;aspect-ratio:16/9;background:#0a0a0a;border-radius:8px;overflow:hidden;border:1px solid rgba(255,255,255,.08)}" +
      ".tlv-tpl-screen{position:absolute;left:0;top:0;width:100%;height:100%;background:#1e1b4b}" +
      ".tlv-tpl-cam{position:absolute;background:#334155;border:1px solid rgba(255,255,255,.18);border-radius:3px}" +
      "[data-diagram='game'] .tlv-tpl-cam{right:6%;bottom:6%;width:22%;height:22%}" +
      "[data-diagram='game'] .tlv-tpl-comments{position:absolute;right:6%;top:6%;width:22%;height:52%;background:rgba(34,211,238,.25);border:1px solid rgba(34,211,238,.5);border-radius:3px}" +
      "[data-diagram='talk'] .tlv-tpl-cam--main{left:0;top:0;width:68%;height:100%}" +
      "[data-diagram='talk'] .tlv-tpl-comments{position:absolute;right:2%;top:6%;width:26%;height:70%;background:rgba(34,211,238,.25);border:1px solid rgba(34,211,238,.5);border-radius:3px}" +
      "[data-diagram='talk'] .tlv-tpl-text{position:absolute;left:3%;bottom:4%;width:60%;height:14%;background:rgba(251,191,36,.3);border:1px solid rgba(251,191,36,.55);border-radius:3px}" +
      "[data-diagram='simple-camera'] .tlv-tpl-cam--full{left:0;top:0;width:100%;height:100%}" +
      "@media (max-width:520px){[data-tlv-scene-templates] .tlv-tpl-cards{flex-direction:column}}" +
      "@media (max-width:640px){" +
      "[data-tlv-scene-handle]{width:20px;height:20px}" +
      "[data-tlv-scene-handle='nw']{left:-10px;top:-10px}" +
      "[data-tlv-scene-handle='ne']{right:-10px;top:-10px}" +
      "[data-tlv-scene-handle='sw']{left:-10px;bottom:-10px}" +
      "[data-tlv-scene-handle='se']{right:-10px;bottom:-10px}" +
      "[data-tlv-scene-toolbar]{gap:6px;padding:8px}" +
      "[data-tlv-scene-toolbar] button{padding:10px 12px;min-height:40px}" +
      "}";
  }

  function findPreviewHost() {
    return (
      document.querySelector("[data-go-live-preview-host]") ||
      document.querySelector("main .aspect-video.bg-black, main .aspect-video")
    );
  }

  function mountDom() {
    ensureStyles();
    var host = findPreviewHost();
    if (!host) return false;
    host.setAttribute("data-go-live-preview-host", "1");
    host.setAttribute("data-tlv-scene-host", "1");

    var panel = host.closest(".glass-panel") || host.parentElement;
    var root = document.querySelector("[data-tlv-scene-root]");
    if (!root && panel) {
      root = document.createElement("div");
      root.setAttribute("data-tlv-scene-root", "1");
      if (host.parentElement === panel) {
        panel.insertBefore(root, host);
        root.appendChild(host);
      } else if (!host.closest("[data-tlv-scene-root]")) {
        host.parentElement.insertBefore(root, host);
        root.appendChild(host);
      }
    } else if (!root) {
      root = document.createElement("div");
      root.setAttribute("data-tlv-scene-root", "1");
      host.parentElement.insertBefore(root, host);
      root.appendChild(host);
    }
    state.root = root;
    state.host = host;
    host.setAttribute("data-tlv-scene-stage", "1");
    applyStageAspect();
    state.stage = host;

    var poster = host.querySelector(".absolute.inset-0.bg-cover");
    if (poster) {
      poster.style.opacity = "0";
      poster.style.pointerEvents = "none";
    }

    if (!state.compositeCanvas) {
      var c = document.createElement("canvas");
      c.width = DESIGN_W;
      c.height = DESIGN_H;
      c.setAttribute("data-tlv-scene-composite", "1");
      c.setAttribute("aria-hidden", "true");
      host.appendChild(c);
      state.compositeCanvas = c;
    }

    if (!state.cameraVideo) {
      var cam = document.createElement("video");
      cam.setAttribute("data-tlv-scene-camera-src", "1");
      cam.muted = true;
      cam.playsInline = true;
      cam.autoplay = true;
      host.appendChild(cam);
      state.cameraVideo = cam;
    }

    var preview =
      host.querySelector("video[data-go-live-preview]") ||
      (function () {
        var v = document.createElement("video");
        v.setAttribute("data-go-live-preview", "1");
        v.muted = true;
        v.playsInline = true;
        v.autoplay = true;
        host.appendChild(v);
        return v;
      })();
    preview.setAttribute("data-tlv-scene-preview", "1");
    preview.className = "absolute inset-0 z-[1] h-full w-full object-contain bg-black";
    state.previewVideo = preview;

    if (!state.overlay) {
      var ov = document.createElement("div");
      ov.setAttribute("data-tlv-scene-overlay", "1");
      ov.addEventListener("pointerdown", onOverlayPointerDown);
      host.appendChild(ov);
      state.overlay = ov;
    }

    if (!state.toolbar) {
      var tb = document.createElement("div");
      tb.setAttribute("data-tlv-scene-toolbar", "1");
      var Ja = global.TasuTlvGoLiveLabelsJa && global.TasuTlvGoLiveLabelsJa.t;
      var L = function (k, fallback) {
        return Ja ? Ja(k) : fallback;
      };
      tb.innerHTML =
        '<button type="button" data-tlv-scene-act="toggle">' +
        L("editLayout", "Edit Layout") +
        "</button>" +
        '<button type="button" data-tlv-scene-act="add">' +
        L("addSource", "Add Source") +
        "</button>" +
        '<button type="button" data-tlv-scene-act="templates">' +
        L("templates", "Templates") +
        "</button>" +
        '<button type="button" data-tlv-scene-act="aspect-16-9" title="Landscape 16:9">16:9</button>' +
        '<button type="button" data-tlv-scene-act="aspect-9-16" title="Portrait 9:16">9:16</button>' +
        '<button type="button" data-tlv-scene-act="visibility">' +
        L("hide", "Hide") +
        "</button>" +
        '<button type="button" data-tlv-scene-act="forward">' +
        L("bringForward", "Bring Forward") +
        "</button>" +
        '<button type="button" data-tlv-scene-act="backward">' +
        L("sendBackward", "Send Backward") +
        "</button>" +
        '<button type="button" data-tlv-scene-act="reconnect">' +
        L("reconnectScreen", "Reconnect Screen") +
        "</button>" +
        '<button type="button" data-tlv-scene-act="remove">' +
        L("removeSource", "Remove Source") +
        "</button>" +
        '<button type="button" data-tlv-scene-act="reset">' +
        L("resetLayout", "Reset Layout") +
        "</button>" +
        '<span class="tlv-scene-meta" data-tlv-scene-meta></span>' +
        '<div data-tlv-scene-add-menu role="menu">' +
        '<button type="button" data-tlv-scene-add="camera">' +
        L("camera", "Camera") +
        "</button>" +
        '<button type="button" data-tlv-scene-add="screen">' +
        L("screenGame", "Screen / Game") +
        "</button>" +
        '<button type="button" data-tlv-scene-add="text">' +
        L("text", "Text") +
        "</button>" +
        '<button type="button" data-tlv-scene-add="image">' +
        L("image", "Image") +
        "</button>" +
        '<button type="button" data-tlv-scene-add="logo">' +
        L("logo", "Logo") +
        "</button>" +
        '<button type="button" data-tlv-scene-add="comments">' +
        L("comments", "Comments") +
        "</button>" +
        '<button type="button" data-tlv-scene-add="information">Information Panel</button>' +
        '<button type="button" data-tlv-scene-add="timetable">Timetable</button>' +
        '<button type="button" data-tlv-scene-add="vtuber">VTuber</button>' +
        "</div>";
      tb.addEventListener("click", onToolbarClick);
      root.appendChild(tb);
      state.toolbar = tb;
      state.addMenu = tb.querySelector("[data-tlv-scene-add-menu]");
    }

    if (!state.templatePanel) {
      var tp = document.createElement("div");
      tp.setAttribute("data-tlv-scene-templates", "1");
      tp.setAttribute("data-open", "0");
      tp.innerHTML = buildTemplatePanelHtml();
      tp.addEventListener("click", onTemplatePanelClick);
      root.appendChild(tp);
      state.templatePanel = tp;
    }

    if (!state.propsPanel) {
      var pp = document.createElement("div");
      pp.setAttribute("data-tlv-scene-props", "1");
      pp.setAttribute("data-empty", "1");
      pp.addEventListener("input", onPropsInput);
      pp.addEventListener("change", onPropsInput);
      pp.addEventListener("click", onPropsClick);
      root.appendChild(pp);
      state.propsPanel = pp;
    }

    if (!state.fileInput) {
      var fi = document.createElement("input");
      fi.type = "file";
      fi.accept = IMAGE_ACCEPT;
      fi.setAttribute("data-tlv-scene-file-input", "1");
      fi.style.position = "absolute";
      fi.style.width = "1px";
      fi.style.height = "1px";
      fi.style.opacity = "0";
      fi.style.pointerEvents = "none";
      fi.style.left = "-9999px";
      root.appendChild(fi);
      state.fileInput = fi;
    }

    host.querySelectorAll(".absolute.top-4, .absolute.bottom-4").forEach(function (el) {
      el.style.zIndex = "4";
      el.style.pointerEvents = "none";
    });
    var fsBtn = host.querySelector(".absolute.bottom-4 button");
    if (fsBtn) fsBtn.style.pointerEvents = "auto";

    return true;
  }

  function beautyApi() {
    return global.TasuOneTlvGoLiveBeauty || null;
  }

  function beautyPocApi() {
    return global.TasuOneTlvGoLiveBeautyTencentPoc || null;
  }

  function snapEffectsApi() {
    return global.TasuOneTlvGoLiveSnapEffects || null;
  }

  /**
   * Camera Effect Chain: prefer Snap Effects processed video-only stream when active;
   * else Beauty (Tencent PoC / Basic WebGL); otherwise Formal Raw.
   * Never second getUserMedia. Processors must not own Formal tracks.
   * SCENE_RESET is forbidden — rebind camera draw source only.
   */
  function bindCameraSource() {
    var m = media();
    var formal = m?.getFormalMediaStreamOutput?.() || m?.getActiveMediaStream?.() || null;
    if (!state.cameraVideo) return { ok: false, error: "no_camera_video" };
    if (!formal) {
      state.cameraVideo.srcObject = null;
      return { ok: false, error: "no_formal_stream" };
    }
    var processed = null;
    var source = "formal";
    try {
      var snap = snapEffectsApi();
      if (snap && typeof snap.getCameraStream === "function") {
        processed = snap.getCameraStream() || null;
        if (processed) source = "snap_effects";
      }
    } catch (_) {
      processed = null;
    }
    try {
      var poc = beautyPocApi();
      if (!processed && poc && typeof poc.getCameraStream === "function") {
        processed = poc.getCameraStream() || null;
        if (processed) {
          source = poc.getMode?.() === "premium_tencent" ? "beauty_premium_poc" : "beauty";
        }
      }
    } catch (_) {
      /* keep Snap processed if already bound */
    }
    if (!processed) {
      try {
        processed = beautyApi()?.getOutputStream?.() || null;
        if (processed) source = "beauty";
      } catch (_) {
        processed = null;
      }
    }
    var stream = processed || formal;
    if (state.cameraVideo.srcObject !== stream) state.cameraVideo.srcObject = stream;
    state.cameraVideo.muted = true;
    state.cameraVideo.play().catch(function () {});
    return {
      ok: true,
      stream: stream,
      beauty: Boolean(processed),
      source: source,
    };
  }

  function refreshCameraSource() {
    var r = bindCameraSource();
    // Rebind camera draw source only — do not rebuild Publish on every Beauty notify
    // (setPublishStream notifies media listeners and must not recurse).
    return r;
  }

  function refreshCameraSourceAndPublish() {
    var r = bindCameraSource();
    if (state.enabled) connectPreviewAndPublish();
    return r;
  }

  function ensureScreenVideoEl(layerId) {
    var host = state.stage || state.host;
    if (!host) return null;
    var existing = host.querySelector('[data-tlv-scene-screen-src="' + layerId + '"]');
    if (existing) return existing;
    var v = document.createElement("video");
    v.setAttribute("data-tlv-scene-screen-src", layerId);
    v.muted = true;
    v.playsInline = true;
    v.autoplay = true;
    host.appendChild(v);
    return v;
  }

  function stopScreenRuntime(layerId, opts) {
    opts = opts || {};
    var rt = state.screenRuntimes[layerId];
    if (!rt) return;
    if (rt.stream) {
      rt.stream.getTracks().forEach(function (t) {
        try {
          t.onended = null;
          t.stop();
        } catch (_) {}
      });
    }
    if (rt.video) {
      try {
        rt.video.srcObject = null;
      } catch (_) {}
      if (opts.removeEl && rt.video.parentNode) rt.video.parentNode.removeChild(rt.video);
    }
    delete state.screenRuntimes[layerId];
  }

  function stopAllScreenRuntimes(opts) {
    Object.keys(state.screenRuntimes).forEach(function (id) {
      stopScreenRuntime(id, opts);
    });
  }

  function markScreenInactive(layerId, reason) {
    var layer = getLayer(layerId);
    if (layer && layer.type === "screen") {
      layer.captureState = supportsDisplayMedia() ? "inactive" : "unsupported";
    }
    stopScreenRuntime(layerId, { removeEl: false });
    persist();
    drawFrame();
    setStatus("Screen inactive" + (reason ? ": " + reason : ""));
  }

  function attachScreenStream(layerId, stream) {
    var layer = getLayer(layerId);
    if (!layer || layer.type !== "screen") return { ok: false, error: "no_layer" };
    stopScreenRuntime(layerId, { removeEl: false });

    var video = ensureScreenVideoEl(layerId);
    video.srcObject = stream;
    video.muted = true;
    video.play().catch(function () {});

    var hasAudio = stream.getAudioTracks().length > 0;
    // Recognize screen audio but do NOT publish/mix (Mic remains SSOT)
    stream.getAudioTracks().forEach(function (a) {
      a.enabled = false;
      try {
        a._tlvOwner = OWNER_SCENE;
        a._tlvScreenAudioIgnored = true;
      } catch (_) {}
    });
    stream.getVideoTracks().forEach(function (t) {
      try {
        t._tlvOwner = OWNER_SCENE;
      } catch (_) {}
      t.onended = function () {
        markScreenInactive(layerId, "browser_stop_sharing");
      };
    });

    state.screenRuntimes[layerId] = {
      stream: stream,
      video: video,
      hasAudio: hasAudio,
      active: true,
    };
    layer.captureState = "active";
    persist();
    drawFrame();
    return { ok: true, hasAudio: hasAudio };
  }

  /**
   * Must be called from a user gesture.
   */
  async function startScreenCaptureForLayer(layerId) {
    if (!supportsDisplayMedia()) {
      var layer = getLayer(layerId);
      if (layer) layer.captureState = "unsupported";
      persist();
      return { ok: false, code: "unsupported", message: "getDisplayMedia unsupported" };
    }
    state.displayMediaInvokeCount += 1;
    try {
      var stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: { ideal: TARGET_FPS, max: 30 },
          width: { ideal: DESIGN_W },
          height: { ideal: DESIGN_H },
        },
        audio: true,
      });
      return attachScreenStream(layerId, stream);
    } catch (err) {
      markScreenInactive(layerId, err?.name || "cancelled");
      return { ok: false, code: "cancelled", message: err?.message || String(err) };
    }
  }

  async function addCameraSource() {
    // Reuse Formal stream — never call getUserMedia here.
    var existing = getLayer(CAMERA_LAYER_ID);
    if (existing) {
      existing.visible = true;
      state.selectedId = CAMERA_LAYER_ID;
      bindCameraSource();
      persist();
      updatePropsPanel();
      return { ok: true, reused: true, layerId: CAMERA_LAYER_ID };
    }
    var layer = defaultCameraLayer();
    layer.zIndex = nextZIndex();
    // If screen is full-canvas, place camera as PIP
    var screens = (state.scene.layers || []).filter(function (l) {
      return l.type === "screen";
    });
    if (screens.length) {
      layer.x = DESIGN_W - 480 - 48;
      layer.y = DESIGN_H - 270 - 48;
      layer.width = 480;
      layer.height = 270;
    }
    state.scene.layers.push(clampLayer(layer));
    state.selectedId = CAMERA_LAYER_ID;
    bindCameraSource();
    persist();
    updatePropsPanel();
    connectPreviewAndPublish();
    return { ok: true, reused: false, layerId: CAMERA_LAYER_ID };
  }

  async function addScreenSource(opts) {
    opts = opts || {};
    var layer = clampLayer({
      id: uid("screen"),
      type: "screen",
      label: "Screen / Game",
      x: 0,
      y: 0,
      width: DESIGN_W,
      height: DESIGN_H,
      zIndex: nextZIndex(),
      visible: true,
      locked: false,
      keepAspect: true,
      captureState: supportsDisplayMedia() ? "inactive" : "unsupported",
    });

    // Multi-source foundation: if camera is full frame, shrink camera to PIP
    var cam = getLayer(CAMERA_LAYER_ID);
    if (cam && cam.width >= DESIGN_W * 0.9 && cam.height >= DESIGN_H * 0.9) {
      cam.x = DESIGN_W - 480 - 48;
      cam.y = DESIGN_H - 270 - 48;
      cam.width = 480;
      cam.height = 270;
      cam.zIndex = Math.max(cam.zIndex || 1, layer.zIndex + 1);
      clampLayer(cam);
    }

    state.scene.layers.push(layer);
    state.selectedId = layer.id;
    persist();
    updatePropsPanel();

    if (opts.capture === false) {
      return { ok: true, layerId: layer.id, capture: "skipped" };
    }
    if (!supportsDisplayMedia()) {
      setStatus("Screen / Game unsupported in this browser");
      return { ok: true, layerId: layer.id, capture: "unsupported" };
    }
    var cap = await startScreenCaptureForLayer(layer.id);
    connectPreviewAndPublish();
    return { ok: true, layerId: layer.id, capture: cap };
  }

  function addTextSource() {
    var layer = defaultTextLayer();
    layer.zIndex = nextZIndex();
    clampLayer(layer);
    state.scene.layers.push(layer);
    state.selectedId = layer.id;
    persist();
    updatePropsPanel();
    drawFrame();
    return { ok: true, layerId: layer.id };
  }

  function addCommentsSource() {
    var existing = (state.scene.layers || []).find(function (l) {
      return l.type === "comments";
    });
    if (existing) {
      state.selectedId = existing.id;
      persist();
      updatePropsPanel();
      commentsAdapter()?.syncFromGoLive?.();
      return { ok: true, reused: true, layerId: existing.id };
    }
    var layer = defaultCommentsLayer();
    layer.zIndex = nextZIndex();
    clampLayer(layer);
    state.scene.layers.push(layer);
    state.selectedId = layer.id;
    persist();
    updatePropsPanel();
    drawFrame();
    commentsAdapter()?.syncFromGoLive?.();
    return { ok: true, reused: false, layerId: layer.id };
  }

  function addInformationSource() {
    var layer = defaultInformationLayer();
    layer.zIndex = nextZIndex();
    clampLayer(layer);
    state.scene.layers.push(layer);
    state.selectedId = layer.id;
    persist();
    updatePropsPanel();
    drawFrame();
    return { ok: true, layerId: layer.id };
  }

  function addTimetableSource() {
    var layer = defaultTimetableLayer();
    layer.zIndex = nextZIndex();
    clampLayer(layer);
    state.scene.layers.push(layer);
    state.selectedId = layer.id;
    persist();
    updatePropsPanel();
    drawFrame();
    return { ok: true, layerId: layer.id };
  }

  function ensureVtuberLayer(opts) {
    opts = opts || {};
    var existing = getLayer(VTUBER_LAYER_ID);
    if (existing) {
      if (opts.visible != null) existing.visible = Boolean(opts.visible);
      clampLayer(existing);
      persist();
      updatePropsPanel();
      drawFrame();
      return { ok: true, reused: true, layerId: VTUBER_LAYER_ID, layer: existing };
    }
    var layer = defaultVtuberLayer();
    if (opts.visible != null) layer.visible = Boolean(opts.visible);
    layer.zIndex = nextZIndex();
    clampLayer(layer);
    state.scene.layers.push(layer);
    state.selectedId = layer.id;
    persist();
    updatePropsPanel();
    drawFrame();
    return { ok: true, reused: false, layerId: VTUBER_LAYER_ID, layer: layer };
  }

  function addVtuberSource() {
    var r = ensureVtuberLayer({ visible: true });
    state.selectedId = VTUBER_LAYER_ID;
    persist();
    updatePropsPanel();
    return r;
  }

  function setLayerVisibility(id, visible) {
    var layer = getLayer(id);
    if (!layer) return { ok: false, error: "no_layer" };
    layer.visible = Boolean(visible);
    persist();
    updatePropsPanel();
    drawFrame();
    return { ok: true, id: id, visible: layer.visible };
  }

  function applyAssetAspect(layer, assetW, assetH) {
    if (!assetW || !assetH) return;
    var aspect = assetW / assetH;
    if (!aspect || !isFinite(aspect)) return;
    layer.height = Math.round(layer.width / aspect);
    if (layer.type === "logo") {
      layer.x = DESIGN_W - layer.width - 48;
      layer.y = 48;
    }
  }

  function isAssetUsedElsewhere(assetId, excludeLayerId) {
    if (!assetId) return false;
    return (state.scene?.layers || []).some(function (l) {
      return l.id !== excludeLayerId && (l.type === "image" || l.type === "logo") && l.assetId === assetId;
    });
  }

  function trackObjectUrl(assetId, url) {
    state.objectUrls.push({ assetId: assetId, url: url });
  }

  function getObjectUrl(assetId) {
    var found = state.objectUrls.find(function (o) {
      return o.assetId === assetId;
    });
    return found ? found.url : null;
  }

  function revokeObjectUrl(assetId) {
    state.objectUrls = state.objectUrls.filter(function (o) {
      if (o.assetId !== assetId) return true;
      try {
        URL.revokeObjectURL(o.url);
      } catch (_) {}
      return false;
    });
  }

  function revokeAllObjectUrls() {
    state.objectUrls.forEach(function (o) {
      try {
        URL.revokeObjectURL(o.url);
      } catch (_) {}
    });
    state.objectUrls = [];
  }

  /**
   * Opens the hidden file input and resolves with the picked File (or null on cancel).
   * Must be invoked from a user gesture (toolbar / props panel click handlers).
   */
  function pickImageFile() {
    return new Promise(function (resolve) {
      var input = state.fileInput;
      if (!input) {
        resolve(null);
        return;
      }
      var settled = false;
      function cleanup() {
        input.removeEventListener("change", onChange);
        input.removeEventListener("cancel", onCancel);
      }
      function onChange() {
        if (settled) return;
        settled = true;
        cleanup();
        var file = input.files && input.files[0] ? input.files[0] : null;
        input.value = "";
        resolve(file);
      }
      function onCancel() {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(null);
      }
      input.addEventListener("change", onChange, { once: true });
      input.addEventListener("cancel", onCancel, { once: true });
      input.click();
    });
  }

  async function addImageOrLogoSource(kind) {
    kind = kind === "logo" ? "logo" : "image";
    var store = assetStore();
    if (!store) {
      setStatus("Asset store unavailable — load one-tlv-scene-asset-store.js first");
      return { ok: false, code: "no_store" };
    }
    var file = await pickImageFile();
    if (!file) return { ok: false, code: "cancelled" };
    var validation = store.validateFile ? store.validateFile(file) : { ok: true };
    if (!validation.ok) {
      setStatus("Image rejected: " + validation.message);
      return { ok: false, code: validation.code, message: validation.message };
    }
    var putRes = await store.putAsset(file);
    if (!putRes || !putRes.ok) {
      setStatus("Image failed: " + (putRes?.message || "store error"));
      return { ok: false, code: putRes?.code || "store_error", message: putRes?.message };
    }
    state.imageCache[putRes.assetId] = putRes.image;
    try {
      trackObjectUrl(putRes.assetId, URL.createObjectURL(file));
    } catch (_) {}

    var layer = defaultImageLayer(kind);
    layer.zIndex = nextZIndex();
    layer.assetId = putRes.assetId;
    layer.assetStatus = "ready";
    applyAssetAspect(layer, putRes.width, putRes.height);
    clampLayer(layer);
    state.scene.layers.push(layer);
    state.selectedId = layer.id;
    persist();
    updatePropsPanel();
    drawFrame();
    setStatus((kind === "logo" ? "Logo" : "Image") + " source added");
    return { ok: true, layerId: layer.id, assetId: putRes.assetId };
  }

  async function replaceSelectedAsset() {
    var layer = selectedLayer();
    if (!layer || (layer.type !== "image" && layer.type !== "logo")) {
      return { ok: false, error: "not_image_layer" };
    }
    var store = assetStore();
    if (!store) {
      setStatus("Asset store unavailable — load one-tlv-scene-asset-store.js first");
      return { ok: false, code: "no_store" };
    }
    var file = await pickImageFile();
    if (!file) return { ok: false, code: "cancelled" };
    var validation = store.validateFile ? store.validateFile(file) : { ok: true };
    if (!validation.ok) {
      setStatus("Image rejected: " + validation.message);
      return { ok: false, code: validation.code, message: validation.message };
    }
    var putRes = await store.putAsset(file);
    if (!putRes || !putRes.ok) {
      setStatus("Image failed: " + (putRes?.message || "store error"));
      return { ok: false, code: putRes?.code || "store_error", message: putRes?.message };
    }

    var oldAssetId = layer.assetId;
    state.imageCache[putRes.assetId] = putRes.image;
    try {
      trackObjectUrl(putRes.assetId, URL.createObjectURL(file));
    } catch (_) {}
    layer.assetId = putRes.assetId;
    layer.assetStatus = "ready";
    if (layer.type === "logo") {
      applyAssetAspect(layer, putRes.width, putRes.height);
    }
    clampLayer(layer);

    if (oldAssetId && oldAssetId !== putRes.assetId) {
      revokeObjectUrl(oldAssetId);
      if (!isAssetUsedElsewhere(oldAssetId, layer.id)) {
        delete state.imageCache[oldAssetId];
        store.deleteAsset?.(oldAssetId);
      }
    }

    persist();
    updatePropsPanel();
    drawFrame();
    setStatus("Asset replaced");
    return { ok: true, layerId: layer.id, assetId: putRes.assetId };
  }

  /**
   * Loads + decodes an asset into imageCache, deduping concurrent calls. Never re-decodes
   * an asset already present in the cache — callers must not invoke this from drawFrame().
   */
  function loadImageAsset(assetId) {
    if (!assetId) return Promise.resolve(null);
    if (state.imageCache[assetId]) return Promise.resolve(state.imageCache[assetId]);
    if (state.imageLoadPromises[assetId]) return state.imageLoadPromises[assetId];
    var store = assetStore();
    if (!store || !store.getAsset) return Promise.resolve(null);
    var p = store
      .getAsset(assetId)
      .then(function (res) {
        delete state.imageLoadPromises[assetId];
        if (res && res.ok && res.image) {
          state.imageCache[assetId] = res.image;
          return res.image;
        }
        return null;
      })
      .catch(function () {
        delete state.imageLoadPromises[assetId];
        return null;
      });
    state.imageLoadPromises[assetId] = p;
    return p;
  }

  /** Call once after loadScene() to (re)hydrate every persisted image/logo layer's bitmap. */
  function hydrateAssets() {
    var targets = (state.scene?.layers || []).filter(function (l) {
      return (l.type === "image" || l.type === "logo") && l.assetId;
    });
    if (!targets.length) return Promise.resolve({ ok: true, loaded: 0 });
    var promises = targets.map(function (layer) {
      layer.assetStatus = "loading";
      return loadImageAsset(layer.assetId).then(function (img) {
        layer.assetStatus = img ? "ready" : "missing";
        if (img && !getObjectUrl(layer.assetId) && img.src) {
          // Best-effort thumbnail source for props panel when reloaded without the original File.
          trackObjectUrl(layer.assetId, img.src);
        }
      });
    });
    return Promise.all(promises).then(function () {
      persist();
      drawFrame();
      updatePropsPanel();
      return { ok: true, loaded: targets.length };
    });
  }

  function removeSource(id) {
    id = id || state.selectedId;
    var layer = getLayer(id);
    if (!layer) return { ok: false, error: "no_layer" };
    if (layer.type === "camera") {
      // Keep camera layer in schema for Formal source; hide instead of hard-delete SSOT
      layer.visible = false;
      persist();
      updatePropsPanel();
      return { ok: true, hiddenCamera: true };
    }
    if (layer.type === "screen") {
      stopScreenRuntime(id, { removeEl: true });
      state.scene.layers = state.scene.layers.filter(function (l) {
        return l.id !== id;
      });
      if (state.selectedId === id) state.selectedId = CAMERA_LAYER_ID;
      persist();
      updatePropsPanel();
      connectPreviewAndPublish();
      return { ok: true, removed: id };
    }
    if (layer.type === "text") {
      state.scene.layers = state.scene.layers.filter(function (l) {
        return l.id !== id;
      });
      if (state.selectedId === id) state.selectedId = CAMERA_LAYER_ID;
      persist();
      updatePropsPanel();
      drawFrame();
      return { ok: true, removed: id };
    }
    if (layer.type === "image" || layer.type === "logo") {
      var assetId = layer.assetId;
      state.scene.layers = state.scene.layers.filter(function (l) {
        return l.id !== id;
      });
      if (state.selectedId === id) state.selectedId = CAMERA_LAYER_ID;
      if (assetId && !isAssetUsedElsewhere(assetId, id)) {
        delete state.imageCache[assetId];
        revokeObjectUrl(assetId);
        assetStore()?.deleteAsset?.(assetId);
      }
      persist();
      updatePropsPanel();
      drawFrame();
      return { ok: true, removed: id };
    }
    if (layer.type === "comments") {
      state.scene.layers = state.scene.layers.filter(function (l) {
        return l.id !== id;
      });
      if (state.selectedId === id) state.selectedId = CAMERA_LAYER_ID;
      persist();
      updatePropsPanel();
      drawFrame();
      if (!hasCommentsLayer()) {
        commentsAdapter()?.unbind?.();
      }
      return { ok: true, removed: id };
    }
    if (layer.type === "information" || layer.type === "timetable") {
      state.scene.layers = state.scene.layers.filter(function (l) {
        return l.id !== id;
      });
      if (state.selectedId === id) state.selectedId = CAMERA_LAYER_ID;
      persist();
      updatePropsPanel();
      drawFrame();
      return { ok: true, removed: id };
    }
    if (layer.type === "vtuber") {
      // Keep schema slot; hide instead of hard-delete (same pattern as camera SSOT)
      layer.visible = false;
      persist();
      updatePropsPanel();
      drawFrame();
      return { ok: true, hiddenVtuber: true };
    }
    return { ok: false, error: "unknown_type" };
  }

  /** true when the current scene has been customized beyond the fresh camera-only default. */
  function isSceneEdited() {
    var layers = state.scene?.layers || [];
    if (layers.length !== 1) return true;
    var l = layers[0];
    if (!l || l.type !== "camera") return true;
    return !(l.x === 0 && l.y === 0 && l.width === DESIGN_W && l.height === DESIGN_H);
  }

  function applyLayerTemplate(layers, opts) {
    opts = opts || {};
    // Future Game Template entry — geometry only; no auto capture
    stopAllScreenRuntimes({ removeEl: true });
    var ar = resolveAspect(opts.aspectRatio || (opts.canvas && opts.canvas.aspectRatio) || "16:9");
    var spec = canvasSpec(ar);
    var authoredW = Number(opts.authorWidth) || TEMPLATE_AUTHOR_W;
    var authoredH = Number(opts.authorHeight) || TEMPLATE_AUTHOR_H;
    setDesignSize(spec.width, spec.height);
    var mapped = scaleLayersGeometry(layers || [], authoredW, authoredH, spec.width, spec.height);
    var next = {
      id: state.scene?.id || "scene-default",
      version: VERSION,
      canvas: { width: spec.width, height: spec.height, aspectRatio: spec.aspectRatio },
      layers: mapped.map(normalizeLayer).filter(Boolean),
    };
    if (!next.layers.some(function (l) {
      return l.type === "camera";
    })) {
      next.layers.push(defaultCameraLayer());
    }
    // Caller (applyTemplate) sets templateId after this returns; a bare layer-template
    // apply (e.g. resetLayout, raw layers) is not associated with any registered template.
    if (opts.templateId) next.templateId = String(opts.templateId);
    state.scene = next;
    state.selectedId = CAMERA_LAYER_ID;
    persist();
    updatePropsPanel();
    bindCameraSource();
    connectPreviewAndPublish();
    hydrateAssets();
    return { ok: true, scene: cloneScene(state.scene) };
  }

  /**
   * Applies a built-in/registered Scene Template's layers into the current scene.
   * @param {string} id
   * @param {{ force?: boolean, confirmFn?: Function }} [opts]
   */
  function applyTemplate(id, opts) {
    opts = opts || {};
    var registry = templatesRegistry();
    var layers = registry?.getTemplateLayers ? registry.getTemplateLayers(id) : null;
    if (!layers && registry?.getTemplate) {
      var t = registry.getTemplate(id);
      layers = t?.layers || null;
    }
    if (!layers) return { ok: false, error: "unknown_template" };

    if (!opts.force && isSceneEdited()) {
      var confirmFn = opts.confirmFn || (typeof global.confirm === "function" ? global.confirm.bind(global) : null);
      var message =
        registry?.LABELS?.confirmReplace || "Apply template?\nYour current layout will be replaced.";
      var confirmed = confirmFn ? Boolean(confirmFn(message)) : true;
      if (!confirmed) return { ok: false, cancelled: true };
    }

    var tplMeta = registry?.getTemplate ? registry.getTemplate(id) : null;
    var tplCanvas = tplMeta && tplMeta.canvas ? tplMeta.canvas : null;
    var res = applyLayerTemplate(layers, {
      templateId: String(id),
      aspectRatio: tplCanvas && tplCanvas.aspectRatio,
      canvas: tplCanvas,
      authorWidth: TEMPLATE_AUTHOR_W,
      authorHeight: TEMPLATE_AUTHOR_H,
    });
    if (!res?.ok) return res;
    applyStageAspect();
    state.scene.templateId = String(id);
    persist();
    if (hasCommentsLayer()) commentsAdapter()?.syncFromGoLive?.();
    updateTemplatePanel();
    return { ok: true, templateId: String(id), scene: cloneScene(state.scene) };
  }

  function stopOwnedCaptureTracks() {
    state.ownedCaptureTracks.forEach(function (t) {
      try {
        t.stop();
      } catch (_) {}
    });
    state.ownedCaptureTracks = [];
    state.captureStream = null;
  }

  function buildCompositedStream() {
    if (!state.compositeCanvas || typeof state.compositeCanvas.captureStream !== "function") {
      return { ok: false, error: "captureStream_unsupported" };
    }
    stopOwnedCaptureTracks();
    var cap = state.compositeCanvas.captureStream(resolveComposeFps());
    state.captureStream = cap;
    var videoTracks = cap.getVideoTracks();
    videoTracks.forEach(function (t) {
      try {
        t._tlvOwner = OWNER_SCENE;
      } catch (_) {}
      state.ownedCaptureTracks.push(t);
    });

    var out = new MediaStream(videoTracks.slice());
    var formal = media()?.getFormalMediaStreamOutput?.() || media()?.getActiveMediaStream?.();
    if (formal) {
      formal.getAudioTracks().forEach(function (a) {
        out.addTrack(a);
      });
    }
    state.compositedStream = out;
    return { ok: true, stream: out };
  }

  function connectPreviewAndPublish() {
    if (!state.enabled) {
      stopLoop();
      stopOwnedCaptureTracks();
      state.compositedStream = null;
      media()?.syncPublishFromFormalOutput?.();
      var formal = media()?.getFormalMediaStreamOutput?.();
      if (state.previewVideo) {
        state.previewVideo.srcObject = formal || null;
        state.previewVideo.muted = true;
        state.previewVideo.play().catch(function () {});
      }
      if (state.overlay) state.overlay.style.pointerEvents = "none";
      updateToolbar();
      updatePropsPanel();
      return { ok: true, mode: "formal_raw" };
    }

    bindCameraSource();
    startLoop();
    var built = buildCompositedStream();
    if (!built.ok) return built;
    media()?.setPublishStream?.(built.stream);
    if (state.previewVideo) {
      state.previewVideo.srcObject = built.stream;
      state.previewVideo.muted = true;
      state.previewVideo.play().catch(function () {});
    }
    if (state.overlay) state.overlay.style.pointerEvents = "auto";
    updateToolbar();
    updatePropsPanel();
    return { ok: true, mode: "composited", stream: built.stream };
  }

  function drawVideoCover(ctx, video, layer, placeholder) {
    if (!video || video.readyState < 2) {
      ctx.fillStyle = "#111827";
      ctx.fillRect(layer.x, layer.y, layer.width, layer.height);
      ctx.fillStyle = "#64748b";
      ctx.font = "42px sans-serif";
      ctx.fillText(placeholder || layer.label || layer.type, layer.x + 32, layer.y + 64);
      return;
    }
    var vw = video.videoWidth || 16;
    var vh = video.videoHeight || 9;
    var scale = Math.max(layer.width / vw, layer.height / vh);
    var dw = vw * scale;
    var dh = vh * scale;
    var dx = layer.x + (layer.width - dw) / 2;
    var dy = layer.y + (layer.height - dh) / 2;
    ctx.save();
    ctx.beginPath();
    ctx.rect(layer.x, layer.y, layer.width, layer.height);
    ctx.clip();
    ctx.drawImage(video, dx, dy, dw, dh);
    ctx.restore();
  }

  function drawTextLayer(ctx, layer) {
    var text = String(layer.text || "");
    if (!text) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(layer.x, layer.y, layer.width, layer.height);
    ctx.clip();
    ctx.fillStyle = layer.color || "#ffffff";
    ctx.font = (layer.fontWeight === "bold" ? "bold " : "") + (layer.fontSize || 64) + "px sans-serif";
    ctx.textBaseline = "top";
    var align = layer.align || "left";
    ctx.textAlign = align;
    var tx = layer.x;
    if (align === "center") tx = layer.x + layer.width / 2;
    else if (align === "right") tx = layer.x + layer.width;
    var lineHeight = (layer.fontSize || 64) * 1.2;
    text.split("\n").forEach(function (line, i) {
      ctx.fillText(line, tx, layer.y + i * lineHeight);
    });
    ctx.restore();
  }

  function drawImagePlaceholder(ctx, layer) {
    ctx.save();
    ctx.fillStyle = layer.type === "logo" ? "#1e293b" : "#111827";
    ctx.fillRect(layer.x, layer.y, layer.width, layer.height);
    ctx.strokeStyle = "rgba(248,113,113,.85)";
    ctx.setLineDash([8, 6]);
    ctx.lineWidth = 3;
    ctx.strokeRect(layer.x + 2, layer.y + 2, Math.max(0, layer.width - 4), Math.max(0, layer.height - 4));
    ctx.setLineDash([]);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "24px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    var msg =
      layer.assetStatus === "loading"
        ? "Loading…"
        : layer.type === "logo"
        ? "Logo missing"
        : "Image missing";
    ctx.fillText(msg, layer.x + 12, layer.y + Math.min(layer.height - 10, 32));
    ctx.restore();
  }

  /** Reads only from imageCache — never decodes/fetches here (drawFrame runs every rAF tick). */
  function drawImageLayer(ctx, layer) {
    var img = layer.assetId ? state.imageCache[layer.assetId] : null;
    if (!img) {
      drawImagePlaceholder(ctx, layer);
      return;
    }
    var iw = img.naturalWidth || img.width || 0;
    var ih = img.naturalHeight || img.height || 0;
    if (!iw || !ih) {
      drawImagePlaceholder(ctx, layer);
      return;
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(layer.x, layer.y, layer.width, layer.height);
    ctx.clip();
    if (layer.keepAspect) {
      var scale = Math.min(layer.width / iw, layer.height / ih);
      var dw = iw * scale;
      var dh = ih * scale;
      var dx = layer.x + (layer.width - dw) / 2;
      var dy = layer.y + (layer.height - dh) / 2;
      ctx.drawImage(img, dx, dy, dw, dh);
    } else {
      ctx.drawImage(img, layer.x, layer.y, layer.width, layer.height);
    }
    ctx.restore();
  }

  /**
   * Word-wraps text to fit maxWidth using ctx.measureText, hard-breaking any single
   * word that alone exceeds maxWidth. Never lets a caller fillText an unclipped overflow line.
   */
  function wrapCanvasText(ctx, text, maxWidth) {
    var words = String(text == null ? "" : text)
      .split(/\s+/)
      .filter(Boolean);
    if (!words.length) return [];
    var lines = [];
    var line = "";
    words.forEach(function (word) {
      var candidate = line ? line + " " + word : word;
      if (ctx.measureText(candidate).width <= maxWidth) {
        line = candidate;
        return;
      }
      if (line) {
        lines.push(line);
        line = "";
      }
      if (ctx.measureText(word).width <= maxWidth) {
        line = word;
        return;
      }
      // Single word wider than maxWidth — hard break by character.
      var chunk = "";
      for (var i = 0; i < word.length; i++) {
        var next = chunk + word[i];
        if (ctx.measureText(next).width > maxWidth && chunk) {
          lines.push(chunk);
          chunk = word[i];
        } else {
          chunk = next;
        }
      }
      line = chunk;
    });
    if (line) lines.push(line);
    return lines;
  }

  var COMMENTS_AVATAR_PALETTE = ["#0ea5e9", "#8b5cf6", "#22c55e", "#f97316", "#ec4899", "#14b8a6"];

  function initialsCircleColor(seed) {
    var s = String(seed || "");
    var h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return COMMENTS_AVATAR_PALETTE[h % COMMENTS_AVATAR_PALETTE.length];
  }

  /**
   * Draws the Comments Source: background by backgroundStyle, then up to maxItems formal
   * comments (oldest→newest, top→bottom). Avatars are initials-only discs — never remote
   * avatar image URLs (CORS/taint risk on a canvas that gets captureStream()'d for publish).
   * Comment text is drawn via fillText only (plain string), never innerHTML.
   */
  function drawCommentsLayer(ctx, layer) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(layer.x, layer.y, layer.width, layer.height);
    ctx.clip();

    if (layer.backgroundStyle === "solid") {
      ctx.fillStyle = "rgba(15,23,42,0.92)";
      ctx.fillRect(layer.x, layer.y, layer.width, layer.height);
    } else if (layer.backgroundStyle === "soft") {
      ctx.fillStyle = "rgba(15,23,42,0.45)";
      ctx.fillRect(layer.x, layer.y, layer.width, layer.height);
    }
    // backgroundStyle "transparent" — no fill, camera/screen below shows through.

    var adapter = commentsAdapter();
    var comments = adapter?.getCommentsForCanvas ? adapter.getCommentsForCanvas(layer.maxItems) || [] : [];
    if (!comments.length) {
      ctx.restore();
      return;
    }

    var pad = 16;
    var avatarSize = layer.showAvatar ? Math.max(28, Math.round(layer.fontSize * 1.1)) : 0;
    var gap = layer.showAvatar ? 10 : 0;
    var textX = layer.x + pad + avatarSize + gap;
    var maxTextWidth = Math.max(20, layer.width - pad * 2 - avatarSize - gap);
    var lineHeight = Math.round(layer.fontSize * 1.25);
    var nameHeight = layer.showName ? Math.round(layer.fontSize * 0.85) : 0;
    var bottomLimit = layer.y + layer.height - pad;

    ctx.textBaseline = "top";
    ctx.textAlign = "left";

    var y = layer.y + pad;
    for (var i = 0; i < comments.length; i++) {
      if (y >= bottomLimit) break;
      var c = comments[i];
      var blockTop = y;

      ctx.font = layer.fontSize + "px sans-serif";
      var msgLines = wrapCanvasText(ctx, c.message, maxTextWidth);
      var blockHeight = nameHeight + Math.max(1, msgLines.length) * lineHeight + 10;

      if (layer.showAvatar) {
        var cx = layer.x + pad + avatarSize / 2;
        var cy = blockTop + avatarSize / 2;
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, avatarSize / 2, 0, Math.PI * 2);
        ctx.fillStyle = initialsCircleColor(c.senderId || c.name || c.id);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold " + Math.round(avatarSize * 0.45) + "px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(c.initials || "?").slice(0, 2), cx, cy + 1);
        ctx.restore();
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
      }

      var textY = blockTop;
      if (layer.showName) {
        ctx.font = "bold " + Math.round(layer.fontSize * 0.72) + "px sans-serif";
        ctx.fillStyle = "#7dd3fc";
        ctx.fillText(String(c.name || "Viewer"), textX, textY);
        textY += nameHeight;
      }

      ctx.font = layer.fontSize + "px sans-serif";
      ctx.fillStyle = "#f8fafc";
      msgLines.forEach(function (line, li) {
        ctx.fillText(line, textX, textY + li * lineHeight);
      });

      y = blockTop + blockHeight;
    }

    ctx.restore();
  }

  /**
   * Draws the Information Panel: background by backgroundStyle, then title/subtitle/body/rows
   * word-wrapped via wrapCanvasText. Plain fillText only — never innerHTML for user content.
   */
  function drawInformationLayer(ctx, layer) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(layer.x, layer.y, layer.width, layer.height);
    ctx.clip();

    if (layer.backgroundStyle === "solid") {
      ctx.fillStyle = "rgba(15,23,42,0.92)";
      ctx.fillRect(layer.x, layer.y, layer.width, layer.height);
    } else if (layer.backgroundStyle === "soft") {
      ctx.fillStyle = "rgba(15,23,42,0.45)";
      ctx.fillRect(layer.x, layer.y, layer.width, layer.height);
    }

    var pad = 20;
    var innerWidth = Math.max(20, layer.width - pad * 2);
    var align = layer.align || "left";
    var textX = layer.x + pad;
    if (align === "center") textX = layer.x + layer.width / 2;
    else if (align === "right") textX = layer.x + layer.width - pad;

    ctx.textBaseline = "top";
    ctx.textAlign = align;

    var y = layer.y + pad;
    var bottomLimit = layer.y + layer.height - pad;
    var titleSize = layer.titleSize || 36;
    var bodySize = layer.bodySize || 22;

    var title = String(layer.title || "");
    if (title) {
      ctx.font = "bold " + titleSize + "px sans-serif";
      ctx.fillStyle = "#f8fafc";
      var titleLineHeight = Math.round(titleSize * 1.2);
      wrapCanvasText(ctx, title, innerWidth).forEach(function (line) {
        if (y >= bottomLimit) return;
        ctx.fillText(line, textX, y);
        y += titleLineHeight;
      });
      y += 6;
    }

    var subtitle = String(layer.subtitle || "");
    if (subtitle && y < bottomLimit) {
      ctx.font = Math.round(bodySize * 0.9) + "px sans-serif";
      ctx.fillStyle = "#7dd3fc";
      var subLineHeight = Math.round(bodySize * 1.25);
      wrapCanvasText(ctx, subtitle, innerWidth).forEach(function (line) {
        if (y >= bottomLimit) return;
        ctx.fillText(line, textX, y);
        y += subLineHeight;
      });
      y += 6;
    }

    var body = String(layer.body || "");
    if (body && y < bottomLimit) {
      ctx.font = bodySize + "px sans-serif";
      ctx.fillStyle = "#e2e8f0";
      var bodyLineHeight = Math.round(bodySize * 1.3);
      String(body)
        .split("\n")
        .forEach(function (paragraph) {
          wrapCanvasText(ctx, paragraph, innerWidth).forEach(function (line) {
            if (y >= bottomLimit) return;
            ctx.fillText(line, textX, y);
            y += bodyLineHeight;
          });
        });
      y += 6;
    }

    var rows = Array.isArray(layer.rows) ? layer.rows : [];
    ctx.font = Math.round(bodySize * 0.95) + "px sans-serif";
    ctx.fillStyle = "#f8fafc";
    var rowLineHeight = Math.round(bodySize * 1.4);
    rows.forEach(function (row) {
      if (y >= bottomLimit) return;
      var label = String(row?.label || "");
      var value = String(row?.value || "");
      if (!label && !value) return;
      var text = label && value ? label + ": " + value : label || value;
      wrapCanvasText(ctx, text, innerWidth).forEach(function (line) {
        if (y >= bottomLimit) return;
        ctx.fillText(line, textX, y);
        y += rowLineHeight;
      });
    });

    ctx.restore();
  }

  /**
   * Draws the Timetable: background by backgroundStyle, title, then up to 15 items as
   * time + word-wrapped title rows. Active item gets a soft cyan highlight + brighter text.
   */
  function drawTimetableLayer(ctx, layer) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(layer.x, layer.y, layer.width, layer.height);
    ctx.clip();

    if (layer.backgroundStyle === "solid") {
      ctx.fillStyle = "rgba(15,23,42,0.92)";
      ctx.fillRect(layer.x, layer.y, layer.width, layer.height);
    } else if (layer.backgroundStyle === "soft") {
      ctx.fillStyle = "rgba(15,23,42,0.45)";
      ctx.fillRect(layer.x, layer.y, layer.width, layer.height);
    }

    var pad = 20;
    var innerX = layer.x + pad;
    var innerWidth = Math.max(20, layer.width - pad * 2);
    var bottomLimit = layer.y + layer.height - pad;
    var titleSize = layer.titleSize || 32;
    var itemSize = layer.itemSize || 22;

    ctx.textBaseline = "top";
    ctx.textAlign = "left";

    var y = layer.y + pad;
    var title = String(layer.title || "");
    if (title) {
      ctx.font = "bold " + titleSize + "px sans-serif";
      ctx.fillStyle = "#f8fafc";
      var titleLineHeight = Math.round(titleSize * 1.2);
      wrapCanvasText(ctx, title, innerWidth).forEach(function (line) {
        if (y >= bottomLimit) return;
        ctx.fillText(line, innerX, y);
        y += titleLineHeight;
      });
      y += 10;
    }

    var items = Array.isArray(layer.items) ? layer.items : [];
    var timeColWidth = Math.max(60, Math.round(itemSize * 3.4));
    var titleColX = innerX + timeColWidth;
    var titleColWidth = Math.max(20, innerWidth - timeColWidth);
    var itemLineHeight = Math.round(itemSize * 1.3);

    items.forEach(function (item) {
      if (y >= bottomLimit) return;
      var time = String(item?.time || "");
      var itemTitle = String(item?.title || "");
      var isActive = Boolean(item?.active);
      ctx.font = (isActive ? "bold " : "") + itemSize + "px sans-serif";
      var titleLines = wrapCanvasText(ctx, itemTitle, titleColWidth);
      if (!titleLines.length) titleLines = [""];
      var rowHeight = Math.max(itemLineHeight, titleLines.length * itemLineHeight);
      var rowTop = y;

      if (isActive) {
        ctx.save();
        ctx.fillStyle = "rgba(34,211,238,0.18)";
        ctx.fillRect(layer.x + 8, rowTop - 4, layer.width - 16, rowHeight + 4);
        ctx.restore();
      }

      ctx.fillStyle = isActive ? "#67e8f9" : "#94a3b8";
      ctx.fillText(time, innerX, rowTop);

      ctx.fillStyle = isActive ? "#f8fafc" : "#e2e8f0";
      titleLines.forEach(function (line, li) {
        var lineY = rowTop + li * itemLineHeight;
        if (lineY >= bottomLimit) return;
        ctx.fillText(line, titleColX, lineY);
      });

      y = rowTop + rowHeight + 6;
    });

    ctx.restore();
  }

  function drawVtuberLayer(ctx, layer) {
    var api = global.TasuOneTlvGoLiveVtuberBasic || null;
    var canvas = null;
    try {
      canvas = api?.getOutputCanvas?.() || null;
    } catch (_) {
      canvas = null;
    }
    if (!canvas || !canvas.width || !canvas.height) {
      ctx.save();
      ctx.fillStyle = "rgba(15,23,42,0.35)";
      ctx.fillRect(layer.x, layer.y, layer.width, layer.height);
      ctx.fillStyle = "#94a3b8";
      ctx.font = "28px sans-serif";
      ctx.fillText("VTuber", layer.x + 16, layer.y + 40);
      ctx.restore();
      return;
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(layer.x, layer.y, layer.width, layer.height);
    ctx.clip();
    var iw = canvas.width;
    var ih = canvas.height;
    if (layer.keepAspect) {
      var scale = Math.min(layer.width / iw, layer.height / ih);
      var dw = iw * scale;
      var dh = ih * scale;
      var dx = layer.x + (layer.width - dw) / 2;
      var dy = layer.y + (layer.height - dh) / 2;
      ctx.drawImage(canvas, dx, dy, dw, dh);
    } else {
      ctx.drawImage(canvas, layer.x, layer.y, layer.width, layer.height);
    }
    ctx.restore();
  }

  function drawFrame() {
    var canvas = state.compositeCanvas;
    if (!canvas) return;
    var ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);

    // zIndex-ordered composite: camera / screen / image / logo / text may interleave in any order.
    sortedLayers(state.scene).forEach(function (layer) {
      if (!layer.visible) return;
      if (layer.type === "camera") {
        drawVideoCover(ctx, state.cameraVideo, layer, "Camera");
        return;
      }
      if (layer.type === "screen") {
        var rt = state.screenRuntimes[layer.id];
        if (!rt || !rt.active) {
          ctx.fillStyle = "#1e1b4b";
          ctx.fillRect(layer.x, layer.y, layer.width, layer.height);
          ctx.fillStyle = "#c4b5fd";
          ctx.font = "36px sans-serif";
          ctx.fillText(
            layer.captureState === "unsupported" ? "Screen unsupported" : "Screen disconnected",
            layer.x + 32,
            layer.y + 64
          );
          return;
        }
        drawVideoCover(ctx, rt.video, layer, "Screen / Game");
        return;
      }
      if (layer.type === "image" || layer.type === "logo") {
        drawImageLayer(ctx, layer);
        return;
      }
      if (layer.type === "text") {
        drawTextLayer(ctx, layer);
        return;
      }
      if (layer.type === "comments") {
        drawCommentsLayer(ctx, layer);
        return;
      }
      if (layer.type === "information") {
        drawInformationLayer(ctx, layer);
        return;
      }
      if (layer.type === "timetable") {
        drawTimetableLayer(ctx, layer);
        return;
      }
      if (layer.type === "vtuber") {
        drawVtuberLayer(ctx, layer);
      }
    });

    var now = performance.now();
    state.frameCount += 1;
    if (now - state.lastFrameAt >= 1000) {
      state.fpsEstimate = state.frameCount;
      state.frameCount = 0;
      state.lastFrameAt = now;
      var meta = state.toolbar?.querySelector("[data-tlv-scene-meta]");
      if (meta) {
        var nScreen = Object.keys(state.screenRuntimes).length;
        meta.textContent =
          "Scene · ~" +
          state.fpsEstimate +
          " fps · layers=" +
          (state.scene?.layers?.length || 0) +
          " · screenActive=" +
          nScreen;
      }
    }
  }

  function loop(ts) {
    if (!state.loopRunning) return;
    state.rafId = global.requestAnimationFrame(loop);
    // Page background: skip compose work (keep rAF alive for resume).
    try {
      if (global.document && global.document.visibilityState === "hidden") return;
    } catch (_) {}
    // Cap compose — Desktop TARGET_FPS; Mobile Basic MOBILE_COMPOSE_FPS (thermal).
    var now = typeof ts === "number" ? ts : performance.now();
    var minDt = 1000 / resolveComposeFps();
    if (state.lastComposeAt && now - state.lastComposeAt < minDt - 0.5) return;
    state.lastComposeAt = now;
    drawFrame();
  }

  function startLoop() {
    if (state.loopRunning) return;
    state.loopRunning = true;
    state.lastFrameAt = performance.now();
    state.lastComposeAt = 0;
    state.frameCount = 0;
    state.rafId = global.requestAnimationFrame(loop);
  }

  function stopLoop() {
    state.loopRunning = false;
    if (state.rafId) global.cancelAnimationFrame(state.rafId);
    state.rafId = 0;
  }

  function renderOverlay() {
    if (!state.overlay) return;
    state.overlay.innerHTML = "";
    if (!state.enabled) return;
    sortedLayers(state.scene).forEach(function (layer) {
      var box = document.createElement("div");
      box.setAttribute("data-tlv-scene-layer", layer.id);
      box.setAttribute("data-type", layer.type);
      box.setAttribute("data-selected", state.selectedId === layer.id ? "1" : "0");
      box.setAttribute("data-hidden", layer.visible ? "0" : "1");
      if (layer.type === "screen" && layer.captureState !== "active") {
        box.setAttribute("data-inactive", "1");
      }
      if ((layer.type === "image" || layer.type === "logo") && layer.assetStatus !== "ready") {
        box.setAttribute("data-inactive", "1");
      }
      var css = designToCss(layer);
      box.style.left = css.left;
      box.style.top = css.top;
      box.style.width = css.width;
      box.style.height = css.height;
      if (state.selectedId === layer.id && !layer.locked) {
        ["nw", "ne", "sw", "se"].forEach(function (h) {
          var handle = document.createElement("div");
          handle.setAttribute("data-tlv-scene-handle", h);
          box.appendChild(handle);
        });
      }
      state.overlay.appendChild(box);
    });
  }

  function selectedLayer() {
    return getLayer(state.selectedId) || getLayer(CAMERA_LAYER_ID);
  }

  function fieldRow(labelText, inputHtml) {
    return '<label class="tlv-scene-prop-row"><span>' + escapeHtml(labelText) + "</span>" + inputHtml + "</label>";
  }

  function updatePropsPanel() {
    var panel = state.propsPanel;
    if (!panel) return;
    var layer = state.enabled ? selectedLayer() : null;
    if (!layer) {
      panel.innerHTML = "";
      if (panel.setAttribute) panel.setAttribute("data-empty", "1");
      if (panel.removeAttribute) panel.removeAttribute("data-layer-type");
      return;
    }
    if (panel.removeAttribute) panel.removeAttribute("data-empty");
    if (panel.setAttribute) panel.setAttribute("data-layer-type", layer.type);

    var html = '<div class="tlv-scene-props-head">' + escapeHtml(layer.label || layer.type) + "</div>";

    if (layer.type === "text") {
      html +=
        fieldRow("Text", '<textarea data-prop="text" rows="2">' + escapeHtml(layer.text || "") + "</textarea>") +
        fieldRow(
          "Size",
          '<input type="number" data-prop="fontSize" min="8" max="400" value="' + layer.fontSize + '">'
        ) +
        fieldRow("Color", '<input type="color" data-prop="color" value="' + escapeHtml(layer.color || "#ffffff") + '">') +
        fieldRow(
          "Align",
          '<select data-prop="align">' +
            ["left", "center", "right"]
              .map(function (a) {
                return '<option value="' + a + '"' + (layer.align === a ? " selected" : "") + ">" + a + "</option>";
              })
              .join("") +
            "</select>"
        ) +
        fieldRow(
          "Weight",
          '<select data-prop="fontWeight">' +
            ["normal", "bold"]
              .map(function (w) {
                return '<option value="' + w + '"' + (layer.fontWeight === w ? " selected" : "") + ">" + w + "</option>";
              })
              .join("") +
            "</select>"
        );
    } else if (layer.type === "image" || layer.type === "logo") {
      var thumbUrl = layer.assetId ? getObjectUrl(layer.assetId) : null;
      html +=
        '<div class="tlv-scene-prop-row tlv-scene-prop-thumb">' +
        (thumbUrl ? '<img src="' + escapeHtml(thumbUrl) + '" alt="">' : "<span>No preview</span>") +
        '<span data-prop-status>' +
        escapeHtml(layer.assetStatus || "missing") +
        "</span></div>" +
        '<div class="tlv-scene-prop-row"><button type="button" data-prop-act="replace">Replace ' +
        (layer.type === "logo" ? "Logo" : "Image") +
        "</button></div>" +
        fieldRow(
          "Keep aspect",
          '<input type="checkbox" data-prop="keepAspect"' + (layer.keepAspect ? " checked" : "") + ">"
        );
    } else if (layer.type === "comments") {
      html +=
        fieldRow(
          "Show Avatar",
          '<input type="checkbox" data-prop="showAvatar"' + (layer.showAvatar ? " checked" : "") + ">"
        ) +
        fieldRow(
          "Show Name",
          '<input type="checkbox" data-prop="showName"' + (layer.showName ? " checked" : "") + ">"
        ) +
        fieldRow(
          "Font size",
          '<input type="number" data-prop="fontSize" min="12" max="96" value="' + layer.fontSize + '">'
        ) +
        fieldRow(
          "Max comments",
          '<select data-prop="maxItems">' +
            [3, 5, 8, 10]
              .map(function (n) {
                return '<option value="' + n + '"' + (layer.maxItems === n ? " selected" : "") + ">" + n + "</option>";
              })
              .join("") +
            "</select>"
        ) +
        fieldRow(
          "Background",
          '<select data-prop="backgroundStyle">' +
            ["transparent", "soft", "solid"]
              .map(function (b) {
                return (
                  '<option value="' + b + '"' + (layer.backgroundStyle === b ? " selected" : "") + ">" + b + "</option>"
                );
              })
              .join("") +
            "</select>"
        );
    } else if (layer.type === "information") {
      var infoRows = Array.isArray(layer.rows) ? layer.rows : [];
      var infoRowsHtml = infoRows
        .map(function (r, i) {
          return (
            '<div class="tlv-scene-prop-row">' +
            '<input type="text" data-prop="rowLabel" data-row-index="' +
            i +
            '" maxlength="40" placeholder="Label" value="' +
            escapeHtml(r.label || "") +
            '">' +
            '<input type="text" data-prop="rowValue" data-row-index="' +
            i +
            '" maxlength="80" placeholder="Value" value="' +
            escapeHtml(r.value || "") +
            '">' +
            "</div>"
          );
        })
        .join("");
      html +=
        fieldRow(
          "Title",
          '<input type="text" data-prop="infoTitle" maxlength="80" value="' + escapeHtml(layer.title || "") + '">'
        ) +
        fieldRow(
          "Subtitle",
          '<input type="text" data-prop="infoSubtitle" maxlength="120" value="' +
            escapeHtml(layer.subtitle || "") +
            '">'
        ) +
        fieldRow("Body", '<textarea data-prop="infoBody" rows="3">' + escapeHtml(layer.body || "") + "</textarea>") +
        '<div class="tlv-scene-prop-sub">Rows (max 3)</div>' +
        infoRowsHtml +
        '<div class="tlv-scene-prop-row">' +
        '<button type="button" data-prop-act="addRow"' +
        (infoRows.length >= 3 ? " disabled" : "") +
        ">Add row</button>" +
        '<button type="button" data-prop-act="removeRow"' +
        (infoRows.length === 0 ? " disabled" : "") +
        ">Remove last</button>" +
        "</div>" +
        fieldRow(
          "Align",
          '<select data-prop="infoAlign">' +
            ["left", "center", "right"]
              .map(function (a) {
                return '<option value="' + a + '"' + (layer.align === a ? " selected" : "") + ">" + a + "</option>";
              })
              .join("") +
            "</select>"
        ) +
        fieldRow(
          "Background",
          '<select data-prop="infoBackground">' +
            ["transparent", "soft", "solid"]
              .map(function (b) {
                return (
                  '<option value="' + b + '"' + (layer.backgroundStyle === b ? " selected" : "") + ">" + b + "</option>"
                );
              })
              .join("") +
            "</select>"
        ) +
        fieldRow(
          "Title size",
          '<input type="number" data-prop="infoTitleSize" min="16" max="96" value="' + layer.titleSize + '">'
        ) +
        fieldRow(
          "Body size",
          '<input type="number" data-prop="infoBodySize" min="12" max="64" value="' + layer.bodySize + '">'
        );
    } else if (layer.type === "timetable") {
      var ttItems = Array.isArray(layer.items) ? layer.items : [];
      var ttItemsHtml = ttItems
        .map(function (it, i) {
          return (
            '<div class="tlv-scene-prop-row tlv-scene-item-row">' +
            '<input type="text" class="tlv-scene-item-time" data-prop="itemTime" data-item-index="' +
            i +
            '" maxlength="16" placeholder="Time" value="' +
            escapeHtml(it.time || "") +
            '">' +
            '<input type="text" data-prop="itemTitle" data-item-index="' +
            i +
            '" maxlength="80" placeholder="Title" value="' +
            escapeHtml(it.title || "") +
            '">' +
            '<label class="tlv-scene-item-active">' +
            '<input type="radio" name="tlv-scene-timetable-active" data-prop="itemActive" data-item-index="' +
            i +
            '"' +
            (it.active ? " checked" : "") +
            "> Active</label>" +
            '<button type="button" data-prop-act="moveItemUp" data-item-index="' +
            i +
            '"' +
            (i === 0 ? " disabled" : "") +
            ">\u2191</button>" +
            '<button type="button" data-prop-act="moveItemDown" data-item-index="' +
            i +
            '"' +
            (i === ttItems.length - 1 ? " disabled" : "") +
            ">\u2193</button>" +
            "</div>"
          );
        })
        .join("");
      html +=
        fieldRow(
          "Title",
          '<input type="text" data-prop="ttTitle" maxlength="80" value="' + escapeHtml(layer.title || "") + '">'
        ) +
        '<div class="tlv-scene-prop-sub">Items (max 15)</div>' +
        ttItemsHtml +
        '<div class="tlv-scene-prop-row">' +
        '<button type="button" data-prop-act="addItem"' +
        (ttItems.length >= 15 ? " disabled" : "") +
        ">Add item</button>" +
        '<button type="button" data-prop-act="removeItem"' +
        (ttItems.length === 0 ? " disabled" : "") +
        ">Remove last</button>" +
        "</div>" +
        fieldRow(
          "Background",
          '<select data-prop="ttBackground">' +
            ["transparent", "soft", "solid"]
              .map(function (b) {
                return (
                  '<option value="' + b + '"' + (layer.backgroundStyle === b ? " selected" : "") + ">" + b + "</option>"
                );
              })
              .join("") +
            "</select>"
        ) +
        fieldRow(
          "Title size",
          '<input type="number" data-prop="ttTitleSize" min="16" max="96" value="' + layer.titleSize + '">'
        ) +
        fieldRow(
          "Item size",
          '<input type="number" data-prop="ttItemSize" min="12" max="64" value="' + layer.itemSize + '">'
        );
    } else if (layer.type === "vtuber") {
      html += fieldRow(
        "Keep aspect",
        '<input type="checkbox" data-prop="keepAspect"' + (layer.keepAspect ? " checked" : "") + ">"
      );
    }

    html +=
      '<div class="tlv-scene-prop-row">' +
      '<label class="tlv-scene-prop-row"><input type="checkbox" data-prop="visible"' +
      (layer.visible ? " checked" : "") +
      "> Visible</label>" +
      '<label class="tlv-scene-prop-row"><input type="checkbox" data-prop="locked"' +
      (layer.locked ? " checked" : "") +
      "> Locked</label>" +
      "</div>";

    panel.innerHTML = html;
  }

  function onPropsInput(e) {
    var el = e.target.closest("[data-prop]");
    if (!el) return;
    var layer = selectedLayer();
    if (!layer) return;
    var prop = el.getAttribute("data-prop");
    if (prop === "text") layer.text = el.value.slice(0, 500);
    else if (prop === "fontSize") layer.fontSize = Number(el.value) || 64;
    else if (prop === "color") layer.color = el.value;
    else if (prop === "align") layer.align = el.value;
    else if (prop === "fontWeight") layer.fontWeight = el.value;
    else if (prop === "keepAspect") layer.keepAspect = el.checked;
    else if (prop === "maxItems") layer.maxItems = Number(el.value) || 5;
    else if (prop === "showAvatar") layer.showAvatar = el.checked;
    else if (prop === "showName") layer.showName = el.checked;
    else if (prop === "backgroundStyle") layer.backgroundStyle = el.value;
    else if (prop === "infoTitle") layer.title = el.value.slice(0, 80);
    else if (prop === "infoSubtitle") layer.subtitle = el.value.slice(0, 120);
    else if (prop === "infoBody") layer.body = el.value.slice(0, 800);
    else if (prop === "infoAlign") layer.align = el.value;
    else if (prop === "infoBackground") layer.backgroundStyle = el.value;
    else if (prop === "infoTitleSize") layer.titleSize = Number(el.value) || 36;
    else if (prop === "infoBodySize") layer.bodySize = Number(el.value) || 22;
    else if (prop === "rowLabel" || prop === "rowValue") {
      var rowIdx = Number(el.getAttribute("data-row-index"));
      if (!Array.isArray(layer.rows)) layer.rows = [];
      if (!layer.rows[rowIdx]) layer.rows[rowIdx] = { label: "", value: "" };
      if (prop === "rowLabel") layer.rows[rowIdx].label = el.value.slice(0, 40);
      else layer.rows[rowIdx].value = el.value.slice(0, 80);
    } else if (prop === "ttTitle") layer.title = el.value.slice(0, 80);
    else if (prop === "ttBackground") layer.backgroundStyle = el.value;
    else if (prop === "ttTitleSize") layer.titleSize = Number(el.value) || 32;
    else if (prop === "ttItemSize") layer.itemSize = Number(el.value) || 22;
    else if (prop === "itemTime" || prop === "itemTitle" || prop === "itemActive") {
      var itemIdx = Number(el.getAttribute("data-item-index"));
      if (!Array.isArray(layer.items)) layer.items = [];
      if (!layer.items[itemIdx]) layer.items[itemIdx] = { time: "", title: "", active: false };
      if (prop === "itemTime") layer.items[itemIdx].time = el.value.slice(0, 16);
      else if (prop === "itemTitle") layer.items[itemIdx].title = el.value.slice(0, 80);
      else if (prop === "itemActive") {
        layer.items.forEach(function (it, i) {
          it.active = i === itemIdx;
        });
      }
    } else if (prop === "visible") layer.visible = el.checked;
    else if (prop === "locked") layer.locked = el.checked;
    else return;
    clampLayer(layer);
    persist();
    drawFrame();
  }

  function onPropsClick(e) {
    var btn = e.target.closest("[data-prop-act]");
    if (!btn) return;
    var act = btn.getAttribute("data-prop-act");
    if (act === "replace") {
      replaceSelectedAsset();
      return;
    }
    var layer = selectedLayer();
    if (!layer) return;
    if (act === "addRow") {
      if (!Array.isArray(layer.rows)) layer.rows = [];
      if (layer.rows.length < 3) layer.rows.push({ label: "", value: "" });
    } else if (act === "removeRow") {
      if (Array.isArray(layer.rows) && layer.rows.length) layer.rows.pop();
    } else if (act === "addItem") {
      if (!Array.isArray(layer.items)) layer.items = [];
      if (layer.items.length < 15) layer.items.push({ time: "", title: "", active: false });
    } else if (act === "removeItem") {
      if (Array.isArray(layer.items) && layer.items.length) layer.items.pop();
    } else if (act === "moveItemUp" || act === "moveItemDown") {
      var idx = Number(btn.getAttribute("data-item-index"));
      var items = Array.isArray(layer.items) ? layer.items : [];
      var swapWith = act === "moveItemUp" ? idx - 1 : idx + 1;
      if (swapWith >= 0 && swapWith < items.length) {
        var tmp = items[idx];
        items[idx] = items[swapWith];
        items[swapWith] = tmp;
      }
    } else {
      return;
    }
    clampLayer(layer);
    persist();
    updatePropsPanel();
    drawFrame();
  }

  function updateToolbar() {
    var arNow = resolveAspect(state.scene && state.scene.canvas && state.scene.canvas.aspectRatio);
    var b169 = state.toolbar && state.toolbar.querySelector('[data-tlv-scene-act="aspect-16-9"]');
    var b916 = state.toolbar && state.toolbar.querySelector('[data-tlv-scene-act="aspect-9-16"]');
    if (b169) b169.setAttribute("aria-pressed", arNow === "16:9" ? "true" : "false");
    if (b916) b916.setAttribute("aria-pressed", arNow === "9:16" ? "true" : "false");
    if (!state.toolbar) return;
    var toggle = state.toolbar.querySelector('[data-tlv-scene-act="toggle"]');
    var vis = state.toolbar.querySelector('[data-tlv-scene-act="visibility"]');
    var reconnect = state.toolbar.querySelector('[data-tlv-scene-act="reconnect"]');
    var remove = state.toolbar.querySelector('[data-tlv-scene-act="remove"]');
    var layer = selectedLayer();
    if (toggle) {
      toggle.setAttribute("aria-pressed", state.enabled ? "true" : "false");
      var JaT = global.TasuTlvGoLiveLabelsJa && global.TasuTlvGoLiveLabelsJa.t;
      toggle.textContent = state.enabled
        ? JaT
          ? JaT("editLayoutOn")
          : "Edit Layout: ON"
        : JaT
          ? JaT("editLayoutOff")
          : "Edit Layout: OFF";
    }
    if (vis && layer) {
      var JaV = global.TasuTlvGoLiveLabelsJa && global.TasuTlvGoLiveLabelsJa.t;
      vis.textContent = layer.visible
        ? JaV
          ? JaV("hide")
          : "Hide"
        : JaV
          ? JaV("show")
          : "Show";
      vis.disabled = false;
    }
    if (reconnect) {
      var isScreen = layer && layer.type === "screen";
      reconnect.disabled = !isScreen || !supportsDisplayMedia();
      var JaR = global.TasuTlvGoLiveLabelsJa && global.TasuTlvGoLiveLabelsJa.t;
      reconnect.textContent =
        isScreen && layer.captureState === "active"
          ? JaR
            ? JaR("replaceScreen")
            : "Replace Screen"
          : JaR
            ? JaR("reconnectScreen")
            : "Reconnect Screen";
    }
    if (remove) {
      remove.disabled = !layer;
    }
    if (state.overlay) state.overlay.style.display = state.enabled ? "block" : "none";
    var screenBtn = state.addMenu?.querySelector('[data-tlv-scene-add="screen"]');
    if (screenBtn) {
      screenBtn.disabled = !supportsDisplayMedia();
      screenBtn.textContent = supportsDisplayMedia()
        ? "Screen / Game"
        : "Screen / Game (unsupported)";
    }
    var hasStore = Boolean(assetStore());
    var imageBtn = state.addMenu?.querySelector('[data-tlv-scene-add="image"]');
    var logoBtn = state.addMenu?.querySelector('[data-tlv-scene-add="logo"]');
    if (imageBtn) {
      imageBtn.disabled = !hasStore;
      imageBtn.textContent = hasStore ? "Image" : "Image (store unavailable)";
    }
    if (logoBtn) {
      logoBtn.disabled = !hasStore;
      logoBtn.textContent = hasStore ? "Logo" : "Logo (store unavailable)";
    }
    var hasCommentsAdapter = Boolean(commentsAdapter());
    var commentsBtn = state.addMenu?.querySelector('[data-tlv-scene-add="comments"]');
    if (commentsBtn) {
      commentsBtn.disabled = !hasCommentsAdapter;
      commentsBtn.textContent = hasCommentsAdapter ? "Comments" : "Comments (adapter unavailable)";
    }
  }

  function setStatus(msg) {
    var p = document.querySelector("main h1 + p");
    if (p) p.textContent = String(msg || "").slice(0, 220);
  }

  function setAddMenuOpen(open) {
    if (!state.addMenu) return;
    state.addMenu.setAttribute("data-open", open ? "1" : "0");
  }

  function templateDiagramHtml(id) {
    if (id === "game") {
      return (
        '<div class="tlv-tpl-diagram" data-diagram="game">' +
        '<div class="tlv-tpl-screen"></div>' +
        '<div class="tlv-tpl-comments"></div>' +
        '<div class="tlv-tpl-cam"></div>' +
        "</div>"
      );
    }
    if (id === "talk") {
      return (
        '<div class="tlv-tpl-diagram" data-diagram="talk">' +
        '<div class="tlv-tpl-cam tlv-tpl-cam--main"></div>' +
        '<div class="tlv-tpl-comments"></div>' +
        '<div class="tlv-tpl-text"></div>' +
        "</div>"
      );
    }
    return (
      '<div class="tlv-tpl-diagram" data-diagram="simple-camera">' +
      '<div class="tlv-tpl-cam tlv-tpl-cam--full"></div>' +
      "</div>"
    );
  }

  function buildTemplatePanelHtml() {
    var registry = templatesRegistry();
    var labels = registry?.LABELS || {};
    var list = registry?.listTemplates ? registry.listTemplates() : [];
    var cards = list
      .map(function (t) {
        return (
          '<div class="tlv-tpl-card" data-tlv-template-id="' +
          escapeHtml(t.id) +
          '">' +
          templateDiagramHtml(t.id) +
          '<div class="tlv-tpl-info">' +
          '<div class="tlv-tpl-title">' +
          escapeHtml(t.label || t.id) +
          "</div>" +
          '<div class="tlv-tpl-desc">' +
          escapeHtml(t.description || "") +
          "</div>" +
          "</div>" +
          '<button type="button" data-tlv-template-apply="' +
          escapeHtml(t.id) +
          '">' +
          escapeHtml(labels.apply || "Apply") +
          "</button>" +
          "</div>"
        );
      })
      .join("");
    return (
      '<div class="tlv-tpl-head">' +
      escapeHtml(labels.choose || "Choose Template") +
      "</div>" +
      '<div class="tlv-tpl-cards">' +
      cards +
      "</div>"
    );
  }

  function setTemplatePanelOpen(open) {
    if (!state.templatePanel) return;
    state.templatePanel.setAttribute("data-open", open ? "1" : "0");
  }

  function isTemplatePanelOpen() {
    return state.templatePanel?.getAttribute("data-open") === "1";
  }

  /** Refreshes the panel's active-template highlight and availability; does not toggle open state. */
  function updateTemplatePanel() {
    var panel = state.templatePanel;
    if (!panel) return;
    var currentId = state.scene?.templateId || "";
    panel.querySelectorAll("[data-tlv-template-id]").forEach(function (card) {
      var isActive = currentId && card.getAttribute("data-tlv-template-id") === currentId;
      card.setAttribute("data-active", isActive ? "1" : "0");
    });
  }

  function onTemplatePanelClick(e) {
    var applyBtn = e.target.closest("[data-tlv-template-apply]");
    if (!applyBtn) return;
    var id = applyBtn.getAttribute("data-tlv-template-apply");
    var res = applyTemplate(id);
    if (res?.ok) {
      setTemplatePanelOpen(false);
      setStatus("Template applied: " + id);
    } else if (res?.cancelled) {
      setStatus("Template apply cancelled");
    } else {
      setStatus("Template apply failed: " + (res?.error || "unknown"));
    }
  }

  async function onToolbarClick(e) {
    var add = e.target.closest("[data-tlv-scene-add]");
    if (add) {
      setAddMenuOpen(false);
      var kind = add.getAttribute("data-tlv-scene-add");
      if (kind === "camera") {
        await addCameraSource();
        setStatus("Camera source ready (Formal stream reuse)");
      } else if (kind === "screen") {
        var res = await addScreenSource({ capture: true });
        setStatus(
          res.capture?.ok
            ? "Screen / Game source added"
            : "Screen source added · " + (res.capture?.message || res.capture || "inactive")
        );
      } else if (kind === "text") {
        addTextSource();
        setStatus("Text source added");
      } else if (kind === "image") {
        await addImageOrLogoSource("image");
      } else if (kind === "logo") {
        await addImageOrLogoSource("logo");
      } else if (kind === "comments") {
        var cres = addCommentsSource();
        setStatus(cres.reused ? "Comments source already added" : "Comments source added");
      } else if (kind === "information") {
        addInformationSource();
        setStatus("Information panel added");
      } else if (kind === "timetable") {
        addTimetableSource();
        setStatus("Timetable added");
      } else if (kind === "vtuber") {
        addVtuberSource();
        setStatus("VTuber layer added");
      }
      return;
    }

    var btn = e.target.closest("[data-tlv-scene-act]");
    if (!btn) return;
    var act = btn.getAttribute("data-tlv-scene-act");
    if (act === "toggle") {
      setEnabled(!state.enabled);
      return;
    }
    if (act === "add") {
      setTemplatePanelOpen(false);
      setAddMenuOpen(state.addMenu?.getAttribute("data-open") !== "1");
      return;
    }
    if (act === "aspect-16-9") {
      setAspectRatio("16:9");
      return;
    }
    if (act === "aspect-9-16") {
      setAspectRatio("9:16");
      return;
    }
    if (act === "templates") {
      setAddMenuOpen(false);
      setTemplatePanelOpen(!isTemplatePanelOpen());
      return;
    }
    if (act === "visibility") {
      toggleVisibility(state.selectedId);
      return;
    }
    if (act === "forward") {
      bringForward(state.selectedId);
      return;
    }
    if (act === "backward") {
      sendBackward(state.selectedId);
      return;
    }
    if (act === "reconnect") {
      var layer = selectedLayer();
      if (layer?.type === "screen") {
        var cap = await startScreenCaptureForLayer(layer.id);
        connectPreviewAndPublish();
        setStatus(cap.ok ? "Screen reconnected" : "Screen reconnect failed");
      }
      return;
    }
    if (act === "remove") {
      removeSource(state.selectedId);
      return;
    }
    if (act === "reset") {
      resetLayout();
    }
  }

  function onOverlayPointerDown(e) {
    if (!state.enabled) return;
    setAddMenuOpen(false);
    var handle = e.target.closest("[data-tlv-scene-handle]");
    var layerEl = e.target.closest("[data-tlv-scene-layer]");
    if (!layerEl && !handle) {
      state.selectedId = null;
      renderOverlay();
      updateToolbar();
      updatePropsPanel();
      return;
    }
    var id = (layerEl || handle.parentElement).getAttribute("data-tlv-scene-layer");
    var layer = getLayer(id);
    if (!layer || layer.locked) return;
    state.selectedId = id;
    renderOverlay();
    updateToolbar();
    updatePropsPanel();

    var pt = clientToDesign(e.clientX, e.clientY);
    state.drag = {
      id: id,
      mode: handle ? "resize" : "move",
      handle: handle ? handle.getAttribute("data-tlv-scene-handle") : null,
      startX: pt.x,
      startY: pt.y,
      orig: { x: layer.x, y: layer.y, width: layer.width, height: layer.height },
      pointerId: e.pointerId,
    };
    state.overlay.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (!state.drag) return;
    var layer = getLayer(state.drag.id);
    if (!layer) return;
    var pt = clientToDesign(e.clientX, e.clientY);
    var dx = pt.x - state.drag.startX;
    var dy = pt.y - state.drag.startY;
    var o = state.drag.orig;

    if (state.drag.mode === "move") {
      layer.x = o.x + dx;
      layer.y = o.y + dy;
      clampLayer(layer);
    } else {
      var h = state.drag.handle;
      var aspect = o.width / o.height;
      var nx = o.x;
      var ny = o.y;
      var nw = o.width;
      var nh = o.height;
      if (h === "se") {
        nw = o.width + dx;
        nh = layer.keepAspect ? nw / aspect : o.height + dy;
      } else if (h === "sw") {
        nw = o.width - dx;
        nh = layer.keepAspect ? nw / aspect : o.height + dy;
        nx = o.x + (o.width - nw);
      } else if (h === "ne") {
        nw = o.width + dx;
        nh = layer.keepAspect ? nw / aspect : o.height - dy;
        ny = o.y + (o.height - nh);
      } else if (h === "nw") {
        nw = o.width - dx;
        nh = layer.keepAspect ? nw / aspect : o.height - dy;
        nx = o.x + (o.width - nw);
        ny = o.y + (o.height - nh);
      }
      layer.x = nx;
      layer.y = ny;
      layer.width = nw;
      layer.height = nh;
      clampLayer(layer);
    }
    renderOverlay();
  }

  function onPointerUp() {
    if (!state.drag) return;
    try {
      state.overlay?.releasePointerCapture?.(state.drag.pointerId);
    } catch (_) {}
    state.drag = null;
    persist();
  }

  function setEnabled(on) {
    state.enabled = Boolean(on);
    if (state.enabled && !state.selectedId) state.selectedId = CAMERA_LAYER_ID;
    connectPreviewAndPublish();
    renderOverlay();
    updatePropsPanel();
    persist();
  }

  function toggleVisibility(id) {
    var layer = getLayer(id || state.selectedId || CAMERA_LAYER_ID);
    if (!layer) return;
    layer.visible = !layer.visible;
    persist();
    updatePropsPanel();
    drawFrame();
  }

  function bringForward(id) {
    var layer = getLayer(id || state.selectedId);
    if (!layer) return;
    layer.zIndex = (layer.zIndex || 1) + 1;
    persist();
  }

  function sendBackward(id) {
    var layer = getLayer(id || state.selectedId);
    if (!layer) return;
    layer.zIndex = Math.max(1, (layer.zIndex || 1) - 1);
    persist();
  }

  function resetLayout() {
    stopAllScreenRuntimes({ removeEl: true });
    revokeAllObjectUrls();
    // Reset is camera-only — any Comments Source is dropped, so stop its polling too.
    if (hasCommentsLayer()) commentsAdapter()?.unbind?.();
    state.scene = defaultScene();
    state.selectedId = CAMERA_LAYER_ID;
    state.imageCache = {};
    state.imageLoadPromises = {};
    persist();
    updatePropsPanel();
    bindCameraSource();
    drawFrame();
    connectPreviewAndPublish();
  }

  function onFormalStreamReady() {
    var freshLoad = !state.scene;
    if (freshLoad) state.scene = loadScene();
    setDesignSize(
      (state.scene.canvas && state.scene.canvas.width) || DESIGN_W,
      (state.scene.canvas && state.scene.canvas.height) || DESIGN_H
    );
    applyStageAspect(); // aspect-boot
    if (!mountDom()) return { ok: false, error: "no_host" };
    bindCameraSource();
    connectPreviewAndPublish();
    renderOverlay();
    updatePropsPanel();
    if (freshLoad) hydrateAssets();
    try {
      global.TasuTlvLiveKitFormal?.onFormalStreamChanged?.();
    } catch (_e) {
      /* non-fatal */
    }
    return { ok: true };
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
      // Ignore publish_input — Scene setPublishStream would otherwise loop with Beauty notify.
      if (payload && payload.reason === "publish_input") return;
      bindCameraSource();
      if (state.enabled) connectPreviewAndPublish();
      else if (state.previewVideo) {
        state.previewVideo.srcObject = m.getFormalMediaStreamOutput?.() || null;
      }
    });
  }

  function subscribeBeauty() {
    if (state.unsubBeauty) {
      try {
        state.unsubBeauty();
      } catch (_) {}
      state.unsubBeauty = null;
    }
    var unsubs = [];
    var api = beautyApi();
    if (api?.onChange) {
      unsubs.push(
        api.onChange(function (payload) {
          // Shader uniforms update live — no camera rebind needed for slider tweaks.
          if (payload && payload.reason === "params") return;
          refreshCameraSource();
        })
      );
    }
    var poc = beautyPocApi();
    // Subscribe PoC only when Dev surface is active — avoid notify/rebind noise on normal Go Live.
    if (poc?.isPocSurface?.() && poc?.onChange) {
      unsubs.push(
        poc.onChange(function () {
          refreshCameraSource();
        })
      );
    }
    var snap = snapEffectsApi();
    if (snap?.onChange) {
      unsubs.push(
        snap.onChange(function (payload) {
          if (payload && payload.reason === "catalog") return;
          refreshCameraSource();
        })
      );
    }
    state.unsubBeauty = function () {
      unsubs.forEach(function (u) {
        try {
          u();
        } catch (_) {}
      });
    };
  }

  /** Idempotent subscribe: adapter.onChange only triggers drawFrame — never starts a new rAF loop. */
  function subscribeComments() {
    if (state.unsubComments) {
      try {
        state.unsubComments();
      } catch (_) {}
      state.unsubComments = null;
    }
    var api = commentsAdapter();
    if (!api?.onChange) return;
    state.unsubComments = api.onChange(function () {
      drawFrame();
    });
  }

  function cleanup() {
    stopLoop();
    stopOwnedCaptureTracks();
    stopAllScreenRuntimes({ removeEl: true });
    revokeAllObjectUrls();
    state.compositedStream = null;
    if (state.unsubMedia) {
      try {
        state.unsubMedia();
      } catch (_) {}
      state.unsubMedia = null;
    }
    if (state.unsubBeauty) {
      try {
        state.unsubBeauty();
      } catch (_) {}
      state.unsubBeauty = null;
    }
    // Unbind our onChange listener only — Formal Mic / adapter poll ownership are untouched.
    if (state.unsubComments) {
      try {
        state.unsubComments();
      } catch (_) {}
      state.unsubComments = null;
    }
    try {
      media()?.syncPublishFromFormalOutput?.();
    } catch (_) {}
  }

  function getDiagnostics() {
    var pub = media()?.getPublishStream?.() || null;
    var screenIds = Object.keys(state.screenRuntimes);
    var layers = state.scene?.layers || [];
    return {
      version: VERSION,
      enabled: state.enabled,
      design: { width: DESIGN_W, height: DESIGN_H },
      layerCount: layers.length,
      screenLayerCount: layers.filter(function (l) {
        return l.type === "screen";
      }).length,
      textLayerCount: layers.filter(function (l) {
        return l.type === "text";
      }).length,
      imageLayerCount: layers.filter(function (l) {
        return l.type === "image";
      }).length,
      logoLayerCount: layers.filter(function (l) {
        return l.type === "logo";
      }).length,
      commentsLayerCount: layers.filter(function (l) {
        return l.type === "comments";
      }).length,
      informationLayerCount: layers.filter(function (l) {
        return l.type === "information";
      }).length,
      timetableLayerCount: layers.filter(function (l) {
        return l.type === "timetable";
      }).length,
      vtuberLayerCount: layers.filter(function (l) {
        return l.type === "vtuber";
      }).length,
      commentsBound: Boolean(commentsAdapter()?.getSnapshot?.().bound),
      commentsCount: commentsAdapter()?.getSnapshot?.().count || 0,
      commentsFormalStore: commentsAdapter()?.FORMAL_STORE || null,
      imageCacheSize: Object.keys(state.imageCache).length,
      selectedId: state.selectedId,
      loopRunning: state.loopRunning,
      fpsEstimate: state.fpsEstimate,
      hasComposited: Boolean(state.compositedStream),
      publishIsComposited: Boolean(state.compositedStream && pub && pub === state.compositedStream),
      previewIsComposited: Boolean(
        state.enabled && state.previewVideo && state.previewVideo.srcObject === state.compositedStream
      ),
      ownedCaptureTracks: state.ownedCaptureTracks.length,
      activeScreenRuntimes: screenIds.length,
      displayMediaInvokeCount: state.displayMediaInvokeCount,
      supportsDisplayMedia: supportsDisplayMedia(),
      hasAssetStore: Boolean(assetStore()),
      screenAudioIgnored: screenIds.some(function (id) {
        return state.screenRuntimes[id]?.hasAudio;
      }),
      audioSsot: "formal_mic",
      cameraSource: (function () {
        try {
          return beautyApi()?.getOutputStream?.() ? "beauty" : "formal";
        } catch (_) {
          return "formal";
        }
      })(),
      beautyActive: Boolean(beautyApi()?.getOutputStream?.()),
      storageKey: STORAGE_KEY,
      gameTemplateFoundation: true,
      templateId: state.scene?.templateId || null,
      templatesAvailable: templatesRegistry()?.listTemplates?.().length || 0,
      aspectRatio: resolveAspect(state.scene && state.scene.canvas && state.scene.canvas.aspectRatio),
      outputDimensions: getOutputDimensions(),
    };
  }

  function boot() {
    state.scene = loadScene();
    setDesignSize(
      (state.scene.canvas && state.scene.canvas.width) || DESIGN_W,
      (state.scene.canvas && state.scene.canvas.height) || DESIGN_H
    );
    if (!mountDom()) return { ok: false, error: "no_host" };
    applyStageAspect();
    if (!state.booted) {
      subscribeMedia();
      subscribeBeauty();
      subscribeComments();
      document.addEventListener("pointermove", onPointerMove);
      document.addEventListener("pointerup", onPointerUp);
      document.addEventListener("pointercancel", onPointerUp);
      global.addEventListener("pagehide", cleanup);
      global.addEventListener("beforeunload", cleanup);
      document.addEventListener("visibilitychange", function () {
        if (document.hidden) {
          if (!state.enabled) stopLoop();
        } else if (state.enabled && !state.loopRunning) {
          startLoop();
        }
      });
      document.addEventListener("click", function (e) {
        if (state.addMenu && !e.target.closest("[data-tlv-scene-toolbar]")) setAddMenuOpen(false);
        if (
          state.templatePanel &&
          !e.target.closest("[data-tlv-scene-templates]") &&
          !e.target.closest('[data-tlv-scene-act="templates"]')
        ) {
          setTemplatePanelOpen(false);
        }
      });
      state.booted = true;
    }
    onFormalStreamReady();
    hydrateAssets();
    if (hasCommentsLayer()) commentsAdapter()?.syncFromGoLive?.();
    return { ok: true, scene: cloneScene(state.scene) };
  }

  global.TasuOneTlvSceneEditor = {
    VERSION: VERSION,
    STORAGE_KEY: STORAGE_KEY,
    ASPECT_PRESETS: ASPECT_PRESETS,
    get DESIGN_W() {
      return DESIGN_W;
    },
    get DESIGN_H() {
      return DESIGN_H;
    },
    setAspectRatio: setAspectRatio,
    getAspectRatio: function () {
      return resolveAspect(state.scene && state.scene.canvas && state.scene.canvas.aspectRatio);
    },
    getOutputDimensions: getOutputDimensions,
    boot: boot,
    onFormalStreamReady: onFormalStreamReady,
    refreshCameraSource: refreshCameraSource,
    setEnabled: setEnabled,
    isEnabled: function () {
      return state.enabled;
    },
    getScene: function () {
      return cloneScene(state.scene || defaultScene());
    },
    saveScene: saveScene,
    loadScene: function () {
      // Restore geometry only — never auto getDisplayMedia
      stopAllScreenRuntimes({ removeEl: true });
      state.scene = loadScene();
      renderOverlay();
      updateToolbar();
      updatePropsPanel();
      // Sync paint before rAF — Save/Restore and QA toDataURL must see restored layers immediately.
      drawFrame();
      connectPreviewAndPublish();
      hydrateAssets();
      return cloneScene(state.scene);
    },
    resetLayout: resetLayout,
    toggleVisibility: toggleVisibility,
    bringForward: bringForward,
    sendBackward: sendBackward,
    addCameraSource: addCameraSource,
    addScreenSource: addScreenSource,
    addTextSource: addTextSource,
    addImageSource: function () {
      return addImageOrLogoSource("image");
    },
    addLogoSource: function () {
      return addImageOrLogoSource("logo");
    },
    addCommentsSource: addCommentsSource,
    addInformationSource: addInformationSource,
    addTimetableSource: addTimetableSource,
    addVtuberSource: addVtuberSource,
    ensureVtuberLayer: ensureVtuberLayer,
    setLayerVisibility: setLayerVisibility,
    replaceSelectedAsset: replaceSelectedAsset,
    hydrateAssets: hydrateAssets,
    removeSource: removeSource,
    startScreenCaptureForLayer: startScreenCaptureForLayer,
    applyLayerTemplate: applyLayerTemplate,
    applyTemplate: applyTemplate,
    isSceneEdited: isSceneEdited,
    gamePipTemplateLayers: gamePipTemplateLayers,
    getCompositedStream: function () {
      return state.compositedStream;
    },
    getDiagnostics: getDiagnostics,
    cleanup: cleanup,
  };
})(typeof window !== "undefined" ? window : globalThis);
