/**
 * 掲載フォーム — 行単位画像アップロード（メイン画像と同じUI）
 */
(function () {
  "use strict";

  const IMAGE_TYPES = /^image\/(jpeg|png|webp|gif)$/i;

  /** @type {WeakMap<HTMLElement, { file: File|null, url: string|null, existingUrl: string }>} */
  const stagedByHost = new WeakMap();

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

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /**
   * @param {object} opts
   * @param {string} opts.label
   * @param {string} opts.hiddenAttr - data-* for hidden input
   * @param {string} opts.dropzoneAttr
   * @param {string} opts.inputAttr
   * @param {string} opts.previewAttr
   * @param {string} opts.fileNameAttr
   * @param {string} opts.browseAttr
   * @param {string} [opts.existingUrl]
   * @param {string} [opts.hint]
   */
  function buildMarkup(opts) {
    const label = opts.label || "画像";
    const hint =
      opts.hint ||
      "実際の施工写真・許可証・資料画像などを登録してください。";
    const hiddenVal = escapeHtml(opts.existingUrl || "");
    return `
      <div class="post-fs-image-field post-work-case__field post-work-case__field--full">
        <span class="post-fs-image-field__label">${escapeHtml(label)}</span>
        <p class="post-fs-field-hint">${escapeHtml(hint)}</p>
        <div class="post-fs-image-upload" data-fs-image-upload>
          <div class="post-main-upload__dropzone post-fs-upload-dropzone" ${opts.dropzoneAttr} role="button" tabindex="0" aria-label="${escapeHtml(label)}をドロップまたは選択">
            <input type="file" class="post-main-upload__input" ${opts.inputAttr} tabindex="-1" aria-hidden="true" accept="image/jpeg,image/png,image/webp,image/gif,image/*">
            <input type="hidden" ${opts.hiddenAttr} value="${hiddenVal}">
            <span class="post-fs-upload-icon" aria-hidden="true">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 16V8M12 8L9 11M12 8L15 11" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M4 16.5V17.5C4 18.8807 5.11929 20 6.5 20H17.5C18.8807 20 20 18.8807 20 17.5V16.5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
                <rect x="4" y="4" width="16" height="12" rx="2" stroke="currentColor" stroke-width="1.75"/>
              </svg>
            </span>
            <span class="post-main-upload__title">クリックまたはドラッグ&amp;ドロップ</span>
            <span class="post-main-upload__name" ${opts.fileNameAttr} data-file-default="JPG / PNG / WebP · 1枚">JPG / PNG / WebP · 1枚</span>
            <button type="button" class="post-main-upload__browse" ${opts.browseAttr}>画像を選択</button>
          </div>
          <div class="post-main-upload__preview" ${opts.previewAttr} hidden aria-label="選択済み画像"></div>
        </div>
      </div>`;
  }

  function getState(host) {
    if (!host) return null;
    let state = stagedByHost.get(host);
    if (!state) {
      state = { file: null, url: null, existingUrl: "" };
      stagedByHost.set(host, state);
    }
    return state;
  }

  function revokeBlob(state) {
    if (state?.url && state.url.startsWith("blob:")) {
      URL.revokeObjectURL(state.url);
    }
  }

  function render(host) {
    const state = getState(host);
    if (!state) return;
    const preview = host.querySelector("[data-fs-image-preview]");
    const nameEl = host.querySelector("[data-fs-image-file-name]");
    const dropzone = host.querySelector("[data-fs-image-dropzone]");
    const hasVisual = Boolean(state.file || state.existingUrl);

    if (nameEl) {
      const defaultText = nameEl.dataset.fileDefault || "JPG / PNG / WebP · 1枚";
      nameEl.textContent = state.file ? state.file.name : defaultText;
    }
    if (dropzone) dropzone.classList.toggle("has-item", hasVisual);
    if (!preview) return;
    preview.innerHTML = "";
    if (!hasVisual) {
      preview.hidden = true;
      return;
    }
    preview.hidden = false;
    const wrap = document.createElement("div");
    wrap.className = "post-main-upload__preview-item post-fs-preview-thumb";
    const img = document.createElement("img");
    img.src = state.url || state.existingUrl;
    img.alt = state.file?.name || "画像";
    img.loading = "lazy";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "post-main-upload__remove";
    btn.setAttribute("aria-label", "画像を削除");
    btn.textContent = "×";
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      clear(host);
    });
    wrap.appendChild(img);
    wrap.appendChild(btn);
    preview.appendChild(wrap);
  }

  function syncInput(host) {
    const state = getState(host);
    const input = host.querySelector("[data-fs-image-input]");
    if (!input || !state) return;
    const dt = new DataTransfer();
    if (state.file) dt.items.add(state.file);
    input.files = dt.files;
  }

  function clear(host) {
    const state = getState(host);
    if (!state) return;
    revokeBlob(state);
    state.file = null;
    state.url = null;
    state.existingUrl = "";
    const hidden = host.querySelector("[data-fs-image-url]");
    if (hidden) hidden.value = "";
    render(host);
    syncInput(host);
  }

  function setFile(host, fileList) {
    const file = pickFirstImage(fileList);
    if (!file) return false;
    const state = getState(host);
    revokeBlob(state);
    state.file = file;
    state.url = URL.createObjectURL(file);
    state.existingUrl = "";
    const hidden = host.querySelector("[data-fs-image-url]");
    if (hidden) hidden.value = "";
    render(host);
    syncInput(host);
    return true;
  }

  function setExistingUrl(host, url) {
    const state = getState(host);
    const trimmed = String(url || "").trim();
    revokeBlob(state);
    state.file = null;
    state.url = null;
    state.existingUrl = trimmed;
    const hidden = host.querySelector("[data-fs-image-url]");
    if (hidden) hidden.value = trimmed;
    render(host);
    syncInput(host);
  }

  function bind(host) {
    if (!host || host.dataset.fsImageUploadBound === "1") return;
    host.dataset.fsImageUploadBound = "1";
    const input = host.querySelector("[data-fs-image-input]");
    const dropzone = host.querySelector("[data-fs-image-dropzone]");
    const browseBtn = host.querySelector("[data-fs-image-browse]");
    if (!input) return;

    input.addEventListener("change", () => {
      if (input.files?.length) setFile(host, input.files);
      input.value = "";
    });
    browseBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      input.click();
    });
    if (dropzone) {
      dropzone.addEventListener("click", (e) => {
        if (e.target.closest(".post-main-upload__remove")) return;
        if (e.target.closest("[data-fs-image-browse]")) return;
        input.click();
      });
      ["dragenter", "dragover"].forEach((type) => {
        dropzone.addEventListener(type, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.classList.add("is-dragover");
        });
      });
      ["dragleave", "drop"].forEach((type) => {
        dropzone.addEventListener(type, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.classList.remove("is-dragover");
        });
      });
      dropzone.addEventListener("drop", (e) => {
        const files = e.dataTransfer?.files;
        if (files?.length) setFile(host, files);
      });
    }
    render(host);
    syncInput(host);
  }

  function init(host, options = {}) {
    if (!host) return;
    getState(host);
    if (options.existingUrl) setExistingUrl(host, options.existingUrl);
    bind(host);
  }

  function getStagedFile(host) {
    return getState(host)?.file || null;
  }

  function destroy(host) {
    const state = stagedByHost.get(host);
    if (state) revokeBlob(state);
    stagedByHost.delete(host);
  }

  window.TasuPostImageUploadSlot = {
    buildMarkup,
    init,
    clear,
    setExistingUrl,
    getStagedFile,
    destroy,
  };
})();
