/**
 * AI Execution Gate — Phase B1 hard cap (constant / env · no SAFE-06/07)
 *
 * Evaluation unit: JST-day cumulative (caller supplies daySpentSoFar) +
 * per-execution estimatedApiCost.
 * Block when (daySpentSoFar + estimatedApiCost) > hardCap.
 * Equal to cap is allowed.
 */

import {
  gateAllowedResult,
  gateBlockedResult,
} from "./ai-exec-gate-types.mjs";

/** Env key — Staging / Pages secrets only · never expose to frontend. */
export const PHASE_B_HARD_CAP_ENV_KEY = "AI_EXEC_GATE_PHASE_B_DAILY_HARD_CAP";

/**
 * Conservative default USD/JST-day when env unset.
 * Rationale: single DeepSeek summary ≪ $0.01; $0.10 ≈ 10×+ headroom without
 * inventing product pricing (docs specify no numeric default).
 */
export const PHASE_B_DEFAULT_HARD_CAP_USD = 0.1;

export const PHASE_B_HARD_CAP_CURRENCY = "USD";

/**
 * @param {unknown} raw
 * @returns {{ ok: true, value: number } | { ok: false }}
 */
export function parseHardCapUsd(raw) {
  if (raw === undefined || raw === null || raw === "") {
    return { ok: true, value: PHASE_B_DEFAULT_HARD_CAP_USD };
  }
  if (typeof raw === "number") {
    if (!Number.isFinite(raw) || raw < 0) return { ok: false };
    return { ok: true, value: raw };
  }
  if (typeof raw !== "string") return { ok: false };
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: PHASE_B_DEFAULT_HARD_CAP_USD };
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return { ok: false };
  return { ok: true, value: n };
}

/**
 * Resolve hard cap from env bag (Pages context.env or test fixture).
 * Does not log the value.
 * @param {Record<string, unknown>|null|undefined} env
 */
export function resolvePhaseBHardCapUsd(env) {
  const raw = env?.[PHASE_B_HARD_CAP_ENV_KEY];
  return parseHardCapUsd(raw);
}

/**
 * @param {unknown} n
 * @returns {boolean}
 */
function isNonNegativeFinite(n) {
  return typeof n === "number" && Number.isFinite(n) && n >= 0;
}

/**
 * @param {{
 *   daySpentSoFar: unknown,
 *   estimatedApiCost: unknown,
 *   env?: Record<string, unknown>|null,
 *   hardCapUsd?: unknown,
 * }} input
 */
export function evaluatePhaseBHardCap(input) {
  const { daySpentSoFar, estimatedApiCost, env } = input || {};
  const resolved =
    input?.hardCapUsd !== undefined
      ? parseHardCapUsd(input.hardCapUsd)
      : resolvePhaseBHardCapUsd(env);

  if (!resolved.ok) {
    return gateBlockedResult("invalid_configuration", {
      field: "hard_cap",
    });
  }

  if (!isNonNegativeFinite(daySpentSoFar)) {
    return gateBlockedResult("invalid_configuration", {
      field: "daySpentSoFar",
    });
  }
  if (!isNonNegativeFinite(estimatedApiCost)) {
    return gateBlockedResult("invalid_configuration", {
      field: "estimatedApiCost",
    });
  }

  const projected = daySpentSoFar + estimatedApiCost;
  if (projected > resolved.value) {
    return gateBlockedResult("budget_hard_cap", {
      currency: PHASE_B_HARD_CAP_CURRENCY,
      // Do not echo raw cap to callers that might forward to clients.
      exceeded: true,
    });
  }

  return gateAllowedResult({
    currency: PHASE_B_HARD_CAP_CURRENCY,
    withinCap: true,
  });
}
