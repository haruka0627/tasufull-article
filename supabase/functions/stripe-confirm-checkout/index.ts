import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";
import { corsHeaders, handleOptions, jsonResponse } from "../_shared/cors.ts";
import { applyFeaturedToListing } from "../_shared/apply-featured-listing.ts";

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecret) {
      return jsonResponse({ error: "STRIPE_SECRET_KEY が未設定です" }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const sessionId = String(body.session_id || "").trim();

    if (!sessionId) {
      return jsonResponse({ error: "session_id が必要です" }, 400);
    }

    const stripe = new Stripe(stripeSecret, {
      apiVersion: "2025-01-27.acacia",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return jsonResponse(
        { ok: false, error: "決済が完了していません", payment_status: session.payment_status },
        402
      );
    }

    const listingId = session.metadata?.listing_id;
    const featuredPlan = session.metadata?.featured_plan;

    if (!listingId || !featuredPlan) {
      return jsonResponse({ error: "セッションに metadata がありません" }, 400);
    }

    const result = await applyFeaturedToListing(
      listingId,
      featuredPlan,
      session.id
    );

    if (!result.ok) {
      return jsonResponse({ error: result.error }, result.status ?? 500);
    }

    return jsonResponse({
      ok: true,
      listing_id: result.listing_id,
      featured_plan: result.featured_plan,
    });
  } catch (err) {
    console.error("[stripe-confirm-checkout]", err);
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});
