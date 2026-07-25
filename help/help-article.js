(function () {
  "use strict";

  const Data = window.PlatformQaData;
  const Article = window.PlatformQaArticle;
  const Admin = window.PlatformQaAdmin;
  const root = document.querySelector("[data-help-article-root]");
  if (!Data || !Article || !root) return;

  const adminMode = Admin?.isEnabled?.() === true;
  if (adminMode) Admin?.applyBodyClass?.();

  function resolveSlug() {
    const preset = document.body?.getAttribute("data-qa-slug");
    if (preset) return preset.trim();

    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get("slug");
    if (fromQuery) return fromQuery.trim();

    const reserved = new Set(["", "index", "view", "view.html", "article", "article.html"]);
    const match = window.location.pathname.match(/\/help\/([^/]+)\/?$/);
    if (match && !reserved.has(match[1])) {
      return decodeURIComponent(match[1]);
    }
    return "";
  }

  function formatDate(iso) {
    if (!iso) return "";
    const [y, m, d] = iso.split("-");
    if (!y || !m || !d) return iso;
    return `${y}年${Number(m)}月${Number(d)}日`;
  }

  function initBreadcrumb(articleTitle) {
    const bc = window.TasuCommonBreadcrumb;
    if (!bc?.setTrail) return;
    bc.setTrail(
      [
        { label: "ホーム", href: "/index-top.html" },
        { label: "ヘルプ・Q&A", href: "/help/" },
        { label: articleTitle || "記事" },
      ],
      { replace: true, source: "help-detail" },
    );
  }

  function renderNotFound(slug) {
    document.title = "記事が見つかりません | TASFUL ヘルプ・Q&A";
    initBreadcrumb("記事が見つかりません");
    root.innerHTML =
      `<div class="platform-qa-hub-empty">` +
      `<p>「${Article.escapeHtml(slug)}」に該当するQ&amp;A記事が見つかりませんでした。</p>` +
      `<p><a href="/help/">ヘルプ・Q&A一覧へ戻る</a></p>` +
      `</div>`;
  }

  function renderRelatedQa(article) {
    const slugs = article.relatedQaSlugs || [];
    const items = slugs.map((s) => Data.getBySlug(s)).filter(Boolean);
    if (!items.length) return "";
    return (
      `<section class="platform-qa-detail-related-qa" aria-labelledby="help-related-qa">` +
      `<h2 class="platform-qa-detail-related-qa__title" id="help-related-qa">関連Q&amp;A</h2>` +
      `<div class="platform-qa-detail-related-qa__grid">` +
      items
        .map(
          (item) =>
            `<a class="platform-qa-detail-related-card" href="${Article.escapeHtml(Data.detailUrl(item.slug))}">` +
            `<span class="platform-qa-detail-related-card__title">${Article.escapeHtml(item.title)}</span>` +
            `<span class="platform-qa-detail-related-card__action">詳しく見る →</span>` +
            `</a>`,
        )
        .join("") +
      `</div>` +
      `</section>`
    );
  }

  function renderNav(article) {
    const { prev, next } = Data.getNeighbors(article.slug);
    if (!prev && !next) return "";
    const prevHtml = prev
      ? `<a class="platform-qa-detail-nav__item platform-qa-detail-nav__item--prev" href="${Article.escapeHtml(Data.detailUrl(prev.slug))}">` +
        `<span class="platform-qa-detail-nav__dir">◀ 前の記事</span>` +
        `<span class="platform-qa-detail-nav__title">${Article.escapeHtml(prev.title)}</span>` +
        `</a>`
      : `<span class="platform-qa-detail-nav__spacer" aria-hidden="true"></span>`;
    const nextHtml = next
      ? `<a class="platform-qa-detail-nav__item platform-qa-detail-nav__item--next" href="${Article.escapeHtml(Data.detailUrl(next.slug))}">` +
        `<span class="platform-qa-detail-nav__dir">次の記事 ▶</span>` +
        `<span class="platform-qa-detail-nav__title">${Article.escapeHtml(next.title)}</span>` +
        `</a>`
      : `<span class="platform-qa-detail-nav__spacer" aria-hidden="true"></span>`;
    return (
      `<nav class="platform-qa-detail-nav" aria-label="前後のQ&amp;A">` +
      prevHtml +
      nextHtml +
      `</nav>`
    );
  }

  const slug = resolveSlug();
  const article = Data.getBySlug(slug);
  if (!article) {
    renderNotFound(slug);
    return;
  }

  document.title = `${article.title} | TASFUL ヘルプ・Q&A`;
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute("content", article.summary);
  initBreadcrumb(article.title);

  let adminPrefix = "";
  if (adminMode && Admin) {
    if (Admin.renderBannerHtml) adminPrefix += Admin.renderBannerHtml();
    if (Admin.renderActionsHtml) {
      adminPrefix += `<div class="platform-qa-admin-detail-actions">${Admin.renderActionsHtml(article)}</div>`;
    }
  }

  root.innerHTML =
    adminPrefix +
    Article.buildResultHtml(article, { includeHeader: true, showIndex: false }) +
    `<div class="platform-qa-detail-meta">` +
    `<span>更新日: ${Article.escapeHtml(formatDate(article.updatedAt))}</span>` +
    `<span>カテゴリ: ${Article.escapeHtml(Data.getCategoryListLabel(article.category))}</span>` +
    `<span>Q&amp;Aは随時更新されます</span>` +
    `</div>` +
    renderRelatedQa(article) +
    renderNav(article);

  if (adminMode) {
    Admin?.bindActions?.(root, {
      onDeleted: () => {
        window.location.href = "/help/";
      },
    });
  }

  Article.bindFeedback(root);
})();
