/**
 * Builder Project Hub — 案件詳細（Phase 6-A）
 */
(function (global) {
  "use strict";

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatDate(iso) {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return iso;
      return d.toLocaleString("ja-JP", { dateStyle: "medium", timeStyle: "short" });
    } catch {
      return String(iso);
    }
  }

  function getProjectIdFromUrl() {
    try {
      return new URLSearchParams(global.location?.search || "").get("id") || "";
    } catch {
      return "";
    }
  }

  function statusClass(status) {
    return `builder-ph-status builder-ph-status--${String(status || "inquiry").replace(/-/g, "_")}`;
  }

  let currentProject = null;

  function renderInfo(project) {
    const dl = $("[data-builder-pd-info]");
    const badge = $("[data-builder-pd-status-badge]");
    if (badge) {
      badge.className = statusClass(project.status);
      badge.textContent = project.statusLabel;
    }
    if (!dl) return;
    const rows = [
      ["案件ID", project.id],
      ["案件名", project.name],
      ["カテゴリ", project.categoryLabel],
      ["顧客名", project.customerName || "—"],
      ["連絡先", project.customerContact || "—"],
      ["担当業者", project.assignedVendor || "—"],
      ["ステータス", project.statusLabel],
      ["開始日", project.scheduleStartDate || "—"],
      ["終了日", project.scheduleEndDate || "—"],
      ["工程", project.schedulePhaseLabel || "—"],
      ["作成日", formatDate(project.createdAt)],
      ["更新日", formatDate(project.updatedAt)],
    ];
    dl.innerHTML = rows
      .map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`)
      .join("");
  }

  function renderTimeline(project) {
    const list = $("[data-builder-pd-timeline]");
    if (!list) return;
    const events = [...(project.timeline || [])].sort((a, b) =>
      String(b.at).localeCompare(String(a.at))
    );
    if (!events.length) {
      list.innerHTML = '<li><span class="builder-ph-timeline__label">（イベントなし）</span></li>';
      return;
    }
    list.innerHTML = events
      .map(
        (ev) =>
          `<li>` +
          `<div class="builder-ph-timeline__label">${escapeHtml(ev.label || ev.type)}</div>` +
          `<div class="builder-ph-timeline__at">${escapeHtml(formatDate(ev.at))}</div>` +
          (ev.detail ? `<p class="builder-ph-timeline__detail">${escapeHtml(ev.detail)}</p>` : "") +
          `</li>`
      )
      .join("");
  }

  function renderVisionList(project) {
    const wrap = $("[data-builder-pd-vision-list]");
    const empty = $("[data-builder-pd-vision-empty]");
    if (!wrap) return;
    const list = project.visionDiagnoses || [];
    if (!list.length) {
      wrap.innerHTML = "";
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;
    wrap.innerHTML = list
      .map((v) => {
        const d = v.diagnosis || {};
        return (
          `<article class="builder-ph-vision-card">` +
          `<div class="builder-ph-vision-card__meta">${escapeHtml(formatDate(v.at))} · ${escapeHtml(v.categoryLabel || d.categoryLabel || "")}</div>` +
          `<p><strong>状態:</strong> ${escapeHtml(d.condition || v.summary || "—")}</p>` +
          (d.aiComment ? `<p><strong>AIコメント:</strong> ${escapeHtml(d.aiComment)}</p>` : "") +
          `<p class="builder-kpi">${escapeHtml(d.safetyNotice || "本診断はAIの参考診断です。")}</p>` +
          `</article>`
        );
      })
      .join("");
  }

  function formatYen(amount) {
    const Store = global.TasuBuilderProjectStore;
    return Store?.formatYen?.(amount) || `¥${Number(amount || 0).toLocaleString("ja-JP")}`;
  }

  function renderFinanceReadonly(project) {
    const dl = $("[data-builder-pd-finance-readonly]");
    if (!dl) return;
    const f = project.finance || {};
    const rows = [
      ["粗利", formatYen(f.grossProfit)],
      ["粗利率", `${f.grossProfitRate ?? 0}%`],
    ];
    dl.innerHTML = rows
      .map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`)
      .join("");
  }

  function bindFinance(project) {
    const form = $("[data-builder-pd-finance-form]");
    const estimate = $("[data-builder-pd-finance-estimate]");
    const cost = $("[data-builder-pd-finance-cost]");
    const payment = $("[data-builder-pd-finance-payment-status]");
    const due = $("[data-builder-pd-finance-due]");
    const paid = $("[data-builder-pd-finance-paid]");
    const memo = $("[data-builder-pd-finance-memo]");
    const status = $("[data-builder-pd-finance-status]");
    const Store = global.TasuBuilderProjectStore;
    if (!form || !Store) return;

    const f = project.finance || {};
    if (payment && Store.PAYMENT_STATUSES) {
      payment.innerHTML = Store.PAYMENT_STATUSES.map(
        (s) =>
          `<option value="${escapeHtml(s.id)}"${s.id === f.paymentStatus ? " selected" : ""}>${escapeHtml(s.label)}</option>`
      ).join("");
    }
    if (estimate) estimate.value = f.estimateAmount ?? 0;
    if (cost) cost.value = f.costAmount ?? 0;
    if (due) due.value = f.paymentDueDate || "";
    if (paid) paid.value = f.paidAt || "";
    if (memo) memo.value = f.memo || "";

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const out = Store.updateFinance?.(project.id, {
        estimateAmount: estimate?.value,
        costAmount: cost?.value,
        paymentStatus: payment?.value,
        paymentDueDate: due?.value || "",
        paidAt: paid?.value || "",
        memo: memo?.value || "",
        financeReason: "案件詳細から収支を更新",
      });
      if (out?.ok) {
        currentProject = out.project;
        renderFinanceReadonly(currentProject);
        renderTimeline(currentProject);
        if (status) {
          status.textContent = "収支を保存しました";
          setTimeout(() => {
            status.textContent = "";
          }, 2000);
        }
      }
    });
  }

  function bindSchedule(project) {
    const form = $("[data-builder-pd-schedule-form]");
    const start = $("[data-builder-pd-schedule-start]");
    const end = $("[data-builder-pd-schedule-end]");
    const phase = $("[data-builder-pd-schedule-phase]");
    const status = $("[data-builder-pd-schedule-status]");
    const Store = global.TasuBuilderProjectStore;
    if (!form || !Store) return;

    if (phase && Store.SCHEDULE_PHASES) {
      phase.innerHTML = Store.SCHEDULE_PHASES.map(
        (p) =>
          `<option value="${escapeHtml(p.id)}"${p.id === project.schedulePhase ? " selected" : ""}>${escapeHtml(p.label)}</option>`
      ).join("");
    }
    if (start) start.value = project.scheduleStartDate || "";
    if (end) end.value = project.scheduleEndDate || "";

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const out = Store.updateSchedule?.(project.id, {
        scheduleStartDate: start?.value || "",
        scheduleEndDate: end?.value || "",
        schedulePhase: phase?.value || project.schedulePhase,
        reason: "案件詳細から日程を更新",
      });
      if (out?.ok) {
        currentProject = out.project;
        renderInfo(currentProject);
        renderTimeline(currentProject);
        if (status) {
          status.textContent = "日程を保存しました";
          setTimeout(() => {
            status.textContent = "";
          }, 2000);
        }
      }
    });
  }

  function bindMemo(project) {
    const ta = $("[data-builder-pd-memo]");
    const btn = $("[data-builder-pd-memo-save]");
    const status = $("[data-builder-pd-memo-status]");
    if (ta) ta.value = project.memo || "";
    btn?.addEventListener("click", () => {
      const Store = global.TasuBuilderProjectStore;
      const out = Store?.updateProject?.(project.id, { memo: ta?.value || "" });
      if (out?.ok) {
        currentProject = out.project;
        renderTimeline(currentProject);
        if (status) {
          status.textContent = "保存しました";
          setTimeout(() => {
            status.textContent = "";
          }, 2000);
        }
      }
    });
  }

  function bindAiLink(project) {
    const link = $("[data-builder-pd-ai-link]");
    if (!link) return;
    const q = new URLSearchParams({
      projectId: project.id,
      projectName: project.name,
    });
    link.href = `builder-ai.html?${q.toString()}`;
  }

  function showProject(project) {
    currentProject = project;
    $("[data-builder-pd-root]").hidden = false;
    $("[data-builder-pd-not-found]").hidden = true;
    const title = $("[data-builder-pd-title]");
    const sub = $("[data-builder-pd-sub]");
    if (title) title.textContent = project.name;
    if (sub) sub.textContent = `${project.id} · ${project.customerName || "顧客未設定"}`;
    renderInfo(project);
    renderFinanceReadonly(project);
    renderTimeline(project);
    renderVisionList(project);
    bindFinance(project);
    bindSchedule(project);
    bindAiLink(project);
    bindMemo(project);
  }

  function showNotFound() {
    $("[data-builder-pd-root]").hidden = true;
    $("[data-builder-pd-not-found]").hidden = false;
  }

  function init() {
    const Store = global.TasuBuilderProjectStore;
    const id = getProjectIdFromUrl();
    if (!id || !Store?.getProject) {
      showNotFound();
      return;
    }
    Store.ensureSeed?.();
    const project = Store.getProject(id);
    if (!project) {
      showNotFound();
      return;
    }
    showProject(project);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  global.TasuBuilderProjectDetail = { init, getProjectIdFromUrl };
})(typeof window !== "undefined" ? window : globalThis);
