/**
 * Diversity hot path V2 — existing family gates, fail-closed, no generic fill.
 */
import { checkSfxGenerationGates, createSfxDiversityState, rememberSfxCandidate } from "./sfx-diversity-gate.mjs";
import { checkWebGenerationGates, createWebDiversityState, rememberWebCandidate } from "./web-diversity-gate.mjs";
import { checkCodeGenerationGates, createCodeDiversityState, rememberCodeCandidate } from "./code-diversity-gate.mjs";
import { checkPresentationGenerationGates, createPresentationDiversityState, rememberPresentationCandidate } from "./presentation-diversity-gate.mjs";
import { checkTemplateGenerationGates, createTemplateDiversityState, rememberTemplateCandidate } from "./template-diversity-gate.mjs";
import { checkImageGenerationGates, createImageDiversityState, rememberImageCandidate } from "./image-diversity-gate.mjs";
import { checkIllustrationGenerationGates, createIllustrationDiversityState, rememberIllustrationCandidate } from "./illustration-diversity-gate.mjs";
import { checkBackgroundGenerationGates, createBackgroundDiversityState, rememberBackgroundCandidate } from "./background-diversity-gate.mjs";
import { checkIconGenerationGates, createIconDiversityState, rememberIconCandidate } from "./icon-diversity-gate.mjs";
import { checkTextGenerationGates, createTextDiversityState, rememberTextCandidate } from "./text-diversity-gate.mjs";
import { checkRegistrationGateV2, classifyDiversityBlockReasons } from "./registration-gate-v2.mjs";
import { webSpecFingerprint } from "./web-demand-genre-ssot.mjs";
import { codeSpecFingerprint } from "./code-demand-genre-ssot.mjs";
import { presentationSpecFingerprint } from "./presentation-demand-genre-ssot.mjs";
import { sfxSpecFingerprint } from "./sfx-demand-genre-ssot.mjs";
import { templateSpecFingerprint } from "./template-demand-genre-ssot.mjs";

function pack(check, create, remember, fingerprint) {
  return { check, create, remember, fingerprint };
}

const GATES = {
  sfx: pack(checkSfxGenerationGates, createSfxDiversityState, rememberSfxCandidate, sfxSpecFingerprint),
  web: pack(checkWebGenerationGates, createWebDiversityState, rememberWebCandidate, webSpecFingerprint),
  "web-material": pack(checkWebGenerationGates, createWebDiversityState, rememberWebCandidate, webSpecFingerprint),
  code: pack(checkCodeGenerationGates, createCodeDiversityState, rememberCodeCandidate, codeSpecFingerprint),
  "code-material": pack(checkCodeGenerationGates, createCodeDiversityState, rememberCodeCandidate, codeSpecFingerprint),
  presentation: pack(checkPresentationGenerationGates, createPresentationDiversityState, rememberPresentationCandidate, presentationSpecFingerprint),
  template: pack(checkTemplateGenerationGates, createTemplateDiversityState, rememberTemplateCandidate, templateSpecFingerprint),
  image: pack(checkImageGenerationGates, createImageDiversityState, rememberImageCandidate, null),
  illustration: pack(checkIllustrationGenerationGates, createIllustrationDiversityState, rememberIllustrationCandidate, null),
  background: pack(checkBackgroundGenerationGates, createBackgroundDiversityState, rememberBackgroundCandidate, null),
  icon: pack(checkIconGenerationGates, createIconDiversityState, rememberIconCandidate, null),
  document: pack(checkTextGenerationGates, createTextDiversityState, rememberTextCandidate, null),
  text: pack(checkTextGenerationGates, createTextDiversityState, rememberTextCandidate, null),
};

function emptyCounts() {
  return {
    EXACT_DUPLICATE_BLOCK_COUNT: 0,
    NEAR_DUPLICATE_BLOCK_COUNT: 0,
    STRUCTURAL_DUPLICATE_BLOCK_COUNT: 0,
    SEMANTIC_DUPLICATE_BLOCK_COUNT: 0,
  };
}

export function filterQuotaLinesThroughDiversityGate(assetType, lines = [], existingItems = []) {
  const gate = GATES[assetType];
  const blocks = [];
  const accepted = [];
  const counts = emptyCounts();
  if (!gate) {
    return { accepted: [], blocks: lines.map((l) => ({ line: l, reasons: ["unknown_family_gate"] })), counts };
  }
  const state = gate.create(existingItems);
  for (const line of lines) {
    const spec = line.spec || {};
    const title = spec.title || "";
    const prompt = spec.prompt || String(line.line || "").split("|").slice(1).join("|");
    const spec_fingerprint = spec.spec_fingerprint || (gate.fingerprint ? gate.fingerprint(spec) : undefined);
    const candidate = {
      title,
      prompt,
      spec,
      spec_fingerprint,
      generation_spec_honored: Boolean(spec.genre || spec.purpose || spec.family),
      quality_pass: true,
    };
    const diversity = gate.check(candidate, state);
    const registration = checkRegistrationGateV2(candidate, diversity);
    if (!diversity.ok || !registration.ok) {
      const reasons = [...new Set([...(diversity.reasons || []), ...(registration.reasons || [])])];
      const classified = classifyDiversityBlockReasons(reasons);
      counts.EXACT_DUPLICATE_BLOCK_COUNT += classified.EXACT_DUPLICATE ? 1 : 0;
      counts.NEAR_DUPLICATE_BLOCK_COUNT += classified.NEAR_DUPLICATE ? 1 : 0;
      counts.STRUCTURAL_DUPLICATE_BLOCK_COUNT += classified.STRUCTURAL_DUPLICATE ? 1 : 0;
      counts.SEMANTIC_DUPLICATE_BLOCK_COUNT += classified.SEMANTIC_DUPLICATE ? 1 : 0;
      blocks.push({ line, reasons, registration });
      continue;
    }
    gate.remember(state, candidate);
    accepted.push(line);
  }
  return { accepted, blocks, counts, unfilled: Math.max(0, lines.length - accepted.length) };
}

export { GATES };
