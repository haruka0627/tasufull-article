/**
 * MediaPipe Face Landmarker → TLV Tracking Contract adapter.
 * Keeps ARKit-style blendshape names inside this module only.
 */
import {
  clamp,
  createEmptyTrackingFrame,
} from "./one-tlv-vtuber-tracking-contract.mjs";

/** MediaPipe Face Landmarker category names (adapter-private). */
const MP = Object.freeze({
  blinkL: "eyeBlinkLeft",
  blinkR: "eyeBlinkRight",
  jawOpen: "jawOpen",
  smileL: "mouthSmileLeft",
  smileR: "mouthSmileRight",
  frownL: "mouthFrownLeft",
  frownR: "mouthFrownRight",
  mouthPucker: "mouthPucker",
  mouthFunnel: "mouthFunnel",
  mouthClose: "mouthClose",
  lookInL: "eyeLookInLeft",
  lookOutL: "eyeLookOutLeft",
  lookUpL: "eyeLookUpLeft",
  lookDownL: "eyeLookDownLeft",
  lookInR: "eyeLookInRight",
  lookOutR: "eyeLookOutRight",
  lookUpR: "eyeLookUpRight",
  lookDownR: "eyeLookDownRight",
  browInnerUp: "browInnerUp",
  browDownL: "browDownLeft",
  browDownR: "browDownRight",
  cheekSquintL: "cheekSquintLeft",
  cheekSquintR: "cheekSquintRight",
});

/**
 * @param {unknown} result MediaPipe FaceLandmarkerResult
 * @returns {Record<string, number>}
 */
function blendMap(result) {
  const out = Object.create(null);
  const packs = result?.faceBlendshapes || [];
  const cats = packs[0]?.categories || [];
  for (let i = 0; i < cats.length; i++) {
    const c = cats[i];
    if (c && c.categoryName) out[c.categoryName] = clamp(c.score);
  }
  return out;
}

/**
 * @param {{ data?: ArrayLike<number> } | null | undefined} matrixObj
 * @param {{ Matrix4: new () => { fromArray: (a: ArrayLike<number>) => unknown }, Euler: new () => { setFromRotationMatrix: (m: unknown, order: string) => void, x: number, y: number, z: number } }} THREE
 */
export function matrixToEuler(matrixObj, THREE) {
  const data = matrixObj?.data;
  if (!data || data.length < 16 || !THREE) return { yaw: 0, pitch: 0, roll: 0 };
  const m = new THREE.Matrix4().fromArray(data);
  const e = new THREE.Euler().setFromRotationMatrix(m, "YXZ");
  return { yaw: e.y, pitch: e.x, roll: e.z };
}

/**
 * Convert one MediaPipe detectForVideo result into TLV Tracking Contract.
 *
 * @param {unknown} result
 * @param {{
 *   timestamp?: number,
 *   THREE?: object,
 * }} [opts]
 */
export function mediapipeResultToTrackingFrame(result, opts = {}) {
  const ts = opts.timestamp != null ? Number(opts.timestamp) : Date.now();
  const frame = createEmptyTrackingFrame(ts);

  if (!result?.faceLandmarks?.length) {
    frame.trackingState = "lost";
    frame.confidence = 0;
    return frame;
  }

  const bs = blendMap(result);
  const mats = result.facialTransformationMatrixes || [];
  const euler = matrixToEuler(mats[0], opts.THREE);

  frame.head.yaw = clamp(euler.yaw, -Math.PI, Math.PI);
  frame.head.pitch = clamp(euler.pitch, -Math.PI, Math.PI);
  frame.head.roll = clamp(euler.roll, -Math.PI, Math.PI);

  frame.eyes.blinkLeft = clamp(bs[MP.blinkL]);
  frame.eyes.blinkRight = clamp(bs[MP.blinkR]);

  let lookX =
    (bs[MP.lookOutL] || 0) -
    (bs[MP.lookInL] || 0) +
    ((bs[MP.lookInR] || 0) - (bs[MP.lookOutR] || 0));
  lookX *= 0.5;
  const lookY =
    ((bs[MP.lookUpL] || 0) + (bs[MP.lookUpR] || 0)) * 0.5 -
    ((bs[MP.lookDownL] || 0) + (bs[MP.lookDownR] || 0)) * 0.5;
  frame.eyes.lookX = clamp(lookX, -1, 1);
  frame.eyes.lookY = clamp(lookY, -1, 1);

  const jaw = clamp(bs[MP.jawOpen]);
  frame.mouth.open = jaw;
  // Vowel shapes: approximate from MediaPipe mouth params (V1 lightweight).
  frame.mouth.shapeA = jaw;
  frame.mouth.shapeI = clamp((bs[MP.mouthClose] || 0) * 0.35);
  frame.mouth.shapeU = clamp(bs[MP.mouthPucker]);
  frame.mouth.shapeE = clamp(((bs[MP.smileL] || 0) + (bs[MP.smileR] || 0)) * 0.25);
  frame.mouth.shapeO = clamp(bs[MP.mouthFunnel]);

  const smile = ((bs[MP.smileL] || 0) + (bs[MP.smileR] || 0)) * 0.5;
  const frown = ((bs[MP.frownL] || 0) + (bs[MP.frownR] || 0)) * 0.5;
  const browUp = clamp(bs[MP.browInnerUp]);
  const browDown = ((bs[MP.browDownL] || 0) + (bs[MP.browDownR] || 0)) * 0.5;

  frame.expressions.happy = clamp(smile);
  frame.expressions.angry = clamp(Math.max(frown, browDown * 0.8));
  frame.expressions.sad = clamp(frown * 0.7);
  frame.expressions.relaxed = clamp(1 - Math.max(jaw, smile, browUp) * 0.85);
  frame.expressions.surprised = clamp(Math.max(jaw * 0.55, browUp));

  // Confidence: face present + non-zero motion cues.
  const cue =
    Math.abs(frame.head.yaw) +
    Math.abs(frame.head.pitch) +
    frame.eyes.blinkLeft +
    frame.eyes.blinkRight +
    frame.mouth.open +
    frame.expressions.happy;
  frame.confidence = clamp(0.55 + Math.min(0.45, cue * 0.15));
  frame.trackingState = "tracking";
  return frame;
}

/**
 * Factory used by runtime — binds THREE for matrix decode.
 * @param {object} THREE
 */
export function createMediapipeTrackingAdapter(THREE) {
  return {
    id: "mediapipe_face_landmarker",
    /**
     * @param {unknown} result
     * @param {number} [timestamp]
     */
    toFrame(result, timestamp) {
      return mediapipeResultToTrackingFrame(result, { timestamp, THREE });
    },
  };
}
