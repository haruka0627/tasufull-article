import {
  getPricingFixedAmount,
  getPricingSku,
  isPricingEnabled,
  resolveStripePriceEnvKey,
} from "./generated/tasful-pricing-config.ts";

export type GenAiPlanId = "genai_basic_300" | "genai_pro_980";

export type GenAiPlanLimits = {
  plan: string;
  label: string;
  dailyTextLimit: number;
  dailyVoiceLimit: number;
  dailyImageLimit: number;
  amountJpy: number;
};

const GENAI_SKU_BY_PLAN: Record<GenAiPlanId, string> = {
  genai_basic_300: "tasful_ai_lite",
  genai_pro_980: "tasful_ai_pro",
};

export const GENAI_MAX_PLACEHOLDER_SKU = "tasful_ai_max_placeholder";

const LEGACY_LABELS: Record<GenAiPlanId, string> = {
  genai_basic_300: "生成AIスタンダード",
  genai_pro_980: "生成AIプロ",
};

function dailyLimitFromSku(skuId: string, featureKey: string): number {
  const row = getPricingSku(skuId);
  const v = row?.limits?.daily?.[featureKey];
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function buildGenAiPlanEntry(planId: GenAiPlanId): GenAiPlanLimits & { id: GenAiPlanId } {
  const skuId = GENAI_SKU_BY_PLAN[planId];
  const planCode = planId === "genai_basic_300" ? "basic_300" : "pro_980";
  const amount = getPricingFixedAmount(skuId);
  return {
    id: planId,
    plan: planCode,
    label: LEGACY_LABELS[planId],
    dailyTextLimit: dailyLimitFromSku(skuId, "text_turn"),
    dailyVoiceLimit: dailyLimitFromSku(skuId, "voice_turn"),
    dailyImageLimit: dailyLimitFromSku(skuId, "image_turn"),
    amountJpy: amount ?? 0,
  };
}

export const GENAI_FREE_PLAN: GenAiPlanLimits = {
  plan: "free",
  label: "無料枠",
  dailyTextLimit: 5,
  dailyVoiceLimit: 5,
  dailyImageLimit: 3,
  amountJpy: 0,
};

export const GENAI_PLANS: Record<GenAiPlanId, GenAiPlanLimits & { id: GenAiPlanId }> = {
  genai_basic_300: buildGenAiPlanEntry("genai_basic_300"),
  genai_pro_980: buildGenAiPlanEntry("genai_pro_980"),
};

/** Stripe Dashboard 商品ID（参考・metadata用） */
export const GENAI_STRIPE_PRODUCT_IDS: Record<GenAiPlanId, string> = {
  genai_basic_300: "prod_TASFUL_GENAI_BASIC_300",
  genai_pro_980: "prod_TASFUL_GENAI_PRO_980",
};

export function getGenAiMaxPlaceholder() {
  const row = getPricingSku(GENAI_MAX_PLACEHOLDER_SKU);
  return {
    sku: GENAI_MAX_PLACEHOLDER_SKU,
    label: row?.label || "TASFUL AI Max（未実装）",
    amountJpy: getPricingFixedAmount(GENAI_MAX_PLACEHOLDER_SKU) ?? 0,
    enabled: isPricingEnabled(GENAI_MAX_PLACEHOLDER_SKU),
    status: row?.status || "draft",
  };
}

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
  const skuId = GENAI_SKU_BY_PLAN[planId];
  const envKey = resolveStripePriceEnvKey(skuId);
  if (!envKey) return "";
  return String(Deno.env.get(envKey) || "").trim();
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
