/**
 * TASFUL Builder — AI工程提案（β）
 * 工事内容・人数・日数から終了予定日・総人工を算出し、ルールベースで診断する。
 */
(function (global) {
  "use strict";

  const TOOL_ID = "ai-schedule-suggest";
  const MAX_DIAGNOSTICS = 3;

  /** @type {Readonly<Record<string, string>>} */
  const DIAGNOSTIC_MESSAGES = Object.freeze({
    noProjectName: "工事名を入力すると、工程を管理しやすくなります。",
    noWorkType: "工事種別を入力すると、工程の確認がしやすくなります。",
    noStartDate: "開始日を入力すると、終了予定日を確認できます。",
    noWorkDays: "想定作業日数を入力してください。",
    noWorkers: "作業人数を入力してください。",
    noOffDays: "休工日がない想定です。天候・資材待ち・現場都合を確認してください。",
    workDaysLong: "作業日数が長めです。工程分割や人員追加を検討してください。",
    singleWorker: "1人作業です。安全面と作業効率を確認してください。",
    totalManDaysHigh: "総人工が大きめです。人員計画と工程管理を確認してください。",
    noNote: "備考に現場条件や注意点を残すと、後から確認しやすくなります。",
    ok: "工程内容を受け取りました。作業日数・人数・終了予定日の確認に活用できます。",
  });

  const meta = Object.freeze({
    id: TOOL_ID,
    slug: "ai-schedule-suggest",
    name: "AI工程提案",
    page: "tool-ai-schedule-suggest.html",
    description: "工事内容・人数・開始日・想定日数から、簡易工程と注意コメントを表示します。",
    inputs: Object.freeze([
      { key: "projectName", label: "工事名", type: "text" },
      { key: "workType", label: "工事種別", type: "text" },
      { key: "startDate", label: "開始日", type: "date" },
      { key: "workDays", label: "想定作業日数", type: "number", unit: "日" },
      { key: "workers", label: "作業人数", type: "number", unit: "人" },
      { key: "offDays", label: "休工日数", type: "number", unit: "日" },
      { key: "note", label: "備考", type: "text" },
    ]),
    outputs: Object.freeze([
      { key: "estimatedEndDate", label: "終了予定日", unit: "" },
      { key: "totalManDays", label: "総人工", unit: "人日" },
      { key: "daysPerWorker", label: "1人あたり作業日数", unit: "日" },
    ]),
  });

  function parseNumber(value) {
    if (value === null || value === undefined || value === "") return 0;
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }

  /**
   * @param {unknown} value
   * @returns {Date | null}
   */
  function parseDateInput(value) {
    const raw = String(value || "").trim();
    if (!raw) return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
    if (!match) return null;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  /**
   * @param {Date} date
   * @returns {string}
   */
  function formatDateISO(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + d;
  }

  /**
   * @param {unknown} startDate
   * @param {number} workDays
   * @param {number} offDays
   * @returns {string}
   */
  function calculateEndDate(startDate, workDays, offDays) {
    const start = parseDateInput(startDate);
    if (!start) return "";
    const offset = workDays + offDays - 1;
    if (offset < 0) return formatDateISO(start);
    const end = new Date(start.getTime());
    end.setDate(end.getDate() + offset);
    return formatDateISO(end);
  }

  /**
   * @param {{
   *   projectName?: unknown,
   *   workType?: unknown,
   *   startDate?: unknown,
   *   workDays?: unknown,
   *   workers?: unknown,
   *   offDays?: unknown,
   *   note?: unknown,
   * }} input
   */
  function calculate(input) {
    const projectName = String(input?.projectName || "").trim();
    const workType = String(input?.workType || "").trim();
    const startDate = String(input?.startDate || "").trim();
    const note = String(input?.note || "").trim();
    const workDays = parseNumber(input?.workDays);
    const workers = parseNumber(input?.workers);
    const offDays = parseNumber(input?.offDays);
    const totalManDays = workDays * workers;
    const daysPerWorker = workers > 0 ? totalManDays / workers : 0;
    const estimatedEndDate = calculateEndDate(startDate, workDays, offDays);

    return {
      projectName,
      workType,
      startDate,
      workDays,
      workers,
      offDays,
      estimatedEndDate,
      totalManDays,
      daysPerWorker,
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
    const workType = String(payload?.workType || "").trim();
    const startDate = String(payload?.startDate || "").trim();
    const note = String(payload?.note || "").trim();
    const workDays = Number(payload?.workDays);
    const workers = Number(payload?.workers);
    const offDays = Number(payload?.offDays);
    const totalManDays = Number(payload?.totalManDays);

    const safeWorkDays = Number.isFinite(workDays) && workDays >= 0 ? workDays : 0;
    const safeWorkers = Number.isFinite(workers) && workers >= 0 ? workers : 0;
    const safeOffDays = Number.isFinite(offDays) && offDays >= 0 ? offDays : 0;
    const safeTotalManDays = Number.isFinite(totalManDays) && totalManDays >= 0 ? totalManDays : 0;

    if (!projectName) {
      messages.push(DIAGNOSTIC_MESSAGES.noProjectName);
    }

    if (!workType) {
      messages.push(DIAGNOSTIC_MESSAGES.noWorkType);
    }

    if (!startDate) {
      messages.push(DIAGNOSTIC_MESSAGES.noStartDate);
    }

    if (safeWorkDays === 0) {
      messages.push(DIAGNOSTIC_MESSAGES.noWorkDays);
    }

    if (safeWorkers === 0) {
      messages.push(DIAGNOSTIC_MESSAGES.noWorkers);
    }

    if (safeOffDays === 0) {
      messages.push(DIAGNOSTIC_MESSAGES.noOffDays);
    }

    if (safeWorkDays >= 10) {
      messages.push(DIAGNOSTIC_MESSAGES.workDaysLong);
    }

    if (safeWorkers === 1) {
      messages.push(DIAGNOSTIC_MESSAGES.singleWorker);
    }

    if (safeTotalManDays >= 20) {
      messages.push(DIAGNOSTIC_MESSAGES.totalManDaysHigh);
    }

    if (!note) {
      messages.push(DIAGNOSTIC_MESSAGES.noNote);
    }

    if (!messages.length) {
      messages.push(DIAGNOSTIC_MESSAGES.ok);
    }

    return messages.slice(0, MAX_DIAGNOSTICS);
  }

  function formatManDays(value) {
    return (
      new Intl.NumberFormat("ja-JP", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 1,
      }).format(value) + " 人日"
    );
  }

  function formatDays(value) {
    return (
      new Intl.NumberFormat("ja-JP", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 1,
      }).format(value) + " 日"
    );
  }

  function formatDisplayDate(value) {
    const date = parseDateInput(value);
    if (!date) return "—";
    return new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date);
  }

  /**
   * @param {ParentNode} root
   */
  function readFromRoot(root) {
    return {
      projectName: root.querySelector("[data-builder-ass-project-name]")?.value,
      workType: root.querySelector("[data-builder-ass-work-type]")?.value,
      startDate: root.querySelector("[data-builder-ass-start-date]")?.value,
      workDays: root.querySelector("[data-builder-ass-work-days]")?.value,
      workers: root.querySelector("[data-builder-ass-workers]")?.value,
      offDays: root.querySelector("[data-builder-ass-off-days]")?.value,
      note: root.querySelector("[data-builder-ass-note]")?.value,
    };
  }

  /**
   * @param {ParentNode} root
   * @param {ReturnType<typeof calculate>} result
   */
  function applyToRoot(root, result) {
    const endEl = root.querySelector("[data-builder-ass-end-date]");
    const totalEl = root.querySelector("[data-builder-ass-total-man-days]");
    const perWorkerEl = root.querySelector("[data-builder-ass-days-per-worker]");
    const breakdownEnd = root.querySelector("[data-builder-ass-breakdown-end]");
    const breakdownTotal = root.querySelector("[data-builder-ass-breakdown-total]");
    const breakdownPerWorker = root.querySelector("[data-builder-ass-breakdown-per-worker]");

    if (endEl) {
      endEl.textContent = result.estimatedEndDate ? formatDisplayDate(result.estimatedEndDate) : "—";
    }
    if (totalEl) totalEl.textContent = formatManDays(result.totalManDays);
    if (perWorkerEl) perWorkerEl.textContent = formatDays(result.daysPerWorker);

    if (breakdownEnd) {
      breakdownEnd.textContent = result.startDate
        ? formatDisplayDate(result.startDate) +
          " + " +
          result.workDays +
          "日 + 休工" +
          result.offDays +
          "日 - 1日 = " +
          (result.estimatedEndDate ? formatDisplayDate(result.estimatedEndDate) : "—")
        : "—";
    }
    if (breakdownTotal) {
      breakdownTotal.textContent =
        result.workDays + "日 × " + result.workers + "人 = " + formatManDays(result.totalManDays);
    }
    if (breakdownPerWorker) {
      breakdownPerWorker.textContent =
        formatManDays(result.totalManDays) + " ÷ " + result.workers + "人 = " + formatDays(result.daysPerWorker);
    }

    const analyzePayload = {
      projectName: result.projectName,
      workType: result.workType,
      startDate: result.startDate,
      workDays: result.workDays,
      workers: result.workers,
      offDays: result.offDays,
      estimatedEndDate: result.estimatedEndDate,
      totalManDays: result.totalManDays,
      daysPerWorker: result.daysPerWorker,
      note: result.note,
    };

    root.dispatchEvent(
      new CustomEvent("builder-tool:calculated", {
        bubbles: true,
        detail: {
          toolId: TOOL_ID,
          input: {
            projectName: result.projectName,
            workType: result.workType,
            startDate: result.startDate,
            workDays: result.workDays,
            workers: result.workers,
            offDays: result.offDays,
            note: result.note,
          },
          result: {
            estimatedEndDate: result.estimatedEndDate,
            totalManDays: result.totalManDays,
            daysPerWorker: result.daysPerWorker,
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
    root = root || document.querySelector("[data-builder-ass-root]");
    if (!root) return null;

    const inputs = root.querySelectorAll("[data-builder-ass-input]");
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
    calculateEndDate,
    formatManDays,
    formatDays,
    formatDisplayDate,
    readFromRoot,
    applyToRoot,
    mount,
    MAX_DIAGNOSTICS,
    DIAGNOSTIC_MESSAGES,
  };

  if (global.BuilderConstructionTools && typeof global.BuilderConstructionTools.register === "function") {
    global.BuilderConstructionTools.register(tool);
  }

  global.BuilderToolAiScheduleSuggest = tool;
})(typeof window !== "undefined" ? window : globalThis);
