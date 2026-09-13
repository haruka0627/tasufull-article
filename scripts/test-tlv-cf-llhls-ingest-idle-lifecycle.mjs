#!/usr/bin/env node
/**
 * TLV CF LL-HLS ingest idle lifecycle + cost guardrail (no network, no deploy).
 *
 *   node scripts/test-tlv-cf-llhls-ingest-idle-lifecycle.mjs
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CONTAINER_CLASS_NAME,
  FORBIDDEN_SHUTDOWN_ACTIONS,
  INSTANCE_TYPE_STANDARD_3,
  OPS_OBSERVED_LIVE,
  PLATFORM_DEFAULT_SLEEP_AFTER,
  STAGING_SLEEP_AFTER,
  V1_ADMIN_DESTROY_PATH,
  V1_ADMIN_STOP_PATH,
  V1_STOP_PATH,
  bindStagingSleepAfter,
  classifyRequestActivity,
  correlateInstanceCapacity,
  isDummyStreamId,
  resolveActivityExpiredAction,
  resolveIngestIdleWatchdog,
  resolveSleepAfter,
  runActivityExpired,
  runIngestIdleWatchdog,
  runV1AdminStop,
  runV1Stop,
  shouldForwardToContainer,
  shouldRenewActivityTimeout,
} from "../deploy/cloudflare/workers/tlv-cf-llhls-ingest/src/idle-lifecycle.mjs";
import { handleStagingContainerRequest } from "../deploy/cloudflare/workers/tlv-cf-llhls-ingest/src/fetch-guard.mjs";
import {
  FINDING_CODE,
  SAFE_SHUTDOWN_METHODS,
  collectIdleCostEvidence,
  countActiveStreams,
  evaluateIdleCostFinding,
} from "./lib/tlv-cf-llhls-ingest-cost-guardrail.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const results = [];

function check(name, ok, detail = "") {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? "PASS" : "FAIL"}: ${name}${detail ? ` — ${detail}` : ""}`);
}

const wranglerPath = join(ROOT, "deploy/cloudflare/workers/tlv-cf-llhls-ingest/wrangler.toml");
const wrangler = existsSync(wranglerPath) ? readFileSync(wranglerPath, "utf8") : "";
check("ops wrangler path exists", existsSync(wranglerPath));
check("wrangler max_instances=8", /max_instances\s*=\s*8/.test(wrangler));
check("wrangler instance_type=standard-3", /instance_type\s*=\s*"standard-3"/.test(wrangler));
check("wrangler admin-stop GO default 0", /TLV_CF_LLHLS_ADMIN_STOP_GO\s*=\s*"0"/.test(wrangler));
check("wrangler is staging name", /tlv-cf-llhls-ingest-staging/.test(wrangler));
check("container class name matches dashboard suffix", CONTAINER_CLASS_NAME === "TlvCfLlhlsIngestContainer");

const running5 = correlateInstanceCapacity({
  liveInstances: 5,
  vcpu: 10,
  memoryGiB: 40,
  diskGB: 80,
});
check("5 running named DOs × standard-3 = 10/40/80", running5.matches);
const live7 = correlateInstanceCapacity({ liveInstances: 7 });
check("ops LIVE=7 × standard-3 = 14 vCPU / 56 GiB / 112 GB", live7.expected.memoryGiB === 56 && live7.expected.vcpu === 14);
check("ops staging live=7 max=8 sleepAfter already 2m", OPS_OBSERVED_LIVE.staging.liveInstances === 7 && OPS_OBSERVED_LIVE.staging.maxInstances === 8 && OPS_OBSERVED_LIVE.staging.sleepAfterAlready === "2m");
check("ops production live=7 observe-only", OPS_OBSERVED_LIVE.production.liveInstances === 7 && OPS_OBSERVED_LIVE.production.mutate === false);
check("standard-3 is 2 vCPU / 8 GiB / 16 GB", INSTANCE_TYPE_STANDARD_3.vcpu === 2 && INSTANCE_TYPE_STANDARD_3.memoryGiB === 8);

const stagingSleep = resolveSleepAfter("staging");
const prodSleep = resolveSleepAfter("production");
check("staging does not re-apply sleepAfter (already 2m)", !stagingSleep.apply && stagingSleep.alreadySet && stagingSleep.sleepAfter === STAGING_SLEEP_AFTER);
check("production sleepAfter fail-closed", !prodSleep.apply && prodSleep.reason === "production_fail_closed");
check("platform default constant unused for this deploy", PLATFORM_DEFAULT_SLEEP_AFTER === "10m");

const stagingTarget = { sleepAfter: "2m" };
check("bind staging is no-op (activity-renew is the bug)", !bindStagingSleepAfter(stagingTarget, { envName: "staging" }).applied && stagingTarget.sleepAfter === "2m");

check("GET playlist is playback", classifyRequestActivity({ method: "GET", pathname: "/live/a.m3u8" }) === "playback");
check("POST /v1/stop is v1-stop not ingest", classifyRequestActivity({ method: "POST", pathname: V1_STOP_PATH }) === "v1-stop");
check("POST whip is ingest", classifyRequestActivity({ method: "POST", pathname: "/ingest/whip" }) === "ingest");
check("dummy aaaa detected", isDummyStreamId("aaaa-test") && isDummyStreamId("aaaaaaaa"));

check(
  "staging playback without ingest does not renew or forward",
  shouldRenewActivityTimeout({
    envName: "staging",
    hasActiveIngest: false,
    requestLike: { method: "GET", pathname: "/llhls/index.m3u8" },
  }) === false &&
    shouldForwardToContainer({
      envName: "staging",
      hasActiveIngest: false,
      requestLike: { method: "GET", pathname: "/llhls/index.m3u8" },
    }) === false,
);
check(
  "staging playback with ingest still forwards (stream uninterrupted)",
  shouldForwardToContainer({
    envName: "staging",
    hasActiveIngest: true,
    requestLike: { method: "GET", pathname: "/llhls/index.m3u8" },
  }) === true,
);
check(
  "staging dummy DO is not forwarded",
  shouldForwardToContainer({
    envName: "staging",
    streamId: "aaaa",
    hasActiveIngest: false,
    requestLike: { method: "GET", pathname: "/health" },
  }) === false,
);
check(
  "production always forwards (fail-closed)",
  shouldForwardToContainer({
    envName: "production",
    hasActiveIngest: false,
    requestLike: { method: "GET", pathname: "/llhls/index.m3u8" },
  }) === true,
);

const now = 1_000_000;
check(
  "watchdog staging no ingest → stop",
  resolveIngestIdleWatchdog({ envName: "staging", nowMs: now }).action === "stop",
);
check(
  "watchdog staging ingest idle > 2m → stop",
  resolveIngestIdleWatchdog({ envName: "staging", nowMs: now, lastIngestAtMs: now - 121_000 }).action === "stop",
);
check(
  "watchdog staging within 2m → keep",
  resolveIngestIdleWatchdog({ envName: "staging", nowMs: now, lastIngestAtMs: now - 30_000 }).action === "keep",
);
check(
  "watchdog staging open session → keep",
  resolveIngestIdleWatchdog({ envName: "staging", hasOpenIngestSession: true, lastIngestAtMs: 1 }).action === "keep",
);
check(
  "watchdog production skip",
  resolveIngestIdleWatchdog({ envName: "production", nowMs: now }).action === "skip",
);
check(
  "activityExpired staging idle → stop (does not rely on platform timer)",
  resolveActivityExpiredAction({ envName: "staging", hasActiveIngest: false }).action === "stop",
);

const stopCalls = [];
const stagingContainer = {
  stop: async () => {
    stopCalls.push("stop");
  },
  destroy: async () => {
    stopCalls.push("destroy");
  },
};
const idleResult = await runActivityExpired(stagingContainer, { envName: "staging", hasActiveIngest: false });
check("runActivityExpired staging idle destroy/stop", idleResult.stopped && idleResult.deletedDefinition === false && stopCalls.includes("destroy"));

stopCalls.length = 0;
const keepResult = await runActivityExpired(stagingContainer, { envName: "staging", hasActiveIngest: true });
check("runActivityExpired staging ingest does not stop", !keepResult.stopped && stopCalls.length === 0);

stopCalls.length = 0;
const prodResult = await runActivityExpired(stagingContainer, { envName: "production", hasActiveIngest: false });
check("runActivityExpired production defers", prodResult.defer && !prodResult.stopped && stopCalls.length === 0);

stopCalls.length = 0;
const wd = await runIngestIdleWatchdog(stagingContainer, { envName: "staging", nowMs: now, lastIngestAtMs: now - 200_000 });
check("watchdog runner stops stale DO", wd.stopped && wd.deletedDefinition === false);

const deniedProd = await runV1Stop(stagingContainer, {
  envName: "production",
  ingestJwtOk: true,
  method: "POST",
  pathname: V1_STOP_PATH,
});
check("POST /v1/stop refuses production", deniedProd.error === "production_mutation_prohibited" && !deniedProd.stopped);

const deniedToken = await runV1Stop(stagingContainer, {
  envName: "staging",
  ingestJwtOk: false,
  method: "POST",
  pathname: V1_STOP_PATH,
});
check("POST /v1/stop refuses missing ingest JWT", deniedToken.error === "unauthorized");

stopCalls.length = 0;
const allowedStop = await runV1Stop(stagingContainer, {
  envName: "staging",
  ingestJwtOk: true,
  method: "POST",
  pathname: V1_STOP_PATH,
});
check("POST /v1/stop is SAFE_SHUTDOWN", allowedStop.ok && allowedStop.stopped && !allowedStop.deletedDefinition);

const adminDestroy = await runV1AdminStop(stagingContainer, {
  envName: "staging",
  adminStopGo: "1",
  tokenOk: true,
  method: "POST",
  pathname: V1_ADMIN_DESTROY_PATH,
});
check("/v1/admin-destroy stays hard 404", adminDestroy.status === 404 && !adminDestroy.stopped);

const adminNoGo = await runV1AdminStop(stagingContainer, {
  envName: "staging",
  adminStopGo: "0",
  tokenOk: true,
  method: "POST",
  pathname: V1_ADMIN_STOP_PATH,
});
check("/v1/admin-stop without Human GO is 404", adminNoGo.status === 404 && !adminNoGo.stopped);

const adminProd = await runV1AdminStop(stagingContainer, {
  envName: "production",
  adminStopGo: "1",
  tokenOk: true,
  method: "POST",
  pathname: V1_ADMIN_STOP_PATH,
});
check("/v1/admin-stop production forbidden", adminProd.error === "production_mutation_prohibited" && !adminProd.stopped);

stopCalls.length = 0;
const adminGo = await runV1AdminStop(stagingContainer, {
  envName: "staging",
  adminStopGo: "1",
  tokenOk: true,
  method: "POST",
  pathname: V1_ADMIN_STOP_PATH,
});
check("/v1/admin-stop Staging + Human GO stops instance only", adminGo.ok && adminGo.stopped && !adminGo.deletedDefinition);

const guarded = await handleStagingContainerRequest({
  envName: "staging",
  requestLike: { method: "GET", pathname: "/llhls/index.m3u8" },
  hasActiveIngest: false,
  container: stagingContainer,
});
check("fetch-guard returns 410 for idle playback (no Container.fetch)", guarded.handled && guarded.response?.status === 410);

check("countActiveStreams ignores ended", countActiveStreams([{ status: "ended" }, { status: "live" }, { status: "removed" }]) === 1);

const finding = evaluateIdleCostFinding({
  envName: "staging",
  liveInstances: 7,
  activeStreamCount: 0,
  idleSeconds: 3600,
});
check("guardrail FINDING for 7 live / 0 streams past idle", finding.finding && finding.code === FINDING_CODE && finding.severity === "HIGH");
check("guardrail never auto-deletes", finding.autoDelete === false);
check(
  "guardrail recommends /v1/stop not delete",
  finding.recommendedActions.some((a) => a.includes("/v1/stop")) &&
    finding.recommendedActions.every((a) => !/delete container/i.test(a)) &&
    FORBIDDEN_SHUTDOWN_ACTIONS.includes("dashboard Delete Container") &&
    SAFE_SHUTDOWN_METHODS.length >= 1,
);

const noFinding = evaluateIdleCostFinding({
  envName: "staging",
  liveInstances: 7,
  activeStreamCount: 1,
  idleSeconds: 3600,
});
check("no FINDING while a stream is active", !noFinding.finding);

const slept = evaluateIdleCostFinding({
  envName: "staging",
  liveInstances: 0,
  activeStreamCount: 0,
  idleSeconds: 3600,
});
check("no FINDING when live=0", !slept.finding);

const prodFinding = evaluateIdleCostFinding({
  envName: "production",
  liveInstances: 7,
  activeStreamCount: 0,
  idleSeconds: 3600,
});
check("production LIVE=7 FINDING is CRITICAL observe-only", prodFinding.finding && prodFinding.severity === "CRITICAL" && prodFinding.productionMutation === false);

const collected = await collectIdleCostEvidence({
  envName: "staging",
  idleSeconds: 172800,
  listContainerLiveInstances: async () => 7,
  listBroadcastRows: async () => [{ status: "ended" }, { status: "failed" }],
});
check(
  "collectIdleCostEvidence marks FINDING without secrets",
  collected.evaluation.finding &&
    collected.liveInstances === 7 &&
    collected.activeStreamCount === 0 &&
    !JSON.stringify(collected).includes("Bearer "),
);

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} PASS`);
if (failed.length) {
  console.error("FAILED:", failed.map((f) => f.name).join(", "));
  process.exit(1);
}
