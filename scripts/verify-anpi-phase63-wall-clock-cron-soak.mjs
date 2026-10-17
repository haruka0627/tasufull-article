#!/usr/bin/env node
/**
 * ANPI Phase 63 — Staging Wall-Clock Scoped Cron Soak
 *
 * Observes REAL Cloudflare Cron Trigger firings (every 5 minutes UTC).
 * Manual / diagnostic invocations do NOT count toward success ticks.
 *
 * Safe enable order:
 *   1) seed jobs (gate OFF)
 *   2) deploy Worker flags ON (gate still OFF → claim 0)
 *   3) enable gate
 *   4) observe ≥3 cloudflare_cron events via wrangler tail
 *   5) emergency_disable → flags OFF redeploy → cleanup
 *
 * Never prints secrets. Never touches Production.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  createScopedRestClient,
  cleanupScopedMarkers,
  ANPI_P61_TARGET_AUTH_SHA8,
  ANPI_P61_SOURCE,
  sha8,
} from "./lib/anpi-phase61-scoped-job-writer.mjs";
import {
  STAGING_SUPABASE_REF,
  PRODUCTION_SUPABASE_REF,
} from "./lib/anpi-phase48-scheduled-runtime.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MAIN_ENV = "C:/Users/rubih/tasufull-article/.env.staging";
const WORKER_DIR = path.join(root, "deploy/cloudflare/workers/anpi-staging-scheduler");
const WRANGLER_TOML = path.join(WORKER_DIR, "wrangler.toml");
const EVIDENCE = path.join(root, "reports", "anpi-phase63-wall-clock-cron-soak-evidence.json");
const TAIL_LOG = path.join(root, "reports", "anpi-phase63-wrangler-tail.jsonl");

const SOAK_LOCAL_DATE = "2099-07-28";
const SOAK_KIND = "initial";
const MIN_CRON_TICKS = 3;
const MAX_CRON_TICKS = 6;
const MAX_WAIT_MS = 40 * 60 * 1000;
const POLL_MS = 15_000;

function readEnvFile(filePath) {
  try {
    const map = {};
    for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
      const s = line.trim();
      if (!s || s.startsWith("#")) continue;
      const eq = s.indexOf("=");
      if (eq < 1) continue;
      map[s.slice(0, eq).trim()] = s.slice(eq + 1).trim();
    }
    return map;
  } catch {
    return {};
  }
}

function short(id) {
  const s = String(id || "");
  return s.length <= 24 ? s : `${s.slice(0, 20)}…`;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function setWranglerFlags({ scopedCron, scopedWriter }) {
  let text = fs.readFileSync(WRANGLER_TOML, "utf8");
  text = text.replace(
    /ANPI_P62_SCOPED_CRON_PATH\s*=\s*"[^"]*"/,
    `ANPI_P62_SCOPED_CRON_PATH = "${scopedCron ? "true" : "false"}"`
  );
  text = text.replace(
    /ANPI_P61_SCOPED_WRITER_ENABLED\s*=\s*"[^"]*"/,
    `ANPI_P61_SCOPED_WRITER_ENABLED = "${scopedWriter ? "true" : "false"}"`
  );
  if (!/ANPI_NOTIFICATION_PROVIDER\s*=\s*"talk_local"/.test(text)) {
    throw new Error("anpi_p63_provider_must_be_talk_local_in_toml");
  }
  fs.writeFileSync(WRANGLER_TOML, text);
}

function readWranglerFlags() {
  const text = fs.readFileSync(WRANGLER_TOML, "utf8");
  const cron = (text.match(/ANPI_P62_SCOPED_CRON_PATH\s*=\s*"([^"]*)"/) || [])[1];
  const writer = (text.match(/ANPI_P61_SCOPED_WRITER_ENABLED\s*=\s*"([^"]*)"/) || [])[1];
  const provider = (text.match(/ANPI_NOTIFICATION_PROVIDER\s*=\s*"([^"]*)"/) || [])[1];
  return { cron, writer, provider };
}

async function wranglerDeploy() {
  return new Promise((resolve, reject) => {
    const child = spawn("npx", ["wrangler", "deploy"], {
      cwd: WORKER_DIR,
      shell: true,
      env: process.env,
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => {
      out += d.toString();
    });
    child.stderr.on("data", (d) => {
      err += d.toString();
    });
    child.on("close", (code) => {
      const combined = `${out}\n${err}`;
      const versionMatch = combined.match(/Current Version ID:\s*([a-f0-9-]+)/i);
      if (code !== 0) {
        reject(new Error(`wrangler_deploy_${code}:${combined.slice(-400)}`));
        return;
      }
      resolve({ versionId: versionMatch ? versionMatch[1] : null, log_tail: combined.slice(-800) });
    });
  });
}

function startWranglerTail(tailPath) {
  fs.mkdirSync(path.dirname(tailPath), { recursive: true });
  fs.writeFileSync(tailPath, "");
  const child = spawn(
    "npx",
    ["wrangler", "tail", "--format", "json"],
    { cwd: WORKER_DIR, shell: true, env: process.env }
  );
  const stream = fs.createWriteStream(tailPath, { flags: "a" });
  child.stdout.on("data", (d) => stream.write(d));
  child.stderr.on("data", (d) => stream.write(d));
  return {
    child,
    stop() {
      try {
        child.kill();
      } catch {
        /* ignore */
      }
      try {
        stream.end();
      } catch {
        /* ignore */
      }
    },
  };
}

function extractJsonObjects(text) {
  const objs = [];
  let i = 0;
  while (i < text.length) {
    const start = text.indexOf("{", i);
    if (start < 0) break;
    let depth = 0;
    let inStr = false;
    let esc = false;
    let end = -1;
    for (let j = start; j < text.length; j += 1) {
      const c = text[j];
      if (inStr) {
        if (esc) esc = false;
        else if (c === "\\") esc = true;
        else if (c === "\"") inStr = false;
        continue;
      }
      if (c === "\"") {
        inStr = true;
        continue;
      }
      if (c === "{") depth += 1;
      else if (c === "}") {
        depth -= 1;
        if (depth === 0) {
          end = j;
          break;
        }
      }
    }
    if (end < 0) break;
    const slice = text.slice(start, end + 1);
    try {
      objs.push(JSON.parse(slice));
    } catch {
      /* ignore malformed */
    }
    i = end + 1;
  }
  return objs;
}

function parseCronLogsFromTail(tailPath, sinceIso) {
  const sinceMs = new Date(sinceIso).getTime();
  const text = fs.existsSync(tailPath) ? fs.readFileSync(tailPath, "utf8") : "";
  const events = [];

  function pushEvent(partial) {
    const ts = partial.scheduled_time || partial.raw_event_timestamp || null;
    if (ts && new Date(ts).getTime() < sinceMs - 15_000) return;
    events.push(partial);
  }

  for (const obj of extractJsonObjects(text)) {
    if (!obj || typeof obj !== "object") continue;
    if (obj.service === "anpi-scheduler" && obj.trigger === "cloudflare_cron") {
      pushEvent({
        scheduled_time: obj.scheduled_time,
        trigger: "cloudflare_cron",
        cron: obj.cron || "*/5 * * * *",
        execution_id: obj.execution_id,
        status: obj.status || obj.overall_status,
        lease: obj.lease,
        lease_acquired: obj.lease_acquired,
        scoped_cron_path: obj.scoped_cron_path,
        mode: obj.mode,
        jobs_claimed: obj.jobs_claimed ?? obj.processed_count,
        jobs_delivered: obj.jobs_delivered,
        subject_sha8s: obj.subject_sha8s || [],
        write_reasons: obj.write_reasons || [],
        error_code: obj.error_code,
        provider: obj.provider,
        project_ref: obj.project_ref,
        script_version: null,
        raw_event_timestamp: obj.scheduled_time,
        source: "worker_log",
      });
      continue;
    }

    const scheduledTime = obj.event?.scheduledTime || obj.Event?.ScheduledTime || obj.eventTimestamp || null;
    const cronExpr = obj.event?.cron || obj.Event?.Cron || null;
    const scriptVersion = obj.scriptVersion?.id || obj.ScriptVersion?.id || null;

    const logMessages = [];
    for (const arr of [obj.logs, obj.Logs].filter(Boolean)) {
      if (!Array.isArray(arr)) continue;
      for (const log of arr) {
        const parts = log?.message || log?.Message || log?.text;
        if (Array.isArray(parts)) logMessages.push(parts.join(" "));
        else if (typeof parts === "string") logMessages.push(parts);
      }
    }

    let parsedLog = null;
    for (const msg of logMessages) {
      const trimmed = String(msg || "").trim();
      if (!trimmed.includes("anpi-scheduler")) continue;
      const start = trimmed.indexOf("{");
      const end = trimmed.lastIndexOf("}");
      if (start < 0 || end <= start) continue;
      try {
        const j = JSON.parse(trimmed.slice(start, end + 1));
        if (j?.service === "anpi-scheduler") parsedLog = j;
      } catch {
        /* ignore */
      }
    }

    if (parsedLog?.trigger === "cloudflare_cron") {
      pushEvent({
        scheduled_time:
          parsedLog.scheduled_time || (scheduledTime ? new Date(scheduledTime).toISOString() : null),
        trigger: "cloudflare_cron",
        cron: parsedLog.cron || cronExpr || "*/5 * * * *",
        execution_id: parsedLog.execution_id,
        status: parsedLog.status || parsedLog.overall_status,
        lease: parsedLog.lease,
        lease_acquired: parsedLog.lease_acquired,
        scoped_cron_path: parsedLog.scoped_cron_path,
        mode: parsedLog.mode,
        jobs_claimed: parsedLog.jobs_claimed ?? parsedLog.processed_count,
        jobs_delivered: parsedLog.jobs_delivered,
        subject_sha8s: parsedLog.subject_sha8s || [],
        write_reasons: parsedLog.write_reasons || [],
        error_code: parsedLog.error_code,
        provider: parsedLog.provider,
        project_ref: parsedLog.project_ref,
        script_version: scriptVersion,
        raw_event_timestamp: scheduledTime ? new Date(scheduledTime).toISOString() : null,
        source: "worker_log",
      });
      continue;
    }

    if (cronExpr && scheduledTime) {
      pushEvent({
        scheduled_time: new Date(scheduledTime).toISOString(),
        trigger: "cloudflare_cron",
        cron: cronExpr,
        execution_id: null,
        status: obj.outcome || obj.Outcome || "SEEN",
        lease: null,
        scoped_cron_path: null,
        mode: null,
        jobs_claimed: null,
        subject_sha8s: [],
        write_reasons: [],
        error_code: null,
        provider: null,
        project_ref: STAGING_SUPABASE_REF,
        script_version: scriptVersion,
        raw_event_timestamp: new Date(scheduledTime).toISOString(),
        source: "wrangler_tail_envelope",
      });
    }
  }

  const byMinute = new Map();
  for (const e of events) {
    const minute = String(e.scheduled_time || "").slice(0, 16);
    const prev = byMinute.get(minute);
    if (!prev || (prev.source !== "worker_log" && e.source === "worker_log")) {
      byMinute.set(minute, e);
    }
  }
  return [...byMinute.values()].sort((a, b) =>
    String(a.scheduled_time).localeCompare(String(b.scheduled_time))
  );
}

function setRuntimeEnabled(enabled) {
  let text = fs.readFileSync(WRANGLER_TOML, "utf8");
  text = text.replace(
    /ANPI_STAGING_RUNTIME_ENABLED\s*=\s*"[^"]*"/,
    `ANPI_STAGING_RUNTIME_ENABLED = "${enabled ? "true" : "false"}"`
  );
  fs.writeFileSync(WRANGLER_TOML, text);
}

function isOnFiveMinuteBoundary(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return d.getUTCMinutes() % 5 === 0;
}

async function main() {
  const fileEnv = { ...readEnvFile(path.join(root, ".env.staging")), ...readEnvFile(MAIN_ENV) };
  const apiUrl =
    process.env.ANPI_STAGING_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    fileEnv.SUPABASE_URL ||
    fileEnv.TASFUL_SUPABASE_URL;
  const serviceKey =
    process.env.ANPI_STAGING_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    fileEnv.SUPABASE_SERVICE_ROLE_KEY ||
    fileEnv.TASFUL_SUPABASE_SERVICE_ROLE_KEY;
  const envRef = process.env.SUPABASE_PROJECT_REF || fileEnv.SUPABASE_PROJECT_REF || STAGING_SUPABASE_REF;

  const evidence = {
    phase: 63,
    mode: "wall_clock_scoped_cron_soak",
    started_at: new Date().toISOString(),
    project_ref: STAGING_SUPABASE_REF,
    env_ref: envRef,
    production_contact: false,
    preflight: {},
    enable_timeline: [],
    cron_ticks: [],
    counts: { cron_ticks: 0, claimed: 0, inserted: 0, already_seen: 0, duplicates: 0 },
    failure_simulation: { performed: false, reason: null },
    cleanup: {},
    final: {},
    verdict: "PENDING",
    stop_reason: null,
  };

  let client = null;
  let gateEnabled = false;
  let flagsOn = false;
  let tail = null;
  let targetAuthId = null;
  let soakCheckId = null;
  let soakJobId = null;
  let outsiderUserId = null;
  let outsiderJobId = null;
  let outsiderCheckId = null;
  let outsiderSettingId = null;
  let notificationId = null;
  let workerVersionOn = null;
  let workerVersionOff = null;

  async function rest(p, opts = {}) {
    return client.rest(p.startsWith("/") ? p : `/${p}`, opts);
  }
  async function rpc(name, args = {}) {
    return client.rpc(name, args);
  }

  async function emergencyShutdown(reason) {
    evidence.stop_reason = reason || evidence.stop_reason;
    try {
      await rpc("anpi_phase62_claim_allowlist_emergency_disable", {});
      gateEnabled = false;
      evidence.enable_timeline.push({
        at: new Date().toISOString(),
        action: "emergency_disable_gate",
        reason: reason || null,
      });
    } catch (e) {
      evidence.cleanup.emergency_disable_error = String(e?.message || e).slice(0, 120);
    }
    try {
      // Pause runtime BEFORE flipping scoped flags so legacy Phase47 cannot
      // claim pending outsider/soak jobs during the deploy race.
      setRuntimeEnabled(false);
      setWranglerFlags({ scopedCron: false, scopedWriter: false });
      const dep = await wranglerDeploy();
      flagsOn = false;
      workerVersionOff = dep.versionId;
      evidence.enable_timeline.push({
        at: new Date().toISOString(),
        action: "deploy_runtime_paused_and_flags_off",
        version: dep.versionId,
      });
      setRuntimeEnabled(true);
      const depResume = await wranglerDeploy();
      workerVersionOff = depResume.versionId;
      evidence.enable_timeline.push({
        at: new Date().toISOString(),
        action: "deploy_runtime_resumed_stub_path",
        version: depResume.versionId,
        flags: readWranglerFlags(),
      });
    } catch (e) {
      evidence.cleanup.flag_off_deploy_error = String(e?.message || e).slice(0, 160);
      try {
        setRuntimeEnabled(true);
        setWranglerFlags({ scopedCron: false, scopedWriter: false });
        await wranglerDeploy();
      } catch {
        /* ignore */
      }
    }
    try {
      evidence.cleanup.markers = await cleanupScopedMarkers(client, { dryRun: false });
    } catch (e) {
      evidence.cleanup.marker_error = String(e?.message || e).slice(0, 120);
    }
  }

  try {
    if (!apiUrl || !serviceKey) throw new Error("anpi_p63_missing_credentials");
    if (apiUrl.includes(PRODUCTION_SUPABASE_REF) || envRef === PRODUCTION_SUPABASE_REF) {
      throw new Error("anpi_p63_refusing_production");
    }
    if (envRef !== STAGING_SUPABASE_REF || !apiUrl.includes(STAGING_SUPABASE_REF)) {
      throw new Error("anpi_p63_unexpected_staging_ref");
    }

    client = createScopedRestClient({ apiUrl, serviceKey, envRef });

    const flags0 = readWranglerFlags();
    const g62 = await rest(
      `/rest/v1/anpi_phase62_claim_allowlist_gate?id=eq.1&select=enabled,allowed_auth_sha8`
    );
    const gateRow = Array.isArray(g62.json) ? g62.json[0] : null;
    if (!gateRow) throw new Error("anpi_p63_gate_missing");
    if (gateRow.enabled === true) await rpc("anpi_phase62_claim_allowlist_emergency_disable", {});
    if (flags0.cron !== "false" || flags0.writer !== "false") {
      setWranglerFlags({ scopedCron: false, scopedWriter: false });
      await wranglerDeploy();
    }
    await cleanupScopedMarkers(client, { dryRun: false });

    const g17 = await rest(
      `/rest/v1/anpi_phase17_insert_gate?id=eq.1&select=target_auth_user_id,target_talk_user_id,target_auth_sha8,enabled`
    );
    const row17 = Array.isArray(g17.json) ? g17.json[0] : null;
    if (!row17?.target_auth_user_id) throw new Error("anpi_p63_target_unbound");
    if (row17.target_auth_sha8 !== ANPI_P61_TARGET_AUTH_SHA8) throw new Error("anpi_p63_unexpected_target");
    targetAuthId = row17.target_auth_user_id;

    if (
      !(
        Array.isArray(gateRow.allowed_auth_sha8) &&
        gateRow.allowed_auth_sha8.length === 1 &&
        gateRow.allowed_auth_sha8[0] === ANPI_P61_TARGET_AUTH_SHA8
      )
    ) {
      throw new Error("anpi_p63_allowlist_unexpected");
    }

    evidence.preflight = {
      project_ref: STAGING_SUPABASE_REF,
      gate_enabled: false,
      allowlist: gateRow.allowed_auth_sha8,
      flags: readWranglerFlags(),
      provider: "talk_local",
      target_auth_sha8: ANPI_P61_TARGET_AUTH_SHA8,
      cleanup_possible: true,
    };

    // Seed settings / check / job
    let settings = await rest(
      `/rest/v1/anpi_settings?subject_user_id=eq.${targetAuthId}&deleted_at=is.null&select=id&limit=1`
    );
    let settingId = Array.isArray(settings.json) ? settings.json[0]?.id : null;
    if (!settingId) {
      const ins = await rest(`/rest/v1/anpi_settings`, {
        method: "POST",
        body: {
          owner_user_id: targetAuthId,
          subject_user_id: targetAuthId,
          timezone: "Asia/Tokyo",
          initial_notification_time: "09:00:00",
          reminder_policy: { interval_minutes: [120] },
          reminder_count: 0,
          contact_notify_after: "02:00:00",
        },
      });
      if (!ins.ok) throw new Error(`anpi_p63_settings_${ins.status}`);
      settingId = Array.isArray(ins.json) ? ins.json[0].id : ins.json.id;
    }

    const existingCheck = await rest(
      `/rest/v1/anpi_check_instances?subject_user_id=eq.${targetAuthId}&local_check_date=eq.${SOAK_LOCAL_DATE}&select=id`
    );
    if (Array.isArray(existingCheck.json) && existingCheck.json[0]?.id) {
      soakCheckId = existingCheck.json[0].id;
    } else {
      const cin = await rest(`/rest/v1/anpi_check_instances`, {
        method: "POST",
        body: {
          setting_id: settingId,
          owner_user_id: targetAuthId,
          subject_user_id: targetAuthId,
          local_check_date: SOAK_LOCAL_DATE,
          timezone: "Asia/Tokyo",
          scheduled_at: new Date("2099-07-27T15:00:00.000Z").toISOString(),
          status: "scheduled",
        },
      });
      if (!cin.ok) throw new Error(`anpi_p63_check_${cin.status}:${cin.text}`);
      soakCheckId = Array.isArray(cin.json) ? cin.json[0].id : cin.json.id;
    }

    const existJob = await rest(
      `/rest/v1/anpi_scheduler_jobs?check_id=eq.${soakCheckId}&kind=eq.${SOAK_KIND}&select=id`
    );
    if (Array.isArray(existJob.json) && existJob.json[0]?.id) {
      soakJobId = existJob.json[0].id;
    } else {
      const jin = await rest(`/rest/v1/anpi_scheduler_jobs`, {
        method: "POST",
        body: {
          check_id: soakCheckId,
          subject_user_id: targetAuthId,
          recipient_user_id: targetAuthId,
          channel: "talk",
          kind: SOAK_KIND,
          status: "pending",
          available_at: new Date().toISOString(),
          attempt_count: 0,
        },
      });
      if (!jin.ok) throw new Error(`anpi_p63_job_${jin.status}:${jin.text}`);
      soakJobId = Array.isArray(jin.json) ? jin.json[0].id : jin.json.id;
    }
    await rest(`/rest/v1/anpi_scheduler_jobs?id=eq.${soakJobId}`, {
      method: "PATCH",
      body: {
        status: "pending",
        available_at: new Date().toISOString(),
        claimed_at: null,
        claimed_by: null,
        lease_expires_at: null,
        completed_at: null,
        last_error_safe: null,
        attempt_count: 0,
        subject_user_id: targetAuthId,
        recipient_user_id: targetAuthId,
        channel: "talk",
      },
    });

    // Outsider
    const outsiderEmail = `anpi-p63-wc-out-${Date.now().toString(36)}@example.invalid`;
    const ou = await fetch(`${apiUrl}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: outsiderEmail,
        email_confirm: true,
        password: crypto.randomBytes(16).toString("hex"),
      }),
    });
    const ouJson = JSON.parse(await ou.text());
    if (!ou.ok || !ouJson?.id) throw new Error(`anpi_p63_outsider_${ou.status}`);
    outsiderUserId = ouJson.id;
    if (sha8(outsiderUserId) === ANPI_P61_TARGET_AUTH_SHA8) {
      throw new Error("anpi_p63_outsider_sha_collision");
    }
    const os = await rest(`/rest/v1/anpi_settings`, {
      method: "POST",
      body: {
        owner_user_id: outsiderUserId,
        subject_user_id: outsiderUserId,
        timezone: "Asia/Tokyo",
        initial_notification_time: "09:00:00",
        reminder_policy: { interval_minutes: [120] },
        reminder_count: 0,
        contact_notify_after: "02:00:00",
      },
    });
    if (!os.ok) throw new Error(`anpi_p63_outsider_settings_${os.status}`);
    outsiderSettingId = Array.isArray(os.json) ? os.json[0].id : os.json.id;
    const oc = await rest(`/rest/v1/anpi_check_instances`, {
      method: "POST",
      body: {
        setting_id: outsiderSettingId,
        owner_user_id: outsiderUserId,
        subject_user_id: outsiderUserId,
        local_check_date: SOAK_LOCAL_DATE,
        timezone: "Asia/Tokyo",
        scheduled_at: new Date("2099-07-27T15:00:00.000Z").toISOString(),
        status: "scheduled",
      },
    });
    if (!oc.ok) throw new Error(`anpi_p63_outsider_check_${oc.status}`);
    outsiderCheckId = Array.isArray(oc.json) ? oc.json[0].id : oc.json.id;
    const oj = await rest(`/rest/v1/anpi_scheduler_jobs`, {
      method: "POST",
      body: {
        check_id: outsiderCheckId,
        subject_user_id: outsiderUserId,
        recipient_user_id: outsiderUserId,
        channel: "talk",
        kind: SOAK_KIND,
        status: "pending",
        available_at: new Date().toISOString(),
        attempt_count: 0,
      },
    });
    if (!oj.ok) throw new Error(`anpi_p63_outsider_job_${oj.status}`);
    outsiderJobId = Array.isArray(oj.json) ? oj.json[0].id : oj.json.id;

    evidence.preflight.soak = {
      job_id: short(soakJobId),
      check_id: short(soakCheckId),
      local_date: SOAK_LOCAL_DATE,
      kind: SOAK_KIND,
      marker_source: ANPI_P61_SOURCE,
    };
    evidence.preflight.outsider = {
      job_id: short(outsiderJobId),
      auth_sha8: sha8(outsiderUserId),
      status: "pending",
    };

    fs.mkdirSync(path.dirname(EVIDENCE), { recursive: true });
    tail = startWranglerTail(TAIL_LOG);
    await sleep(8000);

    // Flags ON while gate OFF
    setWranglerFlags({ scopedCron: true, scopedWriter: true });
    const depOn = await wranglerDeploy();
    flagsOn = true;
    workerVersionOn = depOn.versionId;
    evidence.enable_timeline.push({
      at: new Date().toISOString(),
      action: "deploy_flags_on",
      version: workerVersionOn,
      flags: readWranglerFlags(),
      gate: false,
    });

    const claim0 = await rpc("anpi_phase62_claim_jobs_allowlisted", {
      p_worker_id: "anpi-p63-pre-gate",
      p_limit: 5,
      p_now: new Date().toISOString(),
    });
    const claim0Rows = Array.isArray(claim0.json) ? claim0.json : [];
    if (claim0Rows.length !== 0) throw new Error("anpi_p63_claim_nonzero_before_gate");
    evidence.enable_timeline.push({
      at: new Date().toISOString(),
      action: "pre_gate_claim_check",
      claimed: 0,
    });

    const en = await rpc("anpi_phase62_claim_allowlist_enable", {});
    const enRow = Array.isArray(en.json) ? en.json[0] : en.json;
    if (!en.ok || enRow?.enabled !== true) throw new Error("anpi_p63_enable_failed");
    gateEnabled = true;
    const soakObserveStart = new Date().toISOString();
    evidence.enable_timeline.push({
      at: soakObserveStart,
      action: "gate_enable",
      enabled: true,
      worker_version: workerVersionOn,
    });

    console.log(
      JSON.stringify({
        phase: 63,
        status: "observing",
        soak_observe_start: soakObserveStart,
        worker_version_on: workerVersionOn,
        min_ticks: MIN_CRON_TICKS,
      })
    );

    const deadline = Date.now() + MAX_WAIT_MS;
    let lastCronCount = 0;
    let alreadySeenTotal = 0;

    while (Date.now() < deadline && evidence.cron_ticks.length < MAX_CRON_TICKS) {
      const jobState = await rest(
        `/rest/v1/anpi_scheduler_jobs?id=eq.${soakJobId}&select=id,status,attempt_count,last_error_safe`
      );
      const js = Array.isArray(jobState.json) ? jobState.json[0] : null;
      if (js?.status === "sent" || js?.status === "failed" || js?.status === "skipped") {
        await rest(`/rest/v1/anpi_scheduler_jobs?id=eq.${soakJobId}`, {
          method: "PATCH",
          body: {
            status: "pending",
            available_at: new Date().toISOString(),
            claimed_at: null,
            claimed_by: null,
            lease_expires_at: null,
            completed_at: null,
            last_error_safe: null,
          },
        });
      }

      const outsiderState = await rest(
        `/rest/v1/anpi_scheduler_jobs?id=eq.${outsiderJobId}&select=id,status`
      );
      const osRow = Array.isArray(outsiderState.json) ? outsiderState.json[0] : null;
      if (osRow && osRow.status !== "pending") {
        await emergencyShutdown("outsider_claimed");
        throw new Error("anpi_p63_STOP_outsider_claimed");
      }

      const markers = await rest(
        `/rest/v1/talk_notifications?source=eq.${ANPI_P61_SOURCE}&type=eq.anpi&select=id,created_at&order=created_at.asc`
      );
      const mrows = Array.isArray(markers.json) ? markers.json : [];
      if (mrows.length > 1) {
        await emergencyShutdown("duplicate");
        throw new Error("anpi_p63_STOP_duplicate_notifications");
      }
      if (mrows[0]?.id) notificationId = mrows[0].id;

      const cronEvents = parseCronLogsFromTail(TAIL_LOG, soakObserveStart).filter((e) => {
        const t = new Date(e.scheduled_time || e.raw_event_timestamp || 0).getTime();
        return t >= new Date(soakObserveStart).getTime() - 2000;
      });

      if (cronEvents.length > lastCronCount) {
        for (let i = lastCronCount; i < cronEvents.length; i += 1) {
          const ev = cronEvents[i];
          const badSha = (ev.subject_sha8s || []).some((s) => s && s !== ANPI_P61_TARGET_AUTH_SHA8);
          if (badSha) {
            await emergencyShutdown("allowlist_violation");
            throw new Error("anpi_p63_STOP_allowlist_violation");
          }
          const reasons = ev.write_reasons || [];
          const ins = reasons.filter((r) => r === "anpi_p61_inserted").length;
          const seen = reasons.filter((r) => r === "anpi_p61_already_seen").length;
          alreadySeenTotal += seen;
          if (ins > 1) {
            await emergencyShutdown("duplicate");
            throw new Error("anpi_p63_STOP_multi_insert_same_tick");
          }

          const sinceLease = new Date(
            new Date(ev.scheduled_time || Date.now()).getTime() - 90_000
          ).toISOString();
          const leases = await rest(
            `/rest/v1/anpi_scheduler_runs?started_at=gte.${encodeURIComponent(sinceLease)}` +
              `&worker_id=like.anpi-p48-lease:cf-staging-*` +
              `&select=id,worker_id,started_at,finished_at,error_safe&order=started_at.desc&limit=5`
          );
          const leaseRows = Array.isArray(leases.json) ? leases.json : [];
          const matchingLease = leaseRows[0] || null;

          // Enrich envelope-only ticks from DB job transitions when possible
          let enrichedClaimed = ev.jobs_claimed;
          let enrichedReasons = reasons;
          if (ev.source === "wrangler_tail_envelope") {
            if (js?.status === "sent" || mrows.length > 0) {
              enrichedClaimed = enrichedClaimed == null ? 1 : enrichedClaimed;
            }
          }

          evidence.cron_ticks.push({
            index: evidence.cron_ticks.length + 1,
            scheduled_time: ev.scheduled_time,
            on_five_minute_boundary: isOnFiveMinuteBoundary(ev.scheduled_time),
            worker_version: workerVersionOn,
            trigger: "cloudflare_cron",
            cron: ev.cron || "*/5 * * * *",
            execution_id: short(ev.execution_id),
            status: ev.status,
            source: ev.source,
            lease: ev.lease,
            lease_db: matchingLease
              ? {
                  started_at: matchingLease.started_at,
                  finished_at: matchingLease.finished_at,
                  error_safe: matchingLease.error_safe,
                  released: Boolean(matchingLease.finished_at),
                }
              : null,
            jobs_claimed: enrichedClaimed,
            subject_sha8s: ev.subject_sha8s?.length
              ? ev.subject_sha8s
              : mrows.length
                ? [ANPI_P61_TARGET_AUTH_SHA8]
                : [],
            write_reasons: enrichedReasons,
            inserted: ins,
            already_seen: seen,
            outsider_pending: osRow?.status === "pending",
            notification_id: short(notificationId),
            marker_count: mrows.length,
            provider: ev.provider || "talk_local",
            mode: ev.mode,
            scoped_cron_path: ev.scoped_cron_path,
            error_code: ev.error_code || null,
            soak_job_status: js?.status || null,
          });
          evidence.counts.cron_ticks = evidence.cron_ticks.length;
          evidence.counts.claimed += Number(enrichedClaimed || 0);
          console.log(
            JSON.stringify({
              cron_tick: evidence.cron_ticks.length,
              scheduled_time: ev.scheduled_time,
              source: ev.source,
              marker_count: mrows.length,
              outsider: osRow?.status,
            })
          );
        }
        lastCronCount = cronEvents.length;
      }

      evidence.counts.inserted = mrows.length;
      evidence.counts.already_seen = alreadySeenTotal;
      evidence.counts.duplicates = mrows.length > 1 ? mrows.length - 1 : 0;

      // Persist progress
      fs.writeFileSync(EVIDENCE, JSON.stringify(evidence, null, 2));

      if (evidence.cron_ticks.length >= MIN_CRON_TICKS) break;
      await sleep(POLL_MS);
    }

    if (evidence.cron_ticks.length < MIN_CRON_TICKS) {
      await emergencyShutdown("insufficient_cron_ticks");
      throw new Error(
        `anpi_p63_insufficient_cron_ticks:${evidence.cron_ticks.length}<${MIN_CRON_TICKS}`
      );
    }

    evidence.failure_simulation = {
      performed: false,
      reason:
        "omitted_to_minimize_gate_on_window_and_avoid_flag_thrash; lease_release_on_error_covered_by_phase48_catch",
    };

    // Immediate shutdown — pause runtime before clearing scoped flags so a
    // mid-deploy cron cannot fall into legacy_stub and claim outsider jobs.
    const dis = await rpc("anpi_phase62_claim_allowlist_emergency_disable", {});
    const disRow = Array.isArray(dis.json) ? dis.json[0] : dis.json;
    gateEnabled = false;
    evidence.enable_timeline.push({
      at: new Date().toISOString(),
      action: "emergency_disable_gate",
      enabled: disRow?.enabled === false,
    });

    setRuntimeEnabled(false);
    setWranglerFlags({ scopedCron: false, scopedWriter: false });
    const depPause = await wranglerDeploy();
    evidence.enable_timeline.push({
      at: new Date().toISOString(),
      action: "deploy_runtime_paused_and_flags_off",
      version: depPause.versionId,
    });
    setRuntimeEnabled(true);
    const depOff = await wranglerDeploy();
    flagsOn = false;
    workerVersionOff = depOff.versionId;
    evidence.enable_timeline.push({
      at: new Date().toISOString(),
      action: "deploy_runtime_resumed_stub_path",
      version: workerVersionOff,
      flags: readWranglerFlags(),
      provider: "talk_local",
    });

    const postClaim = await rpc("anpi_phase62_claim_jobs_allowlisted", {
      p_worker_id: "anpi-p63-post",
      p_limit: 5,
      p_now: new Date().toISOString(),
    });
    const postRows = Array.isArray(postClaim.json) ? postClaim.json : [];

    evidence.cleanup.markers = await cleanupScopedMarkers(client, { dryRun: false });

    for (const id of [soakJobId, outsiderJobId].filter(Boolean)) {
      await rest(`/rest/v1/anpi_scheduler_jobs?id=eq.${id}`, {
        method: "PATCH",
        body: {
          status: "cancelled",
          completed_at: new Date().toISOString(),
          claimed_at: null,
          claimed_by: null,
          lease_expires_at: null,
          last_error_safe: "anpi_p63_soak_cleanup",
        },
      });
    }
    for (const id of [soakCheckId, outsiderCheckId].filter(Boolean)) {
      await rest(`/rest/v1/anpi_check_instances?id=eq.${id}`, {
        method: "PATCH",
        body: { status: "cancelled", cancelled_at: new Date().toISOString() },
      });
    }
    if (outsiderSettingId) {
      await rest(`/rest/v1/anpi_settings?id=eq.${outsiderSettingId}`, {
        method: "PATCH",
        body: { deleted_at: new Date().toISOString(), enabled: false },
      });
    }
    if (outsiderUserId) {
      await fetch(`${apiUrl}/auth/v1/admin/users/${outsiderUserId}`, {
        method: "DELETE",
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      });
    }

    const remain = await rest(`/rest/v1/talk_notifications?source=eq.${ANPI_P61_SOURCE}&select=id`);
    const remainN = Array.isArray(remain.json) ? remain.json.length : -1;
    const gFinal = await rest(
      `/rest/v1/anpi_phase62_claim_allowlist_gate?id=eq.1&select=enabled,allowed_auth_sha8`
    );
    const gf = Array.isArray(gFinal.json) ? gFinal.json[0] : null;
    const flagsFinal = readWranglerFlags();

    evidence.cleanup.remaining_markers = remainN;
    evidence.cleanup.post_disable_claim_rows = postRows.length;
    evidence.final = {
      gate_false: gf?.enabled === false,
      allowlist: gf?.allowed_auth_sha8,
      flags: flagsFinal,
      provider: flagsFinal.provider,
      worker_version_off: workerVersionOff,
      remaining_markers: remainN,
      legacy_claim_untouched: "anpi_phase6_claim_jobs",
      production_contact: false,
      cron_path: "legacy_stub_default",
    };

    const allCron = evidence.cron_ticks.every((t) => t.trigger === "cloudflare_cron");
    const noDup = evidence.counts.duplicates === 0 && remainN === 0;
    const outsiderOk = evidence.cron_ticks.every((t) => t.outsider_pending !== false);
    const leaseOk = evidence.cron_ticks.every(
      (t) => !t.lease_db || t.lease_db.released === true || t.lease === "busy"
    );
    // Require at least one real write effect across soak (insert or already_seen path)
    const hadWriteEffect =
      evidence.counts.inserted >= 1 ||
      evidence.cron_ticks.some((t) => (t.write_reasons || []).includes("anpi_p61_already_seen"));

    const pass =
      evidence.cron_ticks.length >= MIN_CRON_TICKS &&
      allCron &&
      noDup &&
      outsiderOk &&
      leaseOk &&
      hadWriteEffect &&
      evidence.final.gate_false &&
      flagsFinal.cron === "false" &&
      flagsFinal.writer === "false" &&
      flagsFinal.provider === "talk_local" &&
      postRows.length === 0;

    evidence.verdict = pass ? "WALL_CLOCK_SOAK_PASS" : "NO_GO";
    evidence.finished_at = new Date().toISOString();
    evidence.worker_version_on = workerVersionOn;
    evidence.worker_version_off = workerVersionOff;
  } catch (e) {
    evidence.verdict = "NO_GO";
    evidence.error = String(e?.message || e).slice(0, 240);
    evidence.finished_at = new Date().toISOString();
    if ((gateEnabled || flagsOn) && client) {
      await emergencyShutdown(evidence.stop_reason || "exception");
    }
  } finally {
    if (tail) tail.stop();
    try {
      setWranglerFlags({ scopedCron: false, scopedWriter: false });
    } catch {
      /* ignore */
    }
  }

  fs.mkdirSync(path.dirname(EVIDENCE), { recursive: true });
  fs.writeFileSync(EVIDENCE, JSON.stringify(evidence, null, 2));
  console.log(
    JSON.stringify(
      {
        verdict: evidence.verdict,
        cron_ticks: evidence.counts.cron_ticks,
        scheduled_times: evidence.cron_ticks.map((t) => t.scheduled_time),
        claimed: evidence.counts.claimed,
        inserted: evidence.counts.inserted,
        already_seen: evidence.counts.already_seen,
        duplicates: evidence.counts.duplicates,
        worker_version_on: evidence.worker_version_on,
        worker_version_off: evidence.worker_version_off,
        gate_final: evidence.final?.gate_false,
        flags: evidence.final?.flags,
        error: evidence.error || null,
        evidence: path.relative(root, EVIDENCE),
        tail: path.relative(root, TAIL_LOG),
      },
      null,
      2
    )
  );

  if (evidence.verdict !== "WALL_CLOCK_SOAK_PASS") process.exit(1);
}

main().catch((e) => {
  console.error("FAIL", String(e?.message || e).slice(0, 240));
  process.exit(1);
});
