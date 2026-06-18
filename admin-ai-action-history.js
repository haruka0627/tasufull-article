/**
 * AI運営司令塔 — 実行履歴ビュー（tasu_ai_action_audit_log_v1）
 */
(function (global) {
  "use strict";

  const Ex = () => global.TasuAdminAiActionExecutor;

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatDateTime(iso) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString("ja-JP", {
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return String(iso).slice(0, 16);
    }
  }

  function actionTypeLabel(type) {
    const map = {
      review_only: "詳細確認",
      prepare_reply: "返信準備",
      send_reply: "返信送信準備",
      bulk_resolve: "一括整理",
      open_detail: "詳細表示",
    };
    return map[String(type || "")] || String(type || "—");
  }

  function jsonBlock(obj) {
    if (obj == null) return "—";
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return String(obj);
    }
  }

  function renderAuditDetail(entry) {
    const host = global.document?.querySelector("[data-ops-action-audit-modal-body]");
    const titleEl = global.document?.querySelector("[data-ops-action-audit-modal-title]");
    if (!host || !entry) return;

    if (titleEl) titleEl.textContent = entry.title || "実行履歴の詳細";

    const attach =
      Array.isArray(entry.attachments) && entry.attachments.length
        ? `<section class="ops-ai-action-modal__block"><h3 class="ops-ai-action-modal__label">添付候補</h3><ul class="ops-ai-action-modal__list">${entry.attachments
            .map((a) => `<li>${esc(a)}</li>`)
            .join("")}</ul></section>`
        : "";
    const body = entry.bodyText
      ? `<section class="ops-ai-action-modal__block"><h3 class="ops-ai-action-modal__label">送信文</h3><pre class="ops-ai-action-modal__pre">${esc(entry.bodyText)}</pre></section>`
      : "";
    const warn =
      Array.isArray(entry.warnings) && entry.warnings.length
        ? `<section class="ops-ai-action-modal__block ops-ai-action-modal__block--warn"><h3 class="ops-ai-action-modal__label">注意点</h3><ul class="ops-ai-action-modal__list">${entry.warnings
            .map((w) => `<li>${esc(w)}</li>`)
            .join("")}</ul></section>`
        : "";

    host.innerHTML =
      `<section class="ops-ai-action-modal__block"><h3 class="ops-ai-action-modal__label">実行日時</h3><p class="ops-ai-action-modal__text">${esc(formatDateTime(entry.executedAt))}</p></section>` +
      `<section class="ops-ai-action-modal__block"><h3 class="ops-ai-action-modal__label">actionType / Level</h3><p class="ops-ai-action-modal__text">${esc(actionTypeLabel(entry.actionType))} · Lv.${esc(entry.actionLevel || "—")}</p></section>` +
      `<section class="ops-ai-action-modal__block"><h3 class="ops-ai-action-modal__label">対象</h3><p class="ops-ai-action-modal__text">${esc(entry.target || entry.title || "—")}</p></section>` +
      `<section class="ops-ai-action-modal__block"><h3 class="ops-ai-action-modal__label">AI判断</h3><p class="ops-ai-action-modal__text">${esc(entry.aiJudgement || "—")}</p></section>` +
      `<section class="ops-ai-action-modal__block"><h3 class="ops-ai-action-modal__label">推奨行動</h3><p class="ops-ai-action-modal__text">${esc(entry.recommendation || "—")}</p></section>` +
      `<section class="ops-ai-action-modal__block"><h3 class="ops-ai-action-modal__label">実行者</h3><p class="ops-ai-action-modal__text">${esc(entry.executedBy || "—")}</p></section>` +
      `<section class="ops-ai-action-modal__block"><h3 class="ops-ai-action-modal__label">結果</h3><p class="ops-ai-action-modal__text">${esc(entry.result || "—")}</p></section>` +
      `<section class="ops-ai-action-modal__block"><h3 class="ops-ai-action-modal__label">実行前 (before)</h3><pre class="ops-ai-action-modal__pre">${esc(jsonBlock(entry.before))}</pre></section>` +
      `<section class="ops-ai-action-modal__block"><h3 class="ops-ai-action-modal__label">実行後 (after)</h3><pre class="ops-ai-action-modal__pre">${esc(jsonBlock(entry.after))}</pre></section>` +
      body +
      attach +
      warn;
  }

  function openAuditModal(entryId) {
    const modal = global.document?.querySelector("[data-ops-action-audit-modal]");
    const log = Ex()?.readAuditLog?.() || [];
    const entry = log.find((e) => String(e.id || e.actionId) === String(entryId));
    if (!modal || !entry) return;
    modal.dataset.auditId = entry.id || entry.actionId || "";
    renderAuditDetail(entry);
    modal.hidden = false;
  }

  function closeAuditModal() {
    const modal = global.document?.querySelector("[data-ops-action-audit-modal]");
    if (!modal) return;
    modal.hidden = true;
    delete modal.dataset.auditId;
  }

  function renderHistoryTable() {
    const host = global.document?.querySelector("[data-ops-action-history-body]");
    if (!host) return;

    const log = Ex()?.readAuditLog?.() || [];
    if (!log.length) {
      host.innerHTML = `<p class="ops-ai-action-history__empty">AI実行履歴はまだありません</p>`;
      return;
    }

    const rows = log
      .map((entry) => {
        const id = entry.id || entry.actionId || "";
        const level = entry.actionLevel != null ? `Lv.${entry.actionLevel}` : "—";
        return (
          `<tr data-ops-action-history-row="${esc(id)}">` +
          `<td class="ops-ai-action-history__cell ops-ai-action-history__cell--time">${esc(formatDateTime(entry.executedAt))}</td>` +
          `<td class="ops-ai-action-history__cell">${esc(actionTypeLabel(entry.actionType))}<span class="ops-ai-action-history__level">${esc(level)}</span></td>` +
          `<td class="ops-ai-action-history__cell">${esc(entry.target || "—")}</td>` +
          `<td class="ops-ai-action-history__cell ops-ai-action-history__cell--title">${esc(entry.title || "—")}</td>` +
          `<td class="ops-ai-action-history__cell ops-ai-action-history__cell--wrap">${esc(entry.aiJudgement || "—")}</td>` +
          `<td class="ops-ai-action-history__cell ops-ai-action-history__cell--wrap">${esc(entry.recommendation || "—")}</td>` +
          `<td class="ops-ai-action-history__cell">${esc(entry.executedBy || "—")}</td>` +
          `<td class="ops-ai-action-history__cell ops-ai-action-history__cell--wrap">${esc(entry.result || "—")}</td>` +
          `<td class="ops-ai-action-history__cell ops-ai-action-history__cell--action">` +
          `<button type="button" class="ops-ai-action-history__detail-btn" data-ops-action-audit-open="${esc(id)}">詳細</button>` +
          `</td>` +
          `</tr>`
        );
      })
      .join("");

    host.innerHTML =
      `<div class="ops-ai-action-history__table-wrap">` +
      `<table class="ops-ai-action-history__table">` +
      `<thead><tr>` +
      `<th scope="col">実行日時</th>` +
      `<th scope="col">actionType</th>` +
      `<th scope="col">対象</th>` +
      `<th scope="col">タイトル</th>` +
      `<th scope="col">AI判断</th>` +
      `<th scope="col">推奨行動</th>` +
      `<th scope="col">実行者</th>` +
      `<th scope="col">結果</th>` +
      `<th scope="col">詳細</th>` +
      `</tr></thead>` +
      `<tbody>${rows}</tbody>` +
      `</table></div>`;
  }

  function bindHistory() {
    const section = global.document?.querySelector("[data-ops-action-history]");
    if (!section || section.dataset.wired === "1") return;
    section.dataset.wired = "1";

    section.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-ops-action-audit-open]");
      if (!btn) return;
      e.preventDefault();
      openAuditModal(btn.getAttribute("data-ops-action-audit-open"));
    });

    const modal = global.document?.querySelector("[data-ops-action-audit-modal]");
    if (modal && modal.dataset.wired !== "1") {
      modal.dataset.wired = "1";
      modal.querySelector("[data-ops-action-audit-modal-backdrop]")?.addEventListener("click", closeAuditModal);
      modal.querySelector("[data-ops-action-audit-modal-close]")?.addEventListener("click", closeAuditModal);
      global.document?.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && modal && !modal.hidden) closeAuditModal();
      });
    }
  }

  function render() {
    renderHistoryTable();
    bindHistory();
  }

  function init() {
    render();
  }

  global.TasuAdminAiActionHistory = {
    render,
    init,
    openAuditModal,
    closeAuditModal,
  };

  if (global.document?.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(typeof window !== "undefined" ? window : globalThis);
