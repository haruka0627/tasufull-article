/**
 * one-tlv-scene-templates.js
 * Built-in Scene Template Registry (V1) — Game / Talk / Simple Camera.
 *
 * Templates are layout definitions only (not a second Scene Store).
 * Apply → clone/normalize into TasuOneTlvSceneEditor current scene.
 * Never mutates template objects in place. Never auto getDisplayMedia / getUserMedia.
 */
(function (global) {
  "use strict";

  var DESIGN_W = 1920;
  var DESIGN_H = 1080;
  /** Authoring space for built-in templates. Scene Editor scales into active canvas (1280×720 / 720×1280). */
  var TEMPLATE_AUTHOR_W = 1920;
  var TEMPLATE_AUTHOR_H = 1080;
  var TEMPLATE_VERSION = 1;
  var CAMERA_ID = "camera-1";

  var LABELS = Object.freeze({
    choose: "Choose Template",
    apply: "Apply",
    confirmReplace: "Apply template?\nYour current layout will be replaced.",
    gameTitle: "Game",
    gameDesc: "Screen main + camera PIP + comments",
    talkTitle: "Talk",
    talkDesc: "Camera main + comments + lower third",
    simpleTitle: "Simple Camera",
    simpleDesc: "Camera full canvas — start simple",
  });

  function deepClone(v) {
    return JSON.parse(JSON.stringify(v));
  }

  /** Built-in definitions — single registry for future Built-in / Official / Premium. */
  var BUILTIN = Object.freeze([
    Object.freeze({
      id: "game",
      version: TEMPLATE_VERSION,
      label: LABELS.gameTitle,
      description: LABELS.gameDesc,
      category: "builtin",
      canvas: Object.freeze({ width: DESIGN_W, height: DESIGN_H, aspectRatio: "16:9" }),
      layers: Object.freeze([
        Object.freeze({
          id: "screen-1",
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
        }),
        Object.freeze({
          id: "comments-1",
          type: "comments",
          label: "Comments",
          x: 1480,
          y: 48,
          width: 400,
          height: 700,
          zIndex: 2,
          visible: true,
          locked: false,
          keepAspect: false,
          maxItems: 5,
          fontSize: 26,
          showAvatar: true,
          showName: true,
          backgroundStyle: "soft",
        }),
        Object.freeze({
          id: CAMERA_ID,
          type: "camera",
          label: "Camera",
          x: 1480,
          y: 780,
          width: 400,
          height: 225,
          zIndex: 3,
          visible: true,
          locked: false,
          keepAspect: true,
        }),
      ]),
    }),
    Object.freeze({
      id: "talk",
      version: TEMPLATE_VERSION,
      label: LABELS.talkTitle,
      description: LABELS.talkDesc,
      category: "builtin",
      canvas: Object.freeze({ width: DESIGN_W, height: DESIGN_H, aspectRatio: "16:9" }),
      layers: Object.freeze([
        Object.freeze({
          id: CAMERA_ID,
          type: "camera",
          label: "Camera",
          x: 0,
          y: 0,
          width: 1400,
          height: DESIGN_H,
          zIndex: 1,
          visible: true,
          locked: false,
          keepAspect: true,
        }),
        Object.freeze({
          id: "comments-1",
          type: "comments",
          label: "Comments",
          x: 1420,
          y: 80,
          width: 460,
          height: 820,
          zIndex: 2,
          visible: true,
          locked: false,
          keepAspect: false,
          maxItems: 5,
          fontSize: 28,
          showAvatar: true,
          showName: true,
          backgroundStyle: "soft",
        }),
        Object.freeze({
          id: "text-lower-third",
          type: "text",
          label: "Text",
          x: 64,
          y: 920,
          width: 1280,
          height: 120,
          zIndex: 3,
          visible: true,
          locked: false,
          keepAspect: false,
          text: "Talking Live",
          fontSize: 56,
          color: "#ffffff",
          align: "left",
          fontWeight: "bold",
        }),
      ]),
    }),
    Object.freeze({
      id: "simple-camera",
      version: TEMPLATE_VERSION,
      label: LABELS.simpleTitle,
      description: LABELS.simpleDesc,
      category: "builtin",
      canvas: Object.freeze({ width: DESIGN_W, height: DESIGN_H, aspectRatio: "16:9" }),
      layers: Object.freeze([
        Object.freeze({
          id: CAMERA_ID,
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
        }),
      ]),
    }),
  ]);

  var byId = Object.create(null);
  BUILTIN.forEach(function (t) {
    byId[t.id] = t;
  });

  function listTemplates() {
    return BUILTIN.map(function (t) {
      return {
        id: t.id,
        version: t.version,
        label: t.label,
        description: t.description,
        category: t.category,
      };
    });
  }

  function getTemplate(id) {
    var t = byId[String(id || "")];
    return t ? deepClone(t) : null;
  }

  function getTemplateLayers(id) {
    var t = getTemplate(id);
    return t ? t.layers : null;
  }

  /**
   * Apply builtin template into Scene Editor.
   * @param {string} id
   * @param {{ force?: boolean, confirmFn?: Function }} [opts]
   */
  function applyTemplate(id, opts) {
    opts = opts || {};
    var sceneApi = global.TasuOneTlvSceneEditor;
    if (!sceneApi?.applyTemplate) {
      // Fallback: layers only via applyLayerTemplate
      var layers = getTemplateLayers(id);
      if (!layers || !sceneApi?.applyLayerTemplate) {
        return { ok: false, error: "scene_editor_unavailable" };
      }
      if (!opts.force && sceneApi.isSceneEdited?.() && !confirmApply(opts)) {
        return { ok: false, cancelled: true };
      }
      var res = sceneApi.applyLayerTemplate(layers);
      if (res?.ok) {
        try {
          var sc = sceneApi.getScene?.();
          if (sc) {
            sc.templateId = String(id);
            // best-effort persist via save if available after mutate — editor owns state
          }
        } catch (_) {}
      }
      return Object.assign({ templateId: id }, res || { ok: false });
    }
    return sceneApi.applyTemplate(id, opts);
  }

  function confirmApply(opts) {
    var fn = opts.confirmFn || (typeof global.confirm === "function" ? global.confirm.bind(global) : null);
    if (!fn) return true;
    return Boolean(fn(LABELS.confirmReplace));
  }

  global.TasuOneTlvSceneTemplates = {
    VERSION: TEMPLATE_VERSION,
    DESIGN_W: DESIGN_W,
    DESIGN_H: DESIGN_H,
    LABELS: LABELS,
    listTemplates: listTemplates,
    getTemplate: getTemplate,
    getTemplateLayers: getTemplateLayers,
    applyTemplate: applyTemplate,
    confirmApply: confirmApply,
    BUILTIN_IDS: Object.freeze(["game", "talk", "simple-camera"]),
  };
})(typeof window !== "undefined" ? window : globalThis);
