/**
 * Diff & Approve — Phase A10 Tamper Detection (deterministic hash · no secrets).
 */

import { deepFreeze } from "./ai-diff-approve-a1-foundation.mjs";
import { serializeRecordPayload } from "./ai-diff-approve-a7-persistence-in-memory.mjs";

export { deepFreeze };

export const PHASE_A10_SCHEMA_VERSION = "diff_approve.a10.tamper.v1";

export const PHASE_A10_REASONS = Object.freeze({
  OK: "ok",
  PROPOSAL_HASH_MISMATCH: "proposal_hash_mismatch",
  DIFF_HASH_MISMATCH: "diff_hash_mismatch",
  APPROVAL_HASH_MISMATCH: "approval_snapshot_mismatch",
  PLAN_HASH_MISMATCH: "apply_plan_mismatch",
  SIMULATION_HASH_MISMATCH: "simulation_snapshot_mismatch",
  AUDIT_CHAIN_MISMATCH: "audit_chain_mismatch",
  VERSION_MISMATCH: "record_version_mismatch",
  INVALID_CONTEXT: "invalid_context",
});

/**
 * @param {string} text
 */
export function fnv1aHex(text) {
  let h = 0x811c9dc5;
  const s = String(text || "");
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/**
 * @param {unknown} value
 */
export function hashValue(value) {
  const ser = serializeRecordPayload(value);
  if (ser == null) return null;
  return `fnv1a32:${fnv1aHex(ser)}`;
}

/**
 * @param {string[]} hashes
 */
export function hashChain(hashes) {
  let acc = "genesis";
  for (const h of hashes) {
    acc = `fnv1a32:${fnv1aHex(`${acc}|${h}`)}`;
  }
  return acc;
}

/**
 * Verify bundle hashes against expected map.
 * @param {{
 *   proposal?: unknown,
 *   diff?: unknown,
 *   approval?: unknown,
 *   plan?: unknown,
 *   simulation?: unknown,
 *   expected?: Record<string, string>,
 *   audit_hashes?: string[],
 *   expected_chain?: string,
 *   record_version?: number,
 *   expected_version?: number,
 * }} input
 */
export function detectTampering(input = {}) {
  /** @type {string[]} */
  const mismatches = [];

  const expected = input.expected && typeof input.expected === "object"
    ? input.expected
    : {};

  const checks = [
    ["proposal", input.proposal, PHASE_A10_REASONS.PROPOSAL_HASH_MISMATCH],
    ["diff", input.diff, PHASE_A10_REASONS.DIFF_HASH_MISMATCH],
    ["approval", input.approval, PHASE_A10_REASONS.APPROVAL_HASH_MISMATCH],
    ["plan", input.plan, PHASE_A10_REASONS.PLAN_HASH_MISMATCH],
    [
      "simulation",
      input.simulation,
      PHASE_A10_REASONS.SIMULATION_HASH_MISMATCH,
    ],
  ];

  /** @type {Record<string, string|null>} */
  const actual = {};
  for (const [key, value, reason] of checks) {
    if (value == null) continue;
    const h = hashValue(value);
    actual[key] = h;
    if (expected[key] && h !== expected[key]) {
      mismatches.push(reason);
    }
  }

  if (Array.isArray(input.audit_hashes) && typeof input.expected_chain === "string") {
    const chain = hashChain(input.audit_hashes.filter((x) => typeof x === "string"));
    actual.audit_chain = chain;
    if (chain !== input.expected_chain) {
      mismatches.push(PHASE_A10_REASONS.AUDIT_CHAIN_MISMATCH);
    }
  }

  if (
    typeof input.record_version === "number" &&
    typeof input.expected_version === "number" &&
    input.record_version !== input.expected_version
  ) {
    mismatches.push(PHASE_A10_REASONS.VERSION_MISMATCH);
  }

  const ok = mismatches.length === 0;
  return {
    ok,
    reason: ok ? PHASE_A10_REASONS.OK : mismatches[0],
    mismatches: Object.freeze([...mismatches]),
    hashes: deepFreeze(actual),
  };
}
