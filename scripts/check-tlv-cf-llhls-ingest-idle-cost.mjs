#!/usr/bin/env node
/**
 * Read-only idle-cost check for TLV CF LL-HLS ingest Containers.
 *
 *   node scripts/check-tlv-cf-llhls-ingest-idle-cost.mjs
 *   node scripts/check-tlv-cf-llhls-ingest-idle-cost.mjs --env=staging --fixture=path.json
 *
 * Never runs wrangler containers delete / Dashboard Delete Container.
 * Production is observe-only.
 */

import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  collectIdleCostEvidence,
  evaluateIdleCostFinding,
  wranglerReadOnlyCommands,
  STAGING_CONTAINER_APP,
  PRODUCTION_CONTAINER_APP,
  PRODUCTION_WORKER_NAME,
} from "./lib/tlv-cf-llhls-ingest-cost-guardrail.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const EVIDENCE_DIR = join(
  ROOT,
  "reports/tasful-tlv-cf-staging-container-cost-remediation-v1/evidence",
);

function argValue(flag, fallback = null) {
  const prefix = `${flag}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : fallback;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function loadFixture(pathArg) {
  if (!pathArg) return null;
  const full = resolve(ROOT, pathArg);
  return JSON.parse(readFileSync(full, "utf8"));
}

function tryWranglerJson(args) {
  if (hasFlag("--no-wrangler")) return { ok: false, reason: "disabled" };
  const wrangler = spawnSync("wrangler", args, {
    encoding: "utf8",
    timeout: 20000,
    env: process.env,
  });
  if (wrangler.error || wrangler.status !== 0) {
    return {
      ok: false,
      reason: wrangler.error?.message || wrangler.stderr?.slice(0, 300) || "wrangler_unavailable",
    };
  }
  try {
    return { ok: true, data: JSON.parse(wrangler.stdout || "null") };
  } catch {
    return { ok: false, reason: "wrangler_json_parse_failed" };
  }
}

function countLiveFromWranglerInstances(payload) {
  const rows = Array.isArray(payload) ? payload : payload?.instances || payload?.result || [];
  if (!Array.isArray(rows)) return null;
  return rows.filter((row) => {
    const state = String(row?.state || row?.status || "").toLowerCase();
    return state === "running" || state === "active" || state === "live";
  }).length;
}

async function maybeListLiveInstances(envName, fixture) {
  if (fixture?.liveInstances != null) return Number(fixture.liveInstances);
  if (envName === "production") {
    const listed = tryWranglerJson(["containers", "list"]);
    if (listed.ok) {
      const apps = Array.isArray(listed.data) ? listed.data : listed.data?.result || [];
      const prod = apps.find((app) =>
        String(app?.name || "").includes("tlv-cf-llhls-ingest-production"),
      );
      if (prod?.id) {
        const instances = tryWranglerJson(["containers", "instances", String(prod.id), "--json"]);
        if (instances.ok) return countLiveFromWranglerInstances(instances.data);
      }
    }
    return null;
  }
  const listed = tryWranglerJson(["containers", "list"]);
  if (!listed.ok) return null;
  const apps = Array.isArray(listed.data) ? listed.data : listed.data?.result || [];
  const staging = apps.find((app) =>
    String(app?.name || "").includes("tlv-cf-llhls-ingest-staging"),
  );
  if (!staging?.id) return null;
  const instances = tryWranglerJson(["containers", "instances", String(staging.id), "--json"]);
  if (!instances.ok) return null;
  return countLiveFromWranglerInstances(instances.data);
}

async function maybeListBroadcasts(fixture) {
  if (Array.isArray(fixture?.broadcasts)) return fixture.broadcasts;
  if (fixture?.activeStreamCount != null) {
    return Array.from({ length: Number(fixture.activeStreamCount) }, () => ({ status: "live" }));
  }
  const url = process.env.SUPABASE_URL || process.env.STAGING_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.STAGING_SUPABASE_ANON_KEY;
  if (!url || !key || hasFlag("--no-supabase")) return null;
  const endpoint = `${String(url).replace(/\/$/, "")}/rest/v1/live_broadcasts?select=status`;
  const res = await fetch(endpoint, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`supabase_live_broadcasts_${res.status}`);
  return res.json();
}

const envName = argValue("--env", "staging");
const fixture = loadFixture(argValue("--fixture"));
const idleSeconds =
  fixture?.idleSeconds != null
    ? Number(fixture.idleSeconds)
    : argValue("--idle-seconds") != null
      ? Number(argValue("--idle-seconds"))
      : null;

if (envName === "production" && hasFlag("--mutate")) {
  console.error("PRODUCTION_MUTATION=NO — --mutate is refused for production.");
  process.exit(2);
}

const evidence = await collectIdleCostEvidence({
  envName,
  idleSeconds,
  listContainerLiveInstances: async () => maybeListLiveInstances(envName, fixture),
  listBroadcastRows: async () => maybeListBroadcasts(fixture),
});

evidence.check = {
  command: "node scripts/check-tlv-cf-llhls-ingest-idle-cost.mjs",
  wranglerReadOnly: wranglerReadOnlyCommands(),
  stagingContainerApp: STAGING_CONTAINER_APP,
  productionContainerApp: PRODUCTION_CONTAINER_APP,
  productionWorker: PRODUCTION_WORKER_NAME,
  productionMutation: "NO",
  containerDefinitionDeleted: "NO",
};

mkdirSync(EVIDENCE_DIR, { recursive: true });
const outName =
  envName === "production" ? "guardrail-production-observe.json" : "guardrail-run.json";
const outPath = join(EVIDENCE_DIR, outName);
writeFileSync(outPath, `${JSON.stringify(evidence, null, 2)}\n`);

const evalLine = evaluateIdleCostFinding(evidence.evaluation);
const label = evidence.evaluation.finding ? "FINDING" : "OK";
console.log(
  `${label} ${evidence.evaluation.code || "none"} env=${evidence.envName} live=${evidence.liveInstances} streams=${evidence.activeStreamCount} severity=${evidence.evaluation.severity}`,
);
console.log(`evidence=${outPath}`);
console.log("autoDelete=false productionMutation=NO STAGING_CONTAINER_DELETED=NO");

if (hasFlag("--exit-nonzero-on-finding") && evidence.evaluation.finding) {
  process.exit(1);
}

void evalLine;
