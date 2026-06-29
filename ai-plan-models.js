/**
 * TASFUL AI — プラン別モデル定義（課金接続なし・表示・選択用）
 */
(function (global) {
  "use strict";

  const STORAGE_PLAN_OVERRIDE = "tasu_ai_user_plan";
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
      return path.includes("ai-workspace") || Boolean(global.document?.querySelector?.("[data-ai-workspace-chat]"));
    } catch {
      return false;
    }
  }

  /** @type {Record<string, { id: string, label: string, modelAccess: Record<string, "enabled"|"disabled"|"hidden"> }>} */
  const PLANS = {
    free: {
      id: "free",
      label: "Free",
      modelAccess: {
        "gemini-flash": "enabled",
        gpt: "hidden",
        claude: "hidden",
        grok: "hidden",
      },
    },
    trial: {
      id: "trial",
      label: "Trial",
      modelAccess: {
        "gemini-flash": "enabled",
        gpt: "hidden",
        claude: "hidden",
        grok: "hidden",
      },
    },
    light: {
      id: "light",
      label: "Light",
      modelAccess: {
        "gemini-flash": "enabled",
        gpt: "disabled",
        claude: "hidden",
        grok: "hidden",
      },
    },
    standard: {
      id: "standard",
      label: "Standard",
      modelAccess: {
        "gemini-flash": "enabled",
        gpt: "enabled",
        claude: "enabled",
        grok: "hidden",
      },
    },
    premium: {
      id: "premium",
      label: "Premium",
      modelAccess: {
        "gemini-flash": "enabled",
        gpt: "enabled",
        claude: "enabled",
        grok: "disabled",
      },
    },
  };

  const GENAI_PLAN_TO_TIER = {
    free: "free",
    basic_300: "light",
    pro_980: "standard",
    genai_basic_300: "light",
    genai_pro_980: "standard",
  };

  function normalizePlanId(raw) {
    const id = String(raw || "")
      .trim()
      .toLowerCase();
    if (id in PLANS) return id;
    if (id === "genai_basic_300" || id === "basic_300") return "light";
    if (id === "genai_pro_980" || id === "pro_980") return "standard";
    return "";
  }

  function readPlanOverride() {
    try {
      const params = new URLSearchParams(global.location?.search || "");
      const fromUrl = params.get("ai_plan") || params.get("tasu_ai_plan");
      if (fromUrl) return normalizePlanId(fromUrl);
      return normalizePlanId(localStorage.getItem(STORAGE_PLAN_OVERRIDE));
    } catch {
      return "";
    }
  }

  function readGenAiPlanCode() {
    try {
      const raw = JSON.parse(localStorage.getItem("tasu_genai_plan") || "null");
      if (!raw || typeof raw !== "object") return "free";
      return String(raw.plan || "free").trim();
    } catch {
      return "free";
    }
  }

  function resolveUserPlan() {
    const override = readPlanOverride();
    if (override) return override;
    const code = readGenAiPlanCode();
    return GENAI_PLAN_TO_TIER[code] || GENAI_PLAN_TO_TIER[String(code).toLowerCase()] || "free";
  }

  function getPlan(planId) {
    const id = normalizePlanId(planId) || resolveUserPlan();
    return PLANS[id] || PLANS.free;
  }

  function getModel(modelId) {
    const id = String(modelId || "").trim();
    return MODELS[id] || MODELS["gemini-flash"];
  }

  function listModelsForPlan(planId) {
    const plan = getPlan(planId);
    const workspace = isWorkspaceSurface();
    return Object.keys(MODELS).map((id) => {
      const model = MODELS[id];
      let access = plan.modelAccess[id] || "hidden";
      if (workspace && WORKSPACE_MODEL_IDS.includes(id) && !model.comingSoon) {
        access = "enabled";
      }
      if (workspace && model.comingSoon) {
        access = "hidden";
      }
      return {
        ...model,
        access,
        selectable: access === "enabled",
        disabled: access === "disabled",
        hidden: access === "hidden",
        upgradeHint: access === "disabled" ? (model.comingSoon ? "準備中" : "上位プランで利用可能") : "",
      };
    });
  }

  function getDefaultModelIdForPlan(planId) {
    const list = listModelsForPlan(planId).filter((m) => m.selectable);
    return list[0]?.id || "gemini-flash";
  }

  function getSelectedModelId() {
    try {
      const plan = resolveUserPlan();
      const stored = String(localStorage.getItem(STORAGE_SELECTED_MODEL) || "").trim();
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
      localStorage.setItem(STORAGE_SELECTED_MODEL, row.id);
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

  function setPlanOverrideForBeta(planId) {
    const id = normalizePlanId(planId);
    if (!id) return false;
    try {
      localStorage.setItem(STORAGE_PLAN_OVERRIDE, id);
      const defaultModel = getDefaultModelIdForPlan(id);
      localStorage.setItem(STORAGE_SELECTED_MODEL, defaultModel);
      global.dispatchEvent(new CustomEvent("tasu:ai-plan-changed", { detail: { planId: id } }));
      return true;
    } catch {
      return false;
    }
  }

  function isModelAllowed(modelId, planId) {
    const id = String(modelId || "").trim();
    if (isWorkspaceSurface() && WORKSPACE_MODEL_IDS.includes(id)) {
      const model = MODELS[id];
      return Boolean(model && !model.comingSoon);
    }
    const plan = getPlan(planId);
    return plan.modelAccess[id] === "enabled";
  }

  global.TasuAiPlanModels = {
    MODELS,
    PLANS,
    WORKSPACE_MODEL_IDS,
    STORAGE_PLAN_OVERRIDE,
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
  };
})(typeof window !== "undefined" ? window : globalThis);
