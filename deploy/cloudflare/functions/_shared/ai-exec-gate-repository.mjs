/**
 * AI Execution Gate — Phase B3 DB repository (service_role REST only).
 * Tables: ai_execution_requests · ai_execution_events
 * Does not touch ai_execution_results.
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
  const { res, json } = await rest(cfg, "/rest/v1/ai_execution_events", {
    method: "POST",
    prefer: "return=representation",
    body: JSON.stringify(eventRow),
  });
  if (!res.ok) {
    const err = new Error("db_event_insert_failed");
    err.code = "db_unavailable";
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
 * Defense: ensure results table unused by B3 create path.
 * @param {{ url: string, serviceRoleKey: string }} cfg
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
