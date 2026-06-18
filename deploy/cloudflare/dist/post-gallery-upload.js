/**
 * 掲載フォーム — サブ画像（ギャラリー）の複数選択・追加・D&D・プレビュー
 */
(function () {
  "use strict";

  const MAX_GALLERY_DEFAULT = 6;
  const MAX_GALLERY_ABSOLUTE = 8;
  let maxGallery = MAX_GALLERY_DEFAULT;
  const IMAGE_TYPES = /^image\/(jpeg|png|webp|gif)$/i;

  /** @type {{ id: string, file: File, url: string }[]} */
  let staged = [];
  /** @type {HTMLFormElement|null} */
  let formRef = null;
  /** @type {HTMLInputElement|null} */
  let inputRef = null;

  function isImageFile(file) {
    return file && (IMAGE_TYPES.test(file.type) || file.type.startsWith("image/"));
  }

  function fileKey(file) {
    return `${file.name}|${file.size}|${file.lastModified}`;
  }

  function addFiles(fileList) {
    const incoming = Array.from(fileList || []).filter(isImageFile);
    if (!incoming.length) return 0;

    const existingKeys = new Set(staged.map((item) => fileKey(item.file)));
    let added = 0;

    for (let i = 0; i < incoming.length; i += 1) {
      if (staged.length >= maxGallery) break;
      const file = incoming[i];
      const key = fileKey(file);
      if (existingKeys.has(key)) continue;
      existingKeys.add(key);
      staged.push({
        id: `gallery_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        file,
        url: URL.createObjectURL(file),
      });
      added += 1;
    }

    render();
    syncInput();
    return added;
  }

  function removeById(id) {
    const index = staged.findIndex((item) => item.id === id);
    if (index === -1) return;
    const item = staged[index];
    if (item.file) {
      URL.revokeObjectURL(item.url);
    }
    staged.splice(index, 1);
    render();
    syncInput();
  }

  function syncInput() {
    if (!inputRef) return;
    const dt = new DataTransfer();
    staged.forEach((item) => {
      if (item.file) {
        dt.items.add(item.file);
      }
    });
    inputRef.files = dt.files;
  }

  function render() {
    if (!formRef) return;

    const preview = formRef.querySelector("[data-gallery-preview]");
    const status = formRef.querySelector("[data-gallery-status]");
    const nameEl = formRef.querySelector("[data-gallery-file-name]");
    const dropzone = formRef.querySelector("[data-gallery-dropzone]");

    if (status) {
      status.textContent = `${staged.length} / ${maxGallery} 枚`;
    }

    if (nameEl) {
      const defaultText =
        nameEl.dataset.fileDefault || "複数選択可 · 最大6枚";
      nameEl.textContent = staged.length
        ? `${staged.length}枚選択済み（追加選択で追記できます）`
        : defaultText;
    }

    if (dropzone) {
      dropzone.classList.toggle("is-full", staged.length >= maxGallery);
      dropzone.classList.toggle("has-items", staged.length > 0);
    }

    if (!preview) return;

    preview.innerHTML = "";

    if (!staged.length) {
      preview.hidden = true;
      return;
    }

    preview.hidden = false;

    staged.forEach((item) => {
      const li = document.createElement("li");
      li.className = "post-gallery-upload__item";

      const img = document.createElement("img");
      img.src = item.externalUrl || item.url;
      img.alt = item.file?.name || `ギャラリー画像 ${item.id}`;
      img.loading = "lazy";
      img.onerror = () => {
        img.src = "https://placehold.co/120x90/f1f5f9/64748b?text=Image";
      };

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "post-gallery-upload__remove";
      btn.setAttribute("aria-label", `${item.file?.name || "画像"} を削除`);
      btn.textContent = "×";
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        removeById(item.id);
      });

      li.appendChild(img);
      li.appendChild(btn);
      preview.appendChild(li);
    });
  }

  function openFilePicker() {
    if (!inputRef || staged.length >= maxGallery) return;
    inputRef.click();
  }

  function initGalleryUpload(form) {
    formRef = form;
    const root = form.querySelector("[data-gallery-upload]");
    if (!root) return;

    inputRef = root.querySelector("[data-listing-gallery-images]");
    const dropzone = root.querySelector("[data-gallery-dropzone]");
    const browseBtn = root.querySelector("[data-gallery-browse]");

    if (!inputRef) return;

    inputRef.setAttribute("multiple", "multiple");
    inputRef.setAttribute(
      "accept",
      "image/jpeg,image/png,image/webp,image/gif,image/*"
    );

    inputRef.addEventListener("change", () => {
      if (inputRef.files?.length) {
        addFiles(inputRef.files);
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
        if (event.target.closest(".post-gallery-upload__remove")) return;
        if (event.target.closest("[data-gallery-browse]")) return;
        openFilePicker();
      });

      ["dragenter", "dragover"].forEach((type) => {
        dropzone.addEventListener(type, (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (staged.length < maxGallery) {
            dropzone.classList.add("is-dragover");
          }
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
        if (staged.length >= maxGallery) return;
        const files = event.dataTransfer?.files;
        if (files?.length) addFiles(files);
      });
    }

    render();
    syncInput();
  }

  function getStagedFiles() {
    syncInput();
    return staged.map((item) => item.file);
  }

  function clearStaged() {
    staged.forEach((item) => {
      if (item.file) {
        URL.revokeObjectURL(item.url);
      }
    });
    staged = [];
    render();
    syncInput();
  }

  function setMaxCount(count) {
    const next = Math.max(
      1,
      Math.min(MAX_GALLERY_ABSOLUTE, Number(count) || MAX_GALLERY_DEFAULT)
    );
    maxGallery = next;
    while (staged.length > maxGallery) {
      const last = staged[staged.length - 1];
      if (last?.file) {
        URL.revokeObjectURL(last.url);
      }
      staged.pop();
    }
    render();
    syncInput();
  }

  function setImageUrls(urls) {
    clearStaged();
    const list = (Array.isArray(urls) ? urls : [])
      .map((url) => String(url || "").trim())
      .filter(Boolean)
      .slice(0, maxGallery);

    list.forEach((url, index) => {
      staged.push({
        id: `gallery_url_${Date.now()}_${index}`,
        file: null,
        externalUrl: url,
        url,
      });
    });

    render();
    syncInput();
    return staged.length;
  }

  window.TasuPostGalleryUpload = {
    MAX_GALLERY: MAX_GALLERY_DEFAULT,
    getMaxCount: () => maxGallery,
    setMaxCount,
    initGalleryUpload,
    getStagedFiles,
    syncInput,
    clearStaged,
    addFiles,
    setImageUrls,
  };
})();
