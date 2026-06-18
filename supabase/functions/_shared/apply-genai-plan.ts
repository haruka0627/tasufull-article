import { getServiceSupabase } from "./apply-featured-listing.ts";

import {

  GENAI_FREE_PLAN,

  GENAI_PLANS,

  limitsFromPlanCode,

  parseGenAiPlanIdFromMetadata,

  resolveGenAiPlanId,

  resolveGenAiPlanIdFromStripePrice,

  type GenAiPlanId,

  type GenAiPlanLimits,

} from "./genai-plans.ts";



export { getServiceSupabase };

export { parseGenAiPlanIdFromMetadata };



export type GenAiPlanPayload = GenAiPlanLimits & {

  stripeSubscriptionId?: string | null;

  status?: string;

  subscriptionStatus?: string | null;

  cancelAtPeriodEnd?: boolean;

  currentPeriodEnd?: string | null;

  canceledAt?: string | null;

  cancelScheduled?: boolean;

  updatedAt?: string;

};



export type ApplyGenAiPlanResult =

  | { ok: true; plan: GenAiPlanPayload }

  | { ok: false; error: string; status?: number };



const IMMEDIATE_FREE_SUBSCRIPTION_STATUSES = new Set(["unpaid", "incomplete_expired"]);



export function isGenAiPeriodEndActive(

  periodEnd: string | null | undefined

): boolean {

  if (!periodEnd) return false;

  const t = new Date(periodEnd).getTime();

  return Number.isFinite(t) && t > Date.now();

}



/** DB 行または Stripe 同期用オブジェクトから有料アクセス可否を判定 */

export function hasPaidGenAiAccessFromRow(

  row: Record<string, unknown> | null | undefined

): boolean {

  if (!row) return false;



  const subscriptionStatus = String(

    row.subscription_status ?? row.status ?? ""

  ).trim();



  if (IMMEDIATE_FREE_SUBSCRIPTION_STATUSES.has(subscriptionStatus)) {

    return false;

  }



  const periodEnd = row.current_period_end as string | null | undefined;

  const periodActive = isGenAiPeriodEndActive(periodEnd);

  const cancelAtPeriodEnd = Boolean(row.cancel_at_period_end);



  if (subscriptionStatus === "active" || subscriptionStatus === "trialing") {

    if (!periodEnd) return true;

    return periodActive;

  }



  if (periodActive) {

    if (cancelAtPeriodEnd) return true;

    if (subscriptionStatus === "canceled") return true;

    const planCode = String(row.plan_code || "");

    if (planCode === "basic_300" || planCode === "pro_980") return true;

  }



  return false;

}



function buildPlanPayload(

  limits: GenAiPlanLimits,

  extra: {

    stripeSubscriptionId?: string | null;

    status?: string;

    subscriptionStatus?: string | null;

    cancelAtPeriodEnd?: boolean;

    currentPeriodEnd?: string | null;

    canceledAt?: string | null;

    cancelScheduled?: boolean;

  } = {}

): GenAiPlanPayload {

  const cancelAtPeriodEnd = Boolean(extra.cancelAtPeriodEnd);

  const periodActive = isGenAiPeriodEndActive(extra.currentPeriodEnd ?? null);

  const cancelScheduled =

    Boolean(extra.cancelScheduled) ||

    (cancelAtPeriodEnd && periodActive && limits.plan !== "free");



  return {

    plan: limits.plan,

    label: limits.label,

    dailyTextLimit: limits.dailyTextLimit,

    dailyVoiceLimit: limits.dailyVoiceLimit,

    dailyImageLimit: limits.dailyImageLimit,

    stripeSubscriptionId: extra.stripeSubscriptionId ?? null,

    status: extra.status ?? "active",

    subscriptionStatus: extra.subscriptionStatus ?? null,

    cancelAtPeriodEnd,

    currentPeriodEnd: extra.currentPeriodEnd ?? null,

    canceledAt: extra.canceledAt ?? null,

    cancelScheduled,

    updatedAt: new Date().toISOString(),

  };

}



function planPayloadFromDbRow(data: Record<string, unknown>): GenAiPlanPayload {

  if (!hasPaidGenAiAccessFromRow(data)) {

    return buildPlanPayload(GENAI_FREE_PLAN, {

      status: "free",

      subscriptionStatus: String(data.subscription_status ?? data.status ?? "free"),

      cancelAtPeriodEnd: Boolean(data.cancel_at_period_end),

      currentPeriodEnd: (data.current_period_end as string) ?? null,

      canceledAt: (data.canceled_at as string) ?? null,

      stripeSubscriptionId: (data.stripe_subscription_id as string) ?? null,

    });

  }



  const limits = limitsFromPlanCode(String(data.plan_code || "free"));

  const subscriptionStatus = String(data.subscription_status ?? data.status ?? "active");

  const periodActive = isGenAiPeriodEndActive(

    (data.current_period_end as string) ?? null

  );

  const cancelAtPeriodEnd = Boolean(data.cancel_at_period_end);



  return buildPlanPayload(limits, {

    stripeSubscriptionId: (data.stripe_subscription_id as string) ?? null,

    status: cancelAtPeriodEnd && periodActive ? "active" : subscriptionStatus,

    subscriptionStatus,

    cancelAtPeriodEnd,

    currentPeriodEnd: (data.current_period_end as string) ?? null,

    canceledAt: (data.canceled_at as string) ?? null,

    cancelScheduled: cancelAtPeriodEnd && periodActive,

  });

}



export async function upsertGenAiSubscription(input: {

  userId: string;

  planCode: string;

  limits: GenAiPlanLimits;

  stripeCustomerId?: string | null;

  stripeSubscriptionId?: string | null;

  stripePriceId?: string | null;

  status?: string;

  subscriptionStatus?: string | null;

  cancelAtPeriodEnd?: boolean;

  currentPeriodEnd?: string | null;

  canceledAt?: string | null;

}): Promise<ApplyGenAiPlanResult> {

  const userId = String(input.userId || "").trim();

  if (!userId) {

    return { ok: false, error: "user_id が必要です", status: 400 };

  }



  const subscriptionStatus = String(

    input.subscriptionStatus ?? input.status ?? "active"

  ).trim();

  const cancelAtPeriodEnd = Boolean(input.cancelAtPeriodEnd);

  const displayStatus =

    input.limits.plan === "free"

      ? "free"

      : cancelAtPeriodEnd && isGenAiPeriodEndActive(input.currentPeriodEnd)

        ? "active"

        : subscriptionStatus;



  const supabase = getServiceSupabase();

  const row = {

    user_id: userId,

    plan_code: input.planCode,

    daily_text_limit: input.limits.dailyTextLimit,

    daily_voice_limit: input.limits.dailyVoiceLimit,

    daily_image_limit: input.limits.dailyImageLimit,

    stripe_customer_id: input.stripeCustomerId ?? null,

    stripe_subscription_id: input.stripeSubscriptionId ?? null,

    stripe_price_id: input.stripePriceId ?? null,

    status: displayStatus,

    subscription_status: subscriptionStatus,

    cancel_at_period_end: cancelAtPeriodEnd,

    canceled_at: input.canceledAt ?? null,

    current_period_end: input.currentPeriodEnd ?? null,

    updated_at: new Date().toISOString(),

  };



  const { error } = await supabase.from("gen_ai_subscriptions").upsert(row, {

    onConflict: "user_id",

  });



  if (error) {

    console.error("[apply-genai-plan] upsert failed:", error);

    return { ok: false, error: error.message, status: 500 };

  }



  const accessRow = {

    ...row,

    plan_code: input.planCode,

  };



  return {

    ok: true,

    plan: planPayloadFromDbRow(accessRow),

  };

}



export async function applyGenAiPlanFromCheckout(input: {

  userId: string;

  planId: GenAiPlanId;

  stripeCustomerId?: string | null;

  stripeSubscriptionId?: string | null;

  stripePriceId?: string | null;

  currentPeriodEnd?: string | null;

  cancelAtPeriodEnd?: boolean;

  subscriptionStatus?: string;

  canceledAt?: string | null;

}): Promise<ApplyGenAiPlanResult> {

  const limits = GENAI_PLANS[input.planId];

  return upsertGenAiSubscription({

    userId: input.userId,

    planCode: limits.plan,

    limits,

    stripeCustomerId: input.stripeCustomerId,

    stripeSubscriptionId: input.stripeSubscriptionId,

    stripePriceId: input.stripePriceId,

    subscriptionStatus: input.subscriptionStatus ?? "active",

    cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,

    currentPeriodEnd: input.currentPeriodEnd,

    canceledAt: input.canceledAt ?? null,

  });

}



export async function revertGenAiPlanToFree(

  userId: string,

  opts: {

    stripeCustomerId?: string | null;

    subscriptionStatus?: string;

    canceledAt?: string | null;

    currentPeriodEnd?: string | null;

    cancelAtPeriodEnd?: boolean;

    stripeSubscriptionId?: string | null;

  } = {}

): Promise<ApplyGenAiPlanResult> {

  const supabase = getServiceSupabase();

  const { data: existing } = await supabase

    .from("gen_ai_subscriptions")

    .select("stripe_customer_id, stripe_subscription_id")

    .eq("user_id", userId)

    .maybeSingle();



  return upsertGenAiSubscription({

    userId,

    planCode: GENAI_FREE_PLAN.plan,

    limits: GENAI_FREE_PLAN,

    stripeCustomerId: opts.stripeCustomerId ?? existing?.stripe_customer_id ?? null,

    stripeSubscriptionId: opts.stripeSubscriptionId ?? null,

    stripePriceId: null,

    subscriptionStatus: opts.subscriptionStatus ?? "canceled",

    cancelAtPeriodEnd: opts.cancelAtPeriodEnd ?? false,

    currentPeriodEnd: opts.currentPeriodEnd ?? null,

    canceledAt: opts.canceledAt ?? new Date().toISOString(),

  });

}



export type StripeCustomerLookupResult =

  | { ok: true; customerId: string }

  | { ok: false; error: string; status?: number; code?: string };



export async function getStripeCustomerIdForUser(

  userId: string

): Promise<StripeCustomerLookupResult> {

  const id = String(userId || "").trim();

  if (!id) {

    return { ok: false, error: "user_id が必要です", status: 400, code: "missing_user_id" };

  }



  const supabase = getServiceSupabase();

  const { data, error } = await supabase

    .from("gen_ai_subscriptions")

    .select("stripe_customer_id, stripe_subscription_id, status, subscription_status, plan_code")

    .eq("user_id", id)

    .maybeSingle();



  if (error) {

    console.error("[apply-genai-plan] customer lookup failed:", error);

    return { ok: false, error: error.message, status: 500, code: "db_error" };

  }



  let customerId = String(data?.stripe_customer_id || "").trim();

  if (!customerId) {
    const { getStripeCustomerIdFromEntitlements } = await import("./apply-genai-entitlements.ts");
    customerId = (await getStripeCustomerIdFromEntitlements(id)) || "";
  }

  if (!customerId) {

    return {

      ok: false,

      error: "先にプラン登録が必要です。Basic / Pro / 2D Live / 3Dチケットのいずれかをお申し込みください。",

      status: 404,

      code: "no_customer_id",

    };

  }



  return { ok: true, customerId };

}



export async function getGenAiPlanForUser(userId: string): Promise<ApplyGenAiPlanResult> {

  const id = String(userId || "").trim();

  if (!id) return { ok: false, error: "user_id が必要です", status: 400 };



  const supabase = getServiceSupabase();

  const { data, error } = await supabase

    .from("gen_ai_subscriptions")

    .select("*")

    .eq("user_id", id)

    .maybeSingle();



  if (error) {

    console.error("[apply-genai-plan] read failed:", error);

    return { ok: false, error: error.message, status: 500 };

  }



  if (!data) {

    return { ok: true, plan: buildPlanPayload(GENAI_FREE_PLAN, { status: "free", subscriptionStatus: "free" }) };

  }



  return { ok: true, plan: planPayloadFromDbRow(data as Record<string, unknown>) };

}



async function resolvePlanIdForSubscription(

  userId: string,

  meta: Record<string, string | undefined>,

  stripePriceId: string | null

): Promise<GenAiPlanId | null> {

  const fromMeta = parseGenAiPlanIdFromMetadata(meta);

  if (fromMeta) return fromMeta;



  const fromPrice = stripePriceId ? resolveGenAiPlanIdFromStripePrice(stripePriceId) : null;

  if (fromPrice) return fromPrice;



  const supabase = getServiceSupabase();

  const { data } = await supabase

    .from("gen_ai_subscriptions")

    .select("plan_code")

    .eq("user_id", userId)

    .maybeSingle();



  const code = String(data?.plan_code || "");

  const entry = Object.values(GENAI_PLANS).find((p) => p.plan === code);

  return entry?.id ?? null;

}



/** Stripe Subscription オブジェクトから DB を同期（期間末まで有料維持） */

export async function syncGenAiFromStripeSubscription(sub: {

  id: string;

  status: string;

  customer: string | { id?: string } | null;

  metadata?: Record<string, string> | null;

  cancel_at_period_end?: boolean;

  current_period_end?: number;

  canceled_at?: number | null;

  items?: { data?: Array<{ price?: { id?: string } | null }> };

}): Promise<ApplyGenAiPlanResult | null> {

  const meta = (sub.metadata || {}) as Record<string, string | undefined>;

  const userId = String(meta.user_id || "").trim();

  if (!userId) return null;



  const stripePriceId = sub.items?.data?.[0]?.price?.id ?? null;

  const subscriptionStatus = String(sub.status || "");

  const cancelAtPeriodEnd = Boolean(sub.cancel_at_period_end);

  const currentPeriodEnd = sub.current_period_end

    ? new Date(sub.current_period_end * 1000).toISOString()

    : null;

  const canceledAt = sub.canceled_at

    ? new Date(sub.canceled_at * 1000).toISOString()

    : null;

  const stripeCustomerId = String(sub.customer || "") || null;



  const previewRow: Record<string, unknown> = {

    subscription_status: subscriptionStatus,

    status: subscriptionStatus,

    cancel_at_period_end: cancelAtPeriodEnd,

    current_period_end: currentPeriodEnd,

    plan_code: "",

  };



  if (IMMEDIATE_FREE_SUBSCRIPTION_STATUSES.has(subscriptionStatus)) {

    return revertGenAiPlanToFree(userId, {

      stripeCustomerId,

      subscriptionStatus,

      canceledAt,

      currentPeriodEnd: null,

      cancelAtPeriodEnd: false,

    });

  }



  const planId = await resolvePlanIdForSubscription(userId, meta, stripePriceId);

  if (planId) {

    previewRow.plan_code = GENAI_PLANS[planId].plan;

  } else {

    const supabase = getServiceSupabase();

    const { data } = await supabase

      .from("gen_ai_subscriptions")

      .select("plan_code")

      .eq("user_id", userId)

      .maybeSingle();

    previewRow.plan_code = String(data?.plan_code || "");

  }



  if (!hasPaidGenAiAccessFromRow(previewRow)) {

    return revertGenAiPlanToFree(userId, {

      stripeCustomerId,

      subscriptionStatus,

      canceledAt,

      currentPeriodEnd,

      cancelAtPeriodEnd,

    });

  }



  const finalPlanId =

    planId ?? (await resolvePlanIdForSubscription(userId, meta, stripePriceId));

  if (!finalPlanId) {

    console.warn("[apply-genai-plan] planId unresolved for user", userId, sub.id);

    return null;

  }



  return applyGenAiPlanFromCheckout({

    userId,

    planId: finalPlanId,

    stripeCustomerId,

    stripeSubscriptionId: sub.id,

    stripePriceId,

    currentPeriodEnd,

    cancelAtPeriodEnd,

    subscriptionStatus,

    canceledAt,

  });

}


