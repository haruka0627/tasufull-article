import {
  createPartnerServiceClient,
  DOCUMENT_TYPES,
  handleOptions,
  handlePartnerError,
  okResponse,
  parseJsonBody,
  requireMethod,
  validatePartnerCreate,
  type PartnerCreateBody,
} from "../_shared/partner.ts";

export async function handler(req: Request): Promise<Response> {
  const options = handleOptions(req);
  if (options) return options;

  try {
    requireMethod(req, "POST");
    const body = await parseJsonBody<PartnerCreateBody>(req);
    const data = validatePartnerCreate(body);
    const pendingDocs = (data.pending_documents as string[]) || [];
    delete data.pending_documents;

    const supabase = createPartnerServiceClient();
    const { data: profile, error: profileErr } = await supabase
      .from("partner_profiles")
      .insert(data)
      .select("id, partner_code, status")
      .single();

    if (profileErr || !profile) {
      console.error("[partner-create]", profileErr);
      throw new Error(profileErr?.message || "insert failed");
    }

    if (pendingDocs.length > 0) {
      const docRows = pendingDocs.map((document_type) => ({
        partner_id: profile.id,
        document_type,
        file_url: `pending://${profile.id}/${document_type}`,
        file_name: `${document_type}.pending`,
        verified: false,
      }));
      const { error: docErr } = await supabase.from("partner_documents").insert(docRows);
      if (docErr) console.error("[partner-create] documents", docErr);
    }

    const { error: reviewErr } = await supabase.from("partner_reviews").insert({
      partner_id: profile.id,
      action: "submit",
      previous_status: "pending",
      new_status: "pending",
      reviewer_id: "system",
      notes: "Registration received",
    });
    if (reviewErr) console.error("[partner-create] review", reviewErr);

    return okResponse({
      partner_id: profile.id,
      partner_code: profile.partner_code,
      status: profile.status,
    }, req, 201);
  } catch (err) {
    return handlePartnerError(err, req);
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
