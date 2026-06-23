import {
  createPartnerServiceClient,
  formatProfileSummary,
  handleOptions,
  handlePartnerError,
  okResponse,
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
    const status = url.searchParams.get("status")?.trim() || "";
    const source = url.searchParams.get("source")?.trim() || "";
    const q = url.searchParams.get("q")?.trim() || "";
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "50", 10) || 50));
    const offset = (page - 1) * limit;

    const supabase = createPartnerServiceClient();
    let query = supabase
      .from("partner_profiles")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq("status", status);
    if (source) query = query.eq("source", source);
    if (q) {
      const safe = q.replace(/[%_,]/g, "").trim();
      if (safe) {
        const pattern = `%${safe}%`;
        query = query.or(
          `company_name.ilike.${pattern},partner_code.ilike.${pattern},email.ilike.${pattern},contact_name.ilike.${pattern}`,
        );
      }
    }

    const { data, error, count } = await query;
    if (error) {
      console.error("[partner-list]", error);
      throw error;
    }

    const items = (data || []).map((row) => formatProfileSummary(row as Record<string, unknown>));
    return okResponse({ items, total: count ?? items.length, page, limit }, req);
  } catch (err) {
    return handlePartnerError(err, req);
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
