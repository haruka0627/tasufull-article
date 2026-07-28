/**
 * Diff & Approve — Staging Operator Decision Write service.
 * Persists propose / approve / reject / cancel only.
 * Never imports Apply engine, Provider adapters, or queues.
 */

import { detectGateEnvironment } from "./ai-exec-gate-flags.mjs";
import {
  createPersistentRepository,
  pickDiffApprovePersistenceEnv,
  assertPersistenceAllowed,
} from "./ai-diff-approve-persistence-repository.mjs";
import {
  validateDecisionWriteInput,
  buildScopedIdempotencyKey,
  normalizeDecisionError,
  normalizeUuid,
  DECISION_ERROR,
} from "./ai-diff-approve-ops-decision-contract.mjs";

export const DECISION_WRITE_HTTP_SCHEMA = "diff_approve.ops.decision_write.http.v1";

/**
 * @param {Request} request
 */
export function assertDecisionWriteOrigin(request) {
  const origin = String(request.headers.get("Origin") || "").trim();
  if (!origin) {
    return { ok: false, error: "origin_forbidden", http: 403 };
  }
  let parsed;
  try {
    parsed = new URL(origin);
  } catch {
    return { ok: false, error: "origin_forbidden", http: 403 };
  }
  const host = parsed.hostname.toLowerCase();
  const isLocal =
    (host === "127.0.0.1" || host === "localhost") &&
    (parsed.port === "8788" || parsed.port === "");
  const isPreview =
    host.endsWith(".tasufull-article.pages.dev") ||
    host === "tasufull-article.pages.dev";
  // Deny bare production marketing hosts; allow Preview *.pages.dev + 8788 only
  if (/^(www\.)?tasful\.jp$/i.test(host)) {
    return { ok: false, error: "origin_forbidden", http: 403 };
  }
  if (!isLocal && !isPreview) {
    return { ok: false, error: "origin_forbidden", http: 403 };
  }
  return { ok: true, origin };
}

/**
 * @param {Record<string, unknown>|null|undefined} env
 */
export function assertDecisionWriteEnvironment(env) {
  const gateEnv = detectGateEnvironment(env);
  if (gateEnv === "production") {
    return { ok: false, error: "production_forbidden", http: 403 };
  }
  if (gateEnv !== "staging") {
    return { ok: false, error: "staging_required", http: 403 };
  }
  const cfg = pickDiffApprovePersistenceEnv(env);
  const write = assertPersistenceAllowed(cfg);
  if (!write.ok) {
    return {
      ok: false,
      error: write.error || "persistence_disabled",
      http: write.error === "db_unavailable" ? 503 : 403,
    };
  }
  if (cfg.applyEnabled) {
    return { ok: false, error: "apply_forbidden", http: 403 };
  }
  return { ok: true, cfg, environment: gateEnv };
}

/**
 * Map HTTP status for normalized decision errors.
 * @param {string} code
 */
export function decisionErrorHttp(code) {
  const c = normalizeDecisionError(code);
  if (
    c === DECISION_ERROR.VERSION_CONFLICT ||
    c === DECISION_ERROR.INVALID_STATE_TRANSITION ||
    c === DECISION_ERROR.ALREADY_DECIDED ||
    c === DECISION_ERROR.IDEMPOTENCY_CONFLICT
  ) {
    return 409;
  }
  if (c === "not_found") return 404;
  if (c === "ops_required" || c === "production_forbidden") return 403;
  if (c === "auth_required" || c === "invalid_token") return 401;
  if (c === "db_unavailable") return 503;
  return 400;
}

/**
 * Record a single operator decision (propose|approve|reject|cancel).
 * @param {{
 *   env: Record<string, unknown>,
 *   actor: { userId: string, isOps?: boolean },
 *   body: unknown,
 *   proposalIdFromPath?: string,
 *   fetchImpl?: typeof fetch,
 * }} args
 */
export async function recordOperatorDecision(args) {
  const envCheck = assertDecisionWriteEnvironment(args.env);
  if (!envCheck.ok) return envCheck;

  const validated = validateDecisionWriteInput(args.body);
  if (!validated.ok) return validated;
  const input = validated.value;

  if (args.proposalIdFromPath) {
    const pathId = normalizeUuid(args.proposalIdFromPath);
    if (!pathId || pathId !== input.requestId) {
      return { ok: false, error: "invalid_uuid", http: 400 };
    }
  }

  const actorId = String(args.actor?.userId || "").trim();
  if (!normalizeUuid(actorId)) {
    return { ok: false, error: "auth_required", http: 401 };
  }

  const repo = createPersistentRepository({
    env: args.env,
    fetchImpl: args.fetchImpl,
    ownerUserId: actorId,
  });

  const result = await repo.recordOperatorDecision({
    proposalId: input.requestId,
    action: input.action,
    expectedVersion: input.expectedVersion,
    idempotencyKey: buildScopedIdempotencyKey({
      environment: envCheck.environment,
      actorId,
      requestId: input.requestId,
      action: input.action,
      idempotencyKey: input.idempotencyKey,
    }),
    payloadHash: input.payloadHash,
    reason: input.reason,
    actorId,
    actorRole: "operator",
    environment: envCheck.environment,
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    eventType: input.eventType,
  });

  if (!result.ok) {
    const code = normalizeDecisionError(result.error || result.code || "");
    return {
      ok: false,
      error: code,
      code,
      http: decisionErrorHttp(code),
      current_status: result.current_status,
      current_version: result.current_version,
    };
  }

  return {
    ok: true,
    http: result.replayed ? 200 : 200,
    body: {
      ok: true,
      schema_version: DECISION_WRITE_HTTP_SCHEMA,
      requestId: result.requestId,
      previousStatus: result.previousStatus,
      currentStatus: result.currentStatus,
      version: result.version,
      decision: result.decision,
      auditEventId: result.auditEventId,
      replayed: Boolean(result.replayed),
      createdAt: result.createdAt,
      applied: false,
      provider_called: false,
      executed: false,
      transmit: false,
      environment: "staging",
      mode: "DECISION_WRITE",
      apply: "NOT_EXECUTED",
    },
  };
}
