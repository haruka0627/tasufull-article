/**
 * Generate detail-worker / detail-product / detail-job from detail-skill.html
 * Run: node scripts/build-detail-premium-pages.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const skillPath = path.join(root, "detail-skill.html");

const skillHtml = fs.readFileSync(skillPath, "utf8");
const styleMatch = skillHtml.match(/<style>([\s\S]*?)<\/style>/);
if (styleMatch) {
  fs.writeFileSync(
    path.join(root, "detail-premium-layout.css"),
    `/* Shared premium detail layout (skill / worker / product / job) */\n${styleMatch[1].trim()}\n`,
    "utf8"
  );
}

const sharedHeadLinks = `  <link rel="stylesheet" href="tasu-banner.css">
  <link rel="stylesheet" href="detail-trust-score.css">
  <link rel="stylesheet" href="detail-favorites.css">
  <link rel="stylesheet" href="listing-detail-page.css">
  <link rel="stylesheet" href="detail-skill-premium.css">
  <link rel="stylesheet" href="detail-bottom-sections.css">
  <link rel="stylesheet" href="detail-premium-layout.css">
  <link rel="stylesheet" href="detail-category.css">
  <link rel="stylesheet" href="seller-rank-plate.css">`;

const sharedScripts = `  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <script src="chat-supabase-config.js"></script>
  <script src="tasu-supabase-client.js"></script>
  <script src="chat-user-identity.js"></script>
  <script src="favorites-db.js"></script>
  <script src="chat-supabase.js"></script>
  <script src="detail-trust-score.js"></script>
  <script src="detail-favorites.js"></script>
  <script src="listing-tags.js"></script>
  <script src="listing-images.js"></script>
  <script src="listing-renderer.js"></script>
  <script src="listings-db.js"></script>
  <script src="listing-seller-profile.js"></script>
  <script src="listing-detail-loader.js"></script>
  <script src="detail-skill.js"></script>`;

function headBlock(title, extraCss = "") {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            page: '#F8F9FA',
            gold: { DEFAULT: '#F4D06F', dark: '#D4A63A', light: '#FFE7A3' },
          },
          fontFamily: {
            sans: ['"Noto Sans JP"', 'system-ui', 'sans-serif'],
          },
        },
      },
    };
  </script>
${sharedHeadLinks}
${extraCss}
</head>`;
}

function heroSection(cfg) {
  const priceBlock = cfg.hidePrice
    ? ""
    : `<p class="skill-cta-panel__label">${cfg.priceLabel}</p>
              <p class="skill-cta-panel__price">
                <span data-listing-price>${cfg.priceFallback}</span>
                <span class="skill-cta-panel__tax">（税込）</span>
              </p>`;

  const secondaryCta = cfg.secondaryCta
    ? `<a href="#" class="skill-cta-panel__secondary cta-consult">${cfg.secondaryCta}</a>`
    : "";

  return `      <section class="skill-hero-section skill-hero-premium mb-4 w-full overflow-hidden rounded-xl" data-detail-keep>
        <div class="skill-hero-premium__grid">
          <div class="skill-hero-premium__media">
            <p class="skill-hero-premium__media-label">${cfg.mediaLabel}</p>
            <figure class="listing-hero__figure skill-hero-premium__figure is-loading" data-listing-hero-figure>
              <img id="mainImage" data-listing-image alt="" width="640" height="800" decoding="async">
            </figure>
            <div class="skill-hero-premium__gallery" role="tablist" aria-label="掲載画像" data-listing-gallery hidden></div>
          </div>
          <div class="skill-hero-premium__center">
            <span class="skill-hero-premium__category" data-listing-category-badge>${cfg.categoryBadge}</span>
            <h1 class="skill-hero-premium__title" data-listing-service-name data-listing-title>${cfg.heroTitle}</h1>
            <p class="skill-hero-premium__subtitle" data-listing-subtitle>${cfg.heroSubtitle}</p>
            <div class="skill-hero-premium__tags" data-listing-tags aria-label="タグ"></div>
            <ul class="skill-hero-meta" data-listing-hero-meta aria-label="概要"></ul>
            <p class="skill-hero-premium__description" data-listing-description>${cfg.heroDescription}</p>
          </div>
          <aside class="skill-hero-premium__cta">
            <div class="skill-cta-panel">
              ${priceBlock}
              <p class="skill-cta-panel__label" data-listing-cta-heading>${cfg.ctaHeading}</p>
              <a href="#" class="skill-cta-panel__primary cta-consult" data-listing-primary-cta>${cfg.primaryCta}</a>
              ${secondaryCta}
              <button type="button" class="skill-cta-panel__favorite" data-favorite-button data-tasu-favorite data-target-id="" data-target-type="${cfg.favoriteType}">
                <svg class="h-4 w-4 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
                お気に入りに追加
              </button>
              <p class="skill-cta-panel__note" data-listing-cta-note>${cfg.ctaNote}</p>
            </div>
          </aside>
        </div>
      </section>`;
}

function detailsBlocks(blocks, sectionAttrs) {
  const body = blocks
    .map(
      (b) => `          <div class="skill-details-block" data-listing-${b.key}-block">
            <h3 class="skill-details-block__title">${b.title}</h3>
            <div class="skill-details-block__content${b.long ? " skill-details-block__content--long" : ""}" data-listing-${b.key}>${b.fallback}</div>
          </div>`
    )
    .join("\n");

  return `      <section id="section-details" class="section-anchor skill-details-premium skill-section-spaced mb-4" aria-labelledby="detailDetailsTitle" ${sectionAttrs} data-detail-keep>
        <header class="skill-details-premium__head">
          <span class="skill-details-premium__icon" aria-hidden="true">✨</span>
          <h2 id="detailDetailsTitle" class="skill-details-premium__title">詳細</h2>
        </header>
        <div class="skill-details-premium__body">
${body}
        </div>
      </section>`;
}

function sellerSection(cfg) {
  return `      <section id="section-seller" class="section-anchor skill-seller-premium skill-section-spaced" data-detail-keep data-listing-seller data-author-user-id="${cfg.authorId}" aria-labelledby="detailSellerTitle">
        <header class="skill-seller-premium__head skill-seller-premium__head--bar">
          <p class="skill-seller-premium__lead">${cfg.sellerLead}</p>
          <span class="skill-seller-premium__chip">信頼プロフィール</span>
        </header>
        <div class="skill-seller-premium__body seller-card-inner seller-card">
          <div class="seller-left seller-card-col seller-card-col--left">
            <h2 id="detailSellerTitle" class="seller-left__title skill-seller-premium__title">${cfg.sellerTitle}</h2>
            <div class="skill-seller-premium__avatar-wrap">
              <img data-seller-avatar src="https://placehold.co/160x160/f3ead4/967622?text=S" alt="出品者" class="skill-seller-premium__avatar profile-avatar rank-new" width="104" height="104" loading="lazy">
              <span class="skill-seller-premium__status-dot skill-seller-premium__status-dot--offline" data-seller-status-dot aria-label="稼働状況"></span>
            </div>
            <span class="seller-rank-chip rank-new" data-seller-rank-chip>NEW</span>
            <p class="seller-left__username skill-seller-premium__name seller-name rank-new" data-seller-display-name>出品者</p>
            <p class="seller-left__handle skill-seller-premium__handle" data-seller-handle>@—</p>
            <p class="seller-left__login skill-seller-premium__last-login" data-seller-last-login>最終ログイン：—</p>
          </div>
          <div class="seller-main seller-card-col seller-card-col--center skill-seller-premium__main">
            <div class="skill-seller-premium__block skill-seller-premium__block--tags seller-main__tags">
              <h4 class="skill-seller-premium__block-title">認証・信頼</h4>
              <div class="skill-seller-premium__badges seller-tags" data-seller-badges aria-label="認証・会員バッジ">
                <span class="skill-seller-badge tag-chip skill-seller-badge--muted">バッジ情報なし</span>
              </div>
            </div>
            <div class="skill-seller-premium__block skill-seller-premium__block--stats seller-main__stats">
              <h4 class="skill-seller-premium__block-title">実績</h4>
              <div class="skill-seller-premium__stats seller-stats-grid stats-grid" aria-label="統計">
                <div class="skill-seller-stat seller-stat">
                  <span class="skill-seller-stat__label seller-stat__label">総販売実績</span>
                  <strong class="skill-seller-stat__value seller-stat__value" data-seller-deals>—</strong>
                </div>
                <div class="skill-seller-stat seller-stat">
                  <span class="skill-seller-stat__label seller-stat__label">フォロワー</span>
                  <strong class="skill-seller-stat__value seller-stat__value" data-seller-followers>—</strong>
                </div>
                <div class="skill-seller-stat skill-seller-stat--rating seller-stat seller-stat--rating">
                  <span class="skill-seller-stat__label seller-stat__label">評価</span>
                  <p class="seller-stat__rating" data-seller-trust-anchor aria-label="評価">
                    <span data-seller-rating-value>—</span>
                    <span class="seller-stat__stars" data-seller-rating-stars aria-hidden="true"></span>
                  </p>
                  <span class="seller-stat__count" data-seller-rating-count></span>
                </div>
              </div>
            </div>
            <div class="skill-seller-premium__block skill-seller-premium__block--activity seller-main__activity">
              <h4 class="skill-seller-premium__block-title">対応・稼働情報</h4>
              <div class="skill-seller-premium__activity-grid status-grid">
                <div class="skill-seller-activity status-item"><span class="skill-seller-activity__label">平均返信</span><strong class="skill-seller-activity__value skill-seller-activity__value--accent" data-seller-response-time>—</strong></div>
                <div class="skill-seller-activity status-item"><span class="skill-seller-activity__label">返信状況</span><strong class="skill-seller-activity__value" data-seller-availability>—</strong></div>
                <div class="skill-seller-activity status-item"><span class="skill-seller-activity__label">稼働時間</span><strong class="skill-seller-activity__value" data-seller-work-hours>未設定</strong></div>
                <div class="skill-seller-activity status-item"><span class="skill-seller-activity__label">納品目安</span><strong class="skill-seller-activity__value" data-seller-delivery-estimate>—</strong></div>
                <div class="skill-seller-activity status-item"><span class="skill-seller-activity__label">ステータス</span><strong class="skill-seller-activity__value skill-seller-activity__value--status" data-seller-status-label>—</strong></div>
              </div>
            </div>
          </div>
          <aside class="seller-actions seller-card-col seller-card-col--right skill-seller-premium__actions seller-actions-col">
            <a href="#" class="skill-seller-premium__cta-primary cta-consult">${cfg.sellerPrimaryCta}</a>
            <button type="button" class="skill-seller-premium__cta-secondary"><svg class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg>フォロー</button>
            <a href="#otherServices" class="skill-seller-premium__cta-tertiary"><span>${cfg.sellerMoreLabel}</span><svg class="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg></a>
            <p class="seller-actions__note">ご相談は24時間以内に返信いたします</p>
          </aside>
        </div>
      </section>`;
}

function portfolioSection(label) {
  return `      <section id="section-portfolio" class="section-anchor skill-portfolio-premium skill-section-spaced overflow-hidden rounded-xl bg-white" data-detail-keep>
        <div class="skill-portfolio-premium__head">
          <h2 class="text-[15px] font-bold text-gray-800">${label}</h2>
          <span class="text-xs text-gray-400" data-listing-portfolio-count>—</span>
        </div>
        <div class="skill-portfolio-premium__track-wrap">
          <div class="skill-portfolio-premium__track" id="portfolioStrip" data-listing-portfolio-strip></div>
          <button type="button" class="skill-portfolio-premium__scroll-btn skill-portfolio-premium__scroll-btn--next" aria-label="次へ" data-scroll-target="portfolioStrip" data-scroll-dir="1">›</button>
        </div>
      </section>`;
}

function bottomSections(relatedTitle, relatedHref) {
  return `      <div class="detail-bottom-sections" data-detail-keep>
        <section id="section-reviews" class="section-anchor detail-bottom-card detail-reviews" data-detail-keep aria-labelledby="detailReviewsTitle">
          <header class="detail-bottom-card__head">
            <div class="detail-bottom-card__head-main">
              <h2 id="detailReviewsTitle" class="detail-bottom-card__title">口コミ・評価</h2>
              <a href="#" class="detail-bottom-card__more">もっと見る →</a>
            </div>
            <span class="detail-bottom-card__head-line" aria-hidden="true"></span>
          </header>
          <div class="detail-reviews__body">
            <div class="detail-reviews__summary">
              <p class="detail-reviews__summary-label">総合評価</p>
              <p class="detail-reviews__score" data-listing-review-average>—</p>
              <p class="detail-reviews__stars detail-gold-stars detail-gold-stars--lg" aria-hidden="true">★★★★★</p>
              <p class="detail-reviews__count">(<strong data-listing-review-count>0</strong>件)</p>
            </div>
            <div class="detail-reviews__cards-wrap">
              <div class="detail-reviews__cards" id="reviewsStrip" data-listing-reviews-strip></div>
            </div>
          </div>
        </section>
        <section id="otherServices" class="section-anchor detail-bottom-card detail-seller-services" data-detail-keep aria-labelledby="detailRelatedTitle">
          <header class="detail-bottom-card__head">
            <div class="detail-bottom-card__head-main">
              <h2 id="detailRelatedTitle" class="detail-bottom-card__title">${relatedTitle}</h2>
              <a href="${relatedHref}" class="detail-bottom-card__more">もっと見る →</a>
            </div>
            <span class="detail-bottom-card__head-line" aria-hidden="true"></span>
          </header>
          <div class="detail-seller-services__body">
            <div class="detail-seller-services__track-wrap">
              <button type="button" class="detail-strip-scroll-btn detail-strip-scroll-btn--prev" aria-label="前へ" data-scroll-target="otherServicesStrip" data-scroll-dir="-1">‹</button>
              <div class="detail-seller-services__track" id="otherServicesStrip" data-listing-other-services-strip></div>
              <button type="button" class="detail-strip-scroll-btn detail-strip-scroll-btn--next" aria-label="次へ" data-scroll-target="otherServicesStrip" data-scroll-dir="1">›</button>
            </div>
          </div>
        </section>
      </div>`;
}

function buildPage(cfg) {
  const nav = cfg.nav
    .map(
      (item, i) =>
        `<a href="${item.href}" class="section-nav__link${i === 0 ? " is-active" : ""}">${item.label}</a>`
    )
    .join("\n      ");

  const optionsSection = cfg.includeOptions
    ? `      <section
        id="section-options"
        class="section-anchor paid-options-section skill-section-spaced mb-4"
        data-detail-keep
        data-paid-options-root
        aria-labelledby="paidOptionsTitle"
        hidden
      >
        <div class="paid-options-card">
          <div class="paid-options-heading">
            <span class="paid-options-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 6h14l-1.25 9a1 1 0 01-1 .9H7.25a1 1 0 01-1-.9L6 6z"/>
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 6V4a2 2 0 012-2h8a2 2 0 012 2v2"/>
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 11h6"/>
              </svg>
            </span>
            <h2 id="paidOptionsTitle" class="paid-options-title">${cfg.optionsTitle || "有料オプション"}</h2>
          </div>
          <div class="paid-options-body">
            <div class="paid-options-layout">
              <div class="paid-options-list" id="optionList" role="list" aria-label="有料オプション一覧"></div>
              <aside class="paid-options-total" aria-live="polite">
                <span class="paid-options-total__accent" aria-hidden="true"></span>
                <span class="paid-options-total__label">合計金額</span>
                <strong id="optionTotal" class="paid-options-total__price">¥0</strong>
                <p class="paid-options-total__hint" data-options-hint>オプションを選択してください</p>
              </aside>
            </div>
          </div>
        </div>
      </section>`
    : "";

  const scripts = cfg.includeOptions
    ? `  <script type="application/json" id="listing-options-data">[]</script>
  <script src="listing-options.js"></script>
${sharedScripts}`
    : sharedScripts;

  return `${headBlock(cfg.docTitle, cfg.extraHead || "")}
<body class="min-h-screen bg-page font-sans text-gray-800 antialiased" data-detail-page="1" data-detail-type="${cfg.type}" data-listing-loaded="false">

  <div class="tasu-banner">
    <div class="tasu-text">
      🚀 <span class="logo">TASFUL</span>プラットへようこそ　
      <a href="/post" class="link">今月システム利用料5％！</a>　｜　
      <a href="/contact" class="link accent">AI無料キャンペーン中</a>
    </div>
  </div>

  <nav class="section-nav" aria-label="ページ内ナビゲーション">
    <div class="section-nav__inner">
      ${nav}
    </div>
  </nav>

  <div class="skill-detail-wrap mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
    <header class="page-subheader mb-5 flex items-center justify-between">
      <a href="index.html" class="text-sm text-gray-500 transition hover:text-gold-dark">← 一覧に戻る</a>
      <span class="text-sm font-bold text-gold-dark">TasuFull</span>
    </header>
    <main class="skill-detail-main w-full max-w-none">
${heroSection(cfg.hero)}
${detailsBlocks(cfg.details, cfg.detailsAttrs)}
${optionsSection}
${sellerSection(cfg.seller)}
${portfolioSection(cfg.portfolioLabel)}
${bottomSections(cfg.relatedTitle, cfg.relatedHref)}
    </main>
    <footer class="pb-8 text-center text-xs text-gray-400">© TasuFull — ${cfg.footerLabel}</footer>
  </div>
${scripts}
</body>
</html>
`;
}

const pages = {
  "detail-worker.html": buildPage({
    docTitle: "ワーカー詳細 | TasuFull",
    type: "worker",
    footerLabel: "ワーカーマーケットプレイス",
    nav: [
      { href: "#section-details", label: "詳細" },
      { href: "#section-seller", label: "ワーカー情報" },
      { href: "#section-portfolio", label: "ポートフォリオ" },
      { href: "#section-reviews", label: "口コミ・評価" },
    ],
    hero: {
      mediaLabel: "プロフィール写真",
      categoryBadge: "ワーカー",
      heroTitle: "ワーカー掲載",
      heroSubtitle: "ワーカーの概要をご確認ください",
      heroDescription: "説明はまだ登録されていません。",
      hidePrice: true,
      ctaHeading: "ワーカーに相談",
      primaryCta: "相談する",
      ctaNote: "ご相談は24時間以内に返信いたします",
      favoriteType: "worker",
    },
    details: [
      { key: "worker-profile", title: "プロフィール", fallback: "プロフィールはまだ登録されていません。" },
      { key: "worker-services", title: "対応業務", fallback: "対応業務は未登録です" },
      { key: "worker-area", title: "対応エリア", fallback: "要相談" },
      { key: "worker-hours", title: "稼働時間", fallback: "未設定" },
      { key: "worker-experience", title: "経験年数", fallback: "未登録" },
      { key: "worker-credentials", title: "資格・認証", fallback: "資格・認証情報は未登録です" },
    ],
    detailsAttrs: 'data-listing-worker-details',
    seller: {
      authorId: "u_hiro",
      sellerLead: "このワーカーのプロフィール",
      sellerTitle: "ワーカー情報",
      sellerPrimaryCta: "相談する",
      sellerMoreLabel: "関連ワーカーを見る",
    },
    portfolioLabel: "ポートフォリオ",
    relatedTitle: "関連ワーカー",
    relatedHref: "index.html#workers",
    includeOptions: false,
  }),
  "detail-product.html": buildPage({
    docTitle: "商品詳細 | TasuFull",
    type: "product",
    footerLabel: "商品マーケットプレイス",
    extraHead: '  <link rel="stylesheet" href="skill-paid-options.css">',
    nav: [
      { href: "#section-details", label: "商品説明" },
      { href: "#section-options", label: "有料オプション" },
      { href: "#section-seller", label: "出品者情報" },
      { href: "#section-portfolio", label: "ギャラリー" },
      { href: "#section-reviews", label: "商品レビュー" },
    ],
    optionsTitle: "追加オプション",
    includeOptions: true,
    hero: {
      mediaLabel: "商品画像",
      categoryBadge: "商品",
      heroTitle: "商品掲載",
      heroSubtitle: "商品の概要をご確認ください",
      heroDescription: "説明はまだ登録されていません。",
      hidePrice: false,
      priceLabel: "販売価格",
      priceFallback: "要相談",
      ctaHeading: "ご購入・ご相談",
      primaryCta: "購入する",
      secondaryCta: "相談する",
      ctaNote: "在庫・配送は詳細をご確認ください",
      favoriteType: "product",
    },
    details: [
      { key: "product-description", title: "商品説明", fallback: "商品説明はまだ登録されていません。", long: true },
      { key: "product-category", title: "カテゴリ", fallback: "カテゴリは未登録です" },
      { key: "product-condition", title: "状態", fallback: "状態は未登録です" },
      { key: "product-price-note", title: "価格", fallback: "価格は右パネルをご確認ください" },
      { key: "product-stock", title: "在庫・発送目安", fallback: "未登録" },
      { key: "product-specs", title: "仕様", fallback: "仕様情報は未登録です" },
      { key: "product-shipping", title: "配送・受け渡し", fallback: "配送・受け渡し方法は未登録です" },
    ],
    detailsAttrs: 'data-listing-product-details',
    seller: {
      authorId: "u_store",
      sellerLead: "この商品の出品者",
      sellerTitle: "出品者情報",
      sellerPrimaryCta: "購入・相談する",
      sellerMoreLabel: "他の商品を見る",
    },
    portfolioLabel: "商品ギャラリー",
    relatedTitle: "この出品者の他商品",
    relatedHref: "index.html#products",
  }),
  "detail-job.html": buildPage({
    docTitle: "求人詳細 | TasuFull",
    type: "job",
    footerLabel: "求人マーケットプレイス",
    nav: [
      { href: "#section-details", label: "募集内容" },
      { href: "#section-seller", label: "掲載企業" },
      { href: "#section-portfolio", label: "職場イメージ" },
      { href: "#section-reviews", label: "応募レビュー" },
    ],
    hero: {
      mediaLabel: "職場・チームイメージ",
      categoryBadge: "求人",
      heroTitle: "求人掲載",
      heroSubtitle: "募集内容の概要をご確認ください",
      heroDescription: "説明はまだ登録されていません。",
      hidePrice: false,
      priceLabel: "報酬（目安）",
      priceFallback: "要相談",
      ctaHeading: "応募・お問い合わせ",
      primaryCta: "応募する",
      secondaryCta: "質問する",
      ctaNote: "応募前のご質問もお気軽にどうぞ",
      favoriteType: "job",
    },
    details: [
      { key: "job-description", title: "仕事内容", fallback: "仕事内容はまだ登録されていません。", long: true },
      { key: "job-salary", title: "報酬", fallback: "報酬情報は未登録です" },
      { key: "job-conditions", title: "勤務条件", fallback: "勤務条件は未登録です" },
      { key: "job-location", title: "勤務地", fallback: "勤務地は未登録です" },
      { key: "job-requirements", title: "応募条件", fallback: "応募条件は未登録です" },
      { key: "job-company", title: "会社・掲載者情報", fallback: "会社情報は未登録です" },
    ],
    detailsAttrs: 'data-listing-job-details',
    seller: {
      authorId: "u_company",
      sellerLead: "募集企業・掲載者",
      sellerTitle: "会社・掲載者情報",
      sellerPrimaryCta: "応募する",
      sellerMoreLabel: "他の求人を見る",
    },
    portfolioLabel: "職場イメージ",
    relatedTitle: "関連求人",
    relatedHref: "index.html#jobs",
    includeOptions: false,
  }),
};

for (const [filename, html] of Object.entries(pages)) {
  fs.writeFileSync(path.join(root, filename), html, "utf8");
  console.log("wrote", filename);
}
