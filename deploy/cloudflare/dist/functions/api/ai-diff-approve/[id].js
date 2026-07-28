/**
 * GET /api/ai-diff-approve/:id — Staging read-only proposal detail.
 * GET /api/ai-diff-approve/:id?view=timeline — timeline only.
 */
import {
  rejectNonGet,
  requireDiffApproveOpsAuth,
  opsResultToResponse,
  diffApproveJsonResponse,
} from "../../_shared/ai-diff-approve-http.mjs";
import {
  getOpsProposalDetail,
  getOpsProposalTimeline,
} from "../../_shared/ai-diff-approve-ops-read.mjs";

export async function onRequest(context) {
  const { request, env, params } = context;
  const early = rejectNonGet(request);
  if (early) return early;

  const auth = await requireDiffApproveOpsAuth(request, env);
  if (!auth.ok) {
    return diffApproveJsonResponse(
      { ok: false, error: auth.error },
      auth.http || 401
    );
  }

  const id = String(params?.id || "").trim();
  try {
    const url = new URL(request.url);
    const view = String(url.searchParams.get("view") || "").toLowerCase();
    const result =
      view === "timeline"
        ? await getOpsProposalTimeline({ env, proposalId: id })
        : await getOpsProposalDetail({ env, proposalId: id });
    return opsResultToResponse(result);
  } catch (e) {
    console.error("[ai-diff-approve-detail]", { code: "internal_error" });
    return diffApproveJsonResponse({ ok: false, error: "internal_error" }, 500);
  }
}
