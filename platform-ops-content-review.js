/**
 * Platform OPS-FLOW-2 — 掲載審査パネル (#ops-content-gate)
 * listPendingReview / applyReviewAction を接続
 */
(function (global) {
  "use strict";

  let selected = null;
  let pendingItems = [];

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function parseParams() {
    return global.TasuPlatformOpsActionUrl?.parseReviewParams?.(global.location?.search) || {
      target_type: "",
      target_id: "",
      moderation_status: "",
      event_type: "",
      mode: "",
    };
  }

  function findSelected(items, params) {
    const tid = String(params.target_id || "").trim();
    const table = String(params.target_type || "listings").trim();
    if (!tid) return items[0] || null;
    return (
      items.find((x) => String(x.id) === tid && String(x.table || "listings") === table) ||
      items.find((x) => String(x.id) === tid) ||
      null
    );
  }

  async function loadPending() {
    const Queue = global.TasuPlatformModerationQueue;
    if (!Queue?.listPendingReview) return [];
    return Queue.listPendingReview({ limit: 100 });
  }

  function renderDetail(item, params) {
    const host = global.document?.querySelector("[data-ops-content-review-detail]");
    if (!host) return;

    if (params.mode === "critical" && !item) {
      host.innerHTML =
        `<div class="ops-ai-inbox-item" data-ops-review-highlight>` +
        `<p><strong>${esc(params.event_type || "critical")}</strong></p>` +
        `<p>対象 ID: ${esc(params.target_id || "—")}</p>` +
        `<p class="ops-ai-inbox-item__reason">連絡先流出またはブロックイベント — ログ確認後「確認済み」で完了できます。</p>` +
        `<div class="ops-ai-inbox-item__btns">` +
        `<button type="button" class="ops-ai-inbox-btn ops-ai-inbox-btn--primary" data-ops-review-ack>確認済み</button>` +
        `</div></div>`;
      host.querySelector("[data-ops-review-highlight]")?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
      return;
    }

    if (!item) {
      host.innerHTML =
        `<p class="ops-ai-inbox-section__empty">審査待ちの対象が見つかりません（処理済みまたはローカルのみの可能性があります）</p>`;
      return;
    }

    selected = item;
    const flags = Array.isArray(item.moderation_flags)
      ? item.moderation_flags.join(", ")
      : "";

    host.innerHTML =
      `<div class="ops-ai-inbox-item ops-ai-inbox-item--selected" data-ops-review-highlight>` +
      `<h3 class="ops-ai-inbox-item__title">${esc(item.title || "（無題）")}</h3>` +
      `<p class="ops-ai-inbox-item__target">table: ${esc(item.table)} · id: ${esc(item.id)}</p>` +
      `<p class="ops-ai-inbox-item__reason">` +
      `publish: ${esc(item.publish_status)} · moderation: ${esc(item.moderation_status)}` +
      (flags ? `<br>flags: ${esc(flags)}` : "") +
      (item.moderation_reason ? `<br>reason: ${esc(item.moderation_reason)}` : "") +
      `</p>` +
      `<div class="ops-ai-inbox-item__btns">` +
      `<button type="button" class="ops-ai-inbox-btn ops-ai-inbox-btn--primary" data-ops-review-approve>承認（公開）</button>` +
      `<button type="button" class="ops-ai-inbox-btn ops-ai-inbox-btn--ghost" data-ops-review-reject>却下</button>` +
      `</div></div>`;
    host.querySelector("[data-ops-review-highlight]")?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }

  function renderList(items, params) {
    const host = global.document?.querySelector("[data-ops-content-review-list]");
    if (!host) return;

    if (!items.length) {
      host.innerHTML = `<p class="ops-ai-inbox-section__empty">pending_review は 0 件です</p>`;
      return;
    }

    host.innerHTML = items
      .map((item) => {
        const isSel =
          selected &&
          String(selected.id) === String(item.id) &&
          String(selected.table) === String(item.table);
        return (
          `<button type="button" class="ops-ai-inbox-btn${isSel ? " is-active" : ""}" ` +
          `data-ops-review-pick data-id="${esc(item.id)}" data-table="${esc(item.table)}" ` +
          `style="display:block;width:100%;text-align:left;margin-bottom:6px">` +
          `<strong>${esc(item.title || item.id)}</strong><br>` +
          `<small>${esc(item.table)} · ${esc(item.moderation_status)}</small>` +
          `</button>`
        );
      })
      .join("");

    const pick = findSelected(items, params);
    if (pick) {
      selected = pick;
      const btn = host.querySelector(`[data-ops-review-pick][data-id="${String(pick.id).replace(/"/g, '\\"')}"]`);
      btn?.scrollIntoView?.({ block: "nearest" });
    }
  }

  async function refresh() {
    const params = parseParams();
    pendingItems = await loadPending();
    renderList(pendingItems, params);
    const item = findSelected(pendingItems, params);
    renderDetail(item, params);
  }

  async function runAction(action) {
    if (!selected && parseParams().mode !== "critical") return;
    const Queue = global.TasuPlatformModerationQueue;
    const Bridge = global.TasuPlatformOpsInboxBridge;
    const params = parseParams();

    if (params.mode === "critical" && action === "ack") {
      if (params.event_id) {
        Bridge?.completeInboxItem?.(`inbox_cg_${params.event_id}`);
      }
      Bridge?.completeByReviewTarget?.(params.target_type, params.target_id);
      showToast("確認済みにしました");
      await refresh();
      global.TasuAdminAiDailyInbox?.renderDailyInbox?.();
      global.TasuAdminOperationsDashboard?.refresh?.();
      return;
    }

    if (!Queue?.applyReviewAction || !selected) return;
    const res = await Queue.applyReviewAction({
      id: selected.id,
      table: selected.table || "listings",
      action,
    });
    if (!res?.ok) {
      showToast(res?.error || "処理に失敗しました");
      return;
    }

    Bridge?.completeByReviewTarget?.(selected.table, selected.id);
    showToast(action === "approve" ? "承認しました" : "却下しました");
    selected = null;
    await refresh();
    global.TasuAdminAiDailyInbox?.renderDailyInbox?.();
    global.TasuAdminOperationsDashboard?.refresh?.();
  }

  function showToast(msg) {
    const el = global.document?.querySelector("[data-ops-content-review-toast]");
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    global.setTimeout(() => {
      el.hidden = true;
    }, 3000);
  }

  function scrollToPanel() {
    const panel = global.document?.getElementById("ops-content-gate");
    panel?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }

  function bindUi() {
    const root = global.document?.querySelector("[data-ops-content-review]");
    if (!root || root.dataset.bound === "1") return;
    root.dataset.bound = "1";

    root.addEventListener("click", (e) => {
      const pick = e.target.closest("[data-ops-review-pick]");
      if (pick) {
        const id = pick.getAttribute("data-id");
        const table = pick.getAttribute("data-table") || "listings";
        selected = pendingItems.find((x) => String(x.id) === id && String(x.table) === table) || null;
        renderList(pendingItems, parseParams());
        renderDetail(selected, parseParams());
        return;
      }
      if (e.target.closest("[data-ops-review-approve]")) {
        void runAction("approve");
      }
      if (e.target.closest("[data-ops-review-reject]")) {
        void runAction("reject");
      }
      if (e.target.closest("[data-ops-review-ack]")) {
        void runAction("ack");
      }
    });

    global.addEventListener("tasu:ops-content-review-completed", () => {
      void refresh();
    });
  }

  function initFromUrl() {
    const params = parseParams();
    if (params.target_id || params.mode === "critical" || global.location.hash === "#ops-content-gate") {
      scrollToPanel();
    }
    void refresh();
  }

  function init() {
    bindUi();
    initFromUrl();
  }

  global.TasuPlatformOpsContentReview = {
    refresh,
    init,
    scrollToPanel,
    parseParams,
  };

  if (global.document?.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(typeof window !== "undefined" ? window : globalThis);
