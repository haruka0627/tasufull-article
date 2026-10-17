#!/usr/bin/env node
/**
 * ANPI Phase 59 — Staging controlled real inbox write probe.
 *
 * Flow:
 *   preflight → set idempotency key → enable → dry-run → live INSERT
 *   → idempotent re-run → RLS probes → cleanup → emergency_disable
 *
 * Never prints secrets. Never touches Production. Never flips Cron provider.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  createStagingRestClient,
  firstRpcRow,
  assertStagingApiUrl,
  assertEnvProjectRef,
  validatePhase58ShapeContract,
  evaluateRowShape,
  ANPI_P59_IDEMPOTENCY_KEY,
  ANPI_P59_STAGING_REF,
  ANPI_P59_TARGET_AUTH_SHA8,
  ANPI_P59_TARGET_TALK_SHA16,
  ANPI_P59_SOURCE,
  ANPI_P59_TYPE,
  ANPI_P59_TARGET_URL,
} from "./lib/anpi-phase59-staging-controlled-write.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MAIN_ENV = "C:/Users/rubih/tasufull-article/.env.staging";
const EVIDENCE = path.join(root, "reports", "anpi-phase59-staging-controlled-write-evidence.json");

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

function sha8(v) {
  return crypto.createHash("sha256").update(String(v)).digest("hex").slice(0, 8);
}
function sha16(v) {
  return crypto.createHash("sha256").update(String(v)).digest("hex").slice(0, 16);
}

function shortId(id) {
  const s = String(id || "");
  return s.length <= 20 ? s : `${s.slice(0, 16)}…`;
}

async function mintUserAccessToken(client, { userId, email }) {
  // generate_link returns hashed_token at top-level (not under properties).
  const link = await client.authAdmin("/admin/generate_link", {
    method: "POST",
    body: { type: "magiclink", email },
  });
  if (!link.ok) {
    return { ok: false, reason: `generate_link_${link.status}` };
  }
  const tokenHash =
    link.json?.hashed_token ||
    link.json?.properties?.hashed_token ||
    null;
  if (!tokenHash || !client.anonKey) {
    return { ok: false, reason: "no_hashed_token", user_sha8: sha8(userId) };
  }

  // GoTrue: only token_hash + type (do not send email).
  const verify = await fetch(`${client.apiUrl}/auth/v1/verify`, {
    method: "POST",
    headers: {
      apikey: client.anonKey,
      Authorization: `Bearer ${client.anonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ type: "magiclink", token_hash: tokenHash }),
  });
  const vt = await verify.text();
  let vj = null;
  try {
    vj = vt ? JSON.parse(vt) : null;
  } catch {
    vj = null;
  }
  if (!verify.ok || !vj?.access_token) {
    return {
      ok: false,
      reason: `verify_${verify.status}`,
      user_sha8: sha8(userId),
    };
  }
  return { ok: true, access_token: vj.access_token, user_sha8: sha8(userId) };
}

async function selectNotificationsAs(client, accessToken, notificationId) {
  const res = await fetch(
    `${client.apiUrl}/rest/v1/talk_notifications?id=eq.${encodeURIComponent(notificationId)}&select=id,type,target_url,source`,
    {
      headers: {
        apikey: client.anonKey,
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, count: Array.isArray(json) ? json.length : null, json };
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
  const envRef =
    process.env.SUPABASE_PROJECT_REF || fileEnv.SUPABASE_PROJECT_REF || ANPI_P59_STAGING_REF;

  const evidence = {
    phase: 59,
    started_at: new Date().toISOString(),
    project_ref: null,
    env_ref: null,
    enablement: "phase17_staging_gate_reuse",
    cron_provider_unchanged: "talk_local*",
    phase10_real_mode_still_disabled: null,
    steps: {},
    negatives: {},
    rls: {},
    counts: {},
    verdict: "PENDING",
  };

  let client = null;
  let notificationId = null;
  let enabled = false;
  let inserted = false;

  try {
    evidence.project_ref = assertStagingApiUrl(apiUrl);
    evidence.env_ref = assertEnvProjectRef(envRef);
    if (evidence.project_ref !== evidence.env_ref) {
      throw new Error("anpi_p59_env_url_ref_mismatch");
    }

    const contractCheck = validatePhase58ShapeContract();
    evidence.steps.contract = { ok: contractCheck.ok, error: contractCheck.error };
    if (!contractCheck.ok) throw new Error("anpi_p59_contract_invalid");

    client = createStagingRestClient({ apiUrl, serviceKey, anonKey });

    // Negative: anon cannot call writer
    const anonDeny = await client.rpc(
      "anpi_phase17_insert_first_test_notification",
      { p_dry_run: true },
      anonKey
    );
    evidence.negatives.anon_writer_denied = {
      pass: anonDeny.status === 401 || anonDeny.code === "42501",
      status: anonDeny.status,
      code: anonDeny.code,
    };

    // Negative: Production URL refused (unit-covered; also assert here)
    let prodRefuse = false;
    try {
      assertStagingApiUrl(`https://ddojquacsyqesrjhcvmn.supabase.co`);
    } catch {
      prodRefuse = true;
    }
    evidence.negatives.production_ref_refused = { pass: prodRefuse };

    const health = firstRpcRow(await client.phase10Health());
    evidence.phase10_real_mode_still_disabled = health?.real_mode_enabled === false;
    evidence.steps.phase10_health = {
      ok: health?.ok === true,
      real_mode_enabled: health?.real_mode_enabled,
      production_send: health?.production_send,
      staging_send: health?.staging_send,
      user_facing_inbox_write: health?.user_facing_inbox_write,
    };

    // Preflight gate
    const gateBefore = firstRpcRow(await client.readGate());
    if (!gateBefore) throw new Error("anpi_p59_gate_unreadable");
    evidence.steps.preflight_gate = {
      enabled: gateBefore.enabled,
      target_auth_sha8: gateBefore.target_auth_sha8,
      inserted_count: gateBefore.inserted_count,
      max_inserts: gateBefore.max_inserts,
      idempotency_key_before: gateBefore.idempotency_key,
    };
    if (gateBefore.enabled === true) throw new Error("anpi_p59_gate_already_enabled");
    if (Number(gateBefore.inserted_count) !== 0) throw new Error("anpi_p59_gate_dirty_count");
    if (gateBefore.target_auth_sha8 !== ANPI_P59_TARGET_AUTH_SHA8) {
      throw new Error("anpi_p59_unexpected_target");
    }

    const poll0 = firstRpcRow(await client.polling());
    evidence.counts.before = {
      inbox_for_target: poll0?.inbox_for_target,
      inbox_total: poll0?.inbox_total,
      anon_select: poll0?.anon_select,
      auth_insert: poll0?.auth_insert,
      realtime_registered: poll0?.realtime_registered,
      writer_reader_parity: poll0?.writer_reader_parity,
    };
    if (Number(poll0?.inbox_for_target) !== 0) throw new Error("anpi_p59_target_inbox_not_empty");
    if (poll0?.anon_select !== false) throw new Error("anpi_p59_anon_select_true");
    if (poll0?.auth_insert !== false) throw new Error("anpi_p59_auth_insert_true");

    // Bind Phase 59 idempotency key on gate (cleanup uses gate key)
    const keyPatch = await client.setGateIdempotencyKey(ANPI_P59_IDEMPOTENCY_KEY);
    if (!keyPatch.ok) throw new Error(`anpi_p59_key_patch_${keyPatch.status}`);
    evidence.steps.idempotency_key = ANPI_P59_IDEMPOTENCY_KEY;

    // Enable
    const en = firstRpcRow(await client.enableFlag());
    if (en?.enabled !== true) throw new Error("anpi_p59_enable_failed");
    enabled = true;
    evidence.steps.enable = { enabled: true, target_bound: en.target_bound };

    // Dry-run
    const dry = firstRpcRow(await client.insert({ dryRun: true }));
    evidence.steps.dry_run = {
      reason_code: dry?.reason_code,
      inserted_count: dry?.inserted_count,
      already_seen: dry?.already_seen,
      notification_id: shortId(dry?.notification_id),
      talk_user_id_sha16: dry?.talk_user_id_sha16,
    };
    if (dry?.reason_code !== "anpi_phase17_dry_run_would_insert") {
      throw new Error(`anpi_p59_dry_unexpected:${dry?.reason_code}`);
    }
    if (Number(dry?.inserted_count) !== 0) throw new Error("anpi_p59_dry_inserted");

    const pollDry = firstRpcRow(await client.polling());
    if (Number(pollDry?.inbox_for_target) !== 0) throw new Error("anpi_p59_dry_leaked");

    // LIVE INSERT (once)
    const live = firstRpcRow(await client.insert({ dryRun: false }));
    evidence.steps.live_insert = {
      reason_code: live?.reason_code,
      inserted_count: live?.inserted_count,
      already_seen: live?.already_seen,
      notification_id: shortId(live?.notification_id),
      talk_user_id_sha16: live?.talk_user_id_sha16,
    };
    if (live?.reason_code !== "anpi_phase17_inserted" || Number(live?.inserted_count) !== 1) {
      throw new Error(`anpi_p59_live_unexpected:${live?.reason_code}`);
    }
    if (live?.talk_user_id_sha16 !== ANPI_P59_TARGET_TALK_SHA16) {
      throw new Error("anpi_p59_talk_sha_mismatch");
    }
    notificationId = live.notification_id;
    inserted = true;

    // Fetch row shape (service_role)
    const rowRes = await client.rest(
      `/rest/v1/talk_notifications?id=eq.${encodeURIComponent(notificationId)}&select=id,type,title,body,target_url,source,user_id,priority`
    );
    const row = Array.isArray(rowRes.json) ? rowRes.json[0] : null;
    if (!row) throw new Error("anpi_p59_row_missing_after_insert");
    const shape = evaluateRowShape(row);
    evidence.steps.row_shape = {
      ok: shape.ok,
      findings: shape.findings,
      type: row.type,
      target_url: row.target_url,
      source: row.source,
      title_len: String(row.title || "").length,
      body_len: String(row.body || "").length,
      user_talk_sha16: sha16(row.user_id),
      notification_id: shortId(row.id),
    };
    if (!shape.ok) throw new Error("anpi_p59_row_shape_fail");
    if (sha16(row.user_id) !== ANPI_P59_TARGET_TALK_SHA16) {
      throw new Error("anpi_p59_owner_mismatch");
    }

    const poll1 = firstRpcRow(await client.polling());
    evidence.counts.after_insert = {
      inbox_for_target: poll1?.inbox_for_target,
      inbox_total: poll1?.inbox_total,
    };
    if (Number(poll1?.inbox_for_target) !== 1) throw new Error("anpi_p59_count_after_insert");

    // Idempotent re-run
    const again = firstRpcRow(await client.insert({ dryRun: false }));
    evidence.steps.idempotent_rerun = {
      reason_code: again?.reason_code,
      inserted_count: again?.inserted_count,
      already_seen: again?.already_seen,
      notification_id: shortId(again?.notification_id),
    };
    if (again?.reason_code !== "anpi_phase17_already_seen" || again?.already_seen !== true) {
      throw new Error(`anpi_p59_idempotent_unexpected:${again?.reason_code}`);
    }
    const poll2 = firstRpcRow(await client.polling());
    evidence.counts.after_idempotent = {
      inbox_for_target: poll2?.inbox_for_target,
      inbox_total: poll2?.inbox_total,
    };
    if (Number(poll2?.inbox_for_target) !== 1 || Number(poll2?.inbox_total) !== 1) {
      throw new Error("anpi_p59_duplicate_detected");
    }

    // Malformed / forbidden force key charset (expect RPC error)
    const badKeyRes = await client.insert({
      dryRun: true,
      forceKey: "bad key with spaces!!",
    });
    evidence.negatives.malformed_idempotency_key = {
      pass:
        badKeyRes.ok === false ||
        String(badKeyRes.code || badKeyRes.json?.message || "").includes(
          "invalid_idempotency"
        ),
      status: badKeyRes.status,
      code: String(badKeyRes.code || badKeyRes.json?.message || "").slice(0, 80),
    };

    // RLS probes via Auth Admin mint (best-effort)
    const gateFull = firstRpcRow(await client.readGate());
    const targetAuth = gateFull?.target_auth_user_id;
    const targetTalk = gateFull?.target_talk_user_id;
    evidence.rls.target_auth_sha8 = targetAuth ? sha8(targetAuth) : null;
    evidence.rls.target_talk_sha16 = targetTalk ? sha16(targetTalk) : null;

    // Anon SELECT of the row must not return data (table privilege false already;
    // also attempt REST — expect empty or error)
    if (anonKey) {
      const anonSel = await client.rest(
        `/rest/v1/talk_notifications?id=eq.${encodeURIComponent(notificationId)}&select=id`,
        { key: anonKey }
      );
      evidence.rls.anon_select_row = {
        status: anonSel.status,
        count: Array.isArray(anonSel.json) ? anonSel.json.length : null,
        pass:
          anonSel.status === 401 ||
          anonSel.status === 403 ||
          (Array.isArray(anonSel.json) && anonSel.json.length === 0),
      };
    }

    // Other mapped user + owner visibility via generate_link
    const maps = await client.rest(
      "/rest/v1/anpi_user_contexts?mapping_status=eq.approved_phase15&select=auth_user_id,talk_user_id"
    );
    const mapRows = Array.isArray(maps.json) ? maps.json : [];
    const other = mapRows.find((r) => r.auth_user_id !== targetAuth);
    evidence.rls.map_count = mapRows.length;

    if (anonKey && targetAuth) {
      const userRes = await client.authAdmin(`/admin/users/${targetAuth}`);
      const email = userRes.json?.email || userRes.json?.user?.email;
      if (userRes.ok && email) {
        const minted = await mintUserAccessToken(client, { userId: targetAuth, email });
        evidence.rls.owner_mint = { ok: minted.ok, reason: minted.reason || null };
        if (minted.ok) {
          const sel = await selectNotificationsAs(client, minted.access_token, notificationId);
          evidence.rls.owner_can_read = {
            status: sel.status,
            count: sel.count,
            pass: sel.status === 200 && sel.count === 1,
          };
        }
      } else {
        evidence.rls.owner_mint = { ok: false, reason: "admin_user_email_unavailable" };
      }
    }

    if (anonKey && other?.auth_user_id) {
      const userRes = await client.authAdmin(`/admin/users/${other.auth_user_id}`);
      const email = userRes.json?.email || userRes.json?.user?.email;
      if (userRes.ok && email) {
        const minted = await mintUserAccessToken(client, {
          userId: other.auth_user_id,
          email,
        });
        evidence.rls.other_mint = {
          ok: minted.ok,
          reason: minted.reason || null,
          other_auth_sha8: sha8(other.auth_user_id),
        };
        if (minted.ok) {
          const sel = await selectNotificationsAs(client, minted.access_token, notificationId);
          evidence.rls.other_cannot_read = {
            status: sel.status,
            count: sel.count,
            pass: sel.status === 200 && sel.count === 0,
          };
        }
      } else {
        evidence.rls.other_mint = { ok: false, reason: "admin_user_email_unavailable" };
      }
    }

    // Service-role isolation count: only target owns the marker row
    const otherCount = await client.rest(
      `/rest/v1/talk_notifications?select=id&source=eq.${ANPI_P59_SOURCE}&user_id=neq.${encodeURIComponent(targetTalk)}`
    );
    evidence.rls.other_user_marker_rows = {
      count: Array.isArray(otherCount.json) ? otherCount.json.length : null,
      pass: Array.isArray(otherCount.json) && otherCount.json.length === 0,
    };

    // Cleanup dry + live
    const cDry = firstRpcRow(await client.cleanup({ dryRun: true }));
    evidence.steps.cleanup_dry = {
      reason_code: cDry?.reason_code,
      matched_count: cDry?.matched_count,
      deleted_count: cDry?.deleted_count,
    };
    if (cDry?.reason_code !== "anpi_phase17_cleanup_dry_run" || Number(cDry?.matched_count) !== 1) {
      throw new Error(`anpi_p59_cleanup_dry_unexpected:${cDry?.reason_code}`);
    }

    const cLive = firstRpcRow(await client.cleanup({ dryRun: false }));
    evidence.steps.cleanup_live = {
      reason_code: cLive?.reason_code,
      matched_count: cLive?.matched_count,
      deleted_count: cLive?.deleted_count,
      notification_id: shortId(cLive?.notification_id),
    };
    if (cLive?.reason_code !== "anpi_phase17_cleanup_deleted" || Number(cLive?.deleted_count) !== 1) {
      throw new Error(`anpi_p59_cleanup_live_unexpected:${cLive?.reason_code}`);
    }
    inserted = false;

    const poll3 = firstRpcRow(await client.polling());
    evidence.counts.after_cleanup = {
      inbox_for_target: poll3?.inbox_for_target,
      inbox_total: poll3?.inbox_total,
    };
    if (Number(poll3?.inbox_for_target) !== 0 || Number(poll3?.inbox_total) !== 0) {
      throw new Error("anpi_p59_cleanup_residue");
    }

    // Confirm marker gone
    const gone = await client.rest(
      `/rest/v1/talk_notifications?id=eq.${encodeURIComponent(notificationId)}&select=id`
    );
    evidence.steps.cleanup_verify = {
      remaining: Array.isArray(gone.json) ? gone.json.length : null,
      pass: Array.isArray(gone.json) && gone.json.length === 0,
    };
    if (!evidence.steps.cleanup_verify.pass) throw new Error("anpi_p59_cleanup_row_remains");

    // Emergency disable + probe flag_off
    const dis = firstRpcRow(await client.emergencyDisable());
    enabled = false;
    evidence.steps.emergency_disable = {
      flag_off: dis?.enabled === false,
      pass: dis?.enabled === false,
    };

    const probe = firstRpcRow(await client.insert({ dryRun: true }));
    evidence.steps.post_disable_probe = {
      reason_code: probe?.reason_code,
      pass: probe?.reason_code === "anpi_phase17_flag_off",
    };
    if (!evidence.steps.post_disable_probe.pass) {
      throw new Error(`anpi_p59_post_disable_unexpected:${probe?.reason_code}`);
    }

    // Restore default gate key for future Phase17/18 compatibility
    await client.setGateIdempotencyKey("anpi-phase17-first-insert-v1");

    const rlsOwner = evidence.rls.owner_can_read?.pass === true;
    const rlsOther = evidence.rls.other_cannot_read?.pass === true;
    const rlsAnon = evidence.rls.anon_select_row?.pass === true;
    const rlsMarker = evidence.rls.other_user_marker_rows?.pass === true;
    evidence.rls.jwt_owner_other =
      rlsOwner && rlsOther ? "PASS" : rlsOwner || rlsOther ? "PARTIAL" : "FAIL";

    const required = [
      evidence.negatives.anon_writer_denied?.pass,
      evidence.negatives.production_ref_refused?.pass,
      evidence.negatives.malformed_idempotency_key?.pass,
      evidence.phase10_real_mode_still_disabled === true,
      evidence.steps.live_insert?.reason_code === "anpi_phase17_inserted",
      evidence.steps.idempotent_rerun?.already_seen === true,
      evidence.steps.cleanup_verify?.pass,
      evidence.steps.post_disable_probe?.pass,
      evidence.steps.emergency_disable?.pass,
      rlsAnon,
      rlsMarker,
      rlsOwner,
      rlsOther,
    ];
    evidence.verdict = required.every(Boolean)
      ? "PASS_STAGING_CONTROLLED_WRITE"
      : "FAIL";
    evidence.finished_at = new Date().toISOString();
    evidence.production_real_inbox_send = "NOT_READY";
    evidence.periodic_cron_real_write = "NOT_SWITCHED";

    fs.mkdirSync(path.dirname(EVIDENCE), { recursive: true });
    fs.writeFileSync(EVIDENCE, JSON.stringify(evidence, null, 2), "utf8");
    console.log(JSON.stringify(evidence, null, 2));

    if (evidence.verdict !== "PASS_STAGING_CONTROLLED_WRITE") {
      console.error("FAIL Phase 59 staging controlled write");
      process.exitCode = 1;
      return;
    }
    console.log("PASS Phase 59 staging controlled real inbox write");
  } catch (err) {
    evidence.verdict = "FAIL";
    evidence.error = String(err?.message || err).slice(0, 240);
    evidence.finished_at = new Date().toISOString();
    try {
      if (client) {
        if (inserted) {
          await client.setGateIdempotencyKey(ANPI_P59_IDEMPOTENCY_KEY);
          await client.cleanup({ dryRun: false });
        }
        if (enabled) await client.emergencyDisable();
        await client.setGateIdempotencyKey("anpi-phase17-first-insert-v1");
      }
    } catch (cleanupErr) {
      evidence.cleanup_on_error = String(cleanupErr?.message || cleanupErr).slice(0, 160);
    }
    fs.mkdirSync(path.dirname(EVIDENCE), { recursive: true });
    fs.writeFileSync(EVIDENCE, JSON.stringify(evidence, null, 2), "utf8");
    console.error(JSON.stringify(evidence, null, 2));
    console.error("FAIL", evidence.error);
    process.exitCode = 1;
  }
}

main();
