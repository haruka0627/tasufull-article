/**
 * TASFUL 共通サイトシェル — ホームと同一の header / footer
 */

export const SHELL_CSS = ["/tas-top-page.css", "/corp-company-hp.css"];

export const NAV_ITEMS = [
  { id: "home", href: "/company/", label: "ホーム" },
  { id: "services", href: "/company/services.html", label: "サービス一覧" },
  { id: "partner", href: "/company/contact.html", label: "協力パートナー" },
  { id: "team", href: "/iwasho/team.html", label: "チーム紹介" },
  { id: "about", href: "/company/about.html", label: "会社概要" },
  { id: "faq", href: "/company/faq.html", label: "Q&A" },
];

export const MOBILE_NAV_ITEMS = [
  { id: "home", href: "/company/", label: "ホーム" },
  { id: "construction", href: "/iwasho/services.html", label: "建設・サービス業" },
  { id: "partner", href: "/company/contact.html", label: "協力パートナー" },
  { id: "team", href: "/iwasho/team.html", label: "チーム紹介" },
  { id: "about", href: "/company/about.html", label: "会社概要" },
  { id: "faq", href: "/company/faq.html", label: "Q&A" },
];

export const MOBILE_LEGAL_ITEMS = [
  { id: "terms", href: "/company/legal/terms.html", label: "利用規約" },
  { id: "privacy", href: "/company/legal/privacy.html", label: "プライバシーポリシー" },
  { id: "tokushoho", href: "/company/legal/tokushoho.html", label: "特定商取引法" },
];

/** @param {readonly { id: string, href: string, label: string }[]} items @param {string | null | undefined} currentNavId */
function renderMobileNavLinks(items, currentNavId) {
  return items
    .map((item) => {
      const current = item.id === currentNavId ? ' aria-current="page"' : "";
      return `          <a href="${item.href}"${current}>${item.label}</a>`;
    })
    .join("\n");
}

/** @param {string | null | undefined} currentNavId */
export function renderTasfulHeader(currentNavId) {
  const navLinks = NAV_ITEMS.map((item) => {
    const current = item.id === currentNavId ? ' aria-current="page"' : "";
    return `        <a href="${item.href}"${current}>${item.label}</a>`;
  }).join("\n");

  const mobileNavLinks = renderMobileNavLinks(MOBILE_NAV_ITEMS, currentNavId);
  const mobileLegalLinks = renderMobileNavLinks(MOBILE_LEGAL_ITEMS, currentNavId);

  return `<header class="custom-header">
    <div class="header-inner">
      <div class="header-brand">
        <span class="logo-image-wrap">
          <span class="logo-globe">
            <img src="/images/tasful/tasful-globe-logo.png" alt="TASFUL ロゴ" class="logo-image">
          </span>
        </span>
        <div class="logo">
          TASFUL
        </div>
      </div>
      <nav class="tas-hp-header__nav" aria-label="メインナビ">
${navLinks}
      </nav>
      <a class="tas-hp-header__line-btn" href="/service" aria-label="TASFUL PLATFORM"><span class="tas-hp-header__line-btn-label tas-hp-header__line-btn-label--full">TASFUL PLATFORM</span><span class="tas-hp-header__line-btn-label tas-hp-header__line-btn-label--short" aria-hidden="true">PLATFORM</span></a>
      <button type="button" class="tas-hp-header__menu-btn" aria-label="メニューを開く" aria-expanded="false" aria-controls="tas-hp-mobile-nav"><span class="tas-hp-header__menu-btn-icon" aria-hidden="true">☰</span></button>
    </div>
    <div class="tas-hp-header__mobile-panel" id="tas-hp-mobile-nav" aria-hidden="true">
      <button type="button" class="tas-hp-header__mobile-backdrop" data-tas-hp-menu-close aria-label="メニューを閉じる"></button>
      <div class="tas-hp-header__mobile-drawer">
        <nav class="tas-hp-header__mobile-nav tas-hp-header__mobile-nav--primary" aria-label="メインナビ">
${mobileNavLinks}
        </nav>
        <nav class="tas-hp-header__mobile-nav tas-hp-header__mobile-nav--legal" aria-label="法的情報">
          <p class="tas-hp-header__mobile-nav-label">法的情報</p>
${mobileLegalLinks}
        </nav>
      </div>
    </div>
  </header>`;
}

export function renderTasfulFooter() {
  return `<footer class="modern-footer">
  <div class="footer-inner">
    
    <div class="footer-main">
      <div class="footer-brand">
        <h2 class="footer-logo">TASFUL</h2>
        <div class="company-info">
          <p class="name">IWASHO合同会社</p>
          <p class="desc">事業内容：建設関連工事・美装・防蟻・業務委託調整</p>
        </div>
      </div>

      <div class="footer-nav">
        <div class="link-col link-col--company">
          <h4>企業情報</h4>
          <div class="link-list">
            <a href="/company/about.html">会社概要</a>
            <a href="/iwasho/team.html">チーム紹介</a>
            <a href="/iwasho/partners.html">協力パートナー</a>
          </div>
        </div>

        <div class="link-col link-col--services">
          <h4>サービス</h4>
          <div class="link-list">
            <a href="/company/services.html" class="footer-link--sp-only">サービス一覧</a>
            <a href="/iwasho/services.html">建設・サービス業</a>
            <a href="/service">プラットフォーム</a>
            <a href="/gen-ai-workspace.html">TASFUL AI</a>
            <a href="/talk-home.html">TASFUL TALK</a>
            <a href="/builder/">TASFUL BUILDER</a>
            <a href="#">TASFUL SOUND</a>
          </div>
        </div>

        <div class="link-col link-col--forms">
          <h4>各種フォーム</h4>
          <div class="link-list">
            <a href="/iwasho/contact.html">お問い合わせ</a>
            <a href="/company/contact.html">協力パートナー登録</a>
          </div>
        </div>

        <div class="link-col link-col--legal-sp footer-link--sp-only">
          <h4>規約・ポリシー</h4>
          <div class="link-list">
            <a href="/company/legal/terms.html">利用規約</a>
            <a href="/company/legal/privacy.html">プライバシーポリシー</a>
            <a href="/company/legal/tokushoho.html">特定商取引法に基づく表記</a>
          </div>
        </div>
      </div>
    </div>

    <div class="footer-bottom">
      <p class="note">※ IWASHOは美装・防蟻、TASFULは建設業務委託・調整ユニットとして運営しています。</p>
      <div class="link-list footer-bottom-legal footer-link--pc-only">
        <a href="/company/legal/terms.html">利用規約</a>
        <a href="/company/legal/privacy.html">プライバシーポリシー</a>
        <a href="/company/legal/tokushoho.html">特定商取引法に基づく表記</a>
      </div>
      <p class="copy">&copy; 2026 IWASHO合同会社 All Rights Reserved.</p>
    </div>

  </div>
</footer>
<script src="/tas-hp-header-menu.js" defer></script>`;
}

export const PAGE_NAV = {
  "company/index.html": "home",
  "company/services.html": "services",
  "company/contact.html": "partner",
  "company/faq.html": "faq",
  "company/about.html": "about",
  "company/vision.html": null,
  "company/legal/terms.html": "terms",
  "company/legal/privacy.html": "privacy",
  "company/legal/tokushoho.html": "tokushoho",
  "iwasho/index.html": null,
  "iwasho/about.html": null,
  "iwasho/services.html": "construction",
  "iwasho/partners.html": "partner",
  "iwasho/contact.html": null,
  "iwasho/team.html": "team",
  "iwasho/company.html": null,
  "iwasho/privacy.html": null,
};

export const SHELL_PAGE_PATHS = Object.keys(PAGE_NAV);
