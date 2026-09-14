/**
 * SFX exact-duplicate + spec-diversity gates.
 * Reuses existing-register sha256. No perceptual fingerprint engine.
 */
import crypto from "node:crypto";
import {
  buildDuplicateIndex,
  checkDuplicate,
  sha256File,
} from "./existing-register/hash.mjs";
import { sfxSpecFingerprint } from "./sfx-demand-genre-ssot.mjs";
import { appendCanonicalGenreGateReasons } from "./canonical-genre-generation-contract-v1.mjs";
import { appendDisplayTitleJaGateReasons } from "./japanese-display-title.mjs";

export const SFX_NEAR_AUDIO_DUPLICATE_GATE_STATUS = "REVIEW_REQUIRED";
export const SFX_NEAR_AUDIO_DUPLICATE_GATE_REASON =
  "Perceptual audio similarity is HUMAN_AUDIO; spec fingerprint is fail-closed. Prompt uniqueness alone is not PASS.";

export function sha256Buffer(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

export function createSfxDiversityState(existingItems = []) {
  const dup = buildDuplicateIndex(existingItems);
  const titles = new Set();
  const fingerprints = new Set();
  const prompts = new Set();
  for (const item of existingItems) {
    if (item?.title) titles.add(String(item.title).trim());
    const fp = item?.spec_fingerprint || sfxSpecFingerprint(item);
    if (fp && fp !== "||||||") fingerprints.add(fp);
    if (item?.prompt) prompts.add(String(item.prompt).trim());
  }
  return { dup, titles, fingerprints, prompts, hashesThisBatch: new Set() };
}

export function checkSfxGenerationGates(candidate, state) {
  const reasons = [...appendCanonicalGenreGateReasons(candidate, "sfx")];
  const title = String(candidate.title || "").trim();
  const prompt = String(candidate.prompt || candidate.promptText || "").trim();
  const fp = candidate.spec_fingerprint || sfxSpecFingerprint(candidate.spec || candidate);
  if (!fp || !String(fp).replace(/\|/g, "")) reasons.push("missing_spec_fingerprint");
  if (title && state.titles.has(title)) reasons.push("same_title_repetition");
  reasons.push(...appendDisplayTitleJaGateReasons(candidate));
  if (prompt && state.prompts.has(prompt)) reasons.push("repeated_prompt");
  if (fp && String(fp).replace(/\|/g, "") && state.fingerprints.has(fp)) reasons.push("same_generator_spec");
  const hash = candidate.sha256 || candidate.file_hash;
  if (hash && (state.dup.byHash.has(hash) || state.hashesThisBatch.has(hash))) {
    reasons.push("exact_file_hash");
  }
  const fileDup = checkDuplicate(candidate, state.dup);
  if (fileDup.duplicate) reasons.push(fileDup.reason);
  return {
    ok: reasons.length === 0,
    reasons,
    near_audio: {
      status: SFX_NEAR_AUDIO_DUPLICATE_GATE_STATUS,
      reason: SFX_NEAR_AUDIO_DUPLICATE_GATE_REASON,
    },
  };
}

export function rememberSfxCandidate(state, candidate, sha256) {
  const title = String(candidate.title || "").trim();
  const prompt = String(candidate.prompt || candidate.promptText || "").trim();
  const fp = candidate.spec_fingerprint || sfxSpecFingerprint(candidate.spec || candidate);
  if (title) state.titles.add(title);
  if (prompt) state.prompts.add(prompt);
  if (fp) state.fingerprints.add(fp);
  if (sha256) {
    state.hashesThisBatch.add(sha256);
    state.dup.byHash.add(sha256);
  }
  if (candidate.id) state.dup.byId.add(String(candidate.id));
}

export { sha256File, buildDuplicateIndex, checkDuplicate };
