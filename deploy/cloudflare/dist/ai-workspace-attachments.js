/**
 * TASFUL AI Workspace — 添付ファイル準備（Gateway / Vision 向け）
 */
(function (global) {
  "use strict";

  const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
  const MAX_TEXT_DOC_BYTES = 512 * 1024;
  const MAX_PDF_BYTES = 4 * 1024 * 1024;
  const MAX_FILES = 5;
  const MAX_TEXT_EXTRACT_CHARS = 12000;

  const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "webp"]);
  const TEXT_EXTS = new Set(["txt", "md", "csv", "json"]);
  const PDF_EXTS = new Set(["pdf"]);

  const IMAGE_MIMES = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
  };

  function extOf(name) {
    const m = String(name || "").toLowerCase().match(/\.([a-z0-9]+)$/);
    return m ? m[1] : "";
  }

  function readAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error || new Error("read_failed"));
      reader.readAsDataURL(file);
    });
  }

  function readAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error || new Error("read_failed"));
      reader.readAsText(file, "UTF-8");
    });
  }

  function stripDataUrlPrefix(dataUrl) {
    const s = String(dataUrl || "");
    const idx = s.indexOf(",");
    return idx >= 0 ? s.slice(idx + 1) : s;
  }

  function classifyFile(file) {
    const ext = extOf(file.name);
    if (IMAGE_EXTS.has(ext)) return "image";
    if (TEXT_EXTS.has(ext)) return "document";
    if (PDF_EXTS.has(ext)) return "pdf";
    return "";
  }

  async function prepareFromFileList(fileList) {
    const files = Array.from(fileList || []).slice(0, MAX_FILES);
    const attachments = [];
    const errors = [];

    for (const file of files) {
      const kind = classifyFile(file);
      if (!kind) {
        errors.push(`${file.name}: 非対応形式です（png/jpg/jpeg/webp/pdf/txt/md/csv/json）`);
        continue;
      }

      const sizeBytes = Number(file.size) || 0;
      if (kind === "image" && sizeBytes > MAX_IMAGE_BYTES) {
        errors.push(`${file.name}: 画像は ${Math.round(MAX_IMAGE_BYTES / (1024 * 1024))}MB 以下にしてください`);
        continue;
      }
      if (kind === "document" && sizeBytes > MAX_TEXT_DOC_BYTES) {
        errors.push(`${file.name}: 文書は ${Math.round(MAX_TEXT_DOC_BYTES / 1024)}KB 以下にしてください`);
        continue;
      }
      if (kind === "pdf" && sizeBytes > MAX_PDF_BYTES) {
        errors.push(`${file.name}: PDF は ${Math.round(MAX_PDF_BYTES / (1024 * 1024))}MB 以下にしてください`);
        continue;
      }

      try {
        if (kind === "image") {
          const ext = extOf(file.name);
          const dataUrl = await readAsDataURL(file);
          attachments.push({
            name: file.name,
            mimeType: IMAGE_MIMES[ext] || file.type || "image/png",
            kind: "image",
            base64: stripDataUrlPrefix(dataUrl),
            sizeBytes,
          });
        } else if (kind === "document") {
          const textContent = (await readAsText(file)).slice(0, MAX_TEXT_EXTRACT_CHARS);
          attachments.push({
            name: file.name,
            mimeType: file.type || "text/plain",
            kind: "document",
            textContent,
            sizeBytes,
          });
        } else if (kind === "pdf") {
          attachments.push({
            name: file.name,
            mimeType: "application/pdf",
            kind: "pdf",
            sizeBytes,
            note: "PDF本文解析は後続フェーズのため、ファイル名とサイズのみ受信しました。",
          });
        }
      } catch (err) {
        errors.push(`${file.name}: 読み込みに失敗しました`);
      }
    }

    return { attachments, errors, ok: attachments.length > 0 || errors.length === 0 };
  }

  function showComposerError(root, message) {
    const host = root || document.querySelector("[data-ai-workspace-chat]");
    if (!host) return;
    let el = host.querySelector("[data-ai-attach-error]");
    if (!el) {
      el = document.createElement("p");
      el.className = "ai-attach-error";
      el.dataset.aiAttachError = "1";
      el.setAttribute("role", "alert");
      const preview = host.querySelector("[data-ai-attach-preview]");
      preview?.parentElement?.insertBefore(el, preview?.nextSibling || null);
    }
    if (message) {
      el.textContent = String(message);
      el.hidden = false;
    } else {
      el.textContent = "";
      el.hidden = true;
    }
  }

  function clearComposerError(root) {
    showComposerError(root, null);
  }

  global.TasuAiWorkspaceAttachments = {
    MAX_IMAGE_BYTES,
    MAX_TEXT_DOC_BYTES,
    MAX_PDF_BYTES,
    MAX_FILES,
    prepareFromFileList,
    showComposerError,
    clearComposerError,
    classifyFile,
  };
})(typeof window !== "undefined" ? window : globalThis);
