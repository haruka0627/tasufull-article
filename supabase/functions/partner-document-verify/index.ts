import {
  createPartnerServiceClient,
  handleOptions,
  handlePartnerError,
  okResponse,
  parseJsonBody,
  PartnerFunctionError,
  requireMethod,
  requirePartnerRole,
} from "../_shared/partner.ts";

type VerifyBody = {
  document_id?: string;
  verified?: boolean;
  notes?: string;
};

export async function handler(req: Request): Promise<Response> {
  const options = handleOptions(req);
  if (options) return options;

  try {
    requireMethod(req, "POST");
    const reviewer = await requirePartnerRole(req, ["admin", "reviewer"]);
    const body = await parseJsonBody<VerifyBody>(req);

    const documentId = String(body.document_id ?? "").trim();
    if (!documentId) {
      throw new PartnerFunctionError("validation_error", "document_id is required", 400);
    }
    if (typeof body.verified !== "boolean") {
      throw new PartnerFunctionError("validation_error", "verified must be boolean", 400);
    }

    const supabase = createPartnerServiceClient();
    const updatePayload: Record<string, unknown> = {
      verified: body.verified,
      verified_by: reviewer.userId,
      verified_at: body.verified ? new Date().toISOString() : null,
    };
    if (body.notes !== undefined) {
      updatePayload.notes = String(body.notes ?? "").trim() || null;
    }

    const { data: document, error } = await supabase
      .from("partner_documents")
      .update(updatePayload)
      .eq("id", documentId)
      .select("*")
      .maybeSingle();

    if (error) {
      console.error("[partner-document-verify]", error);
      throw error;
    }
    if (!document) {
      throw new PartnerFunctionError("not_found", "Document not found", 404);
    }

    return okResponse({ document }, req);
  } catch (err) {
    return handlePartnerError(err, req);
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
