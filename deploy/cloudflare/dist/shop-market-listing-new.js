(function () {
  "use strict";

  const Data = window.TasfulMarketProductData;

  const state = {
    shopId: "",
    draft: null,
    published: null,
  };

  function $(sel) {
    return document.querySelector(sel);
  }

  function readShopId() {
    const params = new URLSearchParams(window.location.search);
    return String(params.get("shopId") || Data?.getDefaultSellerShopId?.() || "tasu-market-seller-me").trim();
  }

  function showError(message) {
    const el = $("[data-tasful-listing-error]");
    if (!el) return;
    if (!message) {
      el.hidden = true;
      el.textContent = "";
      return;
    }
    el.hidden = false;
    el.textContent = message;
  }

  function setStep(label) {
    const el = $("[data-tasful-listing-step-label]");
    if (el) el.textContent = label;
  }

  function renderCategoryOptions() {
    const select = $("[data-tasful-listing-category]");
    if (!select || !Data?.LISTING_CATEGORIES) return;
    select.innerHTML =
      `<option value="">選択してください</option>` +
      Data.LISTING_CATEGORIES.map((c) => `<option value="${Data.escAttr(c.id)}">${Data.esc(c.label)}</option>`).join("");
  }

  function renderShipOptions() {
    const select = $("[data-tasful-listing-ship]");
    if (!select || !Data?.SHIP_DAYS_OPTIONS) return;
    select.innerHTML = Data.SHIP_DAYS_OPTIONS.map(
      (o, i) =>
        `<option value="${Data.escAttr(o.id)}"${i === 1 ? " selected" : ""}>${Data.esc(o.label)}</option>`
    ).join("");
  }

  function renderConditionRadios() {
    const wrap = $("[data-tasful-listing-condition]");
    if (!wrap || !Data?.CONDITION_TYPES) return;
    wrap.innerHTML = Object.entries(Data.CONDITION_TYPES)
      .map(
        ([key, label], i) =>
          `<label class="tasful-market-listing-radio"><input type="radio" name="conditionType" value="${Data.escAttr(key)}"${i === 0 ? " checked" : ""}><span>${Data.esc(label)}</span></label>`
      )
      .join("");
  }

  function renderSubImageFields() {
    const wrap = $("[data-tasful-listing-sub-images]");
    if (!wrap) return;
    wrap.innerHTML = [1, 2, 3, 4, 5]
      .map(
        (n) =>
          `<label class="tasful-market-listing-field"><span class="tasful-market-listing-field__label">サブ画像 ${n}</span><input type="url" class="tasful-market-listing-field__input" data-tasful-listing-sub-image placeholder="https://images.unsplash.com/..."></label>`
      )
      .join("");
  }

  function prefillSellerDefaults() {
    const profile = Data?.getSellerProfile?.() || {};
    const sellerName = profile.shopName || "";
    const sellerInput = $("[data-tasful-listing-seller-name]");
    const connectInput = $("[data-tasful-listing-connect]");
    if (sellerInput && sellerName) sellerInput.value = sellerName;
    if (connectInput) connectInput.checked = Boolean(profile.connectVerified);
  }

  function syncImagePreview() {
    const url = String($("[data-tasful-listing-image]")?.value || "").trim();
    const wrap = $("[data-tasful-listing-preview]");
    const img = $("[data-tasful-listing-preview-img]");
    if (!wrap || !img) return;
    if (!url) {
      wrap.hidden = true;
      img.removeAttribute("src");
      return;
    }
    wrap.hidden = false;
    img.onerror = () => window.__tasfulMarketImgError?.(img);
    img.src = url;
  }

  function readFormDraft() {
    const subImages = [...document.querySelectorAll("[data-tasful-listing-sub-image]")]
      .map((el) => String(el.value || "").trim())
      .filter(Boolean);
    const condition = document.querySelector('input[name="conditionType"]:checked');
    return {
      shopId: state.shopId,
      title: String($("[data-tasful-listing-title]")?.value || "").trim(),
      category: String($("[data-tasful-listing-category]")?.value || "").trim(),
      conditionType: String(condition?.value || "new").trim(),
      description: String($("[data-tasful-listing-description]")?.value || "").trim(),
      priceYen: Number($("[data-tasful-listing-price]")?.value),
      taxIncluded: Boolean($("[data-tasful-listing-tax]")?.checked),
      freeShipping: Boolean($("[data-tasful-listing-free-shipping]")?.checked),
      shipDaysKey: String($("[data-tasful-listing-ship]")?.value || "").trim(),
      stock: Number($("[data-tasful-listing-stock]")?.value),
      imageUrl: String($("[data-tasful-listing-image]")?.value || "").trim(),
      subImages,
      sellerName: String($("[data-tasful-listing-seller-name]")?.value || "").trim(),
      connectVerified: Boolean($("[data-tasful-listing-connect]")?.checked),
    };
  }

  function formatPricePreview(draft) {
    if (!Number.isFinite(draft.priceYen) || draft.priceYen <= 0) return "—";
    const base = Data.formatYenAmount(draft.priceYen);
    return draft.taxIncluded ? `${base}（税込）` : base;
  }

  function renderConfirm(draft) {
    const img = $("[data-tasful-listing-confirm-image]");
    const body = $("[data-tasful-listing-confirm-body]");
    if (img) {
      img.onerror = () => window.__tasfulMarketImgError?.(img);
      img.src = Data.resolvePrimaryImage({ image: draft.imageUrl, title: draft.title }) || draft.imageUrl;
    }
    if (!body) return;

    const shipping = draft.freeShipping ? "送料無料" : "送料別";
    const connect = draft.connectVerified ? "✓ Connect認証済み" : "未設定";

    body.innerHTML = [
      ["商品名", draft.title],
      ["カテゴリ", Data.listingCategoryLabel(draft.category)],
      ["状態", Data.resolveConditionLabel(draft.conditionType)],
      ["価格", formatPricePreview(draft), "is-price"],
      ["配送", `${shipping} · ${Data.shipDaysFromKey(draft.shipDaysKey)}`],
      ["在庫", `${draft.stock}点`],
      ["出品者", draft.sellerName],
      ["Connect", connect],
      ["説明", draft.description || "—"],
    ]
      .map(([label, value, cls]) => {
        const className = cls ? ` class="${cls}"` : "";
        return `<div${className}><dt>${Data.esc(label)}</dt><dd>${Data.esc(value)}</dd></div>`;
      })
      .join("");
  }

  function showFormStep() {
    const form = $("[data-tasful-listing-form]");
    const confirm = $("[data-tasful-listing-confirm]");
    const done = $("[data-tasful-listing-done]");
    if (form) form.hidden = false;
    if (confirm) confirm.hidden = true;
    if (done) done.hidden = true;
    setStep("ステップ 1 / 2 — 商品情報の入力");
    showError("");
  }

  function showConfirmStep() {
    const form = $("[data-tasful-listing-form]");
    const confirm = $("[data-tasful-listing-confirm]");
    const done = $("[data-tasful-listing-done]");
    if (form) form.hidden = true;
    if (confirm) confirm.hidden = false;
    if (done) done.hidden = true;
    setStep("ステップ 2 / 2 — 出品内容の確認");
    showError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showDoneStep(result) {
    const form = $("[data-tasful-listing-form]");
    const confirm = $("[data-tasful-listing-confirm]");
    const done = $("[data-tasful-listing-done]");
    if (form) form.hidden = true;
    if (confirm) confirm.hidden = true;
    if (done) done.hidden = false;
    setStep("公開完了");
    showError("");

    const sellerLink = $("[data-tasful-listing-done-seller]");
    if (sellerLink && result?.entry?.shopId) {
      sellerLink.href = Data.sellerPageHref(result.entry.shopId);
    }
    const msg = $("[data-tasful-listing-done-message]");
    if (msg && result?.entry?.title) {
      msg.textContent = `「${result.entry.title}」を公開しました。市場TOP・検索・出品者ページに反映されます。`;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function onConfirmSubmit(event) {
    event?.preventDefault?.();
    if (!Data) {
      showError("出品データの読み込みに失敗しました。");
      return;
    }
    try {
      const draft = readFormDraft();
      const errors = Data.validateListingInput(draft);
      if (errors.length) {
        showError(errors[0]);
        return;
      }
      state.draft = draft;
      renderConfirm(draft);
      showConfirmStep();
    } catch (err) {
      showError(String(err?.message || err || "確認画面の表示に失敗しました"));
    }
  }

  function onPublish() {
    if (!Data || !state.draft) return;
    try {
      const result = Data.publishSellerProduct(state.draft);
      if (!result.ok) {
        showError(result.errors?.[0] || "公開に失敗しました。");
        return;
      }
      state.published = result;
      showDoneStep(result);
    } catch (err) {
      showError(String(err?.message || err || "公開処理に失敗しました"));
    }
  }

  function bindEvents() {
    $("[data-tasful-listing-form]")?.addEventListener("submit", onConfirmSubmit);
    $("[data-tasful-listing-to-confirm]")?.addEventListener("click", onConfirmSubmit);
    $("[data-tasful-listing-image]")?.addEventListener("input", syncImagePreview);
    $("[data-tasful-listing-publish]")?.addEventListener("click", onPublish);
    $("[data-tasful-listing-back]")?.addEventListener("click", showFormStep);
  }

  window.__tasfulListingRunConfirmFromDom = function () {
    onConfirmSubmit({ preventDefault() {} });
  };

  window.__tasfulListingRunPublish = function () {
    onPublish();
  };

  function init() {
    if (document.body.dataset.page !== "shop_market_listing_new") return;
    if (!Data) {
      showError("出品機能の読み込みに失敗しました。");
      return;
    }

    state.shopId = readShopId();
    renderCategoryOptions();
    renderShipOptions();
    renderConditionRadios();
    renderSubImageFields();
    prefillSellerDefaults();
    bindEvents();
    window.TasfulMarketHeader?.syncHeaderOffset?.();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
