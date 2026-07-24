import {
  calcPricingPercentFee,
  formatPricingYen,
  getPricingFixedAmount,
  getPricingSku,
} from "./generated/tasful-pricing-config.ts";

export type FeaturedPlanId =
  | "featured_7days"
  | "featured_30days"
  | "pr_30days";

export type FeaturedPlanConfig = {
  id: FeaturedPlanId;
  label: string;
  days: number;
  amountJpy: number;
  priority: number;
  kind: "featured" | "pr";
};

const BOOST_PLAN_SKU: Record<FeaturedPlanId, string> = {
  featured_7days: "platform_boost_featured_7d",
  featured_30days: "platform_boost_featured_30d",
  pr_30days: "platform_boost_pr_30d",
};

function resolveBoostPriority(row: ReturnType<typeof getPricingSku>, planId: FeaturedPlanId): number {
  const features = Array.isArray(row?.features) ? row.features : [];
  const fromFeature = features
    .map((f) => String(f || ""))
    .find((f) => /^priority_\d+$/.test(f));
  if (fromFeature) {
    const n = Number(fromFeature.replace("priority_", ""));
    if (Number.isFinite(n)) return n;
  }
  if (planId === "featured_7days") return 1;
  if (planId === "featured_30days") return 2;
  return 3;
}

function resolveBoostKind(row: ReturnType<typeof getPricingSku>): "featured" | "pr" {
  const features = Array.isArray(row?.features) ? row.features : [];
  return features.includes("pr") ? "pr" : "featured";
}

function buildFeaturedPlanFromCatalog(planId: FeaturedPlanId): FeaturedPlanConfig {
  const skuId = BOOST_PLAN_SKU[planId];
  const sku = getPricingSku(skuId);
  const amountJpy = getPricingFixedAmount(skuId) ?? 0;
  const days = Number(sku?.durationDays) || 0;
  return {
    id: planId,
    label: String(sku?.label || planId),
    days,
    amountJpy,
    priority: resolveBoostPriority(sku, planId),
    kind: resolveBoostKind(sku),
  };
}

export const FEATURED_PLANS: Record<FeaturedPlanId, FeaturedPlanConfig> = {
  featured_7days: buildFeaturedPlanFromCatalog("featured_7days"),
  featured_30days: buildFeaturedPlanFromCatalog("featured_30days"),
  pr_30days: buildFeaturedPlanFromCatalog("pr_30days"),
};

const LEGACY_PLAN_MAP: Record<string, FeaturedPlanId> = {
  "7days": "featured_7days",
  "30days": "featured_30days",
};

export function resolveFeaturedPlanId(raw: string | null | undefined): FeaturedPlanId | null {
  const key = String(raw || "").trim();
  if (!key) return null;
  if (key in FEATURED_PLANS) return key as FeaturedPlanId;
  if (key in LEGACY_PLAN_MAP) return LEGACY_PLAN_MAP[key];
  return null;
}

export function buildFeaturedUntilIso(days: number): string {
  const until = new Date();
  until.setDate(until.getDate() + days);
  return until.toISOString();
}

export function buildListingFeaturedPatch(planId: FeaturedPlanId) {
  const plan = FEATURED_PLANS[planId];
  return {
    is_featured: true,
    featured_plan: plan.id,
    featured_until: buildFeaturedUntilIso(plan.days),
    featured_priority: plan.priority,
  };
}

/** Connect 成約手数料（catalog SKU: platform_match_connect_rate）— Edge 参照用 */
export function calcPlatformConnectFee(gmvYen: number): number | null {
  return calcPricingPercentFee("platform_match_connect_rate", gmvYen);
}

/** 表示用（Edge ログ等） */
export function formatFeaturedPlanPrice(planId: FeaturedPlanId): string {
  const plan = FEATURED_PLANS[planId];
  return formatPricingYen(plan?.amountJpy ?? 0);
}
