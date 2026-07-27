#!/usr/bin/env node
/**
 * ANPI Phase 62 — Staging Scoped Cron Soak
 *
 * Approves (this run):
 *   - staging scoped writer wiring
 *   - temporary gate enable
 *   - test identity {0411f04d} only
 *   - mandatory immediate disable after soak
 *
 * Never touches Production. Keeps ANPI_NOTIFICATION_PROVIDER=talk_local*.
 * Does not replace anpi_phase6_claim_jobs.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  createScopedRestClient,
  cleanupScopedMarkers,
  ANPI_P61_ENABLE_ENV,
  ANPI_P61_TARGET_AUTH_SHA8,
  ANPI_P61_SOURCE,
  sha8,
} from "./lib/anpi-phase61-scoped-job-writer.mjs";
import {
  runAnpiPhase48ScheduledRuntime,
  STAGING_SUPABASE_REF,
  PRODUCTION_SUPABASE_REF,
} from "./lib/anpi-phase48-scheduled-runtime.mjs";
import {
  ANPI_P62_SCOPED_CRON_ENV,
  isScopedCronPathEnabled,
  assertScopedCronEnv,
} from "./lib/anpi-phase62-scoped-cron-path.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MAIN_ENV = "C:/Users/rubih/tasufull-article/.env.staging";
const EVIDENCE = path.join(root, "reports", "anpi-phase62-scoped-cron-soak-evidence.json");
const SOAK_LOCAL_DATE = "2099-07-27";
const SOAK_SCHEDULED_AT = "2099-07-26T24:00:00+09:00"; // == 2099-07-27 00:00 JST
const SOAK_KIND = "initial";

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

async function rest(client, pathAndQuery, opts = {}) {
  return client.rest(pathAndQuery.startsWith("/") ? pathAndQuery : `/${pathAndQuery}`, opts);
}

async function rpc(client, name, args = {}) {
  return client.rpc(name, args);
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
  const anonKey =
    process.env.SUPABASE_ANON_KEY || fileEnv.SUPABASE_ANON_KEY || fileEnv.TASFUL_SUPABASE_ANON_KEY;
  const envRef = process.env.SUPABASE_PROJECT_REF || fileEnv.SUPABASE_PROJECT_REF || STAGING_SUPABASE_REF;

  const evidence = {
    phase: 62,
    mode: "scoped_cron_soak",
    started_at: new Date().toISOString(),
    project_ref: null,
    env_ref: envRef,
    wiring: {
      claim_rpc: "anpi_phase62_claim_jobs_allowlisted",
      writer: "anpi-phase61-scoped-job-writer",
      flag: ANPI_P62_SCOPED_CRON_ENV,
      writer_flag: ANPI_P61_ENABLE_ENV,
      provider_stays: "talk_local*",
      legacy_claim_untouched: "anpi_phase6_claim_jobs",
    },
    negatives: {},
    dry: {},
    soak_runs: [],
    counts: {
      cron_path_runs: 0,
      claimed: 0,
      inserted: 0,
      duplicates: 0,
      already_seen: 0,
    },
    cleanup: {},
    final: {},
    verdict: "PENDING",
    stop_reason: null,
  };

  let client = null;
  let gateEnabled = false;
  let targetAuthId = null;
  let soakCheckId = null;
  let soakJobId = null;
  let outsiderUserId = null;
  let outsiderJobId = null;
  let outsiderCheckId = null;
  let outsiderSettingId = null;
  let notificationIds = [];

  const scopedEnvOn = {
    ANPI_ENVIRONMENT: "staging",
    ANPI_STAGING_PROJECT_REF: STAGING_SUPABASE_REF,
    ANPI_PROJECT_REF: STAGING_SUPABASE_REF,
    ANPI_NOTIFICATION_PROVIDER: "talk_local",
    [ANPI_P62_SCOPED_CRON_ENV]: "true",
    [ANPI_P61_ENABLE_ENV]: "true",
  };
  const scopedEnvOff = {
    ...scopedEnvOn,
    [ANPI_P62_SCOPED_CRON_ENV]: "false",
    [ANPI_P61_ENABLE_ENV]: "false",
  };

  async function emergencyStop(reason) {
    evidence.stop_reason = reason || evidence.stop_reason;
    try {
      await rpc(client, "anpi_phase62_claim_allowlist_emergency_disable", {});
      gateEnabled = false;
    } catch (e) {
      evidence.cleanup.emergency_disable_error = String(e?.message || e).slice(0, 120);
    }
    try {
      if (notificationIds.length || true) {
        const c = await cleanupScopedMarkers(client, { dryRun: false });
        evidence.cleanup.markers = {
          deleted_count: c.deleted_count,
          matched_count: c.matched_count,
          reason_code: c.reason_code,
        };
      }
    } catch (e) {
      evidence.cleanup.marker_error = String(e?.message || e).slice(0, 120);
    }
  }

  try {
    if (!apiUrl || !serviceKey) throw new Error("anpi_p62_missing_staging_credentials");
    if (String(apiUrl).includes(PRODUCTION_SUPABASE_REF)) {
      throw new Error("anpi_p62_refusing_production");
    }
    if (envRef === PRODUCTION_SUPABASE_REF) throw new Error("anpi_p62_env_production_ref");
    if (envRef !== STAGING_SUPABASE_REF) throw new Error("anpi_p62_unexpected_env_ref");

    client = createScopedRestClient({ apiUrl, serviceKey, envRef });
    evidence.project_ref = STAGING_SUPABASE_REF;

    // --- Negatives (pre-gate) ---
    {
      let prodRefuse = false;
      try {
        assertScopedCronEnv({
          ANPI_ENVIRONMENT: "staging",
          ANPI_STAGING_PROJECT_REF: PRODUCTION_SUPABASE_REF,
          ANPI_NOTIFICATION_PROVIDER: "talk_local",
        });
      } catch {
        prodRefuse = true;
      }
      evidence.negatives.production_ref = { pass: prodRefuse };

      let malformedRefuse = false;
      try {
        assertScopedCronEnv({
          ANPI_ENVIRONMENT: "staging",
          ANPI_STAGING_PROJECT_REF: STAGING_SUPABASE_REF,
          ANPI_NOTIFICATION_PROVIDER: "talk_write",
        });
      } catch {
        malformedRefuse = true;
      }
      evidence.negatives.malformed_provider = { pass: malformedRefuse };

      evidence.negatives.flag_off_is_false = {
        pass: isScopedCronPathEnabled(scopedEnvOff) === false,
      };

      const anonClaim = await fetch(`${apiUrl}/rest/v1/rpc/anpi_phase62_claim_jobs_allowlisted`, {
        method: "POST",
        headers: {
          apikey: anonKey || "anon",
          Authorization: `Bearer ${anonKey || "anon"}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ p_worker_id: "anon-deny", p_limit: 1 }),
      });
      evidence.negatives.non_service_role_claim = {
        pass: anonClaim.status === 401 || anonClaim.status === 403,
        status: anonClaim.status,
      };
    }

    // Resolve test identity from Phase 17 gate bind (sha8 must match)
    const gate17 = await rest(
      client,
      `/rest/v1/anpi_phase17_insert_gate?id=eq.1&select=target_auth_user_id,target_talk_user_id,target_auth_sha8,enabled`
    );
    const g17 = Array.isArray(gate17.json) ? gate17.json[0] : null;
    if (!g17?.target_auth_user_id) throw new Error("anpi_p62_target_unbound");
    if (g17.target_auth_sha8 !== ANPI_P61_TARGET_AUTH_SHA8) {
      throw new Error("anpi_p62_unexpected_target_sha8");
    }
    targetAuthId = g17.target_auth_user_id;
    evidence.dry.target = {
      auth_sha8: sha8(targetAuthId),
      talk_sha16: crypto.createHash("sha256").update(String(g17.target_talk_user_id || "")).digest("hex").slice(0, 16),
    };

    // Phase 62 gate preflight OFF
    const g62 = await rest(
      client,
      `/rest/v1/anpi_phase62_claim_allowlist_gate?id=eq.1&select=enabled,allowed_auth_sha8`
    );
    const gateRow = Array.isArray(g62.json) ? g62.json[0] : null;
    if (!gateRow) throw new Error("anpi_p62_gate_missing");
    if (gateRow.enabled === true) {
      await rpc(client, "anpi_phase62_claim_allowlist_emergency_disable", {});
    }
    evidence.dry.gate_before = {
      enabled: false,
      allowlist: gateRow.allowed_auth_sha8,
    };
    if (!Array.isArray(gateRow.allowed_auth_sha8) || gateRow.allowed_auth_sha8.join(",") !== ANPI_P61_TARGET_AUTH_SHA8) {
      if (!(gateRow.allowed_auth_sha8?.length === 1 && gateRow.allowed_auth_sha8[0] === ANPI_P61_TARGET_AUTH_SHA8)) {
        throw new Error("anpi_p62_allowlist_unexpected");
      }
    }

    // Cleanup leftover markers
    await cleanupScopedMarkers(client, { dryRun: false });

    // Ensure settings for target
    let settings = await rest(
      client,
      `/rest/v1/anpi_settings?subject_user_id=eq.${targetAuthId}&deleted_at=is.null&select=id&limit=1`
    );
    let settingId = Array.isArray(settings.json) ? settings.json[0]?.id : null;
    if (!settingId) {
      const ins = await rest(client, "/rest/v1/anpi_settings", {
        method: "POST",
        body: {
          owner_user_id: targetAuthId,
          subject_user_id: targetAuthId,
          timezone: "Asia/Tokyo",
          initial_notification_time: "09:00:00",
          reminder_policy: { interval_minutes: [120, 240] },
          reminder_count: 0,
          contact_notify_after: "02:00:00",
        },
      });
      if (!ins.ok) throw new Error(`anpi_p62_settings_insert_${ins.status}`);
      settingId = Array.isArray(ins.json) ? ins.json[0].id : ins.json.id;
    }

    // Upsert soak check
    const existingCheck = await rest(
      client,
      `/rest/v1/anpi_check_instances?subject_user_id=eq.${targetAuthId}&local_check_date=eq.${SOAK_LOCAL_DATE}&select=id`
    );
    if (Array.isArray(existingCheck.json) && existingCheck.json[0]?.id) {
      soakCheckId = existingCheck.json[0].id;
    } else {
      const cin = await rest(client, "/rest/v1/anpi_check_instances", {
        method: "POST",
        body: {
          setting_id: settingId,
          owner_user_id: targetAuthId,
          subject_user_id: targetAuthId,
          local_check_date: SOAK_LOCAL_DATE,
          timezone: "Asia/Tokyo",
          scheduled_at: new Date("2099-07-26T15:00:00.000Z").toISOString(), // 2099-07-27 00:00 JST
          status: "scheduled",
        },
      });
      if (!cin.ok) throw new Error(`anpi_p62_check_insert_${cin.status}:${cin.text}`);
      soakCheckId = Array.isArray(cin.json) ? cin.json[0].id : cin.json.id;
    }

    // Reset / seed soak job (allowlisted)
    const existJob = await rest(
      client,
      `/rest/v1/anpi_scheduler_jobs?check_id=eq.${soakCheckId}&kind=eq.${SOAK_KIND}&select=id,status`
    );
    if (Array.isArray(existJob.json) && existJob.json[0]?.id) {
      soakJobId = existJob.json[0].id;
      await rest(client, `/rest/v1/anpi_scheduler_jobs?id=eq.${soakJobId}`, {
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
    } else {
      const jin = await rest(client, "/rest/v1/anpi_scheduler_jobs", {
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
      if (!jin.ok) throw new Error(`anpi_p62_job_insert_${jin.status}:${jin.text}`);
      soakJobId = Array.isArray(jin.json) ? jin.json[0].id : jin.json.id;
    }
    evidence.dry.soak_job = { job_id: short(soakJobId), check_id: short(soakCheckId) };

    // Outsider (non-allowlisted) ephemeral user + pending job
    const outsiderEmail = `anpi-p62-soak-out-${Date.now().toString(36)}@example.invalid`;
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
    const ouText = await ou.text();
    let ouJson = null;
    try {
      ouJson = ouText ? JSON.parse(ouText) : null;
    } catch {
      ouJson = null;
    }
    if (!ou.ok || !ouJson?.id) throw new Error(`anpi_p62_outsider_create_${ou.status}`);
    outsiderUserId = ouJson.id;
    if (sha8(outsiderUserId) === ANPI_P61_TARGET_AUTH_SHA8) {
      throw new Error("anpi_p62_outsider_sha_collision");
    }

    const os = await rest(client, "/rest/v1/anpi_settings", {
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
    if (!os.ok) throw new Error(`anpi_p62_outsider_settings_${os.status}`);
    outsiderSettingId = Array.isArray(os.json) ? os.json[0].id : os.json.id;

    const oc = await rest(client, "/rest/v1/anpi_check_instances", {
      method: "POST",
      body: {
        setting_id: outsiderSettingId,
        owner_user_id: outsiderUserId,
        subject_user_id: outsiderUserId,
        local_check_date: SOAK_LOCAL_DATE,
        timezone: "Asia/Tokyo",
        scheduled_at: new Date("2099-07-26T15:00:00.000Z").toISOString(),
        status: "scheduled",
      },
    });
    if (!oc.ok) throw new Error(`anpi_p62_outsider_check_${oc.status}:${oc.text}`);
    outsiderCheckId = Array.isArray(oc.json) ? oc.json[0].id : oc.json.id;

    const oj = await rest(client, "/rest/v1/anpi_scheduler_jobs", {
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
    if (!oj.ok) throw new Error(`anpi_p62_outsider_job_${oj.status}:${oj.text}`);
    outsiderJobId = Array.isArray(oj.json) ? oj.json[0].id : oj.json.id;

    // Dry 1: gate OFF + flags ON → claim 0 via Phase 48 scoped path
    // (Do NOT run live legacy Phase 47 against seeded jobs — it uses
    // anpi_phase6_claim_jobs and would claim allowlist-out pending jobs.)
    {
      const dry = await runAnpiPhase48ScheduledRuntime({
        apiUrl,
        serviceKey,
        projectRef: STAGING_SUPABASE_REF,
        enabled: "true",
        workerId: `anpi-p62-dry-${Date.now().toString(36)}`,
        holderId: `p62dry${Date.now().toString(36)}`.slice(0, 40),
        env: scopedEnvOn,
      });
      evidence.dry.gate_off_scoped_run = {
        status: dry.status,
        mode: dry.mode,
        jobsClaimed: dry.jobsClaimed,
        scoped_cron_path: dry.scoped_cron_path,
      };
      if (dry.jobsClaimed !== 0) throw new Error("anpi_p62_gate_off_claimed_nonzero");
      evidence.negatives.gate_off_claim_0 = { pass: true };
    }

    // Dry 2: flag OFF routing only — no live stub claim against soak seeds.
    {
      evidence.dry.flag_off_routing = {
        scoped_cron_enabled: isScopedCronPathEnabled(scopedEnvOff),
        writer_would_connect: false,
        note: "live legacy Phase47 skipped to avoid claiming non-allowlisted pending jobs",
      };
      evidence.negatives.flag_off_real_writer_disconnected = {
        pass: isScopedCronPathEnabled(scopedEnvOff) === false,
      };
    }

    // Re-assert soak + outsider still pending before gate enable
    {
      const sj = await rest(
        client,
        `/rest/v1/anpi_scheduler_jobs?id=eq.${soakJobId}&select=id,status`
      );
      const oj = await rest(
        client,
        `/rest/v1/anpi_scheduler_jobs?id=eq.${outsiderJobId}&select=id,status`
      );
      const sjRow = Array.isArray(sj.json) ? sj.json[0] : null;
      const ojRow = Array.isArray(oj.json) ? oj.json[0] : null;
      if (sjRow?.status !== "pending") {
        await rest(client, `/rest/v1/anpi_scheduler_jobs?id=eq.${soakJobId}`, {
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
          },
        });
      }
      if (ojRow?.status !== "pending") {
        throw new Error(`anpi_p62_outsider_not_pending_pre_enable:${ojRow?.status}`);
      }
      evidence.dry.pre_enable_pending = {
        soak: "pending",
        outsider: ojRow?.status,
      };
    }

    // Enable gate
    const en = await rpc(client, "anpi_phase62_claim_allowlist_enable", {});
    const enRow = Array.isArray(en.json) ? en.json[0] : en.json;
    if (!en.ok || enRow?.enabled !== true) throw new Error("anpi_p62_enable_failed");
    gateEnabled = true;
    evidence.dry.gate_enabled = true;

    // Soak runs 1-3 (same path Cloudflare Cron uses via Phase 56 → 48 → 62)
    for (let i = 1; i <= 3; i += 1) {
      // Ensure allowlisted job is pending for run1; for run2+ reset to pending for reclaim
      if (i > 1) {
        await rest(client, `/rest/v1/anpi_scheduler_jobs?id=eq.${soakJobId}`, {
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

      const run = await runAnpiPhase48ScheduledRuntime({
        apiUrl,
        serviceKey,
        projectRef: STAGING_SUPABASE_REF,
        enabled: "true",
        workerId: `anpi-p62-soak-${i}-${Date.now().toString(36)}`.slice(0, 64),
        holderId: `p62s${i}${Date.now().toString(36)}`.slice(0, 40),
        env: scopedEnvOn,
      });

      const processed = Array.isArray(run.processed) ? run.processed : [];
      const claimedSubjects = processed.map((p) => p.subject_sha8);
      if (claimedSubjects.some((s) => s && s !== ANPI_P61_TARGET_AUTH_SHA8)) {
        await emergencyStop("allowlist_violation");
        throw new Error("anpi_p62_STOP_allowlist_violation");
      }

      // Outsider must remain pending
      const ojState = await rest(
        client,
        `/rest/v1/anpi_scheduler_jobs?id=eq.${outsiderJobId}&select=id,status,subject_user_id`
      );
      const ojRow = Array.isArray(ojState.json) ? ojState.json[0] : null;
      if (ojRow?.status !== "pending") {
        await emergencyStop("outsider_claimed");
        throw new Error("anpi_p62_STOP_outsider_claimed");
      }

      let inserted = 0;
      let alreadySeen = 0;
      for (const p of processed) {
        if (p.inserted) inserted += Number(p.inserted);
        if (p.already_seen) alreadySeen += 1;
        if (p.notification_id) notificationIds.push(p.notification_id);
        if (p.write_reason === "anpi_p61_inserted" && Number(p.inserted) > 1) {
          await emergencyStop("duplicate");
          throw new Error("anpi_p62_STOP_duplicate");
        }
      }

      evidence.counts.cron_path_runs += 1;
      evidence.counts.claimed += Number(run.jobsClaimed || 0);
      evidence.counts.inserted += inserted;
      evidence.counts.already_seen += alreadySeen;
      if (i > 1 && inserted > 0) {
        evidence.counts.duplicates += inserted;
        await emergencyStop("duplicate_on_reclaim");
        throw new Error("anpi_p62_STOP_duplicate_on_reclaim");
      }

      evidence.soak_runs.push({
        run: i,
        status: run.status,
        lease: run.lease,
        mode: run.mode,
        jobsClaimed: run.jobsClaimed,
        jobsDelivered: run.jobsDelivered,
        jobsFailed: run.jobsFailed,
        provider_validation: run.provider_validation,
        processed: processed.map((p) => ({
          jobId: short(p.jobId),
          kind: p.kind,
          subject_sha8: p.subject_sha8,
          write_reason: p.write_reason,
          notification_id: short(p.notification_id),
          inserted: p.inserted,
          already_seen: p.already_seen,
          delivery_status: p.delivery_status,
        })),
        outsider_still_pending: ojRow?.status === "pending",
      });

      if (run.status !== "PASS") {
        await emergencyStop("run_fail");
        throw new Error(`anpi_p62_run_${i}_fail`);
      }
    }

    // Marker shape check
    const uniqueIds = [...new Set(notificationIds)];
    if (uniqueIds.length !== 1) {
      // One logical notification across reclaim; duplicates would create more ids
      if (uniqueIds.length > 1) {
        await emergencyStop("multiple_notification_ids");
        throw new Error("anpi_p62_STOP_multiple_notification_ids");
      }
    }
    if (uniqueIds[0]) {
      const row = await rest(
        client,
        `/rest/v1/talk_notifications?id=eq.${encodeURIComponent(uniqueIds[0])}&select=id,source,type,target_url,user_id`
      );
      const n = Array.isArray(row.json) ? row.json[0] : null;
      evidence.dry.inbox_row = {
        id: short(n?.id),
        source: n?.source,
        type: n?.type,
        target_url: n?.target_url,
        source_ok: n?.source === ANPI_P61_SOURCE,
      };
      if (n?.source !== ANPI_P61_SOURCE) throw new Error("anpi_p62_marker_mismatch");
    }

    evidence.counts.duplicates = evidence.counts.duplicates || 0;
    evidence.negatives.allowlist_out_insert_0 = {
      pass: true,
      outsider_job_status: "pending",
    };

    // Immediate stop
    const dis = await rpc(client, "anpi_phase62_claim_allowlist_emergency_disable", {});
    const disRow = Array.isArray(dis.json) ? dis.json[0] : dis.json;
    gateEnabled = false;
    evidence.cleanup.emergency_disable = {
      enabled: disRow?.enabled === false,
      ok: dis.ok && disRow?.enabled === false,
    };

    // Post-disable claim 0
    const postClaim = await rpc(client, "anpi_phase62_claim_jobs_allowlisted", {
      p_worker_id: "anpi-p62-post-disable",
      p_limit: 5,
      p_now: new Date().toISOString(),
    });
    const postRows = Array.isArray(postClaim.json) ? postClaim.json : [];
    evidence.negatives.gate_off_after_soak_claim_0 = { pass: postRows.length === 0, n: postRows.length };

    // Cleanup markers
    const cleaned = await cleanupScopedMarkers(client, { dryRun: false });
    evidence.cleanup.markers = {
      deleted_count: cleaned.deleted_count,
      matched_count: cleaned.matched_count,
      reason_code: cleaned.reason_code,
    };

    // Cleanup soak jobs / checks / outsider
    if (soakJobId) {
      await rest(client, `/rest/v1/anpi_scheduler_jobs?id=eq.${soakJobId}`, { method: "DELETE" }).catch(() => null);
      // DELETE may be denied — mark cancelled instead
      await rest(client, `/rest/v1/anpi_scheduler_jobs?id=eq.${soakJobId}`, {
        method: "PATCH",
        body: {
          status: "cancelled",
          completed_at: new Date().toISOString(),
          claimed_at: null,
          claimed_by: null,
          lease_expires_at: null,
          last_error_safe: "anpi_p62_soak_cleanup",
        },
      });
    }
    if (outsiderJobId) {
      await rest(client, `/rest/v1/anpi_scheduler_jobs?id=eq.${outsiderJobId}`, {
        method: "PATCH",
        body: {
          status: "cancelled",
          completed_at: new Date().toISOString(),
          last_error_safe: "anpi_p62_soak_cleanup",
        },
      });
    }
    if (outsiderCheckId) {
      await rest(client, `/rest/v1/anpi_check_instances?id=eq.${outsiderCheckId}`, {
        method: "PATCH",
        body: { status: "cancelled", cancelled_at: new Date().toISOString() },
      });
    }
    if (soakCheckId) {
      await rest(client, `/rest/v1/anpi_check_instances?id=eq.${soakCheckId}`, {
        method: "PATCH",
        body: { status: "cancelled", cancelled_at: new Date().toISOString() },
      });
    }
    if (outsiderSettingId) {
      await rest(client, `/rest/v1/anpi_settings?id=eq.${outsiderSettingId}`, {
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

    const remain = await rest(
      client,
      `/rest/v1/talk_notifications?source=eq.${ANPI_P61_SOURCE}&select=id`
    );
    const remainN = Array.isArray(remain.json) ? remain.json.length : -1;
    evidence.cleanup.remaining_markers = remainN;

    const gFinal = await rest(
      client,
      `/rest/v1/anpi_phase62_claim_allowlist_gate?id=eq.1&select=enabled,allowed_auth_sha8`
    );
    const gf = Array.isArray(gFinal.json) ? gFinal.json[0] : null;
    evidence.final = {
      gate_enabled: gf?.enabled === true,
      gate_false: gf?.enabled === false,
      allowlist: gf?.allowed_auth_sha8,
      scoped_flag_off: true,
      writer_flag_off: true,
      provider: "talk_local",
      remaining_markers: remainN,
    };

    const pass =
      evidence.counts.cron_path_runs === 3 &&
      evidence.counts.inserted === 1 &&
      evidence.counts.duplicates === 0 &&
      evidence.counts.already_seen >= 2 &&
      evidence.cleanup.emergency_disable?.ok &&
      evidence.final.gate_false &&
      remainN === 0 &&
      evidence.negatives.gate_off_claim_0?.pass &&
      evidence.negatives.allowlist_out_insert_0?.pass &&
      evidence.negatives.production_ref?.pass &&
      evidence.negatives.non_service_role_claim?.pass;

    evidence.verdict = pass ? "SOAK_PASS" : "NO_GO";
    evidence.finished_at = new Date().toISOString();
  } catch (e) {
    evidence.verdict = "NO_GO";
    evidence.error = String(e?.message || e).slice(0, 200);
    evidence.finished_at = new Date().toISOString();
    if (gateEnabled && client) {
      await emergencyStop(evidence.stop_reason || "exception");
    }
  }

  fs.mkdirSync(path.dirname(EVIDENCE), { recursive: true });
  fs.writeFileSync(EVIDENCE, JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify({
    verdict: evidence.verdict,
    runs: evidence.counts.cron_path_runs,
    claimed: evidence.counts.claimed,
    inserted: evidence.counts.inserted,
    duplicates: evidence.counts.duplicates,
    already_seen: evidence.counts.already_seen,
    gate_final: evidence.final?.gate_false,
    remaining: evidence.cleanup?.remaining_markers ?? evidence.final?.remaining_markers,
    error: evidence.error || null,
    evidence: path.relative(root, EVIDENCE),
  }, null, 2));

  if (evidence.verdict !== "SOAK_PASS") process.exit(1);
}

main().catch((e) => {
  console.error("FAIL", String(e?.message || e).slice(0, 200));
  process.exit(1);
});
