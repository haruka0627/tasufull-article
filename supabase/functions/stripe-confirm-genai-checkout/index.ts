import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import {
  applyGenAiPlanFromCheckout,
  parseGenAiPlanIdFromMetadata,
  syncGenAiFromStripeSubscription,
} from "../_shared/apply-genai-plan.ts";
import {
  apply3dTicketFromCheckout,
  getGenAiEntitlementsForUser,
  sync2dLiveFromStripeSubscription,
} from "../_shared/apply-genai-entitlements.ts";
import {
  getCheckoutPlanDef,
  parseGenAiCheckoutPlanIdFromMetadata,
  type GenAiCheckoutPlanId,
} from "../_shared/genai-checkout-plans.ts";
import type { GenAiPlanId } from "../_shared/genai-plans.ts";

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecret) return jsonResponse({ error: "STRIPE_SECRET_KEY が未設定です" }, 500);

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const sessionId = String(body.session_id ?? body.sessionId ?? "").trim();
    if (!sessionId) return jsonResponse({ error: "session_id が必要です" }, 400);

    const stripe = new Stripe(stripeSecret, {
      apiVersion: "2025-01-27.acacia",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });

    if (session.payment_status !== "paid" && session.status !== "complete") {
      return jsonResponse(
        {
          ok: false,
          error: "決済が完了していません",
          payment_status: session.payment_status,
          session_status: session.status,
        },
        402
      );
    }

    const meta = session.metadata || {};
    const planId = parseGenAiCheckoutPlanIdFromMetadata(meta);
    const userId = String(meta.user_id || session.client_reference_id || "").trim();

    if (!planId || !userId) {
      return jsonResponse({ error: "セッションに genai_plan / user_id がありません" }, 400);
    }

    const def = getCheckoutPlanDef(planId);
    const stripeCustomerId = String(session.customer || "") || null;

    if (def.mode === "payment") {
      const ticketResult = await apply3dTicketFromCheckout({
        userId,
        planId,
        stripeSessionId: sessionId,
        stripeCustomerId,
      });
      if (ticketResult && !ticketResult.ok) {
        return jsonResponse({ error: ticketResult.error }, ticketResult.status ?? 500);
      }
      const entitlements = await getGenAiEntitlementsForUser(userId);
      return jsonResponse({
        ok: true,
        genai_plan: planId,
        checkout_mode: "payment",
        entitlements,
        tickets3dRemaining: entitlements.tickets3dRemaining,
      });
    }

    if (planId === "genai_2d_live_300") {
      const sub =
        typeof session.subscription === "string"
          ? await stripe.subscriptions.retrieve(session.subscription)
          : session.subscription;
      if (!sub) {
        return jsonResponse({ error: "サブスクリプションの同期に失敗しました" }, 500);
      }
      const result = await sync2dLiveFromStripeSubscription(sub);
      if (!result) {
        return jsonResponse({ error: "2D Live entitlement の同期に失敗しました" }, 500);
      }
      if (!result.ok) {
        return jsonResponse({ error: result.error }, result.status ?? 500);
      }
      const entitlements = await getGenAiEntitlementsForUser(userId);
      return jsonResponse({
        ok: true,
        genai_plan: planId,
        checkout_mode: "subscription",
        entitlements,
      });
    }

    const legacyPlanId = parseGenAiPlanIdFromMetadata(meta);
    if (!legacyPlanId) {
      return jsonResponse({ error: "不明なプランです" }, 400);
    }

    const sub =
      typeof session.subscription === "string"
        ? await stripe.subscriptions.retrieve(session.subscription)
        : session.subscription;

    const result = sub
      ? await syncGenAiFromStripeSubscription(sub)
      : await applyGenAiPlanFromCheckout({
          userId,
          planId: legacyPlanId as GenAiPlanId,
          stripeCustomerId,
          stripeSubscriptionId: null,
          stripePriceId: null,
          currentPeriodEnd: null,
          subscriptionStatus: "active",
          cancelAtPeriodEnd: false,
        });

    if (!result) {
      return jsonResponse({ error: "サブスクリプションの同期に失敗しました" }, 500);
    }
    if (!result.ok) {
      return jsonResponse({ error: result.error }, result.status ?? 500);
    }

    const entitlements = await getGenAiEntitlementsForUser(userId);
    return jsonResponse({
      ok: true,
      plan: result.plan,
      genai_plan: planId as GenAiCheckoutPlanId,
      entitlements,
    });
  } catch (err) {
    console.error("[stripe-confirm-genai-checkout]", err);
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});
