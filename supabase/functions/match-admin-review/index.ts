import {
  handleMatchError,
  handleOptions,
  parseJsonBody,
  requireAdminAsync,
  requirePost,
} from "../_shared/match-auth.ts";
import {
  adminReviewLive,
  adminSuccess,
  isLiveAdminEnabled,
  type AdminReviewBody,
} from "../_shared/match-admin.ts";

export async function handler(req: Request): Promise<Response> {
  const options = handleOptions(req);
  if (options) return options;

  try {
    requirePost(req);
    const admin = await requireAdminAsync(req);
    const body = await parseJsonBody<AdminReviewBody>(req);

    if (!isLiveAdminEnabled() || admin.tokenMode === "stub") {
      const intent = String(body.intent ?? "execute").trim().toLowerCase();
      if (intent.startsWith("list_")) {
        return adminSuccess(req, admin, { items: [] });
      }
      return adminSuccess(req, admin, {
        reviewed: true,
        action: body.action ?? null,
      });
    }

    const result = await adminReviewLive(req, admin, body);
    return adminSuccess(req, admin, result);
  } catch (err) {
    return handleMatchError(err, req);
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
