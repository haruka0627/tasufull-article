/**
 * Builder AI — 建設ツール / 外部 UI アダプタ
 */
(function (global) {
  "use strict";

  function buildDeepLink(params) {
    const q = new URLSearchParams();
    if (params?.action) q.set("action", params.action);
    if (params?.projectId) q.set("project_id", params.projectId);
    if (params?.role) q.set("role", params.role);
    if (params?.partnerId) q.set("partnerId", params.partnerId);
    const qs = q.toString();
    return `builder-ai.html${qs ? `?${qs}` : ""}`;
  }

  /**
   * 計算結果から Builder AI 詳細下書き（非同期・任意）
   * 既存ルールベース analyze() は変更しない。
   */
  async function enhanceFromCalculation(detail, options) {
    const Router = global.TasuBuilderAIToolRouter;
    const Context = global.TasuBuilderAIContext;
    if (!Router?.routeAndRun) return null;
    const actor = options?.actor || Context?.resolveActor?.({}) || { actorType: "guest" };
    return Router.routeAndRun({
      toolId: detail?.toolId,
      analyzeType: global.BuilderAIEngine?.resolveAnalyzeType?.(detail?.toolId),
      payload: detail?.analyzePayload || detail?.result || detail?.input,
      projectId: options?.projectId,
      actor,
      preferRemote: options?.preferRemote,
    });
  }

  global.TasuBuilderAIAdapter = {
    buildDeepLink,
    enhanceFromCalculation,
    mountCommentDeepLinks,
  };

  function mountCommentDeepLinks() {
    if (!global.document) return;
    global.document.querySelectorAll("[data-builder-ai-comment]").forEach((box) => {
      if (box.querySelector("[data-builder-ai-deep-link]")) return;
      const link = global.document.createElement("a");
      link.className = "builder-ai-comment__deep-link";
      link.setAttribute("data-builder-ai-deep-link", "");
      link.href = buildDeepLink({ role: global.TasuBuilderAIContext?.resolveActor?.({})?.actorType });
      link.textContent = "Builder AI で詳細下書き";
      box.appendChild(link);
    });
  }

  if (global.document) {
    if (global.document.readyState === "loading") {
      global.document.addEventListener("DOMContentLoaded", mountCommentDeepLinks);
    } else {
      mountCommentDeepLinks();
    }
  }
})(typeof window !== "undefined" ? window : globalThis);
