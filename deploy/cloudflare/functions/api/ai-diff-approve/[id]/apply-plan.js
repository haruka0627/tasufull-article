/**
 * POST /api/ai-diff-approve/:id/apply-plan — Staging dry-run Apply Plan.
 * GET  /api/ai-diff-approve/:id/apply-plan — list plans for proposal.
 * No real Apply · Provider · status mutation.
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
  createApplyPlan,
  getApplyPlans,
} from "../../_shared/ai-diff-approve-ops-apply-plan.mjs";

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
      const planId = String(url.searchParams.get("planId") || "").trim();
      const result = await getApplyPlans({
        env,
        proposalId: id,
        planId: planId || undefined,
      });
      return opsResultToResponse(result);
    } catch (e) {
      console.error("[ai-diff-approve-apply-plan-get]", { code: "internal_error" });
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
    const result = await createApplyPlan({
      env,
      actor: { userId: auth.userId },
      body: prepared.body,
      proposalIdFromPath: id,
    });
    return opsResultToResponse(result, "", "POST, OPTIONS");
  } catch (e) {
    console.error("[ai-diff-approve-apply-plan]", { code: "internal_error" });
    return diffApproveJsonResponse(
      { ok: false, error: "internal_error" },
      500,
      "",
      "POST, OPTIONS"
    );
  }
}
