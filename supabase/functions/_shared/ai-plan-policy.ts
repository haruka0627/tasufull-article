/**
 * TASFUL AI — Plan Policy SSOT（Edge）
 * 正本ロジックは scripts/lib/ai-plan-policy.mjs と同契約。料金は含まない。
 */

export const PLAN_POLICY_VERSION = 1;

export const CANONICAL_PLAN_IDS = [
  "anonymous",
  "free",
  "lite",
  "pro",
  "max",
] as const;

export type CanonicalPlanId = (typeof CANONICAL_PLAN_IDS)[number];

export const PLAN_ID_ALIASES: Record<string, CanonicalPlanId> = {
  anonymous: "anonymous",
  free: "free",
  trial: "free",
  lite: "lite",
  light: "lite",
  basic_300: "lite",
  genai_basic_300: "lite",
  pro: "pro",
  standard: "pro",
  pro_980: "pro",
  genai_pro_980: "pro",
  max: "max",
  premium: "max",
  max_placeholder: "max",
  tasful_ai_lite: "lite",
  tasful_ai_pro: "pro",
  tasful_ai_max_placeholder: "max",
};

export type PlanStatus = "active" | "inactive" | "suspended" | "expired";
export type LimitAction = "warn" | "lightweight_only" | "deny" | "reset_wait" | "ok";

export type PlanPolicy = {
  planId: CanonicalPlanId;
  displayName: string;
  status: PlanStatus;
  dailyTextLimit: number;
  monthlyTextLimit: number | null;
  allowedWorkspaceModels: string[];
  allowedFeatures: string[];
  autoModeAllowed: boolean;
  manualModeAllowed: boolean;
  highCostModelAllowed: boolean;
  imageAllowed: boolean;
  ocrAllowed: boolean;
  voiceAllowed: boolean;
  maxInputSize: number;
  maxOutputSize: number;
  nearLimitAction: LimitAction;
  limitAction: LimitAction;
  resetPolicy: string;
  nearLimitRatio: number;
};

const PLAN_POLICIES: Record<CanonicalPlanId, PlanPolicy> = {
  anonymous: {
    planId: "anonymous",
    displayName: "未ログイン",
    status: "active",
    dailyTextLimit: 5,
    monthlyTextLimit: null,
    allowedWorkspaceModels: ["gemini-flash"],
    allowedFeatures: ["workspace_chat", "gemini_chat"],
    autoModeAllowed: true,
    manualModeAllowed: true,
    highCostModelAllowed: false,
    imageAllowed: false,
    ocrAllowed: false,
    voiceAllowed: false,
    maxInputSize: 2000,
    maxOutputSize: 2048,
    nearLimitAction: "warn",
    limitAction: "deny",
    resetPolicy: "daily_jst",
    nearLimitRatio: 0.9,
  },
  free: {
    planId: "free",
    displayName: "無料枠",
    status: "active",
    dailyTextLimit: 5,
    monthlyTextLimit: null,
    allowedWorkspaceModels: ["gemini-flash"],
    allowedFeatures: ["workspace_chat", "gemini_chat", "ocr"],
    autoModeAllowed: true,
    manualModeAllowed: true,
    highCostModelAllowed: false,
    imageAllowed: false,
    ocrAllowed: true,
    voiceAllowed: false,
    maxInputSize: 2000,
    maxOutputSize: 4096,
    nearLimitAction: "warn",
    limitAction: "deny",
    resetPolicy: "daily_jst",
    nearLimitRatio: 0.9,
  },
  lite: {
    planId: "lite",
    displayName: "Lite",
    status: "active",
    dailyTextLimit: 30,
    monthlyTextLimit: null,
    allowedWorkspaceModels: ["gemini-flash"],
    allowedFeatures: ["workspace_chat", "gemini_chat", "ocr"],
    autoModeAllowed: true,
    manualModeAllowed: true,
    highCostModelAllowed: false,
    imageAllowed: false,
    ocrAllowed: true,
    voiceAllowed: false,
    maxInputSize: 2000,
    maxOutputSize: 4096,
    nearLimitAction: "warn",
    limitAction: "deny",
    resetPolicy: "daily_jst",
    nearLimitRatio: 0.9,
  },
  pro: {
    planId: "pro",
    displayName: "Pro",
    status: "active",
    dailyTextLimit: 100,
    monthlyTextLimit: null,
    allowedWorkspaceModels: ["gemini-flash", "gpt", "claude"],
    allowedFeatures: [
      "workspace_chat",
      "gemini_chat",
      "openai_chat",
      "claude_chat",
      "ocr",
    ],
    autoModeAllowed: true,
    manualModeAllowed: true,
    highCostModelAllowed: true,
    imageAllowed: false,
    ocrAllowed: true,
    voiceAllowed: false,
    maxInputSize: 2000,
    maxOutputSize: 8192,
    nearLimitAction: "warn",
    limitAction: "deny",
    resetPolicy: "daily_jst",
    nearLimitRatio: 0.9,
  },
  max: {
    planId: "max",
    displayName: "Max（準備中）",
    status: "inactive",
    dailyTextLimit: 100,
    monthlyTextLimit: null,
    allowedWorkspaceModels: ["gemini-flash", "gpt", "claude"],
    allowedFeatures: [
      "workspace_chat",
      "gemini_chat",
      "openai_chat",
      "claude_chat",
      "ocr",
    ],
    autoModeAllowed: true,
    manualModeAllowed: true,
    highCostModelAllowed: true,
    imageAllowed: false,
    ocrAllowed: true,
    voiceAllowed: false,
    maxInputSize: 2000,
    maxOutputSize: 8192,
    nearLimitAction: "warn",
    limitAction: "deny",
    resetPolicy: "daily_jst",
    nearLimitRatio: 0.9,
  },
};

const EDGE_TO_FEATURE: Record<string, string> = {
  "gemini-chat": "gemini_chat",
  "openai-chat": "openai_chat",
  "claude-chat": "claude_chat",
  "gemini-ocr": "ocr",
};

export function normalizePlanId(raw: unknown): CanonicalPlanId {
  const id = String(raw || "")
    .trim()
    .toLowerCase();
  if (!id) return "free";
  if (PLAN_ID_ALIASES[id]) return PLAN_ID_ALIASES[id];
  if ((CANONICAL_PLAN_IDS as readonly string[]).includes(id)) {
    return id as CanonicalPlanId;
  }
  return "free";
}

export function getPlanPolicy(
  planId: unknown,
  opts: { statusOverride?: PlanStatus } = {}
): PlanPolicy {
  const canonical = normalizePlanId(planId);
  const base = PLAN_POLICIES[canonical] || PLAN_POLICIES.free;
  return {
    ...base,
    status: opts.statusOverride || base.status,
    allowedWorkspaceModels: [...base.allowedWorkspaceModels],
    allowedFeatures: [...base.allowedFeatures],
  };
}

export function getAnonymousPolicy(): PlanPolicy {
  return getPlanPolicy("anonymous");
}

export function resolveStatusFromSubscription(
  row: Record<string, unknown> | null | undefined
): PlanStatus {
  if (!row) return "active";
  const sub = String(row.subscription_status ?? row.status ?? "")
    .trim()
    .toLowerCase();
  if (sub === "suspended" || sub === "paused") return "suspended";
  if (sub === "canceled" || sub === "cancelled" || sub === "expired") {
    const end = row.current_period_end;
    if (end) {
      const t = new Date(String(end)).getTime();
      if (Number.isFinite(t) && t <= Date.now()) return "expired";
    }
    if (sub === "expired") return "expired";
  }
  if (sub === "unpaid" || sub === "incomplete_expired") return "expired";
  return "active";
}

export function policyFromGenAiPlan(plan: {
  plan?: string;
  label?: string;
  dailyTextLimit?: number;
  status?: string;
  subscriptionStatus?: string | null;
  currentPeriodEnd?: string | null;
} | null): PlanPolicy {
  if (!plan) return getPlanPolicy("free");
  const canonical = normalizePlanId(plan.plan);
  const status = resolveStatusFromSubscription({
    status: plan.status,
    subscription_status: plan.subscriptionStatus,
    current_period_end: plan.currentPeriodEnd,
  });
  const policy = getPlanPolicy(canonical, { statusOverride: status });
  if (Number.isFinite(Number(plan.dailyTextLimit))) {
    policy.dailyTextLimit = Math.max(0, Number(plan.dailyTextLimit));
  }
  if (plan.label) policy.displayName = String(plan.label);
  if (canonical === "max") {
    return {
      ...getPlanPolicy("free"),
      displayName: policy.displayName || "Max（準備中）",
      status: "inactive",
    };
  }
  return policy;
}

export function isPlanExecutable(policy: PlanPolicy | null | undefined): boolean {
  if (!policy) return false;
  if (policy.status === "suspended" || policy.status === "expired") return false;
  if (policy.status === "inactive") return false;
  return true;
}

export function isModelAllowedForPolicy(
  policy: PlanPolicy,
  workspaceModelId: string
): boolean {
  if (!isPlanExecutable(policy)) return false;
  const id = String(workspaceModelId || "").trim();
  return policy.allowedWorkspaceModels.includes(id);
}

export function isFeatureAllowedForPolicy(
  policy: PlanPolicy,
  featureKey: string
): boolean {
  if (!isPlanExecutable(policy)) return false;
  const f = String(featureKey || "").trim();
  if (f === "ocr" || f === "ocr_turn" || f === "vision_turn") {
    return Boolean(policy.ocrAllowed) && policy.allowedFeatures.includes("ocr");
  }
  if (f === "text_turn" || f === "workspace_chat") {
    return policy.allowedFeatures.includes("workspace_chat");
  }
  return policy.allowedFeatures.includes(f);
}

export function featureForEdge(edgeName: string): string | null {
  return EDGE_TO_FEATURE[String(edgeName || "").trim()] || null;
}

export function listAllowedModels(policy: PlanPolicy): string[] {
  if (!isPlanExecutable(policy)) return [];
  return [...policy.allowedWorkspaceModels];
}

export function listFallbackModels(policy: PlanPolicy, excludeId: string): string[] {
  return listAllowedModels(policy).filter((id) => id !== excludeId);
}

export function getDefaultModelForPolicy(policy: PlanPolicy): string {
  const list = listAllowedModels(policy);
  return list[0] || "gemini-flash";
}

export function buildPublicPlanSummary(
  policy: PlanPolicy,
  usage: { used?: number | null; remaining?: number | null } = {}
) {
  const executable = isPlanExecutable(policy);
  const limit = Number(policy.dailyTextLimit);
  const used = usage.used != null ? Math.max(0, Number(usage.used) || 0) : null;
  const remaining =
    usage.remaining != null
      ? Math.max(0, Number(usage.remaining) || 0)
      : used != null && Number.isFinite(limit)
        ? Math.max(0, limit - used)
        : null;
  let canExecute = executable && (remaining == null ? true : remaining > 0);
  if (policy.limitAction === "deny" && remaining === 0) canExecute = false;

  return {
    planId: policy.planId,
    displayName: policy.displayName,
    status: policy.status,
    allowedModels: listAllowedModels(policy),
    allowedFeatures: [...policy.allowedFeatures],
    dailyTextLimit: Number.isFinite(limit) ? limit : null,
    usageLimit: Number.isFinite(limit) ? limit : null,
    remaining,
    used,
    canExecute,
    resetPolicy: policy.resetPolicy,
    nearLimitAction: policy.nearLimitAction,
    limitAction: policy.limitAction,
    autoModeAllowed: Boolean(policy.autoModeAllowed),
    manualModeAllowed: Boolean(policy.manualModeAllowed),
    highCostModelAllowed: Boolean(policy.highCostModelAllowed),
    ocrAllowed: Boolean(policy.ocrAllowed),
    imageAllowed: Boolean(policy.imageAllowed),
    voiceAllowed: Boolean(policy.voiceAllowed),
    nearLimitRatio: policy.nearLimitRatio ?? 0.9,
  };
}

export function evaluateLimitAction(
  policy: PlanPolicy,
  usageRatio: number
): LimitAction {
  if (!isPlanExecutable(policy)) return "deny";
  if (!Number.isFinite(usageRatio)) return "deny";
  if (usageRatio >= 1) return (policy.limitAction || "deny") as LimitAction;
  const near = policy.nearLimitRatio ?? 0.9;
  if (usageRatio >= near) return (policy.nearLimitAction || "warn") as LimitAction;
  return "ok";
}
