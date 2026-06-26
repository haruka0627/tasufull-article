/**
 * Builder AI — ツール種別 → アクション ルーティング
 */
(function (global) {
  "use strict";

  function routeToolToAction(toolId, analyzeType) {
    const Tools = global.TasuBuilderAITools;
    const fromType = Tools?.resolveActionForTool?.(analyzeType);
    if (fromType) return fromType;
    return Tools?.resolveActionForTool?.(toolId) || "faq_answer";
  }

  function buildToolContextSummary(payload) {
    if (!payload || typeof payload !== "object") return "";
    try {
      const clone = { ...payload };
      delete clone.raw;
      return JSON.stringify(clone, null, 0).slice(0, 1500);
    } catch {
      return String(payload).slice(0, 800);
    }
  }

  /**
   * @param {{ toolId?: string, analyzeType?: string, payload?: object, projectId?: string, actor?: object }} params
   */
  async function routeAndRun(params) {
    const Core = global.TasuBuilderAICore;
    if (!Core?.runAction) {
      return { ok: false, error: "core_missing", draft: "" };
    }
    const action = routeToolToAction(params?.toolId, params?.analyzeType);
    const toolContext = buildToolContextSummary(params?.payload);
    const userText =
      params?.userText ||
      `建設ツール（${params?.toolId || params?.analyzeType || "tool"}）の計算結果を踏まえ、改善点と下書きを提案してください。`;
    return Core.runAction({
      action,
      userText,
      projectId: params?.projectId,
      actor: params?.actor,
      toolContext,
      preferRemote: params?.preferRemote,
    });
  }

  global.TasuBuilderAIToolRouter = {
    routeToolToAction,
    buildToolContextSummary,
    routeAndRun,
  };
})(typeof window !== "undefined" ? window : globalThis);
