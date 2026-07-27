/**
 * AI Execution Gate — Phase B1 audit metadata redaction (pure)
 * Separate from SAFE-06 sanitizeUsageMetadata (do not merge).
 */

export const GATE_METADATA_FORBIDDEN_KEYS = Object.freeze([
  "prompt",
  "response",
  "messages",
  "systemPrompt",
  "system_prompt",
  "content",
  "body",
  "text",
  "token",
  "tokens",
  "apiKey",
  "api_key",
  "authorization",
  "password",
  "secret",
  "raw",
  "emailBody",
  "email_body",
  "hardCap",
  "hard_cap",
  "remainingBudget",
  "remaining_budget",
  "AI_EXEC_GATE_PHASE_B_DAILY_HARD_CAP",
]);

const FORBIDDEN_SET = new Set(
  GATE_METADATA_FORBIDDEN_KEYS.map((k) => k.toLowerCase())
);

/**
 * @param {unknown} key
 * @returns {boolean}
 */
export function isGateMetadataForbiddenKey(key) {
  if (typeof key !== "string") return true;
  return FORBIDDEN_SET.has(key.toLowerCase());
}

/**
 * Drop forbidden keys; non-objects → {}.
 * Never logs values.
 * @param {unknown} metadata
 * @returns {Record<string, unknown>}
 */
export function sanitizeGateMetadata(metadata) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (isGateMetadataForbiddenKey(key)) continue;
    if (value !== null && typeof value === "object") continue;
    out[key] = value;
  }
  return out;
}
