/**
 * TASFUL 生成AI — VRM キャラ（@pixiv/three-vrm）
 * Vite + npm の three / @pixiv/three-vrm でバンドル（口パク・表情 PoC）
 */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";

const win = typeof window !== "undefined" ? window : globalThis;

/** Vite 開発時は public 相当のルート配信（models/vrm-sample.vrm） */
const VRM_SAMPLE_URL = "/models/vrm-sample.vrm";
const VRM_SAMPLE_URLS = [
  VRM_SAMPLE_URL,
  "https://cdn.jsdelivr.net/gh/pixiv/three-vrm@3.3.4/packages/three-vrm/examples/models/VRM1_Constraint_Twist_Sample.vrm",
];

const STORAGE_VRM_ROTATION_OFFSETS = "tasu_genai_vrm_rotation_offsets";
const Y_ROTATION_CANDIDATES = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
/** カメラは +Z。VRM 正面は通常 -Z（カメラ方向） */
const VRM_VIEW_DIR = { x: 0, y: 0, z: -1 };

const EXPRESSION_IDS =
  win.GenAiCharacterExpression?.EXPRESSION_IDS ||
  ["neutral", "joy", "happy", "shy", "sorrow", "angry", "surprised"];

  /** VRM Expression プリセット名の別名（0.x / 1.0 両対応） */
  const PRESET_ALIASES = {
    vowels: {
      aa: ["aa", "a", "vrc.v_aa", "vrc_v_aa"],
      ih: ["ih", "i", "vrc.v_ih", "vrc_v_ih"],
      ou: ["ou", "u", "vrc.v_ou", "vrc_v_ou"],
      ee: ["ee", "e", "vrc.v_ee", "vrc_v_ee"],
      oh: ["oh", "o", "vrc.v_oh", "vrc_v_oh"],
    },
    blink: ["blink", "blinkleft", "blinkright", "vrc.blink", "vrc.blink_left", "vrc.blink_right"],
    joy: ["happy", "joy", "fun", "vrc.v_fun", "vrc_v_fun"],
    happy: ["happy", "laugh", "vrc.v_happy"],
    shy: ["shy", "vrc.v_shy", "vrc_v_shy"],
    angry: ["angry", "vrc.v_angry", "vrc_v_angry"],
    sorrow: ["sad", "sorrow", "vrc.v_sorrow", "vrc_v_sorrow"],
    surprised: ["surprised", "vrc.v_surprised", "vrc_v_surprised"],
  };

  const threeBundle = { THREE, GLTFLoader };
  const vrmBundle = { VRMLoaderPlugin, VRMUtils };

  let activeController = null;
  let initPromise = null;

  function normalizePresetKey(name) {
    return String(name || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/\./g, "_");
  }

  function listExpressionNames(vrm) {
    const mgr = vrm?.expressionManager;
    if (!mgr) return [];
    if (typeof mgr.getExpressionMap === "function") {
      return [...mgr.getExpressionMap().keys()];
    }
    if (Array.isArray(mgr.expressions)) {
      return mgr.expressions.map((e) => e.expressionName || e.name || "").filter(Boolean);
    }
    return [];
  }

  function resolvePresetIndex(vrm, aliases) {
    const names = listExpressionNames(vrm);
    const normalized = names.map((n) => ({ raw: n, key: normalizePresetKey(n) }));
    for (const alias of aliases) {
      const want = normalizePresetKey(alias);
      const hit = normalized.find((n) => n.key === want || n.key.endsWith(want) || n.key.includes(want));
      if (hit) return { name: hit.raw, found: true };
    }
    return { name: null, found: false };
  }

  function inspectVrmExpressions(vrm) {
    const names = listExpressionNames(vrm);
    const normalizedList = names.map((n) => normalizePresetKey(n));

    const checkGroup = (keys, label) => {
      const resolved = {};
      let any = false;
      for (const [key, aliases] of Object.entries(keys)) {
        const r = resolvePresetIndex(vrm, aliases);
        resolved[key] = r;
        if (r.found) any = true;
      }
      return { label, any, resolved };
    };

    const vowels = checkGroup(PRESET_ALIASES.vowels, "vowels");
    const blink = {
      label: "blink",
      any: resolvePresetIndex(vrm, PRESET_ALIASES.blink).found,
      resolved: { blink: resolvePresetIndex(vrm, PRESET_ALIASES.blink) },
    };
    const joy = {
      label: "joy",
      any: resolvePresetIndex(vrm, PRESET_ALIASES.joy).found,
      resolved: { joy: resolvePresetIndex(vrm, PRESET_ALIASES.joy) },
    };
    const angry = {
      label: "angry",
      any: resolvePresetIndex(vrm, PRESET_ALIASES.angry).found,
      resolved: { angry: resolvePresetIndex(vrm, PRESET_ALIASES.angry) },
    };
    const sorrow = {
      label: "sorrow",
      any: resolvePresetIndex(vrm, PRESET_ALIASES.sorrow).found,
      resolved: { sorrow: resolvePresetIndex(vrm, PRESET_ALIASES.sorrow) },
    };
    const surprised = {
      label: "surprised",
      any: resolvePresetIndex(vrm, PRESET_ALIASES.surprised).found,
      resolved: { surprised: resolvePresetIndex(vrm, PRESET_ALIASES.surprised) },
    };

    const report = {
      expressionCount: names.length,
      expressionNames: names,
      vowels: vowels.resolved,
      hasVowels: Object.values(vowels.resolved).filter((r) => r.found).length >= 3,
      hasBlink: blink.any,
      hasJoy: joy.any,
      hasAngry: angry.any,
      hasSorrow: sorrow.any,
      hasSurprised: surprised.any,
      blink,
      joy,
      angry,
      sorrow,
      surprised,
      lipSyncCapable: vowels.any,
      expressionCapable: joy.any || sorrow.any || angry.any || surprised.any,
      normalizedList,
    };

    report.verdict =
      report.lipSyncCapable && report.hasBlink
        ? "vrm_lip_sync_ready"
        : report.lipSyncCapable
          ? "vrm_partial"
          : "vrm_no_expressions";

    return report;
  }

  function getActiveCharacterId() {
    if (win.TasuGenAiWorkspace?.getActiveCharacterId) {
      return String(win.TasuGenAiWorkspace.getActiveCharacterId() || "").trim();
    }
    try {
      const raw = localStorage.getItem("tasu_genai_active_character");
      if (!raw) return "";
      if (raw.startsWith("{")) {
        const parsed = JSON.parse(raw);
        return String(parsed?.id || "").trim();
      }
      return String(raw).trim();
    } catch {
      return "";
    }
  }

  function readVrmRotationOffsets() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_VRM_ROTATION_OFFSETS) || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function readVrmRotationOffset(characterId) {
    const id = String(characterId || "").trim();
    if (!id) return 0;
    const value = Number(readVrmRotationOffsets()[id]);
    return Number.isFinite(value) ? value : 0;
  }

  function writeVrmRotationOffset(characterId, offsetY) {
    const id = String(characterId || "").trim();
    if (!id) return false;
    const all = readVrmRotationOffsets();
    if (Math.abs(offsetY) < 1e-6) {
      delete all[id];
    } else {
      all[id] = offsetY;
    }
    try {
      localStorage.setItem(STORAGE_VRM_ROTATION_OFFSETS, JSON.stringify(all));
      return true;
    } catch (err) {
      console.warn("[GenAiVRM] rotation offset save failed:", err);
      return false;
    }
  }

  function scoreModelFacingTowardView(model, THREE, viewDir) {
    let score = 0;
    const normal = new THREE.Vector3();
    const normalMatrix = new THREE.Matrix3();
    const dir = new THREE.Vector3(viewDir.x, viewDir.y, viewDir.z);
    model.traverse((child) => {
      if (!child.isMesh?.geometry?.attributes?.normal) return;
      normalMatrix.getNormalMatrix(child.matrixWorld);
      const normals = child.geometry.attributes.normal;
      const step = Math.max(1, Math.floor(normals.count / 3000));
      for (let i = 0; i < normals.count; i += step) {
        normal.fromBufferAttribute(normals, i).applyMatrix3(normalMatrix).normalize();
        const facing = normal.dot(dir);
        if (facing > 0) score += facing;
      }
    });
    return score;
  }

  /** VRM 正面がカメラ（+Z 側）を向くよう Y 回転（Tripo とは別ストレージ） */
  function resolveVrmFacingCorrection(model, THREE) {
    const viewDir = new THREE.Vector3(VRM_VIEW_DIR.x, VRM_VIEW_DIR.y, VRM_VIEW_DIR.z);
    const scores = {};
    let rotationY = 0;
    let bestScore = -1;

    for (const candidate of Y_ROTATION_CANDIDATES) {
      model.rotation.y = candidate;
      model.updateMatrixWorld(true);
      const score = scoreModelFacingTowardView(model, THREE, viewDir);
      scores[candidate] = score;
      if (score > bestScore) {
        bestScore = score;
        rotationY = candidate;
      }
    }

    model.rotation.y = rotationY;
    model.updateMatrixWorld(true);
    console.log("[GenAiVRM] applyVrmFacingCorrection", { rotationY, scores });
    return rotationY;
  }

  function applyVrmFacingRotation(vrm, state, THREE) {
    const autoY = resolveVrmFacingCorrection(vrm.scene, THREE);
    const manualOff = readVrmRotationOffset(getActiveCharacterId());
    state.autoRotationY = autoY;
    state.manualRotationOffset = manualOff;
    vrm.scene.rotation.y = autoY + manualOff;
    vrm.scene.updateMatrixWorld(true);
    console.log("[GenAiVRM] applyVrmFacingRotation", {
      autoRotationY: autoY,
      manualRotationOffset: manualOff,
      totalY: vrm.scene.rotation.y,
    });
  }

  function setupStageLighting(scene, THREE) {
    scene.add(new THREE.AmbientLight(0xffffff, 1.8));
    const key = new THREE.DirectionalLight(0xffffff, 1.2);
    key.position.set(1.2, 2.4, 2.8);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xc8d8ff, 0.55);
    fill.position.set(-2, 1.2, 1.5);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0x88bbff, 0.45);
    rim.position.set(0, 1.5, -2.5);
    scene.add(rim);
  }

  function frameVrmModel(vrm, camera, THREE) {
    const box = new THREE.Box3().setFromObject(vrm.scene);
    if (box.isEmpty()) return;
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 0.01);
    const headFraction = 0.72;
    const focusY = box.min.y + size.y * headFraction;
    const focus = new THREE.Vector3(center.x, focusY, center.z);
    const distance = maxDim * 1.85;
    camera.position.set(focus.x, focus.y + maxDim * 0.05, focus.z + distance);
    camera.lookAt(focus);
    camera.near = Math.max(0.01, distance / 100);
    camera.far = distance * 20;
    camera.updateProjectionMatrix();

    vrm.scene.position.x -= center.x;
    vrm.scene.position.y -= box.min.y;
    vrm.scene.position.z -= center.z;
    return { focus, basePosition: vrm.scene.position.clone() };
  }

  function createVrmController(canvas) {
    const state = {
      disposed: false,
      canvas,
      renderer: null,
      scene: null,
      camera: null,
      clock: null,
      vrm: null,
      presetMap: {},
      speaking: false,
      listening: false,
      targetExpression: "neutral",
      mouthPhase: 0,
      blinkPhase: 0,
      nextBlink: 2.5,
      vowelOrder: ["aa", "ih", "ou", "ee", "oh"],
      inspectReport: null,
      raf: null,
      resizeObserver: null,
      autoRotationY: 0,
      manualRotationOffset: 0,
      framing: null,
    };

    function setExpressionValue(name, weight) {
      const mgr = state.vrm?.expressionManager;
      if (!mgr || !name) return;
      const w = Math.max(0, Math.min(1, weight));
      try {
        if (typeof mgr.setValue === "function") {
          mgr.setValue(name, w);
        } else if (typeof mgr.getExpression === "function") {
          const expr = mgr.getExpression(name);
          if (expr) expr.weight = w;
        }
      } catch (err) {
        console.warn("[GenAiVRM] setExpressionValue failed:", name, err);
      }
    }

    function resetExpressionWeights() {
      listExpressionNames(state.vrm).forEach((name) => setExpressionValue(name, 0));
    }

    function applyVowelPreset(key, weight) {
      const entry = state.presetMap.vowels?.[key];
      if (entry?.found && entry.name) setExpressionValue(entry.name, weight);
    }

    function applyPresetGroup(groupKey, weight) {
      const entry = state.presetMap[groupKey];
      if (entry?.found && entry.name) setExpressionValue(entry.name, weight);
    }

    return {
      state,

      buildPresetMap(vrm) {
        const vowels = {};
        for (const [key, aliases] of Object.entries(PRESET_ALIASES.vowels)) {
          vowels[key] = resolvePresetIndex(vrm, aliases);
        }
        state.presetMap = {
          vowels,
          blink: resolvePresetIndex(vrm, PRESET_ALIASES.blink),
          joy: resolvePresetIndex(vrm, PRESET_ALIASES.joy),
          happy: resolvePresetIndex(vrm, PRESET_ALIASES.happy),
          shy: resolvePresetIndex(vrm, PRESET_ALIASES.shy),
          angry: resolvePresetIndex(vrm, PRESET_ALIASES.angry),
          sorrow: resolvePresetIndex(vrm, PRESET_ALIASES.sorrow),
          surprised: resolvePresetIndex(vrm, PRESET_ALIASES.surprised),
        };
        state.inspectReport = inspectVrmExpressions(vrm);
        win.__genAiVrmLastInspect = state.inspectReport;
        console.log("[GenAiVRM] inspect report", state.inspectReport);
        return state.inspectReport;
      },

      async mount() {
        const { THREE } = threeBundle;
        const parent = canvas.parentElement;
        const rect = parent?.getBoundingClientRect?.() || { width: 220, height: 293 };
        const w = Math.max(1, Math.floor(rect.width));
        const h = Math.max(1, Math.floor(rect.height));

        state.clock = new THREE.Clock();
        state.renderer = new THREE.WebGLRenderer({
          canvas,
          alpha: true,
          antialias: true,
          powerPreference: "high-performance",
        });
        state.renderer.setPixelRatio(Math.min(win.devicePixelRatio || 1, 2));
        state.renderer.setSize(w, h, false);
        state.renderer.outputColorSpace = THREE.SRGBColorSpace;

        state.scene = new THREE.Scene();
        state.camera = new THREE.PerspectiveCamera(28, w / h, 0.1, 100);
        setupStageLighting(state.scene, THREE);

        state.resizeObserver = new ResizeObserver(() => this.resize());
        if (parent) state.resizeObserver.observe(parent);

        this.startLoop();
        this.updateStatusLabel("VRM: モデル未読込");
      },

      resize() {
        if (!state.renderer || !state.camera || !state.canvas) return;
        const parent = state.canvas.parentElement;
        const rect = parent?.getBoundingClientRect?.() || { width: 220, height: 293 };
        const w = Math.max(1, Math.floor(rect.width));
        const h = Math.max(1, Math.floor(rect.height));
        state.camera.aspect = w / h;
        state.camera.updateProjectionMatrix();
        state.renderer.setSize(w, h, false);
        if (state.vrm) {
          const { THREE } = threeBundle;
          frameVrmModel(state.vrm, state.camera, THREE);
          state.vrm.scene.rotation.y =
            (state.autoRotationY ?? 0) + (state.manualRotationOffset ?? 0);
          state.vrm.scene.updateMatrixWorld(true);
        }
      },

      applyLoadedVrm(vrm) {
        const { THREE } = threeBundle;
        state.scene.add(vrm.scene);
        state.vrm = vrm;
        this.buildPresetMap(vrm);
        state.framing = frameVrmModel(vrm, state.camera, THREE);
        applyVrmFacingRotation(vrm, state, THREE);
        this.updateStatusLabel();
        return state.inspectReport;
      },

      async loadFromUrl(url, options = {}) {
        const src = String(url || "").trim();
        if (!src) throw new Error("VRM URL が空です");

        const { THREE, GLTFLoader } = threeBundle;
        const { VRMLoaderPlugin, VRMUtils } = vrmBundle;

        if (state.vrm) {
          VRMUtils.deepDispose(state.vrm);
          state.scene.remove(state.vrm.scene);
          state.vrm = null;
        }

        const loader = new GLTFLoader();
        loader.register((parser) => new VRMLoaderPlugin(parser));

        const gltf = await new Promise((resolve, reject) => {
          loader.load(src, resolve, undefined, reject);
        });

        const vrm = gltf.userData.vrm;
        if (!vrm) throw new Error("GLB に VRM が含まれていません");

        VRMUtils.removeUnnecessaryVertices(vrm.scene);
        VRMUtils.combineSkeletons(vrm.scene);
        vrm.scene.traverse((obj) => {
          obj.frustumCulled = false;
        });

        this.applyLoadedVrm(vrm);
        return { ok: true, inspect: state.inspectReport };
      },

      async loadFromArrayBuffer(buffer) {
        const { THREE, GLTFLoader } = threeBundle;
        const { VRMLoaderPlugin, VRMUtils } = vrmBundle;

        if (state.vrm) {
          VRMUtils.deepDispose(state.vrm);
          state.scene.remove(state.vrm.scene);
          state.vrm = null;
        }

        const loader = new GLTFLoader();
        loader.register((parser) => new VRMLoaderPlugin(parser));

        const gltf = await new Promise((resolve, reject) => {
          loader.parse(buffer, "", resolve, reject);
        });

        const vrm = gltf.userData.vrm;
        if (!vrm) throw new Error("バッファに VRM が含まれていません");

        VRMUtils.removeUnnecessaryVertices(vrm.scene);
        VRMUtils.combineSkeletons(vrm.scene);
        this.applyLoadedVrm(vrm);
        return { ok: true, inspect: state.inspectReport };
      },

      updateStatusLabel(override) {
        const el = document.querySelector("[data-gen-ai-stage-3d-status]");
        if (!el) return;
        if (override) {
          el.textContent = override;
          return;
        }
        const r = state.inspectReport;
        if (!state.vrm) {
          el.textContent = "VRM: 未読込";
          return;
        }
        if (!r) {
          el.textContent = "VRM: 表示中";
          return;
        }
        const parts = [];
        if (r.hasVowels) parts.push("口形");
        if (r.hasBlink) parts.push("まばたき");
        if (r.hasJoy) parts.push("喜");
        if (r.hasSorrow) parts.push("悲");
        if (r.hasAngry) parts.push("怒");
        el.textContent = parts.length
          ? `VRM: ${parts.join("・")}対応`
          : "VRM: 表情プリセット未検出";
      },

      setSpeaking(active) {
        state.speaking = Boolean(active);
      },

      setListening(active) {
        state.listening = Boolean(active);
      },

      setExpression(name) {
        const norm = win.GenAiCharacterExpression?.normalizeExpressionId?.(name) || name;
        state.targetExpression = EXPRESSION_IDS.includes(norm) ? norm : "neutral";
      },

      startLoop() {
        const tick = () => {
          if (state.disposed) return;
          state.raf = win.requestAnimationFrame(tick);
          this.updateFrame();
          if (state.vrm) {
            const delta = state.clock?.getDelta?.() || 0.016;
            state.vrm.update(delta);
          }
          state.renderer?.render(state.scene, state.camera);
        };
        tick();
      },

      updateFrame() {
        const dt = state.clock?.getDelta?.() || 0.016;
        const speakingActive = state.speaking || state.listening;
        const mgr = state.vrm?.expressionManager;
        if (!mgr || !state.vrm) return;

        state.mouthPhase += dt * (speakingActive ? 12 : 3);
        state.blinkPhase += dt;
        if (state.blinkPhase >= state.nextBlink) {
          state.blinkPhase = 0;
          state.nextBlink = 2 + Math.random() * 3.5;
        }

        const blinkAmt =
          state.blinkPhase < 0.12 ? Math.sin((state.blinkPhase / 0.12) * Math.PI) : 0;

        resetExpressionWeights();

        if (state.presetMap.blink?.found) {
          setExpressionValue(state.presetMap.blink.name, blinkAmt);
        }

        const expr = state.targetExpression;
        const meta =
          win.GenAiCharacterExpression?.EXPRESSION_META?.[expr] || { weight: 0.8 };
        const weight = meta.weight ?? 0.8;
        const presetKeyByExpr = {
          joy: "joy",
          happy: "happy",
          shy: "shy",
          sorrow: "sorrow",
          angry: "angry",
          surprised: "surprised",
        };
        const presetKey = presetKeyByExpr[expr];
        if (presetKey && state.presetMap[presetKey]?.found) {
          setExpressionValue(state.presetMap[presetKey].name, weight);
        } else if (expr === "happy" && state.presetMap.joy?.found) {
          setExpressionValue(state.presetMap.joy.name, weight);
        } else if (expr === "shy" && state.presetMap.joy?.found) {
          setExpressionValue(state.presetMap.joy.name, weight * 0.65);
        }

        if (speakingActive && state.inspectReport?.lipSyncCapable) {
          const keys = state.vowelOrder.filter((k) => state.presetMap.vowels?.[k]?.found);
          if (keys.length) {
            const idx = Math.floor(state.mouthPhase) % keys.length;
            const open = 0.35 + Math.abs(Math.sin(state.mouthPhase * 1.7)) * 0.65;
            keys.forEach((k, i) => applyVowelPreset(k, i === idx ? open : 0));
          }
        } else if (state.presetMap.vowels?.aa?.found) {
          applyVowelPreset("aa", 0.03 + Math.sin(state.mouthPhase) * 0.02);
        }

        if (typeof mgr.update === "function") mgr.update();
      },

      dispose() {
        state.disposed = true;
        if (state.raf) win.cancelAnimationFrame(state.raf);
        state.resizeObserver?.disconnect();
        if (state.vrm && vrmBundle?.VRMUtils) {
          vrmBundle.VRMUtils.deepDispose(state.vrm);
        }
        state.vrm = null;
        if (state.renderer) {
          state.scene?.traverse?.((obj) => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
              const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
              mats.forEach((m) => m.dispose?.());
            }
          });
          state.renderer.dispose();
        }
        state.renderer = null;
        state.scene = null;
        state.camera = null;
      },
    };
  }

  function getCanvas() {
    return document.querySelector("[data-gen-ai-char-3d-canvas]");
  }

  function disposeGltfController() {
    if (win.GenAiCharacter3D?.disposeActive) {
      win.GenAiCharacter3D.disposeActive();
    }
  }

  async function ensureMounted() {
    const canvas = getCanvas();
    if (!canvas) return null;
    if (activeController && !activeController.state.disposed) return activeController;
    if (initPromise) return initPromise;

    initPromise = (async () => {
      try {
        disposeGltfController();
        const ctrl = createVrmController(canvas);
        await ctrl.mount();
        activeController = ctrl;
        win.__genAi3dBackend = "vrm";
        return ctrl;
      } catch (err) {
        console.warn("[GenAiVRM] init failed:", err);
        return null;
      } finally {
        initPromise = null;
      }
    })();

    return initPromise;
  }

  async function loadFromUrl(url) {
    const ctrl = await ensureMounted();
    if (!ctrl) return false;
    const primary = String(url || "").trim();
    const candidates = primary ? [primary] : VRM_SAMPLE_URLS;
    let lastErr = "";
    for (const src of candidates) {
      try {
        await ctrl.loadFromUrl(src);
        return true;
      } catch (err) {
        lastErr = err?.message || String(err);
        console.warn("[GenAiVRM] loadFromUrl failed:", src, lastErr);
      }
    }
    win.__genAiVrmLastLoadError = lastErr;
    ctrl.updateStatusLabel(`VRM読込失敗: ${lastErr}`);
    return false;
  }

  async function loadFromFile(file) {
    const buf = await file.arrayBuffer();
    const ctrl = await ensureMounted();
    if (!ctrl) return false;
    try {
      await ctrl.loadFromArrayBuffer(buf);
      return true;
    } catch (err) {
      console.warn("[GenAiVRM] loadFromFile failed:", err?.message || err);
      return false;
    }
  }

  function syncSpeaking(speaking, listening) {
    const mode = win.TasuGenAiWorkspace?.getStageRendererMode?.();
    if (mode !== "3d" || !activeController) return;
    activeController.setSpeaking(speaking);
    activeController.setListening(listening);
  }

  function syncExpression(name) {
    const mode = win.TasuGenAiWorkspace?.getStageRendererMode?.();
    if (mode !== "3d" || !activeController) return;
    activeController.setExpression(name);
  }

  function inferExpressionFromText(text) {
    if (win.GenAiCharacterExpression?.inferExpressionFromText) {
      return win.GenAiCharacterExpression.inferExpressionFromText(text);
    }
    return "neutral";
  }

  function inspectActive() {
    return activeController?.state?.inspectReport || win.__genAiVrmLastInspect || null;
  }

  function logInspectReport() {
    const r = inspectActive();
    if (!r) {
      console.warn("[GenAiVRM] inspect: no VRM loaded");
      return null;
    }
    console.table({
      A: r.vowels?.aa?.found,
      I: r.vowels?.ih?.found,
      U: r.vowels?.ou?.found,
      E: r.vowels?.ee?.found,
      O: r.vowels?.oh?.found,
      Blink: r.hasBlink,
      Joy: r.hasJoy,
      Sorrow: r.hasSorrow,
      Angry: r.hasAngry,
      Surprised: r.hasSurprised,
      表情数: r.expressionCount,
    });
    console.log("[GenAiVRM] expression names:", r.expressionNames);
    return r;
  }

  function adjustManualRotation(deltaY) {
    const ctrl = activeController;
    if (!ctrl?.state?.vrm) return false;
    const charId = getActiveCharacterId();
    const prev = readVrmRotationOffset(charId);
    const next = prev + Number(deltaY || 0);
    writeVrmRotationOffset(charId, next);
    ctrl.state.manualRotationOffset = next;
    ctrl.state.vrm.scene.rotation.y =
      (ctrl.state.autoRotationY ?? 0) + next;
    ctrl.state.vrm.scene.updateMatrixWorld(true);
    console.log("[GenAiVRM] manualRotationY", ctrl.state.vrm.scene.rotation.y, {
      charId,
      deltaY,
    });
    return true;
  }

  function resetManualRotation() {
    const charId = getActiveCharacterId();
    writeVrmRotationOffset(charId, 0);
    if (!activeController?.state?.vrm) return false;
    activeController.state.manualRotationOffset = 0;
    activeController.state.vrm.scene.rotation.y = activeController.state.autoRotationY ?? 0;
    activeController.state.vrm.scene.updateMatrixWorld(true);
    return true;
  }

win.GenAiCharacterVrm = {
    SAMPLE_URL: VRM_SAMPLE_URL,
    /** TASFUL 標準キャラの仮 VRM（正式モデル差し替え前） */
    TASFUL_BUILTIN_VRM_URL: VRM_SAMPLE_URL,
    ensureMounted,
    loadFromUrl,
    loadFromFile,
    syncSpeaking,
    syncExpression,
    inferExpressionFromText,
    inspectActive,
    logInspectReport,
    inspectVrmExpressions,
    getActiveController: () => activeController,
    adjustManualRotation,
    resetManualRotation,
    readVrmRotationOffset,
    disposeActive() {
      if (activeController) {
        activeController.dispose();
        activeController = null;
      }
      if (win.__genAi3dBackend === "vrm") win.__genAi3dBackend = null;
    },
};
