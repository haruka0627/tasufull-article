/**
 * Non-destructive cost guardrail for TLV CF LL-HLS ingest Containers.
 *
 * FINDING when: LIVE_INSTANCES > 0 AND NO_ACTIVE_STREAMS AND idle past timeout.
 * Never deletes Container definitions or instances.
 */

import {
  DASHBOARD_OBSERVED_LIVE,
  FORBIDDEN_SHUTDOWN_ACTIONS,
  INSTANCE_TYPE_STANDARD_3,
  OPS_OBSERVED_LIVE,
  PLATFORM_DEFAULT_SLEEP_AFTER_SECONDS,
  PRODUCTION_CONTAINER_APP,
  PRODUCTION_WORKER_NAME,
  SAFE_SHUTDOWN_METHOD,
  STAGING_CONTAINER_APP,
  STAGING_SLEEP_AFTER_SECONDS,
  STAGING_WORKER_NAME,
  V1_STOP_PATH,
  correlateInstanceCapacity,
  normalizeEnvName,
} from "../../deploy/cloudflare/workers/tlv-cf-llhls-ingest/src/idle-lifecycle.mjs";

export {
  DASHBOARD_OBSERVED_LIVE,
  FORBIDDEN_SHUTDOWN_ACTIONS,
  INSTANCE_TYPE_STANDARD_3,
  OPS_OBSERVED_LIVE,
  PRODUCTION_CONTAINER_APP,
  PRODUCTION_WORKER_NAME,
  STAGING_CONTAINER_APP,
  STAGING_WORKER_NAME,
  V1_STOP_PATH,
};

export const FINDING_CODE = "NO_ACTIVE_STREAMS_AND_LIVE_INSTANCES";

export const SAFE_SHUTDOWN_METHODS = Object.freeze([
  SAFE_SHUTDOWN_METHOD,
  `Staging ${V1_STOP_PATH} per running DO id (ingest JWT). Wrangler has no instance stop.`,
  "After Staging fetch-guard deploy: idle playback is not forwarded; ingest-idle watchdog calls stop/destroy",
]);

const ACTIVE_BROADCAST_STATUSES = new Set(["live", "preparing"]);

export function isActiveBroadcastStatus(status) {
  return ACTIVE_BROADCAST_STATUSES.has(String(status || "").trim().toLowerCase());
}

export function countActiveStreams(rows = []) {
  return rows.filter((row) => isActiveBroadcastStatus(row?.status)).length;
}

export function idleTimeoutSecondsForEnv(envName) {
  return normalizeEnvName(envName) === "staging"
    ? STAGING_SLEEP_AFTER_SECONDS
    : PLATFORM_DEFAULT_SLEEP_AFTER_SECONDS;
}

/**
 * @param {{
 *   envName?: string,
 *   liveInstances?: number,
 *   activeStreamCount?: number,
 *   idleSeconds?: number,
 *   idleTimeoutSeconds?: number,
 * }} input
 */
export function evaluateIdleCostFinding(input = {}) {
  const envName = normalizeEnvName(input.envName || "staging");
  const liveInstances = Number(input.liveInstances) || 0;
  const activeStreamCount = Number(input.activeStreamCount) || 0;
  const idleTimeoutSeconds =
    input.idleTimeoutSeconds != null
      ? Number(input.idleTimeoutSeconds)
      : idleTimeoutSecondsForEnv(envName);
  const idleSeconds = Number(input.idleSeconds);
  const idleKnown = Number.isFinite(idleSeconds);
  const idleExceeded = idleKnown && idleSeconds > idleTimeoutSeconds;

  const finding =
    liveInstances > 0 && activeStreamCount === 0 && (idleExceeded || !idleKnown);

  const severity = !finding
    ? "NONE"
    : envName === "production"
      ? "CRITICAL"
      : "HIGH";

  return {
    finding,
    code: finding ? FINDING_CODE : null,
    severity,
    envName,
    liveInstances,
    activeStreamCount,
    idleSeconds: idleKnown ? idleSeconds : null,
    idleTimeoutSeconds,
    idleKnown,
    autoDelete: false,
    forbiddenActions: [...FORBIDDEN_SHUTDOWN_ACTIONS],
    recommendedActions: finding ? [...SAFE_SHUTDOWN_METHODS] : [],
    productionMutation: false,
  };
}

export function buildDashboardAttribution() {
  const staging = correlateInstanceCapacity({
    liveInstances: OPS_OBSERVED_LIVE.staging.liveInstances,
  });
  const running5 = correlateInstanceCapacity({
    liveInstances: OPS_OBSERVED_LIVE.staging.runningNamedDos,
    vcpu: 10,
    memoryGiB: 40,
    diskGB: 80,
  });
  return {
    instanceType: INSTANCE_TYPE_STANDARD_3.id,
    maxInstances: OPS_OBSERVED_LIVE.staging.maxInstances,
    stagingLiveInstances: OPS_OBSERVED_LIVE.staging.liveInstances,
    stagingRunningNamedDos: OPS_OBSERVED_LIVE.staging.runningNamedDos,
    staging7xStandard3: staging.expected,
    staging5RunningMatches10_40_80: running5.matches,
    productionLiveInstances: OPS_OBSERVED_LIVE.production.liveInstances,
    productionObserveOnly: true,
    productionMutation: false,
  };
}

function redactSecrets(value) {
  if (value == null) return value;
  if (typeof value === "string") {
    return value
      .replace(/(api[_-]?token|authorization|bearer|secret|password|key)=([^\s&]+)/gi, "$1=REDACTED")
      .replace(/Bearer\s+\S+/gi, "Bearer REDACTED");
  }
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (/token|secret|password|authorization|key/i.test(k)) out[k] = "REDACTED";
      else out[k] = redactSecrets(v);
    }
    return out;
  }
  return value;
}

/**
 * Read-only collection. Adapters must not mutate Cloudflare or the database.
 *
 * @param {{
 *   envName?: string,
 *   idleSeconds?: number,
 *   listContainerLiveInstances?: () => Promise<number|null>,
 *   listBroadcastRows?: () => Promise<Array<{status?: string}>>,
 * }} adapters
 */
export async function collectIdleCostEvidence(adapters = {}) {
  const envName = normalizeEnvName(adapters.envName || "staging");
  let liveInstances = null;
  let liveInstancesSource = "unavailable";
  let activeStreamCount = null;
  let activeStreamSource = "unavailable";
  const errors = [];

  if (typeof adapters.listContainerLiveInstances === "function") {
    try {
      liveInstances = await adapters.listContainerLiveInstances();
      liveInstancesSource = "adapter";
    } catch (err) {
      errors.push(`listContainerLiveInstances: ${err?.message || String(err)}`);
    }
  }
  if (liveInstances == null && envName === "staging") {
    liveInstances = OPS_OBSERVED_LIVE.staging.liveInstances;
    liveInstancesSource = "ops_status_fallback";
  }
  if (liveInstances == null && envName === "production") {
    liveInstances = OPS_OBSERVED_LIVE.production.liveInstances;
    liveInstancesSource = "ops_status_fallback_observe_only";
  }

  if (typeof adapters.listBroadcastRows === "function") {
    try {
      const rows = await adapters.listBroadcastRows();
      activeStreamCount = countActiveStreams(rows || []);
      activeStreamSource = "adapter";
    } catch (err) {
      errors.push(`listBroadcastRows: ${err?.message || String(err)}`);
    }
  }
  if (activeStreamCount == null) {
    activeStreamCount = 0;
    activeStreamSource = "operator_no_active_streams_assumption";
  }

  const evaluation = evaluateIdleCostFinding({
    envName,
    liveInstances,
    activeStreamCount,
    idleSeconds: adapters.idleSeconds,
  });

  return redactSecrets({
    collectedAt: new Date().toISOString(),
    envName,
    liveInstances,
    liveInstancesSource,
    activeStreamCount,
    activeStreamSource,
    attribution: buildDashboardAttribution(),
    evaluation,
    errors,
    autoDelete: false,
    productionMutation: false,
  });
}

export function wranglerReadOnlyCommands(applicationId = "<STAGING_APPLICATION_ID>") {
  return {
    listApplications: "wrangler containers list",
    listStagingInstances: `wrangler containers instances ${applicationId} --json`,
    forbidden: [...FORBIDDEN_SHUTDOWN_ACTIONS],
  };
}
