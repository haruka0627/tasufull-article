/** Machine-readable license gate for the Materials Lane B audio generators. */

export const AUDIO_LICENSE_SSOT_VERSION = "materials-audio-license-ssot-v1";

export const AUDIO_GENERATOR_LICENSES = Object.freeze({
  "SFX-AutoGenerator": Object.freeze({
    generator_id: "SFX-AutoGenerator",
    model: "none-procedural-dsp",
    version: "1.0.0",
    provider: "local-synthesis",
    license: "TASFUL_PROCEDURAL_OUTPUT",
    evidence_source: Object.freeze([
      "SFX-AutoGenerator/package.json",
      "SFX-AutoGenerator/README.md",
      "SFX-AutoGenerator/lib/presets.js",
      "docs/MATERIALS_DAILY_AUTO_INVENTORY_GROWTH.md",
    ]),
    evidence_checked_at: "2026-08-29",
    commercial_use: "ALLOWED_BY_EXISTING_MATERIALS_POLICY",
    generated_output_use: "ALLOWED",
    standalone_distribution: "ALLOWED_BY_EXISTING_MATERIALS_POLICY",
    materials_distribution: "ALLOWED",
    attribution: "NOT_REQUIRED",
    revenue_condition: "NONE",
    company_condition: "NONE",
    external_samples: false,
    external_dependencies: false,
    paid_api: false,
    status: "ALLOWED",
  }),
  "BGM-AutoGenerator": Object.freeze({
    generator_id: "BGM-AutoGenerator",
    model: "ACE-Step 1.5",
    version: "1.5.0@6d467e4b5081ccb0abf1ec1bf4fdf9051a2d34b0",
    provider: "ACE-Step local/self-hosted",
    license: "MIT code + MIT weights; output redistribution condition unresolved",
    evidence_source: Object.freeze([
      "scripts/lib/materials-ingest/bgm-license/ssot.mjs",
      "docs/MATERIALS_EXISTING_REGISTER_TAXONOMY_BGM_LICENSE.md",
      "reports/materials-existing-register-taxonomy-bgml-license-v1.md",
    ]),
    evidence_checked_at: "2026-08-13",
    commercial_use: "PERMITTED_PER_EXISTING_EVIDENCE",
    generated_output_use: "COMMERCIAL_USE_CLAIMED_PERMITTED",
    standalone_distribution: "NOT_EXPLICITLY_SPECIFIED_AS_STOCK_LIBRARY",
    materials_distribution: "CONDITIONAL_UNCLEAR_EXPLICITLY",
    attribution: "NOT_RESOLVED_FOR_MATERIALS_DISTRIBUTION",
    revenue_condition: "UNKNOWN",
    company_condition: "UNKNOWN",
    external_samples: false,
    external_dependencies: true,
    paid_api: false,
    status: "BLOCKED_LICENSE",
  }),
});

export function audioLicenseFor(generatorId) {
  return AUDIO_GENERATOR_LICENSES[String(generatorId || "")] || null;
}

export function canPublishAudioFrom(generatorId) {
  return audioLicenseFor(generatorId)?.status === "ALLOWED";
}
