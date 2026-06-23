(function () {
  "use strict";

  var TRADES_CONSTRUCTION = [
    "電気工事", "設備工事", "空調工事", "内装工事", "大工工事", "塗装工事",
    "屋根工事", "防水工事", "外構工事", "ハウスクリーニング", "補修工事"
  ];

  var TRADES_OTHER = [
    "便利屋", "IT", "デザイン", "動画編集", "配送", "介護", "その他"
  ];

  var COVERAGE_OPTIONS = [
    { value: "", label: "選択してください" },
    { value: "not_joined", label: "未加入" },
    { value: "5m", label: "500万円" },
    { value: "10m", label: "1,000万円" },
    { value: "30m", label: "3,000万円" },
    { value: "50m", label: "5,000万円" },
    { value: "100m", label: "1億円" },
    { value: "unlimited", label: "無制限" },
    { value: "other", label: "その他" }
  ];

  var WORKERS_COMP_BY_ENTITY = {
    corporation: [
      { value: "corporate", label: "法人労災加入済み" }
    ],
    solo_contractor: [
      { value: "solo_special", label: "一人親方労災特別加入済み" },
      { value: "not_joined", label: "未加入" }
    ],
    sole_proprietor: [
      { value: "not_joined", label: "未加入" },
      { value: "planned", label: "加入予定" },
      { value: "solo_special", label: "特別加入済み" }
    ],
    freelance: [
      { value: "not_joined", label: "未加入" },
      { value: "planned", label: "加入予定" },
      { value: "solo_special", label: "特別加入済み" }
    ]
  };

  var WORKERS_COMP_NOTES = {
    corporation: "法人の場合は、法人労災保険への加入状況をご選択ください。",
    solo_contractor: "一人親方の場合は、労災保険特別加入（一人親方労災）の有無をご選択ください。",
    sole_proprietor: "個人事業主の場合は、労災の加入状況（未加入・加入予定・特別加入）をご選択ください。",
    freelance: "フリーランスの場合は、労災の加入状況（未加入・加入予定・特別加入）をご選択ください。"
  };

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function slugify(str) {
    return String(str).replace(/\s+/g, "-");
  }

  function buildTradeTags(trades) {
    return trades.map(function (trade) {
      var id = "prt-trade-" + slugify(trade);
      return (
        '<label class="prt-reg-tag" for="' + id + '">' +
        '<input class="prt-reg-tag__input" type="checkbox" id="' + id + '" name="trades" value="' + escapeHtml(trade) + '" />' +
        '<span class="prt-reg-tag__text">' + escapeHtml(trade) + "</span></label>"
      );
    }).join("");
  }

  function buildTradesFieldset() {
    return (
      '<fieldset class="prt-reg-field prt-reg-field--choice"><legend class="prt-reg-field__legend">業種（複数選択可）<span class="prt-reg-badge">必須</span></legend>' +
      '<p class="prt-reg-field__hint">建設・施工系を中心に、対応可能な業種をタップして選択してください。</p>' +
      '<div class="prt-reg-tags" data-prt-trade-tags>' + buildTradeTags(TRADES_CONSTRUCTION) + "</div>" +
      '<p class="prt-reg-tags__heading">その他サービス（便利屋・IT・デザインなど）</p>' +
      '<div class="prt-reg-tags prt-reg-tags--other">' + buildTradeTags(TRADES_OTHER) + "</div>" +
      "</fieldset>"
    );
  }

  function getSource(host) {
    var params = new URLSearchParams(window.location.search);
    var fromQuery = params.get("source");
    if (fromQuery === "iwasho" || fromQuery === "tasful" || fromQuery === "builder") {
      return fromQuery;
    }
    return host.getAttribute("data-source") || "tasful";
  }

  function buildFormHtml(config) {
    var brand = escapeHtml(config.brand);
    var privacyUrl = escapeHtml(config.privacyUrl);
    var source = escapeHtml(config.source);

    return (
      '<form class="prt-reg-form" data-partner-register-form-el novalidate>' +
      '<input type="hidden" name="source" value="' + source + '" data-prt-source-input />' +

      '<div class="prt-reg-flow" aria-labelledby="prt-reg-flow-title">' +
      '<h2 class="prt-reg-flow__title" id="prt-reg-flow-title">登録の流れ</h2>' +
      '<ol class="prt-reg-flow__steps">' +
      "<li>基本情報を入力</li>" +
      "<li>運営による一次確認</li>" +
      "<li>必要書類の提出</li>" +
      "<li>審査</li>" +
      "<li>電子契約</li>" +
      "<li>協力パートナー登録完了</li>" +
      "</ol>" +
      '<p class="prt-reg-flow__note">通常3営業日以内を目安に確認します。</p>' +
      "</div>" +

      '<section class="prt-reg-section" aria-labelledby="prt-sec-1">' +
      '<div class="prt-reg-section__head"><span class="prt-reg-section__num">1</span>' +
      '<h2 class="prt-reg-section__title" id="prt-sec-1">基本情報</h2></div>' +

      field("company_name", "会社名・屋号", "text", true, "例）株式会社サンプル建設 / 山田工務店") +
      field("representative", "代表者名", "text", true, "例）山田 太郎") +
      field("contact_person", "担当者名", "text", true, "例）佐藤 花子") +

      '<fieldset class="prt-reg-field prt-reg-field--choice"><legend class="prt-reg-field__legend">区分<span class="prt-reg-badge">必須</span></legend>' +
      '<div class="prt-reg-radio-group prt-reg-radio-group--inline" data-prt-entity-type role="radiogroup" aria-label="区分">' +
      radio("entity_type", "法人", "corporation", true) +
      radio("entity_type", "個人事業主", "sole_proprietor", false) +
      radio("entity_type", "一人親方", "solo_contractor", false) +
      radio("entity_type", "フリーランス", "freelance", false) +
      "</div></fieldset>" +

      field("postal_code", "郵便番号", "text", true, "例）123-4567") +
      field("address", "住所", "text", true, "例）東京都渋谷区…") +
      field("phone", "電話番号", "tel", true, "例）03-1234-5678") +
      field("email", "メールアドレス", "email", true, "例）info@example.co.jp") +
      '<div class="prt-reg-field prt-reg-field--corp-only" data-prt-corp-field>' +
      '<label for="prt-corporate_number">法人番号<span class="prt-reg-badge">必須</span></label>' +
      '<input class="prt-reg-input" type="text" id="prt-corporate_number" name="corporate_number" placeholder="例）1234567890123" inputmode="numeric" autocomplete="off" />' +
      '<p class="prt-reg-field__hint">法人を選択した場合のみ入力してください（13桁）。</p>' +
      "</div>" +
      '<p class="prt-reg-field__hint prt-reg-field--non-corp-note" data-prt-non-corp-note hidden>個人事業主・一人親方・フリーランスの方は法人番号なしで登録できます。</p>' +
      field("website", "ホームページURL", "url", false, "https://") +
      field("sns_url", "SNS URL", "url", false, "https://") +
      "</section>" +

      '<section class="prt-reg-section" aria-labelledby="prt-sec-2">' +
      '<div class="prt-reg-section__head"><span class="prt-reg-section__num">2</span>' +
      '<h2 class="prt-reg-section__title" id="prt-sec-2">事業情報</h2></div>' +
      buildTradesFieldset() +
      field("service_area", "対応エリア", "text", true, "例）東京都・神奈川県") +
      textarea("achievements", "主な施工・対応実績", true, "実績・得意分野をご記入ください") +
      field("monthly_capacity", "月間対応可能件数", "text", false, "例）10件") +
      field("available_schedule", "対応可能な曜日・時間帯", "text", false, "例）平日9:00〜18:00、土曜対応可") +
      "</section>" +

      '<section class="prt-reg-section" aria-labelledby="prt-sec-3">' +
      '<div class="prt-reg-section__head"><span class="prt-reg-section__num">3</span>' +
      '<h2 class="prt-reg-section__title" id="prt-sec-3">資格・許可</h2></div>' +
      field("construction_license", "建設業許可番号", "text", false, "例）東京都知事許可（般-XX）第XXXXX号") +
      field("electrician_license", "電気工事士", "text", false, "例）第一種電気工事士") +
      field("water_supply_engineer", "給水装置工事主任技術者", "text", false) +
      field("gas_pipe_license", "ガス可とう管", "text", false) +
      textarea("other_licenses", "その他保有資格・許可", false, "その他の資格・許可があればご記入ください") +
      "</section>" +

      '<section class="prt-reg-section" aria-labelledby="prt-sec-4">' +
      '<div class="prt-reg-section__head"><span class="prt-reg-section__num">4</span>' +
      '<h2 class="prt-reg-section__title" id="prt-sec-4">保険・労災</h2></div>' +

      '<fieldset class="prt-reg-field prt-reg-field--choice"><legend class="prt-reg-field__legend">請負業者賠償責任保険の加入状況<span class="prt-reg-badge">必須</span></legend>' +
      '<div class="prt-reg-radio-group prt-reg-radio-group--inline" role="radiogroup" aria-label="請負業者賠償責任保険の加入状況">' +
      radio("liability_insurance", "加入済み", "joined", true) +
      radio("liability_insurance", "未加入", "not_joined", false) +
      radio("liability_insurance", "加入予定", "planned", false) +
      "</div></fieldset>" +

      field("insurance_company", "保険会社名", "text", false, "例）○○損害保険") +
      coverageSelect("personal_coverage", "対人補償額") +
      coverageSelect("property_coverage", "対物補償額") +

      '<fieldset class="prt-reg-field prt-reg-field--choice" data-prt-workers-comp-field>' +
      '<legend class="prt-reg-field__legend">労災加入状況<span class="prt-reg-badge">必須</span></legend>' +
      '<p class="prt-reg-field__hint" data-prt-workers-comp-note></p>' +
      '<div class="prt-reg-radio-group prt-reg-radio-group--stack" data-prt-workers-comp-options role="radiogroup" aria-label="労災加入状況"></div>' +
      "</fieldset>" +
      "</section>" +

      '<section class="prt-reg-section" aria-labelledby="prt-sec-5">' +
      '<div class="prt-reg-section__head"><span class="prt-reg-section__num">5</span>' +
      '<h2 class="prt-reg-section__title" id="prt-sec-5">インボイス</h2></div>' +
      '<fieldset class="prt-reg-field prt-reg-field--choice"><legend class="prt-reg-field__legend">インボイス登録状況</legend>' +
      '<div class="prt-reg-radio-group prt-reg-radio-group--stack" role="radiogroup" aria-label="インボイス登録状況">' +
      radio("invoice_status", "登録済み", "registered", false) +
      radio("invoice_status", "未登録", "not_registered", false) +
      radio("invoice_status", "申請中", "applying", false) +
      radio("invoice_status", "該当なし / 免税事業者", "not_applicable", true) +
      "</div></fieldset>" +
      '<div class="prt-reg-field prt-reg-field--invoice-number" data-prt-invoice-number-field hidden>' +
      '<label for="prt-invoice_number">適格請求書発行事業者登録番号</label>' +
      '<input class="prt-reg-input" type="text" id="prt-invoice_number" name="invoice_number" placeholder="例）T1234567890123" />' +
      '<p class="prt-reg-field__hint">登録済みの場合は T から始まる番号をご入力ください。</p>' +
      "</div>" +
      "</section>" +

      '<section class="prt-reg-section" aria-labelledby="prt-sec-6">' +
      '<div class="prt-reg-section__head"><span class="prt-reg-section__num">6</span>' +
      '<h2 class="prt-reg-section__title" id="prt-sec-6">添付書類<span class="prt-reg-badge prt-reg-badge--optional">任意</span></h2></div>' +
      '<p class="prt-reg-docs-note">書類は後日提出できます。<br>まずは基本情報のみで登録可能です。<br>審査・契約前に必要書類の提出をご案内します。</p>' +
      fileField("file_insurance", "保険証券") +
      fileField("file_workers_comp", "労災加入証明") +
      fileField("file_construction_license", "建設業許可証") +
      fileField("file_qualification", "資格証") +
      fileField("file_company_profile", "会社案内") +
      "</section>" +

      '<section class="prt-reg-section" aria-labelledby="prt-sec-7">' +
      '<div class="prt-reg-section__head"><span class="prt-reg-section__num">7</span>' +
      '<h2 class="prt-reg-section__title" id="prt-sec-7">確認・同意</h2></div>' +
      '<div class="prt-reg-agree">' +
      agreeCheck("agree_antisocial", "反社会的勢力ではありません", true) +
      agreeCheck("agree_truth", "提出情報に虚偽はありません", true) +
      agreeCheck("agree_insurance", "保険・労災の加入内容に虚偽はありません", true) +
      agreeCheck("agree_contract", brand + "の審査後に電子契約へ進むことに同意します", true) +
      '<label class="prt-reg-check" for="prt-agree-privacy">' +
      '<input type="checkbox" id="prt-agree-privacy" name="agree_privacy" value="yes" required />' +
      '<span><a href="' + privacyUrl + '" target="_blank" rel="noopener">プライバシーポリシー</a>に同意します<span class="prt-reg-badge">必須</span></span></label>' +
      "</div>" +
      '<div class="prt-reg-submit-wrap">' +
      '<button type="submit" class="prt-reg-submit">一次登録を送信</button>' +
      "</div>" +
      "</section>" +

      "</form>" +
      '<div class="prt-reg-success" data-prt-success role="status" aria-live="polite">' +
      '<p class="prt-reg-success__title">一次登録を受け付けました</p>' +
      '<p class="prt-reg-success__text">内容確認後、審査結果と必要書類のご案内をお送りします。</p>' +
      "</div>"
    );
  }

  function field(name, label, type, required, placeholder) {
    var id = "prt-" + name;
    var req = required ? '<span class="prt-reg-badge">必須</span>' : "";
    var reqAttr = required ? " required" : "";
    var ph = placeholder ? ' placeholder="' + escapeHtml(placeholder) + '"' : "";
    return (
      '<div class="prt-reg-field">' +
      '<label for="' + id + '">' + escapeHtml(label) + req + "</label>" +
      '<input class="prt-reg-input" type="' + type + '" id="' + id + '" name="' + name + '"' + ph + reqAttr + " />" +
      "</div>"
    );
  }

  function textarea(name, label, required, placeholder) {
    var id = "prt-" + name;
    var req = required ? '<span class="prt-reg-badge">必須</span>' : "";
    var reqAttr = required ? " required" : "";
    return (
      '<div class="prt-reg-field">' +
      '<label for="' + id + '">' + escapeHtml(label) + req + "</label>" +
      '<textarea class="prt-reg-textarea" id="' + id + '" name="' + name + '" placeholder="' + escapeHtml(placeholder) + '"' + reqAttr + "></textarea>" +
      "</div>"
    );
  }

  function radio(name, label, value, checked) {
    var id = "prt-" + name + "-" + value;
    var chk = checked ? " checked" : "";
    var reqAttr = name === "entity_type" || name === "liability_insurance" ? " required" : "";
    return (
      '<label class="prt-reg-radio prt-reg-radio--simple" for="' + id + '">' +
      '<input class="prt-reg-radio__input" type="radio" id="' + id + '" name="' + name + '" value="' + value + '"' + reqAttr + chk + " />" +
      '<span class="prt-reg-radio__text">' + escapeHtml(label) + "</span></label>"
    );
  }

  function coverageSelect(name, label) {
    var id = "prt-" + name;
    var otherId = id + "_other";
    var options = COVERAGE_OPTIONS.map(function (opt) {
      return '<option value="' + escapeHtml(opt.value) + '">' + escapeHtml(opt.label) + "</option>";
    }).join("");
    return (
      '<div class="prt-reg-field" data-prt-coverage-field="' + name + '">' +
      '<label for="' + id + '">' + escapeHtml(label) + "</label>" +
      '<select class="prt-reg-select" id="' + id + '" name="' + name + '" data-prt-coverage-select>' + options + "</select>" +
      '<div class="prt-reg-field prt-reg-field--coverage-other" data-prt-coverage-other hidden>' +
      '<label for="' + otherId + '">' + escapeHtml(label) + "（その他・詳細）</label>" +
      '<input class="prt-reg-input" type="text" id="' + otherId + '" name="' + name + '_other" placeholder="例）2,000万円" />' +
      "</div></div>"
    );
  }

  function agreeCheck(name, label, required) {
    var id = "prt-" + name;
    var reqAttr = required ? " required" : "";
    var req = required ? '<span class="prt-reg-badge">必須</span>' : "";
    return (
      '<label class="prt-reg-check" for="' + id + '">' +
      '<input type="checkbox" id="' + id + '" name="' + name + '" value="yes"' + reqAttr + " />" +
      "<span>" + escapeHtml(label) + req + "</span></label>"
    );
  }

  function fileField(name, label) {
    var id = "prt-" + name;
    return (
      '<div class="prt-reg-field">' +
      '<label for="' + id + '">' + escapeHtml(label) + "</label>" +
      '<input class="prt-reg-file" type="file" id="' + id + '" name="' + name + '" accept=".pdf,.jpg,.jpeg,.png" />' +
      "</div>"
    );
  }

  function getSelectedEntityType(form) {
    var selected = form.querySelector('input[name="entity_type"]:checked');
    return selected ? selected.value : "corporation";
  }

  function bindCorpToggle(form) {
    var corpFields = form.querySelectorAll("[data-prt-corp-field]");
    var nonCorpNote = form.querySelector("[data-prt-non-corp-note]");
    var corpInput = form.querySelector("#prt-corporate_number");
    var radios = form.querySelectorAll('input[name="entity_type"]');

    function update() {
      var entityType = getSelectedEntityType(form);
      var isCorp = entityType === "corporation";
      corpFields.forEach(function (el) {
        el.classList.toggle("prt-reg-field--visible", isCorp);
      });
      if (nonCorpNote) nonCorpNote.hidden = isCorp;
      if (corpInput) {
        if (isCorp) {
          corpInput.setAttribute("required", "");
        } else {
          corpInput.removeAttribute("required");
          corpInput.value = "";
        }
      }
    }

    radios.forEach(function (r) {
      r.addEventListener("change", update);
    });
    update();
  }

  function renderWorkersCompOptions(form, entityType) {
    var container = form.querySelector("[data-prt-workers-comp-options]");
    var noteEl = form.querySelector("[data-prt-workers-comp-note]");
    if (!container) return;

    var options = WORKERS_COMP_BY_ENTITY[entityType] || WORKERS_COMP_BY_ENTITY.corporation;
    if (noteEl) {
      noteEl.textContent = WORKERS_COMP_NOTES[entityType] || "";
    }

    container.innerHTML = options.map(function (opt, index) {
      var id = "prt-workers_comp-" + opt.value;
      var checked = index === 0 ? " checked" : "";
      return (
        '<label class="prt-reg-radio prt-reg-radio--simple" for="' + id + '">' +
        '<input class="prt-reg-radio__input" type="radio" id="' + id + '" name="workers_comp" value="' + escapeHtml(opt.value) + '" required' + checked + " />" +
        '<span class="prt-reg-radio__text">' + escapeHtml(opt.label) + "</span></label>"
      );
    }).join("");
  }

  function bindWorkersCompToggle(form) {
    var radios = form.querySelectorAll('input[name="entity_type"]');
    function update() {
      renderWorkersCompOptions(form, getSelectedEntityType(form));
    }
    radios.forEach(function (r) {
      r.addEventListener("change", update);
    });
    update();
  }

  function bindInvoiceToggle(form) {
    var numberField = form.querySelector("[data-prt-invoice-number-field]");
    var radios = form.querySelectorAll('input[name="invoice_status"]');

    function update() {
      var selected = form.querySelector('input[name="invoice_status"]:checked');
      var showNumber = selected && selected.value === "registered";
      if (numberField) numberField.hidden = !showNumber;
      var invoiceInput = form.querySelector("#prt-invoice_number");
      if (invoiceInput && !showNumber) invoiceInput.value = "";
    }

    radios.forEach(function (r) {
      r.addEventListener("change", update);
    });
    update();
  }

  function bindCoverageOtherToggle(form) {
    form.querySelectorAll("[data-prt-coverage-select]").forEach(function (select) {
      var field = select.closest("[data-prt-coverage-field]");
      var otherWrap = field ? field.querySelector("[data-prt-coverage-other]") : null;
      function update() {
        var isOther = select.value === "other";
        if (otherWrap) otherWrap.hidden = !isOther;
        if (!isOther && otherWrap) {
          var otherInput = otherWrap.querySelector("input");
          if (otherInput) otherInput.value = "";
        }
      }
      select.addEventListener("change", update);
      update();
    });
  }

  function showFormError(form, message) {
    var errEl = form.querySelector("[data-prt-form-error]");
    if (!errEl) {
      errEl = document.createElement("p");
      errEl.className = "prt-reg-form-error";
      errEl.setAttribute("data-prt-form-error", "");
      errEl.setAttribute("role", "alert");
      form.insertBefore(errEl, form.firstChild);
    }
    errEl.textContent = message;
    errEl.hidden = false;
  }

  function clearFormError(form) {
    var errEl = form.querySelector("[data-prt-form-error]");
    if (errEl) errEl.hidden = true;
  }

  function showSuccess(form, successEl) {
    form.hidden = true;
    if (successEl) {
      successEl.classList.add("is-visible");
      successEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function bindSubmit(form, successEl) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      clearFormError(form);
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      var trades = form.querySelectorAll('input[name="trades"]:checked');
      if (trades.length === 0) {
        var firstTrade = form.querySelector('input[name="trades"]');
        if (firstTrade) {
          firstTrade.setCustomValidity("業種を1つ以上選択してください");
          firstTrade.reportValidity();
          firstTrade.setCustomValidity("");
        }
        return;
      }

      var api = window.TASU_PARTNER_API;
      if (!api || !api.shouldUseApi()) {
        showSuccess(form, successEl);
        return;
      }

      var submitBtn = form.querySelector(".prt-reg-submit");
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "送信中…";
      }

      var payload = api.collectRegisterPayload(form);
      api.partnerCreate(payload)
        .then(function () {
          showSuccess(form, successEl);
        })
        .catch(function (err) {
          showFormError(form, err.message || "送信に失敗しました。しばらくしてから再度お試しください。");
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = "一次登録を送信";
          }
        });
    });
  }

  function init() {
    var hosts = document.querySelectorAll("[data-partner-register-form]");
    hosts.forEach(function (host) {
      var source = getSource(host);
      var brand = host.getAttribute("data-brand") || "TASFUL";
      var privacyUrl = host.getAttribute("data-privacy-url") || "/company/legal/privacy.html";
      host.innerHTML = buildFormHtml({ source: source, brand: brand, privacyUrl: privacyUrl });
      var form = host.querySelector("[data-partner-register-form-el]");
      var successEl = host.querySelector("[data-prt-success]");
      var sourceInput = host.querySelector("[data-prt-source-input]");
      if (sourceInput) sourceInput.value = source;
      if (form) {
        bindCorpToggle(form);
        bindWorkersCompToggle(form);
        bindInvoiceToggle(form);
        bindCoverageOtherToggle(form);
        bindSubmit(form, successEl);
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
