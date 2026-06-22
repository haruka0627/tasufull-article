import { renderIwashoFooter, renderIwashoHeader } from "./iwasho-site-shell.mjs";
import { LEGAL_ENACTED, LEGAL_UPDATED } from "./iwasho-legal-content.mjs";

export function renderIwashoLegalPage(page) {
  const updatedDate = page.updatedDate ?? LEGAL_UPDATED;
  const tocItems = page.sections
    .map((s) => `<li><a href="#${s.id}">${s.title}</a></li>`)
    .join("\n            ");

  const relatedLinks = page.related
    .map((r) => `<a href="${r.href}">${r.label}</a>`)
    .join("\n            ");

  const articles = page.sections
    .map(
      (s) => `<article class="iw-legal-article iw-co-biz-card" id="${s.id}">
            <h2 class="iw-legal-article__title">${s.title}</h2>
            <div class="iw-legal-article__body">${s.body}</div>
          </article>`
    )
    .join("\n\n          ");

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${page.title} | IWASHO × TASFUL</title>
  <meta name="description" content="${page.metaDescription}" />
  <link rel="stylesheet" href="/tas-top-page.css" />
  <link rel="stylesheet" href="/corp-company-hp.css" />
  <link rel="stylesheet" href="/corp-layout.css" />
  <link rel="stylesheet" href="/corp-biz-home.css" />
  <link rel="stylesheet" href="/corp-biz-company.css" />
  <link rel="stylesheet" href="/corp-biz-legal.css" />
  <link rel="stylesheet" href="/corp-biz-mobile.css" />
</head>
<body class="corp-body corp-body--iwasho-company" data-corp="iwasho">
  <div class="iwasho-home-page iwasho-company-page iwasho-legal-page">
${renderIwashoHeader(null)}
<main>
      <section class="iw-legal-hero" aria-labelledby="iw-legal-hero-title">
        <div class="iw-legal-hero__inner">
          <h1 id="iw-legal-hero-title" class="iw-legal-hero__title">${page.title}</h1>
          <p class="iw-legal-hero__lead">${page.heroLead}</p>
        </div>
      </section>

      <section class="iw-legal-body" aria-label="${page.title} 本文">
        <div class="iw-co-container">
          <div class="iw-legal-stack">
            <nav class="iw-legal-toc iw-co-biz-card" aria-label="目次">
              <h2 class="iw-legal-toc__title">目次</h2>
              <ol class="iw-legal-toc__list">
            ${tocItems}
              </ol>
              <div class="iw-legal-related">
                <p class="iw-legal-related__label">関連規約</p>
                <div class="iw-legal-related__links">
            ${relatedLinks}
                </div>
              </div>
            </nav>

          ${articles}

            <p class="iw-legal-updated">最終更新日：${updatedDate} ／ 制定日：${LEGAL_ENACTED}</p>
          </div>
        </div>
      </section>
    </main>
${renderIwashoFooter()}
<script src="/iwasho/iwasho-home.js" defer></script>
  </div>
</body>
</html>
`;
}
