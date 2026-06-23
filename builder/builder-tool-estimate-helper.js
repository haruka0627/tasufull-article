/**
 * TASFUL Builder — 見積補助ツール
 * 工事項目・数量・単価から概算見積の小計・消費税・税込合計を算出する。
 */
(function (global) {
  "use strict";

  const TOOL_ID = "estimate-helper";
  const DEFAULT_TAX_RATE = 0.1;

  const meta = Object.freeze({
    id: TOOL_ID,
    slug: "estimate-helper",
    name: "見積補助",
    page: "tool-estimate-helper.html",
    description: "工事項目・数量・単価を入力して、概算見積を整理できます。",
    inputs: Object.freeze([
      { key: "items", label: "見積項目", type: "array" },
      { key: "taxRate", label: "消費税率", type: "number", default: DEFAULT_TAX_RATE },
    ]),
    outputs: Object.freeze([
      { key: "subtotal", label: "小計合計", unit: "円" },
      { key: "tax", label: "消費税", unit: "円" },
      { key: "total", label: "税込合計", unit: "円" },
    ]),
    formulas: Object.freeze({
      lineTotal: "数量 × 単価",
      subtotal: "各行の小計合計",
      tax: "小計合計 × 消費税率",
      total: "小計合計 + 消費税",
    }),
  });

  /** @type {ReadonlyArray<{ name: string, quantity: number, unit: string, unitPrice: number }>} */
  const DEFAULT_ITEMS = Object.freeze([
    { name: "人工費", quantity: 3, unit: "人日", unitPrice: 25000 },
    { name: "材料費", quantity: 1, unit: "式", unitPrice: 80000 },
    { name: "外注費", quantity: 1, unit: "式", unitPrice: 0 },
  ]);

  function parseNumber(value) {
    if (value === null || value === undefined || value === "") return 0;
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }

  function parseTaxRate(value) {
    if (value === null || value === undefined || value === "") return DEFAULT_TAX_RATE;
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return DEFAULT_TAX_RATE;
    return n > 1 ? n / 100 : n;
  }

  /**
   * @param {{
   *   items?: Array<{ name?: unknown, quantity?: unknown, unit?: unknown, unitPrice?: unknown }>,
   *   taxRate?: unknown,
   * }} input
   */
  function calculate(input) {
    const taxRate = parseTaxRate(input?.taxRate);
    const rawItems = Array.isArray(input?.items) ? input.items : [];
    const items = rawItems.map(function (item) {
      const quantity = parseNumber(item?.quantity);
      const unitPrice = parseNumber(item?.unitPrice);
      const lineTotal = quantity * unitPrice;
      return {
        name: String(item?.name || "").trim(),
        quantity,
        unit: String(item?.unit || "").trim(),
        unitPrice,
        lineTotal,
      };
    });

    const subtotal = items.reduce(function (sum, item) {
      return sum + item.lineTotal;
    }, 0);
    const tax = Math.round(subtotal * taxRate);
    const total = subtotal + tax;

    return {
      subtotal,
      tax,
      taxRate,
      total,
      items,
    };
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat("ja-JP", {
      style: "currency",
      currency: "JPY",
      maximumFractionDigits: 0,
    }).format(value);
  }

  function formatTaxRate(value) {
    return (
      new Intl.NumberFormat("ja-JP", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 1,
      }).format(value * 100) + "%"
    );
  }

  /**
   * @param {ParentNode} row
   */
  function readRow(row) {
    return {
      name: row.querySelector("[data-builder-est-name]")?.value,
      quantity: row.querySelector("[data-builder-est-quantity]")?.value,
      unit: row.querySelector("[data-builder-est-unit]")?.value,
      unitPrice: row.querySelector("[data-builder-est-unit-price]")?.value,
    };
  }

  /**
   * @param {ParentNode} root
   */
  function readFromRoot(root) {
    const rows = root.querySelectorAll("[data-builder-est-row]");
    return {
      items: Array.from(rows).map(readRow),
      taxRate: root.querySelector("[data-builder-est-tax-rate]")?.value ?? DEFAULT_TAX_RATE,
    };
  }

  /**
   * @param {ParentNode} root
   * @param {ReturnType<typeof calculate>} result
   */
  function applyToRoot(root, result) {
    const rows = root.querySelectorAll("[data-builder-est-row]");
    rows.forEach(function (row, index) {
      const item = result.items[index];
      const lineEl = row.querySelector("[data-builder-est-line-total]");
      if (lineEl && item) lineEl.textContent = formatCurrency(item.lineTotal);
    });

    const subtotalEl = root.querySelector("[data-builder-est-subtotal]");
    const taxEl = root.querySelector("[data-builder-est-tax]");
    const totalEl = root.querySelector("[data-builder-est-total]");
    const taxRateEl = root.querySelector("[data-builder-est-tax-rate-label]");

    if (subtotalEl) subtotalEl.textContent = formatCurrency(result.subtotal);
    if (taxEl) taxEl.textContent = formatCurrency(result.tax);
    if (totalEl) totalEl.textContent = formatCurrency(result.total);
    if (taxRateEl) taxRateEl.textContent = formatTaxRate(result.taxRate);

    root.dispatchEvent(
      new CustomEvent("builder-tool:calculated", {
        bubbles: true,
        detail: {
          toolId: TOOL_ID,
          input: {
            items: result.items.map(function (item) {
              return {
                name: item.name,
                quantity: item.quantity,
                unit: item.unit,
                unitPrice: item.unitPrice,
              };
            }),
            taxRate: result.taxRate,
          },
          result: {
            subtotal: result.subtotal,
            tax: result.tax,
            total: result.total,
            items: result.items,
          },
        },
      })
    );
  }

  /**
   * @param {ParentNode} root
   * @param {{ name?: string, quantity?: number|string, unit?: string, unitPrice?: number|string }} [data]
   */
  function createRow(root, data) {
    const template = root.querySelector("[data-builder-est-row-template]");
    if (!template || !(template instanceof HTMLTemplateElement)) return null;

    const row = template.content.firstElementChild?.cloneNode(true);
    if (!(row instanceof HTMLElement)) return null;

    if (data) {
      const nameEl = row.querySelector("[data-builder-est-name]");
      const qtyEl = row.querySelector("[data-builder-est-quantity]");
      const unitEl = row.querySelector("[data-builder-est-unit]");
      const priceEl = row.querySelector("[data-builder-est-unit-price]");
      if (nameEl) nameEl.value = data.name || "";
      if (qtyEl) qtyEl.value = data.quantity !== undefined ? String(data.quantity) : "";
      if (unitEl) unitEl.value = data.unit || "";
      if (priceEl) priceEl.value = data.unitPrice !== undefined ? String(data.unitPrice) : "";
    }

    return row;
  }

  /**
   * @param {ParentNode} root
   */
  function bindRow(root, row, run) {
    row.querySelectorAll("[data-builder-est-input]").forEach(function (el) {
      el.addEventListener("input", run);
      el.addEventListener("change", run);
    });

    const removeBtn = row.querySelector("[data-builder-est-remove]");
    if (removeBtn) {
      removeBtn.addEventListener("click", function () {
        const list = root.querySelector("[data-builder-est-items]");
        const rows = list ? list.querySelectorAll("[data-builder-est-row]") : [];
        if (rows.length <= 1) return;
        row.remove();
        run();
      });
    }
  }

  /**
   * @param {ParentNode} [root]
   */
  function mount(root) {
    root = root || document.querySelector("[data-builder-est-root]");
    if (!root) return null;

    const list = root.querySelector("[data-builder-est-items]");
    const addBtn = root.querySelector("[data-builder-est-add]");
    if (!list) return null;

    const run = function () {
      const result = calculate(readFromRoot(root));
      applyToRoot(root, result);
      return result;
    };

    list.querySelectorAll("[data-builder-est-row]").forEach(function (row) {
      bindRow(root, row, run);
    });

    if (addBtn) {
      addBtn.addEventListener("click", function () {
        const row = createRow(root, { name: "", quantity: 1, unit: "式", unitPrice: 0 });
        if (!row) return;
        list.appendChild(row);
        bindRow(root, row, run);
        row.querySelector("[data-builder-est-name]")?.focus();
        run();
      });
    }

    run();
    return { recalculate: run };
  }

  const tool = {
    id: TOOL_ID,
    meta,
    calculate,
    formatCurrency,
    formatTaxRate,
    readFromRoot,
    applyToRoot,
    createRow,
    mount,
    DEFAULT_ITEMS,
    DEFAULT_TAX_RATE,
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
