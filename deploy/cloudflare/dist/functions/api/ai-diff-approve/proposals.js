/**
 * GET /api/ai-diff-approve/proposals — Staging read-only list.
 */
import {
  rejectNonGet,
  requireDiffApproveOpsAuth,
  opsResultToResponse,
  diffApproveJsonResponse,
} from "../../_shared/ai-diff-approve-http.mjs";
import { listOpsProposals } from "../../_shared/ai-diff-approve-ops-read.mjs";

export async function onRequest(context) {
  const { request, env } = context;
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
    const result = await listOpsProposals({
      env,
      query: url.searchParams,
    });
    return opsResultToResponse(result);
  } catch (e) {
    console.error("[ai-diff-approve-proposals]", { code: "internal_error" });
    return diffApproveJsonResponse({ ok: false, error: "internal_error" }, 500);
  }
}
