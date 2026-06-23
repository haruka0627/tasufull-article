(function () {
  "use strict";

  var STATUS_LABELS = {
    pending: "審査待ち",
    hold: "保留",
    approved: "承認",
    rejected: "否認",
    contracted: "契約済み"
  };

  var SOURCE_LABELS = { iwasho: "IWASHO", tasful: "TASFUL", builder: "Builder" };

  var HOLD_CODES = ["H01", "H02", "H03", "H04", "H05", "H06", "H07", "H08", "H09", "H10", "H11", "H12"];
  var REJECT_CODES = ["R01", "R02", "R03", "R04", "R05", "R06", "R07", "R08", "R09", "R10", "R11", "R12"];

  var CHECKLIST_ITEMS = [
    { key: "basic_info", label: "基本情報に不備がない" },
    { key: "insurance", label: "保険加入状況が確認できる" },
    { key: "workers_comp", label: "労災加入状況が確認できる" },
    { key: "invoice", label: "インボイス情報が妥当" },
    { key: "area", label: "対応エリアが明確" }
  ];

  function getMockProfile(id) {
    if (window.TASU_PARTNER_MOCK && window.TASU_PARTNER_MOCK.getProfile) {
      return window.TASU_PARTNER_MOCK.getProfile(id);
    }
    return null;
  }

  var api = window.TASU_PARTNER_API || {};
  var ENTITY_LABELS = api.ENTITY_LABELS || {};
  var INSURANCE_LABELS = api.INSURANCE_LABELS || {};
  var WORKERS_COMP_LABELS = api.WORKERS_COMP_LABELS || {};

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function isMockMode() {
    return api.isMockMode ? api.isMockMode() : true;
  }

  function getPartnerId() {
    return new URLSearchParams(window.location.search).get("id") || "";
  }

  function formatDate(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return d.toLocaleString("ja-JP");
  }

  function setActiveTab(name) {
    document.querySelectorAll("[data-prt-detail-tab]").forEach(function (btn) {
      btn.classList.toggle("is-active", btn.getAttribute("data-prt-detail-tab") === name);
    });
    document.querySelectorAll("[data-prt-detail-panel]").forEach(function (panel) {
      panel.hidden = panel.getAttribute("data-prt-detail-panel") !== name;
    });
  }

  function renderBasic(profile) {
    var el = document.querySelector("[data-prt-detail-basic]");
    if (!el) return;
    var rows = [
      ["申請コード", profile.partner_code],
      ["流入元", SOURCE_LABELS[profile.source] || profile.source],
      ["会社名・屋号", profile.company_name],
      ["代表者", profile.representative_name],
      ["担当者", profile.contact_name],
      ["メール", profile.email],
      ["電話", profile.phone],
      ["住所", profile.address],
      ["区分", ENTITY_LABELS[profile.partner_type] || profile.partner_type],
      ["業種", (profile.business_types || []).join(", ")],
      ["対応エリア", profile.service_area],
      ["インボイス", profile.invoice_number || "—"],
      ["保険", INSURANCE_LABELS[profile.insurance_status] || profile.insurance_status || "—"],
      ["労災", WORKERS_COMP_LABELS[profile.workers_comp_type] || profile.workers_comp_type || "—"],
      ["ステータス", STATUS_LABELS[profile.status] || profile.status],
      ["契約済み", profile.contracted ? "はい" : "いいえ（P1表示のみ）"],
      ["受付日時", formatDate(profile.created_at)]
    ];
    el.innerHTML = rows.map(function (r) {
      return '<dl class="builder-prt-kv"><dt>' + escapeHtml(r[0]) + '</dt><dd>' + escapeHtml(r[1]) + "</dd></dl>";
    }).join("");
  }

  function renderReviews(reviews) {
    var el = document.querySelector("[data-prt-detail-reviews]");
    if (!el) return;
    if (!reviews || !reviews.length) {
      el.innerHTML = "<p>審査履歴はありません。</p>";
      return;
    }
    el.innerHTML = reviews.map(function (rv) {
      return (
        '<article class="builder-prt-review-item">' +
        "<p><strong>" + escapeHtml(rv.action) + "</strong> " +
        escapeHtml(rv.previous_status) + " → " + escapeHtml(rv.new_status) +
        (rv.reason_code ? " (" + escapeHtml(rv.reason_code) + ")" : "") + "</p>" +
        "<p>担当: " + escapeHtml(rv.reviewer_id) + " / " + escapeHtml(formatDate(rv.reviewed_at)) + "</p>" +
        (rv.notes ? "<p>" + escapeHtml(rv.notes) + "</p>" : "") +
        "</article>"
      );
    }).join("");
  }

  function renderDocuments(documents) {
    var el = document.querySelector("[data-prt-detail-documents]");
    if (!el) return;
    if (!documents || !documents.length) {
      el.innerHTML = "<p>提出書類はまだ登録されていません。</p>";
      return;
    }
    el.innerHTML = documents.map(function (doc) {
      return (
        '<div class="builder-prt-doc" data-prt-doc-id="' + escapeHtml(doc.id) + '">' +
        "<p><strong>" + escapeHtml(doc.document_type) + "</strong></p>" +
        "<p>" + escapeHtml(doc.file_url) + "</p>" +
        '<label class="builder-prt-doc-verify">' +
        '<input type="checkbox" data-prt-doc-verify="' + escapeHtml(doc.id) + '"' +
        (doc.verified ? " checked" : "") + " /> 確認済み</label>" +
        "</div>"
      );
    }).join("");
  }

  function buildReviewForm(profile) {
    var el = document.querySelector("[data-prt-detail-review-form]");
    if (!el) return;
    if (profile.status === "approved" || profile.status === "rejected" || profile.status === "contracted") {
      el.innerHTML = "<p>この申請はP1ではこれ以上審査更新できません。</p>";
      return;
    }
    var checklistHtml = CHECKLIST_ITEMS.map(function (item) {
      return (
        '<label class="builder-prt-check"><input type="checkbox" name="checklist" value="' + item.key + '" data-prt-checklist="' + item.key + '" />' +
        escapeHtml(item.label) + "</label>"
      );
    }).join("");
    el.innerHTML =
      '<div class="builder-prt-review-actions">' +
      '<button type="button" class="builder-btn builder-btn--primary" data-prt-review-action="approve">承認</button>' +
      '<button type="button" class="builder-btn builder-btn--ghost" data-prt-review-action="hold">保留</button>' +
      '<button type="button" class="builder-btn builder-btn--ghost" data-prt-review-action="reject">否認</button>' +
      "</div>" +
      '<label class="builder-field"><span class="builder-field__label">理由コード</span>' +
      '<select class="builder-select" data-prt-reason-code><option value="">選択してください</option>' +
      HOLD_CODES.map(function (c) { return '<option value="' + c + '">' + c + " (保留)</option>"; }).join("") +
      REJECT_CODES.map(function (c) { return '<option value="' + c + '">' + c + " (否認)</option>"; }).join("") +
      "</select></label>" +
      '<label class="builder-field"><span class="builder-field__label">審査メモ</span>' +
      '<textarea class="builder-textarea" rows="3" data-prt-review-notes></textarea></label>' +
      '<fieldset class="builder-prt-checklist"><legend>チェックリスト</legend>' + checklistHtml + "</fieldset>" +
      '<p class="builder-prt-msg" data-prt-review-msg hidden role="alert"></p>';
  }

  function collectChecklist() {
    var out = {};
    document.querySelectorAll("[data-prt-checklist]").forEach(function (el) {
      out[el.getAttribute("data-prt-checklist")] = el.checked;
    });
    return out;
  }

  function showReviewMsg(text, isError) {
    var el = document.querySelector("[data-prt-review-msg]");
    if (!el) return;
    el.textContent = text;
    el.hidden = !text;
    el.classList.toggle("is-error", !!isError);
  }

  function loadData() {
    var id = getPartnerId();
    if (!id) {
      document.querySelector("[data-prt-detail-loading]").textContent = "partner_id が指定されていません。";
      return Promise.resolve(null);
    }
    if (isMockMode()) {
      var mock = getMockProfile(id);
      if (!mock) {
        document.querySelector("[data-prt-detail-loading]").textContent = "モックデータが読み込まれていません。";
        return Promise.resolve(null);
      }
      return Promise.resolve(mock);
    }
    if (!api.partnerGet) return Promise.reject(new Error("API not available"));
    return api.partnerGet(id).then(function (res) {
      return { profile: res.profile, reviews: res.reviews, documents: res.documents };
    });
  }

  function bindReview(profile, reload) {
    var formWrap = document.querySelector("[data-prt-detail-review-form]");
    if (!formWrap) return;
    formWrap.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-prt-review-action]");
      if (!btn) return;
      var action = btn.getAttribute("data-prt-review-action");
      var reasonCode = (document.querySelector("[data-prt-reason-code]") || {}).value || "";
      var notes = (document.querySelector("[data-prt-review-notes]") || {}).value || "";
      if ((action === "hold" || action === "reject") && !reasonCode) {
        showReviewMsg("保留・否認には理由コードが必要です。", true);
        return;
      }
      if (isMockMode()) {
        showReviewMsg("モックモード: " + action + " を実行しました（DB未更新）", false);
        return;
      }
      api.partnerReview({
        partner_id: profile.id,
        action: action,
        reason_code: reasonCode || undefined,
        notes: notes,
        checklist_json: collectChecklist()
      }).then(function () {
        showReviewMsg("審査を更新しました。", false);
        reload();
      }).catch(function (err) {
        showReviewMsg(api.formatPartnerError ? api.formatPartnerError(err) : (err.message || "審査更新に失敗しました。"), true);
      });
    });
  }

  function bindDocuments(reload) {
    var wrap = document.querySelector("[data-prt-detail-documents]");
    if (!wrap) return;
    wrap.addEventListener("change", function (e) {
      var input = e.target.closest("[data-prt-doc-verify]");
      if (!input) return;
      var docId = input.getAttribute("data-prt-doc-verify");
      if (isMockMode()) return;
      api.partnerDocumentVerify({ document_id: docId, verified: input.checked })
        .then(function () { reload(); })
        .catch(function (err) {
          alert(api.formatPartnerError ? api.formatPartnerError(err) : (err.message || "書類確認の更新に失敗しました。"));
          input.checked = !input.checked;
        });
    });
  }

  function renderAll(data) {
    document.querySelector("[data-prt-detail-loading]").hidden = true;
    document.querySelector("[data-prt-detail-content]").hidden = false;
    var titleEl = document.querySelector("[data-prt-detail-title]");
    if (titleEl) titleEl.textContent = data.profile.company_name;
    renderBasic(data.profile);
    renderReviews(data.reviews);
    renderDocuments(data.documents);
    buildReviewForm(data.profile);
    bindReview(data.profile, function () {
      loadData().then(function (next) { if (next) renderAll(next); });
    });
    bindDocuments(function () {
      loadData().then(function (next) { if (next) renderAll(next); });
    });
  }

  function init() {
    document.querySelectorAll("[data-prt-detail-tab]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setActiveTab(btn.getAttribute("data-prt-detail-tab"));
      });
    });
    loadData().then(function (data) {
      if (!data) return;
      renderAll(data);
    }).catch(function (err) {
      var loading = document.querySelector("[data-prt-detail-loading]");
      if (loading) loading.textContent = api.formatPartnerError ? api.formatPartnerError(err) : ("読み込みに失敗しました: " + (err.message || "error"));
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
