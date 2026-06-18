/**
 * 売上・手数料管理（sales-fees.html）
 * 業務サービス fee_paid（localStorage）を優先表示
 */
(function (global) {
  "use strict";

  const PERIODS = [
    { id: "thisMonth", label: "今月" },
    { id: "lastMonth", label: "先月" },
    { id: "last3", label: "直近3ヶ月" },
    { id: "all", label: "すべて" },
  ];

  const PAYOUT_STATUS_UI = {
    pending: { label: "保留中", className: "sf-status--pending" },
    scheduled: { label: "振込予定", className: "sf-status--scheduled" },
    transferred: { label: "振込済", className: "sf-status--transferred" },
    completed: { label: "完了", className: "sf-status--completed" },
  };

  let salesRows = [];
  let activePeriod = "all";
  let highlightDealId = "";

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatYen(n) {
    if (window.TasuServiceDealsDb?.formatYen) return window.TasuServiceDealsDb.formatYen(n);
    if (window.TasuDashboardData?.formatYen) return window.TasuDashboardData.formatYen(n);
    return `¥${Math.max(0, Math.round(Number(n) || 0)).toLocaleString("ja-JP")}`;
  }

  function formatDateTime(iso) {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return "—";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const h = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${y}/${m}/${day} ${h}:${min}`;
  }

  function formatFeeRate(rate) {
    const r = Number(rate);
    if (!Number.isFinite(r)) return "—";
    const pct = r * 100;
    return Number.isInteger(pct) ? `${pct}%` : `${Math.round(pct * 10) / 10}%`;
  }

  function getViewProviderId() {
    const params = new URLSearchParams(global.location.search);
    const fromUrl = params.get("userId")?.trim();
    if (fromUrl) return fromUrl;
    return (
      window.TasuChatUserIdentity?.getEffectiveUserId?.() ||
      window.TASU_CHAT_SUPABASE_CONFIG?.currentUserId ||
      "u_me"
    );
  }

  function readHighlightDealId() {
    return new URLSearchParams(global.location.search).get("dealId")?.trim() || "";
  }

  function saleDateIso(row) {
    return row.platform_fee_paid_at || row.updated_at || row.created_at || "";
  }

  function inPeriod(row, period) {
    const iso = saleDateIso(row);
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return period === "all";

    const now = new Date();
    const y = d.getFullYear();
    const m = d.getMonth();
    const cy = now.getFullYear();
    const cm = now.getMonth();

    if (period === "all") return true;
    if (period === "thisMonth") return y === cy && m === cm;
    if (period === "lastMonth") {
      const lm = cm === 0 ? 11 : cm - 1;
      const ly = cm === 0 ? cy - 1 : cy;
      return y === ly && m === lm;
    }
    if (period === "last3") {
      const start = new Date(cy, cm - 2, 1);
      return d >= start;
    }
    return true;
  }

  function loadBusinessSales() {
    const db = window.TasuBusinessServiceSalesDb;
    if (!db?.getSalesByProviderId) return [];
    return db.getSalesByProviderId(getViewProviderId());
  }

  function filteredSales() {
    return salesRows.filter((row) => inPeriod(row, activePeriod));
  }

  function computeSummary(rows) {
    const db = window.TasuBusinessServiceSalesDb;
    if (db?.getSalesSummaryByProviderId && activePeriod === "all") {
      const all = db.getSalesSummaryByProviderId(getViewProviderId());
      if (rows.length === salesRows.length) return all;
    }
    const totalDeals = rows.length;
    const totalEstimate = rows.reduce((s, r) => s + r.estimate_amount, 0);
    const totalFee = rows.reduce((s, r) => s + r.platform_fee_amount, 0);
    const totalNet = rows.reduce((s, r) => s + r.provider_net_amount, 0);
    const rated = rows.filter((r) => r.review_rating != null && r.review_rating >= 1);
    const averageRating =
      rated.length > 0
        ? Math.round((rated.reduce((s, r) => s + r.review_rating, 0) / rated.length) * 10) / 10
        : 0;
    return {
      totalDeals,
      totalEstimate,
      totalFee,
      totalNet,
      averageRating,
      ratedCount: rated.length,
    };
  }

  function renderSummary() {
    const root = document.querySelector("[data-sf-stats]");
    if (!root) return;
    const rows = filteredSales();
    const s = computeSummary(rows);
    const defs = [
      { label: "総取引数", value: `${s.totalDeals}件` },
      { label: "総見積金額", value: formatYen(s.totalEstimate) },
      { label: "総手数料", value: formatYen(s.totalFee) },
      { label: "差引売上", value: formatYen(s.totalNet) },
      {
        label: "平均評価",
        value: s.ratedCount > 0 ? `${s.averageRating.toFixed(1)}（${s.ratedCount}件）` : "—",
      },
    ];
    root.innerHTML = defs
      .map(
        (d) => `<div class="sf-stat">
          <p class="sf-stat__label">${esc(d.label)}</p>
          <p class="sf-stat__value">${esc(d.value)}</p>
        </div>`
      )
      .join("");
  }

  function renderFilters() {
    const root = document.querySelector("[data-sf-filters]");
    if (!root) return;
    root.innerHTML = PERIODS.map(
      (p) =>
        `<button type="button" class="sf-filters__btn${activePeriod === p.id ? " is-active" : ""}" data-sf-period="${esc(p.id)}">${esc(p.label)}</button>`
    ).join("");
    root.querySelectorAll("[data-sf-period]").forEach((btn) => {
      btn.addEventListener("click", () => {
        activePeriod = btn.getAttribute("data-sf-period") || "all";
        renderFilters();
        renderSummary();
        renderTable();
      });
    });
  }

  function formatReviewCell(row) {
    if (row.review_rating == null || row.review_rating < 1) return "—";
    return `★${row.review_rating}`;
  }

  function renderPayoutStatus(row) {
    const key = String(row.payout_status || "completed").trim().toLowerCase();
    const ui = PAYOUT_STATUS_UI[key] || PAYOUT_STATUS_UI.completed;
    return `<span class="sf-status ${ui.className}">${esc(ui.label)}</span>`;
  }

  function ensureConnectAuditDemoDeals(providerId) {
    const params = new URLSearchParams(global.location.search);
    if (params.get("talkDev") !== "1") return;

    const store = window.TasuServiceDealsDb;
    if (!store?.loadLocal) return;

    const pid = String(providerId || "").trim();
    if (!pid) return;

    const now = new Date().toISOString();
    const demoDeals = [
      {
        id: "connect_audit_deal_001",
        service_id: "business-demo-field-001",
        provider_user_id: pid,
        client_user_id: "u_hiro",
        status: "fee_paid",
        payout_status: "transferred",
        agreed_amount: 88000,
        platform_fee_amount: 4400,
        platform_fee_rate: 0.05,
        platform_fee_paid_at: now,
        created_at: now,
        updated_at: now,
        estimate_note: "外壁塗装（Connect監査デモ）",
      },
      {
        id: "connect_audit_deal_002",
        service_id: "business-demo-clean-001",
        provider_user_id: pid,
        client_user_id: "u_taro",
        status: "fee_paid",
        payout_status: "pending",
        agreed_amount: 55000,
        platform_fee_amount: 2750,
        platform_fee_rate: 0.05,
        platform_fee_paid_at: new Date(Date.now() - 86400000 * 5).toISOString(),
        created_at: now,
        updated_at: now,
        estimate_note: "ハウスクリーニング",
      },
      {
        id: "connect_audit_deal_003",
        service_id: "business-demo-garden-001",
        provider_user_id: pid,
        client_user_id: "u_yuki",
        status: "fee_paid",
        payout_status: "scheduled",
        agreed_amount: 42000,
        platform_fee_amount: 2100,
        platform_fee_rate: 0.05,
        platform_fee_paid_at: new Date(Date.now() - 86400000 * 2).toISOString(),
        created_at: now,
        updated_at: now,
        estimate_note: "庭木剪定・除草",
      },
      {
        id: "connect_audit_deal_004",
        service_id: "business-demo-photo-001",
        provider_user_id: pid,
        client_user_id: "u_ken",
        status: "fee_paid",
        payout_status: "completed",
        agreed_amount: 32000,
        platform_fee_amount: 1600,
        platform_fee_rate: 0.05,
        platform_fee_paid_at: new Date(Date.now() - 86400000 * 12).toISOString(),
        created_at: now,
        updated_at: now,
        estimate_note: "商品撮影・レタッチ",
      },
    ];

    const existing = store.loadLocal() || [];
    const demoIds = new Set(demoDeals.map((d) => d.id));
    const merged = [
      ...demoDeals,
      ...existing.filter((row) => !demoIds.has(String(row.id))),
    ];
    localStorage.setItem("tasu_service_deals", JSON.stringify(merged));
  }

  function renderTable() {
    const tbody = document.querySelector("[data-sf-tbody]");
    const empty = document.querySelector("[data-sf-empty]");
    const wrap = document.querySelector("[data-sf-table-wrap]");
    if (!tbody || !empty || !wrap) return;

    const rows = filteredSales();
    if (!rows.length) {
      tbody.innerHTML = "";
      wrap.hidden = true;
      empty.hidden = false;
      return;
    }

    wrap.hidden = false;
    empty.hidden = true;
    tbody.innerHTML = rows
      .map((row) => {
        const isHighlight = highlightDealId && row.deal_id === highlightDealId;
        return `<tr data-sf-row="${esc(row.deal_id)}" class="${isHighlight ? "sf-row--highlight" : ""}"${isHighlight ? ' id="sf-highlight-deal"' : ""}>
          <td>${esc(row.deal_id)}</td>
          <td>${esc(row.service_title)}</td>
          <td class="num">${esc(formatYen(row.estimate_amount))}</td>
          <td class="num">${esc(formatYen(row.platform_fee_amount))}</td>
          <td class="num">${esc(formatYen(row.provider_net_amount))}</td>
          <td class="num">${esc(formatFeeRate(row.platform_fee_rate))}</td>
          <td>${esc(formatDateTime(row.platform_fee_paid_at))}</td>
          <td>${esc(formatReviewCell(row))}</td>
          <td class="sf-status-cell">${renderPayoutStatus(row)}</td>
        </tr>`;
      })
      .join("");

    if (highlightDealId) {
      const el = document.getElementById("sf-highlight-deal");
      if (el) {
        el.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }

  function bindPage() {
    if (document.body?.dataset?.page !== "sales-fees") return;
    highlightDealId = readHighlightDealId();
    const providerId = getViewProviderId();
    ensureConnectAuditDemoDeals(providerId);
    salesRows = loadBusinessSales();
    renderSummary();
    renderFilters();
    renderTable();
  }

  global.TasuSalesFees = {
    PERIODS,
    PAYOUT_STATUS_UI,
    getViewProviderId,
    loadBusinessSales,
    renderPayoutStatus,
    ensureConnectAuditDemoDeals,
    getSalesRows: () => salesRows,
    refresh: bindPage,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindPage);
  } else {
    bindPage();
  }
})(typeof window !== "undefined" ? window : globalThis);
