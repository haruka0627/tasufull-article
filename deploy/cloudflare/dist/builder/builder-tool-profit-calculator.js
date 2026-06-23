/**
 * TASFUL Builder — 粗利計算ツール
 * 請負金額と経費から総原価・粗利・粗利率を算出する。
 */
(function (global) {
  "use strict";

  const TOOL_ID = "profit-calculator";

  const meta = Object.freeze({
    id: TOOL_ID,
    slug: "profit-calculator",
    name: "粗利計算",
    page: "tool-profit-calculator.html",
    description: "請負金額や経費を入力して粗利と粗利率を確認できます。",
    inputs: Object.freeze([
      { key: "contractAmount", label: "請負金額（税込）", type: "number", min: 0, unit: "円", step: 1000 },
      { key: "materialCost", label: "材料費", type: "number", min: 0, unit: "円", step: 1000 },
      { key: "outsourcingCost", label: "外注費", type: "number", min: 0, unit: "円", step: 1000 },
      { key: "laborCost", label: "労務費", type: "number", min: 0, unit: "円", step: 1000 },
      { key: "otherCost", label: "その他経費", type: "number", min: 0, unit: "円", step: 1000 },
    ]),
    outputs: Object.freeze([
      { key: "contractAmount", label: "請負金額", unit: "円" },
      { key: "totalCost", label: "総原価", unit: "円" },
      { key: "grossProfit", label: "粗利", unit: "円" },
      { key: "grossProfitRate", label: "粗利率", unit: "%" },
    ]),
    formulas: Object.freeze({
      totalCost: "材料費 + 外注費 + 労務費 + その他経費",
      grossProfit: "請負金額 - 総原価",
      grossProfitRate: "粗利 ÷ 請負金額 × 100",
    }),
  });

  function parseNumber(value) {
    if (value === null || value === undefined || value === "") return 0;
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }

  /**
   * @param {{
   *   contractAmount?: unknown,
   *   materialCost?: unknown,
   *   outsourcingCost?: unknown,
   *   laborCost?: unknown,
   *   otherCost?: unknown,
   * }} input
   */
  function calculate(input) {
    const contractAmount = parseNumber(input?.contractAmount);
    const materialCost = parseNumber(input?.materialCost);
    const outsourcingCost = parseNumber(input?.outsourcingCost);
    const laborCost = parseNumber(input?.laborCost);
    const otherCost = parseNumber(input?.otherCost);
    const totalCost = materialCost + outsourcingCost + laborCost + otherCost;
    const grossProfit = contractAmount - totalCost;
    const grossProfitRate = contractAmount > 0 ? (grossProfit / contractAmount) * 100 : 0;

    return {
      contractAmount,
      materialCost,
      outsourcingCost,
      laborCost,
      otherCost,
      totalCost,
      grossProfit,
      grossProfitRate,
    };
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat("ja-JP", {
      style: "currency",
      currency: "JPY",
      maximumFractionDigits: 0,
    }).format(value);
  }

  function formatRate(value) {
    return (
      new Intl.NumberFormat("ja-JP", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }).format(value) + "%"
    );
  }

  function formatPlainYen(value) {
    return new Intl.NumberFormat("ja-JP").format(value) + "円";
  }

  /**
   * @param {ParentNode} root
   */
  function readFromRoot(root) {
    return {
      contractAmount: root.querySelector("[data-builder-pc-contract-amount]")?.value,
      materialCost: root.querySelector("[data-builder-pc-material-cost]")?.value,
      outsourcingCost: root.querySelector("[data-builder-pc-outsourcing-cost]")?.value,
      laborCost: root.querySelector("[data-builder-pc-labor-cost]")?.value,
      otherCost: root.querySelector("[data-builder-pc-other-cost]")?.value,
    };
  }

  /**
   * @param {ParentNode} root
   * @param {ReturnType<typeof calculate>} result
   */
  function applyToRoot(root, result) {
    const fields = [
      ["[data-builder-pc-result-contract]", formatCurrency(result.contractAmount)],
      ["[data-builder-pc-result-total-cost]", formatCurrency(result.totalCost)],
      ["[data-builder-pc-result-gross-profit]", formatCurrency(result.grossProfit)],
      ["[data-builder-pc-result-gross-profit-rate]", formatRate(result.grossProfitRate)],
    ];

    fields.forEach(function ([selector, text]) {
      const el = root.querySelector(selector);
      if (el) el.textContent = text;
    });

    const breakdownContract = root.querySelector("[data-builder-pc-breakdown-contract]");
    const breakdownGrossProfit = root.querySelector("[data-builder-pc-breakdown-gross-profit]");
    const breakdownRate = root.querySelector("[data-builder-pc-breakdown-rate]");
    const breakdownCostParts = root.querySelector("[data-builder-pc-breakdown-cost-parts]");

    if (breakdownContract) breakdownContract.textContent = formatPlainYen(result.contractAmount);
    if (breakdownGrossProfit) breakdownGrossProfit.textContent = formatPlainYen(result.grossProfit);
    if (breakdownRate) breakdownRate.textContent = formatRate(result.grossProfitRate);
    if (breakdownCostParts) {
      breakdownCostParts.textContent =
        formatPlainYen(result.materialCost) +
        " + " +
        formatPlainYen(result.outsourcingCost) +
        " + " +
        formatPlainYen(result.laborCost) +
        " + " +
        formatPlainYen(result.otherCost) +
        " = " +
        formatPlainYen(result.totalCost);
    }

    const grossProfitCard = root.querySelector("[data-builder-pc-gross-profit-card]");
    if (grossProfitCard) {
      grossProfitCard.classList.toggle("builder-pc-result-card--negative", result.grossProfit < 0);
      grossProfitCard.classList.toggle("builder-pc-result-card--primary", result.grossProfit >= 0);
    }

    root.dispatchEvent(
      new CustomEvent("builder-tool:calculated", {
        bubbles: true,
        detail: {
          toolId: TOOL_ID,
          input: {
            contractAmount: result.contractAmount,
            materialCost: result.materialCost,
            outsourcingCost: result.outsourcingCost,
            laborCost: result.laborCost,
            otherCost: result.otherCost,
          },
          result: {
            totalCost: result.totalCost,
            grossProfit: result.grossProfit,
            grossProfitRate: result.grossProfitRate,
          },
        },
      })
    );
  }

  /**
   * @param {ParentNode} [root]
   * @param {Record<string, string|number|undefined>} [preset]
   */
  function applyPreset(root, preset) {
    if (!root || !preset) return;
    const map = [
      ["contractAmount", "[data-builder-pc-contract-amount]"],
      ["materialCost", "[data-builder-pc-material-cost]"],
      ["outsourcingCost", "[data-builder-pc-outsourcing-cost]"],
      ["laborCost", "[data-builder-pc-labor-cost]"],
      ["otherCost", "[data-builder-pc-other-cost]"],
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
    root = root || document.querySelector("[data-builder-pc-root]");
    if (!root) return null;

    const params = new URLSearchParams(global.location?.search || "");
    applyPreset(root, {
      contractAmount: params.get("contractAmount") || undefined,
      materialCost: params.get("materialCost") || undefined,
      outsourcingCost: params.get("outsourcingCost") || undefined,
      laborCost: params.get("laborCost") || undefined,
      otherCost: params.get("otherCost") || undefined,
    });

    const inputs = root.querySelectorAll("[data-builder-pc-input]");
    const run = function () {
      const result = calculate(readFromRoot(root));
      applyToRoot(root, result);
      return result;
    };

    inputs.forEach(function (el) {
      el.addEventListener("input", run);
      el.addEventListener("change", run);
    });

    run();
    return { recalculate: run };
  }

  const tool = {
    id: TOOL_ID,
    meta,
    calculate,
    formatCurrency,
    formatRate,
    readFromRoot,
    applyToRoot,
    applyPreset,
    mount,
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
