/**
 * AI運営司令塔 — Lv.4 / Lv.5 本番連携前チェックリスト
 */
(function (global) {
  "use strict";

  const CHECKLIST_STATUS = Object.freeze({
    disconnected: "未接続",
    unchecked: "未確認",
    confirmed: "確認済み",
    needsReview: "要レビュー",
    implemented: "実装済み",
  });

  const LV4_TEMPLATE = Object.freeze([
    { id: "api_endpoint", label: "API接続先" },
    { id: "send_target", label: "送信先" },
    { id: "attachments", label: "添付資料" },
    { id: "body_text", label: "本文" },
    { id: "role_permission", label: "権限ロール" },
    { id: "audit_log", label: "監査ログ" },
    { id: "duplicate_send_guard", label: "二重送信防止" },
    { id: "retry_on_failure", label: "失敗時の再試行" },
    { id: "rollback", label: "ロールバック方法" },
  ]);

  const LV5_TEMPLATE = Object.freeze([
    { id: "change_target", label: "変更対象" },
    { id: "before_value", label: "変更前" },
    { id: "after_value", label: "変更後" },
    { id: "impact_scope", label: "影響範囲" },
    { id: "role_permission", label: "権限ロール" },
    { id: "audit_log", label: "監査ログ" },
    { id: "duplicate_exec_guard", label: "二重実行防止" },
    { id: "rollback", label: "ロールバック方法" },
    { id: "hiro_final_approval", label: "ひろの最終承認" },
  ]);

  const STATUS_CLASS = Object.freeze({
    未接続: "disconnected",
    未確認: "unchecked",
    確認済み: "confirmed",
    要レビュー: "needs-review",
    実装済み: "implemented",
  });

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function resolveLv4Status(id, row) {
    const p = row.executionPayload || {};
    const override = p.preflightStates?.[id];
    if (override && Object.values(CHECKLIST_STATUS).includes(override)) return override;

    switch (id) {
      case "api_endpoint":
        return CHECKLIST_STATUS.disconnected;
      case "send_target":
        return p.connectId || p.ticketId ? CHECKLIST_STATUS.unchecked : CHECKLIST_STATUS.disconnected;
      case "attachments":
        return (p.attachments || []).length > 0 ? CHECKLIST_STATUS.confirmed : CHECKLIST_STATUS.unchecked;
      case "body_text":
        return p.bodyText ? CHECKLIST_STATUS.confirmed : CHECKLIST_STATUS.unchecked;
      case "role_permission":
        return CHECKLIST_STATUS.needsReview;
      case "audit_log":
        return CHECKLIST_STATUS.implemented;
      case "duplicate_send_guard":
      case "retry_on_failure":
        return CHECKLIST_STATUS.disconnected;
      case "rollback":
        return CHECKLIST_STATUS.unchecked;
      default:
        return CHECKLIST_STATUS.unchecked;
    }
  }

  function resolveLv5Status(id, row) {
    const p = row.executionPayload || {};
    const override = p.preflightStates?.[id];
    if (override && Object.values(CHECKLIST_STATUS).includes(override)) return override;

    switch (id) {
      case "change_target":
        return p.changeTarget || p.target ? CHECKLIST_STATUS.confirmed : CHECKLIST_STATUS.unchecked;
      case "before_value":
        return p.beforeValue ? CHECKLIST_STATUS.confirmed : CHECKLIST_STATUS.unchecked;
      case "after_value":
        return p.afterValue ? CHECKLIST_STATUS.needsReview : CHECKLIST_STATUS.unchecked;
      case "impact_scope":
        return p.impactScope ? CHECKLIST_STATUS.needsReview : CHECKLIST_STATUS.unchecked;
      case "role_permission":
        return CHECKLIST_STATUS.needsReview;
      case "audit_log":
        return CHECKLIST_STATUS.implemented;
      case "duplicate_exec_guard":
        return CHECKLIST_STATUS.disconnected;
      case "rollback":
        return CHECKLIST_STATUS.unchecked;
      case "hiro_final_approval":
        return CHECKLIST_STATUS.unchecked;
      default:
        return CHECKLIST_STATUS.unchecked;
    }
  }

  function buildChecklistItems(level, row) {
    const template = Number(level) >= 5 ? LV5_TEMPLATE : LV4_TEMPLATE;
    const resolver = Number(level) >= 5 ? resolveLv5Status : resolveLv4Status;
    return template.map((item) => ({
      ...item,
      status: resolver(item.id, row),
    }));
  }

  function renderChecklistHtml(level, row) {
    const items = buildChecklistItems(level, row);
    const list = items
      .map((item) => {
        const mod = STATUS_CLASS[item.status] || "unchecked";
        return (
          `<li class="ops-ai-preflight-check__item">` +
          `<span class="ops-ai-preflight-check__label">${esc(item.label)}</span>` +
          `<span class="ops-ai-preflight-check__status ops-ai-preflight-check__status--${mod}">${esc(item.status)}</span>` +
          `</li>`
        );
      })
      .join("");
    return (
      `<section class="ops-ai-action-modal__block ops-ai-preflight-check">` +
      `<h3 class="ops-ai-action-modal__label">本番連携前チェックリスト</h3>` +
      `<ul class="ops-ai-preflight-check__list">${list}</ul>` +
      `</section>`
    );
  }

  function renderSummaryHtml(row) {
    const Ex = global.TasuAdminAiActionExecutor;
    const level = Ex?.inferActionLevel?.(row.actionType, row.actionLevel) ?? row.actionLevel ?? 4;
    const label = Ex?.getActionLevelLabel?.(level) || `Lv.${level}`;
    return (
      `<details class="ops-ai-preflight-check__summary-fold">` +
      `<summary class="ops-ai-preflight-check__summary-fold-btn">案件概要（タップで開く）</summary>` +
      `<div class="ops-ai-preflight-check__summary-fold-body">` +
      `<p class="ops-ai-action-modal__text"><strong>対象:</strong> ${esc(row.happened)}</p>` +
      `<p class="ops-ai-action-modal__text"><strong>Lv.${esc(level)}</strong> ${esc(label)}</p>` +
      `<p class="ops-ai-action-modal__text"><strong>AI判断:</strong> ${esc(row.aiDecision)}</p>` +
      `<p class="ops-ai-action-modal__text"><strong>推奨行動:</strong> ${esc(row.recommendation)}</p>` +
      `</div></details>`
    );
  }

  function setModalRunVisible(visible) {
    const runBtn = global.document?.querySelector("[data-ops-action-modal-run]");
    if (runBtn) runBtn.hidden = !visible;
  }

  function openPreflightModal(row) {
    const Ex = global.TasuAdminAiActionExecutor;
    if (!Ex || !row) return;
    const level = Ex.inferActionLevel(row.actionType, row.actionLevel);
    if (!Ex.isLevelBlocked(level)) return;

    const modal = global.document?.querySelector("[data-ops-action-modal]");
    const host = global.document?.querySelector("[data-ops-action-modal-body]");
    const titleEl = global.document?.querySelector("[data-ops-action-modal-title]");
    if (!modal || !host) return;

    setModalRunVisible(false);
    modal.dataset.mode = "preflight";
    modal.dataset.actionId = row.id;
    modal.dataset.actionLevel = String(level);

    if (titleEl) titleEl.textContent = "詳細 — 本番連携前チェック";

    host.innerHTML =
      `<div class="ops-ai-preflight-check__notice-wrap">` +
      `<p class="ops-ai-preflight-check__notice">この操作は本番連携前のため実行できません</p>` +
      `</div>` +
      renderChecklistHtml(level, row) +
      renderSummaryHtml(row);

    modal.hidden = false;
  }

  function bindPreflightDetail() {
    const root = global.document?.querySelector("[data-ops-action-board]");
    if (!root || root.dataset.preflightWired === "1") return;
    root.dataset.preflightWired = "1";

    root.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-ops-action-preflight-detail]");
      if (!btn) return;
      e.preventDefault();
      const id = btn.getAttribute("data-ops-action-preflight-detail");
      const row = global.TasuAdminAiActionExecutor?.getBoardRow?.(id);
      if (row) openPreflightModal(row);
    });
  }

  function init() {
    bindPreflightDetail();
    const modal = global.document?.querySelector("[data-ops-action-modal]");
    if (modal && modal.dataset.preflightHook !== "1") {
      modal.dataset.preflightHook = "1";
      modal.querySelector("[data-ops-action-modal-cancel]")?.addEventListener("click", () => {
        if (modal.dataset.mode === "preflight") {
          delete modal.dataset.mode;
          delete modal.dataset.actionLevel;
        }
      });
      modal.querySelector("[data-ops-action-modal-backdrop]")?.addEventListener("click", () => {
        if (modal.dataset.mode === "preflight") {
          delete modal.dataset.mode;
          delete modal.dataset.actionLevel;
        }
      });
    }
  }

  global.TasuAdminAiActionPreflightChecklist = {
    CHECKLIST_STATUS,
    LV4_TEMPLATE,
    LV5_TEMPLATE,
    buildChecklistItems,
    renderChecklistHtml,
    openPreflightModal,
    setModalRunVisible,
    init,
  };

  if (global.document?.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(typeof window !== "undefined" ? window : globalThis);
