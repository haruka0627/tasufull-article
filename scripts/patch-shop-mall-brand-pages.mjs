#!/usr/bin/env node
/**
 * 店舗販売4ページ — 共通ブランドパッチ（レイアウト構造は維持）
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const MARKET_FOOTER = `  <footer class="tasful-market-footer tasful-shop-mall-footer" aria-label="TASFUL市場フッター">
    <div class="tasful-market-footer__inner">
      <div class="tasful-market-footer__brand-block">
        <p class="tasful-market-footer__brand">TASFUL市場</p>
        <p class="tasful-market-footer__lead">安心して売買できる</p>
        <p class="tasful-market-footer__sub">TASFULのショッピングマーケット</p>
      </div>

      <nav class="tasful-market-footer__block" aria-labelledby="tasful-shop-mall-footer-guide">
        <h2 class="tasful-market-footer__heading" id="tasful-shop-mall-footer-guide">ご利用ガイド</h2>
        <ul class="tasful-market-footer__links">
          <li><a href="index-top.html">配送について</a></li>
          <li><a href="index-top.html">返品・キャンセル</a></li>
          <li><a href="ai-workspace.html">よくある質問</a></li>
          <li><a href="index-top.html">お問い合わせ</a></li>
        </ul>
      </nav>

      <nav class="tasful-market-footer__block" aria-labelledby="tasful-shop-mall-footer-seller">
        <h2 class="tasful-market-footer__heading" id="tasful-shop-mall-footer-seller">出品する</h2>
        <ul class="tasful-market-footer__links">
          <li><a href="post.html?scope=business">出店ガイド</a></li>
          <li><a href="builder/mvp-partner-register.html">Connect認証について</a></li>
        </ul>
      </nav>

      <p class="tasful-market-footer__copy">© TASFUL</p>
    </div>
  </footer>`;

function patchShopProducts() {
  const file = path.join(root, "shop-products.html");
  let html = fs.readFileSync(file, "utf8");

  if (!html.includes("shop-vendors-brand.css")) {
    html = html.replace(
      '<link rel="stylesheet" href="shop-products.css">',
      '<link rel="stylesheet" href="shop-products.css">\n  <link rel="stylesheet" href="shop-vendors-brand.css">'
    );
  }

  html = html.replace(
    '<body class="shop-store-list-page shop-products-page" data-page="shop_products">',
    '<body class="shop-store-list-page shop-products-page tasful-shop-mall-brand" data-page="shop_products">'
  );

  html = html.replace(
    '<a href="shop-store.html" class="link">店舗・販売一覧</a>',
    '<a href="shop-vendors.html" class="link">店舗・販売一覧</a>'
  );

  html = html.replace(
    /src="images\/tasful-(?:market-header-logo|ai-globe)\.png[^"]*"/,
    'src="images/tasful-globe-logo.png"'
  );
  html = html.replace(
    'aria-label="TASFUL プラットフォームTOP"',
    'aria-label="TASFUL 店舗・販売 TOP"'
  );
  html = html.replace('alt=""', 'alt="TASFUL"');
  html = html.replace(
    'class="tasful-ai-logo-icon"\n        >',
    'class="tasful-ai-logo-icon"\n          width="58"\n          height="58"\n          decoding="async"\n        >'
  );
  html = html.replace('<span class="sub">プラットフォーム</span>', '<span class="sub">店舗・販売</span>');

  html = html.replace(/action="shop-store\.html"/g, 'action="shop-vendors.html"');
  html = html.replace(/href="shop-store\.html/g, 'href="shop-vendors.html');

  html = html.replace(
    /  <footer class="shop-products-footer">[\s\S]*?<\/footer>\n/,
    `${MARKET_FOOTER}\n\n`
  );
  if (html.includes("shop-products-footer")) {
    html = html.replace(
      /  <footer class="shop-products-footer">[\s\S]*?<\/footer>/,
      MARKET_FOOTER.trim()
    );
  }

  fs.writeFileSync(file, html, "utf8");
  console.log("Patched shop-products.html");
}

function patchDetailShopStore() {
  const file = path.join(root, "detail-shop-store.html");
  let html = fs.readFileSync(file, "utf8");

  html = html.replace(
    /src="images\/tasful-(?:market-header-logo|ai-globe|globe-logo)\.png[^"]*"/,
    'src="images/tasful-globe-logo.png"'
  );
  html = html.replace(
    'aria-label="TASFUL プラットフォームTOP"',
    'aria-label="TASFUL 店舗・販売 TOP"'
  );
  if (!html.includes('alt="TASFUL"')) {
    html = html.replace('alt=""', 'alt="TASFUL"');
  }
  html = html.replace(
    /class="tasful-ai-logo-icon"\s*\n\s*>/,
    'class="tasful-ai-logo-icon"\n          width="58"\n          height="58"\n          decoding="async"\n        >'
  );

  html = html.replace(/action="shop-store\.html"/g, 'action="shop-vendors.html"');
  html = html.replace(/href="shop-store\.html/g, 'href="shop-vendors.html');

  fs.writeFileSync(file, html, "utf8");
  console.log("Patched detail-shop-store.html");
}

function patchDetailShopProduct() {
  const file = path.join(root, "detail-shop-product.html");
  let html = fs.readFileSync(file, "utf8");

  if (!html.includes("shop-vendors-brand.css")) {
    html = html.replace(
      '<link rel="stylesheet" href="shop-market-product-detail.css">',
      '<link rel="stylesheet" href="shop-market-product-detail.css">\n  <link rel="stylesheet" href="shop-vendors-brand.css">'
    );
  }

  html = html.replace(
    '<body class="tasful-market-page tasful-market-product-page" data-page="shop_market_product">',
    '<body class="tasful-market-page tasful-market-product-page tasful-shop-mall-brand" data-page="shop_market_product">'
  );

  fs.writeFileSync(file, html, "utf8");
  console.log("Patched detail-shop-product.html");
}

patchShopProducts();
patchDetailShopStore();
patchDetailShopProduct();
