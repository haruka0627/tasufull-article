/**
 * TLV-owned lightweight Motion Mapper — Tracking Contract → VRM runtime.
 * No Kalidokit. No Full-body IK.
 */
import { clamp, createEmptyTrackingFrame } from "./one-tlv-vtuber-tracking-contract.mjs";

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function deadzone(v, dz) {
  const x = Number(v) || 0;
  if (Math.abs(x) < dz) return 0;
  return x;
}

/**
 * @param {object} [opts]
 */
export function createMotionMapper(opts = {}) {
  const smooth = {
    yaw: 0,
    pitch: 0,
    roll: 0,
    blinkL: 0,
    blinkR: 0,
    open: 0,
    shapeA: 0,
    shapeI: 0,
    shapeU: 0,
    shapeE: 0,
    shapeO: 0,
    happy: 0,
    angry: 0,
    sad: 0,
    relaxed: 0,
    surprised: 0,
    lookX: 0,
    lookY: 0,
  };

  let lostFrames = 0;
  const LOST_NEUTRAL_FRAMES = 12;

  const cfg = {
    aHead: opts.aHead ?? 0.35,
    aEye: opts.aEye ?? 0.4,
    aMouth: opts.aMouth ?? 0.45,
    aBlink: opts.aBlink ?? 0.55,
    aExpr: opts.aExpr ?? 0.4,
    headDeadzone: opts.headDeadzone ?? 0.02,
    lookDeadzone: opts.lookDeadzone ?? 0.03,
    lookYawScale: opts.lookYawScale ?? 20,
    lookPitchScale: opts.lookPitchScale ?? 15,
    mirror: opts.mirror !== false,
  };

  function setExpressionSafe(vrm, names, value) {
    const mgr = vrm?.expressionManager;
    if (!mgr || typeof mgr.setValue !== "function") return false;
    const map =
      typeof mgr.getExpressionMap === "function" ? mgr.getExpressionMap() : null;
    let applied = false;
    for (const name of names) {
      try {
        if (map && !map.has(name)) continue;
        mgr.setValue(name, clamp(value));
        applied = true;
      } catch (_) {}
    }
    return applied;
  }

  function setMirror(on) {
    cfg.mirror = Boolean(on);
  }

  /**
   * Smooth toward target; on lost, ease to neutral.
   * @param {ReturnType<typeof createEmptyTrackingFrame>} frame
   */
  function ingest(frame) {
    const lost = !frame || frame.trackingState === "lost" || (frame.confidence || 0) < 0.15;
    if (lost) {
      lostFrames += 1;
      const t = Math.min(1, lostFrames / LOST_NEUTRAL_FRAMES) * 0.22;
      const neutral = createEmptyTrackingFrame(frame?.timestamp);
      smooth.yaw = lerp(smooth.yaw, 0, t);
      smooth.pitch = lerp(smooth.pitch, 0, t);
      smooth.roll = lerp(smooth.roll, 0, t);
      smooth.blinkL = lerp(smooth.blinkL, 0, t);
      smooth.blinkR = lerp(smooth.blinkR, 0, t);
      smooth.open = lerp(smooth.open, 0, t);
      smooth.shapeA = lerp(smooth.shapeA, 0, t);
      smooth.shapeI = lerp(smooth.shapeI, 0, t);
      smooth.shapeU = lerp(smooth.shapeU, 0, t);
      smooth.shapeE = lerp(smooth.shapeE, 0, t);
      smooth.shapeO = lerp(smooth.shapeO, 0, t);
      smooth.happy = lerp(smooth.happy, 0, t);
      smooth.angry = lerp(smooth.angry, 0, t);
      smooth.sad = lerp(smooth.sad, 0, t);
      smooth.relaxed = lerp(smooth.relaxed, clamp(neutral.expressions.relaxed || 0.2), t);
      smooth.surprised = lerp(smooth.surprised, 0, t);
      smooth.lookX = lerp(smooth.lookX, 0, t);
      smooth.lookY = lerp(smooth.lookY, 0, t);
      return { lost: true, smooth: { ...smooth } };
    }

    lostFrames = 0;
    const mirror = cfg.mirror ? -1 : 1;
    const yaw = deadzone(frame.head.yaw, cfg.headDeadzone) * mirror;
    const pitch = deadzone(frame.head.pitch, cfg.headDeadzone);
    const roll = deadzone(frame.head.roll, cfg.headDeadzone) * mirror;
    let lookX = deadzone(frame.eyes.lookX, cfg.lookDeadzone) * mirror;
    const lookY = deadzone(frame.eyes.lookY, cfg.lookDeadzone);

    smooth.yaw = lerp(smooth.yaw, yaw, cfg.aHead);
    smooth.pitch = lerp(smooth.pitch, pitch, cfg.aHead);
    smooth.roll = lerp(smooth.roll, roll, cfg.aHead);
    smooth.blinkL = lerp(smooth.blinkL, clamp(frame.eyes.blinkLeft), cfg.aBlink);
    smooth.blinkR = lerp(smooth.blinkR, clamp(frame.eyes.blinkRight), cfg.aBlink);
    smooth.open = lerp(smooth.open, clamp(frame.mouth.open), cfg.aMouth);
    smooth.shapeA = lerp(smooth.shapeA, clamp(frame.mouth.shapeA), cfg.aMouth);
    smooth.shapeI = lerp(smooth.shapeI, clamp(frame.mouth.shapeI), cfg.aMouth);
    smooth.shapeU = lerp(smooth.shapeU, clamp(frame.mouth.shapeU), cfg.aMouth);
    smooth.shapeE = lerp(smooth.shapeE, clamp(frame.mouth.shapeE), cfg.aMouth);
    smooth.shapeO = lerp(smooth.shapeO, clamp(frame.mouth.shapeO), cfg.aMouth);
    smooth.happy = lerp(smooth.happy, clamp(frame.expressions.happy), cfg.aExpr);
    smooth.angry = lerp(smooth.angry, clamp(frame.expressions.angry), cfg.aExpr);
    smooth.sad = lerp(smooth.sad, clamp(frame.expressions.sad), cfg.aExpr);
    smooth.relaxed = lerp(smooth.relaxed, clamp(frame.expressions.relaxed), cfg.aExpr);
    smooth.surprised = lerp(smooth.surprised, clamp(frame.expressions.surprised), cfg.aExpr);
    smooth.lookX = lerp(smooth.lookX, lookX, cfg.aEye);
    smooth.lookY = lerp(smooth.lookY, lookY, cfg.aEye);

    return { lost: false, smooth: { ...smooth } };
  }

  /**
   * Apply smoothed pose to a three-vrm instance.
   * @param {object | null} vrm
   * @param {ReturnType<typeof createEmptyTrackingFrame>} frame
   */
  function applyToVrm(vrm, frame) {
    if (!vrm) return { ok: false, reason: "no_vrm" };
    const { smooth: s } = ingest(frame);

    const head = vrm.humanoid?.getNormalizedBoneNode?.("head");
    if (head) {
      head.rotation.set(s.pitch, s.yaw, s.roll);
    }

    setExpressionSafe(vrm, ["blinkLeft", "blink_l", "BlinkLeft"], s.blinkL);
    setExpressionSafe(vrm, ["blinkRight", "blink_r", "BlinkRight"], s.blinkR);
    setExpressionSafe(vrm, ["blink", "Blink"], Math.max(s.blinkL, s.blinkR));

    setExpressionSafe(vrm, ["aa", "a", "A", "jawOpen"], Math.max(s.open, s.shapeA));
    setExpressionSafe(vrm, ["ih", "i", "I"], s.shapeI);
    setExpressionSafe(vrm, ["ou", "u", "U"], s.shapeU);
    setExpressionSafe(vrm, ["ee", "e", "E"], s.shapeE);
    setExpressionSafe(vrm, ["oh", "o", "O"], s.shapeO);

    setExpressionSafe(vrm, ["happy", "joy", "fun", "smile"], s.happy);
    setExpressionSafe(vrm, ["angry", "anger"], s.angry);
    setExpressionSafe(vrm, ["sad", "sorrow", "depressed"], s.sad);
    setExpressionSafe(vrm, ["relaxed", "neutral"], s.relaxed);
    setExpressionSafe(vrm, ["surprised", "surprise"], s.surprised);

    if (vrm.lookAt) {
      try {
        const yawDeg = s.lookX * cfg.lookYawScale;
        const pitchDeg = s.lookY * cfg.lookPitchScale;
        if (typeof vrm.lookAt.applier?.applyYawPitch === "function") {
          vrm.lookAt.applier.applyYawPitch(yawDeg, pitchDeg);
        } else {
          vrm.lookAt.yaw = yawDeg;
          vrm.lookAt.pitch = pitchDeg;
        }
      } catch (_) {}
    }

    return { ok: true, lost: lostFrames > 0, smooth: s };
  }

  function reset() {
    Object.keys(smooth).forEach((k) => {
      smooth[k] = 0;
    });
    lostFrames = 0;
  }

  function getSmooth() {
    return { ...smooth };
  }

  return {
    id: "tlv_own_lightweight_mapper",
    setMirror,
    ingest,
    applyToVrm,
    reset,
    getSmooth,
  };
}
