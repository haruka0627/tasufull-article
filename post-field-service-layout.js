/**
 * 業務サービス（field_service）専用フォーム — 詳細ページと同じ順でフィールドをマウント
 */
(function () {
  "use strict";

  const ANCHORS = new WeakMap();
  let flowActive = false;

  const STANDARD_HIDE =
    "[data-post-order='10'], [data-business-category-extras-wrap], [data-business-standard-panel], [data-business-job-conditions], [data-shop-products-section], [data-shop-store-flow], [data-business-section='pr']";

  function remember(el) {
    if (!el || ANCHORS.has(el)) return;
    ANCHORS.set(el, { parent: el.parentNode, next: el.nextSibling });
  }

  function stripNativeRequired(root) {
    if (!root) return;
    root.querySelectorAll("[required]").forEach((el) => {
      el.removeAttribute("required");
      el.dataset.fsStrippedRequired = "1";
    });
  }

  function restoreNativeRequired(root) {
    if (!root) return;
    root.querySelectorAll("[data-fs-stripped-required]").forEach((el) => {
      el.setAttribute("required", "");
      delete el.dataset.fsStrippedRequired;
    });
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
  }

  function closestField(id) {
    const node = document.getElementById(id);
    return node?.closest(".post-field") || node?.closest("p.post-field") || node?.parentElement;
  }

  function getFlow(form) {
    return form?.querySelector("[data-field-service-flow]");
  }

  function getMount(form, key) {
    return form?.querySelector(`[data-fs-mount="${key}"]`);
  }

  function moveSectionBody(form, mount, sectionSelector) {
    const section = form?.querySelector(sectionSelector);
    if (!section || !mount) return;
    const body = section.querySelector(".post-section__body");
    if (!body) return;
    remember(section);
    while (body.firstChild) {
      mount.appendChild(body.firstChild);
    }
    section.remove();
  }

  function relabelAchievementGallery(form) {
    const galleryLabel = form.querySelector("[data-gallery-label]");
    const galleryHint = form.querySelector("[data-gallery-field-hint]");
    const galleryStatus = form.querySelector("[data-gallery-status]");
    const mainLabel = form.querySelector("[data-main-image-label]");
    if (mainLabel) mainLabel.textContent = "メイン画像";
    if (galleryLabel) galleryLabel.textContent = "サブ画像（ギャラリー）";
    if (galleryHint) {
      galleryHint.textContent =
        "作業風景・施工事例などの追加写真。詳細ページギャラリーに表示（最大8枚）。";
    }
    if (galleryStatus && galleryStatus.textContent.includes("6")) {
      galleryStatus.textContent = galleryStatus.textContent.replace("6", "8");
    }
    const drop = form.querySelector("[data-gallery-dropzone]");
    if (drop) drop.setAttribute("aria-label", "サブ画像をドロップまたは選択");
    const fileName = form.querySelector("[data-gallery-file-name]");
    if (fileName) fileName.textContent = "複数選択可 · 最大8枚";
  }

  function remountFieldServiceFields(form) {
    const flow = getFlow(form);
    if (!flow) return;

    window.TasuPostFieldServiceForm?.ensureFieldServiceFormSections?.(form);

    const basic = getMount(form, "basic");
    const images = getMount(form, "images");
    const contact = getMount(form, "contact");
    const ads = getMount(form, "ads");

    [
      closestField("bizCompanyName"),
      form.querySelector("[data-fs-title-field]") || closestField("listingTitle"),
      form.querySelector("[data-fs-catch-copy-field]") || closestField("fsCatchCopy"),
      form.querySelector("[data-fs-service-desc-field]") ||
        closestField("bizExtraFieldServiceDesc") ||
        form.querySelector("[data-common-description-field]"),
      form.querySelector("[data-fs-tags-field]") ||
        form.querySelector("[data-shop-store-tags-field]") ||
        form.querySelector("#listingTags")?.closest(".post-field"),
    ].forEach((el) => mountChild(basic, el));

    const catchCopyField = form.querySelector("[data-fs-catch-copy-field]");
    if (catchCopyField) {
      catchCopyField.hidden = false;
      catchCopyField.removeAttribute("aria-hidden");
    }
    const titleWrap = form.querySelector("[data-fs-title-field]") || closestField("listingTitle");
    if (titleWrap) {
      titleWrap.hidden = false;
      titleWrap.removeAttribute("aria-hidden");
    }

    const imagesBlock = form.querySelector("[data-listing-images-block]");
    if (imagesBlock) {
      const mainUpload = imagesBlock.querySelector("[data-main-upload]");
      const galleryUpload = imagesBlock.querySelector("[data-gallery-upload]");
      if (mainUpload) mountChild(images, mainUpload);
      if (galleryUpload) mountChild(images, galleryUpload);
      images
        .querySelectorAll(
          ".post-main-upload__dropzone, .post-gallery-upload__dropzone"
        )
        .forEach((zone) => zone.classList.add("post-fs-upload-dropzone"));
    }
    relabelAchievementGallery(form);
    window.TasuPostGalleryUpload?.setMaxCount?.(8);

    moveSectionBody(form, getMount(form, "menu"), "[data-service-menu-section]");
    moveSectionBody(form, getMount(form, "cases"), "[data-work-cases-section]");
    moveSectionBody(form, ads, "[data-business-section='pr']");

    form.querySelectorAll("[data-fs-contact-field]").forEach((el) => mountChild(contact, el));

    ["#fsCtaEstimateText", "#fsCtaInquiryText"].forEach((sel) => {
      const el = form.querySelector(sel)?.closest(".post-field");
      if (el && contact?.contains(el)) contact.appendChild(el);
    });

    form.querySelectorAll(STANDARD_HIDE).forEach((el) => {
      el.hidden = true;
      el.setAttribute("aria-hidden", "true");
      stripNativeRequired(el);
      el.querySelectorAll("input, textarea, select, button").forEach((field) => {
        if (!field.matches("[data-business-category-pick]")) field.disabled = true;
      });
    });

    const hiddenCommonDesc = form.querySelector("[data-common-description-field]");
    if (hiddenCommonDesc?.hidden || hiddenCommonDesc?.getAttribute("aria-hidden") === "true") {
      stripNativeRequired(hiddenCommonDesc);
    }

    flow.hidden = false;
    flow.setAttribute("aria-hidden", "false");
    flow.classList.remove("is-hidden");
    if (flow.style) flow.style.display = "";
    document.body.classList.add("post--field-service-flow");
    flow.querySelectorAll("input, textarea, select, button").forEach((el) => {
      if (!el.matches("[data-business-category-pick]")) el.disabled = false;
    });

    window.TasuPostShopProducts?.setBlockVisible?.(form, false);
    ensureServiceMenuVisible(form, true);
    window.TasuPostFieldServiceForm?.seedFieldServiceDefaults?.(form);
  }

  function mountFieldServiceFlow(form) {
    const flow = getFlow(form);
    if (!flow) return;
    remountFieldServiceFields(form);
    flowActive = true;
  }

  function ensureServiceMenuVisible(form, visible) {
    const block = form?.querySelector("[data-service-menu-list]")?.closest("[data-fs-mount='menu']");
    if (!block) return;
    block.querySelectorAll("input, textarea, select, button").forEach((el) => {
      if (el.matches("[data-service-menu-add]")) {
        el.disabled = !visible;
        return;
      }
      if (el.closest("[data-service-menu-row]")) el.disabled = !visible;
    });
  }

  function unmountFieldServiceFlow(form) {
    const flow = getFlow(form);
    if (!flow || !flowActive) return;

    const moved = flow.querySelectorAll(
      "[data-fs-mount] > *, [data-fs-mount] > .post-section, [data-fs-form-built]"
    );
    Array.from(moved).forEach((el) => {
      if (el.matches("[data-fs-form-built]")) {
        el.remove();
        return;
      }
      restore(el);
    });

    form.querySelectorAll(STANDARD_HIDE).forEach((el) => {
      el.hidden = false;
      el.removeAttribute("aria-hidden");
      restoreNativeRequired(el);
      el.querySelectorAll("input, textarea, select, button").forEach((field) => {
        field.disabled = false;
      });
    });
    const hiddenCommonDesc = form.querySelector("[data-common-description-field]");
    if (hiddenCommonDesc) restoreNativeRequired(hiddenCommonDesc);

    const catchCopyField = form.querySelector("[data-fs-catch-copy-field]");
    if (catchCopyField) {
      catchCopyField.hidden = true;
      catchCopyField.setAttribute("aria-hidden", "true");
    }

    window.TasuPostGalleryUpload?.setMaxCount?.(6);
    flow.hidden = true;
    flow.setAttribute("aria-hidden", "true");
    document.body.classList.remove("post--field-service-flow");
    flowActive = false;
    ensureServiceMenuVisible(form, false);
  }

  function setActive(form, active) {
    if (!form) return;
    if (active) mountFieldServiceFlow(form);
    else unmountFieldServiceFlow(form);
  }

  window.TasuPostFieldServiceLayout = {
    setActive,
    mountFieldServiceFlow,
    remountFieldServiceFields,
    unmountFieldServiceFlow,
    ensureServiceMenuVisible,
    isActive: () => flowActive,
  };
})();
