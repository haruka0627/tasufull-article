/**
 * POST /api/ai-diff-approve/:id/simulate-execution — Staging noop simulation.
 * GET  /api/ai-diff-approve/:id/simulate-execution — list execution attempts.
 * Explicitly simulation-only · no real Provider.
 */
import {
  rejectNonPost,
  rejectNonGet,
  requireDiffApproveOpsAuth,
  prepareDecisionWriteRequest,
  opsResultToResponse,
  diffApproveJsonResponse,
} from "../../_shared/ai-diff-approve-http.mjs";
import {
  simulateExecution,
  getExecutionAttempts,
} from "../../_shared/ai-diff-approve-ops-final-gate.mjs";

export async function onRequest(context) {
  const { request, env, params } = context;
  const id = String(params?.id || "").trim();

  if (request.method === "GET" || request.method === "OPTIONS") {
    const early = rejectNonGet(request);
    if (early) return early;
    const auth = await requireDiffApproveOpsAuth(request, env);
    if (!auth.ok) {
      return diffApproveJsonResponse(
        { ok: false, error: auth.error },
        auth.http || 401
      );
    }
    try {
      const url = new URL(request.url);
      const attemptId = String(url.searchParams.get("attemptId") || "").trim();
      const result = await getExecutionAttempts({
        env,
        proposalId: id,
        attemptId: attemptId || undefined,
      });
      return opsResultToResponse(result);
    } catch (e) {
      console.error("[ai-diff-approve-sim-get]", { code: "internal_error" });
      return diffApproveJsonResponse({ ok: false, error: "internal_error" }, 500);
    }
  }

  const early = rejectNonPost(request);
  if (early) return early;

  const auth = await requireDiffApproveOpsAuth(request, env);
  if (!auth.ok) {
    return diffApproveJsonResponse(
      { ok: false, error: auth.error },
      auth.http || 401,
      "",
      "POST, OPTIONS"
    );
  }

  const prepared = await prepareDecisionWriteRequest(request);
  if (!prepared.ok) return prepared.response;

  try {
    const result = await simulateExecution({
      env,
      actor: { userId: auth.userId },
      body: prepared.body,
      proposalIdFromPath: id,
    });
    return opsResultToResponse(result, "", "POST, OPTIONS");
  } catch (e) {
    console.error("[ai-diff-approve-sim]", { code: "internal_error" });
    return diffApproveJsonResponse(
      { ok: false, error: "internal_error" },
      500,
      "",
      "POST, OPTIONS"
    );
  }
}
