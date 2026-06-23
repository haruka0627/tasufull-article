/**
 * TASFUL Builder — 材料計算ツール（汎用版）
 * 施工面積 ÷ 1単位あたり施工可能面積 から必要数量を切り上げ算出する。
 */
(function (global) {
  "use strict";

  const TOOL_ID = "material-calculator";

  /** @type {ReadonlyArray<{ id: string, label: string, coverageExample: number, unit: string, description: string }>} */
  const TRADE_TEMPLATES = Object.freeze([
    {
      id: "wallpaper",
      label: "クロス",
      coverageExample: 50,
      unit: "本",
      description: "クロス1本あたり約50㎡を施工可能（目安）。専用計算は将来追加予定です。",
    },
    {
      id: "paint",
      label: "塗装",
      coverageExample: 25,
      unit: "缶",
      description: "塗料1缶あたり約25㎡を施工可能（目安）。専用計算は将来追加予定です。",
    },
    {
      id: "floor",
      label: "床",
      coverageExample: 12,
      unit: "箱",
      description: "床材1箱あたり約12㎡を施工可能（目安）。専用計算は将来追加予定です。",
    },
    {
      id: "board",
      label: "ボード",
      coverageExample: 18,
      unit: "枚",
      description: "ボード1枚あたり約18㎡を施工可能（目安）。専用計算は将来追加予定です。",
    },
  ]);

  const meta = Object.freeze({
    id: TOOL_ID,
    slug: "material-calculator",
    name: "材料計算",
    page: "tool-material-calculator.html",
    description: "施工面積と材料の施工可能面積から必要数量を計算します。",
    inputs: Object.freeze([
      { key: "area", label: "施工面積", type: "number", min: 0, unit: "㎡", step: 0.1 },
      { key: "coverage", label: "1単位あたり施工可能面積", type: "number", min: 0, unit: "㎡", step: 0.1 },
    ]),
    outputs: Object.freeze([{ key: "quantity", label: "必要数量", unit: "単位" }]),
    formulas: Object.freeze({
      quantity: "施工面積 ÷ 1単位あたり施工可能面積（小数点切り上げ）",
    }),
    tradeTemplates: TRADE_TEMPLATES,
  });

  function parseNumber(value) {
    if (value === null || value === undefined || value === "") return 0;
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }

  /**
   * @param {{ area?: unknown, coverage?: unknown }} input
   */
  function calculate(input) {
    const area = parseNumber(input?.area);
    const coverage = parseNumber(input?.coverage);
    const quantity = coverage > 0 ? Math.ceil(area / coverage) : 0;

    return {
      area,
      coverage,
      quantity,
    };
  }

  function formatArea(value) {
    return (
      new Intl.NumberFormat("ja-JP", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(value) + " ㎡"
    );
  }

  function formatQuantity(value, unitLabel) {
    const qty = new Intl.NumberFormat("ja-JP", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
    return unitLabel ? qty + " " + unitLabel : qty + " 単位";
  }

  /**
   * @param {ParentNode} root
   */
  function readFromRoot(root) {
    return {
      area: root.querySelector("[data-builder-mat-area]")?.value,
      coverage: root.querySelector("[data-builder-mat-coverage]")?.value,
    };
  }

  /**
   * @param {ParentNode} root
   * @returns {string|null}
   */
  function getSelectedTemplateId(root) {
    const active = root.querySelector("[data-builder-mat-template].is-active");
    return active ? String(active.getAttribute("data-builder-mat-template") || "") : null;
  }

  /**
   * @param {string|null} templateId
   */
  function getTemplateById(templateId) {
    if (!templateId) return null;
    return TRADE_TEMPLATES.find(function (t) {
      return t.id === templateId;
    }) || null;
  }

  /**
   * @param {ParentNode} root
   * @param {ReturnType<typeof calculate>} result
   */
  function applyToRoot(root, result) {
    const template = getTemplateById(getSelectedTemplateId(root));
    const unitLabel = template ? template.unit : null;

    const areaEl = root.querySelector("[data-builder-mat-result-area]");
    const coverageEl = root.querySelector("[data-builder-mat-result-coverage]");
    const quantityEl = root.querySelector("[data-builder-mat-result-quantity]");
    const formulaEl = root.querySelector("[data-builder-mat-formula]");
    const breakdownArea = root.querySelector("[data-builder-mat-breakdown-area]");
    const breakdownCoverage = root.querySelector("[data-builder-mat-breakdown-coverage]");
    const breakdownQuantity = root.querySelector("[data-builder-mat-breakdown-quantity]");

    if (areaEl) areaEl.textContent = formatArea(result.area);
    if (coverageEl) coverageEl.textContent = formatArea(result.coverage);
    if (quantityEl) quantityEl.textContent = formatQuantity(result.quantity, unitLabel);
    if (formulaEl) {
      formulaEl.textContent =
        formatArea(result.area) +
        " ÷ " +
        formatArea(result.coverage) +
        " = " +
        formatQuantity(result.quantity, unitLabel) +
        "（切り上げ）";
    }
    if (breakdownArea) breakdownArea.textContent = formatArea(result.area);
    if (breakdownCoverage) breakdownCoverage.textContent = formatArea(result.coverage);
    if (breakdownQuantity) breakdownQuantity.textContent = formatQuantity(result.quantity, unitLabel);

    root.dispatchEvent(
      new CustomEvent("builder-tool:calculated", {
        bubbles: true,
        detail: {
          toolId: TOOL_ID,
          input: {
            area: result.area,
            coverage: result.coverage,
          },
          result: {
            area: result.area,
            coverage: result.coverage,
            quantity: result.quantity,
          },
        },
      })
    );
  }

  /**
   * @param {ParentNode} root
   * @param {string|null} templateId
   */
  function applyTemplateUi(root, templateId) {
    const noteEl = root.querySelector("[data-builder-mat-template-note]");
    const template = getTemplateById(templateId);

    root.querySelectorAll("[data-builder-mat-template]").forEach(function (btn) {
      const isActive = btn.getAttribute("data-builder-mat-template") === templateId;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-selected", isActive ? "true" : "false");
    });

    if (!noteEl) return;

    if (!template) {
      noteEl.hidden = true;
      noteEl.textContent = "";
      return;
    }

    noteEl.hidden = false;
    noteEl.textContent =
      template.label +
      "の目安：1" +
      template.unit +
      "あたり約 " +
      template.coverageExample +
      " ㎡（" +
      template.description +
      "）";
  }

  /**
   * @param {ParentNode} [root]
   * @param {Record<string, string|number|undefined>} [preset]
   */
  function applyPreset(root, preset) {
    if (!root || !preset) return;
    const map = [
      ["area", "[data-builder-mat-area]"],
      ["coverage", "[data-builder-mat-coverage]"],
    ];
    map.forEach(function ([key, selector]) {
      if (preset[key] === undefined || preset[key] === null || preset[key] === "") return;
      const el = root.querySelector(selector);
      if (el) el.value = String(preset[key]);
    });
  }

  /**
   * @param {ParentNode} [root]
   */
  function mount(root) {
    root = root || document.querySelector("[data-builder-mat-root]");
    if (!root) return null;

    const params = new URLSearchParams(global.location?.search || "");
    applyPreset(root, {
      area: params.get("area") || undefined,
      coverage: params.get("coverage") || undefined,
    });

    const templateParam = params.get("template");
    if (templateParam && getTemplateById(templateParam)) {
      applyTemplateUi(root, templateParam);
    }

    const inputs = root.querySelectorAll("[data-builder-mat-input]");
    const run = function () {
      const result = calculate(readFromRoot(root));
      applyToRoot(root, result);
      return result;
    };

    inputs.forEach(function (el) {
      el.addEventListener("input", run);
      el.addEventListener("change", run);
    });

    root.querySelectorAll("[data-builder-mat-template]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const id = btn.getAttribute("data-builder-mat-template");
        const current = getSelectedTemplateId(root);
        const nextId = current === id ? null : id;
        applyTemplateUi(root, nextId);
        run();
      });
    });

    run();
    return { recalculate: run };
  }

  const tool = {
    id: TOOL_ID,
    meta,
    calculate,
    formatArea,
    formatQuantity,
    readFromRoot,
    applyToRoot,
    applyPreset,
    mount,
    TRADE_TEMPLATES,
  };

  if (global.BuilderConstructionTools && typeof global.BuilderConstructionTools.register === "function") {
    global.BuilderConstructionTools.register(tool);
  } else {
    global.BuilderConstructionTools = global.BuilderConstructionTools || {};
    global.BuilderConstructionTools.get = function (id) {
      return id === TOOL_ID ? tool : null;
    };
    global.BuilderConstructionTools.calculate = function (id, input) {
      if (id !== TOOL_ID) throw new Error("unknown tool");
      return calculate(input);
    };
  }
})(typeof window !== "undefined" ? window : globalThis);
