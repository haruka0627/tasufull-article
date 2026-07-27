/**
 * AI Execution Gate — Phase B4 report generator (secretary_deepseek port boundary).
 * Deterministic local formatter only — NO DeepSeek / OpenAI / Gemini / Claude / external HTTP.
 */

import { sanitizeGateMetadata } from "./ai-exec-gate-redaction.mjs";

export const PHASE_B4_REPORT_VERSION = "phase_b4.deterministic.v1";
export const PHASE_B4_RECORDED_API_COST_USD = 0;

/**
 * @param {{
 *   collected: Record<string, unknown>,
 *   executionId: string,
 *   now?: Date,
 * }} input
 */
export function generateOpsReport(input) {
  const now = input.now || new Date();
  const collected = input.collected && typeof input.collected === "object"
    ? input.collected
    : {};
  const pending =
    collected.pending && typeof collected.pending === "object"
      ? collected.pending
      : { total: 0, by_category: {}, items: [] };
  const total = Number(pending.total);
  const safeTotal = Number.isFinite(total) && total >= 0 ? total : 0;

  const summaryLines = [
    "Phase B4 deterministic ops report (provider disabled).",
    `Pending total: ${safeTotal}.`,
    safeTotal === 0
      ? "No pending items in fixture collector."
      : `Categories: ${Object.keys(pending.by_category || {}).join(", ") || "(none)"}.`,
    "External AI provider was not invoked.",
  ];

  const report = {
    report_version: PHASE_B4_REPORT_VERSION,
    generated_at: now.toISOString(),
    source: "deterministic_phase_b4",
    provider: "none",
    port: "secretary_deepseek",
    capability_key: "generate_ops_report",
    execution_id: input.executionId,
    summary: {
      pending_total: safeTotal,
      category_count: Object.keys(pending.by_category || {}).length,
      headline: summaryLines[0],
      lines: summaryLines,
    },
    warnings: [],
    limitations: [
      ...(Array.isArray(collected.limitations) ? collected.limitations : []),
      "Deterministic template only — DeepSeek API not called",
    ],
    collector_source: String(collected.source || "unknown"),
  };

  // Drop nested objects from any accidental passthrough keys via redaction helper on flat meta
  const flatMeta = sanitizeGateMetadata({
    report_version: report.report_version,
    source: report.source,
    provider: report.provider,
    pending_total: safeTotal,
  });

  return Object.freeze({
    report: Object.freeze(report),
    sanitized_summary: summaryLines.join(" ").slice(0, 8000),
    metrics: Object.freeze({
      ...flatMeta,
      report_version: PHASE_B4_REPORT_VERSION,
      pending_total: safeTotal,
      provider_called: false,
      recorded_api_cost: PHASE_B4_RECORDED_API_COST_USD,
    }),
    recorded_api_cost: PHASE_B4_RECORDED_API_COST_USD,
  });
}
