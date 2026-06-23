import {
  handleMatchError,
  handleOptions,
  jsonResponse,
  parseJsonBody,
  requirePost,
  requireUserAsync,
  validateEnum,
  validateString,
  validateTextLength,
} from "../_shared/match-auth.ts";
import { requireMatchBetaAllowed } from "../_shared/match-beta.ts";
import {
  isLiveSafetyEnabled,
  safetySuccess,
  submitReportLive,
} from "../_shared/match-safety.ts";

type ReportBody = {
  reported_user_id?: unknown;
  reported_profile_id?: unknown;
  target_profile_id?: unknown;
  reason?: unknown;
  detail?: unknown;
  context_type?: unknown;
};

const REASONS = [
  "inappropriate_message",
  "impersonation",
  "harassment",
  "other",
] as const;

export async function handler(req: Request): Promise<Response> {
  const options = handleOptions(req);
  if (options) return options;

  try {
    requirePost(req);
    const user = await requireUserAsync(req);
    await requireMatchBetaAllowed(req, user);

    const body = await parseJsonBody<ReportBody>(req);
    const reportedUserId = validateString("reported_user_id", body.reported_user_id, {
      maxLength: 128,
    });
    const reason = validateEnum("reason", body.reason, REASONS);
    validateTextLength("detail", body.detail, 2000, { required: false });

    const profileRaw = body.reported_profile_id ?? body.target_profile_id;
    const reportedProfileId = profileRaw === undefined || profileRaw === null
      ? null
      : validateString("reported_profile_id", profileRaw, { maxLength: 64 });

    const contextType = body.context_type === undefined || body.context_type === null
      ? null
      : validateString("context_type", body.context_type, { maxLength: 32 });

    if (reportedUserId === user.matchUserId) {
      return jsonResponse(
        { ok: false, code: "validation_error", message: "Cannot report yourself" },
        422,
        req,
      );
    }

    if (!isLiveSafetyEnabled() || user.tokenMode === "stub") {
      return jsonResponse(
        {
          ok: true,
          mode: "stub",
          report_id: "stub-report-id",
          status: "submitted",
        },
        200,
        req,
      );
    }

    const detail = body.detail === undefined || body.detail === null
      ? null
      : String(body.detail).trim();

    const result = await submitReportLive(req, user, {
      reported_user_id: reportedUserId,
      reported_profile_id: reportedProfileId,
      reason,
      detail,
      context_type: contextType,
    });

    return safetySuccess(req, user, {
      report_id: result.report_id,
      status: result.status === "open" ? "submitted" : result.status,
    });
  } catch (err) {
    return handleMatchError(err, req);
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
