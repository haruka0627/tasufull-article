/**
 * TASFUL AI — Plan Policy（ブラウザ）
 * 正本: scripts/lib/ai-plan-policy.mjs — 料金は含まない。
 */
(function (global) {
  "use strict";

/** @typedef {"active"|"inactive"|"suspended"|"expired"} PlanStatus */
/** @typedef {"warn"|"lightweight_only"|"deny"|"reset_wait"} LimitAction */

const PLAN_POLICY_VERSION = 1;

/** Canonical internal IDs */
const CANONICAL_PLAN_IDS = Object.freeze([
  "anonymous",
  "free",
  "lite",
  "pro",
  "max",
]);

/** Alias → canonical (表示名と分離) */
const PLAN_ID_ALIASES = Object.freeze({
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
 * Canonical plan features（実装済みのみ active · 未接続は FUTURE_FEATURES）
 * openrouter_chat は Phase 6 PoC 専用 — production plan には付与しない
 */
const CANONICAL_FEATURES = Object.freeze([
  "workspace_chat",
  "gemini_chat",
  "openai_chat",
  "claude_chat",
  "ocr",
  "search",
  "text_to_speech",
  "image_analysis",
  "openrouter_chat",
]);

/** 将来 · policy 欄のみ（今回 Guard 接続しない） */
const FUTURE_FEATURES = Object.freeze([
  "vision",
  "image_generation",
  "voice_input",
  "speech_to_text",
  "site_assistant",
  "document_analysis",
  "media",
]);

/**
 * Plan feature → quota bucket（DB: text / vision）
 * OCR は vision_turn を共有（Phase 1 · DB 変更なし）
 * search / TTS / media brief は text_turn（日次 limit 値は変更しない）
 * unknown → null（無制限扱い禁止）
 */
const QUOTA_CATEGORY_MAP = Object.freeze({
  workspace_chat: "text_turn",
  gemini_chat: "text_turn",
  openai_chat: "text_turn",
  claude_chat: "text_turn",
  openrouter_chat: "text_turn",
  search: "text_turn",
  text_to_speech: "text_turn",
  text_turn: "text_turn",
  ocr: "vision_turn",
  ocr_turn: "vision_turn",
  vision_turn: "vision_turn",
  image_analysis: "vision_turn",
  media_video: "text_turn",
  media_music: "text_turn",
});

const AUTH_CHAT_FEATURES = Object.freeze([
  "workspace_chat",
  "gemini_chat",
  "ocr",
  "search",
  "text_to_speech",
]);

/**
 * @type {Record<string, object>}
 * 料金・Stripe・販売開始は含めない（REL-F-04 / Draft）。
 */
const PLAN_POLICIES = Object.freeze({
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
    allowedFeatures: Object.freeze([...AUTH_CHAT_FEATURES]),
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
    allowedFeatures: Object.freeze([...AUTH_CHAT_FEATURES]),
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
      ...AUTH_CHAT_FEATURES,
      "openai_chat",
      "claude_chat",
      "image_analysis",
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
      ...AUTH_CHAT_FEATURES,
      "openai_chat",
      "claude_chat",
      "image_analysis",
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
  "serper-search": "search",
  "gemini-tts": "text_to_speech",
  "ai-workspace-video-generate": "workspace_chat",
  "ai-workspace-music-generate": "workspace_chat",
  "gemini-image-character-analyze": "image_analysis",
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
function normalizePlanId(raw) {
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
function getPlanPolicy(planId, opts = {}) {
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

function getAnonymousPolicy() {
  return getPlanPolicy("anonymous");
}

/**
 * Subscription row → policy status
 * @param {Record<string, unknown>|null|undefined} row
 */
function resolveStatusFromSubscription(row) {
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
function policyFromGenAiPlan(plan) {
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

function isPlanExecutable(policy) {
  if (!policy) return false;
  if (policy.status === "suspended" || policy.status === "expired") return false;
  if (policy.status === "inactive") return false;
  return true;
}

function isModelAllowedForPolicy(policy, workspaceModelId) {
  if (!isPlanExecutable(policy)) return false;
  const id = String(workspaceModelId || "").trim();
  return Boolean(policy.allowedWorkspaceModels?.includes(id));
}

function isFeatureAllowedForPolicy(policy, featureKey) {
  if (!isPlanExecutable(policy)) return false;
  const f = String(featureKey || "").trim();
  if (!f) return false;
  if (FUTURE_FEATURES.includes(f)) return false;
  if (f === "openrouter_chat") return false;
  if (f === "ocr" || f === "ocr_turn") {
    return Boolean(policy.ocrAllowed) && policy.allowedFeatures.includes("ocr");
  }
  if (f === "vision_turn") {
    return (
      (Boolean(policy.ocrAllowed) && policy.allowedFeatures.includes("ocr")) ||
      policy.allowedFeatures.includes("image_analysis")
    );
  }
  if (f === "text_turn" || f === "workspace_chat") {
    return policy.allowedFeatures.includes("workspace_chat");
  }
  if (f === "text_to_speech") {
    return policy.allowedFeatures.includes("text_to_speech");
  }
  if (f === "search") {
    return policy.allowedFeatures.includes("search");
  }
  if (f === "image_analysis") {
    return policy.allowedFeatures.includes("image_analysis");
  }
  if (!CANONICAL_FEATURES.includes(f)) return false;
  return policy.allowedFeatures.includes(f);
}

function featureForEdge(edgeName) {
  return EDGE_TO_FEATURE[String(edgeName || "").trim()] || null;
}

/**
 * @param {string} featureKey
 * @returns {"text_turn"|"vision_turn"|null}
 */
function resolveQuotaCategory(featureKey) {
  const f = String(featureKey || "").trim();
  const cat = QUOTA_CATEGORY_MAP[f];
  return cat === "text_turn" || cat === "vision_turn" ? cat : null;
}

function edgeForWorkspaceModel(workspaceModelId) {
  return WORKSPACE_TO_EDGE[String(workspaceModelId || "").trim()] || null;
}

function listAllowedModels(policy) {
  if (!isPlanExecutable(policy)) return [];
  return [...(policy.allowedWorkspaceModels || [])];
}

function listFallbackModels(policy, excludeId) {
  return listAllowedModels(policy).filter((id) => id !== excludeId);
}

function getDefaultModelForPolicy(policy) {
  const list = listAllowedModels(policy);
  return list[0] || "gemini-flash";
}

/**
 * Public summary — 料金・原価・secret なし
 * @param {object} policy
 * @param {object} [usage]
 */
function buildPublicPlanSummary(policy, usage = {}) {
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

function evaluateLimitAction(policy, usageRatio) {
  if (!isPlanExecutable(policy)) return "deny";
  if (!Number.isFinite(usageRatio)) return "deny";
  if (usageRatio >= 1) return policy.limitAction || "deny";
  const near = policy.nearLimitRatio ?? 0.9;
  if (usageRatio >= near) return policy.nearLimitAction || "warn";
  return "ok";
}

  global.TasuAiPlanPolicy = {
    PLAN_POLICY_VERSION,
    CANONICAL_PLAN_IDS,
    PLAN_ID_ALIASES,
    PLAN_POLICIES,
    CANONICAL_FEATURES,
    FUTURE_FEATURES,
    QUOTA_CATEGORY_MAP,
    normalizePlanId,
    getPlanPolicy,
    getAnonymousPolicy,
    resolveStatusFromSubscription,
    policyFromGenAiPlan,
    isPlanExecutable,
    isModelAllowedForPolicy,
    isFeatureAllowedForPolicy,
    featureForEdge,
    resolveQuotaCategory,
    edgeForWorkspaceModel,
    listAllowedModels,
    listFallbackModels,
    getDefaultModelForPolicy,
    buildPublicPlanSummary,
    evaluateLimitAction,
  };
})(typeof window !== "undefined" ? window : globalThis);
