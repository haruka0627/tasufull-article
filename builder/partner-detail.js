(function () {
  "use strict";

  var STATUS_LABELS = {
    pending: "審査待ち",
    hold: "保留",
    approved: "承認",
    rejected: "却下",
    contracted: "契約済み"
  };

  var ACTION_LABELS = {
    submit: "申請受付",
    approve: "承認",
    reject: "却下",
    hold: "保留",
    contract: "契約完了"
  };

  var REVIEWER_LABELS = {
    system: "システム",
    "verify-script": "自動審査",
    "dev-reviewer": "開発用アカウント"
  };

  var NOTES_LABELS = {
    "registration received": "申請を受け付けました"
  };

  var DOCUMENT_TYPE_LABELS = {
    insurance_policy: "保険証券",
    workers_comp_proof: "労災加入証明",
    license: "許可証・資格証",
    construction_license: "許可証・資格証",
    qualification: "許可証・資格証",
    company_profile: "会社案内",
    registry: "登記簿謄本",
    opening_notice: "開業届",
    other: "その他書類"
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

  function formatReviewDate(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return (
      d.getFullYear() +
      "/" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "/" +
      String(d.getDate()).padStart(2, "0") +
      " " +
      String(d.getHours()).padStart(2, "0") +
      ":" +
      String(d.getMinutes()).padStart(2, "0") +
      ":" +
      String(d.getSeconds()).padStart(2, "0")
    );
  }

  function localizeStatus(status) {
    var key = String(status || "").trim().toLowerCase();
    return STATUS_LABELS[key] || status || "—";
  }

  function localizeAction(action) {
    var key = String(action || "").trim().toLowerCase();
    return ACTION_LABELS[key] || localizeStatus(key) || action || "—";
  }

  function localizeReviewer(reviewerId) {
    var raw = String(reviewerId || "").trim();
    if (!raw) return "—";
    if (REVIEWER_LABELS[raw]) return REVIEWER_LABELS[raw];
    if (/^ops-/i.test(raw)) return "運営担当者";
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)) {
      return "運営担当者";
    }
    return raw;
  }

  function localizeNotes(notes) {
    var raw = String(notes || "").trim();
    if (!raw) return "";
    var mapped = NOTES_LABELS[raw.toLowerCase()];
    return mapped || raw;
  }

  function formatStatusTransition(rv) {
    var prev = localizeStatus(rv.previous_status);
    var next = localizeStatus(rv.new_status);
    var suffix = rv.reason_code ? "（" + rv.reason_code + "）" : "";
    if (prev === next) return prev + suffix;
    return prev + " → " + next + suffix;
  }

  function setActiveTab(name) {
    document.querySelectorAll("[data-prt-detail-tab]").forEach(function (btn) {
      btn.classList.toggle("is-active", btn.getAttribute("data-prt-detail-tab") === name);
    });
    document.querySelectorAll("[data-prt-detail-panel]").forEach(function (panel) {
      panel.hidden = panel.getAttribute("data-prt-detail-panel") !== name;
    });
  }

  function renderStatusBadge(status) {
    var key = String(status || "pending").trim().toLowerCase();
    var label = STATUS_LABELS[key] || status || "—";
    return (
      '<span class="builder-prt-detail-status builder-prt-detail-status--' +
      escapeHtml(key) +
      '">' +
      escapeHtml(label) +
      "</span>"
    );
  }

  function renderKvItem(fieldId, label, valueHtml, opts) {
    opts = opts || {};
    var cls = ["builder-prt-kv"];
    if (opts.accent) cls.push("builder-prt-kv--accent");
    if (opts.highlight) cls.push("builder-prt-kv--highlight");
    if (opts.code) cls.push("builder-prt-kv--code");
    if (opts.company) cls.push("builder-prt-kv--company");
    return (
      '<dl class="' +
      cls.join(" ") +
      '" data-prt-field="' +
      escapeHtml(fieldId) +
      '"><dt>' +
      escapeHtml(label) +
      "</dt><dd>" +
      valueHtml +
      "</dd></dl>"
    );
  }

  function renderBasic(profile) {
    var el = document.querySelector("[data-prt-detail-basic]");
    if (!el) return;
    el.innerHTML =
      renderKvItem("partner_code", "申請コード", escapeHtml(profile.partner_code), { code: true }) +
      renderKvItem("source", "流入元", escapeHtml(SOURCE_LABELS[profile.source] || profile.source)) +
      renderKvItem("company_name", "会社名・屋号", escapeHtml(profile.company_name), { accent: true, company: true }) +
      renderKvItem("representative_name", "代表者", escapeHtml(profile.representative_name)) +
      renderKvItem("contact_name", "担当者", escapeHtml(profile.contact_name)) +
      renderKvItem("email", "メール", escapeHtml(profile.email)) +
      renderKvItem("phone", "電話", escapeHtml(profile.phone)) +
      renderKvItem("address", "住所", escapeHtml(profile.address)) +
      renderKvItem("partner_type", "区分", escapeHtml(ENTITY_LABELS[profile.partner_type] || profile.partner_type)) +
      renderKvItem(
        "business_types",
        "業種",
        escapeHtml((profile.business_types || []).join(", ")),
        { accent: true, highlight: true }
      ) +
      renderKvItem("service_area", "対応エリア", escapeHtml(profile.service_area), { accent: true, highlight: true }) +
      renderKvItem(
        "invoice_number",
        "インボイス",
        escapeHtml(profile.invoice_number || "—"),
        { accent: true, highlight: true }
      ) +
      renderKvItem(
        "insurance_status",
        "保険",
        escapeHtml(INSURANCE_LABELS[profile.insurance_status] || profile.insurance_status || "—"),
        { accent: true, highlight: true }
      ) +
      renderKvItem(
        "workers_comp_type",
        "労災",
        escapeHtml(WORKERS_COMP_LABELS[profile.workers_comp_type] || profile.workers_comp_type || "—"),
        { accent: true, highlight: true }
      ) +
      renderKvItem("status", "ステータス", renderStatusBadge(profile.status), { accent: true, highlight: true }) +
      renderKvItem("contracted", "契約済み", escapeHtml(profile.contracted ? "はい" : "いいえ（P1表示のみ）")) +
      renderKvItem("created_at", "受付日時", escapeHtml(formatDate(profile.created_at)));
  }

  function renderReviews(reviews) {
    var el = document.querySelector("[data-prt-detail-reviews]");
    if (!el) return;
    if (!reviews || !reviews.length) {
      el.innerHTML = "<p>審査履歴はありません。</p>";
      return;
    }
    el.innerHTML = reviews.map(function (rv) {
      var notes = localizeNotes(rv.notes);
      return (
        '<article class="builder-prt-review-item">' +
        '<p class="builder-prt-review-item__action"><strong>' + escapeHtml(localizeAction(rv.action)) + "</strong></p>" +
        '<p class="builder-prt-review-item__transition">' + escapeHtml(formatStatusTransition(rv)) + "</p>" +
        '<p class="builder-prt-review-item__meta">担当: ' + escapeHtml(localizeReviewer(rv.reviewer_id)) + "</p>" +
        '<p class="builder-prt-review-item__date">' + escapeHtml(formatReviewDate(rv.reviewed_at)) + "</p>" +
        (notes ? '<p class="builder-prt-review-item__note">' + escapeHtml(notes) + "</p>" : "") +
        "</article>"
      );
    }).join("");
  }

  function localizeDocumentType(documentType) {
    var key = String(documentType || "").trim().toLowerCase();
    if (DOCUMENT_TYPE_LABELS[key]) return DOCUMENT_TYPE_LABELS[key];
    if (!key) return "—";
    return "その他書類";
  }

  function formatDocumentFileLine(doc) {
    var url = String(doc.file_url || "").trim();
    if (/^pending:\/\//i.test(url)) {
      return "書類提出待ち";
    }
    var name = String(doc.file_name || "").trim();
    if (name && !/\.pending$/i.test(name)) {
      return name;
    }
    if (url && !/^mock:\/\//i.test(url)) {
      return url;
    }
    return "";
  }

  function renderDocVerifyBadge(verified) {
    var isVerified = !!verified;
    return (
      '<span class="builder-prt-doc-badge builder-prt-doc-badge--' +
      (isVerified ? "verified" : "unverified") +
      '">' +
      escapeHtml(isVerified ? "確認済み" : "未確認") +
      "</span>"
    );
  }

  function renderDocuments(documents) {
    var el = document.querySelector("[data-prt-detail-documents]");
    if (!el) return;
    if (!documents || !documents.length) {
      el.innerHTML = "<p>提出書類はまだ登録されていません。</p>";
      return;
    }
    el.innerHTML = documents
      .map(function (doc) {
        var fileLine = formatDocumentFileLine(doc);
        return (
          '<article class="builder-prt-doc" data-prt-doc-id="' +
          escapeHtml(doc.id) +
          '">' +
          '<div class="builder-prt-doc__head">' +
          '<h3 class="builder-prt-doc__type">' +
          escapeHtml(localizeDocumentType(doc.document_type)) +
          "</h3>" +
          renderDocVerifyBadge(doc.verified) +
          "</div>" +
          (fileLine
            ? '<p class="builder-prt-doc__file">' + escapeHtml(fileLine) + "</p>"
            : "") +
          "</article>"
        );
      })
      .join("");
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
        showReviewMsg("モックモード: " + localizeAction(action) + " を実行しました（DB未更新）", false);
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
