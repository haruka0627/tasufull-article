/**
 * TASFUL Builder — Builder AI 共通エンジン（土台）
 * 各建設ツールから入力・計算結果を受け取り、将来の AI 処理へ渡す共通インターフェース。
 */
(function (global) {
  "use strict";

  const VERSION = "0.1.0";

  /** @type {Readonly<Record<string, string>>} */
  const TOOL_ID_TO_ANALYZE_TYPE = Object.freeze({
    "manpower-calculator": "labor-cost",
    "material-calculator": "material-cost",
    "profit-calculator": "profit",
    "estimate-helper": "estimate-helper",
    "ai-estimate": "ai-estimate",
    "ai-cost-analysis": "ai-cost-analysis",
    "ai-quantity-support": "ai-quantity-support",
    "ai-schedule-suggest": "ai-schedule-suggest",
  });

  /** @type {Readonly<Record<string, { summary: string, comment: string }>>} */
  const TYPE_MESSAGES = Object.freeze({
    "labor-cost": {
      summary: "Builder AIの分析準備ができました。",
      comment: "人工数と作業日数を受け取りました。必要人工の確認や人員計画に活用できます。",
    },
    "material-cost": {
      summary: "Builder AIの分析準備ができました。",
      comment: "面積・使用量・単価情報を受け取りました。材料数量と材料費の確認に活用できます。",
    },
    profit: {
      summary: "Builder AIの分析準備ができました。",
      comment: "請負金額・原価・粗利を受け取りました。利益率や採算確認に活用できます。",
    },
    "estimate-helper": {
      summary: "Builder AIの分析準備ができました。",
      comment: "見積項目と合計金額を受け取りました。見積内容の整理や確認に活用できます。",
    },
    "ai-estimate": {
      summary: "Builder AIの分析準備ができました。",
      comment: "工事内容と見積項目を受け取りました。見積作成支援に活用できます。",
    },
    "ai-cost-analysis": {
      summary: "Builder AIの分析準備ができました。",
      comment: "請負金額・原価・粗利率を受け取りました。採算確認や価格見直しに活用できます。",
    },
    "ai-quantity-support": {
      summary: "Builder AIの分析準備ができました。",
      comment: "面積・使用量・ロス率・材料単価を受け取りました。必要数量と材料費の確認に活用できます。",
    },
    "ai-schedule-suggest": {
      summary: "Builder AIの分析準備ができました。",
      comment: "工程条件・作業日数・人数を受け取りました。簡易工程と人員計画の確認に活用できます。",
    },
  });

  /**
   * @param {string} type
   */
  function getTypeMessages(type) {
    const normalizedType = String(type || "").trim();
    return (
      TYPE_MESSAGES[normalizedType] || {
        summary: "Builder AIの分析準備ができました。",
        comment: "入力内容と計算結果を受け取りました。",
      }
    );
  }

  /**
   * @param {unknown} value
   * @returns {value is Record<string, unknown>}
   */
  function isPlainObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  /**
   * @param {string} type
   * @param {Record<string, unknown>} payload
   * @param {string} fallback
   * @returns {string[]}
   */
  function resolveDiagnosticComments(type, payload, fallback) {
    const toolByType = {
      "ai-estimate": global.BuilderToolAiEstimate,
      "ai-cost-analysis": global.BuilderToolAiCostAnalysis,
      "ai-quantity-support": global.BuilderToolAiQuantitySupport,
      "ai-schedule-suggest": global.BuilderToolAiScheduleSuggest,
    };
    const tool = toolByType[type];
    if (tool && typeof tool.diagnose === "function") {
      return tool.diagnose(payload);
    }
    return [fallback];
  }

  /**
   * @param {unknown} type
   * @param {unknown} payload
   */
  function analyze(type, payload) {
    const normalizedType = String(type || "").trim();

    if (!normalizedType) {
      return {
        ok: false,
        type: "",
        error: "type is required",
      };
    }

    if (!isPlainObject(payload)) {
      return {
        ok: false,
        type: normalizedType,
        error: "payload must be an object",
      };
    }

    const messages = getTypeMessages(normalizedType);
    let comment = messages.comment;
    /** @type {string[] | null} */
    let comments = null;

    const DIAGNOSTIC_TYPES = new Set([
      "ai-estimate",
      "ai-cost-analysis",
      "ai-quantity-support",
      "ai-schedule-suggest",
    ]);

    if (DIAGNOSTIC_TYPES.has(normalizedType)) {
      const diagnostics = resolveDiagnosticComments(normalizedType, payload, messages.comment);
      comments = diagnostics;
      comment = diagnostics.join("\n");
    }

    return {
      ok: true,
      type: normalizedType,
      receivedAt: new Date().toISOString(),
      summary: messages.summary,
      comment,
      comments,
      payload,
    };
  }

  /**
   * @param {string} toolId
   * @returns {string}
   */
  function resolveAnalyzeType(toolId) {
    const id = String(toolId || "").trim();
    return TOOL_ID_TO_ANALYZE_TYPE[id] || id;
  }

  function attachCalculationBridge() {
    if (!global.document || typeof global.document.addEventListener !== "function") return;

    global.document.addEventListener("builder-tool:calculated", function (event) {
      const detail = event && event.detail;
      if (!detail) return;

      const type = resolveAnalyzeType(detail.toolId);
      const payload = isPlainObject(detail.analyzePayload)
        ? detail.analyzePayload
        : {
            toolId: detail.toolId,
            input: detail.input,
            result: detail.result,
          };
      const response = analyze(type, payload);

      if (typeof console !== "undefined" && typeof console.debug === "function") {
        console.debug("[BuilderAIEngine] analyze from calculation", type, response);
      }

      const root = event.target;
      if (root instanceof Element && !initialCommentSkipped.has(root)) {
        initialCommentSkipped.add(root);
        return;
      }

      renderComment(response, root instanceof Element ? root : global.document);
    });
  }

  /** @type {WeakSet<Element>} */
  const initialCommentSkipped = new WeakSet();

  /**
   * @param {{ ok?: boolean, type?: string, error?: string }} response
   * @param {ParentNode} [root]
   */
  function renderComment(response, root) {
    if (!global.document) return;
    const scope =
      root && typeof root.querySelectorAll === "function" ? root : global.document;

    scope.querySelectorAll("[data-builder-ai-comment]").forEach(function (box) {
      const body = box.querySelector("[data-builder-ai-comment-body]");
      const meta = box.querySelector("[data-builder-ai-comment-meta]");
      const badge = box.querySelector("[data-builder-ai-comment-badge]");
      if (!body) return;

      box.classList.remove("builder-ai-comment--ok", "builder-ai-comment--error");

      if (response && response.ok) {
        box.classList.add("builder-ai-comment--ok");
        if (badge) badge.textContent = "受信済";
        const messages = getTypeMessages(String(response.type || ""));

        if (Array.isArray(response.comments) && response.comments.length) {
          body.textContent = "";
          const list = global.document.createElement("ul");
          list.className = "builder-ai-comment__list";
          response.comments.forEach(function (item) {
            const li = global.document.createElement("li");
            li.textContent = String(item);
            list.appendChild(li);
          });
          body.appendChild(list);
        } else {
          body.textContent = response.comment || messages.comment;
        }

        if (meta) {
          meta.hidden = false;
          meta.textContent = "分析タイプ：" + String(response.type || "");
        }
        return;
      }

      box.classList.add("builder-ai-comment--error");
      if (badge) badge.textContent = "エラー";
      body.textContent = "AI分析の準備に失敗しました。";
      if (meta) {
        meta.hidden = false;
        meta.textContent = response && response.error ? String(response.error) : "";
      }
    });
  }

  const engine = {
    version: VERSION,
    ready: true,
    analyze,
    query(text, options) {
      const core = global.TasuBuilderAICore || global.TasuBuilderAI;
      if (core?.query) return core.query(text, options);
      return {
        ok: false,
        source: "builder_internal",
        intent: "unknown",
        summary: "Builder AI Core が読み込まれていません。",
        items: [],
        actions: [],
        warnings: ["core_not_loaded"],
        used_tools: [],
      };
    },
    resolveAnalyzeType,
    getTypeMessages,
    renderComment,
    TOOL_ID_TO_ANALYZE_TYPE,
    TYPE_MESSAGES,
  };

  global.BuilderAIEngine = engine;
  attachCalculationBridge();

  if (typeof console !== "undefined" && typeof console.debug === "function") {
    console.debug("[BuilderAIEngine] ready", global.BuilderAIEngine);
  }
})(typeof window !== "undefined" ? window : globalThis);
