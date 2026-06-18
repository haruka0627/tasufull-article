/**
 * テストモード専用: 2D Live サブスク / 3Dチケット購入を Stripe + DB まで反映
 */
import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import {
  add3dGenerateTicket,
  getGenAiEntitlementsForUser,
  sync2dLiveFromStripeSubscription,
} from "../_shared/apply-genai-entitlements.ts";
import {
  resolveGenAiCheckoutPlanId,
  resolveStripePriceIdForCheckout,
  type GenAiCheckoutPlanId,
} from "../_shared/genai-checkout-plans.ts";

async function attachTestCard(stripe: Stripe, customerId: string) {
  const pm = await stripe.paymentMethods.create({
    type: "card",
    card: { token: "tok_visa" },
  });
  await stripe.paymentMethods.attach(pm.id, { customer: customerId });
  await stripe.customers.update(customerId, {
    invoice_settings: { default_payment_method: pm.id },
  });
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecret?.startsWith("sk_test_")) {
      return jsonResponse({ error: "sk_test_ モードのみ利用可能です" }, 403);
    }

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const planId = resolveGenAiCheckoutPlanId(body.genai_plan ?? body.plan);
    const userId = String(body.user_id ?? body.userId ?? "").trim();

    if (!planId || !userId) {
      return jsonResponse({ error: "genai_plan と user_id が必要です" }, 400);
    }
    if (planId !== "genai_2d_live_300" && planId !== "genai_3d_generate_500") {
      return jsonResponse(
        { error: "genai_2d_live_300 または genai_3d_generate_500 のみシミュレート可能です" },
        400
      );
    }

    const priceId = resolveStripePriceIdForCheckout(planId as GenAiCheckoutPlanId);
    if (!priceId) {
      return jsonResponse({ error: "STRIPE_GENAI_PRICE_* が未設定です" }, 500);
    }

    const stripe = new Stripe(stripeSecret, {
      apiVersion: "2025-01-27.acacia",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const customer = await stripe.customers.create({
      email: `e2e-addon-${userId}@tasful.test`,
      metadata: { user_id: userId },
    });

    if (planId === "genai_3d_generate_500") {
      const ticketResult = await add3dGenerateTicket(userId, 1, customer.id);
      if (!ticketResult.ok) {
        return jsonResponse({ error: ticketResult.error }, ticketResult.status ?? 500);
      }
      const entitlements = await getGenAiEntitlementsForUser(userId);
      return jsonResponse({
        ok: true,
        simulated: true,
        genai_plan: planId,
        entitlements,
        tickets3dRemaining: entitlements.tickets3dRemaining,
      });
    }

    await attachTestCard(stripe, customer.id);
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: priceId }],
      metadata: {
        order_type: "genai_2d_live_subscription",
        genai_plan: planId,
        user_id: userId,
      },
    });

    const result = await sync2dLiveFromStripeSubscription(subscription);
    if (!result?.ok) {
      return jsonResponse({ error: result?.error || "2D Live 同期失敗" }, result?.status ?? 500);
    }

    const entitlements = await getGenAiEntitlementsForUser(userId);
    return jsonResponse({
      ok: true,
      simulated: true,
      genai_plan: planId,
      entitlements,
      live2dUnlimited: entitlements.live2dUnlimited,
      twoDLive: entitlements.live2dUnlimited,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: customer.id,
    });
  } catch (err) {
    console.error("[stripe-e2e-simulate-genai-addon]", err);
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});
