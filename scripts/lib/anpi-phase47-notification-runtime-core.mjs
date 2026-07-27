/**
 * ANPI Phase 47 窶・Notification Runtime Core (staging-safe simulation)
 *
 * Goals (this phase):
 * - Never enable Production runtime, never perform external sends.
 * - Use existing Phase 2窶・0 schema/state-machine via RPCs where available.
 * - Add missing "Runtime core" pieces:
 *   - reminder cadence candidate generation (+2h / +4h) with idempotency
 *   - contact_notified state reflection after contact_unconfirmed delivery
 *   - late_confirmation candidate generation after confirmed_late
 *
 * Notes:
 * - We process only initial/reminder/contact_unconfirmed jobs in this phase.
 * - late_confirmation jobs are enqueued as candidates only (no local delivery)
 *   to match "confirmed checks never deliver third-party notifications" guard.
 */

const PRODUCTION_SUPABASE_REF = "ddojquacsyqesrjhcvmn";

function iso(p) {
  if (!p) return new Date().toISOString();
  return new Date(p).toISOString();
}

function toMs(isoString) {
  return new Date(isoString).getTime();
}

function parseReminderPolicy(policy) {
  // DB may return jsonb as object, but keep defensive parsing.
  if (!policy) return { intervalMinutes: [] };
  let raw = policy;
  if (typeof raw === "string") {
    raw = JSON.parse(raw);
  }
  const mins = raw?.interval_minutes ?? raw?.intervalMinutes ?? [];
  const arr = Array.isArray(mins) ? mins.map((n) => Number(n)).filter((n) => Number.isFinite(n)) : [];
  return { intervalMinutes: arr };
}

function parseIntervalToMs(interval) {
  // PostgREST typically returns Postgres interval as e.g. "02:00:00".
  if (interval == null) return NaN;
  if (typeof interval === "number") return interval;
  const s = String(interval).trim();
  const m2 = s.match(/^(-)?(\d{1,2}):(\d{2}):(\d{2})(?:\.\d+)?$/);
  if (m2) {
    const sign = m2[1] ? -1 : 1;
    const hh = Number(m2[2] || 0);
    const mm = Number(m2[3] || 0);
    const ss = Number(m2[4] || 0);
    return sign * (hh * 3600_000 + mm * 60_000 + ss * 1000);
  }
  return NaN;
}

function firstRow(json) {
  if (!json) return null;
  return Array.isArray(json) ? json[0] : json;
}

function assertNoProduction(apiUrl) {
  const url = String(apiUrl || "");
  if (!url) throw new Error("anpi_phase47_missing_apiUrl");
  if (url.includes(PRODUCTION_SUPABASE_REF)) {
    throw new Error("anpi_phase47_refusing_production_endpoint");
  }
}

async function rpc(apiUrl, serviceKey, name, args) {
  const res = await fetch(`${apiUrl}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(args || {}),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    const code = json?.code || json?.message || `HTTP_${res.status}`;
    throw new Error(`anpi_phase47_rpc_${name}_failed:${String(code).slice(0, 90)}`);
  }
  return json;
}

async function restSelect(apiUrl, serviceKey, resourcePath) {
  const url = `${apiUrl}/rest/v1/${resourcePath}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Prefer: "return=representation",
    },
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : [];
  } catch {
    json = [];
  }
  if (!res.ok) {
    const code = json?.code || json?.message || `HTTP_${res.status}`;
    throw new Error(`anpi_phase47_restSelect_failed:${String(code).slice(0, 90)}:${url}`);
  }
  return Array.isArray(json) ? json : [];
}

async function restInsert(apiUrl, serviceKey, table, row) {
  const res = await fetch(`${apiUrl}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(row),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    const code = json?.code || json?.message || `HTTP_${res.status}`;
    throw new Error(`anpi_phase47_restInsert_${table}_failed:${String(code).slice(0, 90)}`);
  }
  return firstRow(json);
}

async function restPatch(apiUrl, serviceKey, resourcePath, patchRow) {
  const res = await fetch(`${apiUrl}/rest/v1/${resourcePath}`, {
    method: "PATCH",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(patchRow),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    const code = json?.code || json?.message || `HTTP_${res.status}`;
    throw new Error(`anpi_phase47_restPatch_failed:${String(code).slice(0, 90)}:${resourcePath}`);
  }
  return json;
}

async function ensureReminderJob({ apiUrl, serviceKey, check, recipientUserId, availableAtIso }) {
  // Unique constraint: (check_id, recipient_user_id, channel, kind)
  const existing = await restSelect(
    apiUrl,
    serviceKey,
    `anpi_scheduler_jobs?check_id=eq.${check.id}&recipient_user_id=eq.${recipientUserId}` +
      `&channel=eq.talk&kind=eq.reminder&select=id,status,available_at,attempt_count`
  );
  const job = existing[0] || null;
  if (!job) {
    return restInsert(apiUrl, serviceKey, "anpi_scheduler_jobs", {
      check_id: check.id,
      subject_user_id: check.subject_user_id,
      recipient_user_id: recipientUserId,
      contact_id: null,
      channel: "talk",
      kind: "reminder",
      status: "pending",
      available_at: availableAtIso,
    });
  }

  if (job.status !== "pending" || (job.available_at && String(job.available_at) !== String(availableAtIso))) {
    await restPatch(apiUrl, serviceKey, `anpi_scheduler_jobs?id=eq.${job.id}`, {
      status: "pending",
      available_at: availableAtIso,
      claimed_at: null,
      claimed_by: null,
      completed_at: null,
      lease_expires_at: null,
      last_error_safe: null,
    });
  }
  return job;
}

async function countDeliveredReminderAttempts({ apiUrl, serviceKey, checkId }) {
  const rows = await restSelect(
    apiUrl,
    serviceKey,
    `anpi_notification_deliveries?check_id=eq.${checkId}&kind=eq.reminder&status=eq.delivered&select=id,attempt_number`
  );
  return Array.isArray(rows) ? rows.length : 0;
}

async function cancelPendingJobsForCheck({ apiUrl, serviceKey, checkId, pNowIso, reason }) {
  try {
    await rpc(apiUrl, serviceKey, "anpi_phase6_cancel_jobs_for_check", {
      p_check_id: checkId,
      p_reason: String(reason || "anpi_phase47_contact_notified").slice(0, 80),
      p_now: pNowIso,
    });
  } catch {
    // Best-effort.
  }
}

async function processDueTalkJobs({ apiUrl, serviceKey, pNowIso, workerId, stubMode, claimLimit = 200 }) {
  const processKinds = new Set(["initial", "reminder", "contact_unconfirmed"]);
  const processed = [];
  let rounds = 0;
  while (rounds < 20) {
    rounds += 1;
    const claimedRows = await rpc(apiUrl, serviceKey, "anpi_phase6_claim_jobs", {
      p_worker_id: workerId,
      p_limit: claimLimit,
      p_now: pNowIso,
    });
    const jobs = Array.isArray(claimedRows) ? claimedRows : [];
    if (jobs.length === 0) break;

    for (const job of jobs) {
      if (!job?.kind || !processKinds.has(job.kind)) {
        // Should not happen in this phase (late_confirmation inserted after processing), but keep safe.
        await rpc(apiUrl, serviceKey, "anpi_phase4_complete_notification_candidate", {
          p_job_id: job.id,
          p_worker_id: workerId,
          p_status: "skipped",
          p_now: pNowIso,
        });
        processed.push({ jobId: job.id, checkId: job.check_id, kind: job.kind, skipped: true });
        continue;
      }

      try {
        const out = await rpc(apiUrl, serviceKey, "anpi_phase6_process_claimed_job", {
          p_job_id: job.id,
          p_worker_id: workerId,
          p_stub_mode: stubMode,
          p_now: pNowIso,
        });
        const row = Array.isArray(out) ? out[0] : out;
        processed.push({
          jobId: job.id,
          checkId: job.check_id,
          kind: job.kind,
          delivery_status: row?.delivery_status ?? null,
          attempt_number: row?.attempt_number ?? null,
        });
      } catch (e) {
        // Failure isolation: skip only this job/check, avoid leaving it stuck in processing.
        try {
          await rpc(apiUrl, serviceKey, "anpi_phase4_complete_notification_candidate", {
            p_job_id: job.id,
            p_worker_id: workerId,
            p_status: "skipped",
            p_now: pNowIso,
          });
        } catch {
          // ignore
        }
        processed.push({
          jobId: job.id,
          checkId: job.check_id,
          kind: job.kind,
          delivery_status: "skipped",
          attempt_number: null,
          error: e?.message ? String(e.message).slice(0, 160) : "unknown",
        });
      }
    }
  }
  return processed;
}

async function setCheckStatus({ apiUrl, serviceKey, checkId, patch }) {
  await restPatch(apiUrl, serviceKey, `anpi_check_instances?id=eq.${checkId}`, patch);
}

async function generateLateConfirmationCandidates({ apiUrl, serviceKey, pNowIso }) {
  const confirmedLate = await restSelect(
    apiUrl,
    serviceKey,
    `anpi_check_instances?status=eq.confirmed_late&select=id,subject_user_id`
  );

  const created = [];
  for (const check of confirmedLate) {
    try {
      const deliveries = await restSelect(
        apiUrl,
        serviceKey,
        `anpi_notification_deliveries?check_id=eq.${check.id}` +
          `&kind=eq.contact_unconfirmed&status=eq.delivered&select=recipient_user_id,contact_id`
      );
      if (!deliveries.length) continue;

      const uniqueRecipients = new Map();
      for (const d of deliveries) {
        if (!d?.recipient_user_id || !d?.contact_id) continue;
        const key = `${d.recipient_user_id}:${d.contact_id}`;
        uniqueRecipients.set(key, { recipientUserId: d.recipient_user_id, contactId: d.contact_id });
      }

      for (const { recipientUserId, contactId } of uniqueRecipients.values()) {
        const existingJobs = await restSelect(
          apiUrl,
          serviceKey,
          `anpi_scheduler_jobs?check_id=eq.${check.id}` +
            `&recipient_user_id=eq.${recipientUserId}&channel=eq.talk&kind=eq.late_confirmation` +
            `&select=id,status`
        );
        if (existingJobs.length) continue;

        await restInsert(apiUrl, serviceKey, "anpi_scheduler_jobs", {
          check_id: check.id,
          subject_user_id: check.subject_user_id,
          recipient_user_id: recipientUserId,
          contact_id: contactId,
          channel: "talk",
          kind: "late_confirmation",
          status: "pending",
          available_at: pNowIso,
        });
        created.push({ checkId: check.id, recipientUserId, contactId });
      }
    } catch {
      // Failure isolation: ignore per-check late confirmation candidate errors.
    }
  }
  return created;
}

export async function runAnpiPhase47NotificationRuntimeCore({
  apiUrl,
  serviceKey,
  pNow,
  workerId = "anpi-phase47-runtime-core",
  stubMode = "success",
}) {
  assertNoProduction(apiUrl);
  if (!serviceKey) throw new Error("anpi_phase47_missing_serviceKey");

  const pNowIso = iso(pNow);

  // 1) due check + scheduled竊地otified + overdue + contact candidates (DB-side)
  await rpc(apiUrl, serviceKey, "anpi_phase4_scheduler_tick", {
    p_now: pNowIso,
    p_worker_id: workerId,
    p_claim_limit: 0,
  });

  // 2) reminder cadence candidate generation 窶・runtime side
  const checks = await restSelect(
    apiUrl,
    serviceKey,
    "anpi_check_instances?status=in.(notified,reminded)&confirmed_at=is.null&select=id,setting_id,subject_user_id,scheduled_at,status"
  );

  const settingIds = Array.from(new Set(checks.map((c) => c.setting_id).filter(Boolean)));
  const settings = settingIds.length
    ? await restSelect(
        apiUrl,
        serviceKey,
        `anpi_settings?id=in.(${settingIds.map((id) => id).join(",")})&select=id,reminder_count,reminder_policy,contact_notify_after`
      )
    : [];
  const settingMap = new Map(settings.map((s) => [s.id, s]));

  for (const check of checks) {
    try {
      const setting = settingMap.get(check.setting_id);
      if (!setting) continue;

      const delivered = await countDeliveredReminderAttempts({ apiUrl, serviceKey, checkId: check.id });
      if (delivered >= Number(setting.reminder_count || 0)) continue;

      const { intervalMinutes } = parseReminderPolicy(setting.reminder_policy);
      if (intervalMinutes.length < 1) continue;

      const scheduledMs = toMs(check.scheduled_at);
      const deadlineMs = scheduledMs + parseIntervalToMs(setting.contact_notify_after);
      const pNowMs = toMs(pNowIso);
      if (Number.isFinite(deadlineMs) && pNowMs >= deadlineMs) continue;

      const dueAt1 = new Date(scheduledMs + (intervalMinutes[0] || 0) * 60_000).toISOString();
      const dueAt2 = new Date(scheduledMs + (intervalMinutes[1] || 0) * 60_000).toISOString();
      const dueAt1Ms = toMs(dueAt1);
      const dueAt2Ms = toMs(dueAt2);

      if (delivered === 0) {
        if (
          setting.reminder_count >= 1 &&
          (!Number.isFinite(deadlineMs) || dueAt1Ms < deadlineMs) &&
          pNowMs >= dueAt1Ms
        ) {
          await ensureReminderJob({
            apiUrl,
            serviceKey,
            check,
            recipientUserId: check.subject_user_id,
            availableAtIso: dueAt1,
          });
        }
      } else if (delivered === 1) {
        if (
          setting.reminder_count >= 2 &&
          (!Number.isFinite(deadlineMs) || dueAt2Ms < deadlineMs) &&
          pNowMs >= dueAt2Ms
        ) {
          await ensureReminderJob({
            apiUrl,
            serviceKey,
            check,
            recipientUserId: check.subject_user_id,
            availableAtIso: dueAt2,
          });
        }
      }
    } catch {
      // Failure isolation: ignore per-check reminder candidate errors.
    }
  }

  // 3) deliver due jobs to local TALK stub
  const processed = await processDueTalkJobs({
    apiUrl,
    serviceKey,
    pNowIso,
    workerId,
    stubMode,
  });

  // 4) reflect check state transitions after successful local delivery
  for (const p of processed) {
    if (p.delivery_status !== "delivered") continue;

    if (p.kind === "reminder") {
      try {
        await setCheckStatus({
          apiUrl,
          serviceKey,
          checkId: p.checkId,
          patch: { status: "reminded", last_reminded_at: pNowIso },
        });
      } catch {
        // Best-effort.
      }
    }

    if (p.kind === "contact_unconfirmed") {
      try {
        await restPatch(
          apiUrl,
          serviceKey,
          `anpi_check_instances?id=eq.${p.checkId}&status=eq.overdue`,
          { status: "contact_notified", contact_notified_at: pNowIso }
        );
        await cancelPendingJobsForCheck({
          apiUrl,
          serviceKey,
          checkId: p.checkId,
          pNowIso,
          reason: "anpi_phase47_contact_notified",
        });
      } catch {
        // Best-effort.
      }
    }
  }

  // 5) enqueue late_confirmation candidates after confirmed_late
  const lateConfirmationCreated = await generateLateConfirmationCandidates({
    apiUrl,
    serviceKey,
    pNowIso,
  });

  return {
    processed,
    lateConfirmationCreatedCount: lateConfirmationCreated?.length || 0,
  };
}

