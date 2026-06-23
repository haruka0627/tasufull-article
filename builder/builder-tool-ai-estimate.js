/**
 * TASFUL Builder — AI見積作成（土台）
 * 工事名・見積項目から小計・消費税・税込合計を算出し、Builder AI へ渡す。
 */
(function (global) {
  "use strict";

  const TOOL_ID = "ai-estimate";
  const DEFAULT_TAX_RATE = 0.1;
  const MAX_DIAGNOSTICS = 3;

  /** @type {Readonly<Record<string, string>>} */
  const DIAGNOSTIC_MESSAGES = Object.freeze({
    noProjectName: "工事名を入力すると、見積内容を管理しやすくなります。",
    fewItems: "見積項目が少ないため、作業内容の抜け漏れがないか確認してください。",
    zeroQtyOrPrice: "数量または単価が未入力の項目があります。",
    subtotalZero: "見積金額がまだ計算されていません。",
    subtotalSmall: "小規模工事または一部作業の見積として確認してください。",
    subtotalLarge: "高額見積のため、材料費・人工費・諸経費の内訳を確認してください。",
    noNotes: "備考に作業条件や注意点を残すと、後から確認しやすくなります。",
    ok: "見積内容を受け取りました。項目・数量・単価の確認に活用できます。",
  });

  const meta = Object.freeze({
    id: TOOL_ID,
    slug: "ai-estimate",
    name: "AI見積作成",
    page: "tool-ai-estimate.html",
    description:
      "工事内容・数量・単価などをもとに、Builder AIが見積作成を支援する機能です。",
    inputs: Object.freeze([
      { key: "projectName", label: "工事名", type: "text" },
      { key: "items", label: "見積項目", type: "array" },
    ]),
    outputs: Object.freeze([
      { key: "subtotal", label: "小計合計", unit: "円" },
      { key: "tax", label: "消費税", unit: "円" },
      { key: "total", label: "税込合計", unit: "円" },
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
   *   items?: Array<{ name?: unknown, quantity?: unknown, unit?: unknown, unitPrice?: unknown, note?: unknown }>,
   *   taxRate?: unknown,
   * }} input
   */
  function calculate(input) {
    const projectName = String(input?.projectName || "").trim();
    const taxRate = DEFAULT_TAX_RATE;
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
        note: String(item?.note || "").trim(),
        lineTotal,
      };
    });

    const subtotal = items.reduce(function (sum, item) {
      return sum + item.lineTotal;
    }, 0);
    const tax = Math.round(subtotal * taxRate);
    const total = subtotal + tax;

    return {
      projectName,
      items,
      subtotal,
      tax,
      taxRate,
      total,
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
   * 見積内容をルールベースで診断し、コメント文言の配列を返す（最大3件）。
   * @param {{
   *   projectName?: unknown,
   *   items?: Array<{ quantity?: unknown, unitPrice?: unknown, note?: unknown }>,
   *   subtotal?: unknown,
   * }} payload
   * @returns {string[]}
   */
  function diagnose(payload) {
    const messages = [];
    const projectName = String(payload?.projectName || "").trim();
    const items = Array.isArray(payload?.items) ? payload.items : [];
    const subtotal = Number(payload?.subtotal);
    const safeSubtotal = Number.isFinite(subtotal) && subtotal >= 0 ? subtotal : 0;

    if (!projectName) {
      messages.push(DIAGNOSTIC_MESSAGES.noProjectName);
    }

    if (items.length <= 1) {
      messages.push(DIAGNOSTIC_MESSAGES.fewItems);
    }

    const hasZeroQtyOrPrice = items.some(function (item) {
      const quantity = parseNumber(item?.quantity);
      const unitPrice = parseNumber(item?.unitPrice);
      return quantity === 0 || unitPrice === 0;
    });
    if (hasZeroQtyOrPrice) {
      messages.push(DIAGNOSTIC_MESSAGES.zeroQtyOrPrice);
    }

    if (safeSubtotal === 0) {
      messages.push(DIAGNOSTIC_MESSAGES.subtotalZero);
    } else if (safeSubtotal < 100000) {
      messages.push(DIAGNOSTIC_MESSAGES.subtotalSmall);
    } else if (safeSubtotal >= 1000000) {
      messages.push(DIAGNOSTIC_MESSAGES.subtotalLarge);
    }

    const allNotesEmpty =
      items.length > 0 &&
      items.every(function (item) {
        return !String(item?.note || "").trim();
      });
    if (allNotesEmpty) {
      messages.push(DIAGNOSTIC_MESSAGES.noNotes);
    }

    if (!messages.length) {
      messages.push(DIAGNOSTIC_MESSAGES.ok);
    }

    return messages.slice(0, MAX_DIAGNOSTICS);
  }

  /**
   * @param {ParentNode} row
   */
  function readRow(row) {
    return {
      name: row.querySelector("[data-builder-ae-name]")?.value,
      quantity: row.querySelector("[data-builder-ae-quantity]")?.value,
      unit: row.querySelector("[data-builder-ae-unit]")?.value,
      unitPrice: row.querySelector("[data-builder-ae-unit-price]")?.value,
      note: row.querySelector("[data-builder-ae-note]")?.value,
    };
  }

  /**
   * @param {ParentNode} root
   */
  function readFromRoot(root) {
    const rows = root.querySelectorAll("[data-builder-ae-row]");
    return {
      projectName: root.querySelector("[data-builder-ae-project-name]")?.value,
      items: Array.from(rows).map(readRow),
      taxRate: DEFAULT_TAX_RATE,
    };
  }

  /**
   * @param {ParentNode} root
   * @param {ReturnType<typeof calculate>} result
   */
  function applyToRoot(root, result) {
    const rows = root.querySelectorAll("[data-builder-ae-row]");
    rows.forEach(function (row, index) {
      const item = result.items[index];
      const lineEl = row.querySelector("[data-builder-ae-line-total]");
      if (lineEl && item) lineEl.textContent = formatCurrency(item.lineTotal);
    });

    const subtotalEl = root.querySelector("[data-builder-ae-subtotal]");
    const taxEl = root.querySelector("[data-builder-ae-tax]");
    const totalEl = root.querySelector("[data-builder-ae-total]");

    if (subtotalEl) subtotalEl.textContent = formatCurrency(result.subtotal);
    if (taxEl) taxEl.textContent = formatCurrency(result.tax);
    if (totalEl) totalEl.textContent = formatCurrency(result.total);

    const analyzePayload = {
      projectName: result.projectName,
      items: result.items.map(function (item) {
        return {
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          note: item.note,
          lineTotal: item.lineTotal,
        };
      }),
      subtotal: result.subtotal,
      tax: result.tax,
      total: result.total,
    };

    root.dispatchEvent(
      new CustomEvent("builder-tool:calculated", {
        bubbles: true,
        detail: {
          toolId: TOOL_ID,
          input: {
            projectName: result.projectName,
            items: analyzePayload.items,
          },
          result: {
            subtotal: result.subtotal,
            tax: result.tax,
            total: result.total,
          },
          analyzePayload,
        },
      })
    );
  }

  /**
   * @param {ParentNode} root
   * @param {{ name?: string, quantity?: number|string, unit?: string, unitPrice?: number|string, note?: string }} [data]
   */
  function createRow(root, data) {
    const template = root.querySelector("[data-builder-ae-row-template]");
    if (!template || !(template instanceof HTMLTemplateElement)) return null;

    const row = template.content.firstElementChild?.cloneNode(true);
    if (!(row instanceof HTMLElement)) return null;

    if (data) {
      const nameEl = row.querySelector("[data-builder-ae-name]");
      const qtyEl = row.querySelector("[data-builder-ae-quantity]");
      const unitEl = row.querySelector("[data-builder-ae-unit]");
      const priceEl = row.querySelector("[data-builder-ae-unit-price]");
      const noteEl = row.querySelector("[data-builder-ae-note]");
      if (nameEl) nameEl.value = data.name || "";
      if (qtyEl) qtyEl.value = data.quantity !== undefined ? String(data.quantity) : "";
      if (unitEl) unitEl.value = data.unit || "";
      if (priceEl) priceEl.value = data.unitPrice !== undefined ? String(data.unitPrice) : "";
      if (noteEl) noteEl.value = data.note || "";
    }

    return row;
  }

  /**
   * @param {ParentNode} root
   */
  function bindRow(root, row, run) {
    row.querySelectorAll("[data-builder-ae-input]").forEach(function (el) {
      el.addEventListener("input", run);
      el.addEventListener("change", run);
    });

    const removeBtn = row.querySelector("[data-builder-ae-remove]");
    if (removeBtn) {
      removeBtn.addEventListener("click", function () {
        const list = root.querySelector("[data-builder-ae-items]");
        const rows = list ? list.querySelectorAll("[data-builder-ae-row]") : [];
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
    root = root || document.querySelector("[data-builder-ae-root]");
    if (!root) return null;

    const list = root.querySelector("[data-builder-ae-items]");
    const addBtn = root.querySelector("[data-builder-ae-add]");
    const projectNameEl = root.querySelector("[data-builder-ae-project-name]");
    if (!list) return null;

    const run = function () {
      const result = calculate(readFromRoot(root));
      applyToRoot(root, result);
      return result;
    };

    if (projectNameEl) {
      projectNameEl.addEventListener("input", run);
      projectNameEl.addEventListener("change", run);
    }

    list.querySelectorAll("[data-builder-ae-row]").forEach(function (row) {
      bindRow(root, row, run);
    });

    if (addBtn) {
      addBtn.addEventListener("click", function () {
        const row = createRow(root, { name: "", quantity: 1, unit: "式", unitPrice: 0, note: "" });
        if (!row) return;
        list.appendChild(row);
        bindRow(root, row, run);
        row.querySelector("[data-builder-ae-name]")?.focus();
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
    diagnose,
    formatCurrency,
    formatTaxRate,
    readFromRoot,
    applyToRoot,
    createRow,
    mount,
    DEFAULT_TAX_RATE,
    MAX_DIAGNOSTICS,
    DIAGNOSTIC_MESSAGES,
  };

  if (global.BuilderConstructionTools && typeof global.BuilderConstructionTools.register === "function") {
    global.BuilderConstructionTools.register(tool);
  }

  global.BuilderToolAiEstimate = tool;
})(typeof window !== "undefined" ? window : globalThis);
