/**
 * AI Execution Gate — Phase B2–B4 DB repository (service_role REST only).
 * Tables: ai_execution_requests · ai_execution_events · ai_execution_results
 * Results: insert-only (never overwrite).
 */

/**
 * @param {Record<string, unknown>|null|undefined} env
 */
export function pickGateDbEnv(env) {
  const url = String(env?.TASFUL_SUPABASE_URL || env?.SUPABASE_URL || "")
    .trim()
    .replace(/\/$/, "");
  const serviceRoleKey = String(env?.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  return { url, serviceRoleKey };
}

/**
 * @param {{ url: string, serviceRoleKey: string }} cfg
 * @param {string} path
 * @param {RequestInit & { prefer?: string }} [init]
 */
async function rest(cfg, path, init = {}) {
  const doFetch = typeof cfg.fetchImpl === "function" ? cfg.fetchImpl : fetch;
  const headers = {
    Authorization: `Bearer ${cfg.serviceRoleKey}`,
    apikey: cfg.serviceRoleKey,
    "Content-Type": "application/json",
    ...(init.prefer ? { Prefer: init.prefer } : {}),
    ...(init.headers || {}),
  };
  const res = await doFetch(`${cfg.url}${path}`, {
    ...init,
    headers,
  });
  const text = await res.text();
  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }
  return { res, json, text };
}

/**
 * @param {{ url: string, serviceRoleKey: string }} cfg
 * @param {string} dayKey
 * @returns {Promise<number>}
 */
export async function sumDayEstimatedAllowed(cfg, dayKey) {
  const path =
    `/rest/v1/ai_execution_requests?select=estimated_api_cost` +
    `&budget_day_key=eq.${encodeURIComponent(dayKey)}` +
    `&preflight_decision=eq.allowed` +
    `&limit=1000`;
  const { res, json } = await rest(cfg, path, { method: "GET" });
  if (!res.ok) {
    const err = new Error("db_sum_failed");
    err.code = "db_unavailable";
    throw err;
  }
  if (!Array.isArray(json)) return 0;
  let sum = 0;
  for (const row of json) {
    const n = Number(row?.estimated_api_cost);
    if (Number.isFinite(n) && n >= 0) sum += n;
  }
  return sum;
}

/**
 * @param {{ url: string, serviceRoleKey: string }} cfg
 * @param {string} idempotencyKey
 */
export async function findRequestByIdempotencyKey(cfg, idempotencyKey) {
  const path =
    `/rest/v1/ai_execution_requests?select=*` +
    `&idempotency_key=eq.${encodeURIComponent(idempotencyKey)}` +
    `&limit=1`;
  const { res, json } = await rest(cfg, path, { method: "GET" });
  if (!res.ok) {
    const err = new Error("db_lookup_failed");
    err.code = "db_unavailable";
    throw err;
  }
  return Array.isArray(json) && json[0] ? json[0] : null;
}

/**
 * @param {{ url: string, serviceRoleKey: string }} cfg
 * @param {string} id
 */
export async function findRequestById(cfg, id) {
  const path =
    `/rest/v1/ai_execution_requests?select=*` +
    `&id=eq.${encodeURIComponent(id)}` +
    `&limit=1`;
  const { res, json } = await rest(cfg, path, { method: "GET" });
  if (!res.ok) {
    const err = new Error("db_lookup_failed");
    err.code = "db_unavailable";
    throw err;
  }
  return Array.isArray(json) && json[0] ? json[0] : null;
}

/**
 * @param {{ url: string, serviceRoleKey: string }} cfg
 * @param {Record<string, unknown>} row
 * @returns {Promise<{ ok: true, row: Record<string, unknown> } | { ok: false, conflict: true } | never>}
 */
export async function insertExecutionRequest(cfg, row) {
  const { res, json, text } = await rest(
    cfg,
    "/rest/v1/ai_execution_requests",
    {
      method: "POST",
      prefer: "return=representation",
      body: JSON.stringify(row),
    }
  );
  if (res.status === 409 || (res.status === 23505)) {
    return { ok: false, conflict: true };
  }
  // PostgREST unique violation typically 409 with code 23505 in body
  if (!res.ok) {
    const code = json?.code || json?.hint || "";
    if (String(code) === "23505" || /duplicate|unique/i.test(text || "")) {
      return { ok: false, conflict: true };
    }
    const err = new Error("db_insert_failed");
    err.code = "db_unavailable";
    throw err;
  }
  const inserted = Array.isArray(json) ? json[0] : json;
  if (!inserted?.id) {
    const err = new Error("db_insert_empty");
    err.code = "db_unavailable";
    throw err;
  }
  return { ok: true, row: inserted };
}

/**
 * @param {{ url: string, serviceRoleKey: string }} cfg
 * @param {Record<string, unknown>} eventRow
 */
export async function insertExecutionEvent(cfg, eventRow) {
  const { res, json, text } = await rest(cfg, "/rest/v1/ai_execution_events", {
    method: "POST",
    prefer: "return=representation",
    body: JSON.stringify(eventRow),
  });
  if (!res.ok) {
    const code = json?.code || "";
    const err = new Error("db_event_insert_failed");
    if (String(code) === "23505" || /duplicate|unique/i.test(text || "")) {
      err.code = "unique_violation";
    } else {
      err.code = "db_unavailable";
    }
    throw err;
  }
  const inserted = Array.isArray(json) ? json[0] : json;
  return inserted;
}

/**
 * @param {{ url: string, serviceRoleKey: string }} cfg
 * @param {string} id
 * @param {Record<string, unknown>} patch
 */
export async function updateExecutionRequest(cfg, id, patch) {
  const path =
    `/rest/v1/ai_execution_requests?id=eq.${encodeURIComponent(id)}`;
  const { res, json } = await rest(cfg, path, {
    method: "PATCH",
    prefer: "return=representation",
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const err = new Error("db_update_failed");
    err.code = "db_unavailable";
    throw err;
  }
  return Array.isArray(json) ? json[0] : json;
}

/**
 * @param {{ url: string, serviceRoleKey: string }} cfg
 * @param {string} executionId
 */
export async function listEventsForExecution(cfg, executionId) {
  const path =
    `/rest/v1/ai_execution_events?select=id,sequence_number,event_type,decision,blocked_reason,created_at` +
    `&execution_id=eq.${encodeURIComponent(executionId)}` +
    `&order=sequence_number.asc`;
  const { res, json } = await rest(cfg, path, { method: "GET" });
  if (!res.ok) {
    const err = new Error("db_events_failed");
    err.code = "db_unavailable";
    throw err;
  }
  return Array.isArray(json) ? json : [];
}

/**
 * Atomic claim: queued + allowed → running (PostgREST conditional PATCH).
 * @param {{ url: string, serviceRoleKey: string, fetchImpl?: typeof fetch }} cfg
 * @param {string} id
 * @param {{ startedAt?: string, attempts?: number }} [opts]
 * @returns {Promise<{ ok: true, row: Record<string, unknown> } | { ok: false, reason: string }>}
 */
export async function claimQueuedExecution(cfg, id, opts = {}) {
  const path =
    `/rest/v1/ai_execution_requests?id=eq.${encodeURIComponent(id)}` +
    `&execution_status=eq.queued` +
    `&preflight_decision=eq.allowed` +
    `&parent_execution_id=is.null`;
  const patch = {
    execution_status: "running",
    started_at: opts.startedAt || new Date().toISOString(),
    execution_attempts:
      typeof opts.attempts === "number" ? opts.attempts : 1,
    executor_name: "ops_collector",
  };
  const { res, json } = await rest(cfg, path, {
    method: "PATCH",
    prefer: "return=representation",
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const err = new Error("db_claim_failed");
    err.code = "db_unavailable";
    throw err;
  }
  const row = Array.isArray(json) ? json[0] : null;
  if (!row) {
    return { ok: false, reason: "not_claimed" };
  }
  return { ok: true, row };
}

/**
 * Conditional status transition.
 * @param {{ url: string, serviceRoleKey: string, fetchImpl?: typeof fetch }} cfg
 * @param {string} id
 * @param {string} fromStatus
 * @param {Record<string, unknown>} patch
 */
export async function transitionExecutionStatus(cfg, id, fromStatus, patch) {
  const path =
    `/rest/v1/ai_execution_requests?id=eq.${encodeURIComponent(id)}` +
    `&execution_status=eq.${encodeURIComponent(fromStatus)}`;
  const { res, json } = await rest(cfg, path, {
    method: "PATCH",
    prefer: "return=representation",
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const err = new Error("db_transition_failed");
    err.code = "db_unavailable";
    throw err;
  }
  const row = Array.isArray(json) ? json[0] : null;
  if (!row) {
    return { ok: false, reason: "status_mismatch" };
  }
  return { ok: true, row };
}

/**
 * @param {{ url: string, serviceRoleKey: string, fetchImpl?: typeof fetch }} cfg
 * @param {string} executionId
 */
export async function nextEventSequence(cfg, executionId) {
  const events = await listEventsForExecution(cfg, executionId);
  return (
    events.reduce((m, e) => Math.max(m, Number(e.sequence_number) || 0), 0) + 1
  );
}

/**
 * Insert event; on sequence unique collision, bump sequence once and retry.
 * @param {{ url: string, serviceRoleKey: string, fetchImpl?: typeof fetch }} cfg
 * @param {Record<string, unknown>} eventRow
 */
export async function appendExecutionEvent(cfg, eventRow) {
  try {
    return await insertExecutionEvent(cfg, eventRow);
  } catch (e) {
    if (e?.code !== "unique_violation") throw e;
    const next = await nextEventSequence(cfg, String(eventRow.execution_id));
    return insertExecutionEvent(cfg, { ...eventRow, sequence_number: next });
  }
}

/**
 * Insert-only result (1:1). Never PATCH/overwrite an existing row.
 * @param {{ url: string, serviceRoleKey: string, fetchImpl?: typeof fetch }} cfg
 * @param {Record<string, unknown>} resultRow
 * @returns {Promise<{ ok: true, row: Record<string, unknown> } | { ok: false, reason: "exists"|"conflict"|"db" }>}
 */
export async function insertExecutionResult(cfg, resultRow) {
  const existing = await findExecutionResult(
    cfg,
    String(resultRow.execution_id)
  );
  if (existing) {
    return { ok: false, reason: "exists", row: existing };
  }
  const { res, json, text } = await rest(cfg, "/rest/v1/ai_execution_results", {
    method: "POST",
    prefer: "return=representation",
    body: JSON.stringify(resultRow),
  });
  if (!res.ok) {
    const code = json?.code || "";
    if (String(code) === "23505" || /duplicate|unique/i.test(text || "")) {
      const raced = await findExecutionResult(
        cfg,
        String(resultRow.execution_id)
      );
      return { ok: false, reason: "conflict", row: raced || null };
    }
    return { ok: false, reason: "db" };
  }
  const row = Array.isArray(json) ? json[0] : json;
  return { ok: true, row };
}

/**
 * @deprecated Use insertExecutionResult — kept name alias for clarity in callers.
 */
export async function upsertExecutionResult(cfg, resultRow) {
  return insertExecutionResult(cfg, resultRow);
}

/**
 * @param {{ url: string, serviceRoleKey: string, fetchImpl?: typeof fetch }} cfg
 * @param {string} executionId
 */
export async function findExecutionResult(cfg, executionId) {
  const path =
    `/rest/v1/ai_execution_results?select=*` +
    `&execution_id=eq.${encodeURIComponent(executionId)}` +
    `&limit=1`;
  const { res, json } = await rest(cfg, path, { method: "GET" });
  if (!res.ok) {
    const err = new Error("db_result_lookup_failed");
    err.code = "db_unavailable";
    throw err;
  }
  return Array.isArray(json) && json[0] ? json[0] : null;
}

/**
 * Defense: ensure results table unused by B3 create path.
 * @param {{ url: string, serviceRoleKey: string, fetchImpl?: typeof fetch }} cfg
 * @param {string} executionId
 */
export async function countResultsForExecution(cfg, executionId) {
  const path =
    `/rest/v1/ai_execution_results?select=execution_id` +
    `&execution_id=eq.${encodeURIComponent(executionId)}`;
  const { res, json } = await rest(cfg, path, {
    method: "GET",
    headers: { Prefer: "count=exact" },
  });
  if (!res.ok) return -1;
  return Array.isArray(json) ? json.length : 0;
}

/**
 * SAFE-07 read-only RPC — `ai_cost_ledger_aggregate` (no writes).
 * Parameterized JSON body only (no string-concat SQL).
 * Uses service_role Bearer for Supabase REST (not a Provider credential).
 *
 * @param {{ url: string, serviceRoleKey: string, fetchImpl?: typeof fetch }} cfg
 * @param {{
 *   from: string,
 *   to: string,
 *   group_by?: string,
 *   currency?: string,
 *   tz?: string,
 * }} params
 * @returns {Promise<unknown>}
 */
export async function rpcAiCostLedgerAggregate(cfg, params) {
  const body = {
    p_from: params.from,
    p_to: params.to,
    p_group_by: params.group_by || "user",
    p_currency: params.currency || "USD",
    p_tz: params.tz || "Asia/Tokyo",
  };
  const { res, json } = await rest(
    cfg,
    "/rest/v1/rpc/ai_cost_ledger_aggregate",
    {
      method: "POST",
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    return { ok: false, error: "rpc_http_error", status: res.status };
  }
  return json;
}
