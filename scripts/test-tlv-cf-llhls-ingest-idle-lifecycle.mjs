#!/usr/bin/env node
/**
 * TLV CF LL-HLS ingest idle lifecycle + cost guardrail (no network, no deploy).
 *
 *   node scripts/test-tlv-cf-llhls-ingest-idle-lifecycle.mjs
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CONTAINER_CLASS_NAME,
  DASHBOARD_OBSERVED_LIVE,
  FORBIDDEN_SHUTDOWN_ACTIONS,
  INSTANCE_TYPE_STANDARD_3,
  PLATFORM_DEFAULT_SLEEP_AFTER,
  STAGING_SLEEP_AFTER,
  bindStagingSleepAfter,
  classifyRequestActivity,
  correlateInstanceCapacity,
  resolveActivityExpiredAction,
  resolveSleepAfter,
  runActivityExpired,
  runStagingOperatorStop,
  shouldRenewActivityTimeout,
} from "../workers/tlv-cf-llhls-ingest/src/idle-lifecycle.mjs";
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
  const mark = ok ? "PASS" : "FAIL";
  console.log(`${mark}: ${name}${detail ? ` — ${detail}` : ""}`);
}

function walkFiles(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const ent of readdirSync(dir)) {
    if (ent === "node_modules" || ent === ".git" || ent === "deploy") continue;
    const full = join(dir, ent);
    const st = statSync(full);
    if (st.isDirectory()) walkFiles(full, acc);
    else acc.push(full);
  }
  return acc;
}

const files = walkFiles(ROOT);
const repoHasWranglerToml = files.some((p) => /wrangler\.(toml|jsonc?)$/.test(p) && !p.includes("tlv-cf-llhls-ingest"));
const repoHasContainerClass = files.some((p) => {
  if (p.includes("tlv-cf-llhls-ingest")) return false;
  if (!/\.(mjs|js|ts)$/.test(p)) return false;
  const text = readFileSync(p, "utf8");
  return /class\s+TlvCfLlhlsIngestContainer|@cloudflare\/containers/.test(text);
});
const overlayExists = existsSync(join(ROOT, "workers/tlv-cf-llhls-ingest/wrangler.staging.overlay.jsonc"));
const doNotDeployExists = existsSync(join(ROOT, "workers/tlv-cf-llhls-ingest/DO_NOT_DEPLOY.md"));

check("repo has no unpublished-unrelated wrangler worker config for ingest", !repoHasWranglerToml);
check("repo has no TlvCfLlhlsIngestContainer implementation outside overlay", !repoHasContainerClass);
check("overlay + DO_NOT_DEPLOY present", overlayExists && doNotDeployExists);
check("container class name matches dashboard suffix", CONTAINER_CLASS_NAME === "TlvCfLlhlsIngestContainer");

const corr = correlateInstanceCapacity(DASHBOARD_OBSERVED_LIVE.staging);
check(
  "5 live × standard-3 correlates 10 vCPU / 40 GiB / 80 GB",
  corr.matches &&
    corr.expected.vcpu === 10 &&
    corr.expected.memoryGiB === 40 &&
    corr.expected.diskGB === 80,
  JSON.stringify(corr.expected),
);
check("standard-3 is 2 vCPU / 8 GiB / 16 GB", INSTANCE_TYPE_STANDARD_3.vcpu === 2 && INSTANCE_TYPE_STANDARD_3.memoryGiB === 8);

const stagingSleep = resolveSleepAfter("staging");
const prodSleep = resolveSleepAfter("production");
const unknownSleep = resolveSleepAfter("other");
check("staging sleepAfter apply 2m", stagingSleep.apply && stagingSleep.sleepAfter === STAGING_SLEEP_AFTER);
check("production sleepAfter fail-closed", !prodSleep.apply && prodSleep.reason === "production_fail_closed");
check("unknown env fail-closed", !unknownSleep.apply);
check("platform default remains 10m constant", PLATFORM_DEFAULT_SLEEP_AFTER === "10m");

const stagingTarget = { sleepAfter: "10m" };
const prodTarget = { sleepAfter: "10m" };
check("bind staging overwrites sleepAfter", bindStagingSleepAfter(stagingTarget, { envName: "staging" }).applied && stagingTarget.sleepAfter === "2m");
check("bind production is no-op", !bindStagingSleepAfter(prodTarget, { envName: "production" }).applied && prodTarget.sleepAfter === "10m");

check("GET playlist is playback", classifyRequestActivity({ method: "GET", pathname: "/live/a.m3u8" }) === "playback");
check("POST publish is ingest", classifyRequestActivity({ method: "POST", pathname: "/ingest/whip" }) === "ingest");
check(
  "staging playback without ingest does not renew",
  shouldRenewActivityTimeout({
    envName: "staging",
    hasActiveIngest: false,
    requestLike: { method: "GET", pathname: "/llhls/index.m3u8" },
  }) === false,
);
check(
  "staging playback with ingest does renew (stream uninterrupted)",
  shouldRenewActivityTimeout({
    envName: "staging",
    hasActiveIngest: true,
    requestLike: { method: "GET", pathname: "/llhls/index.m3u8" },
  }) === true,
);
check(
  "production playback still renews (fail-closed)",
  shouldRenewActivityTimeout({
    envName: "production",
    hasActiveIngest: false,
    requestLike: { method: "GET", pathname: "/llhls/index.m3u8" },
  }) === true,
);

check(
  "staging idle expired → stop",
  resolveActivityExpiredAction({ envName: "staging", hasActiveIngest: false }).action === "stop",
);
check(
  "staging active ingest expired → keep",
  resolveActivityExpiredAction({ envName: "staging", hasActiveIngest: true }).action === "keep",
);
check(
  "production expired → platform-default",
  resolveActivityExpiredAction({ envName: "production", hasActiveIngest: false }).action === "platform-default",
);

const stopCalls = [];
const stagingContainer = {
  stop: async () => {
    stopCalls.push("stop");
  },
  renewActivityTimeout: () => {
    stopCalls.push("renew");
  },
};
const idleResult = await runActivityExpired(stagingContainer, { envName: "staging", hasActiveIngest: false });
check("runActivityExpired staging idle calls stop once", idleResult.stopped && stopCalls.join(",") === "stop" && idleResult.deletedDefinition === false);

stopCalls.length = 0;
const keepResult = await runActivityExpired(stagingContainer, { envName: "staging", hasActiveIngest: true });
check("runActivityExpired staging ingest renews not stops", !keepResult.stopped && stopCalls.join(",") === "renew");

stopCalls.length = 0;
const prodResult = await runActivityExpired(stagingContainer, { envName: "production", hasActiveIngest: false });
check("runActivityExpired production defers (no stop)", prodResult.defer && !prodResult.stopped && stopCalls.length === 0);

const deniedProd = await runStagingOperatorStop(stagingContainer, {
  envName: "production",
  tokenOk: true,
  method: "POST",
  pathname: "/internal/lifecycle/stop",
});
check("operator stop refuses production", deniedProd.error === "production_mutation_prohibited" && !deniedProd.stopped);

const deniedToken = await runStagingOperatorStop(stagingContainer, {
  envName: "staging",
  tokenOk: false,
  method: "POST",
  pathname: "/internal/lifecycle/stop",
});
check("operator stop refuses missing token", deniedToken.error === "unauthorized");

stopCalls.length = 0;
const allowedStop = await runStagingOperatorStop(stagingContainer, {
  envName: "staging",
  tokenOk: true,
  method: "POST",
  pathname: "/internal/lifecycle/stop",
});
check("operator stop staging calls Container.stop only", allowedStop.ok && allowedStop.stopped && !allowedStop.deletedDefinition && stopCalls.join(",") === "stop");

check("countActiveStreams ignores ended", countActiveStreams([{ status: "ended" }, { status: "live" }, { status: "removed" }]) === 1);

const finding = evaluateIdleCostFinding({
  envName: "staging",
  liveInstances: 5,
  activeStreamCount: 0,
  idleSeconds: 3600,
});
check("guardrail FINDING for 5 live / 0 streams past idle", finding.finding && finding.code === FINDING_CODE && finding.severity === "HIGH");
check("guardrail never auto-deletes", finding.autoDelete === false);
check(
  "guardrail does not recommend definition delete",
  finding.recommendedActions.every((a) => !/delete container/i.test(a)) &&
    FORBIDDEN_SHUTDOWN_ACTIONS.includes("dashboard Delete Container") &&
    SAFE_SHUTDOWN_METHODS.length >= 1,
);

const noFinding = evaluateIdleCostFinding({
  envName: "staging",
  liveInstances: 5,
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
  liveInstances: 2,
  activeStreamCount: 0,
  idleSeconds: 3600,
});
check("production FINDING is CRITICAL observe-only", prodFinding.finding && prodFinding.severity === "CRITICAL" && prodFinding.productionMutation === false);

const collected = await collectIdleCostEvidence({
  envName: "staging",
  idleSeconds: 7200,
  listContainerLiveInstances: async () => 5,
  listBroadcastRows: async () => [{ status: "ended" }, { status: "failed" }],
});
check(
  "collectIdleCostEvidence marks FINDING without secrets",
  collected.evaluation.finding &&
    collected.liveInstances === 5 &&
    collected.activeStreamCount === 0 &&
    !JSON.stringify(collected).includes("Bearer "),
);

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} PASS`);
if (failed.length) {
  console.error("FAILED:", failed.map((f) => f.name).join(", "));
  process.exit(1);
}
