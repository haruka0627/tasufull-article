/**
 * 取引管理デモページ — 描画・インタラクション
 */
(function () {
  "use strict";

  const UNPAID_STORAGE_KEY = "tasful_demo_unpaid_paid_ids";

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getProgressDeals() {
    const api = window.TasuDemoDealsData;
    if (typeof api?.getProgressDeals === "function") {
      return api.getProgressDeals();
    }
    return api?.PROGRESS || [];
  }

  function clampProgress(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(100, Math.round(n)));
  }

  function resolveDealDetailHref(item) {
    const id = String(item?.id || "").trim();
    if (item?.detailHref && item.detailHref !== "#") return item.detailHref;
    if (window.TasuDemoDealsData?.buildDealDetailHref) {
      return window.TasuDemoDealsData.buildDealDetailHref(id);
    }
    return id ? `deal-detail.html?id=${encodeURIComponent(id)}` : "deal-detail.html";
  }

  function buildProgressDealCardHtml(item, { interactive = true } = {}) {
    const percent = clampProgress(item.progressPercent);
    const statusKey = esc(item.statusKey || "working");
    const detailHref = esc(resolveDealDetailHref(item));
    const tagName = interactive ? "a" : "div";
    const attrs = interactive
      ? ` class="demo-progress-deal-card demo-deal-card demo-deal-card--progress" href="${detailHref}" data-demo-deal-id="${esc(item.id)}"`
      : ` class="demo-progress-deal-card demo-deal-card demo-deal-card--progress"`;

    return (
      `<${tagName}${attrs}>` +
      `<div class="demo-progress-deal-card__head">` +
      `<h2 class="demo-progress-deal-card__title">${esc(item.title)}</h2>` +
      `<span class="demo-progress-deal-card__status demo-progress-deal-card__status--${statusKey}">${esc(item.status)}</span>` +
      `</div>` +
      `<dl class="demo-progress-deal-card__rows">` +
      `<div class="demo-progress-deal-card__row"><dt>依頼者</dt><dd>${esc(item.clientName)}</dd></div>` +
      `<div class="demo-progress-deal-card__row demo-progress-deal-card__row--progress">` +
      `<dt>進捗</dt>` +
      `<dd>` +
      `<div class="demo-progress-deal-card__progress">` +
      `<div class="demo-progress-deal-card__progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}" aria-label="進捗 ${percent}パーセント">` +
      `<span class="demo-progress-deal-card__progress-fill" style="width:${percent}%"></span>` +
      `</div>` +
      `<span class="demo-progress-deal-card__progress-value">${percent}%</span>` +
      `</div>` +
      `</dd></div>` +
      `<div class="demo-progress-deal-card__row"><dt>最終更新</dt><dd>${esc(item.updatedLabel)}</dd></div>` +
      `</dl>` +
      `</${tagName}>`
    );
  }

  function buildProgressDealsListHtml() {
    const items = getProgressDeals();
    if (!items.length) {
      return '<p class="demo-deals-empty">進行中の取引はありません（デモ）</p>';
    }
    return (
      `<ul class="demo-deals-list demo-deals-list--progress">` +
      items.map((item) => `<li>${buildProgressDealCardHtml(item)}</li>`).join("") +
      `</ul>`
    );
  }

  function bindProgressDealActions(root) {
    root.querySelectorAll("[data-demo-complete-report]").forEach((btn) => {
      if (btn.dataset.demoCompleteReportBound === "1") return;
      btn.dataset.demoCompleteReportBound = "1";
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        window.alert("デモ：完了報告を受け付けました（実際の処理は行いません）");
      });
    });
    root.querySelectorAll("[data-deal-card-stop-nav]").forEach((el) => {
      el.addEventListener("click", (event) => event.stopPropagation());
    });
  }

  function readPaidUnpaidIds() {
    try {
      const raw = localStorage.getItem(UNPAID_STORAGE_KEY);
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }

  function writePaidUnpaidIds(ids) {
    localStorage.setItem(UNPAID_STORAGE_KEY, JSON.stringify([...new Set(ids)]));
  }

  function markUnpaidAsPaid(id) {
    const ids = readPaidUnpaidIds();
    if (!ids.includes(id)) {
      ids.push(id);
      writePaidUnpaidIds(ids);
    }
  }

  function renderProgress(listEl) {
    const items = getProgressDeals();
    if (!items.length) {
      listEl.innerHTML = '<li><p class="demo-deals-empty">進行中の取引はありません（デモ）</p></li>';
      return;
    }

    listEl.innerHTML = items
      .map((item) => {
        const chatHref = esc(item.chatHref || "talk-home.html?tab=chat");
        return (
          `<li>` +
          `<article class="demo-deal-card demo-deal-card--progress-wrap">` +
          buildProgressDealCardHtml(item) +
          `<div class="demo-deal-card__aside demo-deal-card__aside--progress">` +
          `<div class="demo-deal-card__actions demo-deal-card__actions--triple">` +
          `<a class="demo-deal-btn demo-deal-btn--chat" href="${chatHref}" data-deal-card-stop-nav>チャット</a>` +
          `<button type="button" class="demo-deal-btn demo-deal-btn--gold" data-demo-complete-report data-deal-card-stop-nav>完了報告</button>` +
          `</div></div></article></li>`
        );
      })
      .join("");

    bindProgressDealActions(listEl);
  }

  function renderProgressMobile(hostEl) {
    if (!hostEl) return;
    hostEl.innerHTML = buildProgressDealsListHtml();
  }

  function renderComplete(listEl) {
    const items = window.TasuDemoDealsData?.COMPLETE || [];
    listEl.innerHTML = items
      .map(
        (item) => `
      <li>
        <article class="demo-deal-card">
          <div class="demo-deal-card__main">
            <div class="demo-deal-card__tags">
              <span class="demo-deal-card__tag demo-deal-card__tag--done">${esc(item.status)}</span>
              <span class="demo-deal-card__tag">完了日 ${esc(item.completedDate)}</span>
            </div>
            <h2 class="demo-deal-card__title">${esc(item.project)}</h2>
            <p class="demo-deal-card__meta">相手：${esc(item.partner)}</p>
            <p class="demo-deal-card__amount">${esc(item.amount)}</p>
          </div>
          <div class="demo-deal-card__aside">
            <div class="demo-deal-card__actions">
              <button type="button" class="demo-deal-btn demo-deal-btn--gold" data-demo-rate>評価する</button>
              <a class="demo-deal-btn demo-deal-btn--ghost" href="#">詳細を見る</a>
            </div>
          </div>
        </article>
      </li>`
      )
      .join("");

    listEl.querySelectorAll("[data-demo-rate]").forEach((btn) => {
      btn.addEventListener("click", () => {
        window.alert("デモ：評価画面は準備中です");
      });
    });
  }

  function bindReceiptModal() {
    const modal = $("[data-demo-receipt-modal]");
    if (!modal) return;

    const close = () => {
      modal.hidden = true;
    };

    modal.querySelectorAll("[data-demo-modal-close]").forEach((el) => {
      el.addEventListener("click", close);
    });

    document.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-demo-receipt]");
      if (!btn) return;
      event.preventDefault();
      const project = btn.getAttribute("data-project") || "";
      const body = $("[data-demo-receipt-body]", modal);
      if (body) {
        body.textContent = `案件「${project}」のダミー領収書です。実際のPDFダウンロードは今後対応予定です。`;
      }
      modal.hidden = false;
    });
  }

  function renderPaid(listEl) {
    const items = window.TasuDemoDealsData?.PAID || [];
    listEl.innerHTML = items
      .map(
        (item) => `
      <li>
        <article class="demo-deal-card">
          <div class="demo-deal-card__main">
            <div class="demo-deal-card__tags">
              <span class="demo-deal-card__tag">支払日 ${esc(item.paidDate)}</span>
            </div>
            <h2 class="demo-deal-card__title">${esc(item.project)}</h2>
            <p class="demo-deal-card__meta">TASFUL手数料</p>
            <p class="demo-deal-card__amount">${esc(item.fee)}</p>
          </div>
          <div class="demo-deal-card__aside">
            <div class="demo-deal-card__actions">
              <button type="button" class="demo-deal-btn demo-deal-btn--gold" data-demo-receipt data-project="${esc(item.project)}">領収書</button>
            </div>
          </div>
        </article>
      </li>`
      )
      .join("");
  }

  function renderUnpaid(listEl, countEl) {
    const paidIds = new Set(readPaidUnpaidIds());
    const items = (window.TasuDemoDealsData?.UNPAID || []).filter((item) => !paidIds.has(item.id));
    if (countEl) countEl.textContent = String(items.length);

    if (!items.length) {
      listEl.innerHTML = '<li><p class="demo-deals-empty">未払いの手数料はありません（デモ）</p></li>';
      return;
    }

    listEl.innerHTML = items
      .map(
        (item) => `
      <li>
        <article class="demo-deal-card" data-demo-unpaid-id="${esc(item.id)}">
          <div class="demo-deal-card__main">
            <div class="demo-deal-card__tags">
              <span class="demo-deal-card__tag demo-deal-card__tag--warn">支払期限 ${esc(item.dueDate)}</span>
            </div>
            <h2 class="demo-deal-card__title">${esc(item.project)}</h2>
            <p class="demo-deal-card__meta">TASFUL手数料（未払い）</p>
            <p class="demo-deal-card__amount">${esc(item.fee)}</p>
          </div>
          <div class="demo-deal-card__aside">
            <div class="demo-deal-card__actions">
              <button type="button" class="demo-deal-btn demo-deal-btn--pay" data-demo-pay data-id="${esc(item.id)}">支払う</button>
            </div>
          </div>
        </article>
      </li>`
      )
      .join("");

    listEl.querySelectorAll("[data-demo-pay]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id") || "";
        markUnpaidAsPaid(id);
        renderUnpaid(listEl, countEl);
        refreshSidebarStats();
        window.alert("デモ：支払い済みに更新しました");
      });
    });
  }

  function getNavStats() {
    const base = window.TasuDemoDealsData?.NAV_STATS || {
      ongoing: 0,
      completed: 0,
      feeUnpaid: 0,
      feePaid: 0,
    };
    const paidIds = new Set(readPaidUnpaidIds());
    const feeUnpaid = (window.TasuDemoDealsData?.UNPAID || []).filter(
      (item) => !paidIds.has(item.id)
    ).length;
    return { ...base, feeUnpaid, ongoing: getProgressDeals().length };
  }

  function refreshSidebarStats() {
    if (typeof window.TasuDashboardShell?.renderSidebar === "function") {
      window.TasuDashboardShell.renderSidebar(getNavStats());
    }
  }

  function dispatchProgressRendered() {
    document.dispatchEvent(new CustomEvent("tasu:demo-progress-rendered", { bubbles: true }));
  }

  function init(page) {
    const listEl = $("[data-demo-deals-list]");
    const countEl = $("[data-demo-deals-count]");
    if (!listEl) return;

    if (page === "demo-progress") {
      if (countEl) countEl.textContent = String(getProgressDeals().length);
      renderProgress(listEl);
      dispatchProgressRendered();
    } else if (page === "demo-complete") {
      if (countEl) countEl.textContent = String(window.TasuDemoDealsData?.COMPLETE?.length || 0);
      renderComplete(listEl);
    } else if (page === "demo-paid") {
      if (countEl) countEl.textContent = String(window.TasuDemoDealsData?.PAID?.length || 0);
      renderPaid(listEl);
      bindReceiptModal();
    } else if (page === "demo-unpaid") {
      renderUnpaid(listEl, countEl);
    }
  }

  window.TasuDemoDeals = {
    init,
    getNavStats,
    getProgressDeals,
    buildProgressDealCardHtml,
    buildProgressDealsListHtml,
    renderProgressMobile,
    readPaidUnpaidIds,
    markUnpaidAsPaid,
  };

  (function ensureDemoBoot() {
    const page = document.body?.dataset?.page;
    if (!page?.startsWith("demo-")) return;
    const boot = () => {
      const list = document.querySelector("[data-demo-deals-list]");
      if (!list) return;
      if (page === "demo-progress" && list.querySelector(".demo-progress-deal-card")) return;
      if (page !== "demo-progress" && list.querySelector(".demo-deal-card")) return;
      init(page);
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", boot);
    } else {
      boot();
    }
  })();
})();
