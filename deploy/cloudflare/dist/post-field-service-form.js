/**
 * 業務サービス掲載フォーム — detail-business-service.html と1対1の項目
 */
(function () {
  "use strict";

  const FS_FEATURE_PRESETS = (
    window.TasuBusinessServiceData?.BADGE_PRESETS || [
      "見積無料",
      "即日対応",
      "夜間対応",
      "土日対応",
      "全国対応",
      "法人対応",
      "定期契約対応",
      "オンライン対応",
      "リモート対応",
      "損害保険加入",
      "有資格者在籍",
      "写真報告対応",
      "24時間受付",
      "アフターサポート",
    ]
  ).map((label) => ({ label }));

  /** @deprecated 互換エイリアス */
  const FS_HERO_BADGES = FS_FEATURE_PRESETS;

  const FS_CONTACT_METHOD_PRESETS = [
    "電話",
    "メール",
    "チャット",
    "LINE",
    "Zoom",
    "Google Meet",
    "現地相談",
    "その他",
  ];

  const MAX_FEATURE_CUSTOM = 6;
  const MAX_FLOW_STEPS = 8;
  const MAX_LICENSE_ITEMS = 12;
  const MAX_CERT_IMAGES = 5;
  const MAX_OVERVIEW_KPIS = 4;

  const FS_OVERVIEW_KPI_DEFAULTS = [
    { label: "対応実績", value: "" },
    { label: "法人契約", value: "" },
    { label: "最短対応", value: "" },
    { label: "対応エリア", value: "" },
  ];

  const DEFAULT_FLOW_STEPS = [
    { title: "お問い合わせ", desc: "お電話・チャット・フォームからご相談ください。" },
    { title: "現地確認", desc: "現地調査・ヒアリングを行い、状況を確認します。" },
    { title: "お見積り", desc: "内容に応じた正式なお見積りをご提示します。" },
    { title: "作業開始", desc: "ご契約後、作業・サービス提供を開始します。" },
  ];

  const FS_IMAGE_HINT =
    "実際の施工写真・許可証・資料画像などを登録してください。";

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function fsAddBtn(label, dataAttr) {
    return `<button type="button" class="post-fs-add-btn" ${dataAttr}><span class="post-fs-add-btn__icon" aria-hidden="true">+</span><span>${escapeHtml(label)}</span></button>`;
  }

  function fsRemoveBtn(dataAttr, label = "削除") {
    return `<button type="button" class="post-fs-remove-btn" ${dataAttr} aria-label="${escapeHtml(label)}">${escapeHtml(label)}</button>`;
  }

  function fsCardHead(title, desc, titleId = "") {
    const idAttr = titleId ? ` id="${titleId}"` : "";
    return `
      <header class="post-field-service-card__head">
        <h2 class="post-field-service-card__title"${idAttr}>${escapeHtml(title)}</h2>
        <p class="post-field-service-card__desc">${escapeHtml(desc)}</p>
        <hr class="post-field-service-card__divider" aria-hidden="true">
      </header>`;
  }

  function fsFieldHint(text) {
    return `<span class="post-fs-field-hint">${escapeHtml(text)}</span>`;
  }

  function buildFsCtaSwitchRow(label, name, dataAttr, checked = true) {
    const checkedAttr = checked ? " checked" : "";
    return `<div class="post-fs-switch-row">
      <span class="post-fs-switch-row__label">${escapeHtml(label)}</span>
      <label class="post-fs-switch">
        <input type="checkbox" name="${escapeHtml(name)}" ${dataAttr}${checkedAttr} data-business-field>
        <span class="post-fs-switch__slider" aria-hidden="true"></span>
      </label>
    </div>`;
  }

  function buildFsCtaSwitchListHtml() {
    return `<div class="post-fs-cta-switch-list post-field--full" data-fs-cta-switch-list>
      ${buildFsCtaSwitchRow("見積もり表示", "show_estimate_cta", "data-fs-show-estimate-chk", true)}
      ${buildFsCtaSwitchRow("問い合わせ表示", "show_contact_cta", "data-fs-show-inquiry-chk", true)}
      ${buildFsCtaSwitchRow("電話表示", "show_phone_cta", "data-fs-show-phone-btn-chk", false)}
      ${buildFsCtaSwitchRow("AI相談表示", "show_ai_consult_cta", "data-fs-show-ai-chk", false)}
    </div>`;
  }

  function buildOverviewKpiRowHtml(label = "", value = "") {
    return `<div class="post-fs-kpi-row" data-fs-kpi-row>
      <p class="post-field">
        <label>ラベル</label>
        <input type="text" data-fs-kpi-label maxlength="24" value="${escapeHtml(label)}" placeholder="例：対応実績" data-business-field>
      </p>
      <p class="post-field">
        <label>値</label>
        <input type="text" data-fs-kpi-value maxlength="40" value="${escapeHtml(value)}" placeholder="例：500件以上" data-business-field>
      </p>
    </div>`;
  }

  function buildOverviewKpiGridHtml() {
    return `<div class="post-field post-field--full">
      <p class="post-field__legend">実績指標（KPI）</p>
      ${fsFieldHint("詳細ページのサービス概要右側に表示されます。最大4件まで登録できます。")}
      <div class="post-fs-kpi-grid" data-fs-kpi-list>
        ${FS_OVERVIEW_KPI_DEFAULTS.map((item) => buildOverviewKpiRowHtml(item.label, item.value)).join("")}
      </div>
    </div>`;
  }

  function mountCard(host, innerHtml) {
    if (!host || host.dataset.fsFormBuilt) return;
    host.dataset.fsFormBuilt = "1";
    host.innerHTML = innerHtml;
  }

  function buildCertImageField(existingUrl = "") {
    if (!window.TasuPostImageUploadSlot?.buildMarkup) return "";
    return window.TasuPostImageUploadSlot.buildMarkup({
      label: "資格証・許可証・保険証明画像",
      hint:
        "許可証・保険証券・認定証など、信頼性向上につながる画像を登録してください。",
      hiddenAttr:
        'data-fs-image-url data-fs-cert-image-url data-fs-field="license_cert_image_url" id="fsLicenseCertUrl"',
      dropzoneAttr: 'data-fs-image-dropzone',
      inputAttr: 'data-fs-image-input',
      previewAttr: 'data-fs-image-preview',
      fileNameAttr: 'data-fs-image-file-name',
      browseAttr: 'data-fs-image-browse',
      existingUrl,
    });
  }

  function buildDocThumbField(existingUrl = "") {
    if (!window.TasuPostImageUploadSlot?.buildMarkup) return "";
    return window.TasuPostImageUploadSlot.buildMarkup({
      label: "資料サムネイル（任意）",
      hint: FS_IMAGE_HINT,
      hiddenAttr: 'data-fs-image-url data-fs-doc-image-url id="fsDocImageUrl"',
      dropzoneAttr: 'data-fs-image-dropzone',
      inputAttr: 'data-fs-image-input',
      previewAttr: 'data-fs-image-preview',
      fileNameAttr: 'data-fs-image-file-name',
      browseAttr: 'data-fs-image-browse',
      existingUrl,
    });
  }

  function initStandaloneUploads(form) {
    form.querySelectorAll("[data-fs-image-upload]").forEach((host) => {
      const hidden = host.querySelector("[data-fs-image-url]");
      const url = hidden?.value?.trim() || "";
      window.TasuPostImageUploadSlot?.init?.(host, { existingUrl: url });
    });
  }

  function buildCertImageRowField(existingUrl = "", withLegacyId = false) {
    if (!window.TasuPostImageUploadSlot?.buildMarkup) return "";
    return window.TasuPostImageUploadSlot.buildMarkup({
      label: "資格証・許可証・保険証明画像",
      hint:
        "許可証・保険証券・認定証など、信頼性向上につながる画像を登録してください。",
      hiddenAttr: withLegacyId
        ? 'data-fs-image-url data-fs-cert-image-url data-fs-field="license_cert_image_url" id="fsLicenseCertUrl"'
        : 'data-fs-image-url data-fs-cert-image-url',
      dropzoneAttr: 'data-fs-image-dropzone',
      inputAttr: 'data-fs-image-input',
      previewAttr: 'data-fs-image-preview',
      fileNameAttr: 'data-fs-image-file-name',
      browseAttr: 'data-fs-image-browse',
      existingUrl,
    });
  }

  function addCertImageRow(form, existingUrl = "", opts = {}) {
    const list = form.querySelector("[data-fs-cert-images-list]");
    if (!list) return;
    const count = list.querySelectorAll("[data-fs-cert-image-row]").length;
    if (count >= MAX_CERT_IMAGES) return;
    const withLegacyId = opts.withLegacyId === true;

    const row = document.createElement("div");
    row.className = "post-fs-repeater post-fs-mini-card post-fs-repeater--cert-image";
    row.dataset.fsCertImageRow = "1";
    row.innerHTML = `
      ${count === 0 ? "" : fsRemoveBtn("data-fs-cert-image-remove")}
      ${buildCertImageRowField(existingUrl, withLegacyId)}
    `;
    list.appendChild(row);
    const host = row.querySelector("[data-fs-image-upload]");
    if (host) window.TasuPostImageUploadSlot?.init?.(host, { existingUrl });
  }

  function collectContactMethods(form) {
    const picked = new Set();
    form.querySelectorAll("[data-fs-contact-method]:checked").forEach((el) => {
      const v = String(el.value || "").trim();
      if (v) picked.add(v);
    });
    return Array.from(picked).slice(0, 10);
  }

  function collectCertImages(form) {
    const urls = [];
    form.querySelectorAll("[data-fs-cert-image-url]").forEach((el) => {
      const v = String(el.value || "").trim();
      if (v) urls.push(v);
    });
    const uniq = [];
    const seen = new Set();
    urls.forEach((u) => {
      if (seen.has(u)) return;
      seen.add(u);
      uniq.push(u);
    });
    return uniq.slice(0, MAX_CERT_IMAGES).map((image_url) => ({ image_url }));
  }

  function ensureFieldServiceCtaControls(form) {
    const flow = form?.querySelector("[data-field-service-flow]");
    if (!flow) return;
    const contactMount = flow.querySelector('[data-fs-mount="contact"]');
    if (contactMount && !contactMount.querySelector("[data-fs-cta-toggles-hint]")) {
      contactMount.insertAdjacentHTML(
        "afterbegin",
        `
        <div class="post-fs-cta-toggles post-field--full" data-fs-cta-toggles-hint>
          <p class="post-field__legend">詳細ページのCTA表示</p>
          <span class="post-fs-field-hint">見積・問い合わせ・電話・AI相談の表示を切り替えます。OFFにした導線は詳細ページに表示されません。</span>
        </div>`
      );
    }
    if (contactMount && !contactMount.querySelector("[data-fs-cta-switch-list]")) {
      const hint = contactMount.querySelector("[data-fs-cta-toggles-hint]");
      if (hint) {
        hint.insertAdjacentHTML("afterend", buildFsCtaSwitchListHtml());
      } else {
        contactMount.insertAdjacentHTML("afterbegin", buildFsCtaSwitchListHtml());
      }
    }
    if (contactMount && !contactMount.querySelector("#fsCtaEstimateText")) {
      contactMount.insertAdjacentHTML(
        "beforeend",
        `
        <p class="post-field post-field--full post-fs-cta-copy-block">
          <span class="post-field__legend">ボタン文言</span>
          <span class="post-fs-field-hint">表示をONにしたボタンに表示するテキストです。</span>
        </p>
        <p class="post-field post-field--full">
          <label for="fsCtaEstimateText">見積ボタン文言</label>
          ${fsFieldHint("詳細ページの見積依頼ボタンに表示されます。")}
          <input type="text" id="fsCtaEstimateText" name="fs_cta_estimate_text" maxlength="40" data-business-field value="見積もりを依頼する">
        </p>
        <p class="post-field post-field--full">
          <label for="fsCtaInquiryText">問い合わせボタン文言</label>
          ${fsFieldHint("詳細ページの問い合わせボタンに表示されます。")}
          <input type="text" id="fsCtaInquiryText" name="fs_cta_inquiry_text" maxlength="40" data-business-field value="チャットで問い合わせ">
        </p>`
      );
    }
  }

  function ensureFieldServiceFormSections(form) {
    if (!form) return;
    ensureFieldServiceCtaControls(form);
    const flow = form.querySelector("[data-field-service-flow]");
    if (!flow) return;
    if (flow.dataset.fsSectionsBuilt) return;
    flow.dataset.fsSectionsBuilt = "1";

    const slot = (key) => flow.querySelector(`[data-fs-mount="${key}"]`);

    mountCard(slot("hero"), `
      <section class="post-field-service-card" data-fs-block="hero" data-business-form-key="fieldServiceFlow" aria-labelledby="fsHeroTitle">
        ${fsCardHead(
          "上部表示情報",
          "詳細ページ上部に表示される情報です。営業時間・対応エリア・対応方法などを設定してください。",
          "fsHeroTitle"
        )}
        <div class="post-field-service-card__body post-field-service-card__body--grid">
          <p class="post-field">
            <label for="fsHeroPhone">電話番号<span class="post-field__required">必須</span></label>
            ${fsFieldHint("詳細ページ上部の電話リンクに表示されます。")}
            <input type="tel" id="fsHeroPhone" name="fs_hero_phone" maxlength="40" data-business-field placeholder="例：06-0000-0000">
          </p>
          <p class="post-field">
            <label for="fsHeroHours">営業時間</label>
            ${fsFieldHint("受付可能な時間帯を記載してください。")}
            <input type="text" id="fsHeroHours" name="fs_hero_hours" maxlength="120" data-business-field placeholder="例：9:00〜18:00（土日祝休）">
          </p>
          <p class="post-field post-field--full">
            <label for="fsHeroAreaSummary">対応エリア要約<span class="post-field__required">必須</span></label>
            ${fsFieldHint("ヒーロー直下に短く表示するエリアです。")}
            <input type="text" id="fsHeroAreaSummary" name="fs_hero_area" maxlength="200" data-business-field placeholder="例：大阪府全域・東京都23区">
          </p>
          <p class="post-field post-field--full">
            <span class="post-field__legend">希望連絡方法</span>
            ${fsFieldHint("対応可能な連絡方法を選択してください")}
            <div class="post-fs-contact-method-grid" data-fs-contact-methods></div>
          </p>
        </div>
      </section>`);

    mountCard(slot("features"), `
      <section class="post-field-service-card" data-fs-block="features" data-business-form-key="fieldServiceFlow" aria-labelledby="fsFeaturesTitle">
        ${fsCardHead(
          "特徴・対応内容",
          "サービスの強みを選択してください。選択した内容は詳細ページにタグ表示されます。",
          "fsFeaturesTitle"
        )}
        <div class="post-field-service-card__body post-field-service-card__body--stack">
          <fieldset class="post-field post-field--checkgroup post-field--full" data-fs-feature-presets-fieldset>
            <legend class="post-field__legend">よく使う特徴（クリックで選択）</legend>
            <div class="post-fs-preset-tags" data-fs-feature-presets></div>
          </fieldset>
          <div class="post-field post-field--full" data-fs-feature-custom-wrap>
            <p class="post-field__legend">その他の特徴</p>
            ${fsFieldHint("プリセットにない特徴だけ追加してください。")}
            <div data-fs-feature-custom-list></div>
            ${fsAddBtn("その他特徴を追加", "data-fs-feature-custom-add")}
          </div>
        </div>
      </section>`);

    mountCard(slot("overview"), `
      <section class="post-field-service-card" data-fs-block="overview" data-business-form-key="fieldServiceFlow" aria-labelledby="fsOverviewTitle">
        ${fsCardHead(
          "サービス概要",
          "サービス内容や対応可能な業務について詳しく説明してください。",
          "fsOverviewTitle"
        )}
        <div class="post-field-service-card__body post-field-service-card__body--stack">
          <p class="post-field post-field--full">
            <label for="fsOverviewText">サービス概要テキスト</label>
            ${fsFieldHint("詳細ページの「サービス概要」セクションに表示されます。")}
            <textarea id="fsOverviewText" name="fs_overview_text" rows="5" data-fs-field="overview_text" data-business-field placeholder="例：法人向けオフィス清掃・定期メンテナンスを中心に、関西全域で対応しています。"></textarea>
          </p>
          ${buildOverviewKpiGridHtml()}
        </div>
      </section>`);

    mountCard(slot("license"), `
      <section class="post-field-service-card" data-fs-block="license" data-business-form-key="fieldServiceFlow" aria-labelledby="fsLicenseTitle">
        ${fsCardHead(
          "資格・許可・保険",
          "保有資格・許可証・損害保険などを登録してください。法人利用者への信頼性向上につながります。",
          "fsLicenseTitle"
        )}
        <div class="post-field-service-card__body post-field-service-card__body--stack">
          <div class="post-field post-field--full" data-fs-license-list-wrap>
            <p class="post-field__legend">資格・許可の一覧</p>
            ${fsFieldHint("詳細ページの「資格・許可」テーブルに表示されます。")}
            <div data-fs-license-items-list></div>
            ${fsAddBtn("資格・許可を追加", "data-fs-license-item-add")}
          </div>
          <div class="post-field post-field--full" data-fs-cert-images-wrap>
            <p class="post-field__legend">資格証・許可証・保険証明画像</p>
            ${fsFieldHint("資格証・許可証・保険証明画像は運営確認用です。一般公開はされません。最大5枚まで登録できます。")}
            <div data-fs-cert-images-list></div>
            ${fsAddBtn("画像を追加", "data-fs-cert-image-add")}
          </div>
        </div>
      </section>`);

    mountCard(slot("flow"), `
      <section class="post-field-service-card" data-fs-block="flow" data-business-form-key="fieldServiceFlow" aria-labelledby="fsFlowTitle">
        ${fsCardHead(
          "ご利用の流れ",
          "利用者が依頼する際の流れを表示します。通常は「お問い合わせ → 現地確認 → 見積 → 作業開始」の流れです。",
          "fsFlowTitle"
        )}
        <div class="post-field-service-card__body post-field-service-card__body--stack">
          ${fsFieldHint("詳細ページの「ご利用の流れ」にステップ順で表示されます。")}
          <div data-fs-flow-steps-list></div>
          ${fsAddBtn("ステップを追加", "data-fs-flow-step-add")}
        </div>
      </section>`);

    mountCard(slot("company"), `
      <section class="post-field-service-card" data-fs-block="company-detail" data-business-form-key="fieldServiceFlow" aria-labelledby="fsCompanyDetailTitle">
        ${fsCardHead(
          "会社・事業者情報",
          "会社概要や所在地などを入力してください。詳細ページ下部に表示されます。",
          "fsCompanyDetailTitle"
        )}
        <div class="post-field-service-card__body post-field-service-card__body--grid">
          <p class="post-field">
            <label for="fsRepresentative">代表者名</label>
            <input type="text" id="fsRepresentative" name="fs_representative" maxlength="80" data-business-field placeholder="例：山田 太郎">
          </p>
          <p class="post-field">
            <label for="fsEstablished">設立年</label>
            <input type="text" id="fsEstablished" name="fs_established" maxlength="40" data-business-field placeholder="例：2018年">
          </p>
          <p class="post-field post-field--full">
            <label for="fsPostalCode">郵便番号</label>
            <input type="text" id="fsPostalCode" name="fs_postal_code" maxlength="12" data-business-field placeholder="例：530-0001">
          </p>
          <p class="post-field post-field--full">
            <label for="fsAddress">住所</label>
            <input type="text" id="fsAddress" name="fs_address" maxlength="200" data-business-field>
          </p>
          <p class="post-field post-field--full">
            <label for="fsBusinessContent">事業内容</label>
            <textarea id="fsBusinessContent" name="fs_business_content" rows="2" data-business-field></textarea>
          </p>
          <p class="post-field post-field--full">
            <label for="fsWebsiteUrl">公式サイトURL</label>
            <input type="url" id="fsWebsiteUrl" name="fs_website_url" data-business-field inputmode="url" placeholder="https://">
          </p>
          <p class="post-field post-field--full">
            <label for="fsInvoiceNumber">インボイス登録番号</label>
            <input type="text" id="fsInvoiceNumber" name="fs_invoice_number" maxlength="40" data-business-field placeholder="T1234567890123">
          </p>
          <p class="post-field post-field--full">
            <label for="fsSnsUrl">SNSリンク</label>
            <input type="url" id="fsSnsUrl" name="fs_sns_url" data-business-field inputmode="url" placeholder="https://">
          </p>
          <p class="post-field">
            <label for="fsCompanyPhone">電話</label>
            <input type="tel" id="fsCompanyPhone" name="fs_company_phone" maxlength="40" data-business-field>
          </p>
          <p class="post-field">
            <label for="fsCompanyHours">営業時間</label>
            <input type="text" id="fsCompanyHours" name="fs_company_hours" maxlength="120" data-business-field>
          </p>
        </div>
      </section>`);

    mountCard(slot("area"), `
      <section class="post-field-service-card" data-fs-block="area-detail" data-business-form-key="fieldServiceFlow" aria-labelledby="fsAreaDetailTitle">
        ${fsCardHead(
          "対応エリア",
          "対応可能な地域やオンライン対応の有無を設定してください。",
          "fsAreaDetailTitle"
        )}
        <div class="post-field-service-card__body post-field-service-card__body--grid">
          <p class="post-field post-field--full">
            <label for="fsPrimaryArea">主な対応エリア</label>
            ${fsFieldHint("詳細ページの対応エリア欄に表示されます。")}
            <input type="text" id="fsPrimaryArea" name="fs_primary_area" maxlength="200" data-fs-field="primary_service_area" data-business-field placeholder="例：大阪府全域・東京都23区">
          </p>
          <p class="post-field post-field--full">
            <label for="fsSecondaryArea">その他対応エリア</label>
            <input type="text" id="fsSecondaryArea" name="fs_secondary_area" maxlength="200" data-fs-field="secondary_service_area" data-business-field placeholder="例：その他エリアもご相談ください">
          </p>
          <p class="post-field post-field--full">
            <label for="fsMapUrl">地図URL</label>
            <input type="url" id="fsMapUrl" name="fs_map_url" data-business-field inputmode="url" placeholder="Googleマップ等">
          </p>
          <p class="post-field">
            <label for="fsOnlineSupport">オンライン対応</label>
            <select id="fsOnlineSupport" name="fs_online_support" class="post-select" data-fs-field="online_support" data-business-field>
              <option value="">未設定</option>
              <option value="yes">対応可</option>
              <option value="no">非対応</option>
            </select>
          </p>
          <p class="post-field">
            <label for="fsVisitSupport">出張対応</label>
            <select id="fsVisitSupport" name="fs_visit_support" class="post-select" data-fs-field="visit_support" data-business-field>
              <option value="">未設定</option>
              <option value="yes">対応可</option>
              <option value="no">非対応</option>
            </select>
          </p>
        </div>
      </section>`);

    mountCard(slot("materials"), `
      <section class="post-field-service-card" data-fs-block="materials" data-business-form-key="fieldServiceFlow" aria-labelledby="fsMaterialsTitle">
        ${fsCardHead(
          "資料ダウンロード",
          "会社資料・サービス資料・PDFなどを掲載できます。",
          "fsMaterialsTitle"
        )}
        <div class="post-field-service-card__body post-field-service-card__body--stack">
          ${buildDocThumbField()}
          <p class="post-field post-field--full">
            <label for="fsMaterialsName">資料名</label>
            ${fsFieldHint("ダウンロードボタンに表示する名称です。")}
            <input type="text" id="fsMaterialsName" name="fs_materials_name" maxlength="120" data-fs-field="materials_name" data-business-field placeholder="例：サービス資料（PDF）">
          </p>
          <p class="post-field post-field--full">
            <label for="fsMaterialsUrl">資料URL</label>
            ${fsFieldHint("PDFや外部ページのURLを入力してください。")}
            <input type="url" id="fsMaterialsUrl" name="fs_materials_url" data-fs-field="materials_url" data-business-field placeholder="https://example.com/service.pdf" inputmode="url">
          </p>
        </div>
      </section>`);

    initStandaloneUploads(form);
    // 希望連絡方法（カード選択UI）
    const contactHost = form.querySelector("[data-fs-contact-methods]");
    if (contactHost && !contactHost.dataset.built) {
      contactHost.dataset.built = "1";
      const iconSvg = (name) => {
        switch (name) {
          case "phone":
            return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.8 19.8 0 0 1 3 5.18 2 2 0 0 1 5.11 3h3a2 2 0 0 1 2 1.72c.12.9.3 1.77.54 2.61a2 2 0 0 1-.45 2.11L9 10.91a16 16 0 0 0 6.09 6.09l1.47-1.2a2 2 0 0 1 2.11-.45c.84.24 1.71.42 2.61.54A2 2 0 0 1 22 16.92z"/></svg>`;
          case "mail":
            return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><path d="m22 6-10 7L2 6"/></svg>`;
          case "message-circle":
            return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5A8.5 8.5 0 0 1 21 11v.5z"/></svg>`;
          case "message-square":
            return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>`;
          case "video":
            return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 10l4.6-2.3A1 1 0 0 1 21 8.6v6.8a1 1 0 0 1-1.4.9L15 14z"/><path d="M3 6h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"/></svg>`;
          case "map-pin":
            return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s8-4.5 8-12a8 8 0 0 0-16 0c0 7.5 8 12 8 12z"/><path d="M12 10.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"/></svg>`;
          case "more-horizontal":
          default:
            return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h.01"/><path d="M12 12h.01"/><path d="M18 12h.01"/></svg>`;
        }
      };
      const iconByLabel = {
        電話: "phone",
        メール: "mail",
        チャット: "message-circle",
        LINE: "message-square",
        Zoom: "video",
        "Google Meet": "video",
        現地相談: "map-pin",
        その他: "more-horizontal",
      };
      contactHost.innerHTML = FS_CONTACT_METHOD_PRESETS.map((label) => {
        const iconName = iconByLabel[label] || "more-horizontal";
        return `<label class="post-fs-contact-card"><input type="checkbox" value="${escapeHtml(label)}" data-fs-contact-method data-business-field><span class="post-fs-contact-card__inner"><span class="post-fs-contact-card__icon" aria-hidden="true">${iconSvg(iconName)}</span><span class="post-fs-contact-card__label">${escapeHtml(label)}</span></span></label>`;
      }).join("");
    }

    // 資格画像（最低1枚を表示）
    const certList = form.querySelector("[data-fs-cert-images-list]");
    if (certList && !certList.querySelector("[data-fs-cert-image-row]")) {
      addCertImageRow(form, "", { withLegacyId: true });
    }

    buildFeaturePresetCheckboxes(form);
    bindRepeaters(form);
  }

  function buildFeaturePresetCheckboxes(form) {
    const host = form.querySelector("[data-fs-feature-presets]");
    if (!host || host.dataset.built) return;
    host.dataset.built = "1";
    host.innerHTML = FS_FEATURE_PRESETS.map(
      (b) =>
        `<label class="post-fs-preset-tag"><input type="checkbox" name="fs_feature_preset" value="${escapeHtml(b.label)}" data-fs-feature-preset data-fs-badge-preset data-business-field><span>${escapeHtml(b.label)}</span></label>`
    ).join("");
  }

  function addFeatureCustomRow(form, value) {
    const list = form.querySelector("[data-fs-feature-custom-list]");
    if (!list || list.querySelectorAll("[data-fs-feature-custom-row]").length >= MAX_FEATURE_CUSTOM) return;
    const row = document.createElement("div");
    row.className = "post-fs-repeater post-fs-mini-card post-fs-repeater--inline";
    row.dataset.fsFeatureCustomRow = "1";
    row.innerHTML = `
      ${fsRemoveBtn("data-fs-feature-custom-remove")}
      <label class="post-fs-repeater__label">その他の特徴</label>
      <input type="text" data-fs-feature-custom-label data-fs-badge-label maxlength="24" value="${escapeHtml(value)}" placeholder="例：産廃収集運搬許可あり" data-business-field>
    `;
    list.appendChild(row);
  }

  function seedFieldServiceDefaults(form) {
    if (!form?.querySelector("[data-field-service-flow]")) return;

    const menuList = form.querySelector("[data-service-menu-list]");
    if (menuList && !menuList.querySelector("[data-service-menu-row]")) {
      if (window.TasuPostBusinessServiceApply?.fillMenuItems) {
        window.TasuPostBusinessServiceApply.fillMenuItems(form, [{}]);
      }
    }

    const casesList = form.querySelector("[data-work-cases-list]");
    if (casesList && !casesList.querySelector("[data-work-case-row]")) {
      const cat =
        form.querySelector("[data-business-category-pick]:checked")?.value ||
        form.querySelector("[data-business-category-hidden]")?.value ||
        "";
      if (window.TasuPostBusinessServiceApply?.fillWorkCases) {
        window.TasuPostBusinessServiceApply.fillWorkCases(form, [{}], cat);
      }
    }

    const flowList = form.querySelector("[data-fs-flow-steps-list]");
    if (flowList && !flowList.querySelector("[data-fs-flow-step-row]")) {
      DEFAULT_FLOW_STEPS.forEach((step) => addFlowStepRow(form, step.title, step.desc));
    }

    const licList = form.querySelector("[data-fs-license-items-list]");
    if (licList && !licList.querySelector("[data-fs-license-item-row]")) {
      addLicenseItemRow(form, "", "");
    }

    const certList = form.querySelector("[data-fs-cert-images-list]");
    if (certList && !certList.querySelector("[data-fs-cert-image-row]")) {
      addCertImageRow(form, "", { withLegacyId: true });
    }
  }

  function addLicenseItemRow(form, label, value) {
    const list = form.querySelector("[data-fs-license-items-list]");
    if (!list) return;
    if (list.querySelectorAll("[data-fs-license-item-row]").length >= MAX_LICENSE_ITEMS) return;
    const row = document.createElement("div");
    row.className = "post-fs-repeater post-fs-mini-card post-fs-repeater--license";
    row.dataset.fsLicenseItemRow = "1";
    row.dataset.fsCertRow = "1";
    row.innerHTML = `
      ${fsRemoveBtn("data-fs-license-item-remove")}
      <div class="post-fs-repeater__grid">
        <p class="post-field">
          <label>資格名</label>
          <input type="text" data-fs-cert-label maxlength="60" value="${escapeHtml(label)}" placeholder="例：建設業許可（般建）" data-business-field>
        </p>
        <p class="post-field">
          <label>説明・補足</label>
          <input type="text" data-fs-cert-value maxlength="120" value="${escapeHtml(value)}" placeholder="例：大阪府知事許可 第○○○○号" data-business-field>
        </p>
      </div>
    `;
    list.appendChild(row);
  }

  function renumberFlowSteps(form) {
    form.querySelectorAll("[data-fs-flow-step-row]").forEach((row, index) => {
      const badge = row.querySelector("[data-fs-step-badge]");
      if (badge) badge.textContent = `STEP ${index + 1}`;
    });
  }

  function addFlowStepRow(form, title, desc) {
    const list = form.querySelector("[data-fs-flow-steps-list]");
    if (!list) return;
    if (list.querySelectorAll("[data-fs-flow-step-row]").length >= MAX_FLOW_STEPS) return;
    const stepNum = list.querySelectorAll("[data-fs-flow-step-row]").length + 1;
    const row = document.createElement("div");
    row.className = "post-fs-repeater post-fs-mini-card post-fs-repeater--flow post-fs-flow-step-card";
    row.dataset.fsFlowStepRow = "1";
    row.innerHTML = `
      ${fsRemoveBtn("data-fs-flow-step-remove")}
      <span class="post-fs-step-badge" data-fs-step-badge>STEP ${stepNum}</span>
      <p class="post-field post-field--full">
        <label>ステップ名</label>
        <input type="text" data-fs-flow-title maxlength="40" value="${escapeHtml(title)}" placeholder="例：お問い合わせ" data-business-field>
      </p>
      <p class="post-field post-field--full">
        <label>詳細説明</label>
        <textarea data-fs-flow-desc rows="2" maxlength="200" placeholder="例：フォームまたはお電話でご相談内容をお聞かせください。" data-business-field>${escapeHtml(desc)}</textarea>
      </p>
    `;
    list.appendChild(row);
    renumberFlowSteps(form);
  }

  function bindRepeaters(form) {
    if (form.dataset.fsRepeatersBound) return;
    form.dataset.fsRepeatersBound = "1";

    form.querySelector("[data-fs-license-item-add]")?.addEventListener("click", () => {
      addLicenseItemRow(form, "", "");
    });
    form.querySelector("[data-fs-cert-image-add]")?.addEventListener("click", () => {
      addCertImageRow(form, "", { withLegacyId: false });
    });
    form.querySelector("[data-fs-flow-step-add]")?.addEventListener("click", () => {
      addFlowStepRow(form, "", "");
    });
    form.querySelector("[data-fs-feature-custom-add]")?.addEventListener("click", () => {
      addFeatureCustomRow(form, "");
    });

    form.addEventListener("click", (e) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      if (t.matches("[data-fs-license-item-remove]")) {
        t.closest("[data-fs-license-item-row], [data-fs-cert-row]")?.remove();
      }
      if (t.matches("[data-fs-flow-step-remove]")) {
        t.closest("[data-fs-flow-step-row]")?.remove();
        renumberFlowSteps(form);
      }
      if (t.matches("[data-fs-cert-image-remove]")) {
        t.closest("[data-fs-cert-image-row]")?.remove();
      }
      if (t.matches("[data-fs-feature-custom-remove]")) {
        t.closest("[data-fs-feature-custom-row]")?.remove();
      }
    });
  }

  function collectMenuItems(form) {
    const rows = form.querySelectorAll("[data-service-menu-row]");
    const out = [];
    rows.forEach((row) => {
      const title = row.querySelector("[data-service-menu-title]")?.value?.trim() ?? "";
      const description = row.querySelector("[data-service-menu-description]")?.value?.trim() ?? "";
      const scope = row.querySelector("[data-service-menu-scope]")?.value?.trim() ?? "";
      const price = row.querySelector("[data-service-menu-price]")?.value?.trim() ?? "";
      const notes = row.querySelector("[data-service-menu-notes]")?.value?.trim() ?? "";
      const image_url =
        row.querySelector("[data-fs-image-url]")?.value?.trim() ??
        row.querySelector("[data-service-menu-image-url]")?.value?.trim() ??
        "";
      if (!title && !description && !scope && !price && !notes) return;
      out.push({ title, description, scope, price, notes, image_url });
    });
    return out;
  }

  function collectOverviewKpis(form) {
    const out = [];
    form.querySelectorAll("[data-fs-kpi-row]").forEach((row) => {
      const label = row.querySelector("[data-fs-kpi-label]")?.value?.trim() ?? "";
      const value = row.querySelector("[data-fs-kpi-value]")?.value?.trim() ?? "";
      if (!label || !value) return;
      out.push({ label, value });
    });
    return out.slice(0, MAX_OVERVIEW_KPIS);
  }

  function applyOverviewKpisToForm(form, kpis) {
    const list = form.querySelector("[data-fs-kpi-list]");
    if (!list) return;
    const rows = list.querySelectorAll("[data-fs-kpi-row]");
    const normalized = (Array.isArray(kpis) ? kpis : [])
      .map((item) => ({
        label: String(item?.label || item?.name || "").trim(),
        value: String(item?.value || "").trim(),
      }))
      .filter((item) => item.label && item.value)
      .slice(0, MAX_OVERVIEW_KPIS);
    rows.forEach((row, index) => {
      const fallback = FS_OVERVIEW_KPI_DEFAULTS[index] || { label: "", value: "" };
      const item = normalized[index] || fallback;
      const labelEl = row.querySelector("[data-fs-kpi-label]");
      const valueEl = row.querySelector("[data-fs-kpi-value]");
      if (labelEl) labelEl.value = item.label || "";
      if (valueEl) valueEl.value = item.value || "";
    });
  }

  function collectWorkCases(form) {
    const rows = form.querySelectorAll("[data-work-case-row]");
    const out = [];
    rows.forEach((row, index) => {
      const title = row.querySelector("[data-work-case-title]")?.value?.trim() ?? "";
      const description = row.querySelector("[data-work-case-description]")?.value?.trim() ?? "";
      const outcome = row.querySelector("[data-work-case-outcome]")?.value?.trim() ?? "";
      const region = row.querySelector("[data-work-case-region]")?.value?.trim() ?? "";
      const period = row.querySelector("[data-work-case-period]")?.value?.trim() ?? "";
      const price = row.querySelector("[data-work-case-cost]")?.value?.trim() ?? "";
      const image_url =
        row.querySelector("[data-fs-image-url]")?.value?.trim() ??
        row.querySelector("[data-work-case-image-url]")?.value?.trim() ??
        "";
      if (!title && !description && !outcome && !region && !period && !price && !image_url) return;
      out.push({
        title: title || `事例 ${index + 1}`,
        description,
        outcome,
        region,
        period,
        price,
        image_url,
      });
    });
    return out;
  }

  function readAdOptions(form) {
    const prPlan =
      form.querySelector("[data-biz-pr-plan]:checked")?.value ||
      form.querySelector('input[name="bizPrPlan"]:checked')?.value ||
      "none";
    const featuredPlan =
      form.querySelector("[data-biz-featured-plan]:checked")?.value ||
      form.querySelector('input[name="bizFeaturedPlan"]:checked')?.value ||
      "none";
    return {
      pr_plan: prPlan,
      featured_plan: featuredPlan,
      pr_payment_url: form.querySelector("#bizPrPaymentUrl")?.value?.trim() ?? "",
      pr_bank_info: form.querySelector("#bizPrBankInfo")?.value?.trim() ?? "",
      featured_payment_url: form.querySelector("#bizFeaturedPaymentUrl")?.value?.trim() ?? "",
      featured_bank_info: form.querySelector("#bizFeaturedBankInfo")?.value?.trim() ?? "",
    };
  }

  function readFsField(form, key) {
    const el = form.querySelector(`[data-fs-field="${key}"]`);
    if (!el) return "";
    return String(el.value ?? "").trim();
  }

  function collectFeatureBadges(form) {
    const out = [];
    const seen = new Set();
    const push = (label) => {
      const t = String(label || "").trim();
      if (!t || seen.has(t)) return;
      seen.add(t);
      out.push(t);
    };
    form
      .querySelectorAll("[data-fs-feature-preset]:checked, [data-fs-badge-preset]:checked")
      .forEach((el) => push(el.value));
    form
      .querySelectorAll("[data-fs-feature-custom-label], [data-fs-badge-label]")
      .forEach((el) => push(el.value));
    return out;
  }

  /** @deprecated */
  function collectHeroBadges(form) {
    return collectFeatureBadges(form);
  }

  function collectOverviewFeatures(form) {
    return collectFeatureBadges(form);
  }

  function collectLicenseItems(form) {
    const items = [];
    form.querySelectorAll("[data-fs-cert-row]").forEach((row) => {
      const label = row.querySelector("[data-fs-cert-label]")?.value?.trim() ?? "";
      const value = row.querySelector("[data-fs-cert-value]")?.value?.trim() ?? "";
      if (!label && !value) return;
      items.push({ label, value });
    });
    return items.slice(0, MAX_LICENSE_ITEMS);
  }

  function collectFlowSteps(form) {
    const steps = [];
    form.querySelectorAll("[data-fs-flow-step-row]").forEach((row) => {
      const title = row.querySelector("[data-fs-flow-title]")?.value?.trim() ?? "";
      const desc = row.querySelector("[data-fs-flow-desc]")?.value?.trim() ?? "";
      if (!title && !desc) return;
      steps.push({ title, desc });
    });
    return steps.slice(0, MAX_FLOW_STEPS);
  }

  function applyBusinessServiceToForm(form, bs) {
    if (!form || !bs) return;
    const hero = bs.hero || {};
    const company = bs.company_info || {};
    const area = bs.area_info || {};

    const catchEl = form.querySelector("#fsCatchCopy");
    if (catchEl) catchEl.value = hero.catch_copy || "";
    const descEl = form.querySelector("#bizExtraFieldServiceDesc");
    if (descEl) descEl.value = hero.service_description || "";
    const heroHours = form.querySelector("#fsHeroHours");
    if (heroHours) heroHours.value = hero.business_hours || "";
    const heroArea = form.querySelector("#fsHeroAreaSummary");
    if (heroArea) heroArea.value = hero.service_area_summary || "";
    const heroPhone = form.querySelector("#fsHeroPhone");
    if (heroPhone) heroPhone.value = hero.phone || "";
    const picked = new Set(
      Array.isArray(hero.contact_methods)
        ? hero.contact_methods
        : String(hero.contact_method || "")
            .split(/[、,\/・\s]+/g)
            .map((s) => s.trim())
            .filter(Boolean)
    );
    form.querySelectorAll("[data-fs-contact-method]").forEach((el) => {
      el.checked = picked.has(el.value);
    });

    const cta = bs.cta || {};
    const chk = (sel, on) => {
      const el = form.querySelector(sel);
      if (el) el.checked = on !== false;
    };
    chk("[data-fs-show-estimate-chk]", cta.estimate_enabled);
    chk("[data-fs-show-inquiry-chk]", cta.inquiry_enabled);
    chk("[data-fs-show-phone-btn-chk]", cta.phone_enabled);
    chk("[data-fs-show-ai-chk]", cta.ai_enabled);
    const estText = form.querySelector("#fsCtaEstimateText");
    if (estText) estText.value = cta.estimate_text || "";
    const inqText = form.querySelector("#fsCtaInquiryText");
    if (inqText) inqText.value = cta.inquiry_text || "";

    const badgeSet = new Set([
      ...(bs.badges || []),
      ...(bs.overview?.features || []),
    ]);
    form.querySelectorAll("[data-fs-feature-preset], [data-fs-badge-preset]").forEach((el) => {
      el.checked = badgeSet.has(el.value);
    });
    const customList = form.querySelector("[data-fs-feature-custom-list]");
    if (customList) {
      customList.innerHTML = "";
      const presets = new Set(FS_FEATURE_PRESETS.map((b) => b.label));
      badgeSet.forEach((label) => {
        if (!presets.has(label)) addFeatureCustomRow(form, label);
      });
    }

    const overviewText = form.querySelector("#fsOverviewText");
    if (overviewText) overviewText.value = bs.overview?.text || "";
    applyOverviewKpisToForm(form, bs.overview?.kpis);

    const set = (id, val) => {
      const el = form.querySelector(id);
      if (el && val != null) el.value = String(val);
    };
    set("#fsRepresentative", company.representative);
    set("#fsPostalCode", company.postal_code);
    set("#fsAddress", company.address);
    set("#fsEstablished", company.established_year);
    set("#fsBusinessContent", company.business_content);
    set("#fsWebsiteUrl", company.website_url);
    set("#fsInvoiceNumber", company.invoice_number);
    set("#fsSnsUrl", company.sns_url);
    set("#fsCompanyPhone", company.phone);
    set("#fsCompanyHours", company.business_hours);
    set("#fsPrimaryArea", area.primary);
    set("#fsSecondaryArea", area.secondary);
    set("#fsOnlineSupport", area.online_support);
    set("#fsVisitSupport", area.visit_support);
    set("#fsMapUrl", area.map_url);

    // 資格画像（最大5枚）
    const certList = form.querySelector("[data-fs-cert-images-list]");
    if (certList) {
      certList.innerHTML = "";
      const imgs = Array.isArray(bs.certifications_images) ? bs.certifications_images : [];
      const urls = imgs.map((i) => String(i?.image_url || i?.url || "").trim()).filter(Boolean);
      const fallback = String(bs.certification_image_url || "").trim();
      const merged = urls.length ? urls : fallback ? [fallback] : [];
      if (!merged.length) {
        addCertImageRow(form, "", { withLegacyId: true });
      } else {
        merged
          .slice(0, MAX_CERT_IMAGES)
          .forEach((u, idx) => addCertImageRow(form, u, { withLegacyId: idx === 0 }));
      }
    }

    const licList = form.querySelector("[data-fs-license-items-list]");
    if (licList) {
      licList.innerHTML = "";
      (bs.certifications || []).forEach((item) =>
        addLicenseItemRow(form, item.label || "", item.value || "")
      );
      if (!licList.children.length) addLicenseItemRow(form, "", "");
    }

    const flowList = form.querySelector("[data-fs-flow-steps-list]");
    if (flowList) {
      flowList.innerHTML = "";
      (bs.flow_steps || []).forEach((step) =>
        addFlowStepRow(form, step.title || "", step.desc || step.description || "")
      );
      if (!flowList.children.length) {
        DEFAULT_FLOW_STEPS.forEach((step) => addFlowStepRow(form, step.title, step.desc));
      }
    }

    const doc = (bs.documents || [])[0] || {};
    set("#fsMaterialsName", doc.name);
    set("#fsMaterialsUrl", doc.url);
    set("#fsDocImageUrl", doc.image_url);

    form.querySelectorAll("[data-fs-image-upload]").forEach((host) => {
      const url = host.querySelector("[data-fs-image-url]")?.value?.trim() || "";
      window.TasuPostImageUploadSlot?.init?.(host, { existingUrl: url });
    });
  }

  /** 依頼者への支払い方法（当事者間決済・TASFULは手数料のみ） */
  function collectProviderPayment(form) {
    const bankParts = [
      form.querySelector("#fsBankName")?.value?.trim(),
      form.querySelector("#fsBankBranch")?.value?.trim(),
      form.querySelector("#fsBankAccountType")?.value?.trim(),
      form.querySelector("#fsBankAccountNumber")?.value?.trim(),
      form.querySelector("#fsBankAccountHolder")?.value?.trim(),
    ].filter(Boolean);
    const bank_transfer_info = bankParts.length ? bankParts.join(" ") : "";
    return {
      payment_method_type: form.querySelector("#fsPaymentMethodType")?.value?.trim() || "",
      payment_url: form.querySelector("#fsPaymentUrl")?.value?.trim() || "",
      bank_name: form.querySelector("#fsBankName")?.value?.trim() || "",
      bank_branch: form.querySelector("#fsBankBranch")?.value?.trim() || "",
      bank_account_type: form.querySelector("#fsBankAccountType")?.value?.trim() || "",
      bank_account_number: form.querySelector("#fsBankAccountNumber")?.value?.trim() || "",
      bank_account_holder: form.querySelector("#fsBankAccountHolder")?.value?.trim() || "",
      payment_note: form.querySelector("#fsPaymentNote")?.value?.trim() || "",
      bank_transfer_info,
      platform_fee_rate: 0.05,
    };
  }

  /** @returns {Record<string, unknown>} field_service ブロック（後方互換） */
  function collectFieldServiceBlock(form) {
    const catchCopy = form.querySelector("#fsCatchCopy")?.value?.trim() ?? "";
    const serviceDesc = form.querySelector("#bizExtraFieldServiceDesc")?.value?.trim() || "";
    const serviceHours = form.querySelector("#fsHeroHours")?.value?.trim() || "";
    const visitArea =
      form.querySelector("#fsHeroAreaSummary")?.value?.trim() ||
      form.querySelector("#fsPrimaryArea")?.value?.trim() ||
      "";
    const contactMethods = collectContactMethods(form);

    return {
      catch_copy: catchCopy,
      service_description: serviceDesc,
      service_hours: serviceHours,
      visit_area: visitArea,
      contact_methods: contactMethods,
      contact_method: contactMethods.join("・"),
      hero_badges: collectHeroBadges(form),
      overview_text: readFsField(form, "overview_text"),
      overview_features: collectOverviewFeatures(form),
      overview_kpis: collectOverviewKpis(form),
      license_items: collectLicenseItems(form),
      license_cert_image_url: readFsField(form, "license_cert_image_url"),
      certifications_images: collectCertImages(form),
      flow_steps: collectFlowSteps(form),
      representative: form.querySelector("#fsRepresentative")?.value?.trim() ?? "",
      postal_code: form.querySelector("#fsPostalCode")?.value?.trim() ?? "",
      established_year: form.querySelector("#fsEstablished")?.value?.trim() ?? "",
      address: form.querySelector("#fsAddress")?.value?.trim() ?? "",
      business_content: form.querySelector("#fsBusinessContent")?.value?.trim() ?? "",
      website_url: form.querySelector("#fsWebsiteUrl")?.value?.trim() ?? "",
      invoice_number: form.querySelector("#fsInvoiceNumber")?.value?.trim() ?? "",
      sns_url: form.querySelector("#fsSnsUrl")?.value?.trim() ?? "",
      primary_service_area: form.querySelector("#fsPrimaryArea")?.value?.trim() ?? "",
      secondary_service_area: form.querySelector("#fsSecondaryArea")?.value?.trim() ?? "",
      online_support: form.querySelector("#fsOnlineSupport")?.value?.trim() ?? "",
      visit_support: form.querySelector("#fsVisitSupport")?.value?.trim() ?? "",
      map_url: form.querySelector("#fsMapUrl")?.value?.trim() ?? "",
      materials_name: form.querySelector("#fsMaterialsName")?.value?.trim() ?? "",
      materials_url: form.querySelector("#fsMaterialsUrl")?.value?.trim() ?? "",
      show_estimate:
        form.querySelector("#bizExtraFieldShowEstimate")?.value ||
        (form.querySelector("[data-fs-show-estimate-chk]")?.checked ? "yes" : ""),
      show_inquiry:
        form.querySelector("#bizExtraFieldShowInquiry")?.value ||
        (form.querySelector("[data-fs-show-inquiry-chk]")?.checked ? "yes" : ""),
      show_phone:
        form.querySelector("#bizExtraFieldShowPhoneBtn")?.value ||
        form.querySelector("#bizExtraFieldShowPhone")?.value ||
        (form.querySelector("[data-fs-show-phone-btn-chk]")?.checked ? "yes" : ""),
    };
  }

  function applyFieldServiceBlockToForm(form, block) {
    if (!form || !block || typeof block !== "object") return;
    const badgeKeyLabels = {
      estimate_free: "見積無料",
      consult_free: "相談無料",
      online: "オンライン対応",
      corporate: "法人契約対応",
      confidential: "秘密厳守",
      aftercare: "アフターサポート",
      same_day: "即日相談",
      nationwide: "全国対応",
      remote: "リモート対応",
    };
    const badgeList = Array.isArray(block.hero_badges)
      ? block.hero_badges
      : block.hero_badges && typeof block.hero_badges === "object"
        ? Object.entries(block.hero_badges)
            .filter(([, v]) => v)
            .map(([k]) => badgeKeyLabels[k] || k)
        : [];
    applyBusinessServiceToForm(form, {
      hero: {
        catch_copy: block.catch_copy,
        service_description: block.service_description,
        phone: block.phone,
        business_hours: block.service_hours,
        service_area_summary: block.visit_area,
        contact_methods: Array.isArray(block.contact_methods) ? block.contact_methods : [],
        contact_method: block.contact_method,
      },
      badges: badgeList,
      overview: {
        text: block.overview_text,
        features: block.overview_features || [],
        kpis: block.overview_kpis || [],
      },
      company_info: {
        representative: block.representative,
        postal_code: block.postal_code,
        address: block.address,
        established_year: block.established_year || block.established,
        business_content: block.business_content,
        website_url: block.website_url,
        invoice_number: block.invoice_number,
        sns_url: block.sns_url,
      },
      area_info: {
        primary: block.primary_service_area,
        secondary: block.secondary_service_area,
        online_support: block.online_support,
        visit_support: block.visit_support,
        map_url: block.map_url,
      },
      certifications: block.license_items || [],
      certification_image_url: block.license_cert_image_url,
      certifications_images: Array.isArray(block.certifications_images) ? block.certifications_images : [],
      flow_steps: block.flow_steps || [],
      documents: block.materials_name
        ? [{ name: block.materials_name, url: block.materials_url }]
        : [],
    });
  }

  window.TasuPostFieldServiceForm = {
    FS_FEATURE_PRESETS,
    FS_HERO_BADGES: FS_FEATURE_PRESETS,
    DEFAULT_FLOW_STEPS,
    ensureFieldServiceFormSections,
    ensureFieldServiceCtaControls,
    seedFieldServiceDefaults,
    collectFieldServiceBlock,
    collectProviderPayment,
    applyFieldServiceBlockToForm,
    applyBusinessServiceToForm,
    collectContactMethods,
    collectCertImages,
    collectMenuItems,
    collectWorkCases,
    collectOverviewKpis,
    collectFeatureBadges,
    readAdOptions,
    buildFeaturePresetCheckboxes,
    buildHeroBadgeCheckboxes: buildFeaturePresetCheckboxes,
  };
})();
