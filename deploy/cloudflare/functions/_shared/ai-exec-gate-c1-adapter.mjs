/**
 * AI Execution Gate — Phase C1 deterministic ops report adapter.
 * No network · no SDK · no API keys · provider_called=false · recorded_api_cost=0.
 */

import {
  PHASE_C1_COUNT_KEYS,
  PHASE_C1_ERROR_CODES,
  PHASE_C1_OUTPUT_TYPE,
  buildOpsReportProviderRequest,
  validateOpsReportProviderRequest,
  validateOpsReportValidatedResult,
} from "./ai-exec-gate-c1-contracts.mjs";

/**
 * @typedef {{
 *   completed_at: string,
 * }} OpsReportAdapterContext
 */

/**
 * Read available integer count (null/unavailable → treat as absent for ranking).
 * @param {Record<string, unknown>} counts
 * @param {Record<string, unknown>} availability
 * @param {string} key
 */
function availableCount(counts, availability, key) {
  if (availability[key] !== "available") return null;
  const v = counts[key];
  return typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : null;
}

/**
 * Deterministic summary + priorities from sanitized provider-neutral request.
 *
 * @param {{
 *   request: Record<string, unknown>,
 *   context: OpsReportAdapterContext,
 * }} args
 * @returns {{
 *   ok: true,
 *   result: Record<string, unknown>,
 * } | {
 *   ok: false,
 *   error: string,
 * }}
 */
export function generateDeterministicOpsReport(args) {
  const reqCheck = validateOpsReportProviderRequest(args.request);
  if (!reqCheck.ok) return reqCheck;

  const context = args.context;
  if (
    !context ||
    typeof context !== "object" ||
    typeof context.completed_at !== "string" ||
    !context.completed_at
  ) {
    return { ok: false, error: PHASE_C1_ERROR_CODES.INVALID_ADAPTER_OUTPUT };
  }

  const request = /** @type {Record<string, unknown>} */ (reqCheck.value);
  const snapshot = /** @type {Record<string, unknown>} */ (request.snapshot);
  const counts = /** @type {Record<string, unknown>} */ (snapshot.counts || {});
  const availability = /** @type {Record<string, unknown>} */ (
    snapshot.count_availability || {}
  );
  const warningCodes = Array.isArray(snapshot.system_warning_codes)
    ? snapshot.system_warning_codes
    : [];

  const blocked = availableCount(counts, availability, "blocked_total");
  const failed = availableCount(counts, availability, "failed_total");
  const pending = availableCount(counts, availability, "pending_total");
  const warning = availableCount(counts, availability, "warning_total");
  const support = availableCount(counts, availability, "support_pending_total");
  const moderation = availableCount(
    counts,
    availability,
    "moderation_pending_total"
  );
  const anpi = availableCount(counts, availability, "anpi_pending_total");
  const execFailed = availableCount(
    counts,
    availability,
    "execution_failed_total"
  );
  const execBlocked = availableCount(
    counts,
    availability,
    "execution_blocked_total"
  );

  const known = [
    blocked,
    failed,
    pending,
    warning,
    support,
    moderation,
    anpi,
    execFailed,
    execBlocked,
  ].filter((n) => n != null);
  const sumKnown = known.reduce((a, b) => a + /** @type {number} */ (b), 0);

  /** @type {string[]} */
  const priorities = [];
  /** @type {string[]} */
  const priority_levels = [];

  const pushPriority = (level, text) => {
    if (priorities.length >= 8) return;
    priorities.push(text);
    priority_levels.push(level);
  };

  if ((blocked != null && blocked > 0) || (execBlocked != null && execBlocked > 0)) {
    pushPriority(
      "critical",
      "blocked requests — 遮断・ブロック件を確認してください"
    );
  }
  if ((failed != null && failed > 0) || (execFailed != null && execFailed > 0)) {
    pushPriority("high", "failed executions — 失敗件を確認してください");
  }
  if (pending != null && pending > 0) {
    pushPriority("medium", "pending items — 未処理キューを確認してください");
  }
  if (
    (warning != null && warning > 0) ||
    warningCodes.length > 0
  ) {
    pushPriority("medium", "system warnings — システム警告を確認してください");
  }
  if (support != null && support > 0) {
    pushPriority("low", "support queue — サポート未処理を確認してください");
  }
  if (moderation != null && moderation > 0) {
    pushPriority("low", "moderation queue — モデレーション未処理を確認してください");
  }
  if (anpi != null && anpi > 0) {
    pushPriority("low", "anpi queue — 安否運用件数を確認してください");
  }

  if (priorities.length === 0) {
    pushPriority("none", "no urgent operational items");
  }

  const blockedPart =
    blocked != null ? blocked : execBlocked != null ? execBlocked : 0;
  const failedPart =
    failed != null ? failed : execFailed != null ? execFailed : 0;

  let summary;
  if (sumKnown === 0 && warningCodes.length === 0) {
    summary =
      "本日の未処理項目は合計0件です。緊急の運営対応項目はありません。";
  } else {
    summary = `本日の未処理項目は合計${sumKnown}件です。遮断${blockedPart}件、失敗${failedPart}件を確認してください。`;
  }
  if (warningCodes.length > 0) {
    summary += ` システム警告コード数:${warningCodes.length}。`;
  }
  const unavailableKeys = Object.entries(availability)
    .filter(([, st]) => st === "unavailable")
    .map(([k]) => k);
  if (unavailableKeys.length > 0) {
    summary += ` 取得不可ソース数:${unavailableKeys.length}。`;
  }

  /** @type {Record<string, number>} */
  const warning_counts = {};
  for (const key of PHASE_C1_COUNT_KEYS) {
    const n = availableCount(counts, availability, key);
    if (n != null && n > 0) warning_counts[key] = n;
  }
  if (warningCodes.length > 0) {
    warning_counts.system_warning_codes = warningCodes.length;
  }

  const raw = {
    summary,
    priorities: Object.freeze([...priorities]),
    priority_levels: Object.freeze([...priority_levels]),
    warning_counts: Object.freeze({ ...warning_counts }),
    provider_called: false,
    recorded_api_cost: 0,
    output_type: PHASE_C1_OUTPUT_TYPE,
    completed_at: context.completed_at,
    error_code: null,
  };

  const validated = validateOpsReportValidatedResult(raw);
  if (!validated.ok) {
    return { ok: false, error: PHASE_C1_ERROR_CODES.OUTPUT_VALIDATION_FAILED };
  }
  return { ok: true, result: Object.freeze({ ...validated.value }) };
}

/**
 * Snapshot → provider-neutral request → deterministic adapter → validated result.
 *
 * @param {{
 *   snapshot: Record<string, unknown>,
 *   completed_at: string,
 * }} args
 */
export function runDeterministicOpsReportPipeline(args) {
  const built = buildOpsReportProviderRequest(args.snapshot);
  if (!built.ok) return built;
  return generateDeterministicOpsReport({
    request: /** @type {Record<string, unknown>} */ (built.value),
    context: { completed_at: args.completed_at },
  });
}
