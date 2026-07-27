/**
 * AI Execution Gate — Phase B1 capability / action / service / port allowlists
 * Code constants are SSOT for Phase B (no DB seed · no dynamic add).
 */

/** @typedef {{ capability_key: string, capability_version: string, default_risk_level: string, default_execution_mode: string, staging_only: boolean }} GateCapabilityDefinition */

export const PHASE_B_CAPABILITY_VERSION = "1";

/** Fixed Phase B capability allowlist (exact match only). */
export const PHASE_B_CAPABILITY_KEYS = Object.freeze([
  "collect_daily_ops",
  "generate_ops_report",
]);

export const PHASE_B_CAPABILITY_KEY_SET = Object.freeze(
  new Set(PHASE_B_CAPABILITY_KEYS)
);

/** @type {ReadonlyArray<GateCapabilityDefinition>} */
export const PHASE_B_CAPABILITY_DEFINITIONS = Object.freeze([
  Object.freeze({
    capability_key: "collect_daily_ops",
    capability_version: PHASE_B_CAPABILITY_VERSION,
    default_risk_level: "LOW",
    default_execution_mode: "AUTO",
    staging_only: true,
  }),
  Object.freeze({
    capability_key: "generate_ops_report",
    capability_version: PHASE_B_CAPABILITY_VERSION,
    default_risk_level: "LOW",
    default_execution_mode: "AUTO",
    staging_only: true,
  }),
]);

export const PHASE_B_ACTION_TYPE =
  "ops_secretary.daily_pending.report_pipeline";

export const PHASE_B_TARGET_SERVICE = "ops_secretary";

export const PHASE_B_EXECUTOR_PORTS = Object.freeze([
  "ops_collector",
  "secretary_deepseek",
  "gate_audit_writer",
]);

export const PHASE_B_EXECUTOR_PORT_SET = Object.freeze(
  new Set(PHASE_B_EXECUTOR_PORTS)
);

/**
 * Exact-match allowlist check (no trim · no case fold).
 * @param {unknown} capabilityKey
 * @returns {boolean}
 */
export function isPhaseBCapabilityAllowed(capabilityKey) {
  if (typeof capabilityKey !== "string") return false;
  return PHASE_B_CAPABILITY_KEY_SET.has(capabilityKey);
}

/**
 * @param {unknown} actionType
 * @returns {boolean}
 */
export function isPhaseBActionAllowed(actionType) {
  return actionType === PHASE_B_ACTION_TYPE;
}

/**
 * @param {unknown} targetService
 * @returns {boolean}
 */
export function isPhaseBServiceAllowed(targetService) {
  return targetService === PHASE_B_TARGET_SERVICE;
}

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function isPhaseBPortAllowed(port) {
  if (typeof port !== "string") return false;
  return PHASE_B_EXECUTOR_PORT_SET.has(port);
}

/**
 * @param {unknown} capabilityKey
 * @returns {GateCapabilityDefinition|null}
 */
export function getPhaseBCapabilityDefinition(capabilityKey) {
  if (!isPhaseBCapabilityAllowed(capabilityKey)) return null;
  return (
    PHASE_B_CAPABILITY_DEFINITIONS.find(
      (row) => row.capability_key === capabilityKey
    ) || null
  );
}
