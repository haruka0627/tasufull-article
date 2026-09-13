/**
 * TLV CF LL-HLS ingest — idle lifecycle policy (pure module, no Cloudflare SDK).
 *
 * Staging-only runtime change. Production / unknown env is fail-closed:
 * this module never changes sleepAfter and never issues stop().
 *
 * Apply by copying this file into the unpublished Worker source and wiring
 * TlvCfLlhlsIngestContainer as shown in applyNotes() below.
 *
 * Official platform defaults (Cloudflare Containers):
 * - Container extends Durable Object; getContainer(env.BINDING, id) creates
 *   one instance identity per id (typically one per stream key).
 * - sleepAfter default is "10m"; incoming requests renew the timer.
 * - Default onActivityExpired() calls stop() (SIGTERM). Does not delete
 *   the Container application definition.
 */

export const STAGING_WORKER_NAME = "tlv-cf-llhls-ingest-staging";
export const PRODUCTION_WORKER_NAME = "tlv-cf-llhls-ingest-production";
export const STAGING_CONTAINER_APP = "tlv-cf-llhls-ingest-staging-tlvcfllhlsingestcontainer";
export const PRODUCTION_CONTAINER_APP = "tlv-cf-llhls-ingest-production-tlvcfllhlsingestcontainer";
export const CONTAINER_CLASS_NAME = "TlvCfLlhlsIngestContainer";

/** Cloudflare predefined instance type matching 2 vCPU / 8 GiB / 16 GB. */
export const INSTANCE_TYPE_STANDARD_3 = Object.freeze({
  id: "standard-3",
  vcpu: 2,
  memoryGiB: 8,
  diskGB: 16,
});

/** Operator-observed Cloudflare Dashboard live totals (not re-queried here). */
export const DASHBOARD_OBSERVED_LIVE = Object.freeze({
  staging: Object.freeze({
    containerApp: STAGING_CONTAINER_APP,
    state: "Active",
    liveInstances: 5,
    vcpu: 10,
    memoryGiB: 40,
    diskGB: 80,
  }),
  production: Object.freeze({
    containerApp: PRODUCTION_CONTAINER_APP,
    state: "Ready",
    liveInstances: 0,
    vcpu: 0,
    memoryGiB: 0,
    diskGB: 0,
  }),
});

export const PLATFORM_DEFAULT_SLEEP_AFTER = "10m";
export const PLATFORM_DEFAULT_SLEEP_AFTER_SECONDS = 600;

/** Staging idle window: long enough for reconnect, short enough to stop billable RAM. */
export const STAGING_SLEEP_AFTER = "2m";
export const STAGING_SLEEP_AFTER_SECONDS = 120;

export const PLAYBACK_PATH_RE = /(\.m3u8|\.ts|\.m4s|\.mp4|\.m4a|\/hls\/|\/llhls\/|\/playlist)/i;
export const INGEST_PATH_RE = /(\/ingest|\/publish|\/whip|\/whep|\/rtmp|\/srt|\/stream\/in)/i;
export const LIFECYCLE_STOP_PATH = "/internal/lifecycle/stop";

export const FORBIDDEN_SHUTDOWN_ACTIONS = Object.freeze([
  "wrangler containers delete",
  "dashboard Delete Container",
]);

/**
 * @param {{ liveInstances: number, vcpu: number, memoryGiB: number, diskGB: number }} observed
 * @param {{ id: string, vcpu: number, memoryGiB: number, diskGB: number }} instanceType
 */
export function correlateInstanceCapacity(observed, instanceType = INSTANCE_TYPE_STANDARD_3) {
  const n = Number(observed.liveInstances) || 0;
  const expected = {
    instanceType: instanceType.id,
    liveInstances: n,
    vcpu: n * instanceType.vcpu,
    memoryGiB: n * instanceType.memoryGiB,
    diskGB: n * instanceType.diskGB,
  };
  const matches =
    n > 0 &&
    Number(observed.vcpu) === expected.vcpu &&
    Number(observed.memoryGiB) === expected.memoryGiB &&
    Number(observed.diskGB) === expected.diskGB;
  return { matches, expected, observed };
}

export function normalizeEnvName(envName) {
  const v = String(envName || "").trim().toLowerCase();
  if (v === "staging" || v === "stage") return "staging";
  if (v === "production" || v === "prod") return "production";
  return "unknown";
}

export function resolveSleepAfter(envName) {
  if (normalizeEnvName(envName) === "staging") {
    return {
      apply: true,
      sleepAfter: STAGING_SLEEP_AFTER,
      seconds: STAGING_SLEEP_AFTER_SECONDS,
      before: "unknown_or_platform_default_10m",
    };
  }
  return {
    apply: false,
    sleepAfter: null,
    seconds: null,
    before: "unchanged",
    reason: "production_fail_closed",
  };
}

/**
 * @param {{ pathname?: string, method?: string }} requestLike
 */
export function classifyRequestActivity(requestLike = {}) {
  const method = String(requestLike.method || "GET").toUpperCase();
  const pathname = String(requestLike.pathname || "/");
  if (pathname === LIFECYCLE_STOP_PATH || pathname.startsWith(`${LIFECYCLE_STOP_PATH}/`)) {
    return "admin-stop";
  }
  if (INGEST_PATH_RE.test(pathname) || method === "PUT" || method === "POST" || method === "PATCH") {
    return "ingest";
  }
  if (method === "GET" && PLAYBACK_PATH_RE.test(pathname)) {
    return "playback";
  }
  return "unknown";
}

/**
 * Staging: leftover LL-HLS playlist/segment polling must not keep instances
 * billable after the publisher is gone. Production: fail-closed (always renew).
 *
 * @param {{ envName?: string, requestLike?: object, hasActiveIngest?: boolean }} input
 */
export function shouldRenewActivityTimeout(input = {}) {
  const envName = normalizeEnvName(input.envName);
  if (envName !== "staging") return true;
  if (input.hasActiveIngest) return true;
  const kind = classifyRequestActivity(input.requestLike);
  if (kind === "playback") return false;
  return true;
}

/**
 * @param {{ envName?: string, hasActiveIngest?: boolean }} input
 * @returns {{ apply: boolean, action: "stop"|"keep"|"platform-default", reason: string }}
 */
export function resolveActivityExpiredAction(input = {}) {
  const envName = normalizeEnvName(input.envName);
  if (envName !== "staging") {
    return { apply: false, action: "platform-default", reason: "production_fail_closed" };
  }
  if (input.hasActiveIngest) {
    return { apply: true, action: "keep", reason: "active_ingest_uninterrupted" };
  }
  return { apply: true, action: "stop", reason: "staging_idle_no_ingest" };
}

/**
 * Apply Staging sleepAfter onto a Container subclass instance/prototype.
 * Production / unknown: no-op.
 *
 * @param {{ sleepAfter?: string }} target
 * @param {{ envName?: string }} options
 */
export function bindStagingSleepAfter(target, options = {}) {
  const policy = resolveSleepAfter(options.envName);
  if (!policy.apply || !target || typeof target !== "object") {
    return { applied: false, sleepAfter: target?.sleepAfter ?? null, reason: policy.reason || "not_staging" };
  }
  target.sleepAfter = policy.sleepAfter;
  return { applied: true, sleepAfter: policy.sleepAfter };
}

/**
 * Staging onActivityExpired helper. Never deletes the Container definition.
 * Production: returns defer=true so the caller leaves platform default alone.
 *
 * @param {{ stop?: Function, renewActivityTimeout?: Function }} container
 * @param {{ envName?: string, hasActiveIngest?: boolean }} ctx
 */
export async function runActivityExpired(container, ctx = {}) {
  const decision = resolveActivityExpiredAction(ctx);
  if (decision.action === "stop") {
    if (typeof container?.stop !== "function") {
      return { stopped: false, deletedDefinition: false, error: "stop_unavailable", ...decision };
    }
    await container.stop();
    return { stopped: true, deletedDefinition: false, ...decision };
  }
  if (decision.action === "keep") {
    if (typeof container?.renewActivityTimeout === "function") {
      container.renewActivityTimeout();
    }
    return { stopped: false, deletedDefinition: false, ...decision };
  }
  return { stopped: false, deletedDefinition: false, defer: true, ...decision };
}

/**
 * Staging-only operator stop. Rejects Production. Does not delete the app.
 *
 * @param {{ stop?: Function }} container
 * @param {{ envName?: string, tokenOk?: boolean, method?: string, pathname?: string }} ctx
 */
export async function runStagingOperatorStop(container, ctx = {}) {
  const envName = normalizeEnvName(ctx.envName);
  if (envName !== "staging") {
    return {
      ok: false,
      stopped: false,
      deletedDefinition: false,
      error: "production_mutation_prohibited",
    };
  }
  if (String(ctx.method || "POST").toUpperCase() !== "POST") {
    return { ok: false, stopped: false, deletedDefinition: false, error: "method_not_allowed" };
  }
  const pathname = String(ctx.pathname || LIFECYCLE_STOP_PATH);
  if (pathname !== LIFECYCLE_STOP_PATH && !pathname.startsWith(`${LIFECYCLE_STOP_PATH}/`)) {
    return { ok: false, stopped: false, deletedDefinition: false, error: "not_found" };
  }
  if (!ctx.tokenOk) {
    return { ok: false, stopped: false, deletedDefinition: false, error: "unauthorized" };
  }
  if (typeof container?.stop !== "function") {
    return { ok: false, stopped: false, deletedDefinition: false, error: "stop_unavailable" };
  }
  await container.stop();
  return { ok: true, stopped: true, deletedDefinition: false };
}

export function applyNotes() {
  return [
    `1. Copy this module into the unpublished ${CONTAINER_CLASS_NAME} Worker source.`,
    `2. Set class field sleepAfter from resolveSleepAfter(env.TLV_CF_LLHLS_ENV) only when staging.`,
    "3. In fetch(), call shouldRenewActivityTimeout() before renewActivityTimeout().",
    "4. In onActivityExpired(), await runActivityExpired(this, { envName, hasActiveIngest }).",
    "5. If defer===true, do not override Production — leave platform default.",
    `6. Optional Staging POST ${LIFECYCLE_STOP_PATH} via runStagingOperatorStop (token required).`,
    "7. Deploy Staging Worker only. Never Production. Never containers delete.",
  ];
}
