import {
  handleMatchError,
  handleOptions,
  jsonResponse,
  parseJsonBody,
  requirePost,
  requireUserAsync,
  validateEnum,
  validateString,
} from "../_shared/match-auth.ts";

type ModerationLogBody = {
  source?: unknown;
  target_user_id?: unknown;
  severity?: unknown;
  reason?: unknown;
};

const SOURCES = ["profile", "photo", "message", "report", "system"] as const;
const SEVERITIES = ["low", "medium", "high", "critical"] as const;

export async function handler(req: Request): Promise<Response> {
  const options = handleOptions(req);
  if (options) return options;

  try {
    requirePost(req);
    await requireUserAsync(req);

    const body = await parseJsonBody<ModerationLogBody>(req);
    validateEnum("source", body.source, SOURCES);
    validateString("target_user_id", body.target_user_id, { maxLength: 128 });
    validateEnum("severity", body.severity, SEVERITIES);
    validateString("reason", body.reason, { maxLength: 500 });

    return jsonResponse(
      {
        ok: true,
        mode: "stub",
        log_id: "stub-log-id",
        queued: true,
      },
      200,
      req,
    );
  } catch (err) {
    return handleMatchError(err, req);
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
