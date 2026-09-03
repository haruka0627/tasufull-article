/**
 * one-tlv-go-live-vtuber-basic.mjs
 *
 * TLV 3D VTuber V1 (formalized):
 *   Formal Camera MediaStream (read-only · no extra getUserMedia)
 *     → MediaPipe Face Landmarker (browser local)
 *     → TLV Tracking Adapter → TLV Tracking Contract
 *     → TLV Motion Mapper → @pixiv/three-vrm (WebGL2 alpha)
 *     → Transparent canvas
 *     → Scene Editor layer type "vtuber"
 *     → compositedStream → Formal LiveKit
 *
 * Forbidden: getUserMedia ownership, Premium SDKs, Ready Player Me, LiveKit direct publish.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { createEmptyTrackingFrame } from "./one-tlv-vtuber-tracking-contract.mjs";
import { createMediapipeTrackingAdapter } from "./one-tlv-vtuber-mediapipe-adapter.mjs";
import { createMotionMapper } from "./one-tlv-vtuber-motion-mapper.mjs";
import {
  PRESET_VRM_LABEL,
  PRESET_VRM_URL,
  extractVrmLicenseMeta,
  validateVrmUpload,
} from "./one-tlv-vtuber-vrm-guard.mjs";
import {
  createVrmBlobUrlOwner,
  createVrmReplacementGate,
  isBlobUrl,
} from "./one-tlv-vtuber-vrm-blob-lifecycle.mjs";

const VERSION = 4;
const OWNER = "TasuOneTlvGoLiveVtuberBasic";
const STORAGE_KEY = "tlv_go_live_vtuber_basic_v1";
const VTUBER_LAYER_ID = "vtuber-1";
const WASM_ROOT = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

/** V1 device class — Desktop | Mobile only (no per-model hardcode). */
function detectDeviceClass() {
  try {
    const ua = String(navigator.userAgent || "");
    if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) return "mobile";
    // iPadOS may report Macintosh + touch
    if (Number(navigator.maxTouchPoints || 0) > 1 && /Macintosh/i.test(ua)) return "mobile";
  } catch (_) {}
  return "desktop";
}

/**
 * V1 performance preset (Mobile Basic = usable realtime, not max quality).
 * Desktop: long-edge 1280 · 30 render / 24 track
 * Mobile:  long-edge 480 · 15 render / 8 track · CPU MediaPipe · VRM spring/constraint off
 *
 * FIRST_PERFORMANCE_BOTTLENECK (XR path audit):
 *   NOT devicePixelRatio on VTuber (already setPixelRatio(1)).
 *   Primary: Scene composite at 720×1280/1280×720 + VRM spring/constraint update on ~36k tris.
 *   Secondary: MediaPipe inference + dual capped rAF.
 */
function buildDeviceProfile(deviceClass) {
  if (deviceClass === "mobile") {
    return {
      deviceClass: "mobile",
      maxLongEdge: 480,
      renderWidth: 270,
      renderHeight: 480,
      targetRenderFps: 15,
      targetTrackingFps: 8,
      targetComposeFps: 15,
      antialias: false,
      mediapipeDelegate: "CPU",
      powerPreference: "low-power",
      pixelRatioCap: 1,
      simplifyVrmRuntime: true,
      hand: false,
      pose: false,
      advancedIk: false,
      heavyPostEffects: false,
    };
  }
  return {
    deviceClass: "desktop",
    maxLongEdge: 1280,
    renderWidth: 720,
    renderHeight: 1280,
    targetRenderFps: 30,
    targetTrackingFps: 24,
    targetComposeFps: 30,
    antialias: true,
    mediapipeDelegate: "GPU",
    powerPreference: "high-performance",
    pixelRatioCap: 1,
    simplifyVrmRuntime: false,
    hand: false,
    pose: false,
    advancedIk: false,
    heavyPostEffects: false,
  };
}

function getSceneAspectKey() {
  try {
    const ar = sceneEditor()?.getAspectRatio?.();
    if (ar === "16:9" || ar === "9:16") return ar;
  } catch (_) {}
  return "9:16";
}

/** Size WebGL buffer to Scene aspect; long-edge capped by profile (not CSS). */
function resolveRenderSize(profile, aspectKey) {
  const longEdge = Math.max(160, Number(profile.maxLongEdge) || 720);
  if (aspectKey === "16:9") {
    const w = longEdge;
    const h = Math.max(90, Math.round((longEdge * 9) / 16));
    return { width: w, height: h, aspectKey: "16:9" };
  }
  const h = longEdge;
  const w = Math.max(90, Math.round((longEdge * 9) / 16));
  return { width: w, height: h, aspectKey: "9:16" };
}

const trackingAdapter = createMediapipeTrackingAdapter(THREE);
const motionMapper = createMotionMapper({ mirror: true });
const blobUrls = createVrmBlobUrlOwner();

function disposeVrmInstance(vrm) {
  if (!vrm) return;
  try {
    state.scene?.remove(vrm.scene);
  } catch (_) {}
  try {
    VRMUtils.deepDispose?.(vrm.scene);
  } catch (_) {}
}

const vrmGate = createVrmReplacementGate({
  blobOwner: blobUrls,
  disposeInstance: disposeVrmInstance,
});

const state = {
  booted: false,
  enabled: false,
  tracking: true,
  mirror: true,
  cameraVisMode: "both", // both | avatar_only | camera_only
  deviceClass: "desktop",
  profile: buildDeviceProfile("desktop"),
  fallbackReason: null,
  lastError: null,
  landmarker: null,
  landmarkerReady: false,
  landmarkerDelegate: null,
  inputVideo: null,
  renderer: null,
  scene: null,
  camera: null,
  clock: null,
  vrm: null,
  vrmMeta: null,
  vrmStats: null,
  licenseMeta: null,
  lastTrackingFrame: null,
  objectUrl: null,
  rafRender: 0,
  lastRenderAt: 0,
  lastTrackAt: 0,
  loopsPaused: false,
  visHandler: null,
  lastVideoTime: -1,
  metrics: {
    trackingFps: 0,
    renderFps: 0,
    trackMs: 0,
    loadMs: 0,
    trackFrames: 0,
    renderFrames: 0,
    lastTrackBucket: 0,
    lastRenderBucket: 0,
    droppedTrack: 0,
    activeRafCount: 0,
    skippedRender: 0,
    skippedTrack: 0,
  },
  listeners: [],
  unsubMedia: null,
};

function media() {
  return window.TasuOneTlvGoLiveMedia || null;
}

function sceneEditor() {
  return window.TasuOneTlvSceneEditor || null;
}

function notify(reason) {
  const payload = { reason: reason || "update", state: getPublicState() };
  state.listeners.slice().forEach((fn) => {
    try {
      fn(payload);
    } catch (_) {}
  });
}

function persist() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        enabled: state.enabled,
        tracking: state.tracking,
        mirror: state.mirror,
        cameraVisMode: state.cameraVisMode,
      }),
    );
  } catch (_) {}
}

function loadPersisted() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const p = JSON.parse(raw);
    if (!p || typeof p !== "object") return;
    state.tracking = p.tracking !== false;
    state.mirror = p.mirror !== false;
    motionMapper.setMirror(state.mirror);
    if (["both", "avatar_only", "camera_only"].includes(p.cameraVisMode)) {
      state.cameraVisMode = p.cameraVisMode;
    }
  } catch (_) {}
}

function ensureInputVideo() {
  if (state.inputVideo) return state.inputVideo;
  const v = document.createElement("video");
  v.muted = true;
  v.playsInline = true;
  v.setAttribute("playsinline", "");
  v.setAttribute("data-tlv-vtuber-input", "1");
  v.style.cssText =
    "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:-9999px";
  document.body.appendChild(v);
  state.inputVideo = v;
  return v;
}

function getFormalStream() {
  const m = media();
  return m?.getFormalMediaStreamOutput?.() || m?.getActiveMediaStream?.() || null;
}

function formalAlive(stream) {
  if (!stream) return false;
  return (stream.getVideoTracks?.() || []).some((t) => t && t.readyState === "live");
}

/**
 * Reuse Formal camera MediaStream — never call getUserMedia here.
 * Tracking camera is logical-input only; Viewer sees Scene Webcam only if that source is added.
 */
function syncFormalInput() {
  const v = ensureInputVideo();
  const formal = getFormalStream();
  if (!formalAlive(formal)) return { ok: false, error: "no_formal" };
  if (v.srcObject !== formal) {
    v.srcObject = formal;
    v.play().catch(() => {});
  }
  return { ok: true };
}

function avatarLayerVisible() {
  return state.enabled && state.cameraVisMode !== "camera_only";
}

async function ensureLandmarker() {
  const wantDelegate = state.profile.mediapipeDelegate || "GPU";
  if (
    state.landmarkerReady &&
    state.landmarker &&
    state.landmarkerDelegate === wantDelegate
  ) {
    return state.landmarker;
  }
  if (state.landmarker) {
    try {
      state.landmarker.close?.();
    } catch (_) {}
    state.landmarker = null;
    state.landmarkerReady = false;
    state.landmarkerDelegate = null;
  }
  const vision = await FilesetResolver.forVisionTasks(WASM_ROOT);
  state.landmarker = await FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: MODEL_URL,
      delegate: wantDelegate,
    },
    runningMode: "VIDEO",
    numFaces: 1,
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: true,
  });
  state.landmarkerDelegate = wantDelegate;
  state.landmarkerReady = true;
  return state.landmarker;
}

function ensureRenderer() {
  if (state.renderer) return;
  const profile = state.profile;
  const size = resolveRenderSize(profile, getSceneAspectKey());
  const rw = size.width;
  const rh = size.height;
  // preserveDrawingBuffer:true — Scene compositor drawImage() on a separate rAF
  // must still read the last Avatar frame (Mobile Safari black-preview root cause).
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: Boolean(profile.antialias),
    premultipliedAlpha: false,
    preserveDrawingBuffer: true,
    powerPreference: profile.powerPreference || "default",
  });
  // Explicit cap — never let DPR inflate backing store (iPhone XR audit target).
  renderer.setPixelRatio(Math.min(1, Number(profile.pixelRatioCap) || 1));
  renderer.setSize(rw, rh, false);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const canvas = renderer.domElement;
  canvas.setAttribute("data-tlv-vtuber-canvas", "1");
  canvas.setAttribute("data-tlv-vtuber-preserve-drawing-buffer", "1");
  canvas.style.cssText =
    "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:-9999px";
  document.body.appendChild(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, rw / rh, 0.1, 100);
  camera.position.set(0, 1.35, 1.55);
  camera.lookAt(0, 1.25, 0);
  scene.add(new THREE.AmbientLight(0xffffff, 1.6));
  const key = new THREE.DirectionalLight(0xffffff, 1.1);
  key.position.set(0.6, 1.4, 1.2);
  scene.add(key);

  state.renderer = renderer;
  state.scene = scene;
  state.camera = camera;
  state.clock = new THREE.Clock();
  state.profile.renderWidth = rw;
  state.profile.renderHeight = rh;
}

/**
 * Fit full VRM AABB into frustum for current camera.aspect (Scene 16:9 / 9:16).
 * Head-safe top margin + bottom margin — not CSS scale.
 */
function frameVrm(vrm) {
  if (!state.camera || !vrm?.scene) return;
  const box = new THREE.Box3().setFromObject(vrm.scene);
  if (box.isEmpty()) return;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  const padX = 1.1;
  const padTop = 1.16; // head-safe
  const padBot = 1.08;
  const worldTop = box.max.y + size.y * (padTop - 1);
  const worldBot = box.min.y - size.y * (padBot - 1);
  const worldLeft = center.x - (size.x * padX) / 2;
  const worldRight = center.x + (size.x * padX) / 2;
  const fitH = Math.max(0.1, worldTop - worldBot);
  const fitW = Math.max(0.1, worldRight - worldLeft);
  const fitCenterY = (worldTop + worldBot) / 2;
  const fitCenterX = (worldLeft + worldRight) / 2;

  const fovY = (state.camera.fov * Math.PI) / 180;
  const aspect = Math.max(0.2, state.camera.aspect || 1);
  const distH = fitH / 2 / Math.tan(fovY / 2);
  const distW = fitW / 2 / (Math.tan(fovY / 2) * aspect);
  const dist = Math.max(distH, distW, 1.0) * 1.04;

  state.camera.position.set(fitCenterX, fitCenterY, center.z + dist);
  state.camera.lookAt(fitCenterX, fitCenterY, center.z);
  state.camera.near = Math.max(0.05, dist / 80);
  state.camera.far = Math.max(40, dist * 12);
  state.camera.updateProjectionMatrix();
}

/** Keep WebGL size + camera.aspect aligned to Scene aspect SSOT. */
function syncRendererToSceneAspect(forceFrame) {
  if (!state.renderer || !state.camera) return;
  const profile = state.profile;
  const size = resolveRenderSize(profile, getSceneAspectKey());
  const el = state.renderer.domElement;
  const dprCap = Math.min(1, Number(profile.pixelRatioCap) || 1);
  if (state.renderer.getPixelRatio() !== dprCap) {
    state.renderer.setPixelRatio(dprCap);
  }
  if (el.width !== size.width || el.height !== size.height) {
    state.renderer.setSize(size.width, size.height, false);
    state.profile.renderWidth = size.width;
    state.profile.renderHeight = size.height;
  }
  const nextAspect = size.width / size.height;
  if (Math.abs(state.camera.aspect - nextAspect) > 0.001) {
    state.camera.aspect = nextAspect;
    state.camera.updateProjectionMatrix();
    forceFrame = true;
  }
  if (forceFrame && state.vrm) frameVrm(state.vrm);
}

function applyMobileVrmSimplification(vrm) {
  if (!state.profile.simplifyVrmRuntime || !vrm) return;
  // Drop spring / node-constraint runtime cost on Mobile Basic (expressions + humanoid remain).
  try {
    if (vrm.springBoneManager) vrm.springBoneManager = null;
  } catch (_) {}
  try {
    if (vrm.nodeConstraintManager) vrm.nodeConstraintManager = null;
  } catch (_) {}
}

function disposeVrm() {
  vrmGate.invalidateAndClear();
  state.vrm = null;
  state.vrmMeta = null;
  state.licenseMeta = null;
  state.vrmStats = null;
  state.objectUrl = null;
  motionMapper.reset();
}

function estimateVrmStats(vrm) {
  let triangles = 0;
  let meshes = 0;
  let materials = 0;
  let textures = 0;
  const matSet = new Set();
  const texSet = new Set();
  try {
    vrm.scene?.traverse?.((obj) => {
      if (!obj.isMesh && !obj.isSkinnedMesh) return;
      meshes += 1;
      const geo = obj.geometry;
      if (geo) {
        const idx = geo.index;
        if (idx) triangles += Math.floor(idx.count / 3);
        else if (geo.attributes?.position) {
          triangles += Math.floor(geo.attributes.position.count / 3);
        }
      }
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((m) => {
        if (!m) return;
        matSet.add(m.uuid || m);
        Object.keys(m).forEach((k) => {
          const v = m[k];
          if (v && v.isTexture) texSet.add(v.uuid || v);
        });
      });
    });
  } catch (_) {}
  materials = matSet.size;
  textures = texSet.size;
  // Rough GPU estimate: assume avg 1024² RGBA per unique texture when unknown.
  const textureMemoryEstimateBytes = textures * 1024 * 1024 * 4;
  return { triangles, meshes, materials, textures, textureMemoryEstimateBytes };
}

function applyLoadedVrm(vrm, sourceLabel, sourceKind, extra = {}) {
  try {
    VRMUtils.rotateVRM0?.(vrm);
  } catch (_) {}
  applyMobileVrmSimplification(vrm);
  if (state.scene && vrm.scene && vrm.scene.parent !== state.scene) {
    state.scene.add(vrm.scene);
  }
  state.vrm = vrm;
  state.vrmStats = estimateVrmStats(vrm);
  state.licenseMeta = extractVrmLicenseMeta(vrm, {
    source: sourceKind,
    sourceLabel: sourceLabel,
  });
  state.vrmMeta = {
    source: sourceLabel || "url",
    sourceKind,
    hubModelId: sourceKind === "vroid_hub" ? String(extra.hubModelId || "").trim() || null : null,
    hubListKind: sourceKind === "vroid_hub" ? extra.hubListKind || extra.listKind || "account" : null,
    metaVersion: state.licenseMeta.metaVersion || "unknown",
    name: state.licenseMeta.title,
    license: state.licenseMeta,
  };
  state.objectUrl = blobUrls.getActive();
  motionMapper.reset();
  syncRendererToSceneAspect(true);
}

/**
 * Load VRM from URL. Does NOT dispose the current avatar until the new file
 * parses and validates. Candidate blob URLs stay valid until commit/abandon.
 */
async function loadVrmFromUrl(url, sourceLabel, sourceKind = "url", opts = {}) {
  ensureRenderer();
  const t0 = performance.now();
  const gen = vrmGate.beginLoad();
  const blobUrl = opts.blobUrl || (isBlobUrl(url) ? url : null);

  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));
  let gltf;
  try {
    gltf = await loader.loadAsync(url);
  } catch (err) {
    const failed = vrmGate.failCandidate(gen, blobUrl, null, {
      error: "VRM_LOAD_FAILURE: " + (err?.message || String(err)),
    });
    if (failed.stale) return { ok: false, error: "superseded", superseded: true };
    state.lastError = failed.error;
    state.fallbackReason = "vrm_load_failure";
    notify("vrm_error");
    return { ok: false, error: state.lastError };
  }

  if (vrmGate.isStale(gen)) {
    const extra = gltf?.userData?.vrm || null;
    return vrmGate.failCandidate(gen, blobUrl, extra, { error: "superseded", superseded: true });
  }

  const vrm = gltf.userData?.vrm;
  if (!vrm) {
    const failed = vrmGate.failCandidate(gen, blobUrl, null, {
      error: "UNSUPPORTED_VRM: no VRM extension in file",
    });
    if (failed.stale) return { ok: false, error: "superseded", superseded: true };
    state.lastError = failed.error;
    state.fallbackReason = "unsupported_vrm";
    notify("vrm_error");
    return { ok: false, error: state.lastError };
  }
  if (!vrm.humanoid) {
    const failed = vrmGate.failCandidate(gen, blobUrl, vrm, {
      error: "UNSUPPORTED_VRM: missing humanoid",
    });
    if (failed.stale) return { ok: false, error: "superseded", superseded: true };
    state.lastError = failed.error;
    state.fallbackReason = "missing_humanoid";
    notify("vrm_error");
    return { ok: false, error: state.lastError };
  }

  const committed = vrmGate.commitSuccess({ gen, blobUrl, instance: vrm });
  if (!committed.ok) {
    if (committed.superseded) return { ok: false, error: "superseded", superseded: true };
    state.lastError = committed.error || "VRM_LOAD_FAILURE";
    state.fallbackReason = "vrm_load_failure";
    notify("vrm_error");
    return { ok: false, error: state.lastError };
  }

  applyLoadedVrm(vrm, sourceLabel || url, sourceKind, {
    hubModelId: opts.hubModelId,
    hubListKind: opts.listKind || opts.hubListKind,
  });
  state.metrics.loadMs = Number((performance.now() - t0).toFixed(1));
  state.lastError = null;
  state.fallbackReason = null;
  notify("vrm_loaded");
  return {
    ok: true,
    meta: state.vrmMeta,
    license: state.licenseMeta,
    loadMs: state.metrics.loadMs,
    warnings: state.licenseMeta.warnings,
    vrmStats: state.vrmStats,
  };
}

async function loadVrmFile(file, opts = {}) {
  const gate = validateVrmUpload(file);
  if (!gate.ok) {
    state.lastError = gate.error;
    state.fallbackReason = String(gate.code || "upload_rejected").toLowerCase();
    notify("vrm_error");
    return { ok: false, error: gate.error, code: gate.code };
  }
  const sourceKind = opts.sourceKind === "vroid_hub" ? "vroid_hub" : "user_upload";
  const url = blobUrls.createFromBlob(file);
  const hubModelId = sourceKind === "vroid_hub" ? String(opts.hubModelId || "").trim() : "";
  const hubListKind =
    sourceKind === "vroid_hub"
      ? opts.listKind === "hearts" || opts.listKind === "favorites"
        ? "hearts"
        : "account"
      : null;
  return loadVrmFromUrl(url, gate.name || file.name, sourceKind, {
    blobUrl: url,
    hubModelId,
    listKind: hubListKind,
  });
}

function clearAvatarIfSource(sourceKind) {
  const current = state.vrmMeta?.sourceKind;
  if (current !== sourceKind) {
    return { ok: true, cleared: false };
  }
  disposeVrm();
  notify("vrm_cleared");
  return { ok: true, cleared: true };
}

async function loadPresetVrm() {
  return loadVrmFromUrl(PRESET_VRM_URL, PRESET_VRM_LABEL, "tlv_preset");
}

function runTrackingOnce() {
  if (!state.enabled || !state.tracking || !state.landmarkerReady || !state.landmarker) {
    return;
  }
  const video = state.inputVideo;
  if (!video || video.readyState < 2) return;
  if (video.currentTime === state.lastVideoTime) return;
  state.lastVideoTime = video.currentTime;
  const t0 = performance.now();
  let result;
  try {
    result = state.landmarker.detectForVideo(video, t0);
  } catch (err) {
    state.metrics.droppedTrack += 1;
    state.lastError = "TRACKING_FAILURE: " + (err?.message || String(err));
    const lost = createEmptyTrackingFrame(t0);
    lost.trackingState = "lost";
    state.lastTrackingFrame = lost;
    motionMapper.applyToVrm(state.vrm, lost);
    return;
  }
  state.metrics.trackMs = Number((performance.now() - t0).toFixed(2));
  state.metrics.trackFrames += 1;
  const now = performance.now();
  if (now - state.metrics.lastTrackBucket >= 1000) {
    state.metrics.trackingFps = state.metrics.trackFrames;
    state.metrics.trackFrames = 0;
    state.metrics.lastTrackBucket = now;
  }

  const frame = trackingAdapter.toFrame(result, t0);
  state.lastTrackingFrame = frame;
  motionMapper.applyToVrm(state.vrm, frame);
}

function renderOnce() {
  if (!state.renderer || !state.scene || !state.camera) return;
  syncRendererToSceneAspect(false);
  if (!avatarLayerVisible()) {
    // Keep canvas transparent when avatar hidden — skip heavy work.
    state.renderer.clear(true, true, true);
    return;
  }
  const dt = state.clock ? state.clock.getDelta() : 0.016;
  if (state.vrm) {
    try {
      state.vrm.update?.(dt);
    } catch (_) {}
  }
  state.renderer.render(state.scene, state.camera);
  state.metrics.renderFrames += 1;
  const now = performance.now();
  if (now - state.metrics.lastRenderBucket >= 1000) {
    state.metrics.renderFps = state.metrics.renderFrames;
    state.metrics.renderFrames = 0;
    state.metrics.lastRenderBucket = now;
  }
}

function pageHidden() {
  try {
    return document.visibilityState === "hidden";
  } catch (_) {
    return false;
  }
}

/**
 * Single capped rAF: render + tracking at profile FPS (not uncapped dual work).
 * Scene compositor remains separate but is also FPS-capped (TARGET_FPS).
 */
function startLoops() {
  stopLoops();
  state.lastRenderAt = 0;
  state.lastTrackAt = 0;
  state.loopsPaused = pageHidden();
  const tick = (now) => {
    if (!state.enabled) {
      state.rafRender = 0;
      state.metrics.activeRafCount = 0;
      return;
    }
    state.rafRender = requestAnimationFrame(tick);
    state.metrics.activeRafCount = state.rafRender ? 1 : 0;
    if (state.loopsPaused || pageHidden()) return;

    const profile = state.profile;
    const renderInterval = 1000 / Math.max(1, profile.targetRenderFps);
    const trackInterval = 1000 / Math.max(1, profile.targetTrackingFps);

    if (now - state.lastRenderAt >= renderInterval - 0.5) {
      state.lastRenderAt = now;
      renderOnce();
    } else {
      state.metrics.skippedRender += 1;
    }

    // Tracking may run slower than render; skip when OFF / camera_only / no avatar.
    if (!state.tracking || !avatarLayerVisible()) {
      state.metrics.skippedTrack += 1;
      return;
    }
    if (now - state.lastTrackAt >= trackInterval - 0.5) {
      state.lastTrackAt = now;
      runTrackingOnce();
    } else {
      state.metrics.skippedTrack += 1;
    }
  };
  state.rafRender = requestAnimationFrame(tick);
  state.metrics.activeRafCount = 1;
}

function stopLoops() {
  if (state.rafRender) {
    cancelAnimationFrame(state.rafRender);
    state.rafRender = 0;
  }
  state.metrics.activeRafCount = 0;
}

function bindVisibility() {
  if (state.visHandler) return;
  state.visHandler = () => {
    const hidden = pageHidden();
    state.loopsPaused = hidden;
    if (hidden) {
      // Do not keep burning GPU while backgrounded.
      notify("visibility_hidden");
    } else if (state.enabled) {
      notify("visibility_visible");
    }
  };
  try {
    document.addEventListener("visibilitychange", state.visHandler);
  } catch (_) {}
}

function unbindVisibility() {
  if (!state.visHandler) return;
  try {
    document.removeEventListener("visibilitychange", state.visHandler);
  } catch (_) {}
  state.visHandler = null;
}

function applyCameraVisibilityMode() {
  const se = sceneEditor();
  if (!se) return;
  try {
    se.ensureVtuberLayer?.({
      visible: avatarLayerVisible(),
    });
  } catch (_) {}
  try {
    se.setLayerVisibility?.(VTUBER_LAYER_ID, avatarLayerVisible());
  } catch (_) {}
  try {
    se.setLayerVisibility?.("camera-1", state.cameraVisMode !== "avatar_only");
  } catch (_) {}
}

function ensureSceneLayer() {
  const se = sceneEditor();
  if (!se?.ensureVtuberLayer) return;
  se.ensureVtuberLayer({
    id: VTUBER_LAYER_ID,
    visible: avatarLayerVisible(),
  });
  applyCameraVisibilityMode();
}

async function setEnabled(on) {
  state.enabled = Boolean(on);
  persist();
  if (!state.enabled) {
    stopLoops();
    applyCameraVisibilityMode();
    try {
      sceneEditor()?.ensureVtuberLayer?.({ id: VTUBER_LAYER_ID, visible: false });
    } catch (_) {}
    notify("disabled");
    return { ok: true, enabled: false };
  }
  try {
    syncFormalInput();
    ensureRenderer();
    await ensureLandmarker();
    ensureSceneLayer();
    startLoops();
    state.fallbackReason = null;
    notify("enabled");
    return { ok: true, enabled: true };
  } catch (err) {
    state.enabled = false;
    state.fallbackReason = "init_failure";
    state.lastError = err?.message || String(err);
    stopLoops();
    notify("init_failed");
    return { ok: false, error: state.lastError };
  }
}

function setTracking(on) {
  state.tracking = Boolean(on);
  persist();
  notify("tracking");
  return { ok: true, tracking: state.tracking };
}

function setMirror(on) {
  state.mirror = Boolean(on);
  motionMapper.setMirror(state.mirror);
  persist();
  notify("mirror");
  return { ok: true, mirror: state.mirror };
}

function setCameraVisMode(mode) {
  if (!["both", "avatar_only", "camera_only"].includes(mode)) {
    return { ok: false, error: "invalid_mode" };
  }
  state.cameraVisMode = mode;
  persist();
  applyCameraVisibilityMode();
  notify("camera_vis");
  return { ok: true, cameraVisMode: mode };
}

function getOutputCanvas() {
  if (!state.enabled || !state.renderer) return null;
  return state.renderer.domElement;
}

function getPublicState() {
  return {
    version: VERSION,
    owner: OWNER,
    enabled: state.enabled,
    tracking: state.tracking,
    mirror: state.mirror,
    cameraVisMode: state.cameraVisMode,
    deviceClass: state.deviceClass,
    profile: { ...state.profile },
    hasVrm: Boolean(state.vrm),
    vrmMeta: state.vrmMeta,
    licenseMeta: state.licenseMeta,
    trackingContract: state.lastTrackingFrame
      ? {
          trackingState: state.lastTrackingFrame.trackingState,
          confidence: state.lastTrackingFrame.confidence,
          timestamp: state.lastTrackingFrame.timestamp,
        }
      : null,
    landmarkerReady: state.landmarkerReady,
    landmarkerDelegate: state.landmarkerDelegate,
    preserveDrawingBuffer: true,
    fallbackReason: state.fallbackReason,
    lastError: state.lastError,
    formalAlive: formalAlive(getFormalStream()),
    stack: {
      tracking: "MEDIAPIPE_FACE_LANDMARKER_TASKS_VISION",
      trackingContract: "TLV_OWN",
      avatarFormat: "VRM_1_0",
      avatarRuntime: "@pixiv/three-vrm",
      renderer: "THREE_JS_WEBGL2",
      motionMapping: "TLV_OWN_LIGHTWEIGHT_MAPPER",
      sceneIntegration: "EXISTING_VTUBER_LAYER_TYPE",
      mediaOutput: "COMPOSITED_STREAM_CAPTURESTREAM",
      rtc: "LIVEKIT_CLOUD",
      premiumTracking: "DEFER_TO_POC",
      readyPlayerMe: "NOT_ADOPTED",
    },
  };
}

function getMetrics() {
  const p = state.profile;
  const canvas = state.renderer?.domElement;
  return {
    trackingFps: state.metrics.trackingFps,
    renderFps: state.metrics.renderFps,
    trackMs: state.metrics.trackMs,
    loadMs: state.metrics.loadMs,
    droppedTrack: state.metrics.droppedTrack,
    canvas: {
      width: canvas?.width || p.renderWidth,
      height: canvas?.height || p.renderHeight,
    },
    targetRenderFps: p.targetRenderFps,
    targetTrackingFps: p.targetTrackingFps,
    targetComposeFps: p.targetComposeFps,
    activeRafCount: state.metrics.activeRafCount,
    skippedRender: state.metrics.skippedRender,
    skippedTrack: state.metrics.skippedTrack,
    loopsPaused: state.loopsPaused,
    pixelRatio: state.renderer ? state.renderer.getPixelRatio() : p.pixelRatioCap,
    vrmStats: state.vrmStats,
  };
}

function getPerfSnapshot() {
  const m = getMetrics();
  const se = sceneEditor();
  let composite = null;
  let composeTarget = state.profile.targetComposeFps;
  try {
    const diag = se?.getDiagnostics?.() || se?.getState?.() || null;
    const design = diag?.design || null;
    composite = design
      ? { width: design.width, height: design.height }
      : {
          width: se?.DESIGN_W,
          height: se?.DESIGN_H,
        };
  } catch (_) {}
  let videoInput = null;
  try {
    const v = state.inputVideo;
    if (v) {
      videoInput = {
        videoWidth: v.videoWidth || 0,
        videoHeight: v.videoHeight || 0,
        readyState: v.readyState,
      };
    }
  } catch (_) {}
  return {
    VTUBER_RENDER_FPS_ACTUAL: m.renderFps,
    SCENE_COMPOSE_FPS_TARGET: composeTarget,
    MEDIAPIPE_INFERENCE_FPS_ACTUAL: m.trackingFps,
    WEBGL_RENDER_RESOLUTION_ACTUAL: m.canvas,
    COMPOSITE_RESOLUTION_ACTUAL: composite,
    DEVICE_PIXEL_RATIO_USED: m.pixelRatio,
    DEVICE_PIXEL_RATIO_WINDOW: typeof window !== "undefined" ? window.devicePixelRatio : null,
    RAF_COUNT_ACTIVE: m.activeRafCount,
    MEDIAPIPE_ACTIVE_TASKS: state.tracking && state.enabled && avatarLayerVisible() ? 1 : 0,
    VIDEO_INPUT_RESOLUTION: videoInput,
    VRM_TRIANGLE_COUNT: state.vrmStats?.triangles ?? null,
    VRM_TEXTURE_MEMORY_ESTIMATE: state.vrmStats?.textureMemoryEstimateBytes ?? null,
    FIRST_PERFORMANCE_BOTTLENECK:
      "SCENE_COMPOSITE_FULL_HD_PLUS_VRM_SPRING_CONSTRAINT_ON_MOBILE_GPU",
    MOBILE_WEBGL_PIXEL_RATIO: m.pixelRatio,
    MOBILE_RENDER_RESOLUTION: m.canvas,
    profile: { ...state.profile },
    sceneAspect: getSceneAspectKey(),
  };
}

function getDiagnostics() {
  return {
    version: VERSION,
    storageKey: STORAGE_KEY,
    state: getPublicState(),
    metrics: getMetrics(),
    deviceProfile: state.profile,
    preserveDrawingBuffer: true,
    uncappedDualRaf: false,
    deps: {
      three: THREE.REVISION || "unknown",
      mediapipeWasm: WASM_ROOT,
      mediapipeModel: MODEL_URL,
      trackingAdapter: trackingAdapter.id,
      motionMapper: motionMapper.id,
    },
    privacy: {
      browserLocalProcessing: true,
      frameUpload: false,
      landmarkUpload: false,
      externalApi: false,
      trackingCameraNotPublished: true,
    },
    gumCallsForbidden: true,
    presetUrl: PRESET_VRM_URL,
    blobLifecycle: {
      hasActive: Boolean(blobUrls.getActive()),
      liveCount: blobUrls.snapshot().liveCount,
      revokedCount: blobUrls.snapshot().revokedCount,
      loadGeneration: vrmGate.getGeneration(),
    },
  };
}

function subscribeMedia() {
  if (state.unsubMedia) {
    try {
      state.unsubMedia();
    } catch (_) {}
    state.unsubMedia = null;
  }
  const m = media();
  if (!m?.onMediaStreamChange) return;
  state.unsubMedia = m.onMediaStreamChange((payload) => {
    if (payload && payload.reason === "publish_input") return;
    if (!state.enabled) return;
    syncFormalInput();
  });
}

function boot() {
  if (state.booted) return { ok: true, reused: true };
  state.deviceClass = detectDeviceClass();
  state.profile = buildDeviceProfile(state.deviceClass);
  loadPersisted();
  ensureInputVideo();
  subscribeMedia();
  bindVisibility();
  state.booted = true;
  notify("boot");
  return { ok: true, deviceClass: state.deviceClass, profile: state.profile };
}

function cleanup() {
  state.enabled = false;
  stopLoops();
  unbindVisibility();
  disposeVrm();
  if (state.landmarker) {
    try {
      state.landmarker.close?.();
    } catch (_) {}
    state.landmarker = null;
    state.landmarkerReady = false;
    state.landmarkerDelegate = null;
  }
  if (state.renderer) {
    try {
      state.renderer.dispose();
    } catch (_) {}
    try {
      state.renderer.domElement?.remove?.();
    } catch (_) {}
    state.renderer = null;
  }
  state.scene = null;
  state.camera = null;
  state.lastTrackingFrame = null;
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
  try {
    sceneEditor()?.ensureVtuberLayer?.({ id: VTUBER_LAYER_ID, visible: false });
  } catch (_) {}
  persist();
  notify("cleanup");
}

window.TasuOneTlvGoLiveVtuberBasic = {
  VERSION,
  VTUBER_LAYER_ID,
  STORAGE_KEY,
  PRESET_VRM_URL,
  PRESET_VRM_LABEL,
  detectDeviceClass,
  buildDeviceProfile,
  boot,
  setEnabled,
  setTracking,
  setMirror,
  setCameraVisMode,
  loadVrmFile,
  loadVrmFromUrl,
  loadPresetVrm,
  clearAvatarIfSource,
  getOutputCanvas,
  getState: getPublicState,
  getMetrics,
  getPerfSnapshot,
  getDiagnostics,
  getDeviceProfile: () => ({ ...state.profile }),
  syncRendererToSceneAspect,
  frameVrm: () => (state.vrm ? (frameVrm(state.vrm), { ok: true }) : { ok: false }),
  getLicenseMeta: () => state.licenseMeta,
  syncFormalInput,
  cleanup,
  onChange(fn) {
    if (typeof fn !== "function") return () => {};
    state.listeners.push(fn);
    return () => {
      state.listeners = state.listeners.filter((x) => x !== fn);
    };
  },
};

boot();
notify("module_ready");
