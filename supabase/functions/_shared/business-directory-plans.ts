/**
 * Business Directory — plan codes · Stripe price mapping · effective plan guard
 */
export const BD_PLAN_CODES = ["free", "standard", "pro"] as const;
export type BusinessDirectoryPlanCode = (typeof BD_PLAN_CODES)[number];

export const BD_STRIPE_ORDER_TYPE = "business_directory_subscription";

const IMMEDIATE_FREE_STATUSES = new Set(["unpaid", "incomplete_expired"]);

export function resolveStripePriceIdForPlan(planCode: string): string {
  const code = String(planCode || "").trim().toLowerCase();
  if (code === "standard") {
    return String(Deno.env.get("BUSINESS_DIRECTORY_STRIPE_PRICE_STANDARD") ?? "").trim();
  }
  if (code === "pro") {
    return String(Deno.env.get("BUSINESS_DIRECTORY_STRIPE_PRICE_PRO") ?? "").trim();
  }
  return "";
}

export function resolvePlanFromStripePriceId(priceId: string): BusinessDirectoryPlanCode | null {
  const id = String(priceId || "").trim();
  if (!id) return null;
  const standard = resolveStripePriceIdForPlan("standard");
  const pro = resolveStripePriceIdForPlan("pro");
  if (standard && id === standard) return "standard";
  if (pro && id === pro) return "pro";
  return null;
}

export function isPaidPlanCode(planCode: string): boolean {
  const c = String(planCode || "").toLowerCase();
  return c === "standard" || c === "pro";
}

export function isPeriodEndActive(periodEnd: string | null | undefined): boolean {
  if (!periodEnd) return false;
  const t = new Date(periodEnd).getTime();
  return Number.isFinite(t) && t > Date.now();
}

/** Whether Stripe subscription grants paid plan access */
export function hasPaidBusinessDirectoryAccess(
  row: Record<string, unknown> | null | undefined,
): boolean {
  if (!row) return false;

  const subscriptionStatus = String(row.subscription_status ?? "").trim();
  if (IMMEDIATE_FREE_STATUSES.has(subscriptionStatus)) return false;

  const planCode = String(row.plan_code || "free").toLowerCase();
  if (!isPaidPlanCode(planCode)) return false;

  if (subscriptionStatus === "active" || subscriptionStatus === "trialing") {
    const periodEnd = row.current_period_end as string | null | undefined;
    if (!periodEnd) return true;
    return isPeriodEndActive(periodEnd);
  }

  const periodActive = isPeriodEndActive(row.current_period_end as string | null | undefined);
  const cancelAtPeriodEnd = Boolean(row.cancel_at_period_end);

  if (periodActive && (cancelAtPeriodEnd || subscriptionStatus === "canceled")) {
    return true;
  }

  // Grace: past_due keeps plan until period end (MVP safe side — public maintained)
  if (periodActive && (subscriptionStatus === "past_due" || subscriptionStatus === "unpaid")) {
    return true;
  }

  return false;
}

/** Plan used for feature gating (photos, TLV, SNS, public sort) */
export function resolveEffectivePlanCode(
  row: Record<string, unknown> | null | undefined,
): BusinessDirectoryPlanCode {
  if (!row) return "free";
  if (hasPaidBusinessDirectoryAccess(row)) {
    const code = String(row.plan_code || "free").toLowerCase();
    if (code === "standard" || code === "pro") return code;
  }
  return "free";
}

export function resolveSubscriptionWarning(
  row: Record<string, unknown> | null | undefined,
): string | null {
  if (!row) return null;
  const status = String(row.subscription_status ?? "").trim();
  if (status === "past_due" || status === "unpaid") {
    return "お支払いに問題があります。Billing Portal から支払い方法を更新してください。";
  }
  if (Boolean(row.cancel_at_period_end) && isPeriodEndActive(row.current_period_end as string)) {
    const end = row.current_period_end as string;
    try {
      const label = new Date(end).toLocaleDateString("ja-JP");
      return `解約予約中です。${label} まで現行プランが利用できます。`;
    } catch {
      return "解約予約中です。期間終了まで現行プランが利用できます。";
    }
  }
  return null;
}

export function stripePeriodEndIso(sub: { current_period_end?: number | null }): string | null {
  const sec = sub.current_period_end;
  if (sec == null || !Number.isFinite(sec)) return null;
  return new Date(sec * 1000).toISOString();
}

export function primarySubscriptionPriceId(
  sub: { items?: { data?: Array<{ price?: { id?: string } | string }> } },
): string | null {
  const item = sub.items?.data?.[0];
  if (!item) return null;
  const price = item.price;
  if (typeof price === "string") return price;
  return price?.id ? String(price.id) : null;
}
