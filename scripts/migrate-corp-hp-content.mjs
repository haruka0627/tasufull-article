#!/usr/bin/env node
/**
 * HP-MIGRATION-2 — Wix 埋め込みコンテンツ → 企業 HP ページ生成
 *   node scripts/migrate-corp-hp-content.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mdToHtml, renderPage, writePage } from "./lib/corp-shell.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function copyAssets() {
  const tasfulSrc = path.join(ROOT, "source/wix/tasful-images");
  const tasfulDest = path.join(ROOT, "images/corp/tasful");
  fs.mkdirSync(tasfulDest, { recursive: true });
  if (fs.existsSync(tasfulSrc)) {
    for (const name of fs.readdirSync(tasfulSrc)) {
      if (name.endsWith(".png")) {
        fs.copyFileSync(path.join(tasfulSrc, name), path.join(tasfulDest, name));
      }
    }
  }
  const iwashoLogo = path.join(ROOT, "images/corp/iwasho/logo.jpg");
  if (!fs.existsSync(iwashoLogo)) {
    fs.mkdirSync(path.dirname(iwashoLogo), { recursive: true });
    const dl = path.join(process.env.USERPROFILE || "", "Downloads");
    if (fs.existsSync(dl)) {
      const hit = fs.readdirSync(dl).find((n) => /^IWASHO/i.test(n) && /\.jpe?g$/i.test(n));
      if (hit) fs.copyFileSync(path.join(dl, hit), iwashoLogo);
    }
  }
}

function bizHead(title) {
  return `<div class="corp-biz-head"><span class="corp-biz-head__bar" aria-hidden="true"></span><h2 class="corp-biz-head__title">${title}</h2></div>`;
}

function sectionWrap(inner) {
  return `    <section class="corp-section">\n      <div class="corp-container corp-container--wide corp-biz-page">\n${inner}\n      </div>\n    </section>`;
}

function iwashoConstructionCard() {
  return `<div class="corp-biz-card">
          <div class="corp-biz-label corp-biz-label--gold">REAL BUSINESS</div>
          <h3 class="corp-biz-card__title">現場力とネットワークによる柔軟な対応力</h3>
          <p class="corp-biz-card__lead">関東エリアを中心に、解体・外構・足場・改装工事など幅広い施工に対応。協力会社ネットワークと実務経験を活かし、スピードと品質の両立を実現しています。</p>
          <div class="corp-biz-info-grid">
            <div class="corp-biz-info"><h4 class="corp-biz-info__title">対応工事</h4><p class="corp-biz-info__text">解体／足場／外構／エクステリア／改装 など</p></div>
            <div class="corp-biz-info"><h4 class="corp-biz-info__title">対応エリア</h4><p class="corp-biz-info__text">東京・神奈川・埼玉・茨城中心</p></div>
            <div class="corp-biz-info"><h4 class="corp-biz-info__title">強み</h4><p class="corp-biz-info__text">実働経験・元請け対応・協力会社ネットワーク</p></div>
          </div>
        </div>`;
}

function tasfulPlatformCard() {
  return `<div class="corp-biz-card">
          <div class="corp-biz-label corp-biz-label--blue">PLATFORM</div>
          <h3 class="corp-biz-card__title">誰でもすぐ使えるシンプルなマッチング</h3>
          <p class="corp-biz-card__lead">TASFULは「今すぐ」「簡単に」を重視したプラットフォームです。LINEベースの導線により、複雑な操作なしで依頼や応募が可能です。</p>
          <div class="corp-biz-feature-grid">
            <div class="corp-biz-feature"><strong class="corp-biz-feature__title">依頼掲載</strong><p class="corp-biz-feature__text">困りごとをすぐ投稿</p></div>
            <div class="corp-biz-feature"><strong class="corp-biz-feature__title">求人募集</strong><p class="corp-biz-feature__text">人手不足を解決</p></div>
            <div class="corp-biz-feature"><strong class="corp-biz-feature__title">スキル販売</strong><p class="corp-biz-feature__text">個人・事業者の収益化</p></div>
            <div class="corp-biz-feature"><strong class="corp-biz-feature__title">LINE完結</strong><p class="corp-biz-feature__text">登録・連絡・通知すべてLINE</p></div>
          </div>
        </div>`;
}

function tasfulAiCard() {
  return `<div class="corp-biz-card">
          <div class="corp-biz-label corp-biz-label--green">AI SERVICE</div>
          <h3 class="corp-biz-card__title">相談・整理・生成をサポートするAI</h3>
          <p class="corp-biz-card__lead">タスフルAIは、依頼内容の整理や相場の把握、文章生成などを通じて、利用者の判断をサポートするAI機能です。</p>
          <div class="corp-biz-ai-grid">
            <div class="corp-biz-ai"><h4 class="corp-biz-ai__title">無料AI</h4><p class="corp-biz-ai__text">相談・相場確認</p></div>
            <div class="corp-biz-ai"><h4 class="corp-biz-ai__title">有料AI</h4><p class="corp-biz-ai__text">生成・業務効率化</p></div>
          </div>
        </div>`;
}

function pillarsGrid() {
  return `<div class="corp-biz-pillar-grid">
          <article class="corp-biz-pillar"><div class="corp-biz-pillar__icon" aria-hidden="true">🏗️</div><h3 class="corp-biz-pillar__title">建設業（IWASHO）</h3><p class="corp-biz-pillar__text">実際の現場対応・施工・協力体制</p></article>
          <article class="corp-biz-pillar"><div class="corp-biz-pillar__icon" aria-hidden="true">📱</div><h3 class="corp-biz-pillar__title">TASFUL</h3><p class="corp-biz-pillar__text">依頼・人材・スキルをつなぐ仕組み</p></article>
          <article class="corp-biz-pillar"><div class="corp-biz-pillar__icon" aria-hidden="true">🤖</div><h3 class="corp-biz-pillar__title">タスフルAI</h3><p class="corp-biz-pillar__text">相談・生成・判断をサポート</p></article>
        </div>`;
}

function contactCta(base, includePartner) {
  const partnerBtn = includePartner
    ? `\n          <a class="corp-external-cta corp-external-cta--secondary" href="${base}contact.html#partner">パートナー登録（準備中）</a>`
    : "";
  return `    <section class="corp-biz-cta">
      <div class="corp-container corp-container--wide">
        <h2 class="corp-biz-cta__title">ご相談・協力パートナー募集</h2>
        <p class="corp-biz-cta__lead">建設案件・業務提携・サービス利用など、お気軽にお問い合わせください。</p>
        <div class="corp-biz-cta__actions">
          <a class="corp-external-cta" href="${base}contact.html#contact-form">お問い合わせ</a>${partnerBtn}
        </div>
      </div>
    </section>`;
}

function contactFormBlock(brandName) {
  return sectionWrap(`
        ${bizHead("お問い合わせ")}
        <p class="corp-section__lead">フォーム送信は Wix からの移行に伴い外部サービスへ暫定誘導します。</p>
        <div class="corp-contact-box" id="contact-form">
          <dl>
            <div><dt>お問い合わせ方法</dt><dd>外部フォーム（暫定 CTA）</dd></div>
            <div><dt>対象</dt><dd>${brandName} に関するご相談・協力・取材</dd></div>
          </dl>
        </div>
        <p class="corp-contact-cta-wrap">
          <a class="corp-external-cta" href="#contact-form">外部お問い合わせフォーム（URL 設定待ち）</a>
        </p>
        <p class="corp-external-cta-note">※ 本番 URL 確定後に href を差し替えます（Wix 依存コードは除去済み）。</p>
        <div class="corp-contact-box corp-contact-box--spaced" id="partner">
          <dl>
            <div><dt>パートナー登録</dt><dd>協力会社・業務提携のご希望（準備中）</dd></div>
          </dl>
        </div>`);
}

function brandLogo(src) {
  return fs.existsSync(path.join(ROOT, src))
    ? `<img class="corp-header__logo" src="/${src.replace(/\\/g, "/")}" alt="" width="40" height="40" />`
    : "";
}

function iwashoBrand() {
  return {
    main: "IWASHO",
    sub: "建設・施工",
    tagline: "関東エリアの建設・外構・足場 — 現場力とネットワーク",
    legalName: "IWASHO",
    logoHtml: brandLogo("images/corp/iwasho/logo.jpg"),
  };
}

const IWASHO_NAV = [
  { id: "index", href: "index.html", label: "ホーム" },
  { id: "services", href: "services.html", label: "サービス" },
  { id: "about", href: "about.html", label: "会社概要" },
  { id: "team", href: "team.html", label: "チーム", visible: false },
  { id: "partners", href: "partners.html", label: "パートナー" },
  { id: "contact", href: "contact.html", label: "お問い合わせ" },
];

const IWASHO_LEGAL = [{ href: "/iwasho/privacy.html", label: "プライバシーポリシー" }];
const IWASHO_BASE = "/iwasho/";

function tasfulBrand() {
  return {
    main: "TASFUL",
    sub: "Corporate",
    tagline: "建設 × プラットフォーム × AI — 依頼から解決まで",
    legalName: "TASFUL",
    logoHtml: brandLogo("images/corp/tasful/1.png"),
  };
}

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

function iwashoPage(id, title, desc, bodyParts) {
  return renderPage({
    corp: "iwasho",
    title,
    desc,
    brand: iwashoBrand(),
    base: IWASHO_BASE,
    nav: IWASHO_NAV,
    footerNav: IWASHO_NAV,
    footerLegal: IWASHO_LEGAL,
    current: id,
    robots: "index",
    body: bodyParts.join("\n"),
  });
}

function tasfulPage(id, title, desc, bodyParts) {
  return renderPage({
    corp: "tasful",
    title,
    desc,
    brand: tasfulBrand(),
    base: TASFUL_BASE,
    nav: TASFUL_NAV,
    footerNav: TASFUL_NAV,
    footerLegal: TASFUL_LEGAL,
    current: id,
    robots: "index",
    body: bodyParts.join("\n"),
  });
}

copyAssets();

// --- IWASHO ---
// iwasho/index.html — HP-MIGRATION-5 で手維持（Wix TOP）。migrate では上書きしない。
console.log("  SKIP iwasho/index.html (HP-MIGRATION-5 hand-maintained TOP)");

writePage(
  ROOT,
  "iwasho/about.html",
  iwashoPage("about", "会社概要", "IWASHO 会社概要", [
    sectionWrap(`${bizHead("会社概要")}${iwashoConstructionCard()}
        <div class="corp-contact-box corp-contact-box--spaced">
          <dl>
            <div><dt>事業内容</dt><dd>建設・解体・外構・足場・改装工事</dd></div>
            <div><dt>対応エリア</dt><dd>東京・神奈川・埼玉・茨城中心</dd></div>
            <div><dt>強み</dt><dd>元請け対応 · 協力会社ネットワーク · 現場実務経験</dd></div>
          </dl>
        </div>`),
  ])
);

writePage(
  ROOT,
  "iwasho/services.html",
  iwashoPage("services", "サービス", "IWASHO 対応工事・エリア", [
    sectionWrap(`${bizHead("提供サービス")}
        <div class="corp-biz-info-grid">
          <div class="corp-biz-info"><h4 class="corp-biz-info__title">解体工事</h4><p class="corp-biz-info__text">建築物・内装解体に対応</p></div>
          <div class="corp-biz-info"><h4 class="corp-biz-info__title">足場工事</h4><p class="corp-biz-info__text">安全基準に沿った足場組立</p></div>
          <div class="corp-biz-info"><h4 class="corp-biz-info__title">外構・エクステリア</h4><p class="corp-biz-info__text">外構整備・外構リニューアル</p></div>
          <div class="corp-biz-info"><h4 class="corp-biz-info__title">改装工事</h4><p class="corp-biz-info__text">内装・改修の現場調整</p></div>
          <div class="corp-biz-info"><h4 class="corp-biz-info__title">協力会社手配</h4><p class="corp-biz-info__text">ネットワークを活かした職人・業者手配</p></div>
          <div class="corp-biz-info"><h4 class="corp-biz-info__title">対応エリア</h4><p class="corp-biz-info__text">東京 · 神奈川 · 埼玉 · 茨城</p></div>
        </div>`),
  ])
);

writePage(
  ROOT,
  "iwasho/partners.html",
  iwashoPage("partners", "パートナー", "IWASHO 協力パートナー", [
    sectionWrap(`${bizHead("協力パートナー")}
        <p class="corp-section__lead">元請け・協力会社・関連業者とのネットワークを拡大中です。</p>
        <div class="corp-grid corp-grid--3">
          <article class="corp-card"><h3 class="corp-card__title">元請け・一般建設</h3><p class="corp-card__text">関東圏の現場に柔軟に対応</p></article>
          <article class="corp-card"><h3 class="corp-card__title">専門工事業者</h3><p class="corp-card__text">解体 · 足場 · 外構 · 内装</p></article>
          <article class="corp-card"><h3 class="corp-card__title">新規協力募集</h3><p class="corp-card__text">施工パートナー・業務提携を歓迎</p></article>
        </div>`),
    contactCta(IWASHO_BASE, false),
  ])
);

writePage(
  ROOT,
  "iwasho/contact.html",
  iwashoPage("contact", "お問い合わせ", "IWASHO お問い合わせ", [contactFormBlock("IWASHO")])
);

writePage(
  ROOT,
  "iwasho/privacy.html",
  iwashoPage("privacy", "プライバシーポリシー", "IWASHO プライバシーポリシー", [
    `    <section class="corp-section">
      <div class="corp-container corp-prose">
        <p class="corp-legal-meta">最終更新: 2025年（Wix 原文ベース · 個人事業者名等は要確認）</p>
        <h1 class="corp-section__title">プライバシーポリシー</h1>
        <p>IWASHO（以下「当社」）は、お問い合わせ・協力パートナー募集等を通じて取得する個人情報を、適切に管理します。</p>
        <h2>1. 取得する情報</h2>
        <p>氏名、会社名、連絡先、お問い合わせ内容、施工に関する情報等。</p>
        <h2>2. 利用目的</h2>
        <p>お問い合わせ対応、見積・施工の検討、協力パートナー連絡、法令対応。</p>
        <h2>3. 第三者提供</h2>
        <p>法令に基づく場合を除き、同意なく第三者に提供しません。</p>
        <h2>4. お問い合わせ</h2>
        <p><a href="/iwasho/contact.html">お問い合わせページ</a>よりご連絡ください。</p>
      </div>
    </section>`,
  ])
);

// team.html — ページは残し nav 非表示
writePage(
  ROOT,
  "iwasho/team.html",
  renderPage({
    corp: "iwasho",
    title: "チーム",
    desc: "IWASHO チーム",
    brand: iwashoBrand(),
    base: IWASHO_BASE,
    nav: IWASHO_NAV,
    footerNav: IWASHO_NAV,
    footerLegal: IWASHO_LEGAL,
    current: "team",
    robots: "noindex",
    body: sectionWrap(`<p class="corp-placeholder-note">チーム紹介コンテンツは Wix 原文未回収のため準備中です。URL 直アクセスのみ。</p>`),
  })
);

// --- TASFUL company ---
writePage(
  ROOT,
  "company/index.html",
  tasfulPage(
    "index",
    "Corporate TOP",
    "TASFUL 企業サイト — 建設 × プラットフォーム × AI",
    [
      `    <section class="corp-biz-hero">
      <div class="corp-container corp-container--wide">
        <p class="corp-biz-badge">IWASHO × TASFUL</p>
        <h1 class="corp-biz-hero__title">建設 × プラットフォーム × AIで<br />依頼から解決までを一気通貫でサポート</h1>
        <p class="corp-biz-hero__lead">現場対応・人材/依頼のマッチング・AI支援を組み合わせ、従来の非効率を改善し、スピードと精度の高い課題解決を実現します。</p>
      </div>
    </section>`,
      sectionWrap(`${bizHead("事業の全体像")}${pillarsGrid()}`),
      sectionWrap(`${bizHead("建設事業（IWASHO）")}${iwashoConstructionCard()}`),
      sectionWrap(`${bizHead("TASFUL（プラットフォーム）")}${tasfulPlatformCard()}`),
      sectionWrap(`${bizHead("タスフルAI")}${tasfulAiCard()}`),
      contactCta(TASFUL_BASE, true),
    ]
  )
);

writePage(
  ROOT,
  "company/services.html",
  tasfulPage("services", "サービス", "TASFUL サービス — プラットフォームと AI", [
    sectionWrap(`${bizHead("TASFUL プラットフォーム")}${tasfulPlatformCard()}`),
    sectionWrap(`${bizHead("タスフルAI")}${tasfulAiCard()}`),
  ])
);

writePage(
  ROOT,
  "company/vision.html",
  tasfulPage("vision", "ビジョン", "TASFUL ビジョン", [
    `    <section class="corp-biz-hero">
      <div class="corp-container corp-container--wide">
        <p class="corp-biz-badge">VISION</p>
        <h1 class="corp-biz-hero__title">依頼から解決まで、<br />もっとシンプルに</h1>
        <p class="corp-biz-hero__lead">現場の力 · マッチング · AI を組み合わせ、地域の「困った」を解決するインフラを目指します。</p>
      </div>
    </section>`,
    sectionWrap(`${bizHead("3つの軸")}${pillarsGrid()}`),
  ])
);

writePage(
  ROOT,
  "company/about.html",
  tasfulPage("about", "会社概要", "TASFUL 会社概要", [
    sectionWrap(`${bizHead("運営会社")}
        <div class="corp-contact-box">
          <dl>
            <div><dt>法人名</dt><dd>〇〇株式会社（Wix 原文 · 正式表記要確認）</dd></div>
            <div><dt>サービス名</dt><dd>タスフル（TASFUL）</dd></div>
            <div><dt>事業内容</dt><dd>オンラインプラットフォーム運営 · 建設関連事業（IWASHO）· AI 支援</dd></div>
            <div><dt>お問い合わせ</dt><dd>フォームのみ（電話対応なし）</dd></div>
          </dl>
        </div>
        <p class="corp-placeholder-note corp-placeholder-note--spaced">所在地・代表者名は Wix / 特商法表記と同期して更新してください。</p>`),
  ])
);

writePage(
  ROOT,
  "company/faq.html",
  tasfulPage("faq", "FAQ", "TASFUL よくある質問", [
    sectionWrap(`<div class="corp-faq">
          <details><summary>TASFUL とは何ですか？</summary><div class="corp-faq__body">依頼・求人・スキル販売をつなぐマッチングプラットフォームです。LINE ベースで登録・連絡・通知が完結します。</div></details>
          <details><summary>IWASHO との関係は？</summary><div class="corp-faq__body">建設・現場施工を担う事業ブランドです。TASFUL プラットフォームと連携し、現場力とデジタルを組み合わせています。</div></details>
          <details><summary>決済前に連絡先を交換できますか？</summary><div class="corp-faq__body">利用規約により、決済完了前の連絡先交換は禁止されています。</div></details>
          <details><summary>お問い合わせ方法は？</summary><div class="corp-faq__body"><a href="/company/contact.html">お問い合わせページ</a>の外部フォーム（暫定）をご利用ください。</div></details>
        </div>`),
  ])
);

writePage(
  ROOT,
  "company/contact.html",
  tasfulPage("contact", "お問い合わせ", "TASFUL お問い合わせ", [contactFormBlock("TASFUL")])
);

const termsMd = fs.readFileSync(path.join(ROOT, "source/wix/tasful-terms.md"), "utf8");
writePage(
  ROOT,
  "company/legal/terms.html",
  tasfulPage("terms", "利用規約", "TASFUL 利用規約", [
    `    <section class="corp-section">
      <div class="corp-container corp-prose">
        <p class="corp-legal-meta">最終更新: 2026年4月21日（source/wix/tasful-terms.md より移植）</p>
        ${mdToHtml(termsMd)}
      </div>
    </section>`,
  ])
);

writePage(
  ROOT,
  "company/legal/privacy.html",
  tasfulPage("privacy", "プライバシーポリシー", "TASFUL プライバシーポリシー", [
    `    <section class="corp-section">
      <div class="corp-container corp-prose">
        <p class="corp-legal-meta">最終更新: 2025年（Wix docx 原文 · 〇〇表記要置換）</p>
        <h1 class="corp-section__title">プライバシーポリシー</h1>
        <p>〇〇株式会社（以下「当社」）は、当社が運営するサービス「タスフル（TASFUL）」（以下「本サービス」）において取り扱う個人情報の保護に努めます。</p>
        <h2>第1条 事業者情報</h2>
        <ul>
          <li>法人名: 〇〇株式会社（要確認）</li>
          <li>代表者: （Wix 原文より転記予定）</li>
          <li>所在地: （Wix 原文より転記予定）</li>
          <li>お問い合わせ: 本サービス内お問い合わせフォーム（電話対応なし）</li>
        </ul>
        <h2>第2条 取得する個人情報</h2>
        <p>氏名、メールアドレス、LINE ID、利用ログ、決済履歴、IP アドレス等（Wix 原文 docx 詳細を同期予定）。</p>
        <h2>第3条 利用目的</h2>
        <p>サービス提供、本人確認、サポート、不正利用防止、法令対応。</p>
        <h2>第4条 第三者提供</h2>
        <p>法令に基づく場合を除き、同意なく第三者に提供しません。</p>
      </div>
    </section>`,
  ])
);

writePage(
  ROOT,
  "company/legal/tokushoho.html",
  tasfulPage("tokushoho", "特定商取引法に基づく表記", "TASFUL 特商法表記", [
    `    <section class="corp-section">
      <div class="corp-container corp-prose">
        <p class="corp-legal-meta">Wix / docx 原文同期予定</p>
        <h1 class="corp-section__title">特定商取引法に基づく表記</h1>
        <dl class="corp-contact-box">
          <div><dt>販売事業者</dt><dd>〇〇株式会社</dd></div>
          <div><dt>運営責任者</dt><dd>（要確認）</dd></div>
          <div><dt>所在地</dt><dd>（要確認）</dd></div>
          <div><dt>お問い合わせ</dt><dd><a href="/company/contact.html">お問い合わせフォーム</a></dd></div>
          <div><dt>販売価格</dt><dd>各サービスページに表示（システム利用料等）</dd></div>
          <div><dt>支払方法</dt><dd>クレジットカード等（プラットフォーム決済）</dd></div>
        </dl>
      </div>
    </section>`,
  ])
);

console.log("SUMMARY: HP-MIGRATION-2 pages generated");
console.log("  IWASHO: index, about, services, partners, contact, privacy (+ team hidden)");
console.log("  TASFUL company: index, services, vision, about, faq, contact, legal/*");
