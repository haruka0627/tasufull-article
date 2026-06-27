/**
 * Business Directory Phase 6 — Stripe subscription checkout · portal · sync
 */
import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  BD_STRIPE_ORDER_TYPE,
  hasPaidBusinessDirectoryAccess,
  isPaidPlanCode,
  primarySubscriptionPriceId,
  resolvePlanFromStripePriceId,
  resolveStripePriceIdForPlan,
  stripePeriodEndIso,
  type BusinessDirectoryPlanCode,
} from "./business-directory-plans.ts";
import { appendAuditLog, BusinessDirectoryError } from "./business-directory.ts";

export type BdStripeApplyResult =
  | { ok: true; listing_id: string; plan_code: string }
  | { ok: false; error: string; status?: number };

function pickString(...values: unknown[]): string {
  for (const v of values) {
    const s = String(v ?? "").trim();
    if (s) return s;
  }
  return "";
}

function getStripeClient(): Stripe {
  const stripeSecret = String(Deno.env.get("STRIPE_SECRET_KEY") ?? "").trim();
  if (!stripeSecret) {
    throw new BusinessDirectoryError("stripe_not_configured", "STRIPE_SECRET_KEY not configured", 500);
  }
  return new Stripe(stripeSecret, {
    apiVersion: "2025-01-27.acacia",
    httpClient: Stripe.createFetchHttpClient(),
  });
}

function resolveSiteOrigin(req: Request, bodyOrigin?: string): string {
  const fromBody = String(bodyOrigin ?? "").trim().replace(/\/$/, "");
  if (fromBody && /^https?:\/\//i.test(fromBody)) return fromBody;
  const envOrigin = String(Deno.env.get("SITE_URL") ?? "").trim().replace(/\/$/, "");
  if (envOrigin) return envOrigin;
  try {
    return new URL(req.headers.get("referer") || "").origin;
  } catch {
    return "http://localhost:5173";
  }
}

async function getOwnedListingOrThrow(
  supabase: SupabaseClient,
  ownerUserId: string,
  listingId: string,
): Promise<Record<string, unknown>> {
  const { data, error } = await supabase
    .from("business_directory_listings")
    .select("*")
    .eq("id", listingId)
    .maybeSingle();
  if (error) throw new BusinessDirectoryError("db_error", error.message, 500);
  if (!data) throw new BusinessDirectoryError("not_found", "Listing not found", 404);
  if (String(data.owner_user_id) !== ownerUserId) {
    throw new BusinessDirectoryError("forbidden", "Not listing owner", 403);
  }
  return data as Record<string, unknown>;
}

async function findListingBySubscriptionId(
  supabase: SupabaseClient,
  subscriptionId: string,
): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase
    .from("business_directory_listings")
    .select("*")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle();
  if (error) throw new BusinessDirectoryError("db_error", error.message, 500);
  return (data as Record<string, unknown>) ?? null;
}

async function findListingByCustomerId(
  supabase: SupabaseClient,
  customerId: string,
): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase
    .from("business_directory_listings")
    .select("*")
    .eq("stripe_customer_id", customerId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new BusinessDirectoryError("db_error", error.message, 500);
  return (data as Record<string, unknown>) ?? null;
}

export async function applyBusinessDirectorySubscriptionPatch(
  supabase: SupabaseClient,
  listingId: string,
  patch: Record<string, unknown>,
  audit: {
    action: string;
    actorUserId?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<Record<string, unknown>> {
  const { data: before } = await supabase
    .from("business_directory_listings")
    .select("plan_code, status, subscription_status")
    .eq("id", listingId)
    .maybeSingle();

  const { data, error } = await supabase
    .from("business_directory_listings")
    .update(patch)
    .eq("id", listingId)
    .select("*")
    .single();

  if (error || !data) {
    throw new BusinessDirectoryError("db_error", error?.message || "update failed", 500);
  }

  await appendAuditLog(supabase, {
    listingId,
    actorUserId: audit.actorUserId ?? null,
    actorRole: audit.actorUserId ? "owner" : "system",
    action: audit.action,
    fromStatus: before ? String(before.status) : null,
    toStatus: String(data.status),
    metadata: {
      from_plan: before?.plan_code,
      to_plan: data.plan_code,
      subscription_status: data.subscription_status,
      ...(audit.metadata ?? {}),
    },
  });

  return data as Record<string, unknown>;
}

function buildPatchFromStripeSubscription(
  listing: Record<string, unknown>,
  sub: Stripe.Subscription,
  priceId: string | null,
): Record<string, unknown> {
  const planFromPrice = priceId ? resolvePlanFromStripePriceId(priceId) : null;
  const subscriptionStatus = String(sub.status || "");
  const periodEnd = stripePeriodEndIso(sub);
  const cancelAtPeriodEnd = Boolean(sub.cancel_at_period_end);

  let planCode: BusinessDirectoryPlanCode = "free";
  if (hasPaidBusinessDirectoryAccess({
    plan_code: planFromPrice || listing.plan_code,
    subscription_status: subscriptionStatus,
    current_period_end: periodEnd,
    cancel_at_period_end: cancelAtPeriodEnd,
  })) {
    planCode = (planFromPrice || String(listing.plan_code || "free")) as BusinessDirectoryPlanCode;
    if (!isPaidPlanCode(planCode)) planCode = "free";
  }

  const prevPlan = String(listing.plan_code || "free");
  const patch: Record<string, unknown> = {
    stripe_subscription_id: sub.id,
    stripe_customer_id: String(sub.customer || listing.stripe_customer_id || "") || null,
    stripe_price_id: priceId,
    subscription_status: subscriptionStatus,
    current_period_end: periodEnd,
    cancel_at_period_end: cancelAtPeriodEnd,
    plan_code: planCode,
  };

  if (planCode !== prevPlan) {
    patch.plan_changed_at = new Date().toISOString();
    patch.plan_assigned_at = new Date().toISOString();
  }

  return patch;
}

export async function syncBusinessDirectoryFromStripeSubscription(
  supabase: SupabaseClient,
  sub: Stripe.Subscription,
  opts: { listingId?: string; actorUserId?: string | null } = {},
): Promise<BdStripeApplyResult> {
  const meta = sub.metadata || {};
  let listingId = pickString(opts.listingId, meta.listing_id);

  if (!listingId) {
    const bySub = await findListingBySubscriptionId(supabase, sub.id);
    listingId = bySub ? String(bySub.id) : "";
  }

  if (!listingId) {
    const customerId = String(sub.customer || "");
    if (customerId) {
      const byCustomer = await findListingByCustomerId(supabase, customerId);
      listingId = byCustomer ? String(byCustomer.id) : "";
    }
  }

  if (!listingId) {
    return { ok: false, error: "listing_not_found", status: 404 };
  }

  const { data: listing, error } = await supabase
    .from("business_directory_listings")
    .select("*")
    .eq("id", listingId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message, status: 500 };
  if (!listing) return { ok: false, error: "listing_not_found", status: 404 };

  const priceId = primarySubscriptionPriceId(sub);
  const patch = buildPatchFromStripeSubscription(listing as Record<string, unknown>, sub, priceId);

  await applyBusinessDirectorySubscriptionPatch(supabase, listingId, patch, {
    action: "subscription.sync",
    actorUserId: opts.actorUserId ?? null,
    metadata: { stripe_event: "subscription", subscription_id: sub.id },
  });

  return { ok: true, listing_id: listingId, plan_code: String(patch.plan_code) };
}

export async function applyBusinessDirectoryFromCheckoutSession(
  supabase: SupabaseClient,
  stripe: Stripe,
  session: Stripe.Checkout.Session,
): Promise<BdStripeApplyResult> {
  const meta = session.metadata || {};
  const listingId = pickString(meta.listing_id);
  if (!listingId) return { ok: false, error: "missing_listing_id", status: 400 };

  const subId = session.subscription;
  if (!subId) {
    return { ok: false, error: "missing_subscription", status: 400 };
  }

  const sub = typeof subId === "string"
    ? await stripe.subscriptions.retrieve(subId)
    : subId;

  return syncBusinessDirectoryFromStripeSubscription(supabase, sub, {
    listingId,
    actorUserId: pickString(meta.owner_user_id) || null,
  });
}

export async function handleBusinessDirectoryInvoiceEvent(
  supabase: SupabaseClient,
  stripe: Stripe,
  invoice: Stripe.Invoice,
  eventType: string,
): Promise<BdStripeApplyResult | null> {
  const subId = invoice.subscription;
  if (!subId) return null;

  const sub = typeof subId === "string"
    ? await stripe.subscriptions.retrieve(subId)
    : subId;

  if (String(sub.metadata?.order_type || "") !== BD_STRIPE_ORDER_TYPE) {
    const linked = await findListingBySubscriptionId(supabase, sub.id);
    if (!linked) return null;
  }

  const result = await syncBusinessDirectoryFromStripeSubscription(supabase, sub);

  if (eventType === "invoice.payment_failed") {
    const listingId = result.ok ? result.listing_id : pickString(sub.metadata?.listing_id);
    if (listingId) {
      await appendAuditLog(supabase, {
        listingId,
        actorUserId: null,
        actorRole: "system",
        action: "subscription.payment_failed",
        metadata: { invoice_id: invoice.id, subscription_id: sub.id },
      });
    }
  }

  return result;
}

export function isBusinessDirectoryCheckoutSession(session: Stripe.Checkout.Session): boolean {
  return String(session.metadata?.order_type || "") === BD_STRIPE_ORDER_TYPE;
}

export function isBusinessDirectorySubscription(sub: Stripe.Subscription): boolean {
  return String(sub.metadata?.order_type || "") === BD_STRIPE_ORDER_TYPE;
}

export async function createBusinessDirectorySubscriptionCheckout(
  supabase: SupabaseClient,
  ownerUserId: string,
  listingId: string,
  targetPlan: string,
  req: Request,
  body: { origin?: string; success_path?: string; cancel_path?: string },
): Promise<Record<string, unknown>> {
  const planCode = String(targetPlan || "").trim().toLowerCase();
  if (!isPaidPlanCode(planCode)) {
    throw new BusinessDirectoryError("validation_error", "target_plan must be standard or pro", 400);
  }

  const priceId = resolveStripePriceIdForPlan(planCode);
  if (!priceId) {
    throw new BusinessDirectoryError(
      "stripe_not_configured",
      `Stripe price not configured for ${planCode}`,
      500,
    );
  }

  const listing = await getOwnedListingOrThrow(supabase, ownerUserId, listingId);
  const stripe = getStripeClient();

  const existingSubId = pickString(listing.stripe_subscription_id);
  const existingStatus = String(listing.subscription_status || "");
  if (
    existingSubId &&
    hasPaidBusinessDirectoryAccess(listing) &&
    ["active", "trialing", "past_due"].includes(existingStatus)
  ) {
    const sub = await stripe.subscriptions.retrieve(existingSubId);
    const itemId = sub.items?.data?.[0]?.id;
    if (!itemId) {
      throw new BusinessDirectoryError("stripe_error", "Subscription item missing", 500);
    }

    const updated = await stripe.subscriptions.update(existingSubId, {
      items: [{ id: itemId, price: priceId }],
      metadata: {
        order_type: BD_STRIPE_ORDER_TYPE,
        listing_id: listingId,
        owner_user_id: ownerUserId,
        plan_code: planCode,
      },
      proration_behavior: "create_prorations",
    });

    const synced = await syncBusinessDirectoryFromStripeSubscription(supabase, updated, {
      listingId,
      actorUserId: ownerUserId,
    });
    if (!synced.ok) {
      throw new BusinessDirectoryError("sync_failed", synced.error, synced.status ?? 500);
    }

    return {
      mode: "subscription_update",
      plan_code: synced.plan_code,
      listing_id: listingId,
    };
  }

  const siteOrigin = resolveSiteOrigin(req, body.origin);
  const successPath = pickString(body.success_path) || `/business-directory/edit.html?id=${listingId}&tab=basic&bd_checkout=success`;
  const cancelPath = pickString(body.cancel_path) || `/business-directory/edit.html?id=${listingId}&tab=basic&bd_checkout=cancel`;
  const successUrl = `${siteOrigin}${successPath}${successPath.includes("?") ? "&" : "?"}bd_session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${siteOrigin}${cancelPath}`;

  let customerId = pickString(listing.stripe_customer_id);
  if (!customerId) {
    const customer = await stripe.customers.create({
      metadata: {
        order_type: BD_STRIPE_ORDER_TYPE,
        listing_id: listingId,
        owner_user_id: ownerUserId,
      },
    });
    customerId = customer.id;
    await supabase
      .from("business_directory_listings")
      .update({ stripe_customer_id: customerId })
      .eq("id", listingId);
  }

  const metadata = {
    order_type: BD_STRIPE_ORDER_TYPE,
    listing_id: listingId,
    owner_user_id: ownerUserId,
    plan_code: planCode,
  };

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    success_url: successUrl,
    cancel_url: cancelUrl,
    locale: "ja",
    client_reference_id: listingId,
    metadata,
    subscription_data: { metadata },
    line_items: [{ quantity: 1, price: priceId }],
  });

  if (!session.url) {
    throw new BusinessDirectoryError("stripe_error", "Checkout URL generation failed", 500);
  }

  return {
    mode: "checkout",
    url: session.url,
    session_id: session.id,
    plan_code: planCode,
  };
}

export async function createBusinessDirectoryBillingPortalSession(
  supabase: SupabaseClient,
  ownerUserId: string,
  listingId: string,
  req: Request,
  body: { origin?: string; return_path?: string },
): Promise<Record<string, unknown>> {
  const listing = await getOwnedListingOrThrow(supabase, ownerUserId, listingId);
  const customerId = pickString(listing.stripe_customer_id);
  if (!customerId) {
    throw new BusinessDirectoryError(
      "billing_portal_unavailable",
      "Stripe customer not found — subscribe first",
      400,
    );
  }

  const stripe = getStripeClient();
  const siteOrigin = resolveSiteOrigin(req, body.origin);
  const returnPath = pickString(body.return_path) || `/business-directory/edit.html?id=${listingId}&tab=basic`;
  const returnUrl = `${siteOrigin}${returnPath}`;

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return { url: session.url };
}

export async function syncBusinessDirectorySubscriptionStatus(
  supabase: SupabaseClient,
  ownerUserId: string,
  listingId: string,
): Promise<Record<string, unknown>> {
  const listing = await getOwnedListingOrThrow(supabase, ownerUserId, listingId);
  const subId = pickString(listing.stripe_subscription_id);
  if (!subId) {
    return {
      listing,
      synced: false,
      message: "No active Stripe subscription on file",
    };
  }

  const stripe = getStripeClient();
  const sub = await stripe.subscriptions.retrieve(subId);
  const result = await syncBusinessDirectoryFromStripeSubscription(supabase, sub, {
    listingId,
    actorUserId: ownerUserId,
  });

  if (!result.ok) {
    throw new BusinessDirectoryError("sync_failed", result.error, result.status ?? 500);
  }

  const { data: refreshed } = await supabase
    .from("business_directory_listings")
    .select("*")
    .eq("id", listingId)
    .single();

  return {
    listing: refreshed,
    synced: true,
    plan_code: result.plan_code,
  };
}
