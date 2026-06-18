import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getServiceSupabase } from "../_shared/apply-featured-listing.ts";

function resolveSiteOrigin(req: Request, body: { origin?: string }): string {
  const fromBody = String(body.origin || "").trim().replace(/\/$/, "");
  if (fromBody && /^https?:\/\//i.test(fromBody)) return fromBody;
  const envOrigin = String(Deno.env.get("SITE_URL") || "").trim().replace(/\/$/, "");
  if (envOrigin) return envOrigin;
  try {
    return new URL(req.headers.get("referer") || "").origin;
  } catch {
    return "http://localhost:5173";
  }
}

function isLocalDealId(dealId: string): boolean {
  return dealId.startsWith("local-deal-");
}

function pickFeeFromBody(body: Record<string, unknown>): number {
  return Math.round(
    Number(body.fee_amount ?? body.feeAmount ?? body.platform_fee_amount) || 0
  );
}

function pickAgreedFromBody(body: Record<string, unknown>): number {
  return Math.round(Number(body.agreed_amount ?? body.amount) || 0);
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecret) return jsonResponse({ error: "STRIPE_SECRET_KEY が未設定です" }, 500);

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const dealId = String(body.deal_id || body.dealId || "").trim();
    if (!dealId) return jsonResponse({ error: "deal_id が必要です" }, 400);

    const siteOrigin = resolveSiteOrigin(req, body);
    const successUrl = `${siteOrigin}/service-fee-pay.html?fee_checkout=success&deal=${encodeURIComponent(dealId)}&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${siteOrigin}/service-fee-pay.html?deal=${encodeURIComponent(dealId)}&fee_checkout=cancelled`;

    const stripe = new Stripe(stripeSecret, {
      apiVersion: "2025-01-27.acacia",
      httpClient: Stripe.createFetchHttpClient(),
    });

    let fee = 0;
    let serviceId = "";
    let productName = "TASFUL 成約手数料（業務サービス）";
    let productDescription = `取引ID: ${dealId}`;
    /** @type {Record<string, string>} */
    let metadata: Record<string, string> = {
      order_type: "service_platform_fee",
      deal_id: dealId,
    };

    if (isLocalDealId(dealId) || body.deal_type === "local") {
      fee = pickFeeFromBody(body);
      if (fee < 1) {
        return jsonResponse(
          { error: "手数料金額が未設定です（localDeal は fee_amount / feeAmount が必要です）" },
          400
        );
      }

      const agreed = pickAgreedFromBody(body);
      serviceId = String(body.service_id || "").trim();
      const title = String(body.title || "").trim();
      productName = title || "TASFUL 成約手数料（業務サービス・デモ）";
      productDescription = agreed > 0
        ? `デモ取引 / 成約金額 ¥${agreed.toLocaleString("ja-JP")} / ${dealId}`
        : `デモ取引 / ${dealId}`;

      metadata = {
        ...metadata,
        deal_type: "local",
        local_deal_id: dealId,
        service_id: serviceId,
        platform_fee_amount: String(fee),
        agreed_amount: agreed > 0 ? String(agreed) : "",
      };
    } else {
      const supabase = getServiceSupabase();
      const { data: deal, error: dealError } = await supabase
        .from("service_deals")
        .select("*")
        .eq("id", dealId)
        .maybeSingle();

      if (dealError) return jsonResponse({ error: dealError.message }, 500);
      if (!deal) return jsonResponse({ error: "取引が見つかりません" }, 404);

      fee = Math.round(Number(deal.platform_fee_amount) || 0);
      if (fee < 1) return jsonResponse({ error: "手数料金額が未設定です" }, 400);

      serviceId = String(deal.service_id || "");
      metadata = {
        ...metadata,
        deal_type: "supabase",
        service_id: serviceId,
        platform_fee_amount: String(fee),
      };
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      locale: "ja",
      metadata,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "jpy",
            unit_amount: fee,
            product_data: {
              name: productName,
              description: productDescription,
            },
          },
        },
      ],
    });

    return jsonResponse({
      ok: true,
      session_id: session.id,
      checkout_url: session.url,
      url: session.url,
      deal_type: metadata.deal_type || "supabase",
    });
  } catch (err) {
    console.error("[stripe-create-service-fee]", err);
    return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
