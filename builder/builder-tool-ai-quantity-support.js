/**
 * TASFUL Builder — AI積算補助（β）
 * 面積・使用量・ロス率・単価から必要数量と概算材料費を算出し、ルールベースで診断する。
 */
(function (global) {
  "use strict";

  const TOOL_ID = "ai-quantity-support";
  const MAX_DIAGNOSTICS = 3;

  /** @type {Readonly<Record<string, string>>} */
  const DIAGNOSTIC_MESSAGES = Object.freeze({
    noProjectName: "工事名を入力すると、積算内容を管理しやすくなります。",
    noTargetName: "積算対象を入力すると、材料や作業内容を確認しやすくなります。",
    noArea: "施工面積を入力すると、必要数量を計算できます。",
    noUsage: "単位あたり使用量を入力してください。",
    noUnitPrice: "材料単価を入力すると、概算材料費を確認できます。",
    lossRateZero: "ロス率が0%です。端材・塗り重ね・予備分が必要ないか確認してください。",
    lossRateHigh: "ロス率が高めです。材料の無駄や施工条件を確認してください。",
    materialCostHigh: "材料費が高額です。数量・単価・ロス率を確認してください。",
    noNote: "備考に施工条件や注意点を残すと、後から確認しやすくなります。",
    ok: "積算内容を受け取りました。必要数量と概算材料費の確認に活用できます。",
  });

  const meta = Object.freeze({
    id: TOOL_ID,
    slug: "ai-quantity-support",
    name: "AI積算補助",
    page: "tool-ai-quantity-support.html",
    description:
      "面積・使用量・ロス率・単価をもとに、必要数量と概算材料費を確認できます。",
    inputs: Object.freeze([
      { key: "projectName", label: "工事名", type: "text" },
      { key: "targetName", label: "積算対象", type: "text" },
      { key: "area", label: "施工面積", type: "number", unit: "㎡" },
      { key: "usagePerUnit", label: "単位あたり使用量", type: "number" },
      { key: "lossRate", label: "ロス率", type: "number", unit: "%" },
      { key: "unitPrice", label: "材料単価", type: "number", unit: "円" },
      { key: "note", label: "備考", type: "text" },
    ]),
    outputs: Object.freeze([
      { key: "baseQuantity", label: "基準数量", unit: "" },
      { key: "lossQuantity", label: "ロス数量", unit: "" },
      { key: "requiredQuantity", label: "必要数量", unit: "" },
      { key: "materialCost", label: "概算材料費", unit: "円" },
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
   *   targetName?: unknown,
   *   area?: unknown,
   *   usagePerUnit?: unknown,
   *   lossRate?: unknown,
   *   unitPrice?: unknown,
   *   note?: unknown,
   * }} input
   */
  function calculate(input) {
    const projectName = String(input?.projectName || "").trim();
    const targetName = String(input?.targetName || "").trim();
    const note = String(input?.note || "").trim();
    const area = parseNumber(input?.area);
    const usagePerUnit = parseNumber(input?.usagePerUnit);
    const lossRate = parseNumber(input?.lossRate);
    const unitPrice = parseNumber(input?.unitPrice);
    const baseQuantity = area * usagePerUnit;
    const lossQuantity = baseQuantity * (lossRate / 100);
    const requiredQuantity = baseQuantity + lossQuantity;
    const materialCost = requiredQuantity * unitPrice;

    return {
      projectName,
      targetName,
      area,
      usagePerUnit,
      lossRate,
      unitPrice,
      baseQuantity,
      lossQuantity,
      requiredQuantity,
      materialCost,
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
    const targetName = String(payload?.targetName || "").trim();
    const note = String(payload?.note || "").trim();
    const area = Number(payload?.area);
    const usagePerUnit = Number(payload?.usagePerUnit);
    const lossRate = Number(payload?.lossRate);
    const unitPrice = Number(payload?.unitPrice);
    const materialCost = Number(payload?.materialCost);

    const safeArea = Number.isFinite(area) && area >= 0 ? area : 0;
    const safeUsage = Number.isFinite(usagePerUnit) && usagePerUnit >= 0 ? usagePerUnit : 0;
    const safeLossRate = Number.isFinite(lossRate) && lossRate >= 0 ? lossRate : 0;
    const safeUnitPrice = Number.isFinite(unitPrice) && unitPrice >= 0 ? unitPrice : 0;
    const safeMaterialCost = Number.isFinite(materialCost) && materialCost >= 0 ? materialCost : 0;

    if (!projectName) {
      messages.push(DIAGNOSTIC_MESSAGES.noProjectName);
    }

    if (!targetName) {
      messages.push(DIAGNOSTIC_MESSAGES.noTargetName);
    }

    if (safeArea === 0) {
      messages.push(DIAGNOSTIC_MESSAGES.noArea);
    }

    if (safeUsage === 0) {
      messages.push(DIAGNOSTIC_MESSAGES.noUsage);
    }

    if (safeUnitPrice === 0) {
      messages.push(DIAGNOSTIC_MESSAGES.noUnitPrice);
    }

    if (safeLossRate === 0) {
      messages.push(DIAGNOSTIC_MESSAGES.lossRateZero);
    } else if (safeLossRate >= 20) {
      messages.push(DIAGNOSTIC_MESSAGES.lossRateHigh);
    }

    if (safeMaterialCost >= 1000000) {
      messages.push(DIAGNOSTIC_MESSAGES.materialCostHigh);
    }

    if (!note) {
      messages.push(DIAGNOSTIC_MESSAGES.noNote);
    }

    if (!messages.length) {
      messages.push(DIAGNOSTIC_MESSAGES.ok);
    }

    return messages.slice(0, MAX_DIAGNOSTICS);
  }

  function formatQuantity(value) {
    return new Intl.NumberFormat("ja-JP", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
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
        minimumFractionDigits: 0,
        maximumFractionDigits: 1,
      }).format(value) + "%"
    );
  }

  /**
   * @param {ParentNode} root
   */
  function readFromRoot(root) {
    return {
      projectName: root.querySelector("[data-builder-aqs-project-name]")?.value,
      targetName: root.querySelector("[data-builder-aqs-target-name]")?.value,
      area: root.querySelector("[data-builder-aqs-area]")?.value,
      usagePerUnit: root.querySelector("[data-builder-aqs-usage-per-unit]")?.value,
      lossRate: root.querySelector("[data-builder-aqs-loss-rate]")?.value,
      unitPrice: root.querySelector("[data-builder-aqs-unit-price]")?.value,
      note: root.querySelector("[data-builder-aqs-note]")?.value,
    };
  }

  /**
   * @param {ParentNode} root
   * @param {ReturnType<typeof calculate>} result
   */
  function applyToRoot(root, result) {
    const baseEl = root.querySelector("[data-builder-aqs-base-quantity]");
    const lossEl = root.querySelector("[data-builder-aqs-loss-quantity]");
    const requiredEl = root.querySelector("[data-builder-aqs-required-quantity]");
    const costEl = root.querySelector("[data-builder-aqs-material-cost]");
    const breakdownBase = root.querySelector("[data-builder-aqs-breakdown-base]");
    const breakdownLoss = root.querySelector("[data-builder-aqs-breakdown-loss]");
    const breakdownRequired = root.querySelector("[data-builder-aqs-breakdown-required]");
    const breakdownCost = root.querySelector("[data-builder-aqs-breakdown-cost]");

    if (baseEl) baseEl.textContent = formatQuantity(result.baseQuantity);
    if (lossEl) lossEl.textContent = formatQuantity(result.lossQuantity);
    if (requiredEl) requiredEl.textContent = formatQuantity(result.requiredQuantity);
    if (costEl) costEl.textContent = formatCurrency(result.materialCost);

    if (breakdownBase) {
      breakdownBase.textContent =
        formatQuantity(result.area) + "㎡ × " + formatQuantity(result.usagePerUnit) + " = " + formatQuantity(result.baseQuantity);
    }
    if (breakdownLoss) {
      breakdownLoss.textContent =
        formatQuantity(result.baseQuantity) + " × " + formatRate(result.lossRate) + " = " + formatQuantity(result.lossQuantity);
    }
    if (breakdownRequired) {
      breakdownRequired.textContent =
        formatQuantity(result.baseQuantity) + " + " + formatQuantity(result.lossQuantity) + " = " + formatQuantity(result.requiredQuantity);
    }
    if (breakdownCost) {
      breakdownCost.textContent =
        formatQuantity(result.requiredQuantity) + " × " + formatCurrency(result.unitPrice) + " = " + formatCurrency(result.materialCost);
    }

    const analyzePayload = {
      projectName: result.projectName,
      targetName: result.targetName,
      area: result.area,
      usagePerUnit: result.usagePerUnit,
      lossRate: result.lossRate,
      unitPrice: result.unitPrice,
      baseQuantity: result.baseQuantity,
      lossQuantity: result.lossQuantity,
      requiredQuantity: result.requiredQuantity,
      materialCost: result.materialCost,
      note: result.note,
    };

    root.dispatchEvent(
      new CustomEvent("builder-tool:calculated", {
        bubbles: true,
        detail: {
          toolId: TOOL_ID,
          input: {
            projectName: result.projectName,
            targetName: result.targetName,
            area: result.area,
            usagePerUnit: result.usagePerUnit,
            lossRate: result.lossRate,
            unitPrice: result.unitPrice,
            note: result.note,
          },
          result: {
            baseQuantity: result.baseQuantity,
            lossQuantity: result.lossQuantity,
            requiredQuantity: result.requiredQuantity,
            materialCost: result.materialCost,
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
    root = root || document.querySelector("[data-builder-aqs-root]");
    if (!root) return null;

    const inputs = root.querySelectorAll("[data-builder-aqs-input]");
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
    formatQuantity,
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

  global.BuilderToolAiQuantitySupport = tool;
})(typeof window !== "undefined" ? window : globalThis);
