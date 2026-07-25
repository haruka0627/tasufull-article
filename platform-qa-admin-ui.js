/**
 * Q&A 管理UI — PlatformQaAdminConfig が有効なときのみ描画・操作
 * 本番ビルドではこのファイル自体が dist に含まれない
 */
(function (global) {
  "use strict";

  const Config = () => global.PlatformQaAdminConfig;

  function isEnabled() {
    return Config()?.isAdminUiEnabled?.() === true;
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function resolveArticle(articleOrSlug) {
    const Data = global.PlatformQaData;
    if (!articleOrSlug) return null;
    if (typeof articleOrSlug === "object") return articleOrSlug;
    return Data?.getBySlug?.(articleOrSlug) || { slug: articleOrSlug };
  }

  function applyBodyClass() {
    if (typeof document === "undefined") return;
    document.body?.classList.toggle("platform-qa-admin-mode", isEnabled());
  }

  function confirmDelete(article) {
    if (!article) return false;
    const title = article.title || article.label || article.slug;
    const question = article.question || article.query || "";
    const id = article.id ? `\nID: ${article.id}` : "";
    return global.confirm(
      `以下のQ&Aを削除しますか？${id}\n\n「${title}」\n${question}\n\n※ 整理用: このブラウザ内のみ反映されます`,
    );
  }

  function renderActionsHtml(articleOrSlug) {
    if (!isEnabled()) return "";
    const article = resolveArticle(articleOrSlug);
    if (!article?.slug) return "";
    const idHtml = article.id
      ? `<span class="platform-qa-admin-id" title="Q&amp;A ID">#${escapeHtml(article.id)}</span>`
      : "";
    return (
      `<div class="platform-qa-admin-actions" data-qa-admin-actions data-qa-slug="${escapeHtml(article.slug)}">` +
      idHtml +
      `<button type="button" class="platform-qa-admin-btn platform-qa-admin-btn--edit" disabled title="今後実装予定">編集</button>` +
      `<button type="button" class="platform-qa-admin-btn platform-qa-admin-btn--delete" data-qa-admin-delete>削除</button>` +
      `</div>`
    );
  }

  function renderBannerHtml() {
    if (!isEnabled()) return "";
    const Data = global.PlatformQaData;
    const stats = Data?.getStats?.() || {};
    const deleted = Data?.getDeletedCount?.() ?? 0;
    const qaDev = Config()?.getQaDevQuery?.();
    const modeLabel = qaDev === true ? "qa_dev=1" : "開発モード";
    return (
      `<div class="platform-qa-admin-banner" role="status" data-qa-admin-banner>` +
      `<strong>Q&amp;A 整理モード</strong>` +
      `<span class="platform-qa-admin-banner__meta">` +
      `表示 ${escapeHtml(String(stats.articleCount ?? 0))}件` +
      (deleted ? ` · 削除済み ${escapeHtml(String(deleted))}件` : "") +
      ` · ${escapeHtml(modeLabel)}` +
      `</span>` +
      `<span class="platform-qa-admin-banner__hint">不要なQ&amp;Aは「削除」で整理（ブラウザ内のみ）</span>` +
      `<div class="platform-qa-admin-banner__tools">` +
      `<button type="button" class="platform-qa-admin-btn platform-qa-admin-btn--export" data-qa-admin-export-lines title="改行区切りでコピー（catalog seed 除去用）">削除リストをコピー</button>` +
      `<button type="button" class="platform-qa-admin-btn platform-qa-admin-btn--export" data-qa-admin-export-json title="JSON配列でコピー">JSONでコピー</button>` +
      `<span class="platform-qa-admin-banner__copy-status" data-qa-admin-export-status hidden role="status"></span>` +
      `</div>` +
      `</div>`
    );
  }

  async function copyExportText(text, statusEl) {
    if (!text) {
      if (statusEl) {
        statusEl.hidden = false;
        statusEl.textContent = "削除済み slug はありません";
        global.setTimeout(() => {
          statusEl.hidden = true;
        }, 2200);
      }
      return false;
    }
    try {
      if (global.navigator?.clipboard?.writeText) {
        await global.navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
      }
      if (statusEl) {
        statusEl.hidden = false;
        statusEl.textContent = "コピーしました";
        global.setTimeout(() => {
          statusEl.hidden = true;
        }, 2200);
      }
      return true;
    } catch {
      if (statusEl) {
        statusEl.hidden = false;
        statusEl.textContent = "コピーに失敗しました";
      }
      return false;
    }
  }

  function bindBanner(root) {
    if (!root || !isEnabled()) return;
    const Data = global.PlatformQaData;
    const statusEl = root.querySelector("[data-qa-admin-export-status]");

    root.querySelectorAll("[data-qa-admin-export-lines]").forEach((btn) => {
      if (btn.dataset.qaAdminBound === "1") return;
      btn.dataset.qaAdminBound = "1";
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        const text = Data?.exportDeletedSlugs?.("lines") || "";
        await copyExportText(text, statusEl);
      });
    });

    root.querySelectorAll("[data-qa-admin-export-json]").forEach((btn) => {
      if (btn.dataset.qaAdminBound === "1") return;
      btn.dataset.qaAdminBound = "1";
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        const text = Data?.exportDeletedSlugs?.("json") || "[]";
        await copyExportText(text, statusEl);
      });
    });
  }

  function mountBanner(container) {
    if (!container || !isEnabled()) return;
    const existing = document.querySelector("[data-qa-admin-banner]");
    if (existing) existing.remove();
    const html = renderBannerHtml();
    if (!html) return;
    container.insertAdjacentHTML("afterbegin", html);
    const banner = document.querySelector("[data-qa-admin-banner]");
    if (banner) bindBanner(banner);
  }

  function refreshBanner() {
    const banner = document.querySelector("[data-qa-admin-banner]");
    if (!banner || !isEnabled()) return;
    banner.outerHTML = renderBannerHtml();
    const next = document.querySelector("[data-qa-admin-banner]");
    if (next) bindBanner(next);
  }

  function bindActions(root, options) {
    if (!root || !isEnabled()) return;
    const Data = global.PlatformQaData;
    if (!Data?.deleteArticle) return;

    root.querySelectorAll("[data-qa-admin-delete]").forEach((btn) => {
      if (btn.dataset.qaAdminBound === "1") return;
      btn.dataset.qaAdminBound = "1";
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const slug = btn.closest("[data-qa-admin-actions]")?.getAttribute("data-qa-slug");
        if (!slug) return;
        const article = Data.getBySlug(slug);
        if (!article) return;
        if (!confirmDelete(article)) return;
        if (!Data.deleteArticle(slug)) return;
        if (typeof options?.onDeleted === "function") {
          options.onDeleted(slug, article);
        }
      });
    });
  }

  applyBodyClass();

  global.PlatformQaAdmin = {
    isEnabled,
    applyBodyClass,
    confirmDelete,
    renderActionsHtml,
    renderBannerHtml,
    mountBanner,
    refreshBanner,
    bindBanner,
    bindActions,
  };
})(typeof window !== "undefined" ? window : globalThis);
