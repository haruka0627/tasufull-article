/**
 * 店舗・販売フォーム — 専用カードレイアウト（フィールドの並べ替え・表示切替）
 */
(function () {
  "use strict";

  const ANCHORS = new WeakMap();
  let flowActive = false;

  const STANDARD_HIDE =
    "[data-post-order='10'], [data-business-category-extras-wrap], [data-business-standard-panel]";

  function remember(el) {
    if (!el || ANCHORS.has(el)) return;
    ANCHORS.set(el, { parent: el.parentNode, next: el.nextSibling });
  }

  function restore(el) {
    const anchor = ANCHORS.get(el);
    if (!anchor?.parent) return;
    if (anchor.next && anchor.next.parentNode === anchor.parent) {
      anchor.parent.insertBefore(el, anchor.next);
    } else {
      anchor.parent.appendChild(el);
    }
  }

  function mountChild(mount, el) {
    if (!mount || !el) return;
    remember(el);
    mount.appendChild(el);
    // ensure moved fields are visible (avoid leaving empty gaps)
    try {
      el.hidden = false;
      el.removeAttribute("hidden");
      el.setAttribute("aria-hidden", "false");
      if (el.style) el.style.display = "";
    } catch (_) {}
  }

  function closestField(id) {
    const node = document.getElementById(id);
    return node?.closest(".post-field") || node?.closest("p.post-field") || node?.parentElement;
  }

  function getFlow(form) {
    return form?.querySelector("[data-shop-store-flow]");
  }

  function getMount(form, key) {
    return form?.querySelector(`[data-shop-mount="${key}"]`);
  }

  function mountShopStoreFlow(form) {
    const flow = getFlow(form);
    if (!flow) return;
    if (flowActive) {
      // If mounts are empty (e.g. category reselect), re-mount critical blocks.
      ensureBasicMounted(form);
      ensureContactMounted(form);
      ensureShopProductsVisible(form, true);
      window.TasuPostShopProducts?.setBlockVisible?.(form, true);
      return;
    }

    const basic = getMount(form, "basic");
    const contact = getMount(form, "contact");
    const sales = getMount(form, "sales");
    const images = getMount(form, "images");
    const products = getMount(form, "products");
    const options = getMount(form, "options");

    const titleWrap = form.querySelector("[data-shop-store-title-field]") ||
      closestField("listingTitle");
    if (titleWrap) {
      titleWrap.hidden = false;
      titleWrap.removeAttribute("aria-hidden");
    }

    [
      titleWrap,
      closestField("bizCompanyName"),
      closestField("bizExtraShopStoreCategory"),
      closestField("bizPhone"),
      closestField("bizServiceArea"),
      closestField("bizExtraShopStoreHours"),
      closestField("bizExtraShopStoreDesc"),
      form.querySelector("[data-shop-store-tags-field]") ||
        form.querySelector("#listingTags")?.closest(".post-field"),
    ].forEach((el) => mountChild(basic, el));

    // 店舗情報・連絡先（住所・アクセスなど）
    [
      closestField("bizExtraShopStoreAddress"),
      closestField("bizExtraShopStoreClosed"),
      closestField("bizExtraShopStoreStation"),
      closestField("bizHpUrl"),
      closestField("bizGoogleMapUrl"),
    ].forEach((el) => mountChild(contact, el));

    const imagesBlock = form.querySelector("[data-listing-images-block]");
    mountChild(images, imagesBlock);
    const imagesHeading = imagesBlock?.querySelector("[data-shop-store-images-heading]");
    if (imagesHeading) {
      imagesHeading.hidden = false;
      imagesHeading.setAttribute("aria-hidden", "false");
    }

    [
      closestField("bizExtraShopSales"),
      closestField("bizExtraShopBuyback"),
      closestField("bizExtraShopUsed"),
      closestField("bizExtraShopNew"),
      closestField("bizExtraShopVisitBuy"),
      closestField("bizExtraShopFreeAssessment"),
      closestField("bizExtraShopFastShip"),
      closestField("bizExtraShopCredit"),
      closestField("bizExtraShopCorporate"),
      closestField("bizExtraShopShowEstimate"),
      closestField("bizExtraShopShowPhone"),
    ].forEach((el) => mountChild(sales, el));

    const spacer = document.createElement("div");
    spacer.className = "post-shop-store-spacer";
    spacer.setAttribute("aria-hidden", "true");
    mountChild(sales, spacer);

    const productsSection = form.querySelector("[data-shop-products-section]");
    if (productsSection) {
      remember(productsSection);
      products.appendChild(productsSection);
      productsSection.classList.add("post-shop-store-card--products");
    }
    ensureShopProductsVisible(form, true);

    const serviceMenu = imagesBlock?.querySelector("[data-service-menu-section]");
    if (serviceMenu) {
      serviceMenu.hidden = true;
      serviceMenu.setAttribute("aria-hidden", "true");
      serviceMenu.querySelectorAll("input, textarea, select, button").forEach((el) => {
        el.disabled = true;
      });
    }
    const workCases = imagesBlock?.querySelector("[data-work-cases-section]");
    if (workCases) {
      workCases.hidden = true;
      workCases.setAttribute("aria-hidden", "true");
    }

    [form.querySelector("[data-biz-pr-plan-group]"), form.querySelector("[data-biz-featured-plan-group]")]
      .filter(Boolean)
      .forEach((el) => mountChild(options, el));

    form.querySelectorAll(STANDARD_HIDE).forEach((el) => {
      el.hidden = true;
      el.setAttribute("aria-hidden", "true");
    });

    flow.hidden = false;
    flow.setAttribute("aria-hidden", "false");
    document.body.classList.add("post--shop-store-flow");
    flow.querySelectorAll("input, textarea, select, button").forEach((el) => {
      if (!el.matches("[data-business-category-pick]")) el.disabled = false;
    });
    const galleryDrop = form.querySelector("[data-gallery-dropzone]");
    if (galleryDrop) {
      galleryDrop.setAttribute("aria-label", "店舗サブ画像をドロップまたは選択");
    }
    flowActive = true;
    window.TasuPostShopProducts?.initShopProductsForm?.(form);
    window.TasuPostShopProducts?.setBlockVisible?.(form, true);
  }

  function ensureContactMounted(form) {
    const contact = getMount(form, "contact");
    if (!contact) return;
    const hasAny = contact.querySelector(".post-field, p.post-field, .post-work-case__field");
    if (hasAny) return;
    [
      closestField("bizExtraShopStoreAddress"),
      closestField("bizExtraShopStoreClosed"),
      closestField("bizExtraShopStoreStation"),
      closestField("bizHpUrl"),
      closestField("bizGoogleMapUrl"),
    ].forEach((el) => mountChild(contact, el));
  }

  function ensureBasicMounted(form) {
    const basic = getMount(form, "basic");
    if (!basic) return;
    const hasAny = basic.querySelector(".post-field, p.post-field, .post-work-case__field");
    if (hasAny) return;
    const titleWrap = form.querySelector("[data-shop-store-title-field]") || closestField("listingTitle");
    [
      titleWrap,
      closestField("bizCompanyName"),
      closestField("bizExtraShopStoreCategory"),
      closestField("bizPhone"),
      closestField("bizServiceArea"),
      closestField("bizExtraShopStoreHours"),
      closestField("bizExtraShopStoreDesc"),
      form.querySelector("[data-shop-store-tags-field]") ||
        form.querySelector("#listingTags")?.closest(".post-field"),
    ].forEach((el) => mountChild(basic, el));
  }

  function ensureShopProductsVisible(form, visible) {
    const block = form?.querySelector("[data-shop-products-section]");
    if (!block) return;
    block.hidden = !visible;
    block.setAttribute("aria-hidden", visible ? "false" : "true");
    block.style.display = visible ? "" : "none";
    block.querySelectorAll("input, textarea, select, button").forEach((el) => {
      if (el.matches("[data-shop-products-add]")) {
        el.disabled = !visible;
        return;
      }
      if (el.closest("[data-shop-product-row]")) {
        el.disabled = !visible;
      }
    });
  }

  function unmountShopStoreFlow(form) {
    const flow = getFlow(form);
    if (!flow || !flowActive) return;

    const moved = flow.querySelectorAll(
      "[data-shop-mount] > *, [data-shop-mount] > .post-section"
    );
    Array.from(moved).forEach((el) => {
      if (el.classList?.contains("post-shop-store-spacer")) {
        el.remove();
        return;
      }
      restore(el);
    });

    form.querySelectorAll(STANDARD_HIDE).forEach((el) => {
      el.hidden = false;
      el.setAttribute("aria-hidden", "false");
    });

    const productsSection = form.querySelector("[data-shop-products-section]");
    if (productsSection) {
      productsSection.classList.remove("post-shop-store-card--products");
      productsSection.style.display = "";
    }
    ensureShopProductsVisible(form, false);

    flow.hidden = true;
    flow.setAttribute("aria-hidden", "true");
    document.body.classList.remove("post--shop-store-flow");
    flowActive = false;
  }

  function setActive(form, active) {
    if (!form) return;
    if (active) mountShopStoreFlow(form);
    else unmountShopStoreFlow(form);
  }

  window.TasuPostShopStoreLayout = {
    setActive,
    mountShopStoreFlow,
    unmountShopStoreFlow,
    ensureShopProductsVisible,
    ensureContactMounted,
    ensureBasicMounted,
    isActive: () => flowActive,
  };
})();
