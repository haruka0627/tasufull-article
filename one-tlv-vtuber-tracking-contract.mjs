/**
 * TLV VTuber Tracking Contract — TLV_OWN SSOT (V1).
 * MediaPipe / Premium blendshape names must not leak past adapters.
 */
export const TRACKING_CONTRACT_VERSION = 1;

/**
 * @typedef {"tracking"|"lost"|"initializing"|"disabled"} TrackingState
 */

/** @returns {{ version: number, timestamp: number, head: object, eyes: object, mouth: object, expressions: object, confidence: number, trackingState: TrackingState }} */
export function createEmptyTrackingFrame(ts = Date.now()) {
  return {
    version: TRACKING_CONTRACT_VERSION,
    timestamp: Number(ts) || Date.now(),
    head: { yaw: 0, pitch: 0, roll: 0 },
    eyes: { blinkLeft: 0, blinkRight: 0, lookX: 0, lookY: 0 },
    mouth: {
      open: 0,
      shapeA: 0,
      shapeI: 0,
      shapeU: 0,
      shapeE: 0,
      shapeO: 0,
    },
    expressions: {
      happy: 0,
      angry: 0,
      sad: 0,
      relaxed: 0,
      surprised: 0,
    },
    confidence: 0,
    trackingState: /** @type {TrackingState} */ ("lost"),
  };
}

/**
 * Clamp helper shared by adapters / mappers.
 * @param {unknown} n
 * @param {number} [lo]
 * @param {number} [hi]
 */
export function clamp(n, lo = 0, hi = 1) {
  const x = Number(n);
  if (!Number.isFinite(x)) return lo;
  return Math.max(lo, Math.min(hi, x));
}

/**
 * Shallow-validate a frame without throwing.
 * @param {unknown} frame
 */
export function isTrackingFrame(frame) {
  return Boolean(
    frame &&
      typeof frame === "object" &&
      frame.head &&
      frame.eyes &&
      frame.mouth &&
      frame.expressions,
  );
}
