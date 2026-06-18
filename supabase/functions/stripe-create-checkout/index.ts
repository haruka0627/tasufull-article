import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import {
  FEATURED_PLANS,
  resolveFeaturedPlanId,
  type FeaturedPlanId,
} from "../_shared/featured-plans.ts";
import { getServiceSupabase } from "../_shared/apply-featured-listing.ts";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DETAIL_PAGES: Record<string, string> = {
  product: "detail-product.html",
  skill: "detail-skill.html",
  job: "detail-job.html",
  worker: "detail-worker.html",
};

function resolveSiteOrigin(req: Request, body: { origin?: string }): string {
  const fromBody = String(body.origin || "").trim().replace(/\/$/, "");
  if (fromBody && /^https?:\/\//i.test(fromBody)) return fromBody;

  const envOrigin = String(Deno.env.get("SITE_URL") || "").trim().replace(/\/$/, "");
  if (envOrigin) return envOrigin;

  const referer = req.headers.get("referer") || req.headers.get("origin") || "";
  try {
    const url = new URL(referer);
    return url.origin;
  } catch {
    return "http://localhost:5173";
  }
}

function buildReturnUrls(
  siteOrigin: string,
  listingType: string,
  listingId: string
) {
  const page = DETAIL_PAGES[listingType] || DETAIL_PAGES.skill;
  const base = `${siteOrigin}/${page}?id=${encodeURIComponent(listingId)}`;
  const successUrl =
    `${base}&featured_checkout=success&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${base}&featured_checkout=cancelled`;
  return { successUrl, cancelUrl };
}

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
    const listingId = String(body.listing_id || "").trim();
    const planId = resolveFeaturedPlanId(body.featured_plan);

    if (!listingId || !UUID_RE.test(listingId)) {
      return jsonResponse({ error: "有効な listing_id（UUID）が必要です" }, 400);
    }
    if (!planId) {
      return jsonResponse(
        {
          error:
            "featured_plan は featured_7days / featured_30days / pr_30days のいずれかです",
        },
        400
      );
    }

    const plan = FEATURED_PLANS[planId as FeaturedPlanId];
    const supabase = getServiceSupabase();

    const { data: listing, error: listingError } = await supabase
      .from("listings")
      .select("id, title, listing_type")
      .eq("id", listingId)
      .maybeSingle();

    if (listingError) {
      console.error(listingError);
      return jsonResponse({ error: listingError.message }, 500);
    }
    if (!listing) {
      return jsonResponse({ error: "掲載が見つかりません" }, 404);
    }

    const listingType = String(listing.listing_type || "skill");
    const siteOrigin = resolveSiteOrigin(req, body);
    const { successUrl, cancelUrl } = buildReturnUrls(
      siteOrigin,
      listingType,
      listingId
    );

    const stripe = new Stripe(stripeSecret, {
      apiVersion: "2025-01-27.acacia",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      locale: "ja",
      metadata: {
        listing_id: listingId,
        featured_plan: planId,
        listing_type: listingType,
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "jpy",
            unit_amount: plan.amountJpy,
            product_data: {
              name: plan.label,
              description: String(listing.title || "TasuFull 掲載").slice(0, 200),
            },
          },
        },
      ],
    });

    if (!session.url) {
      return jsonResponse({ error: "Checkout URL の生成に失敗しました" }, 500);
    }

    return jsonResponse({
      ok: true,
      url: session.url,
      session_id: session.id,
    });
  } catch (err) {
    console.error("[stripe-create-checkout]", err);
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});
