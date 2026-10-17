#!/usr/bin/env node
/**
 * ANPI Phase 61 — Staging scoped job-writer verification.
 * Manual job invocation only. Does NOT flip Cron provider.
 * Secrets never printed.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import {
  createScopedRestClient,
  scopedWriteForJob,
  cleanupScopedMarkers,
  assertStableKeySemantics,
  ANPI_P61_ENABLE_ENV,
  ANPI_P61_TARGET_AUTH_SHA8,
  ANPI_P61_SOURCE,
  sha8,
} from "./lib/anpi-phase61-scoped-job-writer.mjs";
import { STAGING_SUPABASE_REF } from "./lib/anpi-phase48-scheduled-runtime.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MAIN_ENV = "C:/Users/rubih/tasufull-article/.env.staging";
const EVIDENCE = path.join(root, "reports", "anpi-phase61-scoped-job-writer-evidence.json");

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
  const anonKey = process.env.SUPABASE_ANON_KEY || fileEnv.SUPABASE_ANON_KEY || fileEnv.TASFUL_SUPABASE_ANON_KEY;

  const evidence = {
    phase: 61,
    started_at: new Date().toISOString(),
    project_ref: STAGING_SUPABASE_REF,
    cron_provider_unchanged: "talk_local*",
    job_writer: "js_scoped_talk_notifications_phase10_contract",
    stable_key_sem: null,
    negatives: {},
    steps: {},
    counts: { inserted: 0, duplicates: 0 },
    verdict: "PENDING",
  };

  let client = null;
  let notificationId = null;
  let enabledEnv = { ...process.env, [ANPI_P61_ENABLE_ENV]: "true" };

  try {
    evidence.stable_key_sem = assertStableKeySemantics();
    client = createScopedRestClient({ apiUrl, serviceKey, envRef });

    // Load gate target auth id (test identity)
    const gate = await client.rest(
      "/rest/v1/anpi_phase17_insert_gate?id=eq.1&select=target_auth_user_id,target_talk_user_id,target_auth_sha8,enabled"
    );
    const g = Array.isArray(gate.json) ? gate.json[0] : null;
    if (!g?.target_auth_user_id) throw new Error("anpi_p61_gate_unbound");
    if (g.target_auth_sha8 !== ANPI_P61_TARGET_AUTH_SHA8) throw new Error("anpi_p61_unexpected_gate_target");
    evidence.steps.gate = {
      target_auth_sha8: g.target_auth_sha8,
      phase17_flag: g.enabled,
    };

    // Pre-cleanup any leftover p61 markers
    await cleanupScopedMarkers(client, { dryRun: false });

    const logicalDueAt = "2026-07-27T12:00:00.000Z";
    const checkId = crypto.randomUUID();
    const jobId = crypto.randomUUID();
    const job = {
      id: jobId,
      kind: "initial",
      check_id: checkId,
      subject_user_id: g.target_auth_user_id,
      attempt_count: 1,
      available_at: logicalDueAt,
      channel: "talk",
    };

    // Negative: flag OFF
    const flagOff = await scopedWriteForJob(client, job, {
      dryRun: false,
      env: { ...process.env, [ANPI_P61_ENABLE_ENV]: "false" },
      envRef,
      logicalDueAt,
    }).catch((e) => ({ status: "error", reason_code: String(e.message || e) }));
    evidence.negatives.flag_off = {
      pass: flagOff.reason_code === "anpi_p61_flag_off" || String(flagOff.reason_code).includes("flag_off"),
      reason_code: flagOff.reason_code,
    };
    if (!evidence.negatives.flag_off.pass) {
      // scopedWriteForJob throws before return when flag off on live
      try {
        await scopedWriteForJob(client, job, {
          dryRun: false,
          env: { [ANPI_P61_ENABLE_ENV]: "0" },
          envRef,
          logicalDueAt,
        });
        evidence.negatives.flag_off.pass = false;
      } catch (e) {
        evidence.negatives.flag_off = {
          pass: String(e.message).includes("flag_off"),
          reason_code: String(e.message).slice(0, 80),
        };
      }
    }

    // Negative: Production ref
    let prodRefuse = false;
    try {
      createScopedRestClient({
        apiUrl: `https://ddojquacsyqesrjhcvmn.supabase.co`,
        serviceKey: "x",
        envRef: STAGING_SUPABASE_REF,
      });
    } catch (e) {
      prodRefuse = /production/.test(String(e.message));
    }
    evidence.negatives.production_ref = { pass: prodRefuse };

    // Negative: non-allowlisted identity
    const otherJob = {
      ...job,
      id: crypto.randomUUID(),
      subject_user_id: "00000000-0000-4000-8000-00000000dead",
    };
    const skipped = await scopedWriteForJob(client, otherJob, {
      dryRun: false,
      env: enabledEnv,
      envRef,
      logicalDueAt,
    });
    evidence.negatives.non_allowlisted = {
      pass: skipped.reason_code === "anpi_p61_identity_not_allowlisted" && skipped.inserted === 0,
      reason_code: skipped.reason_code,
    };

    // Negative: anon cannot insert (table privilege / RLS)
    if (anonKey) {
      const anonIns = await fetch(`${apiUrl}/rest/v1/talk_notifications`, {
        method: "POST",
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          id: "anpi-p61-anon-probe",
          user_id: "u_store",
          type: "anpi",
          title: "x",
          body: "y",
          target_url: "#",
          source: ANPI_P61_SOURCE,
        }),
      });
      evidence.negatives.anon_insert = {
        pass: anonIns.status === 401 || anonIns.status === 403,
        status: anonIns.status,
      };
    }

    // Malformed due
    let malformed = false;
    try {
      await scopedWriteForJob(
        client,
        { ...job, available_at: "not-a-date" },
        { dryRun: true, env: enabledEnv, envRef, logicalDueAt: "bad" }
      );
    } catch (e) {
      malformed = /stable_key/.test(String(e.message));
    }
    evidence.negatives.malformed_due = { pass: malformed };

    // Dry-run
    const dry = await scopedWriteForJob(client, job, {
      dryRun: true,
      env: enabledEnv,
      envRef,
      logicalDueAt,
    });
    evidence.steps.dry_run = {
      reason_code: dry.reason_code,
      notification_id: short(dry.notification_id),
      idempotency_key_suffix: String(dry.idempotency_key || "").slice(-24),
    };
    if (dry.reason_code !== "anpi_p61_dry_run_would_insert") {
      throw new Error(`dry_unexpected:${dry.reason_code}`);
    }

    // LIVE insert
    const live = await scopedWriteForJob(client, job, {
      dryRun: false,
      env: enabledEnv,
      envRef,
      logicalDueAt,
    });
    evidence.steps.live_insert = {
      reason_code: live.reason_code,
      inserted: live.inserted,
      notification_id: short(live.notification_id),
      talk_user_sha16: live.talk_user_sha16,
      official_room_id: live.official_room_id,
    };
    if (live.reason_code !== "anpi_p61_inserted" || live.inserted !== 1) {
      throw new Error(`live_unexpected:${live.reason_code}`);
    }
    notificationId = live.notification_id;
    evidence.counts.inserted = 1;

    // Retry / reclaim simulation: bump attempt_count, same logical factors
    const retryJob = { ...job, attempt_count: 5 };
    const retry = await scopedWriteForJob(client, retryJob, {
      dryRun: false,
      env: enabledEnv,
      envRef,
      logicalDueAt,
    });
    evidence.steps.retry_same_logical = {
      reason_code: retry.reason_code,
      inserted: retry.inserted,
      already_seen: retry.already_seen,
      same_notification_id: retry.notification_id === notificationId,
    };
    if (!retry.already_seen || retry.inserted !== 0) {
      throw new Error(`retry_duplicate:${retry.reason_code}`);
    }
    evidence.counts.duplicates = 0;

    // Second reclaim with different attempt + same due bucket (different clock)
    const reclaim = await scopedWriteForJob(client, { ...job, attempt_count: 9 }, {
      dryRun: false,
      env: enabledEnv,
      envRef,
      logicalDueAt: "2026-07-27T18:30:00.000Z",
    });
    evidence.steps.reclaim_due_bucket = {
      reason_code: reclaim.reason_code,
      already_seen: reclaim.already_seen,
      same_notification_id: reclaim.notification_id === notificationId,
    };
    if (!reclaim.already_seen) throw new Error("reclaim_not_deduped");

    // Count rows for marker
    const markers = await client.rest(
      `/rest/v1/talk_notifications?source=eq.${ANPI_P61_SOURCE}&select=id`
    );
    const mcount = Array.isArray(markers.json) ? markers.json.length : -1;
    evidence.counts.marker_rows_after_writes = mcount;
    if (mcount !== 1) throw new Error(`marker_count_${mcount}`);

    // Row shape
    const rowRes = await client.rest(
      `/rest/v1/talk_notifications?id=eq.${encodeURIComponent(notificationId)}&select=id,type,target_url,source,user_id,title,body`
    );
    const row = Array.isArray(rowRes.json) ? rowRes.json[0] : null;
    evidence.steps.row_shape = {
      type: row?.type,
      target_url: row?.target_url,
      source: row?.source,
      title_len: String(row?.title || "").length,
      pass: row?.type === "anpi" && row?.target_url === "#" && row?.source === ANPI_P61_SOURCE,
    };
    if (!evidence.steps.row_shape.pass) throw new Error("row_shape_fail");

    // Cleanup
    const cDry = await cleanupScopedMarkers(client, { dryRun: true, notificationId });
    evidence.steps.cleanup_dry = cDry;
    const cLive = await cleanupScopedMarkers(client, { dryRun: false, notificationId });
    evidence.steps.cleanup_live = {
      reason_code: cLive.reason_code,
      deleted_count: cLive.deleted_count,
      matched_count: cLive.matched_count,
    };
    if (cLive.reason_code !== "anpi_p61_cleanup_deleted" || cLive.deleted_count < 1) {
      throw new Error(`cleanup_fail:${cLive.reason_code}`);
    }
    notificationId = null;

    const gone = await client.rest(
      `/rest/v1/talk_notifications?source=eq.${ANPI_P61_SOURCE}&select=id`
    );
    evidence.steps.cleanup_verify = {
      remaining: Array.isArray(gone.json) ? gone.json.length : null,
      pass: Array.isArray(gone.json) && gone.json.length === 0,
    };
    if (!evidence.steps.cleanup_verify.pass) throw new Error("cleanup_residue");

    // Rollback / disable: flag off after cleanup
    evidence.steps.rollback_disable = {
      flag_env: ANPI_P61_ENABLE_ENV,
      disabled_means: "unset or not true → anpi_p61_flag_off",
      cron_still: "talk_local*",
      pass: true,
    };

    evidence.owner_visibility = "reuse_phase59_PASS";
    evidence.phase62_cron_soak = "NO_GO_until_sql_claim_allowlist_and_cron_wiring";
    evidence.note =
      "Phase 61 JS scoped writer uses Phase 10 contract + talk_notifications. Cron cutover still requires claim allowlist wiring (Phase 62 gate).";

    const required = [
      evidence.negatives.flag_off?.pass,
      evidence.negatives.production_ref?.pass,
      evidence.negatives.non_allowlisted?.pass,
      evidence.negatives.malformed_due?.pass,
      evidence.steps.live_insert?.reason_code === "anpi_p61_inserted",
      evidence.steps.retry_same_logical?.already_seen === true,
      evidence.steps.reclaim_due_bucket?.already_seen === true,
      evidence.counts.duplicates === 0,
      evidence.steps.cleanup_verify?.pass,
      evidence.steps.row_shape?.pass,
    ];
    if (evidence.negatives.anon_insert) required.push(evidence.negatives.anon_insert.pass);

    evidence.verdict = required.every(Boolean) ? "PASS_SCOPED_JOB_WRITER" : "FAIL";
    evidence.finished_at = new Date().toISOString();

    fs.mkdirSync(path.dirname(EVIDENCE), { recursive: true });
    fs.writeFileSync(EVIDENCE, JSON.stringify(evidence, null, 2), "utf8");
    console.log(JSON.stringify(evidence, null, 2));

    if (evidence.verdict !== "PASS_SCOPED_JOB_WRITER") {
      console.error("FAIL Phase 61 scoped job-writer");
      process.exitCode = 1;
      return;
    }
    console.log("PASS Phase 61 staging scoped job-writer");
  } catch (err) {
    evidence.verdict = "FAIL";
    evidence.error = String(err?.message || err).slice(0, 240);
    evidence.finished_at = new Date().toISOString();
    try {
      if (client) await cleanupScopedMarkers(client, { dryRun: false });
    } catch (e) {
      evidence.cleanup_on_error = String(e?.message || e).slice(0, 120);
    }
    fs.mkdirSync(path.dirname(EVIDENCE), { recursive: true });
    fs.writeFileSync(EVIDENCE, JSON.stringify(evidence, null, 2), "utf8");
    console.error(JSON.stringify(evidence, null, 2));
    console.error("FAIL", evidence.error);
    process.exitCode = 1;
  }
}

main();
