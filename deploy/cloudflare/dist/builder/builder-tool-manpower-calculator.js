/**
 * TASFUL Builder — 人工計算ツール
 * 人数 × 日数 × 単価 から総人工数・労務費を算出する。
 */
(function (global) {
  "use strict";

  const TOOL_ID = "manpower-calculator";

  const meta = Object.freeze({
    id: TOOL_ID,
    slug: "manpower-calculator",
    name: "人工計算",
    page: "tool-manpower-calculator.html",
    description: "作業人数・日数・1人工単価から総人工数と労務費合計を計算します。",
    inputs: Object.freeze([
      { key: "workers", label: "人数", type: "number", min: 0, unit: "人", step: 1 },
      { key: "days", label: "日数", type: "number", min: 0, unit: "日", step: 0.5 },
      { key: "unitPrice", label: "1人工単価", type: "number", min: 0, unit: "円/人日", step: 100 },
    ]),
    outputs: Object.freeze([
      { key: "totalManDays", label: "総人工数", unit: "人日" },
      { key: "totalLaborCost", label: "労務費合計", unit: "円" },
    ]),
    formulas: Object.freeze({
      totalManDays: "人数 × 日数",
      totalLaborCost: "人数 × 日数 × 単価",
    }),
  });

  function parseNumber(value) {
    if (value === null || value === undefined || value === "") return 0;
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }

  /**
   * @param {{ workers?: unknown, days?: unknown, unitPrice?: unknown }} input
   */
  function calculate(input) {
    const workers = parseNumber(input?.workers);
    const days = parseNumber(input?.days);
    const unitPrice = parseNumber(input?.unitPrice);
    const totalManDays = workers * days;
    const totalLaborCost = totalManDays * unitPrice;

    return {
      workers,
      days,
      unitPrice,
      totalManDays,
      totalLaborCost,
    };
  }

  function formatManDays(value) {
    return (
      new Intl.NumberFormat("ja-JP", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(value) + " 人日"
    );
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat("ja-JP", {
      style: "currency",
      currency: "JPY",
      maximumFractionDigits: 0,
    }).format(value);
  }

  /**
   * @param {ParentNode} root
   */
  function readFromRoot(root) {
    return {
      workers: root.querySelector("[data-builder-mc-workers]")?.value,
      days: root.querySelector("[data-builder-mc-days]")?.value,
      unitPrice: root.querySelector("[data-builder-mc-unit-price]")?.value,
    };
  }

  /**
   * @param {ParentNode} root
   * @param {ReturnType<typeof calculate>} result
   */
  function applyToRoot(root, result) {
    const manDaysEl = root.querySelector("[data-builder-mc-total-man-days]");
    const laborEl = root.querySelector("[data-builder-mc-total-labor-cost]");
    const formulaManDays = root.querySelector("[data-builder-mc-formula-man-days]");
    const formulaLabor = root.querySelector("[data-builder-mc-formula-labor]");

    if (manDaysEl) manDaysEl.textContent = formatManDays(result.totalManDays);
    if (laborEl) laborEl.textContent = formatCurrency(result.totalLaborCost);
    if (formulaManDays) {
      formulaManDays.textContent =
        result.workers + " 人 × " + result.days + " 日 = " + formatManDays(result.totalManDays);
    }
    if (formulaLabor) {
      formulaLabor.textContent =
        formatManDays(result.totalManDays) +
        " × " +
        new Intl.NumberFormat("ja-JP").format(result.unitPrice) +
        " 円 = " +
        formatCurrency(result.totalLaborCost);
    }

    root.dispatchEvent(
      new CustomEvent("builder-tool:calculated", {
        bubbles: true,
        detail: {
          toolId: TOOL_ID,
          input: {
            workers: result.workers,
            days: result.days,
            unitPrice: result.unitPrice,
          },
          result,
        },
      })
    );
  }

  /**
   * @param {ParentNode} [root]
   * @param {{ workers?: string|number, days?: string|number, unitPrice?: string|number }} [preset]
   */
  function applyPreset(root, preset) {
    if (!root || !preset) return;
    const map = [
      ["workers", "[data-builder-mc-workers]"],
      ["days", "[data-builder-mc-days]"],
      ["unitPrice", "[data-builder-mc-unit-price]"],
    ];
    map.forEach(([key, selector]) => {
      if (preset[key] === undefined || preset[key] === null || preset[key] === "") return;
      const el = root.querySelector(selector);
      if (el) el.value = String(preset[key]);
    });
  }

  /**
   * @param {ParentNode} [root]
   */
  function mount(root) {
    root = root || document.querySelector("[data-builder-mc-root]");
    if (!root) return null;

    const params = new URLSearchParams(global.location?.search || "");
    applyPreset(root, {
      workers: params.get("workers") || params.get("people") || undefined,
      days: params.get("days") || undefined,
      unitPrice: params.get("unitPrice") || params.get("rate") || undefined,
    });

    const inputs = root.querySelectorAll("[data-builder-mc-input]");
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
    formatManDays,
    formatCurrency,
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
