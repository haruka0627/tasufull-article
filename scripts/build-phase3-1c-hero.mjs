import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
let html = fs.readFileSync(path.join(root, "scripts/tas-hero-fragment.html"), "utf8");

const pairs = [
  ["tas-hero__cards", "top-pillar-grid hero-main-cards hero-cards"],
  ["tas-hero__card tas-hero__card--general", "top-pillar-card top-pillar-card--general"],
  ["tas-hero__card tas-hero__card--business", "top-pillar-card top-pillar-card--business"],
  ["tas-hero__card tas-hero__card--ai", "top-pillar-card top-pillar-card--ai ai-card"],
  ["tas-hero__badge", "top-pillar-card__badge"],
  ["tas-hero__card-title", "top-pillar-card__title"],
  ["tas-hero__card-sub", "top-pillar-card__sub"],
  ["tas-hero__cats", "top-pillar-cats top-pillar-cats--row"],
  ["tas-hero__cat-icon--skill", "top-pillar-cat__icon top-pillar-cat__icon--skill"],
  ["tas-hero__cat-icon--product", "top-pillar-cat__icon top-pillar-cat__icon--product"],
  ["tas-hero__cat-icon--worker", "top-pillar-cat__icon top-pillar-cat__icon--worker"],
  ["tas-hero__cat-icon--job", "top-pillar-cat__icon top-pillar-cat__icon--job"],
  ["tas-hero__cat-icon", "top-pillar-cat__icon"],
  ["tas-hero__cat-label", "top-pillar-cat__label"],
  ["tas-hero__cat-hint", "top-pillar-cat__hint"],
  ["tas-hero__cat", "top-pillar-cat"],
  ["tas-hero__card-body", "top-pillar-card__body"],
  ["tas-hero__list--ai", "top-pillar-card__list top-pillar-card__list--ai"],
  ["tas-hero__list", "top-pillar-card__list"],
  ["tas-hero__price-label", "top-pillar-card__price-label"],
  ["tas-hero__price-value", "top-pillar-card__price-value"],
  ["tas-hero__price", "top-pillar-card__price"],
  ["tas-hero__actions", "top-pillar-card__actions"],
  ["tas-hero__btn--pink-ghost", "top-pillar-btn top-pillar-btn--ghost"],
  ["tas-hero__btn--pink", "top-pillar-btn top-pillar-btn--primary"],
  ["tas-hero__btn--teal-ghost", "top-pillar-btn top-pillar-btn--ghost-teal"],
  ["tas-hero__btn--teal", "top-pillar-btn top-pillar-btn--teal"],
  ["tas-hero__btn--ai-ghost", "top-pillar-btn top-pillar-btn--ai-ghost"],
  ["tas-hero__btn--ai", "top-pillar-btn top-pillar-btn--ai"],
  ["tas-hero__btn-arrow", "top-pillar-btn__arrow"],
  ["tas-hero__btn", "top-pillar-btn"],
  ["tas-hero__biz-icon--more", "top-pillar-biz__icon top-pillar-biz__icon--more"],
  ["tas-hero__biz-icon", "top-pillar-biz__icon"],
  ["tas-hero__biz-label", "top-pillar-biz__label"],
  ["tas-hero__biz-item", "top-pillar-biz"],
  ["tas-hero__biz", "top-pillar-biz-grid"],
  ["tas-hero__ai-tool-icon", "top-pillar-ai-tool__icon"],
  ["tas-hero__ai-tool-name", "top-pillar-ai-tool__name"],
  ["tas-hero__ai-tool", "top-pillar-ai-tool"],
  ["tas-hero__ai-tools", "top-pillar-ai__tools"],
  ["tas-hero__ai-plan-label", "top-pillar-ai__plan-label"],
  ["tas-hero__ai-plan-value", "top-pillar-ai__plan-value"],
  ["tas-hero__ai-plan", "top-pillar-ai__plan-box"],
  ["tas-hero__ai-foot", "top-pillar-ai__foot"],
  ["tas-hero__trust-item", "top-trust-bar__item"],
  ["tas-hero__trust-icon", "top-trust-bar__icon"],
  ["tas-hero__trust-title", "top-trust-bar__title"],
  ["tas-hero__trust-text", "top-trust-bar__text"],
  ["tas-hero__trust", "top-trust-bar"],
  ["tas-hero__stats-wrap", "top-portal-stats"],
  ["tas-hero__stats-defs", "top-stats-bar__defs"],
  ["tas-hero__stats-note", "top-portal-stats__note"],
  ["tas-hero__stats", "top-stats-bar"],
  ["tas-hero__stat-glyph", "top-stats-bar__glyph"],
  ["tas-hero__stat-icon", "top-stats-bar__icon"],
  ["tas-hero__stat-label", "top-stats-bar__label"],
  ["tas-hero__stat-value", "top-stats-bar__value"],
  ["tas-hero__stat-delta", "top-stats-bar__delta"],
  ["tas-hero__stat", "top-stats-bar__item"],
];

for (const [from, to] of pairs) {
  html = html.replaceAll(from, to);
}

html = html.replaceAll("tasHeroStat", "topHeroStat");
html = html.replace('aria-labelledby="tasHeroAiTitle"', 'aria-labelledby="heroAiTitle"');
html = html.replace('id="tasHeroAiTitle"', 'id="heroAiTitle"');

// AI badge modifier
html = html.replace(
  '<span class="top-pillar-card__badge">AIで効率UP!</span>',
  '<span class="top-pillar-card__badge top-pillar-card__badge--ai">AIで効率UP!</span>',
);

// general / business: wrap badge + title + sub in head
html = html.replace(
  /(<article class="top-pillar-card top-pillar-card--(?:general|business)"[\s\S]*?<span class="top-pillar-card__badge">[^<]*<\/span>\s*)<h2/g,
  "$1<header class=\"top-pillar-card__head\">\n            <h2",
);
html = html.replace(
  /(top-pillar-card--(?:general|business)"[\s\S]*?<p class="top-pillar-card__sub">[^<]*<\/p>)\s*(?=<div class="top-pillar-(?:cats|biz-grid))/g,
  "$1\n          </header>\n            ",
);

// business price teal
html = html.replace(
  /(<article class="top-pillar-card top-pillar-card--business"[\s\S]*?)<div class="top-pillar-card__price">/,
  '$1<div class="top-pillar-card__price top-pillar-card__price--teal">',
);

// AI: head wrap + main wrap
html = html.replace(
  /<span class="top-pillar-card__badge top-pillar-card__badge--ai">AIで効率UP!<\/span>\s*<h2 class="top-pillar-card__title" id="heroAiTitle">AI Workspace<\/h2>\s*<p class="top-pillar-card__sub">AI相談・作成・サポート<\/p>\s*<div class="top-pillar-ai__tools"/,
  `<span class="top-pillar-card__badge top-pillar-card__badge--ai">AIで効率UP!</span>
            <header class="top-pillar-card__head top-pillar-card__head--ai">
              <h2 class="top-pillar-card__title" id="heroAiTitle">AI Workspace</h2>
              <p class="top-pillar-card__sub">AI相談・作成・サポート</p>
            </header>
            <div class="top-pillar-ai__main">
              <div class="top-pillar-ai__tools"`,
);
html = html.replace(
  /<\/div>\s*<div class="top-pillar-ai__foot">/,
  `</div>
            </div>
            <div class="top-pillar-ai__foot">`,
);
html = html.replace(
  /<div class="top-pillar-card__actions">\s*<a class="top-pillar-btn top-pillar-btn--ai"/,
  '<div class="top-pillar-card__actions top-pillar-card__actions--ai">\n              <a class="top-pillar-btn top-pillar-btn--ai"',
);

// trust: drop extra classes on strong/p (optional keep)
html = html.replace(/ class="top-trust-bar__title"/g, "");
html = html.replace(/ class="top-trust-bar__text"/g, "");

// links
html = html.replace(/href="#">掲載する/g, 'href="post.html">掲載する');
html = html.replace(
  /(top-pillar-card--general[\s\S]*?top-pillar-btn--ghost" )href="#"/,
  '$1href="index.html"',
);
html = html.replace(/href="#">業者を探す/g, 'href="business.html">業者を探す');
html = html.replace(
  /(top-pillar-card--business[\s\S]*?top-pillar-btn--ghost-teal" )href="#"/,
  '$1href="business.html"',
);
html = html.replace(/href="#">無料で試す/g, 'href="chat-list.html">無料で試す');
html = html.replace(
  /(top-pillar-card--ai[\s\S]*?top-pillar-btn--ai-ghost" )href="#"/,
  '$1href="chat-list.html"',
);

const pillarBody = html.trim().replace(/^\s{8}/gm, "          ");

const searchBlock = `      <section class="top-search" aria-label="掲載検索">
        <div class="top-search__inner">
          <form class="top-search__form" action="index.html" method="get" role="search">
            <label class="visually-hidden" for="heroSearch">キーワード検索</label>
            <input id="heroSearch" class="top-search__input" type="search" name="q" placeholder="動画編集・SNS運用・AI相談 など" autocomplete="off">
            <button type="submit" class="top-search__btn" aria-label="検索">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>
            </button>
          </form>
          <div class="top-search__tags">
            <a href="index.html?q=動画編集">動画編集</a>
            <a href="index.html?q=SNS運用">SNS運用</a>
            <a href="index.html?q=AI相談">AI相談</a>
            <a href="index.html?category=job">求人</a>
            <a href="index.html?q=デザイン">デザイン</a>
            <a href="index.html?q=プログラミング">プログラミング</a>
            <a href="index.html?q=占い">占い</a>
          </div>
        </div>
      </section>`;

const heroWrap = `    <section class="top-visual-wrap top-portal-visual">
      <div class="top-portal-sparkles" aria-hidden="true"></div>
      <section class="top-portal-hero" aria-label="ポータルヒーロー">
        <div class="top-hero__overlay top-portal-hero__overlay" aria-hidden="true"></div>
        <div class="top-portal-hero__inner top-page__inner">
          <header class="top-portal-hero__head">
            <h1 class="top-portal-hero__title" id="heroTitle">つなぐ、広がる、あなたの<span class="top-portal-hero__accent">可能性</span>。</h1>
            <p class="top-portal-hero__lead">スキル・商品・求人の掲載から、法人・業務サービス、AI相談までワンストップで。</p>
          </header>

${pillarBody}
        </div>
      </section>

${searchBlock}
    </section>`;

const indexPath = path.join(root, "index-top.html");
const index = fs.readFileSync(indexPath, "utf8");
const startMark = '    <section class="top-visual-wrap">';
const endMark = '    <section class="top-section top-categories-section"';
const start = index.indexOf(startMark);
const end = index.indexOf(endMark);
if (start < 0 || end < 0) throw new Error("markers not found");
const next = index.slice(0, start) + heroWrap + "\n\n" + index.slice(end);
fs.writeFileSync(indexPath, next);
fs.writeFileSync(path.join(root, "scripts/phase3-1c-pillar-body.html"), pillarBody);
console.log("index-top.html updated", { start, end, ufffd: (next.match(/\uFFFD/g) || []).length });
