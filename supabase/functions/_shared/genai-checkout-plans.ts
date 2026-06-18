import { GENAI_PLANS, type GenAiPlanId } from "./genai-plans.ts";

export type GenAiAddonPlanId = "genai_2d_live_300" | "genai_3d_generate_500";

export type GenAiCheckoutPlanId = GenAiPlanId | GenAiAddonPlanId;

export type GenAiCheckoutMode = "subscription" | "payment";

export type GenAiCheckoutPlanDef = {
  id: GenAiCheckoutPlanId;
  label: string;
  amountJpy: number;
  mode: GenAiCheckoutMode;
  orderType: string;
  lookupKey: string;
  stripeProductRef: string;
};

export const GENAI_ADDON_PLANS: Record<GenAiAddonPlanId, GenAiCheckoutPlanDef> = {
  genai_2d_live_300: {
    id: "genai_2d_live_300",
    label: "TASFUL AI 2D Live",
    amountJpy: 300,
    mode: "subscription",
    orderType: "genai_2d_live_subscription",
    lookupKey: "tasful_genai_2d_live_300",
    stripeProductRef: "prod_TASFUL_GENAI_2D_LIVE_300",
  },
  genai_3d_generate_500: {
    id: "genai_3d_generate_500",
    label: "TASFUL AI 3D Generate",
    amountJpy: 500,
    mode: "payment",
    orderType: "genai_3d_ticket",
    lookupKey: "tasful_genai_3d_generate_500",
    stripeProductRef: "prod_TASFUL_GENAI_3D_GENERATE_500",
  },
};

export const ENTITLEMENT_2D_LIVE = "2d_live_unlimited";

export function resolveGenAiCheckoutPlanId(raw: unknown): GenAiCheckoutPlanId | null {
  const id = String(raw || "").trim();
  if (id in GENAI_PLANS) return id as GenAiPlanId;
  if (id in GENAI_ADDON_PLANS) return id as GenAiAddonPlanId;
  return null;
}

export function parseGenAiCheckoutPlanIdFromMetadata(
  meta: Record<string, string | undefined>
): GenAiCheckoutPlanId | null {
  return resolveGenAiCheckoutPlanId(meta.genai_plan || meta.genaiPlan);
}

export function getCheckoutPlanDef(planId: GenAiCheckoutPlanId): GenAiCheckoutPlanDef {
  if (planId in GENAI_ADDON_PLANS) {
    return GENAI_ADDON_PLANS[planId as GenAiAddonPlanId];
  }
  const sub = GENAI_PLANS[planId as GenAiPlanId];
  return {
    id: planId,
    label: sub.label,
    amountJpy: sub.amountJpy,
    mode: "subscription",
    orderType: "genai_subscription",
    lookupKey: planId === "genai_basic_300" ? "tasful_genai_basic_300" : "tasful_genai_pro_980",
    stripeProductRef:
      planId === "genai_basic_300" ? "prod_TASFUL_GENAI_BASIC_300" : "prod_TASFUL_GENAI_PRO_980",
  };
}

export function resolveStripePriceIdForCheckout(planId: GenAiCheckoutPlanId): string {
  if (planId === "genai_basic_300") {
    return String(Deno.env.get("STRIPE_GENAI_PRICE_BASIC_300") || "").trim();
  }
  if (planId === "genai_pro_980") {
    return String(Deno.env.get("STRIPE_GENAI_PRICE_PRO_980") || "").trim();
  }
  if (planId === "genai_2d_live_300") {
    return String(Deno.env.get("STRIPE_GENAI_PRICE_2D_LIVE_300") || "").trim();
  }
  return String(Deno.env.get("STRIPE_GENAI_PRICE_3D_GENERATE_500") || "").trim();
}

export function resolveGenAiCheckoutPlanIdFromStripePrice(
  priceId: string
): GenAiCheckoutPlanId | null {
  const id = String(priceId || "").trim();
  if (!id) return null;
  const ids: GenAiCheckoutPlanId[] = [
    "genai_basic_300",
    "genai_pro_980",
    "genai_2d_live_300",
    "genai_3d_generate_500",
  ];
  for (const planId of ids) {
    const configured = resolveStripePriceIdForCheckout(planId);
    if (configured && configured === id) return planId;
  }
  return null;
}

export function isGenAiSubscriptionOrderType(orderType: string): boolean {
  return orderType === "genai_subscription" || orderType === "genai_2d_live_subscription";
}
