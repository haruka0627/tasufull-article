import {
  PLATFORM_SHELL_CSS,
  renderPlatformPortalFooter,
  renderPlatformPortalHeader,
} from "./platform-portal-shell.mjs";
import { renderTasfulAiIconHtml } from "./platform-qa-ai-icon-html.mjs";

function renderHead({ title, description }) {
  const shellCss = PLATFORM_SHELL_CSS.map((href) => `  <link rel="stylesheet" href="${href}">`).join("\n");
  const desc = description
    ? `  <meta name="description" content="${description}">`
    : "";
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
${desc}
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;600;700;800&display=swap" rel="stylesheet">
${shellCss}
  <link rel="stylesheet" href="/common-breadcrumb.css">
  <link rel="stylesheet" href="/platform-qa.css">
</head>`;
}

const QA_SCRIPTS = `  <script src="/breadcrumb-config.js"></script>
  <script src="/common-breadcrumb.js"></script>
  <script src="/platform-qa-articles.generated.js"></script>
  <script src="/platform-qa-keywords.generated.js"></script>
  <script src="/platform-qa-ai-icon.js"></script>
  <script src="/platform-qa-admin-config.js"></script>
  <script src="/platform-qa-admin-ui.js"></script>
  <script src="/platform-qa-data.js"></script>
  <script src="/platform-qa-article.js"></script>`;

function renderTail(pageScript) {
  return `  <div data-tasful-portal-tabbar-mount></div>
  <script src="/platform-portal-tabbar.js"></script>
${QA_SCRIPTS}
  <script src="${pageScript}"></script>
</body>
</html>
`;
}

export function renderHelpHubPage() {
  const header = renderPlatformPortalHeader({ activeNav: "guide" });
  const footer = renderPlatformPortalFooter();
  return `${renderHead({
    title: "TASFUL ヘルプ・Q&A",
    description: "会員登録、料金、応募、検索、利用ルールなど、TASFULの使い方をわかりやすくご案内します。",
  })}
<body class="platform-qa-help-page platform-qa-help-page--hub" data-page="help-index" data-breadcrumb-page-label="ヘルプ・Q&A">
${header}
  <main class="platform-qa-help-main platform-qa-hub-shell" id="main">
    <nav data-breadcrumb class="platform-qa-hub__breadcrumb tasu-common-breadcrumb tasu-common-breadcrumb--platform" aria-label="パンくず"></nav>

    <div class="platform-qa-hub">
      <section class="platform-qa-hub-hero" aria-labelledby="help-hub-title">
        <div class="platform-qa-hub-hero__inner">
          <div class="platform-qa-hub-hero__content">
            <h1 class="platform-qa-hub-hero__title" id="help-hub-title">TASFUL ヘルプ・Q&A</h1>
            <p class="platform-qa-hub-hero__lead">
              会員登録、料金、応募、検索、利用ルールなど、TASFULの使い方をわかりやすくご案内します。
            </p>
            <form class="platform-qa-hub-search" data-help-search-form role="search">
              <label class="platform-qa-hub-search__field">
                <span class="visually-hidden">Q&amp;Aを検索</span>
                <span class="platform-qa-hub-search__icon" aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
                </span>
                <input
                  type="search"
                  class="platform-qa-hub-search__input"
                  data-help-search-input
                  placeholder="知りたいことを入力してください"
                  autocomplete="off"
                >
              </label>
              <button type="submit" class="platform-qa-hub-search__btn">検索</button>
            </form>
          </div>
          <div class="platform-qa-hub-hero__visual" aria-hidden="true">
            <img
              class="platform-qa-hub-hero__img"
              src="/images/help/hero-pc-transparent.png"
              alt=""
              width="640"
              height="480"
              decoding="async"
            >
          </div>
        </div>
      </section>

      <section class="platform-qa-hub-block" aria-labelledby="help-categories-heading">
        <h2 class="platform-qa-hub-block__title" id="help-categories-heading">カテゴリから探す</h2>
        <div class="platform-qa-hub-categories" data-help-categories role="tablist" aria-label="カテゴリ"></div>
      </section>

      <section class="platform-qa-hub-block" aria-labelledby="help-popular-heading">
        <h2 class="platform-qa-hub-block__title" id="help-popular-heading">よく見られているQ&amp;A</h2>
        <div class="platform-qa-hub-popular" data-help-popular></div>
        <button type="button" class="platform-qa-hub-popular__more" data-help-popular-toggle hidden>
          <span data-help-popular-toggle-label>もっと見る</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
        </button>
      </section>

      <section class="platform-qa-hub-block" aria-labelledby="help-all-heading">
        <div class="platform-qa-hub-block__head">
          <div class="platform-qa-hub-block__head-main">
            <h2 class="platform-qa-hub-block__title" id="help-all-heading">すべてのQ&amp;A</h2>
            <p class="platform-qa-hub-search-meta" data-help-search-meta hidden></p>
          </div>
          <label class="platform-qa-hub-sort">
            <span class="visually-hidden">並び替え</span>
            <select class="platform-qa-hub-sort__select" data-help-sort aria-label="並び替え">
              <option value="relevance">関連度順</option>
              <option value="date-desc">新しい順</option>
              <option value="date-asc">古い順</option>
            </select>
          </label>
        </div>
        <div class="platform-qa-hub-list" data-help-list aria-live="polite"></div>
        <p class="platform-qa-hub-empty" data-help-empty hidden>該当するQ&amp;Aが見つかりませんでした。</p>
        <button type="button" class="platform-qa-hub-list__more" data-help-list-more hidden>
          <span data-help-list-more-label>もっと見る</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
        </button>
      </section>

      <section class="platform-qa-hub-ai-cta" aria-labelledby="help-ai-cta-title">
        <div class="platform-qa-hub-ai-cta__icon" aria-hidden="true">
          ${renderTasfulAiIconHtml("cta")}
        </div>
        <div class="platform-qa-hub-ai-cta__copy">
          <h2 class="platform-qa-hub-ai-cta__title" id="help-ai-cta-title">解決しない場合はAIに相談してみましょう</h2>
          <p class="platform-qa-hub-ai-cta__lead">AIがあなたの質問にお答えします。</p>
        </div>
        <a class="platform-qa-hub-ai-cta__btn" href="/ai-workspace.html">
          <span class="platform-qa-hub-ai-cta__btn-text">AIに相談する</span>
          <span aria-hidden="true">→</span>
        </a>
      </section>
    </div>
  </main>

${footer}
${renderTail("/help/help-index.js")}`;
}

/** @param {string} slug */
export function renderHelpDetailPage(slug) {
  const header = renderPlatformPortalHeader({ activeNav: "guide" });
  const footer = renderPlatformPortalFooter();
  return `${renderHead({ title: "ヘルプ記事 | TASFUL" })}
<body class="platform-qa-help-page platform-qa-help-page--detail" data-page="help-detail" data-qa-slug="${slug}">
${header}
  <main class="platform-qa-help-main platform-qa-detail-shell">
    <nav data-breadcrumb class="platform-qa-hub__breadcrumb tasu-common-breadcrumb tasu-common-breadcrumb--platform" aria-label="パンくず"></nav>
    <a class="platform-qa-detail-back" href="/help/">← ヘルプ・Q&amp;A一覧へ</a>
    <div class="platform-qa-detail-wrap" data-help-article-root aria-live="polite"></div>
  </main>

${footer}
${renderTail("/help/help-article.js")}`;
}
