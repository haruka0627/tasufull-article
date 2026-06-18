/**
 * 口位置自動推定 — 静的検証 + 構図ヒューリスティック
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(root, "gen-ai-workspace.html"), "utf8");
const js = readFileSync(join(root, "gen-ai-workspace.js"), "utf8");
const edge = readFileSync(
  join(root, "supabase/functions/gemini-image-character-analyze/index.ts"),
  "utf8"
);

const checks = [
  ["estimate button form", /data-gen-ai-char-mouth-estimate-btn/.test(html)],
  ["composition in js", /detectCompositionHeuristic/.test(js)],
  ["mouthEstimateComposition save", /mouthEstimateComposition/.test(js)],
  ["face_closeup preset", /FACE_CLOSEUP/.test(js)],
  ["formatMouthEstimateStatusMessage", /formatMouthEstimateStatusMessage/.test(js)],
  ["composition in edge", /parseComposition/.test(edge)],
  ["seed composition json", /"composition": "face_closeup/.test(edge)],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}: ${name}`);
  if (!ok) failed += 1;
}

const MOUTH_COMPOSITION = {
  FACE_CLOSEUP: "face_closeup",
  BUST_UP: "bust_up",
  FULL_BODY: "full_body",
  UNKNOWN: "unknown",
};

function detectCompositionHeuristic(width, height) {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const ratio = w / h;
  const tallness = h / w;
  const near34 = Math.abs(ratio - 0.75) <= 0.1;
  if (tallness >= 1.85 || ratio < 0.52) return MOUTH_COMPOSITION.FULL_BODY;
  if (tallness >= 1.55 && ratio < 0.62) return MOUTH_COMPOSITION.FULL_BODY;
  if (ratio >= 0.7 && ratio <= 0.85 && tallness >= 1.15 && tallness <= 1.45 && near34) {
    return MOUTH_COMPOSITION.FACE_CLOSEUP;
  }
  if (ratio >= 0.7 && ratio <= 0.85 && tallness >= 1.15 && tallness <= 1.45) {
    return MOUTH_COMPOSITION.FACE_CLOSEUP;
  }
  if (ratio >= 0.72 && ratio <= 0.92 && tallness > 1.45 && tallness < 1.85) {
    return MOUTH_COMPOSITION.BUST_UP;
  }
  if (ratio >= 0.62 && ratio <= 0.92 && tallness >= 1.15 && tallness < 1.85) {
    return MOUTH_COMPOSITION.BUST_UP;
  }
  return MOUTH_COMPOSITION.UNKNOWN;
}

function getMouthPresetForComposition(composition) {
  switch (composition) {
    case MOUTH_COMPOSITION.FACE_CLOSEUP:
      return { mouthX: 50, mouthY: 72, mouthScale: 0.85 };
    case MOUTH_COMPOSITION.BUST_UP:
      return { mouthX: 50, mouthY: 65, mouthScale: 0.9 };
    case MOUTH_COMPOSITION.FULL_BODY:
      return { mouthX: 50, mouthY: 52, mouthScale: 1 };
    default:
      return { mouthX: 50, mouthY: 65, mouthScale: 1 };
  }
}

function estimateMouthHeuristic(width, height) {
  const composition = detectCompositionHeuristic(width, height);
  return { ...getMouthPresetForComposition(composition), composition };
}

function mergeMouthEstimates(heuristic, aiPayload) {
  const aiComposition = String(aiPayload?.composition || "unknown");
  if (aiComposition === "face_closeup") {
    const hint = aiPayload.mouthHint;
    if (hint) {
      return {
        mouthX: hint.mouthX,
        mouthY: hint.mouthY,
        mouthScale: hint.mouthScale,
        composition: "face_closeup",
        source: "ai",
      };
    }
    return { ...getMouthPresetForComposition("face_closeup"), composition: "face_closeup", source: "ai" };
  }
  return { ...heuristic, source: "heuristic" };
}

const face = estimateMouthHeuristic(480, 640);
const bust = estimateMouthHeuristic(520, 780);
const full = estimateMouthHeuristic(400, 900);

const faceOk =
  face.composition === "face_closeup" && face.mouthY >= 70 && face.mouthY <= 74 && face.mouthScale >= 0.75 && face.mouthScale <= 0.9;
const bustOk =
  bust.composition === "bust_up" && bust.mouthY >= 63 && bust.mouthY <= 68;
const fullOk =
  full.composition === "full_body" && full.mouthY >= 45 && full.mouthY <= 55;

console.log(`${faceOk ? "PASS" : "FAIL"}: face_closeup 480×640 → Y=${face.mouthY} scale=${face.mouthScale}`);
console.log(`${bustOk ? "PASS" : "FAIL"}: bust_up 520×780 → Y=${bust.mouthY}`);
console.log(`${fullOk ? "PASS" : "FAIL"}: full_body 400×900 → Y=${full.mouthY}`);

if (!faceOk || !bustOk || !fullOk) failed += 1;

const aiMerged = mergeMouthEstimates(face, {
  composition: "face_closeup",
  mouthHint: { mouthX: 50, mouthY: 73, mouthScale: 0.88, confidence: 0.8 },
});
const aiOk = aiMerged.composition === "face_closeup" && aiMerged.mouthY === 73 && aiMerged.source === "ai";
console.log(`${aiOk ? "PASS" : "FAIL"}: AI face_closeup overrides heuristic`);
if (!aiOk) failed += 1;

console.log(`\nTotal checks failed: ${failed}`);
process.exit(failed ? 1 : 0);
