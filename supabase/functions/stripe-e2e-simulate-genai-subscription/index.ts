/**
 * テストモード専用: Stripe サブスク作成 → gen_ai_subscriptions 反映
 * E2E / 開発確認用。sk_test_ のみ。
 */
import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { applyGenAiPlanFromCheckout } from "../_shared/apply-genai-plan.ts";
import {
  GENAI_PLANS,
  resolveGenAiPlanId,
  resolveStripePriceId,
  type GenAiPlanId,
} from "../_shared/genai-plans.ts";

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
    const planId = resolveGenAiPlanId(body.genai_plan ?? body.plan);
    const userId = String(body.user_id ?? body.userId ?? "").trim();
    if (!planId || !userId) {
      return jsonResponse({ error: "genai_plan と user_id が必要です" }, 400);
    }

    const plan = GENAI_PLANS[planId as GenAiPlanId];
    const priceId = resolveStripePriceId(planId as GenAiPlanId);
    if (!priceId) {
      return jsonResponse({ error: "STRIPE_GENAI_PRICE_* が未設定です" }, 500);
    }

    const stripe = new Stripe(stripeSecret, {
      apiVersion: "2025-01-27.acacia",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const customer = await stripe.customers.create({
      email: `e2e-${userId}@tasful.test`,
      metadata: { user_id: userId, order_type: "genai_subscription" },
    });

    const pm = await stripe.paymentMethods.create({
      type: "card",
      card: { token: "tok_visa" },
    });
    await stripe.paymentMethods.attach(pm.id, { customer: customer.id });
    await stripe.customers.update(customer.id, {
      invoice_settings: { default_payment_method: pm.id },
    });

    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: priceId }],
      metadata: {
        order_type: "genai_subscription",
        genai_plan: planId,
        user_id: userId,
      },
    });

    const result = await applyGenAiPlanFromCheckout({
      userId,
      planId: planId as GenAiPlanId,
      stripeCustomerId: customer.id,
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      currentPeriodEnd: subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : null,
    });

    if (!result.ok) return jsonResponse({ error: result.error }, result.status ?? 500);

    return jsonResponse({
      ok: true,
      simulated: true,
      plan: result.plan,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: customer.id,
    });
  } catch (err) {
    console.error("[stripe-e2e-simulate-genai-subscription]", err);
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});
