/**
 * Web exact-duplicate + spec-diversity gates.
 * Reuses existing-register sha256. No DOM similarity engine.
 */
import crypto from "node:crypto";
import { buildDuplicateIndex, checkDuplicate, sha256File } from "./existing-register/hash.mjs";
import { webSpecFingerprint } from "./web-demand-genre-ssot.mjs";
import { appendCanonicalGenreGateReasons } from "./canonical-genre-generation-contract-v1.mjs";

export const WEB_NEAR_DUPLICATE_GATE_STATUS = "REVIEW_REQUIRED";
export const WEB_NEAR_DUPLICATE_GATE_REASON =
  "Perceptual DOM similarity is HUMAN_VISUAL; structural spec fingerprint is fail-closed. Hash-only uniqueness is forbidden.";

export function sha256Buffer(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

export function createWebDiversityState(existingItems = []) {
  const dup = buildDuplicateIndex(existingItems);
  const titles = new Set();
  const fingerprints = new Set();
  const prompts = new Set();
  for (const item of existingItems) {
    if (item?.title) titles.add(String(item.title).trim());
    const fp = item?.spec_fingerprint || webSpecFingerprint(item);
    if (fp && fp !== "||||||") fingerprints.add(fp);
    if (item?.prompt) prompts.add(String(item.prompt).trim());
  }
  const structures = new Set();
  for (const item of existingItems) {
    if (item?.structural_fingerprint) structures.add(String(item.structural_fingerprint));
  }
  return { dup, titles, fingerprints, prompts, structures, hashesThisBatch: new Set() };
}

export function checkWebGenerationGates(candidate, state) {
  const reasons = [...appendCanonicalGenreGateReasons(candidate, "web")];
  const title = String(candidate.title || "").trim();
  const prompt = String(candidate.prompt || candidate.promptText || "").trim();
  const fp = candidate.spec_fingerprint || webSpecFingerprint(candidate.spec || candidate);
  if (!fp || !String(fp).replace(/\|/g, "")) reasons.push("missing_spec_fingerprint");
  if (title && state.titles.has(title)) reasons.push("same_title_repetition");
  if (prompt && state.prompts.has(prompt)) reasons.push("repeated_prompt");
  if (fp && String(fp).replace(/\|/g, "") && state.fingerprints.has(fp)) reasons.push("same_generator_spec");
  if (candidate.structural_fingerprint && state.structures?.has(candidate.structural_fingerprint)) {
    reasons.push("same_structural_fingerprint");
  }
  const hash = candidate.sha256 || candidate.file_hash;
  if (hash && (state.dup.byHash.has(hash) || state.hashesThisBatch.has(hash))) reasons.push("exact_file_hash");
  const fileDup = checkDuplicate(candidate, state.dup);
  if (fileDup.duplicate) reasons.push(fileDup.reason);
  return {
    ok: reasons.length === 0,
    reasons,
    near_web: { status: WEB_NEAR_DUPLICATE_GATE_STATUS, reason: WEB_NEAR_DUPLICATE_GATE_REASON },
  };
}

export function rememberWebCandidate(state, candidate, sha256) {
  const title = String(candidate.title || "").trim();
  const prompt = String(candidate.prompt || candidate.promptText || "").trim();
  const fp = candidate.spec_fingerprint || webSpecFingerprint(candidate.spec || candidate);
  if (title) state.titles.add(title);
  if (prompt) state.prompts.add(prompt);
  if (fp) state.fingerprints.add(fp);
  if (candidate.structural_fingerprint) {
    state.structures = state.structures || new Set();
    state.structures.add(String(candidate.structural_fingerprint));
  }
  if (sha256) {
    state.hashesThisBatch.add(sha256);
    state.dup.byHash.add(sha256);
  }
  if (candidate.id) state.dup.byId.add(String(candidate.id));
}

export { sha256File, buildDuplicateIndex, checkDuplicate };
