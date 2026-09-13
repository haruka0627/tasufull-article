/**
 * TLV CF LL-HLS ingest — Staging idle lifecycle (pure module, no Cloudflare SDK).
 *
 * Ops (see reports/.../ops-status.md): worker.js already has sleepAfter="2m"
 * and onActivityExpired → destroy/stop. Those hooks do not run while the
 * @cloudflare/containers Container class keeps renewing activity:
 *   - every proxied fetch / WS message calls renewActivityTimeout()
 *   - isActivityExpired() is false while inflightRequests > 0 (then renews)
 *
 * This module does NOT add another sleepAfter. It:
 *   1) refuses to forward idle playback / dummy DOs to Container.fetch (no renew)
 *   2) runs an ingest-idle watchdog independent of platform sleepAfter
 *   3) documents POST /v1/stop (ingest JWT) as SAFE_SHUTDOWN
 *   4) optional Staging /v1/admin-stop behind Human GO (default 404)
 *
 * Production / unknown: fail-closed. Never deletes the Container application.
 */

export const STAGING_WORKER_NAME = "tlv-cf-llhls-ingest-staging";
export const PRODUCTION_WORKER_NAME = "tlv-cf-llhls-ingest-production";
export const STAGING_CONTAINER_APP = "tlv-cf-llhls-ingest-staging-tlvcfllhlsingestcontainer";
export const PRODUCTION_CONTAINER_APP = "tlv-cf-llhls-ingest-production-tlvcfllhlsingestcontainer";
export const CONTAINER_CLASS_NAME = "TlvCfLlhlsIngestContainer";
export const STAGING_APPLICATION_ID_PREFIX = "a03deec3";

export const INSTANCE_TYPE_STANDARD_3 = Object.freeze({
  id: "standard-3",
  vcpu: 2,
  memoryGiB: 8,
  diskGB: 16,
});

/** Operator-collected live totals (ops-status.md). Not re-queried. */
export const OPS_OBSERVED_LIVE = Object.freeze({
  staging: Object.freeze({
    containerApp: STAGING_CONTAINER_APP,
    applicationIdPrefix: STAGING_APPLICATION_ID_PREFIX,
    liveInstances: 7,
    runningNamedDos: 5,
    dummyStreamIncluded: true,
    maxInstances: 8,
    instanceType: "standard-3",
    sleepAfterAlready: "2m",
    createdApprox: "2026-09-11",
    sleepAfterClearing: false,
  }),
  production: Object.freeze({
    containerApp: PRODUCTION_CONTAINER_APP,
    liveInstances: 7,
    observeOnly: true,
    mutate: false,
  }),
});

/** @deprecated use OPS_OBSERVED_LIVE — kept so older report fixtures still import. */
export const DASHBOARD_OBSERVED_LIVE = OPS_OBSERVED_LIVE;

export const PLATFORM_DEFAULT_SLEEP_AFTER = "10m";
export const PLATFORM_DEFAULT_SLEEP_AFTER_SECONDS = 600;
export const STAGING_SLEEP_AFTER = "2m";
export const STAGING_SLEEP_AFTER_SECONDS = 120;

export const PLAYBACK_PATH_RE = /(\.m3u8|\.ts|\.m4s|\.mp4|\.m4a|\/hls\/|\/llhls\/|\/playlist)/i;
export const INGEST_PATH_RE = /(\/ingest|\/publish|\/whip|\/whep|\/rtmp|\/srt|\/stream\/in)/i;
export const V1_STOP_PATH = "/v1/stop";
export const V1_ADMIN_STOP_PATH = "/v1/admin-stop";
export const V1_ADMIN_DESTROY_PATH = "/v1/admin-destroy";
export const LIFECYCLE_STOP_PATH = V1_STOP_PATH;

export const FORBIDDEN_SHUTDOWN_ACTIONS = Object.freeze([
  "wrangler containers delete",
  "dashboard Delete Container",
]);

export const SAFE_SHUTDOWN_METHOD = "POST /v1/stop with ingest JWT (Container.stop/destroy; app remains)";

/**
 * @param {{ liveInstances: number, vcpu?: number, memoryGiB?: number, diskGB?: number }} observed
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
  const hasTotals =
    observed.vcpu != null && observed.memoryGiB != null && observed.diskGB != null;
  const matches =
    n > 0 &&
    (!hasTotals ||
      (Number(observed.vcpu) === expected.vcpu &&
        Number(observed.memoryGiB) === expected.memoryGiB &&
        Number(observed.diskGB) === expected.diskGB));
  return { matches, expected, observed };
}

export function normalizeEnvName(envName) {
  const v = String(envName || "").trim().toLowerCase();
  if (v === "staging" || v === "stage") return "staging";
  if (v === "production" || v === "prod") return "production";
  return "unknown";
}

export function isDummyStreamId(id) {
  const raw = String(id || "").trim().toLowerCase();
  if (!raw) return false;
  if (raw.includes("aaaa")) return true;
  const compact = raw.replace(/-/g, "");
  return /^a{4,}$/.test(compact);
}

export function isHumanAdminStopGo(value) {
  return String(value || "").trim() === "1";
}

/**
 * sleepAfter is already "2m" on the deployed worker. Staging does not change
 * the field again. Production is fail-closed (no apply).
 */
export function resolveSleepAfter(envName) {
  if (normalizeEnvName(envName) === "staging") {
    return {
      apply: false,
      alreadySet: true,
      sleepAfter: STAGING_SLEEP_AFTER,
      seconds: STAGING_SLEEP_AFTER_SECONDS,
      before: "2m_already_in_worker_js",
      reason: "sleepAfter_already_set_activity_renew_blocks_expiry",
    };
  }
  return {
    apply: false,
    alreadySet: false,
    sleepAfter: null,
    seconds: null,
    before: "unchanged",
    reason: "production_fail_closed",
  };
}

export function classifyRequestActivity(requestLike = {}) {
  const method = String(requestLike.method || "GET").toUpperCase();
  const pathname = String(requestLike.pathname || "/");
  if (pathname === V1_ADMIN_DESTROY_PATH || pathname.startsWith(`${V1_ADMIN_DESTROY_PATH}/`)) {
    return "admin-destroy";
  }
  if (pathname === V1_ADMIN_STOP_PATH || pathname.startsWith(`${V1_ADMIN_STOP_PATH}/`)) {
    return "admin-stop";
  }
  if (pathname === V1_STOP_PATH || pathname.startsWith(`${V1_STOP_PATH}/`)) {
    return "v1-stop";
  }
  if (INGEST_PATH_RE.test(pathname) || method === "PUT" || method === "PATCH") {
    return "ingest";
  }
  if (method === "POST" && INGEST_PATH_RE.test(pathname)) {
    return "ingest";
  }
  if (method === "POST" && !pathname.startsWith("/v1/")) {
    return "ingest";
  }
  if (method === "GET" && PLAYBACK_PATH_RE.test(pathname)) {
    return "playback";
  }
  return "unknown";
}

/**
 * If true, Worker may call container.fetch()/super.fetch() (renews activity).
 * Staging idle playback and dummy ids must return false so sleepAfter can fire
 * and so we do not start a billed VM for leftover playlist polls.
 */
export function shouldForwardToContainer(input = {}) {
  const envName = normalizeEnvName(input.envName);
  if (envName !== "staging") return true;
  const kind = classifyRequestActivity(input.requestLike);
  if (kind === "v1-stop" || kind === "admin-stop" || kind === "admin-destroy") {
    return false;
  }
  if (input.hasActiveIngest) return true;
  if (isDummyStreamId(input.streamId)) return false;
  if (kind === "playback") return false;
  if (kind === "unknown" && input.lastIngestAtMs == null) return false;
  return true;
}

export function shouldRenewActivityTimeout(input = {}) {
  const envName = normalizeEnvName(input.envName);
  if (envName !== "staging") return true;
  if (input.hasActiveIngest) return true;
  if (isDummyStreamId(input.streamId)) return false;
  const kind = classifyRequestActivity(input.requestLike);
  if (kind === "playback" || kind === "unknown") return false;
  if (kind === "v1-stop" || kind === "admin-stop" || kind === "admin-destroy") return false;
  return true;
}

/**
 * Independent of Container.sleepAfter / inflightRequests.
 * Staging: stop when no open ingest and last ingest older than 2m (or never).
 */
export function resolveIngestIdleWatchdog(input = {}) {
  const envName = normalizeEnvName(input.envName);
  if (envName !== "staging") {
    return { apply: false, action: "skip", reason: "production_fail_closed" };
  }
  if (input.hasOpenIngestSession || input.hasActiveIngest) {
    return { apply: true, action: "keep", reason: "active_ingest_uninterrupted" };
  }
  const now = Number(input.nowMs) || Date.now();
  const last = input.lastIngestAtMs == null ? null : Number(input.lastIngestAtMs);
  if (last == null || !Number.isFinite(last)) {
    return { apply: true, action: "stop", reason: "no_ingest_seen" };
  }
  if (now - last > STAGING_SLEEP_AFTER_SECONDS * 1000) {
    return { apply: true, action: "stop", reason: "ingest_idle_exceeded" };
  }
  return { apply: true, action: "keep", reason: "within_idle_window" };
}

export function resolveActivityExpiredAction(input = {}) {
  const envName = normalizeEnvName(input.envName);
  if (envName !== "staging") {
    return { apply: false, action: "platform-default", reason: "production_fail_closed" };
  }
  const watchdog = resolveIngestIdleWatchdog(input);
  if (watchdog.action === "keep") {
    return { apply: true, action: "keep", reason: watchdog.reason };
  }
  return { apply: true, action: "stop", reason: watchdog.reason };
}

export function bindStagingSleepAfter(target, options = {}) {
  const policy = resolveSleepAfter(options.envName);
  return {
    applied: false,
    sleepAfter: target?.sleepAfter ?? policy.sleepAfter,
    reason: policy.reason,
  };
}

export async function runActivityExpired(container, ctx = {}) {
  const decision = resolveActivityExpiredAction(ctx);
  if (decision.action === "stop") {
    const fn = container?.destroy || container?.stop;
    if (typeof fn !== "function") {
      return { stopped: false, deletedDefinition: false, error: "stop_unavailable", ...decision };
    }
    await fn.call(container);
    return { stopped: true, deletedDefinition: false, ...decision };
  }
  if (decision.action === "keep") {
    return { stopped: false, deletedDefinition: false, ...decision };
  }
  return { stopped: false, deletedDefinition: false, defer: true, ...decision };
}

export async function runIngestIdleWatchdog(container, ctx = {}) {
  const decision = resolveIngestIdleWatchdog(ctx);
  if (decision.action !== "stop") {
    return { stopped: false, deletedDefinition: false, ...decision };
  }
  const fn = container?.destroy || container?.stop;
  if (typeof fn !== "function") {
    return { stopped: false, deletedDefinition: false, error: "stop_unavailable", ...decision };
  }
  await fn.call(container);
  return { stopped: true, deletedDefinition: false, ...decision };
}

/**
 * Existing SAFE_SHUTDOWN: POST /v1/stop + ingest JWT.
 * Production: refused (observe-only). Does not delete the app.
 */
export async function runV1Stop(container, ctx = {}) {
  const envName = normalizeEnvName(ctx.envName);
  if (envName !== "staging") {
    return { ok: false, stopped: false, deletedDefinition: false, error: "production_mutation_prohibited" };
  }
  if (String(ctx.method || "POST").toUpperCase() !== "POST") {
    return { ok: false, stopped: false, deletedDefinition: false, error: "method_not_allowed" };
  }
  const pathname = String(ctx.pathname || V1_STOP_PATH);
  if (pathname !== V1_STOP_PATH && !pathname.startsWith(`${V1_STOP_PATH}/`)) {
    return { ok: false, stopped: false, deletedDefinition: false, error: "not_found" };
  }
  if (!ctx.ingestJwtOk && !ctx.tokenOk) {
    return { ok: false, stopped: false, deletedDefinition: false, error: "unauthorized" };
  }
  const fn = container?.destroy || container?.stop;
  if (typeof fn !== "function") {
    return { ok: false, stopped: false, deletedDefinition: false, error: "stop_unavailable" };
  }
  await fn.call(container);
  return { ok: true, stopped: true, deletedDefinition: false, path: V1_STOP_PATH };
}

export const runStagingOperatorStop = runV1Stop;

/**
 * /v1/admin-destroy stays hard 404 (ops).
 * /v1/admin-stop is 404 unless Staging AND Human GO (TLV_CF_LLHLS_ADMIN_STOP_GO=1).
 */
export async function runV1AdminStop(container, ctx = {}) {
  const pathname = String(ctx.pathname || "");
  if (pathname === V1_ADMIN_DESTROY_PATH || pathname.startsWith(`${V1_ADMIN_DESTROY_PATH}/`)) {
    return { ok: false, stopped: false, deletedDefinition: false, status: 404, error: "not_found" };
  }
  const envName = normalizeEnvName(ctx.envName);
  if (envName !== "staging") {
    return {
      ok: false,
      stopped: false,
      deletedDefinition: false,
      status: 404,
      error: "production_mutation_prohibited",
    };
  }
  if (!isHumanAdminStopGo(ctx.adminStopGo)) {
    return { ok: false, stopped: false, deletedDefinition: false, status: 404, error: "not_found" };
  }
  if (String(ctx.method || "POST").toUpperCase() !== "POST") {
    return { ok: false, stopped: false, deletedDefinition: false, status: 405, error: "method_not_allowed" };
  }
  if (pathname !== V1_ADMIN_STOP_PATH && !pathname.startsWith(`${V1_ADMIN_STOP_PATH}/`)) {
    return { ok: false, stopped: false, deletedDefinition: false, status: 404, error: "not_found" };
  }
  if (!ctx.tokenOk) {
    return { ok: false, stopped: false, deletedDefinition: false, status: 401, error: "unauthorized" };
  }
  const fn = container?.destroy || container?.stop;
  if (typeof fn !== "function") {
    return { ok: false, stopped: false, deletedDefinition: false, status: 500, error: "stop_unavailable" };
  }
  await fn.call(container);
  return { ok: true, stopped: true, deletedDefinition: false, status: 200, path: V1_ADMIN_STOP_PATH };
}

export function applyNotes() {
  return [
    "1. Merge this module into existing TlvCfLlhlsIngestContainer worker.js (Staging only).",
    "2. Do not change Production. Do not change sleepAfter (already 2m).",
    "3. Before Container.fetch/super.fetch: if !shouldForwardToContainer(), return 404/410.",
    "4. On a DO alarm (~60s): runIngestIdleWatchdog (independent of inflightRequests).",
    "5. SAFE_SHUTDOWN remains POST /v1/stop with ingest JWT.",
    "6. /v1/admin-destroy stays 404. /v1/admin-stop is 404 until Human sets TLV_CF_LLHLS_ADMIN_STOP_GO=1 on Staging.",
    "7. wrangler deploy Staging Worker only. Never Production. Never containers delete.",
  ];
}
