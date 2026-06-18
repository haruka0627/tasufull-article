(function () {
  "use strict";

  const Data = window.TasfulMarketProductData;

  const STATUS_CLASS = {
    注文受付: "",
    発送準備中: "is-shipping",
    発送済み: "is-shipped",
    配達完了: "is-delivered",
    キャンセル: "is-cancelled",
  };

  const FILTER_STATUSES = ["注文受付", "発送準備中", "発送済み", "配達完了", "キャンセル"];

  const PERIOD_OPTIONS = [
    { id: "30d", label: "過去30日" },
    { id: "3m", label: "過去3か月" },
    { id: "1y", label: "過去1年" },
    { id: "all", label: "すべて" },
  ];

  const state = {
    allHistory: [],
    query: "",
    filters: {
      statuses: [],
      period: "all",
      shops: [],
    },
    draft: {
      statuses: [],
      period: "all",
      shops: [],
    },
    sheetOpen: false,
  };

  function esc(s) {
    return Data?.esc?.(s) ?? String(s ?? "");
  }

  function escAttr(s) {
    return Data?.escAttr?.(s) ?? String(s ?? "").replace(/"/g, "&quot;");
  }

  function normalizeSearchText(s) {
    return String(s || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function shopLabel(entry) {
    return String(entry?.sellerName || entry?.shopName || "出品者").trim();
  }

  function formatAddress(addr) {
    if (!addr || typeof addr !== "object") return "—";
    const parts = [addr.zip, addr.address].filter(Boolean);
    const nameLine = [addr.name, addr.phone].filter(Boolean).join(" / ");
    return [nameLine, ...parts].filter(Boolean).join("\n") || "—";
  }

  function statusClass(status) {
    return STATUS_CLASS[status] || "";
  }

  function periodStart(periodId) {
    const now = Date.now();
    if (periodId === "30d") return now - 30 * 24 * 60 * 60 * 1000;
    if (periodId === "3m") return now - 92 * 24 * 60 * 60 * 1000;
    if (periodId === "1y") return now - 365 * 24 * 60 * 60 * 1000;
    return 0;
  }

  function collectShopOptions(history) {
    const map = new Map();
    (history || []).forEach((entry) => {
      const name = shopLabel(entry);
      if (!name) return;
      if (!map.has(name)) map.set(name, { name, count: 0 });
      map.get(name).count += 1;
    });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "ja"));
  }

  function matchesSearch(entry, query) {
    const q = normalizeSearchText(query);
    if (!q) return true;
    const hay = normalizeSearchText(
      [entry.productName, entry.orderId, shopLabel(entry)].filter(Boolean).join(" ")
    );
    return hay.includes(q);
  }

  function matchesFilters(entry, filters) {
    if (filters.statuses.length && !filters.statuses.includes(entry.status)) return false;
    if (filters.shops.length && !filters.shops.includes(shopLabel(entry))) return false;
    if (filters.period && filters.period !== "all") {
      const start = periodStart(filters.period);
      const ts = new Date(entry.createdAt).getTime();
      if (!Number.isFinite(ts) || ts < start) return false;
    }
    return true;
  }

  function filterHistory(history) {
    return (history || []).filter(
      (entry) => matchesSearch(entry, state.query) && matchesFilters(entry, state.filters)
    );
  }

  function countActiveFilters(filters) {
    let n = 0;
    if (filters.statuses.length) n += 1;
    if (filters.period && filters.period !== "all") n += 1;
    if (filters.shops.length) n += 1;
    return n;
  }

  function cloneFilters(filters) {
    return {
      statuses: [...(filters.statuses || [])],
      period: filters.period || "all",
      shops: [...(filters.shops || [])],
    };
  }

  function renderDetail(entry, index) {
    const subtotal = entry.subtotal || entry.price * entry.quantity;
    const total = entry.orderTotal || subtotal;
    const connectHtml = entry.connectVerified
      ? '<span class="tasful-market-order-history-detail__connect">✓ Connect認証済み</span>'
      : "未認証";

    return `
      <div class="tasful-market-order-history-card__detail" id="order-detail-${index}" data-tasful-order-detail hidden>
        <h2 class="tasful-market-order-history-detail__title">注文詳細</h2>
        <dl class="tasful-market-order-history-detail__list">
          <div class="tasful-market-order-history-detail__row">
            <dt>注文番号</dt>
            <dd>${esc(entry.orderId)}</dd>
          </div>
          <div class="tasful-market-order-history-detail__row">
            <dt>商品</dt>
            <dd>${esc(entry.productName)} × ${entry.quantity}</dd>
          </div>
          <div class="tasful-market-order-history-detail__row">
            <dt>支払い方法</dt>
            <dd>${esc(entry.paymentMethod)}</dd>
          </div>
          <div class="tasful-market-order-history-detail__row">
            <dt>配送先</dt>
            <dd>${esc(formatAddress(entry.address)).replace(/\n/g, "<br>")}</dd>
          </div>
          <div class="tasful-market-order-history-detail__row">
            <dt>出品者</dt>
            <dd>${esc(shopLabel(entry))}</dd>
          </div>
          <div class="tasful-market-order-history-detail__row">
            <dt>Connect認証</dt>
            <dd>${connectHtml}</dd>
          </div>
          <div class="tasful-market-order-history-detail__row">
            <dt>合計金額</dt>
            <dd>${esc(Data.formatYenAmount(total))}</dd>
          </div>
          <div class="tasful-market-order-history-detail__row">
            <dt>注文日時</dt>
            <dd>${esc(Data.formatOrderDateTime(entry.createdAt))}</dd>
          </div>
        </dl>
      </div>`;
  }

  function renderCard(entry, index) {
    const subtotal = entry.subtotal || entry.price * entry.quantity;
    const imgSrc = Data.resolvePrimaryImage(entry) || Data.getFallbackImageUrl();
    const statusCls = statusClass(entry.status);
    return `
      <article class="tasful-market-order-history-card" data-tasful-order-card data-order-index="${index}" data-order-id="${escAttr(entry.orderId)}">
        <button type="button" class="tasful-market-order-history-card__toggle" data-tasful-order-toggle aria-expanded="false" aria-controls="order-detail-${index}">
          <div class="tasful-market-order-history-card__summary">
            <div class="tasful-market-order-history-card__img">
              <img src="${esc(imgSrc)}" alt="" loading="lazy"${Data.productImageOnErrorAttr()}>
            </div>
            <div class="tasful-market-order-history-card__body">
              <h2 class="tasful-market-order-history-card__title">${esc(entry.productName)}</h2>
              <p class="tasful-market-order-history-card__order-id">注文番号: ${esc(entry.orderId)}</p>
              <p class="tasful-market-order-history-card__meta">
                ${esc(Data.formatOrderDateTime(entry.createdAt))}<br>
                数量: ${entry.quantity} · ${esc(entry.paymentMethod)}<br>
                出品者: ${esc(shopLabel(entry))}
              </p>
              <div class="tasful-market-order-history-card__meta-row">
                <span class="tasful-market-order-history-card__total">${esc(Data.formatYenAmount(subtotal))}</span>
                <span class="tasful-market-order-history-card__status ${statusCls}">${esc(entry.status)}</span>
              </div>
            </div>
          </div>
          <span class="tasful-market-order-history-card__chevron" data-tasful-order-chevron>詳細を見る ▼</span>
        </button>
        ${renderDetail(entry, index)}
      </article>`;
  }

  function renderFilterChipGroup(title, name, options, selected, type = "checkbox") {
    const chips = options
      .map((opt) => {
        const value = typeof opt === "string" ? opt : opt.id;
        const label = typeof opt === "string" ? opt : opt.label;
        const count = typeof opt === "object" && opt.count != null ? ` (${opt.count})` : "";
        const checked =
          type === "radio"
            ? selected === value
            : Array.isArray(selected) && selected.includes(value);
        return `<label class="tasful-market-order-history-filter-chip${checked ? " is-active" : ""}">
          <input type="${type}" name="${escAttr(name)}" value="${escAttr(value)}"${checked ? " checked" : ""} />
          <span>${esc(label)}${esc(count)}</span>
        </label>`;
      })
      .join("");
    return `<section class="tasful-market-order-history-filter-group">
      <h3 class="tasful-market-order-history-filter-group__title">${esc(title)}</h3>
      <div class="tasful-market-order-history-filter-group__chips">${chips}</div>
    </section>`;
  }

  function readDraftFromSheet() {
    const body = document.querySelector("[data-tasful-order-history-filter-body]");
    if (!body) return cloneFilters(state.filters);
    const statuses = [...body.querySelectorAll('input[name="filter-status"]:checked')].map((el) => el.value);
    const periodEl = body.querySelector('input[name="filter-period"]:checked');
    const shops = [...body.querySelectorAll('input[name="filter-shop"]:checked')].map((el) => el.value);
    return {
      statuses,
      period: periodEl?.value || "all",
      shops,
    };
  }

  function renderFilterSheetBody() {
    const body = document.querySelector("[data-tasful-order-history-filter-body]");
    if (!body) return;
    const shops = collectShopOptions(state.allHistory);
    const shopOpts = shops.length
      ? shops
      : [{ name: "購入履歴がありません", count: 0, disabled: true }];
    body.innerHTML = [
      renderFilterChipGroup("注文状態", "filter-status", FILTER_STATUSES, state.draft.statuses, "checkbox"),
      renderFilterChipGroup("期間", "filter-period", PERIOD_OPTIONS, state.draft.period, "radio"),
      renderFilterChipGroup(
        "ショップ",
        "filter-shop",
        shopOpts.map((s) => ({ id: s.name, label: s.name, count: s.count })),
        state.draft.shops,
        "checkbox"
      ),
    ].join("");

    body.querySelectorAll(".tasful-market-order-history-filter-chip input").forEach((input) => {
      input.addEventListener("change", () => {
        const label = input.closest(".tasful-market-order-history-filter-chip");
        if (!label) return;
        if (input.type === "radio") {
          label.parentElement?.querySelectorAll(".tasful-market-order-history-filter-chip").forEach((el) => {
            el.classList.toggle("is-active", el.contains(input) && input.checked);
          });
        } else {
          label.classList.toggle("is-active", input.checked);
        }
      });
    });
  }

  function updateFilterBadge() {
    const badge = document.querySelector("[data-tasful-order-history-filter-badge]");
    const btn = document.querySelector("[data-tasful-order-history-filter-open]");
    const n = countActiveFilters(state.filters);
    if (!badge || !btn) return;
    if (n > 0) {
      badge.hidden = false;
      badge.textContent = String(n);
      btn.classList.add("is-active");
    } else {
      badge.hidden = true;
      badge.textContent = "";
      btn.classList.remove("is-active");
    }
  }

  function updateSearchClear() {
    const clearBtn = document.querySelector("[data-tasful-order-history-search-clear]");
    if (!clearBtn) return;
    clearBtn.hidden = !String(state.query || "").trim();
  }

  function updateCount(visible, total) {
    const countEl = document.querySelector("[data-tasful-order-history-count]");
    if (!countEl) return;
    if (!total) {
      countEl.hidden = true;
      return;
    }
    countEl.hidden = false;
    if (visible === total) {
      countEl.textContent = `${total}件の注文`;
    } else {
      countEl.textContent = `${visible}件の注文（全${total}件中）`;
    }
  }

  function bindToggleEvents(root) {
    root.querySelectorAll("[data-tasful-order-toggle]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const card = btn.closest("[data-tasful-order-card]");
        const detail = card?.querySelector("[data-tasful-order-detail]");
        const chevron = card?.querySelector("[data-tasful-order-chevron]");
        if (!detail) return;
        const open = detail.hidden;
        detail.hidden = !open;
        btn.setAttribute("aria-expanded", open ? "true" : "false");
        if (chevron) {
          chevron.textContent = open ? "詳細を閉じる ▲" : "詳細を見る ▼";
        }
      });
    });
  }

  function expandCard(card, open) {
    if (!card) return;
    const btn = card.querySelector("[data-tasful-order-toggle]");
    const detail = card.querySelector("[data-tasful-order-detail]");
    const chevron = card.querySelector("[data-tasful-order-chevron]");
    if (!detail || !btn) return;
    detail.hidden = !open;
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    if (chevron) chevron.textContent = open ? "詳細を閉じる ▲" : "詳細を見る ▼";
  }

  function applyDeepLink(visibleHistory) {
    const params = new URLSearchParams(window.location.search);
    const orderId = String(params.get("orderId") || params.get("order_id") || "").trim();
    if (!orderId) return;
    const cards = [...document.querySelectorAll("[data-tasful-order-card]")];
    const card = cards.find((el) => String(el.getAttribute("data-order-id") || "") === orderId);
    if (!card) return;
    card.scrollIntoView({ block: "center", behavior: "instant" in window ? "instant" : "auto" });
    if (params.get("detail") === "1" || params.get("expand") === "1") {
      expandCard(card, true);
    }
  }

  function setSheetOpen(open) {
    const sheet = document.querySelector("[data-tasful-order-history-sheet]");
    if (!sheet) return;
    state.sheetOpen = open;
    sheet.hidden = !open;
    sheet.setAttribute("aria-hidden", open ? "false" : "true");
    document.body.classList.toggle("tasful-market-order-history-sheet-open", open);
    if (open) {
      state.draft = cloneFilters(state.filters);
      renderFilterSheetBody();
    }
  }

  function clearFilters() {
    state.query = "";
    state.filters = { statuses: [], period: "all", shops: [] };
    state.draft = cloneFilters(state.filters);
    const input = document.querySelector("[data-tasful-order-history-search]");
    if (input) input.value = "";
    updateSearchClear();
    render();
  }

  function renderList() {
    const listEl = document.querySelector("[data-tasful-order-history-list]");
    const emptyEl = document.querySelector("[data-tasful-order-history-empty]");
    const noResultsEl = document.querySelector("[data-tasful-order-history-no-results]");
    const toolbarEl = document.querySelector("[data-tasful-order-history-toolbar]");
    if (!listEl || !emptyEl || !noResultsEl) return;

    const total = state.allHistory.length;
    const visible = filterHistory(state.allHistory);

    if (!total) {
      listEl.hidden = true;
      noResultsEl.hidden = true;
      emptyEl.hidden = false;
      if (toolbarEl) toolbarEl.hidden = true;
      updateCount(0, 0);
      return;
    }

    emptyEl.hidden = true;
    if (toolbarEl) toolbarEl.hidden = false;
    updateCount(visible.length, total);
    updateFilterBadge();
    updateSearchClear();

    if (!visible.length) {
      listEl.hidden = true;
      noResultsEl.hidden = false;
      return;
    }

    noResultsEl.hidden = true;
    listEl.hidden = false;
    listEl.innerHTML = visible.map((entry, i) => renderCard(entry, i)).join("");
    bindToggleEvents(listEl);
    applyDeepLink(visible);
  }

  function render() {
    state.allHistory = Data?.getOrderHistory?.() || [];
    renderList();
  }

  function bindEvents() {
    const searchInput = document.querySelector("[data-tasful-order-history-search]");
    const searchForm = document.querySelector("[data-tasful-order-history-search-form]");
    searchForm?.addEventListener("submit", (e) => e.preventDefault());
    searchInput?.addEventListener("input", () => {
      state.query = searchInput.value;
      updateSearchClear();
      renderList();
    });

    document.querySelector("[data-tasful-order-history-search-clear]")?.addEventListener("click", () => {
      state.query = "";
      if (searchInput) searchInput.value = "";
      updateSearchClear();
      renderList();
      searchInput?.focus();
    });

    document.querySelector("[data-tasful-order-history-filter-open]")?.addEventListener("click", () => {
      setSheetOpen(true);
    });
    document.querySelector("[data-tasful-order-history-sheet-close]")?.addEventListener("click", () => {
      setSheetOpen(false);
    });
    document.querySelector("[data-tasful-order-history-sheet-backdrop]")?.addEventListener("click", () => {
      setSheetOpen(false);
    });
    document.querySelector("[data-tasful-order-history-filter-apply]")?.addEventListener("click", () => {
      state.filters = readDraftFromSheet();
      setSheetOpen(false);
      renderList();
    });
    document.querySelector("[data-tasful-order-history-filter-clear]")?.addEventListener("click", () => {
      state.draft = { statuses: [], period: "all", shops: [] };
      renderFilterSheetBody();
    });
    document.querySelector("[data-tasful-order-history-clear-filters]")?.addEventListener("click", () => {
      clearFilters();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && state.sheetOpen) setSheetOpen(false);
    });
  }

  function init() {
    if (document.body.dataset.page !== "shop_market_order_history") return;
    if (!Data) return;
    bindEvents();
    render();
    window.TasfulMarketHeader?.syncHeaderOffset?.();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
