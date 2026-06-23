import {
  createPartnerServiceClient,
  handleOptions,
  handlePartnerError,
  okResponse,
  PartnerFunctionError,
  requireMethod,
  requirePartnerRole,
} from "../_shared/partner.ts";

export async function handler(req: Request): Promise<Response> {
  const options = handleOptions(req);
  if (options) return options;

  try {
    requireMethod(req, "GET");
    await requirePartnerRole(req, ["admin", "ops", "reviewer"]);

    const url = new URL(req.url);
    const partnerId = url.searchParams.get("partner_id")?.trim() || "";
    if (!partnerId) {
      throw new PartnerFunctionError("validation_error", "partner_id is required", 400);
    }

    const supabase = createPartnerServiceClient();
    const { data: profile, error: profileErr } = await supabase
      .from("partner_profiles")
      .select("*")
      .eq("id", partnerId)
      .maybeSingle();

    if (profileErr) {
      console.error("[partner-get]", profileErr);
      throw profileErr;
    }
    if (!profile) {
      throw new PartnerFunctionError("not_found", "Partner not found", 404);
    }

    const { data: reviews, error: reviewsErr } = await supabase
      .from("partner_reviews")
      .select("*")
      .eq("partner_id", partnerId)
      .order("reviewed_at", { ascending: false });

    if (reviewsErr) {
      console.error("[partner-get] reviews", reviewsErr);
      throw reviewsErr;
    }

    const { data: documents, error: docsErr } = await supabase
      .from("partner_documents")
      .select("*")
      .eq("partner_id", partnerId)
      .order("created_at", { ascending: true });

    if (docsErr) {
      console.error("[partner-get] documents", docsErr);
      throw docsErr;
    }

    return okResponse({
      profile,
      reviews: reviews || [],
      documents: documents || [],
    }, req);
  } catch (err) {
    return handlePartnerError(err, req);
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
