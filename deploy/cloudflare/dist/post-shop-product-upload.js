/**
 * 掲載フォーム — 店舗・販売の商品画像（商品カードごとに1枚）
 */
(function () {
  "use strict";

  const IMAGE_TYPES = /^image\/(jpeg|png|webp|gif)$/i;

  /** @type {WeakMap<HTMLElement, { file: File|null, url: string|null, existingUrl: string }>} */
  const stagedByRow = new WeakMap();

  function isImageFile(file) {
    return file && (IMAGE_TYPES.test(file.type) || file.type.startsWith("image/"));
  }

  function pickFirstImage(fileList) {
    const list = Array.from(fileList || []);
    for (let i = 0; i < list.length; i += 1) {
      if (isImageFile(list[i])) return list[i];
    }
    return null;
  }

  function getState(row) {
    if (!row) return null;
    let state = stagedByRow.get(row);
    if (!state) {
      state = { file: null, url: null, existingUrl: "" };
      stagedByRow.set(row, state);
    }
    return state;
  }

  function revokeBlob(state) {
    if (state?.url && state.url.startsWith("blob:")) {
      URL.revokeObjectURL(state.url);
    }
  }

  function renderRow(row) {
    const state = getState(row);
    if (!state) return;

    const root = row.querySelector("[data-shop-product-upload]");
    if (!root) return;

    const preview = root.querySelector("[data-shop-product-preview]");
    const nameEl = root.querySelector("[data-shop-product-file-name]");
    const dropzone = root.querySelector("[data-shop-product-dropzone]");
    const actions = root.querySelector("[data-shop-product-image-actions]");
    const changeBtn = root.querySelector("[data-shop-product-change]");
    const removeBtn = root.querySelector("[data-shop-product-remove-image]");
    const hasVisual = Boolean(state.file || state.existingUrl);

    if (nameEl) {
      const defaultText = nameEl.dataset.fileDefault || "JPG / PNG / WebP · 1枚";
      nameEl.textContent = state.file ? state.file.name : defaultText;
    }

    if (dropzone) {
      dropzone.classList.toggle("has-item", hasVisual);
      dropzone.hidden = hasVisual;
    }

    if (actions) actions.hidden = !hasVisual;
    if (changeBtn) changeBtn.hidden = !hasVisual;
    if (removeBtn) removeBtn.hidden = !hasVisual;

    if (!preview) return;
    preview.innerHTML = "";

    if (!hasVisual) {
      preview.hidden = true;
      return;
    }

    preview.hidden = false;
    const wrap = document.createElement("div");
    wrap.className = "post-main-upload__preview-item";

    const img = document.createElement("img");
    img.src = state.url || state.existingUrl;
    img.alt = state.file?.name || "商品画像";
    img.loading = "lazy";

    wrap.appendChild(img);
    preview.appendChild(wrap);
  }

  function syncInput(row) {
    const state = getState(row);
    const input = row?.querySelector("[data-shop-product-image-input]");
    if (!input || !state) return;
    const dt = new DataTransfer();
    if (state.file) dt.items.add(state.file);
    input.files = dt.files;
  }

  function clearRow(row) {
    const state = getState(row);
    if (!state) return;
    revokeBlob(state);
    state.file = null;
    state.url = null;
    state.existingUrl = "";
    const hidden = row.querySelector("[data-shop-product-image-url]");
    if (hidden) hidden.value = "";
    renderRow(row);
    syncInput(row);
  }

  function setFile(row, fileList) {
    const file = pickFirstImage(fileList);
    if (!file) return false;
    const state = getState(row);
    revokeBlob(state);
    state.file = file;
    state.url = URL.createObjectURL(file);
    state.existingUrl = "";
    const hidden = row.querySelector("[data-shop-product-image-url]");
    if (hidden) hidden.value = "";
    renderRow(row);
    syncInput(row);
    return true;
  }

  function setExistingUrl(row, url) {
    const state = getState(row);
    const trimmed = String(url || "").trim();
    revokeBlob(state);
    state.file = null;
    state.url = null;
    state.existingUrl = trimmed;
    const hidden = row.querySelector("[data-shop-product-image-url]");
    if (hidden) hidden.value = trimmed;
    renderRow(row);
    syncInput(row);
  }

  function openFilePicker(row) {
    row?.querySelector("[data-shop-product-image-input]")?.click();
  }

  function bindRow(row) {
    const root = row.querySelector("[data-shop-product-upload]");
    if (!root || root.dataset.shopProductUploadBound === "1") return;
    root.dataset.shopProductUploadBound = "1";

    const input = row.querySelector("[data-shop-product-image-input]");
    const dropzone = root.querySelector("[data-shop-product-dropzone]");
    const browseBtn = root.querySelector("[data-shop-product-browse]");
    const changeBtn = root.querySelector("[data-shop-product-change]");
    const removeBtn = root.querySelector("[data-shop-product-remove-image]");

    if (!input) return;
    input.setAttribute("accept", "image/jpeg,image/png,image/webp,image/gif,image/*");

    input.addEventListener("change", () => {
      if (input.files?.length) setFile(row, input.files);
      input.value = "";
    });

    browseBtn?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openFilePicker(row);
    });

    changeBtn?.addEventListener("click", (event) => {
      event.preventDefault();
      openFilePicker(row);
    });

    removeBtn?.addEventListener("click", (event) => {
      event.preventDefault();
      clearRow(row);
    });

    if (dropzone) {
      dropzone.addEventListener("click", (event) => {
        if (event.target.closest("[data-shop-product-browse]")) return;
        openFilePicker(row);
      });

      ["dragenter", "dragover"].forEach((type) => {
        dropzone.addEventListener(type, (event) => {
          event.preventDefault();
          event.stopPropagation();
          dropzone.classList.add("is-dragover");
        });
      });

      ["dragleave", "drop"].forEach((type) => {
        dropzone.addEventListener(type, (event) => {
          event.preventDefault();
          event.stopPropagation();
          dropzone.classList.remove("is-dragover");
        });
      });

      dropzone.addEventListener("drop", (event) => {
        const files = event.dataTransfer?.files;
        if (files?.length) setFile(row, files);
      });
    }

    renderRow(row);
    syncInput(row);
  }

  function initRow(row, options = {}) {
    if (!row) return;
    getState(row);
    if (options.existingUrl) {
      setExistingUrl(row, options.existingUrl);
    }
    bindRow(row);
  }

  function destroyRow(row) {
    const state = stagedByRow.get(row);
    if (state) revokeBlob(state);
    stagedByRow.delete(row);
  }

  function getStagedFile(row) {
    syncInput(row);
    return getState(row)?.file || null;
  }

  function getExistingUrl(row) {
    const hidden = row.querySelector("[data-shop-product-image-url]");
    const fromHidden = hidden?.value?.trim() || "";
    const fromState = getState(row)?.existingUrl || "";
    return fromHidden || fromState;
  }

  function rowHasImage(row) {
    return Boolean(getStagedFile(row) || getExistingUrl(row));
  }

  window.TasuPostShopProductUpload = {
    initRow,
    destroyRow,
    clearRow,
    setFile,
    setExistingUrl,
    getStagedFile,
    getExistingUrl,
    rowHasImage,
  };
})();
