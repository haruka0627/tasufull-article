/**
 * Builder AI — ツール / アクション レジストリ
 */
(function (global) {
  "use strict";

  const TOOL_TO_ACTION = Object.freeze({
    "ai-estimate": "estimate_draft",
    "estimate-helper": "estimate_draft",
    "ai-schedule-suggest": "schedule_draft",
    "ai-cost-analysis": "proposal_draft",
    "ai-quantity-support": "field_checklist",
    "labor-cost": "labor_cost_calc",
    "material-cost": "paint_cross_calc",
    profit: "estimate_profit_calc",
    "profit-calculator": "estimate_profit_calc",
    "manpower-calculator": "labor_cost_calc",
    "material-calculator": "material_quantity_calc",
    gantt: "gantt_schedule_draft",
    ky: "safety_ky_checklist",
    document: "document_text_draft",
    "before-after": "before_after_checklist",
    worker: "worker_search_assist",
    partner: "partner_search_assist",
    recommend: "candidate_recommendation",
    candidate: "candidate_recommendation",
    "sole-prop": "sole_prop_tax_assist",
    "tax-assist": "sole_prop_tax_assist",
    invoice: "invoice_tax_calc",
    schedule: "schedule_calc",
  });

  function resolveActionForTool(toolType) {
    const key = String(toolType || "").trim();
    return TOOL_TO_ACTION[key] || "";
  }

  function listActionDefinitions(actorType) {
    return global.TasuBuilderAIActions?.listActions?.(actorType) || [];
  }

  global.TasuBuilderAITools = {
    TOOL_TO_ACTION,
    resolveActionForTool,
    listActionDefinitions,
  };
})(typeof window !== "undefined" ? window : globalThis);
