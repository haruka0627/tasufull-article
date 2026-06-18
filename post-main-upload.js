/**
 * 掲載フォーム — メイン画像（1枚）の選択・D&D・プレビュー
 */
(function () {
  "use strict";

  const IMAGE_TYPES = /^image\/(jpeg|png|webp|gif)$/i;

  /** @type {{ file: File, url: string } | null} */
  let staged = null;
  /** @type {HTMLFormElement|null} */
  let formRef = null;
  /** @type {HTMLInputElement|null} */
  let inputRef = null;

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

  function clearStaged() {
    if (staged?.url && staged?.file) {
      URL.revokeObjectURL(staged.url);
    }
    staged = null;
    render();
    syncInput();
  }

  function setFile(fileList) {
    const file = pickFirstImage(fileList);
    if (!file) return false;

    if (staged?.url && staged?.file) {
      URL.revokeObjectURL(staged.url);
    }

    staged = {
      file,
      url: URL.createObjectURL(file),
      externalUrl: null,
    };

    render();
    syncInput();
    return true;
  }

  function syncInput() {
    if (!inputRef) return;
    const dt = new DataTransfer();
    if (staged?.file) {
      dt.items.add(staged.file);
    }
    inputRef.files = dt.files;
  }

  function render() {
    if (!formRef) return;

    const preview = formRef.querySelector("[data-main-preview]");
    const nameEl = formRef.querySelector("[data-main-file-name]");
    const dropzone = formRef.querySelector("[data-main-dropzone]");

    if (nameEl) {
      const defaultText =
        nameEl.dataset.fileDefault || "JPG / PNG / WebP · 1枚";
      if (staged?.file) {
        nameEl.textContent = staged.file.name;
      } else if (staged?.externalUrl) {
        nameEl.textContent = "URL画像を設定済み";
      } else {
        nameEl.textContent = defaultText;
      }
    }

    if (dropzone) {
      dropzone.classList.toggle("has-item", Boolean(staged));
    }

    if (!preview) return;

    preview.innerHTML = "";

    if (!staged) {
      preview.hidden = true;
      return;
    }

    preview.hidden = false;

    const wrap = document.createElement("div");
    wrap.className = "post-main-upload__preview-item";

    const img = document.createElement("img");
    img.src = staged.externalUrl || staged.url;
    img.alt = staged.file?.name || "メイン画像プレビュー";
    img.loading = "lazy";
    img.onerror = () => {
      img.src = "https://placehold.co/400x300/f1f5f9/64748b?text=Image";
    };

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "post-main-upload__remove";
    btn.setAttribute("aria-label", "メイン画像を削除");
    btn.textContent = "×";
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      clearStaged();
    });

    wrap.appendChild(img);
    wrap.appendChild(btn);
    preview.appendChild(wrap);
  }

  function openFilePicker() {
    if (!inputRef) return;
    inputRef.click();
  }

  function initMainUpload(form) {
    formRef = form;
    const root = form.querySelector("[data-main-upload]");
    if (!root) return;

    inputRef = root.querySelector("[data-listing-main-image]");
    const dropzone = root.querySelector("[data-main-dropzone]");
    const browseBtn = root.querySelector("[data-main-browse]");

    if (!inputRef) return;

    inputRef.setAttribute("accept", "image/jpeg,image/png,image/webp,image/gif,image/*");

    inputRef.addEventListener("change", () => {
      if (inputRef.files?.length) {
        setFile(inputRef.files);
      }
      inputRef.value = "";
    });

    browseBtn?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openFilePicker();
    });

    if (dropzone) {
      dropzone.addEventListener("click", (event) => {
        if (event.target.closest(".post-main-upload__remove")) return;
        if (event.target.closest("[data-main-browse]")) return;
        openFilePicker();
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
        if (files?.length) setFile(files);
      });
    }

    render();
    syncInput();
  }

  function getStagedFile() {
    syncInput();
    return staged?.file || null;
  }

  function setImageUrl(url) {
    const trimmed = String(url || "").trim();
    if (!trimmed) return false;
    if (staged?.url && staged?.file) {
      URL.revokeObjectURL(staged.url);
    }
    staged = { externalUrl: trimmed, url: trimmed, file: null };
    render();
    syncInput();
    return true;
  }

  window.TasuPostMainUpload = {
    initMainUpload,
    getStagedFile,
    syncInput,
    clearStaged,
    setFile,
    setImageUrl,
  };
})();
