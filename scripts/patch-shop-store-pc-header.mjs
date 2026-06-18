import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "shop-store.html");
let html = fs.readFileSync(out, "utf8");

const start = html.indexOf('<header class="tasful-market-mall-header"');
const end = html.indexOf("</header>", start) + "</header>".length;
if (start < 0 || end <= start) {
  console.error("header not found");
  process.exit(1);
}

const newHeader = `  <header class="tasful-market-mall-header" data-tasful-market-header aria-label="TASFUL市場">
    <div class="tasful-market-mall-header__stack">
      <div class="tasful-market-mall-header__top">
        <a href="shop-store.html" class="tasful-market-mall-header__logo" aria-label="TASFUL市場トップ">
          <span class="tasful-market-mall-header__logo-mark" aria-hidden="true">T</span>
          <span class="tasful-market-mall-header__logo-text">TASFUL<em>市場</em></span>
          <div class="tasful-header-pc__brand">
            <img class="tasful-header-pc__logo" src="images/tasful-globe-logo.png" alt="TASFUL" width="58" height="58" decoding="async">
            <span class="tasful-header-pc__brand-text">TASFUL市場</span>
          </div>
        </a>
        <div class="tasful-market-mall-header__search-row">
        <form class="tasful-market-mall-header__search" role="search" data-tasful-market-search-form action="shop-search.html" method="get">
          <input
            type="search"
            name="keyword"
            class="tasful-market-mall-header__search-input"
            data-tasful-market-search-input
            placeholder="商品名・キーワードで検索"
            aria-label="商品名・キーワードで検索"
          >
          <button type="submit" class="tasful-market-mall-header__search-btn" aria-label="検索">
            <svg class="tasful-market-mall-header__search-btn-icon" width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" stroke-width="2"></circle><path d="M13 13l4.5 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path></svg>
          </button>
        </form>
        </div>
        <div class="tasful-market-mall-header__actions">
          <a href="shop-market-mypage.html" class="tasful-market-mall-header__account" aria-label="マイページ">
            <span class="tasful-market-mall-header__account-icon" aria-hidden="true">👤</span>
            <span class="tasful-market-mall-header__account-label">マイページ</span>
            <span class="tasful-market-mall-header__action-lines" aria-hidden="true"><span class="tasful-market-mall-header__action-primary">ひろ</span><span class="tasful-market-mall-header__action-sub">マイページ</span></span>
          </a>
          <a href="shop-market-listing-new.html" class="tasful-market-mall-header__sell" data-tasful-market-header-sell aria-label="出品する">
            <span class="tasful-market-mall-header__sell-icon" aria-hidden="true">🏷</span>
            <span class="tasful-market-mall-header__sell-label">出品する</span>
            <span class="tasful-market-mall-header__action-lines" aria-hidden="true"><span class="tasful-market-mall-header__action-primary">出品する</span><span class="tasful-market-mall-header__action-sub">出品</span></span>
          </a>
          <a href="shop-market-order-history.html" class="tasful-market-mall-header__orders" aria-label="注文履歴">
            <span class="tasful-market-mall-header__orders-icon" aria-hidden="true">📋</span>
            <span class="tasful-market-mall-header__orders-label">注文履歴</span>
            <span class="tasful-market-mall-header__action-lines" aria-hidden="true"><span class="tasful-market-mall-header__action-primary">注文履歴</span><span class="tasful-market-mall-header__action-sub">注文</span></span>
          </a>
          <a href="shop-market-cart.html" class="tasful-market-mall-header__cart" aria-label="カート">
            <span class="tasful-market-mall-header__cart-icon" aria-hidden="true">🛒</span>
            <span class="tasful-market-mall-header__cart-badge" data-tasful-market-cart-count hidden>0</span>
            <span class="tasful-market-mall-header__cart-label">カート</span>
            <span class="tasful-market-mall-header__action-lines" aria-hidden="true"><span class="tasful-market-mall-header__action-primary">カート</span><span class="tasful-market-mall-header__action-sub">&gt;</span></span>
          </a>
        </div>
        <div class="tasful-header-pc__actions">
          <a href="shop-market-mypage.html" class="tasful-header-pc__action" aria-label="マイページ">
            <span class="tasful-header-pc__icon"><svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true" focusable="false"><circle cx="18" cy="18" r="16" fill="none" stroke="currentColor" stroke-width="1.5"></circle><circle cx="18" cy="14" r="5" fill="currentColor"></circle><path d="M8 30c0-5.5 4.5-10 10-10s10 4.5 10 10" fill="currentColor"></path></svg></span>
            <span class="tasful-header-pc__main">ひろ⌄</span>
            <span class="tasful-header-pc__sub">マイページ</span>
          </a>
          <a href="shop-market-listing-new.html" class="tasful-header-pc__action" data-tasful-market-header-sell aria-label="出品する">
            <span class="tasful-header-pc__icon"><svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true" focusable="false"><path d="M10 12h16l-2 16H12L10 12z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"></path><path d="M8 12h20l-2-4H10l-2 4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"></path><path d="M14 20v4M22 20v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path></svg></span>
            <span class="tasful-header-pc__main">出品する</span>
            <span class="tasful-header-pc__sub">出品</span>
          </a>
          <a href="shop-market-order-history.html" class="tasful-header-pc__action" aria-label="注文履歴">
            <span class="tasful-header-pc__icon"><svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true" focusable="false"><rect x="10" y="6" width="16" height="24" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"></rect><path d="M14 12h8M14 17h8M14 22h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path><path d="M22 6v4h4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"></path></svg></span>
            <span class="tasful-header-pc__main">注文履歴</span>
            <span class="tasful-header-pc__sub">注文</span>
          </a>
          <a href="shop-market-cart.html" class="tasful-header-pc__action tasful-header-pc__action--cart" aria-label="カート">
            <span class="tasful-header-pc__icon-wrap">
              <span class="tasful-header-pc__icon"><svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true" focusable="false"><path d="M8 8h3l2.5 14h11L27 12H11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path><circle cx="15" cy="28" r="2" fill="currentColor"></circle><circle cx="24" cy="28" r="2" fill="currentColor"></circle></svg></span>
              <span class="tasful-header-pc__badge" data-tasful-market-cart-count hidden>0</span>
            </span>
            <span class="tasful-header-pc__main">カート</span>
            <span class="tasful-header-pc__sub">&gt;</span>
          </a>
        </div>
      </div>
    </div>
    <nav class="tasful-market-mall-header__nav" aria-label="市場カテゴリ">
      <div class="tasful-market-mall-header__nav-scroll" data-tasful-market-nav></div>
    </nav>
  </header>`;

html = html.slice(0, start) + newHeader + html.slice(end);
fs.writeFileSync(out, html, "utf8");
console.log("patched shop-store.html PC header");
