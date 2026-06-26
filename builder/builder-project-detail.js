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
    renderTimeline(project);
    renderVisionList(project);
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
