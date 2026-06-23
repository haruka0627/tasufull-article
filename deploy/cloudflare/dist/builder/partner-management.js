(function () {
  "use strict";

  var STATUS_LABELS = {
    pending: { label: "審査待ち", cls: "builder-prt-badge--pending" },
    hold: { label: "保留", cls: "builder-prt-badge--hold" },
    approved: { label: "承認", cls: "builder-prt-badge--approved" },
    rejected: { label: "否認", cls: "builder-prt-badge--rejected" },
    contracted: { label: "契約済み", cls: "builder-prt-badge--contracted" }
  };

  var SOURCE_LABELS = { iwasho: "IWASHO", tasful: "TASFUL", builder: "Builder" };

  var MOCK_DATA = (window.TASU_PARTNER_MOCK && window.TASU_PARTNER_MOCK.list) || [];

  var apiLabels = window.TASU_PARTNER_API || {};
  var ENTITY_LABELS = apiLabels.ENTITY_LABELS || {};
  var INSURANCE_LABELS = apiLabels.INSURANCE_LABELS || {};
  var WORKERS_COMP_LABELS = apiLabels.WORKERS_COMP_LABELS || {};

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function isMockMode() {
    return apiLabels.isMockMode ? apiLabels.isMockMode() : true;
  }

  function formatDate(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso).slice(0, 10);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function renderBadge(status) {
    var s = STATUS_LABELS[status] || STATUS_LABELS.pending;
    return '<span class="builder-prt-badge ' + s.cls + '">' + escapeHtml(s.label) + "</span>";
  }

  function normalizeMockRow(row) {
    return {
      id: row.id,
      partner_code: row.id,
      created_at: row.date,
      source: row.source,
      company_name: row.company,
      partner_type: row.entity,
      business_types: row.trades.split(",").map(function (t) { return t.trim(); }),
      service_area: row.area,
      invoice_number: row.invoice,
      insurance_status: row.insurance,
      workers_comp_type: row.workersComp,
      status: row.status,
      representative_name: row.representative,
      contact_name: row.contact || row.representative,
      email: row.email,
      phone: row.phone
    };
  }

  function normalizeApiRow(row) {
    return {
      id: row.id,
      partner_code: row.partner_code,
      created_at: row.created_at,
      source: row.source,
      company_name: row.company_name,
      partner_type: ENTITY_LABELS[row.partner_type] || row.partner_type,
      business_types: row.business_types || [],
      service_area: row.service_area,
      invoice_number: row.invoice_number || "—",
      insurance_status: INSURANCE_LABELS[row.insurance_status] || row.insurance_status || "—",
      workers_comp_type: WORKERS_COMP_LABELS[row.workers_comp_type] || row.workers_comp_type || "—",
      status: row.status
    };
  }

  function filterRows(rows, q, source, status) {
    return rows.filter(function (row) {
      if (source && row.source !== source) return false;
      if (status && row.status !== status) return false;
      if (q) {
        var trades = Array.isArray(row.business_types) ? row.business_types.join(" ") : String(row.business_types || "");
        var hay = (
          row.company_name +
          trades +
          row.service_area +
          row.partner_code +
          (row.representative_name || "") +
          (row.contact_name || "") +
          (row.email || "") +
          (row.phone || "")
        ).toLowerCase();
        if (hay.indexOf(q.toLowerCase()) === -1) return false;
      }
      return true;
    });
  }

  function renderTable(rows) {
    var list = document.querySelector("[data-prt-mgmt-tbody]");
    var countEl = document.querySelector("[data-prt-mgmt-count]");
    if (!list) return;
    if (countEl) countEl.textContent = rows.length + "件";
    if (!rows.length) {
      list.innerHTML =
        '<li class="builder-admin-empty">' +
        '<p class="builder-admin-empty__title">登録申請がありません</p>' +
        '<p class="builder-admin-empty__sub">条件を変更するか、新規申請をお待ちください。</p>' +
        "</li>";
      return;
    }
    list.innerHTML = rows.map(function (row) {
      var trades = Array.isArray(row.business_types) ? row.business_types.join(", ") : String(row.business_types || "");
      var detailHref = "partner-detail.html?id=" + encodeURIComponent(row.id);
      if (isMockMode()) detailHref += "&mock=1";
      return (
        '<li><a class="builder-recent-card builder-prt-app-card" href="' + detailHref + '">' +
        '<div class="builder-prt-app-card__head">' +
        '<h3 class="builder-prt-app-card__title">' + escapeHtml(row.company_name) + "</h3>" +
        '<span class="builder-prt-app-card__source">' + escapeHtml(SOURCE_LABELS[row.source] || row.source) + "</span>" +
        "</div>" +
        '<dl class="builder-prt-app-card__meta">' +
        '<div class="builder-prt-app-card__row"><dt>業種</dt><dd>' + escapeHtml(trades) + "</dd></div>" +
        '<div class="builder-prt-app-card__row"><dt>エリア</dt><dd>' + escapeHtml(row.service_area) + "</dd></div>" +
        '<div class="builder-prt-app-card__row"><dt>担当</dt><dd>' + escapeHtml(row.contact_name || row.representative_name || "—") + "</dd></div>" +
        '<div class="builder-prt-app-card__row"><dt>連絡</dt><dd>' + escapeHtml(row.email || "—") + " / " + escapeHtml(row.phone || "—") + "</dd></div>" +
        '<div class="builder-prt-app-card__row"><dt>区分</dt><dd>' + escapeHtml(row.partner_type) + "</dd></div>" +
        "</dl>" +
        '<div class="builder-prt-app-card__foot">' +
        '<span class="builder-prt-app-card__date">登録日 ' + escapeHtml(formatDate(row.created_at)) + "</span>" +
        renderBadge(row.status) +
        "</div>" +
        "</a></li>"
      );
    }).join("");
  }

  function updateStats(rows) {
    var counts = { pending: 0, hold: 0, approved: 0, contracted: 0 };
    rows.forEach(function (row) {
      if (counts[row.status] !== undefined) counts[row.status] += 1;
    });
    var map = {
      pending: "[data-prt-mgmt-stat-pending]",
      hold: "[data-prt-mgmt-stat-hold]",
      approved: "[data-prt-mgmt-stat-approved]",
      contracted: "[data-prt-mgmt-stat-contracted]"
    };
    Object.keys(map).forEach(function (key) {
      var el = document.querySelector(map[key]);
      if (el) el.textContent = String(counts[key]);
    });
  }

  function showLoadError(err) {
    if (typeof err === "string") err = { message: err };
    var list = document.querySelector("[data-prt-mgmt-tbody]");
    if (!list) return;
    var message = formatApiError(err);
    var hintHtml = "";
    var code = err && err.code;
    var status = err && err.status;
    if (code === "not_logged_in" || status === 401) {
      var returnPath = "builder/partner-management.html";
      hintHtml =
        '<p class="builder-admin-empty__hint">Supabase のセッションが必要です。' +
        '<a href="../login.html?return=' + encodeURIComponent(returnPath) + '">ログインページへ</a>' +
        "（partner_role 付与済みの運営アカウント）。localhost ではダッシュボード表示のみでは接続できません。</p>";
    } else if (code === "forbidden" || status === 403) {
      hintHtml =
        '<p class="builder-admin-empty__hint">JWT の app_metadata.partner_role（admin / ops / reviewer）が必要です。付与後に再ログインしてください。</p>';
    }
    list.innerHTML =
      '<li class="builder-admin-empty">' +
      '<p class="builder-admin-empty__title">読み込みエラー</p>' +
      '<p class="builder-admin-empty__sub">' + escapeHtml(message) + "</p>" +
      hintHtml +
      "</li>";
  }

  function formatApiError(err) {
    return apiLabels.formatPartnerError ? apiLabels.formatPartnerError(err) : (err.message || "error");
  }

  function bindEvents(getRows) {
    var qInput = document.querySelector("[data-prt-mgmt-search-q]");
    var sourceSelect = document.querySelector("[data-prt-mgmt-search-source]");
    var statusSelect = document.querySelector("[data-prt-mgmt-search-status]");
    var resetBtn = document.querySelector("[data-prt-mgmt-filter-reset]");
    var applyBtn = document.querySelector("[data-prt-mgmt-filter-apply]");

    function applyFilter() {
      var q = qInput ? qInput.value.trim() : "";
      var source = sourceSelect ? sourceSelect.value : "";
      var status = statusSelect ? statusSelect.value : "";
      getRows(q, source, status).then(function (rows) {
        renderTable(rows);
      }).catch(function (err) {
        showLoadError(err);
      });
    }

    [qInput, sourceSelect, statusSelect].forEach(function (el) {
      if (el) el.addEventListener("input", applyFilter);
      if (el && el.tagName === "SELECT") el.addEventListener("change", applyFilter);
    });

    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        if (qInput) qInput.value = "";
        if (sourceSelect) sourceSelect.value = "";
        if (statusSelect) statusSelect.value = "";
        applyFilter();
      });
    }

    if (applyBtn) {
      applyBtn.addEventListener("click", applyFilter);
    }

    applyFilter();
  }

  function initMock() {
    if (!MOCK_DATA.length) {
      showLoadError("モックデータが読み込まれていません。partner-mock-data.js を確認してください。");
      return;
    }
    var allRows = MOCK_DATA.map(normalizeMockRow);
    updateStats(allRows);
    bindEvents(function (q, source, status) {
      return Promise.resolve(filterRows(allRows, q, source, status));
    });
  }

  function initApi() {
    var cache = [];
    function loadAll() {
      if (!apiLabels.partnerList) return Promise.reject(new Error("API not available"));
      return apiLabels.partnerList({ limit: 100 }).then(function (res) {
        cache = (res.items || []).map(normalizeApiRow);
        updateStats(cache);
        return cache;
      });
    }

    loadAll().catch(function (err) {
      showLoadError(err);
    });

    bindEvents(function (q, source, status) {
      if (cache.length) {
        return Promise.resolve(filterRows(cache, q, source, status));
      }
      return apiLabels.partnerList({
        q: q || undefined,
        source: source || undefined,
        status: status || undefined,
        limit: 100
      }).then(function (res) {
        var rows = (res.items || []).map(normalizeApiRow);
        if (!q && !source && !status) {
          cache = rows;
          updateStats(cache);
        }
        return filterRows(rows, q, source, status);
      });
    });
  }

  function init() {
    var modeEl = document.querySelector("[data-prt-mgmt-mode]");
    if (modeEl) {
      modeEl.textContent = isMockMode() ? "モック" : "API";
    }
    if (isMockMode()) {
      initMock();
    } else {
      initApi();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
