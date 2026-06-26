/**
 * TasuFull — 掲載フォーム（post.html）
 * 掲載タイプ切替・listing-options 連携
 */
(function () {
  "use strict";

  // TODO:
  // 将来的に
  // ・位置情報検索
  // ・距離検索
  // ・本人確認バッジ
  // ・地域フィルター
  // ・タグ検索
  // を追加予定

  const TYPE_LABELS = {
    skill: "スキル",
    product: "商品",
    job: "求人",
    worker: "ワーカー",
    "shop-store": "店舗・販売",
    "business-service": "業務サービス",
  };

  const GENERAL_TYPES = ["skill", "product", "job", "worker"];
  const BUSINESS_SCOPE_TYPES = ["shop-store", "business-service"];
  const ALL_LISTING_TYPES = [...GENERAL_TYPES, ...BUSINESS_SCOPE_TYPES];

  function isBusinessScopeListingType(type) {
    return BUSINESS_SCOPE_TYPES.includes(type);
  }

  const BUSINESS_PLAN_LABELS = {
    none: "希望しない",
    considering: "検討中（担当から連絡可）",
    apply: "申し込み希望",
  };

  function bizCatLabel(cat) {
    if (window.TasuBusinessCategories?.getCategoryLabel) {
      return window.TasuBusinessCategories.getCategoryLabel(cat) || cat;
    }
    return BUSINESS_CATEGORY_LABELS[cat] || cat;
  }

  function bizExtraKey(cat, listing) {
    return (
      window.TasuBusinessCategories?.getExtraSectionKey?.(cat, listing) ||
      window.TasuBusinessCategories?.getDetailProfile?.(cat) ||
      cat
    );
  }

  function getBusinessTypeForCategory(cat) {
    return (
      window.TasuBusinessCategories?.businessTypeForCategory?.(cat) ||
      (normalizeBizCat(cat) === "shop_store"
        ? "shop_store"
        : normalizeBizCat(cat) === "field_service"
          ? "field_service"
          : "")
    );
  }

  function isTransportBiz(cat) {
    return window.TasuBusinessCategories?.isTransportProfile?.(cat) ?? cat === "taxi";
  }

  function isConstructionBiz(cat) {
    return window.TasuBusinessCategories?.isConstructionProfile?.(cat) ?? cat === "construction";
  }

  function isRepairBiz(cat) {
    return (
      window.TasuBusinessCategories?.isRepairProfile?.(cat) ||
      normalizeBizCat(cat) === "repair_maintenance"
    );
  }

  function isCleaningBiz(cat) {
    return normalizeBizCat(cat) === "cleaning";
  }

  function isShopStoreBiz(cat) {
    return (
      window.TasuBusinessCategories?.isShopStoreType?.(cat) ||
      normalizeBizCat(cat) === "shop_store"
    );
  }

  function getSelectedBusinessCategory(form) {
    return form.querySelector("[data-business-category-pick]:checked")?.value?.trim() ?? "";
  }

  /** 店舗・販売フォーム（カテゴリ or business_type） */
  function isShopStoreFormContext(form, category) {
    const cat = category ?? getSelectedBusinessCategory(form);
    const bt =
      form?.querySelector("[data-business-type-value]")?.value?.trim() ||
      document.body.dataset.businessType ||
      "";
    return bt === "shop_store" || isShopStoreBiz(cat);
  }

  function shouldShowShopProductsBlock(form, category) {
    return isShopStoreFormContext(form, category);
  }

  function isFieldServiceFormContext(form, category) {
    const cat = category ?? getSelectedBusinessCategory(form);
    const bt =
      form?.querySelector("[data-business-type-value]")?.value?.trim() ||
      document.body.dataset.businessType ||
      "";
    if (bt === "field_service") return true;
    if (bt === "shop_store") return false;
    return Boolean(window.TasuBusinessCategories?.isFieldServiceUiCategory?.(cat));
  }

  function shouldShowServiceMenuBlock(form, category) {
    const cat = category ?? getSelectedBusinessCategory(form);
    if (isShopStoreFormContext(form, cat)) return false;
    return isFieldServiceFormContext(form, cat) || usesServiceMenuProfile(cat);
  }

  function isFieldServiceBiz(cat) {
    return (
      window.TasuBusinessCategories?.isFieldServiceType?.(cat) ||
      normalizeBizCat(cat) === "field_service"
    );
  }

  function isStoreFieldBiz(cat) {
    const n = normalizeBizCat(cat);
    return (
      isShopStoreBiz(cat) ||
      isFieldServiceBiz(cat) ||
      n === "store_field_service"
    );
  }

  function usesWorkCasesProfile(cat) {
    return isConstructionBiz(cat) || isFieldServiceFormContext(null, cat);
  }

  const WORK_CASES_MAX = 3;
  const SERVICE_MENU_MAX = 6;

  /** 出張・修理系（店舗・販売は掲載商品） */
  function usesServiceMenuProfile(cat) {
    return (
      isFieldServiceFormContext(null, cat) ||
      isRepairBiz(cat) ||
      isFieldServiceBiz(cat)
    );
  }

  const SERVICE_MENU_SECTION_TITLE = "対応メニュー";
  const SERVICE_MENU_SECTION_DESC =
    "対応可能なサービス内容と料金目安を登録します（最大6件）。詳細ページの「対応メニュー」に表示されます。";

  function serviceMenuSectionTitle() {
    return SERVICE_MENU_SECTION_TITLE;
  }

  function serviceMenuSectionDesc() {
    return SERVICE_MENU_SECTION_DESC;
  }

  function normalizeBizCat(cat) {
    return window.TasuBusinessCategories?.normalizeCategory?.(cat) || String(cat || "").trim();
  }

  const BUSINESS_CATEGORY_LABELS = {
    transport: "送迎・運搬",
    construction: "建設・工事",
    repair_maintenance: "修理・メンテナンス",
    cleaning: "清掃・片付け",
    shop_store: "店舗・販売",
    onsite_service: "出張サービス",
    life_support: "暮らしサポート",
    it_web: "IT・Web制作",
    sales_agency: "営業・代行",
    corporate_support: "法人サポート",
    other_business: "その他業務",
    /* legacy */
    construction_work: "建設・工事",
    local_support: "暮らしサポート",
    field_service: "その他業務",
    store_field_service: "店舗・出張サービス（旧）",
  };

  const BUSINESS_STATUS_LABELS = {
    available: "対応可能",
    busy: "忙しい",
    closed: "休み",
  };

  const POST_SCOPE = {
    general: "general",
    business: "business",
  };

  /** 法人・業者フォーム — ホワイトリストキー（表示してよい項目のみ） */
  const BUSINESS_FORM_WHITELIST = {
    shared: ["categoryHub", "businessType", "publish", "legal"],
    shop: [
      "businessCategory",
      "shopFlow",
      "businessName",
      "businessDescription",
      "images",
      "serviceArea",
      "businessHours",
      "contactMethod",
      "shopProducts",
      "license",
      "faqs",
      "privateMeta",
      "privateBank",
      "notes",
      "tags",
      "payment",
    ],
    fieldService: [
      "businessCategory",
      "businessSubCategory",
      "fieldServiceFlow",
      "businessName",
      "businessDescription",
      "serviceMenu",
      "serviceArea",
      "businessHours",
      "contactMethod",
      "images",
      "notes",
      "tags",
      "license",
      "payment",
    ],
    legacy: [
      "businessCategory",
      "businessSubCategory",
      "standardCommon",
      "standardPanel",
      "categoryExtra",
      "businessName",
      "businessDescription",
      "serviceMenu",
      "serviceArea",
      "businessHours",
      "contactMethod",
      "images",
      "notes",
      "tags",
      "license",
      "workCases",
    ],
  };

  const BUSINESS_FORM_CANDIDATE_SELECTOR = [
    ".post-field",
    "section.post-section",
    ".post-form-panel",
    ".post-shop-store-flow",
    ".post-field-service-flow",
    ".post-shop-store-card",
    ".post-field-service-card",
    ".post-business-extras-wrap",
    ".category-extra-section",
    "[data-business-job-conditions]",
    "[data-business-standard-panel]",
    "[data-listing-images-block]",
    "[data-service-menu-section]",
    "[data-work-cases-section]",
    "[data-shop-products-section]",
  ].join(",");

  function getBusinessFormMode(form) {
    const modePick = form?.querySelector("[data-business-mode-pick]:checked")?.value?.trim();
    if (modePick === "shop_store") return "shop";
    if (modePick === "field_service") return "field_service";
    const bt =
      form?.querySelector("[data-business-type-value]")?.value?.trim() ||
      document.body.dataset.businessType ||
      "";
    if (bt === "shop_store") return "shop";
    if (bt === "field_service") return "field_service";
    return "unset";
  }

  function getBusinessFormCategory(form) {
    if (!form) return "";
    if (getBusinessFormMode(form) === "shop") {
      const shopCat = form.querySelector("[data-shop-store-category-pick]:checked")?.value?.trim();
      if (shopCat) return "shop_store";
    }
    return (
      form.querySelector("[data-business-category-pick]:checked")?.value?.trim() ||
      form.querySelector("[data-business-category-hidden]")?.value?.trim() ||
      ""
    );
  }

  function getCurrentPostType(form) {
    if (!form) return "skill";
    const activeCard = form.querySelector(
      "[data-post-type].is-active, [data-post-type][aria-pressed='true']"
    );
    if (activeCard?.dataset?.postType) return activeCard.dataset.postType;
    const fromSelect = form.querySelector("[data-listing-type]")?.value?.trim();
    if (fromSelect) return fromSelect;
    const fromHidden = form.querySelector("[data-listing-type-value]")?.value?.trim();
    return fromHidden || "skill";
  }

  function getCurrentBusinessMode(form) {
    const modePick = form?.querySelector("[data-business-mode-pick]:checked")?.value?.trim();
    if (modePick) return modePick;
    return (
      form?.querySelector("[data-business-type-value]")?.value?.trim() ||
      document.body.dataset.businessType ||
      ""
    );
  }

  function setCategoryGroupVisible(group, visible) {
    if (!group) return;
    group.hidden = !visible;
    group.setAttribute("aria-hidden", visible ? "false" : "true");
    group.style.display = visible ? "" : "none";
    if (visible) {
      group.setAttribute("data-business-whitelist-hidden", "false");
      group.classList.remove("is-hidden");
    }
  }

  function hideShopStoreCategoryGroup(form) {
    setCategoryGroupVisible(form?.querySelector("[data-shop-store-category-pick-group]"), false);
  }

  function showShopStoreCategoryGroup(form) {
    setCategoryGroupVisible(form?.querySelector("[data-shop-store-category-pick-group]"), true);
  }

  function hideBusinessServiceCategoryGroup(form) {
    setCategoryGroupVisible(form?.querySelector("[data-business-category-pick-group]"), false);
  }

  function showBusinessServiceCategoryGroup(form) {
    setCategoryGroupVisible(form?.querySelector("[data-business-category-pick-group]"), true);
  }

  function isInsideBusinessFlow(el) {
    return Boolean(el?.closest?.("[data-shop-store-flow], [data-field-service-flow]"));
  }

  function isPaymentBlock(el) {
    if (!el) return false;
    return (
      el.matches?.("[data-business-payment-section], [data-general-payment-section]") ||
      Boolean(el.closest?.("[data-business-payment-section], [data-general-payment-section]"))
    );
  }

  function isTermsAgreementBlock(el) {
    if (!el) return false;
    return (
      el.matches?.(
        "[data-terms-block], [data-terms-agreement-section], .post-section--legal, [data-terms-agree]"
      ) ||
      Boolean(
        el.closest?.("[data-terms-block], [data-terms-agreement-section], .post-section--legal")
      )
    );
  }

  function setBlockVisible(el, visible) {
    if (!el || !(el instanceof HTMLElement)) return;
    el.hidden = !visible;
    el.setAttribute("aria-hidden", visible ? "false" : "true");
    el.setAttribute("data-business-whitelist-hidden", "false");
    el.classList.remove("is-hidden");
    if (el.style) el.style.display = visible ? "" : "none";
    el.querySelectorAll("input, textarea, select, button").forEach((control) => {
      if (
        control.matches(
          "[data-business-category-pick], [data-business-mode-pick], [data-shop-store-category-pick], [data-general-category]"
        )
      ) {
        return;
      }
      control.disabled = !visible;
    });
  }

  function setEmptyCardHidden(el, hidden) {
    if (!el || !(el instanceof HTMLElement)) return;
    el.hidden = hidden;
    el.classList.toggle("is-hidden", hidden);
    el.setAttribute("aria-hidden", hidden ? "true" : "false");
    if (el.style) el.style.display = hidden ? "none" : "";
    if (hidden) el.dataset.emptyCardHidden = "true";
    else delete el.dataset.emptyCardHidden;
  }

  function isIgnorableMountChild(el) {
    if (!(el instanceof HTMLElement)) return true;
    if (el.classList.contains("post-shop-store-spacer")) return true;
    if (el.hidden || el.classList.contains("is-hidden")) return true;
    if (String(el.getAttribute("aria-hidden") || "").trim() === "true") return true;
    const style = window.getComputedStyle(el);
    return style.display === "none" || style.visibility === "hidden";
  }

  function nodeHasMeaningfulContent(root) {
    if (!root || !(root instanceof HTMLElement)) return false;
    const selector =
      "input:not([type='hidden']), textarea, select, button, img, .post-images-block, [data-shop-product-row], [data-service-menu-row], [data-work-case-row], .post-main-upload, .post-gallery-upload, .post-fs-menu-card, .post-work-case";
    const nodes = root.querySelectorAll(selector);
    for (const el of nodes) {
      if (!(el instanceof HTMLElement)) continue;
      if (el.closest(".is-hidden, [hidden]")) continue;
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;
      if (el.getClientRects().length === 0 && !el.matches("input, textarea, select")) continue;
      return true;
    }
    return false;
  }

  function shopMountIsEmpty(mount) {
    if (!mount || !(mount instanceof HTMLElement)) return true;
    const visibleChildren = Array.from(mount.children).filter((child) => !isIgnorableMountChild(child));
    if (visibleChildren.length === 0) return true;
    return !nodeHasMeaningfulContent(mount);
  }

  function shouldKeepFieldServiceElement(el) {
    if (!(el instanceof HTMLElement)) return true;
    if (
      el.matches(
        "[data-field-service-flow], [data-fs-mount], [data-business-form-key], [data-field-service-section], [data-service-menu-section], [data-work-cases-section], .post-field-service-card, .post-field-service-card__head, .post-field-service-card__body"
      )
    ) {
      return true;
    }
    if (el.closest("[data-fs-mount], .post-field-service-card, [data-service-menu-section], [data-work-cases-section]")) {
      return true;
    }
    if (el.querySelector("input, textarea, select, button, label")) return true;
    if (el.id) return true;
    if (el.getAttribute("aria-labelledby")) return true;
    if (String(el.textContent || "").trim()) return true;
    return false;
  }

  function unlockFieldServiceFlowVisibility(form) {
    const flow = form.querySelector("[data-field-service-flow]");
    if (!flow) return;

    unlockBusinessFlowElement(flow);
    flow.querySelectorAll("*").forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      if (el === flow) return;
      unlockBusinessFlowElement(el);
      delete el.dataset.emptyCardHidden;
      delete el.dataset.fsGarbageHidden;
    });
  }

  function restoreFieldServiceFlow(form) {
    if (!form) return;
    const fsFlow = form.querySelector("[data-field-service-flow]");
    if (!fsFlow) return;

    const shopFlow = form.querySelector("[data-shop-store-flow]");
    if (shopFlow) {
      setEmptyCardHidden(shopFlow, true);
      shopFlow.querySelectorAll(".post-shop-store-card").forEach((card) => {
        setEmptyCardHidden(card, true);
        card
          .querySelectorAll(".post-shop-store-card__head, .post-shop-store-card__body, [data-shop-mount]")
          .forEach((el) => setEmptyCardHidden(el, true));
      });
    }

    unlockFieldServiceFlowVisibility(form);
    document.body.classList.add("post--field-service-flow");
    document.body.classList.remove("post--shop-store-flow");

    window.TasuPostFieldServiceForm?.ensureFieldServiceFormSections?.(form);
    window.TasuPostFieldServiceForm?.ensureFieldServiceCtaControls?.(form);

    if (window.TasuPostFieldServiceLayout?.isActive?.()) {
      window.TasuPostFieldServiceLayout?.remountFieldServiceFields?.(form);
    } else {
      window.TasuPostFieldServiceLayout?.setActive?.(form, true);
    }

    unlockBusinessFlowSubtree(fsFlow);
    window.TasuPostFieldServiceForm?.seedFieldServiceDefaults?.(form);
    refreshPaymentAndTermsVisibility(form);
    pruneEmptyFieldServiceCards(form);
  }

  function hideInactiveBusinessFlows(form, shopActive, fieldActive) {
    const shopFlow = form.querySelector("[data-shop-store-flow]");
    const fsFlow = form.querySelector("[data-field-service-flow]");

    if (shopFlow) {
      const hideShop = fieldActive || !shopActive;
      setEmptyCardHidden(shopFlow, hideShop);
      shopFlow.querySelectorAll(".post-shop-store-card").forEach((card) => {
        setEmptyCardHidden(card, hideShop);
        card.querySelectorAll(".post-shop-store-card__head, .post-shop-store-card__body, [data-shop-mount]").forEach(
          (el) => setEmptyCardHidden(el, hideShop)
        );
      });
    }

    if (fsFlow) {
      const hideFs = shopActive || !fieldActive;
      setEmptyCardHidden(fsFlow, hideFs);
      if (hideFs) {
        fsFlow.querySelectorAll(".post-field-service-card, [data-fs-mount]").forEach((el) =>
          setEmptyCardHidden(el, true)
        );
      }
    }
  }

  function hideEmptyShopStoreCards(form) {
    form.querySelectorAll("[data-shop-store-flow] .post-shop-store-card").forEach((card) => {
      const mount = card.querySelector("[data-shop-mount]");
      const empty = shopMountIsEmpty(mount);
      if (mount) setEmptyCardHidden(mount, empty);
      setEmptyCardHidden(card.querySelector(".post-shop-store-card__body"), empty);
      setEmptyCardHidden(card.querySelector(".post-shop-store-card__head"), empty);
      setEmptyCardHidden(card, empty);
    });
  }

  function pruneEmptyFieldServiceCards(form) {
    const fsFlow = form?.querySelector("[data-field-service-flow]");
    if (!fsFlow || fsFlow.hidden) return;

    fsFlow.querySelectorAll(".post-field, .post-card").forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      if (shouldKeepFieldServiceElement(el)) {
        if (el.dataset.fsGarbageHidden === "true") {
          unlockBusinessFlowElement(el);
          delete el.dataset.fsGarbageHidden;
        }
        return;
      }
      if (el.childElementCount === 0 && !String(el.textContent || "").trim()) {
        el.dataset.fsGarbageHidden = "true";
        setEmptyCardHidden(el, true);
      }
    });
  }

  function hideEmptyBusinessCards(form) {
    if (!form) return;
    const scope = form.querySelector("[data-post-scope]")?.value ?? POST_SCOPE.general;
    if (scope !== POST_SCOPE.business) return;

    const postType = getCurrentPostType(form);
    const businessMode = getCurrentBusinessMode(form);
    const shopActive = postType === "shop-store" || businessMode === "shop_store";
    const fieldActive = postType === "business-service" || businessMode === "field_service";

    hideInactiveBusinessFlows(form, shopActive, fieldActive);

    if (shopActive && !fieldActive) {
      hideEmptyShopStoreCards(form);
    }
  }

  function refreshPaymentAndTermsVisibility(form) {
    if (!form) return;
    const scope = form.querySelector("[data-post-scope]")?.value ?? POST_SCOPE.general;
    const postType = getCurrentPostType(form);
    const businessMode = getCurrentBusinessMode(form);
    const category = getBusinessFormCategory(form);
    const isBusiness = scope === POST_SCOPE.business;
    const showBusinessPayment =
      isBusiness &&
      !isTransportBiz(category) &&
      (postType === "shop-store" ||
        postType === "business-service" ||
        businessMode === "shop_store" ||
        businessMode === "field_service");

    const bizPayment = form.querySelector("[data-business-payment-section]");
    setBlockVisible(bizPayment, showBusinessPayment);

    const generalPayment = form.querySelector("[data-general-payment-section]");
    if (generalPayment) {
      setBlockVisible(generalPayment, !isBusiness);
    }

    const legal = form.querySelector(".post-section--legal");
    const termsBlock = form.querySelector("[data-terms-block]");
    [legal, termsBlock].forEach((el) => {
      if (!el) return;
      unlockBusinessFlowElement(el);
      setBlockVisible(el, true);
    });

    const termsCheckbox = form.querySelector("[data-terms-agree]");
    if (termsCheckbox) {
      termsCheckbox.disabled = false;
      termsCheckbox.required = true;
    }

    const bizTermsNote = form.querySelector("[data-business-terms-note]");
    if (bizTermsNote) {
      bizTermsNote.hidden = !isBusiness;
      bizTermsNote.setAttribute("aria-hidden", isBusiness ? "false" : "true");
    }
  }

  function unlockBusinessFlowElement(el) {
    if (!el || !(el instanceof HTMLElement)) return;
    el.setAttribute("data-business-whitelist-hidden", "false");
    el.classList.remove("is-hidden", "business-ghost-line");
    el.hidden = false;
    el.removeAttribute("hidden");
    el.setAttribute("aria-hidden", "false");
    if (el.dataset.prunedEmptyField === "true") delete el.dataset.prunedEmptyField;
    if (el.style) el.style.display = "";
    el.querySelectorAll("input, textarea, select, button").forEach((control) => {
      if (
        control.matches(
          "[data-business-category-pick], [data-business-mode-pick], [data-shop-store-category-pick], [data-general-category]"
        )
      ) {
        return;
      }
      control.disabled = false;
    });
  }

  function unlockBusinessFlowSubtree(root) {
    if (!root) return;
    unlockBusinessFlowElement(root);
    root.querySelectorAll(
      ".post-shop-store-card, .post-field-service-card, .post-field, .post-section, [data-fs-form-built], [data-shop-products-section], [data-listing-images-block]"
    ).forEach(unlockBusinessFlowElement);
  }

  function hideBusinessFlowContainers(form) {
    form?.querySelectorAll("[data-shop-store-flow], [data-field-service-flow]").forEach((flow) => {
      flow.hidden = true;
      flow.setAttribute("aria-hidden", "true");
    });
    document.body.classList.remove("post--shop-store-flow", "post--field-service-flow");
  }

  function refreshBusinessFormLayout(form) {
    if (!form) return;
    const scope = form.querySelector("[data-post-scope]")?.value ?? POST_SCOPE.general;
    const postType = getCurrentPostType(form);
    const businessMode = getCurrentBusinessMode(form);
    const shopFlow = form.querySelector("[data-shop-store-flow]");
    const fsFlow = form.querySelector("[data-field-service-flow]");

    if (scope !== POST_SCOPE.business) {
      window.TasuPostShopStoreLayout?.setActive?.(form, false);
      window.TasuPostFieldServiceLayout?.setActive?.(form, false);
      hideShopStoreCategoryGroup(form);
      hideBusinessServiceCategoryGroup(form);
      hideBusinessFlowContainers(form);
      refreshPaymentAndTermsVisibility(form);
      hideEmptyBusinessCards(form);
      return;
    }

    const shopActive = postType === "shop-store" || businessMode === "shop_store";
    const fieldActive = postType === "business-service" || businessMode === "field_service";

    if (shopActive) {
      hideBusinessServiceCategoryGroup(form);
      showShopStoreCategoryGroup(form);
      window.TasuPostFieldServiceLayout?.setActive?.(form, false);
      window.TasuPostShopStoreLayout?.setActive?.(form, true);
      unlockBusinessFlowSubtree(shopFlow);
      window.TasuPostShopProducts?.setBlockVisible?.(form, true);
      window.TasuPostShopProducts?.initShopProductsForm?.(form);
      window.TasuPostShopStoreLayout?.ensureShopProductsVisible?.(form, true);
      refreshPaymentAndTermsVisibility(form);
      hideEmptyBusinessCards(form);
      return;
    }

    if (fieldActive) {
      hideShopStoreCategoryGroup(form);
      showBusinessServiceCategoryGroup(form);
      window.TasuPostShopStoreLayout?.setActive?.(form, false);
      hideEmptyBusinessCards(form);
      restoreFieldServiceFlow(form);
      return;
    }

    window.TasuPostShopStoreLayout?.setActive?.(form, false);
    window.TasuPostFieldServiceLayout?.setActive?.(form, false);
    hideShopStoreCategoryGroup(form);
    hideBusinessServiceCategoryGroup(form);
    hideBusinessFlowContainers(form);
    refreshPaymentAndTermsVisibility(form);
    hideEmptyBusinessCards(form);
  }

  function buildAllowedBusinessFormKeys(form) {
    const mode = getBusinessFormMode(form);
    const category = getBusinessFormCategory(form);
    const allowed = new Set(BUSINESS_FORM_WHITELIST.shared);

    if (mode === "unset") {
      return allowed;
    }

    if (mode === "shop") {
      BUSINESS_FORM_WHITELIST.shop.forEach((k) => allowed.add(k));
      return allowed;
    }

    if (mode === "field_service") {
      BUSINESS_FORM_WHITELIST.fieldService.forEach((k) => allowed.add(k));
      if (usesWorkCasesProfile(category)) allowed.add("workCases");
      return allowed;
    }

    BUSINESS_FORM_WHITELIST.legacy.forEach((k) => allowed.add(k));
    if (usesWorkCasesProfile(category)) allowed.add("workCases");
    if (shouldShowServiceMenuBlock(form, category)) allowed.add("serviceMenu");
    return allowed;
  }

  function businessFormKeysForElement(el) {
    const raw = el?.dataset?.businessFormKey;
    if (!raw) return [];
    return raw.split(/\s+/).filter(Boolean);
  }

  function elementMatchesBusinessWhitelist(el, allowed) {
    const keys = businessFormKeysForElement(el);
    if (keys.length) return keys.some((k) => allowed.has(k));
    const carrier = el?.closest?.("[data-business-form-key]");
    if (carrier && businessFormKeysForElement(carrier).some((k) => allowed.has(k))) {
      return true;
    }
    const nested = el?.querySelector?.("[data-business-form-key]");
    if (!nested) return false;
    return businessFormKeysForElement(nested).some((k) => allowed.has(k));
  }

  function setBusinessWhitelistVisible(el, show) {
    if (!el || !(el instanceof HTMLElement)) return;
    // DOMは保持したまま、class でのみ表示制御する（remove/innerHTML禁止方針）
    el.setAttribute("data-business-whitelist-hidden", show ? "false" : "true");
    el.classList.toggle("is-hidden", !show);
    el.setAttribute("aria-hidden", show ? "false" : "true");

    const disableControls = !show;
    el.querySelectorAll("input, textarea, select, button").forEach((control) => {
      if (
        control.matches(
          "[data-business-category-pick], [data-business-mode-pick], [data-shop-store-category-pick], [data-general-category]"
        )
      ) {
        return;
      }
      if (control.closest('[data-post-scope-block="general"]')) return;
      control.disabled = disableControls;
    });
  }

  function clearBusinessFormWhitelist(form) {
    if (!form) return;
    form.querySelectorAll('[data-business-whitelist-hidden="true"]').forEach((el) => {
      el.setAttribute("data-business-whitelist-hidden", "false");
      el.classList.remove("is-hidden");
      el.setAttribute("aria-hidden", "false");
      el.querySelectorAll("input, textarea, select, button").forEach((control) => {
        if (
          control.matches(
            "[data-business-category-pick], [data-business-mode-pick], [data-shop-store-category-pick]"
          )
        ) {
          return;
        }
        control.disabled = false;
      });
    });
  }

  function applyBusinessFormWhitelist(form) {
    if (!form) return;
    const scope = form.querySelector("[data-post-scope]")?.value ?? POST_SCOPE.general;
    const isBusiness = scope === POST_SCOPE.business;
    document.body.dataset.postScope = scope;

    if (!isBusiness) {
      clearBusinessFormWhitelist(form);
      refreshPaymentAndTermsVisibility(form);
      return;
    }

    const allowed = buildAllowedBusinessFormKeys(form);
    const mode = getBusinessFormMode(form);
    document.body.dataset.businessFormMode = mode;

    form.querySelectorAll('[data-form-type]:not([data-form-type="business"])').forEach((panel) => {
      setBusinessWhitelistVisible(panel, false);
    });

    form.querySelectorAll("[data-business-form-key]").forEach((el) => {
      if (
        el.matches(
          "[data-shop-store-flow], [data-field-service-flow], [data-shop-store-category-pick-group], [data-business-category-pick-group]"
        ) ||
        isInsideBusinessFlow(el) ||
        isPaymentBlock(el) ||
        isTermsAgreementBlock(el)
      ) {
        return;
      }
      let show = businessFormKeysForElement(el).some((k) => allowed.has(k));
      if (el.matches("[data-business-category-pick-group]") && mode !== "field_service") {
        show = false;
      }
      if (el.matches("[data-shop-store-category-pick-group]") && mode !== "shop") {
        show = false;
      }
      setBusinessWhitelistVisible(el, show);
    });

    if (mode !== "shop" && mode !== "field_service") {
      form.querySelectorAll(BUSINESS_FORM_CANDIDATE_SELECTOR).forEach((el) => {
        if (el.closest('[data-general-only]')) return;
        if (el.closest('[data-post-scope-block="general"]')) return;
        if (el.hasAttribute("data-business-form-key")) return;
        if (isInsideBusinessFlow(el)) return;
        if (isPaymentBlock(el) || isTermsAgreementBlock(el)) return;
        if (
          el.matches(
            "[data-shop-store-flow], [data-field-service-flow], [data-shop-store-category-pick-group], [data-business-category-pick-group]"
          )
        ) {
          return;
        }
        if (elementMatchesBusinessWhitelist(el, allowed)) return;
        setBusinessWhitelistVisible(el, false);
      });
    }

    const extrasWrap = form.querySelector("[data-business-category-extras-wrap]");
    if (extrasWrap && !allowed.has("categoryExtra")) {
      setBusinessWhitelistVisible(extrasWrap, false);
    }

    const jobSection = form.querySelector("[data-business-job-conditions]");
    if (jobSection) {
      setBusinessWhitelistVisible(jobSection, false);
    }

    const businessPanel = form.querySelector('[data-form-type="business"]');
    if (businessPanel) {
      const showPanel =
        allowed.has("standardPanel") &&
        mode !== "shop" &&
        mode !== "field_service";
      setBusinessWhitelistVisible(businessPanel, showPanel);
    }

    const commonSection = form.querySelector("[data-business-standard-panel][data-post-order='10']");
    if (commonSection) {
      const showCommon =
        allowed.has("standardCommon") && mode !== "shop" && mode !== "field_service";
      setBusinessWhitelistVisible(commonSection, showCommon);
    }

    pruneEmptyBusinessFields(form);
    pruneEmptyFieldServiceCards(form);
    refreshBusinessFormLayout(form);
  }

  function pruneEmptyBusinessFields(form) {
    if (!form) return;
    const scope = form.querySelector("[data-post-scope]")?.value ?? POST_SCOPE.general;
    if (scope !== POST_SCOPE.business) return;

    const businessRoot =
      form.querySelector('[data-post-scope-block="business"]') ||
      form.querySelector('[data-form-type="business"]') ||
      form;

    const candidates = businessRoot.querySelectorAll(".post-field");
    candidates.forEach((field) => {
      if (!(field instanceof HTMLElement)) return;
      if (field.getAttribute("data-business-whitelist-hidden") === "true") return;
      if (field.closest('[data-general-only]')) return;

      const controls = Array.from(field.querySelectorAll("input, select, textarea")).filter(
        (el) => el instanceof HTMLElement
      );

      const hasAnyNonHiddenControl = controls.some(
        (el) => !(el instanceof HTMLInputElement && el.type === "hidden")
      );
      const hasOnlyHiddenControls = controls.length > 0 && !hasAnyNonHiddenControl;

      const label = field.querySelector("label");
      const hasLabelText = Boolean(String(label?.textContent || "").trim());
      const hasRequiredBadge = Boolean(field.querySelector(".post-field__required"));
      const hasBusinessKey = field.hasAttribute("data-business-form-key");
      const hasDataBusinessField = Boolean(field.querySelector("[data-business-field]"));

      const firstControl = field.querySelector("input, textarea, select");
      const placeholder =
        firstControl instanceof HTMLInputElement || firstControl instanceof HTMLTextAreaElement
          ? String(firstControl.getAttribute("placeholder") || "").trim()
          : "";
      const ariaLabel = firstControl ? String(firstControl.getAttribute("aria-label") || "").trim() : "";

      const isEmptyChildren =
        field.childElementCount === 0 ||
        Array.from(field.children).every((c) => {
          if (!(c instanceof HTMLElement)) return true;
          const style = window.getComputedStyle(c);
          return style.display === "none" || style.visibility === "hidden";
        });

      const isZeroHeight = field.getClientRects().length === 0 || field.offsetHeight <= 1;

      // “白い横線だけ”の原因になりやすいケースだけを潰す（推測で全体は消さない）
      const shouldHide =
        (!hasAnyNonHiddenControl && !hasLabelText) ||
        (hasOnlyHiddenControls && !hasLabelText) ||
        (isEmptyChildren && !hasLabelText) ||
        (isZeroHeight && !hasLabelText && !hasRequiredBadge && !hasBusinessKey && !hasDataBusinessField) ||
        (!hasLabelText && !placeholder && !ariaLabel && !hasAnyNonHiddenControl);

      if (shouldHide) {
        field.dataset.prunedEmptyField = "true";
        field.classList.add("business-ghost-line", "is-hidden");
        field.setAttribute("aria-hidden", "true");
        field.querySelectorAll("input, textarea, select").forEach((control) => {
          control.disabled = true;
        });
      } else if (field.dataset.prunedEmptyField === "true") {
        delete field.dataset.prunedEmptyField;
        field.classList.remove("business-ghost-line", "is-hidden");
        field.setAttribute("aria-hidden", "false");
        // disabled の復帰は setBusinessWhitelistVisible / 各モード切替が担う（ここでは触り過ぎない）
      }
    });
  }

  const OPTIONS_HEADINGS = {
    product: "追加オプション",
    skill: "追加サービス",
    worker: "追加サービス",
    job: "追加オプション",
  };

  const OPTIONS_DESC = {
    product: "延長保証・ラッピングなど購入時に選べるオプションを追加できます。",
    skill: "お急ぎ対応・表情差分など、依頼時に選べる追加サービスを設定できます。",
    worker: "深夜対応・即日対応など、依頼時に選べる追加サービスを設定できます。",
    job: "",
  };

  const ALLOWED_TYPES = GENERAL_TYPES;

  const TAG_LABELS = {
    product: "タグ",
    skill: "対応タグ",
    job: "募集タグ",
    worker: "募集タグ",
  };

  const TAG_PLACEHOLDERS = {
    product: "例：家電, 送料無料, リモート（カンマ区切り）",
    skill: "例：Premiere Pro, TikTok, 広告動画, VTuber",
    job: "例：副業OK, フルリモート, 急募, TikTok運用",
    worker: "例：買い物代行, 即日対応, 深夜OK, 車あり",
  };

  const TAG_HINTS = {
    product: "最大12個まで。一覧・検索で使われます。",
    skill: "スキル・ツール名など。最大12個まで。一覧・検索で使われます。",
    job: "募集条件のタグ。最大12個まで。一覧・検索で使われます。",
    worker: "サービス特徴のタグ。最大12個まで。一覧・検索で使われます。",
  };

  const BUSINESS_TAG_UI = {
    label: "対応タグ",
    placeholder: "例：内装工事, 夜間対応, 法人契約（カンマ区切り）",
    hint: "業務の特徴・対応範囲をタグで記載。最大12個まで。一覧・検索で使われます。",
  };

  const BUSINESS_CATEGORY_EXTRA_TITLES = {
    taxi: "タクシー・送迎サービス",
    repair: "修理向け追加情報",
    construction: "建設向け追加情報",
    cleaning: "清掃向け追加情報",
    local_service: "地域サービス向け追加情報",
    shop_store: "店舗・販売向け情報",
    field_service: "業者サービス向け情報",
    store: "店舗・出張向け追加情報",
  };

  const BUSINESS_EXTRA_FIELD_LABELS = {
    work_types: "対応工事種別",
    construction_license: "建設業許可の有無",
    insurance: "保険加入",
    night_support: "夜間対応",
    emergency_support: "緊急対応",
    team_capacity: "対応可能人数 / 体制",
    partner_registration: "建設パートナー登録",
    cleaning_types: "対応清掃種別",
    regular_contract: "定期契約対応",
    spot_support: "スポット対応",
    corporate_contract: "法人契約対応",
    repair_types: "対応修理種別",
    visit_support: "出張対応",
    same_day_support: "即日対応",
    estimate_support: "見積もり対応",
    warranty_support: "保証対応",
    taxi_services: "対応内容",
    vehicle_types: "対応車種",
    taxi_area_type: "対応エリア",
    airport_transfer: "空港送迎",
    support_24h: "24時間対応",
    reservation_support: "予約対応",
    corporate_contract: "法人契約",
    invoice_support_extra: "インボイス対応",
    taxi_base_fare: "料金目安",
    taxi_night_fare: "深夜料金",
    taxi_route_price: "ルート別料金",
    taxi_capacity: "乗車人数",
    taxi_language_support: "対応言語",
    child_seat: "チャイルドシート",
    booking_types: "予約タイプ",
    service_types: "対応サービス種別",
    regular_support: "定期対応",
    senior_support: "高齢者対応",
    holiday_support: "土日祝対応",
    store_type: "店舗種別",
    store_service_types: "対応サービス種別",
    visit_support: "出張対応",
    reservation: "来店予約",
    coupon: "クーポン掲載",
    corporate_use: "法人/団体利用",
    parking: "駐車場",
    shop_description: "店舗説明",
    shop_store_free_assessment: "査定無料対応",
    sales_support: "販売対応",
    buyback_support: "買取対応",
    used_sales: "中古販売",
    new_sales: "新品販売",
    visit_buyback: "出張買取",
    fast_shipping: "即日発送",
    credit_support: "クレジット対応",
    show_phone: "電話相談表示",
    show_estimate: "見積表示",
  };

  const PRODUCT_SUBCATEGORIES = {
    家電: ["大型家電", "生活家電", "カメラ・映像"],
    スマホ: ["iPhone", "Android", "アクセサリ"],
    PC: ["ノートPC", "デスクトップ", "周辺機器"],
    ゲーム: ["Switch", "PS5", "レトロゲーム"],
    ファッション: ["メンズ", "レディース", "靴・バッグ"],
    家具: ["ソファ", "ベッド", "収納"],
    インテリア: ["照明", "雑貨", "カーテン"],
    工具: ["電動工具", "手工具", "DIY"],
    "車・バイク": ["車用品", "バイク用品", "パーツ"],
    スポーツ: ["ウェア", "器具", "ゴルフ"],
    アウトドア: ["キャンプ", "釣り", "登山"],
    ホビー: ["フィギュア", "模型", "トレカ"],
    本: ["漫画", "小説", "専門書"],
    音楽: ["CD", "レコード", "楽器"],
    ハンドメイド: ["アクセサリー", "雑貨", "ファッション"],
    美容: ["スキンケア", "メイク", "ヘアケア"],
    食品: ["加工食品", "飲料", "お菓子"],
    ペット: ["犬用品", "猫用品", "小動物"],
    ベビー: ["服", "おもちゃ", "育児用品"],
    その他: ["その他"],
  };

  function getInitialType() {
    const params = new URLSearchParams(window.location.search);
    const initialType = params.get("type");
    return ALL_LISTING_TYPES.includes(initialType) ? initialType : "skill";
  }

  function getUserId() {
    return (
      window.TASU_CHAT_SUPABASE_CONFIG?.currentUserId ||
      window.TasuChatUserIdentity?.getUserIdFromUrl?.() ||
      "u_me"
    );
  }

  function syncListingTypeValue(form, type) {
    const hidden = form.querySelector("[data-listing-type-value]");
    if (hidden) hidden.value = type;
  }

  function resolveActiveListingType(form) {
    if (!form) return "skill";
    const fromRadio = form.querySelector("[data-general-category]:checked")?.value?.trim();
    const fromSelect = form.querySelector("[data-listing-type]")?.value?.trim();
    const fromHidden = form.querySelector("[data-listing-type-value]")?.value?.trim();
    const type = fromRadio || fromSelect || fromHidden || "skill";
    return ALL_LISTING_TYPES.includes(type) ? type : "skill";
  }

  function collectBusinessJobConditions(form) {
    const category =
      form.querySelector("[data-business-category-pick]:checked")?.value ||
      form.querySelector("[data-business-category-hidden]")?.value ||
      "";
    if (isTransportBiz(category)) {
      return {
        budget_amount: "",
        payment_type: "",
        start_date: "",
        contract_period: "",
        recruit_count: "",
        recruit_status:
          window.TasuBusinessWording?.defaultRecruitStatus || "受付中",
        application_conditions: [],
        contact_method: "サイト内チャット",
      };
    }

    const read = (selector) => {
      const el = form.querySelector(selector);
      if (!el || el.disabled) return "";
      return String(el.value ?? "").trim();
    };

    if (isRepairBiz(category)) {
      return {
        budget_amount: read("[data-business-job-field='budget_amount']"),
        payment_type: "",
        start_date: read("[data-business-job-field='start_date']"),
        contract_period: "",
        recruit_count: read("[data-business-job-field='recruit_count']"),
        recruit_status:
          (window.TasuBusinessWording?.normalizeRecruitStatusForSave
            ? window.TasuBusinessWording.normalizeRecruitStatusForSave(
                read("[data-business-job-field='recruit_status']")
              )
            : read("[data-business-job-field='recruit_status']")) ||
          window.TasuBusinessWording?.defaultRecruitStatus ||
          "受付中",
        application_conditions: [],
        contact_method:
          read("[data-business-job-field='contact_method']") || "サイト内チャット",
      };
    }

    const conditions = Array.from(
      form.querySelectorAll('input[name="biz_application_conditions"]:checked')
    )
      .filter((el) => !el.disabled)
      .map((el) => String(el.value || "").trim())
      .filter(Boolean);

    return {
      budget_amount: read("[data-business-job-field='budget_amount']"),
      payment_type: read("[data-business-job-field='payment_type']"),
      start_date: read("[data-business-job-field='start_date']"),
      contract_period: read("[data-business-job-field='contract_period']"),
      recruit_count: read("[data-business-job-field='recruit_count']"),
      recruit_status:
        (window.TasuBusinessWording?.normalizeRecruitStatusForSave
          ? window.TasuBusinessWording.normalizeRecruitStatusForSave(
              read("[data-business-job-field='recruit_status']")
            )
          : read("[data-business-job-field='recruit_status']")) ||
        window.TasuBusinessWording?.defaultRecruitStatus ||
        "受付中",
      application_conditions: conditions,
      contact_method:
        read("[data-business-job-field='contact_method']") || "サイト内チャット",
    };
  }

  function formatApplicationConditionsForConfirm(conditions) {
    if (!Array.isArray(conditions) || !conditions.length) return "—";
    return conditions.join("、");
  }

  function syncFieldServiceCheckboxExtras(form) {
    const pairs = [
      ["[data-fs-same-day-chk]", "#bizExtraFieldSameDay", "yes"],
      ["[data-fs-night-chk]", "#bizExtraFieldNight", "yes"],
      ["[data-fs-holiday-chk]", "#bizExtraFieldHoliday", "yes"],
      ["[data-fs-corporate-chk]", "#bizExtraFieldCorporate", "yes"],
      ["[data-fs-female-chk]", "#bizExtraFieldFemale", "yes"],
      ["[data-fs-estimate-chk]", "#bizExtraFieldEstimate", "free"],
      ["[data-fs-show-ai-chk]", "#bizExtraFieldShowAi", "yes"],
      ["[data-fs-show-estimate-chk]", "#bizExtraFieldShowEstimate", "yes"],
      ["[data-fs-show-inquiry-chk]", "#bizExtraFieldShowInquiry", "yes"],
      ["[data-fs-show-phone-btn-chk]", "#bizExtraFieldShowPhoneBtn", "yes"],
      ["[data-fs-line-chk]", "#bizExtraFieldLine", "yes"],
    ];
    pairs.forEach(([chkSel, hiddenSel, onVal]) => {
      const chk = form.querySelector(chkSel);
      const hidden = form.querySelector(hiddenSel);
      if (!hidden) return;
      hidden.value = chk?.checked ? onVal : "";
    });
  }

  function collectBusinessCategoryExtra(form, category) {
    if (!category) return null;
    const extraKey = bizExtraKey(category);
    const useShopKeyedFields =
      extraKey === "shop_store" && window.TasuPostShopStoreLayout?.isActive?.();
    const useFsKeyedFields =
      extraKey === "field_service" && window.TasuPostFieldServiceLayout?.isActive?.();
    const fieldNodes = useShopKeyedFields
      ? form.querySelectorAll(
          `[data-category-extra-key="${extraKey}"][data-business-extra-field]`
        )
      : useFsKeyedFields
        ? form.querySelectorAll(
            `[data-category-extra-key="${extraKey}"][data-business-extra-field]`
          )
        : form.querySelectorAll(
          `.category-extra-section[data-category-extra="${extraKey}"] [data-business-extra-field]`
        );
    const mergeFieldServiceExtra = isFieldServiceFormContext(form, category);
    if (
      !fieldNodes.length &&
      !useShopKeyedFields &&
      !useFsKeyedFields &&
      !mergeFieldServiceExtra
    ) {
      return null;
    }
    const data = {};
    fieldNodes.forEach((field) => {
      const key = field.dataset.businessExtraField;
      if (!key || field.disabled) return;
      const value = String(field.value ?? "").trim();
      if (value) data[key] = value;
    });
    if (extraKey === "shop_store") {
      const serviceArea = form.querySelector("#bizServiceArea")?.value?.trim() ?? "";
      if (serviceArea) data.visit_area = serviceArea;

      // 非公開：申請者/本人確認
      const applicant = {};
      form.querySelectorAll("[data-shop-private-applicant]").forEach((el) => {
        const key = el.getAttribute("data-shop-private-applicant");
        if (!key || el.disabled) return;
        const value = String(el.value ?? "").trim();
        if (value) applicant[key] = value;
      });
      if (Object.keys(applicant).length) data.private_applicant = applicant;

      // 非公開：振込先
      const bank = {};
      form.querySelectorAll("[data-shop-private-bank]").forEach((el) => {
        const key = el.getAttribute("data-shop-private-bank");
        if (!key || el.disabled) return;
        const value = String(el.value ?? "").trim();
        if (value) bank[key] = value;
      });
      if (Object.keys(bank).length) data.private_bank = bank;
    }
    if (extraKey === "field_service") {
      syncFieldServiceCheckboxExtras(form);
      const serviceArea =
        form.querySelector("#bizServiceArea")?.value?.trim() ||
        form.querySelector("#bizExtraFieldArea")?.value?.trim() ||
        "";
      if (serviceArea) data.visit_area = serviceArea;
    }
    let result = null;
    if (Object.keys(data).length) {
      result = { [extraKey]: data };
    }
    if (mergeFieldServiceExtra) {
      let fsData = {};
      if (window.TasuPostFieldServiceLayout?.isActive?.() && window.TasuPostFieldServiceForm?.collectFieldServiceBlock) {
        fsData = window.TasuPostFieldServiceForm.collectFieldServiceBlock(form);
      } else {
        const fsNodes = form.querySelectorAll(
          `[data-category-extra-key="field_service"][data-business-extra-field]`
        );
        fsNodes.forEach((field) => {
          const key = field.dataset.businessExtraField;
          if (!key || field.disabled) return;
          const value = String(field.value ?? "").trim();
          if (value) fsData[key] = value;
        });
        syncFieldServiceCheckboxExtras(form);
        const serviceArea =
          form.querySelector("#bizServiceArea")?.value?.trim() ||
          form.querySelector("#bizExtraFieldArea")?.value?.trim() ||
          "";
        if (serviceArea) fsData.visit_area = serviceArea;
      }
      if (Object.keys(fsData).length) {
        result = { ...(result || {}), field_service: { ...(result?.field_service || {}), ...fsData } };
      }
    }
    if (extraKey === "taxi") {
      const bookings = Array.from(
        form.querySelectorAll("[data-business-taxi-booking]:checked")
      )
        .map((el) => String(el.value || "").trim())
        .filter(Boolean);
      if (bookings.length) data.booking_types = bookings;
      if (Object.keys(data).length) {
        result = { ...(result || {}), [extraKey]: { ...(result?.[extraKey] || {}), ...data } };
      }
    }
    return result;
  }

  function readFieldServiceDescription(form) {
    return form.querySelector("#bizExtraFieldServiceDesc")?.value?.trim() ?? "";
  }

  function readBusinessAdPlanFields(form) {
    const prPlan = form.querySelector("#bizPrPlan")?.value ?? "none";
    const featuredPlan = form.querySelector("#bizFeaturedPlan")?.value ?? "none";
    const prApply = prPlan === "apply";
    const featuredApply = featuredPlan === "apply";
    return {
      pr_plan: prPlan,
      featured_plan: featuredPlan,
      pr_payment_url: prApply
        ? form.querySelector("#bizPrPaymentUrl")?.value?.trim() ?? ""
        : "",
      pr_bank_info: prApply ? form.querySelector("#bizPrBankInfo")?.value?.trim() ?? "" : "",
      featured_payment_url: featuredApply
        ? form.querySelector("#bizFeaturedPaymentUrl")?.value?.trim() ?? ""
        : "",
      featured_bank_info: featuredApply
        ? form.querySelector("#bizFeaturedBankInfo")?.value?.trim() ?? ""
        : "",
    };
  }

  function formatBusinessAdPlanForConfirm(plan, paymentUrl, bankInfo) {
    const label = BUSINESS_PLAN_LABELS[plan] || plan || "—";
    if (plan !== "apply") return label;
    const parts = [label];
    if (paymentUrl) parts.push(`決済URL: ${paymentUrl}`);
    if (bankInfo) parts.push(`振込先: ${bankInfo}`);
    return parts.join("\n");
  }

  function syncBusinessAdPlanFieldVisibility(form) {
    if (!form) return;
    const prPlan = form.querySelector("#bizPrPlan")?.value ?? "none";
    const featuredPlan = form.querySelector("#bizFeaturedPlan")?.value ?? "none";
    form.querySelectorAll("[data-biz-pr-plan-extra]").forEach((wrap) => {
      const show = prPlan === "apply";
      wrap.hidden = !show;
      wrap.setAttribute("aria-hidden", show ? "false" : "true");
      wrap.querySelectorAll("input, textarea").forEach((field) => {
        field.disabled = !show;
      });
    });
    form.querySelectorAll("[data-biz-featured-plan-extra]").forEach((wrap) => {
      const show = featuredPlan === "apply";
      wrap.hidden = !show;
      wrap.setAttribute("aria-hidden", show ? "false" : "true");
      wrap.querySelectorAll("input, textarea").forEach((field) => {
        field.disabled = !show;
      });
    });
  }

  function initBusinessAdPlanFields(form) {
    if (!form) return;
    syncBusinessAdPlanFieldVisibility(form);
    form.querySelectorAll("[data-biz-ad-plan-select]").forEach((select) => {
      if (select.dataset.bizAdPlanBound === "1") return;
      select.dataset.bizAdPlanBound = "1";
      select.addEventListener("change", () => syncBusinessAdPlanFieldVisibility(form));
    });
  }

  /** タクシー：トップレベル DB 列へ同期 */
  function collectBusinessTaxiColumns(form) {
    const section = form.querySelector(
      '.category-extra-section[data-category-extra="taxi"]'
    );
    if (!section) return {};
    const cols = {};
    section.querySelectorAll("[data-business-taxi-field]").forEach((field) => {
      const col = field.dataset.businessTaxiField;
      if (!col || field.disabled) return;
      const value = String(field.value ?? "").trim();
      if (value) cols[col] = value;
    });
    const payments = Array.from(
      section.querySelectorAll("[data-business-taxi-payment]:checked")
    )
      .map((el) => String(el.value || "").trim())
      .filter(Boolean);
    if (payments.length) cols.taxi_payment_methods = payments;
    const bookings = Array.from(
      form.querySelectorAll("[data-business-taxi-booking]:checked")
    )
      .map((el) => String(el.value || "").trim())
      .filter(Boolean);
    if (bookings.length) cols.taxi_booking_types = bookings;
    return cols;
  }

  function formatCategoryExtraForConfirm(category, categoryExtra) {
    if (!category || !categoryExtra || typeof categoryExtra !== "object") return "—";
    const block =
      categoryExtra[category] && typeof categoryExtra[category] === "object"
        ? categoryExtra[category]
        : categoryExtra;
    const lines = Object.entries(block)
      .filter(([, value]) => value)
      .map(([key, value]) => {
        const label = BUSINESS_EXTRA_FIELD_LABELS[key] || key;
        const display = window.TasuBusinessWording?.formatExtraFieldValue
          ? window.TasuBusinessWording.formatExtraFieldValue(key, value)
          : value;
        return `${label}: ${display}`;
      });
    return lines.length ? lines.join(" / ") : "—";
  }

  function initBusinessCategoryExtras(form) {
    const extrasWrap = form.querySelector("[data-business-category-extras-wrap]");
    const extraHub = form.querySelector("[data-category-extra-hub]");
    const extraTitle = form.querySelector("[data-category-extra-title]");
    const extraLead = form.querySelector("[data-category-extra-lead]");
    const generalHubBlock = form.querySelector(
      '.post-category-hub__block[data-post-scope-block="general"]'
    );
    const extraSections = form.querySelectorAll(".category-extra-section");
    const subcategoryWrap = form.querySelector("[data-business-subcategory-wrap]");
    const subcategorySelect = form.querySelector("[data-business-subcategory]");
    const listingTitleLabel = form.querySelector("[data-listing-title-label]");
    const licenseFieldWrap = form.querySelector("[data-business-license-field]");
    const licenseHint = form.querySelector("[data-business-license-hint]");
    const licenseBadge = form.querySelector("[data-license-required-badge]");
    const commonDesc = form.querySelector("[data-common-section-desc]");
    const tagsLabel = form.querySelector("[data-tags-label]");
    const tagsInput = form.querySelector("[data-tags-input]");
    const tagsHint = form.querySelector("[data-tags-hint]");
    const workCasesSection = form.querySelector("[data-work-cases-section]");
    const workCasesList = form.querySelector("[data-work-cases-list]");
    const workCasesAddBtn = form.querySelector("[data-work-cases-add]");
    const workCasesDesc = form.querySelector("[data-work-cases-section-desc]");
    const serviceMenuSection = form.querySelector("[data-service-menu-section]");
    const serviceMenuList = form.querySelector("[data-service-menu-list]");
    const serviceMenuAddBtn = form.querySelector("[data-service-menu-add]");
    let workCaseRowSeq = 0;
    let serviceMenuRowSeq = 0;

    function workCasePeriodLabel(category) {
      if (isRepairBiz(category) || isCleaningBiz(category)) return "対応日";
      return "工期";
    }

    function syncWorkCasesAddButton() {
      const count = workCasesList?.querySelectorAll("[data-work-case-row]").length ?? 0;
      if (!workCasesAddBtn) return;
      const atMax = count >= WORK_CASES_MAX;
      workCasesAddBtn.disabled = atMax;
      workCasesAddBtn.setAttribute("aria-disabled", atMax ? "true" : "false");
    }

    function removeWorkCaseRow(row) {
      row?.remove();
      syncWorkCasesAddButton();
    }

    function updateGalleryUploadForWorkCases(showWorkCases) {
      const galleryBlock = form.querySelector("[data-gallery-upload]");
      const label = galleryBlock?.querySelector("[data-gallery-label]");
      const hint = galleryBlock?.querySelector("[data-gallery-field-hint]");
      const fileName = galleryBlock?.querySelector("[data-gallery-file-name]");

      if (showWorkCases) {
        if (label) label.textContent = "実績・事例画像";
        if (hint) {
          hint.textContent =
            "施工・修理の実績写真を登録してください。最大3枚まで登録できます。詳細の実績カードに順番で表示されます（1枚目→事例1、2枚目→事例2…）。";
        }
        if (fileName) fileName.dataset.fileDefault = "複数選択可 · 最大3枚";
        window.TasuPostGalleryUpload?.setMaxCount?.(WORK_CASES_MAX);
      } else {
        if (label) {
          label.textContent =
            label.dataset.defaultLabel || "サブ画像（ギャラリー）";
        }
        if (hint) {
          hint.textContent =
            hint.dataset.defaultHint ||
            "詳細ページのギャラリーに表示。追加選択で追記でき、合計最大6枚まで。";
        }
        if (fileName) {
          fileName.dataset.fileDefault =
            fileName.dataset.defaultFileDefault || "複数選択可 · 最大6枚";
        }
        window.TasuPostGalleryUpload?.setMaxCount?.(
          window.TasuPostGalleryUpload?.MAX_GALLERY || 6
        );
      }
      window.TasuPostGalleryUpload?.syncInput?.();
    }

    function buildFsImageField(label, existingUrl, legacyHiddenAttr, hint) {
      const slot = window.TasuPostImageUploadSlot;
      if (!slot?.buildMarkup) return "";
      return slot.buildMarkup({
        label,
        hint:
          hint ||
          "実際の施工写真・許可証・資料画像などを登録してください。",
        hiddenAttr: `data-fs-image-url ${legacyHiddenAttr}`,
        dropzoneAttr: "data-fs-image-dropzone",
        inputAttr: "data-fs-image-input",
        previewAttr: "data-fs-image-preview",
        fileNameAttr: "data-fs-image-file-name",
        browseAttr: "data-fs-image-browse",
        existingUrl: String(existingUrl || "").trim(),
      });
    }

    function initFsRowImage(row, existingUrl) {
      const host = row?.querySelector("[data-fs-image-upload]");
      if (!host) return;
      window.TasuPostImageUploadSlot?.init?.(host, {
        existingUrl: String(existingUrl || "").trim(),
      });
    }

    function addWorkCaseRow(category, data = {}) {
      if (!workCasesList) return;
      const count = workCasesList.querySelectorAll("[data-work-case-row]").length;
      if (count >= WORK_CASES_MAX) return;
      const periodLabel = workCasePeriodLabel(category);
      const idx = workCaseRowSeq++;
      const caseImageUrl = String(data.image_url || data.image || "").trim();
      const row = document.createElement("article");
      row.className = "post-work-case post-fs-repeater-block post-fs-mini-card";
      row.dataset.workCaseRow = String(idx);
      row.innerHTML = `
        <button type="button" class="post-fs-remove-btn" data-work-case-remove aria-label="この事例を削除">削除</button>
        <h3 class="post-fs-repeater-block__label">事例 ${count + 1}</h3>
        <div class="post-work-case__grid">
          <label class="post-work-case__field post-work-case__field--full">
            <span>事例タイトル</span>
            <input type="text" data-work-case-title maxlength="120" placeholder="例：オフィス定期清掃の導入" value="${escapeHtml(data.title || "")}">
          </label>
          <label class="post-work-case__field post-work-case__field--full">
            <span>作業内容・背景</span>
            <textarea rows="2" data-work-case-description maxlength="500" placeholder="例：150㎡オフィスの週次清掃を新規導入">${escapeHtml(data.description || data.content || data.service || "")}</textarea>
          </label>
          <label class="post-work-case__field post-work-case__field--full">
            <span>成果・効果</span>
            <textarea rows="2" data-work-case-outcome maxlength="300" placeholder="例：清掃品質のばらつき解消・コスト15%削減">${escapeHtml(data.outcome || data.note || data.notes || "")}</textarea>
          </label>
          <label class="post-work-case__field">
            <span>地域</span>
            <input type="text" data-work-case-region maxlength="80" placeholder="例：大阪府大阪市" value="${escapeHtml(data.region || data.area || "")}">
          </label>
          <label class="post-work-case__field">
            <span data-work-case-period-label>${escapeHtml(periodLabel)}</span>
            <input type="text" data-work-case-period maxlength="80" placeholder="例：2025年4月 / 3日間" value="${escapeHtml(data.period || data.duration || "")}">
          </label>
          <label class="post-work-case__field post-work-case__field--full">
            <span>費用目安</span>
            <input type="text" data-work-case-cost maxlength="80" placeholder="例：月額25万円" value="${escapeHtml(data.cost || data.price || "")}">
          </label>
          ${buildFsImageField("事例画像", caseImageUrl, "data-work-case-image-url", "詳細ページの実績セクションに表示されます。")}
        </div>`;
      row.querySelector("[data-work-case-remove]")?.addEventListener("click", () => removeWorkCaseRow(row));
      workCasesList.appendChild(row);
      initFsRowImage(row, caseImageUrl);
      syncWorkCasesAddButton();
    }

    function syncServiceMenuAddButton() {
      const count = serviceMenuList?.querySelectorAll("[data-service-menu-row]").length ?? 0;
      if (!serviceMenuAddBtn) return;
      const atMax = count >= SERVICE_MENU_MAX;
      serviceMenuAddBtn.disabled = atMax;
      serviceMenuAddBtn.setAttribute("aria-disabled", atMax ? "true" : "false");
    }

    function renumberServiceMenuCards() {
      serviceMenuList?.querySelectorAll("[data-service-menu-row]").forEach((row, index) => {
        const title = row.querySelector(".post-fs-menu-card__title");
        if (title) title.textContent = `サービスメニュー #${index + 1}`;
      });
    }

    function removeServiceMenuRow(row) {
      row?.remove();
      renumberServiceMenuCards();
      syncServiceMenuAddButton();
    }

    function addServiceMenuRow(data = {}) {
      if (!serviceMenuList) return;
      const count = serviceMenuList.querySelectorAll("[data-service-menu-row]").length;
      if (count >= SERVICE_MENU_MAX) return;
      const idx = serviceMenuRowSeq++;
      const menuNum = count + 1;
      const menuImageUrl = String(data.image_url || data.menu_image_url || "").trim();
      const row = document.createElement("article");
      row.className = "post-fs-menu-card";
      row.dataset.serviceMenuRow = String(idx);
      row.innerHTML = `
        <button type="button" class="post-fs-remove-btn" data-service-menu-remove aria-label="このメニューを削除">削除</button>
        <header class="post-fs-menu-card__head">
          <h3 class="post-fs-menu-card__title">サービスメニュー #${menuNum}</h3>
        </header>
        <div class="post-fs-menu-card__body">
          ${buildFsImageField("メニュー画像", menuImageUrl, "data-service-menu-image-url", "料金プラン一覧に表示される画像です。")}
          <label class="post-work-case__field post-work-case__field--full">
            <span>サービス名</span>
            <input type="text" data-service-menu-title maxlength="80" placeholder="例：定期オフィス清掃" value="${escapeHtml(data.title || "")}">
          </label>
          <label class="post-work-case__field post-work-case__field--full">
            <span>料金</span>
            <input type="text" data-service-menu-price maxlength="60" placeholder="例：月額25,000円〜" value="${escapeHtml(data.price || "")}">
          </label>
          <label class="post-work-case__field post-work-case__field--full">
            <span>内容</span>
            <textarea rows="2" data-service-menu-description maxlength="300" placeholder="例：床清掃・ゴミ回収・共用部清掃">${escapeHtml(data.description || data.work_description || data.desc || "")}</textarea>
          </label>
          <label class="post-work-case__field post-work-case__field--full">
            <span>対応範囲</span>
            <input type="text" data-service-menu-scope maxlength="120" placeholder="例：週1〜週5・夜間対応可能" value="${escapeHtml(data.scope || data.location || data.service_location || "")}">
          </label>
          <label class="post-work-case__field post-work-case__field--full">
            <span>備考</span>
            <textarea rows="2" data-service-menu-notes maxlength="200" placeholder="例：初回現地調査無料">${escapeHtml(data.notes || data.note || "")}</textarea>
          </label>
        </div>`;
      row.querySelector("[data-service-menu-remove]")?.addEventListener("click", () =>
        removeServiceMenuRow(row)
      );
      serviceMenuList.appendChild(row);
      initFsRowImage(row, menuImageUrl);
      renumberServiceMenuCards();
      syncServiceMenuAddButton();
    }

    function updateServiceMenuFormMode(showServiceMenu, category) {
      if (serviceMenuSection) {
        serviceMenuSection.hidden = !showServiceMenu;
        serviceMenuSection.setAttribute("aria-hidden", showServiceMenu ? "false" : "true");
        serviceMenuSection.querySelectorAll("input, textarea, select, button").forEach((el) => {
          if (el.matches("[data-service-menu-add]")) {
            el.disabled = !showServiceMenu;
            return;
          }
          el.disabled = !showServiceMenu;
        });
      }
      const titleEl = serviceMenuSection?.querySelector("#bizServiceMenuTitle");
      const descEl = form.querySelector("[data-service-menu-section-desc]");
      if (showServiceMenu) {
        if (titleEl) {
          const icon = titleEl.querySelector(".post-section__icon");
          titleEl.textContent = "";
          if (icon) titleEl.appendChild(icon);
          titleEl.appendChild(document.createTextNode(` ${SERVICE_MENU_SECTION_TITLE}`));
        }
        if (descEl) descEl.textContent = SERVICE_MENU_SECTION_DESC;
      }
      if (showServiceMenu && serviceMenuList && !serviceMenuList.querySelector("[data-service-menu-row]")) {
        addServiceMenuRow();
      }
      syncServiceMenuAddButton();
    }

    function updateWorkCasesFormMode(category, isBusiness, showWorkCases, isRepair) {
      updateServiceMenuFormMode(
        isBusiness && shouldShowServiceMenuBlock(form, category),
        category
      );
      if (workCasesSection) {
        workCasesSection.hidden = !showWorkCases;
        workCasesSection.setAttribute("aria-hidden", showWorkCases ? "false" : "true");
      }
      form.querySelectorAll("[data-gallery-hide-for-work-cases]").forEach((el) => {
        el.hidden = false;
        el.setAttribute("aria-hidden", "false");
        el.querySelectorAll("input, button").forEach((field) => {
          field.disabled = false;
        });
      });
      updateGalleryUploadForWorkCases(showWorkCases);
      form.querySelectorAll("[data-achievements-hide-for-work-cases]").forEach((el) => {
        el.hidden = showWorkCases;
        el.setAttribute("aria-hidden", showWorkCases ? "true" : "false");
        const field = el.querySelector("textarea, input");
        if (field) field.disabled = showWorkCases;
      });
      if (workCasesDesc) {
        workCasesDesc.textContent = isRepair
          ? "修理実績のテキスト情報を登録します（最大3件）。写真は下の「実績・事例画像」から登録し、1枚目→事例1の順で表示されます。"
          : isCleaningBiz(category)
            ? "清掃・片付け実績のテキスト情報を登録します（最大3件）。写真は下の「実績・事例画像」から登録し、1枚目→事例1の順で表示されます。"
            : "施工実績のテキスト情報を登録します（最大3件）。写真は下の「実績・事例画像」から登録し、1枚目→事例1の順で表示されます。";
      }
      if (showWorkCases && workCasesList && !workCasesList.querySelector("[data-work-case-row]")) {
        addWorkCaseRow(category);
      }
      const periodLabel = workCasePeriodLabel(category);
      workCasesList?.querySelectorAll("[data-work-case-period-label]").forEach((el) => {
        el.textContent = periodLabel;
      });
      syncWorkCasesAddButton();
    }

    workCasesAddBtn?.addEventListener("click", () => {
      const category = getSelectedCategory();
      addWorkCaseRow(category);
    });

    serviceMenuAddBtn?.addEventListener("click", () => {
      addServiceMenuRow();
    });

    function getSelectedCategory() {
      return (
        form.querySelector("[data-business-category-pick]:checked")?.value ||
        form.querySelector("[data-business-category-hidden]")?.value ||
        ""
      );
    }

    function updateLicenseEmphasis(category) {
      const emphasize = isTransportBiz(category) || isConstructionBiz(category);
      licenseFieldWrap?.classList.toggle("post-field--license-emphasis", emphasize);
      if (licenseBadge) licenseBadge.hidden = !isTransportBiz(category);
      if (licenseHint) {
        licenseHint.textContent = isTransportBiz(category)
          ? "旅客運送に必要な許可・資格番号を正確に記載してください。無許可・白タク掲載は禁止です。"
          : "許可・資格が必要な業種は、届出番号・資格名を正確に記載してください。";
      }
    }

    function updateSubcategoryField(category, isBusiness) {
      if (!subcategorySelect || !subcategoryWrap) return;
      const canonical = normalizeBizCat(category);
      const subs = window.TasuBusinessCategories?.getSubcategories?.(canonical) || [];
      const current = subcategorySelect.value;
      subcategorySelect.innerHTML = '<option value="">選択してください（任意）</option>';
      subs.forEach((sub) => {
        const opt = document.createElement("option");
        opt.value = sub.id;
        opt.textContent = sub.label;
        subcategorySelect.appendChild(opt);
      });
      if (current && [...subcategorySelect.options].some((o) => o.value === current)) {
        subcategorySelect.value = current;
      }
      const show = isBusiness && Boolean(canonical) && subs.length > 0;
      subcategoryWrap.hidden = !show;
      subcategoryWrap.setAttribute("aria-hidden", show ? "false" : "true");
      subcategorySelect.disabled = !show;
    }

    function updateContractPeriodLabel(category) {
      const labelEl = form.querySelector("[data-biz-contract-period-label]");
      if (!labelEl) return;
      labelEl.textContent = window.TasuBusinessWording?.contractPeriodLabel
        ? window.TasuBusinessWording.contractPeriodLabel(category)
        : isConstructionBiz(category)
          ? "工期"
          : "対応期間";
    }

    function updateBusinessCommonLabels(isBusiness) {
      if (commonDesc) {
        commonDesc.textContent = isBusiness
          ? "タイトル・説明・対応タグ・画像は全カテゴリ共通です"
          : "すべての掲載タイプで共通の項目です";
      }
      if (isBusiness) {
        if (tagsLabel) tagsLabel.textContent = BUSINESS_TAG_UI.label;
        if (tagsInput) tagsInput.placeholder = BUSINESS_TAG_UI.placeholder;
        if (tagsHint) tagsHint.textContent = BUSINESS_TAG_UI.hint;
        return;
      }
      const type = resolveActiveListingType(form);
      if (tagsLabel) tagsLabel.textContent = TAG_LABELS[type] ?? "タグ";
      if (tagsInput) tagsInput.placeholder = TAG_PLACEHOLDERS[type] ?? "";
      if (tagsHint) tagsHint.textContent = TAG_HINTS[type] ?? TAG_HINTS.product;
    }

    function updateCategoryHubDimming(isBusiness) {
      generalHubBlock?.classList.toggle(
        "post-category-hub__block--dimmed",
        Boolean(isBusiness)
      );
    }

    function setBusinessJobFieldGroupHidden(selector, hidden) {
      form.querySelectorAll(selector).forEach((el) => {
        el.hidden = hidden;
        el.setAttribute("aria-hidden", hidden ? "true" : "false");
        el.querySelectorAll("input, select, textarea").forEach((field) => {
          field.disabled = hidden;
        });
      });
    }

    function updateBudgetAmountLabel(category, isBusiness) {
      const label = form.querySelector("[data-biz-budget-amount-label]");
      if (!label) return;
      label.textContent =
        isBusiness && isRepairBiz(category) ? "料金目安" : "予算・単価";
    }

    function updateTaxiFormMode(category, isBusiness) {
      const isTaxi = isBusiness && isTransportBiz(category);
      const isRepair = isBusiness && isRepairBiz(category);
      const showWorkCases = isBusiness && usesWorkCasesProfile(category);
      document.body.dataset.businessCategory = isBusiness ? category || "" : "";

      setBusinessJobFieldGroupHidden("[data-business-job-hide-for-taxi]", isTaxi);
      setBusinessJobFieldGroupHidden("[data-business-job-hide-for-repair]", isRepair);
      updateBudgetAmountLabel(category, isBusiness);
      updateWorkCasesFormMode(category, isBusiness, showWorkCases, isRepair);

      const isShop = isBusiness && isShopStoreFormContext(form, category);
      const isFsUi =
        isBusiness && isFieldServiceFormContext(form, category);
      const jobSection = form.querySelector("[data-business-job-conditions]");
      if (jobSection) {
        jobSection.hidden = !isBusiness || isTaxi || isShop || isFsUi;
        jobSection.setAttribute(
          "aria-hidden",
          !isBusiness || isTaxi || isShop || isFsUi ? "true" : "false"
        );
        if (isRepair && !isTaxi) {
          const jobDesc = jobSection.querySelector(".post-section__desc");
          if (jobDesc) {
            jobDesc.textContent =
              "料金目安・受付状況など。出張・即日・見積などは修理向け追加情報と対応タグで表示します。";
          }
        }
      }

      form.querySelectorAll("[data-business-hide-for-taxi]").forEach((el) => {
        el.hidden = isTaxi;
        el.setAttribute("aria-hidden", isTaxi ? "true" : "false");
      });

      const companyDesc = form.querySelector("[data-business-company-desc]");
      if (companyDesc) {
        companyDesc.textContent = isTaxi
          ? "送迎・配車サービスの基本情報です。電話は表示のみで、問い合わせはサイト内から受け付けます。"
          : "業者ページ・AI検索・今対応可能検索に表示する基本情報です";
      }

      const achievements = form.querySelector("[data-business-achievements-field]");
      if (achievements) {
        achievements.placeholder = isTaxi
          ? "送迎実績・法人取引・ルート事例など（1行1件推奨）"
          : isRepair
            ? "修理実績・対応事例など（1行1件推奨）"
            : "施工実績・導入件数・受賞歴など";
      }

      const isShopFlow = isBusiness && isShopStoreFormContext(form, category);
      const isFsFlow =
        isBusiness && isFieldServiceFormContext(form, category) && !isShopFlow;

      if (extraHub) {
        const showHub =
          isBusiness && Boolean(category) && !isTaxi && !isShopFlow && !isFsFlow;
        extraHub.hidden = !showHub;
        extraHub.setAttribute("aria-hidden", showHub ? "false" : "true");
      }
      if (extraTitle && isTaxi) {
        extraTitle.textContent = BUSINESS_CATEGORY_EXTRA_TITLES.taxi;
      }
      if (extraLead && isTaxi) {
        extraLead.textContent =
          "送迎予約サービス向けの専用フォームです。下の順番で入力してください。";
      }
    }

    function syncBusinessTypeField(category, isBusiness) {
      const hidden = form.querySelector("[data-business-type-value]");
      if (!hidden) return;
      const bt = isBusiness ? getBusinessTypeForCategory(category) : "";
      hidden.value = bt;
      document.body.dataset.businessType = bt || "";
    }

    function setBusinessFieldGroupHidden(selector, hidden) {
      form.querySelectorAll(selector).forEach((el) => {
        if (
          hidden &&
          (el.closest("[data-shop-store-flow]") || el.closest("[data-field-service-flow]"))
        ) {
          return;
        }
        el.hidden = hidden;
        el.setAttribute("aria-hidden", hidden ? "true" : "false");
        el.querySelectorAll("input, textarea, select, button").forEach((field) => {
          if (field.matches("[data-business-category-pick]")) return;
          field.disabled = hidden;
        });
      });
    }

    function updateFieldServiceFormMode(category, isBusiness) {
      const isFs = isBusiness && isFieldServiceFormContext(form, category);
      if (!isFs) return;
      const companyLabel = form.querySelector('label[for="bizCompanyName"]');
      if (companyLabel) {
        companyLabel.innerHTML = 'サービス名<span class="post-field__required">必須</span>';
      }
      const listingTitleLabel = form.querySelector("[data-listing-title-label]");
      if (listingTitleLabel) {
        listingTitleLabel.innerHTML =
          '掲載タイトル<span class="post-field__required">必須</span>';
      }
      if (workCasesDesc) {
        workCasesDesc.textContent =
          "作業事例テキスト（最大3件）。実績画像とあわせて詳細ページに表示されます。";
      }
      const menuDesc = form.querySelector("[data-service-menu-section-desc]");
      if (menuDesc) {
        menuDesc.textContent =
          "対応メニューと料金目安を登録します（最大6件）。詳細の「サービスメニュー」に表示されます。";
      }
    }

    function updateShopStoreFormMode(category, isBusiness) {
      const isShop = isBusiness && isShopStoreFormContext(form, category);
      setBusinessFieldGroupHidden("[data-business-hide-for-shop-store]", isShop);
      const serviceMenuSection = form.querySelector("[data-service-menu-section]");
      if (serviceMenuSection && isShop) {
        serviceMenuSection.hidden = true;
        serviceMenuSection.setAttribute("aria-hidden", "true");
        serviceMenuSection.querySelectorAll("input, textarea, select, button").forEach((el) => {
          el.disabled = true;
        });
      }

      const listingDesc = form.querySelector("#description");
      if (listingDesc) {
        if (isShop) listingDesc.removeAttribute("required");
        else if (isBusiness) listingDesc.setAttribute("required", "");
      }

      // shop_store placeholders (basic block)
      if (isShop) {
        const company = form.querySelector("#bizCompanyName");
        if (company) company.placeholder = "例：工具専門店 Re:WORKS";
        const phone = form.querySelector("#bizPhone");
        if (phone) phone.placeholder = "例：06-1234-5678";
        const area = form.querySelector("#bizServiceArea");
        if (area) area.placeholder = "例：大阪府全域・京都市内・神戸市内";
        const catField = form.querySelector("#bizExtraShopStoreCategory");
        if (catField) catField.placeholder = "例：工具・機材・中古販売・買取";
        const hours = form.querySelector("#bizExtraShopStoreHours");
        if (hours) hours.placeholder = "例：10:00〜19:00";
        const desc = form.querySelector("#bizExtraShopStoreDesc");
        if (desc) desc.placeholder =
          "工具・機材の新品・中古販売と買取に対応。法人向けの継続取引や大量買取にも対応しています。";
        const tags = form.querySelector("[data-tags-input]");
        if (tags) tags.placeholder = "例：工具, 電動工具, 中古販売, 買取, 出張査定, 法人対応";
      }

      const listingTitle = form.querySelector("#title");
      const listingTitleLabel = form.querySelector("[data-listing-title-label]");
      if (listingTitle) {
        if (isShop || isBusiness) listingTitle.setAttribute("required", "");
        else listingTitle.removeAttribute("required");
      }
      if (listingTitleLabel && isShop) {
        listingTitleLabel.innerHTML =
          '掲載タイトル<span class="post-field__required">必須</span>';
      }
      if (listingTitle && isShop) {
        listingTitle.placeholder =
          "例：工具・機材の販売・買取｜工具専門店 Re:WORKS";
      }
      const tagsLabelEl = form.querySelector("[data-tags-label]");
      if (tagsLabelEl && isShop) tagsLabelEl.textContent = "対応タグ";

      const shopDesc = form.querySelector("#bizExtraShopStoreDesc");
      if (shopDesc) {
        if (isShop) shopDesc.setAttribute("required", "");
        else shopDesc.removeAttribute("required");
        shopDesc.disabled = !isShop;
      }

      const companyLabel = form.querySelector('label[for="bizCompanyName"]');
      if (companyLabel) {
        companyLabel.innerHTML = isShop
          ? '店舗名<span class="post-field__required">必須</span>'
          : '会社名<span class="post-field__required">必須</span>';
      }

      const serviceAreaLabel = form.querySelector("[data-biz-service-area-label]");
      if (serviceAreaLabel) {
        serviceAreaLabel.innerHTML = isShop
          ? '対応エリア<span class="post-field__required">必須</span>'
          : '対応地域<span class="post-field__required">必須</span>';
      }

      const imagesHeading = form.querySelector("[data-shop-store-images-heading]");
      const galleryLabel = form.querySelector("[data-gallery-label]");
      const galleryHint = form.querySelector("[data-gallery-field-hint]");
      if (imagesHeading) {
        imagesHeading.hidden = !isShop;
        imagesHeading.setAttribute("aria-hidden", isShop ? "false" : "true");
      }
      if (galleryLabel) {
        galleryLabel.textContent = isShop
          ? "サブ画像（最大6枚）"
          : galleryLabel.dataset.defaultLabel || "サブ画像（ギャラリー）";
      }
      if (galleryHint) {
        galleryHint.textContent = isShop
          ? "店舗のサブ画像です。追加選択で追記でき、合計最大6枚まで。"
          : galleryHint.dataset.defaultHint ||
            "詳細ページのギャラリーに表示。追加選択で追記でき、合計最大6枚まで。";
      }

      if (commonDesc) {
        commonDesc.textContent = isShop
          ? "対応タグ・店舗画像を登録します（店舗説明は「店舗・販売向け情報」に入力）"
          : isBusiness
            ? "タイトル・説明・対応タグ・画像は全カテゴリ共通です"
            : "すべての掲載タイプで共通の項目です";
      }
    }

    function updateCategoryExtraSections() {
      const scope = form.querySelector("[data-post-scope]")?.value ?? POST_SCOPE.general;
      const isBusiness = scope === POST_SCOPE.business;
      const category = getSelectedCategory();
      const showExtras = isBusiness && Boolean(category);
      const isShopFlow = isBusiness && isShopStoreFormContext(form, category);
      const isFsFlow = isBusiness && isFieldServiceFormContext(form, category) && !isShopFlow;

      syncBusinessTypeField(category, isBusiness);
      updateShopStoreFormMode(category, isBusiness);
      updateTaxiFormMode(category, isBusiness);
      updateCategoryHubDimming(isBusiness);

      if (extrasWrap) {
        extrasWrap.hidden = !isBusiness;
        extrasWrap.setAttribute("aria-hidden", isBusiness ? "false" : "true");
        extrasWrap.dataset.hasActiveExtra = showExtras ? "true" : "false";
      }

      if (extraHub) {
        extraHub.hidden = !showExtras;
        extraHub.setAttribute("aria-hidden", showExtras ? "false" : "true");
      }
      if (extraTitle && category) {
        extraTitle.textContent =
          BUSINESS_CATEGORY_EXTRA_TITLES[bizExtraKey(category)] || "カテゴリ別追加情報";
      }
      if (extraLead) {
        extraLead.textContent = showExtras
          ? "以下は選択中のカテゴリ専用の項目です。細かい内容は対応タグにも記載できます。"
          : "法人・業者カテゴリを選択すると、ここに追加項目が表示されます。";
      }

      const extraKey = bizExtraKey(category);

      extraSections.forEach((section) => {
        const match =
          isBusiness &&
          extraKey &&
          section.dataset.categoryExtra === extraKey &&
          !isShopFlow &&
          !isFsFlow;
        section.hidden = !match;
        section.style.display = match ? "block" : "none";
        section.setAttribute("aria-hidden", match ? "false" : "true");
        section
          .querySelectorAll(
            "[data-business-extra-field], [data-business-taxi-field], [data-business-taxi-payment], [data-business-taxi-booking]"
          )
          .forEach((field) => {
            field.disabled = !match || !isBusiness;
          });
      });

      updateLicenseEmphasis(isBusiness ? category : "");
      updateBusinessCommonLabels(isBusiness);
      if (isBusiness) updateContractPeriodLabel(category);
      updateSubcategoryField(category, isBusiness);
      if (listingTitleLabel && !(isBusiness && isShopStoreBiz(category))) {
        listingTitleLabel.innerHTML = isBusiness
          ? isFieldServiceBiz(category)
            ? 'サービス名<span class="post-field__required">必須</span>'
            : 'サービス名<span class="post-field__required">必須</span>'
          : 'タイトル<span class="post-field__required">必須</span>';
      }
      if (isBusiness) {
        updateShopStoreFormMode(category, isBusiness);
        updateFieldServiceFormMode(category, isBusiness);
      }
      const titleInput = form.querySelector("#title");
      if (titleInput) {
        titleInput.placeholder = isBusiness
          ? isShopStoreBiz(category)
            ? "例：工具・機材の販売・買取｜工具専門店 Re:WORKS"
            : isFieldServiceBiz(category)
              ? "例：営業代行 / IT支援 / 現地対応サポート"
              : "例：空港送迎 / 内装工事一式 / オフィス定期清掃"
          : "例：スマートウォッチ Pro / Live2D制作 / 動画編集スタッフ募集";
      }
      if (workCasesDesc && isFieldServiceBiz(category)) {
        workCasesDesc.textContent =
          "業者サービスの作業事例テキスト（最大3件）。写真は下の「実績・事例画像」から登録します。";
      }

      const showProducts = isBusiness && shouldShowShopProductsBlock(form, category);
      window.TasuPostShopProducts?.setBlockVisible?.(form, showProducts);
      if (showProducts) {
        window.TasuPostShopStoreLayout?.ensureShopProductsVisible?.(form, true);
        window.TasuPostShopProducts?.initShopProductsForm?.(form);
      }
      applyBusinessFormWhitelist(form);
    }

    form.querySelectorAll("[data-business-category-pick]").forEach((radio) => {
      radio.addEventListener("change", updateCategoryExtraSections);
    });

    subcategorySelect?.addEventListener("change", () => {
      refreshBusinessFormLayout(form);
    });

    updateCategoryExtraSections();
    window.TasuPostShopProducts?.initShopProductsForm?.(form);
    form.__postServiceMenuApi = {
      addRow: addServiceMenuRow,
      syncAddButton: syncServiceMenuAddButton,
    };
    form.__postWorkCasesApi = {
      addRow: addWorkCaseRow,
      syncAddButton: syncWorkCasesAddButton,
    };
    return { updateCategoryExtraSections, getSelectedCategory };
  }

  function collectServiceMenuItems(form) {
    const rows = form.querySelectorAll("[data-service-menu-row]");
    const out = [];
    rows.forEach((row) => {
      const title = row.querySelector("[data-service-menu-title]")?.value?.trim() ?? "";
      const price = row.querySelector("[data-service-menu-price]")?.value?.trim() ?? "";
      const description =
        row.querySelector("[data-service-menu-description]")?.value?.trim() ?? "";
      const scope = row.querySelector("[data-service-menu-scope]")?.value?.trim() ?? "";
      const notes = row.querySelector("[data-service-menu-notes]")?.value?.trim() ?? "";
      const duration =
        row.querySelector("[data-service-menu-duration]")?.value?.trim() ?? "";
      const location =
        row.querySelector("[data-service-menu-location]")?.value?.trim() ?? "";
      const image_url =
        row.querySelector("[data-fs-image-url]")?.value?.trim() ??
        row.querySelector("[data-service-menu-image-url]")?.value?.trim() ??
        "";
      const imageHost = row.querySelector("[data-fs-image-upload]");
      const image_file =
        window.TasuPostImageUploadSlot?.getStagedFile(imageHost) ??
        window.TasuPostServiceMenuUpload?.getStagedFile?.(row) ??
        null;
      if (!title && !description && !price && !notes) return;
      out.push({
        title,
        price,
        description,
        scope,
        notes,
        duration,
        location,
        image_url,
        image_file,
      });
    });
    return out.slice(0, SERVICE_MENU_MAX);
  }

  function sanitizeServiceMenuForSave(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const title = String(item.title || item.name || "").trim();
        const price = String(item.price || item.value || item.amount || "").trim();
        const description = String(item.description || item.desc || "").trim();
        const scope = String(item.scope || item.location || "").trim();
        const notes = String(item.notes || item.note || "").trim();
        const duration = String(item.duration || "").trim();
        const location = String(item.location || "").trim();
        const image_url = String(item.image_url || item.image || "").trim();
        if (!title && !description && !price && !notes) return null;
        return { title, price, description, scope, notes, duration, location, image_url };
      })
      .filter(Boolean)
      .slice(0, SERVICE_MENU_MAX);
  }

  function formatServiceMenuForConfirm(form) {
    const items = collectServiceMenuItems(form);
    if (!items.length) return "未入力";
    return items
      .map((item, i) => {
        const parts = [item.title, item.price, item.description].filter(Boolean);
        return `${i + 1}. ${parts.join(" / ")}`;
      })
      .join("\n");
  }

  function collectWorkCases(form) {
    const rows = form.querySelectorAll("[data-work-case-row]");
    const out = [];
    rows.forEach((row, index) => {
      const title = row.querySelector("[data-work-case-title]")?.value?.trim() ?? "";
      const description =
        row.querySelector("[data-work-case-description]")?.value?.trim() ??
        row.querySelector("[data-work-case-content]")?.value?.trim() ??
        "";
      const outcome =
        row.querySelector("[data-work-case-outcome]")?.value?.trim() ??
        row.querySelector("[data-work-case-note]")?.value?.trim() ??
        "";
      const region = row.querySelector("[data-work-case-region]")?.value?.trim() ?? "";
      const period = row.querySelector("[data-work-case-period]")?.value?.trim() ?? "";
      const price = row.querySelector("[data-work-case-cost]")?.value?.trim() ?? "";
      const image_url =
        row.querySelector("[data-fs-image-url]")?.value?.trim() ??
        row.querySelector("[data-work-case-image-url]")?.value?.trim() ??
        "";
      const imageHost = row.querySelector("[data-fs-image-upload]");
      const image_file =
        window.TasuPostImageUploadSlot?.getStagedFile(imageHost) ??
        window.TasuPostWorkCaseUpload?.getStagedFile?.(row) ??
        null;
      if (!title && !description && !outcome && !region && !period && !price && !image_url) return;
      out.push({
        title: title || `事例 ${index + 1}`,
        description,
        outcome,
        region,
        period,
        price,
        image_url,
        image_file,
      });
    });
    return out.slice(0, WORK_CASES_MAX);
  }

  function sanitizeWorkCasesForSave(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((item, index) => {
        if (!item || typeof item !== "object") return null;
        const title = String(item.title || item.name || "").trim();
        const description = String(
          item.description || item.category || item.content || item.service || ""
        ).trim();
        const outcome = String(item.outcome || item.note || item.notes || "").trim();
        const region = String(item.region || item.area || "").trim();
        const period = String(item.period || item.duration || "").trim();
        const price = String(item.price || item.cost || "").trim();
        const image_url = String(item.image_url || item.image || "").trim();
        if (!title && !description && !outcome && !region && !period && !price && !image_url) {
          return null;
        }
        return {
          title: title || `事例 ${index + 1}`,
          description,
          outcome,
          region,
          period,
          price,
          image_url,
        };
      })
      .filter(Boolean)
      .slice(0, WORK_CASES_MAX);
  }

  function formatWorkCasesForConfirm(form) {
    const rows = form.querySelectorAll("[data-work-case-row]");
    const galleryCount = window.TasuPostGalleryUpload?.getStagedFiles?.().length ?? 0;
    const lines = [];
    rows.forEach((row, index) => {
      const title = row.querySelector("[data-work-case-title]")?.value?.trim() ?? "";
      const content = row.querySelector("[data-work-case-content]")?.value?.trim() ?? "";
      const region = row.querySelector("[data-work-case-region]")?.value?.trim() ?? "";
      const period = row.querySelector("[data-work-case-period]")?.value?.trim() ?? "";
      const cost = row.querySelector("[data-work-case-cost]")?.value?.trim() ?? "";
      if (!title && !content && !region && !period && !cost) return;
      const extra = [region, period, cost].filter(Boolean).join(" / ");
      lines.push(`${index + 1}. ${title || "（無題）"}${extra ? `（${extra}）` : ""}`);
    });
    const textBlock = lines.length ? lines.join("\n") : "テキスト未入力";
    const photoBlock =
      galleryCount > 0 ? `実績・事例画像: ${galleryCount}枚` : "実績・事例画像: 未選択";
    return `${photoBlock}\n${textBlock}`;
  }

  function initPostScope(form) {
    const scopeInput = form.querySelector("[data-post-scope]");
    const businessCategoryHidden = form.querySelector("[data-business-category-hidden]");
    const listingTypeHidden = form.querySelector("[data-listing-type-value]");
    const generalOnlyBlocks = form.querySelectorAll("[data-general-only]");
    const postTypeBar = form.querySelector("[data-post-type-bar]");
    const businessCategoryBar = form.querySelector("[data-business-category-bar]");
    const businessCategoryBadge = form.querySelector("[data-business-category-badge]");
    const generalCategoryRadios = form.querySelectorAll("[data-general-category]");
    const businessCategoryRadios = form.querySelectorAll("[data-business-category-pick]");
    const businessModeRadios = form.querySelectorAll("[data-business-mode-pick]");
    const businessCategoryGroup = form.querySelector("[data-business-category-pick-group]");
    const shopStoreCategoryGroup = form.querySelector("[data-shop-store-category-pick-group]");
    const shopStoreCategoryRadios = form.querySelectorAll("[data-shop-store-category-pick]");
    const shopStoreCategoryInput = document.getElementById("bizExtraShopStoreCategory");
    const businessNotice = form.querySelector("[data-business-notice]");
    const businessPanel = form.querySelector('[data-form-type="business"]');
    const jobConditionsSection = form.querySelector("[data-business-job-conditions]");
    const typeSelect = form.querySelector("[data-listing-type]");
    const submitNote = document.querySelector("[data-submit-note]");
    const businessFields = form.querySelectorAll("[data-business-field]");
    const generalPaymentFields = form.querySelectorAll("[data-general-payment-field]");

    const REQUIRED_BUSINESS_IDS = ["bizCompanyName", "bizPhone", "bizServiceArea"];
    const categoryExtras = initBusinessCategoryExtras(form);

    function setGeneralPaymentFieldsActive(active) {
      generalPaymentFields.forEach((field) => {
        field.disabled = !active;
      });
    }

    function setGeneralOnlyVisible(visible) {
      generalOnlyBlocks.forEach((el) => {
        el.hidden = !visible;
        el.setAttribute("aria-hidden", visible ? "false" : "true");
      });
      if (postTypeBar) {
        postTypeBar.hidden = !visible;
        postTypeBar.setAttribute("aria-hidden", visible ? "false" : "true");
      }
    }

    function updateBusinessCategoryBadge(category) {
      if (!businessCategoryBadge) return;
      const label = bizCatLabel(category) || "—";
      businessCategoryBadge.textContent = label;
      businessCategoryBadge.dataset.category = category || "";
    }

    function setBusinessFieldRequired(active) {
      businessFields.forEach((field) => {
        const isRequired =
          active &&
          (REQUIRED_BUSINESS_IDS.includes(field.id) || field.name === "bizStatus");
        if (field.type === "radio" && field.name === "bizStatus") {
          field.required = active;
          field.disabled = !active;
          return;
        }
        field.required = Boolean(isRequired);
        field.disabled = !active;
      });
      if (active) {
        const statusChecked = form.querySelector('input[name="bizStatus"]:checked');
        if (!statusChecked) {
          const first = form.querySelector('input[name="bizStatus"][value="available"]');
          if (first) first.checked = true;
        }
      }
    }

    function syncGeneralTypeFromRadio() {
      const checked = form.querySelector("[data-general-category]:checked");
      if (!checked) return;
      const type = checked.value;
      if (typeSelect && typeSelect.value !== type) {
        typeSelect.value = type;
      }
      syncListingTypeValue(form, type);
      form.__updateListingFormType?.(type);
    }

    function syncGeneralRadioFromType(type) {
      const radio = form.querySelector(`[data-general-category][value="${type}"]`);
      if (radio) radio.checked = true;
    }

    function applyScope(scope) {
      const isBusiness = scope === POST_SCOPE.business;

      if (scopeInput) scopeInput.value = scope;
      document.body.dataset.postScope = scope;

      setGeneralOnlyVisible(!isBusiness);

      if (businessPanel) {
        businessPanel.hidden = !isBusiness;
        businessPanel.setAttribute("aria-hidden", isBusiness ? "false" : "true");
      }

      if (businessCategoryBar) {
        businessCategoryBar.hidden = !isBusiness;
      }

      if (businessNotice) {
        businessNotice.hidden = !isBusiness;
      }

      if (jobConditionsSection) {
        jobConditionsSection.hidden = !isBusiness;
        jobConditionsSection.setAttribute("aria-hidden", isBusiness ? "false" : "true");
      }

      if (typeSelect) {
        typeSelect.required = !isBusiness;
        typeSelect.disabled = isBusiness;
        typeSelect.tabIndex = isBusiness ? -1 : 0;
      }

      if (listingTypeHidden) {
        listingTypeHidden.value = isBusiness ? "" : listingTypeHidden.value || typeSelect?.value || "skill";
      }

      if (businessCategoryHidden && !isBusiness) {
        businessCategoryHidden.value = "";
        updateBusinessCategoryBadge("");
      }

      setBusinessFieldRequired(isBusiness);
      setGeneralPaymentFieldsActive(!isBusiness);

      if (submitNote) {
        submitNote.textContent =
          "「掲載内容を確認」→ 確認画面 →「この内容で掲載する」で保存（確認前はDBに保存しません）";
      }

      if (!isBusiness) {
        delete form.dataset.postBusinessMode;
        syncGeneralTypeFromRadio();
        refreshBusinessFormLayout(form);
      } else {
        const cat =
          form.querySelector("[data-business-category-pick]:checked")?.value ||
          businessCategoryHidden?.value ||
          "";
        updateBusinessCategoryBadge(cat);
      }

      categoryExtras?.updateCategoryExtraSections();
      applyBusinessFormWhitelist(form);
    }

    function selectBusinessCategory(value) {
      const radio = form.querySelector(`[data-business-category-pick][value="${value}"]`);
      if (radio) radio.checked = true;
      if (businessCategoryHidden) businessCategoryHidden.value = value;
      updateBusinessCategoryBadge(value);
      categoryExtras?.updateCategoryExtraSections();
    }

    function setPostTypeCardActive(type) {
      form.querySelectorAll("[data-post-type]").forEach((card) => {
        const active = card.dataset.postType === type;
        card.classList.toggle("is-active", active);
        card.setAttribute("aria-pressed", active ? "true" : "false");
      });
    }

    function activateBusinessShop() {
      generalCategoryRadios.forEach((r) => {
        r.checked = false;
      });
      businessModeRadios.forEach((m) => {
        m.checked = m.value === "shop_store";
      });
      setBusinessMode("shop_store");
      setPostTypeCardActive("shop-store");
      if (typeSelect && typeSelect.value !== "shop-store") {
        typeSelect.value = "shop-store";
      }
      syncListingTypeValue(form, "shop-store");
      refreshBusinessFormLayout(form);
    }

    function activateBusinessService() {
      generalCategoryRadios.forEach((r) => {
        r.checked = false;
      });
      businessModeRadios.forEach((m) => {
        m.checked = m.value === "field_service";
      });
      setBusinessMode("field_service");
      setPostTypeCardActive("business-service");
      if (typeSelect && typeSelect.value !== "business-service") {
        typeSelect.value = "business-service";
      }
      syncListingTypeValue(form, "business-service");
      refreshBusinessFormLayout(form);
    }

    function setBusinessMode(mode) {
      const isShop = mode === "shop_store";
      if (businessCategoryBar) {
        businessCategoryBar.hidden = false;
        businessCategoryBar.setAttribute("aria-hidden", "false");
      }
      if (isShop) {
        // 店舗・販売：business_category は shop_store に固定し、業務カテゴリは未選択にする
        businessCategoryRadios.forEach((r) => {
          r.checked = false;
        });
        selectBusinessCategory("shop_store");
        if (form.querySelector("[data-business-type-value]")) {
          form.querySelector("[data-business-type-value]").value = "shop_store";
        }
        document.body.dataset.businessType = "shop_store";
      } else {
        // 業務サービス：business_type を field_service に固定、カテゴリは10種から選択
        if (businessCategoryHidden) businessCategoryHidden.value = "";
        updateBusinessCategoryBadge("");
        if (form.querySelector("[data-business-type-value]")) {
          form.querySelector("[data-business-type-value]").value = "field_service";
        }
        document.body.dataset.businessType = "field_service";
      }
      applyScope(POST_SCOPE.business);
    }

    // 初期状態: 子カテゴリは refreshBusinessFormLayout が制御

    generalCategoryRadios.forEach((radio) => {
      radio.addEventListener("change", () => {
        if (!radio.checked) return;
        businessCategoryRadios.forEach((r) => {
          r.checked = false;
        });
        if (businessCategoryHidden) businessCategoryHidden.value = "";
        setPostTypeCardActive("");
        applyScope(POST_SCOPE.general);
        refreshBusinessFormLayout(form);
      });
    });

    businessCategoryRadios.forEach((radio) => {
      radio.addEventListener("change", () => {
        if (!radio.checked) return;
        businessModeRadios.forEach((m) => {
          m.checked = m.value === "field_service";
        });
        generalCategoryRadios.forEach((r) => {
          r.checked = false;
        });
        selectBusinessCategory(radio.value);
        setPostTypeCardActive("business-service");
        applyScope(POST_SCOPE.business);
        refreshBusinessFormLayout(form);
      });
    });

    businessModeRadios.forEach((radio) => {
      radio.addEventListener("change", () => {
        if (!radio.checked) return;
        setBusinessMode(radio.value);
        if (radio.value === "shop_store") setPostTypeCardActive("shop-store");
        if (radio.value === "field_service") setPostTypeCardActive("business-service");
        refreshBusinessFormLayout(form);
      });
    });

    form.querySelectorAll("[data-post-type]").forEach((card) => {
      card.addEventListener("click", () => {
        const type = card.dataset.postType;
        if (type === "shop-store") activateBusinessShop();
        else if (type === "business-service") activateBusinessService();
      });
    });

    shopStoreCategoryRadios.forEach((radio) => {
      radio.addEventListener("change", () => {
        if (!radio.checked) return;
        generalCategoryRadios.forEach((r) => {
          r.checked = false;
        });
        businessModeRadios.forEach((m) => {
          m.checked = m.value === "shop_store";
        });
        setBusinessMode("shop_store");
        setPostTypeCardActive("shop-store");
        if (shopStoreCategoryInput) shopStoreCategoryInput.value = radio.value;
        categoryExtras?.updateCategoryExtraSections();
        refreshBusinessFormLayout(form);
      });
    });

    const params = new URLSearchParams(window.location.search);
    const scopeParam = params.get("scope");
    const bizCatParam = params.get("businessCategory");

    const normalizedBizParam = normalizeBizCat(bizCatParam);
    if (scopeParam === "business" && normalizedBizParam && bizCatLabel(normalizedBizParam)) {
      selectBusinessCategory(normalizedBizParam);
      applyScope(POST_SCOPE.business);
    }

    async function tryLoadBusinessEdit() {
      const editParams = new URLSearchParams(window.location.search);
      const editId = editParams.get("id") || editParams.get("edit");
      if (!editId || !window.TasuBusinessListings?.fetchBusinessListingById) return;
      const listing = await window.TasuBusinessListings.fetchBusinessListingById(editId);
      if (!listing) return;
      applyScope(POST_SCOPE.business);
      const bt = String(listing.business_type || "").trim();
      const cat = normalizeBizCat(listing.business_category || "");
      if (bt === "shop_store" || cat === "shop_store") {
        setBusinessMode("shop_store");
        if (cat) selectBusinessCategory(cat);
        // Restore shop_store FAQ JSON into hidden field (builder will hydrate)
        try {
          const faqs =
            listing?.form_data?.category_extra?.shop_store?.faqs ??
            listing?.category_extra?.shop_store?.faqs ??
            "";
          const faqField = form.querySelector("#bizExtraShopStoreFaqs");
          if (faqField && faqs) {
            faqField.value = typeof faqs === "string" ? faqs : JSON.stringify(faqs);
          }
        } catch (_) {}
        // Restore shop_store private blocks (審査用)
        try {
          const shop = listing?.form_data?.category_extra?.shop_store || listing?.category_extra?.shop_store || {};
          const applicant = shop.private_applicant || {};
          const bank = shop.private_bank || {};
          if (applicant && typeof applicant === "object") {
            form.querySelectorAll("[data-shop-private-applicant]").forEach((el) => {
              const key = el.getAttribute("data-shop-private-applicant");
              if (!key) return;
              if (applicant[key] == null) return;
              el.value = String(applicant[key]);
            });
          }
          if (bank && typeof bank === "object") {
            form.querySelectorAll("[data-shop-private-bank]").forEach((el) => {
              const key = el.getAttribute("data-shop-private-bank");
              if (!key) return;
              if (bank[key] == null) return;
              el.value = String(bank[key]);
            });
          }
        } catch (_) {}
      } else {
        businessModeRadios.forEach((m) => {
          if (m.value === "field_service") m.checked = true;
        });
        setBusinessMode("field_service");
        if (cat && bizCatLabel(cat)) selectBusinessCategory(cat);
        restoreFieldServiceFlow(form);
        requestAnimationFrame(() => {
          window.TasuBusinessServiceData?.applyBusinessServiceListingToForm?.(form, listing);
        });
      }
      form.dataset.editListingId = editId;
      const pageTitle = document.querySelector("h1");
      if (pageTitle) pageTitle.textContent = "掲載を編集";
      refreshBusinessFormLayout(form);
    }
    void tryLoadBusinessEdit();

    if (scopeParam === "business" && normalizedBizParam && bizCatLabel(normalizedBizParam)) {
      refreshBusinessFormLayout(form);
      return {
        applyScope,
        syncGeneralRadioFromType,
        activateBusinessShop,
        activateBusinessService,
        refreshBusinessFormLayout,
        restoreFieldServiceFlow,
      };
    }

    const initialType = getInitialType();
    if (initialType === "shop-store") {
      activateBusinessShop();
      return {
        applyScope,
        syncGeneralRadioFromType,
        activateBusinessShop,
        activateBusinessService,
        refreshBusinessFormLayout,
        restoreFieldServiceFlow,
      };
    }
    if (initialType === "business-service") {
      activateBusinessService();
      return {
        applyScope,
        syncGeneralRadioFromType,
        activateBusinessShop,
        activateBusinessService,
        refreshBusinessFormLayout,
        restoreFieldServiceFlow,
      };
    }
    syncGeneralRadioFromType(initialType);
    if (typeSelect) typeSelect.value = initialType;
    syncListingTypeValue(form, initialType);
    setGeneralOnlyVisible(true);
    applyScope(POST_SCOPE.general);
    refreshBusinessFormLayout(form);
    return {
      applyScope,
      syncGeneralRadioFromType,
      activateBusinessShop,
      activateBusinessService,
      refreshBusinessFormLayout,
      restoreFieldServiceFlow,
    };
  }

  // shop_store FAQ builder (max 5)
  const FAQ_STATE = new WeakMap();

  function escapeHtmlFaq(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function parseFaqs(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    try {
      const parsed = JSON.parse(String(raw));
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function syncFaqsToField(state) {
    const { listEl, fieldEl } = state;
    if (!listEl || !fieldEl) return;
    const rows = Array.from(listEl.querySelectorAll("[data-faq-row]"))
      .map((row) => {
        const q = row.querySelector("[data-faq-q]")?.value?.trim() ?? "";
        const a = row.querySelector("[data-faq-a]")?.value?.trim() ?? "";
        if (!q && !a) return null;
        return { question: q, answer: a };
      })
      .filter(Boolean);
    fieldEl.value = rows.length ? JSON.stringify(rows) : "";
  }

  function buildFaqRowHtml(index, data = {}) {
    const q = escapeHtmlFaq(String(data.question || "").trim());
    const a = escapeHtmlFaq(String(data.answer || "").trim());
    return `
      <div class="post-faq-item" data-faq-row>
        <div class="post-faq-item__head">
          <div class="post-faq-item__title">FAQ ${index + 1}</div>
          <button type="button" class="post-faq-remove" data-faq-remove>削除</button>
        </div>
        <label class="post-field post-field--full">
          <span>質問</span>
          <input type="text" data-faq-q maxlength="120" placeholder="例：買取だけでも依頼できますか？" value="${q}">
        </label>
        <label class="post-field post-field--full">
          <span>回答</span>
          <textarea rows="3" data-faq-a maxlength="600" placeholder="例：はい、買取のみでも対応可能です。工具1点からご相談いただけます。">${a}</textarea>
        </label>
      </div>`;
  }

  function initShopStoreFaqBuilder(form) {
    if (!form || FAQ_STATE.has(form)) return;
    const section = form.querySelector("[data-shop-faq-section]");
    const listEl = form.querySelector("[data-shop-faq-list]");
    const addBtn = form.querySelector("[data-shop-faq-add]");
    const fieldEl = form.querySelector("#bizExtraShopStoreFaqs");
    if (!section || !listEl || !addBtn || !fieldEl) return;

    const state = { section, listEl, addBtn, fieldEl };
    FAQ_STATE.set(form, state);

    function renumber() {
      listEl.querySelectorAll("[data-faq-row]").forEach((row, i) => {
        const title = row.querySelector(".post-faq-item__title");
        if (title) title.textContent = `FAQ ${i + 1}`;
      });
    }

    function addRow(data = {}) {
      const count = listEl.querySelectorAll("[data-faq-row]").length;
      if (count >= 5) return;
      const wrap = document.createElement("div");
      wrap.innerHTML = buildFaqRowHtml(count, data).trim();
      const row = wrap.firstElementChild;
      if (!row) return;
      row.querySelector("[data-faq-remove]")?.addEventListener("click", () => {
        row.remove();
        renumber();
        syncFaqsToField(state);
      });
      row.querySelectorAll("input, textarea").forEach((el) => {
        el.addEventListener("input", () => syncFaqsToField(state));
      });
      listEl.appendChild(row);
      renumber();
      syncFaqsToField(state);
    }

    addBtn.addEventListener("click", () => addRow());

    // Restore from hidden JSON (edit)
    const initial = parseFaqs(fieldEl.value);
    if (initial.length) {
      initial.slice(0, 5).forEach((it) => addRow(it));
    }
  }

  function initTypeSwitch(form, scopeHelpers) {
    const typeSelect = form.querySelector("[data-listing-type]");
    const panels = form.querySelectorAll("[data-form-type]");
    const typeBadge = form.querySelector("[data-type-badge]");
    const optionsBlock = form.querySelector("[data-options-block]");
    const optionsHeading = form.querySelector("[data-options-heading]");
    const optionsDesc = form.querySelector("[data-options-desc-text]");
    const optionsSection = form.querySelector("[data-options-section]");
    const optionsJson = form.querySelector("[data-options-json]");
    const optionsJsonPreview = form.querySelector("#optionsJsonPreview");
    const tagsLabel = form.querySelector("[data-tags-label]");
    const tagsInput = form.querySelector("[data-tags-input]");
    const tagsHint = form.querySelector("[data-tags-hint]");
    const categoryBlocks = form.querySelectorAll("[data-category-block]");

    if (!typeSelect) {
      return;
    }

    const currentType = getInitialType();
    if (!isBusinessScopeListingType(currentType)) {
      typeSelect.value = currentType;
    }

    function updateCategoryFields(type) {
      categoryBlocks.forEach((block) => {
        const blockType = block.dataset.categoryBlock;
        const active = blockType === type;
        block.querySelectorAll("select, input, textarea").forEach((field) => {
          field.disabled = !active;
          if (field.tagName === "SELECT" && field.dataset.wasRequired === "true") {
            field.required = active;
          }
        });
      });
    }

    function updateDescriptionFields(type) {
      const isProduct = type === "product";
      const commonDescWrap = form.querySelector("[data-common-description-field]");
      const listingDesc = form.querySelector("#description");
      const productDesc = form.querySelector("#productDescription");

      if (commonDescWrap) {
        commonDescWrap.hidden = isProduct;
      }
      if (listingDesc) {
        listingDesc.required = !isProduct;
        if (isProduct) {
          listingDesc.removeAttribute("required");
        } else {
          listingDesc.setAttribute("required", "");
        }
      }
      if (productDesc) {
        productDesc.required = isProduct;
        if (isProduct) {
          productDesc.setAttribute("required", "");
        } else {
          productDesc.removeAttribute("required");
        }
      }
    }

    function updateFormType(type) {
      if (isBusinessScopeListingType(type)) return;
      panels.forEach((panel) => {
        const match = panel.dataset.formType === type;
        panel.hidden = !match;
      });

      if (typeBadge) {
        typeBadge.textContent = TYPE_LABELS[type] ?? type;
        typeBadge.dataset.type = type;
      }

      if (optionsHeading) {
        optionsHeading.textContent = OPTIONS_HEADINGS[type] ?? "追加オプション";
      }

      if (optionsDesc) {
        optionsDesc.textContent = OPTIONS_DESC[type] ?? "";
      }

      const showOptions = type === "product" || type === "skill" || type === "worker";
      if (optionsBlock) {
        optionsBlock.hidden = !showOptions;
      }
      if (optionsSection) {
        optionsSection.hidden = !showOptions;
      }

      if (tagsLabel) {
        tagsLabel.textContent = TAG_LABELS[type] ?? "タグ";
      }
      if (tagsInput) {
        tagsInput.placeholder = TAG_PLACEHOLDERS[type] ?? "";
      }
      if (tagsHint) {
        tagsHint.textContent = TAG_HINTS[type] ?? TAG_HINTS.product;
      }

      if (type === "job") {
        if (optionsJson) {
          optionsJson.value = "[]";
        }
        if (optionsJsonPreview) {
          optionsJsonPreview.textContent = "[]";
        }
      }

      updateCategoryFields(type);
      updateDescriptionFields(type);
      document.body.dataset.postFormType = type;
    }

    typeSelect.addEventListener("change", () => {
      if (form.dataset.postFormUpdating === "1") return;
      form.dataset.postFormUpdating = "1";
      try {
      const type = typeSelect.value;
      if (type === "shop-store") {
        scopeHelpers?.activateBusinessShop?.();
        return;
      }
      if (type === "business-service") {
        scopeHelpers?.activateBusinessService?.();
        return;
      }
      scopeHelpers?.applyScope?.(POST_SCOPE.general);
      const radio = form.querySelector(`[data-general-category][value="${type}"]`);
      if (radio) radio.checked = true;
      syncListingTypeValue(form, type);
      updateFormType(type);
      refreshBusinessFormLayout(form);
      } finally {
        delete form.dataset.postFormUpdating;
      }
    });

    form.__updateListingFormType = updateFormType;

    if (!isBusinessScopeListingType(currentType)) {
      updateFormType(currentType);
    }
  }

  function initProductSubcategories(form) {
    const categorySelect = form.querySelector("[data-product-category]");
    const subCategorySelect = form.querySelector("[data-product-subcategory]");

    if (!categorySelect || !subCategorySelect) {
      return;
    }

    subCategorySelect.dataset.wasRequired = "true";

    function fillSubcategories(category) {
      const subs = PRODUCT_SUBCATEGORIES[category] ?? [];
      subCategorySelect.innerHTML = "";

      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = "選択してください";
      subCategorySelect.appendChild(placeholder);

      subs.forEach((label) => {
        const option = document.createElement("option");
        option.value = label;
        option.textContent = label;
        subCategorySelect.appendChild(option);
      });

      subCategorySelect.required = subs.length > 0;
      subCategorySelect.disabled = subs.length === 0;
    }

    categorySelect.addEventListener("change", () => {
      fillSubcategories(categorySelect.value);
    });

    fillSubcategories(categorySelect.value);
  }

  function initTagPreview(form) {
    const tagInput = form.querySelector("[data-tags-input]");
    const tagPreview = form.querySelector("[data-tags-preview]");
    if (!tagInput || !tagPreview) {
      return;
    }

    function renderTags() {
      const raw = tagInput.value.trim();
      const tags = raw
        .split(/[,、\s]+/)
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 12);

      tagPreview.innerHTML = "";
      if (tags.length === 0) {
        tagPreview.hidden = true;
        return;
      }

      tagPreview.hidden = false;
      tags.forEach((tag) => {
        const chip = document.createElement("span");
        chip.className = "post-tag-chip";
        chip.textContent = tag;
        tagPreview.appendChild(chip);
      });
    }

    tagInput.addEventListener("input", renderTags);
    renderTags();
  }

  function initImageHints() {
    document.querySelectorAll("[data-file-label]").forEach((label) => {
      if (
        label.closest("[data-gallery-upload]") ||
        label.closest("[data-main-upload]")
      ) {
        return;
      }
      const input = label.querySelector('input[type="file"]');
      const nameEl = label.querySelector("[data-file-name]");
      if (!input || !nameEl) {
        return;
      }

      const defaultText =
        nameEl.dataset.fileDefault || nameEl.textContent || "ファイル未選択";

      input.addEventListener("change", () => {
        const files = input.files;
        if (!files?.length) {
          nameEl.textContent = defaultText;
          return;
        }

        if (input.multiple) {
          const names = Array.from(files)
            .map((f) => f.name)
            .join(", ");
          const preview =
            names.length > 72 ? `${names.slice(0, 72)}…` : names;
          nameEl.textContent = `${files.length}件: ${preview}`;
          return;
        }

        nameEl.textContent = files[0].name;
      });
    });
  }

  function initJsonPreview(form) {
    const preview = form.querySelector("#optionsJsonPreview");
    const hidden = form.querySelector("[data-options-json]");

    function syncPreview() {
      if (preview && hidden) {
        try {
          const parsed = JSON.parse(hidden.value || "[]");
          preview.textContent = JSON.stringify(parsed, null, 2);
        } catch {
          preview.textContent = hidden.value || "[]";
        }
      }
    }

    form.addEventListener("input", syncPreview);
    syncPreview();
  }

  const GENERAL_INVOICE_LABELS = {
    yes: "請求書対応",
    negotiable: "請求書要相談",
    no: "",
  };

  function collectGeneralPayment(form) {
    const invoice = form.querySelector("[data-invoice-support]")?.value ?? "no";
    const onsite = form.querySelector("[data-onsite-payment]")?.checked ?? false;

    return {
      payment_url: form.querySelector("#genPaymentUrl")?.value?.trim() ?? "",
      bank_transfer_info: form.querySelector("#genBankTransferInfo")?.value?.trim() ?? "",
      onsite_payment: onsite,
      invoice_support: invoice,
      badges: {
        onsite: onsite,
        invoice: invoice === "yes" || invoice === "negotiable",
        invoiceLabel: GENERAL_INVOICE_LABELS[invoice] ?? "",
      },
    };
  }

  function initGeneralPaymentPreview(form) {
    const preview = form.querySelector("[data-general-payment-badges]");
    const onsiteInput = form.querySelector("[data-onsite-payment]");
    const invoiceSelect = form.querySelector("[data-invoice-support]");
    if (!preview) return;

    function render() {
      const payment = collectGeneralPayment(form);
      preview.innerHTML = "";

      if (payment.onsite_payment) {
        const chip = document.createElement("span");
        chip.className = "post-general-payment__badge post-general-payment__badge--onsite";
        chip.textContent = "現地払い対応";
        preview.appendChild(chip);
      }

      if (payment.badges.invoiceLabel) {
        const chip = document.createElement("span");
        chip.className = "post-general-payment__badge post-general-payment__badge--invoice";
        chip.textContent = payment.badges.invoiceLabel;
        preview.appendChild(chip);
      }

      preview.hidden = preview.childElementCount === 0;
    }

    onsiteInput?.addEventListener("change", render);
    invoiceSelect?.addEventListener("change", render);
    render();
  }

  function collectCheckedTagLabels(form, inputSelector) {
    const labels = [];
    form.querySelectorAll(inputSelector).forEach((input) => {
      if (!input.checked) return;
      const text = input.closest("label")?.textContent?.replace(/\s+/g, " ").trim();
      if (text) labels.push(text);
    });
    return labels;
  }

  function collectAvailableTags(form, listingType) {
    if (listingType === "skill") {
      return collectCheckedTagLabels(form, 'input[name="skillTags"]');
    }
    if (listingType === "worker") {
      return collectCheckedTagLabels(form, ".worker-tags input[type=checkbox]");
    }
    if (listingType === "job") {
      const tags = [];
      if (form.querySelector('input[name="urgent"]:checked')) {
        tags.push("急募");
      }
      return tags;
    }
    return [];
  }

  function collectOptionTags(options) {
    if (!Array.isArray(options)) return [];
    return options
      .map((item) => {
        if (!item || typeof item !== "object") return "";
        return String(item.name || item.title || item.label || "").trim();
      })
      .filter(Boolean);
  }

  function getSelectDisplayLabel(form, selector) {
    const el = form.querySelector(selector);
    if (!el) return "";
    if (el.tagName === "SELECT") {
      const opt = el.options[el.selectedIndex];
      return String(opt?.textContent || opt?.label || el.value || "").trim();
    }
    return String(el.value || "").trim();
  }

  /** product: listings 直下カラム用 */
  function collectProductListingFields(form) {
    const productName = form.querySelector("#productName")?.value?.trim() ?? "";
    const productDescription = form.querySelector("#productDescription")?.value?.trim() ?? "";
    const category = form.querySelector("[data-product-category]")?.value ?? "";
    const subcategory = form.querySelector("[data-product-subcategory]")?.value ?? "";
    const condition = form.querySelector("#productCondition")?.value ?? "";
    const delivery_method = getSelectDisplayLabel(form, "#productShipping");
    const stockRaw = form.querySelector("#productStock")?.value;
    const stock_count =
      stockRaw === "" || stockRaw == null ? "" : String(stockRaw).trim();
    const delivery_days = form.querySelector("#productDeliveryDays")?.value?.trim() ?? "";
    const spec = form.querySelector("#productSpec")?.value?.trim() ?? "";
    const priceRaw = form.querySelector("#productPrice")?.value;
    const priceNum = Number(priceRaw);
    const price_amount =
      Number.isFinite(priceNum) && priceNum >= 0 ? priceNum : null;

    return {
      product_name: productName,
      product_description: productDescription,
      description: productDescription,
      category,
      subcategory,
      condition,
      delivery_method,
      stock_count,
      delivery_days,
      spec,
      price_amount,
    };
  }

  /** product: form_data は決済など補助のみ（主要フィールドは listings 直下） */
  function buildProductAuxiliaryFormData(payment) {
    return { payment };
  }

  function getTrimmedFormDataValue(fd, name) {
    const value = fd.get(name);
    if (value == null) return "";
    return String(value).trim();
  }

  /** disabled フィールドも FormData に含める（求人パネル内のみ一時的に有効化） */
  function buildJobFormData(form) {
    const restoreDisabled = [];
    const jobPanel = form.querySelector('[data-form-type="job"]');
    jobPanel?.querySelectorAll("input, select, textarea").forEach((el) => {
      if (el.disabled) {
        restoreDisabled.push(el);
        el.disabled = false;
      }
    });

    const fd = new FormData(form);

    restoreDisabled.forEach((el) => {
      el.disabled = true;
    });

    return fd;
  }

  function parseJobSalaryFromText(salaryRaw) {
    const text = String(salaryRaw || "").trim();
    let salary_type = "";
    if (/月|monthly/i.test(text)) salary_type = "月給";
    else if (/時|hourly/i.test(text)) salary_type = "時給";
    else if (/年|yearly/i.test(text)) salary_type = "年俸";
    else if (/日|daily/i.test(text)) salary_type = "日給";
    else if (/案件|プロジェクト|単価/i.test(text)) salary_type = "プロジェクト";

    const manMatch = text.replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*万/);
    let salary_amount = null;
    if (manMatch) {
      salary_amount = Math.round(Number(manMatch[1]) * 10000);
    } else {
      const digits = text.replace(/[^\d]/g, "");
      const n = Number(digits);
      if (Number.isFinite(n) && n > 0) salary_amount = n;
    }

    return { salary_text: text, salary_type, salary_amount };
  }

  /** FormData から listings 直下の求人カラムを取得 */
  function readJobListingColumnsFromFormData(fd) {
    const salaryRaw = getTrimmedFormDataValue(fd, "salary_amount");
    const { salary_text, salary_type, salary_amount } = parseJobSalaryFromText(salaryRaw);

    const recruitmentRaw = fd.get("recruitment_count");
    let recruitment_count = null;
    const recruitmentNum = Number(recruitmentRaw);
    if (Number.isFinite(recruitmentNum) && recruitmentNum >= 0) {
      recruitment_count = Math.floor(recruitmentNum);
    }

    const deadlineRaw = getTrimmedFormDataValue(fd, "application_deadline");

    return {
      job_location: getTrimmedFormDataValue(fd, "job_location"),
      salary_amount: salary_amount ?? (salaryRaw || null),
      salary_type: salary_type || null,
      salary_text,
      work_style: getTrimmedFormDataValue(fd, "work_style"),
      employment_type: getTrimmedFormDataValue(fd, "employment_type"),
      working_hours: getTrimmedFormDataValue(fd, "working_hours"),
      required_skills: getTrimmedFormDataValue(fd, "required_skills"),
      welcome_skills: getTrimmedFormDataValue(fd, "welcome_skills"),
      job_benefits: getTrimmedFormDataValue(fd, "job_benefits"),
      recruitment_count,
      application_deadline: deadlineRaw || null,
      application_method: getTrimmedFormDataValue(fd, "application_method"),
      contract_terms: getTrimmedFormDataValue(fd, "contract_terms"),
      price_amount: salary_amount,
    };
  }

  function mergeJobListingFieldsFromFormData(payload, form) {
    const fd = buildJobFormData(form);
    const columns = readJobListingColumnsFromFormData(fd);
    return { ...payload, ...columns };
  }

  function splitJobRequirementsText(text) {
    const raw = String(text || "").trim();
    if (!raw) return { required: "", welcome: "" };
    const parts = raw.split(/(?:歓迎|尚可|あれば)/i);
    if (parts.length > 1) {
      return {
        required: parts[0].replace(/[・\-–—]\s*$/, "").trim(),
        welcome: parts.slice(1).join(" ").trim(),
      };
    }
    return { required: raw, welcome: "" };
  }

  function buildJobApplicationMethod(fields) {
    const parts = [];
    if (fields.contact_email) parts.push(`メール: ${fields.contact_email}`);
    if (fields.recruiter_name) parts.push(`担当: ${fields.recruiter_name}`);
    if (fields.phone) parts.push(`電話: ${fields.phone}`);
    return parts.join(" / ");
  }

  /** job: listings 直下カラム用（FormData 優先） */
  function collectJobListingFields(form) {
    const fd = buildJobFormData(form);
    const columns = readJobListingColumnsFromFormData(fd);

    const jobCategory =
      getTrimmedFormDataValue(fd, "jobCategory") ||
      form.querySelector("[data-job-category]")?.value?.trim() ||
      "";
    const jobTitle = getTrimmedFormDataValue(fd, "jobTitle");
    const listingTitle = form.querySelector("#title")?.value?.trim() ?? "";
    const listingDescription = form.querySelector("#description")?.value?.trim() ?? "";
    const workContent =
      getTrimmedFormDataValue(fd, "job_work_content") ||
      getTrimmedFormDataValue(fd, "workContent") ||
      "";

    const welcomeFromSplit = splitJobRequirementsText(columns.required_skills).welcome;
    const welcome_skills = columns.welcome_skills || welcomeFromSplit;

    const recruiter_name = form.querySelector("#companyContact")?.value?.trim() ?? "";
    const contact_email = form.querySelector("#companyEmail")?.value?.trim() ?? "";
    const phone = form.querySelector("#companyPhone")?.value?.trim() ?? "";
    const company_name = form.querySelector("#companyName")?.value?.trim() ?? "";
    const companyAbout = form.querySelector("#companyAbout")?.value?.trim() ?? "";

    const contactFields = { contact_email, recruiter_name, phone };
    const application_method =
      columns.application_method || buildJobApplicationMethod(contactFields);

    return {
      title: jobTitle || listingTitle,
      description: workContent || listingDescription,
      category: jobCategory || null,
      subcategory: jobCategory || null,
      ...columns,
      welcome_skills,
      application_method,
      company_name,
      recruiter_name,
      contact_email,
      phone,
      company_description: companyAbout,
    };
  }

  /** job: listings 直下に必ず載せるカラム（form_data のみにしない） */
  const JOB_LISTING_SAVE_KEYS = [
    "job_location",
    "salary_amount",
    "work_style",
    "employment_type",
    "working_hours",
    "required_skills",
    "welcome_skills",
    "job_benefits",
    "recruitment_count",
    "application_deadline",
    "application_method",
    "contract_terms",
  ];

  /** job: form_data は決済・補助テキストのみ */
  function buildJobAuxiliaryFormData(jobFields, payment) {
    return {
      payment,
      salary: jobFields?.salary_text || "",
      salary_text: jobFields?.salary_text || "",
    };
  }

  /** 求人詳細カラムを payload 直下に強制マージ（FormData 再取得・画像付与後対策） */
  function assignJobListingSaveFields(payload, form) {
    if (!payload || !form) return payload;
    const merged = mergeJobListingFieldsFromFormData(payload, form);
    const jobFields = collectJobListingFields(form);

    merged.listing_type = "job";
    merged.title = jobFields.title ?? merged.title;
    merged.description = jobFields.description ?? merged.description;
    merged.category = jobFields.category ?? merged.category;
    merged.subcategory = jobFields.subcategory ?? merged.subcategory;
    merged.welcome_skills = jobFields.welcome_skills ?? merged.welcome_skills;
    merged.application_method = jobFields.application_method ?? merged.application_method;
    merged.company_name = jobFields.company_name ?? merged.company_name;
    merged.recruiter_name = jobFields.recruiter_name ?? merged.recruiter_name;
    merged.contact_email = jobFields.contact_email ?? merged.contact_email;
    merged.phone = jobFields.phone ?? merged.phone;
    merged.company_description = jobFields.company_description ?? merged.company_description;
    merged.salary_type = jobFields.salary_type ?? merged.salary_type ?? null;
    merged.salary_text = jobFields.salary_text ?? "";
    merged.form_data = {
      ...(merged.form_data || {}),
      salary: jobFields.salary_text || "",
      salary_text: jobFields.salary_text || "",
    };

    return merged;
  }

  /** job: listings 直下保存用の完全 payload（画像は attachListingImagesToPayload で付与） */
  function buildJobListingPayload(form) {
    const payment = collectGeneralPayment(form);
    const publishStatus =
      form.querySelector('input[name="publishStatus"]:checked')?.value ?? "public";
    const publishAt = form.querySelector("#publishAt")?.value?.trim() || null;
    const availableTags = collectAvailableTags(form, "job");
    const textTags = form.querySelector("[data-tags-input]")?.value?.trim() ?? "";
    const jobFields = collectJobListingFields(form);

    const payload = {
      user_id: getUserId(),
      listing_type: "job",
      title: jobFields.title,
      description: jobFields.description,
      category: jobFields.category,
      subcategory: jobFields.subcategory,
      tags: [textTags, ...availableTags].filter(Boolean).join(", "),
      available_tags: availableTags,
      publish_status: publishStatus,
      publish_at: publishAt,
      price_amount: jobFields.price_amount,
      salary_amount: jobFields.salary_amount ?? jobFields.salary_text ?? null,
      salary_type: jobFields.salary_type,
      salary_text: jobFields.salary_text,
      job_location: jobFields.job_location,
      work_style: jobFields.work_style,
      employment_type: jobFields.employment_type,
      working_hours: jobFields.working_hours,
      required_skills: jobFields.required_skills,
      welcome_skills: jobFields.welcome_skills,
      job_benefits: jobFields.job_benefits,
      application_method: jobFields.application_method,
      application_deadline: jobFields.application_deadline || null,
      recruitment_count: jobFields.recruitment_count ?? null,
      contract_terms: jobFields.contract_terms,
      company_name: jobFields.company_name,
      recruiter_name: jobFields.recruiter_name,
      contact_email: jobFields.contact_email,
      phone: jobFields.phone,
      company_description: jobFields.company_description,
      payment_url: payment.payment_url,
      bank_transfer_info: payment.bank_transfer_info,
      onsite_payment: payment.onsite_payment,
      invoice_support: payment.invoice_support,
      form_data: buildJobAuxiliaryFormData(jobFields, payment),
      image_url: null,
      thumbnail_url: null,
      gallery_urls: [],
      images: [],
    };

    return assignJobListingSaveFields(payload, form);
  }

  function syncWorkerAreaHidden(form) {
    const hidden = form.querySelector('[name="worker_area"]');
    if (!hidden) return;
    const pref = form.querySelector("[name=workerPrefecture]")?.value?.trim() ?? "";
    const city = form.querySelector("[name=workerCity]")?.value?.trim() ?? "";
    const travel = form.querySelector("[name=workerTravel]")?.value?.trim() ?? "";
    const parts = [];
    if (pref) parts.push(pref);
    if (city) parts.push(city);
    let text = parts.join(" ");
    if (travel) {
      text = text ? `${text}（${travel}）` : travel;
    }
    hidden.value = text;
  }

  /** disabled フィールドも FormData に含める（ワーカーパネル内のみ一時的に有効化） */
  function buildWorkerFormData(form) {
    syncWorkerAreaHidden(form);
    const restoreDisabled = [];
    const workerPanel = form.querySelector('[data-form-type="worker"]');
    workerPanel?.querySelectorAll("input, select, textarea").forEach((el) => {
      if (el.disabled) {
        restoreDisabled.push(el);
        el.disabled = false;
      }
    });

    const fd = new FormData(form);

    restoreDisabled.forEach((el) => {
      el.disabled = true;
    });

    return fd;
  }

  function collectWorkerSupportTagsFromForm(form) {
    return collectCheckedTagLabels(form, ".worker-tags input[type=checkbox]").join(
      ", "
    );
  }

  function readWorkerListingColumnsFromFormData(fd, form) {
    const payment = form ? collectGeneralPayment(form) : {};
    const supportTags =
      (form ? collectWorkerSupportTagsFromForm(form) : "") ||
      getTrimmedFormDataValue(fd, "worker_support_tags");

    let certifications = getTrimmedFormDataValue(fd, "worker_certifications");
    const verified = form?.querySelector('input[name="verified"]')?.checked;
    if (verified) {
      certifications = certifications
        ? `${certifications}\n本人確認済み`
        : "本人確認済み";
    }

    const priceAmountRaw = getTrimmedFormDataValue(fd, "worker_price_amount");
    let worker_price_amount = null;
    if (window.TasuWorkerListingFields?.parseWorkerPriceAmount) {
      worker_price_amount =
        window.TasuWorkerListingFields.parseWorkerPriceAmount(priceAmountRaw);
    } else {
      const n = Number(String(priceAmountRaw).replace(/[^\d]/g, ""));
      worker_price_amount = Number.isFinite(n) && n > 0 ? n : null;
    }

    return {
      worker_profile: getTrimmedFormDataValue(fd, "worker_profile"),
      worker_services: getTrimmedFormDataValue(fd, "worker_services"),
      worker_area: getTrimmedFormDataValue(fd, "worker_area"),
      worker_availability: getTrimmedFormDataValue(fd, "worker_availability"),
      worker_experience: getTrimmedFormDataValue(fd, "worker_experience"),
      worker_certifications: certifications,
      worker_display_name: getTrimmedFormDataValue(fd, "worker_display_name"),
      worker_age_group: getTrimmedFormDataValue(fd, "worker_age_group"),
      worker_notes: getTrimmedFormDataValue(fd, "worker_notes"),
      worker_price_type: getTrimmedFormDataValue(fd, "worker_price_type"),
      worker_price_amount,
      worker_support_tags: supportTags,
      worker_invoice_support: payment.invoice_support || "",
      worker_payment_url: payment.payment_url || "",
      worker_bank_info: payment.bank_transfer_info || "",
    };
  }

  function collectWorkerListingFields(form) {
    const fd = buildWorkerFormData(form);
    const columns = readWorkerListingColumnsFromFormData(fd, form);
    const workerCategory =
      getTrimmedFormDataValue(fd, "workerCategory") ||
      form.querySelector("[data-worker-category]")?.value?.trim() ||
      "";
    const serviceName =
      form.querySelector("[data-worker-service-name]")?.value?.trim() ||
      form.querySelector("#workerServiceName")?.value?.trim() ||
      "";
    const listingTitle = form.querySelector("#title")?.value?.trim() ?? "";
    const listingDescription =
      form.querySelector("#description")?.value?.trim() ?? "";

    return {
      title: serviceName || listingTitle,
      description: listingDescription || columns.worker_services,
      category: workerCategory || null,
      subcategory: workerCategory || null,
      ...columns,
    };
  }

  function buildWorkerAuxiliaryFormData(workerFields, payment) {
    return {
      payment,
      workerCategory: workerFields?.category || "",
    };
  }

  function assignWorkerListingSaveFields(payload, form) {
    if (!payload || !form) return payload;
    const workerFields = collectWorkerListingFields(form);
    const payment = collectGeneralPayment(form);
    const merged = { ...payload, ...workerFields };

    merged.listing_type = "worker";
    merged.payment_url = payment.payment_url || merged.worker_payment_url;
    merged.bank_transfer_info =
      payment.bank_transfer_info || merged.worker_bank_info;
    merged.invoice_support =
      payment.invoice_support || merged.worker_invoice_support;
    merged.price_amount = workerFields.worker_price_amount ?? merged.price_amount;
    merged.form_data = {
      ...(merged.form_data || {}),
      ...buildWorkerAuxiliaryFormData(workerFields, payment),
    };

    return merged;
  }

  /** worker: listings 直下保存用の完全 payload */
  function buildWorkerListingPayload(form) {
    const payment = collectGeneralPayment(form);
    const publishStatus =
      form.querySelector('input[name="publishStatus"]:checked')?.value ?? "public";
    const publishAt = form.querySelector("#publishAt")?.value?.trim() || null;
    const availableTags = collectAvailableTags(form, "worker");
    const textTags = form.querySelector("[data-tags-input]")?.value?.trim() ?? "";
    const workerFields = collectWorkerListingFields(form);

    const payload = {
      user_id: getUserId(),
      listing_type: "worker",
      title: workerFields.title,
      description: workerFields.description,
      category: workerFields.category,
      subcategory: workerFields.subcategory,
      tags: [textTags, ...availableTags].filter(Boolean).join(", "),
      available_tags: availableTags,
      publish_status: publishStatus,
      publish_at: publishAt,
      price_amount: workerFields.worker_price_amount,
      payment_url: payment.payment_url,
      bank_transfer_info: payment.bank_transfer_info,
      onsite_payment: payment.onsite_payment,
      invoice_support: payment.invoice_support,
      worker_profile: workerFields.worker_profile,
      worker_services: workerFields.worker_services,
      worker_area: workerFields.worker_area,
      worker_availability: workerFields.worker_availability,
      worker_experience: workerFields.worker_experience,
      worker_certifications: workerFields.worker_certifications,
      worker_display_name: workerFields.worker_display_name,
      worker_age_group: workerFields.worker_age_group,
      worker_notes: workerFields.worker_notes,
      worker_price_type: workerFields.worker_price_type,
      worker_price_amount: workerFields.worker_price_amount,
      worker_support_tags: workerFields.worker_support_tags,
      worker_invoice_support: workerFields.worker_invoice_support,
      worker_payment_url: workerFields.worker_payment_url,
      worker_bank_info: workerFields.worker_bank_info,
      form_data: buildWorkerAuxiliaryFormData(workerFields, payment),
      image_url: null,
      thumbnail_url: null,
      gallery_urls: [],
      images: [],
    };

    return assignWorkerListingSaveFields(payload, form);
  }

  function collectGeneralListingPayload(form, listingType) {
    const hidden = form.querySelector("[data-options-json]");
    const payment = collectGeneralPayment(form);
    const publishStatus =
      form.querySelector('input[name="publishStatus"]:checked')?.value ?? "public";
    const publishAt = form.querySelector("#publishAt")?.value?.trim() || null;
    const options = listingType === "job" ? [] : JSON.parse(hidden?.value || "[]");
    const availableTags = collectAvailableTags(form, listingType);
    const optionTags = collectOptionTags(options);
    const textTags = form.querySelector("[data-tags-input]")?.value?.trim() ?? "";

    const productFields =
      listingType === "product" ? collectProductListingFields(form) : null;

    if (productFields) {
      const listingTitle = form.querySelector("#title")?.value?.trim() ?? "";
      const productDescription = productFields.product_description || "";

      return {
        user_id: getUserId(),
        listing_type: "product",
        title: productFields.product_name || listingTitle,
        description: productDescription,
        product_description: productDescription,
        category: productFields.category || null,
        subcategory: productFields.subcategory || null,
        condition: productFields.condition || null,
        delivery_method: productFields.delivery_method || null,
        stock_count: productFields.stock_count || null,
        delivery_days: productFields.delivery_days || null,
        spec: productFields.spec || null,
        available_tags: availableTags,
        options,
        tags: [textTags, ...availableTags].filter(Boolean).join(", "),
        publish_status: publishStatus,
        publish_at: publishAt,
        price_amount: productFields.price_amount,
        payment_url: payment.payment_url,
        bank_transfer_info: payment.bank_transfer_info,
        onsite_payment: payment.onsite_payment,
        invoice_support: payment.invoice_support,
        form_data: buildProductAuxiliaryFormData(payment),
      };
    }

    if (listingType === "job") {
      return buildJobListingPayload(form);
    }

    if (listingType === "worker") {
      return buildWorkerListingPayload(form);
    }

    const formData = {
      tags: textTags,
      available_tags: availableTags,
      option_tags: optionTags,
      badges: [...availableTags],
      options,
      payment,
      category:
        listingType === "skill"
          ? { skillCategory: form.querySelector("[data-skill-category]")?.value ?? "" }
          : listingType === "worker"
            ? { workerCategory: form.querySelector("[data-worker-category]")?.value ?? "" }
            : { jobCategory: form.querySelector("[data-job-category]")?.value ?? "" },
    };
    if (listingType === "skill") {
      formData.basePrice = form.querySelector("#skillBasePrice")?.value ?? "";
      const serviceName = form.querySelector("#serviceName")?.value?.trim() ?? "";
      formData.serviceName = serviceName;
      formData.service_name = serviceName;
      formData.deliveryTime = form.querySelector("#skillDelivery")?.value?.trim() ?? "";
      formData.scope = form.querySelector("#skillScope")?.value?.trim() ?? "";
      formData.achievements = form.querySelector("#skillAchievements")?.value?.trim() ?? "";
      formData.portfolioUrl = form.querySelector("#portfolioUrl")?.value?.trim() ?? "";
    }
    const listingTitle = form.querySelector("#title")?.value?.trim() ?? "";
    const listingDescription =
      form.querySelector("#description")?.value?.trim() ?? "";

    return {
      user_id: getUserId(),
      listing_type: listingType,
      title: listingTitle,
      description: listingDescription,
      tags: [textTags, ...availableTags, ...optionTags].filter(Boolean).join(", "),
      publish_status: publishStatus,
      publish_at: publishAt,
      payment_url: payment.payment_url,
      bank_transfer_info: payment.bank_transfer_info,
      onsite_payment: payment.onsite_payment,
      invoice_support: payment.invoice_support,
      form_data: formData,
    };
  }

  /** 投稿完了後の詳細ページ URL（現在の document URL 基準・file 絶対パスは生成しない） */
  function buildPostDetailRedirectUrl(detailPath, listingId) {
    const id = String(listingId || "").trim();
    const path = String(detailPath || "").trim();
    if (!id || !path) return null;
    const detailUrl = new URL(path, window.location.href);
    detailUrl.searchParams.set("id", id);
    return detailUrl;
  }

  function resolveBusinessDetailPath(form) {
    const bt =
      form?.querySelector("[data-business-type-value]")?.value?.trim() ||
      document.body.dataset.businessType ||
      "";
    const category = getSelectedBusinessCategory(form);
    const businessParent =
      bt === "shop_store" || isShopStoreFormContext(form, category) ? "shop_store" : "field_service";
    return businessParent === "shop_store"
      ? "./detail-shop.html"
      : (typeof globalThis !== "undefined" && globalThis.TasuListingRouteResolver?.buildDetailUrl?.("business_service")) ||
        "./detail-business-service.html?id=demo-business-service-001";
  }

  function getDetailUrlForSaved(scope, listingType, id, form) {
    const listingId = String(id || "").trim();
    if (!listingId) return null;

    let detailPath;
    if (scope === POST_SCOPE.business) {
      detailPath = resolveBusinessDetailPath(form);
    } else {
      const type = listingType || "skill";
      const map = {
        product: "./detail-product.html",
        skill: "./detail-skill.html",
        job: "./detail-job.html",
        worker: "./detail-worker.html",
      };
      detailPath = map[type] || "./detail-skill.html";
    }

    return buildPostDetailRedirectUrl(detailPath, listingId);
  }

  function navigateToPostDetail(detailUrl) {
    if (!detailUrl) return;
    console.log("[post current href]", window.location.href);
    console.log("[post redirect url]", detailUrl.toString());
    window.location.assign(detailUrl.toString());
  }

  function collectBusinessPayload(form) {
    const rawCategory =
      form.querySelector("[data-business-category-pick]:checked")?.value ||
      form.querySelector("[data-business-category-hidden]")?.value ||
      "";
    const category = normalizeBizCat(rawCategory);
    const shopStoreSubcategory =
      form.querySelector("[data-shop-store-category-pick]:checked")?.value?.trim() ?? "";
    const businessSubcategory =
      form.querySelector("[data-business-subcategory]")?.value?.trim() ?? "";
    const status = form.querySelector('input[name="bizStatus"]:checked')?.value || "available";
    const categoryExtra = collectBusinessCategoryExtra(form, category);
    const isShop = isShopStoreFormContext(form, category);
    const isFs = isFieldServiceFormContext(form, category);
    const shopBlock = categoryExtra?.shop_store || {};
    const fsBlock = categoryExtra?.field_service || {};
    const jobConditions = isShop || isFs ? {} : collectBusinessJobConditions(form);
    const taxiColumns = isTransportBiz(category) ? collectBusinessTaxiColumns(form) : {};
    const isRepair = isRepairBiz(category);
    const usesWorkCases = usesWorkCasesProfile(category);
    const workCases = usesWorkCases ? collectWorkCases(form) : [];
    const serviceMenuItems = collectServiceMenuItems(form);
    const companyName = form.querySelector("#bizCompanyName")?.value?.trim() ?? "";
    const listingTitle = form.querySelector("#title")?.value?.trim() ?? "";
    const listingDescription =
      form.querySelector("#description")?.value?.trim() ?? "";
    const shopDescription = String(shopBlock.shop_description || "").trim();
    const shopCatchCopy = String(shopBlock.catch_copy || "").trim();
    const shopAddress = String(shopBlock.address || "").trim();
    const shopHoliday = String(shopBlock.closed_day || "").trim();
    const shopAccess = String(shopBlock.access || "").trim();
    const shopParking = String(shopBlock.parking || "").trim();
    const shopServicesRaw = String(shopBlock.services || "").trim();
    const shopNotices = String(shopBlock.notices || "").trim();
    const shopSnsUrl = String(shopBlock.sns_url || "").trim();
    const shopServices = shopServicesRaw
      ? shopServicesRaw
          .split(/[\n,、/|]+/)
          .map((s) => String(s || "").trim())
          .filter(Boolean)
          .slice(0, 24)
      : [];
    const fieldServiceDescription = readFieldServiceDescription(form);
    const adPlans = readBusinessAdPlanFields(form);
    const jobFormData =
      isShop || isFs
        ? {}
        : {
            budget_amount: jobConditions.budget_amount,
            start_date: jobConditions.start_date,
            recruit_count: jobConditions.recruit_count,
            recruit_status: jobConditions.recruit_status,
            contact_method: jobConditions.contact_method,
          };
    if (!isShop && !isFs && !isRepair) {
      jobFormData.payment_type = jobConditions.payment_type;
      jobFormData.contract_period = jobConditions.contract_period;
      jobFormData.application_conditions = jobConditions.application_conditions;
    }

    const fsServiceArea =
      String(fsBlock.primary_service_area || "").trim() ||
      String(fsBlock.visit_area || "").trim() ||
      form.querySelector("#bizServiceArea")?.value?.trim() ||
      "";
    const fsCatchCopy = String(fsBlock.catch_copy || "").trim();
    const fsMaterialsUrl = String(fsBlock.materials_url || "").trim();

    const businessType = getBusinessTypeForCategory(category);
    const privateMeta = {};
    form.querySelectorAll("[data-private-meta]").forEach((el) => {
      const key = el.getAttribute("data-private-meta");
      if (!key) return;
      const value = String(el.value ?? "").trim();
      if (value) privateMeta[key] = value;
    });

    if (isFs && window.TasuBusinessServiceData?.collectBusinessServiceFromForm) {
      const draft = {
        user_id: getUserId(),
        business_category: category,
        business_type: businessType || null,
        business_subcategory: businessSubcategory || null,
        company_name: companyName,
        title: listingTitle,
        description: fieldServiceDescription || listingDescription,
        status,
        work_cases: workCases,
        service_menu_items: serviceMenuItems,
        license_info: form.querySelector("#bizLicenseInfo")?.value?.trim() ?? "",
        publish_status: form.querySelector('input[name="publishStatus"]:checked')?.value ?? "public",
        tags: form.querySelector("[data-tags-input]")?.value?.trim() ?? "",
        form_data: {
          category_extra: categoryExtra,
          business_type: businessType || undefined,
          business_subcategory: businessSubcategory || "",
        },
      };
      return window.TasuBusinessServiceData.collectBusinessServiceFromForm(form, draft);
    }

    return {
      user_id: getUserId(),
      business_category: category,
      business_type: businessType || null,
      business_subcategory: (isShop ? shopStoreSubcategory : businessSubcategory) || null,
      company_name: companyName,
      title: listingTitle,
      catch_copy: isShop ? shopCatchCopy : isFs ? fsCatchCopy : "",
      description: isShop
        ? shopDescription
        : isFs
          ? fieldServiceDescription ||
            String(fsBlock.service_description || "").trim() ||
            listingDescription
          : fieldServiceDescription || listingDescription,
      hp_url: isFs && fsMaterialsUrl
        ? fsMaterialsUrl
        : form.querySelector("#bizHpUrl")?.value?.trim() ?? "",
      google_map_url: form.querySelector("#bizGoogleMapUrl")?.value?.trim() ?? "",
      phone: form.querySelector("#bizPhone")?.value?.trim() ?? "",
      business_hours: isShop
        ? form.querySelector("#bizExtraShopStoreHours")?.value?.trim() ||
          form.querySelector("#bizBusinessHours")?.value?.trim() ||
          ""
        : isFs
          ? String(fsBlock.service_hours || "").trim() ||
            form.querySelector("#bizBusinessHours")?.value?.trim() ||
            ""
          : form.querySelector("#bizBusinessHours")?.value?.trim() ?? "",
      address: isShop ? shopAddress : "",
      holiday: isShop ? shopHoliday : "",
      access: isShop ? shopAccess : "",
      parking: isShop ? shopParking : "",
      store_services: isShop ? shopServices : [],
      notices: isShop ? shopNotices : "",
      sns_url: isShop ? shopSnsUrl : "",
      service_area: isFs ? fsServiceArea : form.querySelector("#bizServiceArea")?.value?.trim() ?? "",
      achievements:
        isShop || usesWorkCases
          ? ""
          : form.querySelector("#bizAchievements")?.value?.trim() ?? "",
      work_cases: workCases,
      service_menu_items: isShop ? [] : serviceMenuItems,
      status: isShop ? "available" : status,
      license_info: form.querySelector("#bizLicenseInfo")?.value?.trim() ?? "",
      pr_plan: adPlans.pr_plan,
      featured_plan: adPlans.featured_plan,
      pr_payment_url: adPlans.pr_payment_url,
      pr_bank_info: adPlans.pr_bank_info,
      featured_payment_url: adPlans.featured_payment_url,
      featured_bank_info: adPlans.featured_bank_info,
      payment_url: form.querySelector("#bizPaymentUrl")?.value?.trim() ?? "",
      bank_transfer_info: form.querySelector("#bizBankTransferInfo")?.value?.trim() ?? "",
      onsite_payment: Boolean(form.querySelector("#bizOnsitePayment, [data-biz-onsite-payment]")?.checked),
      invoice_support:
        form.querySelector("#bizInvoiceSupport")?.value?.trim() || "no",
      publish_status: form.querySelector('input[name="publishStatus"]:checked')?.value ?? "public",
      tags: form.querySelector("[data-tags-input]")?.value?.trim() ?? "",
      ...taxiColumns,
      form_data: {
        hp_url: form.querySelector("#bizHpUrl")?.value?.trim() ?? "",
        google_map_url: form.querySelector("#bizGoogleMapUrl")?.value?.trim() ?? "",
        license_info: form.querySelector("#bizLicenseInfo")?.value?.trim() ?? "",
        business_type: businessType || undefined,
        business_subcategory: (isShop ? shopStoreSubcategory : businessSubcategory) || "",
        catch_copy: isShop ? shopCatchCopy : "",
        address: isShop ? shopAddress : "",
        holiday: isShop ? shopHoliday : "",
        access: isShop ? shopAccess : "",
        parking: isShop ? shopParking : "",
        store_services: isShop ? shopServices : undefined,
        services: isShop ? shopServicesRaw : undefined,
        notices: isShop ? shopNotices : undefined,
        sns_url: isShop ? shopSnsUrl : undefined,
        achievements:
          isShop || usesWorkCases
            ? ""
            : form.querySelector("#bizAchievements")?.value?.trim() ?? "",
        work_cases: workCases,
        service_menu_items:
          !isShop && serviceMenuItems.length ? serviceMenuItems : undefined,
        pr_plan: adPlans.pr_plan,
        featured_plan: adPlans.featured_plan,
        pr_payment_url: adPlans.pr_payment_url || undefined,
        pr_bank_info: adPlans.pr_bank_info || undefined,
        featured_payment_url: adPlans.featured_payment_url || undefined,
        featured_bank_info: adPlans.featured_bank_info || undefined,
        category_extra: categoryExtra,
        ...taxiColumns,
        ...jobFormData,
      },
    };
  }

  function clearValidationErrors(form) {
    form.querySelectorAll(".post-field--error").forEach((el) => {
      el.classList.remove("post-field--error");
    });
    form.querySelectorAll(".post-field__error:not([data-terms-error])").forEach((el) => {
      if (!el.hasAttribute("data-terms-error")) el.remove();
    });
    form.querySelector(".post-category-hub")?.classList.remove("post-field--error");
    form.querySelector("[data-category-hub-error]")?.remove();
    const termsBlock = form.querySelector("[data-terms-block]");
    termsBlock?.classList.remove("post-field--error");
    const termsErr = form.querySelector("[data-terms-error]");
    if (termsErr) termsErr.hidden = true;
  }

  function markFieldError(element, message) {
    if (!element) return null;
    const wrap =
      element.closest(".post-field") ||
      element.closest(".post-category-block") ||
      element.closest("fieldset") ||
      element.parentElement;
    if (wrap) wrap.classList.add("post-field--error");

    let err = wrap?.querySelector(":scope > .post-field__error");
    if (!err && wrap) {
      err = document.createElement("span");
      err.className = "post-field__error";
      err.setAttribute("role", "alert");
      wrap.appendChild(err);
    }
    if (err) err.textContent = message;
    return { element, wrap };
  }

  function markCategoryHubError(form, message) {
    const hub = form.querySelector(".post-category-hub");
    if (!hub) return null;
    hub.classList.add("post-field--error");
    let err = hub.querySelector("[data-category-hub-error]");
    if (!err) {
      err = document.createElement("p");
      err.className = "post-category-hub__error";
      err.dataset.categoryHubError = "1";
      err.setAttribute("role", "alert");
      hub.appendChild(err);
    }
    err.textContent = message;
    return { element: hub };
  }

  function isFormFieldVisible(el) {
    if (!el || el.disabled) return false;
    if (el.hidden || el.type === "hidden") return false;
    if (el.closest("[hidden]")) return false;
    if (el.closest(".is-hidden")) return false;
    if (el.closest('[aria-hidden="true"]')) return false;
    return el.offsetParent !== null;
  }

  const FIELD_SERVICE_REQUIRED_CHECKS = [
    { key: "company_name", label: "会社名", selector: "#bizCompanyName" },
    { key: "title", label: "サービス名", selector: "#title" },
    {
      key: "service_description",
      label: "サービス説明",
      selector: "#bizExtraFieldServiceDesc",
      readValue: (form) => readFieldServiceDescription(form),
    },
    { key: "phone", label: "電話番号", selector: "#fsHeroPhone" },
    { key: "service_area_summary", label: "対応エリア要約", selector: "#fsHeroAreaSummary" },
  ];

  const BUSINESS_PAYLOAD_REQUIRED_LABELS = {
    company_name: "会社名",
    title: "サービス名",
    description: "サービス説明",
    phone: "電話番号",
    service_area: "対応エリア要約",
    user_id: "ユーザーID",
    business_category: "カテゴリ",
  };

  function showBusinessMissingRequiredAlert(missingFields) {
    const list = (missingFields || []).filter(Boolean);
    if (!list.length) return;
    console.warn("[business missing required fields]", list);
    alert(
      "必要項目が不足しています：\n" +
        list.map((f) => `・${f.label || f.key || f.name}`).join("\n")
    );
  }

  function requireField(form, selector, label) {
    const el = form.querySelector(selector);
    if (!el || !isFormFieldVisible(el)) return null;
    const value =
      el.type === "checkbox" || el.type === "radio"
        ? el.checked
          ? el.value || "yes"
          : ""
        : String(el.value ?? "").trim();
    if (!value) return markFieldError(el, `${label}を入力してください`);
    return null;
  }

  function validateTermsAgreed(form) {
    const terms = form.querySelector("[data-terms-agree]");
    const termsBlock = form.querySelector("[data-terms-block]");
    const termsErr = form.querySelector("[data-terms-error]");
    if (!isFormFieldVisible(terms) || terms?.checked) return true;
    termsBlock?.classList.add("post-field--error");
    if (termsErr) {
      termsErr.hidden = false;
      termsErr.textContent = "掲載ルール・利用規約・注意事項への同意が必要です。";
    }
    return false;
  }

  function validateFieldServiceRequired(form) {
    const errors = [];
    const missingFields = [];

    FIELD_SERVICE_REQUIRED_CHECKS.forEach(({ key, label, selector, readValue }) => {
      const el = form.querySelector(selector);
      if (!isFormFieldVisible(el)) return;
      const value = readValue
        ? readValue(form)
        : el.type === "checkbox" || el.type === "radio"
          ? el.checked
            ? el.value || "yes"
            : ""
          : String(el.value ?? "").trim();
      if (value) return;
      missingFields.push({ key, label, name: label });
      errors.push(markFieldError(el, `${label}を入力してください`));
    });

    if (!validateTermsAgreed(form)) {
      missingFields.push({ key: "terms", label: "利用規約同意", name: "利用規約同意" });
    }

    return { errors: errors.filter(Boolean), missingFields };
  }

  function validateGeneralForm(form, listingType) {
    const errors = [];

    if (!form.querySelector("[data-general-category]:checked")) {
      errors.push(markCategoryHubError(form, "一般カテゴリ（スキル / 商品 / 求人 / ワーカー）を選択してください"));
    }

    const common = [["#title", "タイトル"]];
    common.forEach(([sel, label]) => {
      const err = requireField(form, sel, label);
      if (err) errors.push(err);
    });

    if (listingType !== "product") {
      const err = requireField(form, "#description", "説明");
      if (err) errors.push(err);
    }

    if (listingType === "product") {
      [
        ["[data-product-category]", "商品カテゴリ"],
        ["[data-product-subcategory]", "サブカテゴリ"],
        ["#productName", "商品名"],
        ["#productPrice", "価格"],
        ["#productDescription", "商品説明"],
      ].forEach(([sel, label]) => {
        const err = requireField(form, sel, label);
        if (err) errors.push(err);
      });
    } else if (listingType === "skill") {
      [
        ["[data-skill-category]", "スキルカテゴリ"],
        ["#skillBasePrice", "基本料金"],
      ].forEach(([sel, label]) => {
        const err = requireField(form, sel, label);
        if (err) errors.push(err);
      });
    } else if (listingType === "job") {
      [
        ["[data-job-category]", "職種カテゴリ"],
        ["#jobTitle", "募集タイトル"],
        ["#salary_amount", "#jobSalary", "給与・報酬"],
      ].forEach(([sel, label]) => {
        const err = requireField(form, sel, label);
        if (err) errors.push(err);
      });
    } else if (listingType === "worker") {
      [
        ["[data-worker-category]", "ワーカーカテゴリ"],
        ["#workerServiceName", "サービス名"],
        ["#workerPrefecture", "都道府県"],
        ["#workerCity", "市区町村"],
        ["#workerPriceType", "料金体系"],
        ["#workerPrice", "金額"],
        ["#workerScope", "対応内容"],
      ].forEach(([sel, label]) => {
        const err = requireField(form, sel, label);
        if (err) errors.push(err);
      });
    }

    return errors.filter(Boolean);
  }

  function listBusinessPayloadMissingFields(payload) {
    const missing = [];
    const pushKey = (key) => {
      missing.push({
        key,
        label: BUSINESS_PAYLOAD_REQUIRED_LABELS[key] || key,
        name: BUSINESS_PAYLOAD_REQUIRED_LABELS[key] || key,
      });
    };
    if (!String(payload?.company_name || "").trim()) pushKey("company_name");
    if (!String(payload?.title || "").trim()) pushKey("title");
    const description =
      String(payload?.description || "").trim() ||
      String(payload?.form_data?.category_extra?.field_service?.service_description || "").trim();
    if (!description) pushKey("description");
    if (!String(payload?.phone || "").trim()) pushKey("phone");
    if (!String(payload?.service_area || "").trim()) pushKey("service_area");
    return missing;
  }

  function validateBusinessForm(form) {
    const errors = [];
    let missingFields = [];
    const category = getSelectedBusinessCategory(form);
    const isShop = isShopStoreFormContext(form, category);
    const isFs = isFieldServiceFormContext(form, category);

    if (isShop) {
      if (!form.querySelector("[data-shop-store-category-pick]:checked")) {
        errors.push(markCategoryHubError(form, "店舗・販売の子カテゴリを選択してください"));
      }
    } else if (!isFs) {
      const catPick = form.querySelector("[data-business-category-pick]:checked");
      const catHidden = form.querySelector("[data-business-category-hidden]")?.value?.trim();
      const catHubVisible = isFormFieldVisible(
        form.querySelector("[data-business-category-pick]")
      );
      if (catHubVisible && !catPick) {
        errors.push(markCategoryHubError(form, "法人・業者カテゴリを選択してください"));
      } else if (!catHubVisible && !catPick && !catHidden) {
        errors.push(markCategoryHubError(form, "法人・業者カテゴリを選択してください"));
      }
    }

    if (isFs) {
      const fsCheck = validateFieldServiceRequired(form);
      errors.push(...fsCheck.errors);
      missingFields = fsCheck.missingFields;
    } else if (isShop) {
      [
        ["#title", "掲載タイトル"],
        ["#bizCompanyName", "店舗名"],
        ["#bizExtraShopStoreCatchCopy", "キャッチコピー"],
        ["#bizExtraShopStoreDesc", "店舗説明"],
        ["#bizExtraShopStoreAddress", "住所"],
        ["#bizExtraShopStoreHours", "営業時間"],
        ["#bizExtraShopStoreClosed", "定休日"],
        ["#bizPhone", "電話番号"],
        ["#bizServiceArea", "対応エリア"],
        ["#bizExtraShopStoreParking", "駐車場"],
        ["#bizExtraShopStoreServices", "取扱サービス"],
      ].forEach(([sel, label]) => {
        const err = requireField(form, sel, label);
        if (err) errors.push(err);
      });
    } else {
      [
        ["#title", "サービス名"],
        ["#bizCompanyName", "会社名"],
        ["#bizPhone", "電話番号"],
        ["#bizServiceArea", "対応地域"],
      ].forEach(([sel, label]) => {
        const el = form.querySelector(sel);
        if (!isFormFieldVisible(el)) return;
        const err = requireField(form, sel, label);
        if (err) {
          errors.push(err);
          missingFields.push(label);
        }
      });

      const serviceDescEl = form.querySelector("#bizExtraFieldServiceDesc");
      const listingDescEl = form.querySelector("#description");
      const hasDescription =
        (isFormFieldVisible(serviceDescEl) && readFieldServiceDescription(form)) ||
        (isFormFieldVisible(listingDescEl) &&
          String(listingDescEl.value ?? "").trim());
      if (!hasDescription) {
        const target =
          isFormFieldVisible(serviceDescEl) && serviceDescEl
            ? serviceDescEl
            : listingDescEl;
        if (target) {
          errors.push(markFieldError(target, "サービス説明を入力してください"));
          missingFields.push("サービス説明");
        }
      }

      const statusFieldset = form.querySelector('input[name="bizStatus"]')?.closest("fieldset");
      if (isFormFieldVisible(statusFieldset?.querySelector('input[name="bizStatus"]'))) {
        if (!form.querySelector('input[name="bizStatus"]:checked')) {
          const statusField = form.querySelector('input[name="bizStatus"]');
          errors.push(markFieldError(statusField, "対応可能状態を選択してください"));
          missingFields.push("対応可能状態");
        }
      }
    }

    return { errors: errors.filter(Boolean), missingFields };
  }

  function scrollToFirstError(errors) {
    const first = errors.find((e) => e?.element)?.element;
    if (first?.scrollIntoView) {
      first.scrollIntoView({ behavior: "smooth", block: "center" });
      if (first.focus) first.focus();
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function buildConfirmRows(rows) {
    return rows
      .filter((row) => row[1])
      .map(
        ([label, value]) =>
          `<div class="post-confirm-dl__row"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`
      )
      .join("");
  }

  function buildConfirmSummary(form, scope, listingType) {
    if (scope === POST_SCOPE.business) {
      const payload = collectBusinessPayload(form);
      const cat = bizCatLabel(payload.business_category) || payload.business_category;
      const status = BUSINESS_STATUS_LABELS[payload.status] ?? payload.status;
      const extra = payload.form_data?.category_extra;
      const extraSummary = formatCategoryExtraForConfirm(
        payload.business_category,
        extra
      );
      const partnerRow =
        isConstructionBiz(payload.business_category) &&
        extra?.construction?.partner_registration
          ? extra.construction.partner_registration
          : "";
      const fd = payload.form_data || {};
      const isShop = isShopStoreBiz(payload.business_category);
      const isFsConfirm =
        payload.business_type === "field_service" ||
        isFieldServiceFormContext(form, payload.business_category);
      const isRepair = isRepairBiz(payload.business_category);
      const usesWorkCases = usesWorkCasesProfile(payload.business_category);
      const fsConfirm = extra?.field_service || {};
      const workCases =
        payload.work_cases || payload.form_data?.work_cases || [];
      let confirmRows;
      if (isShop) {
        confirmRows = [
          ["掲載区分", "法人・業者"],
          ["カテゴリ", cat],
          ["掲載タイトル", payload.title],
          ["店舗名", payload.company_name],
          ["店舗説明", payload.description],
          ["対応タグ", payload.tags || "—"],
          ["電話", payload.phone],
          ["営業時間", payload.business_hours || "—"],
          ["対応エリア", payload.service_area],
          [
            "掲載商品",
            window.TasuPostShopProducts?.formatProductsForConfirm?.(form) || "—",
          ],
          ["店舗・販売情報", extraSummary],
          ["許可・資格", payload.license_info || fd.license_info || "—"],
          [
            "PR掲載",
            formatBusinessAdPlanForConfirm(
              payload.pr_plan,
              payload.pr_payment_url,
              payload.pr_bank_info
            ),
          ],
          [
            "上位掲載",
            formatBusinessAdPlanForConfirm(
              payload.featured_plan,
              payload.featured_payment_url,
              payload.featured_bank_info
            ),
          ],
        ];
      } else if (isFsConfirm) {
        confirmRows = [
          ["掲載区分", "法人・業者（業務サービス）"],
          ["カテゴリ", cat],
          ["会社名", payload.company_name],
          ["サービス名 / タイトル", payload.title],
          ["キャッチコピー", payload.catch_copy || fsConfirm.catch_copy || "—"],
          ["サービス説明", payload.description],
          ["対応タグ", payload.tags || "—"],
          ["電話", payload.phone],
          ["営業時間", payload.business_hours || "—"],
          [
            "問い合わせ方法",
            fsConfirm.contact_method || fd.contact_method || "—",
          ],
          ["対応エリア", payload.service_area],
          ["業務概要", fsConfirm.overview_text || "—"],
          [
            "特徴リスト",
            (fsConfirm.overview_features || []).join(" / ") || "—",
          ],
          [SERVICE_MENU_SECTION_TITLE, formatServiceMenuForConfirm(form)],
          ["実績・事例", formatWorkCasesForConfirm(form)],
          [
            "資格・認証",
            (fsConfirm.license_items || [])
              .map((i) => `${i.label || ""}:${i.value || ""}`)
              .join(" / ") || payload.license_info || "—",
          ],
          [
            "ご依頼の流れ",
            (fsConfirm.flow_steps || [])
              .map((s, i) => `${i + 1}. ${s.title || ""}`)
              .join(" / ") || "—",
          ],
          [
            "資料DL",
            fsConfirm.materials_name
              ? `${fsConfirm.materials_name} (${fsConfirm.materials_url || payload.hp_url || "—"})`
              : "—",
          ],
          [
            "PR掲載",
            formatBusinessAdPlanForConfirm(
              payload.pr_plan,
              payload.pr_payment_url,
              payload.pr_bank_info
            ),
          ],
          [
            "上位掲載",
            formatBusinessAdPlanForConfirm(
              payload.featured_plan,
              payload.featured_payment_url,
              payload.featured_bank_info
            ),
          ],
        ];
      } else {
        confirmRows = [
          ["掲載区分", "法人・業者"],
          ["カテゴリ", cat],
          ["会社名", payload.company_name],
          ["タイトル", payload.title],
          ["説明", payload.description],
          ["対応タグ", payload.tags || "—"],
          [isRepair ? "料金目安" : "予算・単価", fd.budget_amount || "—"],
        ];
        if (!isRepair) {
          confirmRows.push(
            ["支払い条件", fd.payment_type || "—"],
            ["開始希望日", fd.start_date || "—"],
            [
              window.TasuBusinessWording?.contractPeriodLabel?.(payload.business_category) ||
                "対応期間",
              fd.contract_period || "—",
            ]
          );
        } else if (fd.start_date) {
          confirmRows.push(["開始希望日", fd.start_date]);
        }
        confirmRows.push(
          [
            window.TasuBusinessWording?.labels?.headcount || "対応可能人数",
            fd.recruit_count || "—",
          ],
          [
            window.TasuBusinessWording?.labels?.acceptanceStatus || "受付状況",
            window.TasuBusinessWording?.formatRecruitStatus
              ? window.TasuBusinessWording.formatRecruitStatus(fd.recruit_status)
              : fd.recruit_status || "—",
          ]
        );
        if (!isRepair) {
          confirmRows.push([
            window.TasuBusinessWording?.labels?.conditions || "対応条件",
            formatApplicationConditionsForConfirm(fd.application_conditions),
          ]);
        }
        confirmRows.push(
          [
            window.TasuBusinessWording?.labels?.contactMethod || "お問い合わせ方法",
            fd.contact_method || "—",
          ],
          ["電話", payload.phone],
          ["対応地域", payload.service_area],
          ...(usesServiceMenuProfile(payload.business_category)
            ? [[SERVICE_MENU_SECTION_TITLE, formatServiceMenuForConfirm(form)]]
            : []),
          ...(usesWorkCases
            ? [["実績・事例", formatWorkCasesForConfirm(form)]]
            : [["実績・紹介", payload.achievements || fd.achievements || "—"]]),
          ["対応状態", status],
          ["カテゴリ追加", extraSummary],
          ["建設パートナー登録", partnerRow],
          [
            "PR掲載",
            formatBusinessAdPlanForConfirm(
              payload.pr_plan,
              payload.pr_payment_url,
              payload.pr_bank_info
            ),
          ],
          [
            "上位掲載",
            formatBusinessAdPlanForConfirm(
              payload.featured_plan,
              payload.featured_payment_url,
              payload.featured_bank_info
            ),
          ],
          ["決済URL", payload.payment_url ? "設定あり" : "—"],
          ["振込先", payload.bank_transfer_info ? "設定あり" : "—"]
        );
      }
      const rows = buildConfirmRows(confirmRows);
      return { html: `<dl class="post-confirm-dl">${rows}</dl>`, payload, scope };
    }

    const savePayload =
      listingType === "job"
        ? buildJobListingPayload(form)
        : listingType === "worker"
          ? buildWorkerListingPayload(form)
          : collectGeneralListingPayload(form, listingType);
    const typeLabel = TYPE_LABELS[listingType] ?? listingType;
    const pay = savePayload.form_data?.payment || {};
    const descriptionLabel = listingType === "product" ? "商品説明" : "説明";
    const rows = buildConfirmRows([
      ["掲載区分", "一般"],
      ["カテゴリ", typeLabel],
      ["タイトル", savePayload.title],
      [descriptionLabel, savePayload.description],
      ["公開", savePayload.publish_status],
      ["決済URL", pay.payment_url ? "設定あり" : "—"],
      ["振込先", pay.bank_transfer_info ? "設定あり" : "—"],
      ["現地払い", pay.onsite_payment ? "対応" : "—"],
      ["請求書", pay.invoice_support === "yes" ? "対応可" : pay.invoice_support === "negotiable" ? "要相談" : "—"],
    ]);
    return {
      html: `<dl class="post-confirm-dl">${rows}</dl>`,
      payload: savePayload,
      scope,
      listingType,
    };
  }

  function validateBeforeConfirm(form) {
    clearValidationErrors(form);

    const scope = form.querySelector("[data-post-scope]")?.value ?? POST_SCOPE.general;
    let errors = [];
    let missingFields = [];

    if (scope === POST_SCOPE.business) {
      const bizCheck = validateBusinessForm(form);
      errors = bizCheck.errors;
      missingFields = bizCheck.missingFields;
      if (!validateTermsAgreed(form)) {
        missingFields.push({ key: "terms", label: "利用規約同意", name: "利用規約同意" });
      }
    } else {
      if (!validateTermsAgreed(form)) {
        showBusinessMissingRequiredAlert([
          { label: "掲載ルール・利用規約・注意事項への同意" },
        ]);
        form.querySelector("[data-terms-agree]")?.scrollIntoView?.({ behavior: "smooth", block: "center" });
        return { ok: false, errors: [] };
      }
      const listingType = resolveActiveListingType(form);
      if (!GENERAL_TYPES.includes(listingType)) {
        errors.push(markCategoryHubError(form, "一般カテゴリを選択してください"));
      } else {
        errors = validateGeneralForm(form, listingType);
      }
    }

    if (missingFields.length) {
      showBusinessMissingRequiredAlert(missingFields);
    }

    if (errors.length) {
      scrollToFirstError(errors);
      return { ok: false, errors };
    }

    return { ok: true, scope, listingType: scope === POST_SCOPE.general ? resolveActiveListingType(form) : null };
  }

  async function persistListing(pending, form) {
    if (pending.scope === POST_SCOPE.business) {
      const db = window.TasuBusinessListings;
      if (!db?.insertBusinessListing) {
        return { ok: false, error: "保存モジュールが読み込まれていません" };
      }
      const attachImages =
        window.TasuListingImages?.attachListingImagesToPayload ||
        window.TasuListingImages?.attachSkillImagesToPayload;
      let payload = { ...pending.payload, listing_type: "business" };
      if (!form) {
        console.warn("[post] business persist: form が無いため画像を添付できません");
      } else {
        try {
          if (attachImages) {
            payload = await attachImages(form, payload);

            const fileToStorableUrl = window.TasuListingImages?.fileToStorableUrl;
            const listingType = String(payload.listing_type || "business").trim() || "business";

            let serviceMenuItems = collectServiceMenuItems(form);
            if (fileToStorableUrl && serviceMenuItems.length) {
              for (let i = 0; i < serviceMenuItems.length; i += 1) {
                const item = serviceMenuItems[i];
                if (!item) continue;
                const file = item.image_file;
                const existingUrl = String(item.image_url || "").trim();
                if (file) {
                  const url = await fileToStorableUrl(file, payload.user_id, listingType);
                  item.image_url = url;
                } else if (existingUrl) {
                  item.image_url = existingUrl;
                }
                delete item.image_file;
              }
            } else {
              serviceMenuItems = sanitizeServiceMenuForSave(
                payload.service_menu_items || payload.form_data?.service_menu_items
              );
            }
            serviceMenuItems = sanitizeServiceMenuForSave(serviceMenuItems);
            payload.service_menu_items = serviceMenuItems;
            payload.form_data = {
              ...(payload.form_data || {}),
              service_menu_items: serviceMenuItems,
            };

            if (usesWorkCasesProfile(payload.business_category)) {
              let workCases = collectWorkCases(form);
              if (fileToStorableUrl && workCases.length) {
                for (let i = 0; i < workCases.length; i += 1) {
                  const item = workCases[i];
                  if (!item) continue;
                  const file = item.image_file;
                  const existingUrl = String(item.image_url || "").trim();
                  if (file) {
                    const url = await fileToStorableUrl(file, payload.user_id, listingType);
                    item.image_url = url;
                  } else if (existingUrl) {
                    item.image_url = existingUrl;
                  }
                  delete item.image_file;
                }
              } else {
                workCases = payload.work_cases || payload.form_data?.work_cases || [];
              }
              workCases = sanitizeWorkCasesForSave(workCases);
              payload.work_cases = workCases;
              payload.form_data = {
                ...payload.form_data,
                work_cases: workCases,
              };
            }
          } else {
            console.warn(
              "[post] business persist: listing-images.js 未読み込みのため attachListingImagesToPayload をスキップ"
            );
          }

          if (window.TasuListingImages?.attachShopStoreProductsToPayload) {
            payload = await window.TasuListingImages.attachShopStoreProductsToPayload(
              form,
              payload
            );
          }
        } catch (err) {
          return { ok: false, error: err?.message || "画像の保存に失敗しました" };
        }
      }
      const payloadMissing = listBusinessPayloadMissingFields(payload);
      if (payloadMissing.length) {
        return {
          ok: false,
          error:
            "必要項目が不足しています：\n" +
            payloadMissing.map((f) => `・${f.label || f.key}`).join("\n"),
          missingFields: payloadMissing,
        };
      }
      if (
        isFieldServiceFormContext(form, payload.business_category) &&
        window.TasuBusinessServiceData?.collectBusinessServiceFromForm
      ) {
        const refreshed = window.TasuBusinessServiceData.collectBusinessServiceFromForm(form, {
          ...payload,
          work_cases: payload.work_cases,
          service_menu_items: payload.service_menu_items,
        });
        payload = { ...payload, ...refreshed };
      }
      const editId = form?.dataset?.editListingId || "";
      if (db.saveBusinessListing) {
        return db.saveBusinessListing(payload, editId);
      }
      return db.insertBusinessListing(payload);
    }

    const store = window.TasuListingStore;
    if (!store?.insertListing) {
      return { ok: false, error: "保存モジュールが読み込まれていません" };
    }

    const attachImages = window.TasuListingImages?.attachListingImagesToPayload
      || window.TasuListingImages?.attachSkillImagesToPayload;
    const imageListingTypes = new Set(["skill", "product", "worker", "job"]);

    let listingType = pending.listingType || "skill";
    let payload = pending.payload;

    if (form) {
      listingType = resolveActiveListingType(form);
      syncListingTypeValue(form, listingType);

      if (listingType === "job") {
        payload = buildJobListingPayload(form);
      } else if (listingType === "worker") {
        payload = buildWorkerListingPayload(form);
      } else if (listingType === "product") {
        payload = collectGeneralListingPayload(form, "product");
      } else {
        payload = collectGeneralListingPayload(form, listingType);
      }

      if (imageListingTypes.has(listingType) && attachImages) {
        try {
          payload = await attachImages(form, payload);
        } catch (err) {
          return { ok: false, error: err?.message || "画像の保存に失敗しました" };
        }
      }

      if (listingType === "job") {
        payload = assignJobListingSaveFields(payload, form);
      }
      if (listingType === "worker") {
        payload = assignWorkerListingSaveFields(payload, form);
      }
    }

    if (listingType === "job" && form) {
      const fd = buildJobFormData(form);
      console.log("JOB FORM DATA", Object.fromEntries(fd.entries()));
      console.log("JOB FINAL PAYLOAD", payload);
    }

    if (listingType === "worker" && form) {
      const fd = buildWorkerFormData(form);
      console.log("WORKER FORM DATA", Object.fromEntries(fd.entries()));
      console.log("WORKER FINAL PAYLOAD", payload);
    }

    return store.insertListing(payload);
  }

  function initSubmitFlow(form) {
    const confirmModal = document.querySelector("[data-confirm-modal]");
    const successModal = document.querySelector("[data-success-modal]");
    const confirmSummary = document.querySelector("[data-confirm-summary]");
    const confirmPublishBtn = document.querySelector("[data-confirm-publish]");
    const openConfirmBtn = document.querySelector("[data-open-confirm]");
    let pendingPublish = null;
    let lastPostRedirect = null;

    function closeModal(modal) {
      if (!modal) return;
      modal.hidden = true;
      modal.setAttribute("aria-hidden", "true");
      document.body.classList.remove("post-modal-open");
    }

    function openModal(modal) {
      if (!modal) return;
      modal.hidden = false;
      modal.setAttribute("aria-hidden", "false");
      document.body.classList.add("post-modal-open");
    }

    function showConfirmModal(summary) {
      if (confirmSummary) confirmSummary.innerHTML = summary.html;
      openModal(confirmModal);
      confirmPublishBtn?.focus();
    }

    function showSuccessModal(detailUrl, listingId) {
      const goBtn = document.querySelector("[data-success-go-detail]");
      if (goBtn) goBtn.hidden = !detailUrl;

      const upsellRoot = successModal?.querySelector("[data-featured-upsell]");
      if (upsellRoot && window.TasuListingFeatured?.renderPostSuccessUpsell) {
        if (listingId) {
          window.TasuListingFeatured.renderPostSuccessUpsell(upsellRoot, {
            listingId,
          });
        } else {
          upsellRoot.hidden = true;
          upsellRoot.innerHTML = "";
        }
      }

      openModal(successModal);
    }

    openConfirmBtn?.addEventListener("click", () => {
      const check = validateBeforeConfirm(form);
      if (!check.ok) return;

      const scope = check.scope;
      const listingType = check.listingType || resolveActiveListingType(form);
      const summary = buildConfirmSummary(form, scope, listingType);
      pendingPublish = {
        scope,
        listingType,
        payload: summary.payload,
      };
      showConfirmModal(summary);
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      openConfirmBtn?.click();
    });

    document.querySelectorAll("[data-confirm-back], [data-confirm-close]").forEach((btn) => {
      btn.addEventListener("click", () => {
        closeModal(confirmModal);
        pendingPublish = null;
      });
    });

    confirmPublishBtn?.addEventListener("click", async () => {
      if (!pendingPublish) return;

      confirmPublishBtn.disabled = true;
      const prevLabel = confirmPublishBtn.textContent;
      confirmPublishBtn.textContent = "掲載中…";

      const editId =
        form.dataset.editListingId ||
        new URLSearchParams(window.location.search).get("edit") ||
        "";

      const localResult = window.TasuListingLocalStore?.upsertFromForm?.(form, {
        editId,
        fromAiAgent: form.dataset.aiAgentSource === "1",
      }) ||
        window.TasuPostDraftAgent?.upsertListingFromForm?.(form, { editId });
      console.log("[post listing save]", localResult);

      const result = await persistListing(pendingPublish, form);

      confirmPublishBtn.disabled = false;
      confirmPublishBtn.textContent = prevLabel;

      if (localResult?.ok) {
        window.location.href = "listing-management.html";
        return;
      }

      if (!result.ok) {
        if (result.missingFields?.length) {
          showBusinessMissingRequiredAlert(result.missingFields);
        } else {
          alert(`保存に失敗しました。\n\n${result.error || "不明なエラー"}`);
        }
        return;
      }

      const successMessageEl = successModal?.querySelector("[data-success-message]");
      if (successMessageEl) {
        successMessageEl.textContent =
          result.autoPublic ||
          (result.record?.publish_status === "public" &&
            result.record?.moderation_status === "approved")
            ? "掲載が完了しました。詳細ページを見に行みますか？"
            : result.pending ||
                result.record?.publish_status === "pending_review" ||
                result.record?.moderation_status === "pending_review"
              ? "掲載を受け付けました。タスフルAIが確認中です。完了後に公開されます。"
              : "掲載が完了しました。詳細ページを見に行みますか？";
      }

      const savedScope = pendingPublish.scope;
      const savedListingType = resolveActiveListingType(form);

      closeModal(confirmModal);
      pendingPublish = null;

      lastPostRedirect = {
        scope: savedScope,
        listingType: savedListingType,
        listingId: result.id,
      };
      const detailUrl = getDetailUrlForSaved(
        savedScope,
        savedListingType,
        result.id,
        form
      );
      console.log("[post current href]", window.location.href);
      if (detailUrl) {
        console.log("[post redirect url]", detailUrl.toString());
      }
      const featuredListingId =
        savedScope === POST_SCOPE.general ? result.id : null;
      showSuccessModal(detailUrl, featuredListingId);
    });

    document.querySelectorAll("[data-success-stay]").forEach((btn) => {
      btn.addEventListener("click", () => closeModal(successModal));
    });

    document.querySelector("[data-success-go-detail]")?.addEventListener("click", () => {
      if (!lastPostRedirect?.listingId) return;
      const detailUrl = getDetailUrlForSaved(
        lastPostRedirect.scope,
        lastPostRedirect.listingType,
        lastPostRedirect.listingId,
        form
      );
      navigateToPostDetail(detailUrl);
    });

    form.querySelector("[data-terms-agree]")?.addEventListener("change", () => {
      if (form.querySelector("[data-terms-agree]")?.checked) {
        form.querySelector("[data-terms-block]")?.classList.remove("post-field--error");
        const termsErr = form.querySelector("[data-terms-error]");
        if (termsErr) termsErr.hidden = true;
      }
    });

    form.addEventListener(
      "input",
      (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const wrap = target.closest(".post-field--error");
        if (wrap) {
          wrap.classList.remove("post-field--error");
          wrap.querySelector(".post-field__error")?.remove();
        }
      },
      true
    );
  }

  function resolveDraftDescription(form) {
    const listingType =
      form.querySelector("[data-listing-type-value]")?.value ||
      form.querySelector("[data-listing-type]")?.value ||
      form.querySelector("[data-general-category]:checked")?.value ||
      "skill";
    if (listingType === "product") {
      return form.querySelector("#productDescription")?.value ?? "";
    }
    return form.querySelector("#description")?.value ?? "";
  }

  function initDraftActions(form) {
    const draftBtn = document.querySelector("[data-save-draft]");
    draftBtn?.addEventListener("click", async () => {
      const scope = form.querySelector("[data-post-scope]")?.value ?? POST_SCOPE.general;
      const category =
        form.querySelector("[data-business-category-pick]:checked")?.value ||
        form.querySelector("[data-business-category-hidden]")?.value ||
        "";

      try {
        let result = null;
        if (scope === POST_SCOPE.business) {
          const payload = { ...collectBusinessPayload(form), publish_status: "draft" };
          const editId = form?.dataset?.editListingId || "";
          result = await window.TasuBusinessListings?.saveBusinessListing?.(payload, editId);
        } else {
          const listingType = resolveActiveListingType(form);
          const base =
            listingType === "job"
              ? buildJobListingPayload(form)
              : listingType === "worker"
                ? buildWorkerListingPayload(form)
                : listingType === "product"
                  ? collectGeneralListingPayload(form, "product")
                  : collectGeneralListingPayload(form, listingType);
          const payload = { ...base, publish_status: "draft", user_id: getUserId() };
          result = await window.TasuListingStore?.insertListing?.(payload);
        }

        if (!result?.ok) {
          alert(`下書き保存に失敗しました。\n\n${result?.error || "不明なエラー"}`);
          return;
        }

        const id = result.id;
        if (id) {
          form.dataset.editListingId = id;
        }
        const editUrl = new URL(window.location.href);
        editUrl.searchParams.set("id", id);
        editUrl.searchParams.set("scope", scope);
        alert(`下書きを保存しました。\n編集URL：${editUrl.toString()}`);
      } catch (err) {
        console.error("[draft save] failed:", err);
        alert("下書きの保存に失敗しました");
      }
    });
  }

  window.TasuPostBusinessServiceApply = {
    fillMenuItems(form, items) {
      const list = form.querySelector("[data-service-menu-list]");
      if (!list) return;
      list.innerHTML = "";
      const addRow = form.__postServiceMenuApi?.addRow;
      if (typeof addRow !== "function") {
        console.warn("[post] service menu API not ready");
        return;
      }
      (items || []).forEach((item) => addRow(item));
      form.__postServiceMenuApi?.syncAddButton?.();
    },
    fillWorkCases(form, items, category) {
      const list = form.querySelector("[data-work-cases-list]");
      if (!list) return;
      const cat =
        category ||
        form.querySelector("[data-business-category-pick]:checked")?.value ||
        form.querySelector("[data-business-category-hidden]")?.value ||
        "";
      list.innerHTML = "";
      const addRow = form.__postWorkCasesApi?.addRow;
      if (typeof addRow !== "function") {
        console.warn("[post] work cases API not ready");
        return;
      }
      (items || []).forEach((item) => addRow(cat, item));
      form.__postWorkCasesApi?.syncAddButton?.();
    },
  };

  window.TasuPostFormLayout = {
    hideEmptyBusinessCards,
    restoreFieldServiceFlow,
  };

  function init() {
    const form = document.getElementById("listingForm");
    if (!form) {
      return;
    }

    const scopeHelpers = initPostScope(form);
    initShopStoreFaqBuilder(form);
    initTypeSwitch(form, scopeHelpers);
    initProductSubcategories(form);
    initTagPreview(form);
    initImageHints();
    if (window.TasuPostMainUpload?.initMainUpload) {
      window.TasuPostMainUpload.initMainUpload(form);
    }
    if (window.TasuPostGalleryUpload?.initGalleryUpload) {
      window.TasuPostGalleryUpload.initGalleryUpload(form);
    }
    initJsonPreview(form);
    initGeneralPaymentPreview(form);
    initSubmitFlow(form);
    initBusinessAdPlanFields(form);
    initDraftActions(form);
    window.TasuPostDraftAgent?.init?.(form);
    window.TasuPostDraftAgent?.initEditMode?.(form);

    if (window.TasuListingOptions) {
      window.TasuListingOptions.initForm(form);
    }

    try {
      void window.TasuTalkAiDraftApply?.tryApplyPostFormPage?.({ form });
    } catch (err) {
      console.warn("[post] TALK AI draft apply skipped:", err);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
