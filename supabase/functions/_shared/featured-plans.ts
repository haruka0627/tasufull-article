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

export const FEATURED_PLANS: Record<FeaturedPlanId, FeaturedPlanConfig> = {
  featured_7days: {
    id: "featured_7days",
    label: "上位掲載 7日",
    days: 7,
    amountJpy: 980,
    priority: 1,
    kind: "featured",
  },
  featured_30days: {
    id: "featured_30days",
    label: "上位掲載 30日",
    days: 30,
    amountJpy: 2980,
    priority: 2,
    kind: "featured",
  },
  pr_30days: {
    id: "pr_30days",
    label: "PR掲載 30日",
    days: 30,
    amountJpy: 4980,
    priority: 3,
    kind: "pr",
  },
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
