/**
 * Presentation exact-duplicate + spec-diversity gates.
 * Reuses existing-register sha256. No image similarity engine.
 */
import crypto from "node:crypto";
import { buildDuplicateIndex, checkDuplicate, sha256File } from "./existing-register/hash.mjs";
import { presentationSpecFingerprint } from "./presentation-demand-genre-ssot.mjs";
import { appendCanonicalGenreGateReasons } from "./canonical-genre-generation-contract-v1.mjs";

export const PRESENTATION_NEAR_DUPLICATE_GATE_STATUS = "REVIEW_REQUIRED";
export const PRESENTATION_NEAR_DUPLICATE_GATE_REASON =
  "Perceptual slide similarity is HUMAN_VISUAL; spec/combo fingerprint is fail-closed. Hash-only uniqueness is forbidden.";

export function sha256Buffer(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

export function createPresentationDiversityState(existingItems = []) {
  const dup = buildDuplicateIndex(existingItems);
  const titles = new Set();
  const fingerprints = new Set();
  const prompts = new Set();
  const combos = new Set();
  for (const item of existingItems) {
    if (item?.title) titles.add(String(item.title).trim());
    const fp = item?.spec_fingerprint || presentationSpecFingerprint(item);
    if (fp && fp !== "||||||") fingerprints.add(fp);
    if (item?.prompt) prompts.add(String(item.prompt).trim());
    const combo = `${item?.design_family || ""}|${item?.layout_type || ""}|${item?.slide_type || ""}`;
    if (combo !== "||") combos.add(combo);
  }
  return { dup, titles, fingerprints, prompts, combos, hashesThisBatch: new Set() };
}

export function checkPresentationGenerationGates(candidate, state) {
  const reasons = [...appendCanonicalGenreGateReasons(candidate, "presentation")];
  const title = String(candidate.title || "").trim();
  const prompt = String(candidate.prompt || candidate.promptText || "").trim();
  const spec = candidate.spec || candidate;
  const fp = candidate.spec_fingerprint || presentationSpecFingerprint(spec);
  const combo = `${spec.design_family || ""}|${spec.layout_type || ""}|${spec.slide_type || ""}`;
  if (!fp || !String(fp).replace(/\|/g, "")) reasons.push("missing_spec_fingerprint");
  if (title && state.titles.has(title)) reasons.push("same_title_repetition");
  if (prompt && state.prompts.has(prompt)) reasons.push("repeated_prompt");
  if (fp && String(fp).replace(/\|/g, "") && state.fingerprints.has(fp)) reasons.push("same_generator_spec");
  if (combo !== "||" && state.combos.has(combo)) reasons.push("same_family_layout_slide");
  const hash = candidate.sha256 || candidate.file_hash;
  if (hash && (state.dup.byHash.has(hash) || state.hashesThisBatch.has(hash))) reasons.push("exact_file_hash");
  const fileDup = checkDuplicate(candidate, state.dup);
  if (fileDup.duplicate) reasons.push(fileDup.reason);
  return {
    ok: reasons.length === 0,
    reasons,
    near_presentation: { status: PRESENTATION_NEAR_DUPLICATE_GATE_STATUS, reason: PRESENTATION_NEAR_DUPLICATE_GATE_REASON },
  };
}

export function rememberPresentationCandidate(state, candidate, sha256) {
  const title = String(candidate.title || "").trim();
  const prompt = String(candidate.prompt || candidate.promptText || "").trim();
  const spec = candidate.spec || candidate;
  const fp = candidate.spec_fingerprint || presentationSpecFingerprint(spec);
  const combo = `${spec.design_family || ""}|${spec.layout_type || ""}|${spec.slide_type || ""}`;
  if (title) state.titles.add(title);
  if (prompt) state.prompts.add(prompt);
  if (fp) state.fingerprints.add(fp);
  if (combo !== "||") state.combos.add(combo);
  if (sha256) {
    state.hashesThisBatch.add(sha256);
    state.dup.byHash.add(sha256);
  }
  if (candidate.id) state.dup.byId.add(String(candidate.id));
}

export { sha256File, buildDuplicateIndex, checkDuplicate };
