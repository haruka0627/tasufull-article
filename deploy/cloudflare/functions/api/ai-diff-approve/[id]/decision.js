/**
 * POST /api/ai-diff-approve/:id/decision — Staging operator decision write.
 * Actions: propose | approve | reject | cancel
 * No Apply · Provider · Production.
 */
import {
  rejectNonPost,
  requireDiffApproveOpsAuth,
  prepareDecisionWriteRequest,
  opsResultToResponse,
  diffApproveJsonResponse,
} from "../../_shared/ai-diff-approve-http.mjs";
import { recordOperatorDecision } from "../../_shared/ai-diff-approve-ops-decision-write.mjs";

export async function onRequest(context) {
  const { request, env, params } = context;
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

  const id = String(params?.id || "").trim();
  try {
    const result = await recordOperatorDecision({
      env,
      actor: { userId: auth.userId, isOps: true },
      body: prepared.body,
      proposalIdFromPath: id,
    });
    return opsResultToResponse(result, "", "POST, OPTIONS");
  } catch (e) {
    console.error("[ai-diff-approve-decision]", { code: "internal_error" });
    return diffApproveJsonResponse(
      { ok: false, error: "internal_error" },
      500,
      "",
      "POST, OPTIONS"
    );
  }
}
