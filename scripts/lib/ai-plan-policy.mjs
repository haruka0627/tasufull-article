/**
 * TASFUL AI — Plan Policy SSOT（料金は含まない · Draft）
 * Browser / Node / Edge 同契約。クライアント申告の plan_id は権限に使わない。
 */

/** @typedef {"active"|"inactive"|"suspended"|"expired"} PlanStatus */
/** @typedef {"warn"|"lightweight_only"|"deny"|"reset_wait"} LimitAction */

export const PLAN_POLICY_VERSION = 1;

/** Canonical internal IDs */
export const CANONICAL_PLAN_IDS = Object.freeze([
  "anonymous",
  "free",
  "lite",
  "pro",
  "max",
]);

/** Alias → canonical (表示名と分離) */
export const PLAN_ID_ALIASES = Object.freeze({
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
});

const WORKSPACE_MODELS = Object.freeze(["gemini-flash", "gpt", "claude"]);

/**
 * @type {Record<string, object>}
 * 料金・Stripe・販売開始は含めない（REL-F-04 / Draft）。
 */
export const PLAN_POLICIES = Object.freeze({
  anonymous: Object.freeze({
    planId: "anonymous",
    displayName: "未ログイン",
    status: "active",
    dailyTextLimit: 5,
    monthlyTextLimit: null,
    allowedWorkspaceModels: Object.freeze(["gemini-flash"]),
    allowedFeatures: Object.freeze(["workspace_chat", "gemini_chat"]),
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
  }),
  free: Object.freeze({
    planId: "free",
    displayName: "無料枠",
    status: "active",
    dailyTextLimit: 5,
    monthlyTextLimit: null,
    allowedWorkspaceModels: Object.freeze(["gemini-flash"]),
    allowedFeatures: Object.freeze([
      "workspace_chat",
      "gemini_chat",
      "ocr",
    ]),
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
  }),
  lite: Object.freeze({
    planId: "lite",
    displayName: "Lite",
    status: "active",
    dailyTextLimit: 30,
    monthlyTextLimit: null,
    allowedWorkspaceModels: Object.freeze(["gemini-flash"]),
    allowedFeatures: Object.freeze([
      "workspace_chat",
      "gemini_chat",
      "ocr",
    ]),
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
  }),
  pro: Object.freeze({
    planId: "pro",
    displayName: "Pro",
    status: "active",
    dailyTextLimit: 100,
    monthlyTextLimit: null,
    allowedWorkspaceModels: Object.freeze(["gemini-flash", "gpt", "claude"]),
    allowedFeatures: Object.freeze([
      "workspace_chat",
      "gemini_chat",
      "openai_chat",
      "claude_chat",
      "ocr",
    ]),
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
  }),
  max: Object.freeze({
    planId: "max",
    displayName: "Max（準備中）",
    status: "inactive",
    dailyTextLimit: 100,
    monthlyTextLimit: null,
    allowedWorkspaceModels: Object.freeze(["gemini-flash", "gpt", "claude"]),
    allowedFeatures: Object.freeze([
      "workspace_chat",
      "gemini_chat",
      "openai_chat",
      "claude_chat",
      "ocr",
    ]),
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
  }),
});

const EDGE_TO_FEATURE = Object.freeze({
  "gemini-chat": "gemini_chat",
  "openai-chat": "openai_chat",
  "claude-chat": "claude_chat",
  "gemini-ocr": "ocr",
  /** Phase 6 PoC — いずれの production plan にも openrouter_chat を付与しない */
  "openrouter-chat": "openrouter_chat",
});

const WORKSPACE_TO_EDGE = Object.freeze({
  "gemini-flash": "gemini-chat",
  gpt: "openai-chat",
  claude: "claude-chat",
});

/**
 * @param {unknown} raw
 * @returns {string} canonical planId (unknown → free)
 */
export function normalizePlanId(raw) {
  const id = String(raw || "")
    .trim()
    .toLowerCase();
  if (!id) return "free";
  if (PLAN_ID_ALIASES[id]) return PLAN_ID_ALIASES[id];
  if (CANONICAL_PLAN_IDS.includes(id)) return id;
  return "free";
}

/**
 * @param {string} planId
 * @param {{ statusOverride?: PlanStatus }} [opts]
 */
export function getPlanPolicy(planId, opts = {}) {
  const canonical = normalizePlanId(planId);
  const base = PLAN_POLICIES[canonical] || PLAN_POLICIES.free;
  const status = opts.statusOverride || base.status;
  return {
    ...base,
    planId: base.planId,
    status,
    allowedWorkspaceModels: [...base.allowedWorkspaceModels],
    allowedFeatures: [...base.allowedFeatures],
  };
}

export function getAnonymousPolicy() {
  return getPlanPolicy("anonymous");
}

/**
 * Subscription row → policy status
 * @param {Record<string, unknown>|null|undefined} row
 */
export function resolveStatusFromSubscription(row) {
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

/**
 * Build policy from GenAI plan payload (server).
 * @param {{ plan?: string, label?: string, dailyTextLimit?: number, status?: string, subscriptionStatus?: string, currentPeriodEnd?: string|null }} plan
 */
export function policyFromGenAiPlan(plan) {
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
  // Max は販売未確定 — subscription があっても inactive として最小権限へ
  if (canonical === "max") {
    return {
      ...getPlanPolicy("free"),
      displayName: policy.displayName || "Max（準備中）",
      status: "inactive",
    };
  }
  return policy;
}

export function isPlanExecutable(policy) {
  if (!policy) return false;
  if (policy.status === "suspended" || policy.status === "expired") return false;
  if (policy.status === "inactive") return false;
  return true;
}

export function isModelAllowedForPolicy(policy, workspaceModelId) {
  if (!isPlanExecutable(policy)) return false;
  const id = String(workspaceModelId || "").trim();
  return Boolean(policy.allowedWorkspaceModels?.includes(id));
}

export function isFeatureAllowedForPolicy(policy, featureKey) {
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

export function featureForEdge(edgeName) {
  return EDGE_TO_FEATURE[String(edgeName || "").trim()] || null;
}

export function edgeForWorkspaceModel(workspaceModelId) {
  return WORKSPACE_TO_EDGE[String(workspaceModelId || "").trim()] || null;
}

export function listAllowedModels(policy) {
  if (!isPlanExecutable(policy)) return [];
  return [...(policy.allowedWorkspaceModels || [])];
}

export function listFallbackModels(policy, excludeId) {
  return listAllowedModels(policy).filter((id) => id !== excludeId);
}

export function getDefaultModelForPolicy(policy) {
  const list = listAllowedModels(policy);
  return list[0] || "gemini-flash";
}

/**
 * Public summary — 料金・原価・secret なし
 * @param {object} policy
 * @param {object} [usage]
 */
export function buildPublicPlanSummary(policy, usage = {}) {
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
    allowedFeatures: [...(policy.allowedFeatures || [])],
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

export function evaluateLimitAction(policy, usageRatio) {
  if (!isPlanExecutable(policy)) return "deny";
  if (!Number.isFinite(usageRatio)) return "deny";
  if (usageRatio >= 1) return policy.limitAction || "deny";
  const near = policy.nearLimitRatio ?? 0.9;
  if (usageRatio >= near) return policy.nearLimitAction || "warn";
  return "ok";
}

export default {
  PLAN_POLICY_VERSION,
  CANONICAL_PLAN_IDS,
  PLAN_ID_ALIASES,
  PLAN_POLICIES,
  WORKSPACE_MODELS,
  normalizePlanId,
  getPlanPolicy,
  getAnonymousPolicy,
  resolveStatusFromSubscription,
  policyFromGenAiPlan,
  isPlanExecutable,
  isModelAllowedForPolicy,
  isFeatureAllowedForPolicy,
  featureForEdge,
  edgeForWorkspaceModel,
  listAllowedModels,
  listFallbackModels,
  getDefaultModelForPolicy,
  buildPublicPlanSummary,
  evaluateLimitAction,
};
