#!/usr/bin/env node
/**
 * HP-MIGRATION-1 — 企業 HP 仮ページ生成（Wix 移植前の土台）
 *   node scripts/scaffold-corp-hp.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const CSS = ["/corp-layout.css", "/corp-header.css", "/corp-footer.css"];

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function navHtml(brand, base, items, current) {
  const links = items
    .map(
      (item) =>
        `<li><a class="corp-nav__link" href="${base}${item.href}"${
          item.id === current ? ' aria-current="page"' : ""
        }>${esc(item.label)}</a></li>`
    )
    .join("\n            ");
  return `<header class="corp-header">
      <div class="corp-container corp-header__inner">
        <a class="corp-header__brand" href="${base}index.html">
          <span class="corp-header__brand-main">${esc(brand.main)}</span>
          <span class="corp-header__brand-sub">${esc(brand.sub)}</span>
        </a>
        <details class="corp-nav">
          <summary class="corp-nav__toggle" aria-label="メニューを開く">
            <span class="corp-nav__toggle-icon" aria-hidden="true"></span>
          </summary>
          <ul class="corp-nav__list">
            ${links}
          </ul>
        </details>
      </div>
    </header>`;
}

function footerHtml(brand, base, navLinks, legalLinks) {
  const nav = navLinks
    .map((l) => `<a class="corp-footer__link" href="${base}${l.href}">${esc(l.label)}</a>`)
    .join("\n          ");
  const legal = legalLinks
    .map((l) => `<a class="corp-footer__legal-link" href="${l.href}">${esc(l.label)}</a>`)
    .join("\n          ");
  return `<footer class="corp-footer">
      <div class="corp-container corp-footer__inner">
        <div>
          <p class="corp-footer__brand">${esc(brand.main)}</p>
          <p class="corp-footer__tagline">${esc(brand.tagline)}</p>
        </div>
        <nav class="corp-footer__nav" aria-label="フッターナビ">
          ${nav}
        </nav>
        <nav class="corp-footer__legal" aria-label="法務">
          ${legal}
        </nav>
        <p class="corp-footer__copy">&copy; ${new Date().getFullYear()} ${esc(brand.legalName)}. All rights reserved.</p>
      </div>
    </footer>`;
}

function page({ corp, title, desc, base, depth, nav, footerNav, footerLegal, brand, current, body }) {
  const cssLinks = CSS.map((href) => `  <link rel="stylesheet" href="${href}" />`).join("\n");
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)} | ${esc(brand.main)}</title>
  <meta name="description" content="${esc(desc)}" />
  <meta name="robots" content="noindex, nofollow" />
${cssLinks}
</head>
<body class="corp-body" data-corp="${corp}">
  ${navHtml(brand, base, nav, current)}
  <main class="corp-main">
${body}
  </main>
  ${footerHtml(brand, base, footerNav, footerLegal)}
</body>
</html>
`;
}

function hero(label, title, text, actions = "") {
  return `    <section class="corp-hero">
      <div class="corp-container corp-hero__inner">
        <p class="corp-hero__label">${esc(label)}</p>
        <h1 class="corp-hero__title">${title}</h1>
        <p class="corp-hero__text">${esc(text)}</p>
        ${actions ? `<div class="corp-hero__actions">${actions}</div>` : ""}
      </div>
    </section>`;
}

function section(title, lead, inner, eyebrow = "") {
  return `    <section class="corp-section${eyebrow ? "" : ""}">
      <div class="corp-container">
        <div class="corp-section__head">
          ${eyebrow ? `<p class="corp-section__eyebrow">${esc(eyebrow)}</p>` : ""}
          <h2 class="corp-section__title">${title}</h2>
          ${lead ? `<p class="corp-section__lead">${esc(lead)}</p>` : ""}
        </div>
        ${inner}
      </div>
    </section>`;
}

function cards(items) {
  return `<div class="corp-grid corp-grid--3">
          ${items
            .map(
              (c) => `<article class="corp-card">
            <h3 class="corp-card__title">${esc(c.title)}</h3>
            <p class="corp-card__text">${esc(c.text)}</p>
          </article>`
            )
            .join("\n          ")}
        </div>`;
}

function writePage(rel, content) {
  const file = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
  console.log("wrote", rel);
}

const TASFUL_BRAND = {
  main: "TASFUL",
  sub: "Corporate Site",
  tagline: "地域と人をつなぐ、新しいマーケットプレイスの力",
  legalName: "TASFUL Inc.",
};

const TASFUL_NAV = [
  { id: "index", href: "index.html", label: "ホーム" },
  { id: "services", href: "services.html", label: "サービス" },
  { id: "vision", href: "vision.html", label: "ビジョン" },
  { id: "about", href: "about.html", label: "会社概要" },
  { id: "faq", href: "faq.html", label: "FAQ" },
  { id: "contact", href: "contact.html", label: "お問い合わせ" },
];

const TASFUL_LEGAL = [
  { href: "/company/legal/terms.html", label: "利用規約" },
  { href: "/company/legal/privacy.html", label: "プライバシーポリシー" },
  { href: "/company/legal/tokushoho.html", label: "特定商取引法に基づく表記" },
];

const TASFUL_BASE = "/company/";

function corpBody(...parts) {
  return parts.filter(Boolean).join("\n");
}

function tasfulPage(id, title, desc, body) {
  return page({
    corp: "tasful",
    title,
    desc,
    base: TASFUL_BASE,
    current: id,
    brand: TASFUL_BRAND,
    nav: TASFUL_NAV,
    footerNav: TASFUL_NAV.filter((n) => n.id !== "index"),
    footerLegal: TASFUL_LEGAL,
    body,
  });
}

writePage(
  "company/index.html",
  tasfulPage(
    "index",
    "Corporate TOP",
    "TASFUL 企業サイト — サービス・ビジョン・会社情報（仮コンテンツ）",
    corpBody(
      hero(
        "Corporate",
        "つながりから、<br />新しい価値を。",
        "TASFUL は、地域の事業者と利用者をつなぐマーケットプレイス・コミュニケーション基盤を提供します。本ページは Wix 移植前の仮構成です。",
        '<a class="corp-btn corp-btn--primary" href="/company/services.html">サービスを見る</a>\n        <a class="corp-btn corp-btn--ghost" href="/company/contact.html">お問い合わせ</a>'
      ),
      section(
        "事業領域（仮）",
        "プラットフォーム本体とは独立した企業情報サイトです。",
        cards([
          { title: "マーケットプレイス", text: "掲載・検索・取引の基盤。小規模事業者のデジタル接点を支援します。" },
          { title: "コミュニケーション", text: "TALK を中心とした問い合わせ・案件管理の体験設計。" },
          { title: "AI 支援", text: "相談・運営・業務効率化への AI 活用を研究開発しています。" },
        ]),
        "Services"
      )
    )
  )
);

writePage(
  "company/services.html",
  tasfulPage(
    "services",
    "サービス",
    "TASFUL のサービス概要（仮）",
    corpBody(
      hero("Services", "サービス", "TASFUL が提供する主要サービスの概要です。正式な内容は Wix から移植予定。"),
      section(
        "提供サービス",
        "",
        cards([
          { title: "TASFUL プラットフォーム", text: "掲載・検索・決済・メッセージングを統合した Web サービス。" },
          { title: "Builder", text: "案件・パートナー・完了フローを支える業務支援モジュール。" },
          { title: "運営支援", text: "AI を活用した問い合わせ分類・運営オペレーション支援（開発中）。" },
        ])
      )
    )
  )
);

writePage(
  "company/vision.html",
  tasfulPage(
    "vision",
    "ビジョン",
    "TASFUL のビジョンとミッション（仮）",
    corpBody(
      hero("Vision", "誰もが、近くの価値にアクセスできる社会へ", "テクノロジーで距離を縮め、地域経済の循環を加速します。"),
      section(
        "ミッション",
        "",
        '<div class="corp-prose"><p>私たちは、デジタルの力で「見つける・つながる・続ける」をシンプルにし、事業者と利用者双方の体験を向上させます。</p><ul><li>小規模事業者のオンライン接点を低コストで提供する</li><li>安全で透明性の高い取引・コミュニケーション基盤を構築する</li><li>AI を実務に役立つ形で段階的に導入する</li></ul></div>'
      )
    )
  )
);

writePage(
  "company/about.html",
  tasfulPage(
    "about",
    "会社概要",
    "TASFUL 会社概要（仮）",
    corpBody(
      hero("About", "会社概要", "企業情報の正式データは Wix 移植時に差し替えます。"),
      section(
        "概要",
        "",
        '<div class="corp-contact-box"><dl><div><dt>会社名</dt><dd>TASFUL Inc.（仮表記）</dd></div><div><dt>所在地</dt><dd>〒000-0000 東京都（移植時に更新）</dd></div><div><dt>代表者</dt><dd>代表取締役（移植時に更新）</dd></div><div><dt>事業内容</dt><dd>Web プラットフォームの企画・開発・運営</dd></div></dl></div><p class="corp-placeholder-note" style="margin-top:1rem">※ 本ページは HP-MIGRATION-1 仮構成です。</p>'
      )
    )
  )
);

writePage(
  "company/faq.html",
  tasfulPage(
    "faq",
    "FAQ",
    "TASFUL 企業サイト FAQ（仮）",
    corpBody(
      hero("FAQ", "よくある質問", "企業サイトに関する一般的な質問（仮）。"),
      section(
        "",
        "",
        '<div class="corp-faq"><details><summary>このサイトは本番版ですか？</summary><div class="corp-faq__body">いいえ。Cloudflare Pages 上の仮土台です。デザイン・文言は Wix から順次移植します。</div></details><details><summary>プラットフォームへのログインはここからできますか？</summary><div class="corp-faq__body">本企業サイトとは別系統です。サービス利用はプラットフォーム側の入口から行います（移植時にリンク整備予定）。</div></details><details><summary>お問い合わせ方法は？</summary><div class="corp-faq__body"><a href="/company/contact.html">お問い合わせページ</a>のフォーム（仮）をご利用ください。</div></details></div>'
      )
    )
  )
);

writePage(
  "company/contact.html",
  tasfulPage(
    "contact",
    "お問い合わせ",
    "TASFUL 企業サイト お問い合わせ（仮）",
    corpBody(
      hero("Contact", "お問い合わせ", "法人・取材・パートナーシップに関するお問い合わせ（仮）。"),
      section(
        "連絡先",
        "フォーム送信機能は Wix 移植時に実装します。",
        '<div class="corp-contact-box"><dl><div><dt>メール（仮）</dt><dd>corp@tasful.jp</dd></div><div><dt>受付時間</dt><dd>平日 10:00–18:00（仮）</dd></div><div><dt>お問い合わせ種別</dt><dd>取材 / 提携 / 採用 / その他</dd></div></dl></div><p class="corp-placeholder-note" style="margin-top:1rem">フォーム UI は未実装 — コンテンツ移植フェーズで追加。</p>'
      )
    )
  )
);

function tasfulLegalPage(id, title, desc, bodyContent) {
  return page({
    corp: "tasful",
    title,
    desc,
    base: TASFUL_BASE,
    current: id,
    brand: TASFUL_BRAND,
    nav: TASFUL_NAV,
    footerNav: TASFUL_NAV.filter((n) => n.id !== "index"),
    footerLegal: TASFUL_LEGAL,
    body: `    <section class="corp-section">
      <div class="corp-container corp-prose">
        <p class="corp-legal-meta">最終更新: 2026-06-18（仮）</p>
        <h1 class="corp-section__title">${esc(title)}</h1>
        ${bodyContent}
        <p class="corp-placeholder-note">正式な条文・表記は Wix から移植後に差し替えます。</p>
      </div>
    </section>`,
  });
}

writePage(
  "company/legal/terms.html",
  tasfulLegalPage(
    "terms",
    "利用規約",
    "TASFUL 利用規約（仮）",
    `<p>本利用規約は、TASFUL が提供するサービスの利用条件を定めるものです（仮置き）。</p>
        <h2>第1条（適用）</h2>
        <p>本規約は、ユーザーと当社との間の一切の関係に適用されます。</p>
        <h2>第2条（禁止事項）</h2>
        <ul><li>法令または公序良俗に反する行為</li><li>当社または第三者の権利を侵害する行為</li></ul>`
  )
);

writePage(
  "company/legal/privacy.html",
  tasfulLegalPage(
    "privacy",
    "プライバシーポリシー",
    "TASFUL プライバシーポリシー（仮）",
    `<p>当社は、取得した個人情報を適切に管理し、利用目的の範囲内で取り扱います（仮置き）。</p>
        <h2>1. 取得する情報</h2>
        <p>氏名、メールアドレス、利用ログ等（移植時に詳細化）。</p>
        <h2>2. 利用目的</h2>
        <p>サービス提供、サポート、改善、法令対応。</p>`
  )
);

writePage(
  "company/legal/tokushoho.html",
  tasfulLegalPage(
    "tokushoho",
    "特定商取引法に基づく表記",
    "TASFUL 特商法表記（仮）",
    `<p>特定商取引法に基づく表記（仮）。</p>
        <h2>販売事業者</h2>
        <p>TASFUL Inc.（仮）</p>
        <h2>所在地</h2>
        <p>移植時に記載</p>
        <h2>連絡先</h2>
        <p>corp@tasful.jp（仮）</p>`
  )
);

const IWASHO_BRAND = {
  main: "IWASHO",
  sub: "Corporate Site",
  tagline: "洗濯・リネンサプライの次世代ソリューション",
  legalName: "IWASHO Inc.",
};

const IWASHO_NAV = [
  { id: "index", href: "index.html", label: "ホーム" },
  { id: "services", href: "services.html", label: "サービス" },
  { id: "about", href: "about.html", label: "会社概要" },
  { id: "team", href: "team.html", label: "チーム" },
  { id: "partners", href: "partners.html", label: "パートナー" },
  { id: "contact", href: "contact.html", label: "お問い合わせ" },
];

const IWASHO_LEGAL = [{ href: "/iwasho/privacy.html", label: "プライバシーポリシー" }];

const IWASHO_BASE = "/iwasho/";

function iwashoPage(id, title, desc, body) {
  return page({
    corp: "iwasho",
    title,
    desc,
    base: IWASHO_BASE,
    current: id,
    brand: IWASHO_BRAND,
    nav: IWASHO_NAV,
    footerNav: IWASHO_NAV.filter((n) => n.id !== "index"),
    footerLegal: IWASHO_LEGAL,
    body,
  });
}

writePage(
  "iwasho/index.html",
  iwashoPage(
    "index",
    "Corporate TOP",
    "IWASHO 企業サイト — 洗濯・リネン事業（仮コンテンツ）",
    corpBody(
      hero(
        "IWASHO",
        "リネンサプライを、<br />もっとスマートに。",
        "ホテル・施設・事業者向けの洗濯・リネンソリューション。Wix 移植前の仮構成です。",
        '<a class="corp-btn corp-btn--primary" href="/iwasho/services.html">サービス</a>\n        <a class="corp-btn corp-btn--ghost" href="/iwasho/contact.html">お問い合わせ</a>'
      ),
      section(
        "強み（仮）",
        "",
        cards([
          { title: "品質管理", text: "標準化された洗濯工程と検品フロー（仮説明）。" },
          { title: "物流ネットワーク", text: "エリア拠点からの安定供給（仮説明）。" },
          { title: "デジタル連携", text: "発注・在庫・請求の可視化（移植予定）。" },
        ]),
        "Features"
      )
    )
  )
);

writePage(
  "iwasho/services.html",
  iwashoPage(
    "services",
    "サービス",
    "IWASHO サービス概要（仮）",
    corpBody(
      hero("Services", "サービス", "リネンサプライ・洗濯代行・関連コンサル（仮）。"),
      section(
        "サービス一覧",
        "",
        cards([
          { title: "リネンリース", text: "シーツ・タオル等の定期供給。" },
          { title: "洗濯代行", text: "施設向けバッチ洗濯・特殊クリーニング。" },
          { title: "コンサルティング", text: "コスト最適化・工程改善支援。" },
        ])
      )
    )
  )
);

writePage(
  "iwasho/about.html",
  iwashoPage(
    "about",
    "会社概要",
    "IWASHO 会社概要（仮）",
    corpBody(
      hero("About", "会社概要", "企業情報は Wix 移植時に正式データへ差し替え。"),
      section(
        "",
        "",
        '<div class="corp-contact-box"><dl><div><dt>会社名</dt><dd>IWASHO Inc.（仮表記）</dd></div><div><dt>所在地</dt><dd>（移植時に更新）</dd></div><div><dt>事業内容</dt><dd>リネンサプライ・洗濯関連サービス</dd></div></dl></div>'
      )
    )
  )
);

writePage(
  "iwasho/team.html",
  iwashoPage(
    "team",
    "チーム",
    "IWASHO チーム紹介（仮）",
    corpBody(
      hero("Team", "チーム", "メンバー紹介は Wix から移植予定。"),
      section(
        "",
        "",
        '<div class="corp-team"><article class="corp-card"><div class="corp-team__avatar" aria-hidden="true">CEO</div><h3 class="corp-card__title">代表（仮）</h3><p class="corp-card__text">リネン業界のオペレーション reform をリード。</p></article><article class="corp-card"><div class="corp-team__avatar" aria-hidden="true">COO</div><h3 class="corp-card__title">運営責任者（仮）</h3><p class="corp-card__text">物流・品質管理の標準化を担当。</p></article></div>'
      )
    )
  )
);

writePage(
  "iwasho/partners.html",
  iwashoPage(
    "partners",
    "パートナー",
    "IWASHO パートナー（仮）",
    corpBody(
      hero("Partners", "パートナー", "連携先・加盟パートナー（仮一覧）。"),
      section(
        "",
        "",
        cards([
          { title: "ホテル・宿泊", text: "全国規模の宿泊施設との取引（仮）。" },
          { title: "医療・介護", text: "リネン需要の高い施設向け供給（仮）。" },
          { title: "物流パートナー", text: "エリア配送ネットワーク（仮）。" },
        ])
      )
    )
  )
);

writePage(
  "iwasho/contact.html",
  iwashoPage(
    "contact",
    "お問い合わせ",
    "IWASHO お問い合わせ（仮）",
    corpBody(
      hero("Contact", "お問い合わせ", "法人のお客様・パートナー候補向け（仮）。"),
      section(
        "",
        "",
        '<div class="corp-contact-box"><dl><div><dt>メール（仮）</dt><dd>info@iwasho.example</dd></div><div><dt>電話（仮）</dt><dd>03-0000-0000</dd></div></dl></div><p class="corp-placeholder-note" style="margin-top:1rem">フォームはコンテンツ移植フェーズで実装。</p>'
      )
    )
  )
);

writePage(
  "iwasho/privacy.html",
  page({
    corp: "iwasho",
    title: "プライバシーポリシー",
    desc: "IWASHO プライバシーポリシー（仮）",
    base: IWASHO_BASE,
    current: "privacy",
    brand: IWASHO_BRAND,
    nav: IWASHO_NAV,
    footerNav: IWASHO_NAV.filter((n) => n.id !== "index"),
    footerLegal: IWASHO_LEGAL,
    body: `    <section class="corp-section">
      <div class="corp-container corp-prose">
        <p class="corp-legal-meta">最終更新: 2026-06-18（仮）</p>
        <h1 class="corp-section__title">プライバシーポリシー</h1>
        <p>IWASHO は、お客様の個人情報を適切に保護します（仮置き）。</p>
        <h2>1. 収集する情報</h2>
        <p>会社名、担当者名、連絡先、利用履歴等。</p>
        <h2>2. 第三者提供</h2>
        <p>法令に基づく場合を除き、同意なく第三者に提供しません。</p>
        <p class="corp-placeholder-note">正式版は Wix から移植後に差し替えます。</p>
      </div>
    </section>`,
  })
);

console.log("\nSUMMARY: corp HP scaffold complete");
