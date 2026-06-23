import {
  handleMatchError,
  handleOptions,
  jsonResponse,
  parseJsonBody,
  requirePost,
  requireUserAsync,
  validateString,
} from "../_shared/match-auth.ts";
import { requireMatchBetaAllowed } from "../_shared/match-beta.ts";
import {
  isLiveVerificationEnabled,
  listVerificationsLive,
  normalizeApiVerificationType,
  submitVerificationLive,
  verificationSuccess,
} from "../_shared/match-verification.ts";

type VerificationBody = {
  intent?: unknown;
  verification_type?: unknown;
  id_document_type?: unknown;
  metadata?: unknown;
};

export async function handler(req: Request): Promise<Response> {
  const options = handleOptions(req);
  if (options) return options;

  try {
    requirePost(req);
    const user = await requireUserAsync(req);
    await requireMatchBetaAllowed(req, user);
    const body = await parseJsonBody<VerificationBody>(req);
    const intent = body.intent === undefined || body.intent === null
      ? "submit"
      : String(body.intent).trim().toLowerCase();

    if (!isLiveVerificationEnabled() || user.tokenMode === "stub") {
      if (intent === "list") {
        return jsonResponse(
          { ok: true, mode: "stub", items: [] },
          200,
          req,
        );
      }
      return jsonResponse(
        {
          ok: true,
          mode: "stub",
          verification_id: "stub-verification-id",
          verification_type: "identity",
          status: "pending",
        },
        200,
        req,
      );
    }

    if (intent === "list") {
      const result = await listVerificationsLive(req, user);
      return verificationSuccess(req, user, result);
    }

    if (body.verification_type === undefined || body.verification_type === null) {
      return jsonResponse(
        { ok: false, code: "validation_error", message: "verification_type is required" },
        422,
        req,
      );
    }

    const apiType = normalizeApiVerificationType(String(body.verification_type));

    if (body.metadata !== undefined && body.metadata !== null) {
      if (typeof body.metadata !== "object" || Array.isArray(body.metadata)) {
        return jsonResponse(
          { ok: false, code: "validation_error", message: "metadata must be an object" },
          422,
          req,
        );
      }
    }

    const idDocumentType = body.id_document_type === undefined || body.id_document_type === null
      ? null
      : validateString("id_document_type", body.id_document_type, { maxLength: 64 });

    const result = await submitVerificationLive(req, user, {
      verification_type: apiType,
      id_document_type: idDocumentType,
      metadata: body.metadata as Record<string, unknown> | null,
    });

    return verificationSuccess(req, user, {
      ...result,
      message: "確認申請を受け付けました",
    });
  } catch (err) {
    return handleMatchError(err, req);
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
