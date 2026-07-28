/**
 * POST /api/ai-diff-approve/:id/apply-gate — Staging Final Apply Gate confirm.
 * GET  /api/ai-diff-approve/:id/apply-gate — list gate records.
 * No real Apply · Provider · status→applying.
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
  confirmApplyGate,
  getApplyGates,
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
      const gateId = String(url.searchParams.get("gateId") || "").trim();
      const result = await getApplyGates({
        env,
        proposalId: id,
        gateId: gateId || undefined,
      });
      return opsResultToResponse(result);
    } catch (e) {
      console.error("[ai-diff-approve-apply-gate-get]", { code: "internal_error" });
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
    const result = await confirmApplyGate({
      env,
      actor: { userId: auth.userId },
      body: prepared.body,
      proposalIdFromPath: id,
    });
    return opsResultToResponse(result, "", "POST, OPTIONS");
  } catch (e) {
    console.error("[ai-diff-approve-apply-gate]", { code: "internal_error" });
    return diffApproveJsonResponse(
      { ok: false, error: "internal_error" },
      500,
      "",
      "POST, OPTIONS"
    );
  }
}
