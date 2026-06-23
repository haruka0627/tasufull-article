/**
 * IWASHO 専用サイトシェル（完成版）
 * 復元元: corp-biz-home.css (.iw-site-header / .footer-wrapper)
 *         source/wix/iwasho-footer.embed.html
 *         iwasho/contact.html（agent transcript 完成版）
 */

import { FOOTER_SNS_GROUP_HTML } from "./iwasho-footer-sns.mjs";

export const IWASHO_NAV = [
  { id: "home", href: "/iwasho/", label: "ホーム" },
  { id: "about", href: "/iwasho/about.html", label: "事業内容" },
  { id: "services", href: "/iwasho/services.html", label: "対応業務" },
  { id: "partners", href: "/iwasho/partners.html", label: "パートナー募集" },
  { id: "team", href: "/iwasho/team.html", label: "チーム紹介" },
  { id: "company", href: "/iwasho/company.html", label: "会社概要" },
  { id: "contact", href: "/iwasho/contact.html", label: "お問い合わせ" },
];

export const PAGE_ACTIVE = {
  "index.html": "home",
  "about.html": "about",
  "services.html": "services",
  "partners.html": "partners",
  "team.html": "team",
  "company.html": "company",
  "contact.html": "contact",
  "privacy.html": null,
};

function navLink(item, activeId) {
  const active = item.id === activeId ? ' class="is-active"' : "";
  return `<a href="${item.href}"${active}>${item.label}</a>`;
}

export function renderIwashoHeader(activeId) {
  const links = IWASHO_NAV.map((item) => navLink(item, activeId)).join("\n            ");

  return `<header class="iw-site-header">
  <div class="iw-site-header__inner">
    <a class="iw-site-header__brand" href="/iwasho/">
      <span class="iw-site-header__logo">IWASHO <span class="iw-site-header__times">&times;</span> TASFUL</span>
      <span class="iw-site-header__tagline">現場をつなぐ、未来をつくる</span>
    </a>
    <div class="iw-site-header__nav-and-btn">
      <nav class="iw-site-header__nav" aria-label="メインナビゲーション">
            ${links}
      </nav>
      <div class="iw-site-header__actions">
        <a class="iw-site-header__btn iw-site-header__btn--primary" href="/iwasho/partners.html#partner">
          協力パートナー募集
          <span class="iw-site-header__btn-arrow" aria-hidden="true">→</span>
        </a>
      </div>
    </div>
    <button type="button" class="iw-site-header__menu-btn" aria-label="メニューを開く" aria-expanded="false" data-iw-menu-toggle>
      <span></span><span></span><span></span>
    </button>
  </div>
</header>`;
}

export function renderIwashoFooter() {
  return `<div class="footer-wrapper">
  <div class="footer-inner">
    <div class="footer-col">
      <h4 class="footer-col-title">IWASHO合同会社</h4>
      <div class="company-desc">
        <p class="footer-text">新築・中古・リフォームの現場管理</p>
        <p class="footer-text">パートナーネットワーク事業</p>
      </div>
      ${FOOTER_SNS_GROUP_HTML}
    </div>
    <div class="footer-col">
      <h4 class="footer-col-title">事業内容</h4>
      <ul class="footer-links">
        <li><a href="/iwasho/about.html">・IWASHO事業<br>（メーカー案件）</a></li>
        <li><a href="/service">・TASFUL事業<br>（業者検索・支援）</a></li>
        <li><a href="/builder/">・Builder<br>（業務支援ツール）</a></li>
      </ul>
    </div>
    <div class="footer-col">
      <h4 class="footer-col-title">対応業務</h4>
      <ul class="footer-links">
        <li><a href="/iwasho/services.html">・対応カテゴリ一覧</a></li>
        <li><a href="/iwasho/services.html#iw-svc-realm-title">・除外対象工事</a></li>
      </ul>
    </div>
    <div class="footer-col">
      <h4 class="footer-col-title">パートナー募集</h4>
      <ul class="footer-links">
        <li><a href="/iwasho/partners.html#partner">・パートナー登録の流れ</a></li>
        <li><a href="/iwasho/partners.html#iw-ptn-benefits-title">・利用できるツール</a></li>
        <li><a href="/company/faq.html">・よくあるご質問</a></li>
      </ul>
    </div>
    <div class="footer-col">
      <h4 class="footer-col-title">法務</h4>
      <ul class="footer-links">
        <li><a href="/iwasho/terms.html">・利用規約</a></li>
        <li><a href="/iwasho/partner-terms.html">・協力パートナー利用規約</a></li>
        <li><a href="/iwasho/privacy.html">・プライバシーポリシー</a></li>
      </ul>
    </div>
    <div class="footer-col">
      <h4 class="footer-col-title">お問い合わせ</h4>
      <div class="contact-box">
        <p class="footer-text">ご相談・ご質問など</p>
        <p class="footer-text">お気軽にご連絡ください。</p>
        <a href="/iwasho/contact.html" class="contact-btn">
          <span>お問い合わせはこちら</span>
          <svg class="btn-mail-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
        </a>
      </div>
    </div>
  </div>
  <div class="copyright">&copy; 2026 IWASHO合同会社 All Rights Reserved.</div>
</div>`;
}
