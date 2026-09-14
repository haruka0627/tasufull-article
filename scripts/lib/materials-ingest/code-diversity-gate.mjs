/**
 * Code exact-duplicate + spec-diversity gates.
 * Reuses existing-register sha256. Optional whitespace/comment stripped hash.
 * No large code-similarity engine.
 */
import crypto from "node:crypto";
import { buildDuplicateIndex, checkDuplicate, sha256File } from "./existing-register/hash.mjs";
import { codeSpecFingerprint } from "./code-demand-genre-ssot.mjs";
import { appendCanonicalGenreGateReasons } from "./canonical-genre-generation-contract-v1.mjs";

export const CODE_NEAR_DUPLICATE_GATE_STATUS = "REVIEW_REQUIRED";
export const CODE_NEAR_DUPLICATE_GATE_REASON =
  "AST similarity is HUMAN_REVIEW; spec fingerprint + title/prompt are fail-closed. Hash-only uniqueness is forbidden.";

export function sha256Buffer(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

/** Strip // comments, # comments, block comments, and whitespace. Not a similarity engine. */
export function normalizeCodeForHash(text) {
  return String(text || "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1")
    .replace(/^\s*#.*$/gm, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

export function normalizedCodeHash(text) {
  const n = normalizeCodeForHash(text);
  if (!n) return "";
  return sha256Buffer(Buffer.from(n));
}

export function createCodeDiversityState(existingItems = []) {
  const dup = buildDuplicateIndex(existingItems);
  const titles = new Set();
  const fingerprints = new Set();
  const prompts = new Set();
  const normalized = new Set();
  for (const item of existingItems) {
    if (item?.title) titles.add(String(item.title).trim());
    const fp = item?.spec_fingerprint || codeSpecFingerprint(item);
    if (fp && fp !== "|||||") fingerprints.add(fp);
    if (item?.prompt) prompts.add(String(item.prompt).trim());
    if (item?.normalized_code_hash) normalized.add(String(item.normalized_code_hash));
  }
  return { dup, titles, fingerprints, prompts, normalized, hashesThisBatch: new Set() };
}

export function checkCodeGenerationGates(candidate, state) {
  const reasons = [...appendCanonicalGenreGateReasons(candidate, "code")];
  const title = String(candidate.title || "").trim();
  const prompt = String(candidate.prompt || candidate.promptText || "").trim();
  const fp = candidate.spec_fingerprint || codeSpecFingerprint(candidate.spec || candidate);
  if (!fp || !String(fp).replace(/\|/g, "")) reasons.push("missing_spec_fingerprint");
  if (title && state.titles.has(title)) reasons.push("same_title_repetition");
  if (prompt && state.prompts.has(prompt)) reasons.push("repeated_prompt");
  if (fp && String(fp).replace(/\|/g, "") && state.fingerprints.has(fp)) reasons.push("same_generator_spec");
  const hash = candidate.sha256 || candidate.file_hash;
  if (hash && (state.dup.byHash.has(hash) || state.hashesThisBatch.has(hash))) reasons.push("exact_file_hash");
  const norm = candidate.normalized_code_hash;
  if (norm && state.normalized.has(norm)) reasons.push("normalized_code_hash");
  const fileDup = checkDuplicate(candidate, state.dup);
  if (fileDup.duplicate) reasons.push(fileDup.reason);
  return {
    ok: reasons.length === 0,
    reasons,
    near_code: { status: CODE_NEAR_DUPLICATE_GATE_STATUS, reason: CODE_NEAR_DUPLICATE_GATE_REASON },
  };
}

export function rememberCodeCandidate(state, candidate, sha256, normalizedHash) {
  const title = String(candidate.title || "").trim();
  const prompt = String(candidate.prompt || candidate.promptText || "").trim();
  const fp = candidate.spec_fingerprint || codeSpecFingerprint(candidate.spec || candidate);
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
