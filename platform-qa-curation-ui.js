/**
 * Q&A 整理管理UI（開発モード専用）
 */
(function (global) {
  "use strict";

  const Curation = () => global.PlatformQaCuration;
  const Data = () => global.PlatformQaData;
  const Admin = () => global.PlatformQaAdmin;

  const PAGE_SIZE = 50;

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function isEnabled() {
    return Curation()?.isEnabled?.() === true;
  }

  const REASON_LABELS = {
    title: "タイトル近似",
    question: "質問近似",
    keywords: "KW近似",
    "slug-base": "slug系",
    "short-answer": "短文",
    "generic-text": "汎用文",
    "no-related": "関連なし",
    "no-cta": "CTAなし",
    repetitive: "重複文言",
    "unnatural-title": "タイトル不自然",
    "unnatural-question": "質問不自然",
  };

  function renderBadges(reasons, issues) {
    const tags = [...(reasons || []), ...(issues || [])].slice(0, 4);
    if (!tags.length) return "";
    return tags
      .map(
        (t) =>
          `<span class="platform-qa-curation-badge platform-qa-curation-badge--${escapeHtml(t)}">${escapeHtml(REASON_LABELS[t] || t)}</span>`,
      )
      .join("");
  }

  function renderStatusOptions(current) {
    const labels = Curation().REVIEW_STATUS_LABELS;
    const statuses = Curation().REVIEW_STATUS;
    return Object.values(statuses)
      .map((value) => {
        const sel = value === current ? " selected" : "";
        return `<option value="${escapeHtml(value)}"${sel}>${escapeHtml(labels[value])}</option>`;
      })
      .join("");
  }

  function renderRow(row) {
    const { article, reviewStatus, duplicateReasons, qualityIssues, effectiveCategory, isDeleted, isArchived } =
      row;
    const disabled = isDeleted || isArchived ? " disabled" : "";
    const stateClass = isDeleted ? " is-deleted" : isArchived ? " is-archived" : "";
    return (
      `<tr class="platform-qa-curation-row${stateClass}" data-qa-curation-slug="${escapeHtml(article.slug)}">` +
      `<td class="platform-qa-curation-row__check"><input type="checkbox" class="platform-qa-curation-check" data-qa-curation-check value="${escapeHtml(article.slug)}"${disabled}></td>` +
      `<td class="platform-qa-curation-row__status"><select class="platform-qa-curation-status" data-qa-curation-status aria-label="レビュー状態">${renderStatusOptions(reviewStatus)}</select></td>` +
      `<td class="platform-qa-curation-row__main">` +
      `<a class="platform-qa-curation-row__title" href="${escapeHtml(Data().detailUrl(article.slug))}" target="_blank" rel="noopener">${escapeHtml(article.title)}</a>` +
      `<p class="platform-qa-curation-row__question">${escapeHtml(article.question)}</p>` +
      `<p class="platform-qa-curation-row__slug"><code>${escapeHtml(article.slug)}</code></p>` +
      `</td>` +
      `<td class="platform-qa-curation-row__meta">` +
      `<span class="platform-qa-curation-row__cat">${escapeHtml(Data().getCategoryListLabel(effectiveCategory))}</span>` +
      `<div class="platform-qa-curation-row__badges">${renderBadges(duplicateReasons, qualityIssues)}</div>` +
      `</td>` +
      `<td class="platform-qa-curation-row__actions">` +
      (isDeleted
        ? `<span class="platform-qa-curation-row__state">削除済</span>`
        : isArchived
          ? `<span class="platform-qa-curation-row__state">アーカイブ</span>`
          : `<button type="button" class="platform-qa-admin-btn platform-qa-admin-btn--delete" data-qa-curation-delete>削除</button>`) +
      `</td>` +
      `</tr>`
    );
  }

  function renderTabs(activeTab, counts) {
    return Curation()
      .TABS.map((tab) => {
        const active = tab.id === activeTab ? " is-active" : "";
        const count = counts[tab.id] ?? 0;
        return (
          `<button type="button" class="platform-qa-curation-tab${active}" data-qa-curation-tab="${escapeHtml(tab.id)}">` +
          `${escapeHtml(tab.label)} <span class="platform-qa-curation-tab__count">${count}</span>` +
          `</button>`
        );
      })
      .join("");
  }

  function renderCategoryOptions() {
    const cats = (Data()?.QA_CATEGORIES || []).filter((c) => c.id !== "all");
    return cats
      .map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.listLabel)}</option>`)
      .join("");
  }

  function mount(root, options) {
    if (!root || !isEnabled()) {
      if (root) {
        root.innerHTML =
          `<div class="platform-qa-curation-denied"><p>Q&amp;A整理管理は開発モード（<code>?qa_dev=1</code>）でのみ利用できます。</p><p><a href="/help/business-directory/">Business Directory ヘルプへ</a></p></div>`;
      }
      return null;
    }

    const state = {
      tab: options?.tab || "duplicates",
      page: 1,
      query: "",
      selected: new Set(),
    };

    const controller = {
      getState: () => state,
      render() {
        Curation().buildAnalysis();
        const counts = Curation().getTabCounts();
        let rows = Curation().listForTab(state.tab);
        if (state.query.trim()) {
          const q = state.query.trim().toLowerCase();
          rows = rows.filter(
            (r) =>
              r.article.title.toLowerCase().includes(q) ||
              r.article.question.toLowerCase().includes(q) ||
              r.article.slug.toLowerCase().includes(q),
          );
        }
        const total = rows.length;
        const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
        if (state.page > pages) state.page = pages;
        const start = (state.page - 1) * PAGE_SIZE;
        const pageRows = rows.slice(start, start + PAGE_SIZE);

        root.innerHTML =
          `<div class="platform-qa-curation" data-qa-curation-root>` +
          `<header class="platform-qa-curation-header">` +
          `<div class="platform-qa-curation-header__top">` +
          `<h1 class="platform-qa-curation-header__title">Q&amp;A 整理管理</h1>` +
          `<p class="platform-qa-curation-header__lead">重複・低品質候補を優先してレビュー（全${escapeHtml(String(Data()?.QA_ARTICLES?.length || 0))}件）</p>` +
          `<a class="platform-qa-curation-header__back" href="/help/business-directory/">← Business Directory ヘルプ</a>` +
          `</div>` +
          `<div class="platform-qa-curation-tabs" role="tablist">${renderTabs(state.tab, counts)}</div>` +
          `</header>` +
          `<div class="platform-qa-curation-toolbar">` +
          `<label class="platform-qa-curation-search">` +
          `<span class="visually-hidden">検索</span>` +
          `<input type="search" class="platform-qa-curation-search__input" data-qa-curation-search placeholder="タイトル・質問・slug" value="${escapeHtml(state.query)}">` +
          `</label>` +
          `<div class="platform-qa-curation-bulk">` +
          `<label class="platform-qa-curation-bulk__select"><input type="checkbox" data-qa-curation-select-page> ページ全選択</label>` +
          `<select class="platform-qa-curation-bulk__cat" data-qa-curation-bulk-cat aria-label="一括カテゴリ">` +
          `<option value="">カテゴリ変更…</option>${renderCategoryOptions()}</select>` +
          `<button type="button" class="platform-qa-admin-btn" data-qa-curation-bulk-archive>一括アーカイブ</button>` +
          `<button type="button" class="platform-qa-admin-btn platform-qa-admin-btn--delete" data-qa-curation-bulk-delete>一括削除</button>` +
          `<button type="button" class="platform-qa-admin-btn" data-qa-curation-bulk-keywords disabled title="今後実装予定">一括KW編集（準備中）</button>` +
          `</div>` +
          `</div>` +
          `<p class="platform-qa-curation-meta">${total}件 · ${state.page}/${pages}ページ</p>` +
          `<div class="platform-qa-curation-table-wrap">` +
          `<table class="platform-qa-curation-table">` +
          `<thead><tr>` +
          `<th scope="col"></th><th scope="col">状態</th><th scope="col">Q&amp;A</th><th scope="col">分類・フラグ</th><th scope="col">操作</th>` +
          `</tr></thead>` +
          `<tbody>${pageRows.map(renderRow).join("")}</tbody>` +
          `</table>` +
          `</div>` +
          `<nav class="platform-qa-curation-pager" aria-label="ページ">` +
          `<button type="button" class="platform-qa-admin-btn" data-qa-curation-prev ${state.page <= 1 ? "disabled" : ""}>前へ</button>` +
          `<button type="button" class="platform-qa-admin-btn" data-qa-curation-next ${state.page >= pages ? "disabled" : ""}>次へ</button>` +
          `</nav>` +
          `</div>`;

        bind(root, controller);
      },
    };

    controller.render();
    return controller;
  }

  function getSelectedSlugs(root) {
    return [...root.querySelectorAll("[data-qa-curation-check]:checked")].map((el) => el.value);
  }

  function bind(root, controller) {
    const el = root.querySelector("[data-qa-curation-root]");
    if (!el) return;

    el.querySelectorAll("[data-qa-curation-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        controller.getState().tab = btn.getAttribute("data-qa-curation-tab");
        controller.getState().page = 1;
        controller.getState().selected.clear();
        controller.render();
      });
    });

    const search = el.querySelector("[data-qa-curation-search]");
    if (search) {
      search.addEventListener("input", () => {
        controller.getState().query = search.value;
        controller.getState().page = 1;
        controller.render();
      });
    }

    el.querySelector("[data-qa-curation-prev]")?.addEventListener("click", () => {
      controller.getState().page -= 1;
      controller.render();
    });
    el.querySelector("[data-qa-curation-next]")?.addEventListener("click", () => {
      controller.getState().page += 1;
      controller.render();
    });

    el.querySelector("[data-qa-curation-select-page]")?.addEventListener("change", (e) => {
      const checked = e.target.checked;
      el.querySelectorAll("[data-qa-curation-check]:not(:disabled)").forEach((box) => {
        box.checked = checked;
      });
    });

    el.querySelector("[data-qa-curation-bulk-delete]")?.addEventListener("click", () => {
      const slugs = getSelectedSlugs(el);
      if (!slugs.length) return;
      if (!global.confirm(`${slugs.length}件を一括削除しますか？（ブラウザ内のみ）`)) return;
      Curation().bulkDelete(slugs);
      Curation().invalidateAnalysis();
      controller.render();
    });

    el.querySelector("[data-qa-curation-bulk-archive]")?.addEventListener("click", () => {
      const slugs = getSelectedSlugs(el);
      if (!slugs.length) return;
      if (!global.confirm(`${slugs.length}件を一括アーカイブしますか？`)) return;
      Curation().bulkArchive(slugs);
      Curation().invalidateAnalysis();
      controller.render();
    });

    el.querySelector("[data-qa-curation-bulk-cat]")?.addEventListener("change", (e) => {
      const cat = e.target.value;
      if (!cat) return;
      const slugs = getSelectedSlugs(el);
      if (!slugs.length) {
        global.alert("先にQ&Aを選択してください");
        e.target.value = "";
        return;
      }
      Curation().bulkSetCategory(slugs, cat);
      e.target.value = "";
      controller.render();
    });

    el.querySelectorAll("[data-qa-curation-status]").forEach((sel) => {
      sel.addEventListener("change", () => {
        const slug = sel.closest("[data-qa-curation-slug]")?.getAttribute("data-qa-curation-slug");
        if (!slug) return;
        Curation().setReviewStatus(slug, sel.value);
      });
    });

    el.querySelectorAll("[data-qa-curation-delete]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const slug = btn.closest("[data-qa-curation-slug]")?.getAttribute("data-qa-curation-slug");
        const article = Data()?.getRawBySlug?.(slug);
        if (!article || !Admin()?.confirmDelete?.(article)) return;
        Data()?.deleteArticle?.(slug);
        Curation().invalidateAnalysis();
        controller.render();
      });
    });

    Admin()?.bindActions?.(el);
  }

  global.PlatformQaCurationUI = { isEnabled, mount };
})(typeof window !== "undefined" ? window : globalThis);
