import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";
import { applyFeaturedToListing } from "../_shared/apply-featured-listing.ts";
import {
  applyGenAiPlanFromCheckout,
  parseGenAiPlanIdFromMetadata,
  syncGenAiFromStripeSubscription,
} from "../_shared/apply-genai-plan.ts";
import {
  applyBusinessDirectoryFromCheckoutSession,
  handleBusinessDirectoryInvoiceEvent,
  isBusinessDirectoryCheckoutSession,
  isBusinessDirectorySubscription,
  syncBusinessDirectoryFromStripeSubscription,
} from "../_shared/business-directory-stripe.ts";
import { BD_STRIPE_ORDER_TYPE } from "../_shared/business-directory-plans.ts";
import { createBusinessDirectoryServiceClient } from "../_shared/business-directory.ts";
import {
  apply3dTicketFromCheckout,
  sync2dLiveFromStripeSubscription,
} from "../_shared/apply-genai-entitlements.ts";
import {
  getCheckoutPlanDef,
  isGenAiSubscriptionOrderType,
  parseGenAiCheckoutPlanIdFromMetadata,
} from "../_shared/genai-checkout-plans.ts";
import type { GenAiPlanId } from "../_shared/genai-plans.ts";

function jsonOk(body: Record<string, unknown> = { received: true }) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

async function applyGenAiBasicProFromCheckoutSession(
  stripe: Stripe,
  session: Stripe.Checkout.Session
) {
  const planId = parseGenAiPlanIdFromMetadata(session.metadata || {});
  const userId = String(session.metadata?.user_id || session.client_reference_id || "").trim();
  if (!planId || !userId) return null;

  const subId = session.subscription;
  const sub =
    typeof subId === "string" ? await stripe.subscriptions.retrieve(subId) : subId;

  if (sub) {
    return syncGenAiFromStripeSubscription(sub);
  }

  return applyGenAiPlanFromCheckout({
    userId,
    planId: planId as GenAiPlanId,
    stripeCustomerId: String(session.customer || "") || null,
    stripeSubscriptionId: null,
    stripePriceId: null,
    currentPeriodEnd: null,
    subscriptionStatus: "active",
    cancelAtPeriodEnd: false,
  });
}

async function applyGenAiCheckoutSession(stripe: Stripe, session: Stripe.Checkout.Session) {
  const meta = session.metadata || {};
  const orderType = String(meta.order_type || "");
  const planId = parseGenAiCheckoutPlanIdFromMetadata(meta);
  const userId = String(meta.user_id || session.client_reference_id || "").trim();

  if (!planId || !userId) return null;

  if (orderType === "genai_3d_ticket" || planId === "genai_3d_generate_500") {
    return apply3dTicketFromCheckout({
      userId,
      planId,
      stripeSessionId: session.id,
      stripeCustomerId: String(session.customer || "") || null,
    });
  }

  if (orderType === "genai_2d_live_subscription" || planId === "genai_2d_live_300") {
    const subId = session.subscription;
    const sub =
      typeof subId === "string" ? await stripe.subscriptions.retrieve(subId) : subId;
    if (sub) return sync2dLiveFromStripeSubscription(sub);
    return null;
  }

  if (orderType === "genai_subscription" || parseGenAiPlanIdFromMetadata(meta)) {
    return applyGenAiBasicProFromCheckoutSession(stripe, session);
  }

  const def = getCheckoutPlanDef(planId);
  if (def.mode === "payment") {
    return apply3dTicketFromCheckout({
      userId,
      planId,
      stripeSessionId: session.id,
      stripeCustomerId: String(session.customer || "") || null,
    });
  }

  return applyGenAiBasicProFromCheckoutSession(stripe, session);
}

function isGenAiCheckoutSession(session: Stripe.Checkout.Session): boolean {
  const meta = session.metadata || {};
  if (parseGenAiCheckoutPlanIdFromMetadata(meta)) return true;
  const orderType = String(meta.order_type || "");
  return (
    isGenAiSubscriptionOrderType(orderType) ||
    orderType === "genai_3d_ticket" ||
    orderType === "genai_subscription"
  );
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  if (!stripeSecret || !webhookSecret) {
    return new Response("Stripe secrets not configured", { status: 500 });
  }

  const stripe = new Stripe(stripeSecret, {
    apiVersion: "2025-01-27.acacia",
    httpClient: Stripe.createFetchHttpClient(),
  });

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing stripe-signature", { status: 400 });
  }

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    console.error("[stripe-webhook] signature verification failed:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      if (isBusinessDirectoryCheckoutSession(session)) {
        if (session.payment_status !== "paid" && session.status !== "complete") {
          return jsonOk({ received: true, skipped: true, kind: "business_directory" });
        }
        const supabase = createBusinessDirectoryServiceClient();
        const result = await applyBusinessDirectoryFromCheckoutSession(supabase, stripe, session);
        if (!result.ok) {
          console.error("[stripe-webhook] business directory checkout failed:", result.error);
          return new Response(result.error, { status: result.status ?? 500 });
        }
        return jsonOk({ received: true, kind: "business_directory" });
      }

      if (isGenAiCheckoutSession(session)) {
        if (session.payment_status !== "paid" && session.status !== "complete") {
          return jsonOk({ received: true, skipped: true, kind: "genai" });
        }

        const result = await applyGenAiCheckoutSession(stripe, session);
        if (result && !result.ok) {
          console.error("[stripe-webhook] genai apply failed:", result.error);
          return new Response(result.error, { status: result.status ?? 500 });
        }
        return jsonOk({ received: true, kind: "genai" });
      }

      if (session.payment_status !== "paid") {
        return jsonOk({ received: true, skipped: true });
      }

      const listingId = session.metadata?.listing_id;
      const featuredPlan = session.metadata?.featured_plan;

      if (!listingId || !featuredPlan) {
        console.warn("[stripe-webhook] missing metadata", session.id);
        return jsonOk();
      }

      const result = await applyFeaturedToListing(listingId, featuredPlan, session.id);
      if (!result.ok) {
        console.error("[stripe-webhook] apply failed:", result.error);
        return new Response(result.error, { status: result.status ?? 500 });
      }
    }

    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const sub = event.data.object as Stripe.Subscription;
      const meta = sub.metadata || {};
      const orderType = String(meta.order_type || "");

      if (orderType === BD_STRIPE_ORDER_TYPE || isBusinessDirectorySubscription(sub)) {
        const supabase = createBusinessDirectoryServiceClient();
        const result = await syncBusinessDirectoryFromStripeSubscription(supabase, sub);
        if (!result.ok) {
          console.error("[stripe-webhook] business directory subscription sync failed:", result.error);
          return new Response(result.error, { status: result.status ?? 500 });
        }
        return jsonOk({ received: true, kind: "business_directory" });
      }

      if (orderType === "genai_2d_live_subscription" || meta.genai_plan === "genai_2d_live_300") {
        const result = await sync2dLiveFromStripeSubscription(sub);
        if (result && !result.ok) {
          console.error("[stripe-webhook] genai 2d live sync failed:", result.error);
          return new Response(result.error, { status: result.status ?? 500 });
        }
        return jsonOk({ received: true, kind: "genai_2d_live" });
      }

      const isGenAi =
        orderType === "genai_subscription" || Boolean(parseGenAiPlanIdFromMetadata(meta));

      if (isGenAi) {
        const result = await syncGenAiFromStripeSubscription(sub);
        if (result && !result.ok) {
          console.error("[stripe-webhook] genai subscription sync failed:", result.error);
          return new Response(result.error, { status: result.status ?? 500 });
        }
      }
    }

    if (event.type === "invoice.payment_succeeded" || event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;
      const supabase = createBusinessDirectoryServiceClient();
      const result = await handleBusinessDirectoryInvoiceEvent(supabase, stripe, invoice, event.type);
      if (result && !result.ok) {
        console.error("[stripe-webhook] business directory invoice failed:", result.error);
        return new Response(result.error, { status: result.status ?? 500 });
      }
      if (result?.ok) {
        return jsonOk({ received: true, kind: "business_directory_invoice" });
      }
    }

    return jsonOk();
  } catch (err) {
    console.error("[stripe-webhook]", err);
    return new Response("Webhook handler error", { status: 500 });
  }
});
