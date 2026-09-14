/**
 * Template exact + structural + semantic gates. Hash-only uniqueness is not enough.
 */
import crypto from "node:crypto";
import { buildDuplicateIndex, checkDuplicate, sha256File } from "./existing-register/hash.mjs";
import { templateSpecFingerprint } from "./template-demand-genre-ssot.mjs";

export const TEMPLATE_NEAR_DUPLICATE_GATE_STATUS = "REVIEW_REQUIRED";
export const TEMPLATE_NEAR_DUPLICATE_GATE_REASON =
  "Perceptual print similarity is HUMAN_VISUAL; structural fingerprint is fail-closed";

export function sha256Buffer(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

export function createTemplateDiversityState(existingItems = []) {
  const dup = buildDuplicateIndex(existingItems);
  const titles = new Set();
  const fingerprints = new Set();
  const prompts = new Set();
  const structures = new Set();
  for (const item of existingItems) {
    if (item?.title) titles.add(String(item.title).trim());
    const fp = item?.spec_fingerprint || templateSpecFingerprint(item);
    if (fp && fp !== "||||") fingerprints.add(fp);
    if (item?.prompt) prompts.add(String(item.prompt).trim());
    if (item?.structural_fingerprint) structures.add(String(item.structural_fingerprint));
  }
  return { dup, titles, fingerprints, prompts, structures, hashesThisBatch: new Set() };
}

export function checkTemplateGenerationGates(candidate, state) {
  const reasons = [];
  const title = String(candidate.title || "").trim();
  const prompt = String(candidate.prompt || candidate.promptText || "").trim();
  const fp = candidate.spec_fingerprint || templateSpecFingerprint(candidate.spec || candidate);
  if (!fp || fp === "||||") reasons.push("missing_spec_fingerprint");
  if (title && state.titles.has(title)) reasons.push("same_title_repetition");
  if (prompt && state.prompts.has(prompt)) reasons.push("repeated_prompt");
  if (fp && fp !== "||||" && state.fingerprints.has(fp)) reasons.push("same_generator_spec");
  const structural = candidate.structural_fingerprint;
  if (structural && state.structures.has(structural)) reasons.push("same_structural_fingerprint");
  const hash = candidate.sha256 || candidate.file_hash;
  if (hash && (state.dup.byHash.has(hash) || state.hashesThisBatch.has(hash))) reasons.push("exact_file_hash");
  const fileDup = checkDuplicate(candidate, state.dup);
  if (fileDup.duplicate) reasons.push(fileDup.reason);
  return {
    ok: reasons.length === 0,
    reasons,
    exact: reasons.some((r) => r === "exact_file_hash" || r.startsWith("duplicate")),
    structural: reasons.includes("same_generator_spec") || reasons.includes("same_structural_fingerprint"),
    semantic: reasons.includes("same_title_repetition") || reasons.includes("repeated_prompt"),
    near_template: { status: TEMPLATE_NEAR_DUPLICATE_GATE_STATUS, reason: TEMPLATE_NEAR_DUPLICATE_GATE_REASON },
  };
}

export function rememberTemplateCandidate(state, candidate, sha256) {
  const title = String(candidate.title || "").trim();
  const prompt = String(candidate.prompt || candidate.promptText || "").trim();
  const fp = candidate.spec_fingerprint || templateSpecFingerprint(candidate.spec || candidate);
  if (title) state.titles.add(title);
  if (prompt) state.prompts.add(prompt);
  if (fp) state.fingerprints.add(fp);
  if (candidate.structural_fingerprint) state.structures.add(String(candidate.structural_fingerprint));
  if (sha256) {
    state.hashesThisBatch.add(sha256);
    state.dup.byHash.add(sha256);
  }
  if (candidate.id) state.dup.byId.add(String(candidate.id));
}

export { sha256File, buildDuplicateIndex, checkDuplicate };
