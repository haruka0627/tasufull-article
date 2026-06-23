import {
  assertReviewTransition,
  createPartnerServiceClient,
  handleOptions,
  handlePartnerError,
  okResponse,
  parseJsonBody,
  PartnerFunctionError,
  requireMethod,
  requirePartnerRole,
  statusForAction,
  validateReasonCode,
} from "../_shared/partner.ts";

type ReviewBody = {
  partner_id?: string;
  action?: string;
  reason_code?: string;
  checklist_json?: Record<string, unknown>;
  notes?: string;
};

export async function handler(req: Request): Promise<Response> {
  const options = handleOptions(req);
  if (options) return options;

  try {
    requireMethod(req, "POST");
    const reviewer = await requirePartnerRole(req, ["admin", "reviewer"]);
    const body = await parseJsonBody<ReviewBody>(req);

    const partnerId = String(body.partner_id ?? "").trim();
    const action = String(body.action ?? "").trim();
    if (!partnerId) {
      throw new PartnerFunctionError("validation_error", "partner_id is required", 400);
    }

    const supabase = createPartnerServiceClient();
    const { data: current, error: fetchErr } = await supabase
      .from("partner_profiles")
      .select("*")
      .eq("id", partnerId)
      .maybeSingle();

    if (fetchErr) {
      console.error("[partner-review]", fetchErr);
      throw fetchErr;
    }
    if (!current) {
      throw new PartnerFunctionError("not_found", "Partner not found", 404);
    }

    const previousStatus = String(current.status);
    assertReviewTransition(previousStatus, action);
    const newStatus = statusForAction(action);
    const reasonCode = String(body.reason_code ?? "").trim() || null;
    validateReasonCode(action, reasonCode);

    const profileUpdate: Record<string, unknown> = { status: newStatus };
    if (action === "approve") {
      profileUpdate.approved_at = new Date().toISOString();
    }

    const { data: profile, error: updateErr } = await supabase
      .from("partner_profiles")
      .update(profileUpdate)
      .eq("id", partnerId)
      .select("*")
      .single();

    if (updateErr || !profile) {
      console.error("[partner-review] update", updateErr);
      throw updateErr || new Error("update failed");
    }

    const checklist = body.checklist_json && typeof body.checklist_json === "object"
      ? body.checklist_json
      : {};

    const { data: review, error: reviewErr } = await supabase
      .from("partner_reviews")
      .insert({
        partner_id: partnerId,
        action,
        previous_status: previousStatus,
        new_status: newStatus,
        reason_code: reasonCode,
        checklist_json: checklist,
        notes: String(body.notes ?? "").trim() || null,
        reviewer_id: reviewer.userId,
      })
      .select("*")
      .single();

    if (reviewErr || !review) {
      console.error("[partner-review] insert", reviewErr);
      throw reviewErr || new Error("review insert failed");
    }

    return okResponse({ profile, review }, req);
  } catch (err) {
    return handlePartnerError(err, req);
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
