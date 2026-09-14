/**
 * Registration Gate V2 — NEW PRODUCT VALUE, not NEW FILE.
 * Fail-closed: slug/hash uniqueness alone is not enough.
 */
export const REGISTRATION_GATE_V2_VERSION = "materials-registration-gate-v2";

export function checkRegistrationGateV2(candidate = {}, diversity = {}) {
  const reasons = [];
  const title = String(candidate.title || "").trim();
  const spec = candidate.spec || {};
  const diversityReasons = Array.isArray(diversity.reasons) ? diversity.reasons : [];

  const titleUnique = !diversityReasons.includes("same_title_repetition");
  const titleJustified = Boolean(candidate.title_justified);
  const TITLE_UNIQUE_OR_JUSTIFIED = Boolean(title) && (titleUnique || titleJustified);
  if (!TITLE_UNIQUE_OR_JUSTIFIED) reasons.push("TITLE_UNIQUE_OR_JUSTIFIED");

  const STRUCTURAL_DIVERSITY_PASS =
    !diversityReasons.includes("same_generator_spec") &&
    !diversityReasons.includes("same_structural_fingerprint") &&
    !diversityReasons.includes("missing_spec_fingerprint");
  if (!STRUCTURAL_DIVERSITY_PASS) reasons.push("STRUCTURAL_DIVERSITY_PASS");

  const SEMANTIC_DIVERSITY_PASS =
    !diversityReasons.includes("repeated_prompt") &&
    !diversityReasons.includes("same_title_repetition");
  if (!SEMANTIC_DIVERSITY_PASS) reasons.push("SEMANTIC_DIVERSITY_PASS");

  const GENERATION_SPEC_HONORED = Boolean(
    candidate.generation_spec_honored === true ||
      (spec.genre && (spec.style || spec.layout_type || spec.use_case)),
  );
  if (!GENERATION_SPEC_HONORED) reasons.push("GENERATION_SPEC_HONORED");

  const QUALITY_PASS = candidate.quality_pass !== false && diversity.ok !== false;
  if (!QUALITY_PASS) reasons.push("QUALITY_PASS");

  if (diversityReasons.includes("exact_file_hash")) reasons.push("EXACT_DUPLICATE");

  return {
    ok: reasons.length === 0,
    reasons: [...new Set(reasons)],
    TITLE_UNIQUE_OR_JUSTIFIED,
    STRUCTURAL_DIVERSITY_PASS,
    SEMANTIC_DIVERSITY_PASS,
    GENERATION_SPEC_HONORED,
    QUALITY_PASS,
  };
}

export function classifyDiversityBlockReasons(reasons = []) {
  const exact = reasons.filter((r) => r === "exact_file_hash" || r.includes("duplicate_id") || r.includes("duplicate_filename"));
  const near = reasons.filter((r) => r.startsWith("near_") || r === "near_unjudgeable");
  const structural = reasons.filter((r) => r === "same_generator_spec" || r === "same_structural_fingerprint" || r === "missing_spec_fingerprint");
  const semantic = reasons.filter((r) => r === "same_title_repetition" || r === "repeated_prompt");
  return {
    EXACT_DUPLICATE: exact.length,
    NEAR_DUPLICATE: near.length,
    STRUCTURAL_DUPLICATE: structural.length,
    SEMANTIC_DUPLICATE: semantic.length,
  };
}
