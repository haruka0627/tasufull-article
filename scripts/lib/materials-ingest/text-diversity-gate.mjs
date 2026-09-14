/**
 * Text exact-duplicate + spec-diversity gates.
 * Reuses existing-register sha256. Normalized placeholder/whitespace hash.
 * No large semantic similarity engine.
 */
import crypto from "node:crypto";
import { buildDuplicateIndex, checkDuplicate, sha256File } from "./existing-register/hash.mjs";
import { textSpecFingerprint } from "./text-demand-genre-ssot.mjs";
import { appendCanonicalGenreGateReasons } from "./canonical-genre-generation-contract-v1.mjs";

export const TEXT_NEAR_DUPLICATE_GATE_STATUS = "REVIEW_REQUIRED";
export const TEXT_NEAR_DUPLICATE_GATE_REASON =
  "NOT_AVAILABLE — repository has no semantic text similarity; normalized placeholder hash ≠ near-duplicate";

export function sha256Buffer(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

/** Collapse whitespace and placeholder values. Not a similarity engine. */
export function normalizeTextForHash(text) {
  return String(text || "")
    .normalize("NFKC")
    .replace(/\[[^[\]]{1,40}\]/g, "[]")
    .replace(/\s+/g, "")
    .toLowerCase();
}

export function normalizedTextHash(text) {
  const n = normalizeTextForHash(text);
  if (!n) return "";
  return sha256Buffer(Buffer.from(n));
}

export function createTextDiversityState(existingItems = []) {
  const dup = buildDuplicateIndex(existingItems);
  const titles = new Set();
  const fingerprints = new Set();
  const prompts = new Set();
  const normalized = new Set();
  const openings = new Set();
  for (const item of existingItems) {
    if (item?.title) titles.add(String(item.title).trim());
    const fp = item?.spec_fingerprint || textSpecFingerprint(item);
    if (fp && fp !== "|||||") fingerprints.add(fp);
    if (item?.prompt) prompts.add(String(item.prompt).trim());
    if (item?.normalized_text_hash) normalized.add(String(item.normalized_text_hash));
    if (item?.opening_key) openings.add(String(item.opening_key));
  }
  return { dup, titles, fingerprints, prompts, normalized, openings, hashesThisBatch: new Set() };
}

export function checkTextGenerationGates(candidate, state) {
  const reasons = [...appendCanonicalGenreGateReasons(candidate, "document")];
  const title = String(candidate.title || "").trim();
  const prompt = String(candidate.prompt || candidate.promptText || "").trim();
  const fp = candidate.spec_fingerprint || textSpecFingerprint(candidate.spec || candidate);
  if (!fp || !String(fp).replace(/\|/g, "")) reasons.push("missing_spec_fingerprint");
  if (title && state.titles.has(title)) reasons.push("same_title_repetition");
  if (prompt && state.prompts.has(prompt)) reasons.push("repeated_prompt");
  if (fp && String(fp).replace(/\|/g, "") && state.fingerprints.has(fp)) reasons.push("same_generator_spec");
  const hash = candidate.sha256 || candidate.file_hash;
  if (hash && (state.dup.byHash.has(hash) || state.hashesThisBatch.has(hash))) reasons.push("exact_file_hash");
  const norm = candidate.normalized_text_hash;
  if (norm && state.normalized.has(norm)) reasons.push("normalized_text_hash");
  const fileDup = checkDuplicate(candidate, state.dup);
  if (fileDup.duplicate) reasons.push(fileDup.reason);
  return {
    ok: reasons.length === 0,
    reasons,
    near_text: { status: TEXT_NEAR_DUPLICATE_GATE_STATUS, reason: TEXT_NEAR_DUPLICATE_GATE_REASON },
  };
}

export function rememberTextCandidate(state, candidate, sha256, normalizedHash) {
  const title = String(candidate.title || "").trim();
  const prompt = String(candidate.prompt || candidate.promptText || "").trim();
  const fp = candidate.spec_fingerprint || textSpecFingerprint(candidate.spec || candidate);
  if (title) state.titles.add(title);
  if (prompt) state.prompts.add(prompt);
  if (fp) state.fingerprints.add(fp);
  if (sha256) {
    state.hashesThisBatch.add(sha256);
    state.dup.byHash.add(sha256);
  }
  if (normalizedHash) state.normalized.add(normalizedHash);
  if (candidate.id) state.dup.byId.add(String(candidate.id));
}

export { sha256File, buildDuplicateIndex, checkDuplicate };
