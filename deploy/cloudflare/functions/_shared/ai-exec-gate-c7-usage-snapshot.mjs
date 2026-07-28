/**
 * AI Execution Gate — Phase C7 authoritative usage snapshot read (SAFE-06/07 SSOT).
 *
 * READ-ONLY · daily JST actor/env isolation via Gate budget_day_key.
 * No provider execute · no SAFE write · no migration · no process.env hard-cap · no SDK.
 * Primary wires repository; this module accepts an injected rpcAggregate only.
 */

import {
  PHASE_C3_HARD_CAP_CURRENCY,
  validateBudgetNumber,
} from "./ai-exec-gate-c3-budget.mjs";
import { deepFreeze } from "./ai-exec-gate-c5-execution-boundary.mjs";
import { GATE_ENVIRONMENTS } from "./ai-exec-gate-types.mjs";

export { deepFreeze };

export const PHASE_C7_SCHEMA_VERSION = "phase_c7.usage_snapshot.v1";

/** Must match C3 `PHASE_C3_HARD_CAP_CURRENCY`. */
export const PHASE_C7_CURRENCY = PHASE_C3_HARD_CAP_CURRENCY;

/** SAFE-07 default + Gate budget_day_key JST. */
export const PHASE_C7_TIMEZONE = "Asia/Tokyo";

/** SAFE-07 aggregate RPC as cost SSOT (read path only). */
export const PHASE_C7_SOURCE = "safe07.ai_cost_ledger_aggregate";

/** @typedef {(
 *   | "available"
 *   | "unavailable"
 *   | "not_found"
 *   | "ambiguous"
 *   | "read_failure"
 *   | "invalid_source"
 *   | "invalid_scope"
 *   | "invalid_period"
 *   | "currency_mismatch"
 * )} PhaseC7Availability */

export const PHASE_C7_AVAILABILITIES = Object.freeze([
  "available",
  "unavailable",
  "not_found",
  "ambiguous",
  "read_failure",
  "invalid_source",
  "invalid_scope",
  "invalid_period",
  "currency_mismatch",
]);

export const PHASE_C7_AVAILABILITY_SET = Object.freeze(
  new Set(PHASE_C7_AVAILABILITIES)
);

/** Fail-closed reason vocabulary (string tokens). */
export const PHASE_C7_REASONS = Object.freeze({
  USAGE_SNAPSHOT_UNAVAILABLE: "usage_snapshot_unavailable",
  USAGE_READ_FAILED: "usage_read_failed",
  USAGE_AMBIGUOUS: "usage_ambiguous",
  INVALID_USAGE_SNAPSHOT: "invalid_usage_snapshot",
  MISSING_SCOPE: "missing_scope",
  INVALID_PERIOD: "invalid_period",
  CURRENCY_MISMATCH: "currency_mismatch",
});

const SNAPSHOT_ALLOWLIST = Object.freeze([
  "schema_version",
  "source",
  "availability",
  "actor_id",
  "environment",
  "period_start",
  "period_end",
  "period_key",
  "timezone",
  "currency",
  "recorded_usage_usd",
  "reserved_usage_usd",
  "effective_usage_usd",
  "snapshot_at",
  "provider_called",
  "recorded_api_cost",
]);

const SNAPSHOT_ALLOWLIST_SET = Object.freeze(new Set(SNAPSHOT_ALLOWLIST));

const GATE_ENV_SET = Object.freeze(
  new Set([
    GATE_ENVIRONMENTS.STAGING,
    GATE_ENVIRONMENTS.PRODUCTION,
    GATE_ENVIRONMENTS.UNKNOWN,
  ])
);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DAY_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isUuidActor(value) {
  return typeof value === "string" && UUID_RE.test(value);
}

/**
 * @param {string} availability
 * @param {string} reason
 * @param {Record<string, unknown>} [extra]
 */
function failClosed(availability, reason, extra = {}) {
  return deepFreeze({
    ok: false,
    availability,
    reason,
    provider_called: false,
    recorded_api_cost: 0,
    ...extra,
  });
}

/**
 * Authoritative daily JST period from Gate budget_day_key (YYYY-MM-DD).
 * period_start inclusive / period_end exclusive · Asia/Tokyo · no DST.
 *
 * @param {unknown} budgetDayKey
 * @returns {{
 *   ok: true,
 *   period_start: string,
 *   period_end: string,
 *   period_key: string,
 *   timezone: string,
 * } | {
 *   ok: false,
 *   availability: "invalid_period",
 *   reason: string,
 *   provider_called: false,
 *   recorded_api_cost: 0,
 * }}
 */
export function buildJstDayPeriod(budgetDayKey) {
  if (typeof budgetDayKey !== "string" || !DAY_KEY_RE.test(budgetDayKey)) {
    return failClosed("invalid_period", PHASE_C7_REASONS.INVALID_PERIOD);
  }
  const m = DAY_KEY_RE.exec(budgetDayKey);
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const probe = new Date(Date.UTC(y, mo - 1, d));
  if (
    probe.getUTCFullYear() !== y ||
    probe.getUTCMonth() !== mo - 1 ||
    probe.getUTCDate() !== d
  ) {
    return failClosed("invalid_period", PHASE_C7_REASONS.INVALID_PERIOD);
  }

  const next = new Date(Date.UTC(y, mo - 1, d + 1));
  const ny = next.getUTCFullYear();
  const nm = String(next.getUTCMonth() + 1).padStart(2, "0");
  const nd = String(next.getUTCDate()).padStart(2, "0");
  const nextKey = `${ny}-${nm}-${nd}`;

  return deepFreeze({
    ok: true,
    period_start: `${budgetDayKey}T00:00:00+09:00`,
    period_end: `${nextKey}T00:00:00+09:00`,
    period_key: budgetDayKey,
    timezone: PHASE_C7_TIMEZONE,
  });
}

/**
 * @param {{
 *   actor_id: unknown,
 *   environment: unknown,
 *   budget_day_key: unknown,
 * }} input
 */
function validateIsolationScope(input) {
  const actorRaw = input.actor_id;
  if (typeof actorRaw !== "string" || actorRaw.length === 0) {
    return failClosed("invalid_scope", PHASE_C7_REASONS.MISSING_SCOPE);
  }
  if (!isUuidActor(actorRaw)) {
    // Do not fall back to summing all users — fail closed.
    return failClosed("invalid_scope", PHASE_C7_REASONS.MISSING_SCOPE);
  }

  const env = input.environment;
  if (typeof env !== "string" || !GATE_ENV_SET.has(env)) {
    return failClosed("invalid_scope", PHASE_C7_REASONS.MISSING_SCOPE);
  }

  const period = buildJstDayPeriod(input.budget_day_key);
  if (!period.ok) return period;

  return deepFreeze({
    ok: true,
    actor_id: actorRaw,
    environment: env,
    budget_day_key: period.period_key,
    period_start: period.period_start,
    period_end: period.period_end,
    period_key: period.period_key,
    timezone: period.timezone,
  });
}

/**
 * Fail-closed allowlist validation for C7 usage snapshots.
 * @param {unknown} snapshot
 * @returns {{
 *   ok: true,
 *   snapshot: Readonly<Record<string, unknown>>,
 * } | {
 *   ok: false,
 *   availability: string,
 *   reason: string,
 *   provider_called: false,
 *   recorded_api_cost: 0,
 * }}
 */
export function validateUsageSnapshot(snapshot) {
  if (!isPlainObject(snapshot)) {
    return failClosed(
      "invalid_source",
      PHASE_C7_REASONS.INVALID_USAGE_SNAPSHOT
    );
  }
  const o = /** @type {Record<string, unknown>} */ (snapshot);
  const keys = Object.keys(o);
  if (keys.length !== SNAPSHOT_ALLOWLIST.length) {
    return failClosed(
      "invalid_source",
      PHASE_C7_REASONS.INVALID_USAGE_SNAPSHOT
    );
  }
  for (const key of keys) {
    if (!SNAPSHOT_ALLOWLIST_SET.has(key)) {
      return failClosed(
        "invalid_source",
        PHASE_C7_REASONS.INVALID_USAGE_SNAPSHOT
      );
    }
  }

  if (o.schema_version !== PHASE_C7_SCHEMA_VERSION) {
    return failClosed(
      "invalid_source",
      PHASE_C7_REASONS.INVALID_USAGE_SNAPSHOT
    );
  }
  if (o.source !== PHASE_C7_SOURCE) {
    return failClosed(
      "invalid_source",
      PHASE_C7_REASONS.INVALID_USAGE_SNAPSHOT
    );
  }
  if (
    typeof o.availability !== "string" ||
    !PHASE_C7_AVAILABILITY_SET.has(o.availability)
  ) {
    return failClosed(
      "invalid_source",
      PHASE_C7_REASONS.INVALID_USAGE_SNAPSHOT
    );
  }
  if (!isUuidActor(o.actor_id)) {
    return failClosed("invalid_scope", PHASE_C7_REASONS.MISSING_SCOPE);
  }
  if (typeof o.environment !== "string" || !GATE_ENV_SET.has(o.environment)) {
    return failClosed("invalid_scope", PHASE_C7_REASONS.MISSING_SCOPE);
  }
  if (typeof o.period_key !== "string") {
    return failClosed("invalid_period", PHASE_C7_REASONS.INVALID_PERIOD);
  }
  const period = buildJstDayPeriod(o.period_key);
  if (!period.ok) return period;
  if (
    o.period_start !== period.period_start ||
    o.period_end !== period.period_end ||
    o.timezone !== PHASE_C7_TIMEZONE
  ) {
    return failClosed("invalid_period", PHASE_C7_REASONS.INVALID_PERIOD);
  }
  if (o.currency !== PHASE_C7_CURRENCY) {
    return failClosed(
      "currency_mismatch",
      PHASE_C7_REASONS.CURRENCY_MISMATCH
    );
  }
  if (o.provider_called !== false || o.recorded_api_cost !== 0) {
    return failClosed(
      "invalid_source",
      PHASE_C7_REASONS.INVALID_USAGE_SNAPSHOT
    );
  }
  if (o.reserved_usage_usd !== 0) {
    return failClosed(
      "invalid_source",
      PHASE_C7_REASONS.INVALID_USAGE_SNAPSHOT
    );
  }
  if (typeof o.snapshot_at !== "string" || !o.snapshot_at) {
    return failClosed(
      "invalid_source",
      PHASE_C7_REASONS.INVALID_USAGE_SNAPSHOT
    );
  }

  const recorded = validateBudgetNumber(o.recorded_usage_usd);
  if (!recorded.ok) {
    return failClosed(
      "invalid_source",
      PHASE_C7_REASONS.INVALID_USAGE_SNAPSHOT
    );
  }
  const effective = validateBudgetNumber(o.effective_usage_usd);
  if (!effective.ok) {
    return failClosed(
      "invalid_source",
      PHASE_C7_REASONS.INVALID_USAGE_SNAPSHOT
    );
  }
  if (effective.value !== recorded.value + 0) {
    return failClosed(
      "invalid_source",
      PHASE_C7_REASONS.INVALID_USAGE_SNAPSHOT
    );
  }

  return {
    ok: true,
    snapshot: deepFreeze({ ...o }),
  };
}

/**
 * Build immutable C7 snapshot from SAFE-07 `ai_cost_ledger_aggregate` JSON.
 * NEVER sums all users — exact `bucket === actor_id` only.
 *
 * @param {{
 *   actor_id: unknown,
 *   environment: unknown,
 *   budget_day_key: unknown,
 *   aggregateJson: unknown,
 *   snapshot_at?: unknown,
 * }} input
 */
export function buildUsageSnapshotFromAggregate(input = {}) {
  const scope = validateIsolationScope(input);
  if (!scope.ok) return scope;

  const snapshotAt =
    typeof input.snapshot_at === "string" && input.snapshot_at
      ? input.snapshot_at
      : null;
  if (!snapshotAt) {
    return failClosed(
      "invalid_source",
      PHASE_C7_REASONS.INVALID_USAGE_SNAPSHOT
    );
  }

  const agg = input.aggregateJson;
  if (!isPlainObject(agg)) {
    return failClosed(
      "unavailable",
      PHASE_C7_REASONS.USAGE_SNAPSHOT_UNAVAILABLE
    );
  }
  if (agg.ok !== true) {
    return failClosed("read_failure", PHASE_C7_REASONS.USAGE_READ_FAILED);
  }

  const currency =
    typeof agg.currency === "string" ? agg.currency.toUpperCase() : null;
  if (currency !== PHASE_C7_CURRENCY) {
    return failClosed(
      "currency_mismatch",
      PHASE_C7_REASONS.CURRENCY_MISMATCH
    );
  }

  if (!Array.isArray(agg.rows)) {
    return failClosed("read_failure", PHASE_C7_REASONS.USAGE_READ_FAILED);
  }

  const matches = agg.rows.filter(
    (row) =>
      isPlainObject(row) &&
      typeof row.bucket === "string" &&
      row.bucket === scope.actor_id
  );

  if (matches.length > 1) {
    return failClosed("ambiguous", PHASE_C7_REASONS.USAGE_AMBIGUOUS);
  }

  /** @type {number} */
  let recorded = 0;
  if (matches.length === 1) {
    const sum = matches[0].estimated_cost_sum;
    const validated = validateBudgetNumber(sum);
    if (!validated.ok) {
      return failClosed(
        "invalid_source",
        PHASE_C7_REASONS.INVALID_USAGE_SNAPSHOT
      );
    }
    recorded = validated.value;
  }
  // 0 matches → authoritative empty usage (available · recorded 0). Never sum all users.

  const raw = {
    schema_version: PHASE_C7_SCHEMA_VERSION,
    source: PHASE_C7_SOURCE,
    availability: "available",
    actor_id: scope.actor_id,
    environment: scope.environment,
    period_start: scope.period_start,
    period_end: scope.period_end,
    period_key: scope.period_key,
    timezone: PHASE_C7_TIMEZONE,
    currency: PHASE_C7_CURRENCY,
    recorded_usage_usd: recorded,
    reserved_usage_usd: 0,
    effective_usage_usd: recorded,
    snapshot_at: snapshotAt,
    provider_called: false,
    recorded_api_cost: 0,
  };

  const validated = validateUsageSnapshot(raw);
  if (!validated.ok) return validated;

  return deepFreeze({
    ok: true,
    availability: "available",
    snapshot: validated.snapshot,
    provider_called: false,
    recorded_api_cost: 0,
  });
}

/**
 * Map available C7 snapshot → C3 budget input `{ current_usage }` only.
 * @param {unknown} snapshot
 */
export function usageSnapshotToBudgetInput(snapshot) {
  const v = validateUsageSnapshot(snapshot);
  if (!v.ok) {
    return failClosed(
      v.availability || "invalid_source",
      v.reason || PHASE_C7_REASONS.INVALID_USAGE_SNAPSHOT
    );
  }
  if (v.snapshot.availability !== "available") {
    return failClosed(
      /** @type {string} */ (v.snapshot.availability),
      PHASE_C7_REASONS.USAGE_SNAPSHOT_UNAVAILABLE
    );
  }
  return deepFreeze({
    ok: true,
    current_usage: /** @type {number} */ (v.snapshot.effective_usage_usd),
  });
}

/**
 * Test-only fixed reader (no I/O).
 * Accepts a full reader outcome or a C7 snapshot object.
 * @param {unknown} resultOrSnapshot
 */
export function createFixedUsageReader(resultOrSnapshot) {
  /** @type {Readonly<Record<string, unknown>>} */
  let fixed;
  if (
    isPlainObject(resultOrSnapshot) &&
    typeof /** @type {Record<string, unknown>} */ (resultOrSnapshot).ok ===
      "boolean"
  ) {
    const o = /** @type {Record<string, unknown>} */ (resultOrSnapshot);
    fixed = deepFreeze({
      ...o,
      provider_called: false,
      recorded_api_cost: 0,
    });
  } else if (isPlainObject(resultOrSnapshot)) {
    const snap = /** @type {Record<string, unknown>} */ (resultOrSnapshot);
    const available = snap.availability === "available";
    fixed = deepFreeze({
      ok: available,
      availability:
        typeof snap.availability === "string" ? snap.availability : "available",
      snapshot: deepFreeze({ ...snap }),
      provider_called: false,
      recorded_api_cost: 0,
    });
  } else {
    fixed = failClosed(
      "unavailable",
      PHASE_C7_REASONS.USAGE_SNAPSHOT_UNAVAILABLE
    );
  }

  return {
    /**
     * @param {{
     *   actor_id?: unknown,
     *   environment?: unknown,
     *   budget_day_key?: unknown,
     *   snapshot_at?: unknown,
     * }} [_input]
     */
    async readUsageSnapshot(_input = {}) {
      return fixed;
    },
  };
}

/**
 * SAFE-07 read path — inject `rpcAggregate` (Primary/repository wires fetch).
 * No direct network in this module.
 *
 * @param {{
 *   rpcAggregate: (params: Readonly<Record<string, unknown>>) => Promise<unknown>,
 * }} deps
 */
export function createSafe07UsageSnapshotReader(deps) {
  const rpcAggregate =
    deps && typeof deps.rpcAggregate === "function" ? deps.rpcAggregate : null;

  return {
    /**
     * @param {{
     *   actor_id?: unknown,
     *   environment?: unknown,
     *   budget_day_key?: unknown,
     *   snapshot_at?: unknown,
     * }} [input]
     */
    async readUsageSnapshot(input = {}) {
      const scope = validateIsolationScope({
        actor_id: input.actor_id,
        environment: input.environment,
        budget_day_key: input.budget_day_key,
      });
      if (!scope.ok) return scope;

      const snapshotAt =
        typeof input.snapshot_at === "string" && input.snapshot_at
          ? input.snapshot_at
          : new Date().toISOString();

      if (!rpcAggregate) {
        return failClosed(
          "unavailable",
          PHASE_C7_REASONS.USAGE_SNAPSHOT_UNAVAILABLE
        );
      }

      /** @type {unknown} */
      let aggregateJson;
      try {
        aggregateJson = await rpcAggregate(
          deepFreeze({
            from: scope.period_start,
            to: scope.period_end,
            group_by: "user",
            currency: PHASE_C7_CURRENCY,
            tz: PHASE_C7_TIMEZONE,
            actor_id: scope.actor_id,
            environment: scope.environment,
            budget_day_key: scope.budget_day_key,
          })
        );
      } catch (_err) {
        return failClosed("read_failure", PHASE_C7_REASONS.USAGE_READ_FAILED);
      }

      return buildUsageSnapshotFromAggregate({
        actor_id: scope.actor_id,
        environment: scope.environment,
        budget_day_key: scope.budget_day_key,
        aggregateJson,
        snapshot_at: snapshotAt,
      });
    },
  };
}

/**
 * Minimal event metadata (no prompts / secrets / raw rows).
 * @param {unknown} outcome
 */
export function sanitizeUsageSnapshotEventMetadata(outcome) {
  if (!isPlainObject(outcome)) {
    return deepFreeze({
      source: PHASE_C7_SOURCE,
      period_key: null,
      currency: PHASE_C7_CURRENCY,
      recorded_usage_usd: null,
      availability: "unavailable",
      reason: PHASE_C7_REASONS.USAGE_SNAPSHOT_UNAVAILABLE,
      provider_called: false,
      recorded_api_cost: 0,
    });
  }
  const o = /** @type {Record<string, unknown>} */ (outcome);
  const snap = isPlainObject(o.snapshot)
    ? /** @type {Record<string, unknown>} */ (o.snapshot)
    : null;

  const recorded =
    snap && typeof snap.recorded_usage_usd === "number"
      ? snap.recorded_usage_usd
      : null;

  return deepFreeze({
    source: PHASE_C7_SOURCE,
    period_key:
      (snap && typeof snap.period_key === "string" && snap.period_key) ||
      null,
    currency: PHASE_C7_CURRENCY,
    recorded_usage_usd: recorded,
    availability:
      typeof o.availability === "string"
        ? o.availability
        : snap && typeof snap.availability === "string"
          ? snap.availability
          : "unavailable",
    reason: typeof o.reason === "string" ? o.reason : null,
    provider_called: false,
    recorded_api_cost: 0,
  });
}
