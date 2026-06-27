/**
 * AI秘書 Phase 6-H — Google Drive UI (read-only)
 */
(function (global) {
  "use strict";

  let mounted = false;
  const navState = { folderId: "", folderName: "", mimeType: "", preset: "recent" };

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function $(root, sel) {
    return (root || document).querySelector(sel);
  }

  function formatDate(raw) {
    const t = Date.parse(String(raw || ""));
    if (!Number.isFinite(t)) return esc(raw || "");
    try {
      return esc(
        new Date(t).toLocaleString("ja-JP", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    } catch {
      return esc(raw || "");
    }
  }

  function formatSize(bytes) {
    const n = Number(bytes || 0);
    if (!n) return "—";
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  }

  function kindLabel(kind) {
    const map = { folder: "フォルダ", doc: "Google ドキュメント", sheet: "スプレッドシート", slide: "スライド", pdf: "PDF", file: "ファイル" };
    return map[kind] || "ファイル";
  }

  function renderBreadcrumb(root) {
    const host = $(root, "[data-ops-secretary-drive-breadcrumb]");
    if (!host) return;
    const parts = [`<button type="button" class="ops-p3-action ops-secretary-gmail__chip" data-drive-nav="root">マイドライブ</button>`];
    if (navState.folderId) {
      parts.push(`<span class="ops-secretary-gmail__meta">${esc(navState.folderName || "フォルダ")}</span>`);
    }
    host.innerHTML = parts.join(" ");
    host.querySelector('[data-drive-nav="root"]')?.addEventListener("click", () => {
      navState.folderId = "";
      navState.folderName = "";
      void loadBrowse(root, { preset: navState.preset || "root", label: "マイドライブ" });
    });
  }

  function renderDetail(host, file, root) {
    if (!host) return;
    if (!file) {
      host.hidden = true;
      host.innerHTML = "";
      return;
    }
    host.hidden = false;
    const exportable = ["doc", "sheet", "slide"].includes(file.kind);
    host.innerHTML =
      `<article class="ops-secretary-gmail__card ops-secretary-drive__detail">` +
      `<header class="ops-secretary-gmail__card-head">` +
      `<strong class="ops-secretary-gmail__subject">${esc(file.name)}</strong>` +
      `<span class="ops-secretary-gmail__meta">${esc(kindLabel(file.kind))}</span>` +
      `</header>` +
      `<dl class="ops-secretary-calendar__detail-list">` +
      `<dt>更新日時</dt><dd>${formatDate(file.modifiedTime)}</dd>` +
      `<dt>サイズ</dt><dd>${esc(formatSize(file.size))}</dd>` +
      `<dt>mimeType</dt><dd>${esc(file.mimeType || "—")}</dd>` +
      `</dl>` +
      `<div class="ops-secretary-gmail__actions">` +
      (exportable
        ? `<button type="button" class="ops-p3-action" data-drive-action="export">テキスト抽出</button>`
        : "") +
      (file.webViewLink ? `<a class="ops-p3-action" href="${esc(file.webViewLink)}" target="_blank" rel="noopener noreferrer">Driveで開く</a>` : "") +
      `<button type="button" class="ops-p3-action" data-ops-drive-detail-close>閉じる</button>` +
      `</div>` +
      `<pre class="ops-secretary-drive__export-preview" data-drive-export-preview hidden></pre>` +
      `</article>`;
    host.querySelector("[data-ops-drive-detail-close]")?.addEventListener("click", () => {
      renderDetail(host, null, root);
    });
    host.querySelector('[data-drive-action="export"]')?.addEventListener("click", () => {
      void handleExport(root, file, host);
    });
  }

  async function handleExport(root, file, host) {
    const Client = global.TasuSecretaryGoogleDriveClient;
    const preview = host?.querySelector("[data-drive-export-preview]");
    if (!Client?.exportFileText || !preview) return;
    preview.hidden = false;
    preview.textContent = "抽出中…";
    const result = await Client.exportFileText(file.id);
    if (!result.ok) {
      preview.textContent = `抽出できませんでした: ${String(result.error || "failed")}`;
      return;
    }
    preview.textContent = String(result.data?.text || "（空）").slice(0, 8000);
  }

  function renderCards(host, files, root) {
    if (!host) return;
    files = Array.isArray(files) ? files : [];
    if (!files.length) {
      host.innerHTML = '<p class="ops-secretary-gmail__empty">ファイルはありません</p>';
      return;
    }
    host.innerHTML = files
      .map((f) => {
        return (
          `<article class="ops-secretary-gmail__card ops-secretary-drive__card" data-drive-id="${esc(f.id)}" data-drive-folder="${f.isFolder ? "1" : "0"}" tabindex="0" role="button">` +
          `<header class="ops-secretary-gmail__card-head">` +
          `<strong class="ops-secretary-gmail__subject">${esc(f.name)}</strong>` +
          `<span class="ops-secretary-gmail__meta">${esc(kindLabel(f.kind))} · ${formatDate(f.modifiedTime)}</span>` +
          `</header>` +
          `<p class="ops-secretary-gmail__snippet">${f.isFolder ? "フォルダ" : esc(formatSize(f.size))}</p>` +
          `</article>`
        );
      })
      .join("");
    host.__files = files;
    host.querySelectorAll("[data-drive-id]").forEach((card) => {
      const open = () => {
        const id = card.getAttribute("data-drive-id");
        const hit = (host.__files || []).find((f) => f.id === id);
        if (!hit) return;
        if (hit.isFolder) {
          navState.folderId = hit.id;
          navState.folderName = hit.name;
          void loadBrowse(root, { folderId: hit.id, label: hit.name });
          return;
        }
        renderDetail($(root, "[data-ops-secretary-drive-detail]"), hit, root);
      };
      card.addEventListener("click", open);
      card.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          open();
        }
      });
    });
  }

  async function loadBrowse(root, options) {
    options = options || {};
    const Client = global.TasuSecretaryGoogleDriveClient;
    const host = $(root, "[data-ops-secretary-drive-cards]");
    const status = $(root, "[data-ops-secretary-drive-status]");
    if (!Client?.listFiles || !host) return;
    if (options.preset) navState.preset = options.preset;
    if (options.mimeType !== undefined) navState.mimeType = options.mimeType || "";
    if (options.folderId !== undefined) {
      navState.folderId = options.folderId || "";
      if (!options.folderId) navState.folderName = "";
    }
    renderBreadcrumb(root);
    if (status) status.textContent = `${options.label || "Drive"}を読込中…`;
    host.innerHTML = '<p class="ops-secretary-gmail__empty">読込中…</p>';
    renderDetail($(root, "[data-ops-secretary-drive-detail]"), null, root);
    const result = await Client.listFiles({
      preset: navState.folderId ? undefined : options.preset || navState.preset || PRESET_FALLBACK(),
      folderId: navState.folderId || undefined,
      mimeType: navState.mimeType || undefined,
      q: options.q || undefined,
      maxResults: 25,
    });
    if (!result.ok) {
      if (status) status.textContent = `Drive エラー: ${String(result.error || "failed").slice(0, 80)}`;
      host.innerHTML = '<p class="ops-secretary-gmail__empty">Drive を読み込めませんでした</p>';
      return;
    }
    const files = result.data?.files || [];
    renderCards(host, files, root);
    const mock = result.data?.mock ? " · mock" : "";
    if (status) status.textContent = `${options.label || "Drive"} ${files.length} 件${mock}`;
  }

  function PRESET_FALLBACK() {
    return global.TasuSecretaryGoogleDriveClient?.PRESETS?.recent || "recent";
  }

  function bindControls(root) {
    const Client = global.TasuSecretaryGoogleDriveClient;
    if (!Client) return;

    root.querySelectorAll("[data-ops-secretary-drive-preset]").forEach((btn) => {
      if (btn.dataset.bound === "1") return;
      btn.dataset.bound = "1";
      btn.addEventListener("click", () => {
        navState.folderId = "";
        navState.folderName = "";
        const preset = btn.getAttribute("data-ops-secretary-drive-preset") || "recent";
        void loadBrowse(root, { preset, label: btn.textContent?.trim() || preset });
      });
    });

    root.querySelectorAll("[data-ops-secretary-drive-mime]").forEach((btn) => {
      if (btn.dataset.bound === "1") return;
      btn.dataset.bound = "1";
      btn.addEventListener("click", () => {
        const mime = btn.getAttribute("data-ops-secretary-drive-mime") || "";
        void loadBrowse(root, { mimeType: mime, label: btn.textContent?.trim() || "フィルタ" });
      });
    });

    const searchForm = $(root, "[data-ops-secretary-drive-search-form]");
    if (searchForm && searchForm.dataset.bound !== "1") {
      searchForm.dataset.bound = "1";
      searchForm.addEventListener("submit", (ev) => {
        ev.preventDefault();
        const input = $(root, "[data-ops-secretary-drive-search-input]");
        const q = String(input?.value || "").trim();
        if (!q) {
          void loadBrowse(root, { preset: navState.preset || "recent", label: "最近のファイル" });
          return;
        }
        void loadBrowse(root, { q, label: `検索 ${q.slice(0, 24)}` });
      });
    }
  }

  function mount(root) {
    root = root || document.querySelector("[data-ops-secretary-drive-panel]");
    if (!root || mounted) return;
    mounted = true;
    bindControls(root);
    void loadBrowse(root, { preset: "recent", label: "最近のファイル" });
  }

  global.TasuSecretaryGoogleDriveUI = {
    mount,
    loadBrowse,
    renderCards,
    renderDetail,
  };
})(typeof window !== "undefined" ? window : globalThis);
