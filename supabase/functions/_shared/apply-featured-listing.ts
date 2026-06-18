import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  buildListingFeaturedPatch,
  resolveFeaturedPlanId,
  type FeaturedPlanId,
} from "./featured-plans.ts";

export type ApplyFeaturedResult =
  | { ok: true; listing_id: string; featured_plan: FeaturedPlanId }
  | { ok: false; error: string; status?: number };

export function getServiceSupabase() {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !key) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が未設定です");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function applyFeaturedToListing(
  listingId: string,
  featuredPlanRaw: string,
  stripeSessionId?: string
): Promise<ApplyFeaturedResult> {
  const planId = resolveFeaturedPlanId(featuredPlanRaw);
  if (!planId) {
    return { ok: false, error: "不明な featured_plan です", status: 400 };
  }

  const id = String(listingId || "").trim();
  if (!id) {
    return { ok: false, error: "listing_id が未設定です", status: 400 };
  }

  const supabase = getServiceSupabase();

  const { data: existing, error: fetchError } = await supabase
    .from("listings")
    .select("id, form_data, featured_stripe_session_id")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    console.error("[apply-featured] fetch failed:", fetchError);
    return { ok: false, error: fetchError.message, status: 500 };
  }

  if (!existing) {
    return { ok: false, error: "掲載が見つかりません", status: 404 };
  }

  if (
    stripeSessionId &&
    existing.featured_stripe_session_id === stripeSessionId
  ) {
    return { ok: true, listing_id: id, featured_plan: planId };
  }

  const patch = buildListingFeaturedPatch(planId);
  const formData =
    existing.form_data && typeof existing.form_data === "object"
      ? { ...existing.form_data }
      : {};

  if (stripeSessionId) {
    formData.featured_stripe_session_id = stripeSessionId;
  }

  const { error: updateError } = await supabase
    .from("listings")
    .update({
      ...patch,
      form_data: formData,
      featured_stripe_session_id: stripeSessionId ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateError) {
    console.error("[apply-featured] update failed:", updateError);
    return { ok: false, error: updateError.message, status: 500 };
  }

  return { ok: true, listing_id: id, featured_plan: planId };
}
