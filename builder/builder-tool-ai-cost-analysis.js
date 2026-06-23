/**
 * TASFUL Builder — AI原価分析（β）
 * 請負金額・原価から粗利・粗利率を算出し、ルールベースで診断する。
 */
(function (global) {
  "use strict";

  const TOOL_ID = "ai-cost-analysis";
  const MAX_DIAGNOSTICS = 3;

  /** @type {Readonly<Record<string, string>>} */
  const DIAGNOSTIC_MESSAGES = Object.freeze({
    noProjectName: "工事名を入力すると、案件ごとの採算を管理しやすくなります。",
    noContractAmount: "請負金額を入力すると、粗利率を計算できます。",
    noTotalCost: "原価がまだ入力されていません。",
    negativeProfit: "原価が請負金額を上回っています。赤字見積の可能性があります。",
    rateVeryLow: "粗利率がかなり低めです。原価や単価の見直しを検討してください。",
    rateLow: "粗利率が低めです。外注費・材料費・諸経費を確認してください。",
    rateStandard: "粗利率は標準的な範囲です。条件に応じて安全率を確認してください。",
    rateGood: "粗利率は良好です。価格設定と原価管理は比較的安定しています。",
    materialRateHigh: "材料費の比率が高めです。材料単価や数量を確認してください。",
    outsourcingRateHigh: "外注費の比率が高めです。外注範囲と単価を確認してください。",
    noNote: "備考に現場条件や注意点を残すと、後から確認しやすくなります。",
  });

  const meta = Object.freeze({
    id: TOOL_ID,
    slug: "ai-cost-analysis",
    name: "AI原価分析",
    page: "tool-ai-cost-analysis.html",
    description:
      "請負金額・原価・粗利率をもとに、Builder AIが採算確認を支援する機能です。",
    inputs: Object.freeze([
      { key: "projectName", label: "工事名", type: "text" },
      { key: "contractAmount", label: "請負金額", type: "number", unit: "円" },
      { key: "laborCost", label: "人工費", type: "number", unit: "円" },
      { key: "materialCost", label: "材料費", type: "number", unit: "円" },
      { key: "outsourcingCost", label: "外注費", type: "number", unit: "円" },
      { key: "overheadCost", label: "諸経費", type: "number", unit: "円" },
      { key: "note", label: "備考", type: "text" },
    ]),
    outputs: Object.freeze([
      { key: "totalCost", label: "原価合計", unit: "円" },
      { key: "grossProfit", label: "粗利", unit: "円" },
      { key: "grossProfitRate", label: "粗利率", unit: "%" },
    ]),
  });

  function parseNumber(value) {
    if (value === null || value === undefined || value === "") return 0;
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }

  /**
   * @param {{
   *   projectName?: unknown,
   *   contractAmount?: unknown,
   *   laborCost?: unknown,
   *   materialCost?: unknown,
   *   outsourcingCost?: unknown,
   *   overheadCost?: unknown,
   *   note?: unknown,
   * }} input
   */
  function calculate(input) {
    const projectName = String(input?.projectName || "").trim();
    const note = String(input?.note || "").trim();
    const contractAmount = parseNumber(input?.contractAmount);
    const laborCost = parseNumber(input?.laborCost);
    const materialCost = parseNumber(input?.materialCost);
    const outsourcingCost = parseNumber(input?.outsourcingCost);
    const overheadCost = parseNumber(input?.overheadCost);
    const totalCost = laborCost + materialCost + outsourcingCost + overheadCost;
    const grossProfit = contractAmount - totalCost;
    const grossProfitRate = contractAmount > 0 ? (grossProfit / contractAmount) * 100 : 0;

    return {
      projectName,
      contractAmount,
      laborCost,
      materialCost,
      outsourcingCost,
      overheadCost,
      totalCost,
      grossProfit,
      grossProfitRate,
      note,
    };
  }

  /**
   * @param {ReturnType<typeof calculate>} payload
   * @returns {string[]}
   */
  function diagnose(payload) {
    const messages = [];
    const projectName = String(payload?.projectName || "").trim();
    const note = String(payload?.note || "").trim();
    const contractAmount = Number(payload?.contractAmount);
    const materialCost = Number(payload?.materialCost);
    const outsourcingCost = Number(payload?.outsourcingCost);
    const totalCost = Number(payload?.totalCost);
    const grossProfit = Number(payload?.grossProfit);
    const grossProfitRate = Number(payload?.grossProfitRate);

    const safeContract = Number.isFinite(contractAmount) && contractAmount >= 0 ? contractAmount : 0;
    const safeTotalCost = Number.isFinite(totalCost) && totalCost >= 0 ? totalCost : 0;
    const safeGrossProfit = Number.isFinite(grossProfit) ? grossProfit : 0;
    const safeGrossProfitRate = Number.isFinite(grossProfitRate) ? grossProfitRate : 0;
    const safeMaterial = Number.isFinite(materialCost) && materialCost >= 0 ? materialCost : 0;
    const safeOutsourcing = Number.isFinite(outsourcingCost) && outsourcingCost >= 0 ? outsourcingCost : 0;

    if (!projectName) {
      messages.push(DIAGNOSTIC_MESSAGES.noProjectName);
    }

    if (safeContract === 0) {
      messages.push(DIAGNOSTIC_MESSAGES.noContractAmount);
    }

    if (safeTotalCost === 0) {
      messages.push(DIAGNOSTIC_MESSAGES.noTotalCost);
    }

    if (safeGrossProfit < 0) {
      messages.push(DIAGNOSTIC_MESSAGES.negativeProfit);
    } else if (safeContract > 0) {
      if (safeGrossProfitRate < 10) {
        messages.push(DIAGNOSTIC_MESSAGES.rateVeryLow);
      } else if (safeGrossProfitRate < 20) {
        messages.push(DIAGNOSTIC_MESSAGES.rateLow);
      } else if (safeGrossProfitRate < 35) {
        messages.push(DIAGNOSTIC_MESSAGES.rateStandard);
      } else {
        messages.push(DIAGNOSTIC_MESSAGES.rateGood);
      }
    }

    if (safeContract > 0 && safeMaterial / safeContract >= 0.5) {
      messages.push(DIAGNOSTIC_MESSAGES.materialRateHigh);
    }

    if (safeContract > 0 && safeOutsourcing / safeContract >= 0.5) {
      messages.push(DIAGNOSTIC_MESSAGES.outsourcingRateHigh);
    }

    if (!note) {
      messages.push(DIAGNOSTIC_MESSAGES.noNote);
    }

    return messages.slice(0, MAX_DIAGNOSTICS);
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
      projectName: root.querySelector("[data-builder-aca-project-name]")?.value,
      contractAmount: root.querySelector("[data-builder-aca-contract-amount]")?.value,
      laborCost: root.querySelector("[data-builder-aca-labor-cost]")?.value,
      materialCost: root.querySelector("[data-builder-aca-material-cost]")?.value,
      outsourcingCost: root.querySelector("[data-builder-aca-outsourcing-cost]")?.value,
      overheadCost: root.querySelector("[data-builder-aca-overhead-cost]")?.value,
      note: root.querySelector("[data-builder-aca-note]")?.value,
    };
  }

  /**
   * @param {ParentNode} root
   * @param {ReturnType<typeof calculate>} result
   */
  function applyToRoot(root, result) {
    const totalCostEl = root.querySelector("[data-builder-aca-total-cost]");
    const grossProfitEl = root.querySelector("[data-builder-aca-gross-profit]");
    const grossProfitRateEl = root.querySelector("[data-builder-aca-gross-profit-rate]");
    const breakdownCost = root.querySelector("[data-builder-aca-breakdown-cost]");
    const breakdownProfit = root.querySelector("[data-builder-aca-breakdown-profit]");
    const breakdownRate = root.querySelector("[data-builder-aca-breakdown-rate]");

    if (totalCostEl) totalCostEl.textContent = formatCurrency(result.totalCost);
    if (grossProfitEl) grossProfitEl.textContent = formatCurrency(result.grossProfit);
    if (grossProfitRateEl) grossProfitRateEl.textContent = formatRate(result.grossProfitRate);

    if (breakdownCost) {
      breakdownCost.textContent =
        formatPlainYen(result.laborCost) +
        " + " +
        formatPlainYen(result.materialCost) +
        " + " +
        formatPlainYen(result.outsourcingCost) +
        " + " +
        formatPlainYen(result.overheadCost) +
        " = " +
        formatPlainYen(result.totalCost);
    }
    if (breakdownProfit) breakdownProfit.textContent = formatPlainYen(result.grossProfit);
    if (breakdownRate) breakdownRate.textContent = formatRate(result.grossProfitRate);

    const grossProfitCard = root.querySelector("[data-builder-aca-gross-profit-card]");
    if (grossProfitCard) {
      grossProfitCard.classList.toggle("builder-aca-result-card--negative", result.grossProfit < 0);
      grossProfitCard.classList.toggle("builder-aca-result-card--primary", result.grossProfit >= 0);
    }

    const analyzePayload = {
      projectName: result.projectName,
      contractAmount: result.contractAmount,
      laborCost: result.laborCost,
      materialCost: result.materialCost,
      outsourcingCost: result.outsourcingCost,
      overheadCost: result.overheadCost,
      totalCost: result.totalCost,
      grossProfit: result.grossProfit,
      grossProfitRate: result.grossProfitRate,
      note: result.note,
    };

    root.dispatchEvent(
      new CustomEvent("builder-tool:calculated", {
        bubbles: true,
        detail: {
          toolId: TOOL_ID,
          input: {
            projectName: result.projectName,
            contractAmount: result.contractAmount,
            laborCost: result.laborCost,
            materialCost: result.materialCost,
            outsourcingCost: result.outsourcingCost,
            overheadCost: result.overheadCost,
            note: result.note,
          },
          result: {
            totalCost: result.totalCost,
            grossProfit: result.grossProfit,
            grossProfitRate: result.grossProfitRate,
          },
          analyzePayload,
        },
      })
    );
  }

  /**
   * @param {ParentNode} [root]
   */
  function mount(root) {
    root = root || document.querySelector("[data-builder-aca-root]");
    if (!root) return null;

    const inputs = root.querySelectorAll("[data-builder-aca-input]");
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
    diagnose,
    formatCurrency,
    formatRate,
    readFromRoot,
    applyToRoot,
    mount,
    MAX_DIAGNOSTICS,
    DIAGNOSTIC_MESSAGES,
  };

  if (global.BuilderConstructionTools && typeof global.BuilderConstructionTools.register === "function") {
    global.BuilderConstructionTools.register(tool);
  }

  global.BuilderToolAiCostAnalysis = tool;
})(typeof window !== "undefined" ? window : globalThis);
