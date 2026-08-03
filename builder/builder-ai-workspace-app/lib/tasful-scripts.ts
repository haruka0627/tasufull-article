/**
 * Existing TASFUL Builder AI modules (Intent / Estimate / Cost / Document / Gateway).
 * Loaded before React UI — connection only. V0 components unchanged.
 */
export const TASFUL_BUILDER_AI_SCRIPTS = [
  '/ai-model-gateway.js',
  '/builder/builder-ai/schema/estimate-draft-schema.js',
  '/builder/builder-ai/parser/estimate-parser.js',
  '/builder/builder-ai/estimate/draft-generator.js',
  '/builder/builder-ai/preview/estimate-preview.js',
  '/builder/builder-ai/cost/cost-money.js',
  '/builder/builder-ai/cost/cost-schema.js',
  '/builder/builder-ai/cost/labor-calculator.js',
  '/builder/builder-ai/cost/margin-calculator.js',
  '/builder/builder-ai/cost/tax-calculator.js',
  '/builder/builder-ai/cost/cost-calculator.js',
  '/builder/builder-ai/cost/cost-parser.js',
  '/builder/builder-ai/cost/cost-validator.js',
  '/builder/builder-ai/preview/estimate-cost-preview.js',
  '/builder/builder-ai/preview/estimate-cost-panel.js',
  '/builder/builder-ai/document/estimate-document-schema.js',
  '/builder/builder-ai/document/estimate-document-builder.js',
  '/builder/builder-ai/preview/estimate-document-preview.js',
  '/builder/builder-ai/preview/estimate-document-panel.js',
  '/builder/builder-ai/adapters/estimate-foundation-adapter.js',
  '/builder/builder-ai/launcher/launch-payload.js',
  '/builder/builder-ai/intent/intent-schema.js',
  '/builder/builder-ai/intent/intent-normalizer.js',
  '/builder/builder-ai/intent/intent-classifier.js',
  '/builder/builder-ai/intent/intent-validator.js',
  '/builder/builder-ai/intent/intent-result.js',
  '/builder/builder-ai/intent/intent-router.js',
] as const
