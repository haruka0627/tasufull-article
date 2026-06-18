export type GenAiPlanId = "genai_basic_300" | "genai_pro_980";

export type GenAiPlanLimits = {
  plan: string;
  label: string;
  dailyTextLimit: number;
  dailyVoiceLimit: number;
  dailyImageLimit: number;
  amountJpy: number;
};

export const GENAI_FREE_PLAN: GenAiPlanLimits = {
  plan: "free",
  label: "無料枠",
  dailyTextLimit: 5,
  dailyVoiceLimit: 5,
  dailyImageLimit: 3,
  amountJpy: 0,
};

export const GENAI_PLANS: Record<GenAiPlanId, GenAiPlanLimits & { id: GenAiPlanId }> = {
  genai_basic_300: {
    id: "genai_basic_300",
    plan: "basic_300",
    label: "生成AIスタンダード",
    dailyTextLimit: 30,
    dailyVoiceLimit: 30,
    dailyImageLimit: 10,
    amountJpy: 300,
  },
  genai_pro_980: {
    id: "genai_pro_980",
    plan: "pro_980",
    label: "生成AIプロ",
    dailyTextLimit: 100,
    dailyVoiceLimit: 100,
    dailyImageLimit: 30,
    amountJpy: 980,
  },
};

/** Stripe Dashboard 商品ID（参考・metadata用） */
export const GENAI_STRIPE_PRODUCT_IDS: Record<GenAiPlanId, string> = {
  genai_basic_300: "prod_TASFUL_GENAI_BASIC_300",
  genai_pro_980: "prod_TASFUL_GENAI_PRO_980",
};

export function resolveGenAiPlanId(raw: unknown): GenAiPlanId | null {
  const id = String(raw || "").trim();
  if (id in GENAI_PLANS) return id as GenAiPlanId;
  return null;
}

export function parseGenAiPlanIdFromMetadata(
  meta: Record<string, string | undefined>
): GenAiPlanId | null {
  return resolveGenAiPlanId(meta.genai_plan || meta.genaiPlan);
}

export function limitsFromPlanCode(planCode: string): GenAiPlanLimits {
  const entry = Object.values(GENAI_PLANS).find((p) => p.plan === planCode);
  if (entry) return entry;
  if (planCode === "free") return { ...GENAI_FREE_PLAN };
  return { ...GENAI_FREE_PLAN };
}

export function resolveStripePriceId(planId: GenAiPlanId): string {
  if (planId === "genai_basic_300") {
    return String(Deno.env.get("STRIPE_GENAI_PRICE_BASIC_300") || "").trim();
  }
  return String(Deno.env.get("STRIPE_GENAI_PRICE_PRO_980") || "").trim();
}

export function resolveGenAiPlanIdFromStripePrice(priceId: string): GenAiPlanId | null {
  const id = String(priceId || "").trim();
  if (!id) return null;
  const basic = resolveStripePriceId("genai_basic_300");
  const pro = resolveStripePriceId("genai_pro_980");
  if (basic && id === basic) return "genai_basic_300";
  if (pro && id === pro) return "genai_pro_980";
  return null;
}
