/**
 * TASFUL 生成AI — 3Dキャラクター・表情プロトタイプ（Three.js）
 * glTF 読み込み + プロシージャル顔のフォールバック
 */
(function initGenAiCharacter3d(global) {
  const THREE_CDN = "https://cdn.jsdelivr.net/npm/three@0.172.0";
  const PROTOTYPE_GLB = "models/gen-ai-avatar-prototype.glb";
  const ROBOT_CANDIDATES = [
    `${THREE_CDN}/examples/models/gltf/RobotExpressive/RobotExpressive.glb`,
    "https://threejs.org/examples/models/gltf/RobotExpressive/RobotExpressive.glb",
  ];
  const MODEL_CANDIDATES = [PROTOTYPE_GLB, ...ROBOT_CANDIDATES];
  const STORAGE_ROTATION_OFFSETS = "tasu_genai_3d_rotation_offsets";
  const Y_ROTATION_CANDIDATES = [0, Math.PI / 2, Math.PI, -Math.PI / 2];

  const EXPRESSIONS = ["neutral", "happy", "surprised", "sad"];
  const MORPH_ALIASES = {
    mouthOpen: ["mouthOpen", "viseme_aa", "jawOpen", "Mouth_Open"],
    smile: ["mouthSmile", "happy", "smile", "Mouth_Smile"],
    surprised: ["surprised", "Surprised", "eyesWide"],
    sad: ["sad", "Sad"],
    blink: ["eyesClosed", "eyeBlinkLeft", "eyeBlinkRight", "Blink"],
  };

  let threeBundle = null;

  async function loadThreeBundle() {
    if (threeBundle) return threeBundle;
    const THREE = await import(`${THREE_CDN}/build/three.module.js`);
    const { GLTFLoader } = await import(`${THREE_CDN}/examples/jsm/loaders/GLTFLoader.js`);
    threeBundle = { THREE, GLTFLoader };
    return threeBundle;
  }

  function isTripoCdnGlbUrl(url) {
    return /^https:\/\/tripo-data\.[a-z0-9.-]+\/.+\.glb/i.test(String(url || ""));
  }

  async function fetchTripoGlbArrayBuffer(url, ms = 120000) {
    const cfg = global.TasuTripoGenAiConfig;
    if (!cfg?.healthCheckUrl || !cfg.getHeaders) {
      throw new Error("Tripo GLB proxy が未設定です");
    }
    const ctrl = new AbortController();
    const timer = global.setTimeout(() => ctrl.abort(), ms);
    try {
      const res = await fetch(cfg.healthCheckUrl, {
        method: "POST",
        headers: cfg.getHeaders(),
        body: JSON.stringify({ action: "fetch_glb", url }),
        signal: ctrl.signal,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `GLB proxy HTTP ${res.status}`);
      }
      return await res.arrayBuffer();
    } finally {
      global.clearTimeout(timer);
    }
  }

  function getActiveCharacterId() {
    if (global.TasuGenAiWorkspace?.getActiveCharacterId) {
      return String(global.TasuGenAiWorkspace.getActiveCharacterId() || "").trim();
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

  function readRotationOffsets() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_ROTATION_OFFSETS) || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function readRotationOffset(characterId) {
    const id = String(characterId || "").trim();
    if (!id) return 0;
    const value = Number(readRotationOffsets()[id]);
    return Number.isFinite(value) ? value : 0;
  }

  function writeRotationOffset(characterId, offsetY) {
    const id = String(characterId || "").trim();
    if (!id) return false;
    const all = readRotationOffsets();
    if (Math.abs(offsetY) < 1e-6) {
      delete all[id];
    } else {
      all[id] = offsetY;
    }
    try {
      localStorage.setItem(STORAGE_ROTATION_OFFSETS, JSON.stringify(all));
      return true;
    } catch (err) {
      console.warn("[GenAi3D] rotation offset save failed:", err);
      return false;
    }
  }

  function isGenAiDevMode() {
    try {
      return localStorage.getItem("tasu_genai_dev_mode") === "1";
    } catch {
      return false;
    }
  }

  function findMorphIndex(dict, aliases) {
    if (!dict) return -1;
    for (const name of aliases) {
      if (name in dict) return dict[name];
    }
    const lower = Object.keys(dict).reduce((acc, k) => {
      acc[k.toLowerCase()] = dict[k];
      return acc;
    }, {});
    for (const name of aliases) {
      const idx = lower[name.toLowerCase()];
      if (idx !== undefined) return idx;
    }
    return -1;
  }

  function findMorphIndexByPattern(dict, patterns) {
    if (!dict) return -1;
    for (const key of Object.keys(dict)) {
      for (const pattern of patterns) {
        if (pattern.test(key)) return dict[key];
      }
    }
    return -1;
  }

  function pickPrimaryMorphMesh(meshes) {
    let best = null;
    let bestCount = 0;
    for (const mesh of meshes) {
      const count = Object.keys(mesh.morphTargetDictionary || {}).length;
      if (count > bestCount) {
        bestCount = count;
        best = mesh;
      }
    }
    return best || meshes[0] || null;
  }

  const MOUTH_SHAPE_PATTERN = /mouth|jaw|viseme|open|aa|lip/i;
  const EXPRESSION_SHAPE_PATTERN = /smile|happy|blink|eye|surpris|sad|brow/i;

  function matchMorphShapeNames(names, pattern) {
    return names.filter((name) => pattern.test(name));
  }

  /** GLB 内の morph / BlendShape を調査ログ出力（applyGltfModel から呼ぶ） */
  function inspectModelMorphTargets(model) {
    const meshes = [];
    const allBlendShapeNames = [];
    model.traverse((obj) => {
      if (!obj.isMesh) return;
      const dict = obj.morphTargetDictionary || null;
      const inf = obj.morphTargetInfluences || null;
      const blendShapeNames = dict ? Object.keys(dict) : [];
      blendShapeNames.forEach((name) => allBlendShapeNames.push(name));

      console.log("[GenAi3D] morphTarget summary", {
        meshName: obj.name || "(unnamed)",
        hasMorphDictionary: Boolean(dict),
        morphTargetDictionary: dict ? { ...dict } : null,
        hasMorphInfluences: Boolean(inf),
        morphInfluenceCount: inf?.length || 0,
      });

      meshes.push({
        name: obj.name || "(unnamed)",
        hasDictionary: Boolean(dict),
        dictionary: dict ? { ...dict } : null,
        influenceCount: inf?.length ?? 0,
        blendShapeNames,
      });
    });

    const unique = [...new Set(allBlendShapeNames)];
    const mouthShapes = matchMorphShapeNames(unique, MOUTH_SHAPE_PATTERN);
    const expressionShapes = matchMorphShapeNames(unique, EXPRESSION_SHAPE_PATTERN);
    const morphMeshCount = meshes.filter((m) => m.hasDictionary).length;
    const verdict = {
      lipSyncCapable: mouthShapes.length > 0,
      expressionCapable: expressionShapes.length > 0,
      tripNoMorphLikely: morphMeshCount === 0,
      mouthShapes,
      expressionShapes,
      allBlendShapeNames: unique,
    };
    console.log("[GenAi3D] morphTarget verdict", verdict);
    return { meshes, meshCount: meshes.length, morphMeshCount, allBlendShapeNames: unique, verdict };
  }

  function buildMorphIndices(morphMeshes) {
    const primary = pickPrimaryMorphMesh(morphMeshes);
    const dict = primary?.morphTargetDictionary || null;
    const indices = {
      mouthOpen:
        findMorphIndex(dict, MORPH_ALIASES.mouthOpen) >= 0
          ? findMorphIndex(dict, MORPH_ALIASES.mouthOpen)
          : findMorphIndexByPattern(dict, [/mouth/i, /jaw/i, /viseme/i, /open/i, /aa/i]),
      smile:
        findMorphIndex(dict, MORPH_ALIASES.smile) >= 0
          ? findMorphIndex(dict, MORPH_ALIASES.smile)
          : findMorphIndexByPattern(dict, [/smile/i, /happy/i]),
      surprised:
        findMorphIndex(dict, MORPH_ALIASES.surprised) >= 0
          ? findMorphIndex(dict, MORPH_ALIASES.surprised)
          : findMorphIndexByPattern(dict, [/surpris/i, /wide/i]),
      sad:
        findMorphIndex(dict, MORPH_ALIASES.sad) >= 0
          ? findMorphIndex(dict, MORPH_ALIASES.sad)
          : findMorphIndexByPattern(dict, [/sad/i]),
      blink:
        findMorphIndex(dict, MORPH_ALIASES.blink) >= 0
          ? findMorphIndex(dict, MORPH_ALIASES.blink)
          : findMorphIndexByPattern(dict, [/blink/i, /eye.*close/i]),
    };
    return { primaryMesh: primary, indices, dictionaryKeys: dict ? Object.keys(dict) : [] };
  }

  function resolveExpressionCapability(morphMeshes, morphPack) {
    const dictionaryKeys = morphPack?.dictionaryKeys || [];
    if (!morphMeshes.length) {
      return {
        supported: false,
        mouthCapable: false,
        expressionCapable: false,
        label: "表情・口パク非対応モデル",
        reason: "no_morph_targets",
        dictionaryKeys: [],
      };
    }
    const idx = morphPack?.indices || {};
    const mouthCapable = idx.mouthOpen >= 0;
    const expressionCapable =
      mouthCapable ||
      idx.smile >= 0 ||
      idx.surprised >= 0 ||
      idx.sad >= 0 ||
      idx.blink >= 0;
    if (!expressionCapable) {
      return {
        supported: false,
        mouthCapable: false,
        expressionCapable: false,
        label: "表情・口パク非対応モデル",
        reason: "unmapped_blendshapes",
        dictionaryKeys,
      };
    }
    return {
      supported: true,
      mouthCapable,
      expressionCapable,
      label: mouthCapable ? "3D: glTF（表情・口パク）" : "3D: glTF（表情のみ）",
      reason: "ok",
      dictionaryKeys,
    };
  }

  /** AIキャラ会話向け — 明るく親しみやすいライティング */
  function setupStageLighting(scene, THREE) {
    const ambient = new THREE.AmbientLight(0xffffff, 1.8);
    scene.add(ambient);

    const hemi = new THREE.HemisphereLight(0xfff8ff, 0xe8e4ff, 0.75);
    scene.add(hemi);

    const frontLight = new THREE.DirectionalLight(0xffffff, 1.2);
    frontLight.position.set(0, 1, 3);
    scene.add(frontLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 0.7);
    keyLight.position.set(1.0, 2.4, 2.2);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xfff5fc, 0.5);
    fillLight.position.set(-1.4, 1.3, 2.0);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 0.5);
    rimLight.position.set(0, 2, -2);
    scene.add(rimLight);
  }

  function createProceduralFace(THREE) {
    const root = new THREE.Group();
    root.name = "ProceduralAvatar";

    const skin = new THREE.MeshStandardMaterial({
      color: 0xffe8f0,
      roughness: 0.55,
      metalness: 0.05,
    });
    const hairMat = new THREE.MeshStandardMaterial({
      color: 0x6b4cff,
      roughness: 0.4,
      metalness: 0.1,
    });
    const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf8f8ff, roughness: 0.3 });
    const eyeIrisMat = new THREE.MeshStandardMaterial({ color: 0x3d7cff, roughness: 0.2 });
    const mouthMat = new THREE.MeshStandardMaterial({ color: 0xc45b7a, roughness: 0.45 });

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.52, 32, 32), skin);
    head.scale.set(1, 1.08, 0.95);
    head.position.y = 1.05;
    root.add(head);

    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.56, 24, 24, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat);
    hair.position.y = 1.22;
    hair.scale.set(1.02, 0.9, 1);
    root.add(hair);

    const eyeGeo = new THREE.SphereGeometry(0.09, 16, 16);
    const leftEye = new THREE.Group();
    leftEye.position.set(-0.17, 1.12, 0.42);
    const rightEye = new THREE.Group();
    rightEye.position.set(0.17, 1.12, 0.42);

    [leftEye, rightEye].forEach((g) => {
      const white = new THREE.Mesh(eyeGeo, eyeWhiteMat);
      white.scale.set(1.1, 0.85, 0.5);
      const iris = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 12), eyeIrisMat);
      iris.position.z = 0.04;
      g.add(white, iris);
    });
    root.add(leftEye, rightEye);

    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 0.08), mouthMat);
    mouth.position.set(0, 0.82, 0.48);
    root.add(mouth);

    const browMat = new THREE.MeshStandardMaterial({ color: 0x5a3fd4, roughness: 0.5 });
    const leftBrow = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 0.02), browMat);
    leftBrow.position.set(-0.17, 1.28, 0.44);
    const rightBrow = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 0.02), browMat);
    rightBrow.position.set(0.17, 1.28, 0.44);
    root.add(leftBrow, rightBrow);

    return {
      root,
      procedural: true,
      parts: { head, leftEye, rightEye, mouth, leftBrow, rightBrow },
      morphMeshes: [],
    };
  }

  function collectMorphMeshes(root) {
    const meshes = [];
    root.traverse((obj) => {
      if (obj.isMesh && obj.morphTargetDictionary && obj.morphTargetInfluences) {
        meshes.push(obj);
      }
    });
    return meshes;
  }

  /** +Z 側カメラから見て、法線が手前を向いている量をスコア化 */
  function scoreModelFacingTowardView(model, THREE, viewDir) {
    let score = 0;
    const normal = new THREE.Vector3();
    const normalMatrix = new THREE.Matrix3();
    model.traverse((child) => {
      if (!child.isMesh?.geometry?.attributes?.normal) return;
      normalMatrix.getNormalMatrix(child.matrixWorld);
      const normals = child.geometry.attributes.normal;
      const step = Math.max(1, Math.floor(normals.count / 3000));
      for (let i = 0; i < normals.count; i += step) {
        normal.fromBufferAttribute(normals, i).applyMatrix3(normalMatrix).normalize();
        const facing = normal.dot(viewDir);
        if (facing > 0) score += facing;
      }
    });
    return score;
  }

  /**
   * GLB の正面がカメラ（+Z 側）を向くよう Y 回転を決定（4方向候補）。
   * 手動 offset は applyGltfModel 側で加算する。
   */
  function resolveGltfFacingCorrection(model, THREE, { isTripo = false } = {}) {
    const viewDir = new THREE.Vector3(0, 0, 1);
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

    const scoreValues = Y_ROTATION_CANDIDATES.map((c) => scores[c]);
    const maxScore = Math.max(...scoreValues, 0.001);
    const closeScores = scoreValues.filter((s) => Math.abs(s - maxScore) <= maxScore * 0.05).length > 1;
    if (isTripo && closeScores && rotationY === 0) {
      rotationY = Math.PI;
    }

    model.rotation.y = rotationY;
    model.updateMatrixWorld(true);
    console.log("[GenAi3D] applyGltfFacingCorrection", {
      isTripo,
      rotationY,
      scores,
      closeScores,
    });
    return rotationY;
  }

  function createStageController(canvas) {
    const state = {
      canvas,
      renderer: null,
      scene: null,
      camera: null,
      clock: null,
      avatar: null,
      morphMeshes: [],
      morphIndices: {},
      expression: "neutral",
      targetExpression: "neutral",
      speaking: false,
      listening: false,
      mouthPhase: 0,
      blinkPhase: 0,
      nextBlink: 2.4,
      raf: 0,
      disposed: false,
      modelKind: "none",
      expressionCapability: null,
      morphInspect: null,
      controls: null,
      resizeObserver: null,
    };

    return {
      state,

      frameGltfModelView(model) {
        const THREE = state.three;
        if (!THREE || !state.camera || !model) return;
        model.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(model);
        if (box.isEmpty()) return;

        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const headFraction = 0.65;
        const focusY = box.min.y + size.y * headFraction;
        const focus = new THREE.Vector3(center.x, focusY, center.z);
        const maxDim = Math.max(size.x, size.y, size.z, 0.001);
        const distance = maxDim * 1.9;

        state.camera.position.set(center.x, focusY, center.z + distance);
        state.camera.lookAt(focus);
        state.camera.updateProjectionMatrix();

        if (state.controls) {
          state.controls.target.copy(focus);
          state.controls.update();
        }

        state.gltfView = { focus: focus.clone(), distance, sizeY: size.y, maxDim };

        console.log("[GenAi3D] framing", {
          headFraction,
          focusY,
          cameraY: state.camera.position.y,
        });

        console.log("[GenAi3D] frameGltfModelView", {
          boxMin: { x: box.min.x, y: box.min.y, z: box.min.z },
          boxMax: { x: box.max.x, y: box.max.y, z: box.max.z },
          size: { x: size.x, y: size.y, z: size.z },
          focusY,
          cameraPosition: {
            x: state.camera.position.x,
            y: state.camera.position.y,
            z: state.camera.position.z,
          },
          modelRotationY: model.rotation.y,
        });
      },

      applyAvatarRotation(model, avatarState) {
        if (!model || !avatarState) return 0;
        const total =
          (avatarState.autoRotationY ?? 0) + (avatarState.manualRotationOffset ?? 0);
        model.rotation.y = total;
        model.updateMatrixWorld(true);
        avatarState.baseRotationY = total;
        return total;
      },

      applyGltfModel(model, options = {}) {
        const THREE = state.three;
        if (!THREE || state.disposed || !state.scene) return false;
        if (state.avatar?.root) state.scene.remove(state.avatar.root);
        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = false;
            child.receiveShadow = false;
          }
        });

        model.scale.set(1, 1, 1);
        model.position.set(0, 0, 0);
        model.rotation.set(0, 0, 0);
        model.updateMatrixWorld(true);

        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z, 0.001);
        const scale = 1.65 / maxDim;
        model.scale.setScalar(scale);
        model.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
        model.updateMatrixWorld(true);

        const isTripo = Boolean(options.isTripo);
        const characterId = String(options.characterId || getActiveCharacterId() || "").trim();
        const autoRotationY = resolveGltfFacingCorrection(model, THREE, { isTripo });
        const manualRotationOffset = readRotationOffset(characterId);

        const avatarState = {
          root: model,
          procedural: false,
          parts: null,
          characterId,
          autoRotationY,
          manualRotationOffset,
          baseRotationY: 0,
          basePosition: model.position.clone(),
        };
        this.applyAvatarRotation(model, avatarState);

        state.scene.add(model);
        this.frameGltfModelView(model);
        state.avatar = avatarState;

        console.log("[GenAi3D] applyGltfModel — morphTarget inspect start");
        state.morphInspect = inspectModelMorphTargets(model);
        console.log("[GenAi3D] applyGltfModel — morphTarget inspect end", state.morphInspect?.verdict);
        state.morphMeshes = collectMorphMeshes(model);
        const morphPack = buildMorphIndices(state.morphMeshes);
        state.morphIndices = morphPack.indices;
        state.expressionCapability = resolveExpressionCapability(state.morphMeshes, morphPack);
        state._loggedNoMouthMorph = false;
        state.modelKind = "gltf";
        global.__genAi3dLastMorphReport = {
          inspect: state.morphInspect,
          morphIndices: state.morphIndices,
          expressionCapability: state.expressionCapability,
        };
        console.log("[GenAi3D] expressionCapability", state.expressionCapability);
        console.log("[GenAi3D] applyGltfModel rotation", {
          characterId,
          autoRotationY,
          manualRotationOffset,
          totalRotationY: model.rotation.y,
        });
        this.updateStatusLabel();
        return state.modelKind === "gltf";
      },

      async mount() {
        const { THREE, GLTFLoader } = await loadThreeBundle();
        state.three = THREE;
        state.clock = new THREE.Clock();

        const parent = canvas.parentElement;
        const rect = parent?.getBoundingClientRect?.() || { width: 220, height: 293 };
        const w = Math.max(1, Math.floor(rect.width));
        const h = Math.max(1, Math.floor(rect.height));

        state.renderer = new THREE.WebGLRenderer({
          canvas,
          alpha: true,
          antialias: true,
          powerPreference: "high-performance",
        });
        state.renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 2));
        state.renderer.setSize(w, h, false);
        state.renderer.outputColorSpace = THREE.SRGBColorSpace;

        state.scene = new THREE.Scene();
        state.camera = new THREE.PerspectiveCamera(28, w / h, 0.1, 100);
        state.camera.position.set(0, 1.05, 2.65);
        state.camera.lookAt(0, 1.0, 0);

        setupStageLighting(state.scene, THREE);

        const loadGltfWithTimeout = (url, ms = 8000) =>
          Promise.race([
            new Promise((resolve, reject) => {
              const loader = new GLTFLoader();
              loader.load(url, resolve, undefined, reject);
            }),
            new Promise((_, reject) => {
              setTimeout(() => reject(new Error("timeout")), ms);
            }),
          ]);

        const showProceduralFallback = () => {
          if (state.disposed || state.modelKind === "gltf" || state.avatar?.procedural) return;
          const proc = createProceduralFace(THREE);
          state.scene.add(proc.root);
          state.avatar = proc;
          state.morphMeshes = [];
          state.modelKind = "procedural";
          this.updateStatusLabel();
        };

        const useVrmBackend =
          global.__genAi3dBackend === "vrm" ||
          global.TasuGenAiWorkspace?.getActive3dBackend?.() === "vrm";

        if (useVrmBackend) {
          state.modelKind = "none";
          this.updateStatusLabel();
          return;
        }

        const hasTripo =
          typeof global.TasuGenAiWorkspace?.hasTripoCharacterModel === "function" &&
          global.TasuGenAiWorkspace.hasTripoCharacterModel();
        const preferred =
          String(global.TasuGenAiWorkspace?.getPreferred3dModelUrl?.() || "").trim() || null;

        if (!preferred && !hasTripo) {
          showProceduralFallback();
        } else {
          state.modelKind = "none";
          this.updateStatusLabel();
        }

        void (async () => {
          let resolvedUrl = preferred;
          if (!resolvedUrl && hasTripo) {
            for (let i = 0; i < 20 && !resolvedUrl; i += 1) {
              resolvedUrl =
                String(global.TasuGenAiWorkspace?.getPreferred3dModelUrl?.() || "").trim() || null;
              if (!resolvedUrl) await new Promise((r) => setTimeout(r, 150));
            }
          }
          if (!resolvedUrl && hasTripo && global.TasuGenAiWorkspace?.refreshTripoGlbUrls) {
            try {
              const refreshed = await global.TasuGenAiWorkspace.refreshTripoGlbUrls(null, {
                allowCompleteGeneration: true,
              });
              resolvedUrl = String(refreshed?.modelUrl || refreshed?.downloadUrl || "").trim() || null;
            } catch (err) {
              console.warn("[GenAi3D] Tripo URL refresh failed:", err?.message || err);
            }
          }

          const candidates = [];
          if (resolvedUrl) candidates.push(resolvedUrl);
          if (hasTripo || resolvedUrl) {
            candidates.push(PROTOTYPE_GLB);
          } else {
            candidates.push(...MODEL_CANDIDATES);
          }

          for (const url of candidates) {
            if (state.disposed || state.modelKind === "gltf") break;
            try {
              let gltf;
              if (resolvedUrl && url === resolvedUrl && isTripoCdnGlbUrl(url)) {
                const buffer = await fetchTripoGlbArrayBuffer(url, 120000);
                gltf = await new Promise((resolve, reject) => {
                  const loader = new GLTFLoader();
                  loader.parse(buffer, "", resolve, reject);
                });
              } else {
                gltf = await loadGltfWithTimeout(
                  url,
                  resolvedUrl && url === resolvedUrl ? 120000 : 8000
                );
              }
              this.applyGltfModel(gltf.scene, {
                isTripo: Boolean(resolvedUrl && url === resolvedUrl && isTripoCdnGlbUrl(url)),
                characterId: getActiveCharacterId(),
              });
              if (resolvedUrl && url === resolvedUrl) {
                const el = document.querySelector("[data-gen-ai-stage-3d-status]");
                if (el) el.textContent = "3Dモデル表示中";
              }
              return;
            } catch (err) {
              console.warn("[GenAi3D] model load failed:", url, err?.message || err);
            }
          }
          if (!state.disposed && state.modelKind !== "gltf") {
            showProceduralFallback();
          }
        })();

        state.resizeObserver = new ResizeObserver(() => this.resize());
        if (parent) state.resizeObserver.observe(parent);

        this.resize();
        this.updateStatusLabel();
        this.startLoop();
      },

      async loadGltfFromUrl(url, ms = 120000) {
        const src = String(url || "").trim();
        if (!src || state.disposed) return false;
        const { GLTFLoader } = await loadThreeBundle();
        const loadGltfWithTimeout = (modelUrl, timeoutMs) =>
          Promise.race([
            new Promise((resolve, reject) => {
              const loader = new GLTFLoader();
              loader.load(modelUrl, resolve, undefined, reject);
            }),
            new Promise((_, reject) => {
              setTimeout(() => reject(new Error("timeout")), timeoutMs);
            }),
          ]);
        const parseBuffer = (buffer) =>
          new Promise((resolve, reject) => {
            const loader = new GLTFLoader();
            loader.parse(buffer, "", resolve, reject);
          });
        try {
          let gltf;
          if (isTripoCdnGlbUrl(src)) {
            const buffer = await fetchTripoGlbArrayBuffer(src, ms);
            gltf = await parseBuffer(buffer);
          } else {
            gltf = await loadGltfWithTimeout(src, ms);
          }
          const applied = this.applyGltfModel(gltf.scene, {
            isTripo: isTripoCdnGlbUrl(src),
            characterId: getActiveCharacterId(),
          });
          const el = document.querySelector("[data-gen-ai-stage-3d-status]");
          if (applied && el) el.textContent = "3Dモデル表示中";
          if (!applied) throw new Error("モデルをシーンに適用できませんでした");
          return true;
        } catch (err) {
          const msg = err?.message || String(err);
          console.warn("[GenAi3D] Tripo GLB load failed:", msg);
          global.__genAi3dLastLoadError = msg;
          return false;
        }
      },

      updateStatusLabel() {
        const el = document.querySelector("[data-gen-ai-stage-3d-status]");
        if (!el) return;
        const labels = {
          gltf:
            state.expressionCapability?.supported === false
              ? `3D: ${state.expressionCapability.label}`
              : state.expressionCapability?.label || "3D: glTFモデル（表情・口パク）",
          procedural: "3D: プロトタイプ顔（glTF未配置時）",
          none: "3D: 読み込み中…",
        };
        el.textContent = labels[state.modelKind] || labels.none;
        el.hidden = false;
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
        if (state.avatar?.root && !state.avatar.procedural && state.modelKind === "gltf") {
          this.frameGltfModelView(state.avatar.root);
        }
      },

      setSpeaking(active) {
        state.speaking = Boolean(active);
      },

      setListening(active) {
        state.listening = Boolean(active);
      },

      setExpression(name) {
        const next = EXPRESSIONS.includes(name) ? name : "neutral";
        state.targetExpression = next;
      },

      startLoop() {
        const tick = () => {
          if (state.disposed) return;
          state.raf = global.requestAnimationFrame(tick);
          this.updateFrame();
          state.renderer?.render(state.scene, state.camera);
        };
        tick();
      },

      updateFrame() {
        const dt = state.clock?.getDelta?.() || 0.016;
        const { THREE } = threeBundle || {};
        const speakingActive = state.speaking || state.listening;

        state.mouthPhase += dt * (speakingActive ? 14 : 4);
        state.blinkPhase += dt;
        if (state.blinkPhase >= state.nextBlink) {
          state.blinkPhase = 0;
          state.nextBlink = 2 + Math.random() * 3.5;
        }

        const blinkAmt =
          state.blinkPhase < 0.12 ? Math.sin((state.blinkPhase / 0.12) * Math.PI) : 0;
        const mouthAmt = speakingActive
          ? 0.25 + Math.abs(Math.sin(state.mouthPhase)) * 0.75
          : 0.05 + Math.sin(state.mouthPhase) * 0.03;

        state.expression = state.targetExpression;
        const expr = state.expression;
        const exprWeights = {
          neutral: { smile: 0.05, surprised: 0, sad: 0 },
          happy: { smile: 0.85, surprised: 0, sad: 0 },
          surprised: { smile: 0.1, surprised: 0.9, sad: 0 },
          sad: { smile: 0, surprised: 0, sad: 0.75 },
        }[expr] || { smile: 0, surprised: 0, sad: 0 };

        if (state.avatar?.procedural && state.avatar.parts && THREE) {
          const { head, leftEye, rightEye, mouth, leftBrow, rightBrow } = state.avatar.parts;
          const gazeX = Math.sin(state.mouthPhase * 0.15) * 0.04;
          const gazeY = Math.sin(state.mouthPhase * 0.11) * 0.03;
          head.rotation.y = gazeX;
          head.rotation.x = gazeY;
          leftEye.scale.y = 1 - blinkAmt * 0.92;
          rightEye.scale.y = 1 - blinkAmt * 0.92;
          mouth.scale.y = 0.35 + mouthAmt * 0.9;
          mouth.scale.x = 0.9 + mouthAmt * 0.15;
          const browLift = expr === "surprised" ? 0.08 : expr === "sad" ? -0.04 : 0.02;
          leftBrow.position.y = 1.28 + browLift;
          rightBrow.position.y = 1.28 + browLift;
          leftBrow.rotation.z = expr === "sad" ? 0.25 : expr === "happy" ? -0.08 : 0;
          rightBrow.rotation.z = expr === "sad" ? -0.25 : expr === "happy" ? 0.08 : 0;
        }

        if (
          speakingActive &&
          state.expressionCapability &&
          !state.expressionCapability.mouthCapable &&
          !state._loggedNoMouthMorph
        ) {
          state._loggedNoMouthMorph = true;
          console.warn(
            "[GenAi3D] syncSpeaking active but mouth morph is unavailable",
            state.expressionCapability
          );
        }

        if (state.expressionCapability?.supported) {
          state.morphMeshes.forEach((mesh) => {
            const inf = mesh.morphTargetInfluences;
            if (!inf) return;
            const setMorph = (key, val) => {
              const idx = state.morphIndices[key];
              if (idx >= 0) inf[idx] = THREE.MathUtils.lerp(inf[idx] || 0, val, 0.18);
            };
            setMorph("mouthOpen", mouthAmt);
            setMorph("smile", exprWeights.smile);
            setMorph("surprised", exprWeights.surprised);
            setMorph("sad", exprWeights.sad);
            setMorph("blink", blinkAmt);
          });
        }

        if (state.avatar?.root && !state.avatar.procedural) {
          const root = state.avatar.root;
          const autoY = state.avatar.autoRotationY ?? 0;
          const manualOff = state.avatar.manualRotationOffset ?? 0;
          const baseY = autoY + manualOff;
          root.rotation.y = baseY + Math.sin(state.mouthPhase * 0.12) * 0.06;
          root.rotation.x = Math.sin(state.mouthPhase * 0.09) * 0.03;
          const basePos = state.avatar.basePosition;
          if (basePos) {
            root.position.set(
              basePos.x,
              basePos.y + Math.sin(state.mouthPhase * 0.2) * 0.01,
              basePos.z
            );
          }
        }
      },

      dispose() {
        state.disposed = true;
        if (state.raf) global.cancelAnimationFrame(state.raf);
        state.resizeObserver?.disconnect();
        state.morphMeshes = [];
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
        state.avatar = null;
      },
    };
  }

  const STAGE_STORAGE_KEY = "tasu_genai_stage_renderer";
  let activeController = null;
  let rendererMode = "2d";
  let initPromise = null;

  function getCanvas() {
    return document.querySelector("[data-gen-ai-char-3d-canvas]");
  }

  function getStage() {
    return document.querySelector("[data-ai-character-stage]");
  }

  function loadRendererPreference() {
    if (global.TasuGenAiWorkspace?.getStageRendererMode) {
      return global.TasuGenAiWorkspace.getStageRendererMode();
    }
    try {
      const v = localStorage.getItem(STAGE_STORAGE_KEY);
      if (v === "3d" || v === "live") return v;
      return "2d";
    } catch {
      return "2d";
    }
  }

  function saveRendererPreference(mode) {
    try {
      localStorage.setItem(STAGE_STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
  }

  function applyRendererModeUi(mode) {
    if (global.TasuGenAiWorkspace?.applyStageRendererUi) {
      global.TasuGenAiWorkspace.applyStageRendererUi(mode);
      rendererMode = global.TasuGenAiWorkspace.getStageRendererMode?.() || mode;
      return;
    }
    rendererMode = mode === "3d" ? "3d" : mode === "live" ? "live" : "2d";
    const canvas = getCanvas();
    if (canvas) canvas.hidden = rendererMode !== "3d";
  }

  async function ensure3dMounted() {
    const canvas = getCanvas();
    if (!canvas) return null;
    if (activeController && !activeController.state.disposed) return activeController;
    if (initPromise) return initPromise;

    initPromise = (async () => {
      try {
        const ctrl = createStageController(canvas);
        await ctrl.mount();
        activeController = ctrl;
        return ctrl;
      } catch (err) {
        console.warn("[GenAi3D] init failed:", err);
        return null;
      } finally {
        initPromise = null;
      }
    })();

    return initPromise;
  }

  async function setRendererMode(mode) {
    if (global.TasuGenAiWorkspace?.setStageRendererMode) {
      return global.TasuGenAiWorkspace.setStageRendererMode(mode, { save: true });
    }
    const next = mode === "3d" ? "3d" : "2d";
    saveRendererPreference(next);
    applyRendererModeUi(next);
    if (next === "3d") {
      await ensure3dMounted();
      activeController?.resize();
      activeController?.updateStatusLabel?.();
    }
  }

  function syncSpeaking(speaking, listening) {
    const mode = global.TasuGenAiWorkspace?.getStageRendererMode?.() || rendererMode;
    if (mode !== "3d" || !activeController) return;
    activeController.setSpeaking(speaking);
    activeController.setListening(listening);
  }

  function syncExpression(name) {
    const mode = global.TasuGenAiWorkspace?.getStageRendererMode?.() || rendererMode;
    if (mode !== "3d" || !activeController) return;
    activeController.setExpression(name);
  }

  function inferExpressionFromText(text) {
    if (global.GenAiCharacterExpression?.toGltfLegacyExpression) {
      return global.GenAiCharacterExpression.toGltfLegacyExpression(
        global.GenAiCharacterExpression.inferExpressionFromText(text)
      );
    }
    return "neutral";
  }

  function bindRendererToggle() {
    if (global.TasuGenAiWorkspace?.setStageRendererMode) return;
    document.querySelectorAll("[data-gen-ai-stage-renderer]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const mode = btn.getAttribute("data-gen-ai-stage-renderer");
        void setRendererMode(mode);
      });
    });
  }

  function init() {
    if (!document.querySelector("[data-gen-ai-char-3d-canvas]")) return;
    if (document.querySelector("[data-gen-ai-root]")) return;
    applyRendererModeUi(loadRendererPreference());
    bindRendererToggle();
    if (rendererMode === "3d") void ensure3dMounted();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  function bindRotationDevControls() {
    if (!isGenAiDevMode()) return;
    const leftBtn = document.querySelector("[data-gen-ai-3d-rotate-left]");
    const rightBtn = document.querySelector("[data-gen-ai-3d-rotate-right]");
    const resetBtn = document.querySelector("[data-gen-ai-3d-rotate-reset]");
    if (!leftBtn || leftBtn.dataset.genAi3dRotateBound === "1") return;
    leftBtn.dataset.genAi3dRotateBound = "1";
    rightBtn && (rightBtn.dataset.genAi3dRotateBound = "1");
    resetBtn && (resetBtn.dataset.genAi3dRotateBound = "1");
    leftBtn.addEventListener("click", () => adjustManualRotation(-Math.PI / 2));
    rightBtn?.addEventListener("click", () => adjustManualRotation(Math.PI / 2));
    resetBtn?.addEventListener("click", () => resetManualRotation());
  }

  function adjustManualRotation(deltaRadians) {
    const ctrl = activeController;
    const avatar = ctrl?.state?.avatar;
    if (!avatar?.root || avatar.procedural) return false;
    const charId = avatar.characterId || getActiveCharacterId();
    if (!charId) return false;

    const nextOffset = readRotationOffset(charId) + Number(deltaRadians || 0);
    writeRotationOffset(charId, nextOffset);
    avatar.manualRotationOffset = nextOffset;
    avatar.characterId = charId;
    ctrl.applyAvatarRotation(avatar.root, avatar);
    ctrl.frameGltfModelView(avatar.root);
    console.log("[GenAi3D] manualRotationY", avatar.root.rotation.y, {
      characterId: charId,
      manualOffset: nextOffset,
      autoRotationY: avatar.autoRotationY,
    });
    return true;
  }

  function resetManualRotation(characterId) {
    const ctrl = activeController;
    const avatar = ctrl?.state?.avatar;
    const charId = String(characterId || avatar?.characterId || getActiveCharacterId() || "").trim();
    if (!charId) return false;
    writeRotationOffset(charId, 0);
    if (avatar?.root && !avatar.procedural) {
      avatar.manualRotationOffset = 0;
      avatar.characterId = charId;
      ctrl.applyAvatarRotation(avatar.root, avatar);
      ctrl.frameGltfModelView(avatar.root);
      console.log("[GenAi3D] manualRotationY", avatar.root.rotation.y, {
        characterId: charId,
        manualOffset: 0,
        autoRotationY: avatar.autoRotationY,
        reset: true,
      });
    }
    return true;
  }

  async function loadGltfFromUrl(url) {
    const ctrl = await ensure3dMounted();
    if (!ctrl?.loadGltfFromUrl) return false;
    return ctrl.loadGltfFromUrl(url);
  }

  function disposeActiveController() {
    if (activeController) {
      activeController.dispose();
      activeController = null;
    }
    if (global.__genAi3dBackend === "tripo" || global.__genAi3dBackend === "gltf") {
      global.__genAi3dBackend = null;
    }
  }

  global.GenAiCharacter3D = {
    disposeActive: disposeActiveController,
    EXPRESSIONS,
    MODEL_CANDIDATES,
    STORAGE_ROTATION_OFFSETS,
    init,
    setRendererMode,
    getRendererMode: () => rendererMode,
    ensure3dMounted,
    loadGltfFromUrl,
    adjustManualRotation,
    resetManualRotation,
    readRotationOffset,
    writeRotationOffset,
    getActiveCharacterId,
    bindRotationDevControls,
    inspectModelMorphTargets,
    getLastMorphReport: () => global.__genAi3dLastMorphReport || null,
    syncSpeaking,
    syncExpression,
    inferExpressionFromText,
    applyRendererModeUi,
    dispose() {
      activeController?.dispose();
      activeController = null;
    },
  };
})(window);
