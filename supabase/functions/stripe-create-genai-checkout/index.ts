import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import {
  getCheckoutPlanDef,
  resolveGenAiCheckoutPlanId,
  resolveStripePriceIdForCheckout,
  type GenAiCheckoutPlanId,
} from "../_shared/genai-checkout-plans.ts";
import { GENAI_PLANS, GENAI_STRIPE_PRODUCT_IDS, type GenAiPlanId } from "../_shared/genai-plans.ts";

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

function buildLineItem(
  planId: GenAiCheckoutPlanId,
  configuredPriceId: string
): Stripe.Checkout.SessionCreateParams.LineItem {
  if (configuredPriceId) {
    return { quantity: 1, price: configuredPriceId };
  }
  const def = getCheckoutPlanDef(planId);
  if (def.mode === "payment") {
    return {
      quantity: 1,
      price_data: {
        currency: "jpy",
        unit_amount: def.amountJpy,
        product_data: {
          name: def.label,
          metadata: {
            genai_plan: planId,
            tasful_product_id: def.stripeProductRef,
            order_type: def.orderType,
          },
        },
      },
    };
  }
  const subPlan = GENAI_PLANS[planId as GenAiPlanId];
  const label = subPlan?.label ?? def.label;
  const productRef =
    planId in GENAI_STRIPE_PRODUCT_IDS
      ? GENAI_STRIPE_PRODUCT_IDS[planId as GenAiPlanId]
      : def.stripeProductRef;
  return {
    quantity: 1,
    price_data: {
      currency: "jpy",
      unit_amount: def.amountJpy,
      recurring: { interval: "month" },
      product_data: {
        name: label,
        metadata: {
          genai_plan: planId,
          tasful_product_id: productRef,
          order_type: def.orderType,
        },
      },
    },
  };
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecret) return jsonResponse({ error: "STRIPE_SECRET_KEY が未設定です" }, 500);

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const planId = resolveGenAiCheckoutPlanId(body.genai_plan ?? body.plan);
    const userId = String(body.user_id ?? body.userId ?? "").trim();

    if (!planId) {
      return jsonResponse(
        {
          error:
            "genai_plan は genai_basic_300 / genai_pro_980 / genai_2d_live_300 / genai_3d_generate_500 のいずれかです",
        },
        400
      );
    }
    if (!userId) {
      return jsonResponse({ error: "user_id が必要です" }, 400);
    }

    const def = getCheckoutPlanDef(planId);
    const siteOrigin = resolveSiteOrigin(req, body);
    const successUrl =
      `${siteOrigin}/gen-ai-workspace.html?genai_checkout=success&session_id={CHECKOUT_SESSION_ID}&genai_plan=${planId}`;
    const cancelUrl = `${siteOrigin}/gen-ai-workspace.html?genai_checkout=cancelled`;

    const stripe = new Stripe(stripeSecret, {
      apiVersion: "2025-01-27.acacia",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const configuredPriceId = resolveStripePriceIdForCheckout(planId);
    const lineItem = buildLineItem(planId, configuredPriceId);

    const metadata = {
      order_type: def.orderType,
      genai_plan: planId,
      user_id: userId,
    };

    const params: Stripe.Checkout.SessionCreateParams = {
      mode: def.mode,
      success_url: successUrl,
      cancel_url: cancelUrl,
      locale: "ja",
      client_reference_id: userId,
      metadata,
      line_items: [lineItem],
    };

    if (def.mode === "subscription") {
      params.subscription_data = { metadata };
    }

    if (def.mode === "payment") {
      params.payment_intent_data = { metadata };
    }

    const session = await stripe.checkout.sessions.create(params);

    if (!session.url) {
      return jsonResponse({ error: "Checkout URL の生成に失敗しました" }, 500);
    }

    return jsonResponse({
      ok: true,
      url: session.url,
      session_id: session.id,
      genai_plan: planId,
      checkout_mode: def.mode,
    });
  } catch (err) {
    console.error("[stripe-create-genai-checkout]", err);
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});
