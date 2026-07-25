/**
 * TASFUL AI — プラン別モデル定義（表示 · 選択）
 * 権限の正本は TasuAiPlanPolicy（サーバー再検証必須）。localStorage / URL の plan 改ざんは権限に使わない。
 */
(function (global) {
  "use strict";

  const STORAGE_SELECTED_MODEL = "tasu_ai_selected_model";

  /** @type {Record<string, { id: string, label: string, provider: string, edge?: string, comingSoon?: boolean }>} */
  const MODELS = {
    "gemini-flash": {
      id: "gemini-flash",
      label: "最速",
      shortLabel: "最速",
      provider: "gemini",
      edge: "gemini-chat",
    },
    gpt: {
      id: "gpt",
      label: "標準",
      shortLabel: "標準",
      provider: "openai",
      edge: "openai-chat",
    },
    claude: {
      id: "claude",
      label: "高精度",
      shortLabel: "高精度",
      provider: "anthropic",
      edge: "claude-chat",
    },
    grok: {
      id: "grok",
      label: "Grok",
      shortLabel: "Grok",
      provider: "xai",
      edge: "grok-chat",
      comingSoon: true,
    },
  };

  const WORKSPACE_MODEL_IDS = ["gemini-flash", "gpt", "claude"];

  function isWorkspaceSurface() {
    try {
      const path = String(global.location?.pathname || "");
      return (
        path.includes("ai-workspace") ||
        Boolean(global.document?.querySelector?.("[data-ai-workspace-chat]"))
      );
    } catch {
      return false;
    }
  }

  function policyApi() {
    return global.TasuAiPlanPolicy || null;
  }

  /** サーバー同期 plan を優先。localStorage / URL override は権限に使わない。 */
  function resolveUserPlan() {
    const Usage = global.TasuAiWorkspaceUsage;
    const fromServer = Usage?.getServerPlanId?.();
    const Policy = policyApi();
    if (fromServer && Policy?.normalizePlanId) {
      return Policy.normalizePlanId(fromServer);
    }
    try {
      const raw = JSON.parse(global.localStorage.getItem("tasu_genai_plan") || "null");
      const code = raw && typeof raw === "object" ? String(raw.plan || "free") : "free";
      return Policy?.normalizePlanId?.(code) || "free";
    } catch {
      return "free";
    }
  }

  function getActivePolicy(planId) {
    const Policy = policyApi();
    const id = planId || resolveUserPlan();
    if (Policy?.getPlanPolicy) return Policy.getPlanPolicy(id);
    return {
      planId: "free",
      displayName: "無料枠",
      allowedWorkspaceModels: ["gemini-flash"],
      status: "active",
    };
  }

  function normalizePlanId(raw) {
    return policyApi()?.normalizePlanId?.(raw) || "free";
  }

  function getPlan(planId) {
    const policy = getActivePolicy(planId);
    return {
      id: policy.planId,
      label: policy.displayName,
      modelAccess: Object.fromEntries(
        Object.keys(MODELS).map((mid) => {
          if (MODELS[mid].comingSoon) return [mid, "hidden"];
          if (policy.allowedWorkspaceModels?.includes(mid)) return [mid, "enabled"];
          if (WORKSPACE_MODEL_IDS.includes(mid)) return [mid, "disabled"];
          return [mid, "hidden"];
        })
      ),
    };
  }

  function getModel(modelId) {
    const id = String(modelId || "").trim();
    return MODELS[id] || MODELS["gemini-flash"];
  }

  function listModelsForPlan(planId) {
    const plan = getPlan(planId);
    return Object.keys(MODELS).map((id) => {
      const model = MODELS[id];
      const access = plan.modelAccess[id] || "hidden";
      return {
        ...model,
        access,
        selectable: access === "enabled",
        disabled: access === "disabled",
        hidden: access === "hidden",
        upgradeHint:
          access === "disabled"
            ? model.comingSoon
              ? "準備中"
              : "現在の利用区分では利用できません"
            : "",
      };
    });
  }

  function getDefaultModelIdForPlan(planId) {
    const Policy = policyApi();
    const policy = getActivePolicy(planId);
    if (Policy?.getDefaultModelForPolicy) return Policy.getDefaultModelForPolicy(policy);
    const list = listModelsForPlan(planId).filter((m) => m.selectable);
    return list[0]?.id || "gemini-flash";
  }

  function getSelectedModelId() {
    try {
      const plan = resolveUserPlan();
      const stored = String(global.localStorage.getItem(STORAGE_SELECTED_MODEL) || "").trim();
      const list = listModelsForPlan(plan);
      const row = list.find((m) => m.id === stored);
      if (row?.selectable) return row.id;
      return getDefaultModelIdForPlan(plan);
    } catch {
      return "gemini-flash";
    }
  }

  function setSelectedModelId(modelId) {
    const plan = resolveUserPlan();
    const list = listModelsForPlan(plan);
    const row = list.find((m) => m.id === modelId);
    if (!row?.selectable) return false;
    try {
      global.localStorage.setItem(STORAGE_SELECTED_MODEL, row.id);
      global.dispatchEvent(
        new CustomEvent("tasu:ai-model-changed", {
          detail: { modelId: row.id, planId: plan },
        })
      );
      return true;
    } catch {
      return false;
    }
  }

  /** @deprecated Phase 5 — 権限に使わない。 */
  function setPlanOverrideForBeta() {
    return false;
  }

  function isModelAllowed(modelId, planId) {
    const id = String(modelId || "").trim();
    const Policy = policyApi();
    const policy = getActivePolicy(planId);
    if (Policy?.isModelAllowedForPolicy) {
      return Policy.isModelAllowedForPolicy(policy, id);
    }
    return getPlan(planId).modelAccess[id] === "enabled";
  }

  global.TasuAiPlanModels = {
    MODELS,
    WORKSPACE_MODEL_IDS,
    STORAGE_SELECTED_MODEL,
    isWorkspaceSurface,
    resolveUserPlan,
    getPlan,
    getModel,
    listModelsForPlan,
    getSelectedModelId,
    setSelectedModelId,
    setPlanOverrideForBeta,
    getDefaultModelIdForPlan,
    isModelAllowed,
    normalizePlanId,
    getActivePolicy,
  };
})(typeof window !== "undefined" ? window : globalThis);
