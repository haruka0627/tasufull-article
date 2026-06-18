import { getServiceSupabase } from "./apply-featured-listing.ts";
import {
  ENTITLEMENT_2D_LIVE,
  parseGenAiCheckoutPlanIdFromMetadata,
  resolveGenAiCheckoutPlanIdFromStripePrice,
  type GenAiCheckoutPlanId,
} from "./genai-checkout-plans.ts";
import { isGenAiPeriodEndActive } from "./apply-genai-plan.ts";

export type GenAiEntitlementsPayload = {
  live2dUnlimited: boolean;
  /** @deprecated 互換エイリアス（twoDLive === live2dUnlimited） */
  twoDLive: boolean;
  live2dStatus: string;
  live2dCurrentPeriodEnd: string | null;
  live2dCancelScheduled: boolean;
  tickets3dRemaining: number;
  tickets3dTotalPurchased: number;
  tickets3dTotalUsed: number;
};

export type ApplyEntitlementResult =
  | { ok: true; entitlements: GenAiEntitlementsPayload; alreadyGranted?: boolean }
  | { ok: false; error: string; status?: number };

const IMMEDIATE_INACTIVE = new Set(["unpaid", "incomplete_expired"]);

export function hasActive2dLiveEntitlement(row: Record<string, unknown> | null | undefined): boolean {
  if (!row) return false;
  const subscriptionStatus = String(row.subscription_status ?? row.status ?? "").trim();
  if (IMMEDIATE_INACTIVE.has(subscriptionStatus)) return false;
  const status = String(row.status || "").trim();
  if (status === "inactive") return false;
  if (subscriptionStatus === "active" || subscriptionStatus === "trialing") {
    const periodEnd = row.current_period_end as string | null | undefined;
    if (!periodEnd) return true;
    return isGenAiPeriodEndActive(periodEnd);
  }
  const periodEnd = row.current_period_end as string | null | undefined;
  if (!isGenAiPeriodEndActive(periodEnd)) return false;
  if (Boolean(row.cancel_at_period_end)) return true;
  if (subscriptionStatus === "canceled") return true;
  return status === "active";
}

function buildEntitlementsPayload(
  liveRow: Record<string, unknown> | null,
  ticketsRow: Record<string, unknown> | null
): GenAiEntitlementsPayload {
  const periodEnd = (liveRow?.current_period_end as string | null) ?? null;
  const cancelAtPeriodEnd = Boolean(liveRow?.cancel_at_period_end);
  const liveActive = hasActive2dLiveEntitlement(liveRow);
  return {
    live2dUnlimited: liveActive,
    twoDLive: liveActive,
    live2dStatus: String(liveRow?.status || (liveActive ? "active" : "inactive")),
    live2dCurrentPeriodEnd: periodEnd,
    live2dCancelScheduled:
      liveActive && cancelAtPeriodEnd && isGenAiPeriodEndActive(periodEnd),
    tickets3dRemaining: Math.max(0, Number(ticketsRow?.tickets_remaining) || 0),
    tickets3dTotalPurchased: Math.max(0, Number(ticketsRow?.total_purchased) || 0),
    tickets3dTotalUsed: Math.max(0, Number(ticketsRow?.total_used) || 0),
  };
}

export async function getGenAiEntitlementsForUser(
  userId: string
): Promise<GenAiEntitlementsPayload> {
  const id = String(userId || "").trim();
  if (!id) {
    return buildEntitlementsPayload(null, null);
  }
  const supabase = getServiceSupabase();
  const [liveRes, ticketsRes] = await Promise.all([
    supabase
      .from("gen_ai_entitlements")
      .select("*")
      .eq("user_id", id)
      .eq("entitlement_type", ENTITLEMENT_2D_LIVE)
      .maybeSingle(),
    supabase.from("gen_ai_3d_tickets").select("*").eq("user_id", id).maybeSingle(),
  ]);
  if (liveRes.error) console.error("[genai-entitlements] live read:", liveRes.error);
  if (ticketsRes.error) console.error("[genai-entitlements] tickets read:", ticketsRes.error);
  return buildEntitlementsPayload(
    (liveRes.data as Record<string, unknown>) || null,
    (ticketsRes.data as Record<string, unknown>) || null
  );
}

export async function upsert2dLiveEntitlement(input: {
  userId: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripePriceId?: string | null;
  subscriptionStatus?: string;
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: string | null;
  canceledAt?: string | null;
  status?: string;
}): Promise<ApplyEntitlementResult> {
  const subscriptionStatus = String(input.subscriptionStatus || "active");
  const periodEnd = input.currentPeriodEnd ?? null;
  const preview: Record<string, unknown> = {
    status: input.status || "active",
    subscription_status: subscriptionStatus,
    cancel_at_period_end: Boolean(input.cancelAtPeriodEnd),
    current_period_end: periodEnd,
  };
  const active = hasActive2dLiveEntitlement(preview);
  const row = {
    user_id: input.userId,
    entitlement_type: ENTITLEMENT_2D_LIVE,
    status: active ? "active" : "inactive",
    stripe_customer_id: input.stripeCustomerId ?? null,
    stripe_subscription_id: input.stripeSubscriptionId ?? null,
    stripe_price_id: input.stripePriceId ?? null,
    subscription_status: subscriptionStatus,
    cancel_at_period_end: Boolean(input.cancelAtPeriodEnd),
    current_period_end: periodEnd,
    canceled_at: input.canceledAt ?? null,
    updated_at: new Date().toISOString(),
  };
  const supabase = getServiceSupabase();
  const { error } = await supabase.from("gen_ai_entitlements").upsert(row, {
    onConflict: "user_id,entitlement_type",
  });
  if (error) {
    console.error("[genai-entitlements] upsert 2d live failed:", error);
    return { ok: false, error: error.message, status: 500 };
  }
  const entitlements = await getGenAiEntitlementsForUser(input.userId);
  return { ok: true, entitlements };
}

export async function deactivate2dLiveEntitlement(
  userId: string,
  opts: {
    stripeCustomerId?: string | null;
    subscriptionStatus?: string;
    cancelAtPeriodEnd?: boolean;
    currentPeriodEnd?: string | null;
    canceledAt?: string | null;
    stripeSubscriptionId?: string | null;
  } = {}
): Promise<ApplyEntitlementResult> {
  return upsert2dLiveEntitlement({
    userId,
    stripeCustomerId: opts.stripeCustomerId,
    stripeSubscriptionId: opts.stripeSubscriptionId ?? null,
    subscriptionStatus: opts.subscriptionStatus ?? "canceled",
    cancelAtPeriodEnd: opts.cancelAtPeriodEnd ?? false,
    currentPeriodEnd: opts.currentPeriodEnd ?? null,
    canceledAt: opts.canceledAt ?? new Date().toISOString(),
    status: "inactive",
  });
}

/** 本番3D生成成功時のみ呼ぶ（条件付き更新で二重消費を防止） */
export async function consume3dGenerateTicket(
  userId: string
): Promise<ApplyEntitlementResult> {
  const id = String(userId || "").trim();
  if (!id) return { ok: false, error: "user_id が必要です", status: 400 };
  const supabase = getServiceSupabase();
  const { data: existing, error: readErr } = await supabase
    .from("gen_ai_3d_tickets")
    .select("tickets_remaining, total_used")
    .eq("user_id", id)
    .maybeSingle();
  if (readErr) {
    console.error("[genai-entitlements] consume 3d read:", readErr);
    return { ok: false, error: readErr.message, status: 500 };
  }
  const remaining = Math.max(0, Number(existing?.tickets_remaining) || 0);
  if (remaining < 1) {
    return { ok: false, error: "3D生成チケットがありません", status: 402 };
  }
  const nextRemaining = remaining - 1;
  const nextUsed = Math.max(0, Number(existing?.total_used) || 0) + 1;
  const { data: updated, error: updErr } = await supabase
    .from("gen_ai_3d_tickets")
    .update({
      tickets_remaining: nextRemaining,
      total_used: nextUsed,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", id)
    .eq("tickets_remaining", remaining)
    .select("tickets_remaining, total_used")
    .maybeSingle();
  if (updErr || !updated) {
    console.error("[genai-entitlements] consume 3d update:", updErr);
    return {
      ok: false,
      error: "チケット消費の競合が発生しました。再試行してください。",
      status: 409,
    };
  }
  const entitlements = await getGenAiEntitlementsForUser(id);
  return { ok: true, entitlements };
}

export async function add3dGenerateTicket(
  userId: string,
  count = 1,
  stripeCustomerId?: string | null
): Promise<ApplyEntitlementResult> {
  const id = String(userId || "").trim();
  if (!id) return { ok: false, error: "user_id が必要です", status: 400 };
  const supabase = getServiceSupabase();
  const { data: existing } = await supabase
    .from("gen_ai_3d_tickets")
    .select("tickets_remaining, total_purchased, total_used, stripe_customer_id")
    .eq("user_id", id)
    .maybeSingle();
  const add = Math.max(1, count);
  const remaining = Math.max(0, Number(existing?.tickets_remaining) || 0) + add;
  const total = Math.max(0, Number(existing?.total_purchased) || 0) + add;
  const { error } = await supabase.from("gen_ai_3d_tickets").upsert(
    {
      user_id: id,
      tickets_remaining: remaining,
      total_purchased: total,
      stripe_customer_id: stripeCustomerId || existing?.stripe_customer_id || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) {
    console.error("[genai-entitlements] add 3d ticket failed:", error);
    return { ok: false, error: error.message, status: 500 };
  }
  const entitlements = await getGenAiEntitlementsForUser(id);
  return { ok: true, entitlements };
}

export async function sync2dLiveFromStripeSubscription(sub: {
  id: string;
  status: string;
  customer: string | { id?: string } | null;
  metadata?: Record<string, string> | null;
  cancel_at_period_end?: boolean;
  current_period_end?: number;
  canceled_at?: number | null;
  items?: { data?: Array<{ price?: { id?: string } | null }> };
}): Promise<ApplyEntitlementResult | null> {
  const meta = (sub.metadata || {}) as Record<string, string | undefined>;
  const userId = String(meta.user_id || "").trim();
  if (!userId) return null;

  const orderType = String(meta.order_type || "");
  const planFromMeta = parseGenAiCheckoutPlanIdFromMetadata(meta);
  const stripePriceId = sub.items?.data?.[0]?.price?.id ?? null;
  const planFromPrice = stripePriceId
    ? resolveGenAiCheckoutPlanIdFromStripePrice(stripePriceId)
    : null;
  const is2dLive =
    orderType === "genai_2d_live_subscription" ||
    planFromMeta === "genai_2d_live_300" ||
    planFromPrice === "genai_2d_live_300";
  if (!is2dLive) return null;

  const subscriptionStatus = String(sub.status || "");
  const cancelAtPeriodEnd = Boolean(sub.cancel_at_period_end);
  const currentPeriodEnd = sub.current_period_end
    ? new Date(sub.current_period_end * 1000).toISOString()
    : null;
  const canceledAt = sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null;
  const stripeCustomerId =
    typeof sub.customer === "string" ? sub.customer : String(sub.customer?.id || "") || null;

  if (IMMEDIATE_INACTIVE.has(subscriptionStatus)) {
    return deactivate2dLiveEntitlement(userId, {
      stripeCustomerId,
      subscriptionStatus,
      canceledAt,
      stripeSubscriptionId: sub.id,
    });
  }

  const preview: Record<string, unknown> = {
    subscription_status: subscriptionStatus,
    status: "active",
    cancel_at_period_end: cancelAtPeriodEnd,
    current_period_end: currentPeriodEnd,
  };
  if (!hasActive2dLiveEntitlement(preview)) {
    return deactivate2dLiveEntitlement(userId, {
      stripeCustomerId,
      subscriptionStatus,
      cancelAtPeriodEnd,
      currentPeriodEnd,
      canceledAt,
      stripeSubscriptionId: sub.id,
    });
  }

  return upsert2dLiveEntitlement({
    userId,
    stripeCustomerId,
    stripeSubscriptionId: sub.id,
    stripePriceId,
    subscriptionStatus,
    cancelAtPeriodEnd,
    currentPeriodEnd,
    canceledAt,
    status: "active",
  });
}

/** Stripe Checkout Session 単位で冪等に 3D チケットを付与 */
export async function add3dGenerateTicketFromCheckoutSession(input: {
  userId: string;
  stripeSessionId: string;
  planId: GenAiCheckoutPlanId;
  ticketsAdded?: number;
  stripeCustomerId?: string | null;
}): Promise<ApplyEntitlementResult> {
  const userId = String(input.userId || "").trim();
  const stripeSessionId = String(input.stripeSessionId || "").trim();
  const planId = input.planId;
  const ticketsAdded = Math.max(1, input.ticketsAdded ?? 1);

  if (!userId) return { ok: false, error: "user_id が必要です", status: 400 };
  if (!stripeSessionId) {
    return { ok: false, error: "stripe_session_id が必要です", status: 400 };
  }
  if (planId !== "genai_3d_generate_500") {
    return { ok: false, error: "3D生成チケット対象外のプランです", status: 400 };
  }

  const supabase = getServiceSupabase();

  const { data: existingGrant, error: readErr } = await supabase
    .from("gen_ai_3d_ticket_grants")
    .select("id")
    .eq("stripe_session_id", stripeSessionId)
    .maybeSingle();
  if (readErr) {
    console.error("[genai-entitlements] grant read:", readErr);
    return { ok: false, error: readErr.message, status: 500 };
  }
  if (existingGrant?.id) {
    const entitlements = await getGenAiEntitlementsForUser(userId);
    return { ok: true, entitlements, alreadyGranted: true };
  }

  const { data: grantRow, error: grantErr } = await supabase
    .from("gen_ai_3d_ticket_grants")
    .insert({
      user_id: userId,
      stripe_session_id: stripeSessionId,
      plan_id: planId,
      tickets_added: ticketsAdded,
    })
    .select("id")
    .maybeSingle();

  if (grantErr) {
    if (grantErr.code === "23505") {
      const entitlements = await getGenAiEntitlementsForUser(userId);
      return { ok: true, entitlements, alreadyGranted: true };
    }
    console.error("[genai-entitlements] grant insert:", grantErr);
    return { ok: false, error: grantErr.message, status: 500 };
  }
  if (!grantRow?.id) {
    const entitlements = await getGenAiEntitlementsForUser(userId);
    return { ok: true, entitlements, alreadyGranted: true };
  }

  const ticketResult = await add3dGenerateTicket(userId, ticketsAdded, input.stripeCustomerId);
  if (!ticketResult.ok) {
    const { error: rollbackErr } = await supabase
      .from("gen_ai_3d_ticket_grants")
      .delete()
      .eq("id", grantRow.id);
    if (rollbackErr) {
      console.error("[genai-entitlements] grant rollback failed:", rollbackErr);
    }
    return ticketResult;
  }
  return ticketResult;
}

export async function apply3dTicketFromCheckout(input: {
  userId: string;
  planId: GenAiCheckoutPlanId;
  stripeSessionId: string;
  stripeCustomerId?: string | null;
}): Promise<ApplyEntitlementResult | null> {
  if (input.planId !== "genai_3d_generate_500") return null;
  return add3dGenerateTicketFromCheckoutSession({
    userId: input.userId,
    stripeSessionId: input.stripeSessionId,
    planId: input.planId,
    ticketsAdded: 1,
    stripeCustomerId: input.stripeCustomerId,
  });
}

export async function getStripeCustomerIdFromEntitlements(
  userId: string
): Promise<string | null> {
  const supabase = getServiceSupabase();
  const [entRes, ticketRes] = await Promise.all([
    supabase
      .from("gen_ai_entitlements")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .not("stripe_customer_id", "is", null)
      .limit(5),
    supabase
      .from("gen_ai_3d_tickets")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  for (const row of entRes.data || []) {
    const cid = String(row.stripe_customer_id || "").trim();
    if (cid) return cid;
  }
  const fromTickets = String(ticketRes.data?.stripe_customer_id || "").trim();
  return fromTickets || null;
}
