/**
 * Diff & Approve — Staging read-only Operations service.
 * DB → Persistence repo → A8 read model → redacted ops response.
 * No write · Apply · Provider · browser service_role.
 */

import { deepFreeze } from "./ai-diff-approve-a1-foundation.mjs";
import {
  projectReadModel,
  queryReadModels,
  groupByStatus,
} from "./ai-diff-approve-a8-read-model.mjs";
import {
  createPersistentRepository,
  pickDiffApprovePersistenceEnv,
  assertReadAllowed,
  DIFF_APPROVE_READ_FLAG,
  DIFF_APPROVE_APPLY_FLAG,
  DIFF_APPROVE_PERSISTENCE_FLAG,
} from "./ai-diff-approve-persistence-repository.mjs";
import { detectGateEnvironment } from "./ai-exec-gate-flags.mjs";

export {
  DIFF_APPROVE_READ_FLAG,
  DIFF_APPROVE_APPLY_FLAG,
  DIFF_APPROVE_PERSISTENCE_FLAG,
};

export const OPS_READ_SCHEMA = "diff_approve.ops.read.v1";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SORT_ALLOW = Object.freeze([
  "created_at",
  "updated_at",
  "status",
  "proposal_id",
  "capability",
]);

const FILTER_ALLOW = Object.freeze([
  "status",
  "capability",
  "risk",
  "owner_user_id",
  "request_id",
]);

const SECRET_KEY_RE =
  /^(authorization|cookie|set-cookie|api[_-]?key|apikey|secret|token|access[_-]?token|refresh[_-]?token|password|credential|private[_-]?key|service[_-]?role)$/i;

const MAX_PAGE_SIZE = 50;
const MAX_JSON_DEPTH = 6;
const MAX_KEYS = 64;
const MAX_STRING = 4000;
const MAX_ARRAY = 100;

/**
 * @param {string} requestId
 */
export function newRequestId(requestId) {
  if (typeof requestId === "string" && requestId.trim()) {
    return requestId.trim().slice(0, 80);
  }
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * @param {Record<string, unknown>|null|undefined} env
 */
export function assertOpsReadEnvironment(env) {
  const gateEnv = detectGateEnvironment(env);
  if (gateEnv === "production") {
    return {
      ok: false,
      error: "production_forbidden",
      http: 403,
    };
  }
  if (gateEnv !== "staging") {
    return {
      ok: false,
      error: "staging_required",
      http: 403,
    };
  }
  const cfg = pickDiffApprovePersistenceEnv(env);
  const read = assertReadAllowed(cfg);
  if (!read.ok) {
    return {
      ok: false,
      error: read.error || "read_disabled",
      http: read.error === "db_unavailable" ? 503 : 403,
    };
  }
  if (cfg.applyEnabled) {
    return { ok: false, error: "apply_forbidden", http: 403 };
  }
  return { ok: true, cfg, environment: gateEnv };
}

/**
 * @param {URLSearchParams} params
 */
export function parseListQuery(params) {
  const allowed = new Set([
    ...FILTER_ALLOW,
    "page",
    "pageSize",
    "limit",
    "sortBy",
    "sortDir",
    "cursor",
  ]);
  for (const key of params.keys()) {
    if (!allowed.has(key)) {
      return { ok: false, error: "invalid_filter", http: 400 };
    }
  }

  /** @type {Record<string, string>} */
  const filters = {};
  for (const key of FILTER_ALLOW) {
    const v = params.get(key);
    if (v != null && v !== "") filters[key] = String(v).normalize("NFC");
  }

  const sortByRaw = params.get("sortBy") || "created_at";
  if (!SORT_ALLOW.includes(sortByRaw)) {
    return { ok: false, error: "invalid_sort", http: 400 };
  }
  const sortDir = params.get("sortDir") === "asc" ? "asc" : "desc";
  const page = Math.max(1, Number(params.get("page") || 1) || 1);
  const rawLimit = Number(params.get("pageSize") || params.get("limit") || 20);
  if (!Number.isFinite(rawLimit) || rawLimit < 1) {
    return { ok: false, error: "invalid_limit", http: 400 };
  }
  if (rawLimit > MAX_PAGE_SIZE) {
    return { ok: false, error: "limit_too_large", http: 400 };
  }

  if (filters.owner_user_id && !UUID_RE.test(filters.owner_user_id)) {
    return { ok: false, error: "invalid_filter", http: 400 };
  }
  if (filters.request_id && !UUID_RE.test(filters.request_id)) {
    return { ok: false, error: "invalid_filter", http: 400 };
  }

  return {
    ok: true,
    value: deepFreeze({
      ...filters,
      sortBy: sortByRaw,
      sortDir,
      page,
      pageSize: Math.floor(rawLimit),
    }),
  };
}

/**
 * @param {string} proposalId
 */
export function parseProposalId(proposalId) {
  const id = String(proposalId || "")
    .trim()
    .normalize("NFC");
  if (!UUID_RE.test(id)) {
    return { ok: false, error: "invalid_proposal_id", http: 400 };
  }
  return { ok: true, value: id };
}

/**
 * @param {unknown} value
 * @param {number} depth
 */
export function redactSecrets(value, depth = 0) {
  if (depth > MAX_JSON_DEPTH) return "[truncated]";
  if (value == null) return value;
  if (typeof value === "string") {
    return value.length > MAX_STRING
      ? `${value.slice(0, MAX_STRING)}…`
      : value;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY).map((v) => redactSecrets(v, depth + 1));
  }
  if (typeof value === "object") {
    /** @type {Record<string, unknown>} */
    const out = {};
    const keys = Object.keys(value)
      .filter(
        (k) => k !== "__proto__" && k !== "prototype" && k !== "constructor"
      )
      .slice(0, MAX_KEYS);
    for (const k of keys) {
      if (SECRET_KEY_RE.test(k)) {
        out[k] = "[redacted]";
        continue;
      }
      out[k] = redactSecrets(
        /** @type {Record<string, unknown>} */ (value)[k],
        depth + 1
      );
    }
    return out;
  }
  return null;
}

/**
 * @param {unknown} payload
 */
function payloadFields(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {};
  }
  return /** @type {Record<string, unknown>} */ (payload);
}

/**
 * @param {readonly unknown[]} records
 * @param {readonly unknown[]} timeline
 * @param {Record<string, unknown>} [proposalRow]
 */
export function buildOpsReadModel(records, timeline, proposalRow = {}) {
  /** @type {Record<string, Record<string, unknown>>} */
  const byType = {};
  for (const row of records || []) {
    if (!row || typeof row !== "object") continue;
    const r = /** @type {Record<string, unknown>} */ (row);
    if (typeof r.record_type === "string") {
      byType[r.record_type] = r;
    }
  }

  const proposalPayload = payloadFields(byType.proposal?.payload);
  const approvalPayload = payloadFields(byType.approval?.payload);
  const readinessPayload = payloadFields(byType.apply_readiness?.payload);
  const validationPayload = payloadFields(byType.apply_validation?.payload);
  const simulationPayload = payloadFields(byType.simulation?.payload);
  const finalGatePayload = payloadFields(byType.final_gate?.payload);
  const impactPayload = payloadFields(
    proposalPayload.impact || approvalPayload.impact || {}
  );

  const timelineIntegrity =
    Array.isArray(timeline) &&
    timeline.some(
      (e) =>
        e &&
        typeof e === "object" &&
        /** @type {any} */ (e).reason === "audit_chain_mismatch"
    )
      ? "mismatch"
      : "ok";

  if (timelineIntegrity === "mismatch") {
    return {
      ok: false,
      error: "integrity_error",
      reason: "audit_chain_mismatch",
      http: 409,
    };
  }

  const projected = projectReadModel({
    proposal: {
      proposal_id: proposalRow.proposal_id || byType.proposal?.proposal_id,
      status: proposalRow.status || proposalPayload.status,
      capability: proposalRow.capability || proposalPayload.capability,
      resource_type: proposalRow.resource_type || proposalPayload.resource_type,
    },
    approval: {
      actor: approvalPayload.approval_actor || approvalPayload.actor,
      decision: approvalPayload.approval_decision || approvalPayload.decision,
    },
    readiness: {
      decision: readinessPayload.readiness_state || readinessPayload.decision,
    },
    simulation: {
      simulation_state:
        simulationPayload.simulation_state || simulationPayload.state,
    },
    final_gate: {
      decision:
        finalGatePayload.final_gate_decision || finalGatePayload.decision,
      blocking_reasons: Array.isArray(finalGatePayload.blocking_reasons)
        ? finalGatePayload.blocking_reasons
        : [],
    },
    impact: {
      estimated_risk: impactPayload.estimated_risk,
      approval_required: impactPayload.approval_required === true,
      changed_fields: Array.isArray(impactPayload.changed_fields)
        ? impactPayload.changed_fields
        : [],
      affected_scope: impactPayload.affected_scope || null,
    },
    audit_timeline: timeline,
  });

  if (!projected.ok) {
    return {
      ok: false,
      error: "invalid_context",
      http: 500,
    };
  }

  const lastEvent =
    Array.isArray(timeline) && timeline.length
      ? /** @type {any} */ (timeline[timeline.length - 1])
      : null;
  const createdAt = String(proposalRow.created_at || "");
  const ageSeconds = createdAt
    ? Math.max(
        0,
        Math.floor((Date.now() - Date.parse(createdAt)) / 1000) || 0
      )
    : null;

  const security = deepFreeze({
    applied: false,
    executed: false,
    provider_called: false,
    transmit: false,
    recorded_api_cost: 0,
    network_called: false,
    db_written: true,
    production_written: false,
    rollback_executed: false,
  });

  const value = deepFreeze({
    schema_version: OPS_READ_SCHEMA,
    proposal: redactSecrets({
      proposal_id: proposalRow.proposal_id || projected.value.proposal_id,
      request_id: proposalRow.request_id || proposalPayload.request_id || null,
      capability: proposalRow.capability || projected.value.capability,
      resource_type: proposalRow.resource_type || projected.value.resource_type,
      resource_id: proposalRow.resource_id || proposalPayload.resource_id || "",
      owner_user_id: proposalRow.owner_user_id || null,
      status: proposalRow.status || projected.value.status,
      created_at: proposalRow.created_at || null,
      updated_at: proposalRow.updated_at || null,
      record_version: proposalRow.record_version || byType.proposal?.record_version || 1,
    }),
    approval: redactSecrets({
      approval_actor: projected.value.approval_actor,
      approval_decision: projected.value.approval_decision,
      approval_timestamp:
        approvalPayload.approval_timestamp || approvalPayload.timestamp || null,
      revision_reason:
        approvalPayload.revision_reason || approvalPayload.reason || null,
    }),
    impact: redactSecrets(projected.value.impact_summary),
    apply_state: redactSecrets({
      readiness_state: projected.value.apply_readiness,
      validation_state:
        validationPayload.validation_state ||
        validationPayload.execution_state ||
        null,
      simulation_state: projected.value.simulation_result,
      final_gate_decision: projected.value.final_gate_decision,
      blocking_reasons: projected.value.blocking_reasons,
    }),
    security,
    read_model: projected.value,
    display: deepFreeze({
      display_status: projected.value.status,
      risk_label: projected.value.risk_summary,
      blocking_reason_count: projected.value.counters.blocking_count,
      timeline_integrity: timelineIntegrity,
      last_event_at: lastEvent?.created_at || null,
      age_seconds: ageSeconds,
    }),
    timeline: Object.freeze(
      (Array.isArray(timeline) ? timeline : []).map((e) =>
        deepFreeze(redactSecrets(e))
      )
    ),
    labels: deepFreeze({
      environment: "STAGING",
      mode: "READ_ONLY",
      apply: "NO_APPLY",
    }),
  });

  return { ok: true, value };
}

/**
 * @param {{
 *   env: Record<string, unknown>,
 *   query: URLSearchParams,
 *   fetchImpl?: typeof fetch,
 *   repo?: ReturnType<typeof createPersistentRepository>,
 * }} args
 */
export async function listOpsProposals(args) {
  const envCheck = assertOpsReadEnvironment(args.env);
  if (!envCheck.ok) return envCheck;
  const parsed = parseListQuery(args.query);
  if (!parsed.ok) return parsed;

  const repo =
    args.repo ||
    createPersistentRepository({
      env: args.env,
      fetchImpl: args.fetchImpl,
      readEnabled: true,
      persistenceEnabled: false,
      applyEnabled: false,
    });

  const summaries = await repo.listProposalBundles({
    owner_user_id: parsed.value.owner_user_id,
    limit: 200,
  });

  /** @type {unknown[]} */
  const models = [];
  for (const row of summaries) {
    const bundle = await repo.getProposalBundle(
      /** @type {any} */ (row).proposal_id
    );
    const built = buildOpsReadModel(
      bundle.records || [],
      bundle.timeline || [],
      /** @type {any} */ (row)
    );
    if (!built.ok) {
      return {
        ok: false,
        error: built.error || "integrity_error",
        http: built.http || 409,
      };
    }
    if (
      parsed.value.capability &&
      built.value.proposal.capability !== parsed.value.capability
    ) {
      continue;
    }
    if (
      parsed.value.request_id &&
      built.value.proposal.request_id !== parsed.value.request_id
    ) {
      continue;
    }
    models.push(built.value.read_model);
  }

  const paged = queryReadModels(models, {
    status: parsed.value.status,
    risk: parsed.value.risk,
    sortBy:
      parsed.value.sortBy === "created_at" ||
      parsed.value.sortBy === "updated_at"
        ? "proposal_id"
        : parsed.value.sortBy,
    sortDir: parsed.value.sortDir,
    page: parsed.value.page,
    pageSize: parsed.value.pageSize,
  });

  /** Enrich page items with proposal summary from built models */
  const items = [];
  for (const rm of paged.items) {
    const full = models.find(
      (m) =>
        /** @type {any} */ (m).proposal_id ===
        /** @type {any} */ (rm).proposal_id
    );
    const summaryRow = summaries.find(
      (s) =>
        /** @type {any} */ (s).proposal_id ===
        /** @type {any} */ (rm).proposal_id
    );
    items.push(
      redactSecrets({
        proposal_id: /** @type {any} */ (rm).proposal_id,
        status: /** @type {any} */ (rm).status,
        capability: /** @type {any} */ (rm).capability,
        resource_type: /** @type {any} */ (rm).resource_type,
        risk_summary: /** @type {any} */ (rm).risk_summary,
        approval_decision: /** @type {any} */ (rm).approval_decision,
        final_gate_decision: /** @type {any} */ (rm).final_gate_decision,
        blocking_count: /** @type {any} */ (rm).counters?.blocking_count || 0,
        created_at: /** @type {any} */ (summaryRow)?.created_at || null,
        record_version: /** @type {any} */ (summaryRow)?.record_version || null,
        owner_user_id: /** @type {any} */ (summaryRow)?.owner_user_id || null,
        read_model: full || rm,
      })
    );
  }

  return {
    ok: true,
    http: 200,
    body: deepFreeze({
      ok: true,
      schema_version: OPS_READ_SCHEMA,
      total: paged.total,
      page: paged.page,
      pageSize: paged.pageSize,
      items: Object.freeze(items),
      labels: {
        environment: "STAGING",
        mode: "READ_ONLY",
        apply: "NO_APPLY",
      },
    }),
  };
}

/**
 * @param {{
 *   env: Record<string, unknown>,
 *   proposalId: string,
 *   fetchImpl?: typeof fetch,
 *   repo?: ReturnType<typeof createPersistentRepository>,
 * }} args
 */
export async function getOpsProposalDetail(args) {
  const envCheck = assertOpsReadEnvironment(args.env);
  if (!envCheck.ok) return envCheck;
  const idParsed = parseProposalId(args.proposalId);
  if (!idParsed.ok) return idParsed;

  const repo =
    args.repo ||
    createPersistentRepository({
      env: args.env,
      fetchImpl: args.fetchImpl,
      readEnabled: true,
      persistenceEnabled: false,
      applyEnabled: false,
    });

  const summaries = await repo.listProposalBundles({ limit: 200 });
  const row = summaries.find(
    (s) => /** @type {any} */ (s).proposal_id === idParsed.value
  );
  const bundle = await repo.getProposalBundle(idParsed.value);
  if ((!bundle.records || bundle.records.length === 0) && !row) {
    return { ok: false, error: "not_found", http: 404 };
  }

  const built = buildOpsReadModel(
    bundle.records || [],
    bundle.timeline || [],
    /** @type {any} */ (row || { proposal_id: idParsed.value })
  );
  if (!built.ok) {
    return {
      ok: false,
      error: built.error || "integrity_error",
      http: built.http || 409,
    };
  }
  return {
    ok: true,
    http: 200,
    body: deepFreeze({ ok: true, ...built.value }),
  };
}

/**
 * @param {{
 *   env: Record<string, unknown>,
 *   proposalId: string,
 *   fetchImpl?: typeof fetch,
 *   repo?: ReturnType<typeof createPersistentRepository>,
 * }} args
 */
export async function getOpsProposalTimeline(args) {
  const detail = await getOpsProposalDetail(args);
  if (!detail.ok) return detail;
  return {
    ok: true,
    http: 200,
    body: deepFreeze({
      ok: true,
      schema_version: OPS_READ_SCHEMA,
      proposal_id: args.proposalId,
      timeline: detail.body.timeline,
      timeline_integrity: detail.body.display?.timeline_integrity || "ok",
      labels: detail.body.labels,
    }),
  };
}

/**
 * @param {{
 *   env: Record<string, unknown>,
 *   fetchImpl?: typeof fetch,
 *   repo?: ReturnType<typeof createPersistentRepository>,
 * }} args
 */
export async function getOpsSummary(args) {
  const listed = await listOpsProposals({
    env: args.env,
    query: new URLSearchParams("page=1&pageSize=50"),
    fetchImpl: args.fetchImpl,
    repo: args.repo,
  });
  if (!listed.ok) return listed;
  const items = listed.body.items || [];
  const byStatus = groupByStatus(
    items.map((i) => /** @type {any} */ (i).read_model || i)
  );
  /** @type {Record<string, number>} */
  const byRisk = {};
  for (const item of items) {
    const risk = String(/** @type {any} */ (item).risk_summary || "unknown");
    byRisk[risk] = (byRisk[risk] || 0) + 1;
  }
  return {
    ok: true,
    http: 200,
    body: deepFreeze({
      ok: true,
      schema_version: OPS_READ_SCHEMA,
      total: listed.body.total,
      by_status: byStatus,
      by_risk: deepFreeze(byRisk),
      security_defaults: {
        applied: false,
        executed: false,
        provider_called: false,
        transmit: false,
        recorded_api_cost: 0,
      },
      labels: {
        environment: "STAGING",
        mode: "READ_ONLY",
        apply: "NO_APPLY",
      },
    }),
  };
}
